import crypto from 'node:crypto';
import { tx } from '../db/index.js';
import { HttpError, bad, intOr, str } from '../http/util.js';
import { quote } from '../shared/pricing.js';
import { enqueueInvoice } from '../invoicing/queue.js';
import { queueOrderEmail } from '../mail/index.js';
import { getStore } from './settings.js';
import { listPromos } from './promos.js';
import { productFromRow } from './catalog.js';
import { customerType, getCustomer, validEmail, normEmail } from './customers.js';

export const FLOW = {
  physical: ['pending', 'paid', 'preparing', 'shipped', 'delivered'],
  digital: ['pending', 'paid', 'delivered'],
};
export const STATUS_LABEL = {
  pending: 'Pendiente de pago', paid: 'Pagado', preparing: 'Preparando', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
};
export const DOC_TYPES = { CC: 'Cédula de ciudadanía', NIT: 'NIT', CE: 'Cédula de extranjería', PP: 'Pasaporte', TI: 'Tarjeta de identidad', CF: 'Consumidor final' };
const DOC_RULES = { CC: /^\d{6,10}$/, NIT: /^\d{6,10}(-\d)?$/, CE: /^[A-Za-z0-9]{4,12}$/, PP: /^[A-Za-z0-9]{4,16}$/, TI: /^\d{6,12}$/ };

const fmtCop = n => '$' + Math.round(n).toLocaleString('es-CO');
const addEvent = (db, orderId, status, note = '') => db.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)').run(orderId, status, note);

/* ---------- creación ---------- */

function validateBuyer(input, physical) {
  const name = str(input.name, 100), email = normEmail(input.email), phone = str(input.phone, 30);
  if (!name) throw bad('Escribe tu nombre completo.', 'bad_name');
  validEmail(email);
  if (phone.replace(/\D/g, '').length < 7) throw bad('Escribe un teléfono de al menos 7 dígitos.', 'bad_phone');
  const docType = str(input.docType, 3).toUpperCase();
  if (!DOC_TYPES[docType]) throw bad('Elige el tipo de documento.', 'bad_doc');
  let docNumber = str(input.docNumber, 20).replace(/[\s.]/g, '');
  if (docType === 'CF') docNumber = '222222222222';
  else if (!DOC_RULES[docType].test(docNumber)) throw bad(`El número de ${DOC_TYPES[docType].toLowerCase()} no es válido.`, 'bad_doc');
  const address = str(input.address, 200), city = str(input.city, 80), notes = str(input.notes, 300);
  if (physical && address.length < 5) throw bad('Escribe la dirección de entrega.', 'bad_address');
  if (physical && !city) throw bad('Escribe la ciudad.', 'bad_city');
  return { name, email, phone, docType, docNumber, address: physical ? address : '', city: physical ? city : '', notes };
}

export function createOrder({ db, config }, input, customerRow) {
  const store = getStore(db);
  if (!Array.isArray(input.items) || !input.items.length) throw bad('El carrito está vacío.', 'empty_cart');
  if (input.items.length > 50) throw bad('El carrito tiene demasiados productos.');
  const method = input.method;
  if (!['online', 'transfer', 'cod'].includes(method)) throw bad('Elige un método de pago.', 'bad_method');

  return tx(db, () => {
    const lines = [];
    for (const it of input.items) {
      const qty = intOr(it.qty, 0);
      if (qty < 1 || qty > 99) throw bad('La cantidad de cada producto debe estar entre 1 y 99.');
      const row = db.prepare("SELECT * FROM products WHERE id = ? AND status = 'active'").get(String(it.pid));
      if (!row) throw new HttpError(409, 'Uno de los productos ya no está disponible. Actualiza tu carrito.', 'unavailable');
      const p = productFromRow(row, { admin: true });
      const opts = {};
      for (const def of p.options) {
        const v = it.opts && it.opts[def.name];
        if (!def.values.includes(v)) throw bad(`Elige ${def.name.toLowerCase()} para ${p.name}.`, 'bad_option');
        opts[def.name] = v;
      }
      lines.push({ p, qty, opts });
    }

    const fiel = !!customerRow && customerType(customerRow, db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE customer_id = ? AND paid_at IS NOT NULL AND status <> 'cancelled'").get(customerRow.id).s, store.loyalty) === 'fiel';
    const q = quote({ promos: listPromos(db), loyalty: store.loyalty, shipping: store.shipping, fmt: fmtCop }, lines, { fiel, couponCode: input.coupon || '' });
    if (input.coupon && q.note) throw bad(q.note, 'bad_coupon');
    if (q.total < 1) throw bad('El total del pedido debe ser mayor que cero.', 'bad_total');

    if (method === 'online' && !(config.onlineEnabled && store.pay.online)) throw bad('El pago en línea no está disponible.', 'bad_method');
    if (method === 'transfer' && !store.pay.transfer) throw bad('La transferencia no está disponible.', 'bad_method');
    if (method === 'cod' && !(store.pay.cod && q.physical)) throw bad('El pago contra entrega no está disponible para este pedido.', 'bad_method');

    const buyer = validateBuyer(input.buyer || {}, q.physical);

    // Reserva de stock: descuenta de forma atómica; si no alcanza, revierte todo.
    const need = new Map();
    for (const l of lines) need.set(l.p.id, (need.get(l.p.id) || 0) + l.qty);
    for (const [pid, qty] of need) {
      const l = lines.find(x => x.p.id === pid);
      if (l.p.stock === null) continue;
      const r = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(qty, pid, qty);
      if (r.changes !== 1) throw new HttpError(409, `No hay suficientes unidades de ${l.p.name}.`, 'out_of_stock');
    }

    const token = crypto.randomBytes(18).toString('base64url');
    const r = db.prepare(`INSERT INTO orders (access_token, customer_id, email, name, phone, doc_type, doc_number, address, city, notes, subtotal, loyalty_discount,
        coupon_code, coupon_discount, shipping, total, physical, fiel, method)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(token, customerRow ? customerRow.id : null, buyer.email, buyer.name, buyer.phone, buyer.docType, buyer.docNumber,
      buyer.address, buyer.city, buyer.notes, q.subtotal, q.loyalty, q.coupon ? q.coupon.code : '', q.couponDiscount, q.shipping, q.total, q.physical ? 1 : 0, fiel ? 1 : 0, method);
    const orderId = Number(r.lastInsertRowid);
    lines.forEach((l, k) => {
      db.prepare('INSERT INTO order_items (order_id, product_id, name, qty, unit_price, opts, digital) VALUES (?,?,?,?,?,?,?)')
        .run(orderId, l.p.id, l.p.name, l.qty, q.lines[k].unit, JSON.stringify(l.opts), l.p.digital ? 1 : 0);
    });
    addEvent(db, orderId, 'pending', method === 'online' ? 'Pedido creado. Esperando el pago en línea.' : 'Pedido creado.');
    queueOrderEmail(db, orderId, 'order_created');

    // Guarda los datos de facturación y entrega en la cuenta para la próxima compra.
    if (customerRow) {
      db.prepare("UPDATE customers SET phone = ?, doc_type = ?, doc_number = ?, address = CASE WHEN ? <> '' THEN ? ELSE address END, city = CASE WHEN ? <> '' THEN ? ELSE city END WHERE id = ?")
        .run(buyer.phone, buyer.docType, buyer.docNumber, buyer.address, buyer.address, buyer.city, buyer.city, customerRow.id);
    }
    return orderId;
  });
}

/* ---------- consultas ---------- */

const itemsOf = (db, id) => db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id)
  .map(i => ({ pid: i.product_id, name: i.name, qty: i.qty, price: i.unit_price, opts: JSON.parse(i.opts), digital: !!i.digital }));

export function nextStep(row) {
  if (row.status === 'cancelled' || row.status === 'delivered') return null;
  if (row.status === 'pending') {
    if (row.method === 'transfer') return { action: 'mark_paid', to: 'paid', label: 'Confirmar pago recibido' };
    if (row.method === 'cod') return { action: 'advance', to: 'preparing', label: 'Empezar a preparar' };
    return null; // pago en línea: avanza solo cuando la pasarela aprueba
  }
  const flow = FLOW[row.physical ? 'physical' : 'digital'];
  const to = flow[flow.indexOf(row.status) + 1];
  const label = { preparing: 'Empezar a preparar', shipped: 'Marcar como enviado', delivered: 'Marcar como entregado' }[to];
  return to ? { action: 'advance', to, label } : null;
}

export function orderJson(db, row, { admin = false } = {}) {
  const o = {
    id: row.id, status: row.status, method: row.method, physical: !!row.physical, fiel: !!row.fiel,
    subtotal: row.subtotal, loyaltyDiscount: row.loyalty_discount, couponCode: row.coupon_code, couponDiscount: row.coupon_discount,
    shipping: row.shipping, total: row.total, createdAt: row.created_at, paidAt: row.paid_at,
    customer: { name: row.name, email: row.email, phone: row.phone },
    address: row.physical ? { line: row.address, city: row.city, notes: row.notes } : null,
    items: itemsOf(db, row.id),
    events: db.prepare('SELECT status, note, at FROM order_events WHERE order_id = ? ORDER BY id').all(row.id),
  };
  if (admin) {
    o.docType = row.doc_type; o.docNumber = row.doc_number; o.customerId = row.customer_id;
    o.next = nextStep(row);
    o.payments = db.prepare('SELECT reference, provider_tx_id txId, status, amount, payment_method method, created_at createdAt, updated_at updatedAt FROM payments WHERE order_id = ? ORDER BY id').all(row.id);
    const inv = db.prepare("SELECT id, status, prefix, number, cufe, provider, last_error lastError, attempts, issued_at issuedAt FROM invoices WHERE order_id = ? AND kind = 'invoice'").get(row.id);
    o.invoice = inv || null;
  }
  return o;
}

export const getOrderRow = (db, id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

/** Acceso de un invitado: número de pedido + token secreto del enlace. */
export function getOrderPublic(db, id, token) {
  const row = getOrderRow(db, id);
  if (!row || !token || row.access_token.length !== String(token).length || !crypto.timingSafeEqual(Buffer.from(row.access_token), Buffer.from(String(token)))) return null;
  return row;
}

export function listOrders(db, { status = '', q = '', limit = 200 } = {}) {
  const where = [], args = [];
  if (status) { where.push('o.status = ?'); args.push(status); }
  if (q) { where.push('(CAST(o.id AS TEXT) LIKE ? OR LOWER(o.name) LIKE ? OR LOWER(o.email) LIKE ?)'); const t = `%${q.toLowerCase()}%`; args.push(t, t, t); }
  const rows = db.prepare(`SELECT o.*, (SELECT status FROM invoices i WHERE i.order_id = o.id AND i.kind = 'invoice') invoice_status FROM orders o
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.id DESC LIMIT ?`).all(...args, Math.min(500, Math.max(1, limit)));
  return rows.map(r => ({
    id: r.id, status: r.status, method: r.method, total: r.total, createdAt: r.created_at, paidAt: r.paid_at, fiel: !!r.fiel,
    customer: { name: r.name, email: r.email }, invoiceStatus: r.invoice_status || null,
  }));
}

export function ordersOfCustomer(db, customerId) {
  return db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC').all(customerId).map(r => orderJson(db, r));
}

/* ---------- cambios de estado ---------- */

export function releaseStock(db, orderId) {
  const o = db.prepare('SELECT stock_released FROM orders WHERE id = ?').get(orderId);
  if (!o || o.stock_released) return;
  for (const i of db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(orderId)) {
    if (i.product_id) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL').run(i.qty, i.product_id);
  }
  db.prepare('UPDATE orders SET stock_released = 1 WHERE id = ?').run(orderId);
}

/** Marca el pedido como pagado. Es idempotente: llamarlo dos veces no repite efectos. */
export function markPaid(db, orderId, note = '') {
  return tx(db, () => {
    const o = getOrderRow(db, orderId);
    if (!o) throw new HttpError(404, 'Pedido no encontrado.', 'not_found');
    if (o.paid_at) return o;
    if (o.status === 'cancelled') {
      // Pago aprobado de un pedido que ya se había cancelado/expirado: se deja constancia para revisión manual.
      addEvent(db, orderId, 'cancelled', 'Llegó un pago aprobado después de cancelar el pedido. Revisa y reembolsa o recrea el pedido.');
      db.prepare('UPDATE orders SET paid_at = ? WHERE id = ?').run(new Date().toISOString(), orderId);
      return getOrderRow(db, orderId);
    }
    const to = o.status === 'pending' ? 'paid' : o.status;
    db.prepare('UPDATE orders SET paid_at = ?, status = ? WHERE id = ?').run(new Date().toISOString(), to, orderId);
    addEvent(db, orderId, to, note || 'Pago confirmado.');
    enqueueInvoice(db, orderId);
    queueOrderEmail(db, orderId, 'payment_confirmed');
    return getOrderRow(db, orderId);
  });
}

export function cancelOrder(db, orderId, note = 'Pedido cancelado.') {
  return tx(db, () => {
    const o = getOrderRow(db, orderId);
    if (!o) throw new HttpError(404, 'Pedido no encontrado.', 'not_found');
    if (['shipped', 'delivered', 'cancelled'].includes(o.status)) throw new HttpError(409, 'Este pedido ya no se puede cancelar.', 'bad_transition');
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(orderId);
    releaseStock(db, orderId);
    addEvent(db, orderId, 'cancelled', note);
    queueOrderEmail(db, orderId, 'order_cancelled', note);
    return getOrderRow(db, orderId);
  });
}

export function advanceOrder(db, orderId) {
  return tx(db, () => {
    const o = getOrderRow(db, orderId);
    if (!o) throw new HttpError(404, 'Pedido no encontrado.', 'not_found');
    const step = nextStep(o);
    if (!step) throw new HttpError(409, 'Este pedido no tiene un paso siguiente.', 'bad_transition');
    if (step.action === 'mark_paid') { markPaid(db, orderId, 'Pago confirmado manualmente.'); return getOrderRow(db, orderId); }
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(step.to, orderId);
    addEvent(db, orderId, step.to);
    if (step.to === 'shipped') queueOrderEmail(db, orderId, 'order_shipped');
    if (step.to === 'delivered') queueOrderEmail(db, orderId, 'order_delivered');
    // Contra entrega: el cobro ocurre al entregar.
    if (step.to === 'delivered' && o.method === 'cod' && !o.paid_at) {
      db.prepare('UPDATE orders SET paid_at = ? WHERE id = ?').run(new Date().toISOString(), orderId);
      enqueueInvoice(db, orderId);
    }
    return getOrderRow(db, orderId);
  });
}
