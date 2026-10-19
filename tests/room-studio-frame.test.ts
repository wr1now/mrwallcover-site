import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureProject } from '../src/room-studio/fixtures.ts';
import { compileRoom, wallLength } from '../src/room-studio/geometry.ts';
import type { CompiledMesh, RoomProject } from '../src/room-studio/types.ts';
import { validateProject } from '../src/room-studio/validation.ts';

const compile = (project: RoomProject) => compileRoom({ id: 'frame-test-revision', projectId: project.id, number: project.revision, createdAt: project.updatedAt, project });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} differs from ${b}`);
const faceNormal = (mesh: CompiledMesh, i: number) => {
  const [a, b, c] = mesh.indices.slice(i, i + 3).map(index => mesh.positions.slice(index * 3, index * 3 + 3));
  const u = b.map((value, j) => value - a[j]), v = c.map((value, j) => value - a[j]);
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
};

test('absent and zero window frames preserve the exact existing package geometry and UVs', () => {
  const project = fixtureProject('angled'), baseline = compile(project);
  assert.ok(!baseline.meshes.some(mesh => mesh.id.includes('-frame-')));
  for (const opening of project.room.openings) opening.frameMm = 0;
  assert.deepEqual(validateProject(project), []); assert.deepEqual(compile(project), baseline, 'The opt-in frame must not change any default vertex, normal, UV, mesh ordering or material');
});

test('45 mm window frames add four closed beams within the original opening without changing the measured walls or UVs', () => {
  for (const shape of ['rectangle', 'angled'] as const) {
    const project = fixtureProject(shape), baseline = compile(project), originalRoom = structuredClone(project.room);
    const opening = project.room.openings.find(opening => opening.kind === 'window')!; opening.frameMm = 45;
    const framed = compile(project), frames = framed.meshes.filter(mesh => mesh.id.startsWith(`${opening.id}-frame-`));
    assert.deepEqual(validateProject(project), []); assert.equal(frames.length, 4 * 6);
    assert.deepEqual(framed.meshes.filter(mesh => !mesh.id.includes('-frame-')), baseline.meshes, 'The frame cannot move wall cells, opening reveals or artwork UVs');
    assert.deepEqual(project.room, { ...originalRoom, openings: originalRoom.openings.map(candidate => candidate.id === opening.id ? { ...candidate, frameMm: 45 } : candidate) });
    const wallIndex = project.room.vertices.findIndex(vertex => vertex.wallId === opening.wallId), a = project.room.vertices[wallIndex], b = project.room.vertices[(wallIndex + 1) % project.room.vertices.length], length = wallLength(project.room, a.wallId), dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
    const insideNormal = [-dz, 0, dx];
    const bounds = new Map<string, { x: number[]; y: number[] }>();
    for (const mesh of frames) {
      assert.equal(mesh.surface, 'reveal'); assert.equal(mesh.materialId, 'neutral-trim'); assert.equal(mesh.wallId, opening.wallId);
      assert.ok([...mesh.positions, ...mesh.normals, ...mesh.uvs].every(Number.isFinite));
      const beam = mesh.id.slice(`${opening.id}-frame-`.length).split('-')[0], beamBounds = bounds.get(beam) ?? { x: [], y: [] }; bounds.set(beam, beamBounds);
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const p = mesh.positions.slice(i, i + 3), relative = [p[0] * 1000 - a.x, p[1] * 1000, p[2] * 1000 - a.z], along = relative[0] * dx + relative[2] * dz, inset = relative.reduce((sum, value, j) => sum + value * insideNormal[j], 0);
        assert.ok(along >= opening.offsetMm - 1e-6 && along <= opening.offsetMm + opening.widthMm + 1e-6);
        assert.ok(relative[1] >= opening.sillMm - 1e-6 && relative[1] <= opening.sillMm + opening.heightMm + 1e-6);
        assert.ok(inset >= -opening.revealMm - 1e-6 && inset <= -opening.revealMm + 35 + 1e-6);
        beamBounds.x.push(along); beamBounds.y.push(relative[1]); near(Math.hypot(...mesh.normals.slice(i, i + 3)), 1);
      }
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const normal = faceNormal(mesh, i), expected = mesh.normals.slice(mesh.indices[i] * 3, mesh.indices[i] * 3 + 3);
        assert.ok(Math.hypot(...normal) > 1e-12); assert.ok(normal.reduce((sum, value, j) => sum + value * expected[j], 0) > 0, `${mesh.id}: every front/back/left/right/top/bottom face points out of its solid beam`);
      }
    }
    for (const [name, bound] of bounds) {
      if (name === 'left' || name === 'right') { near(Math.max(...bound.x) - Math.min(...bound.x), 45); near(Math.max(...bound.y) - Math.min(...bound.y), opening.heightMm); }
      else { near(Math.max(...bound.y) - Math.min(...bound.y), 45); near(Math.max(...bound.x) - Math.min(...bound.x), opening.widthMm - 90); }
    }
    const frontArea = frames.filter(mesh => mesh.id.endsWith('-front')).reduce((sum, mesh) => sum + Math.hypot(...faceNormal(mesh, 0)), 0);
    near(frontArea, (opening.widthMm * opening.heightMm - (opening.widthMm - 90) * (opening.heightMm - 90)) / 1e6);
  }
});

test('frames reject nonfinite, fractional, oversized, closed-opening and positive door-frame inputs', () => {
  for (const value of [NaN, Infinity, -1, 45.5, 101]) {
    const project = fixtureProject(), opening = project.room.openings.find(opening => opening.kind === 'window')!; opening.frameMm = value;
    assert.ok(validateProject(project).some(issue => issue.path.endsWith('.frameMm')), `Reject frame width ${value}`); assert.throws(() => compile(project), /window frame/);
  }
  const narrow = fixtureProject(), window = narrow.room.openings.find(opening => opening.kind === 'window')!; window.widthMm = 100; window.frameMm = 50;
  assert.ok(validateProject(narrow).some(issue => issue.path.endsWith('.frameMm')), 'Two opposing beams cannot close the measured opening');
  const door = fixtureProject(); door.room.openings.find(opening => opening.kind === 'door')!.frameMm = 45;
  assert.ok(validateProject(door).some(issue => issue.path.endsWith('.frameMm'))); assert.throws(() => compile(door), /Door frames are not supported/);
});
