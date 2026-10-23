// El servidor completo (rutas, dominio, facturación, correo y pasarela simulada) corriendo dentro del navegador.
// Es el mismo código de app/src: aquí solo se reemplazan la base de datos, el reloj de tareas y la red.
import demo from '../../app/src/seed/demo.json';
import { loadConfig } from '../../app/src/config.js';
import { openDb } from '../../app/src/db/index.js';
import { createRouter } from '../../app/src/http/router.js';
import { HttpError, createLimiter } from '../../app/src/http/util.js';
import { COOKIE, bootstrapAdmin, createSession, getSession } from '../../app/src/auth.js';
import { registerRoutes } from '../../app/src/routes.js';
import { applyDemo } from '../../app/src/seed/apply.js';
import { createOrder, advanceOrder, getOrderRow } from '../../app/src/domain/orders.js';
import { updateFiscal } from '../../app/src/domain/settings.js';
import { createResolution, processInvoices } from '../../app/src/invoicing/service.js';
import { processEmails, rememberPublicUrl } from '../../app/src/mail/index.js';
import { initSqlite } from '../shims/sqlite.js';

export const STORES = Object.fromEntries(Object.entries(demo).map(([k, v]) => [k, `${v.store.name} · ${v.label}`]));
const KEY_STORE = 'pe-demo-store', KEY_DB = k => `pe-demo-db-v1:${k}`;
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }, del: k => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } } };

export const currentStoreKey = () => (STORES[store.get(KEY_STORE)] ? store.get(KEY_STORE) : 'moda');
export function switchStore(key) { store.set(KEY_STORE, key); }
export function resetDemo() { Object.keys(STORES).forEach(k => store.del(KEY_DB(k))); }

/** Pedidos de ejemplo repartidos en los últimos 14 días, para que el panel no se vea vacío. */
async function seedOrders(db, config) {
  let s = 11; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const products = db.prepare("SELECT * FROM products WHERE status = 'active' AND (stock IS NULL OR stock > 8)").all();
  const people = [['Camila Torres', 'camila.t@correo.com'], ['Andrés Rojas', 'andres.rojas@correo.com'], ['Sofía Herrera', 'sofia.herrera@correo.com'], ['Julián Castro', 'julian.castro@correo.com'], ['Laura Mejía', 'laura.mejia@correo.com'], ['Daniel Pardo', 'daniel.pardo@correo.com']];
  const digital = db.prepare("SELECT value FROM settings WHERE key = 'store'").get().value.includes('"type":"digital"');
  for (let i = 0; i < 18; i++) {
    const p = products[Math.floor(rnd() * products.length)], who = people[Math.floor(rnd() * people.length)];
    const opts = {}; JSON.parse(p.options).forEach(o => { opts[o.name] = o.values[Math.floor(rnd() * o.values.length)]; });
    let id;
    try {
      id = createOrder({ db, config }, { items: [{ pid: p.id, qty: 1 + Math.floor(rnd() * 2), opts }], method: 'transfer',
        buyer: { name: who[0], email: who[1], phone: '3105550142', docType: 'CC', docNumber: String(1000000000 + Math.floor(rnd() * 8e8)), address: digital ? '' : 'Calle 45 #12-30', city: digital ? '' : 'Medellín' } }, null);
    } catch { continue; }
    const age = Math.floor(rnd() * 14), at = new Date(Date.now() - age * 864e5 - Math.floor(rnd() * 10) * 36e5).toISOString();
    const steps = age > 8 ? 4 : age > 4 ? 3 : age > 1 ? 2 : Math.floor(rnd() * 2); // cuántos pasos avanza el pedido
    for (let k = 0; k < steps; k++) { try { advanceOrder(db, id); } catch { break; } }
    db.prepare('UPDATE orders SET created_at = ?, paid_at = CASE WHEN paid_at IS NULL THEN NULL ELSE ? END WHERE id = ?').run(at, at, id);
    db.prepare('UPDATE order_events SET at = ? WHERE order_id = ?').run(at, id);
  }
  await processInvoices(db);
  db.prepare('DELETE FROM emails').run(); // los correos de esta carga inicial no interesan
}

export async function startBackend() {
  await initSqlite();
  const key = currentStoreKey();
  const config = loadConfig({ paymentMode: 'demo', mailTransport: 'outbox', publicUrl: 'https://demo.tienda.example', dataDir: '/data', jobsIntervalMs: 0, adminEmail: 'admin@demo.co', adminPassword: 'demo1234' });
  const saved = store.get(KEY_DB(key));
  globalThis.__SQLITE_RESTORE__ = saved ? unb64(saved) : undefined;
  const db = openDb(':memory:');
  rememberPublicUrl(db, config.publicUrl);
  await bootstrapAdmin(db, config.admin);
  if (!saved) {
    await applyDemo(db, demo[key], { accounts: true });
    updateFiscal(db, { enabled: true, nit: '900123456', dv: '7', legalName: `${demo[key].store.name} S.A.S.`, tradeName: demo[key].store.name, address: 'Calle 10 #20-30', cityName: 'Medellín', cityCode: '05001', departmentName: 'Antioquia', departmentCode: '05', email: 'facturas@demo.co', phone: '6041234567' });
    createResolution(db, { resolutionNumber: '18760000001', prefix: 'SETP', from: 990000001, to: 995000000, validFrom: '2026-01-01', validTo: '2027-12-31' });
    await seedOrders(db, config);
  }

  const limiter = createLimiter();
  const router = createRouter();
  registerRoutes(router, { config, db, limiter, wompi: null, uploadsDir: '/uploads' });
  const jar = {};
  jar[COOKIE.admin] = createSession(db, 'admin', db.prepare('SELECT id FROM admins LIMIT 1').get().id).token; // en la demo el panel se abre directo

  let timer = null;
  const persist = () => { clearTimeout(timer); timer = setTimeout(() => { try { const d = db.snapshot(); if (d.length < 3.5e6) store.set(KEY_DB(key), b64(d)); } catch { /* demasiado grande o sin almacenamiento */ } }, 400); };

  async function handle(method, url, bodyText) {
    const u = new URL(url, 'http://demo.local'), path = u.pathname;
    const out = (status, body) => ({ status, body });
    try {
      const { route, params, pathMatched } = router.match(method, path);
      if (!route) throw new HttpError(pathMatched ? 405 : 404, 'No encontrado.', 'not_found');
      if (path.endsWith('/image') && method === 'POST') throw new HttpError(400, 'La carga de fotos no está disponible en la demostración.', 'demo');
      let body = {};
      if (bodyText) { try { body = JSON.parse(bodyText); } catch { throw new HttpError(400, 'El cuerpo no es JSON válido.', 'bad_json'); } }
      const cid = getSession(db, 'customer', jar[COOKIE.customer]), aid = getSession(db, 'admin', jar[COOKIE.admin]);
      const ctx = {
        req: { headers: {} }, ip: 'demo', params, query: u.searchParams, cookies: { ...jar }, body, rawBody: null,
        customer: cid ? db.prepare('SELECT * FROM customers WHERE id = ?').get(cid) || null : null,
        admin: aid ? db.prepare('SELECT * FROM admins WHERE id = ?').get(aid) || null : null,
        setCookie(name, value) { jar[name] = value; }, clearCookie(name) { delete jar[name]; },
      };
      if (route.auth === 'admin' && !ctx.admin) throw new HttpError(401, 'Inicia sesión como administrador.', 'unauthorized');
      let res = await route.handler(ctx), status = 200;
      if (res && res.status && res.body) { status = res.status; res = res.body; }
      if (method !== 'GET') { await processEmails(db, config); await processInvoices(db); persist(); }
      return out(status, res ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return out(e.status, { error: { code: e.code, message: e.message } });
      console.error('[demo]', e);
      return out(500, { error: { code: 'internal', message: 'Ocurrió un error inesperado. Inténtalo de nuevo.' } });
    }
  }
  return { handle, key };
}

/** Intercepta las llamadas a /api/* y las atiende con el servidor del navegador. */
export function installFetch(backend) {
  const native = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('/api/')) return native(input, init);
    const r = await backend.handle((init.method || 'GET').toUpperCase(), url, typeof init.body === 'string' ? init.body : undefined);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  };
}
