import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { homeCounts } from '../scripts/home-counts.mjs';
import { serve, launchBrowser } from '../scripts/visual-browser.mjs';

// The owner explicitly shortened home on 19 October. The former homepage material remains
// on the relevant subject page, rather than being protected by a minimum homepage length.
const html = await readFile('dist/index.html', 'utf8');
const work = await readFile('dist/projects/index.html', 'utf8');
const practice = await readFile('dist/practice/index.html', 'utf8');
const contact = await readFile('dist/contact/index.html', 'utf8');
const questions = await readFile('dist/faq/index.html', 'utf8');
const baseline = JSON.parse(await readFile('scripts/home-baseline-1b387c6.json', 'utf8'));

test('home is the seven-section introduction, with complete records on subject pages', () => {
  assert.equal(homeCounts(html).sections, 7);
  for (const id of ['hero-heading', 'trust-heading', 'showcase-heading', 'founder-heading', 'process-heading', 'aftercare-heading', 'contact-heading']) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /data-design-object=|data-studio(?:\s|>|=)|<video\b|"@type":"FAQPage"/);
  for (const href of ['/projects/', '/about/#dorin', '/practice/', '/aftercare/', '/contact/']) assert.ok(html.includes(`href="${href}"`), href);
});

test('the complete project page retains the historical homepage project destinations and Calico record', () => {
  const now = homeCounts(work);
  for (const slug of baseline.projectSlugs) assert.ok(now.projectSlugs.includes(slug), slug);
  assert.match(work, /data-project-slug="calico-lee-broom-overture"/);
  const calico = work.match(/<section[^>]*home-calico[\s\S]*?<\/section>/)![0];
  assert.equal(new Set([...calico.matchAll(/href="\/projects\/([a-z0-9-]+)\/"/g)].map(m => m[1])).size, 4);
  assert.match(calico, /calico-lee-broom-overture/);
  assert.ok(work.includes('Work delivered in partnership with Calico Wallpaper'));
});

test('original process, enquiry and question content remains on its relevant page', async () => {
  for (const text of ['In the trade', 'Since 2012', 'Five steps, and the same people throughout.', 'scope of works by room', 'The hang is not finished when we leave.']) assert.ok(html.includes(text), text);
  for (const text of ['Five ways to begin.', 'A hotel or contractor package', 'Aftercare or a repair']) assert.ok(contact.includes(text), text);
  assert.ok(practice.includes('On site, step by step'));
  assert.ok(practice.includes('The finish is our craft.'));
  const faq = JSON.parse(await readFile('src/content/faq.json', 'utf8'));
  const decode = (text: string) => text.replaceAll('&#39;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
  for (const item of faq.items) {
    assert.ok(decode(questions).includes(item.question), item.question);
    for (const paragraph of item.paragraphs) assert.ok(decode(questions).includes(paragraph), item.id);
  }
});

test('only the hero photograph loads eagerly; every other homepage image is lazy', () => {
  const main = html.match(/<main[\s\S]*?<\/main>/)![0];
  const imgs = [...main.matchAll(/<img\s[^>]*>/g)].map((m) => m[0]);
  const eager = imgs.filter((tag) => !/loading="lazy"/.test(tag));
  assert.equal(eager.length, 1, eager.join('\n'));
  assert.match(eager[0], /fetchpriority="high"/);
  assert.doesNotMatch(main, /<video[^>]*\sposter=/, 'film posters wait until the films are opened');
});

test('retired project URLs land on /projects/: a meta-refresh stub where the name may be built, the 404 fallback otherwise', async () => {
  const stub = await readFile('dist/projects/the-lanesborough/index.html', 'utf8');
  assert.match(stub, /<meta http-equiv="refresh" content="0; url=\/projects\/">/);
  assert.match(stub, /<meta name="robots" content="noindex">/);
  const notFound = await readFile('dist/404.html', 'utf8');
  assert.ok(notFound.includes("location.replace('/projects/')"), '404 sends unknown /projects/ URLs to the work index');
  assert.ok(notFound.includes('/^\\/projects\\/[a-z0-9-]+\\/?$/'), 'only single-segment /projects/ URLs');
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  assert.doesNotMatch(sitemap, /the-lanesborough/);
  // The Biltmore Mayfair was published with its own photographs on 11 Oct 2026.
  assert.match(sitemap, /\/projects\/biltmore-mayfair\//);
});


test('every removed homepage fragment has an explicit canonical destination, while retained anchors stay on home', async () => {
  const destinations = JSON.parse(await readFile('src/data/home-fragments.json', 'utf8')) as Record<string, string>;
  const ledger = JSON.parse(await readFile('docs/design/clearer-home/content-relocations.json', 'utf8'));
  const retained = new Set([...html.matchAll(/\bid="([^"\s]+)"/g)].map(match => match[1]));
  const removed = ledger.anchors.filter((anchor: { oldHref: string }) => !retained.has(anchor.oldHref.slice(2)));
  assert.deepEqual(Object.keys(destinations).sort(), removed.map((anchor: { oldHref: string }) => anchor.oldHref.slice(2)).sort());
  for (const anchor of removed) assert.ok(anchor.destinations.includes(destinations[anchor.oldHref.slice(2)]), anchor.oldHref);
});

test('saved homepage fragments open canonical practice, project evidence, material studio and questions', { timeout: 60000 }, async () => {
  const server = await serve('dist');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width:390, height:900 });
    for (const [fragment, destination] of [
      ['intro-heading', '/practice/#intro-heading'],
      ['calico-heading', '/projects/#calico-heading'],
      ['studio-heading', '/materials/#studio-heading'],
      ['cost', '/faq/#cost'],
    ]) {
      await page.goto(server.origin + '/#' + fragment, { waitUntil:'domcontentloaded' });
      await page.waitForFunction((expected: string) => location.pathname + location.hash === expected, { timeout:20000 }, destination);
      assert.equal(new URL(page.url()).pathname + new URL(page.url()).hash, destination);
      assert.ok(await page.$('#' + destination.split('#')[1]), destination);
      if (fragment === 'calico-heading') assert.equal(await page.$eval('#calico-heading', (heading:HTMLElement) => (heading.closest('details') as HTMLDetailsElement).open), true, 'the canonical project disclosure opens around its target');
    }
    for (const fragment of ['', 'hero-heading', 'selected-work', 'unknown-fragment', '%E0%A4%A', 'toString']) {
      await page.goto(server.origin + '/#' + fragment, { waitUntil:'domcontentloaded' });
      assert.equal(new URL(page.url()).pathname, '/', fragment);
      assert.equal(new URL(page.url()).hash, fragment ? '#' + fragment : '', fragment);
    }
    await page.goto(server.origin + '/', { waitUntil:'domcontentloaded' });
    const historyBefore = await page.evaluate(() => history.length);
    await page.evaluate(() => { location.hash = '%63ost'; });
    await page.waitForFunction(() => location.pathname === '/faq/' && location.hash === '#cost');
    assert.equal(await page.evaluate(() => history.length), historyBefore + 1, 'hashchange forwards with replace, adding no redirect-only history entry');
    await page.close();
  } finally {
    await browser.close();
    await server.close();
  }
});
