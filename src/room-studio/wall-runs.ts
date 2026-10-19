import type { ArtworkFinish, FinishWallRun, RoomDefinition, RoomProject, TextureAsset, ValidationIssue, WallFinishAssignment } from './types.ts';

export const panelMaterialId = (finishId: string, index: number) => `${finishId}--panel-${index + 1}`;
export const finishTextures = (finish: RoomProject['finishes'][number]): TextureAsset[] => finish.type === 'wallpaper' || finish.type === 'mural' ? finish.panels?.length ? finish.panels.map(panel => panel.texture) : [finish.texture] : [];
const length = (room: RoomDefinition, wallId: string) => { const i = room.vertices.findIndex(vertex => vertex.wallId === wallId); if (i < 0) return 0; const a = room.vertices[i], b = room.vertices[(i + 1) % room.vertices.length]; return Math.hypot(b.x - a.x, b.z - a.z); };

/** Horizontal origin on this wall. Wall lengths remain unrounded, including angled returns. */
export function assignmentOrigin(room: RoomDefinition, assignment: WallFinishAssignment, runs: FinishWallRun[] = []): number {
  const run = assignment.runId && Array.isArray(runs) ? runs.find(value => value?.id === assignment.runId) : undefined;
  if (!run || !Array.isArray(run.wallIds) || !Number.isFinite(run.startOffsetMm)) return assignment.offsetXmm;
  const index = run.wallIds.indexOf(assignment.wallId);
  return run.startOffsetMm - run.wallIds.slice(0, Math.max(0, index)).reduce((sum, wallId) => sum + length(room, wallId), 0);
}
export function orderedPanels(finish: ArtworkFinish) {
  let tenths = 0;
  return (Array.isArray(finish.panels) ? finish.panels : []).flatMap((panel, index) => { if (!panel || !panel.texture || ![panel.widthMm, panel.heightMm, panel.texture.widthPx, panel.texture.heightPx].every(value => Number.isFinite(value) && value > 0)) return [];  const startMm = tenths / 10; tenths += Math.round(panel.widthMm * 10); return [{ panel, index, startMm, endMm: tenths / 10 }]; });
}

/** Coverage warnings do not prevent the editable browser preview. Confirmation must reject them. */
export function artworkCoverageIssues(project: RoomProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  project.assignments.forEach((assignment, index) => {
    const finish = project.finishes.find(value => value.id === assignment.finishId);
    if (!finish || finish.type !== 'mural') return;
    if (finish.panels !== undefined && (!Array.isArray(finish.panels) || !finish.panels.length || orderedPanels(finish).length !== finish.panels.length)) { issues.push({ path: `assignments.${index}.coverage`, message: `${finish.name}: repair the numbered panel files and dimensions before rendering.` }); return; }
    if (finish.panels?.length) {
      const run = Array.isArray(project.wallRuns) ? project.wallRuns.find(value => value?.id === assignment.runId) : undefined;
      if (run && Array.isArray(run.wallIds) && run.wallIds.some(wallId => !project.assignments.some(value => value.wallId === wallId && value.finishId === finish.id && value.runId === run.id))) issues.push({ path: `assignments.${index}.coverage`, message: `${finish.name}: a wall in this numbered-panel run now has another finish. Reapply the panel sequence to the intended connected walls and review its start before rendering.` });
      const instances = project.assignments.filter(value => value.finishId === finish.id);
      const walls = new Set(instances.map(value => value.wallId)), runs = new Set(instances.map(value => value.runId));
      if (walls.size > 1 && (runs.size !== 1 || runs.has(undefined))) issues.push({ path: `assignments.${index}.coverage`, message: `${finish.name}: link all selected walls as one connected numbered-panel run. A finite sequence cannot restart on each wall.` });
    }
    const origin = assignmentOrigin(project.room, assignment, project.wallRuns), panels = orderedPanels(finish);
    const width = panels.length ? panels.at(-1)!.endMm : finish.calibration.widthMm;
    const wallWidth = length(project.room, assignment.wallId), bottom = assignment.fromMm, top = assignment.toMm ?? project.room.heightMm;
    if (origin > .05 || origin + width < wallWidth - .05) issues.push({ path: `assignments.${index}.coverage`, message: `${finish.name} does not cover the full width of this wall band. Add sufficient panels, reduce the selected band or choose another finish.` });
    const relevant = panels.filter(value => origin + value.endMm > 0 && origin + value.startMm < wallWidth);
    const height = relevant.length ? Math.min(...relevant.map(value => value.panel.heightMm)) : finish.calibration.heightMm;
    if (assignment.offsetYmm > bottom + .05 || assignment.offsetYmm + height < top - .05) issues.push({ path: `assignments.${index}.coverage`, message: `${finish.name} does not cover the full height of this wall band. Select an explicitly smaller band or provide taller artwork.` });
  });
  return issues;
}
