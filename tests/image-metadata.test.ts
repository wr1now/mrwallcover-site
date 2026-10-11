import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Google Search Console "Image metadata": every ImageObject must carry all five of Google's
// image-licence fields: creator (typed Person or Organization, named), creditText,
// copyrightNotice, license and acquireLicensePage. Credited (third-party) photographs
// must name their credited owner, never Mr Wallcover. See src/lib/schema.ts (imageRights).
const SITE = 'https://www.mrwallcover.com';
const IMAGE_USE = `${SITE}/image-use/`;
const REQUIRED = ['creator', 'creditText', 'copyrightNotice', 'license', 'acquireLicensePage'] as const;
const OURS = new Set(['Mr Wallcover', 'Dorin Burcus']);

type Node = Record<string, unknown>;
type Entry = { manifestNote?: string; src?: string; jpg?: string; thumb?: string; thumbJpg?: string };
const readJson = async <T>(file: string) => JSON.parse(await readFile(file, 'utf8')) as T;

async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full !== path.join('dist', 'media') && full !== path.join('dist', '_astro')) out.push(...(await htmlFiles(full)));
    } else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

async function imageObjects() {
  const found: { page: string; node: Node }[] = [];
  const walk = (n: unknown, page: string) => {
    if (Array.isArray(n)) n.forEach((v) => walk(v, page));
    else if (n && typeof n === 'object') {
      if ((n as Node)['@type'] === 'ImageObject') found.push({ page, node: n as Node });
      Object.values(n).forEach((v) => walk(v, page));
    }
  };
  for (const file of await htmlFiles('dist')) {
    const html = await readFile(file, 'utf8');
    for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) walk(JSON.parse(m[1]), file);
  }
  return found;
}

async function creditIndex() {
  const alts = await readJson<Record<string, Entry>>('src/content/alts.json');
  const credited = await readJson<Record<string, Entry>>('src/content/credited-media.json');
  const sizes = await readJson<Record<string, Entry>>('src/content/sizes.json');
  const byPath = new Map<string, string>();
  for (const [id, e] of Object.entries({ ...sizes, ...credited })) for (const k of ['src', 'jpg', 'thumb', 'thumbJpg'] as const) if (e[k]) byPath.set(e[k]!, id);
  const holders = new Map<string, string>();
  for (const [id, e] of Object.entries({ ...alts, ...credited })) {
    const holder = e?.manifestNote?.match(/credit\s+(?:Photography|Photograph|Photo|Image|Images)\s*:\s*([^;]+)/i)?.[1].trim();
    if (holder) holders.set(id, holder.replace(/\s*\/\s*Wikimedia Commons.*$/i, '').replace(/\s*\(official\)\s*$/i, '').trim());
  }
  return { byPath, holders };
}

test('every ImageObject in the built JSON-LD carries all five image-licence fields', async () => {
  const objs = await imageObjects();
  assert.ok(objs.length >= 262, `expected at least 262 ImageObjects, found ${objs.length}`);
  for (const { page, node } of objs) {
    for (const key of REQUIRED) assert.ok(node[key], `${page}: ImageObject ${node.url} is missing ${key}`);
    const creator = node.creator as Node;
    assert.ok(creator['@type'] === 'Person' || creator['@type'] === 'Organization', `${page}: creator of ${node.url} needs a Person or Organization type`);
    assert.ok(typeof creator.name === 'string' && creator.name.length > 1, `${page}: creator of ${node.url} needs a name`);
    assert.match(String(node.copyrightNotice), /^©\s\S/, `${page}: copyrightNotice of ${node.url}`);
    assert.equal(node.acquireLicensePage, IMAGE_USE, `${page}: acquireLicensePage of ${node.url}`);
    assert.ok(node.license === IMAGE_USE || /^https:\/\/creativecommons\.org\/licenses\//.test(String(node.license)), `${page}: license of ${node.url} is ${node.license}`);
    if (OURS.has(String(creator.name))) assert.equal(node.copyrightNotice, '© Mr Wallcover', `${page}: our photo ${node.url}`);
    assert.equal(node.contentUrl, node.url, `${page}: contentUrl of ${node.url}`);
    // creditText matches the creator, and only our own photographs are credited to us.
    const credit = String(node.creditText);
    if (creator.name === 'Mr Wallcover') assert.equal(credit, 'Mr Wallcover', `${page}: creditText of our photo ${node.url}`);
    else if (creator.name === 'Dorin Burcus') assert.equal(credit, 'Dorin Burcus / Mr Wallcover', `${page}: creditText of Dorin's photo ${node.url}`);
    else if (creator.name === 'Photographer not recorded') assert.equal(credit, 'Photographer not recorded', `${page}: creditText of ${node.url}`);
    else {
      assert.ok(credit.startsWith(`Photo: ${creator.name}`), `${page}: creditText "${credit}" of ${node.url} must credit ${creator.name}`);
      assert.doesNotMatch(credit, /Mr Wallcover/, `${page}: credited image ${node.url} is credited to us`);
    }
  }
});

test('every creator in the built JSON-LD is a typed, named Person or Organization', async () => {
  for (const { page, node } of await imageObjects()) {
    const creator = node.creator as Node;
    assert.ok(creator && typeof creator === 'object' && !Array.isArray(creator), `${page}: creator of ${node.url} must be one node`);
    assert.ok(['Person', 'Organization'].includes(String(creator['@type'])), `${page}: creator of ${node.url} has @type ${creator['@type']}`);
    assert.ok(typeof creator.name === 'string' && creator.name.trim().length > 1, `${page}: creator of ${node.url} has no name`);
    if (creator.name === 'Mr Wallcover') {
      assert.equal(creator['@id'], `${SITE}/#business`, `${page}: our creator node carries the business @id`);
      assert.equal(creator.url, `${SITE}/`, `${page}: our creator url`);
    }
    if (creator.name === 'Dorin Burcus') assert.equal(creator.url, `${SITE}/about/`, `${page}: Dorin's creator url`);
  }
});

test('credited photographs name their credited owner and are never claimed as Mr Wallcover', async () => {
  const objs = await imageObjects();
  const { byPath, holders } = await creditIndex();
  assert.ok(holders.size >= 20, 'the credit records are readable');
  let checked = 0;
  for (const { page, node } of objs) {
    const p = new URL(String(node.url)).pathname;
    const id = byPath.get(p) ?? p.match(/^\/media\/img\/(?:r\/|thumbs\/)?([a-z0-9-]+?)(?:-(?:\d+|preview))?\.\w+$/)?.[1];
    const holder = id ? holders.get(id) : undefined;
    if (!holder) continue;
    checked += 1;
    const creator = node.creator as Node;
    assert.ok(!OURS.has(String(creator.name)), `${page}: credited image ${id} (${holder}) is claimed as ours`);
    assert.notEqual(node.copyrightNotice, '© Mr Wallcover', `${page}: credited image ${id} carries our copyright notice`);
    assert.equal(creator.name, holder, `${page}: ${id} creator must be the credited owner exactly`);
    assert.equal(node.copyrightNotice, `© ${holder}`, `${page}: ${id} copyright notice`);
  }
  assert.ok(checked >= 25, `expected the credited OWO, House of Hackney, Hilton and Wikimedia images in the schema, checked ${checked}`);
});

test('the SCP and unrecorded sets are not claimed as ours', async () => {
  for (const { page, node } of await imageObjects()) {
    if (/\/(scp-pimlico|tea-house)-\d+|hilton-holborn-01|old-bailey-hotel-01/.test(String(node.url))) {
      assert.ok(!OURS.has(String((node.creator as Node).name)), `${page}: ${node.url} is not our photograph`);
      assert.notEqual(node.copyrightNotice, '© Mr Wallcover', `${page}: ${node.url}`);
    }
  }
});

test('/image-use/ is published with one H1, an answer-first opening, author, date and the terms', async () => {
  const html = await readFile('dist/image-use/index.html', 'utf8');
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, 'one H1');
  assert.doesNotMatch(html, /<meta name="robots" content="noindex/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.mrwallcover\.com\/image-use\/"/);
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const first = main.slice(main.indexOf('</h1>')).match(/<p>(?:<strong>)?([\s\S]*?)<\/p>/g)?.find((p) => !/page-meta/.test(p)) ?? '';
  assert.match(main, /class="page-meta[^"]*"[\s\S]*?Dorin Burcus[\s\S]*?Last updated/, 'author and Last updated line');
  assert.match(first, /© Mr Wallcover[\s\S]*permission/, 'answer-first opening states the terms');
  assert.match(main, /credited owner|owner named in their credit/);
  assert.match(main, /info@mrwallcover\.com/);
  const md = await readFile('dist/image-use/index.md', 'utf8');
  assert.match(md, /^# Using our photographs$/m, 'Markdown twin');
  assert.match(await readFile('dist/sitemap-0.xml', 'utf8'), /<loc>https:\/\/www\.mrwallcover\.com\/image-use\/<\/loc>/);
  assert.match(await readFile('dist/llms.txt', 'utf8'), /\(https:\/\/www\.mrwallcover\.com\/image-use\/\)/);
  assert.match(await readFile('dist/llms-full.txt', 'utf8'), /https:\/\/www\.mrwallcover\.com\/image-use\//);
  assert.match(await readFile('dist/index.html', 'utf8'), /<footer[\s\S]*href="\/image-use\/"/, 'footer link');
});
