// Pasarela simulada para demostraciones: no mueve dinero. Reproduce el mismo recorrido que una pasarela real
// (intento de pago, resultado, pedido pagado, factura) para poder mostrar y probar el flujo completo.
import crypto from 'node:crypto';
import { HttpError } from '../http/util.js';
import { applyTransaction } from './wompi.js';

export function startDemoPayment(db, config, order) {
  // Si ya hay un intento abierto (sin resultado o pendiente) se reutiliza en vez de abrir otro.
  const open = db.prepare("SELECT reference FROM payments WHERE order_id = ? AND provider = 'demo' AND status IN ('CREATED','PENDING') ORDER BY id DESC LIMIT 1").get(order.id);
  if (open) return { reference: open.reference, url: `${config.publicUrl}/#/pago-demo/${order.id}?t=${order.accessToken}`, simulated: true };
  const reference = `DEMO-${order.id}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  db.prepare("INSERT INTO payments (order_id, provider, reference, status, amount) VALUES (?, 'demo', ?, 'CREATED', ?)").run(order.id, reference, order.total);
  return { reference, url: `${config.publicUrl}/#/pago-demo/${order.id}?t=${order.accessToken}`, simulated: true };
}

const STATUS = { approved: 'APPROVED', declined: 'DECLINED', pending: 'PENDING' };
const METHOD = { card: 'CARD', pse: 'PSE', nequi: 'NEQUI' };

export function demoAttempt(db, orderId) {
  return db.prepare("SELECT reference, status, amount FROM payments WHERE order_id = ? AND provider = 'demo' ORDER BY id DESC LIMIT 1").get(orderId) || null;
}

/** Aplica el resultado elegido en la pantalla de la pasarela simulada. */
export function simulateOutcome(db, order, { outcome, method }) {
  if (!STATUS[outcome]) throw new HttpError(400, 'Resultado no válido.', 'bad_outcome');
  if (order.paid_at || order.status !== 'pending') throw new HttpError(409, 'Este pedido ya no está pendiente de pago.', 'bad_transition');
  const attempt = demoAttempt(db, order.id);
  if (!attempt || !['CREATED', 'PENDING'].includes(attempt.status)) throw new HttpError(409, 'No hay un intento de pago abierto. Inicia uno nuevo desde el pedido.', 'bad_transition');
  applyTransaction(db, {
    id: `DEMO-TX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, status: STATUS[outcome], reference: attempt.reference,
    amount_in_cents: attempt.amount * 100, currency: 'COP', payment_method_type: METHOD[method] || 'CARD',
  });
}
