import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Internal links (SEO fix pack B): the hotel service page lists every published hotel case
// study, and the footer links every service and material page from every page.
const html = (p: string) => readFileSync(path.join('dist', p, 'index.html'), 'utf8');
const section = (page: string, id: string) => {
  const start = page.indexOf(`id="${id}"`);
  return start < 0 ? '' : page.slice(start, page.indexOf('</section>', start));
};
const sitemapPaths = [...readFileSync('dist/sitemap-0.xml', 'utf8').matchAll(/<loc>https:\/\/www\.mrwallcover\.com([^<]*)<\/loc>/g)].map((m) => m[1]);

test('the hotel service page lists every published hotel case study', () => {
  const hotels = JSON.parse(readFileSync('src/content/hotels.json', 'utf8')).items as { publish: boolean; name: string; href: string }[];
  const record = section(html('/services/hotel-wallcovering-installation/'), 'record-heading');
  const caseStudies = readdirSync('src/content/case-studies').filter((n) => n.endsWith('.md')).map((n) => JSON.parse(readFileSync(`src/content/case-studies/${n}`, 'utf8').match(/^---\n([\s\S]*?)\n---\n/)![1]));
  let expected = 0;
  for (const hotel of hotels.filter((h) => h.publish)) {
    const slug = hotel.href.match(/^\/projects\/([a-z0-9-]+)\/$/)?.[1] ?? caseStudies.find((cs) => !cs.draft && (cs.client === hotel.name || cs.title === hotel.name))?.slug;
    if (!slug || !existsSync(`dist/projects/${slug}/index.html`)) continue;
    expected += 1;
    assert.match(record, new RegExp(`href="/projects/${slug}/"`), `${hotel.name} (/projects/${slug}/) is not linked from the hotel service page`);
  }
  assert.ok(expected >= 11, `expected the hotel case studies, found ${expected}`);
  for (const slug of ['pendley-manor-hotel', 'biltmore-mayfair', 'hilton-london-metropole', 'novotel-london-canary-wharf', 'doubletree-victoria']) {
    assert.match(record, new RegExp(`href="/projects/${slug}/"`), `${slug} on the hotel service page`);
  }
  // Every link resolves to a built page.
  for (const m of record.matchAll(/href="(\/projects\/[^"]+)"/g)) assert.ok(existsSync(`dist${m[1]}index.html`), `${m[1]} is built`);
});

test('the footer links every service and material page, on every page', () => {
  const targets = sitemapPaths.filter((p) => /^\/(services|materials)\/[a-z0-9-]+\/$/.test(p));
  assert.ok(targets.length >= 19, `service and material pages: ${targets.length}`);
  for (const p of sitemapPaths) {
    const page = html(p);
    const footer = page.slice(page.lastIndexOf('<footer'));
    for (const target of targets) assert.match(footer, new RegExp(`href="${target}"`), `${p}: footer lacks ${target}`);
  }
});

test('the heritage and specified-papers pages are linked from (almost) every page', () => {
  for (const target of ['/services/heritage-listed-buildings/', '/materials/specified-papers/']) {
    const inlinks = sitemapPaths.filter((p) => p !== target && html(p).includes(`href="${target}"`)).length;
    assert.ok(inlinks >= sitemapPaths.length - 1, `${target} has ${inlinks} inlinks`);
  }
});
