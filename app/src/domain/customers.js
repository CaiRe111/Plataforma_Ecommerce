import crypto from 'node:crypto';
import { hashPassword, validatePassword, verifyPassword } from '../auth.js';
import { HttpError, bad, str } from '../http/util.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normEmail = e => str(e, 160).toLowerCase();
export function validEmail(e) { if (!EMAIL.test(e)) throw bad('Escribe un correo válido, por ejemplo nombre@correo.com.', 'bad_email'); }

export function customerStats(db, customerId) {
  return db.prepare("SELECT COUNT(*) count, COALESCE(SUM(total), 0) spent FROM orders WHERE customer_id = ? AND paid_at IS NOT NULL AND status <> 'cancelled'").get(customerId);
}
export function customerType(row, spent, loyalty) {
  return row.type_override || (spent >= loyalty.threshold ? 'fiel' : 'normal');
}
export function customerJson(db, row, loyalty) {
  const st = customerStats(db, row.id);
  return {
    id: row.id, email: row.email, name: row.name, phone: row.phone, docType: row.doc_type, docNumber: row.doc_number, address: row.address, city: row.city,
    type: customerType(row, st.spent, loyalty), forced: !!row.type_override, orders: st.count, spent: st.spent, createdAt: row.created_at,
  };
}
export const getCustomer = (db, id) => db.prepare('SELECT * FROM customers WHERE id = ?').get(id);

export async function registerCustomer(db, { email, name, phone, password }) {
  email = normEmail(email); validEmail(email);
  name = str(name, 100);
  if (!name) throw bad('Escribe tu nombre completo.');
  validatePassword(password);
  if (db.prepare('SELECT 1 FROM customers WHERE email = ?').get(email)) throw new HttpError(409, 'Ya existe una cuenta con ese correo. Inicia sesión.', 'email_taken');
  const r = db.prepare('INSERT INTO customers (email, name, phone, password_hash) VALUES (?, ?, ?, ?)').run(email, name, str(phone, 30), await hashPassword(password));
  return getCustomer(db, Number(r.lastInsertRowid));
}

export async function loginCustomer(db, { email, password }) {
  email = normEmail(email);
  const row = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
  // Se verifica siempre para no revelar por tiempo si el correo existe.
  const ok = await verifyPassword(String(password || ''), row && row.password_hash);
  if (!row || !ok) throw new HttpError(401, 'Correo o contraseña incorrectos.', 'bad_credentials');
  return row;
}

export function listCustomers(db, loyalty) {
  return db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all().map(r => customerJson(db, r, loyalty)).sort((a, b) => b.spent - a.spent);
}
export function setCustomerType(db, id, type) {
  if (!['normal', 'fiel', null].includes(type)) throw bad('Perfil no válido.');
  return db.prepare('UPDATE customers SET type_override = ? WHERE id = ?').run(type, id).changes > 0;
}

/* ---------- recuperación de contraseña ---------- */
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const RESET_TTL = 3600e3;

/** Crea un enlace de un solo uso (vence en una hora). Devuelve null si el correo no tiene cuenta con contraseña. */
export function createResetToken(db, email) {
  const row = db.prepare('SELECT * FROM customers WHERE email = ? AND password_hash IS NOT NULL').get(normEmail(email));
  if (!row) return null;
  db.prepare('DELETE FROM password_resets WHERE customer_id = ?').run(row.id);
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO password_resets (token_hash, customer_id, expires_at) VALUES (?, ?, ?)').run(sha(token), row.id, new Date(Date.now() + RESET_TTL).toISOString());
  return { customer: row, token };
}

export async function consumeResetToken(db, token, password) {
  validatePassword(password);
  const r = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL').get(sha(String(token || '')));
  if (!r || r.expires_at <= new Date().toISOString()) throw new HttpError(400, 'El enlace no es válido o ya venció. Pide uno nuevo.', 'bad_token');
  db.prepare('UPDATE customers SET password_hash = ? WHERE id = ?').run(await hashPassword(password), r.customer_id);
  db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').run(new Date().toISOString(), r.token_hash);
  db.prepare("DELETE FROM sessions WHERE kind = 'customer' AND user_id = ?").run(r.customer_id);
}
