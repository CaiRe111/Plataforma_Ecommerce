import { getStore, getSetting, setSetting } from '../domain/settings.js';
import { nowIso } from '../http/util.js';
import { render, orderContent, SUBJECT, welcomeContent, resetContent } from './templates.js';

/** Configuración que necesitan las plantillas y que no viaja con cada llamada (se guarda al arrancar). */
export const rememberPublicUrl = (db, publicUrl) => setSetting(db, 'system', { publicUrl });
const publicUrl = db => getSetting(db, 'system', { publicUrl: '' }).publicUrl;

export function queueEmail(db, { kind, to, subject, content, orderId = null, storeName }) {
  const { text, html } = render(storeName, content);
  db.prepare('INSERT INTO emails (kind, to_email, subject, text_body, html_body, order_id) VALUES (?, ?, ?, ?, ?, ?)').run(kind, to, subject, text, html, orderId);
}

export function queueOrderEmail(db, orderId, kind, note = '') {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return;
  const store = getStore(db);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId);
  const link = `${publicUrl(db)}/#/pedido/${order.id}?t=${order.access_token}`;
  queueEmail(db, { kind, to: order.email, subject: SUBJECT[kind](order, store.name), content: orderContent(kind, { store, order, items, link, note }), orderId, storeName: store.name });
}
export function queueWelcomeEmail(db, customer) {
  const store = getStore(db);
  queueEmail(db, { kind: 'welcome', to: customer.email, subject: `Bienvenido a ${store.name}`, content: welcomeContent(store, customer.name, `${publicUrl(db)}/#/cuenta`), storeName: store.name });
}
export function queueResetEmail(db, customer, token) {
  const store = getStore(db);
  queueEmail(db, { kind: 'password_reset', to: customer.email, subject: `Restablece tu contraseña · ${store.name}`, content: resetContent(store, customer.name, `${publicUrl(db)}/#/restablecer?token=${token}`), storeName: store.name });
}

/* ---------- envío ---------- */

// Transportes disponibles. "outbox" no envía nada: deja el correo guardado para verlo en el panel (modo demostración).
// Para producción se agrega un transporte SMTP aquí con la misma forma: async send(email) => void (lanza si falla).
const TRANSPORTS = {
  outbox: { name: 'outbox', async send() { /* se queda guardado en la base de datos */ } },
};
export const getTransport = config => TRANSPORTS[config.mail.transport];
export const mailTransportOk = config => !!TRANSPORTS[config.mail.transport];

const MAX_ATTEMPTS = 5;
export async function processEmails(db, config, now = Date.now()) {
  const transport = getTransport(config);
  if (!transport) return 0;
  const due = db.prepare("SELECT * FROM emails WHERE status = 'queued' AND attempts < ? ORDER BY id LIMIT 50").all(MAX_ATTEMPTS);
  let sent = 0;
  for (const e of due) {
    try {
      await transport.send(e);
      db.prepare("UPDATE emails SET status = 'sent', transport = ?, sent_at = ?, attempts = attempts + 1, last_error = '' WHERE id = ?").run(transport.name, new Date(now).toISOString(), e.id);
      sent += 1;
    } catch (err) {
      const attempts = e.attempts + 1;
      db.prepare('UPDATE emails SET status = ?, attempts = ?, last_error = ? WHERE id = ?').run(attempts >= MAX_ATTEMPTS ? 'failed' : 'queued', attempts, String(err.message).slice(0, 300), e.id);
    }
  }
  return sent;
}

export const listEmails = db => db.prepare('SELECT id, kind, to_email, subject, status, transport, order_id, created_at, sent_at, last_error FROM emails ORDER BY id DESC LIMIT 300').all()
  .map(r => ({ id: r.id, kind: r.kind, to: r.to_email, subject: r.subject, status: r.status, transport: r.transport, orderId: r.order_id, createdAt: r.created_at, sentAt: r.sent_at, lastError: r.last_error }));
export const getEmail = (db, id) => {
  const r = db.prepare('SELECT * FROM emails WHERE id = ?').get(id);
  return r ? { id: r.id, kind: r.kind, to: r.to_email, subject: r.subject, text: r.text_body, status: r.status, transport: r.transport, createdAt: r.created_at, orderId: r.order_id } : null;
};
export { nowIso };
