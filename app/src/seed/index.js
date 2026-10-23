// Carga un catálogo de demostración en una instalación nueva:
//   npm run seed:demo -- moda            (moda | alimentos | tecnologia | digital | fantasia)
//   npm run seed:demo -- moda --accounts (crea además dos clientes de ejemplo: normal y fiel)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { openDb } from '../db/index.js';
import { applyDemo } from './apply.js';

export { applyDemo };

export async function seedDemo(db, key, opts = {}) {
  const demo = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'demo.json'), 'utf8'));
  if (!demo[key]) throw new Error(`Catálogo desconocido "${key}". Opciones: ${Object.keys(demo).join(', ')}`);
  return applyDemo(db, demo[key], opts);
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
