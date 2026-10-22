import type { FinishWallRun, RoomProject, WallFinishAssignment } from './types.ts';

/** Topology edits invalidate connected installations in saved schemes as well. */
export function reconcileRoomRuns(project: RoomProject): { project: RoomProject; removed: boolean } {
  const ids = project.room.vertices.map(vertex => vertex.wallId);
  let removed = false;
  function reconcile(assignments: WallFinishAssignment[], wallRuns: FinishWallRun[] = []) {
    const runs = wallRuns.filter(run => run.wallIds.every((id, index) => ids.includes(id) && (index === 0 || ids[(ids.indexOf(run.wallIds[index - 1]) + 1) % ids.length] === id)));
    const valid = new Set(runs.map(run => run.id));
    if (runs.length !== wallRuns.length) removed = true;
    const next = assignments.map(assignment => {
      if (!assignment.runId || valid.has(assignment.runId)) return assignment;
      removed = true;
      const { runId, ...rest } = assignment;
      return rest;
    });
    return { assignments: next, ...(wallRuns.length ? { wallRuns: runs } : {}) };
  }
  const current = reconcile(project.assignments, project.wallRuns);
  const schemes = project.schemes.map(scheme => ({ ...scheme, ...reconcile(scheme.assignments, scheme.wallRuns) }));
  return { project: { ...project, ...current, schemes }, removed };
}
