import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { estimateRolls } from '../src/lib/quantity.ts';

const roll = { rollWidthM: 0.52, rollLengthM: 10, trimM: 0.1 };

test('free-match fixture: one plain wall needs 2 rolls', () => {
  const result = estimateRolls({
    ...roll,
    match: 'free',
    walls: [{ widthM: 4, heightM: 2.4 }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.walls[0].drops, 8);
  assert.equal(result.walls[0].cutLengthM, 2.5);
  assert.equal(result.walls[0].dropsPerRoll, 4);
  assert.equal(result.rolls, 2);
  assert.match(result.assumptions.join(' '), /not a quotation/i);
});

test('straight-match fixture: 0.64m repeat needs 3 rolls', () => {
  const result = estimateRolls({
    ...roll,
    match: 'straight',
    repeatM: 0.64,
    walls: [{ widthM: 4, heightM: 2.4 }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.walls[0].cutLengthM, 2.56);
  assert.equal(result.walls[0].dropsPerRoll, 3);
  assert.equal(result.rolls, 3);
});

test('two walls are counted separately and partial rolls are not shared', () => {
  const result = estimateRolls({
    ...roll,
    match: 'free',
    walls: [
      { widthM: 4, heightM: 2.4 },
      { widthM: 4, heightM: 2.4 },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.rolls, 4);
});

test('refuses half-drop, murals, stairs and panels', () => {
  for (const match of ['half-drop', 'mural', 'stair', 'panel'] as const) {
    const result = estimateRolls({ ...roll, match, walls: [{ widthM: 4, heightM: 2.4 }] });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /not|need/i);
  }
});

test('rejects zero, negative and impossible rolls', () => {
  assert.equal(estimateRolls({ ...roll, match: 'free', walls: [{ widthM: 0, heightM: 2.4 }] }).ok, false);
  assert.equal(estimateRolls({ ...roll, match: 'free', walls: [{ widthM: -1, heightM: 2.4 }] }).ok, false);
  assert.equal(estimateRolls({ ...roll, rollLengthM: 0, match: 'free', walls: [{ widthM: 4, heightM: 2.4 }] }).ok, false);
  assert.equal(estimateRolls({ ...roll, rollLengthM: 1, match: 'free', walls: [{ widthM: 4, heightM: 2.4 }] }).ok, false);
  assert.equal(estimateRolls({ ...roll, trimM: -0.2, match: 'free', walls: [{ widthM: 4, heightM: 2.4 }] }).ok, false);
  assert.equal(estimateRolls({ ...roll, match: 'straight', walls: [{ widthM: 4, heightM: 2.4 }] }).ok, false);
});

test('does not invent a price', () => {
  const result = estimateRolls({ ...roll, match: 'free', walls: [{ widthM: 4, heightM: 2.4 }] });
  assert.equal(JSON.stringify(result).includes('£'), false);
});

test('the worked example on /advice/quantities/: 5.00 x 2.70 m wall, 10.05 x 0.53 m roll, needs 4 rolls by drops and 3 by area', () => {
  const result = estimateRolls({ rollWidthM: 0.53, rollLengthM: 10.05, trimM: 0.1, match: 'free', walls: [{ widthM: 5, heightM: 2.7 }] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.walls[0].drops, 10);
  assert.equal(result.walls[0].cutLengthM, 2.8);
  assert.equal(result.walls[0].dropsPerRoll, 3);
  assert.equal(result.rolls, 4);
  // The area method the page warns against: 13.5 m2 over a 5.33 m2 roll rounds up to 3, one roll short.
  assert.equal(Math.ceil((5 * 2.7) / (10.05 * 0.53)), 3);
  // The plain 2.50 m cut fits four times on 10.05 m; the 0.64 m straight-match repeat cuts that to three.
  assert.equal(Math.floor(10050 / 2500), 4);
  const straight = estimateRolls({ rollWidthM: 0.53, rollLengthM: 10.05, trimM: 0.1, match: 'straight', repeatM: 0.64, walls: [{ widthM: 5, heightM: 2.4 }] });
  assert.equal(straight.ok && straight.walls[0].cutLengthM, 2.56);
  assert.equal(straight.ok && straight.walls[0].dropsPerRoll, 3);
});

test('the calculator opens with the worked example, and the page copy states the result it gives', async () => {
  const page = await readFile('src/pages/advice/quantities.astro', 'utf8');
  const value = (name: string) => Number(page.match(new RegExp(`name="${name}"[^>]*value="([0-9.]+)"`))![1]);
  const result = estimateRolls({ rollWidthM: value('rollWidth'), rollLengthM: value('rollLength'), trimM: value('trim'), match: 'free', walls: [{ widthM: value('width'), heightM: value('height') }] });
  assert.equal(result.ok && result.rolls, 4);
  assert.match(page, /Ten drops at three per roll is 4 rolls/);
  assert.match(page, /calculator gives 4\./);
  assert.doesNotMatch(page, /10-metre roll|0\.5 metres wide/, 'the old exact-fit example is gone');
});

test('allowance range: net area plus 15–30% (the guide example, 5.00 × 2.70 m on a 0.53 × 10.05 m roll, gives 3–4 rolls)', async () => {
  const { allowanceRange } = await import('../src/lib/quantity.ts');
  const result = allowanceRange({ match: 'free', rollWidthM: 0.53, rollLengthM: 10.05, walls: [{ widthM: 5, heightM: 2.7 }] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.netAreaM2, 13.5);
  assert.deepEqual([result.minPct, result.maxPct, result.minRolls, result.maxRolls], [15, 30, 3, 4]);
});

test('allowance range: staircases at around 30%; murals and panel sets get no figure', async () => {
  const { allowanceRange } = await import('../src/lib/quantity.ts');
  const stair = allowanceRange({ match: 'stair', rollWidthM: 0.53, rollLengthM: 10.05, walls: [{ widthM: 5, heightM: 2.7 }] });
  assert.equal(stair.ok, true);
  if (stair.ok) assert.deepEqual([stair.minPct, stair.maxPct, stair.minRolls, stair.maxRolls], [30, 30, 4, 4]);
  for (const match of ['mural', 'panel'] as const) {
    const result = allowanceRange({ match, rollWidthM: 0.53, rollLengthM: 10.05, walls: [{ widthM: 5, heightM: 2.7 }] });
    assert.equal(result.ok, false);
  }
  const bad = allowanceRange({ match: 'free', rollWidthM: 0, rollLengthM: 10, walls: [{ widthM: 5, heightM: 2.7 }] });
  assert.equal(bad.ok, false);
});

test('a room becomes one run of wall round its perimeter', async () => {
  const { roomWalls, estimateRolls } = await import('../src/lib/quantity.ts');
  assert.deepEqual(roomWalls(4, 3, 2.5), [{ widthM: 14, heightM: 2.5 }]);
  const result = estimateRolls({ ...roll, match: 'free', walls: roomWalls(4, 3, 2.4) });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.rolls, 7); // 14 m ÷ 0.52 = 27 drops, 4 per roll
});
