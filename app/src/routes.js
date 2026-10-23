import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { COOKIE, createSession, destroySession, bootstrapAdmin, hashPassword, validatePassword, verifyPassword } from './auth.js';
import { HttpError, bad, intOr, nowIso, readBody, str } from './http/util.js';
import { getStore, updateStore, getFiscal, updateFiscal, fiscalForAdmin } from './domain/settings.js';
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct, listCategories } from './domain/catalog.js';
import { listPromos, publicPromos, createPromo, updatePromo, deletePromo } from './domain/promos.js';
import { registerCustomer, loginCustomer, customerJson, listCustomers, setCustomerType, getCustomer, normEmail, createResetToken, consumeResetToken } from './domain/customers.js';
import { queueWelcomeEmail, queueResetEmail, listEmails, getEmail } from './mail/index.js';
import { createOrder, orderJson, getOrderRow, getOrderPublic, listOrders, ordersOfCustomer, advanceOrder, cancelOrder, DOC_TYPES } from './domain/orders.js';
import { handleWebhook, syncOrderPayments } from './payments/wompi.js';
import { startOnlinePayment } from './payments/index.js';
import { demoAttempt, simulateOutcome } from './payments/demo.js';
import { listInvoices, getInvoiceDocument, retryInvoice, backfillInvoices, invoiceCounts, listResolutions, createResolution, setResolutionActive, resolutionWarnings, processInvoices } from './invoicing/service.js';
import { listProviders } from './invoicing/providers.js';

const IMG = { 'image/jpeg': ['jpg', b => b[0] === 0xff && b[1] === 0xd8], 'image/png': ['png', b => b.slice(0, 4).toString('hex') === '89504e47'], 'image/webp': ['webp', b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP'] };

export function registerRoutes(r, { config, db, limiter, wompi, uploadsDir }) {
  const get = (p, o, h) => r.add('GET', p, o, h);
  const post = (p, o, h) => r.add('POST', p, o, h);
  const put = (p, o, h) => r.add('PUT', p, o, h);
  const del = (p, o, h) => r.add('DELETE', p, o, h);
  const A = { auth: 'admin' };
  const pid = v => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw new HttpError(404, 'No encontrado.', 'not_found'); return n; };

  const publicStore = c => {
    const s = getStore(db);
    return {
      name: s.name, tagline: s.tagline, hue: s.hue, theme: s.theme, symbol: s.symbol, currency: s.currency, type: s.type, hero: s.hero, perks: s.perks, facets: s.facets,
      lowStock: s.lowStock, shipping: s.shipping, loyalty: s.loyalty,
      pay: { online: s.pay.online && config.onlineEnabled, transfer: s.pay.transfer, cod: s.pay.cod }, paymentMode: config.paymentMode,
    };
  };
  const customerPayload = row => (row ? customerJson(db, row, getStore(db).loyalty) : null);

  get('/api/health', {}, ctx => ({ ok: true, time: nowIso() }));

  get('/api/store', {}, ctx => {
    const fiel = !!ctx.customer && customerPayload(ctx.customer).type === 'fiel';
    return { store: publicStore(), cats: listCategories(db), products: listProducts(db), promos: publicPromos(db, { fiel }), docTypes: DOC_TYPES, me: customerPayload(ctx.customer) };
  });

  /* ----- cuenta de cliente ----- */
  post('/api/auth/register', {}, async ctx => {
    limiter.check(`reg:${ctx.ip}`, 10, 3600e3);
    const row = await registerCustomer(db, ctx.body);
    queueWelcomeEmail(db, row);
    const s = createSession(db, 'customer', row.id);
    ctx.setCookie(COOKIE.customer, s.token, s.maxAge);
    return { me: customerPayload(row) };
  });
  post('/api/auth/login', {}, async ctx => {
    limiter.check(`login:${ctx.ip}:${normEmail(ctx.body.email)}`, 10, 15 * 60e3);
    const row = await loginCustomer(db, ctx.body);
    const s = createSession(db, 'customer', row.id);
    ctx.setCookie(COOKIE.customer, s.token, s.maxAge);
    return { me: customerPayload(row) };
  });
  post('/api/auth/forgot', {}, ctx => {
    limiter.check(`forgot:${ctx.ip}`, 10, 3600e3);
    limiter.check(`forgot:${normEmail(ctx.body.email)}`, 3, 3600e3);
    const r = createResetToken(db, ctx.body.email);
    if (r) queueResetEmail(db, r.customer, r.token);
    // La respuesta es la misma exista o no la cuenta, para no revelar qué correos están registrados.
    return { ok: true, message: 'Si el correo tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva.' };
  });
  post('/api/auth/reset', {}, async ctx => {
    limiter.check(`reset:${ctx.ip}`, 20, 3600e3);
    await consumeResetToken(db, ctx.body.token, ctx.body.password);
    return { ok: true };
  });
  post('/api/auth/logout', {}, ctx => { destroySession(db, ctx.cookies[COOKIE.customer]); ctx.clearCookie(COOKIE.customer); return { ok: true }; });
  get('/api/me', {}, ctx => ({ me: customerPayload(ctx.customer), orders: ctx.customer ? ordersOfCustomer(db, ctx.customer.id) : [] }));
  put('/api/me', {}, ctx => {
    if (!ctx.customer) throw new HttpError(401, 'Inicia sesión.', 'unauthorized');
    const b = ctx.body;
    db.prepare('UPDATE customers SET name = ?, phone = ?, address = ?, city = ? WHERE id = ?')
      .run(str(b.name, 100) || ctx.customer.name, str(b.phone, 30), str(b.address, 200), str(b.city, 80), ctx.customer.id);
    return { me: customerPayload(getCustomer(db, ctx.customer.id)) };
  });

  /* ----- pedidos ----- */
  const checkoutFor = order => {
    const row = getOrderRow(db, order.id);
    return startOnlinePayment(db, config, { id: row.id, total: row.total, email: row.email, name: row.name, accessToken: row.access_token });
  };
  const orderResponse = (row, extra = {}) => ({ order: { ...orderJson(db, row), token: row.access_token }, ...extra });

  post('/api/orders', {}, ctx => {
    limiter.check(`order:${ctx.ip}`, 20, 10 * 60e3);
    const id = createOrder({ db, config }, ctx.body, ctx.customer);
    const row = getOrderRow(db, id);
    const extra = {};
    if (row.method === 'online') extra.checkout = checkoutFor(row);
    if (row.method === 'transfer') extra.transferInstructions = getStore(db).transferInstructions;
    return { status: 201, body: orderResponse(row, extra) };
  });

  const ownedOrder = ctx => {
    const id = pid(ctx.params.id);
    const token = ctx.query.get('t');
    let row = token ? getOrderPublic(db, id, token) : null;
    if (!row && ctx.customer) { const o = getOrderRow(db, id); if (o && o.customer_id === ctx.customer.id) row = o; }
    if (!row) throw new HttpError(404, 'No encontramos ese pedido.', 'not_found');
    return row;
  };
  get('/api/orders/:id', {}, ctx => {
    const row = ownedOrder(ctx);
    return orderResponse(row, row.method === 'transfer' ? { transferInstructions: getStore(db).transferInstructions } : {});
  });
  post('/api/orders/:id/pay', {}, ctx => {
    limiter.check(`pay:${ctx.ip}`, 20, 10 * 60e3);
    const row = ownedOrder(ctx);
    if (row.method !== 'online' || row.status !== 'pending' || row.paid_at) throw new HttpError(409, 'Este pedido no admite un nuevo intento de pago.', 'bad_transition');
    return { checkout: checkoutFor(row) };
  });
  post('/api/orders/:id/sync', {}, async ctx => {
    limiter.check(`sync:${ctx.ip}`, 60, 10 * 60e3);
    const row = ownedOrder(ctx);
    if (row.method === 'online' && !row.paid_at && wompi) await syncOrderPayments(db, wompi, row.id, { txId: str(ctx.body.txId || ctx.query.get('id'), 80) || undefined }).catch(() => null);
    return orderResponse(getOrderRow(db, row.id));
  });

  post('/api/webhooks/wompi', { raw: true }, ctx => {
    if (config.paymentMode !== 'wompi') throw new HttpError(404, 'No encontrado.', 'not_found');
    let event;
    try { event = JSON.parse(ctx.rawBody.toString('utf8')); } catch { throw bad('Evento no válido.'); }
    return handleWebhook(db, config, event, ctx.req.headers['x-event-checksum']);
  });

  /* ----- pasarela simulada (solo PAYMENT_MODE=demo) ----- */
  const demoOnly = () => { if (config.paymentMode !== 'demo') throw new HttpError(404, 'No encontrado.', 'not_found'); };
  get('/api/demo/payment/:id', {}, ctx => {
    demoOnly();
    const row = ownedOrder(ctx);
    return { order: { id: row.id, total: row.total, status: row.status, name: row.name, method: row.method }, attempt: demoAttempt(db, row.id) };
  });
  post('/api/demo/payment/:id', {}, ctx => {
    demoOnly();
    limiter.check(`demopay:${ctx.ip}`, 60, 10 * 60e3);
    const row = ownedOrder(ctx);
    simulateOutcome(db, row, { outcome: ctx.body.outcome, method: ctx.body.method });
    return orderResponse(getOrderRow(db, row.id));
  });

  /* ----- administración: acceso ----- */
  post('/api/admin/login', {}, async ctx => {
    const email = normEmail(ctx.body.email);
    limiter.check(`alogin:${ctx.ip}`, 10, 15 * 60e3);
    limiter.check(`alogin:${email}`, 10, 15 * 60e3);
    const row = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
    const ok = await verifyPassword(String(ctx.body.password || ''), row && row.password_hash);
    if (!row || !ok) throw new HttpError(401, 'Correo o contraseña incorrectos.', 'bad_credentials');
    const s = createSession(db, 'admin', row.id);
    ctx.setCookie(COOKIE.admin, s.token, s.maxAge, true);
    return { admin: { email: row.email, name: row.name } };
  });
  post('/api/admin/logout', {}, ctx => { destroySession(db, ctx.cookies[COOKIE.admin]); ctx.clearCookie(COOKIE.admin); return { ok: true }; });
  get('/api/admin/me', {}, ctx => ({ admin: ctx.admin ? { email: ctx.admin.email, name: ctx.admin.name } : null }));
  post('/api/admin/password', A, async ctx => {
    if (!(await verifyPassword(String(ctx.body.current || ''), ctx.admin.password_hash))) throw new HttpError(403, 'La contraseña actual no es correcta.', 'bad_credentials');
    validatePassword(ctx.body.next);
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(await hashPassword(ctx.body.next), ctx.admin.id);
    return { ok: true };
  });

  /* ----- administración: resumen ----- */
  get('/api/admin/summary', A, ctx => {
    const store = getStore(db);
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - 5 * 3600e3 - i * 864e5).toISOString().slice(0, 10));
    const sales = db.prepare("SELECT substr(datetime(paid_at, '-5 hours'), 1, 10) d, SUM(total) t, COUNT(*) n FROM orders WHERE paid_at IS NOT NULL AND status <> 'cancelled' AND paid_at >= ? GROUP BY d")
      .all(new Date(Date.now() - 15 * 864e5).toISOString());
    const byDay = Object.fromEntries(sales.map(s => [s.d, s]));
    const sum14 = days.reduce((a, d) => a + (byDay[d]?.t || 0), 0), n14 = days.reduce((a, d) => a + (byDay[d]?.n || 0), 0);
    const products = listProducts(db, { admin: true });
    const alerts = products.filter(p => p.stock !== null && p.stock <= store.lowStock).map(p => ({ id: p.id, name: p.name, stock: p.stock, kind: p.kind, hue: p.hue }));
    return {
      days: days.map(d => ({ date: d, total: byDay[d]?.t || 0 })), sales14: sum14, orders14: n14, avgTicket: n14 ? Math.round(sum14 / n14) : 0,
      toAttend: db.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('pending','paid','preparing')").get().c,
      unpaid: db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'pending'").get().c,
      stockAlerts: alerts, recent: listOrders(db, { limit: 5 }),
      invoices: invoiceCounts(db), invoiceWarnings: getFiscal(db).enabled ? resolutionWarnings(db) : [],
    };
  });

  /* ----- administración: catálogo ----- */
  get('/api/admin/products', A, () => ({ products: listProducts(db, { admin: true }), cats: listCategories(db, { onlyActive: false }) }));
  post('/api/admin/products', A, ctx => ({ status: 201, body: { product: createProduct(db, ctx.body) } }));
  get('/api/admin/products/:id', A, ctx => { const p = getProduct(db, ctx.params.id, { admin: true }); if (!p) throw new HttpError(404, 'Producto no encontrado.', 'not_found'); return { product: p }; });
  put('/api/admin/products/:id', A, ctx => { const p = updateProduct(db, ctx.params.id, ctx.body); if (!p) throw new HttpError(404, 'Producto no encontrado.', 'not_found'); return { product: p }; });
  del('/api/admin/products/:id', A, ctx => { if (!deleteProduct(db, ctx.params.id)) throw new HttpError(404, 'Producto no encontrado.', 'not_found'); return { ok: true }; });
  post('/api/admin/products/:id/image', { auth: 'admin', raw: true }, async ctx => {
    const type = String(ctx.req.headers['content-type'] || '').split(';')[0];
    const spec = IMG[type];
    if (!spec) throw bad('Sube una imagen JPG, PNG o WebP.', 'bad_image');
    const buf = ctx.rawBody;
    if (!buf.length || !spec[1](buf)) throw bad('El archivo no es una imagen válida.', 'bad_image');
    const cur = db.prepare('SELECT image FROM products WHERE id = ?').get(ctx.params.id);
    if (!cur) throw new HttpError(404, 'Producto no encontrado.', 'not_found');
    const name = `${ctx.params.id}-${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10)}.${spec[0]}`;
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, name), buf);
    if (cur.image && cur.image !== name) fs.rmSync(path.join(uploadsDir, cur.image), { force: true });
    db.prepare('UPDATE products SET image = ? WHERE id = ?').run(name, ctx.params.id);
    return { product: getProduct(db, ctx.params.id, { admin: true }) };
  });
  del('/api/admin/products/:id/image', A, ctx => {
    const cur = db.prepare('SELECT image FROM products WHERE id = ?').get(ctx.params.id);
    if (!cur) throw new HttpError(404, 'Producto no encontrado.', 'not_found');
    if (cur.image) fs.rmSync(path.join(uploadsDir, cur.image), { force: true });
    db.prepare('UPDATE products SET image = NULL WHERE id = ?').run(ctx.params.id);
    return { product: getProduct(db, ctx.params.id, { admin: true }) };
  });

  get('/api/admin/promos', A, () => ({ promos: listPromos(db) }));
  post('/api/admin/promos', A, ctx => ({ status: 201, body: { promo: createPromo(db, ctx.body) } }));
  put('/api/admin/promos/:id', A, ctx => { const p = updatePromo(db, ctx.params.id, ctx.body); if (!p) throw new HttpError(404, 'Promoción no encontrada.', 'not_found'); return { promo: p }; });
  del('/api/admin/promos/:id', A, ctx => { if (!deletePromo(db, ctx.params.id)) throw new HttpError(404, 'Promoción no encontrada.', 'not_found'); return { ok: true }; });

  /* ----- administración: pedidos y clientes ----- */
  get('/api/admin/orders', A, ctx => ({ orders: listOrders(db, { status: ctx.query.get('status') || '', q: str(ctx.query.get('q') || '', 60), limit: intOr(ctx.query.get('limit'), 200) }) }));
  get('/api/admin/orders/:id', A, ctx => { const o = getOrderRow(db, pid(ctx.params.id)); if (!o) throw new HttpError(404, 'Pedido no encontrado.', 'not_found'); return { order: orderJson(db, o, { admin: true }) }; });
  post('/api/admin/orders/:id/action', A, async ctx => {
    const id = pid(ctx.params.id), a = ctx.body.action;
    if (a === 'advance') advanceOrder(db, id);
    else if (a === 'cancel') cancelOrder(db, id, 'Pedido cancelado por el administrador.');
    else if (a === 'sync' && wompi) await syncOrderPayments(db, wompi, id);
    else throw bad('Acción no válida.');
    if (a === 'advance') await processInvoices(db).catch(() => 0);
    return { order: orderJson(db, getOrderRow(db, id), { admin: true }) };
  });
  get('/api/admin/emails', A, () => ({ emails: listEmails(db), transport: config.mail.transport }));
  get('/api/admin/emails/:id', A, ctx => { const e = getEmail(db, pid(ctx.params.id)); if (!e) throw new HttpError(404, 'Correo no encontrado.', 'not_found'); return { email: e }; });
  get('/api/admin/customers', A, () => ({ customers: listCustomers(db, getStore(db).loyalty) }));
  put('/api/admin/customers/:id/type', A, ctx => {
    const id = pid(ctx.params.id);
    if (!getCustomer(db, id)) throw new HttpError(404, 'Cliente no encontrado.', 'not_found');
    setCustomerType(db, id, ctx.body.type === 'auto' ? null : ctx.body.type);
    return { customer: customerPayload(getCustomer(db, id)) };
  });

  /* ----- administración: ajustes, pagos y facturación ----- */
  get('/api/admin/settings', A, () => ({ store: getStore(db), cats: listCategories(db, { onlyActive: false }), mode: config.paymentMode, wompi: { enabled: config.wompi.enabled, env: config.wompi.env, webhookUrl: `${config.publicUrl}/api/webhooks/wompi` } }));
  put('/api/admin/settings', A, ctx => ({ store: updateStore(db, ctx.body) }));
  get('/api/admin/fiscal', A, () => ({ fiscal: fiscalForAdmin(getFiscal(db)), providers: listProviders(), resolutions: listResolutions(db), warnings: resolutionWarnings(db), counts: invoiceCounts(db) }));
  put('/api/admin/fiscal', A, ctx => ({ fiscal: fiscalForAdmin(updateFiscal(db, ctx.body)) }));
  post('/api/admin/fiscal/resolutions', A, ctx => ({ status: 201, body: { resolution: createResolution(db, ctx.body) } }));
  put('/api/admin/fiscal/resolutions/:id', A, ctx => { if (!setResolutionActive(db, pid(ctx.params.id), !!ctx.body.active)) throw new HttpError(404, 'Resolución no encontrada.', 'not_found'); return { resolutions: listResolutions(db) }; });
  get('/api/admin/invoices', A, ctx => ({ invoices: listInvoices(db, { status: ctx.query.get('status') || '' }) }));
  get('/api/admin/invoices/:id', A, ctx => { const d = getInvoiceDocument(db, pid(ctx.params.id)); if (!d) throw new HttpError(404, 'Factura no encontrada.', 'not_found'); return d; });
  post('/api/admin/invoices/:id/retry', A, async ctx => { retryInvoice(db, pid(ctx.params.id)); await processInvoices(db); return { invoice: getInvoiceDocument(db, pid(ctx.params.id)).invoice }; });
  post('/api/admin/invoicing/backfill', A, async () => { const n = backfillInvoices(db); await processInvoices(db); return { queued: n }; });
}

export { bootstrapAdmin };
