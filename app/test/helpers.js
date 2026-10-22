import crypto from 'node:crypto';
import { createApp } from '../src/server.js';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db/index.js';

export const WOMPI = { publicKey: 'pub_test_abc', privateKey: 'prv_test_abc', eventsSecret: 'test_events_secret', integritySecret: 'test_integrity_secret' };

const open = new Set();
export const closeAll = () => Promise.all([...open].map(f => f()));

export async function boot(over = {}) {
  const config = loadConfig({
    publicUrl: 'http://localhost:3000', dataDir: '/tmp/pe-test-' + crypto.randomBytes(4).toString('hex'), jobsIntervalMs: 0,
    adminEmail: 'admin@tienda.co', adminPassword: 'clave-segura-1', paymentMode: 'wompi', wompiPublicKey: WOMPI.publicKey, wompiPrivateKey: WOMPI.privateKey,
    wompiEventsSecret: WOMPI.eventsSecret, wompiIntegritySecret: WOMPI.integritySecret, ...over.config,
  });
  const fetchLog = [];
  const fetchImpl = over.fetchImpl || (async url => { fetchLog.push(String(url)); return { ok: true, json: async () => ({ data: [] }) }; });
  const app = await createApp({ config, db: openDb(':memory:'), fetchImpl });
  const addr = await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${addr.port}`;
  const jar = {};
  const call = async (method, path, body, { cookies = '', headers = {}, raw } = {}) => {
    const res = await fetch(base + path, {
      method, redirect: 'manual',
      headers: { ...(raw ? {} : body !== undefined ? { 'content-type': 'application/json' } : {}), cookie: cookies, ...headers },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
    const set = res.headers.getSetCookie?.() || [];
    return { status: res.status, json, text, set };
  };
  const cookieOf = r => r.set.map(c => c.split(';')[0]).join('; ');
  const admin = async () => {
    const r = await call('POST', '/api/admin/login', { email: 'admin@tienda.co', password: 'clave-segura-1' });
    if (r.status !== 200) throw new Error('login admin falló: ' + r.text);
    return cookieOf(r);
  };
  let closed = false;
  const close = async () => { if (closed) return; closed = true; open.delete(close); await app.close(); };
  open.add(close);
  return { app, config, call, cookieOf, admin, fetchLog, close };
}

export const wompiEvent = (tx, { secret = WOMPI.eventsSecret, timestamp = 1700000000 } = {}) => {
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const values = [tx.id, tx.status, tx.amount_in_cents];
  const checksum = crypto.createHash('sha256').update(values.join('') + timestamp + secret).digest('hex');
  return { event: 'transaction.updated', data: { transaction: tx }, environment: 'test', signature: { properties, checksum }, timestamp, sent_at: new Date().toISOString() };
};
