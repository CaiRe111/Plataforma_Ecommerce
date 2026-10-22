// Restablece la contraseña de un administrador desde el servidor (por si se olvidó):
//   npm run admin:reset -- correo@ejemplo.com "nueva-contraseña"
import path from 'node:path';
import { loadConfig } from './config.js';
import { openDb } from './db/index.js';
import { hashPassword, validatePassword } from './auth.js';

const [email, password] = process.argv.slice(2);
if (!email || !password) { console.error('Uso: npm run admin:reset -- correo "nueva-contraseña"'); process.exit(1); }
try { validatePassword(password); } catch (e) { console.error(e.message); process.exit(1); }
const db = openDb(path.join(loadConfig().dataDir, 'app.db'));
const row = db.prepare('SELECT id FROM admins WHERE email = ?').get(email.toLowerCase());
if (!row) { console.error('No existe un administrador con ese correo.'); process.exit(1); }
db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(await hashPassword(password), row.id);
db.prepare("DELETE FROM sessions WHERE kind = 'admin' AND user_id = ?").run(row.id);
console.log('Contraseña actualizada. Se cerraron las sesiones abiertas de ese administrador.');
