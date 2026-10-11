import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The hotel fire-safety and compliance guide (competitor-analysis follow-up d): built from Dorin's
// answers only. The manufacturer certifies the rating; we install to the maker's system; RAMS,
// insurance and handover as stated. It never claims a rating or certifies anything itself.
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const PATH = '/advice/hotel-fire-safety-and-compliance/';
const html = readFileSync(`dist${PATH}index.html`, 'utf8');
const text = decode(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const buyer = JSON.parse(readFileSync('src/data/buyer-answers.json', 'utf8'));
const answers = [...buyer.answers, ...buyer.standing] as { id: string; question: string; answer: string; pages: string[] }[];

test(`${PATH}: built, listed on the hub, in the sitemap and llms.txt`, () => {
  assert.ok(readFileSync('dist/advice/index.html', 'utf8').includes(`href="${PATH}"`));
  assert.ok(readFileSync('dist/sitemap-0.xml', 'utf8').includes(`https://www.mrwallcover.com${PATH}`));
  assert.ok(readFileSync('dist/llms.txt', 'utf8').includes(PATH));
});

test(`${PATH}: the compliance lines are Dorin's own words, and the FAQPage matches the placed answers`, () => {
  for (const line of [
    'The fire classification is certified by the wallcovering manufacturer, not by the installer.',
    "Mr Wallcover installs in line with the manufacturer's system and the applicable regulations",
    'Risk assessments and method statements (RAMS) are issued for every package, and Dorin Burcus personally supervises the site.',
    "Public liability, employers' liability and professional indemnity details are available on request.",
  ]) assert.ok(text.includes(line), line);
  const placed = answers.filter((a) => a.pages.includes(PATH));
  assert.deepEqual(placed.map((a) => a.id).sort(), ['f-b5', 'f-q1', 'f-q3']);
  const graph = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])['@graph'] ?? [JSON.parse(m[1])]);
  const faq = graph.filter((n: { '@type'?: string }) => n['@type'] === 'FAQPage');
  assert.equal(faq.length, 1, 'one FAQPage');
  for (const a of placed) assert.ok(faq[0].mainEntity.some((q: { name: string }) => q.name === a.question), a.question);
});

test(`${PATH}: never claims a rating, never certifies, no barred words`, () => {
  assert.doesNotMatch(text, /\b(we|our wallcoverings?|mr wallcover) (are|is|certif(y|ies))\b[^.]{0,30}\b(fire[- ]rated|class [a-c0]|b-s1)/i);
  assert.match(text, /does not certify any product/);
  assert.doesNotMatch(text, /CLAUDI|Landmark|Threadneedles|subcontract|third party/i);
});
