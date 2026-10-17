import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { looksLikeText, matches, parseList, readText } from '../scripts/names-guard.mjs';

// The real list is private (see scripts/names-guard.mjs). These tests use made-up names only.
const list = parseList(['# comment', '', 'Example Interiors', 'Ålpha & Beta Decorating', 're:\\bsample\\s+academy\\b', 'Solo'].join('\n'));

test('the names list numbers real entries only', () => {
  assert.deepEqual(list.map((entry: { n: number }) => entry.n), [1, 2, 3, 4]);
});

test('a name is found however it is written', () => {
  for (const text of [
    '<p>Hung by Example Interiors.</p>',
    'EXAMPLE-INTERIORS',
    'https://www.example-interiors.com/pricing',
    'exampleinteriors.co.uk',
    '<a>Example <em>Interiors</em></a>',
    'Example&nbsp;Interiors',
    '/search/?q=example%20interiors',
  ]) assert.deepEqual(matches(list, text), [1], text);
  assert.deepEqual(matches(list, 'Alpha and Beta decorating'), [2]);
  assert.deepEqual(matches(list, 'alpha &amp; beta decorating'), [2]);
  assert.deepEqual(matches(list, 'The Sample  Academy course'), [3]);
});

test('whole words only, so longer words that contain a name pass', () => {
  assert.deepEqual(matches(list, 'Examples of interiors; soloist; solomon'), []);
  assert.deepEqual(matches(list, 'a solo hang'), [4]);
});

test('a malformed pattern stops the guard with its entry number, never the pattern', () => {
  assert.throws(
    () => parseList('Example Interiors\nre:(made-up-secret'),
    (error: Error) => /entry 2\b/.test(error.message) && !error.message.includes('made-up-secret') && !(error.stack ?? '').includes('made-up-secret'),
  );
});

test('text is found by content, so files without a known extension are read too', () => {
  assert.equal(looksLikeText(Buffer.from('www.example.com\n')), true);
  assert.equal(looksLikeText(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])), false);
  const dir = mkdtempSync(path.join(tmpdir(), 'names-guard-'));
  writeFileSync(path.join(dir, 'CNAME'), 'Hung by Example Interiors\n');
  writeFileSync(path.join(dir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]));
  assert.deepEqual(matches(list, readText(path.join(dir, 'CNAME')) ?? ''), [1]);
  assert.equal(readText(path.join(dir, 'image.png')), null);
});
