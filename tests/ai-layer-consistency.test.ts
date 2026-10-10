import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/**
 * The two AI layers must agree on the shared facts:
 *   ours   /projects.json, /.well-known/facts.json, /for-ai/, /llms.txt (src/lib/ai-layer-data.ts)
 *   Codex  /ai/business.json, /ai/decision-guide.json, /ai/projects.json (src/lib/ai-crawler.ts)
 * This test only reads both; it never fixes either side. A mismatch fails with
 * the exact difference. A mismatch known today is a named, skipped assertion
 * so the rest stays enforced.
 */

const read = (file: string) => readFile(file, 'utf8');
const json = async <T = any>(file: string): Promise<T> => JSON.parse(await read(file)) as T;
const AWARD_TEXT = 'Award-winning (2021): Most Outstanding for Wallcovering Installation, BUILD Magazine 2021 Design & Build Awards';

function diff(a: string[], b: string[]) {
  return { onlyInProjectsJson: a.filter((x) => !b.includes(x)), onlyInAiProjectsJson: b.filter((x) => !a.includes(x)) };
}

test('since 2012: both layers state the same start year', async () => {
  const ours = await json<{ inTradeSince: number }>('dist/.well-known/facts.json');
  const business = await read('dist/ai/business.json');
  const crawler = await read('dist/wallcovering-installation-ai-crawler/index.html');
  assert.equal(ours.inTradeSince, 2012);
  assert.ok(business.includes('since 2012'), '/ai/business.json does not say "since 2012"');
  assert.ok(crawler.includes('since 2012'), '/wallcovering-installation-ai-crawler/ does not say "since 2012"');
  for (const [name, text] of [['/ai/business.json', business], ['/wallcovering-installation-ai-crawler/', crawler]] as const) {
    assert.doesNotMatch(text, /since (19|20)(?!12)\d{2}/, `${name} gives another start year`);
  }
});

test('the 15–30% wastage allowance: both layers quote the same range', async () => {
  const ours = await json<{ wastageAllowance: { range: string; statement: string } }>('dist/.well-known/facts.json');
  assert.equal(ours.wastageAllowance.range, '15–30%');
  for (const file of ['dist/ai/business.json', 'dist/ai/decision-guide.json']) {
    const text = await read(file);
    assert.ok(text.includes('15–30%'), `${file} does not state 15–30%`);
    const ranges = [...text.matchAll(/(\d{1,2})\s?[–-]\s?(\d{1,2})\s?%/g)].map((m) => `${m[1]}–${m[2]}%`);
    const wastage = ranges.filter((r) => r !== '15–30%');
    // Other percentage ranges may exist for other topics; only flag one written next to "wastage".
    for (const r of wastage) assert.doesNotMatch(text, new RegExp(`wastage[^.]{0,80}${r.replace('–', '[–-]')}`, 'i'), `${file}: wastage given as ${r}`);
  }
  assert.ok(ours.wastageAllowance.statement.includes('15–30%'));
});

test('the award: our layer prints the confirmed wording exactly', async () => {
  const ours = await json<{ awardText?: string; award?: unknown }>('dist/.well-known/facts.json');
  assert.equal(ours.awardText, AWARD_TEXT, '/.well-known/facts.json awardText');
  const llms = await read('dist/llms.txt');
  assert.ok(llms.includes(AWARD_TEXT), '/llms.txt');
  const forAi = (await read('dist/for-ai/index.html')).replaceAll('&amp;', '&');
  assert.ok(forAi.includes(AWARD_TEXT), '/for-ai/');
});

test('the award wording is identical in /ai/business.json', async () => {
  const ours = await json<{ awardText?: string }>('dist/.well-known/facts.json');
  const business = await json<{ award?: string }>('dist/ai/business.json');
  assert.equal(business.award, AWARD_TEXT, '/ai/business.json award');
  assert.equal(business.award, ours.awardText, 'both layers print the same award line');
});

test('the award is never stated in a different wording in either layer', async () => {
  for (const file of ['dist/.well-known/facts.json', 'dist/ai/business.json', 'dist/ai/projects.json', 'dist/ai/decision-guide.json', 'dist/projects.json', 'dist/llms.txt']) {
    const text = await read(file);
    for (const match of text.matchAll(/Most Outstanding[^"\n]{0,120}/g)) {
      assert.ok(match[0].startsWith('Most Outstanding for Wallcovering Installation'), `${file}: "${match[0]}"`);
    }
  }
});

test('the published project list: same slugs and URLs in /projects.json and /ai/projects.json', async () => {
  const ours = (await json<{ projects: { slug: string; url: string; recordType: string }[] }>('dist/projects.json')).projects;
  const codex = (await json<{ projects: { slug: string; url: string; recordType: string }[] }>('dist/ai/projects.json')).projects;
  const slugDiff = diff(ours.map((p) => p.slug), codex.map((p) => p.slug));
  assert.deepEqual(slugDiff, { onlyInProjectsJson: [], onlyInAiProjectsJson: [] }, `slug mismatch: ${JSON.stringify(slugDiff)}`);
  const urlDiff = diff(ours.map((p) => p.url), codex.map((p) => p.url));
  assert.deepEqual(urlDiff, { onlyInProjectsJson: [], onlyInAiProjectsJson: [] }, `URL mismatch: ${JSON.stringify(urlDiff)}`);
  const kinds = ours.filter((p) => codex.find((c) => c.slug === p.slug)?.recordType !== p.recordType).map((p) => p.slug);
  assert.deepEqual(kinds, [], `recordType differs for ${kinds.join(', ')}`);
  assert.deepEqual(ours.map((p) => p.slug), codex.map((p) => p.slug), 'same order');
});
