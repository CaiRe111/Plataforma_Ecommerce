// Modelo de documento de factura independiente del proveedor. Los precios de la tienda incluyen IVA,
// así que base e impuesto se obtienen "hacia atrás" y todo se calcula en pesos enteros.
import { HttpError } from '../http/util.js';

const taxOf = (gross, rate) => Math.round(gross * rate / (100 + rate));

/** Reparte el descuento total entre las líneas en proporción a su valor; el residuo va a la última. */
function spreadDiscount(grosses, discount) {
  const total = grosses.reduce((a, b) => a + b, 0);
  if (!discount || !total) return grosses.map(() => 0);
  const out = grosses.map(g => Math.floor(discount * g / total));
  out[out.length - 1] += discount - out.reduce((a, b) => a + b, 0);
  return out;
}

export function bogotaParts(iso) {
  const d = new Date(new Date(iso).getTime() - 5 * 3600e3); // Colombia no usa horario de verano: UTC-5 fijo
  const s = d.toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 19) + '-05:00' };
}

export function buildInvoiceDocument({ order, items, productsById, fiscal, prefix, number, issuedAt }) {
  const noIva = fiscal.regime === 'no_responsable';
  const grosses = items.map(i => i.unit_price * i.qty);
  const discounts = spreadDiscount(grosses, order.loyalty_discount + order.coupon_discount);
  const lines = items.map((i, k) => {
    const rate = noIva ? 0 : (productsById.get(i.product_id)?.tax_rate ?? 19);
    const total = grosses[k] - discounts[k];
    const tax = taxOf(total, rate);
    return { description: i.name + (i.opts && i.opts !== '{}' ? ` (${Object.values(JSON.parse(i.opts)).join(', ')})` : ''), qty: i.qty, unitGross: i.unit_price, discount: discounts[k], taxRate: rate, base: total - tax, tax, total };
  });
  if (order.shipping > 0) {
    const rate = noIva ? 0 : fiscal.shippingTaxRate;
    const tax = taxOf(order.shipping, rate);
    lines.push({ description: 'Servicio de envío', qty: 1, unitGross: order.shipping, discount: 0, taxRate: rate, base: order.shipping - tax, tax, total: order.shipping });
  }
  const sum = lines.reduce((a, l) => a + l.total, 0);
  if (sum !== order.total) throw new HttpError(500, `La suma de las líneas (${sum}) no coincide con el total del pedido (${order.total}).`, 'invoice_total_mismatch');
  const taxes = [...new Set(lines.map(l => l.taxRate))].sort((a, b) => a - b).map(rate => {
    const ls = lines.filter(l => l.taxRate === rate);
    return { rate, base: ls.reduce((a, l) => a + l.base, 0), amount: ls.reduce((a, l) => a + l.tax, 0) };
  });
  const when = bogotaParts(issuedAt);
  return {
    kind: 'invoice', environment: fiscal.environment, currency: 'COP',
    prefix, number, fullNumber: `${prefix}${number}`, issueDate: when.date, issueTime: when.time,
    issuer: {
      nit: fiscal.nit, dv: fiscal.dv, legalName: fiscal.legalName, tradeName: fiscal.tradeName, regime: fiscal.regime,
      address: fiscal.address, cityName: fiscal.cityName, cityCode: fiscal.cityCode, departmentName: fiscal.departmentName, departmentCode: fiscal.departmentCode,
      postalCode: fiscal.postalCode, email: fiscal.email, phone: fiscal.phone,
    },
    customer: { name: order.name, docType: order.doc_type, docNumber: order.doc_number, email: order.email, phone: order.phone, address: order.address, city: order.city },
    lines, taxes,
    totals: { base: lines.reduce((a, l) => a + l.base, 0), tax: lines.reduce((a, l) => a + l.tax, 0), discount: order.loyalty_discount + order.coupon_discount, total: order.total },
    payment: { method: order.method, paidAt: order.paid_at },
    orderId: order.id,
  };
}
