import test from 'node:test';
import assert from 'node:assert/strict';
import { inversePhotoHomography, photoArtworkUV, photoExportSize, photoWallPoint, quadError, isPhysicalPhotoScale } from '../src/room-studio/photo-math.ts';
import { compositePhotoSurface, photoPixelColour, photoShadingField } from '../src/room-studio/photo-compositor.ts';
import { assertPhotoEditBudget, collectPhotoTextures, validatePhotoProject } from '../src/room-studio/photo-validation.ts';
import { portableJsonBytes } from '../src/room-studio/portable.ts';
import { artworkUVAt } from '../src/room-studio/finishes.ts';
import type { ArtworkFinish, TextureAsset } from '../src/room-studio/types.ts';
import type { PhotoProject, PhotoQuad, PhotoSurface } from '../src/room-studio/photo-types.ts';
const texture: TextureAsset = { id: 'photo', sha256: 'a'.repeat(64), mime: 'image/png', widthPx: 2, heightPx: 2, dataUrl: 'data:image/png;base64,aAAA' };
const surface = (): PhotoSurface => ({ id: 'wall', name: 'Wall 1', corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], strokes: [], finishId: null, widthMm: 200, heightMm: 200, scale: 1, offsetXmm: 0, offsetYmm: 0, shading: 0 });
const wallpaper = (): ArtworkFinish => ({ id: 'paper', type: 'wallpaper', name: 'Original pattern', texture, calibration: { widthMm: 100, heightMm: 100, crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, repeatKind: 'strip', match: 'half-drop', offsetAlreadyIncluded: false, proofAccepted: true } });
const project = (): PhotoProject => ({ kind: 'photo', schemaVersion: 1, id: 'photo-project', ownerId: null, name: 'My room', source: texture, surfaces: [surface()], finishes: [], comparisons: [], revision: 1, updatedAt: '2026-10-19T12:00:00Z' });

test('perspective homography maps every corner and a non-parallelogram interior', () => {
  const quad: PhotoQuad = [{ x: .1, y: .1 }, { x: .9, y: .2 }, { x: .7, y: .9 }, { x: .2, y: .8 }], h = inversePhotoHomography(quad);
  quad.forEach((p, i) => { const uv = photoWallPoint(h, p); assert.ok(Math.abs(uv.x - [0, 1, 1, 0][i]) < 1e-9); assert.ok(Math.abs(uv.y - [0, 0, 1, 1][i]) < 1e-9); });
  const centre = photoWallPoint(h, { x: .45, y: .5 }); assert.ok(centre.x > 0 && centre.x < 1 && centre.y > 0 && centre.y < 1);
});
test('crossed, concave, reversed and tiny wall outlines are rejected', () => {
  const q = surface().corners;
  assert.equal(quadError(q), null);
  for (const bad of [[q[0], q[2], q[1], q[3]], [...q].reverse(), [{ x: 0, y: 0 }, { x: .001, y: 0 }, { x: .001, y: .001 }, { x: 0, y: .001 }]]) assert.ok(quadError(bad as PhotoQuad));
});
test('export never upscales and respects source aspect and 4096 cap', () => {
  assert.deepEqual(photoExportSize(1200, 800), { width: 1200, height: 800 });
  assert.deepEqual(photoExportSize(6000, 4000), { width: 4096, height: 2731 });
  assert.deepEqual(photoExportSize(3000, 6000), { width: 2048, height: 4096 });
  assert.deepEqual(photoExportSize(6000, 4000, 8192), { width: 4096, height: 2731 });
  assert.throws(() => photoExportSize(6000, 4000, -1));
});
test('physical scale requires both measurements, accepted proof and neutral scale', () => {
  const s = surface(), f = wallpaper(); assert.equal(isPhysicalPhotoScale(s, f), true);
  assert.equal(isPhysicalPhotoScale({ ...s, heightMm: null }, f), false);
  assert.equal(isPhysicalPhotoScale({ ...s, scale: 1.2 }, f), false);
  assert.equal(isPhysicalPhotoScale(s, { ...f, calibration: { ...f.calibration, proofAccepted: false } }), false);
});
test('photo repeat coordinates use shared half-drop implementation, including negative strips', () => {
  const s = surface(), f = wallpaper(); s.offsetXmm = 50; s.offsetYmm = 15;
  for (const u of [0, .25, .75, 1]) assert.deepEqual(photoArtworkUV(s, f, u, .375), artworkUVAt(u * 200, 125, f.calibration, 50, 15));
  const included = { ...f, calibration: { ...f.calibration, offsetAlreadyIncluded: true } };
  assert.notEqual(photoArtworkUV(s, f, .9, .4).v, photoArtworkUV(s, included, .9, .4).v);
});
test('half-drop samples original pixels without redrawing and finite mural never tiles', () => {
  const s = surface(), f = wallpaper(), image = { width: 1, height: 2, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]) };
  assert.deepEqual(photoPixelColour(s, f, .25, .375, image), [0, 0, 255, 255]);
  assert.deepEqual(photoPixelColour(s, f, .75, .375, image), [255, 0, 0, 255]);
  const mural = { ...f, type: 'mural' as const, calibration: { ...f.calibration, match: 'straight' as const } };
  assert.equal(photoPixelColour(s, mural, .9, .2, image), null);
});
test('compositing preserves every unmasked source pixel and keeps paint within selection', async () => {
  const base = { width: 2, height: 2, data: new Uint8ClampedArray([30, 40, 50, 255, 60, 70, 80, 255, 90, 100, 110, 255, 120, 130, 140, 255]) };
  const output = { ...base, data: new Uint8ClampedArray(base.data) }, mask = new Uint8ClampedArray(16); mask[7] = 255;
  await compositePhotoSurface(base, output, mask, surface(), { id: 'paint', type: 'paint', name: 'Green', colour: '#112233', sheen: 'matte' });
  assert.deepEqual([...output.data.slice(4, 8)], [17, 34, 51, 255]);
  for (const start of [0, 8, 12]) assert.deepEqual(output.data.slice(start, start + 4), base.data.slice(start, start + 4));
});
test('low-frequency shading suppresses the photograph previous checker pattern', async () => {
  const width = 32, data = new Uint8ClampedArray(width * width * 4), mask = new Uint8ClampedArray(data.length);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) { const i = (y * width + x) * 4, value = (x + y) % 2 ? 240 : 20; data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = mask[i + 3] = 255; }
  const base = { width, height: width, data }, field = photoShadingField(base, mask);
  assert.ok(field.width < width); assert.equal(new Set([...field.data].filter((_, i) => i % 4 === 0)).size, 1);
  const output = { ...base, data: new Uint8ClampedArray(data) };
  await compositePhotoSurface(base, output, mask, { ...surface(), shading: 1 }, { id: 'paint', type: 'paint', name: 'Neutral', colour: '#808080', sheen: 'matte' });
  assert.equal(output.data[0], output.data[4]);
});
test('numbered mural panels retain order and coverage without wrapping', () => {
  const s = surface(), f = { ...wallpaper(), type: 'mural' as const, panels: [{ id: 'p1', number: 1, widthMm: 100, heightMm: 200, texture }, { id: 'p2', number: 2, widthMm: 100, heightMm: 200, texture }] };
  const red = { width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255]) }, blue = { ...red, data: new Uint8ClampedArray([0, 0, 255, 255]) }, images = new Map([['p1', red], ['p2', blue]]);
  assert.deepEqual(photoPixelColour(s, f, .25, .5, undefined, images), [255, 0, 0, 255]); assert.deepEqual(photoPixelColour(s, f, .75, .5, undefined, images), [0, 0, 255, 255]);
  assert.equal(photoPixelColour({ ...s, widthMm: 300 }, f, .9, .5, undefined, images), null);
});
test('closed photo validator rejects external images, excessive walls and unbounded masks', () => {
  assert.deepEqual(validatePhotoProject(project()), []);
  const external = project(); external.source = { ...texture, dataUrl: 'https://example.org/room.png' }; assert.ok(validatePhotoProject(external).some(e => e.path === 'source'));
  const walls = project(); walls.surfaces = Array.from({ length: 7 }, (_, i) => ({ ...surface(), id: `wall-${i}` })); assert.ok(validatePhotoProject(walls).length);
  const masks = project(); masks.surfaces[0].strokes = [{ id: 'stroke', mode: 'erase', radius: 5, points: [{ x: .5, y: .5 }] }]; assert.ok(validatePhotoProject(masks).length);
  const unsupported = { ...project(), script: 'alert(1)' }; assert.ok(validatePhotoProject(unsupported).some(e => e.path === 'photo'));
});
test('comparison artwork remains collectible for private upload and identity cannot drift', () => {
  const p = project(), f = wallpaper(); p.finishes = [f]; p.comparisons = [{ id: 'idea', name: 'Idea', createdAt: p.updatedAt, surfaces: p.surfaces, finishes: [{ ...f, texture: { ...texture, sha256: 'b'.repeat(64) } }] }];
  assert.equal(collectPhotoTextures(p).length, 3); assert.ok(validatePhotoProject(p).some(e => e.path === 'textures'));
});
test('legacy oversized photo cleanup permits reductions, while growth and new oversized snapshots are rejected', () => {
  const original = project(); original.finishes = [wallpaper()]; original.comparisons = [{ id: 'old-idea', name: 'Original idea', createdAt: original.updatedAt, surfaces: original.surfaces, finishes: original.finishes }];
  const smaller = { ...original, comparisons: [] }, limit = portableJsonBytes(smaller) - 1;
  assert.ok(portableJsonBytes(original) > limit && portableJsonBytes(smaller) > limit);
  assert.doesNotThrow(() => assertPhotoEditBudget(original, smaller, limit));
  assert.throws(() => assertPhotoEditBudget(original, structuredClone(original), limit), /previous photo project is unchanged/);
  assert.throws(() => assertPhotoEditBudget(smaller, original, limit), /160 MB/);
  const fresh = project(), freshLimit = portableJsonBytes(fresh) + 2;
  assert.throws(() => assertPhotoEditBudget(fresh, { ...fresh, name: `${fresh.name} enlarged` }, freshLimit), /160 MB/);
  assert.doesNotThrow(() => assertPhotoEditBudget(original, smaller, portableJsonBytes(smaller)));
});
