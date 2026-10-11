import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

/**
 * The imperfect-arches case study is a private residence. It may only use photographs #28-40 from
 * the numbered photo labels, and nothing on the page, in its alts, file names, schema or Markdown
 * twin may identify the home or its owner: the location is only "a prime residence in central London".
 */
const SLUG = 'imperfect-arches-external-corner-trim';
const PAGE = `dist/projects/${SLUG}/index.html`;
const ALLOWED_PHOTOS = new Set([28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40]);
// Place names, postcodes, house numbers and source folder names that would identify the residence.
const IDENTIFYING = [
  /Mayfair|Belgravia|Knightsbridge|Kensington|Chelsea|Marylebone|Fitzrovia|Westminster|Pimlico|Holland Park|Notting Hill|Fulham|Hammersmith|Saltash|St\.? James|Soho|Covent Garden|Bloomsbury/i,
  /\b(?:W1|SW1|SW3|SW7|W8|W11|NW8|WC1|WC2)[A-Z]?\s?\d[A-Z]{2}\b/,
  /\b\d{1,4}[a-z]?\s+[A-Z][a-z]+\s+(?:Street|Square|Road|Place|Gardens|Terrace|Mews|Crescent|Lane)\b/,
  /\bflat\s+\d+|\bapartment\s+\d+/i,
  /unidentified-2019|luxury-residence|IMG_\d{4}|img-\d{4}/i,
  /CLAUDI|Landmark|Threadneedle|third[\s-]party|subcontract/i,
  /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|\b020\s?\d{4}\s?\d{4}\b/,
];

const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');

test('the arch case study is built with one H1, an answer-first opening and a last-updated line', async () => {
  const html = await readFile(PAGE, 'utf8');
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, 'exactly one H1');
  assert.match(html, /<h1[^>]*>How we solve imperfect arches: bespoke external-corner trim for wallcoverings<\/h1>/);
  assert.match(text(html), /How do you get a clean wallcovering edge on an arch that is not true\?/, 'answer-first opening');
  assert.match(text(html), /updated/i, 'last updated line');
  assert.match(html, /A prime residence in central London/);
  // The LCP image is eager with high priority; the rest of the gallery is lazy.
  assert.match(html, /<img[^>]*arch-trim-01[^>]*loading="eager"[^>]*fetchpriority="high"|<img[^>]*loading="eager"[^>]*fetchpriority="high"[^>]*arch-trim-01/);
  assert.match(html, /type="image\/avif" srcset="[^"]*arch-trim-01-2400\.avif 2400w/);
  for (const id of ['arch-trim-02', 'arch-trim-11']) assert.match(html, new RegExp(`<img[^>]*${id}[^>]*loading="lazy"`), id);
  const graph = JSON.stringify([...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])));
  assert.match(graph, /"@type":"Article"/);
  assert.match(graph, /"@type":"CreativeWork"/);
  assert.match(graph, /"name":"Dorin Burcus"/);
});

test('nothing on the arch case study identifies the home or its owner', async () => {
  const html = await readFile(PAGE, 'utf8');
  // The page's own content: from its header to the related-pages nav (which lists other studies by name).
  const own = html.slice(html.indexOf('<header class="page-head"'), html.indexOf('aria-label="Related pages"'));
  assert.ok(own.length > 2000, 'page content found');
  // The page's own schema node (the site-wide business node lists the areas served, which is fine).
  const graph = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const data = JSON.parse(m[1]);
    return (data['@graph'] ?? [data]) as { '@type'?: string; '@id'?: string }[];
  });
  const article = JSON.stringify(graph.filter((node) => String(node['@id'] ?? '').includes(`/projects/${SLUG}/`)));
  assert.match(article, /"@type":"Article"/);
  const meta = [...html.slice(0, html.indexOf('<body')).matchAll(/<(?:title|meta)[^>]*>/g)].map((m) => m[0]).join('\n');
  const full = await readFile('dist/llms-full.txt', 'utf8');
  const at = full.indexOf(`URL: https://www.mrwallcover.com/projects/${SLUG}/`);
  assert.ok(at > 0, 'llms-full.txt carries the page');
  const section = full.slice(full.lastIndexOf('\n---\n', at), full.indexOf('\n---\n', at));
  const sources = [
    ['page', own],
    ['page schema', article],
    ['page meta tags', meta],
    ['markdown twin', await readFile(`dist/projects/${SLUG}/index.md`, 'utf8')],
    ['case study source', await readFile(`src/content/case-studies/${SLUG}.md`, 'utf8')],
    ['llms-full.txt', section],
  ] as const;
  for (const [name, body] of sources) {
    for (const pattern of IDENTIFYING) assert.doesNotMatch(body, pattern, `${name}: ${pattern}`);
  }
  const files = (await readdir('public/media/img/r')).filter((f) => f.startsWith('arch-trim-'));
  assert.ok(files.length >= 11 * 8, 'responsive set for every frame');
  for (const file of files) for (const pattern of IDENTIFYING) assert.doesNotMatch(file, pattern, file);
});

test('the arch case study uses only photographs #28-40, and leaves #32 and #33 out', async () => {
  const manifest = JSON.parse(await readFile('scripts/originals/arch-trim.json', 'utf8')) as { images: Record<string, { photo: number }> };
  const used = Object.values(manifest.images).map((frame) => frame.photo);
  for (const n of used) assert.ok(ALLOWED_PHOTOS.has(n), `photo #${n} is not allowed on this page`);
  assert.ok(!used.includes(32) && !used.includes(33), 'the fingerprint artworks stay out');
  const fm = JSON.parse((await readFile(`src/content/case-studies/${SLUG}.md`, 'utf8')).match(/^---\n([\s\S]*?)\n---\n/)![1]) as { gallery: { id: string }[]; hero: string };
  assert.deepEqual(fm.gallery.map((g) => g.id).sort(), Object.keys(manifest.images).sort());
  assert.equal(fm.hero, 'arch-trim-01');
  assert.equal(manifest.images['arch-trim-01'].photo, 28);
});

test('the arch case study is listed and linked from Work, Services, llms.txt and the sitemap', async () => {
  const href = `/projects/${SLUG}/`;
  for (const file of ['dist/projects/index.html', 'dist/services/index.html']) assert.ok((await readFile(file, 'utf8')).includes(`href="${href}"`), file);
  assert.ok((await readFile('dist/llms.txt', 'utf8')).includes(href), 'llms.txt');
  assert.ok((await readFile('dist/sitemap-0.xml', 'utf8')).includes(href), 'sitemap');
  // The Lee Broom study stays published and listed alongside it.
  assert.ok((await readFile('dist/projects/index.html', 'utf8')).includes('href="/projects/calico-lee-broom-overture/"'), 'Lee Broom card');
});
