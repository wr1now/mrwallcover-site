import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gapsFor, products, sources } from '../src/lib/fire-ratings.ts';

// The built fire-ratings reference: discoverable, linked from the Wallpapering hub, the Wallpapering
// sub-menu, the Guide and the hotel guide (owner's menu choice, 15 Oct 2026: no header link), and every
// product row rendered with its printed class, its gaps and its sources, readable without JavaScript.
const SITE = 'https://www.mrwallcover.com';
const PATH = '/advice/wallcovering-fire-ratings-uk/';
const html = readFileSync(`dist${PATH}index.html`, 'utf8');
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = decode(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const page = JSON.parse(readFileSync('src/content/fire-ratings/page.json', 'utf8'));
const graph = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])['@graph'] ?? [JSON.parse(m[1])]);

test('one H1, a self-canonical URL, a short title and an indexable page', () => {
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}${PATH}"`));
  const title = html.match(/<title>([^<]+)<\/title>/)![1];
  assert.ok(decode(title).length <= 60, title);
  assert.doesNotMatch(html, /name="robots" content="noindex/);
  assert.ok(text.includes(page.title));
});

test('Article, BreadcrumbList and FAQPage match the visible page and the page data', () => {
  const article = graph.find((n) => n['@type'] === 'Article');
  assert.ok(article);
  assert.equal(article.datePublished, page.published);
  assert.equal(article.dateModified, page.updated);
  assert.equal(article.author['@id'], `${SITE}/about/#dorin`);
  const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList');
  assert.equal(crumbs.itemListElement.at(-1).item, `${SITE}${PATH}`);
  const faq = graph.find((n) => n['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity.length, page.faq.length);
  for (const item of page.faq) assert.ok(text.includes(item.q) && text.includes(item.a), item.q);
  assert.match(html, /<time datetime="2026-10-15" data-page-updated="updated">/);
});

test('in the sitemap with its own updated date, in llms.txt, search and the Markdown twin', () => {
  const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
  const entry = sitemap.match(new RegExp(`<url><loc>${SITE}${PATH}</loc>(?:<lastmod>([^<]+)</lastmod>)?`));
  assert.ok(entry, 'listed in the sitemap');
  assert.equal(entry![1]?.slice(0, 10), page.updated, 'lastmod is the page’s own updated date');
  assert.ok(readFileSync('dist/llms.txt', 'utf8').includes(PATH));
  assert.ok(readFileSync('dist/search/index.html', 'utf8').includes(`href="${PATH}"`));
  assert.ok(existsSync(`dist${PATH}index.md`), 'Markdown twin written');
});

test('linked from the Guide, the Wallpapering hub and sub-menu, the footer and the hotel fire guide; no header link', () => {
  for (const file of ['dist/advice/index.html', 'dist/wallpapering/index.html', 'dist/wallpapering/preparation/index.html', 'dist/wallpapering/lining-and-adhesives/index.html', 'dist/advice/hotel-fire-safety-and-compliance/index.html', 'dist/index.html']) {
    assert.ok(readFileSync(file, 'utf8').includes(`href="${PATH}"`), file);
  }
  const home = readFileSync('dist/index.html', 'utf8');
  const nav = home.match(/<nav class="primary-nav"[\s\S]*?<\/nav>/)![0];
  assert.ok(!nav.includes(PATH), 'not a header link (owner, 15 Oct 2026)');
  const sub = readFileSync('dist/wallpapering/index.html', 'utf8').match(/<nav aria-label="Wallpapering">[\s\S]*?<\/nav>/)![0];
  assert.ok(sub.includes(`href="${PATH}"`) && sub.includes('Fire ratings &amp; standards'));
  assert.match(html, /<nav aria-label="Wallpapering">[\s\S]*?aria-current="page"[^>]*>Fire ratings &amp; standards</);
  const hub = readFileSync('dist/wallpapering/index.html', 'utf8');
  assert.match(hub, /<h2 id="fire-ratings">Fire ratings<\/h2>/, 'a short summary on the hub, not the reference itself');
});

test('every product row shows its printed class, a decoded reading, its limitations and gaps, and links its evidence', () => {
  for (const p of products) {
    const row = html.match(new RegExp(`<tr id="product-${p.id}">[\\s\\S]*?</tr>`))?.[0];
    assert.ok(row, `${p.id} rendered`);
    const rowText = decode(row!.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    assert.ok(rowText.includes(p.classificationRaw.replace(/\s+/g, ' ')), `${p.id} printed class`);
    for (const l of p.limitations) assert.ok(rowText.includes(l), `${p.id} limitation: ${l}`);
    for (const g of gapsFor(p)) assert.ok(rowText.includes(g.text), `${p.id} gap: ${g.text}`);
    for (const e of p.evidence) assert.ok(row!.includes(`href="${sources.find((s) => s.id === e.sourceId)!.url.replace(/&/g, '&amp;')}"`), `${p.id} links ${e.sourceId}`);
    if (!p.notation) assert.match(rowText, /not resolved: the documents disagree|no European class printed/, `${p.id} says why no class is shown`);
    if (p.classification.class && (!p.classification.smoke || !p.classification.droplets) && ['A2', 'B', 'C', 'D'].includes(p.classification.class)) {
      assert.match(rowText, /not stated/, `${p.id} says the missing subclass is not stated`);
    }
  }
});

test('the Markdown twin keeps each product’s build-up, evidence and gaps in that product’s own row', () => {
  const lines = readFileSync(`dist${PATH}index.md`, 'utf8').split('\n');
  assert.ok(!lines.some((l) => /\|\s*\|\s*\|\s*$/.test(l)), 'no table row ends in empty cells');
  const flat = (s: string) => s.replace(/\s+/g, ' ');
  for (const p of products) {
    const row = lines.find((l) => l.startsWith(`| ${p.manufacturer} ${flat(p.product)}`) && l.includes(flat(p.reference)));
    assert.ok(row, `${p.id} has a row`);
    if (p.testedBuildup.substrate) assert.ok(row!.includes(flat(p.testedBuildup.substrate)), `${p.id} substrate in its own row`);
    for (const e of p.evidence) assert.ok(row!.includes(sources.find((s) => s.id === e.sourceId)!.url), `${p.id} links ${e.sourceId} in its own row`);
    for (const g of gapsFor(p)) assert.ok(row!.includes(flat(g.text)), `${p.id} gap in its own row: ${g.text}`);
  }
});

test('the source library lists every source with its checking date; the decoder and tables work without JavaScript', () => {
  for (const s of sources) assert.ok(html.includes(`id="${s.id}"`), s.id);
  assert.match(html, /<form class="fr-decoder" data-fr-decoder hidden>/, 'the decoder form is hidden until its script runs');
  for (const code of ['A1', 'A2', 'B', 'C', 'D', 'E', 'F', 's1', 's2', 's3', 'd0', 'd1', 'd2']) assert.ok(html.includes(`<code>${code}</code>`), code);
  assert.match(text, /not project-specific fire-safety approval/);
  assert.match(text, /Discuss your wallcovering specification/);
  assert.match(html, /href="\/contact\/\?intent=advice"/);
});

test('reaction to fire is never presented as fire resistance, and nothing claims we certify', () => {
  assert.doesNotMatch(text, /\b(30|60|120)[- ]minute (fire )?(rated|rating|resistance) (wallcovering|wallpaper)/i);
  assert.doesNotMatch(text, /(?<!does )\b(we|mr wallcover) (certify|certifies|approve|approves)\b/i);
  assert.match(text, /does not give a wall any number of minutes/);
  assert.doesNotMatch(text, /in force 2 September 2029/, 'a future date is shown as taking effect, not in force');
  assert.match(text, /takes effect 2 September 2029/);
});
