// Carga un catálogo de demostración en una instalación nueva:
//   npm run seed:demo -- moda            (moda | alimentos | tecnologia | digital)
//   npm run seed:demo -- moda --accounts (crea además dos clientes de ejemplo: normal y fiel)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import { updateStore } from '../domain/settings.js';
import { createProduct } from '../domain/catalog.js';
import { createPromo } from '../domain/promos.js';
import { hashPassword } from '../auth.js';

export async function seedDemo(db, key, { accounts = false } = {}) {
  const demo = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'demo.json'), 'utf8'));
  const d = demo[key];
  if (!d) throw new Error(`Catálogo desconocido "${key}". Opciones: ${Object.keys(demo).join(', ')}`);
  if (db.prepare('SELECT COUNT(*) c FROM products').get().c > 0) throw new Error('Esta instalación ya tiene productos. No se cargó la demostración.');
  updateStore(db, d.store);
  d.categories.forEach((c, i) => db.prepare('INSERT OR IGNORE INTO categories (name, position) VALUES (?, ?)').run(c, i));
  d.products.forEach(p => createProduct(db, p));
  d.promos.forEach(p => createPromo(db, { ...p, ends: p.endsInDays ? new Date(Date.now() + p.endsInDays * 864e5).toISOString() : null, active: true }));
  if (accounts) {
    const hash = await hashPassword('demo12345');
    db.prepare("INSERT OR IGNORE INTO customers (email, name, phone, password_hash, type_override) VALUES ('valentina.rios@correo.com', 'Valentina Ríos', '3105550142', ?, 'normal')").run(hash);
    db.prepare("INSERT OR IGNORE INTO customers (email, name, phone, password_hash, type_override) VALUES ('mateo.gomez@correo.com', 'Mateo Gómez', '3115550177', ?, 'fiel')").run(hash);
  }
  return d.products.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const key = process.argv[2] || 'moda';
  const config = loadConfig();
  const db = openDb(path.join(config.dataDir, 'app.db'));
  try {
    const n = await seedDemo(db, key, { accounts: process.argv.includes('--accounts') });
    console.log(`Listo: ${n} productos de "${key}" cargados en ${config.dataDir}.`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
