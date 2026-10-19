import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureArtwork, fixtureProject } from '../src/room-studio/fixtures.ts';
import { compileRoom, createRectangle, wallLength } from '../src/room-studio/geometry.ts';
import { createManufacturerPreviewProject } from '../src/room-studio/manufacturer-preview.ts';
import { createReliefWall, reliefHeight } from '../src/room-studio/relief.ts';
import type { ReliefProfile } from '../src/room-studio/relief.ts';
import type { ArtworkFinish, CompiledMesh, RoomProject, Vec3 } from '../src/room-studio/types.ts';
import { validateProject } from '../src/room-studio/validation.ts';

type Pair = [number, number];
const profile: ReliefProfile = { kind: 'coffered', depthMm: 8, columns: 9, rows: 5 };
const near = (actual: number, expected: number, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a: number[], b: number[]): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vertex = (mesh: CompiledMesh, index: number) => mesh.positions.slice(index * 3, index * 3 + 3);
const triangles = (mesh: CompiledMesh) => Array.from({ length: mesh.indices.length / 3 }, (_, i) => mesh.indices.slice(i * 3, i * 3 + 3));
const compile = (project: RoomProject) => compileRoom({ id: 'relief-test-revision', projectId: project.id, number: project.revision, createdAt: project.updatedAt, project });

function caissonProject(): RoomProject {
  // Existing original geometric fixture pixels only; no supplier artwork in Git.
  return createManufacturerPreviewProject('arte-caisson-61533', {
    texture: fixtureArtwork().texture,
    coverage: { widthMm: 3690, heightMm: 2300, status: 'assumed', evidence: 'Test-only original pixels exercising the private nine-column, five-row source coverage.' },
  }).project;
}

test('coffered depth stays bounded and preserves its physical cell phase across negative offsets and source repeats', () => {
  let maximum = 0;
  for (let i = -30; i <= 30; i++) for (let j = -20; j <= 20; j++) {
    const u = i / 29, v = j / 19, height = reliefHeight(u, v, profile);
    assert.ok(Number.isFinite(height) && height >= 0 && height <= .008);
    near(height, reliefHeight(u + 1 / 9, v, profile)); near(height, reliefHeight(u, v + 1 / 5, profile));
    near(height, reliefHeight(u + 1, v + 1, profile)); maximum = Math.max(maximum, height);
  }
  assert.ok(maximum > .0075, 'The profile produces visible raised geometry rather than a flat textured plane');
  for (const u of [-2, -1 / 9, 0, 1 / 9, 1]) for (const v of [.013, .12, .337]) near(reliefHeight(u, v, profile), 0, 1e-8);
});

test('splitting a raised wall at a non-seam boundary retains identical physical vertices and UV phase', () => {
  const make = (start: number, end: number, u0: number, u1: number) => createReliefWall('split', 'paper', [[start, 0, 0], [end, 0, 0], [end, 1.8, 0], [start, 1.8, 0]], [0, 0, 1], [[u0, -.13], [u1, -.13], [u1, .87], [u0, .87]], 'wall', profile);
  const left = make(0, 1.2, -.07, .41), right = make(1.2, 2.4, .41, .89);
  const boundary = (mesh: CompiledMesh) => [...new Set(mesh.uvs.flatMap((_, i) => i % 2 === 0 && Math.abs(mesh.uvs[i] - .41) < 1e-8 ? [JSON.stringify([mesh.uvs[i + 1], ...vertex(mesh, i / 2)].map(value => Math.round(value * 1e9) / 1e9))] : []))].sort();
  assert.ok(boundary(left).length > 30); assert.deepEqual(boundary(left), boundary(right), 'Opening or band subdivisions must not restart the coffer profile');
  for (const mesh of [left, right]) for (let i = 0; i < mesh.positions.length / 3; i++) {
    const [x, y, z] = vertex(mesh, i), [u, v] = mesh.uvs.slice(i * 2, i * 2 + 2);
    near(u, -.07 + x * .4); near(v, -.13 + y / 1.8);
    assert.ok(Math.abs(z) < 1e-8 || Math.abs(z - reliefHeight(u, v, profile)) < 1e-8, 'Cap vertices return to the nominal wall; front vertices retain absolute profile height');
  }
});

for (const kind of ['coffered', 'faceted'] as const) test(`${kind} relief fronts and clipped caps have finite unit normals and nondegenerate correctly wound triangles`, () => {
  const normal: Vec3 = [-.8, 0, .6], mesh = createReliefWall('clipped', 'paper', [[0, 0, 0], [1.02, 0, 1.36], [1.02, 1.8, 1.36], [0, 1.8, 0]], normal, [[-.07, .13], [.53, .13], [.53, .87], [-.07, .87]], 'angled-wall', { ...profile, kind });
  assert.ok(mesh.positions.length / 3 > 500); assert.equal(mesh.normals.length, mesh.positions.length); assert.equal(mesh.uvs.length, mesh.positions.length / 3 * 2);
  assert.ok([...mesh.positions, ...mesh.normals, ...mesh.uvs].every(Number.isFinite));
  let capVertices = 0;
  for (let i = 0; i < mesh.positions.length / 3; i++) {
    const n = mesh.normals.slice(i * 3, i * 3 + 3), p = vertex(mesh, i);
    near(Math.hypot(...n), 1); assert.ok(dot(p, normal) >= -1e-8 && dot(p, normal) <= .008 + 1e-8);
    if (Math.abs(dot(n, normal)) < 1e-8) capVertices++;
  }
  assert.ok(capVertices > 0, 'A cropped raised edge has solid closure caps');
  for (const ids of triangles(mesh)) {
    assert.ok(ids.every(index => Number.isInteger(index) && index >= 0 && index < mesh.positions.length / 3));
    const [a, b, c] = ids.map(index => vertex(mesh, index)), face = cross(b.map((value, i) => value - a[i]), c.map((value, i) => value - a[i]));
    assert.ok(Math.hypot(...face) > 1e-12, 'A source seam may collapse one cap corner, but must not emit a zero-area triangle');
    const expected = mesh.normals.slice(ids[0] * 3, ids[0] * 3 + 3);
    assert.ok(dot(face, expected) > 0, 'Triangle winding must agree with the declared outward/front normal');
  }
});

function clippedArea(triangle: Pair[], x0: number, x1: number, y0: number, y1: number): number {
  let polygon = triangle;
  for (const [axis, limit, sign] of [[0, x0, 1], [0, x1, -1], [1, y0, 1], [1, y1, -1]]) {
    const result: Pair[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], aIn = (a[axis] - limit) * sign >= 0, bIn = (b[axis] - limit) * sign >= 0;
      if (aIn) result.push(a);
      if (aIn !== bIn) { const t = (limit - a[axis]) / (b[axis] - a[axis]); result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
    }
    polygon = result;
  }
  return Math.abs(polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
}

test('whole-room coffered compilation preserves opening cut-outs, complete coverage and UV phase through angled walls', () => {
  const project = caissonProject(), scene = compile(project), finish = project.finishes.find(finish => finish.type === 'wallpaper') as ArtworkFinish;
  assert.deepEqual(validateProject(project), []); assert.ok(project.room.openings.some(opening => opening.kind === 'window')); assert.ok(project.room.openings.some(opening => opening.kind === 'door'));
  assert.equal(scene.materials.find(material => material.id === finish.id)?.appearance?.relief?.columns, 9);
  let vertices = 0;
  project.room.vertices.forEach((a, wallIndex) => {
    const b = project.room.vertices[(wallIndex + 1) % project.room.vertices.length], length = wallLength(project.room, a.wallId), dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
    const assignment = project.assignments.find(assignment => assignment.wallId === a.wallId)!, openings = project.room.openings.filter(opening => opening.wallId === a.wallId);
    const projectPoint = (p: number[]): Pair => [((p[0] * 1000 - a.x) * dx + (p[2] * 1000 - a.z) * dz) / 1000, p[1]];
    let wallArea = 0;
    for (const mesh of scene.meshes.filter(mesh => mesh.wallId === a.wallId && mesh.id.endsWith('-inside'))) {
      assert.equal(mesh.materialId, finish.id); vertices += mesh.positions.length / 3;
      for (let i = 0; i < mesh.positions.length / 3; i++) {
        const [along, y] = projectPoint(vertex(mesh, i));
        near(mesh.uvs[i * 2], (along * 1000 - assignment.offsetXmm) / 3690); near(mesh.uvs[i * 2 + 1], (y * 1000 - assignment.offsetYmm) / 2300);
      }
      for (const ids of triangles(mesh)) {
        const points = ids.map(index => projectPoint(vertex(mesh, index))), [p, q, r] = points;
        wallArea += Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / 2;
        for (const opening of openings) {
          // UV cut coordinates are rounded to 1e-9. Ignore less than 0.0001 mm
          // at the exact boundary, while testing the actual opening interior.
          const edgeTolerance = 1e-7;
          const overlap = clippedArea(points, opening.offsetMm / 1000 + edgeTolerance, (opening.offsetMm + opening.widthMm) / 1000 - edgeTolerance, opening.sillMm / 1000 + edgeTolerance, (opening.sillMm + opening.heightMm) / 1000 - edgeTolerance);
          assert.ok(overlap < 1e-10, `${opening.id}: no relief triangle may cover any window/door area; ${mesh.id} overlap ${overlap} m², points ${JSON.stringify(points)}`);
        }
      }
    }
    near(wallArea, (length * project.room.heightMm - openings.reduce((sum, opening) => sum + opening.widthMm * opening.heightMm, 0)) / 1e6, 1e-6);
  });
  assert.ok(vertices > 10000, 'The actual compiled room includes relief geometry');
  assert.ok(scene.meshes.reduce((sum, mesh) => sum + mesh.positions.length / 3, 0) < 250000, 'The selected full-room study fits the shared rendering budget');
});

test('every whole-room indexed triangle retains nonzero area after the renderers convert positions to Float32', () => {
  const project = caissonProject(), scene = compile(project);
  let testedTriangles = 0, angledReliefCaps = 0;
  for (const mesh of scene.meshes) {
    if (mesh.id.endsWith('-inside') && /indigo-bay-(left|right)-/.test(mesh.id)) {
      const wallIndex = project.room.vertices.findIndex(wall => wall.wallId === mesh.wallId), a = project.room.vertices[wallIndex], b = project.room.vertices[(wallIndex + 1) % project.room.vertices.length], length = wallLength(project.room, a.wallId), inward = [-(b.z - a.z) / length, 0, (b.x - a.x) / length];
      for (let i = 0; i < mesh.normals.length; i += 3) if (Math.abs(dot(mesh.normals.slice(i, i + 3), inward)) < 1e-8) angledReliefCaps++;
    }
    for (const [triangleIndex, ids] of triangles(mesh).entries()) {
      const [a, b, c] = ids.map(index => vertex(mesh, index).map(Math.fround));
      const face = cross(b.map((value, i) => value - a[i]), c.map((value, i) => value - a[i]));
      assert.ok(Math.hypot(...face) > 1e-12, `${mesh.id}: triangle ${triangleIndex} collapses after Float32 coordinate conversion`);
      testedTriangles++;
    }
  }
  assert.ok(testedTriangles > 40000, 'Check the actual full-room tessellation, including window frames and relief opening caps');
  assert.ok(angledReliefCaps > 100, 'The regression includes clipped caps on angled bay walls, where nanometre seam heights previously collapsed');
});

test('relief detail guards reject unsafe per-wall and aggregate room tessellation', () => {
  const points: Vec3[] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
  assert.throws(() => createReliefWall('tiny', 'paper', points, [0, 0, 1], [[0, 0], [601, 0], [601, 1], [0, 1]], 'wall', { ...profile, columns: 1, rows: 1 }), /cells are too small/);
  assert.throws(() => createReliefWall('dense', 'paper', points, [0, 0, 1], [[0, 0], [2, 0], [2, 2], [0, 2]], 'wall', { ...profile, columns: 24, rows: 24 }), /per-wall detail budget/);
  const project = fixtureProject(); project.room = createRectangle(20000, 20000, 5800); project.room.skirtingMm = 0; project.room.corniceMm = 0;
  const finish = project.finishes[0] as ArtworkFinish; finish.calibration.widthMm = 3690; finish.calibration.heightMm = 2300; finish.appearance = { roughness: .85, metalness: 0, relief: profile };
  project.assignments = project.room.vertices.map(vertex => ({ id: `dense-${vertex.wallId}`, wallId: vertex.wallId, finishId: finish.id, fromMm: 0, toMm: null, offsetXmm: 0, offsetYmm: 0 }));
  assert.deepEqual(validateProject(project), []);
  assert.throws(() => compile(project), /250,000 vertex budget/, 'Individually permitted wall meshes must still obey the room-wide budget');
});
