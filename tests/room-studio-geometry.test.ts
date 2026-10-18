import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileRoom, createLShape, createRectangle, pointInsideRoom, suggestCameras, wallLength } from '../src/room-studio/geometry.ts';
import { fixtureArtwork, fixtureProject, fixtureRevision } from '../src/room-studio/fixtures.ts';
import { signedPlanArea, validateProject, validateRoom } from '../src/room-studio/validation.ts';
import { createLimewashPixels } from '../src/room-studio/finishes.ts';
import type { CompiledMesh, RoomRevision } from '../src/room-studio/types.ts';

const near = (a: number, b: number, message?: string) => assert.ok(Math.abs(a - b) < 1e-6, message ?? `${a} != ${b}`);
function triangleNormal(mesh: CompiledMesh, index: number): number[] {
  const [a, b, c] = mesh.indices.slice(index, index + 3).map(i => mesh.positions.slice(i * 3, i * 3 + 3));
  const u = b.map((n, i) => n - a[i]), v = c.map((n, i) => n - a[i]);
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}
const compile = (project = fixtureProject()) => compileRoom({ id: `${project.id}-revision-${project.revision}`, projectId: project.id, number: project.revision, createdAt: project.updatedAt, project });

test('rectangle and L-shape preserve stable wall IDs and dimensions', () => {
  const room = createRectangle(4600, 3800, 2700);
  assert.equal(wallLength(room, 'wall-south'), 4600);
  assert.equal(wallLength(room, 'missing'), 0);
  assert.deepEqual(createRectangle(5200, 4000).vertices.map(v => v.wallId), room.vertices.map(v => v.wallId));
  assert.equal(validateRoom(room).length, 0);
  assert.equal(validateRoom(createLShape()).length, 0);
});

test('original fixture artwork declares its real PNG dimensions and checksum', () => {
  const texture = fixtureArtwork().texture, png = Buffer.from(texture.dataUrl!.split(',')[1], 'base64');
  assert.equal(png.readUInt32BE(16), texture.widthPx);
  assert.equal(png.readUInt32BE(20), texture.heightPx);
  assert.equal(createHash('sha256').update(png).digest('hex'), texture.sha256);
});

for (const shape of ['rectangle', 'l-shape', 'angled'] as const) {
  test(`${shape} triangles point with their declared inward normals, with closed concave floor and ceiling`, () => {
    const revision = fixtureRevision(shape), pkg = compileRoom(revision);
    assert.equal(validateProject(revision.project).length, 0);
    for (const mesh of pkg.meshes) {
      assert.equal(mesh.normals.length, mesh.positions.length);
      assert.equal(mesh.uvs.length, mesh.positions.length / 3 * 2);
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const normal = triangleNormal(mesh, i), expected = mesh.normals.slice(mesh.indices[i] * 3, mesh.indices[i] * 3 + 3);
        assert.ok(normal.reduce((sum, n, j) => sum + n * expected[j], 0) > 0, `${mesh.id}: triangle ${i / 3} winding`);
      }
    }
    for (const surface of ['floor', 'ceiling']) {
      const mesh = pkg.meshes.find(m => m.surface === surface)!;
      const area = mesh.indices.reduce((sum, _, i) => i % 3 ? sum : sum + Math.abs(triangleNormal(mesh, i)[1]) / 2, 0);
      near(area, signedPlanArea(revision.project.room.vertices) / 1e6);
    }
  });
}

test('self intersections, reversed winding, zero walls and noninteger dimensions are rejected', () => {
  const reversed = createRectangle(); reversed.vertices.reverse();
  assert.ok(validateRoom(reversed).some(i => /counter-clockwise/.test(i.message)));
  const crossing = createRectangle(); [crossing.vertices[1], crossing.vertices[2]] = [crossing.vertices[2], crossing.vertices[1]];
  assert.ok(validateRoom(crossing).some(i => /cross/.test(i.message)));
  const duplicate = createRectangle(); duplicate.vertices[1] = { ...duplicate.vertices[0], wallId: 'unique' };
  assert.ok(validateRoom(duplicate).some(i => /100 mm/.test(i.message)));
  const fractional = createRectangle(); fractional.heightMm = 2600.5;
  assert.ok(validateRoom(fractional).length);
});

test('door floor notches and windows remove only their actual wall cells', () => {
  const project = fixtureProject(), pkg = compile(project), room = project.room;
  const insideSouth = pkg.meshes.filter(m => m.wallId === 'wall-south' && m.id.endsWith('-inside'));
  const area = insideSouth.reduce((sum, m) => sum + (m.positions[3] - m.positions[0]) * (m.positions[7] - m.positions[1]), 0);
  near(area, (4200 * 2600 - 850 * 2100) / 1e6);
  const door = room.openings[0];
  assert.ok(pkg.meshes.some(m => m.id === `${door.id}-door`));
  for (const mesh of insideSouth) {
    const cx = (mesh.positions[0] + mesh.positions[3]) * 500, cy = (mesh.positions[1] + mesh.positions[7]) * 500;
    assert.ok(!(cx > door.offsetMm && cx < door.offsetMm + door.widthMm && cy < door.heightMm));
  }
  assert.ok(!pkg.meshes.some(m => m.id === `${door.id}-sill`));
  const threshold = pkg.meshes.find(m => m.id === `${door.id}-threshold`)!;
  assert.equal(threshold.surface, 'floor');
  assert.ok(threshold.positions.filter((_, i) => i % 3 === 1).every(y => y === 0));
  near(Math.abs(threshold.positions[8] - threshold.positions[2]), door.revealMm / 1000);
  assert.ok(pkg.meshes.some(m => m.id === 'fixture-window-sill'));
});

test('opening validation rejects bounds, overlap, elevated doors and missing wall references', () => {
  const room = fixtureProject().room;
  room.openings.push({ ...room.openings[0], id: 'overlap' });
  assert.ok(validateRoom(room).some(i => /overlap/.test(i.message)));
  room.openings[0].offsetMm = 4000;
  room.openings[0].sillMm = 10;
  room.openings[1].wallId = 'missing';
  const messages = validateRoom(room).map(i => i.message).join(' ');
  assert.match(messages, /past the end/); assert.match(messages, /finished floor/); assert.match(messages, /existing wall/);
});

test('reveal depth uses the supplied millimetres including shallow and flush openings', () => {
  const project = fixtureProject();
  for (const depth of [0, 50, 230]) {
    project.room.openings[0].revealMm = depth;
    const pkg = compile(project), door = pkg.meshes.find(m => m.id === 'fixture-door-door')!;
    near(door.positions[2], -depth / 1000);
    const reveal = pkg.meshes.find(m => m.id === 'fixture-door-reveal-left');
    assert.equal(Boolean(reveal), depth > 0);
    if (reveal) near(Math.abs(reveal.positions[5] - reveal.positions[2]), depth / 1000);
    const outside = pkg.meshes.find(m => m.wallId === 'wall-south' && m.id.endsWith('-outside'));
    assert.equal(Boolean(outside), depth > 0);
    if (outside) near(outside.positions[2], -depth / 1000);
  }
});

test('wallpaper UVs retain true physical scale through openings, bands and room resize', () => {
  const project = fixtureProject();
  const check = (pkg: ReturnType<typeof compile>) => {
    for (const mesh of pkg.meshes.filter(m => m.materialId === 'fixture-wallpaper')) {
      const width = Math.hypot(mesh.positions[3] - mesh.positions[0], mesh.positions[5] - mesh.positions[2]);
      near(mesh.uvs[2] - mesh.uvs[0], width / .530);
      near(mesh.uvs[5] - mesh.uvs[1], (mesh.positions[7] - mesh.positions[1]) / .640);
    }
  };
  check(compile(project));
  project.room.vertices[1].x += 1000; project.room.vertices[2].x += 1000; project.cameras = suggestCameras(project.room);
  check(compile(project));
  const south = project.assignments.find(a => a.wallId === 'wall-south')!;
  south.fromMm = 800; south.toMm = 1800;
  for (const mesh of compile(project).meshes.filter(m => m.materialId === 'fixture-wallpaper' && m.wallId === 'wall-south')) {
    assert.ok(Math.min(...mesh.positions.filter((_, i) => i % 3 === 1)) >= .8);
    assert.ok(Math.max(...mesh.positions.filter((_, i) => i % 3 === 1)) <= 1.8);
  }
});

test('half-drop applies once to odd strips only and does not stagger complete tiles', () => {
  const project = fixtureProject(); project.room.openings = []; project.room.skirtingMm = 0; project.room.corniceMm = 0;
  const artwork = project.finishes[0] as ReturnType<typeof fixtureArtwork>;
  artwork.calibration.repeatKind = 'strip'; artwork.calibration.match = 'half-drop';
  const cells = compile(project).meshes.filter(m => m.wallId === 'wall-south' && m.materialId === artwork.id);
  const first = cells.find(m => Math.abs(m.positions[0]) < 1e-9)!;
  const second = cells.find(m => Math.abs(m.positions[0] - .530) < 1e-9)!;
  near(first.uvs[1], 0); near(second.uvs[1], -.5);
  for (const mode of ['already-included', 'tile'] as const) {
    artwork.calibration.offsetAlreadyIncluded = mode === 'already-included'; artwork.calibration.repeatKind = mode === 'tile' ? 'tile' : 'strip';
    const output = compile(project).meshes.filter(m => m.wallId === 'wall-south' && m.materialId === artwork.id);
    near(output[0].uvs[1], 0);
    assert.equal(output.length, 1);
  }
});

test('negative set-out offsets preserve half-drop strip parity and excessive subdivisions stop early', () => {
  const project = fixtureProject(); project.room.openings = []; project.room.skirtingMm = 0; project.room.corniceMm = 0;
  const artwork = project.finishes[0] as ReturnType<typeof fixtureArtwork>;
  artwork.calibration.repeatKind = 'strip'; artwork.calibration.match = 'half-drop';
  project.assignments[0].offsetXmm = 530;
  const cells = compile(project).meshes.filter(m => m.wallId === 'wall-south' && m.materialId === artwork.id);
  near(cells[0].uvs[0], -1); near(cells[0].uvs[1], -.5);
  near(cells[1].uvs[0], 0); near(cells[1].uvs[1], 0);
  artwork.calibration.widthMm = 1;
  assert.throws(() => compile(project), /512 strips/);
  artwork.calibration.widthMm = 10;
  project.assignments = Array.from({ length: 96 }, (_, i) => ({ ...project.assignments[0], id: `band-${i}`, fromMm: i * 20, toMm: i * 20 + 10 }));
  assert.throws(() => compile(project), /geometry is too complex/);
});

test('mural is a finite nonrepeating region and crop/rotation is prepared once outside UVs', () => {
  const project = fixtureProject(); project.room.openings = [];
  const artwork = project.finishes[0] as ReturnType<typeof fixtureArtwork>;
  artwork.type = 'mural'; artwork.calibration.widthMm = 1600; artwork.calibration.heightMm = 999;
  artwork.calibration.crop = { x: .25, y: .1, width: .5, height: .8 }; artwork.calibration.rotation = 90;
  const assignment = project.assignments[0]; assignment.offsetXmm = 800; assignment.offsetYmm = 300;
  const pkg = compile(project), meshes = pkg.meshes.filter(m => m.materialId === artwork.id && m.wallId === 'wall-south');
  assert.ok(meshes.length);
  for (const mesh of meshes) {
    assert.ok(mesh.positions[0] >= .8 - 1e-8 && mesh.positions[3] <= 2.4 + 1e-8);
    assert.ok(mesh.uvs.every(v => v >= -1e-8 && v <= 1 + 1e-8));
  }
  const material = pkg.materials.find(m => m.id === artwork.id)!;
  assert.equal(material.repeat, false);
  assert.deepEqual(material.texturePreparation, { crop: artwork.calibration.crop, rotation: 90 });
});

test('finish validation rejects overlaps and unknown finish IDs', () => {
  const project = fixtureProject(); project.assignments.push({ ...project.assignments[0], id: 'duplicate-band', finishId: 'missing' });
  const messages = validateProject(project).map(i => i.message).join(' ');
  assert.match(messages, /overlap/); assert.match(messages, /existing finish/);
  assert.throws(() => compile(project), /assignments/);
});

test('artwork texture identity, project revision and immutable snapshot identity must agree', () => {
  const project = fixtureProject(), artwork = structuredClone(fixtureArtwork());
  artwork.id = 'other-artwork'; artwork.texture.sha256 = '1'.repeat(64); project.finishes.push(artwork);
  assert.ok(validateProject(project).some(i => /same artwork/.test(i.message)));
  const revision = fixtureRevision();
  assert.throws(() => compileRoom({ ...revision, projectId: 'another-project' }), /matching project ID/);
  assert.throws(() => compileRoom({ ...revision, number: revision.number + 1 }), /revision number/);
  assert.throws(() => compileRoom({ ...revision, id: '' }), /identified snapshot/);
  revision.project.revision = 0;
  assert.ok(validateProject(revision.project).some(i => i.path === 'revision'));
});

test('unused artwork library assets are excluded from the render package', () => {
  const project = fixtureProject(), unused = fixtureArtwork();
  unused.id = 'unused-artwork'; unused.texture.id = 'unused-texture'; project.finishes.push(unused);
  const pkg = compile(project);
  assert.ok(!pkg.materials.some(m => m.id === unused.id));
  assert.ok(!pkg.textures.some(t => t.id === unused.texture.id));
  assert.ok(project.finishes.some(f => f.id === unused.id));
});

test('camera defaults stay inside concave/angled rooms and saved external cameras fail validation', () => {
  for (const room of [createRectangle(), createLShape(), fixtureProject('angled').room]) {
    const cameras = suggestCameras(room); assert.equal(cameras.length, 3);
    for (const camera of cameras) {
      assert.ok(pointInsideRoom(room, { x: camera.position[0] * 1000, z: camera.position[2] * 1000 }));
      assert.ok(camera.position[1] > 0 && camera.position[1] < room.heightMm / 1000);
    }
  }
  assert.equal(pointInsideRoom(createLShape(), { x: 5000, z: 4000 }), false);
  assert.equal(pointInsideRoom(createRectangle(), { x: 0, z: 1200 }), false);
  const room = createRectangle(); room.heightMm = NaN; assert.deepEqual(suggestCameras(room), []);
  const project = fixtureProject(); project.cameras[0].position = [100, 1, 100];
  assert.ok(validateProject(project).some(i => i.path.startsWith('cameras')));
});

test('compiled snapshots are deterministic, detached and render Python consumes the same geometry identity', t => {
  const revision = fixtureRevision('l-shape'), before = JSON.stringify(revision), pkg = compileRoom(revision);
  assert.equal(JSON.stringify(pkg), JSON.stringify(compileRoom(revision)));
  assert.equal(JSON.stringify(revision), before);
  const folder = mkdtempSync(join(tmpdir(), 'room-studio-parity-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const packagePath = join(folder, 'package.json'); writeFileSync(packagePath, JSON.stringify(pkg));
  const result = spawnSync('python3', [resolve('workers/room_studio/render.py'), '--inspect', '--package', packagePath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const identity = JSON.parse(result.stdout);
  assert.equal(identity.revisionId, revision.id);
  assert.equal(identity.meshes, pkg.meshes.length);
  assert.equal(identity.vertices, pkg.meshes.reduce((sum, m) => sum + m.positions.length / 3, 0));
  assert.equal(identity.triangles, pkg.meshes.reduce((sum, m) => sum + m.indices.length / 3, 0));
  assert.deepEqual(identity.cameras, pkg.cameras);
  assert.deepEqual(identity.outputs, { stills: [1920, 1080], panorama: [4096, 2048] });
  assert.match(identity.geometrySha256, /^[0-9a-f]{64}$/);
});

test('Python and browser bake exactly the same seeded limewash bytes', () => {
  const expected = createHash('sha256').update(createLimewashPixels('#b4aa93', 9127, 32)).digest('hex');
  const python = `import importlib.util,hashlib; s=importlib.util.spec_from_file_location('renderer','workers/room_studio/render.py'); m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(hashlib.sha256(m.limewash_pixels('#b4aa93',9127,32)).hexdigest()); print(m.blender_point([1,2,3]))`;
  const result = spawnSync('python3', ['-c', python], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.split('\n')[0], expected);
  assert.equal(result.stdout.split('\n')[1], '(1, -3, 2)');
});

test('Blender preserves cropped/rotated pixels, caps artwork and matches the browser vertical camera lens', { skip: !process.env.BLENDER_BIN }, t => {
  const folder = mkdtempSync(join(tmpdir(), 'room-studio-blender-')); t.after(() => rmSync(folder, { recursive: true, force: true }));
  const sourcePath = join(folder, 'source.png'), scriptPath = join(folder, 'check.py');
  writeFileSync(sourcePath, Buffer.from(fixtureArtwork().texture.dataUrl!.split(',')[1], 'base64'));
  writeFileSync(scriptPath, `import bpy,importlib.util,numpy as np\ns=importlib.util.spec_from_file_location('renderer',${JSON.stringify(resolve('workers/room_studio/render.py'))})\nr=importlib.util.module_from_spec(s);s.loader.exec_module(r)\na=bpy.data.images.load(${JSON.stringify(sourcePath)})\nwidth,height=a.size\nsource=np.array(a.pixels[:],dtype=np.float32).reshape(height,width,4)[::-1]\nfor rotation in [0,90,180,270]:\n b=r._prepare_image(bpy,a,{'crop':{'x':.25,'y':.125,'width':.5,'height':.75},'rotation':rotation},'prepared')\n expected=np.rot90(source[int(height*.125):int(height*.875),int(width*.25):int(width*.75)],k=-(rotation//90))\n h,w=expected.shape[:2]\n assert tuple(b.size)==(w,h)\n actual=np.array(b.pixels[:]).reshape(h,w,4)[::-1]\n assert np.max(np.abs(actual-expected))<.000001\nwide=bpy.data.images.new('wide',width=8192,height=1)\nsmall=r._prepare_image(bpy,wide,{'crop':{'x':0,'y':0,'width':1,'height':1},'rotation':0},'capped')\nassert tuple(small.size)==(4096,1)\nprint('ROOM_STUDIO_PREPARATION_OK')\n`);
  writeFileSync(scriptPath, "\nimport math\ncamera=bpy.data.cameras.new('lens-check')\nr._configure_camera_projection(camera,{'kind':'perspective','fov':65})\nassert camera.sensor_fit=='VERTICAL'\nassert abs(math.degrees(camera.angle_y)-65)<.00001\nr._configure_camera_projection(camera,{'kind':'panorama','fov':90})\nassert camera.type=='PANO' and camera.panorama_type=='EQUIRECTANGULAR'\n", { flag: 'a' });
  const result = spawnSync(process.env.BLENDER_BIN!, ['-b', '--python-exit-code', '1', '--python', scriptPath], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /ROOM_STUDIO_PREPARATION_OK/);
});
