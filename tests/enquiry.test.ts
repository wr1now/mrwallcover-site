import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyEnquiry, makeReference, sanitiseEvent, validateEnquiry } from '../src/lib/enquiry.ts';
import { prepareUpload, sniffType, stripJpegMetadata } from '../src/lib/files.ts';

function fields(partial: Parameters<typeof emptyEnquiry>[0]) {
  return emptyEnquiry(partial);
}

test('email alone is enough', () => {
  const result = validateEnquiry(fields({ name: 'Ada', replyBy: 'email', email: 'ada@example.com', message: 'One bedroom, paper already bought.' }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.phone, '');
});

test('phone alone is enough', () => {
  const result = validateEnquiry(fields({ name: 'Ada', replyBy: 'phone', phone: '07450 000000', message: 'Please call about a repair.' }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.email, '');
});

test('requires one reply method and a note', () => {
  const missing = validateEnquiry(fields({ name: 'Ada', message: 'Hello there friend' }));
  assert.equal(missing.ok, false);
  const emptyNote = validateEnquiry(fields({ name: 'Ada', replyBy: 'email', email: 'ada@example.com', message: 'Hi' }));
  assert.equal(emptyNote.ok, false);
});

test('honeypot is spam and marketing defaults off', () => {
  const spam = validateEnquiry(fields({ honeypot: 'bot', name: 'Ada', replyBy: 'email', email: 'a@b.co', message: 'Hello there friend' }));
  assert.equal(spam.ok, false);
  if (spam.ok) return;
  assert.equal(spam.spam, true);
  const clean = validateEnquiry(fields({ name: 'Ada', replyBy: 'email', email: 'ada@example.com', message: 'A sitting room in Mayfair.' }));
  assert.equal(clean.ok, true);
  if (!clean.ok) return;
  assert.equal(clean.value.marketing, false);
});

test('aftercare is a distinct kind and keeps an optional project reference', () => {
  const result = validateEnquiry(fields({
    kind: 'aftercare',
    name: 'Ada',
    replyBy: 'email',
    email: 'ada@example.com',
    message: 'A seam has lifted in the corridor.',
    projectReference: 'MW-OLDREF',
  }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.kind, 'aftercare');
  assert.equal(result.value.intent, 'aftercare');
  assert.equal(result.value.projectReference, 'MW-OLDREF');
});

test('reference is non-guessable and stable for a given seed', () => {
  const reference = makeReference(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  assert.match(reference, /^MW-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
  assert.equal(makeReference(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), reference);
});

test('analytics sanitiser drops enquiry text', () => {
  const clean = sanitiseEvent({
    event: 'enquiry_received',
    name: 'Ada',
    email: 'ada@example.com',
    message: 'The whole brief',
    kind: 'aftercare',
    step: 2,
  });
  assert.deepEqual(clean, { event: 'enquiry_received', kind: 'aftercare', step: 2 });
});

test('jpeg GPS marker is stripped and a text file is rejected', () => {
  const jpeg = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, 0x00, 0x08, 0x47, 0x50, 0x53, 0x31, 0x00, 0x00,
    0xff, 0xda, 0x00, 0x02, 0xff, 0xd9,
  ]);
  assert.equal(sniffType(jpeg), 'jpeg');
  const stripped = stripJpegMetadata(jpeg);
  assert.equal(Buffer.from(stripped).includes(Buffer.from('GPS')), false);
  const prepared = prepareUpload(jpeg);
  assert.equal(prepared.metadata, 'stripped');
  const text = prepareUpload(new TextEncoder().encode('<html>not a photo</html>'));
  assert.equal(text.metadata, 'rejected');
});

test('heic brand is recognised', () => {
  const bytes = new Uint8Array(16);
  bytes.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 0);
  assert.equal(sniffType(bytes), 'heic');
  assert.equal(prepareUpload(bytes).metadata, 'stored');
});
