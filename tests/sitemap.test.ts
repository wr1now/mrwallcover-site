import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Sitemap: an honest <lastmod> on every URL (scripts/sitemap-lastmod.mjs, never the build time)
// and <image:image> entries for every photograph a page describes, credited ones included.
const SITE = 'https://www.mrwallcover.com';
const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
  const body = m[1];
  return {
    loc: body.match(/<loc>(.*?)<\/loc>/)![1],
    lastmod: body.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
    images: [...body.matchAll(/<image:loc>(.*?)<\/image:loc>/g)].map((x) => x[1]),
  };
});
const fm = (file: string) => {
  const block = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---\n/)![1];
  try {
    return JSON.parse(block);
  } catch {
    return Object.fromEntries([...block.matchAll(/^([a-zA-Z]+):\s*"?([^"\n]*)"?\s*$/gm)].map((m) => [m[1], m[2]]));
  }
};

test('every sitemap URL carries a real lastmod date, never in the future', () => {
  assert.ok(urls.length >= 85, `sitemap lists ${urls.length} URLs`);
  const today = new Date().toISOString().slice(0, 10);
  for (const u of urls) {
    assert.ok(u.lastmod, `${u.loc} has no <lastmod>`);
    assert.match(u.lastmod!, /^\d{4}-\d{2}-\d{2}/, `${u.loc} lastmod`);
    assert.ok(u.lastmod!.slice(0, 10) <= today, `${u.loc} lastmod ${u.lastmod} is in the future`);
  }
});

test('case-study and guide lastmod equal their frontmatter updated date', () => {
  let checked = 0;
  for (const [dir, prefix] of [['src/content/case-studies', '/projects/'], ['src/content/guides', '/advice/']] as const) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      const data = fm(path.join(dir, name));
      if (data.draft === true || data.draft === 'true') continue;
      const u = urls.find((x) => x.loc === `${SITE}${prefix}${data.slug}/`);
      if (!u) continue;
      assert.equal(u.lastmod!.slice(0, 10), data.updated, `${u.loc}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 35, `checked ${checked} case studies and guides`);
});

test('every photograph described in a page’s JSON-LD (credited ones included) is in that page’s image sitemap entry, and every entry exists', () => {
  let credited = 0;
  let total = 0;
  for (const u of urls) {
    const file = path.join('dist', new URL(u.loc).pathname, 'index.html');
    const html = readFileSync(file, 'utf8');
    const described = new Map<string, string>();
    const walk = (n: any) => {
      if (Array.isArray(n)) n.forEach(walk);
      else if (n && typeof n === 'object') {
        if (n['@type'] === 'ImageObject') described.set(n.contentUrl ?? n.url, String(n.creditText ?? ''));
        Object.values(n).forEach(walk);
      }
    };
    for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) walk(JSON.parse(m[1]));
    for (const [img, credit] of described) {
      if (img === `${SITE}/og.jpg` && u.loc !== `${SITE}/`) continue;
      assert.ok(u.images.includes(img), `${u.loc}: ${img} is described in JSON-LD but missing from the image sitemap`);
      if (credit.startsWith('Photo: ')) credited += 1;
    }
    for (const img of u.images) {
      assert.ok(img.startsWith(`${SITE}/`), `${img} is on our domain`);
      assert.ok(existsSync(path.join('dist', decodeURIComponent(new URL(img).pathname))), `${u.loc}: image ${img} is not in the build`);
    }
    total += u.images.length;
  }
  assert.ok(credited >= 25, `credited photographs in the image sitemap: ${credited}`);
  assert.ok(total >= 400, `image sitemap entries: ${total}`);
});

test('the schema logo is the 512 px render of the logo mark', () => {
  const png = readFileSync('dist/logo-512.png');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 512, 'width');
  assert.equal(png.readUInt32BE(20), 512, 'height');
  const home = readFileSync('dist/index.html', 'utf8');
  assert.match(home, /"logo":"https:\/\/www\.mrwallcover\.com\/logo-512\.png"/);
  assert.doesNotMatch(home, /"streetAddress"|"postalCode"|"telephone"/, 'no street, postcode or phone in schema');
});
