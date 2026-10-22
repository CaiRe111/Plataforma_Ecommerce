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
  await A('PUT', '/api/admin/settings', { name: 'Taller Norte', pay: { wompi: true, transfer: true, cod: true }, shipping: { flat: 12000, freeFrom: 250000 }, transferInstructions: 'Cuenta 000-111' });
  const mk = async (o) => (await A('POST', '/api/admin/products', { name: 'Camiseta', cat: 'Camisetas', price: 60000, stock: 5, status: 'active', options: [{ name: 'Talla', values: ['S', 'M'] }], ...o })).json.product;
  t.mk = mk;
  t.product = await mk({});
  t.order = (o = {}, cookies = '') => t.call('POST', '/api/orders', { items: [{ pid: t.product.id, qty: 1, opts: { Talla: 'M' } }], buyer: buyer(), method: 'wompi', ...o }, { cookies });
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
  assert.equal(s.store.pay.wompi, true);
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
