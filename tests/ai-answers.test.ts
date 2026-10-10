import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Buyer questions from the AI answer audit (10 Oct 2026): src/data/buyer-answers.json.
type Answer = { id: string; question: string; answer: string; short?: string; pages: string[]; pendingOmitted: string[]; sources: { url?: string; note?: string }[] };
const data = JSON.parse(await readFile('src/data/buyer-answers.json', 'utf8')) as { answers: Answer[]; standing: Answer[]; factsAdditions: Record<string, unknown>; factsAdditionsPending: string[] };
const all = [...data.answers, ...data.standing];
const FAQ_PAGES = ['/for-ai/', '/professionals/designers/', '/professionals/hotels/', '/professionals/developers/', '/advice/hotel-wallcovering-specification/', '/aftercare/'];
const AWARD_LINE = 'Award-winning (2021): Most Outstanding for Wallcovering Installation, BUILD Magazine 2021 Design & Build Awards';

const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const graphOf = (html: string) => {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return scripts.flatMap((m) => JSON.parse(m[1])['@graph'] ?? [JSON.parse(m[1])]) as Record<string, any>[];
};

async function textFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'media' && entry.name !== '_astro') await textFiles(p, out); }
    else if (/\.(html|json|txt|md|xml)$/.test(entry.name)) out.push(p);
  }
  return out;
}

test('the source answers carry no [Pending] text, no banned names, no phone number, and quote the award exactly', () => {
  for (const item of all) {
    const text = `${item.question} ${item.answer} ${item.short ?? ''}`;
    assert.doesNotMatch(text, /Pending/, item.id);
    assert.doesNotMatch(text, /CLAUDI|Landmark|Threadneedles|third[ -]party|subcontract/i, item.id);
    assert.doesNotMatch(text, /(\+44|\b0)\s?\d{2,4}[\s-]?\d{3}[\s-]?\d{3,4}/, `${item.id} phone-like number`);
    assert.ok(item.sources.length > 0, `${item.id} has sources`);
    assert.ok(item.pages.length > 0, `${item.id} is placed on a page`);
  }
  assert.ok(all.some((item) => item.answer.includes(AWARD_LINE)), 'award line, exact');
  assert.equal(new Set(all.map((item) => item.id)).size, all.length, 'ids are unique');
});

for (const page of FAQ_PAGES) {
  test(`${page} shows its buyer questions and has exactly one valid FAQPage that matches them`, async () => {
    const html = await readFile(`dist${page}index.html`, 'utf8');
    const graph = graphOf(html);
    const faqs = graph.filter((node) => node['@type'] === 'FAQPage');
    assert.equal(faqs.length, 1, 'one FAQPage per page');
    const faq = faqs[0];
    assert.ok(Array.isArray(faq.mainEntity) && faq.mainEntity.length > 0, 'mainEntity is a non-empty list');
    for (const q of faq.mainEntity) {
      assert.equal(q['@type'], 'Question');
      assert.ok(typeof q.name === 'string' && q.name.length > 5, 'Question.name');
      assert.equal(q.acceptedAnswer?.['@type'], 'Answer');
      assert.ok(typeof q.acceptedAnswer.text === 'string' && q.acceptedAnswer.text.length > 20, 'Answer.text');
    }
    const visible = [...html.matchAll(/<div class="guide-faq-item"[^>]*>\s*<h3>([\s\S]*?)<\/h3>/g)].map((m) => decode(m[1]).trim());
    assert.deepEqual(visible, faq.mainEntity.map((q: any) => q.name), 'schema questions are the visible questions, in order');
    for (const item of all.filter((a) => a.pages.includes(page))) {
      assert.ok(visible.includes(item.question), `${item.id} visible`);
      assert.ok(faq.mainEntity.some((q: any) => q.name === item.question && q.acceptedAnswer.text === item.answer), `${item.id} in schema with its exact answer`);
      assert.ok(html.includes(`id="${item.id}"`), `${item.id} anchor`);
    }
  });
}

test('no [Pending] text and no 110- or 109-room Hyde London City wording anywhere in dist', async () => {
  const problems: string[] = [];
  for (const file of await textFiles('dist')) {
    const text = await readFile(file, 'utf8');
    if (text.includes('[Pending') || /Pending Q\d/.test(text)) problems.push(`${file}: [Pending]`);
    for (const m of text.matchAll(/\b(110|109)[\s-]+(guest[\s-]+)?(bed)?rooms?\b|\bthe next 109\b/gi)) problems.push(`${file}: "${m[0]}"`);
    for (const m of text.matchAll(/(Hyde London City|Old Bailey)[^.\n]{0,120}\b(110|109)\b(?![,\d])/g)) problems.push(`${file}: "${m[0].slice(-80)}"`);
  }
  assert.deepEqual(problems, []);
});

test('llms.txt lists every buyer question; /.well-known/facts.json carries them and the audit keys, add only', async () => {
  const llms = await readFile('dist/llms.txt', 'utf8');
  const section = llms.split('\n## Buyer questions\n')[1]?.split('\n## ')[0] ?? '';
  const lines = section.split('\n').filter((line) => line.startsWith('- ['));
  assert.equal(lines.length, data.answers.length, 'one llms line per buyer question');
  for (const item of data.answers) assert.ok(lines.some((line) => line.includes(`/for-ai/#${item.id})`)), item.id);
  const wellKnown = JSON.parse(await readFile('dist/.well-known/facts.json', 'utf8'));
  for (const [key, value] of Object.entries(data.factsAdditions)) assert.deepEqual(wellKnown[key], value, key);
  for (const key of data.factsAdditionsPending) assert.ok(!(key in wellKnown), `${key} waits for Dorin`);
  assert.equal(wellKnown.buyerQuestions.count, data.answers.length);
  assert.equal(wellKnown.largestPublishedHotelProgramme.rooms, 111);
  for (const key of ['inTradeSince', 'awardText', 'services', 'areasServed', 'enquiryRoutes', 'wastageAllowance', 'projects']) assert.ok(key in wellKnown, `${key} kept`);
});

// Dorin's answers to QUESTIONS_FOR_DORIN.md Q1–Q14 (10 Oct 2026, 21:43).
test('Dorin\'s Q1–Q14 answers: no [Pending] left, no insurance limits, no SafeContractor, no payment terms, no certifying of fire ratings', async () => {
  for (const item of all) {
    for (const q of (item as Answer & { answeredBy?: string[] }).answeredBy ?? []) assert.ok(/^Q(1[0-4]|[1-9])$/.test(q), `${item.id} answeredBy ${q}`);
  }
  const problems: string[] = [];
  const sources = ['src/data/buyer-answers.json', 'src/content/pages/trade.md', 'src/content/areas.json', 'src/lib/ai-decision-guide.ts'];
  const files = [...(await textFiles('dist')), ...sources];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (let n = 1; n <= 14; n += 1) if (text.includes(`[Pending Q${n}`)) problems.push(`${file}: [Pending Q${n}`);
    if (/SafeContractor/i.test(text)) problems.push(`${file}: SafeContractor`);
    if (/payment terms (are|:)|our payment terms|\bdeposit of\b|\d+\s?% (deposit|retention)|payable within|net \d+ days/i.test(text)) problems.push(`${file}: payment terms`);
    for (const m of text.matchAll(/(public liability|employers'? liability|professional indemnity|insurance|insured)[^.\n]{0,120}(£\s?\d|\d+\s?(m|million)\b)/gi)) problems.push(`${file}: insurance limit "${m[0].slice(0, 80)}"`);
    if (/we certify fire|certif(y|ies) the fire (rating|classification)s? (ourselves|ourself)|Mr Wallcover certifies/i.test(text)) problems.push(`${file}: certifying fire ratings`);
    if (/third[ -]party|subcontract/i.test(text) && !file.startsWith('dist/')) problems.push(`${file}: banned wording`);
  }
  assert.deepEqual(problems, []);
});

test('Q10 and Q13: Chelsea FAQ, decision guide and Cadence role read as Dorin decided; makers installed are in the facts', async () => {
  const Q10 = 'We focus on whole residences and hotel packages, and will take on one- or two-room commissions.';
  const chelsea = await readFile('dist/areas/chelsea/index.html', 'utf8');
  assert.ok(chelsea.includes(Q10), 'Chelsea FAQ');
  const guide = JSON.parse(await readFile('dist/ai/decision-guide.json', 'utf8'));
  assert.ok(JSON.stringify(guide).includes(Q10), 'decision guide');
  for (const file of ['dist/projects/index.html', 'dist/for-ai/index.html', 'dist/projects.json', 'dist/llms.txt']) assert.ok((await readFile(file, 'utf8')).includes('Wallcovering installation (feature wall)'), `Cadence role in ${file}`);
  assert.ok(await readFile('dist/projects/calico-beverly-1975-cadence/index.html', 'utf8'), 'Cadence case study still built');
  const wellKnown = JSON.parse(await readFile('dist/.well-known/facts.json', 'utf8'));
  assert.deepEqual(wellKnown.makersInstalled.makers, ['de Gournay', 'Fromental', 'House of Hackney', 'Muraspec', 'Phillip Jeffries']);
  assert.equal(wellKnown.minimumProjectSize, Q10);
  for (const key of ['paymentTerms', 'roomsPerDay']) assert.ok(!(key in wellKnown), key);
});
