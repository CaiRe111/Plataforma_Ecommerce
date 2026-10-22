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
