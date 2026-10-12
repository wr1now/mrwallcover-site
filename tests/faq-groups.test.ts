import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

// /faq/ keeps the six core questions (also on the homepage) and adds grouped technical questions
// from src/content/faq.json `groups`. Every question must be on the page, in the page's one FAQPage,
// in llms.txt, and every link inside an answer must resolve in the build.
type Item = { id: string; question: string; paragraphs: string[] };
type Group = { id: string; heading: string; lede?: string; items: Item[] };
const faq = JSON.parse(readFileSync('src/content/faq.json', 'utf8')) as { items: Item[]; groups?: Group[]; coreHeading?: string };
const groups = faq.groups ?? [];
const all = [...faq.items, ...groups.flatMap((g) => g.items)];
const page = readFileSync('dist/faq/index.html', 'utf8');
const home = readFileSync('dist/index.html', 'utf8');
const llms = readFileSync('dist/llms.txt', 'utf8');
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const graphOf = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const data = JSON.parse(m[1]);
    return (data['@graph'] ?? [data]) as Record<string, any>[];
  });

test('faq.json groups are well formed: unique ids, real questions, links only as <a href>', () => {
  assert.ok(groups.length >= 5, `expected the five technical groups, found ${groups.length}`);
  const ids = [...all.map((i) => i.id), ...groups.map((g) => g.id), 'faq-core'];
  assert.equal(new Set(ids).size, ids.length, 'every group and question id is unique on the page');
  for (const g of groups) {
    assert.match(g.id, /^[a-z][a-z0-9-]+$/);
    assert.ok(g.items.length >= 4, `${g.id} has at least four questions`);
    for (const item of g.items) {
      assert.match(item.id, /^[a-z][a-z0-9-]+$/, item.id);
      assert.match(item.question, /\?$/, `${item.id} is phrased as a question`);
      assert.ok(item.paragraphs.length >= 2, `${item.id} has a fuller answer (2+ paragraphs)`);
      for (const p of item.paragraphs) {
        const withoutLinks = p.replace(/<a href="[^"]+">[^<]+<\/a>/g, '');
        assert.doesNotMatch(withoutLinks, /<|>/, `${item.id}: only <a href> markup is allowed in answers`);
      }
    }
  }
});

test('/faq/ renders the index, every group heading and every question as an h3 disclosure', () => {
  assert.match(page, /<nav class="faq-groups-nav"/);
  assert.match(page, /id="faq-core"/);
  for (const g of groups) {
    assert.ok(page.includes(`href="#${g.id}"`), `${g.id} is in the index`);
    assert.match(page, new RegExp(`<h2[^>]*id="${g.id}"`), `${g.id} heading is an h2`);
  }
  for (const item of all) {
    assert.ok(page.includes(`<details id="${item.id}"`), `${item.id} is on /faq/`);
    assert.ok(decode(page).includes(item.question), `${item.id} question text`);
  }
  assert.equal((page.match(/<h1(?:\s|>)/g) ?? []).length, 1, 'one h1');
});

test('/faq/ has one FAQPage covering every question in plain text; the homepage keeps the six core ones', () => {
  const pageFaqs = graphOf(page).filter((n) => n['@type'] === 'FAQPage');
  assert.equal(pageFaqs.length, 1);
  const names = pageFaqs[0].mainEntity.map((q: any) => q.name);
  assert.deepEqual(names, all.map((i) => i.question));
  for (const q of pageFaqs[0].mainEntity) assert.doesNotMatch(q.acceptedAnswer.text, /<[^>]+>/, `${q.name}: schema answer is plain text`);
  const homeFaqs = graphOf(home).filter((n) => n['@type'] === 'FAQPage');
  assert.equal(homeFaqs.length, 1);
  assert.deepEqual(homeFaqs[0].mainEntity.map((q: any) => q.name), faq.items.map((i) => i.question));
});

test('llms.txt lists every FAQ question with its anchor and no markup', () => {
  for (const item of all) assert.ok(llms.includes(`/faq/#${item.id}`), `${item.id} in llms.txt`);
  const section = llms.split('## Frequently asked')[1]?.split('\n## ')[0] ?? '';
  assert.doesNotMatch(section, /<a\s/);
});

test('every link inside an FAQ answer resolves', () => {
  for (const item of all) {
    for (const p of item.paragraphs) {
      for (const [, href] of p.matchAll(/<a href="([^"]+)">/g)) {
        if (/^https?:\/\//.test(href)) continue;
        assert.match(href, /^\/[^ ]*$/, `${item.id}: internal links are root-relative`);
        const [route, hash] = href.split('#');
        const file = `dist${route}${route.endsWith('/') ? 'index.html' : ''}`;
        assert.ok(existsSync(file), `${item.id}: ${href} does not resolve (${file})`);
        if (hash) assert.ok(readFileSync(file, 'utf8').includes(`id="${hash}"`), `${item.id}: ${href} anchor #${hash} not found`);
      }
    }
  }
});
