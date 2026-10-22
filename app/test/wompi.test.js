import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { integritySignature, verifyEventChecksum } from '../src/payments/wompi.js';
import { wompiEvent } from './helpers.js';

const sha = s => crypto.createHash('sha256').update(s).digest('hex');

test('firma de integridad = SHA-256(referencia + centavos + moneda + secreto)', () => {
  assert.equal(integritySignature('REF-1', 5000000, 'COP', 'sec'), sha('REF-15000000COPsec'));
});

const tx = { id: 'T-1', status: 'APPROVED', amount_in_cents: 5000000, reference: 'REF-1', currency: 'COP' };

test('checksum de evento válido', () => {
  const ev = wompiEvent(tx);
  assert.equal(verifyEventChecksum(ev, 'test_events_secret'), true);
  assert.equal(verifyEventChecksum(ev, 'test_events_secret', ev.signature.checksum), true);
});
test('rechaza secreto distinto, datos alterados y firma ausente', () => {
  const ev = wompiEvent(tx);
  assert.equal(verifyEventChecksum(ev, 'otro'), false);
  const tampered = structuredClone(ev); tampered.data.transaction.status = 'DECLINED';
  assert.equal(verifyEventChecksum(tampered, 'test_events_secret'), false);
  const noSig = structuredClone(ev); delete noSig.signature;
  assert.equal(verifyEventChecksum(noSig, 'test_events_secret'), false);
  assert.equal(verifyEventChecksum(ev, 'test_events_secret', 'deadbeef'), false);
});
test('el orden de signature.properties se respeta', () => {
  const ev = wompiEvent(tx);
  ev.signature.properties = ['transaction.status', 'transaction.id', 'transaction.amount_in_cents'];
  assert.equal(verifyEventChecksum(ev, 'test_events_secret'), false);
});
