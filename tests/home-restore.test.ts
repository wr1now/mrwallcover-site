import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { homeCounts } from '../scripts/home-counts.mjs';

// Restored after #23 dropped them (content audit, 10 Oct 2026). Baseline: the 1b387c6 homepage.
const html = await readFile('dist/index.html', 'utf8');
const baseline = JSON.parse(await readFile('scripts/home-baseline-1b387c6.json', 'utf8'));

test('Lee Broom is on the homepage, as a card and in the Calico section', () => {
  assert.match(html, /<article class="home-card" data-project-slug="calico-lee-broom-overture">/);
  assert.match(html, /<section[^>]*home-calico[\s\S]*?href="\/projects\/calico-lee-broom-overture\/"[\s\S]*?<\/section>/);
});

test('homepage keeps at least the 1b387c6 sections, case studies and photographs', () => {
  const now = homeCounts(html);
  for (const key of ['sections', 'headings', 'projectLinks', 'images'] as const) assert.ok(now[key] >= baseline[key], `${key}: ${now[key]} < ${baseline[key]}`);
  for (const slug of baseline.projectSlugs) assert.ok(now.projectSlugs.includes(slug), slug);
});

test('restored copy: Since 2012, Calico partnership, five steps, five routes, aftercare', () => {
  for (const text of ['In the trade', 'Since 2012', 'Work delivered in partnership with Calico Wallpaper', 'Five steps, and the same people throughout.', 'scope of works by room', 'Five ways to begin.', 'A hotel or contractor package', 'Aftercare or a repair', 'The hang is not finished when we leave.']) {
    assert.ok(html.includes(text), text);
  }
  const calico = html.match(/<section[^>]*home-calico[\s\S]*?<\/section>/)![0];
  assert.equal(new Set([...calico.matchAll(/href="\/projects\/([a-z0-9-]+)\/"/g)].map((m) => m[1])).size, 4, 'all four Calico projects');
});

test('only the hero photograph loads eagerly; every other homepage image is lazy', () => {
  const main = html.match(/<main[\s\S]*?<\/main>/)![0];
  const imgs = [...main.matchAll(/<img\s[^>]*>/g)].map((m) => m[0]);
  const eager = imgs.filter((tag) => !/loading="lazy"/.test(tag));
  assert.equal(eager.length, 1, eager.join('\n'));
  assert.match(eager[0], /fetchpriority="high"/);
  assert.doesNotMatch(main, /<video[^>]*\sposter=/, 'film posters wait until the films are opened');
});
