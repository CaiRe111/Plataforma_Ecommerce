/* Prototipo navegable. Sin servidor: todo el estado vive en memoria y, si el navegador lo permite, en localStorage.
   No se procesa ningún pago ni se envía ningún dato fuera del navegador. */
(() => {
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
};
const art = (p, cls = '') => html`<div class="art ${cls}" style="--h:${p.hue}"><svg viewBox="0 0 100 100" aria-hidden="true">${raw(SHAPES[p.kind] || SHAPES.box)}</svg></div>`;

/* ================= estado ================= */
const KEY = 'pe-prototipo-v1';
const S = { cur: 'moda', stores: null, route: null, ui: { menu: false, cart: false, filters: false, search: false, pdp: null, co: null, confirm: null } };

function loadState() {
  const saved = store_.get(KEY);
  if (saved) {
    try {
      const d = JSON.parse(saved);
      if (d && d.stores && d.stores[d.cur]) { S.stores = d.stores; S.cur = d.cur; return; }
    } catch (e) { /* datos dañados: se vuelve a sembrar */ }
  }
  S.stores = buildDemo();
}
const persist = () => store_.set(KEY, JSON.stringify({ cur: S.cur, stores: S.stores }));
const ST = () => S.stores[S.cur];
const prod = id => ST().products.find(p => p.id === id);
const activeProducts = () => ST().products.filter(p => p.status === 'active');
const money = n => ST().symbol + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = iso => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
const fmtDateTime = iso => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const optsText = o => Object.entries(o || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
const flow = () => FLOWS[ST().type];

const STATUS = {
  pending: { l: 'Pendiente de pago', c: 'warn' }, paid: { l: 'Pagado', c: 'info' }, preparing: { l: 'Preparando', c: 'info' },
  shipped: { l: 'Enviado', c: 'info' }, delivered: { l: 'Entregado', c: 'good' }, cancelled: { l: 'Cancelado', c: 'bad' },
};
const NEXT_LABEL = { paid: 'Marcar como pagado', preparing: 'Empezar a preparar', shipped: 'Marcar como enviado', delivered: 'Marcar como entregado' };
const METHODS = { card: 'Tarjeta', transfer: 'Transferencia', cod: 'Contra entrega' };
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

/* ================= carrito ================= */
function lines() {
  return ST().cart.items.map((it, i) => {
    const p = prod(it.pid);
    return p && p.status === 'active' ? { it, i, p, total: p.price * it.qty } : null;
  }).filter(Boolean);
}
function calc(ls) {
  const s = ST();
  const subtotal = ls.reduce((a, l) => a + l.total, 0);
  const disc = s.cart.coupon ? subtotal * 0.1 : 0;
  const physical = ls.some(l => !l.p.digital);
  const ship = ls.length ? calcShipping(s, subtotal - disc, physical) : 0;
  return { subtotal, disc, ship, physical, total: subtotal - disc + ship };
}
const cartCount = () => lines().reduce((a, l) => a + l.it.qty, 0);
const maxQty = p => p.stock === null ? 99 : p.stock;

function addToCart(p, qty, opts) {
  const items = ST().cart.items;
  const key = JSON.stringify(opts);
  const ex = items.find(i => i.pid === p.id && JSON.stringify(i.opts) === key);
  const inCart = items.filter(i => i.pid === p.id).reduce((a, i) => a + i.qty, 0);
  const room = maxQty(p) - inCart;
  if (room <= 0) return toast(`Ya tienes todas las unidades disponibles (${maxQty(p)}).`);
  const n = Math.min(qty, room);
  if (ex) ex.qty += n; else items.push({ pid: p.id, qty: n, opts });
  if (n < qty) toast(`Solo quedan ${maxQty(p)} unidades; agregamos ${n}.`);
  persist();
  S.ui.cart = true;
}

/* ================= router ================= */
function parse(h) {
  const [path, query = ''] = h.replace(/^#\/?/, '').split('?');
  return { segs: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(query) };
}
function go(href, replace) {
  const h = href.replace(/^#\/?/, '');
  const prev = S.route && S.route.segs.join('/');
  try { history[replace ? 'replaceState' : 'pushState'](null, '', '#/' + h); } catch (e) { /* entorno sin historial */ }
  S.route = parse(h);
  S.ui.menu = S.ui.filters = S.ui.search = false;
  render(!(replace && prev === S.route.segs.join('/')));
}
window.addEventListener('popstate', () => { S.route = parse(location.hash); S.ui.menu = S.ui.cart = S.ui.filters = false; render(true); });

/* ================= páginas de la tienda ================= */
function productCard(p) {
  const s = stockState(p);
  const off = p.compare ? Math.round((1 - p.price / p.compare) * 100) : 0;
  return html`<a class="card" href="#/producto/${p.id}">
    <div class="card-img">${art(p)}<div class="card-tag">
      ${off ? html`<span class="tag">-${off}%</span>` : ''}
      ${s === 'out' ? html`<span class="tag soft">Agotado</span>` : s === 'low' ? html`<span class="tag soft">Últimas unidades</span>` : ''}
    </div></div>
    <div class="card-body"><span class="eyebrow">${p.cat}</span><h3>${p.name}</h3>
      <div class="price">${money(p.price)}${p.compare ? html`<s>${money(p.compare)}</s>` : ''}</div></div>
  </a>`;
}

function home() {
  const s = ST(), act = activeProducts();
  return html`
  <section class="hero"><div class="wrap hero-in">
    <div class="hero-copy"><p class="eyebrow">${s.hero.eyebrow}</p><h1>${s.hero.title}</h1><p class="lead">${s.tagline}</p>
      <div class="row"><a class="btn btn-primary" href="#/catalogo">${s.hero.cta}</a><a class="btn btn-ghost" href="#/catalogo?cat=${enc(s.cats[0])}">${s.cats[0]}</a></div></div>
    <div class="hero-art">${act.slice(0, 3).map(p => html`<a href="#/producto/${p.id}" aria-label="${p.name}">${art(p)}</a>`)}</div>
  </div></section>
  <section class="wrap sec"><div class="sec-head"><h2>Categorías</h2></div>
    <div class="cat-grid">${s.cats.map(c => html`<a href="#/catalogo?cat=${enc(c)}"><h3>${c}</h3><span class="muted small">${act.filter(p => p.cat === c).length} productos</span></a>`)}</div></section>
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
  if (skip !== 'p' && q.get('p')) { const [a, b] = q.get('p').split('-'); list = list.filter(p => p.price >= +a && (b === '' || p.price < +b)); }
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
  const max = Math.max(...activeProducts().map(p => p.price), 10);
  const step = max > 60 ? 10 : 5;
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
  if (sort === 'asc') list.sort((a, b) => a.price - b.price);
  else if (sort === 'desc') list.sort((a, b) => b.price - a.price);
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
  const u = S.ui.pdp, st = stockState(p), s = ST();
  const off = p.compare ? Math.round((1 - p.price / p.compare) * 100) : 0;
  const rel = activeProducts().filter(x => x.cat === p.cat && x.id !== p.id).concat(activeProducts().filter(x => x.cat !== p.cat && x.id !== p.id)).slice(0, 4);
  return html`<div class="wrap">
    <div class="crumbs"><a href="#/">Inicio</a><span>/</span><a href="#/catalogo?cat=${enc(p.cat)}">${p.cat}</a><span>/</span><span>${p.name}</span></div>
    <div class="pdp">
      <div class="gallery">${art(p, ['', 'alt1', 'alt2'][u.img])}
        <div class="thumbs">${['', 'alt1', 'alt2'].map((c, i) => html`<button data-act="thumb" data-i="${i}" aria-pressed="${u.img === i}" aria-label="Vista ${i + 1}">${art(p, c)}</button>`)}</div>
        <p class="muted small">Imagen ilustrativa. En la versión final, cada producto sube sus propias fotos.</p></div>
      <div class="pinfo">
        <div class="stack" style="gap:10px"><span class="eyebrow">${p.cat}</span><h1 style="font-size:clamp(28px,3.4vw,40px)">${p.name}</h1>
          <div class="price">${money(p.price)}${p.compare ? html`<s style="font-size:16px">${money(p.compare)}</s><span class="off">Ahorras ${off}%</span>` : ''}</div></div>
        <p>${p.desc}</p>
        ${p.options.map(o => html`<div class="ogroup" role="group" aria-label="${o.name}"><span class="lbl">${o.name}: <span class="muted">${u.opts[o.name]}</span></span>
          <div class="opts">${o.values.map(v => html`<button class="opt" data-act="opt" data-name="${o.name}" data-val="${v}" aria-pressed="${u.opts[o.name] === v}">${v}</button>`)}</div></div>`)}
        <div class="stock-note ${st}">${st === 'out' ? 'Agotado por ahora' : st === 'low' ? `Quedan solo ${p.stock} ${p.digital ? 'cupos' : 'unidades'}` : p.stock === null ? 'Disponible' : 'En stock'}</div>
        <div class="buy">
          <div class="stepper" role="group" aria-label="Cantidad"><button data-act="pdp-qty" data-d="-1" aria-label="Menos">−</button><span aria-live="polite">${u.qty}</span><button data-act="pdp-qty" data-d="1" aria-label="Más">+</button></div>
          <button class="btn btn-primary" data-act="add" ${st === 'out' ? 'disabled' : ''}>${st === 'out' ? 'Agotado' : 'Agregar al carrito'}</button></div>
        <div>
          <details class="acc" open><summary>Especificaciones</summary><div><dl class="spec">${Object.entries(p.attrs).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}<dt>Referencia</dt><dd class="mono">${p.sku}</dd></dl></div></details>
          <details class="acc"><summary>${p.digital ? 'Entrega' : 'Envíos y devoluciones'}</summary><div>${p.digital ? 'Acceso inmediato por correo electrónico. Garantía de devolución según las condiciones de la tienda.' : `Envío de ${money(s.shipping.flat)}; gratis en compras desde ${money(s.shipping.freeFrom)}. Aceptamos cambios dentro de los primeros 30 días.`}</div></details></div>
      </div></div>
    ${rel.length ? html`<section class="sec" style="padding-top:0"><div class="sec-head"><h2>También te puede gustar</h2></div><div class="grid">${rel.map(productCard)}</div></section>` : ''}
  </div>`;
}

/* ---- carrito ---- */
function totalsHTML(t, withCoupon) {
  const s = ST();
  const missing = t.physical && t.ship > 0 ? s.shipping.freeFrom - (t.subtotal - t.disc) : 0;
  return html`
    <div class="tr"><span>Subtotal</span><span class="num">${money(t.subtotal)}</span></div>
    ${t.disc ? html`<div class="tr"><span>Cupón ${s.cart.coupon}</span><span class="num">−${money(t.disc)}</span></div>` : ''}
    <div class="tr"><span>${t.physical ? 'Envío' : 'Entrega'}</span><span class="num">${!t.physical ? 'Digital, sin costo' : t.ship ? money(t.ship) : 'Gratis'}</span></div>
    ${missing > 0 ? html`<p class="muted small">Agrega ${money(missing)} más para tener envío gratis.</p>` : ''}
    <div class="tr total"><span>Total</span><span class="num">${money(t.total)}</span></div>`;
}
function lineHTML(l, editable) {
  return html`<div class="line">
    <a href="#/producto/${l.p.id}">${art(l.p)}</a>
    <div class="meta"><a href="#/producto/${l.p.id}"><b>${l.p.name}</b></a>${Object.keys(l.it.opts).length ? html`<span class="muted small">${optsText(l.it.opts)}</span>` : ''}
      <span class="num muted small">${money(l.p.price)} c/u</span>
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
          : html`<form class="coupon" data-form="coupon"><label class="sr" for="coupon">Código de cupón</label><input id="coupon" placeholder="Código de cupón"><button class="btn btn-ghost btn-sm" style="min-height:40px">Aplicar</button></form><span class="muted small">Prueba con PRIMERA10 (10 % de descuento).</span>`}
        ${totalsHTML(t)}
        <a class="btn btn-primary btn-block" href="#/pago">Finalizar compra</a>
        <a class="btn btn-ghost btn-block" href="#/catalogo">Seguir comprando</a></aside></div></div>`;
}

/* ---- pago ---- */
function initCheckout() {
  const methods = Object.keys(ST().pay).filter(m => ST().pay[m]);
  S.ui.co = { step: 1, data: { method: methods[0], country: '' }, errors: {} };
}
function fld(id, label, o = {}) {
  const co = S.ui.co, v = co.data[id] || '', e = co.errors[id];
  return html`<div class="field ${o.full ? 'full' : ''}"><label for="f-${id}">${label}</label>
    <input id="f-${id}" type="${o.type || 'text'}" value="${v}" placeholder="${o.ph || ''}" autocomplete="${o.auto || 'off'}" ${o.mode ? raw(`inputmode="${o.mode}"`) : ''} data-field="${id}" ${e ? raw('aria-invalid="true"') : ''}>
    ${e ? html`<span class="err">${e}</span>` : o.hint ? html`<span class="hint">${o.hint}</span>` : ''}</div>`;
}
function validate(step) {
  const co = S.ui.co, d = co.data, er = {}, phys = calc(lines()).physical;
  if (step === 1) {
    if (!/^\S+@\S+\.\S+$/.test(d.email || '')) er.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    if (!(d.name || '').trim()) er.name = 'Escribe tu nombre completo.';
    if ((d.phone || '').replace(/\D/g, '').length < 7) er.phone = 'Escribe un teléfono de al menos 7 dígitos.';
    if (phys && !(d.address || '').trim()) er.address = 'Escribe la dirección de entrega.';
    if (phys && !(d.city || '').trim()) er.city = 'Escribe la ciudad.';
  }
  if (step === 2 && d.method === 'card') {
    const n = (d.cardNumber || '').replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(n)) er.cardNumber = 'El número debe tener entre 13 y 19 dígitos.';
    if (!(d.cardName || '').trim()) er.cardName = 'Escribe el nombre que aparece en la tarjeta.';
    if (!/^(0[1-9]|1[0-2])\s*\/\s*\d{2}$/.test(d.cardExp || '')) er.cardExp = 'Usa el formato MM/AA.';
    if (!/^\d{3,4}$/.test(d.cardCvc || '')) er.cardCvc = 'Son 3 o 4 dígitos.';
  }
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
  const co = S.ui.co, d = co.data, t = calc(ls), s = ST();
  const names = t.physical ? ['Datos y entrega', 'Pago', 'Revisión'] : ['Tus datos', 'Pago', 'Revisión'];
  const summary = html`<h3>Tu pedido</h3><div class="stack">${sumList(ls)}</div>${totalsHTML(t)}`;
  let body;
  if (co.step === 1) {
    body = html`<div class="panel"><div class="row between"><h3>Contacto</h3><button class="link-btn" data-act="co-fill" type="button">Rellenar con datos de ejemplo</button></div>
      <div class="form-grid">${fld('email', 'Correo electrónico', { type: 'email', auto: 'email', full: true, hint: t.physical ? 'Te enviaremos la confirmación y el seguimiento.' : 'Aquí recibirás el acceso a tu compra.' })}
        ${fld('name', 'Nombre completo', { auto: 'name' })}${fld('phone', 'Teléfono', { type: 'tel', auto: 'tel', mode: 'tel' })}</div></div>
      ${t.physical ? html`<div class="panel"><h3>Entrega</h3><div class="form-grid">${fld('address', 'Dirección', { auto: 'street-address', full: true })}${fld('city', 'Ciudad', { auto: 'address-level2' })}${fld('notes', 'Indicaciones (opcional)', { ph: 'Torre, apartamento, portería…' })}</div>
        <div class="paycard" style="cursor:default;border-color:var(--accent)"><span></span><b>Envío estándar</b><small>2 a 4 días hábiles · ${t.ship ? money(t.ship) : 'Gratis'}</small></div></div>` : html`<div class="notice">Es un pedido digital: no necesitas dirección. Recibirás el acceso por correo.</div>`}`;
  } else if (co.step === 2) {
    const avail = Object.keys(s.pay).filter(m => s.pay[m] && (m !== 'cod' || t.physical));
    const sub = { card: 'Pago con tarjeta de crédito o débito.', transfer: 'Te mostramos los datos bancarios al confirmar. El pedido se prepara al recibir el pago.', cod: 'Pagas en efectivo al recibir el pedido.' };
    body = html`<div class="panel"><h3>Método de pago</h3>
      <div class="notice"><b>Pagos de demostración.</b> No se procesa ningún cobro real. Con tarjeta puedes usar el número 4242 4242 4242 4242.</div>
      ${avail.map(m => html`<label class="paycard"><input type="radio" name="method" value="${m}" data-method ${d.method === m ? 'checked' : ''}><b>${METHODS[m]}</b><small>${sub[m]}</small></label>`)}
      ${d.method === 'card' ? html`<div class="form-grid" style="margin-top:4px">${fld('cardNumber', 'Número de tarjeta', { full: true, ph: '4242 4242 4242 4242', mode: 'numeric', auto: 'cc-number' })}${fld('cardName', 'Nombre en la tarjeta', { full: true, auto: 'cc-name' })}${fld('cardExp', 'Vencimiento', { ph: 'MM/AA', auto: 'cc-exp' })}${fld('cardCvc', 'CVC', { ph: '123', mode: 'numeric', auto: 'cc-csc' })}</div>` : ''}</div>`;
  } else {
    body = html`<div class="panel"><h3>Revisa tu pedido</h3>
      <dl class="spec"><dt>Contacto</dt><dd>${d.name}<br><span class="muted">${d.email} · ${d.phone}</span></dd>
        ${t.physical ? html`<dt>Entrega</dt><dd>${d.address}, ${d.city}${d.notes ? html`<br><span class="muted">${d.notes}</span>` : ''}</dd>` : html`<dt>Entrega</dt><dd>Digital, por correo</dd>`}
        <dt>Pago</dt><dd>${METHODS[d.method]}${d.method === 'card' ? html` <span class="muted mono">•••• ${(d.cardNumber || '').replace(/\s/g, '').slice(-4)}</span>` : ''}</dd></dl>
      <div class="row"><button class="link-btn" data-act="co-edit" data-step="1">Editar datos</button><button class="link-btn" data-act="co-edit" data-step="2">Cambiar pago</button></div></div>
      <div class="notice">Al confirmar se crea un pedido de demostración. No se cobra nada.</div>`;
  }
  return html`<div class="wrap"><div class="page-h"><h1 style="font-size:clamp(28px,4vw,40px)">Finalizar compra</h1></div>
    <ol class="steps" style="padding:0;margin:0 0 28px">${names.map((n, i) => html`<li ${co.step === i + 1 ? raw('aria-current="step"') : ''} class="${co.step > i + 1 ? 'done' : ''}"><span class="n">${co.step > i + 1 ? '✓' : i + 1}</span>${n}</li>`)}</ol>
    <div class="two"><div class="stack" style="gap:20px">
      <details class="panel m-only" style="padding:14px 16px"><summary style="cursor:pointer;font-weight:650">Resumen del pedido · ${money(t.total)}</summary><div class="stack mt">${summary}</div></details>
      ${body}
      <div class="row between">${co.step > 1 ? html`<button class="btn btn-ghost" data-act="co-back">Volver</button>` : html`<a class="btn btn-ghost" href="#/carrito">Volver al carrito</a>`}
        ${co.step < 3 ? html`<button class="btn btn-primary" data-act="co-next">Continuar</button>` : html`<button class="btn btn-primary" data-act="place-order">Confirmar pedido · ${money(t.total)}</button>`}</div></div>
      <aside class="summary d-only">${summary}</aside></div></div>`;
}
function placeOrder() {
  const s = ST(), ls = lines(), t = calc(ls), d = S.ui.co.data;
  const id = String(Math.max(1040, ...s.orders.map(o => +o.id)) + 1);
  const now = new Date().toISOString();
  const status = d.method === 'card' ? 'paid' : 'pending';
  const order = {
    id, date: now, customer: { name: d.name, email: d.email, phone: d.phone },
    address: t.physical ? { line: d.address, city: d.city } : null,
    items: ls.map(l => ({ pid: l.p.id, name: l.p.name, qty: l.it.qty, price: l.p.price, opts: l.it.opts, digital: l.p.digital })),
    subtotal: t.subtotal, discount: t.disc, shipping: t.ship, total: t.total, method: d.method, status,
    history: status === 'paid' ? [{ s: 'pending', at: now }, { s: 'paid', at: now }] : [{ s: 'pending', at: now }],
  };
  s.orders.push(order);
  ls.forEach(l => { if (l.p.stock !== null) l.p.stock = Math.max(0, l.p.stock - l.it.qty); });
  s.cart = { items: [], coupon: null };
  S.ui.co = null;
  persist();
  go('#/pedido/' + id);
}

function done(id) {
  const o = ST().orders.find(x => x.id === id);
  if (!o) return notFound();
  const s = ST();
  return html`<div class="wrap"><div class="page-h stack" style="justify-items:start;gap:16px"><div class="done-mark">${ic('check')}</div>
    <h1 style="font-size:clamp(28px,4vw,40px)">Gracias, ${o.customer.name.split(' ')[0]}. Recibimos tu pedido.</h1>
    <p class="lead">Pedido <b class="mono">#${o.id}</b>. Enviamos la confirmación a ${o.customer.email}.</p></div>
    <div class="two"><div class="stack" style="gap:20px">
      <div class="panel"><h3>Estado</h3>${timeline(o)}</div>
      ${o.method === 'transfer' ? html`<div class="notice"><b>Datos para la transferencia (demostración):</b> Banco Ejemplo · Cuenta de ahorros 000-111222-33 · A nombre de ${s.name}. Usa el pedido #${o.id} como referencia.</div>` : ''}
      <div class="row"><a class="btn btn-primary" href="#/catalogo">Seguir comprando</a><a class="btn btn-ghost" href="#/admin/pedidos/${o.id}">Ver este pedido en el panel admin</a></div></div>
      <aside class="summary"><h3>Resumen</h3>${o.items.map(i => html`<div class="tr"><span>${i.name} <span class="muted">×${i.qty}</span></span><span class="num">${money(i.price * i.qty)}</span></div>`)}
        <div class="tr"><span>Envío</span><span class="num">${o.address ? (o.shipping ? money(o.shipping) : 'Gratis') : 'Digital'}</span></div>
        ${o.discount ? html`<div class="tr"><span>Descuento</span><span class="num">−${money(o.discount)}</span></div>` : ''}
        <div class="tr total"><span>Total</span><span class="num">${money(o.total)}</span></div>
        <p class="muted small">Pago: ${METHODS[o.method]}</p></aside></div></div>`;
}
function timeline(o) {
  const f = flow();
  if (o.status === 'cancelled') {
    return html`<ol class="timeline">${o.history.map(h => html`<li class="${h.s === 'cancelled' ? 'bad now' : 'done'}"><span class="dot"></span><div><b>${STATUS[h.s].l}</b><span class="small">${fmtDateTime(h.at)}</span></div></li>`)}</ol>`;
  }
  const idx = f.indexOf(o.status);
  return html`<ol class="timeline">${f.map((st, i) => {
    const h = o.history.find(x => x.s === st);
    return html`<li class="${i <= idx ? 'done' : ''} ${i === idx ? 'now' : ''}"><span class="dot"></span><div><b>${STATUS[st].l}</b><span class="small">${h ? fmtDateTime(h.at) : 'Pendiente'}</span></div></li>`;
  })}</ol>`;
}

function guide() {
  return html`<div class="wrap" style="max-width:820px"><div class="page-h stack" style="gap:14px"><span class="eyebrow">Guía de revisión</span><h1 style="font-size:clamp(28px,4vw,42px)">Qué revisar en este prototipo</h1>
    <p class="lead">Es una maqueta navegable con datos ficticios. Nada se guarda fuera de tu navegador y no existe ningún cobro real.</p></div>
    <div class="stack" style="gap:32px;padding-bottom:72px">
    <section class="stack"><h2>Recorrido sugerido</h2><ol class="guide-list">
      <li>Cambia de tienda en la barra superior: son cuatro rubros sobre la misma estructura (moda, alimentos, electrónica y productos digitales).</li>
      <li><a href="#/catalogo">Catálogo</a>: filtra por categoría, precio y atributos. Los filtros cambian según el rubro.</li>
      <li>Abre una ficha, elige opciones y <a href="#/carrito">agrega al carrito</a>. Prueba el cupón PRIMERA10.</li>
      <li><a href="#/pago">Finaliza la compra</a> con el botón “Rellenar con datos de ejemplo”. En la tienda digital no pide dirección.</li>
      <li>En el <a href="#/admin">panel</a>: edita un precio en <a href="#/admin/productos">Productos</a>, ajusta stock en <a href="#/admin/inventario">Inventario</a> y avanza el estado de un pedido en <a href="#/admin/pedidos">Pedidos</a>. Los cambios se reflejan en la tienda.</li>
      <li>En <a href="#/admin/ajustes">Ajustes</a> cambia el nombre, el color y las reglas de envío de la tienda.</li>
      <li>Prueba el tamaño de teléfono y el tema oscuro (botón “Tema”).</li></ol></section>
    <section class="stack"><h2>Fuera del prototipo (fase 2)</h2><ul class="guide-list">
      <li>Servidor, base de datos y cuentas reales de administrador.</li><li>Pasarela de pagos real y conciliación de pedidos.</li>
      <li>Carga de fotos de producto, correos de confirmación y facturación.</li><li>Cálculo de envíos por transportadora, impuestos y varios idiomas o monedas.</li></ul></section>
    <section class="stack"><h2>Decisiones que necesito de ti</h2><ul class="guide-list">
      <li>País y moneda de la primera venta, para elegir pasarela de pagos e impuestos.</li>
      <li>Modelo comercial: una instalación por cliente o una plataforma única con varias tiendas.</li>
      <li>Si el diseño, el flujo de compra y el panel están aprobados o qué ajustar antes de construir.</li></ul></section></div></div>`;
}
function notFound() {
  return html`<div class="wrap"><div class="empty page-h"><h1>No encontramos esa página</h1><p class="muted">El enlace no existe o el producto ya no está disponible.</p><a class="btn btn-primary" href="#/">Volver al inicio</a></div></div>`;
}

/* ================= panel de administración ================= */
const dayKey = d => new Date(d).toLocaleDateString('en-CA');
function niceMax(v) {
  if (v <= 0) return 100;
  const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e;
}
const shortMoney = n => n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(Math.round(n));

function adminDash() {
  const s = ST(), live = s.orders.filter(o => o.status !== 'cancelled');
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * 864e5));
  const totals = days.map(d => live.filter(o => dayKey(o.date) === dayKey(d)).reduce((a, o) => a + o.total, 0));
  const sum = totals.reduce((a, b) => a + b, 0), max = niceMax(Math.max(...totals));
  const open = s.orders.filter(o => ['pending', 'paid', 'preparing'].includes(o.status));
  const alerts = s.products.filter(p => stockState(p) !== 'ok');
  const recent = [...s.orders].reverse().slice(0, 5);
  return html`
  <div class="adm-h"><div><span class="eyebrow">${s.name}</span><h1>Resumen</h1></div><a class="btn btn-ghost btn-sm" href="#/admin/productos/nuevo">Nuevo producto</a></div>
  <div class="kpis">
    <div class="kpi"><span class="eyebrow">Ventas, 14 días</span><b>${money(sum)}</b><span class="sub">${live.length} pedidos</span></div>
    <div class="kpi"><span class="eyebrow">Por atender</span><b>${open.length}</b><span class="sub">${s.orders.filter(o => o.status === 'pending').length} sin pagar</span></div>
    <div class="kpi"><span class="eyebrow">Ticket promedio</span><b>${money(live.length ? sum / live.length : 0)}</b><span class="sub">por pedido</span></div>
    <div class="kpi"><span class="eyebrow">Stock en alerta</span><b>${alerts.length}</b><span class="sub">${alerts.filter(p => stockState(p) === 'out').length} agotados</span></div></div>
  <div class="cols">
    <section class="card-box"><header><h3>Ventas por día</h3><span class="muted small">Del ${fmtDate(days[0])} al ${fmtDate(days[13])}</span></header>
      <div class="pad chart-wrap"><div class="chart" role="img" aria-label="Ventas diarias de los últimos 14 días">
        ${[1, .5, 0].map(f => html`<div class="gl" style="bottom:${f * 100}%"><span>${shortMoney(max * f)}</span></div>`)}
        <div class="bars">${totals.map((v, i) => html`<div class="bar ${i === 13 ? 'today' : ''}" title="${fmtDate(days[i])}: ${money(v)}"><i style="height:${(v / max) * 100}%"></i><em>${days[i].getDate()}</em></div>`)}</div></div></div></section>
    <section class="card-box"><header><h3>Inventario en alerta</h3><a class="small" href="#/admin/inventario">Ver todo</a></header>
      ${alerts.length ? alerts.slice(0, 5).map(p => html`<a class="list-row" href="#/admin/productos/${p.id}">${art(p)}<span><b>${p.name}</b><br><span class="muted small">${p.stock} en stock</span></span>${stockPill(p)}</a>`) : html`<p class="pad muted">Todo el inventario está en orden.</p>`}</section></div>
  <section class="card-box"><header><h3>Pedidos recientes</h3><a class="small" href="#/admin/pedidos">Ver todos</a></header>${ordersTable(recent)}</section>`;
}

function ordersTable(list) {
  return html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th>Estado</th><th class="r">Total</th></tr></thead><tbody>
    ${list.map(o => html`<tr data-search="${(o.id + ' ' + o.customer.name + ' ' + o.customer.email).toLowerCase()}">
      <td data-label="Pedido"><a class="mono" href="#/admin/pedidos/${o.id}"><b>#${o.id}</b></a></td><td data-label="Fecha">${fmtDate(o.date)}</td>
      <td data-label="Cliente">${o.customer.name}</td><td data-label="Pago">${METHODS[o.method]}</td><td data-label="Estado">${pill(o.status)}</td>
      <td data-label="Total" class="r num">${money(o.total)}</td></tr>`)}</tbody></table></div>`;
}

function filterBox(ph) {
  return html`<div class="field" style="max-width:320px"><label class="sr" for="adm-filter">Buscar</label><input id="adm-filter" type="search" placeholder="${ph}" data-input="filter"></div>`;
}

function adminProducts(q) {
  const s = ST(), f = q.get('f') || 'all';
  const list = s.products.filter(p => f === 'all' || p.status === f);
  const tab = (k, l, n) => html`<a href="#/admin/productos${k === 'all' ? '' : '?f=' + k}" aria-current="${f === k}">${l} <span class="c">${n}</span></a>`;
  return html`<div class="adm-h"><div><span class="eyebrow">Catálogo</span><h1>Productos</h1></div><a class="btn btn-primary btn-sm" href="#/admin/productos/nuevo">Nuevo producto</a></div>
  <div class="card-box"><div class="pad row between" style="padding-bottom:0">${filterBox('Buscar por nombre o referencia')}</div>
    <div style="padding:12px 20px 0"><nav class="tabs">${tab('all', 'Todos', s.products.length)}${tab('active', 'Activos', s.products.filter(p => p.status === 'active').length)}${tab('draft', 'Borradores', s.products.filter(p => p.status === 'draft').length)}</nav></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th>Categoría</th><th class="r">Precio</th><th>Stock</th><th>Estado</th><th></th></tr></thead><tbody>
    ${list.map(p => html`<tr data-search="${(p.name + ' ' + p.sku + ' ' + p.cat).toLowerCase()}">
      <td data-label="" class="full"><div class="cell-prod">${art(p)}<div><a href="#/admin/productos/${p.id}">${p.name}</a><div class="muted small mono">${p.sku}</div></div></div></td>
      <td data-label="Categoría">${p.cat}</td>
      <td data-label="Precio" class="r"><label class="sr" for="pr-${p.id}">Precio de ${p.name}</label><input id="pr-${p.id}" class="inline-num" type="number" min="0" step="0.01" value="${p.price.toFixed(2)}" data-change="price" data-id="${p.id}"></td>
      <td data-label="Stock">${stockPill(p)}<div class="muted small num">${p.stock === null ? '∞' : p.stock + ' u.'}</div></td>
      <td data-label="Estado"><span class="pill ${p.status === 'active' ? 'good' : ''}">${p.status === 'active' ? 'Activo' : 'Borrador'}</span></td>
      <td data-label="" class="r"><a class="btn btn-ghost btn-sm" href="#/admin/productos/${p.id}">Editar</a></td></tr>`)}
    </tbody></table></div></div>`;
}

function adminProductEdit(id) {
  const s = ST(), isNew = id === 'nuevo';
  const p = isNew ? { id: 'n' + Date.now().toString(36), name: '', cat: s.cats[0], price: 0, compare: null, stock: 10, kind: 'box', hue: s.hue, attrs: {}, options: [], desc: '', sku: s.name.slice(0, 2).toUpperCase() + '-' + (1001 + s.products.length), status: 'draft', digital: s.type === 'digital' } : prod(id);
  if (!p) return notFound();
  const delAsk = S.ui.confirm === 'del:' + p.id;
  return html`<div class="adm-h"><div><a class="small muted" href="#/admin/productos">← Productos</a><h1>${isNew ? 'Nuevo producto' : p.name}</h1></div>
    ${isNew ? '' : html`<a class="btn btn-ghost btn-sm" href="#/producto/${p.id}">Ver en la tienda</a>`}</div>
  <form id="pform" data-form="product" data-id="${isNew ? 'nuevo' : p.id}" data-newid="${p.id}" class="edit-grid" novalidate>
    <div class="stack" style="gap:24px">
      <div class="panel"><h3>Información</h3><div class="form-grid">
        <div class="field full"><label for="e-name">Nombre</label><input id="e-name" name="name" value="${p.name}" required></div>
        <div class="field full"><label for="e-desc">Descripción</label><textarea id="e-desc" name="desc">${p.desc}</textarea></div>
        <div class="field"><label for="e-cat">Categoría</label><input id="e-cat" name="cat" list="cats" value="${p.cat}"><datalist id="cats">${s.cats.map(c => html`<option value="${c}">`)}</datalist><span class="hint">Escribe una nueva para crearla.</span></div>
        <div class="field"><label for="e-sku">Referencia (SKU)</label><input id="e-sku" name="sku" value="${p.sku}"></div></div></div>
      <div class="panel"><h3>Precio e inventario</h3><div class="form-grid">
        <div class="field"><label for="e-price">Precio (${s.currency})</label><input id="e-price" name="price" type="number" min="0" step="0.01" value="${p.price}"></div>
        <div class="field"><label for="e-compare">Precio anterior (opcional)</label><input id="e-compare" name="compare" type="number" min="0" step="0.01" value="${p.compare || ''}"><span class="hint">Si es mayor al precio, se muestra como oferta.</span></div>
        <div class="field"><label for="e-stock">Unidades disponibles</label><input id="e-stock" name="stock" type="number" min="0" step="1" value="${p.stock === null ? '' : p.stock}" ${p.stock === null ? 'disabled' : ''}></div>
        <label class="check" style="align-self:end"><input type="checkbox" name="unlimited" id="e-unl" ${p.stock === null ? 'checked' : ''} data-change="unlimited"> Sin límite de stock</label></div></div>
      <div class="panel"><h3>Atributos y opciones</h3><p class="muted small">Los atributos alimentan los filtros del catálogo. Cada tienda define cuáles usar. Las opciones son lo que el cliente elige al comprar.</p>
        <div class="form-grid">${s.facets.map(f => html`<div class="field"><label for="a-${f}">${f}</label><input id="a-${f}" name="attr:${f}" value="${p.attrs[f] || ''}"></div>`)}</div>
        <div class="field"><label for="e-opts">Opciones (una por línea)</label><textarea id="e-opts" name="options" placeholder="Talla: S, M, L">${p.options.map(o => o.name + ': ' + o.values.join(', ')).join('\n')}</textarea></div></div></div>
    <div class="stack" style="gap:24px">
      <div class="panel"><h3>Estado</h3><div class="field"><label for="e-status" class="sr">Estado</label><select id="e-status" name="status"><option value="active" ${p.status === 'active' ? 'selected' : ''}>Activo, visible en la tienda</option><option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Borrador, oculto</option></select></div>
        <label class="check"><input type="checkbox" name="digital" ${p.digital ? 'checked' : ''}> Producto digital o servicio (sin envío)</label></div>
      <div class="panel"><h3>Imagen</h3>${art(p)}<div class="drop"><b>Arrastra una foto aquí</b><span class="small">La carga de imágenes se activa en la versión final.</span></div></div>
      <div class="stack"><button class="btn btn-primary btn-block" type="submit">${isNew ? 'Crear producto' : 'Guardar cambios'}</button>
        ${isNew ? '' : delAsk ? html`<div class="notice">¿Eliminar este producto? Esta acción no se puede deshacer.<div class="row mt" style="margin-top:12px"><button class="btn btn-danger btn-sm" type="button" data-act="del-yes" data-id="${p.id}">Sí, eliminar</button><button class="btn btn-ghost btn-sm" type="button" data-act="confirm-no">Cancelar</button></div></div>` : html`<button class="btn btn-ghost btn-block" type="button" data-act="del-ask" data-id="${p.id}">Eliminar producto</button>`}</div></div>
  </form>`;
}

function adminInventory(q) {
  const s = ST(), f = q.get('f') || 'all';
  const act = s.products;
  const cnt = k => act.filter(p => k === 'all' || (k === 'low' ? stockState(p) === 'low' : stockState(p) === 'out')).length;
  const list = act.filter(p => f === 'all' || stockState(p) === f);
  const units = s.products.reduce((a, p) => a + (p.stock || 0), 0);
  const value = s.products.reduce((a, p) => a + (p.stock || 0) * p.price, 0);
  const tab = (k, l) => html`<a href="#/admin/inventario${k === 'all' ? '' : '?f=' + k}" aria-current="${f === k}">${l} <span class="c">${cnt(k)}</span></a>`;
  return html`<div class="adm-h"><div><span class="eyebrow">Existencias</span><h1>Inventario</h1></div></div>
  <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="kpi"><span class="eyebrow">Productos</span><b>${s.products.length}</b></div>
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
  const s = ST(), f = q.get('f') || 'all';
  const all = [...s.orders].reverse();
  const list = all.filter(o => f === 'all' || o.status === f);
  const keys = ['all', ...flow().slice(0, flow().length), 'cancelled'];
  return html`<div class="adm-h"><div><span class="eyebrow">Ventas</span><h1>Pedidos</h1></div></div>
  <div class="card-box"><div class="pad" style="padding-bottom:0">${filterBox('Buscar por número o cliente')}</div>
    <div style="padding:12px 20px 0;overflow-x:auto"><nav class="tabs" style="flex-wrap:nowrap;white-space:nowrap">${keys.map(k => html`<a href="#/admin/pedidos${k === 'all' ? '' : '?f=' + k}" aria-current="${f === k}">${k === 'all' ? 'Todos' : STATUS[k].l} <span class="c">${k === 'all' ? all.length : all.filter(o => o.status === k).length}</span></a>`)}</nav></div>
    ${list.length ? ordersTable(list) : html`<p class="pad muted">No hay pedidos en este estado.</p>`}</div>`;
}

function adminOrder(id) {
  const s = ST(), o = s.orders.find(x => x.id === id);
  if (!o) return notFound();
  const f = flow(), idx = f.indexOf(o.status), next = idx >= 0 && idx < f.length - 1 ? f[idx + 1] : null;
  const ask = S.ui.confirm === 'cancel:' + o.id;
  return html`<div class="adm-h"><div><a class="small muted" href="#/admin/pedidos">← Pedidos</a><h1>Pedido <span class="mono">#${o.id}</span></h1></div><div class="row">${pill(o.status)}<span class="muted">${fmtDateTime(o.date)}</span></div></div>
  <div class="cols">
    <div class="stack" style="gap:24px">
      <section class="card-box"><header><h3>Productos</h3></header><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Producto</th><th class="r">Precio</th><th class="r">Cant.</th><th class="r">Subtotal</th></tr></thead><tbody>
        ${o.items.map(i => { const p = prod(i.pid); return html`<tr><td data-label=""  class="full"><div class="cell-prod">${p ? art(p) : ''}<div><b>${i.name}</b>${Object.keys(i.opts || {}).length ? html`<div class="muted small">${optsText(i.opts)}</div>` : ''}</div></div></td><td data-label="Precio" class="r num">${money(i.price)}</td><td data-label="Cant." class="r num">${i.qty}</td><td data-label="Subtotal" class="r num">${money(i.price * i.qty)}</td></tr>`; })}</tbody></table></div>
        <div class="pad stack" style="gap:8px;border-top:1px solid var(--line)"><div class="row between"><span class="muted">Subtotal</span><span class="num">${money(o.subtotal)}</span></div>
          ${o.discount ? html`<div class="row between"><span class="muted">Descuento</span><span class="num">−${money(o.discount)}</span></div>` : ''}
          <div class="row between"><span class="muted">Envío</span><span class="num">${o.address ? (o.shipping ? money(o.shipping) : 'Gratis') : 'Digital'}</span></div>
          <div class="row between" style="font-weight:700;font-size:17px"><span>Total</span><span class="num">${money(o.total)}</span></div></div></section>
      <section class="card-box"><header><h3>Cliente y entrega</h3></header><div class="pad"><dl class="spec">
        <dt>Cliente</dt><dd>${o.customer.name}</dd><dt>Correo</dt><dd>${o.customer.email}</dd><dt>Teléfono</dt><dd class="mono">${o.customer.phone}</dd>
        <dt>Entrega</dt><dd>${o.address ? o.address.line + ', ' + o.address.city : 'Digital, por correo'}</dd>
        <dt>Pago</dt><dd>${METHODS[o.method]} · ${o.status === 'pending' ? 'por confirmar' : o.status === 'cancelled' ? 'cancelado' : 'confirmado'}</dd></dl></div></section></div>
    <section class="card-box"><header><h3>Seguimiento</h3></header><div class="pad stack">${timeline(o)}
      ${next ? html`<button class="btn btn-primary btn-block" data-act="order-next" data-id="${o.id}">${NEXT_LABEL[next]}</button>` : ''}
      ${o.status !== 'cancelled' && o.status !== 'delivered' ? (ask ? html`<div class="notice">¿Cancelar el pedido #${o.id}?<div class="row" style="margin-top:12px"><button class="btn btn-danger btn-sm" data-act="order-cancel" data-id="${o.id}">Sí, cancelar</button><button class="btn btn-ghost btn-sm" data-act="confirm-no">Volver</button></div></div>` : html`<button class="btn btn-ghost btn-block" data-act="cancel-ask" data-id="${o.id}">Cancelar pedido</button>`) : ''}
      ${o.status === 'delivered' ? html`<p class="muted small">Pedido completado.</p>` : ''}</div></section></div>`;
}

function adminSettings() {
  const s = ST();
  const num = (k, label, v, hint) => html`<div class="field"><label for="s-${k}">${label}</label><input id="s-${k}" type="number" min="0" step="${k === 'lowStock' ? 1 : 0.5}" value="${v}" data-change="setting" data-key="${k}">${hint ? html`<span class="hint">${hint}</span>` : ''}</div>`;
  return html`<div class="adm-h"><div><span class="eyebrow">Configuración</span><h1>Ajustes de la tienda</h1></div></div>
  <div class="panel"><h3>Identidad</h3><div class="form-grid">
    <div class="field"><label for="s-name">Nombre de la tienda</label><input id="s-name" value="${s.name}" data-change="setting" data-key="name"></div>
    <div class="field"><label for="s-symbol">Símbolo de moneda</label><input id="s-symbol" value="${s.symbol}" maxlength="4" data-change="setting" data-key="symbol"></div>
    <div class="field full"><label for="s-tagline">Descripción corta</label><input id="s-tagline" value="${s.tagline}" data-change="setting" data-key="tagline"></div>
    <div class="field full"><span class="lbl">Color de la tienda</span><div class="swatches">${[215, 168, 28, 262, 340, 142].map(h => html`<button style="--sw:${h}" data-act="hue" data-h="${h}" aria-pressed="${s.hue === h}" aria-label="Color ${h}"></button>`)}</div></div></div></div>
  <div class="panel"><h3>Envíos</h3>${s.type === 'digital' ? html`<p class="muted">Esta tienda vende productos digitales, por eso no cobra envío.</p>` : html`<div class="form-grid">${num('flat', `Costo de envío (${s.symbol})`, s.shipping.flat)}${num('freeFrom', `Envío gratis desde (${s.symbol})`, s.shipping.freeFrom)}</div>`}</div>
  <div class="panel"><h3>Pagos</h3><label class="check"><input type="checkbox" data-change="setting" data-key="pay.card" ${s.pay.card ? 'checked' : ''}> Tarjeta de crédito o débito</label>
    <label class="check"><input type="checkbox" data-change="setting" data-key="pay.transfer" ${s.pay.transfer ? 'checked' : ''}> Transferencia bancaria</label>
    ${s.type === 'digital' ? '' : html`<label class="check"><input type="checkbox" data-change="setting" data-key="pay.cod" ${s.pay.cod ? 'checked' : ''}> Pago contra entrega</label>`}
    <p class="muted small">En el prototipo los pagos son simulados. En la versión final se conecta la pasarela elegida.</p></div>
  <div class="panel"><h3>Inventario</h3><div class="form-grid">${num('lowStock', 'Alerta de stock bajo (unidades)', s.lowStock, 'Se marca “Stock bajo” cuando quedan estas unidades o menos.')}</div></div>`;
}

const NAV = [['', 'Resumen', 'home'], ['productos', 'Productos', 'box'], ['inventario', 'Inventario', 'stock'], ['pedidos', 'Pedidos', 'orders'], ['ajustes', 'Ajustes', 'gear']];
function adminPage(b, c, q) {
  let body;
  if (!b) body = adminDash();
  else if (b === 'productos') body = c ? adminProductEdit(c) : adminProducts(q);
  else if (b === 'inventario') body = adminInventory(q);
  else if (b === 'pedidos') body = c ? adminOrder(c) : adminOrders(q);
  else if (b === 'ajustes') body = adminSettings();
  else body = notFound();
  const pending = ST().orders.filter(o => o.status === 'pending').length;
  return html`<div class="adm-top"><div class="wrap"><a class="brand" href="#/admin"><span class="mark">${ST().name[0]}</span>${ST().name}</a><span class="pill" style="--c:var(--muted)">Panel</span><span class="grow"></span><a class="btn btn-ghost btn-sm" href="#/">Ver tienda</a></div></div>
  <div class="wrap adm"><nav class="side" aria-label="Panel">${NAV.map(([k, l, i]) => html`<a href="#/admin${k ? '/' + k : ''}" ${(b || '') === k ? raw('aria-current="page"') : ''}>${ic(i)}${l}${k === 'pedidos' && pending ? html`<span class="cnt">${pending}</span>` : ''}</a>`)}</nav>
  <main class="adm-main">${body}</main></div>`;
}

/* ================= estructura general ================= */
function demoBar(isAdmin) {
  return html`<div class="demobar"><div class="wrap">
    <span class="tag">Prototipo · datos de demostración · sin pagos reales</span>
    <label class="sr" for="store-sel">Tienda de ejemplo</label>
    <select id="store-sel" data-change="store">${Object.keys(S.stores).map(k => html`<option value="${k}" ${k === S.cur ? 'selected' : ''}>${S.stores[k].name} · ${S.stores[k].rubro}</option>`)}</select>
    <span class="seg"><a href="#/" ${!isAdmin && S.route.segs[0] !== 'guia' ? raw('aria-current="page"') : ''}>Tienda</a><a href="#/admin" ${isAdmin ? raw('aria-current="page"') : ''}>Panel admin</a></span>
    <span class="sp"></span><a class="lnk" href="#/guia">Guía</a><button data-act="theme">Tema</button><button data-act="reset">Restablecer datos</button></div></div>`;
}
function header() {
  const s = ST(), n = cartCount(), cat = S.route.segs[0] === 'catalogo' ? S.route.q.get('cat') : null;
  return html`<header class="hdr ${S.ui.search ? 'search-open' : ''}"><div class="wrap hdr-in">
    <button class="icon-btn menu-btn" data-act="menu-open" aria-label="Abrir menú">${ic('menu')}</button>
    <a class="brand" href="#/"><span class="mark">${s.name[0]}</span>${s.name}</a>
    <nav class="nav" aria-label="Principal">${s.cats.map(c => html`<a href="#/catalogo?cat=${enc(c)}" ${cat === c ? raw('aria-current="page"') : ''}>${c}</a>`)}</nav>
    <form class="search" data-form="search" role="search">${ic('search')}<label class="sr" for="q">Buscar productos</label><input id="q" type="search" placeholder="Buscar productos" value="${S.route.segs[0] === 'catalogo' ? S.route.q.get('q') || '' : ''}"></form>
    <button class="icon-btn search-btn" data-act="search-toggle" aria-label="Buscar">${ic('search')}</button>
    <a class="icon-btn" href="#/carrito" data-act="cart-open" aria-label="Carrito, ${n} productos">${ic('cart')}${n ? html`<span class="badge-n">${n}</span>` : ''}</a></div></header>`;
}
function footer() {
  const s = ST();
  return html`<footer class="foot"><div class="wrap foot-in"><div><div class="brand" style="margin-bottom:8px"><span class="mark">${s.name[0]}</span>${s.name}</div><p class="muted" style="max-width:36ch">${s.tagline}</p></div>
    <div><h3 style="margin-bottom:8px">Tienda</h3><a href="#/catalogo">Catálogo</a><a href="#/carrito">Carrito</a></div>
    <div><h3 style="margin-bottom:8px">Ayuda</h3><a href="#/guia">Guía del prototipo</a><a href="#/admin">Panel administrativo</a></div></div></footer>`;
}
function renderOverlay() {
  const u = S.ui, s = ST(), q = S.route.q;
  let out = '';
  if (u.menu) {
    out = html`<button class="scrim" data-act="close" aria-label="Cerrar menú"></button><aside class="drawer left" role="dialog" aria-label="Menú"><div class="drawer-h"><b>${s.name}</b><button class="icon-btn" data-act="close" aria-label="Cerrar">${ic('close')}</button></div>
      <div class="drawer-b"><form class="search" style="display:flex;width:100%;padding:0" data-form="search">${ic('search')}<label class="sr" for="q2">Buscar</label><input id="q2" type="search" placeholder="Buscar productos"></form>
      <a class="btn btn-ghost" href="#/catalogo">Todo el catálogo</a>${s.cats.map(c => html`<a href="#/catalogo?cat=${enc(c)}" style="font-size:19px;font-weight:650;text-decoration:none;padding:6px 0">${c}</a>`)}
      <hr style="border:0;border-top:1px solid var(--line);width:100%"><a href="#/guia" class="muted">Guía del prototipo</a><a href="#/admin" class="muted">Panel administrativo</a></div></aside>`;
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
function applyTheme() { document.documentElement.style.setProperty('--hue', ST().hue); }
function page() {
  const [a, b, c] = S.route.segs, q = S.route.q;
  if (a === 'admin') return adminPage(b, c, q);
  switch (a) {
    case undefined: return home();
    case 'catalogo': return catalog(q);
    case 'producto': return pdp(b);
    case 'carrito': return cartPage();
    case 'pago': return checkout();
    case 'pedido': return done(b);
    case 'guia': return guide();
    default: return notFound();
  }
}
function render(toTop) {
  const y = window.scrollY, fid = document.activeElement && document.activeElement.id;
  applyTheme();
  const isAdmin = S.route.segs[0] === 'admin';
  const body = page();
  $('#root').innerHTML = html`${demoBar(isAdmin)}${isAdmin ? '' : header()}${isAdmin ? body : html`<main>${body}</main>${footer()}`}`.s;
  renderOverlay();
  window.scrollTo(0, toTop ? 0 : y);
  if (fid && !toTop) { const el = document.getElementById(fid); if (el && el.tagName !== 'BUTTON') el.focus(); }
}
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ================= eventos ================= */
const ACT = {
  close() { S.ui.menu = S.ui.cart = S.ui.filters = false; render(); },
  'menu-open'() { S.ui.menu = true; render(); },
  'filters-open'() { S.ui.filters = true; render(); },
  'search-toggle'() { S.ui.search = !S.ui.search; render(); if (S.ui.search) { const i = $('#q'); i && i.focus(); } },
  'cart-open'(el, e) { e.preventDefault(); S.ui.cart = true; render(); },
  theme() {
    const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
  },
  reset() { store_.del(KEY); S.stores = buildDemo(); S.ui.pdp = S.ui.co = null; persist(); go('#/', true); toast('Datos de demostración restablecidos.'); },
  thumb(el) { S.ui.pdp.img = +el.dataset.i; render(); },
  opt(el) { S.ui.pdp.opts[el.dataset.name] = el.dataset.val; render(); },
  'pdp-qty'(el) { const p = prod(S.ui.pdp.pid); S.ui.pdp.qty = Math.min(Math.max(1, S.ui.pdp.qty + +el.dataset.d), Math.max(1, maxQty(p))); render(); },
  add() { const u = S.ui.pdp; addToCart(prod(u.pid), u.qty, { ...u.opts }); render(); },
  'cart-qty'(el) {
    const it = ST().cart.items[+el.dataset.i], p = prod(it.pid), n = it.qty + +el.dataset.d;
    const others = ST().cart.items.filter(x => x !== it && x.pid === p.id).reduce((a, x) => a + x.qty, 0);
    if (n < 1) return;
    if (n + others > maxQty(p)) return toast(`Solo hay ${maxQty(p)} unidades disponibles.`);
    it.qty = n; persist(); render();
  },
  'cart-remove'(el) { ST().cart.items.splice(+el.dataset.i, 1); persist(); render(); },
  'coupon-remove'() { ST().cart.coupon = null; persist(); render(); },
  'co-fill'() {
    const t = calc(lines());
    Object.assign(S.ui.co.data, { email: 'valentina.rios@correo.com', name: 'Valentina Ríos', phone: '3105550142', address: 'Calle 45 #12-30', city: 'Medellín', notes: '', cardNumber: '4242 4242 4242 4242', cardName: 'Valentina Ríos', cardExp: '12/29', cardCvc: '123' });
    S.ui.co.errors = {}; render(); toast(t.physical ? 'Datos de ejemplo cargados.' : 'Datos de ejemplo cargados (sin dirección).');
  },
  'co-next'() { const co = S.ui.co; if (validate(co.step)) { co.step++; render(true); } else { render(); const bad = $('[aria-invalid="true"]'); bad && bad.focus(); } },
  'co-back'() { S.ui.co.step--; render(true); },
  'co-edit'(el) { S.ui.co.step = +el.dataset.step; render(true); },
  'place-order'() { placeOrder(); },
  stock(el) { const p = prod(el.dataset.id); p.stock = Math.max(0, p.stock + +el.dataset.d); persist(); render(); },
  'stock-limit'(el) { prod(el.dataset.id).stock = 10; persist(); render(); toast('Stock definido en 10 unidades.'); },
  'del-ask'(el) { S.ui.confirm = 'del:' + el.dataset.id; render(); },
  'cancel-ask'(el) { S.ui.confirm = 'cancel:' + el.dataset.id; render(); },
  'confirm-no'() { S.ui.confirm = null; render(); },
  'del-yes'(el) { const s = ST(); s.products = s.products.filter(p => p.id !== el.dataset.id); s.cart.items = s.cart.items.filter(i => i.pid !== el.dataset.id); S.ui.confirm = null; persist(); go('#/admin/productos'); toast('Producto eliminado.'); },
  'order-next'(el) {
    const o = ST().orders.find(x => x.id === el.dataset.id), f = flow(), n = f[f.indexOf(o.status) + 1];
    if (!n) return;
    o.status = n; o.history.push({ s: n, at: new Date().toISOString() }); persist(); render(); toast(`Pedido #${o.id}: ${STATUS[n].l.toLowerCase()}.`);
  },
  'order-cancel'(el) {
    const o = ST().orders.find(x => x.id === el.dataset.id);
    o.status = 'cancelled'; o.history.push({ s: 'cancelled', at: new Date().toISOString() }); S.ui.confirm = null; persist(); render(); toast(`Pedido #${o.id} cancelado.`);
  },
  hue(el) { ST().hue = +el.dataset.h; persist(); render(); toast('Color actualizado.'); },
};

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#/"]');
  if (a && a.dataset.act !== 'cart-open') {
    e.preventDefault();
    S.ui.confirm = null;
    S.ui.cart = false;
    return go(a.getAttribute('href'));
  }
  const el = e.target.closest('[data-act]');
  if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el, e);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.field && S.ui.co) S.ui.co.data[t.dataset.field] = t.value;
  if (t.dataset.input === 'filter') {
    const term = t.value.toLowerCase().trim();
    $$('tr[data-search]').forEach(r => { r.hidden = !r.dataset.search.includes(term); });
  }
});

document.addEventListener('change', e => {
  const t = e.target, s = ST();
  if (t.dataset.go) return go(t.dataset.go, true);
  if (t.hasAttribute('data-go-select')) return go(t.value, true);
  if (t.dataset.method !== undefined) { S.ui.co.data.method = t.value; return render(); }
  const ch = t.dataset.change;
  if (ch === 'store') {
    S.cur = t.value; S.ui.pdp = S.ui.co = null; S.ui.cart = false; persist();
    return go(S.route.segs[0] === 'admin' ? '#/admin' : '#/');
  }
  if (ch === 'price') {
    const p = prod(t.dataset.id), v = parseFloat(t.value);
    if (!(v >= 0)) { t.value = p.price.toFixed(2); return toast('Escribe un precio válido.'); }
    p.price = Math.round(v * 100) / 100; if (p.compare && p.compare <= p.price) p.compare = null;
    persist(); t.value = p.price.toFixed(2); return toast(`Precio de “${p.name}” actualizado a ${money(p.price)}.`);
  }
  if (ch === 'stock') {
    const p = prod(t.dataset.id), v = Math.max(0, Math.floor(+t.value || 0));
    p.stock = v; persist(); render(); return toast(`Stock de “${p.name}”: ${v} unidades.`);
  }
  if (ch === 'unlimited') { const f = $('#e-stock'); f.disabled = t.checked; if (!t.checked && !f.value) f.value = 10; return; }
  if (ch === 'setting') {
    const key = t.dataset.key;
    let v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Math.max(0, +t.value || 0) : t.value.trim();
    if (key === 'name' && !v) { t.value = s.name; return toast('El nombre no puede quedar vacío.'); }
    if (key === 'flat' || key === 'freeFrom') s.shipping[key] = v;
    else if (key.startsWith('pay.')) {
      s.pay[key.slice(4)] = v;
      if (!Object.values(s.pay).some(Boolean)) { s.pay[key.slice(4)] = true; render(); return toast('Deja al menos un método de pago activo.'); }
    } else s[key] = v;
    persist(); render(); return toast('Cambios guardados.');
  }
});

document.addEventListener('submit', e => {
  const f = e.target, kind = f.dataset.form;
  if (!kind) return;
  e.preventDefault();
  if (kind === 'search') {
    const v = $('input', f).value.trim();
    return go('#/catalogo' + (v ? '?q=' + enc(v) : ''));
  }
  if (kind === 'coupon') {
    const code = $('#coupon').value.trim().toUpperCase();
    if (code === 'PRIMERA10') { ST().cart.coupon = code; persist(); render(); return toast('Cupón aplicado: 10 % de descuento.'); }
    return toast('Ese cupón no es válido. Prueba con PRIMERA10.');
  }
  if (kind === 'product') {
    const s = ST(), fd = new FormData(f), isNew = f.dataset.id === 'nuevo';
    const name = (fd.get('name') || '').trim(), price = parseFloat(fd.get('price'));
    if (!name) { $('#e-name').focus(); return toast('Escribe el nombre del producto.'); }
    if (!(price >= 0)) { $('#e-price').focus(); return toast('Escribe un precio válido.'); }
    const p = isNew ? { id: f.dataset.newid, kind: 'box', hue: s.hue, attrs: {}, options: [] } : prod(f.dataset.id);
    const cat = (fd.get('cat') || '').trim() || s.cats[0];
    if (!s.cats.includes(cat)) s.cats.push(cat);
    const cmp = parseFloat(fd.get('compare'));
    Object.assign(p, {
      name, desc: (fd.get('desc') || '').trim(), cat, sku: (fd.get('sku') || '').trim(), price: Math.round(price * 100) / 100,
      compare: cmp > price ? cmp : null, stock: fd.get('unlimited') ? null : Math.max(0, Math.floor(+fd.get('stock') || 0)),
      status: fd.get('status'), digital: !!fd.get('digital'),
    });
    s.facets.forEach(k => { const v = (fd.get('attr:' + k) || '').trim(); if (v) p.attrs[k] = v; else delete p.attrs[k]; });
    p.options = (fd.get('options') || '').split('\n').map(l => {
      const [n, ...rest] = l.split(':');
      const values = rest.join(':').split(',').map(x => x.trim()).filter(Boolean);
      return n.trim() && values.length ? { name: n.trim(), values } : null;
    }).filter(Boolean);
    if (isNew) s.products.push(p);
    persist(); go('#/admin/productos'); return toast(isNew ? 'Producto creado.' : 'Cambios guardados.');
  }
});

document.addEventListener('keydown', e => { if (e.key === 'Escape' && (S.ui.menu || S.ui.cart || S.ui.filters)) ACT.close(); });

/* ================= arranque ================= */
loadState();
S.route = parse(location.hash);
render(true);
})();
