import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculate, type PlanResult, type QuantityResult } from '../src/lib/quantity.ts';
import { convert, formatGroups, formatLabel, formats, groupOf, rollFormats, soldByFor, toCm } from '../src/lib/roll-formats.ts';

const plan = (result: QuantityResult): PlanResult => {
  assert.ok(result.ok && result.kind === 'plan', JSON.stringify(result));
  return result as PlanResult;
};

test('every preset is a size a maker prints, with its source', () => {
  const ids = new Set<string>();
  for (const format of formats) {
    assert.ok(!ids.has(format.id), `duplicate id ${format.id}`);
    ids.add(format.id);
    assert.ok(formatGroups.some((group) => group.id === format.group), `${format.id}: unknown group`);
    if (format.group === 'mural' || format.group === 'panel-set') continue;
    assert.ok(format.width && format.width > 0, `${format.id}: width`);
    assert.ok(['cm', 'in'].includes(format.widthUnit!), `${format.id}: width unit`);
    assert.ok(['m', 'ft', 'yd'].includes(format.lengthUnit!), `${format.id}: length unit`);
    assert.ok(format.length === null ? groupOf(format).soldBy === 'length' : format.length! > 0, `${format.id}: only paper sold by length may leave the length open`);
    assert.match(format.source?.url ?? '', /^https:\/\//, `${format.id}: source link`);
    assert.ok(format.source?.label, `${format.id}: source label`);
  }
  // Ids from the first version stay, so a link someone copied still opens the same size.
  for (const id of ['standard', 'roll-52', 'us-double', 'us-double-27', 'bolt', 'length', 'mural', 'panel-set']) assert.ok(ids.has(id), id);
  assert.match(rollFormats.checked, /^\d{4}-\d{2}-\d{2}$/);
});

test('labels read as sizes, with metric beside imperial', () => {
  const byId = (id: string) => formats.find((format) => format.id === id)!;
  assert.equal(formatLabel(byId('standard')), 'Standard roll, 53 cm × 10.05 m');
  assert.equal(formatLabel(byId('us-double-27')), '27 in × 27 ft (68.6 cm × 8.23 m)');
  assert.equal(formatLabel(byId('length')), '130 cm × 30 m, 5 cm overlap');
  assert.equal(formatLabel(byId('mural')), 'Made-to-measure mural, by the m²');
});

test('units convert exactly', () => {
  assert.equal(toCm(27, 'in'), 68.58);
  assert.equal(toCm(33, 'ft'), 1005.84);
  assert.equal(toCm(8, 'yd'), 731.52);
  assert.equal(convert(53, 'cm', 'in'), 20.87);
  assert.equal(convert(10.05, 'm', 'ft'), 32.97);
});

test('each group orders in its own unit', () => {
  const unitOf = (id: string, rollsPerSet?: number) => soldByFor(formatGroups.find((group) => group.id === id)!, { rollsPerSet });
  assert.deepEqual(unitOf('roll'), { kind: 'roll' });
  assert.deepEqual(unitOf('double-roll'), { kind: 'double-roll' });
  assert.deepEqual(unitOf('set', 3), { kind: 'set', rollsPerSet: 3 });
  assert.deepEqual(unitOf('length-m'), { kind: 'length', unit: 'm' });
  assert.deepEqual(unitOf('length-yd'), { kind: 'length', unit: 'yd' });
});

test('any width the owner named works: 45, 55, 68, 80, 90 cm and 1 m (owner, 17 Oct 2026)', () => {
  for (const widthCm of [45, 55, 68, 80, 90, 100]) {
    const r = plan(calculate({ paper: { widthCm, lengthCm: 1005, match: 'free' }, walls: [{ widthCm: 500, heightCm: 270 }] }));
    assert.equal(r.drops, Math.ceil(500 / widthCm), `${widthCm} cm`);
  }
  // A US double roll typed in inches and feet: 20.5 in × 33 ft.
  const us = plan(calculate({ paper: { widthCm: toCm(20.5, 'in'), lengthCm: toCm(33, 'ft'), match: 'free', soldBy: { kind: 'double-roll' } }, walls: [{ widthCm: 500, heightCm: 270 }] }));
  assert.equal(us.drops, 10);
  // Wide goods by the yard: 54 in less a 5 cm overlap.
  const yd = plan(calculate({ paper: { widthCm: toCm(54, 'in') - 5, lengthCm: 0, match: 'free', soldBy: { kind: 'length', unit: 'yd' } }, walls: [{ widthCm: 1200, heightCm: 280 }] }));
  assert.equal(yd.drops, Math.ceil(1200 / (137.16 - 5)));
  assert.equal(yd.working.unit.one, 'yard');
  // A set of two rolls is ordered in whole sets.
  const set = plan(calculate({ paper: { widthCm: 52, lengthCm: 1000, match: 'free', soldBy: { kind: 'set', rollsPerSet: 2 } }, walls: [{ widthCm: 500, heightCm: 270 }] }));
  assert.equal(set.working.unit.one, 'set of 2 rolls');
});

test('the calculator page takes any width, in cm or inches, and suggests the common ones', () => {
  const page = readFileSync(new URL('../src/pages/calculator.astro', import.meta.url), 'utf8');
  assert.match(page, /name="widthUnit"[\s\S]*?<option value="cm">cm<\/option><option value="in">in<\/option>/);
  assert.match(page, /name="lengthUnit"[\s\S]*?<option value="m">m<\/option><option value="ft">ft<\/option><option value="yd">yd<\/option>/);
  assert.match(page, /name="overlap"/);
  assert.match(page, /name="rollsPerSet"/);
  assert.match(page, /list="qc-widths"/);
  for (const width of [45, 55, 68, 80, 90, 100]) assert.ok(rollFormats.widthSuggestions.cm.includes(width), `${width} cm is suggested`);
  assert.match(page, /Another size: type it below/);
  assert.match(page, /name="mu" value="cm" checked/, 'walls are measured in cm unless the visitor picks m, inches or feet');
  assert.equal((page.match(/data-dim="/g) ?? []).length, 17, 'every size on the form is converted to cm');
});

test('the retained footer calls it Wallpaper calculator after the six-link navigation change', () => {
  const menu = JSON.parse(readFileSync(new URL('../src/content/navigation.json', import.meta.url), 'utf8')) as { href: string; label: string }[];
  assert.equal(menu.length,6);
  assert.equal(menu.some(item=>item.href==='/calculator/'),false);
  const footer=readFileSync(new URL('../src/components/Footer.astro',import.meta.url),'utf8');
  assert.match(footer,/href:\s*['"]\/calculator\/['"],\s*label:\s*['"]Wallpaper calculator['"]/);
});

test('the calculator page follows the design brief: answer beside the form, one status sentence, the strips', () => {
  const page = readFileSync(new URL('../src/pages/calculator.astro', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../src/scripts/quantity-ui.ts', import.meta.url), 'utf8');
  assert.match(page, /<h2 id="calculator-heading" class="sr-only">Roll calculator<\/h2>/, 'the H2 no longer repeats the H1 on screen');
  assert.match(page, /<aside class="qc-docket"[^>]*aria-labelledby="qc-docket-heading"/, 'the order docket sits beside the form');
  assert.match(page, /role="status" data-qc-status/, 'one status line, always present');
  assert.doesNotMatch(page, /class="qc-result"[^>]*aria-live/, 'the whole result is not read out on every change');
  assert.match(page, /class="qc-seg"/, 'brand segmented controls in step 2');
  assert.doesNotMatch(page, /£/);
  assert.match(script, /qc-roll-bar/, 'the cutting plan is drawn as roll strips');
  assert.match(script, /Not a set-out, not a price\./, 'the honesty line stays');
  assert.match(script, /track\('calculator_complete'/);
  assert.equal((script.match(/track\('calculator_complete'/g) ?? []).length, 1, 'analytics counts a calculation once, on submit');
});
