// Revisa una tienda de demostración antes de agregarla a app/src/seed/demo.json:
//   node .claude/skills/prototipo-ecommerce/scripts/validar-catalogo.mjs <archivo.json>
// Señala lo que la aplicación rechazaría o cambiaría en silencio y luego la carga en una base en memoria
// con el mismo código del servidor (applyDemo).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const app = f => import(path.join(ROOT, 'app', 'src', f));

const isInt = n => Number.isInteger(n);
const len = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;

export async function validar(t) {
  const { KINDS } = await app('domain/catalog.js');
  const err = [], warn = [];
  const e = (cond, msg) => { if (!cond) err.push(msg); };

  e(len(t.label, 30), 'label: obligatorio, máx. 30 caracteres.');
  const s = t.store || {};
  e(len(s.name, 80), 'store.name: obligatorio, máx. 80.');
  e(typeof s.tagline === 'string' && s.tagline.length <= 200, 'store.tagline: máx. 200.');
  e(isInt(s.hue) && s.hue >= 0 && s.hue <= 360, 'store.hue: entero entre 0 y 360.');
  e(s.theme === undefined || ['clasico', 'fantasia'].includes(s.theme), 'store.theme: clasico o fantasia.');
  e(['physical', 'digital'].includes(s.type), 'store.type: physical o digital.');
  e(s.hero && len(s.hero.eyebrow, 60) && len(s.hero.title, 140) && len(s.hero.cta, 40), 'store.hero: eyebrow ≤60, title ≤140 y cta ≤40, todos con texto.');
  e(Array.isArray(s.perks) && s.perks.length >= 1 && s.perks.length <= 3 && s.perks.every(p => len(p.t, 60) && len(p.d, 140)), 'store.perks: de 1 a 3, con t ≤60 y d ≤140.');
  e(Array.isArray(s.facets) && s.facets.length >= 1 && s.facets.length <= 4 && s.facets.every(f => len(f, 30)), 'store.facets: de 1 a 4 nombres ≤30.');
  e(isInt(s.lowStock) && s.lowStock >= 0, 'store.lowStock: entero ≥0.');
  e(s.shipping && isInt(s.shipping.flat) && isInt(s.shipping.freeFrom), 'store.shipping: flat y freeFrom enteros.');
  e(s.pay && (s.pay.online || s.pay.transfer || s.pay.cod), 'store.pay: al menos un método activo.');
  e(typeof s.transferInstructions === 'string' && s.transferInstructions.length <= 600, 'store.transferInstructions: máx. 600.');
  e(s.loyalty && isInt(s.loyalty.discount) && s.loyalty.discount >= 0 && s.loyalty.discount <= 90 && typeof s.loyalty.freeShipping === 'boolean' && isInt(s.loyalty.threshold), 'store.loyalty: discount 0–90, freeShipping booleano, threshold entero.');
  if (s.type === 'digital' && s.pay && s.pay.cod) warn.push('store.pay.cod: una tienda digital no debería ofrecer contra entrega.');

  const cats = Array.isArray(t.categories) ? t.categories : [];
  e(cats.length >= 2 && cats.every(c => len(c, 60)) && new Set(cats).size === cats.length, 'categories: al menos 2 nombres únicos ≤60.');

  const prods = Array.isArray(t.products) ? t.products : [];
  e(prods.length >= 6, 'products: al menos 6 (las tiendas existentes tienen 8).');
  const usedCats = new Set();
  prods.forEach((p, i) => {
    const at = `products[${i}] (${p.name || 'sin nombre'})`;
    e(len(p.name, 120), `${at}: name obligatorio ≤120.`);
    e(cats.includes(p.cat), `${at}: cat "${p.cat}" no está en categories.`);
    usedCats.add(p.cat);
    e(isInt(p.price) && p.price > 0 && p.price <= 1e9, `${at}: price entero en pesos, mayor que 0.`);
    e(p.compare === null || (isInt(p.compare) && p.compare > p.price), `${at}: compare debe ser null o mayor que price.`);
    e(p.stock === null || (isInt(p.stock) && p.stock >= 0), `${at}: stock entero ≥0 o null.`);
    e(KINDS.includes(p.kind), `${at}: kind "${p.kind}" no tiene ilustración. Opciones: ${KINDS.join(', ')}.`);
    e(isInt(p.hue) && p.hue >= 0 && p.hue <= 360, `${at}: hue entero entre 0 y 360.`);
    e(p.attrs && typeof p.attrs === 'object' && !Array.isArray(p.attrs) && Object.entries(p.attrs).every(([k, v]) => len(k, 30) && len(String(v), 80)), `${at}: attrs objeto con claves ≤30 y valores ≤80.`);
    (s.facets || []).forEach(f => { if (!p.attrs || !p.attrs[f]) warn.push(`${at}: no tiene el atributo "${f}" usado como filtro.`); });
    e(Array.isArray(p.options) && p.options.length <= 4 && p.options.every(o => len(o.name, 30) && Array.isArray(o.values) && o.values.length >= 1 && o.values.length <= 20 && o.values.every(v => len(v, 30))), `${at}: options lista (máx. 4) de { name, values[1–20] }.`);
    e(typeof p.desc === 'string' && p.desc.length <= 2000, `${at}: desc máx. 2000.`);
    e(typeof p.digital === 'boolean', `${at}: digital debe ser true o false.`);
    e(['active', 'draft'].includes(p.status), `${at}: status active o draft.`);
    e(p.taxRate === undefined || [0, 5, 19].includes(p.taxRate), `${at}: taxRate 0, 5 o 19.`);
    if (p.digital && p.stock !== null) warn.push(`${at}: producto digital con stock; déjalo solo si son cupos limitados (sesiones), si no usa null.`);
    if (s.type === 'digital' && !p.digital) warn.push(`${at}: tienda digital con producto físico.`);
  });
  cats.filter(c => !usedCats.has(c)).forEach(c => warn.push(`categories: "${c}" no tiene productos y no se verá en la tienda.`));

  const promos = Array.isArray(t.promos) ? t.promos : [];
  e(promos.length >= 1, 'promos: al menos una.');
  const codes = new Set();
  promos.forEach((r, i) => {
    const at = `promos[${i}] (${r.name || 'sin nombre'})`;
    e(len(r.name, 80), `${at}: name obligatorio ≤80.`);
    e(typeof r.desc === 'string' && r.desc.length <= 200, `${at}: desc máx. 200.`);
    e(['percent', 'fixed', 'shipping'].includes(r.kind), `${at}: kind percent, fixed o shipping.`);
    if (r.kind === 'percent') e(isInt(r.value) && r.value >= 1 && r.value <= 90, `${at}: value entre 1 y 90.`);
    if (r.kind === 'fixed') e(isInt(r.value) && r.value >= 1, `${at}: value en pesos ≥1.`);
    if (r.kind === 'shipping' && s.type === 'digital') warn.push(`${at}: envío gratis en una tienda digital no tiene efecto.`);
    e(r.scope === 'all' || cats.includes(r.scope), `${at}: scope "${r.scope}" debe ser all o una categoría.`);
    e(typeof r.code === 'string' && r.code === r.code.toUpperCase().replace(/\s+/g, '') && r.code.length <= 30, `${at}: code vacío o en mayúsculas sin espacios.`);
    if (r.code) { e(!codes.has(r.code), `${at}: code "${r.code}" repetido.`); codes.add(r.code); }
    e(['all', 'fiel'].includes(r.audience), `${at}: audience all o fiel.`);
    e(isInt(r.min) && r.min >= 0, `${at}: min entero ≥0.`);
    e(r.endsInDays === null || (isInt(r.endsInDays) && r.endsInDays > 0), `${at}: endsInDays entero >0 o null.`);
  });

  // Carga real con el código del servidor.
  if (!err.length) {
    const { openDb } = await app('db/index.js');
    const { applyDemo } = await app('seed/apply.js');
    const db = openDb(':memory:');
    try { await applyDemo(db, t, { accounts: true }); } catch (x) { err.push(`La aplicación rechazó la tienda: ${x.message}`); }
    finally { db.close(); }
  }
  return { err, warn };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('Uso: validar-catalogo.mjs <archivo.json>'); process.exit(2); }
  const { err, warn } = await validar(JSON.parse(fs.readFileSync(file, 'utf8')));
  warn.forEach(w => console.log(`Aviso: ${w}`));
  err.forEach(x => console.log(`Error: ${x}`));
  console.log(err.length ? `\n${err.length} error(es). Corrige antes de agregar la tienda.` : '\nTienda válida.');
  process.exitCode = err.length ? 1 : 0;
}
