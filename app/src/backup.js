// Copia consistente de la base de datos y las imágenes: npm run backup -- /ruta/destino
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadConfig } from './config.js';

const config = loadConfig();
const dest = path.resolve(process.argv[2] || path.join(config.dataDir, 'backups'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(dest, stamp);
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(path.join(config.dataDir, 'app.db'));
db.exec(`VACUUM INTO '${path.join(dir, 'app.db').replace(/'/g, "''")}'`);
db.close();
const uploads = path.join(config.dataDir, 'uploads');
if (fs.existsSync(uploads)) fs.cpSync(uploads, path.join(dir, 'uploads'), { recursive: true });
// Conserva solo las 14 copias más recientes.
const all = fs.readdirSync(dest).filter(n => /^\d{4}-/.test(n)).sort();
for (const old of all.slice(0, Math.max(0, all.length - 14))) fs.rmSync(path.join(dest, old), { recursive: true, force: true });
console.log(`Respaldo creado en ${dir}`);
