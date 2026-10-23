/* Tienda y panel de administración. Consume la API del servidor (/api/*); todos los precios y totales
   definitivos los calcula el servidor. Aquí se usa el mismo módulo de precios solo para mostrar el carrito. */
import { priceInfo as basePriceInfo, quote as baseQuote, promoLive } from '/shared/pricing.js';

(async () => {
'use strict';

/* ================= utilidades ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
class Raw { constructor(s) { this.s = s; } }
const raw = s => new Raw(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => v instanceof Raw ? v.s : Array.isArray(v) ? v.map(str).join('') : (v == null || v === false) ? '' : esc(v);
const html = (s, ...v) => { let o = ''; s.forEach((x, i) => { o += x; if (i < v.length) o += str(v[i]); }); return new Raw(o); };
const enc = encodeURIComponent;
const store_ = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } },
};

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  cart: '<path d="M3 4h2.5l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/>',
  box: '<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  stock: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.3 2.4 3.8 5.2"/>',
};
const ic = n => raw(`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`);

const SHAPES = {
  tee: '<path d="M30 18l12-6q8 9 16 0l12 6 14 16-10 8-6-6v48H32V36l-6 6-10-8z"/>',
  pants: '<path d="M32 14h36l4 72H55l-5-44-5 44H28z"/>',
  bag: '<rect x="22" y="36" width="56" height="50" rx="6"/><path class="s" d="M38 36V28a12 12 0 0 1 24 0v8"/>',
  cap: '<path d="M18 60Q18 28 50 28Q82 28 82 60z"/><path d="M62 60h28q0 8-12 8H62z"/>',
  shoe: '<path d="M12 64V46q18 0 26-8l8 8 16 4q24 2 26 16v6H12z"/><path class="d" d="M12 72h76v4H12z"/>',
  bottle: '<rect x="38" y="28" width="24" height="58" rx="8"/><rect x="44" y="12" width="12" height="18" rx="2"/>',
  jar: '<rect x="26" y="34" width="48" height="50" rx="8"/><rect x="30" y="22" width="40" height="12" rx="3"/><rect class="d" x="34" y="48" width="32" height="20" rx="3"/>',
  box: '<path d="M50 14l34 16v40L50 86 16 70V30z"/><path class="b" d="M16 30l34 16 34-16M50 46v40"/>',
  loaf: '<path d="M14 66Q14 34 50 34t36 32v8H14z"/><path class="b" d="M34 44l6 12M50 40v14M66 44l-6 12"/>',
  headphones: '<path class="s" d="M22 64V52a28 28 0 0 1 56 0v12"/><rect x="16" y="58" width="16" height="28" rx="6"/><rect x="68" y="58" width="16" height="28" rx="6"/>',
  speaker: '<rect x="30" y="20" width="40" height="64" rx="12"/><circle class="d" cx="50" cy="60" r="12"/><circle class="d" cx="50" cy="34" r="4"/>',
  lamp: '<circle cx="50" cy="40" r="24"/><rect x="40" y="62" width="20" height="20" rx="4"/><path class="b" d="M44 40q6-8 12 0"/>',
  laptop: '<rect x="12" y="20" width="76" height="50" rx="4"/><rect class="d" x="17" y="25" width="66" height="40" rx="2"/><rect x="40" y="72" width="20" height="10"/><rect x="30" y="82" width="40" height="4" rx="2"/>',
  keyboard: '<rect x="8" y="34" width="84" height="34" rx="6"/><path class="b" d="M18 46h6M30 46h6M42 46h6M54 46h6M66 46h6M78 46h6M22 58h56"/>',
  cable: '<path class="s" d="M20 74q0-44 30-30t30-20"/><rect x="12" y="70" width="14" height="14" rx="3"/><rect x="74" y="16" width="14" height="14" rx="3"/>',
  play: '<rect x="12" y="24" width="76" height="52" rx="8"/><path class="d" d="M43 38l18 12-18 12z"/>',
  grid: '<rect x="16" y="16" width="30" height="30" rx="5"/><rect x="54" y="16" width="30" height="30" rx="5"/><rect x="16" y="54" width="30" height="30" rx="5"/><rect x="54" y="54" width="30" height="30" rx="5"/>',
  cal: '<rect x="14" y="22" width="72" height="62" rx="7"/><rect class="d" x="14" y="38" width="72" height="3"/><rect x="30" y="12" width="6" height="18" rx="3"/><rect x="64" y="12" width="6" height="18" rx="3"/>',
  doc: '<rect x="24" y="12" width="52" height="76" rx="5"/><path class="b" d="M34 32h32M34 44h32M34 56h20"/>',
  dice: '<path d="M50 10l34 20v40L50 90 16 70V30z"/><circle class="d" cx="50" cy="50" r="6"/><circle class="d" cx="37" cy="37" r="4"/><circle class="d" cx="63" cy="37" r="4"/><circle class="d" cx="37" cy="63" r="4"/><circle class="d" cx="63" cy="63" r="4"/>',
  scroll: '<rect x="26" y="20" width="48" height="60" rx="3"/><rect x="20" y="14" width="60" height="10" rx="5"/><rect x="20" y="76" width="60" height="10" rx="5"/><path class="b" d="M34 36h32M34 46h32M34 56h20"/>',
  sword: '<path d="M46 10h8v52h-8z"/><path d="M32 62h36v7H32z"/><rect x="46" y="69" width="8" height="18" rx="3"/><circle cx="50" cy="90" r="4"/>',
};

const art = (p, cls = '', alt = '') => p.image
  ? html`<div class="art photo ${cls}"><img src="${p.image}" alt="${alt}" loading="lazy"></div>`
  : html`<div class="art ${cls}" style="--h:${p.hue}"><svg viewBox="0 0 100 100" aria-hidden="true">${raw(SHAPES[p.kind] || SHAPES.box)}</svg></div>`;

/* ================= estado y datos ================= */
const CART_KEY = 'pe-cart-v1', LAST_KEY = 'pe-last-order';
const FLOWS = { physical: ['pending', 'paid', 'preparing', 'shipped', 'delivered'], digital: ['pending', 'paid', 'delivered'] };
const S = {
  store: null, st: null, cats: [], products: [], promos: [], docTypes: {}, me: null, myOrders: [], order: null,
  admin: undefined, adm: {}, route: null, cart: { items: [], coupon: null },
  ui: { menu: false, cart: false, filters: false, search: false, pdp: null, co: null, confirm: null, authTab: 'login', busy: false },
};
try { const c = JSON.parse(store_.get(CART_KEY) || 'null'); if (c && Array.isArray(c.items)) S.cart = { items: c.items, coupon: c.coupon || null }; } catch (e) { /* carrito vacío */ }
const persistCart = () => store_.set(CART_KEY, JSON.stringify(S.cart));

async function api(method, url, body, raw_) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (raw_) { opts.headers['content-type'] = raw_.type; opts.body = raw_.data; }
  else if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(url, opts); } catch (e) { throw new Error('No hay conexión con la tienda. Revisa tu internet e inténtalo de nuevo.'); }
  let data = null;
  try { data = await res.json(); } catch (e) { /* sin cuerpo */ }
  if (!res.ok) {
    const err = new Error((data && data.error && data.error.message) || 'No pudimos completar la acción. Inténtalo de nuevo.');
    err.status = res.status; err.code = data && data.error && data.error.code;
    throw err;
  }
  return data;
}
const rebuild = () => { S.st = { ...S.store, cats: S.cats, products: S.products, promos: S.promos, cart: S.cart }; };
async function loadStore() {
  const d = await api('GET', '/api/store');
  Object.assign(S, { store: d.store, cats: d.cats, products: d.products, promos: d.promos, docTypes: d.docTypes, me: d.me });
  rebuild();
}
const ST = () => S.st;
const prod = id => S.products.find(p => p.id === id);
const activeProducts = () => S.products;
const money = n => (S.store ? S.store.symbol : '$') + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtDate = iso => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
const fmtDateTime = iso => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const optsText = o => Object.entries(o || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
const isFiel = () => !!S.me && S.me.type === 'fiel';

const STATUS = {
  pending: { l: 'Pendiente de pago', c: 'warn' }, paid: { l: 'Pagado', c: 'info' }, preparing: { l: 'Preparando', c: 'info' },
  shipped: { l: 'Enviado', c: 'info' }, delivered: { l: 'Entregado', c: 'good' }, cancelled: { l: 'Cancelado', c: 'bad' },
};
const METHODS = { online: 'Pago en línea', transfer: 'Transferencia', cod: 'Contra entrega' };
const isDemoPay = () => !!S.store && S.store.paymentMode === 'demo';
const methodLabel = m => (m === 'online' && isDemoPay() ? 'Pago en línea (simulado)' : METHODS[m]);
const pill = s => html`<span class="pill ${STATUS[s].c}">${STATUS[s].l}</span>`;

function stockState(p) {
  if (p.stock === null) return 'ok';
  if (p.stock <= 0) return 'out';
  return p.stock <= ST().lowStock ? 'low' : 'ok';
}
const stockPill = p => {
  const s = stockState(p);
  return html`<span class="pill ${s === 'out' ? 'bad' : s === 'low' ? 'warn' : 'good'}">${s === 'out' ? 'Agotado' : s === 'low' ? 'Stock bajo' : p.stock === null ? 'Sin límite' : 'Disponible'}</span>`;
};

/* ================= precios y carrito (vista previa; el servidor recalcula al comprar) ================= */
const priceInfo = (p, asFiel) => basePriceInfo(S.promos, p, { fiel: asFiel === undefined ? isFiel() : asFiel });
const fielOffer = p => {
  if (isFiel()) return null;
  const i = priceInfo(p, true);
  return i.promo && i.promo.audience === 'fiel' ? i : null;
};
const liveCoupon = code => S.promos.find(r => r.code && !r.codeHidden && r.code.toUpperCase() === String(code).trim().toUpperCase() && promoLive(r));
function promoText(r) {
  const where = r.scope === 'all' ? 'en toda la tienda' : 'en ' + r.scope;
  const min = r.min ? ` desde ${money(r.min)}` : '';
  if (r.kind === 'percent') return `${r.value} % de descuento ${where}${min}`;
  if (r.kind === 'fixed') return `${money(r.value)} de descuento${min}`;
  return `Envío gratis${min}`;
}
function applyCoupon(code) {
  const r = liveCoupon(code);
  if (!r) return toast('Ese cupón no existe, ya venció o es exclusivo de clientes fieles.');
  S.cart.coupon = r.code; persistCart(); render(); toast(`Cupón ${r.code} aplicado.`);
}
function lines() {
  return S.cart.items.map((it, i) => {
    const p = prod(it.pid);
    if (!p) return null;
    const info = priceInfo(p);
    return { it, i, p, info, unit: info.price, total: info.price * it.qty };
  }).filter(Boolean);
}
function calc(ls) {
  const s = ST();
  const q = baseQuote({ promos: S.promos, loyalty: s.loyalty, shipping: s.shipping, fmt: money }, ls.map(l => ({ p: l.p, qty: l.it.qty })), { fiel: isFiel(), couponCode: S.cart.coupon || '' });
  return { subtotal: q.subtotal, loyalty: q.loyalty, cDisc: q.couponDiscount, cp: q.coupon, note: q.note, disc: q.discount, physical: q.physical, ship: q.shipping, freeShip: q.freeShip, total: q.total };
}
const cartCount = () => lines().reduce((a, l) => a + l.it.qty, 0);
const maxQty = p => p.stock === null ? 99 : p.stock;

function addToCart(p, qty, opts) {
  const items = S.cart.items;
  const key = JSON.stringify(opts);
  const ex = items.find(i => i.pid === p.id && JSON.stringify(i.opts) === key);
  const inCart = items.filter(i => i.pid === p.id).reduce((a, i) => a + i.qty, 0);
  const room = maxQty(p) - inCart;
  if (room <= 0) return toast(`Ya tienes todas las unidades disponibles (${maxQty(p)}).`);
  const n = Math.min(qty, room);
  if (ex) ex.qty += n; else items.push({ pid: p.id, qty: n, opts });
  if (n < qty) toast(`Solo quedan ${maxQty(p)} unidades; agregamos ${n}.`);
  persistCart();
  S.ui.cart = true;
}

/* ================= router y carga de datos por pantalla ================= */
function parse(h) {
  const [path, query = ''] = h.replace(/^#\/?/, '').split('?');
  return { segs: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(query) };
}
let navSeq = 0, pollTimer = null;
async function go(href, replace) {
  const h = href.replace(/^#\/?/, '');
  const prev = S.route && S.route.segs.join('/');
  try { history[replace ? 'replaceState' : 'pushState'](null, '', '#/' + h); } catch (e) { /* entorno sin historial */ }
  S.route = parse(h);
  S.ui.menu = S.ui.filters = S.ui.search = false;
  await show(!(replace && prev === S.route.segs.join('/')));
}
async function show(toTop) {
  const seq = ++navSeq;
  clearTimeout(pollTimer);
  try { await loadRoute(); } catch (e) { S.loadError = e.message; }
  if (seq !== navSeq) return; // el usuario ya navegó a otra pantalla
  render(toTop);
}
window.addEventListener('popstate', () => { S.route = parse(location.hash); S.ui.menu = S.ui.cart = S.ui.filters = false; show(true); });

async function loadRoute() {
  S.loadError = null;
  const [a, b, c] = S.route.segs, q = S.route.q;
  if (a === 'admin') return loadAdmin(b, c);
  if (a === 'pedido') return loadOrder(b, q);
  if (a === 'pago-demo') return loadDemo(b, q);
  if (a === 'cuenta' && S.me) { S.myOrders = (await api('GET', '/api/me')).orders; }
}
async function loadDemo(id, q) {
  S.demo = null;
  try { S.demo = await api('GET', `/api/demo/payment/${id}?t=${enc(q.get('t') || '')}`); S.demo.token = q.get('t') || ''; } catch (e) { if (e.status !== 404) throw e; }
}
async function loadOrder(id, q) {
  const token = q.get('t') || '';
  try {
    if (q.get('tx') || q.get('id')) {
      S.order = await api('POST', `/api/orders/${id}/sync?t=${enc(token)}`, { txId: q.get('tx') || q.get('id') });
    } else S.order = await api('GET', `/api/orders/${id}?t=${enc(token)}`);
    S.order.token = token;
  } catch (e) { S.order = null; if (e.status !== 404) throw e; }
  if (S.order) {
    const o = S.order.order;
    if (o.status !== 'pending') store_.del(LAST_KEY);
    else if (o.method === 'online' && !o.paidAt && !isDemoPay()) schedulePoll(id, token, 0);
  }
}
function schedulePoll(id, token, n) {
  if (n >= 24) return;
  pollTimer = setTimeout(async () => {
    if (!(S.route.segs[0] === 'pedido' && S.route.segs[1] === String(id))) return;
    try {
      const r = await api('POST', `/api/orders/${id}/sync?t=${enc(token)}`, {});
      r.token = token; S.order = r;
      if (r.order.status !== 'pending') { render(); return; }
    } catch (e) { /* se reintenta */ }
    schedulePoll(id, token, n + 1);
  }, 5000);
}
function productCard(p) {
  const s = stockState(p), info = priceInfo(p);
  return html`<a class="card" href="#/producto/${p.id}">
    <div class="card-img">${art(p)}<div class="card-tag">
      ${info.pct ? html`<span class="tag">-${info.pct}%</span>` : ''}
      ${info.promo && info.promo.audience === 'fiel' ? html`<span class="tag soft">Precio fiel</span>` : ''}
      ${s === 'out' ? html`<span class="tag soft">Agotado</span>` : s === 'low' ? html`<span class="tag soft">Últimas unidades</span>` : ''}
    </div></div>
    <div class="card-body"><span class="eyebrow">${p.cat}</span><h3>${p.name}</h3>
      <div class="price">${money(info.price)}${info.was ? html`<s>${money(info.was)}</s>` : ''}</div></div>
  </a>`;
}
function fielCard(p) {
  const i = priceInfo(p, true);
  return html`<a class="card" href="#/producto/${p.id}"><div class="card-img">${art(p)}<div class="card-tag"><span class="tag">Precio fiel -${i.pct}%</span></div></div>
    <div class="card-body"><span class="eyebrow">${p.cat}</span><h3>${p.name}</h3><div class="price">${money(i.price)}<s>${money(i.was)}</s></div></div></a>`;
}
function promoStrip() {
  const live = ST().promos.filter(r => promoLive(r) && r.audience === 'all').slice(0, 2);
  if (!live.length) return '';
  return html`<section class="strip-band"><div class="wrap strip">${live.map(r => html`<a href="#/ofertas"><b>${r.name}</b><span class="muted">${promoText(r)}</span></a>`)}<a href="#/ofertas" style="margin-left:auto"><b>Ver todas las ofertas →</b></a></div></section>`;
}
function home() {
  const s = ST(), act = activeProducts();
  return html`
  <section class="hero"><div class="wrap hero-in">
    <div class="hero-copy"><p class="eyebrow">${s.hero.eyebrow}</p><h1>${s.hero.title}</h1><p class="lead">${s.tagline}</p>
      <div class="row"><a class="btn btn-primary" href="#/catalogo">${s.hero.cta}</a>${s.cats[0] ? html`<a class="btn btn-ghost" href="#/catalogo?cat=${enc(s.cats[0])}">${s.cats[0]}</a>` : ''}</div></div>
    <div class="hero-art">${act.slice(0, 3).map(p => html`<a href="#/producto/${p.id}" aria-label="${p.name}">${art(p)}</a>`)}</div>
  </div></section>
  ${promoStrip()}
  <section class="wrap sec"><div class="sec-head"><h2>Categorías</h2></div>
    <div class="cat-grid">${s.cats.map(c => html`<a href="#/catalogo?cat=${enc(c)}"><h3>${c}</h3><span class="muted small">${act.filter(p => p.cat === c).length} ${act.filter(p => p.cat === c).length === 1 ? 'producto' : 'productos'}</span></a>`)}</div></section>
  ${act.length ? '' : html`<section class="wrap sec"><div class="empty"><h2>Estamos preparando el catálogo</h2><p class="muted">Muy pronto encontrarás aquí nuestros productos.</p></div></section>`}
  <section class="wrap sec" style="padding-top:8px"><div class="sec-head"><h2>Destacados</h2><a href="#/catalogo" class="muted">Ver todo</a></div>
    <div class="grid">${act.slice(0, 4).map(productCard)}</div></section>
  <section class="wrap"><div class="perks">${s.perks.map(k => html`<div><h3>${k.t}</h3><p class="muted">${k.d}</p></div>`)}</div></section>`;
}
/* ---- catálogo ---- */
function filterProducts(q, skip) {
  const s = ST();
  let list = activeProducts();
  const cat = q.get('cat'), term = (q.get('q') || '').toLowerCase().trim();
  if (skip !== 'cat' && cat) list = list.filter(p => p.cat === cat);
  if (term) list = list.filter(p => (p.name + ' ' + p.cat + ' ' + Object.values(p.attrs).join(' ') + ' ' + p.desc).toLowerCase().includes(term));
  if (skip !== 'p' && q.get('p')) { const [a, b] = q.get('p').split('-'); list = list.filter(p => { const v = priceInfo(p).price; return v >= +a && (b === '' || v < +b); }); }
  if (skip !== 'd' && q.get('d')) list = list.filter(p => p.stock === null || p.stock > 0);
  s.facets.forEach(f => {
    const v = q.get('f_' + f);
    if (skip !== 'f_' + f && v) { const vals = v.split('|'); list = list.filter(p => vals.includes(p.attrs[f])); }
  });
  return list;
}
function qhref(q, changes) {
  const n = new URLSearchParams(q);
  Object.keys(changes).forEach(k => { const v = changes[k]; if (v == null || v === '') n.delete(k); else n.set(k, v); });
  const t = n.toString();
  return '#/catalogo' + (t ? '?' + t : '');
}
function toggleVal(q, key, val) {
  const cur = (q.get(key) || '').split('|').filter(Boolean);
  const i = cur.indexOf(val);
  if (i >= 0) cur.splice(i, 1); else cur.push(val);
  return cur.join('|');
}
function priceRanges() {
  const max = Math.max(...activeProducts().map(p => priceInfo(p).price), 1000);
  const step = 5 * Math.pow(10, Math.max(0, Math.floor(Math.log10(max)) - 1));
  const t1 = Math.max(step, Math.round(max / 3 / step) * step), t2 = Math.max(t1 + step, Math.round(max * 2 / 3 / step) * step);
  return [[`0-${t1}`, `Menos de ${money(t1)}`], [`${t1}-${t2}`, `${money(t1)} a ${money(t2)}`], [`${t2}-`, `${money(t2)} o más`]];
}
function filtersHTML(q) {
  const s = ST();
  const base = filterProducts(q, 'cat');
  return html`
  <div class="fgroup"><h4>Categoría</h4>
    <a class="flink" href="${qhref(q, { cat: '' })}" aria-current="${!q.get('cat')}"><span>Todas</span><span class="count">${base.length}</span></a>
    ${s.cats.map(c => html`<a class="flink" href="${qhref(q, { cat: c })}" aria-current="${q.get('cat') === c}"><span>${c}</span><span class="count">${base.filter(p => p.cat === c).length}</span></a>`)}</div>
  <div class="fgroup"><h4>Precio</h4>
    <label class="check"><input type="radio" name="price" data-go="${qhref(q, { p: '' })}" ${!q.get('p') ? 'checked' : ''}> Cualquier precio</label>
    ${priceRanges().map(([v, l]) => html`<label class="check"><input type="radio" name="price" data-go="${qhref(q, { p: v })}" ${q.get('p') === v ? 'checked' : ''}> ${l}</label>`)}</div>
  ${s.facets.map(f => {
    const vals = [...new Set(activeProducts().map(p => p.attrs[f]).filter(Boolean))];
    const pool = filterProducts(q, 'f_' + f);
    return html`<div class="fgroup"><h4>${f}</h4>${vals.map(v => html`<label class="check"><input type="checkbox" data-go="${qhref(q, { ['f_' + f]: toggleVal(q, 'f_' + f, v) })}" ${(q.get('f_' + f) || '').split('|').includes(v) ? 'checked' : ''}> <span class="grow">${v}</span><span class="count">${pool.filter(p => p.attrs[f] === v).length}</span></label>`)}</div>`;
  })}
  <div class="fgroup"><h4>Disponibilidad</h4>
    <label class="check"><input type="checkbox" data-go="${qhref(q, { d: q.get('d') ? '' : '1' })}" ${q.get('d') ? 'checked' : ''}> Solo disponibles</label></div>`;
}
function catalog(q) {
  const s = ST();
  let list = filterProducts(q);
  const sort = q.get('s') || '';
  if (sort === 'asc') list.sort((a, b) => priceInfo(a).price - priceInfo(b).price);
  else if (sort === 'desc') list.sort((a, b) => priceInfo(b).price - priceInfo(a).price);
  else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const chips = [];
  if (q.get('cat')) chips.push([q.get('cat'), qhref(q, { cat: '' })]);
  if (q.get('q')) chips.push([`“${q.get('q')}”`, qhref(q, { q: '' })]);
  if (q.get('p')) chips.push([(priceRanges().find(r => r[0] === q.get('p')) || [0, 'Precio'])[1], qhref(q, { p: '' })]);
  if (q.get('d')) chips.push(['Solo disponibles', qhref(q, { d: '' })]);
  s.facets.forEach(f => (q.get('f_' + f) || '').split('|').filter(Boolean).forEach(v => chips.push([v, qhref(q, { ['f_' + f]: toggleVal(q, 'f_' + f, v) })])));
  const title = q.get('q') ? `Resultados para “${q.get('q')}”` : q.get('cat') || 'Todos los productos';
  return html`<div class="wrap">
    <div class="crumbs"><a href="#/">Inicio</a><span>/</span><span>Catálogo</span></div>
    <div class="cat-top"><div><h1 style="font-size:clamp(28px,4vw,40px)">${title}</h1><p class="muted" id="res-count">${list.length} ${list.length === 1 ? 'producto' : 'productos'}</p></div>
      <div class="row"><button class="btn btn-ghost btn-sm filter-btn" data-act="filters-open">${ic('filter')} Filtros</button>
        <div class="sort"><label for="sort" class="small muted">Ordenar</label><select id="sort" data-go-select>
          ${[['', 'Destacados'], ['asc', 'Precio: menor a mayor'], ['desc', 'Precio: mayor a menor'], ['name', 'Nombre A–Z']].map(([v, l]) => html`<option value="${qhref(q, { s: v })}" ${sort === v ? 'selected' : ''}>${l}</option>`)}</select></div></div></div>
    <div class="cat-layout"><aside class="filters" aria-label="Filtros">${filtersHTML(q)}</aside>
      <div>${chips.length ? html`<div class="chips">${chips.map(([l, h]) => html`<a class="chip x" href="${h}">${l}</a>`)}<a class="chip" href="#/catalogo">Limpiar todo</a></div>` : ''}
        ${list.length ? html`<div class="grid g3">${list.map(productCard)}</div>` : html`<div class="empty"><h2>No hay productos con esos filtros</h2><p class="muted">Prueba quitando algún filtro o buscando con otra palabra.</p><a class="btn btn-primary" href="#/catalogo">Ver todo el catálogo</a></div>`}</div></div></div>`;
}
/* ---- ficha de producto ---- */
function pdp(id) {
  const p = prod(id);
  if (!p || p.status !== 'active') return notFound();
  if (!S.ui.pdp || S.ui.pdp.pid !== id) {
    const opts = {};
    p.options.forEach(o => { opts[o.name] = o.values[0]; });
    S.ui.pdp = { pid: id, qty: 1, opts, img: 0 };
  }
  const u = S.ui.pdp, st = stockState(p), s = ST(), info = priceInfo(p), fo = fielOffer(p);
  const rel = activeProducts().filter(x => x.cat === p.cat && x.id !== p.id).concat(activeProducts().filter(x => x.cat !== p.cat && x.id !== p.id)).slice(0, 4);
  return html`<div class="wrap">
    <div class="crumbs"><a href="#/">Inicio</a><span>/</span><a href="#/catalogo?cat=${enc(p.cat)}">${p.cat}</a><span>/</span><span>${p.name}</span></div>
    <div class="pdp">
      <div class="gallery">${art(p, p.image ? '' : ['', 'alt1', 'alt2'][u.img], p.name)}
        ${p.image ? '' : html`<div class="thumbs">${['', 'alt1', 'alt2'].map((c, i) => html`<button data-act="thumb" data-i="${i}" aria-pressed="${u.img === i}" aria-label="Vista ${i + 1}">${art(p, c)}</button>`)}</div><p class="muted small">Imagen ilustrativa.</p>`}</div>
      <div class="pinfo">
        <div class="stack" style="gap:10px"><span class="eyebrow">${p.cat}</span><h1 style="font-size:clamp(28px,3.4vw,40px)">${p.name}</h1>
          <div class="price">${money(info.price)}${info.was ? html`<s style="font-size:16px">${money(info.was)}</s><span class="off">Ahorras ${info.pct}%</span>` : ''}</div>
          ${info.promo ? html`<p class="small muted">${info.promo.name}${info.promo.audience === 'fiel' ? ' · precio de cliente fiel' : ''}</p>` : ''}
          ${fo ? html`<div class="notice">Como <b>cliente fiel</b> pagas <b>${money(fo.price)}</b>. <a href="#/cuenta">Conoce el programa</a></div>` : ''}</div>
        <p>${p.desc}</p>
        ${p.options.map(o => html`<div class="ogroup" role="group" aria-label="${o.name}"><span class="lbl">${o.name}: <span class="muted">${u.opts[o.name]}</span></span>
          <div class="opts">${o.values.map(v => html`<button class="opt" data-act="opt" data-name="${o.name}" data-val="${v}" aria-pressed="${u.opts[o.name] === v}">${v}</button>`)}</div></div>`)}
        <div class="stock-note ${st}">${st === 'out' ? 'Agotado por ahora' : st === 'low' ? `Quedan solo ${p.stock} ${p.digital ? 'cupos' : 'unidades'}` : p.stock === null ? 'Disponible' : 'En stock'}</div>
        <div class="buy">
          <div class="stepper" role="group" aria-label="Cantidad"><button data-act="pdp-qty" data-d="-1" aria-label="Menos">−</button><span aria-live="polite">${u.qty}</span><button data-act="pdp-qty" data-d="1" aria-label="Más">+</button></div>
          <button class="btn btn-primary" data-act="add" ${st === 'out' ? 'disabled' : ''}>${st === 'out' ? 'Agotado' : 'Agregar al carrito'}</button></div>
        <div>
          <details class="acc" open><summary>Especificaciones</summary><div><dl class="spec">${Object.entries(p.attrs).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl></div></details>
          <details class="acc"><summary>${p.digital ? 'Entrega' : 'Envíos y devoluciones'}</summary><div>${p.digital ? 'Acceso inmediato por correo electrónico. Garantía de devolución según las condiciones de la tienda.' : `Envío de ${money(s.shipping.flat)}; gratis en compras desde ${money(s.shipping.freeFrom)}. Aceptamos cambios dentro de los primeros 30 días.`}</div></details></div>
      </div></div>
    ${rel.length ? html`<section class="sec" style="padding-top:0"><div class="sec-head"><h2>También te puede gustar</h2></div><div class="grid">${rel.map(productCard)}</div></section>` : ''}
  </div>`;
}
/* ---- carrito ---- */
function totalsHTML(t) {
  const s = ST();
  const missing = t.physical && !t.freeShip ? s.shipping.freeFrom - (t.subtotal - t.disc) : 0;
  return html`
    <div class="tr"><span>Subtotal</span><span class="num">${money(t.subtotal)}</span></div>
    ${t.loyalty ? html`<div class="tr"><span>Cliente fiel (${s.loyalty.discount} %)</span><span class="num">−${money(t.loyalty)}</span></div>` : ''}
    ${t.cDisc ? html`<div class="tr"><span>Cupón ${t.cp.code}</span><span class="num">−${money(t.cDisc)}</span></div>` : ''}
    ${t.note ? html`<p class="small" style="color:var(--warn)">${t.note}</p>` : ''}
    <div class="tr"><span>${t.physical ? 'Envío' : 'Entrega'}</span><span class="num">${!t.physical ? 'Digital, sin costo' : t.ship ? money(t.ship) : 'Gratis'}</span></div>
    ${missing > 0 ? html`<p class="muted small">Agrega ${money(missing)} más para tener envío gratis.</p>` : ''}
    <div class="tr total"><span>Total</span><span class="num">${money(t.total)}</span></div>
    <p class="muted small" style="margin-top:-6px">Precios en pesos colombianos (COP) con IVA incluido.</p>`;
}
function lineHTML(l, editable) {
  return html`<div class="line">
    <a href="#/producto/${l.p.id}">${art(l.p)}</a>
    <div class="meta"><a href="#/producto/${l.p.id}"><b>${l.p.name}</b></a>${Object.keys(l.it.opts).length ? html`<span class="muted small">${optsText(l.it.opts)}</span>` : ''}
      <span class="num muted small">${money(l.unit)} c/u${l.info.was ? html` <s>${money(l.info.was)}</s>` : ''}</span>
      ${editable ? html`<button class="link-btn" data-act="cart-remove" data-i="${l.i}" style="justify-self:start">Quitar</button>` : ''}</div>
    <div class="tot">${editable ? html`<div class="stepper"><button data-act="cart-qty" data-i="${l.i}" data-d="-1" aria-label="Menos">−</button><span>${l.it.qty}</span><button data-act="cart-qty" data-i="${l.i}" data-d="1" aria-label="Más">+</button></div>` : html`<span class="muted">×${l.it.qty}</span>`}
      <b class="num">${money(l.total)}</b></div></div>`;
}
function cartPage() {
  const ls = lines(), t = calc(ls), s = ST();
  if (!ls.length) return html`<div class="wrap"><div class="empty page-h"><h1>Tu carrito está vacío</h1><p class="muted">Agrega productos del catálogo para continuar.</p><a class="btn btn-primary" href="#/catalogo">Ver catálogo</a></div></div>`;
  return html`<div class="wrap"><div class="page-h"><h1 style="font-size:clamp(28px,4vw,40px)">Carrito</h1></div>
    <div class="two"><div>${ls.map(l => lineHTML(l, true))}</div>
      <aside class="summary"><h3>Resumen</h3>
        ${s.cart.coupon ? html`<div class="row between small"><span>Cupón <b class="mono">${s.cart.coupon}</b> aplicado</span><button class="link-btn" data-act="coupon-remove">Quitar</button></div>`
          : html`<form class="coupon" data-form="coupon"><label class="sr" for="coupon">Código de cupón</label><input id="coupon" placeholder="Código de cupón"><button class="btn btn-ghost btn-sm" style="min-height:40px">Aplicar</button></form><span class="muted small">Mira los códigos vigentes en <a href=\"#/ofertas\">Ofertas</a>.</span>`}
        ${totalsHTML(t)}
        ${!isFiel() ? html`<p class="muted small">Los clientes fieles tienen ${s.loyalty.discount} % de descuento${s.loyalty.freeShipping ? ' y envío gratis' : ''}. <a href="#/cuenta">Ver mi cuenta</a></p>` : ''}
        <a class="btn btn-primary btn-block" href="#/pago">Finalizar compra</a>
        <a class="btn btn-ghost btn-block" href="#/catalogo">Seguir comprando</a></aside></div></div>`;
}

/* ---- compra ---- */
const DOC_RULES = { CC: /^\d{6,10}$/, NIT: /^\d{6,10}(-\d)?$/, CE: /^[A-Za-z0-9]{4,12}$/, PP: /^[A-Za-z0-9]{4,16}$/, TI: /^\d{6,12}$/ };
const availableMethods = physical => ['online', 'transfer', 'cod'].filter(m => ST().pay[m] && (m !== 'cod' || physical));
function initCheckout() {
  const m = S.me, phys = calc(lines()).physical;
  S.ui.co = { step: 1, busy: false, errors: {}, data: {
    method: availableMethods(phys)[0] || '', docType: (m && m.docType) || 'CC', docNumber: (m && m.docNumber) || '',
    email: m ? m.email : '', name: m ? m.name : '', phone: m ? m.phone : '', address: m ? m.address : '', city: m ? m.city : '', notes: '',
  } };
}
function fld(id, label, o = {}) {
  const co = S.ui.co, v = co.data[id] || '', e = co.errors[id];
  return html`<div class="field ${o.full ? 'full' : ''}"><label for="f-${id}">${label}</label>
    <input id="f-${id}" type="${o.type || 'text'}" value="${v}" placeholder="${o.ph || ''}" autocomplete="${o.auto || 'off'}" ${o.mode ? raw(`inputmode="${o.mode}"`) : ''} data-field="${id}" ${e ? raw('aria-invalid="true"') : ''}>
    ${e ? html`<span class="err">${e}</span>` : o.hint ? html`<span class="hint">${o.hint}</span>` : ''}</div>`;
}
function accountNotice() {
  if (!S.me) return html`<div class="notice">¿Ya tienes cuenta? <a href="#/cuenta">Inicia sesión</a> para usar tus datos y tus beneficios de cliente.</div>`;
  return html`<div class="notice">Compras como <b>${S.me.name}</b> · ${isFiel() ? 'Cliente fiel: se aplican tus beneficios.' : 'Cliente normal.'}</div>`;
}
function validate(step) {
  const co = S.ui.co, d = co.data, er = {}, phys = calc(lines()).physical;
  if (step === 1) {
    if (!/^\S+@\S+\.\S{2,}$/.test((d.email || '').trim())) er.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    if (!(d.name || '').trim()) er.name = 'Escribe tu nombre completo.';
    if ((d.phone || '').replace(/\D/g, '').length < 7) er.phone = 'Escribe un teléfono de al menos 7 dígitos.';
    if (d.docType !== 'CF' && !DOC_RULES[d.docType].test((d.docNumber || '').replace(/[\s.]/g, ''))) er.docNumber = 'El número de documento no es válido para el tipo elegido.';
    if (phys && (d.address || '').trim().length < 5) er.address = 'Escribe la dirección de entrega.';
    if (phys && !(d.city || '').trim()) er.city = 'Escribe la ciudad.';
  }
  if (step === 2 && !availableMethods(phys).includes(d.method)) er.method = 'Elige cómo vas a pagar.';
  co.errors = er;
  return !Object.keys(er).length;
}
function sumList(ls) {
  return ls.map(l => html`<div class="mini-line">${art(l.p)}<div class="grow"><b class="small">${l.p.name}</b><div class="muted small">${[optsText(l.it.opts), '×' + l.it.qty].filter(Boolean).join(' · ')}</div></div><span class="num small">${money(l.total)}</span></div>`);
}
function checkout() {
  const ls = lines();
  if (!ls.length) return html`<div class="wrap"><div class="empty page-h"><h1>No hay nada para pagar</h1><p class="muted">Tu carrito está vacío.</p><a class="btn btn-primary" href="#/catalogo">Ver catálogo</a></div></div>`;
  if (!S.ui.co) initCheckout();
  const co = S.ui.co, d = co.data, t = calc(ls);
  const names = t.physical ? ['Datos y entrega', 'Pago', 'Revisión'] : ['Tus datos', 'Pago', 'Revisión'];
  const summary = html`<h3>Tu pedido</h3><div class="stack">${sumList(ls)}</div>${totalsHTML(t)}`;
  const methods = availableMethods(t.physical);
  let body;
  if (co.step === 1) {
    body = html`${accountNotice()}<div class="panel"><h3>Contacto</h3>
      <div class="form-grid">${fld('email', 'Correo electrónico', { type: 'email', auto: 'email', full: true, hint: t.physical ? 'Te enviaremos la confirmación y el seguimiento.' : 'Aquí recibirás el acceso a tu compra.' })}
        ${fld('name', 'Nombre completo', { auto: 'name' })}${fld('phone', 'Teléfono', { type: 'tel', auto: 'tel', mode: 'tel' })}</div></div>
      <div class="panel"><h3>Datos para tu factura</h3>
        <div class="form-grid"><div class="field"><label for="f-docType">Tipo de documento</label><select id="f-docType" data-field="docType" data-rerender>${Object.entries(S.docTypes).map(([k, v]) => html`<option value="${k}" ${d.docType === k ? 'selected' : ''}>${v}</option>`)}</select></div>
          ${d.docType === 'CF' ? '' : fld('docNumber', 'Número de documento', { mode: 'numeric', hint: d.docType === 'NIT' ? 'Con dígito de verificación si lo tienes, por ejemplo 900123456-7.' : '' })}</div>
        <p class="muted small">Los usamos para la factura electrónica de tu compra.</p></div>
      ${t.physical ? html`<div class="panel"><h3>Entrega</h3><div class="form-grid">${fld('address', 'Dirección', { auto: 'street-address', full: true })}${fld('city', 'Ciudad', { auto: 'address-level2' })}${fld('notes', 'Indicaciones (opcional)', { ph: 'Torre, apartamento, portería…' })}</div>
        <div class="paycard" style="cursor:default;border-color:var(--accent)"><span></span><b>Envío estándar</b><small>2 a 4 días hábiles · ${t.ship ? money(t.ship) : 'Gratis'}</small></div></div>` : html`<div class="notice">Es un pedido digital: no necesitas dirección. Recibirás el acceso por correo.</div>`}`;
  } else if (co.step === 2) {
    const sub = { online: isDemoPay() ? 'Pasarela simulada de demostración: tú eliges si el pago se aprueba o se rechaza. No se cobra nada.' : 'Tarjeta, PSE, Nequi, Bancolombia y más. Pagas en el sitio seguro de Wompi y vuelves aquí.', transfer: 'Te mostramos los datos bancarios al confirmar. El pedido se prepara al recibir el pago.', cod: 'Pagas en efectivo al recibir el pedido.' };
    body = html`<div class="panel"><h3>Método de pago</h3>
      ${methods.length ? methods.map(m => html`<label class="paycard"><input type="radio" name="method" value="${m}" data-method ${d.method === m ? 'checked' : ''}><b>${methodLabel(m)}</b><small>${sub[m]}</small></label>`) : html`<p class="muted">La tienda no tiene métodos de pago disponibles. Escríbenos para completar tu compra.</p>`}
      ${co.errors.method ? html`<span class="err">${co.errors.method}</span>` : ''}</div>`;
  } else {
    body = html`<div class="panel"><h3>Revisa tu pedido</h3>
      <dl class="spec"><dt>Contacto</dt><dd>${d.name}<br><span class="muted">${d.email} · ${d.phone}</span></dd>
        <dt>Factura a</dt><dd>${S.docTypes[d.docType]}${d.docType === 'CF' ? '' : ' ' + d.docNumber}</dd>
        ${t.physical ? html`<dt>Entrega</dt><dd>${d.address}, ${d.city}${d.notes ? html`<br><span class="muted">${d.notes}</span>` : ''}</dd>` : html`<dt>Entrega</dt><dd>Digital, por correo</dd>`}
        <dt>Pago</dt><dd>${methodLabel(d.method)}</dd></dl>
      <div class="row"><button class="link-btn" data-act="co-edit" data-step="1">Editar datos</button><button class="link-btn" data-act="co-edit" data-step="2">Cambiar pago</button></div></div>
      ${d.method === 'online' ? html`<div class="notice">${isDemoPay() ? 'Al confirmar te llevamos a una pasarela de pago simulada. No se cobra nada.' : 'Al confirmar te llevamos al sitio seguro de Wompi para completar el pago.'}</div>` : ''}`;
  }
  return html`<div class="wrap"><div class="page-h"><h1 style="font-size:clamp(28px,4vw,40px)">Finalizar compra</h1></div>
    <ol class="steps" style="padding:0;margin:0 0 28px">${names.map((n, i) => html`<li ${co.step === i + 1 ? raw('aria-current="step"') : ''} class="${co.step > i + 1 ? 'done' : ''}"><span class="n">${co.step > i + 1 ? '✓' : i + 1}</span>${n}</li>`)}</ol>
    <div class="two"><div class="stack" style="gap:20px">
      <details class="panel m-only" style="padding:14px 16px"><summary style="cursor:pointer;font-weight:650">Resumen del pedido · ${money(t.total)}</summary><div class="stack mt">${summary}</div></details>
      ${body}
      <div class="row between">${co.step > 1 ? html`<button class="btn btn-ghost" data-act="co-back">Volver</button>` : html`<a class="btn btn-ghost" href="#/carrito">Volver al carrito</a>`}
        ${co.step < 3 ? html`<button class="btn btn-primary" data-act="co-next" ${co.step === 2 && !methods.length ? 'disabled' : ''}>Continuar</button>` : html`<button class="btn btn-primary" data-act="place-order" ${co.busy ? 'disabled' : ''}>${co.busy ? 'Procesando…' : d.method === 'online' ? `Confirmar y pagar · ${money(t.total)}` : `Confirmar pedido · ${money(t.total)}`}</button>`}</div></div>
      <aside class="summary d-only">${summary}</aside></div></div>`;
}
async function placeOrder() {
  const co = S.ui.co, d = co.data;
  if (co.busy) return;
  co.busy = true; render();
  try {
    const res = await api('POST', '/api/orders', {
      items: S.cart.items.map(i => ({ pid: i.pid, qty: i.qty, opts: i.opts })), coupon: S.cart.coupon || '', method: d.method,
      buyer: { name: d.name, email: d.email, phone: d.phone, docType: d.docType, docNumber: d.docNumber, address: d.address, city: d.city, notes: d.notes },
    });
    S.cart.items.length = 0; S.cart.coupon = null; persistCart();
    S.ui.co = null;
    store_.set(LAST_KEY, JSON.stringify({ id: res.order.id, token: res.order.token }));
    if (res.checkout && res.checkout.simulated) { await loadStore(); go(`#/pago-demo/${res.order.id}?t=${enc(res.order.token)}`); return; }
    if (res.checkout) { location.assign(res.checkout.url); return; }
    await loadStore();
    go(`#/pedido/${res.order.id}?t=${enc(res.order.token)}`);
  } catch (e) {
    co.busy = false;
    toast(e.message);
    if (['out_of_stock', 'unavailable', 'bad_coupon'].includes(e.code)) { try { await loadStore(); } catch (e2) { /* se reintenta */ } }
    render();
  }
}

function timeline(o) {
  if (o.status === 'cancelled') {
    return html`<ol class="timeline">${o.events.map(h => html`<li class="${h.status === 'cancelled' ? 'bad now' : 'done'}"><span class="dot"></span><div><b>${STATUS[h.status].l}</b><span class="small">${fmtDateTime(h.at)}${h.note ? ' · ' + h.note : ''}</span></div></li>`)}</ol>`;
  }
  const f = FLOWS[o.physical ? 'physical' : 'digital'].filter(s => !(o.method === 'cod' && s === 'paid'));
  const idx = f.indexOf(o.status);
  return html`<ol class="timeline">${f.map((st, i) => {
    const h = o.events.find(x => x.status === st);
    return html`<li class="${i <= idx ? 'done' : ''} ${i === idx ? 'now' : ''}"><span class="dot"></span><div><b>${STATUS[st].l}</b><span class="small">${h ? fmtDateTime(h.at) : 'Pendiente'}</span></div></li>`;
  })}</ol>`;
}

function done() {
  if (!S.order) return html`<div class="wrap"><div class="empty page-h"><h1>No encontramos ese pedido</h1><p class="muted">El enlace está incompleto o el pedido no existe. Si compraste con una cuenta, inicia sesión para verlo.</p><a class="btn btn-primary" href="#/cuenta">Mi cuenta</a></div></div>`;
  const o = S.order.order, first = o.customer.name.split(' ')[0];
  const waiting = o.status === 'pending' && o.method === 'online';
  const title = o.status === 'cancelled' ? 'Este pedido fue cancelado.' : waiting ? 'Falta completar tu pago.' : o.status === 'pending' ? `Gracias, ${first}. Recibimos tu pedido.` : `Gracias, ${first}. Tu pedido está confirmado.`;
  return html`<div class="wrap"><div class="page-h stack" style="justify-items:start;gap:16px"><div class="done-mark" style="${waiting || o.status === 'cancelled' ? 'background:var(--warn)' : ''}">${ic(o.status === 'cancelled' ? 'close' : 'check')}</div>
    <h1 style="font-size:clamp(28px,4vw,40px)">${title}</h1>
    <p class="lead">Pedido <b class="mono">#${o.id}</b>. ${waiting ? (isDemoPay() ? 'Falta completar el pago en la pasarela simulada.' : 'Estamos esperando la confirmación de Wompi. Si ya pagaste, esta página se actualiza sola.') : `Enviaremos la información a ${o.customer.email}.`}</p></div>
    <div class="two"><div class="stack" style="gap:20px">
      ${waiting ? html`<div class="row"><button class="btn btn-primary" data-act="pay-again">Completar el pago</button>${isDemoPay() ? '' : html`<button class="btn btn-ghost" data-act="order-check">Ya pagué, verificar</button>`}</div>` : ''}
      <div class="panel"><h3>Estado</h3>${timeline(o)}</div>
      ${o.method === 'transfer' && o.status === 'pending' ? html`<div class="notice"><b>Datos para la transferencia:</b> ${S.order.transferInstructions || 'La tienda te contactará con los datos bancarios.'} Usa el pedido #${o.id} como referencia.</div>` : ''}
      ${o.method === 'cod' && o.status !== 'cancelled' && o.status !== 'delivered' ? html`<div class="notice">Pagas en efectivo cuando recibas el pedido.</div>` : ''}
      <div class="row"><a class="btn ${waiting ? 'btn-ghost' : 'btn-primary'}" href="#/catalogo">Seguir comprando</a>${S.me ? html`<a class="btn btn-ghost" href="#/cuenta">Mis pedidos</a>` : ''}</div></div>
      <aside class="summary"><h3>Resumen</h3>${o.items.map(i => html`<div class="tr"><span>${i.name} <span class="muted">×${i.qty}</span></span><span class="num">${money(i.price * i.qty)}</span></div>`)}
        ${o.loyaltyDiscount ? html`<div class="tr"><span>Cliente fiel</span><span class="num">−${money(o.loyaltyDiscount)}</span></div>` : ''}
        ${o.couponDiscount ? html`<div class="tr"><span>Cupón ${o.couponCode}</span><span class="num">−${money(o.couponDiscount)}</span></div>` : ''}
        <div class="tr"><span>Envío</span><span class="num">${o.address ? (o.shipping ? money(o.shipping) : 'Gratis') : 'Digital'}</span></div>
        <div class="tr total"><span>Total</span><span class="num">${money(o.total)}</span></div>
        <p class="muted small">Pago: ${methodLabel(o.method)}</p></aside></div></div>`;
}

function demoGateway() {
  if (!S.demo) return html`<div class="wrap"><div class="empty page-h"><h1>No encontramos ese pago</h1><p class="muted">El enlace está incompleto, el pedido no existe o la pasarela simulada no está activa.</p><a class="btn btn-primary" href="#/">Volver a la tienda</a></div></div>`;
  const { order, attempt, token } = S.demo, m = S.ui.demoMethod || 'card', pendingTx = attempt && attempt.status === 'PENDING';
  const closed = order.status !== 'pending' || !attempt || !['CREATED', 'PENDING'].includes(attempt.status);
  const back = `#/pedido/${order.id}?t=${enc(token)}`;
  return html`<div class="wrap" style="max-width:560px;padding-block:32px 72px"><div class="stack" style="gap:20px">
    <div class="notice" style="border-color:var(--warn)"><b>Pasarela simulada · modo demostración.</b> No se cobra nada ni se usa ninguna tarjeta real.</div>
    <div class="panel"><div class="row between"><span class="eyebrow">Pago del pedido</span><span class="mono">#${order.id}</span></div>
      <div class="row between"><b>${S.store.name}</b><b class="num" style="font-size:24px">${money(order.total)}</b></div></div>
    ${closed ? html`<div class="panel"><h3>${order.status === 'pending' ? 'Este intento de pago ya terminó' : 'Este pedido ya no está pendiente de pago'}</h3><p class="muted">${order.status === 'pending' ? 'Vuelve al pedido para iniciar un nuevo intento.' : 'No hace falta pagar de nuevo.'}</p><a class="btn btn-primary" href="${back}">Ver mi pedido</a></div>`
    : html`<div class="panel"><h3>${pendingTx ? 'Tu pago quedó pendiente' : 'Elige cómo pagar'}</h3>
      ${pendingTx ? html`<p class="muted">Algunos medios, como PSE, tardan en confirmar. Elige cómo termina la transacción.</p>` : html`
        ${[['card', 'Tarjeta de crédito o débito'], ['pse', 'PSE'], ['nequi', 'Nequi']].map(([k, l]) => html`<label class="paycard"><input type="radio" name="dm" value="${k}" data-demo-method ${m === k ? 'checked' : ''}><b>${l}</b></label>`)}`}
      <p class="muted small">Resultado de la simulación:</p>
      <div class="stack" style="gap:10px">
        <button class="btn btn-primary" data-act="demo-outcome" data-outcome="approved">Simular pago aprobado</button>
        <button class="btn btn-ghost" data-act="demo-outcome" data-outcome="declined">Simular pago rechazado</button>
        ${pendingTx ? '' : html`<button class="btn btn-ghost" data-act="demo-outcome" data-outcome="pending">Simular pago pendiente</button>`}</div></div>
      <a class="muted" href="${back}">← Volver al pedido sin pagar</a>`}</div></div>`;
}

function pendingNotice() {
  let last = null;
  try { last = JSON.parse(store_.get(LAST_KEY) || 'null'); } catch (e) { /* sin pedido */ }
  if (!last) return '';
  return html`<div class="wrap" style="padding-top:16px"><div class="notice row between">Tienes un pedido sin completar: <b class="mono">#${last.id}</b> <a class="btn btn-ghost btn-sm" href="#/pedido/${last.id}?t=${enc(last.token)}">Ver pedido</a></div></div>`;
}

/* ---- cuenta ---- */
function cuenta() {
  const s = ST();
  if (!S.me) {
    const tab = S.ui.authTab;
    if (tab === 'forgot') return html`<div class="wrap" style="max-width:480px;padding-block:32px 72px"><div class="stack" style="gap:20px"><span class="eyebrow">Mi cuenta</span><h1 style="font-size:32px">Recupera tu contraseña</h1>
      <p class="muted">Escribe el correo de tu cuenta y te enviamos un enlace para elegir una contraseña nueva.</p>
      <form class="panel" data-form="forgot" novalidate><div class="field"><label for="a-email">Correo electrónico</label><input id="a-email" name="email" type="email" autocomplete="email"></div>
        <button class="btn btn-primary" type="submit" ${S.ui.busy ? 'disabled' : ''}>Enviar enlace</button></form>
      <a class="muted" href="#/cuenta" data-act="auth-tab" data-tab="login">← Volver a iniciar sesión</a></div></div>`;
    return html`<div class="wrap"><div class="page-h stack" style="gap:12px"><span class="eyebrow">Mi cuenta</span><h1>${tab === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
      <p class="lead">Con una cuenta guardas tus datos, ves tus pedidos y accedes a los beneficios de cliente fiel.</p></div>
      <div class="acct-grid" style="padding-bottom:40px;align-items:start">
        <form class="panel" data-form="${tab}" novalidate><nav class="tabs"><a href="#/cuenta" data-act="auth-tab" data-tab="login" aria-current="${tab === 'login'}">Ya tengo cuenta</a><a href="#/cuenta" data-act="auth-tab" data-tab="register" aria-current="${tab === 'register'}">Crear cuenta</a></nav>
          ${tab === 'register' ? html`<div class="field"><label for="a-name">Nombre completo</label><input id="a-name" name="name" autocomplete="name"></div><div class="field"><label for="a-phone">Teléfono</label><input id="a-phone" name="phone" type="tel" autocomplete="tel"></div>` : ''}
          <div class="field"><label for="a-email">Correo electrónico</label><input id="a-email" name="email" type="email" autocomplete="email"></div>
          <div class="field"><label for="a-pass">Contraseña</label><input id="a-pass" name="password" type="password" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}">${tab === 'register' ? html`<span class="hint">Mínimo 8 caracteres.</span>` : ''}</div>
          <button class="btn btn-primary" type="submit" ${S.ui.busy ? 'disabled' : ''}>${tab === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
          ${tab === 'login' ? html`<a class="muted small" href="#/cuenta" data-act="auth-tab" data-tab="forgot">¿Olvidaste tu contraseña?</a>` : ''}</form>
        <div class="stack"><h2>Diferencias entre perfiles</h2>${programTable()}</div></div></div>`;
  }
  const m = S.me, L = s.loyalty, orders = S.myOrders;
  const pct = Math.min(100, Math.round(m.spent / Math.max(1, L.threshold) * 100));
  return html`<div class="wrap"><div class="page-h row between"><div class="stack" style="gap:10px"><span class="eyebrow">Mi cuenta</span><h1 style="font-size:clamp(28px,4vw,40px)">${m.name}</h1>
      <div class="row"><span class="pill ${m.type === 'fiel' ? 'good' : ''}">${m.type === 'fiel' ? 'Cliente fiel' : 'Cliente normal'}</span><span class="muted">${m.email}</span></div></div>
      <button class="btn btn-ghost" data-act="logout">Cerrar sesión</button></div>
    <div class="two" style="grid-template-columns:minmax(0,1fr) 380px">
      <div class="stack" style="gap:24px"><section class="panel"><h3>Mis pedidos</h3>
        ${orders.length ? orders.map(o => html`<a class="list-row" style="padding-inline:0;grid-template-columns:minmax(0,1fr) auto auto" href="#/pedido/${o.id}"><span><b class="mono">#${o.id}</b> <span class="muted">· ${fmtDate(o.createdAt)}</span></span>${pill(o.status)}<b class="num">${money(o.total)}</b></a>`) : html`<p class="muted">Aún no tienes pedidos.</p>`}</section></div>
      <aside class="summary">${m.type === 'fiel' ? html`<h3>Tus beneficios</h3><ul class="guide-list" style="padding-left:18px"><li>${L.discount} % de descuento en cada compra.</li>${L.freeShipping ? html`<li>Envío gratis siempre.</li>` : ''}<li>Promociones y precios exclusivos en <a href="#/ofertas">Ofertas</a>.</li></ul>`
        : html`<h3>Hazte cliente fiel</h3><p class="muted">Acumula ${money(L.threshold)} en compras pagadas y obtén ${L.discount} % de descuento${L.freeShipping ? ', envío gratis' : ''} y precios exclusivos.</p>
          <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
          <div class="row between small"><span class="num">${money(m.spent)}</span><span class="muted">Te faltan <b class="num">${money(Math.max(0, L.threshold - m.spent))}</b></span></div>`}
        <a class="btn btn-ghost btn-block" href="#/ofertas">Ver ofertas</a></aside></div></div>`;
}
function resetPage() {
  const token = S.route.q.get('token') || '';
  if (!token) return notFound();
  return html`<div class="wrap" style="max-width:480px;padding-block:32px 72px"><div class="stack" style="gap:20px"><span class="eyebrow">Mi cuenta</span><h1 style="font-size:32px">Elige una contraseña nueva</h1>
    <form class="panel" data-form="reset" data-token="${token}" novalidate><div class="field"><label for="r-pass">Contraseña nueva</label><input id="r-pass" name="password" type="password" autocomplete="new-password"><span class="hint">Mínimo 8 caracteres.</span></div>
      <div class="field"><label for="r-pass2">Repite la contraseña</label><input id="r-pass2" name="password2" type="password" autocomplete="new-password"></div>
      <button class="btn btn-primary" type="submit" ${S.ui.busy ? 'disabled' : ''}>Guardar contraseña</button></form></div></div>`;
}
function notFound() {
  return html`<div class="wrap"><div class="empty page-h"><h1>No encontramos esa página</h1><p class="muted">El enlace no existe o el producto ya no está disponible.</p><a class="btn btn-primary" href="#/">Volver al inicio</a></div></div>`;
}

const endsText = r => r.ends ? 'Hasta ' + fmtDate(r.ends) : 'Sin fecha de cierre';
function programTable() {
  const L = ST().loyalty;
  return html`<div class="compare">
    <div class="plan"><span class="eyebrow">Perfil</span><h3 style="font-size:20px">Cliente normal</h3>
      <ul><li>Cuenta con historial de pedidos y datos guardados.</li><li>Promociones y cupones para todos.</li><li>Compra con o sin cuenta.</li></ul></div>
    <div class="plan fiel"><span class="eyebrow">Perfil</span><h3 style="font-size:20px">Cliente fiel</h3>
      <ul><li>Todo lo del cliente normal.</li><li><b>${L.discount} % de descuento</b> en cada compra.</li>${L.freeShipping ? html`<li><b>Envío gratis</b> siempre.</li>` : ''}<li>Promociones y precios exclusivos.</li><li>Se activa al acumular <b>${money(L.threshold)}</b> en compras.</li></ul></div></div>`;
}
function ofertas() {
  const s = ST(), live = s.promos.filter(r => promoLive(r));
  const sale = activeProducts().filter(p => priceInfo(p).was);
  const fielProds = activeProducts().filter(p => { const i = priceInfo(p, true); return i.promo && i.promo.audience === 'fiel'; });
  return html`<div class="wrap">
    <div class="page-h stack" style="gap:12px"><span class="eyebrow">Descuentos y promociones</span><h1>Ofertas</h1><p class="lead">Promociones vigentes, cupones y precios para clientes fieles.</p></div>
    <section class="stack" style="padding-bottom:48px"><h2>Promociones activas</h2>
      <div class="promo-grid">${live.map(r => {
        const locked = r.audience === 'fiel' && !isFiel();
        return html`<article class="promo ${locked ? 'locked' : ''}"><div class="row between"><span class="pill ${r.audience === 'fiel' ? 'good' : ''}">${r.audience === 'fiel' ? 'Cliente fiel' : 'Para todos'}</span><span class="muted small">${endsText(r)}</span></div>
          <h3 style="font-size:19px">${r.name}</h3><p class="muted">${r.desc}</p><p class="promo-val">${promoText(r)}</p>
          <div class="row">${r.code ? html`<span class="code">${r.code}</span>${locked ? '' : html`<button class="btn btn-ghost btn-sm" data-act="apply-code" data-code="${r.code}">Aplicar al carrito</button>`}` : html`<span class="muted small">Se aplica automáticamente.</span>`}
            ${locked ? html`<a class="btn btn-ghost btn-sm" href="#/cuenta">Iniciar sesión</a>` : ''}</div></article>`;
      })}</div></section>
    ${sale.length ? html`<section style="padding-bottom:56px"><div class="sec-head"><h2>En oferta ahora</h2><a href="#/catalogo" class="muted">Ver catálogo</a></div><div class="grid">${sale.slice(0, 8).map(productCard)}</div></section>` : ''}
    ${fielProds.length ? html`<section style="padding-bottom:56px"><div class="sec-head"><div><span class="eyebrow">Exclusivo</span><h2>Precios para clientes fieles</h2></div></div>
      ${isFiel() ? '' : html`<p class="muted" style="margin-bottom:20px">Estos son los precios que verías con una cuenta de cliente fiel. <a href="#/cuenta">Crea tu cuenta o inicia sesión</a>.</p>`}
      <div class="grid">${fielProds.slice(0, 8).map(fielCard)}</div></section>` : ''}
    <section class="stack" style="padding-bottom:72px"><h2>Programa de cliente fiel</h2>${programTable()}</section></div>`;
}

/* ================= panel de administración ================= */
ICONS.mail = '<path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/>';
ICONS.invoice = '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>';
async function loadAdmin(b, c) {
  if (S.admin === undefined) { try { S.admin = (await api('GET', '/api/admin/me')).admin; } catch (e) { S.admin = null; } }
  if (!S.admin) return;
  const A = S.adm;
  try {
    if (!b) A.summary = await api('GET', '/api/admin/summary');
    else if (b === 'productos' || b === 'inventario') { const d = await api('GET', '/api/admin/products'); A.products = d.products; A.cats = d.cats; }
    else if (b === 'pedidos') { if (c) A.order = (await api('GET', `/api/admin/orders/${c}`)).order; else A.orders = (await api('GET', '/api/admin/orders?limit=500')).orders; }
    else if (b === 'clientes') A.customers = (await api('GET', '/api/admin/customers')).customers;
    else if (b === 'promociones') { A.promos = (await api('GET', '/api/admin/promos')).promos; A.cats = (await api('GET', '/api/admin/settings')).cats; }
    else if (b === 'facturacion') { A.fiscal = await api('GET', '/api/admin/fiscal'); A.invoices = (await api('GET', '/api/admin/invoices')).invoices; A.invDoc = null; }
    else if (b === 'ajustes') A.settings = await api('GET', '/api/admin/settings');
    else if (b === 'correos') { const d = await api('GET', '/api/admin/emails'); A.emails = d.emails; A.mailTransport = d.transport; A.mailView = null; }
  } catch (e) { if (e.status === 401) { S.admin = null; return; } throw e; }
}

const niceMax = v => { if (v <= 0) return 100; const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; };
const shortMoney = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(Math.round(n));
const INV = { queued: ['En cola', 'warn'], issued: ['Emitida', 'good'], rejected: ['Rechazada', 'bad'], error: ['Con error', 'bad'] };
const invPill = s => html`<span class="pill ${INV[s][1]}">${INV[s][0]}</span>`;

function adminLogin() {
  return html`<div class="wrap" style="max-width:440px;padding-block:64px"><div class="stack" style="gap:20px"><span class="eyebrow">Administración</span><h1 style="font-size:32px">Entrar al panel</h1>
    <form class="panel" data-form="admin-login" novalidate><div class="field"><label for="l-email">Correo</label><input id="l-email" name="email" type="email" autocomplete="username"></div>
      <div class="field"><label for="l-pass">Contraseña</label><input id="l-pass" name="password" type="password" autocomplete="current-password"></div>
      <button class="btn btn-primary" type="submit" ${S.ui.busy ? 'disabled' : ''}>Entrar</button></form>
    <a class="muted" href="#/">← Volver a la tienda</a></div></div>`;
}

function adminDash() {
  const d = S.adm.summary, s = S.store, max = niceMax(Math.max(...d.days.map(x => x.total)));
  return html`
  <div class="adm-h"><div><span class="eyebrow">${s.name}</span><h1>Resumen</h1></div><a class="btn btn-ghost btn-sm" href="#/admin/productos/nuevo">Nuevo producto</a></div>
  ${d.invoiceWarnings.map(w => html`<div class="notice" style="border-color:var(--${w.level === 'error' ? 'bad' : 'warn'})">${w.text} <a href="#/admin/facturacion">Ir a facturación</a></div>`)}
  <div class="kpis">
    <div class="kpi"><span class="eyebrow">Ventas, 14 días</span><b>${money(d.sales14)}</b><span class="sub">${d.orders14} pedidos pagados</span></div>
    <div class="kpi"><span class="eyebrow">Por atender</span><b>${d.toAttend}</b><span class="sub">${d.unpaid} sin pagar</span></div>
    <div class="kpi"><span class="eyebrow">Ticket promedio</span><b>${money(d.avgTicket)}</b><span class="sub">por pedido</span></div>
    <div class="kpi"><span class="eyebrow">Stock en alerta</span><b>${d.stockAlerts.length}</b><span class="sub">${d.stockAlerts.filter(p => p.stock === 0).length} agotados</span></div></div>
  <div class="cols">
    <section class="card-box"><header><h3>Ventas por día</h3><span class="muted small">Del ${fmtDate(d.days[0].date + 'T12:00:00')} al ${fmtDate(d.days[13].date + 'T12:00:00')}</span></header>
      <div class="pad chart-wrap"><div class="chart" role="img" aria-label="Ventas diarias de los últimos 14 días">
        ${[1, .5, 0].map(f => html`<div class="gl" style="bottom:${f * 100}%"><span>${shortMoney(max * f)}</span></div>`)}
        <div class="bars">${d.days.map((x, i) => html`<div class="bar ${i === 13 ? 'today' : ''}" title="${fmtDate(x.date + 'T12:00:00')}: ${money(x.total)}"><i style="height:${(x.total / max) * 100}%"></i><em>${Number(x.date.slice(8))}</em></div>`)}</div></div></div></section>
    <section class="card-box"><header><h3>Inventario en alerta</h3><a class="small" href="#/admin/inventario">Ver todo</a></header>
      ${d.stockAlerts.length ? d.stockAlerts.slice(0, 5).map(p => html`<a class="list-row" href="#/admin/productos/${p.id}">${art(p)}<span><b>${p.name}</b><br><span class="muted small">${p.stock} en stock</span></span>${stockPill(p)}</a>`) : html`<p class="pad muted">Todo el inventario está en orden.</p>`}</section></div>
  <section class="card-box"><header><h3>Pedidos recientes</h3><a class="small" href="#/admin/pedidos">Ver todos</a></header>${d.recent.length ? ordersTable(d.recent) : html`<p class="pad muted">Todavía no hay pedidos.</p>`}</section>`;
}
function ordersTable(list) {
  return html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th>Estado</th><th>Factura</th><th class="r">Total</th></tr></thead><tbody>
    ${list.map(o => html`<tr data-search="${(o.id + ' ' + o.customer.name + ' ' + o.customer.email).toLowerCase()}">
      <td data-label="Pedido"><a class="mono" href="#/admin/pedidos/${o.id}"><b>#${o.id}</b></a></td><td data-label="Fecha">${fmtDate(o.createdAt)}</td>
      <td data-label="Cliente">${o.customer.name}${o.fiel ? html` <span class="pill good">Fiel</span>` : ''}</td><td data-label="Pago">${methodLabel(o.method)}</td><td data-label="Estado">${pill(o.status)}</td>
      <td data-label="Factura">${o.invoiceStatus ? invPill(o.invoiceStatus) : html`<span class="muted">—</span>`}</td>
      <td data-label="Total" class="r num">${money(o.total)}</td></tr>`)}</tbody></table></div>`;
}
function filterBox(ph) {
  return html`<div class="field" style="max-width:320px"><label class="sr" for="adm-filter">Buscar</label><input id="adm-filter" type="search" placeholder="${ph}" data-input="filter"></div>`;
}

function adminProducts(q) {
  const list0 = S.adm.products, f = q.get('f') || 'all';
  const list = list0.filter(p => f === 'all' || p.status === f);
  const tab = (k, l, n) => html`<a href="#/admin/productos${k === 'all' ? '' : '?f=' + k}" aria-current="${f === k}">${l} <span class="c">${n}</span></a>`;
  return html`<div class="adm-h"><div><span class="eyebrow">Catálogo</span><h1>Productos</h1></div><a class="btn btn-primary btn-sm" href="#/admin/productos/nuevo">Nuevo producto</a></div>
  <div class="card-box"><div class="pad row between" style="padding-bottom:0">${filterBox('Buscar por nombre o referencia')}</div>
    <div style="padding:12px 20px 0"><nav class="tabs">${tab('all', 'Todos', list0.length)}${tab('active', 'Activos', list0.filter(p => p.status === 'active').length)}${tab('draft', 'Borradores', list0.filter(p => p.status === 'draft').length)}</nav></div>
    ${list.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th>Categoría</th><th class="r">Precio</th><th>Stock</th><th>Estado</th><th></th></tr></thead><tbody>
    ${list.map(p => html`<tr data-search="${(p.name + ' ' + p.sku + ' ' + p.cat).toLowerCase()}">
      <td data-label="" class="full"><div class="cell-prod">${art(p)}<div><a href="#/admin/productos/${p.id}">${p.name}</a><div class="muted small mono">${p.sku}</div></div></div></td>
      <td data-label="Categoría">${p.cat}</td>
      <td data-label="Precio" class="r"><label class="sr" for="pr-${p.id}">Precio de ${p.name}</label><input id="pr-${p.id}" class="inline-num" type="number" min="0" step="100" value="${p.price}" data-change="price" data-id="${p.id}"></td>
      <td data-label="Stock">${stockPill(p)}<div class="muted small num">${p.stock === null ? '∞' : p.stock + ' u.'}</div></td>
      <td data-label="Estado"><span class="pill ${p.status === 'active' ? 'good' : ''}">${p.status === 'active' ? 'Activo' : 'Borrador'}</span></td>
      <td data-label="" class="r"><a class="btn btn-ghost btn-sm" href="#/admin/productos/${p.id}">Editar</a></td></tr>`)}
    </tbody></table></div>` : html`<div class="pad empty"><h3>Aún no hay productos</h3><p class="muted">Crea el primero para que aparezca en la tienda.</p><a class="btn btn-primary btn-sm" href="#/admin/productos/nuevo">Nuevo producto</a></div>`}</div>`;
}

const KIND_LABEL = { tee: 'Camiseta', pants: 'Pantalón', bag: 'Bolso', cap: 'Gorra', shoe: 'Calzado', bottle: 'Botella', jar: 'Frasco', box: 'Caja', loaf: 'Pan', headphones: 'Audífonos', speaker: 'Parlante', lamp: 'Lámpara', laptop: 'Pantalla', keyboard: 'Teclado', cable: 'Cable', play: 'Curso en video', grid: 'Plantilla', cal: 'Sesión o cita', doc: 'Documento', dice: 'Dados', scroll: 'Mapa o pergamino', sword: 'Espada o miniatura' };
function adminProductEdit(id) {
  const s = S.store, isNew = id === 'nuevo';
  const p = isNew ? { id: '', name: '', cat: (S.adm.cats && S.adm.cats[0]) || '', price: 0, compare: null, stock: 10, kind: 'box', hue: s.hue, attrs: {}, options: [], desc: '', sku: '', status: 'draft', digital: s.type === 'digital', taxRate: 19, image: null } : (S.adm.products || []).find(x => x.id === id);
  if (!p) return notFound();
  const delAsk = S.ui.confirm === 'del:' + p.id;
  return html`<div class="adm-h"><div><a class="small muted" href="#/admin/productos">← Productos</a><h1>${isNew ? 'Nuevo producto' : p.name}</h1></div>
    ${isNew || p.status !== 'active' ? '' : html`<a class="btn btn-ghost btn-sm" href="#/producto/${p.id}">Ver en la tienda</a>`}</div>
  <form id="pform" data-form="product" data-id="${isNew ? 'nuevo' : p.id}" class="edit-grid" novalidate>
    <div class="stack" style="gap:24px">
      <div class="panel"><h3>Información</h3><div class="form-grid">
        <div class="field full"><label for="e-name">Nombre</label><input id="e-name" name="name" value="${p.name}" required></div>
        <div class="field full"><label for="e-desc">Descripción</label><textarea id="e-desc" name="desc">${p.desc}</textarea></div>
        <div class="field"><label for="e-cat">Categoría</label><input id="e-cat" name="cat" list="cats" value="${p.cat}"><datalist id="cats">${(S.adm.cats || []).map(c => html`<option value="${c}">`)}</datalist><span class="hint">Escribe una nueva para crearla.</span></div>
        <div class="field"><label for="e-sku">Referencia (SKU)</label><input id="e-sku" name="sku" value="${p.sku}"><span class="hint">Déjala vacía para asignarla sola.</span></div></div></div>
      <div class="panel"><h3>Precio e inventario</h3><div class="form-grid">
        <div class="field"><label for="e-price">Precio con IVA (COP)</label><input id="e-price" name="price" type="number" min="0" step="100" value="${p.price}"></div>
        <div class="field"><label for="e-compare">Precio anterior (opcional)</label><input id="e-compare" name="compare" type="number" min="0" step="100" value="${p.compare || ''}"><span class="hint">Si es mayor al precio, se muestra como oferta.</span></div>
        <div class="field"><label for="e-tax">IVA del producto</label><select id="e-tax" name="taxRate">${[19, 5, 0].map(r => html`<option value="${r}" ${p.taxRate === r ? 'selected' : ''}>${r === 0 ? 'Excluido o exento (0 %)' : r + ' %'}</option>`)}</select><span class="hint">El precio ya incluye el IVA. Se usa para la factura.</span></div>
        <div class="field"><label for="e-stock">Unidades disponibles</label><input id="e-stock" name="stock" type="number" min="0" step="1" value="${p.stock === null ? '' : p.stock}" ${p.stock === null ? 'disabled' : ''}></div>
        <label class="check full"><input type="checkbox" name="unlimited" id="e-unl" ${p.stock === null ? 'checked' : ''} data-change="unlimited"> Sin límite de stock</label></div></div>
      <div class="panel"><h3>Atributos y opciones</h3><p class="muted small">Los atributos alimentan los filtros del catálogo. Las opciones son lo que el cliente elige al comprar.</p>
        <div class="form-grid">${s.facets.map(f => html`<div class="field"><label for="a-${f}">${f}</label><input id="a-${f}" name="attr:${f}" value="${p.attrs[f] || ''}"></div>`)}</div>
        <div class="field"><label for="e-opts">Opciones (una por línea)</label><textarea id="e-opts" name="options" placeholder="Talla: S, M, L">${p.options.map(o => o.name + ': ' + o.values.join(', ')).join('\n')}</textarea></div></div></div>
    <div class="stack" style="gap:24px">
      <div class="panel"><h3>Estado</h3><div class="field"><label for="e-status" class="sr">Estado</label><select id="e-status" name="status"><option value="active" ${p.status === 'active' ? 'selected' : ''}>Activo, visible en la tienda</option><option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Borrador, oculto</option></select></div>
        <label class="check"><input type="checkbox" name="digital" ${p.digital ? 'checked' : ''}> Producto digital o servicio (sin envío)</label></div>
      <div class="panel"><h3>Imagen</h3>${art(p, '', p.name)}
        ${isNew ? html`<p class="muted small">Guarda el producto para subir su foto.</p>` : html`<div class="field"><label for="e-file" class="btn btn-ghost btn-sm" style="cursor:pointer">${p.image ? 'Cambiar foto' : 'Subir foto'}</label><input id="e-file" class="sr" type="file" accept="image/jpeg,image/png,image/webp" data-change="upload" data-id="${p.id}"><span class="hint">JPG, PNG o WebP, hasta 3 MB.</span></div>
          ${p.image ? html`<button class="link-btn" type="button" data-act="img-remove" data-id="${p.id}" style="justify-self:start">Quitar foto</button>` : ''}`}
        ${p.image ? '' : html`<div class="field"><label for="e-kind">Ilustración mientras no haya foto</label><select id="e-kind" name="kind">${Object.entries(KIND_LABEL).map(([k, l]) => html`<option value="${k}" ${p.kind === k ? 'selected' : ''}>${l}</option>`)}</select></div>`}</div>
      <div class="stack"><button class="btn btn-primary btn-block" type="submit">${isNew ? 'Crear producto' : 'Guardar cambios'}</button>
        ${isNew ? '' : delAsk ? html`<div class="notice">¿Eliminar este producto? Los pedidos anteriores conservan su detalle.<div class="row" style="margin-top:12px"><button class="btn btn-danger btn-sm" type="button" data-act="del-yes" data-id="${p.id}">Sí, eliminar</button><button class="btn btn-ghost btn-sm" type="button" data-act="confirm-no">Cancelar</button></div></div>` : html`<button class="btn btn-ghost btn-block" type="button" data-act="del-ask" data-id="${p.id}">Eliminar producto</button>`}</div></div>
  </form>`;
}

function adminInventory(q) {
  const s = S.store, all = S.adm.products, f = q.get('f') || 'all';
  const cnt = k => all.filter(p => k === 'all' || stockState(p) === k).length;
  const list = all.filter(p => f === 'all' || stockState(p) === f);
  const units = all.reduce((a, p) => a + (p.stock || 0), 0), value = all.reduce((a, p) => a + (p.stock || 0) * p.price, 0);
  const tab = (k, l) => html`<a href="#/admin/inventario${k === 'all' ? '' : '?f=' + k}" aria-current="${f === k}">${l} <span class="c">${cnt(k)}</span></a>`;
  return html`<div class="adm-h"><div><span class="eyebrow">Existencias</span><h1>Inventario</h1></div></div>
  <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="kpi"><span class="eyebrow">Productos</span><b>${all.length}</b></div>
    <div class="kpi"><span class="eyebrow">Unidades</span><b>${units}</b></div><div class="kpi"><span class="eyebrow">Valor a precio de venta</span><b>${money(value)}</b></div></div>
  <div class="card-box"><div class="pad" style="padding-bottom:0">${filterBox('Buscar producto o referencia')}</div>
    <div style="padding:12px 20px 0"><nav class="tabs">${tab('all', 'Todos')}${tab('low', 'Stock bajo')}${tab('out', 'Agotados')}</nav></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th>Referencia</th><th>Existencias</th><th>Estado</th></tr></thead><tbody>
    ${list.map(p => html`<tr data-search="${(p.name + ' ' + p.sku).toLowerCase()}">
      <td data-label="" class="full"><div class="cell-prod">${art(p)}<a href="#/admin/productos/${p.id}">${p.name}</a></div></td>
      <td data-label="Referencia" class="mono">${p.sku}</td>
      <td data-label="Existencias">${p.stock === null ? html`<span class="row"><span class="muted">Sin límite</span><button class="link-btn" data-act="stock-limit" data-id="${p.id}">Definir cantidad</button></span>`
        : html`<div class="stock-ctl"><button data-act="stock" data-id="${p.id}" data-d="-1" aria-label="Restar una unidad a ${p.name}">−</button><input type="number" min="0" value="${p.stock}" aria-label="Existencias de ${p.name}" data-change="stock" data-id="${p.id}"><button data-act="stock" data-id="${p.id}" data-d="1" aria-label="Sumar una unidad a ${p.name}">+</button></div>`}</td>
      <td data-label="Estado">${stockPill(p)}</td></tr>`)}</tbody></table></div>
    ${list.length ? '' : html`<p class="pad muted">No hay productos en este grupo.</p>`}</div>
  <p class="muted small">Alerta de stock bajo: ${s.lowStock} unidades o menos. Cámbialo en <a href="#/admin/ajustes">Ajustes</a>.</p>`;
}

function adminOrders(q) {
  const all = S.adm.orders, f = q.get('f') || 'all';
  const list = all.filter(o => f === 'all' || o.status === f);
  const keys = ['all', 'pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'];
  return html`<div class="adm-h"><div><span class="eyebrow">Ventas</span><h1>Pedidos</h1></div></div>
  <div class="card-box"><div class="pad" style="padding-bottom:0">${filterBox('Buscar por número o cliente')}</div>
    <div style="padding:12px 20px 0;overflow-x:auto"><nav class="tabs" style="flex-wrap:nowrap;white-space:nowrap">${keys.map(k => html`<a href="#/admin/pedidos${k === 'all' ? '' : '?f=' + k}" aria-current="${f === k}">${k === 'all' ? 'Todos' : STATUS[k].l} <span class="c">${k === 'all' ? all.length : all.filter(o => o.status === k).length}</span></a>`)}</nav></div>
    ${list.length ? ordersTable(list) : html`<p class="pad muted">No hay pedidos en este estado.</p>`}</div>`;
}
function adminOrder() {
  const o = S.adm.order;
  if (!o) return notFound();
  const ask = S.ui.confirm === 'cancel:' + o.id;
  const onlinePaid = o.method === 'online' && o.paidAt && !isDemoPay();
  return html`<div class="adm-h"><div><a class="small muted" href="#/admin/pedidos">← Pedidos</a><h1>Pedido <span class="mono">#${o.id}</span></h1></div><div class="row">${pill(o.status)}<span class="muted">${fmtDateTime(o.createdAt)}</span></div></div>
  <div class="cols">
    <div class="stack" style="gap:24px">
      <section class="card-box"><header><h3>Productos</h3></header><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Precio</th><th class="r">Cant.</th><th class="r">Subtotal</th></tr></thead><tbody>
        ${o.items.map(i => { const p = prod(i.pid); return html`<tr><td data-label="" class="full"><div class="cell-prod">${p ? art(p) : ''}<div><b>${i.name}</b>${Object.keys(i.opts || {}).length ? html`<div class="muted small">${optsText(i.opts)}</div>` : ''}</div></div></td><td data-label="Precio" class="r num">${money(i.price)}</td><td data-label="Cant." class="r num">${i.qty}</td><td data-label="Subtotal" class="r num">${money(i.price * i.qty)}</td></tr>`; })}</tbody></table></div>
        <div class="pad stack" style="gap:8px;border-top:1px solid var(--line)"><div class="row between"><span class="muted">Subtotal</span><span class="num">${money(o.subtotal)}</span></div>
          ${o.loyaltyDiscount ? html`<div class="row between"><span class="muted">Cliente fiel</span><span class="num">−${money(o.loyaltyDiscount)}</span></div>` : ''}
          ${o.couponDiscount ? html`<div class="row between"><span class="muted">Cupón ${o.couponCode}</span><span class="num">−${money(o.couponDiscount)}</span></div>` : ''}
          <div class="row between"><span class="muted">Envío</span><span class="num">${o.address ? (o.shipping ? money(o.shipping) : 'Gratis') : 'Digital'}</span></div>
          <div class="row between" style="font-weight:700;font-size:17px"><span>Total</span><span class="num">${money(o.total)}</span></div></div></section>
      <section class="card-box"><header><h3>Cliente y entrega</h3></header><div class="pad"><dl class="spec">
        <dt>Cliente</dt><dd>${o.customer.name} ${o.fiel ? html`<span class="pill good">Cliente fiel</span>` : ''}</dd><dt>Correo</dt><dd>${o.customer.email}</dd><dt>Teléfono</dt><dd class="mono">${o.customer.phone}</dd>
        <dt>Documento</dt><dd>${S.docTypes[o.docType] || o.docType} ${o.docType === 'CF' ? '' : o.docNumber}</dd>
        <dt>Entrega</dt><dd>${o.address ? html`${o.address.line}, ${o.address.city}${o.address.notes ? html`<br><span class="muted">${o.address.notes}</span>` : ''}` : 'Digital, por correo'}</dd>
        <dt>Pago</dt><dd>${methodLabel(o.method)} · ${o.paidAt ? 'recibido el ' + fmtDateTime(o.paidAt) : o.status === 'cancelled' ? 'cancelado' : 'por confirmar'}</dd></dl></div></section>
      ${o.payments.length ? html`<section class="card-box"><header><h3>Intentos de pago</h3></header><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Referencia</th><th>Estado del pago</th><th>Medio</th><th>Actualizado</th></tr></thead><tbody>
        ${o.payments.map(p => html`<tr><td data-label="Referencia" class="mono">${p.reference}</td><td data-label="Estado del pago"><span class="pill ${p.status === 'APPROVED' ? 'good' : p.status === 'PENDING' || p.status === 'CREATED' ? 'warn' : 'bad'}">${p.status}</span></td><td data-label="Medio">${p.method || '—'}</td><td data-label="Actualizado">${fmtDateTime(p.updatedAt)}</td></tr>`)}</tbody></table></div></section>` : ''}</div>
    <div class="stack" style="gap:24px"><section class="card-box"><header><h3>Seguimiento</h3></header><div class="pad stack">${timeline(o)}
      ${o.next ? html`<button class="btn btn-primary btn-block" data-act="order-next" data-id="${o.id}">${o.next.label}</button>` : ''}
      ${o.method === 'online' && o.status === 'pending' && !isDemoPay() ? html`<button class="btn btn-ghost btn-block" data-act="order-sync" data-id="${o.id}">Verificar pago con Wompi</button>` : ''}
      ${!['cancelled', 'delivered', 'shipped'].includes(o.status) ? (ask ? html`<div class="notice">¿Cancelar el pedido #${o.id}? Se devuelve el inventario.${onlinePaid ? ' El reembolso del pago se hace desde el panel de Wompi.' : ''}<div class="row" style="margin-top:12px"><button class="btn btn-danger btn-sm" data-act="order-cancel" data-id="${o.id}">Sí, cancelar</button><button class="btn btn-ghost btn-sm" data-act="confirm-no">Volver</button></div></div>` : html`<button class="btn btn-ghost btn-block" data-act="cancel-ask" data-id="${o.id}">Cancelar pedido</button>`) : ''}
      ${o.status === 'delivered' ? html`<p class="muted small">Pedido completado.</p>` : ''}</div></section>
    <section class="card-box"><header><h3>Factura electrónica</h3></header><div class="pad stack">${o.invoice ? html`<div class="row between">${invPill(o.invoice.status)}<span class="mono">${o.invoice.number ? o.invoice.prefix + o.invoice.number : 'Sin número'}</span></div>${o.invoice.lastError ? html`<p class="small" style="color:var(--bad)">${o.invoice.lastError}</p>` : ''}<a href="#/admin/facturacion">Ir a facturación</a>` : html`<p class="muted small">${o.paidAt ? 'Este pedido no tiene factura. Activa la facturación y usa “Encolar pedidos pagados”.' : 'Se genera cuando el pago queda confirmado.'}</p>`}</div></section></div></div>`;
}

function adminCustomers() {
  const L = S.store.loyalty, rows = S.adm.customers;
  const fiel = rows.filter(r => r.type === 'fiel');
  const total = rows.reduce((a, r) => a + r.spent, 0), fs = fiel.reduce((a, r) => a + r.spent, 0);
  return html`<div class="adm-h"><div><span class="eyebrow">Clientes</span><h1>Clientes y programa fiel</h1></div></div>
  <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="kpi"><span class="eyebrow">Clientes con cuenta</span><b>${rows.length}</b><span class="sub">${rows.length - fiel.length} normales</span></div>
    <div class="kpi"><span class="eyebrow">Clientes fieles</span><b>${fiel.length}</b></div><div class="kpi"><span class="eyebrow">Compras de fieles</span><b>${total ? Math.round(fs / total * 100) : 0} %</b><span class="sub">del total</span></div></div>
  <form class="panel" data-form="loyalty" novalidate><h3>Reglas del programa de cliente fiel</h3><div class="form-grid">
    <div class="field"><label for="l-disc">Descuento permanente (%)</label><input id="l-disc" name="discount" type="number" min="0" max="90" step="1" value="${L.discount}"></div>
    <div class="field"><label for="l-thr">Se vuelve fiel al acumular (COP)</label><input id="l-thr" name="threshold" type="number" min="0" step="10000" value="${L.threshold}"><span class="hint">Suma de compras pagadas y no canceladas.</span></div>
    ${S.store.type === 'digital' ? '' : html`<label class="check full"><input type="checkbox" name="freeShipping" ${L.freeShipping ? 'checked' : ''}> Envío gratis siempre para clientes fieles</label>`}</div>
    <div><button class="btn btn-primary btn-sm" type="submit">Guardar reglas</button></div></form>
  <div class="card-box"><div class="pad" style="padding-bottom:0">${filterBox('Buscar cliente')}</div>
    ${rows.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Perfil</th><th class="r">Pedidos</th><th class="r">Total comprado</th><th></th></tr></thead><tbody>
    ${rows.map(r => html`<tr data-search="${(r.name + ' ' + r.email).toLowerCase()}"><td data-label="" class="full"><b>${r.name}</b><div class="muted small">${r.email}</div></td>
      <td data-label="Perfil"><span class="pill ${r.type === 'fiel' ? 'good' : ''}">${r.type === 'fiel' ? 'Cliente fiel' : 'Cliente normal'}</span>${r.forced ? html`<div class="muted small">Asignado a mano</div>` : ''}</td>
      <td data-label="Pedidos" class="r num">${r.orders}</td><td data-label="Total comprado" class="r num">${money(r.spent)}</td>
      <td data-label="" class="r"><div class="row" style="justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-act="cust-set" data-id="${r.id}" data-type="${r.type === 'fiel' ? 'normal' : 'fiel'}">${r.type === 'fiel' ? 'Pasar a normal' : 'Hacer fiel'}</button>${r.forced ? html`<button class="link-btn" data-act="cust-set" data-id="${r.id}" data-type="auto">Automático</button>` : ''}</div></td></tr>`)}</tbody></table></div>`
      : html`<p class="pad muted">Cuando los clientes creen su cuenta aparecerán aquí.</p>`}</div>`;
}

const promoStatus = r => !r.active ? html`<span class="pill">Pausada</span>` : r.ends && new Date(r.ends) <= Date.now() ? html`<span class="pill bad">Vencida</span>` : html`<span class="pill good">Vigente</span>`;
function adminPromos() {
  const list = S.adm.promos;
  return html`<div class="adm-h"><div><span class="eyebrow">Marketing</span><h1>Promociones</h1></div><a class="btn btn-primary btn-sm" href="#/admin/promociones/nueva">Nueva promoción</a></div>
  <div class="card-box">${list.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Promoción</th><th>Descuento</th><th>Código</th><th>Audiencia</th><th>Vigencia</th><th>Activa</th><th></th></tr></thead><tbody>
    ${list.map(r => html`<tr>
      <td data-label="" class="full"><b>${r.name}</b><div class="muted small">${r.desc}</div></td>
      <td data-label="Descuento">${promoText(r)}</td>
      <td data-label="Código">${r.code ? html`<span class="mono">${r.code}</span>` : html`<span class="muted">Automática</span>`}</td>
      <td data-label="Audiencia"><span class="pill ${r.audience === 'fiel' ? 'good' : ''}">${r.audience === 'fiel' ? 'Cliente fiel' : 'Todos'}</span></td>
      <td data-label="Vigencia">${promoStatus(r)}<div class="muted small">${endsText(r)}</div></td>
      <td data-label="Activa"><label class="check"><input type="checkbox" data-change="promo-active" data-id="${r.id}" aria-label="Activar ${r.name}" ${r.active ? 'checked' : ''}></label></td>
      <td data-label="" class="r"><a class="btn btn-ghost btn-sm" href="#/admin/promociones/${r.id}">Editar</a></td></tr>`)}</tbody></table></div>`
    : html`<div class="pad empty"><h3>Sin promociones</h3><p class="muted">Crea una para ofrecer descuentos automáticos, cupones o beneficios para clientes fieles.</p></div>`}</div>
  <p class="muted small">Las promociones automáticas cambian el precio en el catálogo. Las que tienen código se aplican en el carrito. Las de audiencia “cliente fiel” solo las ven y las usan esos clientes.</p>`;
}
function adminPromoEdit(id) {
  const isNew = id === 'nueva';
  const r = isNew ? { id: '', name: '', desc: '', kind: 'percent', value: 10, scope: 'all', code: '', audience: 'all', min: 0, ends: null, active: true } : S.adm.promos.find(x => x.id === id);
  if (!r) return notFound();
  const delAsk = S.ui.confirm === 'promo:' + r.id;
  return html`<div class="adm-h"><div><a class="small muted" href="#/admin/promociones">← Promociones</a><h1>${isNew ? 'Nueva promoción' : r.name}</h1></div></div>
  <form id="promoform" data-form="promo" data-id="${isNew ? 'nueva' : r.id}" class="edit-grid" novalidate>
    <div class="stack" style="gap:24px"><div class="panel"><h3>Detalle</h3><div class="form-grid">
      <div class="field full"><label for="r-name">Nombre</label><input id="r-name" name="name" value="${r.name}"></div>
      <div class="field full"><label for="r-desc">Descripción para el cliente</label><input id="r-desc" name="desc" value="${r.desc}"></div>
      <div class="field"><label for="r-kind">Tipo</label><select id="r-kind" name="kind"><option value="percent" ${r.kind === 'percent' ? 'selected' : ''}>Porcentaje de descuento</option><option value="fixed" ${r.kind === 'fixed' ? 'selected' : ''}>Monto fijo (COP)</option><option value="shipping" ${r.kind === 'shipping' ? 'selected' : ''}>Envío gratis</option></select></div>
      <div class="field"><label for="r-value">Valor</label><input id="r-value" name="value" type="number" min="0" step="1" value="${r.value}"><span class="hint">Porcentaje (1 a 90) o pesos, según el tipo.</span></div>
      <div class="field"><label for="r-scope">Aplica a</label><select id="r-scope" name="scope"><option value="all">Toda la tienda</option>${(S.adm.cats || []).map(c => html`<option ${r.scope === c ? 'selected' : ''}>${c}</option>`)}</select></div>
      <div class="field"><label for="r-min">Compra mínima (COP)</label><input id="r-min" name="min" type="number" min="0" step="1000" value="${r.min}"></div></div></div>
    <div class="panel"><h3>Cómo se activa</h3><div class="form-grid">
      <div class="field"><label for="r-code">Código de cupón</label><input id="r-code" name="code" value="${r.code}" autocapitalize="characters"><span class="hint">Déjalo vacío para que se aplique automáticamente.</span></div>
      <div class="field"><label for="r-aud">Audiencia</label><select id="r-aud" name="audience"><option value="all" ${r.audience === 'all' ? 'selected' : ''}>Todos los clientes</option><option value="fiel" ${r.audience === 'fiel' ? 'selected' : ''}>Solo clientes fieles</option></select></div>
      <div class="field"><label for="r-ends">Termina el (opcional)</label><input id="r-ends" name="ends" type="date" value="${r.ends ? r.ends.slice(0, 10) : ''}"></div>
      <label class="check" style="align-self:end"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Promoción activa</label></div></div></div>
    <div class="stack"><button class="btn btn-primary btn-block" type="submit">${isNew ? 'Crear promoción' : 'Guardar cambios'}</button>
      ${isNew ? '' : delAsk ? html`<div class="notice">¿Eliminar esta promoción?<div class="row" style="margin-top:12px"><button class="btn btn-danger btn-sm" type="button" data-act="promo-del-yes" data-id="${r.id}">Sí, eliminar</button><button class="btn btn-ghost btn-sm" type="button" data-act="confirm-no">Cancelar</button></div></div>` : html`<button class="btn btn-ghost btn-block" type="button" data-act="promo-del-ask" data-id="${r.id}">Eliminar promoción</button>`}</div>
  </form>`;
}

function adminFiscal() {
  const { fiscal: f, providers, resolutions, warnings, counts } = S.adm.fiscal, invoices = S.adm.invoices;
  const inp = (k, label, o = {}) => html`<div class="field ${o.full ? 'full' : ''}"><label for="f-${k}">${label}</label><input id="f-${k}" name="${k}" value="${f[k] || ''}" ${o.mode ? raw(`inputmode="${o.mode}"`) : ''}>${o.hint ? html`<span class="hint">${o.hint}</span>` : ''}</div>`;
  const prov = providers.find(p => p.name === f.provider) || providers[0];
  const doc = S.adm.invDoc;
  return html`<div class="adm-h"><div><span class="eyebrow">DIAN</span><h1>Facturación electrónica</h1></div></div>
  ${!prov.fiscalValidity ? html`<div class="notice" style="border-color:var(--warn)"><b>Modo de prueba.</b> Los documentos que se generan son internos y <b>no tienen validez fiscal</b>: todavía no se envían a la DIAN. La conexión con la DIAN se activa en la siguiente etapa, con los datos de habilitación del cliente.</div>` : ''}
  ${warnings.map(w => html`<div class="notice" style="border-color:var(--${w.level === 'error' ? 'bad' : 'warn'})">${w.text}</div>`)}
  <div class="kpis"><div class="kpi"><span class="eyebrow">En cola</span><b>${counts.queued}</b></div><div class="kpi"><span class="eyebrow">Emitidas</span><b>${counts.issued}</b></div>
    <div class="kpi"><span class="eyebrow">Con error</span><b>${counts.error}</b></div><div class="kpi"><span class="eyebrow">Rechazadas</span><b>${counts.rejected}</b></div></div>
  <form class="panel" data-form="fiscal" novalidate><h3>Datos del emisor</h3>
    <label class="check"><input type="checkbox" name="enabled" ${f.enabled ? 'checked' : ''}> Emitir factura electrónica por cada pedido pagado</label>
    <div class="form-grid">
      <div class="field"><label for="f-provider">Proveedor de emisión</label><select id="f-provider" name="provider">${providers.map(p => html`<option value="${p.name}" ${f.provider === p.name ? 'selected' : ''} ${p.available ? '' : 'disabled'}>${p.label}${p.available ? '' : ' (próximamente)'}</option>`)}</select></div>
      <div class="field"><label for="f-environment">Ambiente</label><select id="f-environment" name="environment"><option value="habilitacion" ${f.environment === 'habilitacion' ? 'selected' : ''}>Habilitación (pruebas ante la DIAN)</option><option value="produccion" ${f.environment === 'produccion' ? 'selected' : ''}>Producción</option></select></div>
      ${inp('nit', 'NIT (sin dígito de verificación)', { mode: 'numeric' })}${inp('dv', 'Dígito de verificación', { mode: 'numeric' })}
      ${inp('legalName', 'Razón social', { full: true })}${inp('tradeName', 'Nombre comercial')}
      <div class="field"><label for="f-regime">Régimen</label><select id="f-regime" name="regime"><option value="responsable_iva" ${f.regime === 'responsable_iva' ? 'selected' : ''}>Responsable de IVA</option><option value="no_responsable" ${f.regime === 'no_responsable' ? 'selected' : ''}>No responsable de IVA</option></select></div>
      ${inp('address', 'Dirección', { full: true })}${inp('cityName', 'Municipio')}${inp('cityCode', 'Código DANE del municipio', { mode: 'numeric', hint: 'Cinco dígitos, por ejemplo 05001 para Medellín.' })}
      ${inp('departmentName', 'Departamento')}${inp('departmentCode', 'Código del departamento', { mode: 'numeric' })}${inp('postalCode', 'Código postal')}${inp('email', 'Correo de facturación')}${inp('phone', 'Teléfono')}
      <div class="field"><label for="f-ship">IVA del envío</label><select id="f-ship" name="shippingTaxRate">${[19, 5, 0].map(r => html`<option value="${r}" ${f.shippingTaxRate === r ? 'selected' : ''}>${r} %</option>`)}</select><span class="hint">Confírmalo con el contador del cliente.</span></div>
      ${inp('softwareId', 'ID del software (DIAN)')}${inp('testSetId', 'ID del set de pruebas (DIAN)')}</div>
    <div><button class="btn btn-primary btn-sm" type="submit">Guardar datos del emisor</button></div></form>
  <section class="card-box"><header><h3>Resoluciones de numeración</h3></header>
    ${resolutions.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Resolución</th><th>Prefijo</th><th>Rango</th><th>Siguiente</th><th>Vigencia</th><th>Activa</th></tr></thead><tbody>
      ${resolutions.map(r => html`<tr><td data-label="Resolución" class="mono">${r.resolutionNumber}</td><td data-label="Prefijo" class="mono">${r.prefix || '—'}</td><td data-label="Rango" class="num">${r.from} – ${r.to}</td>
        <td data-label="Siguiente" class="num">${r.next}${r.remaining ? html` <span class="muted small">(${r.remaining} libres)</span>` : html` <span class="pill bad">Agotada</span>`}</td><td data-label="Vigencia">${r.validFrom} a ${r.validTo}</td>
        <td data-label="Activa"><label class="check"><input type="checkbox" data-change="res-active" data-id="${r.id}" aria-label="Activar resolución ${r.resolutionNumber}" ${r.active ? 'checked' : ''}></label></td></tr>`)}</tbody></table></div>` : html`<p class="pad muted">Aún no hay resoluciones. Agrega la que autorizó la DIAN para facturar.</p>`}
    <form class="pad" data-form="resolution" novalidate style="border-top:1px solid var(--line)"><div class="form-grid">
      <div class="field"><label for="n-num">Número de resolución</label><input id="n-num" name="resolutionNumber"></div><div class="field"><label for="n-pre">Prefijo</label><input id="n-pre" name="prefix" maxlength="6"></div>
      <div class="field"><label for="n-from">Desde</label><input id="n-from" name="from" type="number" min="0"></div><div class="field"><label for="n-to">Hasta</label><input id="n-to" name="to" type="number" min="0"></div>
      <div class="field"><label for="n-vf">Vigente desde</label><input id="n-vf" name="validFrom" type="date"></div><div class="field"><label for="n-vt">Vigente hasta</label><input id="n-vt" name="validTo" type="date"></div>
      <div class="field full"><label for="n-key">Clave técnica (la entrega la DIAN)</label><input id="n-key" name="technicalKey" autocomplete="off"></div></div>
      <div style="margin-top:12px"><button class="btn btn-ghost btn-sm" type="submit">Agregar resolución</button></div></form></section>
  <section class="card-box"><header><h3>Facturas</h3><button class="btn btn-ghost btn-sm" data-act="inv-backfill">Encolar pedidos pagados sin factura</button></header>
    ${invoices.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pedido</th><th>Número</th><th>Estado</th><th>Validez</th><th>Intentos</th><th></th></tr></thead><tbody>
      ${invoices.map(i => html`<tr><td data-label="Pedido"><a class="mono" href="#/admin/pedidos/${i.orderId}">#${i.orderId}</a></td><td data-label="Número" class="mono">${i.fullNumber || '—'}</td>
        <td data-label="Estado">${invPill(i.status)}${i.lastError ? html`<div class="small" style="color:var(--bad)">${i.lastError}</div>` : ''}</td>
        <td data-label="Validez">${i.fiscalValidity ? html`<span class="pill good">Fiscal</span>` : html`<span class="pill">Interna</span>`}</td><td data-label="Intentos" class="num">${i.attempts}</td>
        <td data-label="" class="r"><div class="row" style="justify-content:flex-end">${i.status === 'issued' ? html`<button class="btn btn-ghost btn-sm" data-act="inv-view" data-id="${i.id}">Ver</button>` : ''}${['error', 'rejected'].includes(i.status) ? html`<button class="btn btn-ghost btn-sm" data-act="inv-retry" data-id="${i.id}">Reintentar</button>` : ''}</div></td></tr>`)}</tbody></table></div>` : html`<p class="pad muted">Todavía no hay facturas.</p>`}</section>
  ${doc ? html`<section class="card-box"><header><h3>Documento ${doc.document.fullNumber}</h3><button class="link-btn" data-act="inv-close">Cerrar</button></header><div class="pad stack">
    <dl class="spec"><dt>Cliente</dt><dd>${doc.document.customer.name} · ${doc.document.customer.docType} ${doc.document.customer.docNumber}</dd><dt>Fecha</dt><dd>${doc.document.issueDate} ${doc.document.issueTime}</dd>
      <dt>Base</dt><dd class="num">${money(doc.document.totals.base)}</dd>${doc.document.taxes.map(t => html`<dt>IVA ${t.rate} %</dt><dd class="num">${money(t.amount)} <span class="muted">sobre ${money(t.base)}</span></dd>`)}<dt>Total</dt><dd class="num"><b>${money(doc.document.totals.total)}</b></dd></dl>
    <details><summary class="small">Ver documento completo (JSON)</summary><pre class="code-block">${JSON.stringify(doc.document, null, 2)}</pre></details></div></section>` : ''}`;
}

function adminSettings() {
  const { store: s, wompi, mode } = S.adm.settings;
  const perks = (s.perks || []).map(k => `${k.t} | ${k.d}`).join('\n');
  return html`<div class="adm-h"><div><span class="eyebrow">Configuración</span><h1>Ajustes de la tienda</h1></div></div>
  <form class="stack" style="gap:24px" data-form="settings" novalidate>
  <div class="panel"><h3>Identidad</h3><div class="form-grid">
    <div class="field"><label for="s-name">Nombre de la tienda</label><input id="s-name" name="name" value="${s.name}"></div>
    <div class="field"><label for="s-type">Tipo de negocio</label><select id="s-type" name="type"><option value="physical" ${s.type === 'physical' ? 'selected' : ''}>Productos físicos (con envío)</option><option value="digital" ${s.type === 'digital' ? 'selected' : ''}>Productos digitales o servicios</option></select></div>
    <div class="field"><label for="s-theme">Tema visual de la tienda</label><select id="s-theme" name="theme"><option value="clasico" ${s.theme !== 'fantasia' ? 'selected' : ''}>Clásico (minimalista)</option><option value="fantasia" ${s.theme === 'fantasia' ? 'selected' : ''}>Fantasía (aventura medieval)</option></select><span class="hint">Cambia solo la tienda; este panel siempre es sobrio.</span></div>
    <div class="field full"><label for="s-tagline">Descripción corta</label><input id="s-tagline" name="tagline" value="${s.tagline}"></div>
    <div class="field"><label for="s-h1">Portada: texto pequeño</label><input id="s-h1" name="heroEyebrow" value="${s.hero.eyebrow}"></div>
    <div class="field"><label for="s-h3">Portada: botón</label><input id="s-h3" name="heroCta" value="${s.hero.cta}"></div>
    <div class="field full"><label for="s-h2">Portada: titular</label><input id="s-h2" name="heroTitle" value="${s.hero.title}"></div>
    <div class="field full"><label for="s-fac">Filtros del catálogo</label><input id="s-fac" name="facets" value="${s.facets.join(', ')}"><span class="hint">Hasta 4 atributos separados por coma, por ejemplo Color, Material.</span></div>
    <div class="field full"><label for="s-perks">Ventajas de la portada (una por línea)</label><textarea id="s-perks" name="perks" placeholder="Envío gratis desde $250.000 | Entrega en 2 a 4 días hábiles.">${perks}</textarea></div>
    <div class="field full"><span class="lbl">Color de la tienda (tema clásico)</span><div class="swatches">${[215, 168, 28, 262, 340, 142].map(h => html`<label class="sw" style="--sw:${h}"><input type="radio" name="hue" value="${h}" ${s.hue === h ? 'checked' : ''} aria-label="Color ${h}"><span></span></label>`)}</div></div></div></div>
  <div class="panel"><h3>Envíos</h3>${s.type === 'digital' ? html`<p class="muted">Esta tienda vende productos digitales, por eso no cobra envío.</p>` : html`<div class="form-grid">
    <div class="field"><label for="s-flat">Costo de envío (COP)</label><input id="s-flat" name="flat" type="number" min="0" step="500" value="${s.shipping.flat}"></div>
    <div class="field"><label for="s-free">Envío gratis desde (COP)</label><input id="s-free" name="freeFrom" type="number" min="0" step="1000" value="${s.shipping.freeFrom}"></div></div>`}</div>
  <div class="panel"><h3>Pagos</h3>
    <label class="check"><input type="checkbox" name="payOnline" ${s.pay.online ? 'checked' : ''} ${mode === 'demo' || wompi.enabled ? '' : 'disabled'}> ${mode === 'demo' ? 'Pago en línea simulado (tarjeta, PSE, Nequi)' : 'Pago en línea con Wompi (tarjeta, PSE, Nequi y más)'}</label>
    <label class="check"><input type="checkbox" name="payTransfer" ${s.pay.transfer ? 'checked' : ''}> Transferencia bancaria</label>
    ${s.type === 'digital' ? '' : html`<label class="check"><input type="checkbox" name="payCod" ${s.pay.cod ? 'checked' : ''}> Pago contra entrega</label>`}
    <div class="field"><label for="s-tr">Instrucciones de la transferencia</label><textarea id="s-tr" name="transferInstructions" placeholder="Banco, tipo y número de cuenta, titular">${s.transferInstructions}</textarea></div>
    <div class="notice">${mode === 'demo' ? html`<b>Modo demostración.</b> Los pagos en línea se simulan: el cliente elige si se aprueba o se rechaza y no se cobra nada. Los cobros reales con Wompi se activan con <span class="mono">PAYMENT_MODE=wompi</span> y las llaves del cliente.` : wompi.enabled ? html`<b>Wompi conectado</b> (${wompi.env === 'production' ? 'producción' : 'sandbox'}). En el panel de Wompi, en Desarrolladores, configura esta URL de eventos:<br><span class="mono">${wompi.webhookUrl}</span> <button class="link-btn" type="button" data-act="copy" data-text="${wompi.webhookUrl}">Copiar</button>` : html`<b>Wompi no está configurado.</b> Agrega las llaves en el archivo de configuración del servidor (WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET y WOMPI_EVENTS_SECRET) y reinicia. Mientras tanto la tienda puede usar transferencia o contra entrega.`}</div></div>
  <div class="panel"><h3>Inventario</h3><div class="form-grid"><div class="field"><label for="s-low">Alerta de stock bajo (unidades)</label><input id="s-low" name="lowStock" type="number" min="0" value="${s.lowStock}"><span class="hint">Se marca “Stock bajo” cuando quedan estas unidades o menos.</span></div></div></div>
  <div><button class="btn btn-primary" type="submit">Guardar ajustes</button></div></form>
  <form class="panel" data-form="password" novalidate><h3>Cambiar contraseña</h3><div class="form-grid">
    <div class="field"><label for="pw-cur">Contraseña actual</label><input id="pw-cur" name="current" type="password" autocomplete="current-password"></div>
    <div class="field"><label for="pw-new">Contraseña nueva</label><input id="pw-new" name="next" type="password" autocomplete="new-password"><span class="hint">Mínimo 8 caracteres.</span></div></div>
    <div><button class="btn btn-ghost btn-sm" type="submit">Cambiar contraseña</button></div></form>`;
}

// Los enlaces del correo apuntan a la tienda: en el buzón de salida se abren dentro de la propia aplicación.
function mailText(text) {
  return html`${text.split(/(https?:\/\/[^\s]+#\/[^\s]+)/).map((part, i) => i % 2 ? html`<a href="#/${part.split('#/')[1]}">${part}</a>` : part)}`;
}
const MAIL_KIND = { order_created: 'Pedido recibido', payment_confirmed: 'Pago confirmado', order_shipped: 'Pedido enviado', order_delivered: 'Pedido entregado', order_cancelled: 'Pedido cancelado', welcome: 'Bienvenida', password_reset: 'Recuperar contraseña' };
function adminMail() {
  const list = S.adm.emails, v = S.adm.mailView;
  return html`<div class="adm-h"><div><span class="eyebrow">Comunicación</span><h1>Correos</h1></div></div>
  ${S.adm.mailTransport === 'outbox' ? html`<div class="notice" style="border-color:var(--warn)"><b>Modo demostración.</b> Los correos no se envían: se guardan aquí para que veas lo que recibiría cada cliente. El envío real por SMTP se conecta en producción.</div>` : ''}
  <div class="card-box">${list.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Para</th><th>Asunto</th><th>Tipo</th><th>Estado</th><th></th></tr></thead><tbody>
    ${list.map(e => html`<tr><td data-label="Fecha">${fmtDateTime(e.createdAt)}</td><td data-label="Para">${e.to}</td><td data-label="Asunto">${e.subject}</td><td data-label="Tipo">${MAIL_KIND[e.kind] || e.kind}</td>
      <td data-label="Estado"><span class="pill ${e.status === 'sent' ? 'good' : e.status === 'failed' ? 'bad' : 'warn'}">${e.status === 'sent' ? (e.transport === 'outbox' ? 'Guardado' : 'Enviado') : e.status === 'failed' ? 'Falló' : 'En cola'}</span></td>
      <td data-label="" class="r"><button class="btn btn-ghost btn-sm" data-act="mail-view" data-id="${e.id}">Ver</button></td></tr>`)}</tbody></table></div>` : html`<p class="pad muted">Todavía no se ha generado ningún correo.</p>`}</div>
  ${v ? html`<section class="card-box"><header><h3>${v.subject}</h3><button class="link-btn" data-act="mail-close">Cerrar</button></header><div class="pad stack"><p class="small muted">Para: ${v.to}</p><pre class="code-block" style="white-space:pre-wrap">${mailText(v.text)}</pre></div></section>` : ''}`;
}

const NAV = [['', 'Resumen', 'home'], ['productos', 'Productos', 'box'], ['inventario', 'Inventario', 'stock'], ['pedidos', 'Pedidos', 'orders'], ['clientes', 'Clientes', 'users'], ['promociones', 'Promociones', 'tag'], ['facturacion', 'Facturación', 'invoice'], ['correos', 'Correos', 'mail'], ['ajustes', 'Ajustes', 'gear']];
function adminPage(b, c, q) {
  if (!S.admin) return adminLogin();
  let body;
  if (!b) body = adminDash();
  else if (b === 'productos') body = c ? adminProductEdit(c) : adminProducts(q);
  else if (b === 'inventario') body = adminInventory(q);
  else if (b === 'pedidos') body = c ? adminOrder() : adminOrders(q);
  else if (b === 'clientes') body = adminCustomers();
  else if (b === 'promociones') body = c ? adminPromoEdit(c) : adminPromos();
  else if (b === 'facturacion') body = adminFiscal();
  else if (b === 'correos') body = adminMail();
  else if (b === 'ajustes') body = adminSettings();
  else body = notFound();
  const pending = S.adm.summary ? S.adm.summary.unpaid : 0;
  return html`<div class="adm-top"><div class="wrap"><a class="brand" href="#/admin"><span class="mark">${S.store.name[0]}</span>${S.store.name}</a><span class="pill" style="--c:var(--muted)">Panel</span><span class="grow"></span><a class="btn btn-ghost btn-sm" href="#/">Ver tienda</a><button class="btn btn-ghost btn-sm" data-act="admin-logout">Salir</button></div></div>
  <div class="wrap adm"><nav class="side" aria-label="Panel">${NAV.map(([k, l, i]) => html`<a href="#/admin${k ? '/' + k : ''}" ${(b || '') === k ? raw('aria-current="page"') : ''}>${ic(i)}${l}${k === 'pedidos' && pending ? html`<span class="cnt">${pending}</span>` : ''}</a>`)}</nav>
  <main class="adm-main">${body}</main></div>`;
}

/* ================= estructura general ================= */
function header() {
  const s = ST(), n = cartCount(), cat = S.route.segs[0] === 'catalogo' ? S.route.q.get('cat') : null;
  return html`<header class="hdr ${S.ui.search ? 'search-open' : ''}"><div class="wrap hdr-in">
    <button class="icon-btn menu-btn" data-act="menu-open" aria-label="Abrir menú">${ic('menu')}</button>
    <a class="brand" href="#/"><span class="mark">${s.name[0]}</span>${s.name}</a>
    <nav class="nav" aria-label="Principal">${s.cats.map(c => html`<a href="#/catalogo?cat=${enc(c)}" ${cat === c ? raw('aria-current="page"') : ''}>${c}</a>`)}<a href="#/ofertas" class="offer-link" ${S.route.segs[0] === 'ofertas' ? raw('aria-current="page"') : ''}>Ofertas</a></nav>
    <form class="search" data-form="search" role="search">${ic('search')}<label class="sr" for="q">Buscar productos</label><input id="q" type="search" placeholder="Buscar productos" value="${S.route.segs[0] === 'catalogo' ? S.route.q.get('q') || '' : ''}"></form>
    <button class="icon-btn search-btn" data-act="search-toggle" aria-label="Buscar">${ic('search')}</button>
    <a class="icon-btn" href="#/cuenta" aria-label="Mi cuenta">${ic('user')}${isFiel() ? html`<span class="badge-n">★</span>` : ''}</a>
    <a class="icon-btn" href="#/carrito" data-act="cart-open" aria-label="Carrito, ${n} productos">${ic('cart')}${n ? html`<span class="badge-n">${n}</span>` : ''}</a></div></header>`;
}
function footer() {
  const s = ST();
  return html`<footer class="foot"><div class="wrap foot-in"><div><div class="brand" style="margin-bottom:8px"><span class="mark">${s.name[0]}</span>${s.name}</div><p class="muted" style="max-width:36ch">${s.tagline}</p></div>
    <div><h3 style="margin-bottom:8px">Tienda</h3><a href="#/catalogo">Catálogo</a><a href="#/ofertas">Ofertas</a><a href="#/cuenta">Mi cuenta</a><a href="#/carrito">Carrito</a></div>
    <div><h3 style="margin-bottom:8px">Más</h3><button class="link-btn" data-act="theme" style="display:block;padding:3px 0">Cambiar tema claro u oscuro</button><a href="#/admin">Administración</a></div></div></footer>`;
}
function renderOverlay() {
  const u = S.ui, s = ST(), q = S.route.q;
  let out = '';
  if (u.menu) {
    out = html`<button class="scrim" data-act="close" aria-label="Cerrar menú"></button><aside class="drawer left" role="dialog" aria-label="Menú"><div class="drawer-h"><b>${s.name}</b><button class="icon-btn" data-act="close" aria-label="Cerrar">${ic('close')}</button></div>
      <div class="drawer-b"><form class="search" style="display:flex;width:100%;padding:0" data-form="search">${ic('search')}<label class="sr" for="q2">Buscar</label><input id="q2" type="search" placeholder="Buscar productos"></form>
      <a class="btn btn-ghost" href="#/catalogo">Todo el catálogo</a>${s.cats.map(c => html`<a href="#/catalogo?cat=${enc(c)}" style="font-size:19px;font-weight:650;text-decoration:none;padding:6px 0">${c}</a>`)}<a href="#/ofertas" style="font-size:19px;font-weight:650;text-decoration:none;padding:6px 0;color:var(--accent)">Ofertas</a>
      <hr style="border:0;border-top:1px solid var(--line);width:100%"><a href="#/cuenta" class="muted">Mi cuenta</a><a href="#/admin" class="muted">Administración</a></div></aside>`;
  } else if (u.cart) {
    const ls = lines(), t = calc(ls);
    out = html`<button class="scrim" data-act="close" aria-label="Cerrar carrito"></button><aside class="drawer right" role="dialog" aria-label="Carrito"><div class="drawer-h"><b>Carrito (${cartCount()})</b><button class="icon-btn" data-act="close" aria-label="Cerrar">${ic('close')}</button></div>
      <div class="drawer-b">${ls.length ? ls.map(l => lineHTML(l, true)) : html`<p class="muted">Tu carrito está vacío.</p>`}</div>
      ${ls.length ? html`<div class="drawer-f"><div class="row between"><b>Subtotal</b><b class="num">${money(t.subtotal)}</b></div><p class="muted small">Envío y descuentos se calculan al finalizar.</p><a class="btn btn-primary btn-block" href="#/pago">Finalizar compra</a><a class="btn btn-ghost btn-block" href="#/carrito">Ver carrito</a></div>` : html`<div class="drawer-f"><button class="btn btn-ghost btn-block" data-act="close">Seguir comprando</button></div>`}</aside>`;
  } else if (u.filters && S.route.segs[0] === 'catalogo') {
    out = html`<button class="scrim" data-act="close" aria-label="Cerrar filtros"></button><section class="sheet" role="dialog" aria-label="Filtros"><div class="drawer-h"><b>Filtros</b><button class="icon-btn" data-act="close" aria-label="Cerrar">${ic('close')}</button></div>
      <div class="drawer-b">${filtersHTML(q)}</div><div class="drawer-f"><button class="btn btn-primary btn-block" data-act="close">Ver ${filterProducts(q).length} productos</button></div></section>`;
  }
  $('#overlay').innerHTML = out ? out.s : '';
  document.body.classList.toggle('lock', !!out);
}
function page() {
  const [a, b, c] = S.route.segs, q = S.route.q;
  if (S.loadError) return html`<div class="wrap"><div class="empty page-h"><h1>No pudimos cargar esta pantalla</h1><p class="muted">${S.loadError}</p><button class="btn btn-primary" data-act="reload">Reintentar</button></div></div>`;
  if (a === 'admin') return adminPage(b, c, q);
  switch (a) {
    case undefined: return html`${pendingNotice()}${home()}`;
    case 'catalogo': return catalog(q);
    case 'producto': return pdp(b);
    case 'carrito': return html`${pendingNotice()}${cartPage()}`;
    case 'pago': return checkout();
    case 'pedido': return done();
    case 'pago-demo': return demoGateway();
    case 'ofertas': return ofertas();
    case 'cuenta': return cuenta();
    case 'restablecer': return resetPage();
    default: return notFound();
  }
}
function render(toTop) {
  const y = window.scrollY, fid = document.activeElement && document.activeElement.id;
  document.documentElement.style.setProperty('--hue', S.store.hue);
  document.title = S.store.name;
  const isAdmin = S.route.segs[0] === 'admin';
  // El tema de la tienda (p. ej. Fantasía) nunca se aplica al panel de administración.
  if (!isAdmin && S.store.theme === 'fantasia') document.documentElement.dataset.skin = 'fantasia'; else delete document.documentElement.dataset.skin;
  const body = page();
  $('#root').innerHTML = (isAdmin ? body : html`${header()}<main>${body}</main>${footer()}`).s;
  renderOverlay();
  window.scrollTo(0, toTop ? 0 : y);
  if (fid && !toTop) { const el = document.getElementById(fid); if (el && el.tagName !== 'BUTTON') el.focus(); }
}
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ================= eventos ================= */
const reload = async () => { const [, b, c] = S.route.segs; await loadAdmin(b, c); render(); };
const refreshStore = () => loadStore().catch(() => {});
const ACT = {
  close() { S.ui.menu = S.ui.cart = S.ui.filters = false; render(); },
  reload() { location.reload(); },
  'menu-open'() { S.ui.menu = true; render(); },
  'filters-open'() { S.ui.filters = true; render(); },
  'search-toggle'() { S.ui.search = !S.ui.search; render(); if (S.ui.search) { const i = $('#q'); i && i.focus(); } },
  'cart-open'(el, e) { e.preventDefault(); S.ui.cart = true; render(); },
  theme() {
    const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
  },
  copy(el) { const t = el.dataset.text; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copiado.'), () => toast('No se pudo copiar. Selecciona el texto y cópialo a mano.')); },
  thumb(el) { S.ui.pdp.img = +el.dataset.i; render(); },
  opt(el) { S.ui.pdp.opts[el.dataset.name] = el.dataset.val; render(); },
  'pdp-qty'(el) { const p = prod(S.ui.pdp.pid); S.ui.pdp.qty = Math.min(Math.max(1, S.ui.pdp.qty + +el.dataset.d), Math.max(1, maxQty(p))); render(); },
  add() { const u = S.ui.pdp; addToCart(prod(u.pid), u.qty, { ...u.opts }); render(); },
  'cart-qty'(el) {
    const it = S.cart.items[+el.dataset.i], p = prod(it.pid), n = it.qty + +el.dataset.d;
    const others = S.cart.items.filter(x => x !== it && x.pid === p.id).reduce((a, x) => a + x.qty, 0);
    if (n < 1) return;
    if (n + others > maxQty(p)) return toast(`Solo hay ${maxQty(p)} unidades disponibles.`);
    it.qty = n; persistCart(); render();
  },
  'cart-remove'(el) { S.cart.items.splice(+el.dataset.i, 1); persistCart(); render(); },
  'coupon-remove'() { S.cart.coupon = null; persistCart(); render(); },
  'co-next'() { const co = S.ui.co; if (validate(co.step)) { co.step++; render(true); } else { render(); const bad = $('[aria-invalid="true"]'); bad && bad.focus(); } },
  'co-back'() { S.ui.co.step--; render(true); },
  'co-edit'(el) { S.ui.co.step = +el.dataset.step; render(true); },
  'place-order'() { return placeOrder(); },
  'auth-tab'(el, e) { e.preventDefault(); S.ui.authTab = el.dataset.tab; render(); },
  async logout() { await api('POST', '/api/auth/logout', {}); S.myOrders = []; S.ui.co = null; S.ui.authTab = 'login'; await loadStore(); await go('#/'); },
  'apply-code'(el) { applyCoupon(el.dataset.code); },
  async 'pay-again'() {
    const o = S.order.order, r = await api('POST', `/api/orders/${o.id}/pay?t=${enc(S.order.token)}`, {});
    if (r.checkout.simulated) return go(`#/pago-demo/${o.id}?t=${enc(S.order.token)}`);
    location.assign(r.checkout.url);
  },
  async 'demo-outcome'(el) {
    const { order, token } = S.demo, outcome = el.dataset.outcome;
    await api('POST', `/api/demo/payment/${order.id}?t=${enc(token)}`, { outcome, method: S.ui.demoMethod || 'card' });
    await refreshStore();
    await go(`#/pedido/${order.id}?t=${enc(token)}`);
    toast(outcome === 'approved' ? 'Pago aprobado (simulado).' : outcome === 'declined' ? 'Pago rechazado (simulado). Puedes intentarlo de nuevo.' : 'Pago pendiente (simulado).');
  },
  async 'order-check'() {
    const o = S.order.order;
    const r = await api('POST', `/api/orders/${o.id}/sync?t=${enc(S.order.token)}`, {});
    r.token = S.order.token; S.order = r; render();
    toast(r.order.status === 'pending' ? 'Todavía no hay confirmación del pago. Se actualizará sola.' : 'Pago confirmado.');
  },
  /* administración */
  async 'admin-logout'() { await api('POST', '/api/admin/logout', {}); S.admin = null; S.adm = {}; render(true); },
  async stock(el) { const p = S.adm.products.find(x => x.id === el.dataset.id); await api('PUT', `/api/admin/products/${p.id}`, { stock: Math.max(0, p.stock + +el.dataset.d) }); await reload(); refreshStore(); },
  async 'stock-limit'(el) { await api('PUT', `/api/admin/products/${el.dataset.id}`, { stock: 10 }); await reload(); refreshStore(); toast('Stock definido en 10 unidades.'); },
  'del-ask'(el) { S.ui.confirm = 'del:' + el.dataset.id; render(); },
  'cancel-ask'(el) { S.ui.confirm = 'cancel:' + el.dataset.id; render(); },
  'promo-del-ask'(el) { S.ui.confirm = 'promo:' + el.dataset.id; render(); },
  'confirm-no'() { S.ui.confirm = null; render(); },
  async 'del-yes'(el) { await api('DELETE', `/api/admin/products/${el.dataset.id}`); S.ui.confirm = null; await refreshStore(); await go('#/admin/productos'); toast('Producto eliminado.'); },
  async 'promo-del-yes'(el) { await api('DELETE', `/api/admin/promos/${el.dataset.id}`); S.ui.confirm = null; await refreshStore(); await go('#/admin/promociones'); toast('Promoción eliminada.'); },
  async 'img-remove'(el) { await api('DELETE', `/api/admin/products/${el.dataset.id}/image`); await reload(); refreshStore(); toast('Foto eliminada.'); },
  async 'order-next'(el) { await api('POST', `/api/admin/orders/${el.dataset.id}/action`, { action: 'advance' }); await reload(); refreshStore(); toast('Pedido actualizado.'); },
  async 'order-cancel'(el) { await api('POST', `/api/admin/orders/${el.dataset.id}/action`, { action: 'cancel' }); S.ui.confirm = null; await reload(); refreshStore(); toast(`Pedido #${el.dataset.id} cancelado.`); },
  async 'order-sync'(el) { await api('POST', `/api/admin/orders/${el.dataset.id}/action`, { action: 'sync' }); await reload(); toast('Estado del pago consultado en Wompi.'); },
  async 'cust-set'(el) { await api('PUT', `/api/admin/customers/${el.dataset.id}/type`, { type: el.dataset.type }); await reload(); toast('Perfil del cliente actualizado.'); },
  async 'mail-view'(el) { S.adm.mailView = (await api('GET', `/api/admin/emails/${el.dataset.id}`)).email; render(); },
  'mail-close'() { S.adm.mailView = null; render(); },
  async 'inv-view'(el) { S.adm.invDoc = await api('GET', `/api/admin/invoices/${el.dataset.id}`); render(); },
  'inv-close'() { S.adm.invDoc = null; render(); },
  async 'inv-retry'(el) { await api('POST', `/api/admin/invoices/${el.dataset.id}/retry`, {}); await reload(); toast('Factura reintentada.'); },
  async 'inv-backfill'() { const r = await api('POST', '/api/admin/invoicing/backfill', {}); await reload(); toast(r.queued ? `${r.queued} pedidos en cola de facturación.` : 'No hay pedidos pagados sin factura.'); },
};

const guard = fn => async (...a) => {
  try { await fn(...a); } catch (e) {
    if (e.status === 401 && S.route.segs[0] === 'admin') { S.admin = null; render(); }
    toast(e.message || 'Algo salió mal. Inténtalo de nuevo.');
  }
};

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#/"]');
  if (a && a.dataset.act !== 'cart-open' && a.dataset.act !== 'auth-tab') {
    e.preventDefault();
    S.ui.confirm = null; S.ui.cart = false;
    return guard(() => go(a.getAttribute('href')))();
  }
  const el = e.target.closest('[data-act]');
  if (el && ACT[el.dataset.act]) guard(ACT[el.dataset.act])(el, e);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.field && S.ui.co) S.ui.co.data[t.dataset.field] = t.value;
  if (t.dataset.input === 'filter') {
    const term = t.value.toLowerCase().trim();
    $$('tr[data-search]').forEach(r => { r.hidden = !r.dataset.search.includes(term); });
  }
});

document.addEventListener('change', guard(async e => {
  const t = e.target;
  if (t.dataset.go) return go(t.dataset.go, true);
  if (t.hasAttribute('data-go-select')) return go(t.value, true);
  if (t.hasAttribute('data-demo-method')) { S.ui.demoMethod = t.value; return render(); }
  if (t.dataset.method !== undefined) { S.ui.co.data.method = t.value; S.ui.co.errors = {}; return render(); }
  if (t.dataset.rerender !== undefined && S.ui.co) { S.ui.co.data[t.dataset.field] = t.value; S.ui.co.errors = {}; return render(); }
  const ch = t.dataset.change;
  if (ch === 'price') {
    const p = S.adm.products.find(x => x.id === t.dataset.id), v = Math.round(parseFloat(t.value));
    if (!(v >= 0)) { t.value = p.price; return toast('Escribe un precio válido.'); }
    await api('PUT', `/api/admin/products/${p.id}`, { price: v });
    await reload(); refreshStore(); return toast(`Precio de “${p.name}” actualizado a ${money(v)}.`);
  }
  if (ch === 'stock') {
    const p = S.adm.products.find(x => x.id === t.dataset.id), v = Math.max(0, Math.floor(+t.value || 0));
    await api('PUT', `/api/admin/products/${p.id}`, { stock: v });
    await reload(); refreshStore(); return toast(`Stock de “${p.name}”: ${v} unidades.`);
  }
  if (ch === 'unlimited') { const f = $('#e-stock'); f.disabled = t.checked; if (!t.checked && !f.value) f.value = 10; return; }
  if (ch === 'promo-active') { await api('PUT', `/api/admin/promos/${t.dataset.id}`, { active: t.checked }); await reload(); refreshStore(); return toast(t.checked ? 'Promoción activada.' : 'Promoción pausada.'); }
  if (ch === 'res-active') { await api('PUT', `/api/admin/fiscal/resolutions/${t.dataset.id}`, { active: t.checked }); await reload(); return toast('Resolución actualizada.'); }
  if (ch === 'upload') {
    const f = t.files && t.files[0];
    if (!f) return;
    if (f.size > 3_000_000) return toast('La foto pesa más de 3 MB. Reduce su tamaño e inténtalo de nuevo.');
    await api('POST', `/api/admin/products/${t.dataset.id}/image`, undefined, { type: f.type, data: f });
    await reload(); refreshStore(); return toast('Foto actualizada.');
  }
}));

const fdNum = (fd, k, d = 0) => { const v = fd.get(k); return v === null || v === '' ? d : Number(v); };
const SUBMIT = {
  search(f) { const v = $('input', f).value.trim(); return go('#/catalogo' + (v ? '?q=' + enc(v) : '')); },
  coupon() { applyCoupon($('#coupon').value); },
  async forgot(f) {
    const fd = new FormData(f);
    S.ui.busy = true;
    let r;
    try { r = await api('POST', '/api/auth/forgot', { email: fd.get('email') }); } finally { S.ui.busy = false; }
    S.ui.authTab = 'login'; render(); toast(r.message);
  },
  async reset(f) {
    const fd = new FormData(f);
    if (fd.get('password') !== fd.get('password2')) return toast('Las contraseñas no coinciden.');
    S.ui.busy = true;
    try { await api('POST', '/api/auth/reset', { token: f.dataset.token, password: fd.get('password') }); } finally { S.ui.busy = false; }
    S.ui.authTab = 'login'; await go('#/cuenta'); toast('Contraseña actualizada. Ya puedes iniciar sesión.');
  },
  async login(f) {
    const fd = new FormData(f);
    S.ui.busy = true;
    try { await api('POST', '/api/auth/login', { email: fd.get('email'), password: fd.get('password') }); } finally { S.ui.busy = false; }
    S.ui.co = null; await loadStore(); await go('#/cuenta'); toast('Sesión iniciada.');
  },
  async register(f) {
    const fd = new FormData(f);
    S.ui.busy = true;
    try { await api('POST', '/api/auth/register', { email: fd.get('email'), name: fd.get('name'), phone: fd.get('phone'), password: fd.get('password') }); } finally { S.ui.busy = false; }
    S.ui.co = null; S.ui.authTab = 'login'; await loadStore(); await go('#/cuenta'); toast('Cuenta creada.');
  },
  async 'admin-login'(f) {
    const fd = new FormData(f);
    S.ui.busy = true;
    try { S.admin = (await api('POST', '/api/admin/login', { email: fd.get('email'), password: fd.get('password') })).admin; } finally { S.ui.busy = false; }
    await show(true);
  },
  async product(f) {
    const fd = new FormData(f), isNew = f.dataset.id === 'nuevo';
    const s = S.store, attrs = {};
    s.facets.forEach(k => { const v = (fd.get('attr:' + k) || '').trim(); if (v) attrs[k] = v; });
    const options = (fd.get('options') || '').split('\n').map(l => {
      const [n, ...rest] = l.split(':');
      const values = rest.join(':').split(',').map(x => x.trim()).filter(Boolean);
      return n.trim() && values.length ? { name: n.trim(), values } : null;
    }).filter(Boolean);
    const body = {
      name: fd.get('name'), desc: fd.get('desc'), cat: fd.get('cat'), sku: fd.get('sku'), price: fdNum(fd, 'price'), compare: fd.get('compare') ? fdNum(fd, 'compare') : null,
      stock: fd.get('unlimited') ? null : fdNum(fd, 'stock'), status: fd.get('status'), digital: !!fd.get('digital'), taxRate: fdNum(fd, 'taxRate', 19), attrs, options,
    };
    if (fd.get('kind')) body.kind = fd.get('kind');
    if (isNew) {
      const r = await api('POST', '/api/admin/products', body);
      await refreshStore(); await go(`#/admin/productos/${r.product.id}`); toast('Producto creado. Ya puedes subir su foto.');
    } else {
      await api('PUT', `/api/admin/products/${f.dataset.id}`, body);
      await refreshStore(); await go('#/admin/productos'); toast('Cambios guardados.');
    }
  },
  async promo(f) {
    const fd = new FormData(f), isNew = f.dataset.id === 'nueva';
    const body = { name: fd.get('name'), desc: fd.get('desc'), kind: fd.get('kind'), value: fdNum(fd, 'value'), scope: fd.get('scope'), code: fd.get('code'), audience: fd.get('audience'), min: fdNum(fd, 'min'), ends: fd.get('ends') || null, active: !!fd.get('active') };
    if (isNew) await api('POST', '/api/admin/promos', body); else await api('PUT', `/api/admin/promos/${f.dataset.id}`, body);
    await refreshStore(); await go('#/admin/promociones'); toast(isNew ? 'Promoción creada.' : 'Cambios guardados.');
  },
  async settings(f) {
    const fd = new FormData(f), s = S.adm.settings.store;
    const body = {
      name: fd.get('name'), tagline: fd.get('tagline'), type: fd.get('type'), theme: fd.get('theme'), hue: fdNum(fd, 'hue', s.hue),
      hero: { eyebrow: fd.get('heroEyebrow'), title: fd.get('heroTitle'), cta: fd.get('heroCta') },
      facets: String(fd.get('facets') || '').split(',').map(x => x.trim()).filter(Boolean),
      perks: String(fd.get('perks') || '').split('\n').map(l => { const [t, ...d] = l.split('|'); return { t: t.trim(), d: d.join('|').trim() }; }).filter(p => p.t),
      pay: { online: fd.has('payOnline') ? true : (f.elements.payOnline && f.elements.payOnline.disabled ? s.pay.online : false), transfer: !!fd.get('payTransfer'), cod: !!fd.get('payCod') },
      transferInstructions: fd.get('transferInstructions'), lowStock: fdNum(fd, 'lowStock', s.lowStock),
    };
    if (fd.has('flat')) body.shipping = { flat: fdNum(fd, 'flat'), freeFrom: fdNum(fd, 'freeFrom') };
    await api('PUT', '/api/admin/settings', body);
    await refreshStore(); await reload(); toast('Ajustes guardados.');
  },
  async loyalty(f) {
    const fd = new FormData(f);
    await api('PUT', '/api/admin/settings', { loyalty: { discount: fdNum(fd, 'discount'), threshold: fdNum(fd, 'threshold'), freeShipping: !!fd.get('freeShipping') } });
    await refreshStore(); await reload(); toast('Reglas guardadas.');
  },
  async fiscal(f) {
    const fd = new FormData(f), body = {};
    for (const [k, v] of fd.entries()) body[k] = v;
    body.enabled = !!fd.get('enabled'); body.shippingTaxRate = fdNum(fd, 'shippingTaxRate', 19);
    await api('PUT', '/api/admin/fiscal', body); await reload(); toast('Datos del emisor guardados.');
  },
  async resolution(f) {
    const fd = new FormData(f), body = {};
    for (const [k, v] of fd.entries()) body[k] = v;
    await api('POST', '/api/admin/fiscal/resolutions', body); await reload(); toast('Resolución agregada.');
  },
  async password(f) {
    const fd = new FormData(f);
    await api('POST', '/api/admin/password', { current: fd.get('current'), next: fd.get('next') }); f.reset(); toast('Contraseña actualizada.');
  },
};
document.addEventListener('submit', e => {
  const f = e.target, kind = f.dataset.form;
  if (!kind || !SUBMIT[kind]) return;
  e.preventDefault();
  guard(() => SUBMIT[kind](f))();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && (S.ui.menu || S.ui.cart || S.ui.filters)) ACT.close(); });

/* ================= arranque ================= */
S.route = parse(location.hash);
try { await loadStore(); } catch (e) {
  $('#root').innerHTML = html`<div class="wrap" style="padding-block:64px"><h1>No pudimos cargar la tienda</h1><p class="muted">${e.message}</p><button class="btn btn-primary" data-act="reload">Reintentar</button></div>`.s;
  return;
}
await show(true);
})();
