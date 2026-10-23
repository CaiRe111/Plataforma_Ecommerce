import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, closeAll, wompiEvent } from './helpers.js';

after(() => closeAll());
import { integritySignature } from '../src/payments/wompi.js';
import { processInvoices } from '../src/invoicing/service.js';

const buyer = (o = {}) => ({ name: 'Valentina Ríos', email: 'vale@correo.com', phone: '3105550142', docType: 'CC', docNumber: '1020304050', address: 'Calle 45 #12-30', city: 'Medellín', ...o });

async function setup(over) {
  const t = await boot(over);
  t.adminCookie = await t.admin();
  const A = (m, p, b) => t.call(m, p, b, { cookies: t.adminCookie });
  t.A = A;
  await A('PUT', '/api/admin/settings', { name: 'Taller Norte', pay: { online: true, transfer: true, cod: true }, shipping: { flat: 12000, freeFrom: 250000 }, transferInstructions: 'Cuenta 000-111' });
  const mk = async (o) => (await A('POST', '/api/admin/products', { name: 'Camiseta', cat: 'Camisetas', price: 60000, stock: 5, status: 'active', options: [{ name: 'Talla', values: ['S', 'M'] }], ...o })).json.product;
  t.mk = mk;
  t.product = await mk({});
  t.order = (o = {}, cookies = '') => t.call('POST', '/api/orders', { items: [{ pid: t.product.id, qty: 1, opts: { Talla: 'M' } }], buyer: buyer(), method: 'online', ...o }, { cookies });
  return t;
}

test('el panel exige sesión y rechaza orígenes ajenos', async () => {
  const t = await boot();
  assert.equal((await t.call('GET', '/api/admin/products')).status, 401);
  assert.equal((await t.call('POST', '/api/admin/login', { email: 'admin@tienda.co', password: 'mala' })).status, 401);
  const evil = await t.call('POST', '/api/admin/login', { email: 'admin@tienda.co', password: 'clave-segura-1' }, { headers: { origin: 'http://evil.example' } });
  assert.equal(evil.status, 403);
  const ok = await t.call('POST', '/api/admin/login', { email: 'admin@tienda.co', password: 'clave-segura-1' });
  assert.equal(ok.status, 200);
  assert.match(ok.set.join(';'), /HttpOnly/);
  await t.close();
});

test('la tienda pública solo muestra productos activos y oculta datos internos', async () => {
  const t = await setup();
  await t.mk({ name: 'Borrador', status: 'draft' });
  const s = (await t.call('GET', '/api/store')).json;
  assert.deepEqual(s.products.map(p => p.name), ['Camiseta']);
  assert.equal('sku' in s.products[0], false);
  assert.equal(s.store.pay.online, true);
  assert.equal(JSON.stringify(s).includes('prv_test'), false);
  await t.close();
});

test('pedido con Wompi: reserva stock, firma el checkout y valida los datos', async () => {
  const t = await setup();
  const r = await t.order();
  assert.equal(r.status, 201, r.text);
  const u = new URL(r.json.checkout.url);
  assert.equal(u.origin + u.pathname, 'https://checkout.wompi.co/p/');
  assert.equal(u.searchParams.get('amount-in-cents'), String((60000 + 12000) * 100));
  assert.equal(u.searchParams.get('signature:integrity'), integritySignature(r.json.checkout.reference, 7200000, 'COP', 'test_integrity_secret'));
  assert.equal(u.searchParams.get('public-key'), 'pub_test_abc');
  assert.equal(r.json.order.total, 72000);
  assert.equal((await t.A('GET', `/api/admin/products/${t.product.id}`)).json.product.stock, 4);

  assert.equal((await t.order({ items: [{ pid: t.product.id, qty: 1, opts: {} }] })).status, 400, 'falta la talla');
  assert.equal((await t.order({ buyer: buyer({ docNumber: '12' }) })).status, 400, 'documento inválido');
  assert.equal((await t.order({ coupon: 'NOPE' })).status, 400, 'cupón inexistente');
  assert.equal((await t.order({ items: [{ pid: t.product.id, qty: 99, opts: { Talla: 'S' } }] })).status, 409, 'sin stock');
  assert.equal((await t.order({ items: [{ pid: 'zzz', qty: 1, opts: {} }] })).status, 409, 'producto inexistente');
  await t.close();
});

test('el precio lo calcula el servidor, no el navegador', async () => {
  const t = await setup();
  const r = await t.order({ items: [{ pid: t.product.id, qty: 1, opts: { Talla: 'M' }, price: 1 }], total: 1 });
  assert.equal(r.json.order.total, 72000);
  await t.close();
});

test('webhook: firma inválida, aprobación, repetición y monto distinto', async () => {
  const t = await setup();
  const o = (await t.order()).json;
  const ref = o.checkout.reference;
  const tx = { id: 'T-100', status: 'APPROVED', amount_in_cents: 7200000, reference: ref, currency: 'COP', payment_method_type: 'PSE' };

  const bad = wompiEvent(tx); bad.signature.checksum = 'a'.repeat(64);
  assert.equal((await t.call('POST', '/api/webhooks/wompi', bad)).status, 401);
  assert.equal((await t.A('GET', `/api/admin/orders/${o.order.id}`)).json.order.status, 'pending');

  const ok = await t.call('POST', '/api/webhooks/wompi', wompiEvent(tx), { headers: { 'x-event-checksum': wompiEvent(tx).signature.checksum } });
  assert.equal(ok.status, 200);
  const paid = (await t.A('GET', `/api/admin/orders/${o.order.id}`)).json.order;
  assert.equal(paid.status, 'paid');
  assert.ok(paid.paidAt);
  assert.equal(paid.payments[0].status, 'APPROVED');

  const again = await t.call('POST', '/api/webhooks/wompi', wompiEvent(tx));
  assert.equal(again.status, 200);
  assert.equal(again.json.ignored, 'duplicate');
  assert.equal((await t.A('GET', `/api/admin/orders/${o.order.id}`)).json.order.events.filter(e => e.status === 'paid').length, 1);

  // monto distinto al del pedido
  const o2 = (await t.order()).json;
  const t2 = { id: 'T-101', status: 'APPROVED', amount_in_cents: 100, reference: o2.checkout.reference, currency: 'COP' };
  assert.equal((await t.call('POST', '/api/webhooks/wompi', wompiEvent(t2))).json.ignored, 'amount_mismatch');
  assert.equal((await t.A('GET', `/api/admin/orders/${o2.order.id}`)).json.order.status, 'pending');
  await t.close();
});

test('regreso del cliente: /sync consulta a Wompi y aprueba el pedido', async () => {
  let t;
  const fetchImpl = async url => {
    const u = String(url);
    const ref = t.lastRef;
    if (u.includes('/transactions/T-7')) return { ok: true, json: async () => ({ data: { id: 'T-7', status: 'APPROVED', amount_in_cents: 7200000, reference: ref, currency: 'COP', payment_method_type: 'CARD' } }) };
    return { ok: true, json: async () => ({ data: [] }) };
  };
  t = await setup({ fetchImpl });
  const o = (await t.order()).json;
  t.lastRef = o.checkout.reference;
  const r = await t.call('POST', `/api/orders/${o.order.id}/sync?t=${o.order.token}`, { txId: 'T-7' });
  assert.equal(r.json.order.status, 'paid');
  assert.equal((await t.call('GET', `/api/orders/${o.order.id}?t=mal-token`)).status, 404);
  await t.close();
});

test('pedidos sin pagar vencen y devuelven el stock', async () => {
  const t = await setup();
  const o = (await t.order()).json;
  t.app.db.prepare('UPDATE orders SET created_at = ? WHERE id = ?').run(new Date(Date.now() - 3 * 3600e3).toISOString(), o.order.id);
  await t.app.tick();
  assert.equal((await t.A('GET', `/api/admin/orders/${o.order.id}`)).json.order.status, 'cancelled');
  assert.equal((await t.A('GET', `/api/admin/products/${t.product.id}`)).json.product.stock, 5);
  await t.close();
});

test('transferencia: flujo completo y no se cancela lo ya enviado', async () => {
  const t = await setup();
  const o = (await t.order({ method: 'transfer' })).json;
  assert.equal(o.transferInstructions, 'Cuenta 000-111');
  const step = async () => (await t.A('POST', `/api/admin/orders/${o.order.id}/action`, { action: 'advance' })).json.order.status;
  assert.deepEqual([await step(), await step(), await step(), await step()], ['paid', 'preparing', 'shipped', 'delivered']);
  assert.equal((await t.A('POST', `/api/admin/orders/${o.order.id}/action`, { action: 'cancel' })).status, 409);
  await t.close();
});

test('cancelar libera stock y contra entrega cobra al entregar', async () => {
  const t = await setup();
  const a = (await t.order({ method: 'cod' })).json;
  assert.equal((await t.A('GET', `/api/admin/products/${t.product.id}`)).json.product.stock, 4);
  await t.A('POST', `/api/admin/orders/${a.order.id}/action`, { action: 'cancel' });
  assert.equal((await t.A('GET', `/api/admin/products/${t.product.id}`)).json.product.stock, 5);

  const b = (await t.order({ method: 'cod' })).json;
  for (let i = 0; i < 3; i++) await t.A('POST', `/api/admin/orders/${b.order.id}/action`, { action: 'advance' });
  const final = (await t.A('GET', `/api/admin/orders/${b.order.id}`)).json.order;
  assert.equal(final.status, 'delivered');
  assert.ok(final.paidAt);
  await t.close();
});

test('el stock no se vende dos veces', async () => {
  const t = await setup();
  const two = { items: [{ pid: t.product.id, qty: 3, opts: { Talla: 'S' } }] };
  const [a, b] = [await t.order(two), await t.order(two)];
  assert.deepEqual([a.status, b.status], [201, 409]);
  assert.equal((await t.A('GET', `/api/admin/products/${t.product.id}`)).json.product.stock, 2);
  await t.close();
});

test('cuenta de cliente fiel: descuento, envío gratis y códigos exclusivos ocultos al invitado', async () => {
  const t = await setup();
  await t.A('PUT', '/api/admin/settings', { loyalty: { discount: 5, freeShipping: true, threshold: 500000 } });
  await t.A('POST', '/api/admin/promos', { name: 'Solo fieles', kind: 'percent', value: 10, scope: 'all', code: 'FIEL10', audience: 'fiel' });
  const guest = (await t.call('GET', '/api/store')).json;
  assert.equal(guest.promos[0].codeHidden, true);
  assert.notEqual(guest.promos[0].code, 'FIEL10');

  const reg = await t.call('POST', '/api/auth/register', { email: 'Vale@Correo.com', name: 'Vale', phone: '3105550142', password: 'secreta-123' });
  assert.equal(reg.status, 200);
  assert.equal((await t.call('POST', '/api/auth/register', { email: 'vale@correo.com', name: 'Vale', password: 'secreta-123' })).status, 409);
  const cookies = t.cookieOf(reg);
  assert.equal(reg.json.me.type, 'normal');
  const cust = (await t.A('GET', '/api/admin/customers')).json.customers[0];
  await t.A('PUT', `/api/admin/customers/${cust.id}/type`, { type: 'fiel' });

  assert.equal((await t.order({ coupon: 'FIEL10' }, '')).status, 400, 'invitado no puede usar el cupón');
  const r = await t.order({ coupon: 'FIEL10' }, cookies);
  assert.equal(r.status, 201, r.text);
  const ord = r.json.order;
  assert.equal(ord.fiel, true);
  assert.equal(ord.loyaltyDiscount, 3000); // 5 % de 60000
  assert.equal(ord.couponDiscount, 6000); // 10 % de 60000
  assert.equal(ord.total, 51000);
  assert.equal(ord.shipping, 0);
  assert.equal(ord.total, ord.subtotal - ord.loyaltyDiscount - ord.couponDiscount);
  assert.equal((await t.call('GET', `/api/orders/${ord.id}`, undefined, { cookies })).status, 200, 'el dueño ve su pedido sin token');
  await t.close();
});

test('facturación: numeración consecutiva, resolución agotada y reintento', async () => {
  const t = await setup();
  const put = await t.A('PUT', '/api/admin/fiscal', { enabled: true, nit: '900123456', dv: '7', legalName: 'Taller Norte SAS', address: 'Calle 1 #2-3', cityName: 'Medellín', cityCode: '05001' });
  assert.equal(put.status, 200, put.text);
  assert.equal(JSON.stringify(put.json).includes('softwarePin"'), false);
  const pay = async () => {
    const o = (await t.order()).json;
    const tx = { id: 'T-' + o.order.id, status: 'APPROVED', amount_in_cents: o.order.total * 100, reference: o.checkout.reference, currency: 'COP' };
    await t.call('POST', '/api/webhooks/wompi', wompiEvent(tx, { timestamp: o.order.id }));
    return o.order.id;
  };
  const first = await pay();
  await processInvoices(t.app.db);
  let inv = (await t.A('GET', '/api/admin/invoices')).json.invoices;
  assert.equal(inv[0].status, 'error', 'sin resolución no se puede emitir');
  assert.match(inv[0].lastError, /resolución/);

  const res = await t.A('POST', '/api/admin/fiscal/resolutions', { resolutionNumber: '18760000001', prefix: 'SETP', from: 990, to: 991, validFrom: '2020-01-01', validTo: '2099-12-31' });
  assert.equal(res.status, 201, res.text);
  await t.A('POST', `/api/admin/invoices/${inv[0].id}/retry`);
  const second = await pay(), third = await pay();
  await processInvoices(t.app.db, Date.now() + 1000);
  inv = (await t.A('GET', '/api/admin/invoices')).json.invoices.sort((a, b) => a.orderId - b.orderId);
  assert.deepEqual(inv.map(i => [i.orderId, i.status, i.fullNumber]), [[first, 'issued', 'SETP990'], [second, 'issued', 'SETP991'], [third, 'error', '']]);
  assert.equal(inv[0].fiscalValidity, false, 'el proveedor de pruebas no tiene validez fiscal');

  const doc = (await t.A('GET', `/api/admin/invoices/${inv[0].id}`)).json.document;
  assert.equal(doc.totals.total, 72000);
  assert.equal(doc.totals.base + doc.totals.tax, 72000);
  assert.equal(doc.issuer.nit, '900123456');

  await t.A('POST', '/api/admin/fiscal/resolutions', { resolutionNumber: '18760000002', prefix: 'SETP', from: 1000, to: 1100, validFrom: '2020-01-01', validTo: '2099-12-31' });
  await t.A('POST', `/api/admin/invoices/${inv[2].id}/retry`);
  assert.equal((await t.A('GET', '/api/admin/invoices')).json.invoices.find(i => i.orderId === third).fullNumber, 'SETP1000');
  await t.close();
});

test('IVA: base e impuesto por tarifa, descuentos repartidos y envío', async () => {
  const t = await setup();
  const exento = await t.mk({ name: 'Libro', price: 30000, stock: 10, options: [], taxRate: 0 });
  await t.A('PUT', '/api/admin/fiscal', { enabled: true, nit: '900123456', dv: '7', legalName: 'X SAS', address: 'Calle 1', cityName: 'Medellín', cityCode: '05001' });
  await t.A('POST', '/api/admin/fiscal/resolutions', { resolutionNumber: '1', prefix: 'F', from: 1, to: 100, validFrom: '2020-01-01', validTo: '2099-12-31' });
  await t.A('POST', '/api/admin/promos', { name: 'Cupón', kind: 'fixed', value: 10000, code: 'MENOS10' });
  const o = (await t.order({ items: [{ pid: t.product.id, qty: 1, opts: { Talla: 'M' } }, { pid: exento.id, qty: 1, opts: {} }], coupon: 'MENOS10' })).json;
  await t.call('POST', '/api/webhooks/wompi', wompiEvent({ id: 'T-9', status: 'APPROVED', amount_in_cents: o.order.total * 100, reference: o.checkout.reference, currency: 'COP' }));
  await processInvoices(t.app.db);
  const inv = (await t.A('GET', '/api/admin/invoices')).json.invoices[0];
  const d = (await t.A('GET', `/api/admin/invoices/${inv.id}`)).json.document;
  assert.equal(d.totals.total, o.order.total);
  assert.equal(d.totals.discount, 10000);
  assert.deepEqual(d.taxes.map(x => x.rate), [0, 19]);
  const l19 = d.lines.find(l => l.taxRate === 19 && l.description.startsWith('Camiseta'));
  assert.equal(l19.base + l19.tax, l19.total);
  assert.equal(d.lines.reduce((a, l) => a + l.total, 0), o.order.total);
  await t.close();
});

test('retorno de Wompi redirige al pedido con la transacción', async () => {
  const t = await boot();
  const res = await fetch(t.app.server.address() ? `http://127.0.0.1:${t.app.server.address().port}/pago/retorno?o=1001&t=abc_DEF-1&id=T-77` : '', { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/#/pedido/1001?t=abc_DEF-1&tx=T-77');
  const evil = await fetch(`http://127.0.0.1:${t.app.server.address().port}/pago/retorno?o=1&t=%3Cscript%3E&id=x`, { redirect: 'manual' });
  assert.equal(evil.headers.get('location'), '/#/pedido/1?t=3Cscript3E&tx=x');
  await t.close();
});

test('sirve la interfaz, el módulo de precios y no permite salir de la carpeta pública', async () => {
  const t = await boot();
  const base = `http://127.0.0.1:${t.app.server.address().port}`;
  assert.equal((await fetch(base + '/')).status, 200);
  assert.match(await (await fetch(base + '/shared/pricing.js')).text(), /export function quote/);
  assert.equal((await fetch(base + '/..%2f..%2fpackage.json')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e/src/config.js')).status, 404);
  assert.equal((await fetch(base + '/api/nope')).status, 404);
  await t.close();
});

test('pasarela simulada: aprobado, rechazado y pendiente recorren el mismo flujo que una pasarela real', async () => {
  const t = await setup({ config: { paymentMode: 'demo', wompiPublicKey: '', wompiIntegritySecret: '', wompiEventsSecret: '' } });
  await t.A('PUT', '/api/admin/fiscal', { enabled: true, nit: '900123456', dv: '7', legalName: 'X SAS', address: 'Calle 1', cityName: 'Medellín', cityCode: '05001' });
  assert.equal((await t.call('GET', '/api/store')).json.store.paymentMode, 'demo');
  assert.equal((await t.call('GET', '/api/store')).json.store.pay.online, true, 'el pago en línea simulado está disponible sin llaves');

  const o = (await t.order()).json;
  assert.equal(o.checkout.simulated, true);
  assert.match(o.checkout.url, /#\/pago-demo\/\d+\?t=/);
  const url = `/api/demo/payment/${o.order.id}?t=${o.order.token}`;
  assert.equal((await t.call('GET', url)).json.attempt.status, 'CREATED');
  assert.equal((await t.call('GET', `/api/demo/payment/${o.order.id}?t=otro`)).status, 404, 'sin token válido no se ve el pedido');

  // rechazado: sigue pendiente y se puede intentar otra vez
  assert.equal((await t.call('POST', url, { outcome: 'declined', method: 'card' })).json.order.status, 'pending');
  assert.equal((await t.call('POST', url, { outcome: 'approved', method: 'card' })).status, 409, 'un intento rechazado está cerrado');
  const again = (await t.call('POST', `/api/orders/${o.order.id}/pay?t=${o.order.token}`, {})).json;
  assert.equal(again.checkout.simulated, true);

  // pendiente (PSE) y luego aprobado
  assert.equal((await t.call('POST', url, { outcome: 'pending', method: 'pse' })).json.order.status, 'pending');
  const reuse = (await t.call('POST', `/api/orders/${o.order.id}/pay?t=${o.order.token}`, {})).json;
  assert.equal(reuse.checkout.reference, again.checkout.reference, 'un intento pendiente se reutiliza');
  const ok = await t.call('POST', url, { outcome: 'approved', method: 'pse' });
  assert.equal(ok.json.order.status, 'paid');
  assert.equal((await t.call('POST', url, { outcome: 'approved' })).status, 409, 'no se paga dos veces');
  assert.equal((await t.call('POST', url, { outcome: 'raro' })).status, 400);

  const adm = (await t.A('GET', `/api/admin/orders/${o.order.id}`)).json.order;
  assert.equal(adm.invoice.status, 'queued', 'el pago simulado genera la factura igual que uno real');
  assert.deepEqual(adm.payments.map(p => p.status), ['DECLINED', 'APPROVED']);
  assert.equal((await t.call('POST', '/api/webhooks/wompi', {})).status, 404, 'el webhook de Wompi no existe en modo demo');
  await t.close();
});

test('en modo Wompi la pasarela simulada no existe', async () => {
  const t = await setup();
  const o = (await t.order()).json;
  assert.equal((await t.call('GET', `/api/demo/payment/${o.order.id}?t=${o.order.token}`)).status, 404);
  assert.equal((await t.call('POST', `/api/demo/payment/${o.order.id}?t=${o.order.token}`, { outcome: 'approved' })).status, 404);
  await t.close();
});

const emailsOf = async (t, ck) => (await t.call('GET', '/api/admin/emails', undefined, { cookies: ck })).json.emails;

test('correos transaccionales: pedido, pago, envío, entrega y cancelación quedan en el buzón de salida', async () => {
  const t = await setup({ config: { paymentMode: 'demo' } });
  const o = (await t.order()).json;
  let mails = await emailsOf(t, t.adminCookie);
  assert.deepEqual(mails.map(m => m.kind), ['order_created']);
  assert.equal(mails[0].to, 'vale@correo.com');
  assert.equal(mails[0].status, 'sent');
  assert.equal(mails[0].transport, 'outbox');
  const detail = (await t.A('GET', `/api/admin/emails/${mails[0].id}`)).json.email;
  assert.match(detail.text, new RegExp(`#/pedido/${o.order.id}\\?t=${o.order.token}`), 'el correo trae el enlace seguro del pedido');
  assert.match(detail.text, /\$72\.000/);

  const url = `/api/demo/payment/${o.order.id}?t=${o.order.token}`;
  await t.call('POST', url, { outcome: 'approved', method: 'card' });
  for (let i = 0; i < 2; i++) await t.A('POST', `/api/admin/orders/${o.order.id}/action`, { action: 'advance' }); // preparando, enviado
  await t.A('POST', `/api/admin/orders/${o.order.id}/action`, { action: 'advance' }); // entregado
  mails = await emailsOf(t, t.adminCookie);
  assert.deepEqual(mails.map(m => m.kind).reverse(), ['order_created', 'payment_confirmed', 'order_shipped', 'order_delivered']);

  const o2 = (await t.order({ buyer: buyer({ email: 'otra@correo.com' }) })).json;
  await t.A('POST', `/api/admin/orders/${o2.order.id}/action`, { action: 'cancel' });
  assert.equal((await emailsOf(t, t.adminCookie))[0].kind, 'order_cancelled');
  assert.equal((await t.call('GET', '/api/admin/emails')).status, 401, 'el buzón es solo del administrador');
  await t.close();
});

test('un correo con HTML en el nombre no inyecta código', async () => {
  const t = await setup({ config: { paymentMode: 'demo' } });
  await t.order({ buyer: buyer({ name: '<img src=x onerror=alert(1)> Ana' }) });
  const m = (await emailsOf(t, t.adminCookie))[0];
  const row = t.app.db.prepare('SELECT html_body FROM emails WHERE id = ?').get(m.id);
  assert.equal(row.html_body.includes('<img src=x'), false);
  assert.match(row.html_body, /Hola, &lt;img\./);
  await t.close();
});

test('recuperación de contraseña: enlace de un solo uso, sin revelar cuentas y cierra sesiones', async () => {
  const t = await setup({ config: { paymentMode: 'demo' } });
  const reg = await t.call('POST', '/api/auth/register', { email: 'ana@correo.com', name: 'Ana Pérez', password: 'clave-vieja-1' });
  const oldCookie = t.cookieOf(reg);
  assert.equal((await emailsOf(t, t.adminCookie))[0].kind, 'welcome');

  const unknown = await t.call('POST', '/api/auth/forgot', { email: 'nadie@correo.com' });
  const known = await t.call('POST', '/api/auth/forgot', { email: 'ANA@correo.com' });
  assert.deepEqual(unknown.json, known.json, 'misma respuesta exista o no la cuenta');
  const resets = (await emailsOf(t, t.adminCookie)).filter(m => m.kind === 'password_reset');
  assert.equal(resets.length, 1);
  const body = (await t.A('GET', `/api/admin/emails/${resets[0].id}`)).json.email.text;
  const token = /token=([\w-]+)/.exec(body)[1];

  assert.equal((await t.call('POST', '/api/auth/reset', { token: 'falso', password: 'clave-nueva-1' })).status, 400);
  assert.equal((await t.call('POST', '/api/auth/reset', { token, password: 'corta' })).status, 400);
  assert.equal((await t.call('POST', '/api/auth/reset', { token, password: 'clave-nueva-1' })).status, 200);
  assert.equal((await t.call('POST', '/api/auth/reset', { token, password: 'otra-clave-22' })).status, 400, 'el enlace sirve una sola vez');
  assert.equal((await t.call('GET', '/api/me', undefined, { cookies: oldCookie })).json.me, null, 'la sesión anterior se cerró');
  assert.equal((await t.call('POST', '/api/auth/login', { email: 'ana@correo.com', password: 'clave-vieja-1' })).status, 401);
  assert.equal((await t.call('POST', '/api/auth/login', { email: 'ana@correo.com', password: 'clave-nueva-1' })).status, 200);

  // enlace vencido
  await t.call('POST', '/api/auth/forgot', { email: 'ana@correo.com' });
  const m2 = (await emailsOf(t, t.adminCookie)).find(m => m.kind === 'password_reset');
  const tok2 = /token=([\w-]+)/.exec((await t.A('GET', `/api/admin/emails/${m2.id}`)).json.email.text)[1];
  t.app.db.prepare('UPDATE password_resets SET expires_at = ?').run(new Date(Date.now() - 1000).toISOString());
  assert.equal((await t.call('POST', '/api/auth/reset', { token: tok2, password: 'clave-nueva-2' })).status, 400);
  await t.close();
});

test('tema visual: se guarda por tienda, llega a la tienda pública y rechaza valores desconocidos', async () => {
  const t = await setup();
  assert.equal((await t.call('GET', '/api/store')).json.store.theme, 'clasico');
  assert.equal((await t.A('PUT', '/api/admin/settings', { theme: 'neon' })).status, 400);
  assert.equal((await t.A('PUT', '/api/admin/settings', { theme: 'fantasia' })).status, 200);
  assert.equal((await t.call('GET', '/api/store')).json.store.theme, 'fantasia');
  assert.equal((await t.A('POST', '/api/admin/products', { name: 'Espada', cat: 'Armas', price: 100000, stock: 1, status: 'active', kind: 'sword' })).json.product.kind, 'sword');
  await t.close();
});
