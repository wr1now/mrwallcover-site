import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Dorin, 10 Oct 2026: the Lee Broom project must stay published, with its card on /projects/.
const SLUG = 'calico-lee-broom-overture';

test('the Lee Broom case study is published and its project card is listed', async () => {
  const source = await readFile(`src/content/case-studies/${SLUG}.md`, 'utf8');
  const fm = JSON.parse(source.match(/^---\n([\s\S]*?)\n---/)![1]) as { draft?: boolean; gallery?: unknown[] };
  assert.notEqual(fm.draft, true, 'Lee Broom case study must not be a draft');
  assert.ok((fm.gallery ?? []).length >= 10, 'Lee Broom keeps its 10 gallery frames');
  const page = await readFile(`dist/projects/${SLUG}/index.html`, 'utf8');
  assert.doesNotMatch(page, /<meta name="robots" content="noindex/, 'Lee Broom page must be indexable');
  assert.match(page, /Lee Broom/);
  const index = await readFile('dist/projects/index.html', 'utf8');
  assert.match(index, new RegExp(`data-project-slug="${SLUG}"`), 'Lee Broom card on /projects/');
  assert.match(index, new RegExp(`href="/projects/${SLUG}/"`));
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  assert.match(sitemap, new RegExp(`https://www.mrwallcover.com/projects/${SLUG}/`), 'Lee Broom in the sitemap');
});
