import crypto from 'node:crypto';
import { bad, intOr, str } from '../http/util.js';

export const promoFromRow = r => ({
  id: r.id, name: r.name, desc: r.description, kind: r.kind, value: r.value, scope: r.scope, code: r.code,
  audience: r.audience, min: r.min_total, ends: r.ends_at, active: !!r.active,
});
export const listPromos = db => db.prepare('SELECT * FROM promos ORDER BY rowid').all().map(promoFromRow);

/** Promociones para la tienda: solo vigentes; el código de las exclusivas se oculta a quien no es cliente fiel. */
export function publicPromos(db, { fiel, now = Date.now() }) {
  return listPromos(db)
    .filter(r => r.active && (!r.ends || new Date(r.ends).getTime() > now))
    .map(r => (r.audience === 'fiel' && !fiel && r.code ? { ...r, code: '••••••', codeHidden: true } : r));
}

export function normalizePromo(input, db, selfId = null) {
  const name = str(input.name, 80);
  if (!name) throw bad('Escribe el nombre de la promoción.');
  if (!['percent', 'fixed', 'shipping'].includes(input.kind)) throw bad('Tipo de promoción no válido.');
  const value = input.kind === 'shipping' ? 0 : intOr(input.value, 0);
  if (input.kind === 'percent' && (value < 1 || value > 90)) throw bad('El porcentaje debe estar entre 1 y 90.');
  if (input.kind === 'fixed' && (value < 1 || value > 1e9)) throw bad('Escribe el monto del descuento en pesos.');
  const code = str(input.code, 30).toUpperCase().replace(/\s+/g, '');
  if (code) {
    const dup = db.prepare('SELECT id FROM promos WHERE UPPER(code) = ? AND id <> ?').get(code, selfId || '');
    if (dup) throw bad('Ya existe una promoción con ese código.');
  }
  const audience = input.audience === 'fiel' ? 'fiel' : 'all';
  let ends = null;
  if (input.ends) {
    const d = new Date(input.ends);
    if (Number.isNaN(d.getTime())) throw bad('La fecha de cierre no es válida.');
    ends = /^\d{4}-\d{2}-\d{2}$/.test(String(input.ends)) ? new Date(input.ends + 'T23:59:59-05:00').toISOString() : d.toISOString();
  }
  return { name, description: str(input.desc, 200), kind: input.kind, value, scope: str(input.scope, 60) || 'all', code, audience, min: Math.max(0, intOr(input.min, 0)), ends, active: input.active === undefined ? 1 : input.active ? 1 : 0 };
}

export function createPromo(db, input) {
  const n = normalizePromo(input, db);
  const id = 'r' + crypto.randomBytes(5).toString('hex');
  db.prepare('INSERT INTO promos (id, name, description, kind, value, scope, code, audience, min_total, ends_at, active) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, n.name, n.description, n.kind, n.value, n.scope, n.code, n.audience, n.min, n.ends, n.active);
  return promoFromRow(db.prepare('SELECT * FROM promos WHERE id = ?').get(id));
}
export function updatePromo(db, id, input) {
  const cur = db.prepare('SELECT * FROM promos WHERE id = ?').get(id);
  if (!cur) return null;
  const n = normalizePromo({ ...promoFromRow(cur), ...input }, db, id);
  db.prepare('UPDATE promos SET name=?, description=?, kind=?, value=?, scope=?, code=?, audience=?, min_total=?, ends_at=?, active=? WHERE id=?')
    .run(n.name, n.description, n.kind, n.value, n.scope, n.code, n.audience, n.min, n.ends, n.active, id);
  return promoFromRow(db.prepare('SELECT * FROM promos WHERE id = ?').get(id));
}
export const deletePromo = (db, id) => db.prepare('DELETE FROM promos WHERE id = ?').run(id).changes > 0;
