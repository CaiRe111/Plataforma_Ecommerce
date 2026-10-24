// Valida una tienda y la agrega a app/src/seed/demo.json conservando su formato:
//   node .claude/skills/prototipo-ecommerce/scripts/agregar-tienda.mjs <clave> <archivo.json> [--reemplazar]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validar } from './validar-catalogo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DEMO = path.join(ROOT, 'app', 'src', 'seed', 'demo.json');
const [key, file] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const replace = process.argv.includes('--reemplazar');

if (!key || !file) { console.error('Uso: agregar-tienda.mjs <clave> <archivo.json> [--reemplazar]'); process.exit(2); }
if (!/^[a-z][a-z0-9-]{1,29}$/.test(key)) { console.error('La clave debe ir en minúsculas, sin tildes ni espacios (ej. cafe, mascotas).'); process.exit(2); }

const demo = JSON.parse(fs.readFileSync(DEMO, 'utf8'));
if (demo[key] && !replace) { console.error(`Ya existe la tienda "${key}". Usa --reemplazar para sobrescribirla.`); process.exit(1); }

const tienda = JSON.parse(fs.readFileSync(file, 'utf8'));
const { err, warn } = await validar(tienda);
warn.forEach(w => console.log(`Aviso: ${w}`));
if (err.length) { err.forEach(x => console.log(`Error: ${x}`)); console.log(`\n${err.length} error(es). No se modificó demo.json.`); process.exit(1); }

demo[key] = tienda;
fs.writeFileSync(DEMO, JSON.stringify(demo, null, 1));
console.log(`Listo: "${key}" (${tienda.store.name}, ${tienda.products.length} productos) ${replace ? 'actualizada' : 'agregada'} en app/src/seed/demo.json.`);
