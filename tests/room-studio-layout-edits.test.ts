import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtureProject } from '../src/room-studio/fixtures.ts';
import { reconcileRoomRuns } from '../src/room-studio/room-edits.ts';

test('dimension edits retain installations; topology edits clear active and saved run references', () => {
  const project = fixtureProject(); project.schemaVersion = 2;
  const run = { id: 'connected', finishId: project.finishes[0].id, wallIds: project.room.vertices.map(vertex => vertex.wallId), startOffsetMm: 3.2 };
  project.wallRuns = [run]; project.assignments = project.assignments.map(assignment => ({ ...assignment, runId: run.id }));
  project.schemes = [{ id: 'scheme', name: 'Saved installation', finishes: structuredClone(project.finishes), assignments: structuredClone(project.assignments), wallRuns: structuredClone(project.wallRuns) }];
  project.room.vertices[1].x += 100;
  assert.equal(reconcileRoomRuns(project).removed, false);
  assert.equal(reconcileRoomRuns(project).project.wallRuns![0].startOffsetMm, 3.2);
  project.room.vertices.splice(1, 1);
  const result = reconcileRoomRuns(project);
  assert.equal(result.removed, true); assert.deepEqual(result.project.wallRuns, []); assert.deepEqual(result.project.schemes[0].wallRuns, []);
  assert.ok(result.project.assignments.every(assignment => !assignment.runId)); assert.ok(result.project.schemes[0].assignments.every(assignment => !assignment.runId));
  assert.equal(project.schemes[0].wallRuns!.length, 1, 'The undo/history input is untouched');
});
