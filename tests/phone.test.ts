import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contactDetailsFrom, contactPayloadFrom } from '../src/lib/phone.ts';

test('a missing phone produces no payload', () => {
  assert.equal(contactPayloadFrom(undefined), '');
  assert.equal(contactPayloadFrom('   '), '');
  assert.equal(contactPayloadFrom('123'), '');
});

test('a UK mobile becomes a reversed payload and not the raw digits in source form', () => {
  const payload = contactPayloadFrom('07700900123');
  const details = JSON.parse(atob(payload).split('').reverse().join(''));
  assert.equal(details.t, '+447700900123');
  assert.equal(details.d, '07700 900123');
  assert.match(details.w, /^https:\/\/wa\.me\/447700900123\?/);
  assert.equal(contactDetailsFrom('+447700900123')?.t, '+447700900123');
});
