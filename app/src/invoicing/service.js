import { tx } from '../db/index.js';
import { HttpError, bad, intOr, nowIso, str } from '../http/util.js';
import { getFiscal } from '../domain/settings.js';
import { buildInvoiceDocument } from './document.js';
import { getProvider } from './providers.js';

const MAX_ATTEMPTS = 8;
const today = (now = Date.now()) => new Date(now - 5 * 3600e3).toISOString().slice(0, 10);

/* ---------- resoluciones de numeración ---------- */

export const resolutionJson = r => ({
  id: r.id, resolutionNumber: r.resolution_number, prefix: r.prefix, from: r.range_from, to: r.range_to, next: r.next_number,
  validFrom: r.valid_from, validTo: r.valid_to, technicalKey: r.technical_key ? '••••' : '', hasTechnicalKey: !!r.technical_key, active: !!r.active,
  remaining: Math.max(0, r.range_to - r.next_number + 1),
});
export const listResolutions = db => db.prepare('SELECT * FROM invoice_resolutions ORDER BY id DESC').all().map(resolutionJson);

export function createResolution(db, input) {
  const num = str(input.resolutionNumber, 30), prefix = str(input.prefix, 6).toUpperCase();
  const from = intOr(input.from, NaN), to = intOr(input.to, NaN);
  if (!num) throw bad('Escribe el número de la resolución de la DIAN.');
  if (!/^[A-Z0-9]{0,6}$/.test(prefix)) throw bad('El prefijo solo puede tener letras y números (máximo 6).');
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) throw bad('El rango de numeración no es válido.');
  const vf = str(input.validFrom, 10), vt = str(input.validTo, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vf) || !/^\d{4}-\d{2}-\d{2}$/.test(vt) || vt < vf) throw bad('Las fechas de vigencia no son válidas.');
  const r = db.prepare('INSERT INTO invoice_resolutions (resolution_number, prefix, range_from, range_to, next_number, valid_from, valid_to, technical_key, active) VALUES (?,?,?,?,?,?,?,?,1)')
    .run(num, prefix, from, to, from, vf, vt, str(input.technicalKey, 200));
  return resolutionJson(db.prepare('SELECT * FROM invoice_resolutions WHERE id = ?').get(Number(r.lastInsertRowid)));
}
export function setResolutionActive(db, id, active) {
  return db.prepare('UPDATE invoice_resolutions SET active = ? WHERE id = ?').run(active ? 1 : 0, id).changes > 0;
}

function allocateNumber(db, now) {
  const r = db.prepare('SELECT * FROM invoice_resolutions WHERE active = 1 AND valid_from <= ? AND valid_to >= ? AND next_number <= range_to ORDER BY id LIMIT 1').get(today(now), today(now));
  if (!r) return null;
  db.prepare('UPDATE invoice_resolutions SET next_number = next_number + 1 WHERE id = ?').run(r.id);
  return { resolutionId: r.id, prefix: r.prefix, number: r.next_number };
}

/** Avisos para el panel: resoluciones por agotarse o vencer. */
export function resolutionWarnings(db, now = Date.now()) {
  const active = listResolutions(db).filter(r => r.active);
  const t = today(now), warnings = [];
  const usable = active.filter(r => r.validFrom <= t && r.validTo >= t && r.remaining > 0);
  if (!usable.length) warnings.push({ level: 'error', text: 'No hay una resolución de numeración vigente con consecutivos disponibles. No se pueden emitir facturas.' });
  for (const r of usable) {
    const span = r.to - r.from + 1;
    if (r.remaining <= Math.max(10, span * 0.1)) warnings.push({ level: 'warn', text: `La resolución ${r.resolutionNumber} se está agotando: quedan ${r.remaining} números.` });
    const days = Math.round((new Date(r.validTo) - new Date(t)) / 864e5);
    if (days <= 30) warnings.push({ level: 'warn', text: `La resolución ${r.resolutionNumber} vence en ${days} días (${r.validTo}).` });
  }
  return warnings;
}

/* ---------- emisión ---------- */

export function invoiceJson(r) {
  return {
    id: r.id, orderId: r.order_id, status: r.status, provider: r.provider, prefix: r.prefix, number: r.number,
    fullNumber: r.number ? `${r.prefix}${r.number}` : '', cufe: r.cufe, attempts: r.attempts, lastError: r.last_error,
    issuedAt: r.issued_at, createdAt: r.created_at, nextAttemptAt: r.next_attempt_at,
    fiscalValidity: getProvider(r.provider).fiscalValidity,
  };
}
export const listInvoices = (db, { status = '' } = {}) =>
  db.prepare(`SELECT * FROM invoices ${status ? 'WHERE status = ?' : ''} ORDER BY id DESC LIMIT 300`).all(...(status ? [status] : [])).map(invoiceJson);
export function getInvoiceDocument(db, id) {
  const r = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  return r ? { invoice: invoiceJson(r), document: r.document ? JSON.parse(r.document) : null } : null;
}

async function issueOne(db, inv, now) {
  const fiscal = getFiscal(db);
  const provider = getProvider(fiscal.provider);
  if (!provider.available) throw new Error(`El proveedor "${provider.label}" no está disponible todavía.`);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(inv.order_id);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(inv.order_id);
  const productsById = new Map(db.prepare('SELECT id, tax_rate FROM products').all().map(p => [p.id, p]));

  // Un número ya asignado se conserva en los reintentos: la numeración debe ser consecutiva.
  let num = inv.number ? { resolutionId: inv.resolution_id, prefix: inv.prefix, number: inv.number } : null;
  if (!num) {
    num = tx(db, () => {
      const n = allocateNumber(db, now);
      if (n) db.prepare('UPDATE invoices SET resolution_id = ?, prefix = ?, number = ? WHERE id = ?').run(n.resolutionId, n.prefix, n.number, inv.id);
      return n;
    });
  }
  if (!num) { const e = new Error('No hay una resolución de numeración vigente con consecutivos disponibles.'); e.noRetryCount = true; throw e; }

  const doc = buildInvoiceDocument({ order, items, productsById, fiscal, prefix: num.prefix, number: num.number, issuedAt: new Date(now).toISOString() });
  return { doc, result: await provider.issue(doc, { fiscal }) };
}

/** Procesa las facturas en cola. Devuelve cuántas se emitieron. */
export async function processInvoices(db, now = Date.now()) {
  const due = db.prepare("SELECT * FROM invoices WHERE status IN ('queued','error') AND attempts < ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY id LIMIT 20")
    .all(MAX_ATTEMPTS, new Date(now).toISOString());
  let issued = 0;
  for (const inv of due) {
    try {
      const { doc, result } = await issueOne(db, inv, now);
      if (result.status === 'issued') {
        db.prepare("UPDATE invoices SET status='issued', cufe=?, document=?, provider=?, provider_response=?, issued_at=?, last_error='', attempts=attempts+1 WHERE id=?")
          .run(result.cufe || '', JSON.stringify(doc), getFiscal(db).provider, JSON.stringify(result.response || {}), new Date(now).toISOString(), inv.id);
        issued += 1;
      } else {
        db.prepare("UPDATE invoices SET status='rejected', document=?, provider_response=?, last_error=?, attempts=attempts+1 WHERE id=?")
          .run(JSON.stringify(doc), JSON.stringify(result.response || {}), str(JSON.stringify(result.response || {}), 500), inv.id);
      }
    } catch (e) {
      const attempts = inv.attempts + (e.noRetryCount ? 0 : 1);
      const wait = Math.min(2 ** attempts, 360) * 60_000;
      db.prepare("UPDATE invoices SET status='error', attempts=?, last_error=?, next_attempt_at=? WHERE id=?")
        .run(attempts, str(e.message, 500), new Date(now + wait).toISOString(), inv.id);
    }
  }
  return issued;
}

export function retryInvoice(db, id) {
  const r = db.prepare("UPDATE invoices SET status='queued', attempts=0, last_error='', next_attempt_at=? WHERE id = ? AND status IN ('error','rejected','queued')").run(nowIso(), id);
  if (!r.changes) throw new HttpError(409, 'Esta factura no se puede reintentar.', 'bad_transition');
}

/** Pone en cola los pedidos pagados que aún no tienen factura (p. ej. al activar la facturación). */
export function backfillInvoices(db) {
  const fiscal = getFiscal(db);
  if (!fiscal.enabled) throw new HttpError(409, 'Activa la facturación electrónica primero.', 'fiscal_disabled');
  const r = db.prepare(`INSERT OR IGNORE INTO invoices (order_id, kind, status, provider, next_attempt_at)
    SELECT id, 'invoice', 'queued', ?, ? FROM orders WHERE paid_at IS NOT NULL AND status <> 'cancelled'`).run(fiscal.provider, nowIso());
  return Number(r.changes);
}

export function invoiceCounts(db) {
  const out = { queued: 0, issued: 0, rejected: 0, error: 0 };
  for (const r of db.prepare('SELECT status, COUNT(*) c FROM invoices GROUP BY status').all()) out[r.status] = r.c;
  return out;
}
