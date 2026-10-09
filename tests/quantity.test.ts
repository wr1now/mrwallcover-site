import assert from 'node:assert/strict';
import { test } from 'node:test';
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
