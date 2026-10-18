import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  classes, decoderExamples, dropletClasses, englandLinings, formatClassification,
  gapsFor, jurisdictions, products, smokeClasses, sources, standards,
} from '../src/lib/fire-ratings.ts';
import { formatLabel, rollFormats } from '../src/lib/roll-formats.ts';

// These exercise the built public representations, including their publication
// boundaries and the cautions an assistant must retain when reading the numbers.
const SITE = 'https://www.mrwallcover.com';
const read = (file: string) => readFileSync(file, 'utf8');
const json = (file: string) => JSON.parse(read(file));
const wallpapering = json('src/data/wallpapering.json');
const page = json('src/content/fire-ratings/page.json');
const wallpaper = json('dist/ai/wallpapering.json');
const fire = json('dist/ai/fire-ratings.json');
const ids = (items: { id: string }[]) => items.map((item) => item.id).sort();
const plain = (value: string) => value.replace(/<[^>]*>/g, ' ')
  .replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

test('the two semantic datasets identify real public source pages and retain checking dates', () => {
  for (const [dataset, endpoint] of [[wallpaper, 'wallpapering'], [fire, 'fire-ratings']] as const) {
    assert.equal(dataset.schemaVersion, '1.0');
    assert.equal(dataset.url, `${SITE}/ai/${endpoint}.json`);
    assert.match(dataset.checked, /^\d{4}-\d{2}-\d{2}$/);
    for (const url of dataset.sourceUrls ?? [dataset.sourceUrl]) {
      assert.equal(new URL(url).origin, SITE);
      assert.ok(existsSync(`dist${new URL(url).pathname}index.html`), url);
    }
  }
  assert.equal(wallpaper.checked, wallpapering.checked);
  assert.equal(fire.checked, json('src/data/fire-ratings/products.json').checked);
  assert.deepEqual(fire.sourceCheckDates, [...new Set(sources.map((source) => source.accessed))].sort());
  assert.equal(fire.published, page.published);
  assert.equal(fire.updated, page.updated);
  assert.deepEqual(fire.scope, page.scope, 'all published fire-safety scope and limitations are retained verbatim');
});

test('wallpapering includes precisely the public table products and confirmed maker rules', () => {
  const visible = wallpapering.products.filter((item: any) => item.status === 'confirmed' && (
    ['primer', 'stain-block', 'alkali-primer', 'vov'].includes(item.kind)
    || (item.kind === 'lining' && item.role === 'house')
    || item.id === 'wallrock-power'
    || (item.kind === 'paste' && item.role !== 'reference')
  ));
  assert.deepEqual(ids(wallpaper.products), ids(visible));
  assert.deepEqual(ids(wallpaper.makers), ids(wallpapering.makers.filter((item: any) => item.status === 'confirmed')));
  const publicTables = plain(read('dist/wallpapering/lining-and-adhesives/index.html'));
  for (const item of wallpaper.products) {
    const original = visible.find((value: any) => value.id === item.id);
    assert.ok(original, item.id);
    assert.equal(item.name, original.name);
    assert.equal(item.checked, original.checked);
    assert.equal(item.status, 'confirmed');
    assert.notEqual(item.role, 'reference');
    assert.equal(item.coverage?.printed, original.coverage?.printed);
    assert.equal(item.coverage?.conflict, original.coverage?.conflict);
    assert.equal(item.packs?.printed, original.packs?.printed);
    assert.equal(item.availability, original.availability);
    assert.equal(item.dataSheet, original.dataSheet);
    assert.equal(item.page, original.page);
    if (item.kind !== 'lining') assert.ok(publicTables.includes(plain(item.name)), `${item.id} is in the public table`);
    else assert.ok(publicTables.includes(plain(item.wall)), `${item.id} lining wording is public`);
    if (item.step != null) {
      assert.equal(original.stepStatus, 'owner', `${item.id} has an approved house position`);
      assert.equal(item.stepStatus, 'house-practice');
    }
  }
  for (const maker of wallpaper.makers) {
    assert.ok(publicTables.includes(plain(maker.name)), `${maker.id} is in the public maker table`);
    const original = wallpapering.makers.find((value: any) => value.id === maker.id);
    assert.deepEqual(maker.lining, original.lining);
    assert.deepEqual(maker.notes, original.notes);
    assert.equal(maker.source, original.source);
    assert.equal(maker.checked, original.checked);
    if (original.pasteStatus === 'unconfirmed') {
      assert.equal(maker.pasteStatus, 'unconfirmed');
      assert.equal(maker.pastePrinted, null, 'blocked historical paste wording is not a public prescription');
      assert.equal(maker.paste, null);
      assert.equal(maker.pasteCoverage, null);
      assert.equal(maker.pasteName, 'Confirm for the specific product');
      assert.equal(maker.pasteStep, undefined);
    }
  }
  for (const id of ['timorous-beasties', 'schumacher']) assert.ok(!ids(wallpaper.makers).includes(id));
  assert.ok(!ids(wallpaper.products).includes('bartoline-professional'));
});

test('preparation data stays house practice and roll formats retain units, source URLs and dates', () => {
  assert.deepEqual(wallpaper.houseRules, wallpapering.houseRules);
  assert.deepEqual(wallpaper.ladder, wallpapering.ladder);
  assert.deepEqual(wallpaper.wallTypes, wallpapering.wallTypes);
  assert.deepEqual(wallpaper.conditions, wallpapering.conditions);
  assert.deepEqual(wallpaper.conditionQuestion.options, wallpapering.conditionQuestion.options);
  assert.equal(wallpaper.conditionQuestion.basis, 'house-practice');
  assert.match(wallpaper.interpretation.pasteScale, /our house scale/);
  assert.equal(wallpaper.vov.text, wallpapering.vov.text);
  assert.equal(wallpaper.rollFormats.checked, rollFormats.checked);
  assert.deepEqual(wallpaper.rollFormats.groups, rollFormats.groups);
  assert.deepEqual(wallpaper.rollFormats.widthSuggestions, rollFormats.widthSuggestions);
  assert.deepEqual(ids(wallpaper.rollFormats.formats), ids(rollFormats.formats));
  const calculator = read('dist/calculator/index.html');
  for (const format of wallpaper.rollFormats.formats) {
    const original = rollFormats.formats.find((item) => item.id === format.id)!;
    assert.equal(format.label, formatLabel(original));
    for (const key of ['group', 'width', 'widthUnit', 'length', 'lengthUnit', 'overlapCm', 'rollsPerSet', 'source']) {
      assert.deepEqual(format[key], original[key as keyof typeof original], `${format.id}.${key}`);
    }
    assert.ok(calculator.includes(`value="${format.id}"`), `${format.id} is a published preset`);
    if (format.source) assert.match(format.source.url, /^https:\/\//);
  }
});

test('fire products preserve exact printed classes, gaps and build-up limitations without inferring subclasses', () => {
  assert.deepEqual(ids(fire.products), ids(products));
  const html = read('dist/advice/wallcovering-fire-ratings-uk/index.html');
  for (const item of fire.products) {
    const original = products.find((product) => product.id === item.id)!;
    const row = html.match(new RegExp(`<tr id="product-${item.id}">[\\s\\S]*?</tr>`))?.[0];
    assert.ok(row, `${item.id} is a public product row`);
    assert.equal(item.sourceUrl, `${SITE}/advice/wallcovering-fire-ratings-uk/#product-${item.id}`);
    for (const key of ['classificationRaw', 'notation', 'classification', 'testedBuildup', 'fieldOfApplication', 'limitations', 'conflicts', 'unresolved', 'status', 'evidenceLevel', 'checked']) {
      assert.deepEqual(item[key], original[key as keyof typeof original], `${item.id}.${key}`);
    }
    assert.deepEqual(item.gaps, gapsFor(original));
    if (item.notation) assert.equal(item.reading, formatClassification(original.classification));
    for (const caution of [...item.limitations, ...item.gaps.map((gap: any) => gap.text)]) {
      assert.ok(plain(row!).includes(plain(caution)), `${item.id} preserves public caution ${caution}`);
    }
    for (const evidence of item.evidence) assert.ok(sources.some((source) => source.id === evidence.sourceId));
  }
  assert.match(fire.productEvidenceNotice, /not a list of approved products/);
  assert.deepEqual(fire.checklists, page.checklists);
  assert.deepEqual(fire.faq, page.faq);
});

test('fire standards, regulations, decoder and source library retain public qualifiers and dates', () => {
  assert.deepEqual(fire.standards, standards);
  assert.deepEqual(fire.regulations.jurisdictions, jurisdictions);
  for (const key of ['document', 'table', 'rows', 'notes', 'sourceIds']) {
    assert.deepEqual(fire.regulations.englandLinings[key], englandLinings[key as keyof typeof englandLinings]);
  }
  assert.deepEqual(fire.decoder.classes, classes);
  assert.deepEqual(fire.decoder.smoke, smokeClasses);
  assert.deepEqual(fire.decoder.droplets, dropletClasses);
  assert.deepEqual(fire.decoder.examples, decoderExamples);
  assert.deepEqual(ids(fire.sources), ids(sources));
  const html = read('dist/advice/wallcovering-fire-ratings-uk/index.html');
  for (const source of fire.sources) {
    const original = sources.find((item) => item.id === source.id)!;
    for (const key of ['url', 'issued', 'effective', 'statedExpiry', 'accessed', 'establishes', 'limits', 'status']) {
      assert.deepEqual(source[key], original[key as keyof typeof original], `${source.id}.${key}`);
    }
    assert.ok(html.includes(`id="${source.id}"`), `${source.id} appears in the public source library`);
    assert.ok(html.includes(source.url.replace(/&/g, '&amp;')), `${source.id} links its public evidence`);
  }
});

test('internal notes and unused fields cannot leak through either dataset projection', () => {
  const forbidden = new Set(['_note', 'ownerChoice', 'prepStatus', 'housePasteMakers', 'sha256', 'testMethodsCited', 'productStandardCited', 'pageRef', 'pasteStepStatus']);
  const inspect = (value: any, at: string) => {
    if (Array.isArray(value)) return value.forEach((item, i) => inspect(item, `${at}[${i}]`));
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      assert.ok(!key.startsWith('_') && !forbidden.has(key), `${at}.${key} is not an allowed public field`);
      inspect(item, `${at}.${key}`);
    }
  };
  inspect(wallpaper, 'wallpapering');
  inspect(fire, 'fire-ratings');
});
