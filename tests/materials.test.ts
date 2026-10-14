import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

test('the house pastes (owner, 14 Oct 2026): every one is on the ladder with a source; Tektura and the top step route the lining to a check', async () => {
  const { products, liningPaste, maker } = await import('../src/lib/materials.ts');
  const house = products.filter((item) => item.kind === 'paste' && item.role === 'house');
  for (const brand of ['Ciret Ltd (Beeline)', 'Brewers (Albany)', 'Roman Decorating Products']) assert.ok(house.some((item) => item.maker === brand), brand);
  for (const item of house) {
    assert.ok(item.step && item.step >= 1 && item.step <= 4, `${item.id} has a step`);
    assert.equal(item.stepStatus, 'owner', item.id);
    assert.ok(item.page || item.dataSheet, `${item.id} has a source`);
  }
  assert.equal(products.find((item) => item.id === 'roman-pro-880')!.step, 2, 'PRO-880 moved to Standard');
  assert.equal(products.find((item) => item.id === 'beeline-heavy')!.step, 3);
  assert.equal(products.find((item) => item.id === 'albany-super-smooth')!.step, 1);
  const tektura = liningPaste(null, 'tektura');
  assert.equal(tektura.ok, false);
  if (!tektura.ok) assert.match(tektura.reason, /Tekfix/);
  assert.equal(liningPaste(4).ok, false, 'PRO-732, 111, PRO-555 and the Vescom 2000 + 3000 mix sit at the top step');
  assert.match(maker('vescom')!.pastePrinted ?? '', /Use only Vescom adhesive/);
  // Names the owner keeps off the site, as SHA-256 fingerprints so this public test does not publish them.
  const unnamed = new Set(['3a68ef6f0d873650a9a1f74ce6f76b91ebc18601978e9ae5f454d411ba51526c', '928f634e7bf43f6d70f3e079a6c29cf84c5b6bdc0491bb72303dff58a760ba70']);
  const words = JSON.stringify(products).toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  assert.equal(words.some((word) => unnamed.has(createHash('sha256').update(word).digest('hex'))), false);
});

test('the ladder reads Light, Medium, Heavy, Extra-heavy (owner, 14 Oct 2026); a sealed wall gets a VOV adhesive, never a water-based paste', async () => {
  const { wallpapering, ladderLabel, materialsFor, vovAdhesives } = await import('../src/lib/materials.ts');
  const { calculate } = await import('../src/lib/quantity.ts');
  assert.deepEqual(wallpapering.ladder.map((step) => step.label), ['Light', 'Medium', 'Heavy', 'Extra-heavy']);
  assert.equal(wallpapering.ladder[3].alt, 'special heavyweight');
  assert.equal(ladderLabel(2), 'Medium');
  assert.deepEqual(vovAdhesives.map((item) => item.id).sort(), ['beeline-overlap-repair', 'murabond-sealed-surface', 'tekfix-vov', 'vescom-3000']);
  for (const item of vovAdhesives) assert.equal(item.step, null, `${item.id} is not on the ladder`);
  const page = await (await import('node:fs/promises')).readFile('src/pages/wallpapering/lining-and-adhesives.astro', 'utf8');
  assert.match(page, /we hang grasscloth, fabric, hessian and linen with a Medium-grade paste/, 'woven goods default to Medium on the hub (owner, 14 Oct 2026)');
  const input = { paper: { widthCm: 53, lengthCm: 1005, match: 'free' as const }, walls: [{ widthCm: 400, heightCm: 250 }] };
  const result = calculate(input);
  assert.ok(result.ok && result.kind === 'plan');
  if (!result.ok || result.kind !== 'plan') return;
  const generic = materialsFor(input, result, { condition: 'sealed' });
  assert.deepEqual(generic.lines.map((line) => line.name), ['A vinyl-over-vinyl adhesive (VOV) made for sealed surfaces']);
  assert.equal(generic.checks.length, 1, 'a sealed wall is checked with us');
  const muraspec = materialsFor(input, result, { condition: 'sealed', makerId: 'muraspec' });
  assert.equal(muraspec.lines[0].name, 'Murabond Sealed Surface Adhesive (vinyl-over-vinyl use)');
  assert.equal(muraspec.lines[0].amount, '1.43–1.67 kg: 1 × 5 kg', '10 m² at the label\'s 6/7 m² per kg');
  const tektura = materialsFor(input, result, { condition: 'sealed', makerId: 'tektura' }).lines[0];
  assert.equal(tektura.name, 'Tekfix Vinyl over Vinyl (Tekfix VOV)');
  assert.equal(tektura.amount, null, 'no amount from an archived page');
  assert.match(tektura.note ?? '', /check availability/);
});
