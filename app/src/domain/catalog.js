import crypto from 'node:crypto';
import { bad, intOr, str } from '../http/util.js';

export const KINDS = ['tee', 'pants', 'bag', 'cap', 'shoe', 'bottle', 'jar', 'box', 'loaf', 'headphones', 'speaker', 'lamp', 'laptop', 'keyboard', 'cable', 'play', 'grid', 'cal', 'doc'];

export function productFromRow(r, { admin = false } = {}) {
  const p = {
    id: r.id, name: r.name, desc: r.description, cat: r.category, price: r.price, compare: r.compare_price,
    stock: r.stock, kind: r.kind, hue: r.hue, attrs: JSON.parse(r.attrs), options: JSON.parse(r.options),
    status: r.status, digital: !!r.digital, image: r.image ? `/uploads/${r.image}` : null,
  };
  if (admin) { p.sku = r.sku; p.taxRate = r.tax_rate; p.updatedAt = r.updated_at; }
  return p;
}

export const listProducts = (db, { admin = false } = {}) =>
  db.prepare(`SELECT * FROM products ${admin ? '' : "WHERE status = 'active'"} ORDER BY created_at, id`).all().map(r => productFromRow(r, { admin }));

export function getProduct(db, id, { admin = false } = {}) {
  const r = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return r ? productFromRow(r, { admin }) : null;
}

export function listCategories(db, { onlyActive = true } = {}) {
  const sql = onlyActive
    ? "SELECT c.name FROM categories c WHERE EXISTS (SELECT 1 FROM products p WHERE p.category = c.name AND p.status = 'active') ORDER BY c.position, c.name"
    : 'SELECT name FROM categories ORDER BY position, name';
  return db.prepare(sql).all().map(r => r.name);
}

export function ensureCategory(db, name) {
  if (!name) return;
  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 p FROM categories').get().p;
  db.prepare('INSERT OR IGNORE INTO categories (name, position) VALUES (?, ?)').run(name, pos);
}

function cleanOptions(opts) {
  if (!Array.isArray(opts)) return [];
  return opts.slice(0, 4).map(o => ({
    name: str(o && o.name, 30),
    values: Array.isArray(o && o.values) ? [...new Set(o.values.map(v => str(v, 30)).filter(Boolean))].slice(0, 20) : [],
  })).filter(o => o.name && o.values.length);
}
function cleanAttrs(a) {
  const out = {};
  if (a && typeof a === 'object') for (const [k, v] of Object.entries(a).slice(0, 20)) { const key = str(k, 30), val = str(v, 80); if (key && val) out[key] = val; }
  return out;
}

export function normalizeProduct(input, cur = null) {
  const g = (k, d) => (input[k] !== undefined ? input[k] : cur ? cur[k] : d);
  const name = str(g('name', ''), 120);
  if (!name) throw bad('Escribe el nombre del producto.');
  const price = intOr(g('price', 0), NaN);
  if (!Number.isInteger(price) || price < 0 || price > 1e9) throw bad('El precio debe ser un número entero de pesos, sin decimales.');
  let compare = g('compare', null);
  compare = compare === null || compare === '' ? null : intOr(compare, null);
  if (compare !== null && compare <= price) compare = null;
  let stock = g('stock', null);
  stock = stock === null || stock === '' ? null : intOr(stock, NaN);
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) throw bad('Las unidades disponibles deben ser un número entero igual o mayor que 0.');
  const kind = KINDS.includes(g('kind', 'box')) ? g('kind', 'box') : 'box';
  const status = g('status', 'draft');
  if (!['active', 'draft'].includes(status)) throw bad('Estado de producto no válido.');
  const taxRate = intOr(g('taxRate', 19), 19);
  if (![0, 5, 19].includes(taxRate)) throw bad('El IVA debe ser 0, 5 o 19.');
  return {
    name, description: str(g('desc', ''), 2000), category: str(g('cat', ''), 60) || 'General', price, compare, stock, kind,
    hue: Math.min(360, Math.max(0, intOr(g('hue', 215), 215))), attrs: cleanAttrs(g('attrs', {})), options: cleanOptions(g('options', [])),
    status, digital: g('digital', false) ? 1 : 0, taxRate, sku: str(g('sku', ''), 40),
  };
}

export function createProduct(db, input) {
  const n = normalizeProduct(input);
  const id = 'p' + crypto.randomBytes(5).toString('hex');
  const sku = n.sku || 'SKU-' + (1000 + db.prepare('SELECT COUNT(*) c FROM products').get().c + 1);
  ensureCategory(db, n.category);
  db.prepare(`INSERT INTO products (id, sku, name, description, category, price, compare_price, stock, kind, hue, attrs, options, status, digital, tax_rate)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, sku, n.name, n.description, n.category, n.price, n.compare, n.stock, n.kind, n.hue, JSON.stringify(n.attrs), JSON.stringify(n.options), n.status, n.digital, n.taxRate);
  return getProduct(db, id, { admin: true });
}

export function updateProduct(db, id, input) {
  const cur = getProduct(db, id, { admin: true });
  if (!cur) return null;
  const n = normalizeProduct(input, cur);
  ensureCategory(db, n.category);
  db.prepare(`UPDATE products SET sku=?, name=?, description=?, category=?, price=?, compare_price=?, stock=?, kind=?, hue=?, attrs=?, options=?, status=?, digital=?, tax_rate=?,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).run(n.sku || cur.sku, n.name, n.description, n.category, n.price, n.compare, n.stock, n.kind, n.hue, JSON.stringify(n.attrs), JSON.stringify(n.options), n.status, n.digital, n.taxRate, id);
  return getProduct(db, id, { admin: true });
}

export function deleteProduct(db, id) {
  return db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
}
