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
const withPrivateFrames = (room: RoomProject['room']) => ({ ...room, openings: room.openings.map(opening => opening.kind === 'window' ? { ...opening, frameMm: 45 } : opening) });
const compile = (project: RoomProject) => compileRoom({ id: 'private-concept-test', projectId: project.id, number: project.revision, createdAt: project.updatedAt, project });
const pjCoverage: NonNullable<ManufacturerPreviewOptions['coverage']> = { widthMm: 3454.4, heightMm: 3352.8, status: 'verified-full-image', evidence: 'Test fixture with the full four-drop sheet aspect; official renderer filename identifies four 11-foot drops.' };
const caissonCoverage: NonNullable<ManufacturerPreviewOptions['coverage']> = { widthMm: 3690, heightMm: 2300, status: 'assumed', evidence: 'Whole reference framing inferred as nine columns by five rows; no manufacturer artwork mapping is verified.' };

test('manufacturer records separate finite panels, approximate vertical repeat and textile repeat without embedding supplier pixels', () => {
  assert.equal(manufacturerSelections.length, 3);
  const dg = getManufacturerSelection('degournay-plum-blossom'), pj = getManufacturerSelection('phillip-jeffries-3163'), arte = getManufacturerSelection('arte-caisson-61533');
  assert.deepEqual(dg.dimensions, { kind: 'finite-panels', panelWidthMm: 915, panelHeightMm: 3048, designHeightMm: 2150, stockSetCode: '961463', repeat: 'none' });
  assert.deepEqual(pj.dimensions, { kind: 'vertical-repeat-panels', trimmedWidthMm: 863.6, panelHeightMm: 3352.8, verticalRepeatMm: 1066.8, verticalRepeatAccuracy: 'approximate', horizontalRepeatMm: null, match: 'straight' });
  assert.equal(pj.verifiedImageCoverage?.widthMm, 4 * 863.6); assert.equal(pj.verifiedImageCoverage?.heightMm, 3352.8);
  assert.deepEqual(arte.dimensions, { kind: 'textile-repeat', widthMm: 1230, verticalRepeatMm: 460, match: 'straight' });
  assert.equal(arte.design, 'Caisson'); assert.equal(arte.productCode, '61533'); assert.match(arte.colourway, /61533.*russet appearance/);
  assert.equal(arte.assets.artworkMappingVerified, false); assert.match(arte.assets.calibrationLabel, /inferred/);
  assert.equal(dg.layoutId, 'willow-chimney'); assert.equal(pj.layoutId, 'ochre-lshape'); assert.equal(arte.layoutId, 'indigo-bay');
  assert.equal(dg.assets.permission.status, 'unresolved'); assert.equal(pj.assets.permission.status, 'restricted'); assert.equal(arte.assets.permission.status, 'restricted');
  for (const selection of manufacturerSelections) {
    assert.equal(selection.assets.embeddedSupplierAssets, false); assert.equal(selection.assets.manufacturerPbrVerified, false);
    assert.ok(selection.sources.length); assert.ok(selection.sources.every(source => source.url.startsWith('https://')));
  }
  assert.doesNotMatch(JSON.stringify(manufacturerSelections), /data:image|webdamdb|full-pattern\.jpg|\/uploads\/(?:shop|colourway|product)\//);
});

test('Plum Blossom repeats the exact reference block at fixed native-aspect scale across every wall', async () => {
  const original = createExampleProject('willow-chimney'), result = createManufacturerPreviewProject('degournay-plum-blossom', { texture: await texture(1250, 789) });
  const { project } = result, finish = artwork(project), papered = project.assignments.filter(assignment => assignment.finishId === finish.id);
  assert.deepEqual(project.room, withPrivateFrames(original.room));
  assert.equal(finish.type, 'wallpaper'); assert.equal(finish.calibration.heightMm, 2700); assert.equal(finish.calibration.widthMm, 4278);
  assert.ok(Math.abs(finish.calibration.widthMm * finish.texture.heightPx - finish.calibration.heightMm * finish.texture.widthPx) <= Math.max(finish.texture.widthPx, finish.texture.heightPx), 'Source block preserves proportions instead of stretching to the room perimeter');
  assert.deepEqual(papered.map(assignment => assignment.wallId), project.room.vertices.map(vertex => vertex.wallId));
  assert.ok(papered.every(assignment => assignment.offsetYmm === 0), 'No accidental 550 mm blank band below the artwork');
  const run = papered.reduce((sum, assignment) => sum + wallLength(project.room, assignment.wallId), 0); assert.equal(run, 22400);
  assert.equal(papered[0].offsetXmm, 0);
  for (let i = 1; i < papered.length; i++) assert.equal(wallLength(project.room, papered[i - 1].wallId) - papered[i - 1].offsetXmm, -papered[i].offsetXmm, 'The source phase continues across chimney and room corners');
  const scene = compile(project); assert.equal(scene.materials.find(material => material.id === finish.id)?.repeat, true);
  assert.deepEqual(finish.appearance, { roughness: .65, metalness: .35 });
  assert.deepEqual(scene.materials.find(material => material.id === finish.id)?.appearance, finish.appearance);
  const walls = new Set(papered.map(assignment => assignment.wallId));
  for (const mesh of scene.meshes.filter(mesh => mesh.surface === 'wall' && mesh.id.endsWith('-inside') && walls.has(mesh.wallId!))) {
    const middleY = mesh.positions.filter((_, index) => index % 3 === 1).reduce((sum, value) => sum + value, 0) / 4 * 1000;
    if (middleY > project.room.skirtingMm && middleY < 2700) assert.equal(mesh.materialId, finish.id, 'Visible chimney face has no unfinished rectangular artwork boundary');
  }
  assert.ok(result.assumptions.some(note => /assum/i.test(note))); assert.ok(result.assumptions.some(note => /not.*product repeat/i.test(note)));
  assert.ok(result.assumptions.some(note => /duplicated horizontally/i.test(note)));
  assert.equal(result.selection.dimensions.kind === 'finite-panels' && result.selection.dimensions.designHeightMm, 2150, 'The separate product design-height fact is unchanged by private composition');
});

test('PJ repeats four-drop source blocks horizontally for coverage without claiming a horizontal product repeat or repeating vertically', async () => {
  const pixels = await texture(340, 330);
  assert.throws(() => createManufacturerPreviewProject('phillip-jeffries-3163', { texture: pixels }), /coverage explicitly/);
  const result = createManufacturerPreviewProject('phillip-jeffries-3163', { texture: pixels, coverage: pjCoverage }), finish = artwork(result.project);
  assert.equal(finish.type, 'wallpaper'); assert.equal(finish.calibration.widthMm, 3454); assert.equal(finish.calibration.heightMm, 3353);
  assert.notEqual(finish.calibration.heightMm, 1067, 'The approximate 42-inch product repeat is not the height of a four-drop source sheet');
  const scene = compile(result.project); assert.equal(scene.materials.find(material => material.id === finish.id)?.repeat, true);
  const visibleTop = result.project.room.heightMm - result.project.room.corniceMm, offsetYmm = visibleTop - finish.calibration.heightMm;
  assert.equal(offsetYmm, -733);
  assert.ok(result.project.assignments.every(assignment => assignment.finishId === finish.id && assignment.offsetYmm === offsetYmm));
  const visibleWalls = scene.meshes.filter(mesh => mesh.id.endsWith('-inside') && mesh.materialId === finish.id && Math.max(...mesh.positions.filter((_, index) => index % 3 === 1)) <= visibleTop / 1000 + 1e-8);
  for (const mesh of visibleWalls) assert.ok(mesh.uvs.filter((_, index) => index % 2 === 1).every(value => value >= 0 && value <= 1), 'Visible walls use one full-panel height without vertical source wrapping');
  assert.ok(visibleWalls.some(mesh => mesh.uvs.some((value, index) => index % 2 === 1 && Math.abs(value - 1) < 1e-8)), 'The gold upper source edge reaches the cornice rather than being cropped above the room');
  assert.deepEqual(result.project.cameras.filter(camera => camera.kind === 'perspective')[1].position, [1.1, 1.6, 4]);
  assert.ok(result.assumptions.some(note => /top-aligned below the cornice/.test(note) && /without resizing/.test(note)));
  assert.deepEqual(finish.appearance, { roughness: .42, metalness: .7 });
  assert.deepEqual(scene.materials.find(material => material.id === finish.id)?.appearance, finish.appearance);
  assert.match(result.project.name, /Gold on Horsehair 3163/); assert.match(finish.name, /Gold on Horsehair 3163/);
  assert.ok(result.assumptions.some(note => note.includes('3454.4') && note.includes('3352.8')), 'Fractional source coverage and editor rounding remain visible');
  assert.ok(result.assumptions.some(note => /not a product horizontal repeat/i.test(note)));
});

test('Caisson preserves its whole source with assumed 3690 × 2300 mm framing and explicit illustrative coffered relief', async () => {
  const pixels = await texture(400, 225), result = createManufacturerPreviewProject('arte-caisson-61533', { texture: pixels, coverage: caissonCoverage });
  const finish = artwork(result.project); assert.equal(finish.type, 'wallpaper');
  assert.deepEqual([finish.calibration.widthMm, finish.calibration.heightMm, finish.calibration.match], [3690, 2300, 'straight']);
  assert.deepEqual(finish.calibration.crop, { x: 0, y: 0, width: 1, height: 1 }); assert.equal(finish.texture.dataUrl, pixels.dataUrl);
  assert.deepEqual(finish.appearance, { roughness: .85, metalness: 0, relief: { kind: 'coffered', depthMm: 8, columns: 9, rows: 5 } });
  const material = compile(result.project).materials.find(material => material.id === finish.id);
  assert.equal(material?.repeat, true); assert.deepEqual(material?.appearance, finish.appearance);
  assert.equal(finish.calibration.widthMm / finish.appearance!.relief!.columns, 410); assert.equal(finish.calibration.heightMm / finish.appearance!.relief!.rows, 460);
  assert.match(result.project.name, /Caisson 61533/); assert.match(finish.name, /Caisson 61533/);
  assert.ok(result.assumptions.some(note => /assumed full-image coverage/i.test(note)));
  assert.ok(result.assumptions.some(note => /10\.81% vertical aspect correction/.test(note)));
  assert.ok(result.assumptions.some(note => /illustrative 8 mm amplitude/.test(note)));
  assert.ok(result.assumptions.some(note => /No measured relief amplitude/.test(note)));
  assert.equal(result.selection.assets.manufacturerPbrVerified, false); assert.equal(result.selection.assets.permission.status, 'restricted');
  const papered = result.project.assignments.filter(assignment => assignment.finishId === finish.id);
  for (let i = 1; i < papered.length; i++) assert.ok(Math.abs(wallLength(result.project.room, papered[i - 1].wallId) - papered[i - 1].offsetXmm + papered[i].offsetXmm) <= 1, 'Tile set-out continues across angled bay corners within integer-mm tolerance');
});

test('assumption groups preserve every original note exactly once across all three private studies', async () => {
  const cases = [
    ['degournay-plum-blossom', { texture: await texture(1250, 789) }],
    ['phillip-jeffries-3163', { texture: await texture(340, 330), coverage: pjCoverage }],
    ['arte-caisson-61533', { texture: await texture(400, 225), coverage: caissonCoverage }],
  ] as const;
  for (const [id, options] of cases) {
    const { assumptions, assumptionGroups } = createManufacturerPreviewProject(id, options);
    assert.deepEqual(assumptionGroups.map(({ id, title }) => ({ id, title })), [
      { id: 'scale', title: 'Source and scale' },
      { id: 'layout', title: 'Room set-out' },
      { id: 'appearance', title: 'Material appearance' },
      { id: 'status', title: 'Review and permissions' },
    ]);
    assert.ok(assumptionGroups.every(group => group.notes.length > 0));
    const groupedNotes = assumptionGroups.flatMap(group => group.notes);
    assert.deepEqual([...groupedNotes].sort(), [...assumptions].sort(), 'Grouped and flat notes retain complete string and occurrence parity');
    assert.equal(new Set(groupedNotes).size, groupedNotes.length, 'Every original note appears in exactly one group');
    assert.equal(assumptionGroups[0].notes[0], assumptions[1]);
    assert.equal(assumptionGroups[2].notes[0], assumptions[2]);
    assert.deepEqual(assumptionGroups[3].notes, [assumptions[0], assumptions[3], assumptions[4]], 'Private review and permission boundaries remain together');
  }
});

test('private concepts remain valid portable detached drafts and cannot clear permission or proof gates', async () => {
  const cases = [
    ['degournay-plum-blossom', { texture: await texture(1250, 789) }],
    ['phillip-jeffries-3163', { texture: await texture(340, 330), coverage: pjCoverage }],
    ['arte-caisson-61533', { texture: await texture(400, 225), coverage: caissonCoverage }],
  ] as const;
  for (const [id, options] of cases) {
    const before = structuredClone(options), first = createManufacturerPreviewProject(id, options), second = createManufacturerPreviewProject(id, options), baseline = createExampleProject(first.selection.layoutId);
    assert.notEqual(first.project.id, second.project.id); assert.equal(first.project.ownerId, null); assert.equal(first.project.room.confirmed, false);
    assert.equal(artwork(first.project).calibration.proofAccepted, false); assert.deepEqual(validateProject(first.project), []);
    assert.deepEqual(validateProject(JSON.parse(JSON.stringify(first.project))), []); assert.deepEqual(first.project.room, withPrivateFrames(baseline.room));
    for (const opening of first.project.room.openings) assert.equal('frameMm' in opening ? opening.frameMm : undefined, opening.kind === 'window' ? 45 : undefined);
    assert.ok(createExampleProject(first.selection.layoutId).room.openings.every(opening => !('frameMm' in opening)), 'Private frames never alter original public fixtures');
    assert.deepEqual(first.project.cameras.map(camera => camera.id), baseline.cameras.map(camera => camera.id));
    assert.ok(first.project.cameras.filter(camera => camera.kind === 'perspective').every(camera => camera.fov === 75));
    assert.notDeepEqual(first.project.cameras, baseline.cameras, 'Private interior cameras show complementary room coverage');
    assert.deepEqual(createExampleProject(first.selection.layoutId).cameras, baseline.cameras, 'Original public cameras are not changed');
    assert.deepEqual(options, before); first.project.room.vertices[0].x = 99; assert.equal(second.project.room.vertices[0].x, baseline.room.vertices[0].x);
    assert.equal(first.project.finishes.length, 2, 'Generic example wallpaper is replaced, not retained alongside supplier references');
    const finish = artwork(second.project), scene = compile(second.project);
    assert.equal(finish.type, 'wallpaper'); assert.equal(second.project.assignments.length, second.project.room.vertices.length);
    assert.ok(second.project.assignments.every(assignment => assignment.finishId === finish.id && assignment.fromMm === 0 && assignment.toMm === null));
    assert.equal(finish.texture.dataUrl, options.texture.dataUrl); assert.equal(finish.texture.sha256, options.texture.sha256, 'Coverage duplicates exact source pixels without fabricating artwork');
    assert.ok(scene.meshes.filter(mesh => mesh.surface === 'wall' && mesh.id.endsWith('-inside')).every(mesh => mesh.materialId === finish.id), 'Every remaining wall cell has wallpaper rather than an unreported painted alternative');
    const assigned = second.project.assignments;
    for (let i = 1; i < assigned.length; i++) assert.ok(Math.abs(wallLength(second.project.room, assigned[i - 1].wallId) - assigned[i - 1].offsetXmm + assigned[i].offsetXmm) <= 1, 'Source phase continues across each room corner');
    for (const opening of second.project.room.openings) {
      const index = second.project.room.vertices.findIndex(vertex => vertex.wallId === opening.wallId), a = second.project.room.vertices[index], b = second.project.room.vertices[(index + 1) % second.project.room.vertices.length], length = wallLength(second.project.room, a.wallId);
      for (const mesh of scene.meshes.filter(mesh => mesh.wallId === opening.wallId && mesh.surface === 'wall' && mesh.id.endsWith('-inside'))) {
        const vertexCount = mesh.positions.length / 3;
        const x = mesh.positions.filter((_, i) => i % 3 === 0).reduce((sum, value) => sum + value, 0) / vertexCount * 1000, y = mesh.positions.filter((_, i) => i % 3 === 1).reduce((sum, value) => sum + value, 0) / vertexCount * 1000, z = mesh.positions.filter((_, i) => i % 3 === 2).reduce((sum, value) => sum + value, 0) / vertexCount * 1000;
        const along = ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / length;
        assert.equal(along > opening.offsetMm && along < opening.offsetMm + opening.widthMm && y > opening.sillMm && y < opening.sillMm + opening.heightMm, false, 'Window or door opening remains a true wall cut-out');
        const assignment = assigned.find(assignment => assignment.wallId === opening.wallId)!;
        const expectedU = (along - assignment.offsetXmm) / finish.calibration.widthMm, averageU = mesh.uvs.filter((_, i) => i % 2 === 0).reduce((sum, value) => sum + value, 0) / vertexCount;
        assert.ok(Math.abs(averageU - expectedU) < 1e-5, 'Wallpaper coordinates around openings retain the same physical source phase');
      }
    }
  }
});

test('remote references, unsupported source proportions and falsely verified or altered Caisson framing are rejected', async () => {
  const pixels = await texture(180, 160), square = await texture(160, 160), panel = await texture(340, 330);
  assert.throws(() => createManufacturerPreviewProject('degournay-plum-blossom', { texture: { ...pixels, dataUrl: 'https://example.invalid/art.jpg' } }), /locally embedded/);
  assert.throws(() => createManufacturerPreviewProject('phillip-jeffries-3163', { texture: pixels, coverage: { ...pjCoverage, widthMm: 100 } }), /proportions/);
  assert.throws(() => createManufacturerPreviewProject('phillip-jeffries-3163', { texture: panel, coverage: { ...pjCoverage, widthMm: 1030, heightMm: 1000 } }), /without vertical source repetition/);
  assert.throws(() => createManufacturerPreviewProject('arte-caisson-61533', { texture: pixels }), /coverage explicitly/);
  assert.throws(() => createManufacturerPreviewProject('arte-caisson-61533', { texture: pixels, coverage: { ...caissonCoverage, widthMm: 410, heightMm: 460 } }), /3690 × 2300/);
  assert.throws(() => createManufacturerPreviewProject('arte-caisson-61533', { texture: square, coverage: { ...caissonCoverage, status: 'verified-full-image' } }), /assumed, not verified/);
});

test('selection lookup is detached and rejects unknown products', () => {
  const first = getManufacturerSelection('arte-caisson-61533'); first.colourway = 'Changed privately';
  assert.equal(getManufacturerSelection('arte-caisson-61533').colourway, 'Reference 61533 · russet appearance');
  assert.throws(() => getManufacturerSelection('unknown-product' as never), /three selected/);
});
