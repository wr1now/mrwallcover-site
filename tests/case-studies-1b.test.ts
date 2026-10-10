import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/**
 * Award step 1b: the Four Seasons Private Residences frames (#2-4, 12-14, 19, 20, 24-27), the tea
 * house for Jaillon Studio (#59-64, 66, 67) and the SCP showroom in Pimlico (#45-49).
 * Privacy rules: no residence is identified (no flat or floor numbers, owners or views); the tea
 * house is located only as West London; the showroom only as Pimlico, London, with no street.
 */
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
const page = (slug: string) => readFile(`dist/projects/${slug}/index.html`, 'utf8');
const twin = (slug: string) => readFile(`dist/projects/${slug}/index.md`, 'utf8');
const SOURCE_NAMES = /unidentified-20|luxury-residence|cafe-feather|gilded-mural|IMG_\d{4}|img-\d{4}|_jrh\d+/i;

test('Four Seasons: a finished residence leads, all 15 frames kept, nothing identifies a residence', async () => {
  const html = await page('four-seasons-ten-trinity-square');
  assert.match(html, /<img[^>]*fs-residences-01[^>]*loading="eager"[^>]*fetchpriority="high"|<img[^>]*loading="eager"[^>]*fetchpriority="high"[^>]*fs-residences-01/);
  for (let i = 1; i <= 12; i += 1) assert.match(html, new RegExp(`fs-residences-${String(i).padStart(2, '0')}-`), `frame ${i}`);
  for (const id of ['commons-01', 'commons-02', 'commons-03']) assert.match(html, new RegExp(`four-seasons-ten-trinity-${id}`), id);
  const words = text(html) + (await twin('four-seasons-ten-trinity-square'));
  assert.doesNotMatch(words, /\bflat\s+\d+|\bapartment\s+\d+|\bresidence\s+\d+|\bfloor\s+\d+|\blevel\s+\d+/i);
  assert.doesNotMatch(words, SOURCE_NAMES);
});

test('the tea house is credited to Jaillon Studio, located only as West London, feather room first', async () => {
  const html = await page('tea-house-jaillon-studio');
  assert.match(html, /<img[^>]*tea-house-01[^>]*loading="eager"|<img[^>]*loading="eager"[^>]*tea-house-01/);
  assert.match(html, /href="https:\/\/www\.jaillonstudio\.com\/"/);
  const words = text(html) + (await twin('tea-house-jaillon-studio'));
  assert.match(words, /West London/);
  assert.doesNotMatch(words, /Little Venice|Maida Vale|Warrington|Turing|Paddington|W9\b|NW8\b/i);
  assert.doesNotMatch(words, SOURCE_NAMES);
});

test('the SCP showroom is located as Pimlico, London with no street, finished room first', async () => {
  const html = await page('scp-showroom-pimlico');
  assert.match(html, /<img[^>]*scp-pimlico-01[^>]*loading="eager"|<img[^>]*loading="eager"[^>]*scp-pimlico-01/);
  const words = text(html) + (await twin('scp-showroom-pimlico'));
  assert.match(words, /Pimlico, London/);
  assert.doesNotMatch(words, /\b\d{1,4}[a-z]?\s+[A-Z][a-z]+\s+(?:Street|Road|Place|Square|Row|Terrace)\b|Pimlico Road|Lupus Street|Warwick Way|Belgrave Road|SW1V/);
  assert.doesNotMatch(words, SOURCE_NAMES);
});

test('both new case studies are listed on /projects/, in the sitemap, llms.txt and /projects.json; Lee Broom stays', async () => {
  const [index, sitemap, llms, projects] = await Promise.all(
    ['dist/projects/index.html', 'dist/sitemap-0.xml', 'dist/llms.txt', 'dist/projects.json'].map((f) => readFile(f, 'utf8')),
  );
  for (const slug of ['tea-house-jaillon-studio', 'scp-showroom-pimlico', 'calico-lee-broom-overture']) {
    assert.match(index, new RegExp(`/projects/${slug}/`), `${slug} on /projects/`);
    assert.match(sitemap, new RegExp(`/projects/${slug}/`), `${slug} in sitemap`);
    assert.match(llms, new RegExp(`/projects/${slug}/`), `${slug} in llms.txt`);
    assert.match(projects, new RegExp(slug), `${slug} in /projects.json`);
  }
});
