import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
// @ts-expect-error plain ESM module without types
import { DOC_PATH, evaluate, readTokens, render } from '../scripts/contrast-record.mjs';

/**
 * The contrast record and the tokens are one dataset. Every text/background
 * pair the shipped CSS produces is in scripts/contrast-record.mjs; this test
 * holds the used pairs to WCAG 2.2 AA (4.5:1 body, 3:1 large text and UI),
 * holds the forbidden pairs to failing (so the "never gold on ivory" rule is a
 * measurement, not a memory), and keeps docs/glass-atelier/CONTRAST.md current.
 */
type Result = { id: string; status: string; ratio: number; needs: number; passes: boolean; ok: boolean; size: string };

const tokens = readTokens() as Map<string, string>;
const results = evaluate(tokens) as Result[];

test('the six palette tokens from contract section 6 are the ones in tokens.css', () => {
  assert.equal(tokens.get('color-ink'), '#141210');
  assert.equal(tokens.get('color-ivory'), '#f4f0e8');
  assert.equal(tokens.get('color-paper'), '#f7f4ee');
  assert.equal(tokens.get('color-brass'), '#6b542f');
  assert.equal(tokens.get('color-gold'), '#c6a36a');
  assert.equal(tokens.get('color-stone'), '#4e4942');
  for (const name of ['dur-control', 'dur-panel', 'dur-media', 'text-display', 'text-body', 'text-eyebrow', 'radius-control', 'radius-pill', 'content-max', 'glass-champagne-blur', 'glass-smoked-blur', 'glass-clear-blur']) {
    assert.ok(tokens.has(name), `token ${name}`);
  }
  // Motion tokens inside the brief's ranges: controls 150 to 250ms, panels 300 to 500ms, media 500 to 800ms.
  const ms = (name: string) => Number(tokens.get(name)!.replace('ms', ''));
  assert.ok(ms('dur-control') >= 150 && ms('dur-control') <= 250);
  assert.ok(ms('dur-panel') >= 300 && ms('dur-panel') <= 500);
  assert.ok(ms('dur-media') >= 500 && ms('dur-media') <= 800);
  // Blur: every variant within the brief's 16 to 24px.
  const px = (name: string) => Number(tokens.get(name)!.replace('px', ''));
  for (const name of ['glass-champagne-blur', 'glass-smoked-blur', 'glass-clear-blur']) assert.ok(px(name) >= 16 && px(name) <= 24, name);
});

test('every used text/background pair meets WCAG 2.2 AA, worst-case backdrop included', () => {
  const failing = results.filter((r) => r.status === 'used' && !r.passes).map((r) => `${r.id} ${r.ratio.toFixed(2)}:1 needs ${r.needs}:1`);
  assert.deepEqual(failing, []);
  assert.ok(results.filter((r) => r.status === 'used').length >= 25);
});

test('gold is never body text on a light surface, and the other forbidden pairs really fail', () => {
  const ids = results.map((r) => r.id);
  for (const id of ['gold/ivory', 'gold/paper', 'gold/champagne']) assert.ok(ids.includes(id), id);
  const stale = results.filter((r) => r.status === 'forbidden' && r.passes).map((r) => `${r.id} now passes at ${r.ratio.toFixed(2)}:1; update the record`);
  assert.deepEqual(stale, []);
  for (const r of results) assert.ok(['used', 'forbidden', 'noted'].includes(r.status), r.id);
});

test('docs/glass-atelier/CONTRAST.md is generated from the same data and is current', async () => {
  const committed = await readFile(DOC_PATH as string, 'utf8');
  assert.equal(committed, render(results), 'run: node scripts/contrast-record.mjs --write');
});
