import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HOUSE_LINING_PASTE, liningPaste, packsFor, pasteKg, primerLitres, product, products, makers } from '../src/lib/materials.ts';

test('every product and maker row carries a source and a check date, and confirmed figures are as printed', () => {
  for (const item of products) {
    if (item.status !== 'confirmed') continue;
    assert.ok(item.page || item.dataSheet, `${item.id} has a source`);
    assert.match(item.checked ?? '', /^\d{4}-\d{2}-\d{2}$/, `${item.id} has a check date`);
    if (item.coverage) assert.ok(item.coverage.printed.length > 5, `${item.id} keeps the printed coverage`);
  }
  for (const rule of makers) {
    assert.match(rule.source, /^https:\/\//, `${rule.id} has a source`);
    assert.match(rule.checked, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(product('zinsser-gardz').coverage?.printed.startsWith('Approximately 9 - 11m2/ litre'), true);
  assert.equal(product(HOUSE_LINING_PASTE).coverage?.printed.startsWith('A coverage rate of 1Kg per 5m2'), true);
});

test('spec row 22: Gardz for the owner\'s 230 × 265 wall is 0.55–0.68 litres, one coat, one 1 L tin', () => {
  const litres = primerLitres(2.3 * 2.65, product('zinsser-gardz'));
  assert.deepEqual(litres, { min: 0.55, max: 0.68 });
  assert.deepEqual(packsFor(litres!.max, product('zinsser-gardz').packs!.sizes!), [1]);
});

test('spec row 23: Wallrock Power for the same wall is 1.22 kg, one 5 kg tub; 12 kg is a 10 kg and a 5 kg tub', () => {
  const kg = pasteKg(2.3 * 2.65, product('wallrock-power'));
  assert.equal(kg, 1.22);
  assert.deepEqual(packsFor(kg!, [5, 10]), [5]);
  assert.deepEqual(packsFor(12, [5, 10]), [10, 5]);
  assert.deepEqual(packsFor(20, [5, 10]), [10, 10]);
});

test('spec rows 24–26: the lining paste is at least one step stronger, or the maker decides', () => {
  const ok = liningPaste(2);
  assert.equal(ok.ok && ok.pasteName, 'Wallrock Power Adhesive');
  const top = liningPaste(4);
  assert.equal(top.ok, false);
  if (!top.ok) assert.match(top.reason, /Have Mr Wallcover check this/);
  const same = liningPaste(3, 'de-gournay', 'de Gournay Red Lidded Paste');
  assert.equal(same.ok && same.rule, 'maker-same');
  if (same.ok) assert.match(same.note, /replaces our house rule/);
  const named = liningPaste(1, 'muraspec');
  assert.equal(named.ok && named.pasteName, 'Murabond Heavy');
});

test('unconfirmed products never feed a quantity', () => {
  const draft = { ...product('zinsser-gardz'), status: 'unconfirmed' as const };
  assert.equal(primerLitres(10, draft), null);
});

test('the materials list under a result: primer, lining across, the maker\'s paste with its printed quantity, and a lining paste a step stronger', async () => {
  const { calculate } = await import('../src/lib/quantity.ts');
  const { materialsFor } = await import('../src/lib/materials.ts');
  const input = { paper: { widthCm: 55, lengthCm: 1000, repeatCm: 65, match: 'straight' as const }, walls: [{ widthCm: 230, heightCm: 265 }] };
  const result = calculate(input);
  assert.ok(result.ok && result.kind === 'plan');
  if (!result.ok || result.kind !== 'plan') return;
  const plain = materialsFor(input, result);
  assert.deepEqual(plain.lines.map((line) => line.name), ['Zinsser Gardz', 'The paste the wallpaper maker names']);
  assert.deepEqual(plain.assumed, ['The walls are painted and sound.']);
  const cole = materialsFor(input, result, { condition: 'stripped', makerId: 'cole-and-son' });
  assert.deepEqual(cole.lines.map((line) => `${line.role}: ${line.name}: ${line.amount}`), [
    'primer: Zinsser Gardz: 0.55–0.68 litres: 1 × 1 L',
    'lining: Erfurt MAV Professional Lining Paper, 1000 grade: 2 × 10 m rolls, or 1 × 20 m',
    'paste: Cole & Son Wallcovering Paste: 2 kg: 1 × 2.5 kg',
    'lining-paste: Wallrock Power Adhesive: 1.22 kg: 1 × 5 kg',
  ]);
  assert.match(cole.lines[1].note ?? '', /same thickness and the same white/);
  const gournay = materialsFor(input, result, { condition: 'sound', makerId: 'de-gournay' });
  const liningPasteLine = gournay.lines.find((line) => line.role === 'lining-paste')!;
  assert.match(liningPasteLine.note ?? '', /replaces our house rule/);
  assert.equal(gournay.lines.find((line) => line.role === 'lining')!.name, 'Erfurt MAV Professional Lining Paper, 1000 grade', 'de Gournay: 1000 or 1200, the lightest that suits the wall');
  const stains = materialsFor(input, result, { condition: 'stains' });
  assert.deepEqual(stains.lines.slice(0, 2).map((line) => line.name), ['Zinsser B-I-N', 'Zinsser Gardz']);
  assert.equal(stains.checks.length, 1);
  assert.equal(JSON.stringify([plain, cole, gournay, stains]).includes('£'), false);
});
