import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The standard "At a glance" box (competitor-analysis follow-up a): every published case study
// shows the same seven fields in the same order, filled only from its own frontmatter, the page's
// own text (src/content/case-study-glance.json) or an approved programme figure; blanks stay blank.
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const LABELS = ['Client', 'Designer', 'Main contractor', 'Maker and paper', 'Area or rooms', 'Scope', 'Year'];
const glance = JSON.parse(readFileSync('src/content/case-study-glance.json', 'utf8')).items as Record<string, { designer?: string; mainContractor?: string; makers?: string[]; size?: string; year?: string }>;
const facts = JSON.parse(readFileSync('src/data/facts.json', 'utf8'));
const studies = readdirSync('src/content/case-studies')
  .filter((f) => f.endsWith('.md'))
  .map((f) => JSON.parse(readFileSync(`src/content/case-studies/${f}`, 'utf8').split('\n---')[0].replace(/^---\n/, '')))
  .filter((fm) => !fm.draft);
const figureFor = (slug: string) => facts.programmeFigures.find((f: { url: string }) => f.url === `https://www.mrwallcover.com/projects/${slug}/`)?.fact as string | undefined;

test('case-study-glance.json: an entry for every case study, and area or room figures only where Dorin approved one', () => {
  for (const fm of studies) assert.ok(glance[fm.slug], `case-study-glance.json lacks ${fm.slug}`);
  for (const [slug, extra] of Object.entries(glance)) {
    if (!extra.size) continue;
    const fact = figureFor(slug);
    assert.ok(fact, `${slug}: a size needs an approved programme figure in facts.json`);
    for (const n of extra.size.match(/\d[\d,]*/g) ?? []) assert.ok(fact!.includes(n), `${slug}: "${n}" is not in the approved figure "${fact}"`);
  }
  // The brief's barred names never appear.
  assert.doesNotMatch(JSON.stringify(glance), /CLAUDI|Landmark|Threadneedles|subcontract|third party/i);
});

for (const fm of studies) {
  test(`/projects/${fm.slug}/: the At a glance box has the seven fields, in order, from sourced data`, () => {
    const h = readFileSync(`dist/projects/${fm.slug}/index.html`, 'utf8');
    const box = h.match(/<section class="glance-box"[^>]*data-glance[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(box, 'the box is on the page');
    assert.ok(h.indexOf('data-glance') < h.indexOf('class="prose case-study"'), 'the box sits above the story');
    const rows = [...box!.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map((m) => [decode(m[1]), decode(m[2].replace(/<span aria-hidden="true">–<\/span><span class="sr-only">Not recorded<\/span>/, '').replace(/<[^>]+>/g, ''))]);
    assert.deepEqual(rows.map((r) => r[0]), LABELS);
    const get = (label: string) => rows.find((r) => r[0] === label)![1];
    const extra = glance[fm.slug];
    assert.equal(get('Client'), fm.client);
    assert.equal(get('Scope'), fm.role);
    assert.equal(get('Designer'), extra.designer ?? '');
    assert.equal(get('Main contractor'), extra.mainContractor ?? '');
    assert.equal(get('Maker and paper'), (extra.makers ?? fm.wallcoverings ?? []).join('; '));
    assert.equal(get('Area or rooms'), extra.size ?? '', 'only an approved figure, else blank');
    if (extra.year) assert.equal(get('Year'), extra.year);
    else if (fm.years && /^(c\. )?\d{4}(–\d{4})?\b/.test(fm.years)) assert.equal(get('Year'), fm.years);
    else assert.equal(get('Year'), '', `"${fm.years}" is not a year, so the field stays blank`);
    // A blank field says so to screen readers instead of showing nothing.
    const blanks = rows.filter((r) => r[1] === '').length;
    assert.equal((box!.match(/class="sr-only">Not recorded</g) ?? []).length, blanks);
  });
}

test('/projects.json carries the same standard box for every case study (AI layer enriched)', () => {
  const index = JSON.parse(readFileSync('dist/projects.json', 'utf8'));
  assert.ok(index.notes.standardGlance);
  for (const fm of studies) {
    const entry = index.projects.find((p: { slug: string }) => p.slug === fm.slug);
    assert.ok(entry?.standardGlance, `${fm.slug} in /projects.json`);
    assert.deepEqual(entry.standardGlance.map((r: { label: string }) => r.label), LABELS);
    assert.equal(entry.standardGlance[0].value, fm.client);
  }
});
