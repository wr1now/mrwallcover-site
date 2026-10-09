import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

/**
 * The AI-crawling layer, checked on the built site in dist/. Everything here
 * is generated from src/data/facts.json and the content files, so these tests
 * read the output and compare it with those sources rather than with a second
 * copy of the facts.
 */

const SITE = 'https://www.mrwallcover.com';

async function filesUnder(dir: string, keep: (name: string) => boolean): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await filesUnder(full, keep)));
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

const htmlFiles = (dir: string) => filesUnder(dir, (name) => name.endsWith('.html'));

/** A page is published when it is built, indexable and not a redirect stub. */
async function publishedPages(): Promise<{ file: string; pathname: string; html: string }[]> {
  const out: { file: string; pathname: string; html: string }[] = [];
  for (const file of await htmlFiles('dist')) {
    const html = await readFile(file, 'utf8');
    if (/<meta name="robots" content="noindex">/.test(html) || /http-equiv="refresh"/.test(html)) continue;
    out.push({ file, pathname: file.replace(/^dist/, '').replace(/index\.html$/, ''), html });
  }
  assert.ok(out.length > 50, `only ${out.length} published pages found`);
  return out;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

test('/for-ai/ states the facts from facts.json, links every published case study and guide, carries one H1 and a dated byline, and is in the sitemap and footer', async () => {
  const facts = JSON.parse(await readFile('src/data/facts.json', 'utf8')) as {
    brand: string;
    description: string;
    email: string;
    coverage: string;
    lastReviewed: string;
    founder: { name: string; path: string; fragment: string };
  };
  const html = await readFile('dist/for-ai/index.html', 'utf8');
  assert.doesNotMatch(html, /<meta name="robots" content="noindex">/);
  assert.equal(html.match(/<h1[\s>]/g)?.length, 1, 'one H1');
  assert.match(html, new RegExp(`<h1>${facts.brand} in plain facts\\.</h1>`));
  assert.ok(html.includes(`<p class="lede mt-5">${facts.description}</p>`), 'the lede is the fact-sheet sentence');
  assert.ok(html.includes(facts.coverage), 'coverage sentence');
  assert.ok(html.includes(`href="mailto:${facts.email}"`), 'email link');
  assert.ok(html.includes('href="/contact/"'), 'contact link');
  assert.ok(html.includes(`href="${facts.founder.path}#${facts.founder.fragment}"`), 'founder link');
  assert.match(html, /By <a href="\/about\/#dorin">Dorin Burcus<\/a>, founder · Last reviewed <time datetime="\d{4}-\d{2}-\d{2}" data-page-updated>\d{1,2} \w+ \d{4}<\/time>/);
  assert.ok(html.includes(`datetime="${facts.lastReviewed}"`), 'the byline date is the site-wide review date');
  // No endorsement wording, no phone, no draft route.
  assert.doesNotMatch(html, /approved by|accredited by|endorsed by|recommended by/i);
  assert.doesNotMatch(html, /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|\b020\s?\d{4}\s?\d{4}\b/);
  assert.doesNotMatch(html, /penny-morrison|biltmore-mayfair|doubletree-victoria/);
  // Every published case study and guide is linked; every draft is not.
  for (const name of (await readdir('src/content/case-studies')).filter((entry) => entry.endsWith('.md'))) {
    const text = await readFile(`src/content/case-studies/${name}`, 'utf8');
    const fm = JSON.parse(text.match(/^---\n([\s\S]*?)\n---\n/)![1]) as { slug: string; draft?: boolean; wallcoverings: string[] };
    const linked = html.includes(`href="/projects/${fm.slug}/"`);
    assert.equal(linked, !fm.draft, `${fm.slug} ${fm.draft ? 'is a draft and must not be linked' : 'must be linked'}`);
    if (!fm.draft) for (const product of fm.wallcoverings) assert.ok(stripTags(html).includes(product), `${fm.slug}: ${product}`);
  }
  for (const name of (await readdir('src/content/guides')).filter((entry) => entry.endsWith('.md'))) {
    const text = await readFile(`src/content/guides/${name}`, 'utf8');
    const draft = /^draft: true$/m.test(text);
    assert.equal(html.includes(`href="/advice/${name.slice(0, -3)}/"`), !draft, name);
  }
  const specialisms = (JSON.parse(await readFile('src/content/specialisms.json', 'utf8')) as { items: { slug: string }[] }).items;
  for (const item of specialisms) assert.ok(html.includes(`href="/services/${item.slug}/"`), item.slug);
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  assert.ok(sitemap.includes(`<loc>${SITE}/for-ai/</loc>`), 'sitemap');
  const home = await readFile('dist/index.html', 'utf8');
  assert.match(home, /<footer[\s\S]*href="\/for-ai\/"[\s\S]*<\/footer>/, 'footer link');
});

test('every published HTML page has exactly one H1', async () => {
  const problems: string[] = [];
  for (const page of await publishedPages()) {
    const count = page.html.match(/<h1[\s>]/g)?.length ?? 0;
    if (count !== 1) problems.push(`${page.pathname}: ${count} H1s`);
  }
  assert.deepEqual(problems, []);
});
