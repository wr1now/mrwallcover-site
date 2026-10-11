import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contactDetailsFrom, contactPayloadFrom, WHATSAPP_MESSAGE } from '../src/lib/phone.ts';
import { bookingUrlFrom, resolveBookingUrl } from '../src/lib/booking.ts';
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
    w: 'https://wa.me/447700900000?text=Hello%20Mr%20Wallcover%2C%20I%27d%20like%20to%20discuss%20a%20project%3A',
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

test('the WhatsApp link is wa.me with the digits only (no +, no leading 0) and the whole message percent-encoded', () => {
  for (const raw of ['07700 900000', '+44 7700 900000', '447700900000']) {
    const w = contactDetailsFrom(raw)!.w;
    const url = new URL(w);
    assert.equal(url.origin + url.pathname, 'https://wa.me/447700900000');
    assert.equal(url.searchParams.get('text'), WHATSAPP_MESSAGE);
    assert.equal(WHATSAPP_MESSAGE, "Hello Mr Wallcover, I'd like to discuss a project:");
    assert.doesNotMatch(w.split('?text=')[1], /[ ',:]/, 'no raw space, comma, colon or apostrophe');
  }
});

test('the booking URL: https only, empty hides it, and the BOOKING_URL variable (even empty) overrides the file', () => {
  assert.equal(bookingUrlFrom(''), '');
  assert.equal(bookingUrlFrom('   '), '');
  assert.equal(bookingUrlFrom('http://calendar.app.google/x'), '');
  assert.equal(bookingUrlFrom('javascript:alert(1)'), '');
  assert.equal(bookingUrlFrom('not a url'), '');
  assert.equal(bookingUrlFrom(' https://calendar.app.google/x '), 'https://calendar.app.google/x');
  assert.equal(resolveBookingUrl('https://calendar.app.google/file', {}), 'https://calendar.app.google/file');
  assert.equal(resolveBookingUrl('https://calendar.app.google/file', { BOOKING_URL: '' }), '');
  assert.equal(resolveBookingUrl('', { BOOKING_URL: 'https://example.test/fixture' }), 'https://example.test/fixture');
});
