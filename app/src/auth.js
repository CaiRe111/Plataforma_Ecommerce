import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError, nowIso } from './http/util.js';

const scrypt = promisify(crypto.scrypt);
const SESSION_TTL = { admin: 12 * 3600e3, customer: 14 * 24 * 3600e3 };
export const COOKIE = { admin: 'pe_admin', customer: 'pe_sid' };

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [alg, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(key, expected);
}

export function validatePassword(p) {
  if (typeof p !== 'string' || p.length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres.', 'weak_password');
  if (p.length > 200) throw new HttpError(400, 'La contraseña es demasiado larga.', 'weak_password');
}

const sha = t => crypto.createHash('sha256').update(t).digest('hex');

export function createSession(db, kind, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_TTL[kind]).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, kind, user_id, expires_at) VALUES (?, ?, ?, ?)').run(sha(token), kind, userId, expires);
  return { token, maxAge: Math.floor(SESSION_TTL[kind] / 1000) };
}

export function getSession(db, kind, token) {
  if (!token) return null;
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ? AND kind = ?').get(sha(token), kind);
  if (!row) return null;
  if (row.expires_at <= nowIso()) { destroySession(db, token); return null; }
  return row.user_id;
}

export function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
}

export function purgeExpiredSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso());
}

/** Crea el administrador inicial a partir de ADMIN_EMAIL / ADMIN_PASSWORD si aún no hay ninguno. */
export async function bootstrapAdmin(db, { email, password }) {
  const n = db.prepare('SELECT COUNT(*) c FROM admins').get().c;
  if (n > 0 || !email || !password) return false;
  validatePassword(password);
  db.prepare('INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)').run(email.toLowerCase(), 'Administrador', await hashPassword(password));
  return true;
}
