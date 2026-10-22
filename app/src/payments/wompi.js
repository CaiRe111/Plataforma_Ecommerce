// Integración con Wompi (Colombia): checkout web con firma de integridad, webhook de eventos y consulta de transacciones.
// Pendiente de validar con llaves de sandbox reales: ver docs/WOMPI.md.
import crypto from 'node:crypto';
import { HttpError, nowIso } from '../http/util.js';
import { tx } from '../db/index.js';
import { markPaid, getOrderRow, cancelOrder, releaseStock } from '../domain/orders.js';

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

/** SHA-256 de `<referencia><monto en centavos><moneda><secreto de integridad>`. */
export function integritySignature(reference, amountInCents, currency, integritySecret) {
  return sha256(`${reference}${amountInCents}${currency}${integritySecret}`);
}

export function newReference(orderId) {
  return `PE-${orderId}-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

/** Crea un intento de pago para el pedido y devuelve la URL del checkout de Wompi. */
export function startPayment(db, config, order) {
  const w = config.wompi;
  if (!w.enabled) throw new HttpError(503, 'El pago en línea no está configurado.', 'wompi_disabled');
  const reference = newReference(order.id);
  const amountInCents = order.total * 100;
  db.prepare("INSERT INTO payments (order_id, provider, reference, status, amount) VALUES (?, 'wompi', ?, 'CREATED', ?)").run(order.id, reference, order.total);
  const params = new URLSearchParams({
    'public-key': w.publicKey,
    currency: 'COP',
    'amount-in-cents': String(amountInCents),
    reference,
    'signature:integrity': integritySignature(reference, amountInCents, 'COP', w.integritySecret),
    'redirect-url': `${config.publicUrl}/pago/retorno?o=${order.id}&t=${order.accessToken}`,
    'customer-data:email': order.email,
    'customer-data:full-name': order.name,
  });
  return { reference, url: `${w.checkoutUrl}?${params.toString()}` };
}

/* ---------- webhook ---------- */

function pick(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Valida el checksum de un evento: SHA-256 de los valores de signature.properties + timestamp + secreto de eventos. */
export function verifyEventChecksum(event, eventsSecret, headerChecksum = '') {
  const sig = event && event.signature;
  if (!sig || !Array.isArray(sig.properties) || !sig.checksum || event.timestamp === undefined) return false;
  const values = sig.properties.map(p => pick(event.data, p));
  if (values.some(v => v === undefined || v === null)) return false;
  const expected = sha256(values.join('') + String(event.timestamp) + eventsSecret);
  const given = String(sig.checksum).toLowerCase();
  if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return false;
  if (headerChecksum && String(headerChecksum).toLowerCase() !== expected) return false;
  return true;
}

/**
 * Aplica el estado de una transacción de Wompi al pago y al pedido. Es idempotente y valida monto y moneda.
 * Estados de Wompi: PENDING, APPROVED, DECLINED, VOIDED, ERROR.
 */
export function applyTransaction(db, t) {
  return tx(db, () => {
    const pay = db.prepare('SELECT * FROM payments WHERE reference = ?').get(String(t.reference));
    if (!pay) return { ignored: 'unknown_reference' };
    const order = getOrderRow(db, pay.order_id);
    const method = (t.payment_method_type || '').toString();
    const mismatch = Number(t.amount_in_cents) !== pay.amount * 100 || t.currency !== 'COP';
    db.prepare('UPDATE payments SET status = ?, provider_tx_id = ?, payment_method = ?, raw = ?, updated_at = ? WHERE id = ?')
      .run(mismatch ? 'MISMATCH' : String(t.status), String(t.id), method, JSON.stringify(t), nowIso(), pay.id);
    if (mismatch) {
      db.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)').run(order.id, order.status, `Wompi reportó un monto o moneda distinto al del pedido (transacción ${t.id}). No se aprobó.`);
      return { ignored: 'amount_mismatch' };
    }
    if (t.status === 'APPROVED') {
      markPaid(db, order.id, `Pago aprobado en Wompi (${method || 'sin método'}, transacción ${t.id}).`);
      return { orderId: order.id, approved: true };
    }
    if (t.status === 'VOIDED' && order.paid_at && ['paid', 'pending'].includes(order.status)) {
      cancelOrder(db, order.id, `El pago fue anulado en Wompi (transacción ${t.id}).`);
    } else if (t.status === 'DECLINED' || t.status === 'ERROR') {
      db.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)').run(order.id, order.status, `Pago ${t.status === 'DECLINED' ? 'rechazado' : 'con error'} en Wompi. El cliente puede intentarlo de nuevo.`);
    }
    return { orderId: order.id, status: t.status };
  });
}

export function handleWebhook(db, config, event, headerChecksum) {
  if (!config.wompi.eventsSecret) throw new HttpError(503, 'Wompi no está configurado.', 'wompi_disabled');
  if (!verifyEventChecksum(event, config.wompi.eventsSecret, headerChecksum)) throw new HttpError(401, 'Firma del evento no válida.', 'bad_signature');
  if (event.event !== 'transaction.updated' || !event.data || !event.data.transaction) return { ignored: 'event_type' };
  return tx(db, () => {
    const dedupe = `wompi:${event.signature.checksum}`;
    const fresh = db.prepare('INSERT OR IGNORE INTO webhook_events (provider, dedupe_key, payload) VALUES (?, ?, ?)').run('wompi', dedupe, JSON.stringify(event)).changes === 1;
    if (!fresh) return { ignored: 'duplicate' };
    return applyTransaction(db, event.data.transaction);
  });
}

/* ---------- consulta a la API ---------- */

export function createWompiClient(config, fetchImpl = globalThis.fetch) {
  const base = config.wompi.apiUrl;
  const get = async path => {
    const res = await fetchImpl(base + path, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new HttpError(502, `Wompi respondió ${res.status}.`, 'wompi_error');
    return res.json();
  };
  return {
    async transaction(id) { return (await get(`/transactions/${encodeURIComponent(id)}`)).data; },
    async byReference(reference) {
      const r = await get(`/transactions?reference=${encodeURIComponent(reference)}`);
      const list = Array.isArray(r.data) ? r.data : [];
      return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
    },
  };
}

/** Consulta a Wompi el estado real de los intentos de pago de un pedido y lo aplica. */
export async function syncOrderPayments(db, client, orderId, { txId } = {}) {
  const attempts = db.prepare("SELECT * FROM payments WHERE order_id = ? AND provider = 'wompi' ORDER BY id DESC").all(orderId);
  let result = null;
  if (txId) {
    const t = await client.transaction(txId);
    if (t && attempts.some(a => a.reference === t.reference)) result = applyTransaction(db, t);
  }
  for (const a of attempts) {
    if (a.status === 'APPROVED') continue;
    const t = await client.byReference(a.reference).catch(() => null);
    if (t) result = applyTransaction(db, t);
  }
  return result;
}

/**
 * Tarea periódica: libera el stock de pedidos pagados en línea que nunca se completaron.
 * Antes de cancelar consulta a Wompi para no perder un pago aprobado cuyo webhook no llegó.
 */
export async function expireUnpaidOrders(db, config, client, now = Date.now()) {
  const cutoff = new Date(now - config.reserveMinutes * 60_000).toISOString();
  const rows = db.prepare("SELECT id FROM orders WHERE method = 'online' AND status = 'pending' AND paid_at IS NULL AND created_at < ?").all(cutoff);
  let expired = 0;
  for (const { id } of rows) {
    if (client) { try { await syncOrderPayments(db, client, id); } catch { continue; /* sin red: reintenta luego */ } }
    const o = getOrderRow(db, id);
    if (o.paid_at || o.status !== 'pending') continue;
    const inFlight = db.prepare("SELECT 1 FROM payments WHERE order_id = ? AND status = 'PENDING'").get(id);
    if (inFlight && now - new Date(o.created_at).getTime() < 24 * 3600e3) continue; // PSE/Nequi pueden tardar
    cancelOrder(db, id, 'El pago en línea no se completó a tiempo. Se liberó el inventario.');
    expired += 1;
  }
  return expired;
}
export { releaseStock };
