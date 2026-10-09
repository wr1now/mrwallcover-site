import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const slugs = (await readdir('src/content/guides')).filter((file) => file.endsWith('.md')).map((file) => file.slice(0, -3));

test('unreviewed guides stay out of production routes, search, sitemap and public summary', async () => {
  assert.equal(slugs.length, 10);
  const indexable = (await Promise.all(['dist/advice/index.html', 'dist/search/index.html', 'dist/llms.txt', 'dist/sitemap-0.xml'].map((file) => readFile(file, 'utf8')))).join('\n');
  for (const slug of slugs) {
    const source = await readFile(`src/content/guides/${slug}.md`, 'utf8');
    if (!/^draft: true$/m.test(source)) continue;
    await assert.rejects(stat(`dist/advice/${slug}/index.html`));
    assert.equal(indexable.includes(`/advice/${slug}/`), false, slug);
  }
});

test('review output renders all ten full articles without editorial notes or indexing', async () => {
  for (const slug of slugs) {
    const html = await readFile(`dist-review/advice/${slug}/index.html`, 'utf8');
    assert.match(html, /name="robots" content="noindex"/);
    assert.doesNotMatch(html, /INTERNAL EDITORIAL NOTE|awaiting-owner-technical-review/);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, slug);
    assert.match(html, /class="prose guide-prose"/);
    assert.match(html, /Content review preview/);
    assert.match(html, new RegExp(`https://www.mrwallcover.com/advice/${slug}/`));
  }
});

test('new local content links and downloads resolve in the corresponding build', async () => {
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
