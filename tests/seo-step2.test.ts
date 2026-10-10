import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

test('every indexable page has a title of 60 characters or fewer and a description of 70-160', async () => {
  const problems: string[] = [];
  for (const file of await htmlFiles('dist')) {
    const html = await readFile(file, 'utf8');
    if (/<meta name="robots" content="noindex/.test(html)) continue;
    const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
    const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
    if (title.length > 60) problems.push(`${file}: title ${title.length}`);
    if (description.length < 70 || description.length > 160) problems.push(`${file}: description ${description.length}`);
  }
  assert.deepEqual(problems, []);
});

test('each Brown\'s film has a complete VideoObject with a real upload date and measured duration', async () => {
  const films = JSON.parse(await readFile('src/content/videos.json', 'utf8')) as { id: string; src: string; uploadDate: string; duration: string }[];
  for (const page of ['dist/index.html', 'dist/projects/browns-hotel-mayfair/index.html']) {
    const html = await readFile(page, 'utf8');
    const graph = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])['@graph']);
    const videos = graph.filter((node: Record<string, unknown>) => node['@type'] === 'VideoObject');
    assert.equal(videos.length, films.length, page);
    for (const film of films) {
      const node = videos.find((v: Record<string, unknown>) => v.contentUrl === `https://www.mrwallcover.com${film.src}`);
      assert.ok(node, `${page}: ${film.id}`);
      for (const key of ['name', 'description', 'thumbnailUrl', 'contentUrl', 'uploadDate', 'duration']) assert.ok(node[key], `${film.id} ${key}`);
      // Date the file was first committed (git log --diff-filter=A); not the build time.
      assert.match(node.uploadDate, /^2026-10-09T/);
      assert.match(node.duration, /^PT\d+S$/);
    }
  }
});

test('area pages show photographs of their own, each captioned with where it was taken', async () => {
  const areas = JSON.parse(await readFile('src/content/areas.json', 'utf8')).items as { slug: string; imageId: string; imageCaption?: string }[];
  const browns = areas.filter((a) => a.imageId.startsWith('browns-hotel-mayfair'));
  assert.deepEqual(browns.map((a) => a.slug), ['mayfair'], 'only Mayfair, where Brown\'s is, uses a Brown\'s photograph');
  assert.equal(new Set(areas.map((a) => a.imageId)).size, areas.length, 'no two area pages share a photograph');
  for (const area of areas) {
    assert.ok(area.imageCaption, `${area.slug} has a caption`);
    const html = await readFile(`dist/areas/${area.slug}/index.html`, 'utf8');
    assert.match(html, /<figcaption class="caption mt-3">/, `${area.slug} prints the caption`);
  }
});
