import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { allowanceRange, calculate, closeCall, liningPlan, type PlanResult, type QuantityInput, type QuantityResult } from '../src/lib/quantity.ts';

/** Every row of the test table in docs/calculator/spec.md (signed off by the owner, 14 Oct 2026) is a test here. */

function plan(result: QuantityResult): PlanResult {
  assert.equal(result.ok, true, result.ok ? '' : result.reason);
  assert.ok(result.ok && result.kind === 'plan');
  return result as PlanResult;
}
const starts = (result: PlanResult, roll: number) => result.rolls[roll - 1].cuts.map((cut) => cut.atCm);
const wall = (widthCm: number, heightCm: number, extra: Partial<QuantityInput['walls'] extends (infer W)[] | undefined ? W : never> = {}) => ({ widthCm, heightCm, ...extra });

test('row 1, the owner\'s example: 230 × 265 wall, 55 cm × 10 m roll, 65 cm straight match → 5 drops, cut 325, 3 per roll, 2 rolls + 1 spare on its own line', () => {
  const r = plan(calculate({ paper: { widthCm: 55, lengthCm: 1000, repeatCm: 65, match: 'straight' }, walls: [wall(230, 265)] }));
  assert.equal(r.drops, 5);
  assert.equal(r.dropLengthCm, 275);
  assert.equal(r.cutPitchCm, 325);
  assert.equal(r.dropsPerRoll, 3);
  assert.equal(r.startLossCm, 65);
  assert.deepEqual(starts(r, 1), [65, 390, 715]);
  assert.equal(r.rolls[0].leftoverCm, 10);
  assert.deepEqual(starts(r, 2), [65, 390]);
  assert.deepEqual([r.working.count, r.spare.count, r.order.count], [2, 1, 3]);
  assert.equal(r.working.unit.many, 'rolls');
});

test('row 2: free match 400 × 240 on 52 cm × 10 m → 8 drops, cut 250, 4 per roll, 2 rolls', () => {
  const r = plan(calculate({ paper: { widthCm: 52, lengthCm: 1000, match: 'free' }, walls: [wall(400, 240)] }));
  assert.deepEqual([r.drops, r.dropLengthCm, r.dropsPerRoll, r.working.count, r.startLossCm], [8, 250, 4, 2, 0]);
});

test('row 3: the page\'s worked example, 500 × 270 on 53 cm × 10.05 m free → 10 drops, cut 280, 3 per roll, 4 rolls', () => {
  const r = plan(calculate({ paper: { widthCm: 53, lengthCm: 1005, match: 'free' }, walls: [wall(500, 270)] }));
  assert.deepEqual([r.drops, r.dropLengthCm, r.dropsPerRoll, r.working.count], [10, 280, 3, 4]);
});

test('row 4: straight 64 cm repeat, 400 × 240 on 52 cm × 10 m → cut 256, 3 per roll (a 4th would start at 832 and end at 1082), 3 rolls', () => {
  const r = plan(calculate({ paper: { widthCm: 52, lengthCm: 1000, repeatCm: 64, match: 'straight' }, walls: [wall(400, 240)] }));
  assert.equal(r.cutPitchCm, 256);
  assert.equal(r.dropsPerRoll, 3);
  assert.deepEqual(starts(r, 1), [64, 320, 576]);
  assert.equal(r.working.count, 3);
});

test('row 5: half-drop on the owner\'s wall → drop order, roll 1 cuts at 65, 357.5, 650; 2 rolls', () => {
  const r = plan(calculate({ paper: { widthCm: 55, lengthCm: 1000, repeatCm: 65, match: 'half' }, walls: [wall(230, 265)] }));
  assert.equal(r.method, 'drop-order');
  assert.deepEqual(starts(r, 1), [65, 357.5, 650]);
  assert.equal(r.working.count, 2);
});

test('row 6: half-drop where phase by phase wins → 300 × 280, 52 cm × 10 m, repeat 52: 2 rolls (drop order would need 3)', () => {
  const input: QuantityInput = { paper: { widthCm: 52, lengthCm: 1000, repeatCm: 52, match: 'half' }, walls: [wall(300, 280)] };
  const r = plan(calculate(input));
  assert.equal(r.drops, 6);
  assert.equal(r.method, 'phase');
  assert.deepEqual(starts(r, 1), [52, 364, 676]);
  assert.equal(r.working.count, 2);
  const noInfill = plan(calculate({ ...input, paper: { ...input.paper, noOffcutInfill: true } }));
  assert.equal(noInfill.working.count, 3, 'cut strictly in drop order it needs 3');
});

test('row 7: half-drop, both ways tie → 300 × 280, repeat 65: drop order kept, 2 rolls, cuts at 65, 357.5, 650', () => {
  const r = plan(calculate({ paper: { widthCm: 52, lengthCm: 1000, repeatCm: 65, match: 'half' }, walls: [wall(300, 280)] }));
  assert.equal(r.method, 'drop-order');
  assert.deepEqual(starts(r, 1), [65, 357.5, 650]);
  assert.equal(r.working.count, 2);
});

test('row 8: third drop, 300 × 250 on 52 cm × 10.05 m, repeat 63 → 6 drops of 260, roll 1 cuts at 63, 336, 609; 2 rolls', () => {
  const r = plan(calculate({ paper: { widthCm: 52, lengthCm: 1005, repeatCm: 63, match: 'third' }, walls: [wall(300, 250)] }));
  assert.equal(r.dropLengthCm, 260);
  assert.deepEqual(starts(r, 1), [63, 336, 609]);
  assert.equal(r.working.count, 2);
});

test('row 9: a whole room is one run → 400 × 350, height 270, 53 cm × 10.05 m free: run 1500, 29 drops, 10 rolls', () => {
  const r = plan(calculate({ paper: { widthCm: 53, lengthCm: 1005, match: 'free' }, room: { lengthCm: 400, widthCm: 350, heightCm: 270 } }));
  assert.equal(r.runs[0].widthCm, 1500);
  assert.equal(r.drops, 29);
  assert.equal(r.working.count, 10);
});

test('row 10: two walls entered separately are each rounded up → 110 × 240 twice: 3 + 3 = 6 drops (one run would be 5), 2 rolls', () => {
  const r = plan(calculate({ paper: { widthCm: 52, lengthCm: 1000, match: 'free' }, walls: [wall(110, 240), wall(110, 240)] }));
  assert.equal(r.drops, 6);
  assert.equal(r.working.count, 2);
});

test('row 11: a chimney breast adds its returns to the run → 330 across + 35 + 35, height 265: run 400, 8 drops, 3 rolls', () => {
  const r = plan(calculate({ paper: { widthCm: 55, lengthCm: 1000, repeatCm: 65, match: 'straight' }, walls: [wall(330, 265, { returnsCm: [35, 35] })] }));
  assert.equal(r.runs[0].widthCm, 400);
  assert.equal(r.drops, 8);
  assert.equal(r.working.count, 3);
});

test('row 12: a door saves a roll → 350 × 270, 53 cm × 10.05 m free, door 80 × 198: 6 full + 1 short of 82 from roll 1\'s offcut at 840; 2 rolls (3 without)', () => {
  const paper = { widthCm: 53, lengthCm: 1005, match: 'free' as const };
  const r = plan(calculate({ paper, walls: [wall(350, 270, { openings: [{ kind: 'door', widthCm: 80, heightCm: 198 }] })] }));
  assert.equal(r.fullDrops, 6);
  assert.equal(r.shortPieces, 1);
  const short = r.rolls.flatMap((roll) => roll.cuts.map((cut) => ({ ...cut, roll: roll.roll }))).find((cut) => cut.kind === 'above')!;
  assert.deepEqual([short.roll, short.lengthCm, short.atCm], [1, 82, 840]);
  assert.equal(r.working.count, 2);
  assert.equal(plan(calculate({ paper, walls: [wall(350, 270)] })).working.count, 3);
});

test('row 13: a window with side and head reveals → 6 full, 2 part-drops of 130, 2 above of 70, 2 below of 100, all on roll 3; 3 rolls', () => {
  const r = plan(calculate({
    paper: { widthCm: 55, lengthCm: 1000, repeatCm: 65, match: 'straight' },
    walls: [wall(400, 265, { openings: [{ kind: 'window', widthCm: 120, heightCm: 135, fromFloorCm: 90, depthCm: 20, reveals: 'sides-head' }] })],
  }));
  assert.equal(r.drops, 8);
  assert.equal(r.fullDrops, 6);
  assert.deepEqual(r.rolls.slice(0, 2).map((roll) => roll.leftoverCm), [10, 10]);
  assert.deepEqual(r.rolls[2].cuts.map((cut) => `${cut.kind} ${cut.lengthCm}@${cut.atCm}`), ['part 130@65', 'part 130@195', 'below 100@370', 'below 100@500', 'above 70@650', 'above 70@780']);
  assert.equal(r.working.count, 3);
});

test('row 14: a niche → 5 full + 1 over it; part-drops 150 + 150, above 125, below 95, back 90 + 90; 3 rolls (2 without)', () => {
  const paper = { widthCm: 53, lengthCm: 1005, match: 'free' as const };
  const r = plan(calculate({ paper, walls: [wall(300, 250, { openings: [{ kind: 'niche', widthCm: 60, heightCm: 80, fromFloorCm: 70, depthCm: 15 }] })] }));
  const kinds = r.rolls.flatMap((roll) => roll.cuts).filter((cut) => cut.kind !== 'full').map((cut) => `${cut.kind} ${cut.lengthCm}`).sort();
  assert.deepEqual(kinds, ['above 125', 'back 90', 'back 90', 'below 95', 'part 150', 'part 150']);
  assert.equal(r.fullDrops, 5);
  assert.equal(r.working.count, 3);
  assert.equal(plan(calculate({ paper, walls: [wall(300, 250)] })).working.count, 2);
});

test('row 15: no offcut infill, sold per linear metre → 600 × 270, usable 125, door 130 × 200: 4 full + 1 short of 80 in drop order, 1200 cm, 12 m + 3 m spare', () => {
  const r = plan(calculate({
    paper: { widthCm: 125, lengthCm: 3000, match: 'reverse', noOffcutInfill: true, soldBy: { kind: 'length', unit: 'm' } },
    walls: [wall(600, 270, { openings: [{ kind: 'door', widthCm: 130, heightCm: 200 }] })],
  }));
  assert.deepEqual(r.rolls[0].cuts.map((cut) => cut.kind), ['full', 'above', 'full', 'full', 'full']);
  assert.equal(r.usedCm, 1200);
  assert.deepEqual([r.working.count, r.working.unit.many, r.spare.count, r.order.count], [12, 'metres', 3, 15]);
});

test('row 16: US double roll 20.5 in × 33 ft → 8 drops, 4 per roll, 2 double rolls (4 single rolls as priced) + 1 spare double roll', () => {
  const r = plan(calculate({ paper: { widthCm: 52.07, lengthCm: 1005.84, match: 'free', soldBy: { kind: 'double-roll' } }, walls: [wall(400, 240)] }));
  assert.deepEqual([r.drops, r.dropsPerRoll, r.working.count, r.spare.count], [8, 4, 2, 1]);
  assert.equal(r.working.unit.many, 'double rolls');
  assert.equal(r.singleRollsPriced, 6, 'the order of 3 double rolls is 6 single rolls as priced');
});

test('row 17: bolts 36 in × 8 yd → 300 × 260: 4 drops of 270, 2 per bolt, 2 bolts + 1 spare bolt', () => {
  const r = plan(calculate({ paper: { widthCm: 91.44, lengthCm: 731.52, match: 'free', soldBy: { kind: 'bolt' } }, walls: [wall(300, 260)] }));
  assert.deepEqual([r.drops, r.dropLengthCm, r.dropsPerRoll, r.working.count, r.spare.count], [4, 270, 2, 2, 1]);
  assert.equal(r.working.unit.many, 'bolts');
});

test('row 18: a made-to-measure mural → 350 × 260 with a 10 cm maker margin: 360 × 270 = 9.72 m², then the request', () => {
  const r = calculate({ paper: { widthCm: 50, lengthCm: 1000, match: 'free', soldBy: { kind: 'mural', marginCm: 10 } }, walls: [wall(350, 260)] });
  assert.equal(r.ok && r.kind === 'mural' && `${r.widthCm} × ${r.heightCm} = ${r.areaM2}`, '360 × 270 = 9.72');
});

test('row 19: stairs, sloping ceilings, curved walls, ceilings and panel sets go to a request, with no count', () => {
  const paper = { widthCm: 53, lengthCm: 1005, match: 'free' as const };
  for (const bespoke of ['stairs', 'slope', 'curved', 'ceiling'] as const) {
    const r = calculate({ paper, walls: [wall(300, 250)], bespoke: [bespoke] });
    assert.equal(!r.ok && r.route, 'request', bespoke);
  }
  const panels = calculate({ paper: { ...paper, soldBy: { kind: 'panel-set' } }, walls: [wall(300, 250)] });
  assert.equal(!panels.ok && panels.route, 'request');
});

test('row 20: a drop too long for the roll → 400 × 990, 53 × 1005, repeat 64: no count, "Have Mr Wallcover check this"', () => {
  const r = calculate({ paper: { widthCm: 53, lengthCm: 1005, repeatCm: 64, match: 'straight' }, walls: [wall(400, 990)] });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.route, 'check');
    assert.match(r.reason, /Have Mr Wallcover check this/);
  }
});

test('row 21: bad input gives an error, never a count', () => {
  const paper = { widthCm: 53, lengthCm: 1005, match: 'free' as const };
  const cases: QuantityInput[] = [
    { paper, walls: [wall(0, 240)] },
    { paper, walls: [wall(-100, 240)] },
    { paper: { ...paper, lengthCm: 0 }, walls: [wall(400, 240)] },
    { paper: { ...paper, trimTopCm: -1 }, walls: [wall(400, 240)] },
    { paper: { ...paper, match: 'straight' }, walls: [wall(400, 240)] },
    { paper, walls: [] },
    { paper, walls: [wall(100, 240, { openings: [{ kind: 'door', widthCm: 200, heightCm: 198 }] })] },
    { paper, walls: [wall(300, 240, { openings: [{ kind: 'window', widthCm: 100, heightCm: 200, fromFloorCm: 90 }] })] },
  ];
  for (const input of cases) {
    const r = calculate(input);
    assert.equal(!r.ok && r.route, 'error', JSON.stringify(input));
  }
});

test('opening widths are checked against the measured wall, including the final partial strip', () => {
  const paper = { widthCm: 53, lengthCm: 1005, match: 'free' as const };
  // Both spans round to two strips, but a 100 cm opening still cannot fit in a 54 cm wall.
  const result = calculate({ paper, walls: [wall(54, 240, { openings: [{ kind: 'door', widthCm: 100, heightCm: 200 }] })] });
  assert.equal(!result.ok && result.route, 'error');
  if (!result.ok) assert.match(result.reason, /openings are wider than the wall/);
});

test('paper sold by length has a spare long enough for the tallest wall, regardless of entry order', () => {
  for (const match of ['free', 'straight'] as const) {
    const paper = { widthCm: 100, lengthCm: 3000, repeatCm: 65, match, soldBy: { kind: 'length' as const, unit: 'm' as const } };
    const shortFirst = plan(calculate({ paper, walls: [wall(100, 90), wall(100, 290)] }));
    const tallFirst = plan(calculate({ paper, walls: [wall(100, 290), wall(100, 90)] }));
    assert.equal(shortFirst.spare.count, match === 'free' ? 3 : 4);
    assert.equal(shortFirst.spare.count, tallFirst.spare.count);
  }
});

test('a long supplied roll reports its full capacity beyond 1000 drops', () => {
  const result = plan(calculate({ paper: { widthCm: 53, lengthCm: 30000, match: 'free', trimTopCm: 0, trimBottomCm: 0 }, walls: [wall(53, 20)] }));
  assert.equal(result.dropsPerRoll, 1500);
  assert.equal(result.working.count, 1);
});

test('non-representable dimensions and oversized plans refuse safely without allocating unbounded cuts', () => {
  const paper = { widthCm: 53, lengthCm: 1005, match: 'free' as const };
  const badInputs: QuantityInput[] = [
    { paper: { ...paper, widthCm: 0.00001 }, walls: [wall(500, 270)] },
    { paper: { ...paper, lengthCm: 0.00001 }, walls: [wall(500, 270)] },
    { paper: { ...paper, match: 'straight', repeatCm: 0.00001 }, walls: [wall(500, 270)] },
    { paper, walls: [wall(500, 0.00001)] },
    { paper, walls: [wall(Number.MAX_VALUE, 270)] },
    { paper: { ...paper, match: '' as QuantityInput['paper']['match'], repeatCm: 65 }, walls: [wall(500, 270)] },
    { paper: { ...paper, soldBy: { kind: 'bolt', minimumBolts: NaN } }, walls: [wall(500, 270)] },
  ];
  for (const input of badInputs) assert.equal(calculate(input).ok, false);
  const huge = calculate({ paper, walls: [wall(53 * 2001, 270)] });
  assert.equal(!huge.ok && huge.route, 'request');
  assert.equal(liningPlan({ paper, walls: [wall(500, 270)] }, 0.00001, 1000), null);
  assert.equal(liningPlan({ paper, walls: [wall(500, 270)] }, 53, 0.00001), null);
  assert.equal(liningPlan({ paper, walls: [wall(Number.MAX_VALUE, 270)] }, 53, 1000), null);
});

test('all six match modes keep cuts within each roll without overlaps, including millimetre boundary sizes', () => {
  const matches = ['free', 'reverse', 'straight', 'half', 'third', 'quarter'] as const;
  for (const match of matches) {
    for (const heightCm of [149.9, 150, 150.1, 265, 275.9, 276]) {
      const paper = { widthCm: 53, lengthCm: 1000, match, repeatCm: 65 };
      const result = plan(calculate({ paper, walls: [wall(371.1, heightCm)] }));
      assert.equal(result.drops, 8);
      assert.equal(result.rolls.flatMap((roll) => roll.cuts).length, result.fullDrops + result.shortPieces);
      for (const roll of result.rolls) {
        let end = 0;
        for (const cut of roll.cuts) {
          assert.ok(cut.atCm >= end - 0.1, `${match}: cuts overlap`);
          end = cut.atCm + cut.lengthCm;
          assert.ok(end <= paper.lengthCm + 0.1, `${match}: a cut extends past the roll`);
        }
        assert.ok(Math.abs(end + roll.leftoverCm - paper.lengthCm) <= 0.11);
      }
      if (match === 'free' || match === 'reverse') {
        const capacity = Math.floor(paper.lengthCm / (heightCm + 10));
        assert.equal(result.working.count, Math.ceil(8 / capacity));
      }
    }
  }
});

test('row 23: lining for the owner\'s wall, Erfurt 53 cm × 10 m hung across → 5 courses of 240, 4 per roll, 2 rolls; upright is counted too', () => {
  const input: QuantityInput = { paper: { widthCm: 55, lengthCm: 1000, repeatCm: 65, match: 'straight' }, walls: [wall(230, 265)] };
  const across = liningPlan(input, 53, 1000)!;
  assert.deepEqual([across.orientation, across.pieces, across.rolls], ['across', 5, 2]);
  const upright = liningPlan(input, 53, 1000, 'upright')!;
  assert.deepEqual([upright.pieces, upright.rolls], [5, 2]);
});

test('row 27: no result ever carries a price', () => {
  const r = calculate({ paper: { widthCm: 55, lengthCm: 1000, repeatCm: 65, match: 'straight' }, walls: [wall(230, 265)] });
  assert.equal(JSON.stringify(r).includes('£'), false);
});

test('row 28: walls of two heights share rolls → 230 × 265 and 110 × 120: roll 2 carries drops 4–5, then both 130 cm drops at 715 and 845; 2 rolls', () => {
  const r = plan(calculate({ paper: { widthCm: 55, lengthCm: 1000, repeatCm: 65, match: 'straight' }, walls: [wall(230, 265), wall(110, 120)] }));
  assert.deepEqual(r.rolls[1].cuts.map((cut) => `${cut.wall}:${cut.lengthCm}@${cut.atCm}`), ['1:275@65', '1:275@390', '2:130@715', '2:130@845']);
  assert.equal(r.working.count, 2);
});

test('row 29: the close call → height 272 says "4 cm more height would make this 3 working rolls"; 275 says 1 cm; 276 needs 3', () => {
  const at = (heightCm: number): [PlanResult, QuantityInput] => {
    const input: QuantityInput = { paper: { widthCm: 55, lengthCm: 1000, repeatCm: 65, match: 'straight' }, walls: [wall(230, heightCm)] };
    return [plan(calculate(input)), input];
  };
  const [r272, i272] = at(272);
  assert.equal(r272.working.count, 2);
  assert.deepEqual(closeCall(i272, r272), { extraCm: 4, dimension: 'height', working: 3 });
  const [r275, i275] = at(275);
  assert.deepEqual(closeCall(i275, r275), { extraCm: 1, dimension: 'height', working: 3 });
  assert.equal(at(276)[0].working.count, 3);
  const [r265, i265] = at(265);
  assert.equal(closeCall(i265, r265), null, 'the owner\'s wall is 11 cm from the next roll, so no warning');
});

test('sets: a paper sold in pairs is ordered and spared in whole sets', () => {
  const r = plan(calculate({ paper: { widthCm: 55, lengthCm: 1000, repeatCm: 65, match: 'straight', soldBy: { kind: 'set', rollsPerSet: 2 } }, walls: [wall(400, 265)] }));
  assert.equal(r.rolls.length, 3);
  assert.deepEqual([r.working.count, r.spare.count, r.order.count, r.working.unit.many], [2, 1, 3, 'sets of 2 rolls']);
});

test('the ordering allowance the site quotes elsewhere is unchanged: 13.5 m² on a 0.53 × 10.05 m roll is 3–4 rolls at 15–30%; stairs around 30%; murals get none', () => {
  const result = allowanceRange({ match: 'free', rollWidthM: 0.53, rollLengthM: 10.05, walls: [{ widthM: 5, heightM: 2.7 }] });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual([result.netAreaM2, result.minPct, result.maxPct, result.minRolls, result.maxRolls], [13.5, 15, 30, 3, 4]);
  const stair = allowanceRange({ match: 'stair', rollWidthM: 0.53, rollLengthM: 10.05, walls: [{ widthM: 5, heightM: 2.7 }] });
  if (stair.ok) assert.deepEqual([stair.minPct, stair.maxPct, stair.minRolls, stair.maxRolls], [30, 30, 4, 4]);
  assert.equal(allowanceRange({ match: 'mural', rollWidthM: 0.53, rollLengthM: 10.05, walls: [{ widthM: 5, heightM: 2.7 }] }).ok, false);
});

test('/calculator/ suggests the worked example in centimetres, never a confident answer for an unmeasured wall; the guide at /advice/quantities/ states the result it gives and points to the calculator', async () => {
  const calculator = await readFile('src/pages/calculator.astro', 'utf8');
  const guide = await readFile('src/pages/advice/quantities.astro', 'utf8');
  const value = (name: string) => Number(calculator.match(new RegExp(`name="${name}"[^>]*value="([0-9.]+)"`))![1]);
  // The wall inputs carry the example as a placeholder (design brief P1.6), so the docket waits for a real measurement.
  const example = (name: string) => Number(calculator.match(new RegExp(`name="${name}"[^>]*placeholder="e\\.g\\. ([0-9.]+)"`))![1]);
  assert.doesNotMatch(calculator, /name="(width|height|roomLength|roomWidth|roomHeight)"[^>]*value=/, 'no wall is measured until the visitor types it');
  const r = plan(calculate({ paper: { widthCm: value('rollWidth'), lengthCm: value('rollLength') * 100, match: 'free' }, walls: [wall(example('width'), example('height'))] }));
  assert.deepEqual([example('width'), example('height'), value('rollWidth'), value('rollLength')], [500, 270, 53, 10.05]);
  assert.equal(r.working.count, 4);
  assert.match(guide, /Ten drops at three per roll is 4 rolls/);
  assert.match(guide, /<a href="\/calculator\/">calculator<\/a> and it gives 4, plus the spare/);
  assert.match(guide, /65 \+ 325 \+ 325 \+ 275 is 990 cm/, 'the owner\'s example is explained on the guide');
  assert.match(guide, /href="\/calculator\/">Open the calculator/);
  assert.match(guide, /location\.replace\('\/calculator\/' \+ q/, 'an old link carrying a calculation is forwarded');
  assert.doesNotMatch(guide, /data-quantity/, 'the form lives on /calculator/ only');
  for (const page of [calculator, guide]) {
    assert.doesNotMatch(page, /refuses half-drop|10-metre roll|0\.5 metres wide/);
    assert.doesNotMatch(page, /£/);
  }
});
