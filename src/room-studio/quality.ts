import { rotatedCropSize } from './finishes.ts';
import { assignmentOrigin, orderedPanels } from './wall-runs.ts';
import type { RoomProject, ValidationIssue } from './types.ts';
/** Conservative view-dependent guide, not print DPI or a promise of optical accuracy. */
export function sourceQualityIssues(project: RoomProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [index, assignment] of project.assignments.entries()) {
    const finish = project.finishes.find(value => value.id === assignment.finishId);
    if (!finish || (finish.type !== 'wallpaper' && finish.type !== 'mural')) continue;
    const wallIndex = project.room.vertices.findIndex(vertex => vertex.wallId === assignment.wallId);
    if (wallIndex < 0) continue;
    const a = project.room.vertices[wallIndex], b = project.room.vertices[(wallIndex + 1) % project.room.vertices.length];
    const centre = { x: (a.x + b.x) / 2000, y: (assignment.fromMm + (assignment.toMm ?? project.room.heightMm)) / 2000, z: (a.z + b.z) / 2000 };
    const panels = orderedPanels(finish), origin = assignmentOrigin(project.room, assignment, project.wallRuns), wallLength = Math.hypot(b.x - a.x, b.z - a.z);
    const relevant = panels.filter(panel => origin + panel.endMm > 0 && origin + panel.startMm < wallLength);
    const densities = relevant.length ? relevant.map(({ panel }) => Math.min(panel.texture.widthPx * 1000 / panel.widthMm, panel.texture.heightPx * 1000 / panel.heightMm)) : [(() => { const size = rotatedCropSize(finish.texture.widthPx, finish.texture.heightPx, finish.calibration); return Math.min(size.width * 1000 / finish.calibration.widthMm, size.height * 1000 / finish.calibration.heightMm); })()];
    const density = Math.min(...densities);
    const cameras = project.cameras;
    const demands = cameras.map(camera => { const distance = Math.max(.1, Math.hypot(camera.position[0] - centre.x, camera.position[1] - centre.y, camera.position[2] - centre.z)); return camera.kind === 'panorama' ? 4096 / (2 * Math.PI * distance) : 1080 / (2 * distance * Math.tan(camera.fov * Math.PI / 360)); });
    if (density < Math.max(150, ...demands) * .8) issues.push({ path: `assignments.${index}.sourceDetail`, message: `${finish.name}: source detail may soften in the saved camera views (${Math.round(density)} pixels per metre). Use a larger original or move the camera farther away. HD output cannot restore missing artwork detail.` });
  }
  return issues;
}
