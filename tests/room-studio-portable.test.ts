import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPortableJson, portableJsonBytes, serializePortableJson, PORTABLE_DOCUMENT_BUDGET_BYTES, PORTABLE_PROJECT_MAX_BYTES } from '../src/room-studio/portable.ts';

test('portable estimator matches actual compact UTF-8, including repeated art, escaping and revision wrappers', () => {
  const dataUrl = 'data:image/png;base64,' + 'A'.repeat(300000);
  const value = { name: 'Limewash 🌿 / “é”\n', absent: undefined, dimensions: [0, -0, 0.1, 1e-7, Infinity, , NaN], panels: [1, 2, 3].map(number => ({ number, dataUrl })), comparisons: Array.from({ length: 8 }, () => ({ dataUrl })) };
  assert.equal(portableJsonBytes(value), new TextEncoder().encode(JSON.stringify(value)).byteLength);
  assert.equal(portableJsonBytes({ project: value, createdAt: '2026-10-19', id: 'revision' }), new TextEncoder().encode(serializePortableJson({ project: value, createdAt: '2026-10-19', id: 'revision' })).byteLength);
  assert.throws(() => assertPortableJson(value, 1000000), /previous project is unchanged/);
  assert.ok(PORTABLE_PROJECT_MAX_BYTES - PORTABLE_DOCUMENT_BUDGET_BYTES >= 16384);
});
test('server metadata can budget all repeated embedded sources before downloading their bytes', () => {
  const asset = { id: 'one', sha256: 'hash', mime: 'image/png', widthPx: 2, heightPx: 2 };
  const metadata = { sources: [asset, asset], comparison: { source: asset } };
  const full = { sources: [{ ...asset, dataUrl: 'data:image/png;base64,AAAA' }, { ...asset, dataUrl: 'data:image/png;base64,AAAA' }], comparison: { source: { ...asset, dataUrl: 'data:image/png;base64,AAAA' } } };
  assert.equal(portableJsonBytes(metadata, new Map([['hash', 3]])), portableJsonBytes(full));
  const cycle: unknown[] = []; cycle.push(cycle); assert.throws(() => portableJsonBytes(cycle), /circular/);
});
