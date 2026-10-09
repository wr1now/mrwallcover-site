import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

/** The nine Markdown guides from section 27.6 of the build brief; guide 4 is the /advice/quantities/ calculator page. */
const EXPECTED_SLUGS = [
  'choosing-wallcoverings',
  'grasscloth-seams-and-variation',
  'wall-preparation',
  'installation-cost',
  'hand-painted-murals-set-out',
  'hotel-wallcovering-specification',
  'designer-specification-checklist',
  'developer-wallcovering-package',
  'wallcovering-problems-and-aftercare',
];

const slugs = (await readdir('src/content/guides')).filter((file) => file.endsWith('.md')).map((file) => file.slice(0, -3)).sort();

function frontmatter(source: string): Record<string, string> {
  const block = source.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/^([a-zA-Z]+): "?([^"\n]*)"?$/gm)].map((match) => [match[1], match[2]]));
}

test('the guide set is the nine 27.6 slugs, each with an author and ISO dates', async () => {
  assert.deepEqual(slugs, [...EXPECTED_SLUGS].sort());
  for (const slug of slugs) {
    const fm = frontmatter(await readFile(`src/content/guides/${slug}.md`, 'utf8'));
    assert.equal(fm.slug, slug);
    assert.equal(fm.author, 'Dorin Burcus', slug);
    assert.equal(fm.authorHref, '/about/#dorin', slug);
    assert.match(fm.published, /^\d{4}-\d{2}-\d{2}$/, `${slug} published`);
    assert.match(fm.updated, /^\d{4}-\d{2}-\d{2}$/, `${slug} updated`);
  }
});

test('draft guides stay out of production routes, search, sitemap and public summary; published ones are in all of them', async () => {
  const [advice, search, llms, sitemap] = await Promise.all(['dist/advice/index.html', 'dist/search/index.html', 'dist/llms.txt', 'dist/sitemap-0.xml'].map((file) => readFile(file, 'utf8')));
  assert.ok(advice.includes('href="/advice/quantities/"'), 'the hub lists the quantity calculator as guide 4');
  for (const slug of slugs) {
    const source = await readFile(`src/content/guides/${slug}.md`, 'utf8');
    const route = `/advice/${slug}/`;
    if (/^draft: true$/m.test(source)) {
      await assert.rejects(stat(`dist${route}index.html`), `${slug} must not be built`);
      for (const [name, text] of Object.entries({ advice, search, llms, sitemap })) assert.equal(text.includes(route), false, `${slug} in ${name}`);
      assert.match(source, /TODO\(Dorin\)/, `${slug} is a draft without a TODO(Dorin) explaining why`);
    } else {
      assert.ok((await stat(`dist${route}index.html`)).isFile(), `${slug} must be built`);
      for (const [name, text] of Object.entries({ advice, search, llms, sitemap })) assert.ok(text.includes(route), `${slug} missing from ${name}`);
      assert.doesNotMatch(source, /TODO/, `${slug} is published with a TODO in its source`);
    }
  }
});

test('review output renders every article, with the byline and without editorial notes or indexing', async () => {
  for (const slug of slugs) {
    const html = await readFile(`dist-review/advice/${slug}/index.html`, 'utf8');
    assert.match(html, /name="robots" content="noindex"/);
    assert.doesNotMatch(html, /INTERNAL EDITORIAL NOTE|awaiting-owner-technical-review|TODO/);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, slug);
    assert.match(html, /class="prose guide-prose"/);
    assert.match(html, /Content review preview/);
    assert.match(html, /By <a href="\/about\/#dorin">Dorin Burcus<\/a>, founder · Last updated <time datetime="\d{4}-\d{2}-\d{2}" data-page-updated="updated">\d{1,2} [A-Z][a-z]+ \d{4}<\/time>/);
    assert.match(html, new RegExp(`https://www.mrwallcover.com/advice/${slug}/`));
  }
});

test('local content links and downloads resolve in the corresponding build', async () => {
  for (const dir of ['dist', 'dist-review']) {
    const routes = ['advice', 'materials', 'professionals'];
    async function walk(folder: string): Promise<string[]> {
      const files = await readdir(folder, { withFileTypes: true });
      return (await Promise.all(files.map(async (file) => file.isDirectory() ? walk(path.join(folder, file.name)) : file.name.endsWith('.html') ? [path.join(folder, file.name)] : []))).flat();
    }
    for (const file of (await Promise.all(routes.map((route) => walk(`${dir}/${route}`)))).flat()) {
      const html = await readFile(file, 'utf8');
      for (const [, href] of html.matchAll(/href="(\/[^" ]*)"/g)) {
        const pathname = new URL(href.replaceAll('&amp;', '&'), 'https://www.mrwallcover.com').pathname;
        const target = path.join(dir, pathname, pathname.endsWith('/') ? 'index.html' : '');
        assert.ok((await stat(target)).isFile(), `${file}: ${href}`);
      }
    }
  }
});
