import { getFiscal } from '../domain/settings.js';

/** Encola la factura de un pedido pagado. No hace nada si la facturación está desactivada. Es idempotente. */
export function enqueueInvoice(db, orderId) {
  const fiscal = getFiscal(db);
  if (!fiscal.enabled) return null;
  db.prepare("INSERT OR IGNORE INTO invoices (order_id, kind, status, provider, next_attempt_at) VALUES (?, 'invoice', 'queued', ?, ?)")
    .run(orderId, fiscal.provider, new Date().toISOString());
  return db.prepare("SELECT id FROM invoices WHERE order_id = ? AND kind = 'invoice'").get(orderId);
}
