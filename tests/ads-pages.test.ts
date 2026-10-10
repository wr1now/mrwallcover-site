/**
 * Ad landing pages (claude/ads-pages): heritage and listed buildings,
 * specified papers we install, and fit-out contractors.
 *
 * Each page is built, has exactly one H1, an author and "Last updated" line,
 * Service + BreadcrumbList schema, a sitemap entry, an llms.txt entry and a
 * Markdown twin, and is linked from its hub (services, materials or
 * professionals). Copy guards: the only partnership claim is Calico
 * Wallpaper's, no approved/recommended/accredited installer wording, no banned
 * names, no unpublished product reference, no phone number, and de Gournay
 * stays out of titles, H1s and schema names.
 */
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const SITE = 'https://www.mrwallcover.com';
const PAGES = [
  { path: '/services/heritage-listed-buildings/', hub: '/services/' },
  { path: '/materials/specified-papers/', hub: '/materials/' },
  { path: '/professionals/fit-out-contractors/', hub: '/professionals/' },
];

const BANNED = [
  /CLAUDI/i,
  /\bLandmark\b/i,
  /\bSamantha\b/,
  /Koroseal/i,
  /Admiralty/i,
  /Metropole/i,
  /Canary Wharf/i,
  /subcontract/i,
  /third[\s-]party/i,
  /Threadneedle/i,
  /Mulberry/i,
  /\bAethos\b/i,
  /Renovart/i,
  /MrWallcover\b(?!\.com|\/)/,
  /Mr\.\s?Wallcover/,
  /\b3163\b/,
  /\b2014\b/,
  /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}/,
];

const CLAIMS = [/approved installer/i, /recommended[\s-]installer/i, /accredit/i, /certified installer/i, /official installer/i, /preferred installer/i];

function visibleText(html: string): string {
  return html
    .replace(/data:image\/[^"')\s]+/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

for (const page of PAGES) {
  test(`${page.path} is built with one H1, byline, schema and discovery entries`, async () => {
    const file = `dist${page.path}index.html`;
    const html = await readFile(file, 'utf8');
    const h1s = html.match(/<h1[\s>]/g) ?? [];
    assert.equal(h1s.length, 1, `${page.path} has ${h1s.length} H1s`);
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1];
    const title = html.match(/<title>([\s\S]*?)<\/title>/)![1];
    assert.doesNotMatch(`${title} ${h1}`, /gournay/i, 'de Gournay stays out of the title and H1');
    assert.match(title, /\| Mr Wallcover$/);

    const text = visibleText(html);
    assert.match(text, /By Dorin Burcus/, 'author byline');
    assert.match(html, /Last updated\s*<time datetime="\d{4}-\d{2}-\d{2}"/, 'last updated date');

    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])['@graph'] as Record<string, any>[];
    const service = graph.find((node) => node['@type'] === 'Service' && node.url === `${SITE}${page.path}`);
    assert.ok(service, 'Service node for the page');
    assert.deepEqual(service!.provider, { '@id': `${SITE}/#business` });
    const crumbs = graph.find((node) => node['@type'] === 'BreadcrumbList');
    assert.ok(crumbs, 'BreadcrumbList');
    assert.equal(crumbs!.itemListElement.at(-1).item, `${SITE}${page.path}`);
    assert.equal(crumbs!.itemListElement.at(-2).item, `${SITE}${page.hub}`);
    assert.ok(graph.some((node) => node['@type'] === 'WebPage' && node.url === `${SITE}${page.path}`), 'WebPage node');
    for (const name of JSON.stringify(graph).matchAll(/"name":"([^"]*)"/g)) assert.doesNotMatch(name[1], /gournay/i, `schema name ${name[1]}`);

    const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
    assert.ok(sitemap.includes(`<loc>${SITE}${page.path}</loc>`), 'in the sitemap');
    const llms = await readFile('dist/llms.txt', 'utf8');
    assert.ok(llms.includes(`${SITE}${page.path}`), 'in llms.txt');
    const full = await readFile('dist/llms-full.txt', 'utf8');
    assert.ok(full.includes(`${SITE}${page.path}`), 'in llms-full.txt');
    await stat(`dist${page.path}index.md`);
    const hub = await readFile(`dist${page.hub}index.html`, 'utf8');
    assert.ok(hub.includes(`href="${page.path}"`), `linked from ${page.hub}`);
  });

  test(`${page.path} makes no partnership claim but Calico's, and carries no banned names`, async () => {
    const html = await readFile(`dist${page.path}index.html`, 'utf8');
    const md = await readFile(`dist${page.path}index.md`, 'utf8');
    const text = `${visibleText(html)}\n${md}`;
    for (const pattern of BANNED) assert.doesNotMatch(text, pattern, `${page.path}: ${pattern}`);
    for (const pattern of CLAIMS) assert.doesNotMatch(text, pattern, `${page.path}: ${pattern}`);
    // Calico Wallpaper is the only partnership. The heritage page's lime render line
    // ("trusted specialist partners") is about a trade, not a maker, and is the one other use of the word.
    const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => /partner/i.test(sentence));
    for (const sentence of sentences) {
      const ok = /Calico Wallpaper/.test(sentence) || /^Lime render is carried out with trusted specialist partners\.?$/.test(sentence.trim());
      assert.ok(ok, `${page.path}: a partnership claim other than Calico Wallpaper: "${sentence.trim()}"`);
    }
    assert.doesNotMatch(text, /TODO|TBC/);
  });
}

test('the specified-papers page names the five makers Dorin confirmed and Calico as the partnership', async () => {
  const text = visibleText(await readFile('dist/materials/specified-papers/index.html', 'utf8'));
  for (const maker of ['de Gournay', 'Fromental', 'House of Hackney', 'Muraspec', 'Phillip Jeffries']) assert.ok(text.includes(maker), maker);
  assert.match(text, /Work delivered in partnership with Calico Wallpaper/);
  assert.match(text, /Fromental\.[^.]*large volume at Four Seasons Hotel London at Ten Trinity Square/);
});

test('the specified-papers page links every case-study maker to its case study', async () => {
  const html = await readFile('dist/materials/specified-papers/index.html', 'utf8');
  for (const [maker, slug] of [
    ['Timorous Beasties', 'old-bailey-hotel'],
    ['Vescom', 'raffles-london-the-owo'],
    ['Omexco', 'four-seasons-ten-trinity-square'],
    ['Lewis &amp; Wood', 'browns-hotel-mayfair'],
    ['Lincrusta', 'trematon-castle'],
  ]) {
    const item = html.match(new RegExp(`<p><strong>${maker}\\.</strong>[\\s\\S]*?</p>`));
    assert.ok(item, `${maker} is listed`);
    assert.ok(item![0].includes(`href="/projects/${slug}/"`), `${maker} links /projects/${slug}/`);
  }
});

test('the heritage page links its case studies and the fit-out page carries the package facts', async () => {
  const heritage = await readFile('dist/services/heritage-listed-buildings/index.html', 'utf8');
  for (const slug of ['trematon-castle', 'raffles-london-the-owo', 'old-bailey-hotel', 'four-seasons-ten-trinity-square']) {
    assert.ok(heritage.includes(`href="/projects/${slug}/"`), slug);
  }
  assert.match(visibleText(heritage), /Limewash is applied by Mr Wallcover's own team/);
  const fitout = visibleText(await readFile('dist/professionals/fit-out-contractors/index.html', 'utf8'));
  for (const fact of [
    /RAMS\) are issued for every package/,
    /Dorin Burcus personally supervises the site/,
    /six wallpaper hangers and six decorators/,
    /25–35 people/,
    /registered for VAT and CIS/,
    /JCT contracts as a specialist package contractor/,
    /weekend work/,
    /mobilise within 2–3 days/,
    /available on request/,
  ]) assert.match(fitout, fact, String(fact));
});
