import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { formatClassification, invalidCombination, parseClassification } from '../src/lib/fire-classification.ts';
import { fireData, gapsFor, jurisdictions, products, sources, validateFireData, type FireData, type Product, type Source } from '../src/lib/fire-ratings.ts';

// The fire-ratings reference (/advice/wallcovering-fire-ratings-uk/): one dataset in src/data/fire-ratings/,
// checked here and again at build time. The rules come from the owner's brief of 15 Oct 2026: no unsourced
// claim, no invented smoke or droplet subclass, no brand-wide rating, no future amendment shown as in force.

const page = JSON.parse(readFileSync('src/content/fire-ratings/page.json', 'utf8'));

test('the dataset as committed passes every check', () => {
  assert.deepEqual(validateFireData(), []);
});

test('class notations are read only as far as they are printed', () => {
  assert.deepEqual(parseClassification('B-s2,d0'), { class: 'B', smoke: 's2', droplets: 'd0' });
  assert.deepEqual(parseClassification('B-s1, d0'), { class: 'B', smoke: 's1', droplets: 'd0' });
  assert.deepEqual(parseClassification('B – s1, d0'), { class: 'B', smoke: 's1', droplets: 'd0' });
  assert.deepEqual(parseClassification('Class B s1 d0'), { class: 'B', smoke: 's1', droplets: 'd0' });
  assert.deepEqual(parseClassification('Euroclass B'), { class: 'B', smoke: null, droplets: null });
  assert.deepEqual(parseClassification('EN 13501-1 C-s3,d2'), { class: 'C', smoke: 's3', droplets: 'd2' });
  assert.deepEqual(parseClassification('Euroclass 13501, B s1 d0'), { class: 'B', smoke: 's1', droplets: 'd0' });
  assert.deepEqual(parseClassification('Euroclass EN13501, C-s1-d0'), { class: 'C', smoke: 's1', droplets: 'd0' });
  assert.deepEqual(parseClassification('EN 13501, B s2 d0'), { class: 'B', smoke: 's2', droplets: 'd0' });
  assert.deepEqual(parseClassification('Euro classification B'), { class: 'B', smoke: null, droplets: null });
  assert.deepEqual(parseClassification('A2-s1,d0'), { class: 'A2', smoke: 's1', droplets: 'd0' });
  assert.deepEqual(parseClassification('A1'), { class: 'A1', smoke: null, droplets: null });
  assert.deepEqual(parseClassification('E-d2'), { class: 'E', smoke: null, droplets: 'd2' });
  // Other systems are never read as a European class.
  for (const other of ['Class 0', 'Class 1', 'ASTM E84 Class A', 'Class A', 'B1', 'IMO FTP Code Part 5', 'M1', '']) {
    assert.equal(parseClassification(other).class, null, other);
  }
  assert.equal(formatClassification(parseClassification('Euroclass B')), 'B (smoke and droplet subclasses not stated)');
  assert.equal(formatClassification(parseClassification('B-s2')), 'B-s2 (droplet subclass not stated)');
  assert.equal(formatClassification(parseClassification('B-s2,d0')), 'B-s2,d0');
  // A1 and F carry no subclass; E carries only an optional d2 (Delegated Regulation 2016/364, Table 1).
  assert.equal(formatClassification(parseClassification('A1')), 'A1 (no smoke or droplet subclass applies)');
  assert.equal(formatClassification(parseClassification('F')), 'F (no smoke or droplet subclass applies)');
  assert.equal(formatClassification(parseClassification('E-d2')), 'E-d2 (no smoke subclass applies)');
  assert.match(formatClassification(parseClassification('E')), /^E \(no smoke subclass applies/);
  for (const impossible of ['A1-s1,d0', 'F-d0', 'E-s1,d0', 'E-d0']) assert.ok(invalidCombination(parseClassification(impossible)), impossible);
  for (const fine of ['A1', 'A2-s1,d0', 'B-s3,d2', 'E', 'E-d2', 'Euroclass B']) assert.equal(invalidCombination(parseClassification(fine)), null, fine);
  assert.equal(parseClassification('Bfl-s1').class, null, 'flooring classes are not read as wall classes');
});

// A minimal valid dataset, then one fault at a time.
const src: Source = { id: 'src-x', issuer: 'Maker', title: 'Declaration of performance', reference: 'DoP 1', type: 'declaration_of_performance', group: 'manufacturer', issued: '2024-09-01', effective: null, statedExpiry: null, url: 'https://example.com/dop.pdf', accessed: '2026-10-15', sha256: null, pages: 'p.1', establishes: 'The declared class for one product.', limits: null, status: 'current' };
const prod: Product = {
  id: 'maker-one', manufacturer: 'Maker', product: 'Product One', reference: null, scope: 'All colourways of Product One', construction: 'Vinyl on non-woven', weight: null,
  classificationRaw: 'B-s2,d0 on fibre cement board', notation: 'B-s2,d0', classification: { class: 'B', smoke: 's2', droplets: 'd0' }, classificationStandardCited: null, testMethodsCited: [], productStandardCited: null,
  evidence: [{ sourceId: 'src-x', evidenceType: 'declaration_of_performance', documentReference: 'DoP 1', testBody: null, pageRef: 'p.1' }],
  testedBuildup: { substrate: 'Plasterboard', adhesive: 'Named paste', other: null }, fieldOfApplication: 'As stated', limitations: ['Only on the tested substrate.'], conflicts: [], unresolved: [],
  status: 'current', evidenceLevel: 'declaration_of_performance', checked: '2026-10-15',
};
const base = (): FireData => ({ ...structuredClone(fireData), sources: [structuredClone(src)], products: [structuredClone(prod)], standards: [], decoder: [{ code: 'B', label: 'b', meaning: 'm', basis: 'b', sourceIds: ['src-x'] }], jurisdictions: [], englandSourceIds: [], checked: '2026-10-15' });
const problemsWith = (edit: (d: FireData) => void) => {
  const d = base();
  edit(d);
  return validateFireData(d, '2026-10-15');
};

test('a minimal valid dataset passes, so each fault below is caught for its own reason', () => {
  assert.deepEqual(problemsWith(() => {}), []);
});

test('missing or unknown evidence is refused', () => {
  assert.ok(problemsWith((d) => (d.products[0].evidence = [])).some((p) => /no evidence/.test(p)));
  assert.ok(problemsWith((d) => (d.products[0].evidence[0].sourceId = 'src-missing')).some((p) => /unknown source src-missing/.test(p)));
  assert.ok(problemsWith((d) => (d.decoder[0].sourceIds = [])).some((p) => /decoder B: unsourced/.test(p)));
  assert.ok(problemsWith((d) => (d.sources[0].establishes = '')).some((p) => /establishes/.test(p)));
  assert.ok(problemsWith((d) => (d.products[0].limitations = [])).some((p) => /limitation/.test(p)));
});

test('a normalised class may not add a subclass the document never printed', () => {
  assert.ok(problemsWith((d) => { d.products[0].classificationRaw = 'Euroclass B'; d.products[0].notation = 'Euroclass B'; }).some((p) => /normalised smoke s2 does not match/.test(p)));
  assert.ok(problemsWith((d) => { d.products[0].classificationRaw = 'B-s2 when adhered'; d.products[0].notation = 'B-s2'; }).some((p) => /normalised droplets d0 does not match/.test(p)));
  assert.ok(problemsWith((d) => { d.products[0].classificationRaw = 'Class 0'; d.products[0].notation = 'Class 0'; }).some((p) => /is not a European class/.test(p)));
  assert.ok(problemsWith((d) => { d.products[0].notation = 'B-s1,d0'; }).some((p) => /is not in the printed line/.test(p)), 'the notation must be copied from the printed line');
  assert.ok(problemsWith((d) => { d.products[0].classificationRaw = 'A1-s1,d0'; d.products[0].notation = 'A1-s1,d0'; d.products[0].classification = { class: 'A1', smoke: 's1', droplets: 'd0' }; }).some((p) => /not a valid combination/.test(p)));
  assert.deepEqual(problemsWith((d) => { d.products[0].classificationRaw = 'Euroclass B when adhered to a suitable substrate'; d.products[0].notation = 'Euroclass B'; d.products[0].classification = { class: 'B', smoke: null, droplets: null }; }), []);
  // Two documents disagreeing: no single class is shown, and the row must say why.
  const conflicting = (d: FireData) => { d.products[0].classificationRaw = 'Euroclass B (sheet); Euroclass C (web page)'; d.products[0].notation = null; d.products[0].classification = { class: null, smoke: null, droplets: null }; };
  assert.ok(problemsWith(conflicting).some((p) => /must say why/.test(p)));
  assert.deepEqual(problemsWith((d) => { conflicting(d); d.products[0].conflicts = ['The sheet says B; the web page says C.']; }), []);
});

test('a row must be a product, never a brand', () => {
  assert.ok(problemsWith((d) => (d.products[0].product = 'Maker')).some((p) => /never just the brand/.test(p)));
  assert.ok(problemsWith((d) => (d.products[0].scope = ' ')).some((p) => /scope/.test(p)));
});

test('dates: ISO, never in the future, and a later change is only ever forthcoming', () => {
  assert.ok(problemsWith((d) => (d.products[0].checked = '2027-01-01')).some((p) => /checked must be/.test(p)));
  assert.ok(problemsWith((d) => (d.sources[0].statedExpiry = 'March 2027')).some((p) => /statedExpiry must be ISO/.test(p)));
  const j = { id: 'x', name: 'X', document: 'd', edition: 'e', linings: 'l', nationalClasses: 'n', notes: [], sourceIds: ['src-x'] };
  assert.ok(problemsWith((d) => (d.jurisdictions = [{ ...j, dates: [{ label: 'later change', date: '2029-09-02', kind: 'effective' }] }])).some((p) => /must be marked forthcoming/.test(p)));
  assert.ok(problemsWith((d) => (d.jurisdictions = [{ ...j, dates: [{ label: 'old change', date: '2025-03-02', kind: 'forthcoming' }] }])).some((p) => /still marked forthcoming/.test(p)));
  assert.deepEqual(problemsWith((d) => (d.jurisdictions = [{ ...j, dates: [{ label: 'later change', date: '2029-09-02', kind: 'forthcoming' }] }])), []);
});

test('superseded or expired documents are flagged, not shown as current', () => {
  assert.ok(problemsWith((d) => (d.sources[0].status = 'superseded')).some((p) => /relies on superseded source/.test(p)));
  const expired = { ...src, statedExpiry: '2026-01-31' };
  const gaps = gapsFor(prod, '2026-10-15', () => expired);
  assert.ok(gaps.some((g) => g.kind === 'stated-expiry-passed'));
  assert.ok(gapsFor({ ...prod, status: 'superseded' }, '2026-10-15', () => src).some((g) => g.kind === 'superseded'));
});

test('gaps are derived from the record: unknown subclasses, missing build-up, sheet-only evidence', () => {
  const partial = { ...prod, classificationRaw: 'Euroclass B', notation: 'Euroclass B', classification: { class: 'B' as const, smoke: null, droplets: null }, testedBuildup: { substrate: null, adhesive: null, other: null }, fieldOfApplication: null, evidenceLevel: 'technical_sheet' as const };
  const kinds = gapsFor(partial, '2026-10-15', () => src).map((g) => g.kind);
  for (const kind of ['subclass-unknown', 'no-buildup', 'no-field-of-application', 'sheet-only']) assert.ok(kinds.includes(kind as never), kind);
  // A1 has no subclasses to be missing.
  assert.ok(!gapsFor({ ...prod, classificationRaw: 'A1', notation: 'A1', classification: { class: 'A1', smoke: null, droplets: null } }, '2026-10-15', () => src).some((g) => g.kind === 'subclass-unknown'));
});

test('the four named manufacturers are covered, each with product-level rows only', () => {
  for (const maker of ['Muraspec', 'Tektura', 'Vescom', 'Arte']) {
    assert.ok(products.some((p) => p.manufacturer.startsWith(maker)), `${maker} has at least one row`);
  }
  const text = JSON.stringify(products);
  assert.doesNotMatch(text, /\ball (muraspec|tektura|vescom|arte|newmor)\b[^"]{0,40}\b(products|wallcoverings|ranges)\b[^"]{0,40}\b(are|carry|achieve)\b/i, 'no brand-wide rating');
});

test('the 2025 and 2029 England changes are dated separately, and 2029 is forthcoming', () => {
  const england = jurisdictions.find((j) => j.id === 'england');
  assert.ok(england, 'England is listed');
  const dates = england!.dates.map((d) => `${d.date}:${d.kind}`);
  assert.ok(dates.includes('2025-03-02:effective'), 'national reaction-to-fire classes withdrawn from 2 March 2025');
  assert.ok(dates.includes('2029-09-02:forthcoming'), 'fire-resistance change scheduled for 2 September 2029');
  for (const j of jurisdictions) assert.ok(j.sourceIds.length, `${j.name} cites its source`);
  assert.deepEqual(jurisdictions.map((j) => j.id), ['england', 'wales', 'scotland', 'northern-ireland']);
});

test('public wording avoids absolute and misleading labels', () => {
  // Quoted words are warnings about other people's labels ("fireproof" should send you to the document); everything else is our own claim.
  // Prose (Markdown) may quote with straight or curly quotes; in JSON only curly quotes mark a quotation.
  const prose = readdirSync('src/content/fire-ratings').filter((f) => f.endsWith('.md')).map((f) => readFileSync(`src/content/fire-ratings/${f}`, 'utf8').replace(/[“"][^”"\n]{1,60}[”"]/g, ''));
  const json = ['src/content/fire-ratings/page.json', 'src/data/fire-ratings/products.json', 'src/data/fire-ratings/standards.json', 'src/data/fire-ratings/regulations.json'].map((f) => readFileSync(f, 'utf8').replace(/“[^”\n]{1,60}”/g, ''));
  const text = [...prose, ...json].join('\n');
  assert.doesNotMatch(text, /fire[- ]?proof|zero smoke|non-toxic smoke|non-flammable|safe (in|for) (every|any|all) (building|location)|fully compliant|guaranteed compliant/i);
  // A question ("Does Mr Wallcover certify…?") is allowed; a statement that we certify or approve is not.
  assert.doesNotMatch(text, /(?<!does )\b(we|mr wallcover) (certif(y|ies)|approve[sd]?)\b/i);
  // "UK law" appears only to say that none of the four systems is it.
  for (const m of text.matchAll(/[^.]*\bUK law\b[^.]*/g)) assert.match(m[0], /\b(not|none)\b/i, m[0]);
  assert.match(page.scope.notice, /not project-specific fire-safety approval/);
  // Who confirms: the building-work route and, for redecorating a building in use, the responsible person.
  assert.match(page.scope.notice, /for building work, the designer or fire engineer with the building-control body/);
  assert.match(page.scope.notice, /building in use that is not building work, the responsible person/);
});

test('every source is a primary document with a checking date, and the library groups them all', () => {
  for (const s of sources) {
    assert.match(s.accessed, /^\d{4}-\d{2}-\d{2}$/, s.id);
    assert.ok(s.establishes.length > 10, s.id);
    assert.doesNotMatch(s.url, /wikipedia|blog|medium\.com|linkedin/i, `${s.id} is not a primary source`);
  }
  assert.ok(sources.some((s) => s.group === 'england' && /Approved Document B/i.test(s.title)));
});


test("overlapping woven-vinyl declarations remain unresolved", () => {
  const row = products.find((p) => p.id === "muraspec-fbv-woven-type-i-360")!;
  assert.equal(row.notation, null);
  assert.equal(row.classification.class, null);
  assert.match(row.classificationRaw, /s1/);
  assert.match(row.classificationRaw, /s2/);
  assert.ok(row.evidence.some((e) => e.sourceId === "src-muraspec-dop-cpr0004-2024-bttg"));
  assert.ok(row.evidence.some((e) => e.sourceId === "src-muraspec-dop-cpr0001-2024"));
});
