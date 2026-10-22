import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { roomStudioExamples } from '../src/room-studio/example-metadata.ts';
import { spawnSync } from 'node:child_process';
import { compileRoom, createRectangle, suggestCameras } from '../src/room-studio/geometry.ts';
import { fixtureArtwork, fixtureProject } from '../src/room-studio/fixtures.ts';
import { APPEARANCE_PRESETS, assignFinishBand, artworkUVAt, calibrationErrors, customArtwork, linkFinishWallRun } from '../src/room-studio/finishes.ts';
import { catalogueProducts, resolveCatalogueFinish, selectCatalogueFinish } from '../src/room-studio/catalogue-products.ts';
import { artworkCoverageIssues, assignmentOrigin, orderedPanels, panelMaterialId } from '../src/room-studio/wall-runs.ts';
import { sourceQualityIssues } from '../src/room-studio/quality.ts';
import { migrateProject } from '../src/room-studio/storage.ts';
import { pointInsideRoom, validateFinishAssets, validateProject } from '../src/room-studio/validation.ts';
import type { ArtworkFinish, RoomProject } from '../src/room-studio/types.ts';

function panelRoom(): RoomProject {
  const p = migrateProject(fixtureProject());
  p.room = createRectangle(2200, 1800, 2000); p.room.skirtingMm = 0; p.room.corniceMm = 0; p.room.confirmed = true;
  p.room.openings = [{ id: 'window', wallId: 'wall-south', kind: 'window', offsetMm: 600, widthMm: 700, heightMm: 700, sillMm: 600, revealMm: 140 }];
  const finish: ArtworkFinish = { ...fixtureArtwork(), type: 'mural', calibration: { ...fixtureArtwork().calibration, widthMm: 2000.1, heightMm: 2000.1 }, panels: [1, 2].map(number => ({ id: `panel-${number}`, number, texture: { ...fixtureArtwork().texture, id: `source-panel-${number}` }, widthMm: 2000.1, heightMm: 2000.1 })) };
  finish.texture = structuredClone(finish.panels![0].texture);
  p.finishes = [finish];
  p.assignments = p.room.vertices.slice(0, 2).map((vertex, index) => ({ id: `band-${index}`, wallId: vertex.wallId, finishId: finish.id, fromMm: 0, toMm: null, offsetXmm: 0, offsetYmm: 0 }));
  p.cameras = suggestCameras(p.room);
  return linkFinishWallRun(p, finish.id, p.room.vertices.slice(0, 2).map(vertex => vertex.wallId));
}
const compile = (p: RoomProject) => compileRoom({ id: 'revision-v2', projectId: p.id, number: p.revision, createdAt: p.updatedAt, project: p });

test('v1 editable migration is detached and preserves all original data and historical versions', () => {
  const old = fixtureProject(), before = structuredClone(old), migrated = migrateProject(old);
  assert.equal(migrated.schemaVersion, 2); assert.deepEqual(old, before); assert.deepEqual({ ...migrated, schemaVersion: 1 }, old);
  assert.deepEqual(migrateProject(migrated), migrated);
  migrated.room.vertices[0].x = 100; assert.equal(old.room.vertices[0].x, 0);
  assert.equal(compile(old).schemaVersion, 1, 'Immutable v1 snapshots still compile');
});

test('0.1 mm artwork precision does not loosen integer survey validation', () => {
  const p = panelRoom(); assert.deepEqual(validateProject(p), []);
  assert.deepEqual(calibrationErrors((p.finishes[0] as ArtworkFinish).calibration), []);
  (p.finishes[0] as ArtworkFinish).calibration.widthMm = 2000.11;
  assert.ok(validateProject(p).some(issue => issue.path.includes('calibration')));
  p.room.heightMm = 2000.1; assert.ok(validateProject(p).some(issue => issue.path === 'room.heightMm'));
});

test('numbered panels cross corners and openings without repeats, stretch or shifted phase', () => {
  const p = panelRoom(), finish = p.finishes[0] as ArtworkFinish, scene = compile(p);
  assert.deepEqual(artworkCoverageIssues(p), []);
  assert.deepEqual(orderedPanels(finish).map(panel => [panel.startMm, panel.endMm]), [[0, 2000.1], [2000.1, 4000.2]]);
  const east = p.assignments.find(value => value.wallId === 'wall-east')!;
  assert.equal(assignmentOrigin(p.room, east, p.wallRuns), -2200);
  const panel2 = scene.meshes.filter(mesh => mesh.surface === 'wall' && mesh.materialId === panelMaterialId(finish.id, 1));
  assert.ok(panel2.some(mesh => mesh.wallId === 'wall-south'));
  assert.ok(panel2.some(mesh => mesh.wallId === 'wall-east'));
  for (const mesh of panel2) for (let i = 0; i < mesh.uvs.length; i += 2) assert.ok(mesh.uvs[i] >= -1e-7 && mesh.uvs[i] <= 1 + 1e-7);
  const eastStart = Math.min(...panel2.filter(mesh => mesh.wallId === 'wall-east').flatMap(mesh => mesh.uvs.filter((_, i) => i % 2 === 0)));
  assert.ok(Math.abs(eastStart - (2200 - 2000.1) / 2000.1) < 1e-7);
  const byWindow = scene.meshes.find(mesh => mesh.materialId === panelMaterialId(finish.id, 0) && mesh.wallId === 'wall-south' && mesh.positions.some((_, index) => index % 3 === 0 && Math.abs(mesh.positions[index] - 1.3) < 1e-7));
  assert.ok(byWindow); assert.ok(byWindow.uvs.some((u, i) => i % 2 === 0 && Math.abs(u - 1300 / 2000.1) < 1e-7));
  assert.equal(scene.textures.length, 2); assert.ok(scene.materials.filter(material => material.type === 'mural').every(material => material.repeat === false));
  const result = spawnSync('python3', ['-c', 'import sys,json; from workers.room_studio.render import validate_package; validate_package(json.load(sys.stdin))'], { input: JSON.stringify(scene), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('exhausted panels stay neutral and block completion; a finite design cannot restart on separate walls', () => {
  const p = panelRoom(); p.room.vertices[1].x = 2800; p.room.vertices[2].x = 2800;
  assert.ok(artworkCoverageIssues(p).some(issue => /width/.test(issue.message)));
  const scene = compile(p), inside = scene.meshes.filter(mesh => mesh.wallId === 'wall-east' && mesh.id.endsWith('-inside'));
  assert.ok(inside.some(mesh => mesh.materialId === 'neutral-wall'));
  p.assignments.forEach(assignment => delete assignment.runId); delete p.wallRuns;
  assert.ok(artworkCoverageIssues(p).some(issue => /cannot restart/.test(issue.message)));
});

test('connected run distances update exactly after angled wall resize and reject disconnected selections', () => {
  const p = panelRoom(); p.room.vertices[2].x += 100;
  const assignment = p.assignments[1];
  assert.equal(assignmentOrigin(p.room, assignment, p.wallRuns), -2200);
  const wallpaper = fixtureArtwork(); p.finishes = [wallpaper]; p.assignments.forEach(value => value.finishId = wallpaper.id); p.wallRuns![0].finishId = wallpaper.id;
  p.room.vertices[1].x = 2300; p.room.vertices[1].z = 200;
  assert.equal(assignmentOrigin(p.room, assignment, p.wallRuns), -Math.hypot(2300, 200));
  const uv = artworkUVAt(0, 0, wallpaper.calibration, assignmentOrigin(p.room, assignment, p.wallRuns));
  assert.equal(uv.u, Math.hypot(2300, 200) / wallpaper.calibration.widthMm);
  assert.throws(() => linkFinishWallRun(p, wallpaper.id, ['wall-south', 'wall-north']), /adjoining/);
});

test('panel and run imports form a closed bounded contract and reject malformed nested input without throwing', () => {
  for (const corrupt of [
    (p: any) => { p.finishes[0].panels = [null]; },
    (p: any) => { p.finishes[0].panels[0].number = 2; },
    (p: any) => { p.finishes[0].panels[1].texture.sha256 = 'different'; },
    (p: any) => { p.finishes[0].panels[1].widthMm = 200; },
    (p: any) => { p.wallRuns = [null]; },
    (p: any) => { p.wallRuns[0].wallIds = ['wall-south', 'wall-north']; },
    (p: any) => { p.wallRuns[0].startOffsetMm = .1; },
    (p: any) => { p.schemaVersion = 1; },
  ]) { const p = panelRoom(); corrupt(p); assert.ok(validateProject(p).length > 0); assert.doesNotThrow(() => artworkCoverageIssues(p)); assert.doesNotThrow(() => sourceQualityIssues(p)); }
  assert.deepEqual(validateFinishAssets(panelRoom().finishes), []);
});

test('catalogue versions are pinned, reject tampering and detach edited material settings', () => {
  const product = catalogueProducts[0], finish = selectCatalogueFinish(product.productId, product.version, 'customer-instance');
  assert.deepEqual(resolveCatalogueFinish(finish), finish);
  assert.ok(finish.type === 'wallpaper'); finish.calibration.widthMm = 800;
  assert.throws(() => resolveCatalogueFinish(finish), /custom finish/);
  const custom = customArtwork(finish, { appearance: structuredClone(APPEARANCE_PRESETS.metallic) });
  assert.equal(custom.catalogue?.verification, 'custom'); assert.deepEqual(resolveCatalogueFinish(custom), custom);
  assert.notEqual((selectCatalogueFinish(product.productId, product.version, 'second') as ArtworkFinish).calibration.widthMm, 800);
  assert.throws(() => selectCatalogueFinish(product.productId, 'unknown', 'third'), /not approved/);
});

test('camera suggestions target selected wallpaper walls and source quality reacts to closer views', () => {
  const p = panelRoom(); p.cameras = suggestCameras(p.room, ['wall-south']);
  assert.equal(p.cameras[0].target[2], 0);
  const aimed = p.cameras[0].target; assert.ok(!(aimed[0] >= .6 && aimed[0] <= 1.3 && aimed[1] >= .6 && aimed[1] <= 1.3), 'The camera aims at solid wallpaper rather than the window');
  for (const camera of p.cameras) assert.ok(pointInsideRoom(p.room, { x: camera.position[0] * 1000, z: camera.position[2] * 1000 }));
  assert.ok(sourceQualityIssues(p).some(issue => /HD output cannot restore/.test(issue.message)));
});

test('Blender consumes finite-panel positions, UVs, normals and material identities verbatim', { skip: !process.env.BLENDER_BIN }, t => {
  const folder = mkdtempSync(join(tmpdir(), 'room-studio-panels-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const packagePath = join(folder, 'package.json'), scriptPath = join(folder, 'verify.py');
  writeFileSync(packagePath, JSON.stringify(compile(panelRoom())));
  writeFileSync(scriptPath, `import bpy,importlib.util,json\ns=importlib.util.spec_from_file_location('renderer',${JSON.stringify(resolve('workers/room_studio/render.py'))});r=importlib.util.module_from_spec(s);s.loader.exec_module(r)\np=json.load(open(${JSON.stringify(packagePath)}));r.validate_package(p)\nfor item in p['meshes']:\n vertices=[r.blender_point(item['positions'][i:i+3]) for i in range(0,len(item['positions']),3)]\n faces=[item['indices'][i:i+3] for i in range(0,len(item['indices']),3)]\n mesh=bpy.data.meshes.new(item['id']);mesh.from_pydata(vertices,[],faces);mesh.update();layer=mesh.uv_layers.new(name='RoomStudioUV')\n for polygon in mesh.polygons:\n  for loop_index in polygon.loop_indices:\n   vertex=mesh.loops[loop_index].vertex_index;layer.data[loop_index].uv=item['uvs'][vertex*2:vertex*2+2]\n r._apply_compiled_normals(mesh,item);r._verify_compiled_mesh(mesh,item)\nassert len([material for material in p['materials'] if material['type']=='mural'])==2\nprint('FINITE_PANEL_BLENDER_PARITY_OK')\n`);
  const result = spawnSync(process.env.BLENDER_BIN!, ['-b', '--python-exit-code', '1', '--python', scriptPath], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr + result.stdout); assert.match(result.stdout, /FINITE_PANEL_BLENDER_PARITY_OK/);
});

test('all three customer catalogue studies keep the exact calibrated sources and repeat rules of the public examples', () => {
  for (const metadata of roomStudioExamples) {
    const product = catalogueProducts.find(value => value.productId === `mrwallcover-${metadata.id}`)!;
    assert.ok(product); assert.ok(Object.isFrozen(product.finish));
    const finish = selectCatalogueFinish(product.productId, product.version, 'catalogue-check');
    assert.ok(finish.type === 'wallpaper'); assert.deepEqual(validateFinishAssets([finish]), []);
    assert.equal(finish.calibration.widthMm, metadata.repeatMm.width); assert.equal(finish.calibration.heightMm, metadata.repeatMm.height);
    assert.equal(finish.calibration.repeatKind, metadata.id === 'ochre-lshape' ? 'strip' : 'tile');
    assert.equal(finish.calibration.match, metadata.id === 'willow-chimney' ? 'straight' : 'half-drop');
    assert.equal(finish.calibration.offsetAlreadyIncluded, metadata.id === 'indigo-bay');
    const source = Buffer.from(finish.texture.dataUrl!.split(',')[1], 'base64');
    assert.equal(createHash('sha256').update(source).digest('hex'), product.sourceHashes[0]);
    assert.deepEqual(resolveCatalogueFinish(finish), finish);
  }
});

test('replacing a feature wall retains remaining wallpaper phase and requires finite-panel placement review', () => {
  const original = panelRoom(), paper = fixtureArtwork();
  const paint = { id: 'replacement-paint', type: 'paint' as const, name: 'Chalk', colour: '#eee8dd', sheen: 'matte' as const };
  original.finishes.push(paint);
  const changed = assignFinishBand(original, { id: 'new-wall', wallId: 'wall-south', finishId: paint.id, fromMm: 0, toMm: null, offsetXmm: 0, offsetYmm: 0 });
  assert.deepEqual(validateProject(changed), []);
  assert.equal(assignmentOrigin(changed.room, changed.assignments.find(value => value.wallId === 'wall-east')!, changed.wallRuns), -2200);
  assert.ok(artworkCoverageIssues(changed).some(issue => /now has another finish/.test(issue.message)));
  const repeating = structuredClone(original); repeating.finishes = [paper, paint]; repeating.wallRuns![0].finishId = paper.id; repeating.assignments.forEach(value => value.finishId = paper.id);
  const painted = assignFinishBand(repeating, { id: 'feature-paint', wallId: 'wall-south', finishId: paint.id, fromMm: 0, toMm: null, offsetXmm: 0, offsetYmm: 0 });
  assert.deepEqual(validateProject(painted), []); assert.deepEqual(artworkCoverageIssues(painted), []);
  assert.equal(assignmentOrigin(painted.room, painted.assignments.find(value => value.wallId === 'wall-east')!, painted.wallRuns), -2200);
});

test('automatic composition ranks unobstructed finished walls and aims inside the actual finish band', () => {
  const room = createRectangle();
  room.openings = [{ id: 'large-window', kind: 'window', wallId: 'wall-south', offsetMm: 600, widthMm: 3000, heightMm: 1800, sillMm: 650, revealMm: 180 }];
  const views = suggestCameras(room, room.vertices.map(vertex => vertex.wallId));
  assert.equal(views[0].target[2], 3.6, 'The largest unobstructed north wall takes priority over the window wall');
  assert.notDeepEqual(views[0].target, views[1].target, 'Two stills show different finished areas');
  const bands = [{ id: 'dado', finishId: 'wallpaper', wallId: 'wall-south', fromMm: 150, toMm: 600, offsetXmm: 0, offsetYmm: 0 }];
  const bandViews = suggestCameras(room, ['wall-south'], bands);
  for (const view of bandViews.filter(view => view.kind === 'perspective')) assert.ok(view.target[1] >= .15 && view.target[1] <= .6);
  for (const shape of ['l-shape', 'angled'] as const) {
    const p = fixtureProject(shape), cameras = suggestCameras(p.room, p.room.vertices.map(vertex => vertex.wallId));
    for (const camera of cameras) assert.ok(pointInsideRoom(p.room, { x: camera.position[0] * 1000, z: camera.position[2] * 1000 }));
    assert.deepEqual(validateProject({ ...p, cameras }), []);
  }
});
