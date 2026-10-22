export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || 'error';
  }
}
export const bad = (message, code = 'invalid') => new HttpError(400, message, code);

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, secure, path = '/' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=Lax`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  if (secure) c += '; Secure';
  return c;
}

export async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, 'El contenido es demasiado grande.', 'too_large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req, limit) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { throw bad('El cuerpo no es JSON válido.', 'bad_json'); }
}

export function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store', ...headers });
  res.end(body);
}

/** Limitador simple en memoria (por proceso): suficiente para una instalación por cliente. */
export function createLimiter() {
  const hits = new Map();
  return {
    check(key, max, windowMs, now = Date.now()) {
      const h = hits.get(key);
      if (!h || h.reset <= now) { hits.set(key, { n: 1, reset: now + windowMs }); return; }
      h.n += 1;
      if (h.n > max) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 'rate_limited');
    },
    sweep(now = Date.now()) { for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); },
  };
}

export const intOr = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.trunc(Number(v)) : d);
export const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const nowIso = () => new Date().toISOString();
