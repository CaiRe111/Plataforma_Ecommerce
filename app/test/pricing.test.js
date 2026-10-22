import test from 'node:test';
import assert from 'node:assert/strict';
import { priceInfo, quote, roundCop } from '../src/shared/pricing.js';

const P = (o = {}) => ({ id: 'a', cat: 'Camisetas', price: 60000, compare: null, digital: false, ...o });
const cfg = (promos = []) => ({ promos, loyalty: { discount: 8, freeShipping: true }, shipping: { flat: 12000, freeFrom: 250000 }, fmt: n => '$' + n });
const promo = o => ({ id: 'r', kind: 'percent', value: 15, scope: 'all', code: '', audience: 'all', min: 0, ends: null, active: true, ...o });

test('redondeo a 100 pesos', () => { assert.equal(roundCop(50950), 51000); assert.equal(roundCop(50949), 50900); });

test('promoción automática reemplaza al precio y conserva el original', () => {
  const i = priceInfo([promo({ scope: 'Camisetas' })], P());
  assert.deepEqual([i.price, i.was, i.pct], [51000, 60000, 15]);
});
test('se aplica la mejor promoción y solo en su categoría', () => {
  const ps = [promo({ value: 10 }), promo({ id: 'r2', value: 20, scope: 'Camisetas' })];
  assert.equal(priceInfo(ps, P()).pct, 20);
  assert.equal(priceInfo(ps, P({ cat: 'Otra' })).pct, 10);
});
test('promoción de clientes fieles solo cuenta para ellos', () => {
  const ps = [promo({ audience: 'fiel' })];
  assert.equal(priceInfo(ps, P()).pct, 0);
  assert.equal(priceInfo(ps, P(), { fiel: true }).pct, 15);
});
test('promoción vencida o pausada no se aplica', () => {
  assert.equal(priceInfo([promo({ ends: '2020-01-01T00:00:00Z' })], P()).pct, 0);
  assert.equal(priceInfo([promo({ active: false })], P()).pct, 0);
});
test('precio anterior se muestra como oferta sin promoción', () => {
  assert.equal(priceInfo([], P({ compare: 80000 })).pct, 25);
});

test('cotización normal: subtotal más envío', () => {
  const q = quote(cfg(), [{ p: P(), qty: 2 }]);
  assert.deepEqual([q.subtotal, q.shipping, q.total], [120000, 12000, 132000]);
});
test('envío gratis al llegar al mínimo', () => {
  assert.equal(quote(cfg(), [{ p: P({ price: 260000 }), qty: 1 }]).shipping, 0);
});
test('cliente fiel: descuento y envío gratis', () => {
  const q = quote(cfg(), [{ p: P(), qty: 1 }], { fiel: true });
  assert.deepEqual([q.loyalty, q.shipping, q.total], [4800, 0, 55200]);
});
test('cupón de porcentaje solo sobre su categoría', () => {
  const ps = [promo({ code: 'CAMI10', value: 10, scope: 'Camisetas' })];
  const q = quote(cfg(ps), [{ p: P(), qty: 1 }, { p: P({ id: 'b', cat: 'Otra', price: 40000 }), qty: 1 }], { couponCode: 'cami10' });
  assert.equal(q.couponDiscount, 6000);
});
test('cupón con mínimo, de clientes fieles o inexistente devuelve nota y no descuenta', () => {
  const ps = [promo({ code: 'MIN', kind: 'fixed', value: 30000, min: 200000 }), promo({ id: 'f', code: 'FIEL', audience: 'fiel' })];
  assert.match(quote(cfg(ps), [{ p: P(), qty: 1 }], { couponCode: 'MIN' }).note, /compra mínima/);
  assert.match(quote(cfg(ps), [{ p: P(), qty: 1 }], { couponCode: 'FIEL' }).note, /clientes fieles/);
  assert.match(quote(cfg(ps), [{ p: P(), qty: 1 }], { couponCode: 'NOPE' }).note, /no existe/);
  assert.equal(quote(cfg(ps), [{ p: P(), qty: 1 }], { couponCode: 'MIN' }).couponDiscount, 0);
});
test('cupón de monto fijo cuando se cumple el mínimo', () => {
  const ps = [promo({ code: 'MIN', kind: 'fixed', value: 30000, min: 100000 })];
  const q = quote(cfg(ps), [{ p: P(), qty: 2 }], { couponCode: 'MIN' });
  assert.equal(q.couponDiscount, 30000);
  assert.equal(q.total, 120000 - 30000 + 12000);
});
test('productos digitales no pagan envío', () => {
  assert.equal(quote(cfg(), [{ p: P({ digital: true }), qty: 1 }]).shipping, 0);
});
test('promoción de envío gratis automática', () => {
  const ps = [promo({ kind: 'shipping', min: 50000 })];
  assert.equal(quote(cfg(ps), [{ p: P(), qty: 1 }]).shipping, 0);
});
