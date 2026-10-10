import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachmentLimits, validateAttachments, type EnquiryAttachment } from '../src/lib/enquiry-attachments.ts';
import { FILE_LIMITS } from '../src/lib/enquiry.ts';

const file = (partial: Partial<EnquiryAttachment> = {}): EnquiryAttachment => ({ name: 'wall.jpg', type: 'image/jpeg', size: 100, ...partial });

test('attachments remain optional and eight files are allowed; nine are rejected without changing the selection', () => {
  assert.equal(validateAttachments([], 'formsubmit'), null);
  const files = Array.from({ length: 8 }, () => file());
  assert.equal(validateAttachments(files, 'formsubmit'), null);
  const nine = [...files, file()];
  assert.match(validateAttachments(nine, 'formsubmit') || '', /no more than 8/);
  assert.equal(nine.length, 9);
});

test('FormSubmit combined size accepts 10 MB exactly and rejects one byte more', () => {
  assert.equal(validateAttachments([file({ size: 5_000_000 }), file({ size: 5_000_000 })], 'formsubmit'), null);
  assert.match(validateAttachments([file({ size: 5_000_000 }), file({ size: 5_000_001 })], 'formsubmit') || '', /10 MB/);
  assert.match(validateAttachments([file({ size: 10_000_001 })], 'formsubmit') || '', /10 MB/);
  assert.equal(attachmentLimits('formsubmit').maxTotalBytes, 10_000_000);
});

test('private API retains its distinct per-file and total-byte limits', () => {
  assert.equal(attachmentLimits('lead-api').maxFileBytes, FILE_LIMITS.maxFileBytes);
  assert.equal(attachmentLimits('lead-api').maxTotalBytes, FILE_LIMITS.maxTotalBytes);
  const max = file({ size: FILE_LIMITS.maxFileBytes });
  assert.equal(validateAttachments([max, max, max], 'lead-api'), null);
  assert.match(validateAttachments([file({ size: FILE_LIMITS.maxFileBytes + 1 })], 'lead-api') || '', /12 MiB/);
  assert.match(validateAttachments([max, max, max, file({ size: 1 })], 'lead-api') || '', /36 MiB/);
});

test('supported extensions and MIME types include browser HEIC and uppercase filename variations', () => {
  for (const [name, type] of [
    ['wall.JPEG', 'image/jpeg'], ['wall.png', 'image/png'], ['wall.webp', 'image/webp'],
    ['wall.HEIC', ''], ['wall.heif', 'application/octet-stream'], ['wall.heic', 'image/heif'],
    ['drawing.pdf', 'application/pdf'],
  ]) assert.equal(validateAttachments([file({ name, type })], 'formsubmit'), null, name);
});

test('unsupported, mismatched, empty and malformed attachments are rejected', () => {
  for (const partial of [
    { name: 'wall.svg', type: 'image/svg+xml' },
    { name: 'wall.jpg.exe', type: 'image/jpeg' },
    { name: 'wall.jpg', type: 'text/html' },
    { name: 'wall.__proto__', type: '' },
    { name: 'pdf', type: 'application/pdf' },
    { size: 0 }, { size: -1 }, { size: Number.NaN }, { size: Number.POSITIVE_INFINITY },
  ]) assert.ok(validateAttachments([file(partial)], 'formsubmit'), JSON.stringify(partial));
});
