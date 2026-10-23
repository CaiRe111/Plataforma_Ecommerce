import { bad, intOr, str } from '../http/util.js';

export const STORE_DEFAULTS = {
  name: 'Mi tienda',
  tagline: '',
  hue: 215,
  theme: 'clasico', // clasico | fantasia (solo cambia la tienda; el panel siempre es sobrio)
  symbol: '$',
  currency: 'COP',
  type: 'physical',
  hero: { eyebrow: 'Bienvenido', title: 'Productos hechos para ti.', cta: 'Ver catálogo' },
  perks: [],
  facets: [],
  lowStock: 5,
  shipping: { flat: 12000, freeFrom: 250000 },
  pay: { online: true, transfer: false, cod: false },
  transferInstructions: '',
  loyalty: { discount: 5, freeShipping: false, threshold: 500000 },
};

export const FISCAL_DEFAULTS = {
  enabled: false,
  environment: 'habilitacion', // habilitacion | produccion
  provider: 'mock',
  nit: '', dv: '', legalName: '', tradeName: '',
  regime: 'responsable_iva', // responsable_iva | no_responsable
  address: '', cityName: '', cityCode: '', departmentName: '', departmentCode: '', postalCode: '', email: '', phone: '',
  shippingTaxRate: 19,
  softwareId: '', testSetId: '',
  notes: '',
};
// Campos que nunca se devuelven al navegador de la tienda ni a listados.
const FISCAL_SECRET = ['softwarePin', 'certificatePassword', 'apiToken'];

export function getSetting(db, key, defaults) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  const stored = row ? JSON.parse(row.value) : {};
  return deepMerge(structuredClone(defaults), stored);
}
export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
}
function deepMerge(base, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) deepMerge(base[k], v);
    else base[k] = v;
  }
  return base;
}

export const getStore = db => getSetting(db, 'store', STORE_DEFAULTS);
export const getFiscal = db => getSetting(db, 'fiscal', FISCAL_DEFAULTS);

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function updateStore(db, input) {
  const cur = getStore(db);
  const next = structuredClone(cur);
  if (input.name !== undefined) { next.name = str(input.name, 80); if (!next.name) throw bad('El nombre de la tienda no puede quedar vacío.'); }
  if (input.tagline !== undefined) next.tagline = str(input.tagline, 200);
  if (input.theme !== undefined) { if (!['clasico', 'fantasia'].includes(input.theme)) throw bad('Tema visual no válido.'); next.theme = input.theme; }
  if (input.hue !== undefined) next.hue = clamp(intOr(input.hue, cur.hue), 0, 360);
  if (input.symbol !== undefined) next.symbol = str(input.symbol, 4) || '$';
  if (input.type !== undefined) { if (!['physical', 'digital'].includes(input.type)) throw bad('Tipo de tienda no válido.'); next.type = input.type; }
  if (input.hero) next.hero = { eyebrow: str(input.hero.eyebrow, 60), title: str(input.hero.title, 140), cta: str(input.hero.cta, 40) || 'Ver catálogo' };
  if (Array.isArray(input.perks)) next.perks = input.perks.slice(0, 3).map(p => ({ t: str(p.t, 60), d: str(p.d, 140) })).filter(p => p.t);
  if (Array.isArray(input.facets)) next.facets = [...new Set(input.facets.map(f => str(f, 30)).filter(Boolean))].slice(0, 4);
  if (input.lowStock !== undefined) next.lowStock = clamp(intOr(input.lowStock, cur.lowStock), 0, 10000);
  if (input.shipping) {
    next.shipping = { flat: clamp(intOr(input.shipping.flat, cur.shipping.flat), 0, 1e7), freeFrom: clamp(intOr(input.shipping.freeFrom, cur.shipping.freeFrom), 0, 1e9) };
  }
  if (input.pay) {
    next.pay = { online: !!input.pay.online, transfer: !!input.pay.transfer, cod: !!input.pay.cod };
    if (!next.pay.online && !next.pay.transfer && !next.pay.cod) throw bad('Deja al menos un método de pago activo.');
  }
  if (input.transferInstructions !== undefined) next.transferInstructions = str(input.transferInstructions, 600);
  if (input.loyalty) {
    next.loyalty = {
      discount: clamp(intOr(input.loyalty.discount, cur.loyalty.discount), 0, 90),
      freeShipping: !!input.loyalty.freeShipping,
      threshold: clamp(intOr(input.loyalty.threshold, cur.loyalty.threshold), 0, 1e10),
    };
  }
  setSetting(db, 'store', next);
  return next;
}

const NIT = /^\d{6,10}$/;
export function updateFiscal(db, input) {
  const cur = getFiscal(db);
  const next = { ...cur };
  const text = (k, max = 120) => { if (input[k] !== undefined) next[k] = str(input[k], max); };
  ['legalName', 'tradeName', 'address', 'cityName', 'cityCode', 'departmentName', 'departmentCode', 'postalCode', 'email', 'phone', 'softwareId', 'testSetId', 'notes'].forEach(k => text(k, 200));
  if (input.enabled !== undefined) next.enabled = !!input.enabled;
  if (input.environment !== undefined) { if (!['habilitacion', 'produccion'].includes(input.environment)) throw bad('Ambiente no válido.'); next.environment = input.environment; }
  if (input.provider !== undefined) next.provider = str(input.provider, 30) || 'mock';
  if (input.regime !== undefined) { if (!['responsable_iva', 'no_responsable'].includes(input.regime)) throw bad('Régimen no válido.'); next.regime = input.regime; }
  if (input.nit !== undefined) { next.nit = str(input.nit, 15).replace(/\D/g, ''); if (next.nit && !NIT.test(next.nit)) throw bad('El NIT debe tener entre 6 y 10 dígitos, sin dígito de verificación.'); }
  if (input.dv !== undefined) { next.dv = str(input.dv, 1).replace(/\D/g, ''); }
  if (input.shippingTaxRate !== undefined) { const r = intOr(input.shippingTaxRate, 19); if (![0, 5, 19].includes(r)) throw bad('La tarifa de IVA debe ser 0, 5 o 19.'); next.shippingTaxRate = r; }
  for (const k of FISCAL_SECRET) if (typeof input[k] === 'string' && input[k] !== '') next[k] = input[k].slice(0, 500);
  if (next.enabled && (!next.nit || !next.legalName || !next.address || !next.cityCode)) throw bad('Para activar la facturación completa NIT, razón social, dirección y código DANE del municipio.');
  setSetting(db, 'fiscal', next);
  return next;
}

/** Vista del emisor para el panel: oculta secretos y avisa cuáles están guardados. */
export function fiscalForAdmin(f) {
  const out = { ...f };
  for (const k of FISCAL_SECRET) { out[k + 'Set'] = !!out[k]; delete out[k]; }
  return out;
}
