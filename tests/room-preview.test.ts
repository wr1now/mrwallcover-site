import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyHomography, cornersFromMask, invert3, polygonArea, solveHomography, wallMapping, type Point } from '../src/lib/room-preview/homography.ts';

/** The room preview maps a real wall rectangle onto its four corners in the photograph. These pin the maths. */

const close = (a: Point, b: Point, tolerance = 1e-6) => assert.ok(Math.abs(a[0] - b[0]) < tolerance && Math.abs(a[1] - b[1]) < tolerance, `${a} is not ${b}`);

test('a wall seen square on maps by plain scaling', () => {
  const { toPhoto, toWall } = wallMapping([[100, 50], [500, 50], [500, 350], [100, 350]], 4000, 3000);
  close(applyHomography(toPhoto, [0, 0]), [100, 50]);
  close(applyHomography(toPhoto, [4000, 3000]), [500, 350]);
  close(applyHomography(toPhoto, [2000, 1500]), [300, 200]);
  close(applyHomography(toWall, [300, 200]), [2000, 1500]);
});

test('a wall seen at an angle keeps its corners and its centre, and the inverse round-trips', () => {
  const corners: Point[] = [[120, 90], [640, 140], [660, 520], [100, 470]];
  const { toPhoto, toWall } = wallMapping(corners, 3600, 2400);
  corners.forEach((corner, i) => close(applyHomography(toPhoto, [[0, 0], [3600, 0], [3600, 2400], [0, 2400]][i] as Point), corner, 1e-4));
  for (const p of [[530, 640], [1800, 1200], [3599, 2399]] as Point[]) close(applyHomography(toWall, applyHomography(toPhoto, p)), p, 1e-4);
});

test('half a wall across in millimetres is not half way across in pixels when the wall recedes', () => {
  // The left edge is taller, so the left end is nearer the camera: the near half takes more pixels.
  const { toPhoto } = wallMapping([[0, 0], [800, 100], [800, 500], [0, 600]], 4000, 3000);
  const [x] = applyHomography(toPhoto, [2000, 1500]);
  assert.ok(x > 400 && x < 800, `the near half of a receding wall takes more pixels: centre at ${x}`);
});

test('degenerate corners are refused with a readable message', () => {
  assert.throws(() => solveHomography([[0, 0], [0, 0], [10, 10], [0, 10]], [[0, 0], [1, 0], [1, 1], [0, 1]]), /corners/);
  assert.throws(() => invert3([1, 2, 3, 2, 4, 6, 3, 6, 9]), /mapped/);
});

test('corner order is clockwise on screen, so the polygon area is positive', () => {
  assert.ok(polygonArea([[0, 0], [10, 0], [10, 10], [0, 10]]) > 0);
  assert.ok(polygonArea([[0, 0], [0, 10], [10, 10], [10, 0]]) < 0);
});

test('the extreme points of a wall mask seed the four handles', () => {
  const width = 40;
  const height = 30;
  const mask = new Uint8Array(width * height);
  // A trapezoid: wider at the bottom, like a wall photographed from below.
  for (let y = 5; y < 25; y++) {
    const inset = Math.round((25 - y) / 4);
    for (let x = 8 + inset; x < 32 - inset; x++) mask[y * width + x] = 1;
  }
  const corners = cornersFromMask(mask, width, height);
  assert.ok(corners);
  assert.deepEqual(corners[0], [13, 5]);
  assert.deepEqual(corners[1], [26, 5]);
  assert.deepEqual(corners[2], [31, 24]);
  assert.deepEqual(corners[3], [8, 24]);
  assert.equal(cornersFromMask(new Uint8Array(width * height), width, height), null, 'an empty mask gives nothing');
});
