import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { artworkHeaderDimensions, artworkIsAnimated, artworkUVAt, assignFinishBand, calibrationErrors, checkArtworkDimensions, checkEmbeddedArtwork, createLimewashPixels, detectArtworkMime, halfDropOffset, normaliseHex, proportionalMuralCalibration, rotatedCropSize, saveFinish } from '../src/room-studio/finishes.ts';
import { bauwerkCatalogue, findBauwerkShades } from '../src/room-studio/catalogue/index.ts';
import type { ArtworkCalibration, RoomProject } from '../src/room-studio/types.ts';

const calibration = (): ArtworkCalibration => ({ widthMm: 530, heightMm: 640, crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, repeatKind: 'strip', match: 'half-drop', offsetAlreadyIncluded: false, proofAccepted: false });
const project = (): RoomProject => ({ schemaVersion: 1, id: 'test', ownerId: null, name: 'Test room', room: { vertices: [{ x: 0, z: 0, wallId: 'a' }, { x: 4000, z: 0, wallId: 'b' }, { x: 4000, z: 3000, wallId: 'c' }, { x: 0, z: 3000, wallId: 'd' }], heightMm: 2400, openings: [], skirtingMm: 0, corniceMm: 0, confirmed: false }, finishes: [{ id: 'paint', type: 'paint', name: 'Ivory', colour: '#EEE8DB', sheen: 'matte' }, { id: 'accent', type: 'paint', name: 'Olive', colour: '#747D5B', sheen: 'matte' }], assignments: [{ id: 'original', wallId: 'a', finishId: 'paint', fromMm: 0, toMm: null, offsetXmm: 0, offsetYmm: 0 }], cameras: [], lighting: 'daylight', schemes: [], revision: 1, updatedAt: '2026-10-18T00:00:00Z' });

test('wallpaper half-drop alternates physical repeats and handles negative placement', () => {
  const c = calibration();
  assert.deepEqual([0, 1, 2, 3, -1].map(index => halfDropOffset(index, c)), [0, 320, 0, 320, 320]);
  assert.deepEqual(artworkUVAt(530, 0, c), { u: 1, v: -.5 });
  assert.deepEqual(artworkUVAt(1060, 640, c), { u: 2, v: 1 });
  assert.deepEqual(artworkUVAt(630, 200, c, 100, 200), { u: 1, v: -.5 });
});

test('a full tile or included stagger does not receive a second half-drop', () => {
  assert.equal(halfDropOffset(1, { ...calibration(), offsetAlreadyIncluded: true }), 0);
  assert.equal(halfDropOffset(1, { ...calibration(), repeatKind: 'tile' }), 0);
  assert.equal(halfDropOffset(1, { ...calibration(), match: 'straight' }), 0);
});

test('cropping uses the original image and quarter-turns swap prepared proportions', () => {
  const c = { ...calibration(), crop: { x: .1, y: .2, width: .5, height: .25 } };
  assert.deepEqual(rotatedCropSize(1200, 800, c), { width: 600, height: 200 });
  assert.deepEqual(rotatedCropSize(1200, 800, { ...c, rotation: 90 }), { width: 200, height: 600 });
  assert.deepEqual(rotatedCropSize(1200, 800, { ...c, rotation: 180 }), { width: 600, height: 200 });
  assert.deepEqual(rotatedCropSize(1200, 800, { ...c, rotation: 270 }), { width: 200, height: 600 });
  assert.deepEqual(calibrationErrors(c), []);
  assert.ok(calibrationErrors({ ...c, crop: { ...c.crop, x: .8 } }).length > 0);
  assert.ok(calibrationErrors({ ...c, heightMm: Number.NaN }).length > 0);
});

test('horizontal finish band replaces its intersection and preserves adjacent paint', () => {
  const before = project();
  const snapshot = JSON.stringify(before);
  const after = assignFinishBand(before, { id: 'band', wallId: 'a', finishId: 'accent', fromMm: 800, toMm: 1500, offsetXmm: 20, offsetYmm: 800 });
  assert.equal(JSON.stringify(before), snapshot, 'input project remains immutable for undo');
  assert.deepEqual(after.assignments.map(a => [a.finishId, a.fromMm, a.toMm]), [['paint', 0, 800], ['paint', 1500, null], ['accent', 800, 1500]]);
  const replaced = assignFinishBand(after, { id: 'whole', wallId: 'a', finishId: 'accent', fromMm: 0, toMm: null, offsetXmm: 0, offsetYmm: 0 });
  assert.equal(replaced.assignments.length, 1);
  assert.throws(() => assignFinishBand(before, { ...after.assignments[2], toMm: 2500 }), /floor and ceiling/);
  assert.throws(() => assignFinishBand(before, { ...after.assignments[2], wallId: 'missing' }), /wall/);
});

test('paint colours and uploaded image contents are validated rather than trusting filenames', () => {
  assert.equal(normaliseHex(' #aabbcc '), '#AABBCC');
  assert.equal(normaliseHex('red'), null);
  assert.equal(normaliseHex('#fff'), null);
  assert.equal(detectArtworkMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png');
  assert.equal(detectArtworkMime(new Uint8Array([255, 216, 255, 0])), 'image/jpeg');
  assert.equal(detectArtworkMime(new TextEncoder().encode('RIFF1234WEBP')), 'image/webp');
  assert.equal(detectArtworkMime(new TextEncoder().encode('<svg><script>')), null);
  const before = project(); const after = saveFinish(before, { ...before.finishes[0], name: 'Renamed' });
  assert.equal(after.finishes.length, 2); assert.equal(before.finishes[0].name, 'Ivory');
});

test('compressed-image header dimensions enforce the memory limit before decode', () => {
  const png = new Uint8Array(24), p = new DataView(png.buffer); p.setUint32(16, 5000); p.setUint32(20, 5000);
  assert.deepEqual(artworkHeaderDimensions(png, 'image/png'), { width: 5000, height: 5000 });
  assert.doesNotThrow(() => checkArtworkDimensions(5000, 5000));
  assert.throws(() => checkArtworkDimensions(5001, 5000), /25 megapixels/);
  assert.throws(() => checkArtworkDimensions(8193, 1), /8,192/);
  const jpeg = new Uint8Array([255, 216, 255, 192, 0, 11, 8, 1, 0, 2, 0, 1, 1, 17, 0]);
  assert.deepEqual(artworkHeaderDimensions(jpeg, 'image/jpeg'), { width: 512, height: 256 });
  const webp = new Uint8Array(30), w = new DataView(webp.buffer); webp.set(new TextEncoder().encode('VP8X'), 12); w.setUint32(16, 10, true); webp.set([255, 1, 0], 24); webp.set([255, 0, 0], 27);
  assert.deepEqual(artworkHeaderDimensions(webp, 'image/webp'), { width: 512, height: 256 });
  assert.equal(artworkHeaderDimensions(new Uint8Array(5), 'image/jpeg'), null);
});

test('animated PNG and WebP are rejected independently of extension or frame timing', () => {
  const apng = new Uint8Array(28); new DataView(apng.buffer).setUint32(8, 8); apng.set(new TextEncoder().encode('acTL'), 12);
  assert.equal(artworkIsAnimated(apng, 'image/png'), true);
  const webp = new Uint8Array(30); webp.set(new TextEncoder().encode('VP8X'), 12); new DataView(webp.buffer).setUint32(16, 10, true); webp[20] = 2;
  assert.equal(artworkIsAnimated(webp, 'image/webp'), true);
  webp[20] = 0; assert.equal(artworkIsAnimated(webp, 'image/webp'), false);
  webp.set(new TextEncoder().encode('ANIM'), 12); assert.equal(artworkIsAnimated(webp, 'image/webp'), true);
  assert.equal(artworkIsAnimated(new Uint8Array(10), 'image/png'), false);
  assert.equal(artworkIsAnimated(new Uint8Array(10), 'image/jpeg'), false);
});

test('recovered embedded artwork cannot open remote links or bypass decoder guards', () => {
  const texture = { id: 'image', sha256: 'a'.repeat(64), mime: 'image/png' as const, widthPx: 1, heightPx: 1, dataUrl: 'https://example.com/private-room.png' };
  assert.throws(() => checkEmbeddedArtwork(texture), /Remote image links/);
  assert.throws(() => checkEmbeddedArtwork({ ...texture, dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }), /Remote image links/);
  const png = new Uint8Array(24); png.set([137, 80, 78, 71, 13, 10, 26, 10]); const view = new DataView(png.buffer); view.setUint32(16, 8193); view.setUint32(20, 1);
  assert.throws(() => checkEmbeddedArtwork({ ...texture, dataUrl: `data:image/png;base64,${Buffer.from(png).toString('base64')}` }), /8,192/);
  view.setUint32(16, 1);
  assert.doesNotThrow(() => checkEmbeddedArtwork({ ...texture, dataUrl: `data:image/png;base64,${Buffer.from(png).toString('base64')}` }));
  assert.throws(() => checkEmbeddedArtwork({ ...texture, widthPx: 2, dataUrl: `data:image/png;base64,${Buffer.from(png).toString('base64')}` }), /dimensions do not match/);
});

test('limewash bake is reproducible, seed-specific and close to the selected digital shade', () => {
  const a = createLimewashPixels('#B8B0A0', 17, 64);
  assert.deepEqual(a, createLimewashPixels('#B8B0A0', 17, 64));
  assert.notDeepEqual(a, createLimewashPixels('#B8B0A0', 18, 64));
  assert.equal(a.length, 64 * 64 * 4);
  const red = [...a].filter((_, index) => index % 4 === 0);
  assert.ok(Math.abs(red.reduce((sum, value) => sum + value, 0) / red.length - 184) < 3);
  assert.ok(red.every(value => value >= 173 && value <= 195));
  assert.ok([...a].filter((_, index) => index % 4 === 3).every(value => value === 255));
  assert.throws(() => createLimewashPixels('olive', 1), /colour/);
});

test('full Bauwerk UK palette keeps verified identities, preview provenance and dated catalogue integrity', () => {
  assert.equal(bauwerkCatalogue.provider, 'bauwerk'); assert.equal(bauwerkCatalogue.market, 'GB');
  assert.equal(bauwerkCatalogue.shades.length, bauwerkCatalogue.shadeCount);
  assert.ok(bauwerkCatalogue.shadeCount >= 350, 'full palette, not a curated demo subset');
  assert.match(bauwerkCatalogue.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(bauwerkCatalogue.shades.map(s => s.id)).size, bauwerkCatalogue.shadeCount);
  assert.equal(new Set(bauwerkCatalogue.shades.map(s => s.name)).size, bauwerkCatalogue.shadeCount);
  assert.equal(createHash('sha256').update(JSON.stringify(bauwerkCatalogue.shades)).digest('hex'), bauwerkCatalogue.sourceMetadataSha256);
  assert.ok(bauwerkCatalogue.sourcePages.length >= 2, 'all collection pages verified');
  for (const shade of bauwerkCatalogue.shades) {
    assert.match(shade.colour, /^#[0-9A-F]{6}$/); assert.equal(shade.colourMethod, 'manufacturer-web-preview');
    assert.equal(shade.productUrl, `https://www.bauwerkcolour.com/en-gb/product/${shade.slug}`);
    assert.ok(shade.families.length > 0); assert.equal(typeof shade.available, 'boolean');
    assert.equal('images' in shade, false, 'no copied manufacturer photographs');
  }
  const bone = findBauwerkShades('  BONE  '); assert.equal(bone.length, 1); assert.equal(bone[0].name, 'Bone');
  assert.deepEqual(findBauwerkShades('', '', new Set([bone[0].id])).map(s => s.name), ['Bone']);
  assert.ok(findBauwerkShades('', 'green').every(s => s.families.includes('green')));
});


test('mural dimensions remain proportional through crop, size and orientation changes', () => {
  const texture = { widthPx: 400, heightPx: 200 };
  const initial = proportionalMuralCalibration(texture, { ...calibration(), repeatKind: 'tile', match: 'straight', widthMm: 3000 });
  assert.deepEqual([initial.widthMm, initial.heightMm], [3000, 1500]);
  const resized = proportionalMuralCalibration(texture, initial, { heightMm: 2000 });
  assert.deepEqual([resized.widthMm, resized.heightMm], [4000, 2000]);
  const rotated = proportionalMuralCalibration(texture, resized, { rotation: 90 });
  assert.deepEqual([rotated.widthMm, rotated.heightMm], [2000, 4000]);
  const cropped = proportionalMuralCalibration(texture, rotated, { crop: { x: 0, y: 0, width: .5, height: 1 } });
  assert.deepEqual([cropped.widthMm, cropped.heightMm], [2000, 2000]);
  assert.equal(cropped.proofAccepted, false);
});
