import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// Service and material page depth (SEO fix pack D): sections built only from published facts,
// buyer questions placed by src/data/buyer-answers.json, one FAQPage that matches the visible list,
// and descriptive material titles.
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const html = (p: string) => readFileSync(`dist${p}index.html`, 'utf8');
const mainText = (h: string) => decode(h.slice(h.indexOf('<main'), h.indexOf('</main>')).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' '));
const depth = JSON.parse(readFileSync('src/content/service-depth.json', 'utf8')).items as Record<string, { sections: { heading: string; paragraphs: string[] }[] }>;
const specialisms = (JSON.parse(readFileSync('src/content/specialisms.json', 'utf8')).items as { slug: string; sections?: { heading: string; paragraphs: string[] }[]; faq: { question: string }[] }[])
  .map((s) => ({ ...s, sections: s.sections ?? depth[s.slug]?.sections }));
const buyer = JSON.parse(readFileSync('src/data/buyer-answers.json', 'utf8'));
const answers = [...buyer.answers, ...buyer.standing] as { id: string; question: string; answer: string; pages: string[] }[];
const facts = JSON.parse(readFileSync('src/data/facts.json', 'utf8'));

for (const page of specialisms.filter((s) => s.sections?.length)) {
  const path = `/services/${page.slug}/`;
  test(`${path}: every section is rendered, its links resolve, and the FAQPage matches the visible questions`, () => {
    const h = html(path);
    for (const section of page.sections!) assert.ok(decode(h).includes(`>${section.heading}</h2>`), `section "${section.heading}"`);
    for (const section of page.sections!) {
      for (const m of section.paragraphs.join(' ').matchAll(/\]\((\/[^)\s]*)\)/g)) {
        const target = m[1].split('#')[0];
        assert.ok(existsSync(`dist${target}index.html`), `${path} links ${target}, which is not built`);
      }
    }
    assert.ok(mainText(h).split(/\s+/).length >= 700, `${path} main content is at least 700 words`);
    const graph = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])['@graph'] ?? []);
    const faqs = graph.filter((n: any) => n['@type'] === 'FAQPage');
    assert.equal(faqs.length, 1, 'one FAQPage');
    const schemaQs = faqs[0].mainEntity.map((q: any) => q.name);
    const visible = [...h.matchAll(/<details id="[^"]*"[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')).trim());
    assert.deepEqual(schemaQs, visible, 'schema questions are the visible questions, in order');
    for (const item of answers.filter((a) => a.pages.includes(path))) {
      assert.ok(faqs[0].mainEntity.some((q: any) => q.name === item.question && q.acceptedAnswer.text === item.answer), `${item.id} in the FAQPage with its exact answer`);
      assert.ok(h.includes(`id="${item.id}"`), `${item.id} anchor`);
    }
  });
}

test('section copy uses only approved programme figures and the brand rules', () => {
  const copy = specialisms.flatMap((s) => (s.sections ?? []).flatMap((x) => [x.heading, ...x.paragraphs])).join('\n');
  assert.doesNotMatch(copy, /CLAUDI|Landmark|Threadneedles|third[ -]party|subcontract/i);
  // Every m² figure in the sections is one Dorin cleared in facts.json programmeFigures.
  const cleared = facts.programmeFigures.map((f: { fact: string }) => f.fact).join(' ');
  for (const m of copy.matchAll(/([\d,]+)\s*m²/g)) assert.ok(cleared.includes(`${m[1]} m²`), `${m[1]} m² is not in facts.json programmeFigures`);
});

test('material pages carry descriptive, unique titles of 60 characters or fewer', () => {
  const materials = JSON.parse(readFileSync('src/content/materials.json', 'utf8')).items as { slug: string; metaTitle?: string }[];
  const seen = new Set<string>();
  for (const m of materials) {
    const title = decode(html(`/materials/${m.slug}/`).match(/<title>([^<]*)<\/title>/)![1]);
    assert.equal(title, m.metaTitle, `${m.slug} title`);
    assert.ok(title.length <= 60, `${m.slug} title is ${title.length} characters`);
    assert.match(title, /installation/i, `${m.slug} title says what the page covers`);
    assert.ok(!seen.has(title), `${title} is unique`);
    seen.add(title);
    const description = decode(html(`/materials/${m.slug}/`).match(/<meta name="description" content="([^"]*)"/)![1]);
    assert.ok(description.length <= 160, `${m.slug} description is ${description.length} characters`);
  }
});

test('every service page has a title of 60 characters or fewer and a description of 160 or fewer', () => {
  for (const page of specialisms) {
    const h = html(`/services/${page.slug}/`);
    const title = decode(h.match(/<title>([^<]*)<\/title>/)![1]);
    const description = decode(h.match(/<meta name="description" content="([^"]*)"/)![1]);
    assert.ok(title.length <= 60, `${page.slug} title is ${title.length} characters`);
    assert.ok(description.length <= 160, `${page.slug} description is ${description.length} characters`);
  }
});
