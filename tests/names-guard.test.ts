import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matches, parseList } from '../scripts/names-guard.mjs';

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
