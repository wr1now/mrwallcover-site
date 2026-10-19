import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createExampleProject } from '../src/room-studio/examples.ts';
import { compileRoom, wallLength } from '../src/room-studio/geometry.ts';
import { getManufacturerSelection, manufacturerSelections } from '../src/room-studio/manufacturer-selections.ts';
import { createManufacturerPreviewProject } from '../src/room-studio/manufacturer-preview.ts';
import type { ManufacturerPreviewOptions } from '../src/room-studio/manufacturer-preview.ts';
import type { ArtworkFinish, RoomProject, TextureAsset } from '../src/room-studio/types.ts';
import { validateProject } from '../src/room-studio/validation.ts';

// Original, deliberately plain test pixels. No manufacturer artwork is bundled.
async function texture(widthPx: number, heightPx: number): Promise<TextureAsset> {
  const bytes = await sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: '#9c937f' } }).png().toBuffer();
  return { id: 'original-manufacturer-test-pixels', widthPx, heightPx, mime: 'image/png', sha256: createHash('sha256').update(bytes).digest('hex'), dataUrl: 'data:image/png;base64,' + bytes.toString('base64') };
}
const artwork = (project: RoomProject) => project.finishes.find(finish => finish.type === 'mural' || finish.type === 'wallpaper') as ArtworkFinish;
const compile = (project: RoomProject) => compileRoom({ id: 'private-concept-test', projectId: project.id, number: project.revision, createdAt: project.updatedAt, project });
const pjCoverage: NonNullable<ManufacturerPreviewOptions['coverage']> = { widthMm: 3454.4, heightMm: 3352.8, status: 'verified-full-image', evidence: 'Test fixture with the full four-drop sheet aspect; official renderer filename identifies four 11-foot drops.' };

test('manufacturer records separate finite panels, approximate vertical repeat and repeatable tiles without embedding supplier pixels', () => {
  assert.equal(manufacturerSelections.length, 3);
  const dg = getManufacturerSelection('degournay-plum-blossom'), pj = getManufacturerSelection('phillip-jeffries-3163'), arte = getManufacturerSelection('arte-adobe-97031');
  assert.deepEqual(dg.dimensions, { kind: 'finite-panels', panelWidthMm: 915, panelHeightMm: 3048, designHeightMm: 2150, stockSetCode: '961463', repeat: 'none' });
  assert.deepEqual(pj.dimensions, { kind: 'vertical-repeat-panels', trimmedWidthMm: 863.6, panelHeightMm: 3352.8, verticalRepeatMm: 1066.8, verticalRepeatAccuracy: 'approximate', horizontalRepeatMm: null, match: 'straight' });
  assert.equal(pj.verifiedImageCoverage?.widthMm, 4 * 863.6); assert.equal(pj.verifiedImageCoverage?.heightMm, 3352.8);
  assert.deepEqual(arte.dimensions, { kind: 'repeatable-tiles', widthMm: 900, heightMm: 800, verticalRepeatMm: 800, match: 'straight' });
  assert.equal(dg.layoutId, 'willow-chimney'); assert.equal(pj.layoutId, 'ochre-lshape'); assert.equal(arte.layoutId, 'indigo-bay');
  assert.equal(dg.assets.permission.status, 'unresolved'); assert.equal(pj.assets.permission.status, 'restricted'); assert.equal(arte.assets.permission.status, 'restricted');
  for (const selection of manufacturerSelections) {
    assert.equal(selection.assets.embeddedSupplierAssets, false); assert.equal(selection.assets.manufacturerPbrVerified, false);
    assert.ok(selection.sources.length); assert.ok(selection.sources.every(source => source.url.startsWith('https://')));
  }
  assert.doesNotMatch(JSON.stringify(manufacturerSelections), /data:image|webdamdb|full-pattern\.jpg|\/uploads\/(?:shop|colourway|product)\//);
});

test('Plum Blossom stays one finite native-aspect image covering only the complete chimney front and returns', async () => {
  const original = createExampleProject('willow-chimney'), result = createManufacturerPreviewProject('degournay-plum-blossom', { texture: await texture(1250, 789) });
  const { project } = result, finish = artwork(project), papered = project.assignments.filter(assignment => assignment.finishId === finish.id);
  assert.deepEqual(project.room, original.room); assert.deepEqual(project.cameras, original.cameras);
  assert.equal(finish.type, 'mural'); assert.equal(finish.calibration.heightMm, 2700); assert.equal(finish.calibration.widthMm, 4278);
  assert.ok(Math.abs(finish.calibration.widthMm * finish.texture.heightPx - finish.calibration.heightMm * finish.texture.widthPx) <= Math.max(finish.texture.widthPx, finish.texture.heightPx), 'Finite artwork preserves source proportions after integer-mm rounding');
  assert.deepEqual(papered.map(assignment => assignment.wallId), ['willow-chimney-right', 'willow-chimney-front', 'willow-chimney-left']);
  assert.ok(papered.every(assignment => assignment.offsetYmm === 0), 'No accidental 550 mm blank band below the artwork');
  const run = papered.reduce((sum, assignment) => sum + wallLength(project.room, assignment.wallId), 0); assert.equal(run, 2600);
  assert.equal(papered[0].offsetXmm, Math.round((run - finish.calibration.widthMm) / 2));
  for (let i = 1; i < papered.length; i++) assert.equal(wallLength(project.room, papered[i - 1].wallId) - papered[i - 1].offsetXmm, -papered[i].offsetXmm, 'One finite image continues through both chimney corners');
  const scene = compile(project); assert.equal(scene.materials.find(material => material.id === finish.id)?.repeat, false);
  const walls = new Set(papered.map(assignment => assignment.wallId));
  for (const mesh of scene.meshes.filter(mesh => mesh.surface === 'wall' && mesh.id.endsWith('-inside') && walls.has(mesh.wallId!))) {
    const middleY = mesh.positions.filter((_, index) => index % 3 === 1).reduce((sum, value) => sum + value, 0) / 4 * 1000;
    if (middleY > project.room.skirtingMm && middleY < 2700) assert.equal(mesh.materialId, finish.id, 'Visible chimney face has no unfinished rectangular artwork boundary');
  }
  assert.ok(result.assumptions.some(note => /assum/i.test(note))); assert.ok(result.assumptions.some(note => /finite/i.test(note)));
  assert.equal(result.selection.dimensions.kind === 'finite-panels' && result.selection.dimensions.designHeightMm, 2150, 'The separate product design-height fact is unchanged by private composition');
});

test('PJ requires explicit image coverage and keeps the identified four-drop sheet finite rather than tiling the approximate repeat', async () => {
  const pixels = await texture(340, 330);
  assert.throws(() => createManufacturerPreviewProject('phillip-jeffries-3163', { texture: pixels }), /coverage explicitly/);
  const result = createManufacturerPreviewProject('phillip-jeffries-3163', { texture: pixels, coverage: pjCoverage }), finish = artwork(result.project);
  assert.equal(finish.type, 'mural'); assert.equal(finish.calibration.widthMm, 3454); assert.equal(finish.calibration.heightMm, 3353);
  assert.notEqual(finish.calibration.heightMm, 1067, 'The approximate 42-inch product repeat is not the height of a four-drop source sheet');
  assert.equal(compile(result.project).materials.find(material => material.id === finish.id)?.repeat, false);
  assert.deepEqual(result.project.assignments.filter(assignment => assignment.finishId === finish.id).map(assignment => assignment.wallId), ['ochre-return-north']);
  assert.match(result.project.name, /Gold on Horsehair 3163/); assert.match(finish.name, /Gold on Horsehair 3163/);
  assert.ok(result.assumptions.some(note => note.includes('3454.4') && note.includes('3352.8')), 'Fractional source coverage and editor rounding remain visible');
});

test('Arte keeps its 900 × 800 mm straight tile while marking the supplied crop as an assumption without inventing measured relief', async () => {
  const result = createManufacturerPreviewProject('arte-adobe-97031', { texture: await texture(180, 160), coverage: { widthMm: 900, heightMm: 800, status: 'assumed', evidence: 'Private corrected tile crop; full-image physical coverage is not verified.' } });
  const finish = artwork(result.project); assert.equal(finish.type, 'wallpaper');
  assert.deepEqual([finish.calibration.widthMm, finish.calibration.heightMm, finish.calibration.match], [900, 800, 'straight']);
  assert.equal(compile(result.project).materials.find(material => material.id === finish.id)?.repeat, true);
  assert.match(result.project.name, /Adobe Ecru 97031/); assert.match(finish.name, /Adobe Ecru 97031/);
  assert.ok(result.assumptions.some(note => /assumed full-image coverage/i.test(note)));
  assert.equal(result.selection.assets.manufacturerPbrVerified, false); assert.equal(result.selection.assets.permission.status, 'restricted');
  const papered = result.project.assignments.filter(assignment => assignment.finishId === finish.id);
  for (let i = 1; i < papered.length; i++) assert.ok(Math.abs(wallLength(result.project.room, papered[i - 1].wallId) - papered[i - 1].offsetXmm + papered[i].offsetXmm) <= 1, 'Tile set-out continues across angled bay corners within integer-mm tolerance');
});

test('private concepts remain valid portable detached drafts and cannot clear permission or proof gates', async () => {
  const cases = [
    ['degournay-plum-blossom', { texture: await texture(1250, 789) }],
    ['phillip-jeffries-3163', { texture: await texture(340, 330), coverage: pjCoverage }],
    ['arte-adobe-97031', { texture: await texture(180, 160) }],
  ] as const;
  for (const [id, options] of cases) {
    const before = structuredClone(options), first = createManufacturerPreviewProject(id, options), second = createManufacturerPreviewProject(id, options), baseline = createExampleProject(first.selection.layoutId);
    assert.notEqual(first.project.id, second.project.id); assert.equal(first.project.ownerId, null); assert.equal(first.project.room.confirmed, false);
    assert.equal(artwork(first.project).calibration.proofAccepted, false); assert.deepEqual(validateProject(first.project), []);
    assert.deepEqual(validateProject(JSON.parse(JSON.stringify(first.project))), []); assert.deepEqual(first.project.room, baseline.room); assert.deepEqual(first.project.cameras, baseline.cameras);
    assert.deepEqual(options, before); first.project.room.vertices[0].x = 99; assert.equal(second.project.room.vertices[0].x, baseline.room.vertices[0].x);
    assert.equal(first.project.finishes.length, 2, 'Generic example wallpaper is replaced, not retained alongside supplier references');
  }
});

test('remote references, unsupported crop proportions and altered tile sizes are rejected', async () => {
  const pixels = await texture(180, 160), square = await texture(160, 160);
  assert.throws(() => createManufacturerPreviewProject('degournay-plum-blossom', { texture: { ...pixels, dataUrl: 'https://example.invalid/art.jpg' } }), /locally embedded/);
  assert.throws(() => createManufacturerPreviewProject('phillip-jeffries-3163', { texture: pixels, coverage: { ...pjCoverage, widthMm: 100 } }), /proportions/);
  assert.throws(() => createManufacturerPreviewProject('arte-adobe-97031', { texture: pixels, coverage: { ...pjCoverage, widthMm: 901, heightMm: 800 } }), /900 × 800/);
  assert.throws(() => createManufacturerPreviewProject('arte-adobe-97031', { texture: square, coverage: { ...pjCoverage, widthMm: 900, heightMm: 800 } }), /proportions/);
});

test('selection lookup is detached and rejects unknown products', () => {
  const first = getManufacturerSelection('arte-adobe-97031'); first.colourway = 'Changed privately';
  assert.equal(getManufacturerSelection('arte-adobe-97031').colourway, 'Ecru');
  assert.throws(() => getManufacturerSelection('unknown-product' as never), /three selected/);
});
