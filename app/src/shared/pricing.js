// Reglas de precios y promociones. Módulo puro: lo usan el servidor (autoridad) y el navegador (vista previa).
// Todos los montos son pesos colombianos enteros, con IVA incluido.

export const roundCop = n => Math.round(n / 100) * 100;

export const promoLive = (r, now = Date.now()) => !!r.active && (!r.ends || new Date(r.ends).getTime() > now);
export const audienceOk = (r, fiel) => r.audience === 'all' || !!fiel;
export const inScope = (r, p) => r.scope === 'all' || r.scope === p.cat;

/** Precio efectivo de un producto: mejor promoción automática de porcentaje, o el precio anterior si existe. */
export function priceInfo(promos, p, { fiel = false, now = Date.now() } = {}) {
  let best = null;
  for (const r of promos) {
    if (promoLive(r, now) && r.kind === 'percent' && !r.code && audienceOk(r, fiel) && inScope(r, p) && (!best || r.value > best.value)) best = r;
  }
  if (best) return { price: roundCop(p.price * (1 - best.value / 100)), was: p.price, pct: best.value, promo: best };
  if (p.compare && p.compare > p.price) return { price: p.price, was: p.compare, pct: Math.round((1 - p.price / p.compare) * 100), promo: null };
  return { price: p.price, was: null, pct: 0, promo: null };
}

export function shippingCost(shipping, amountAfterDiscounts, physical) {
  if (!physical) return 0;
  return amountAfterDiscounts >= shipping.freeFrom ? 0 : shipping.flat;
}

/**
 * Cotiza un carrito.
 * @param {{promos: object[], loyalty: {discount:number, freeShipping:boolean}, shipping: {flat:number, freeFrom:number}}} cfg
 * @param {{p: object, qty: number}[]} items  productos ya cargados con su cantidad
 * @param {{fiel?: boolean, couponCode?: string, now?: number}} ctx
 */
export function quote(cfg, items, { fiel = false, couponCode = '', now = Date.now() } = {}) {
  const lines = items.map(({ p, qty }) => {
    const info = priceInfo(cfg.promos, p, { fiel, now });
    return { p, qty, unit: info.price, was: info.was, pct: info.pct, promo: info.promo, total: info.price * qty };
  });
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const loyalty = fiel ? roundCop(subtotal * cfg.loyalty.discount / 100) : 0;

  const fmt = cfg.fmt || (n => String(n));
  let coupon = null, couponDiscount = 0, couponShipping = false, note = '';
  if (couponCode) {
    const code = String(couponCode).trim().toUpperCase();
    coupon = cfg.promos.find(r => r.code && r.code.toUpperCase() === code && promoLive(r, now)) || null;
    if (!coupon) note = 'Ese cupón no existe o ya venció.';
    else if (!audienceOk(coupon, fiel)) { note = 'Este cupón es exclusivo para clientes fieles.'; coupon = null; }
    else if (subtotal < coupon.min) { note = `El cupón requiere una compra mínima de ${fmt(coupon.min)}.`; coupon = null; }
    else if (coupon.kind === 'percent') couponDiscount = roundCop(lines.filter(l => inScope(coupon, l.p)).reduce((a, l) => a + l.total, 0) * coupon.value / 100);
    else if (coupon.kind === 'fixed') couponDiscount = Math.min(coupon.value, subtotal - loyalty);
    else couponShipping = true;
  }

  const physical = lines.some(l => !l.p.digital);
  const after = subtotal - loyalty - couponDiscount;
  const autoShipping = cfg.promos.some(r => promoLive(r, now) && r.kind === 'shipping' && !r.code && audienceOk(r, fiel) && subtotal >= r.min);
  const freeShip = couponShipping || autoShipping || (fiel && cfg.loyalty.freeShipping);
  const shipping = lines.length && physical ? (freeShip ? 0 : shippingCost(cfg.shipping, after, physical)) : 0;

  return { lines, subtotal, loyalty, coupon, couponDiscount, note, physical, shipping, freeShip, discount: loyalty + couponDiscount, total: after + shipping };
}
