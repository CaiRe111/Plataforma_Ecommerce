import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { openDb } from './db/index.js';
import { createRouter } from './http/router.js';
import { HttpError, cookie, createLimiter, parseCookies, readBody, sendJson } from './http/util.js';
import { COOKIE, bootstrapAdmin, getSession, purgeExpiredSessions } from './auth.js';
import { registerRoutes } from './routes.js';
import { createWompiClient, expireUnpaidOrders } from './payments/wompi.js';
import { processInvoices } from './invoicing/service.js';
import { processEmails, rememberPublicUrl, mailTransportOk } from './mail/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };

const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

export async function createApp({ config = loadConfig(), db, fetchImpl, publicDir = path.join(HERE, '..', 'public') } = {}) {
  db = db || openDb(path.join(config.dataDir, 'app.db'));
  const uploadsDir = path.join(config.dataDir, 'uploads');
  const sharedDir = path.join(HERE, 'shared');
  const limiter = createLimiter();
  const wompi = config.wompi.enabled ? createWompiClient(config, fetchImpl) : null;
  const router = createRouter();
  registerRoutes(router, { config, db, limiter, wompi, uploadsDir });
  if (!mailTransportOk(config)) throw new Error(`MAIL_TRANSPORT="${config.mail.transport}" no está disponible. Opciones: outbox.`);
  rememberPublicUrl(db, config.publicUrl);
  await bootstrapAdmin(db, config.admin);

  const origin = new URL(config.publicUrl).origin;

  async function serveStatic(req, res, pathname) {
    let rel = pathname === '/' ? '/index.html' : pathname;
    let base = publicDir;
    if (rel.startsWith('/uploads/')) { base = uploadsDir; rel = rel.slice('/uploads'.length); }
    else if (rel === '/shared/pricing.js') { base = sharedDir; rel = '/pricing.js'; }
    const file = path.normalize(path.join(base, rel));
    if (!file.startsWith(base + path.sep) && file !== base) return false;
    let st;
    try { st = fs.statSync(file); } catch { return false; }
    if (!st.isFile()) return false;
    const ext = path.extname(file).toLowerCase();
    const cache = ext === '.html' ? 'no-cache' : base === uploadsDir ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'content-length': st.size, 'cache-control': cache, ...SECURITY });
    if (req.method === 'HEAD') return res.end(), true;
    fs.createReadStream(file).pipe(res);
    return true;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const pathname = url.pathname;
    const ip = (config.trustProxy && (req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim())) || req.socket.remoteAddress || '';
    try {
      // Wompi devuelve al cliente aquí (con ?id=<transacción>); se reenvía a la pantalla del pedido, que consulta el estado real.
      if (pathname === '/pago/retorno' && req.method === 'GET') {
        const raw = req.url;
        const pick = k => (new RegExp('[?&]' + k + '=([^&#]+)').exec(raw) || [])[1] || '';
        const o = pick('o').replace(/\D/g, ''), t = pick('t').replace(/[^\w-]/g, ''), id = pick('id').replace(/[^\w-]/g, '');
        res.writeHead(302, { location: `/#/pedido/${o}?t=${t}${id ? '&tx=' + id : ''}`, 'cache-control': 'no-store', ...SECURITY });
        return res.end();
      }
      if (!pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, 'Método no permitido.', 'method');
        if (await serveStatic(req, res, pathname)) return;
        throw new HttpError(404, 'No encontrado.', 'not_found');
      }
      const { route, params, pathMatched } = router.match(req.method, pathname);
      if (!route) throw pathMatched ? new HttpError(405, 'Método no permitido.', 'method') : new HttpError(404, 'No encontrado.', 'not_found');

      const cookies = parseCookies(req.headers.cookie);
      if (!['GET', 'HEAD'].includes(req.method) && !pathname.startsWith('/api/webhooks/')) {
        const o = req.headers.origin;
        if (o && o !== origin && new URL(o).host !== req.headers.host) throw new HttpError(403, 'Origen no permitido.', 'bad_origin');
      }
      const setCookies = [];
      const ctx = {
        req, res, ip, params, query: url.searchParams, cookies, body: {}, rawBody: null, customer: null, admin: null,
        setCookie(name, value, maxAge) { setCookies.push(cookie(name, value, { maxAge, secure: config.secureCookies })); },
        clearCookie(name) { setCookies.push(cookie(name, '', { maxAge: 0, secure: config.secureCookies })); },
      };
      const cid = getSession(db, 'customer', cookies[COOKIE.customer]);
      if (cid) ctx.customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(cid) || null;
      const aid = getSession(db, 'admin', cookies[COOKIE.admin]);
      if (aid) ctx.admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(aid) || null;
      if (route.auth === 'admin' && !ctx.admin) throw new HttpError(401, 'Inicia sesión como administrador.', 'unauthorized');

      if (!['GET', 'HEAD', 'DELETE'].includes(req.method)) {
        if (route.raw) ctx.rawBody = await readBody(req, pathname.endsWith('/image') ? 3_000_000 : 1_000_000);
        else {
          const buf = await readBody(req);
          if (buf.length) {
            if (!String(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, 'Se esperaba JSON.', 'unsupported');
            try { ctx.body = JSON.parse(buf.toString('utf8')); } catch { throw new HttpError(400, 'El cuerpo no es JSON válido.', 'bad_json'); }
          }
        }
      }
      let out = await route.handler(ctx);
      if (!['GET', 'HEAD'].includes(req.method)) await processEmails(db, config);
      let status = 200;
      if (out && out.status && out.body) { status = out.status; out = out.body; }
      sendJson(res, status, out ?? { ok: true }, { ...SECURITY, ...(setCookies.length ? { 'set-cookie': setCookies } : {}) });
    } catch (e) {
      if (e instanceof HttpError) return sendJson(res, e.status, { error: { code: e.code, message: e.message } }, SECURITY);
      console.error('[error]', req.method, pathname, e);
      sendJson(res, 500, { error: { code: 'internal', message: 'Ocurrió un error inesperado. Inténtalo de nuevo.' } }, SECURITY);
    }
  });

  // Tareas periódicas: sesiones vencidas, pedidos sin pagar y cola de facturas.
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      purgeExpiredSessions(db);
      limiter.sweep();
      await expireUnpaidOrders(db, config, wompi);
      await processInvoices(db);
      await processEmails(db, config);
    } catch (e) { console.error('[jobs]', e); } finally { busy = false; }
  };
  const timer = config.jobsIntervalMs > 0 ? setInterval(tick, config.jobsIntervalMs) : null;
  timer?.unref();

  return {
    server, db, config, tick,
    listen: (port = config.port, host = config.host) => new Promise(r => server.listen(port, host, () => r(server.address()))),
    close: () => new Promise(r => { clearInterval(timer); server.close(() => { try { db.close(); } catch { /* ya cerrada */ } r(); }); server.closeAllConnections?.(); }),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const app = await createApp({ config });
  const addr = await app.listen();
  console.log(`Tienda lista en ${config.publicUrl} (puerto ${addr.port}). Pagos en línea: ${config.paymentMode === 'demo' ? 'SIMULADOS (demostración)' : config.wompi.enabled ? 'Wompi ' + config.wompi.env : 'sin configurar'}.`);
  const stop = () => app.close().then(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
