import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contactDetailsFrom, contactPayloadFrom } from '../src/lib/phone.ts';
// Privacy guard for held photographs (owner portraits, unidentified sets): runs with `npm run check` via this import.
import './held-images.test.ts';

// 07700 900000 is in Ofcom's reserved drama range. It is not a real number.
const FAKE = '07700 900000';

test('a missing or malformed SITE_PHONE produces no payload', () => {
  assert.equal(contactPayloadFrom(undefined), '');
  assert.equal(contactPayloadFrom(''), '');
  assert.equal(contactPayloadFrom('   '), '');
  assert.equal(contactPayloadFrom('123'), '');
  assert.equal(contactDetailsFrom('call me'), null);
});

test('a UK mobile becomes tel, display and WhatsApp forms, and the payload does not hold the digits in clear', () => {
  const details = contactDetailsFrom(FAKE);
  assert.deepEqual(details, {
    t: '+447700900000',
    d: '07700 900000',
    w: "https://wa.me/447700900000?text=Hello%2C%20I'd%20like%20to%20ask%20about%20wallcovering.",
  });
  const payload = contactPayloadFrom(FAKE);
  assert.doesNotMatch(payload, /7700|900000/);
  assert.deepEqual(JSON.parse(atob(payload).split('').reverse().join('')), details);
});

test('international and bare-digit forms normalise to the same E.164 number', () => {
  assert.equal(contactDetailsFrom('+44 7700 900000')?.t, '+447700900000');
  assert.equal(contactDetailsFrom('447700900000')?.t, '+447700900000');
  assert.equal(contactDetailsFrom('+447700900000')?.d, '07700 900000');
});
