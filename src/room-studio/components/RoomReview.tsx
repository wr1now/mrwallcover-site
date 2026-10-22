import { wallLength } from '../geometry.ts';
import { sourceQualityIssues } from '../quality.ts';
import { artworkCoverageIssues } from '../wall-runs.ts';
import type { RoomProject } from '../types.ts';

export default function RoomReview({ project, acknowledged, onAcknowledge }: { project: RoomProject; acknowledged: boolean; onAcknowledge: (value: boolean) => void }) {
  const quality = [...new Set(sourceQualityIssues(project).map(issue => issue.message))];
  const coverage = artworkCoverageIssues(project);
  const artworks = project.finishes.filter(finish => (finish.type === 'wallpaper' || finish.type === 'mural') && project.assignments.some(assignment => assignment.finishId === finish.id));
  return <section className="studio-review" aria-labelledby="studio-review-heading">
    <h3 id="studio-review-heading">Review your finished package</h3>
    <dl className="studio-review-facts">
      <div><dt>Room</dt><dd>{project.room.vertices.length} walls · {(project.room.heightMm / 1000).toFixed(2)} m ceiling</dd></div>
      <div><dt>Openings</dt><dd>{project.room.openings.filter(opening => opening.kind === 'door').length} doors · {project.room.openings.filter(opening => opening.kind === 'window').length} windows</dd></div>
      <div><dt>Lighting</dt><dd>{project.lighting === 'warm' ? 'Warm light' : 'Neutral daylight'}</dd></div>
      <div><dt>Outputs</dt><dd>Two 1920 × 1080 images · one 4096 × 2048 panorama</dd></div>
    </dl>
    <details className="studio-details"><summary>Wall sizes and finish placement</summary><ol>{project.room.vertices.map((wall, index) => <li key={wall.wallId}>Wall {index + 1}: {wallLength(project.room, wall.wallId).toFixed(1)} mm — {project.assignments.filter(assignment => assignment.wallId === wall.wallId).map(assignment => project.finishes.find(finish => finish.id === assignment.finishId)?.name ?? 'Unassigned').join(', ') || 'Unassigned'}</li>)}</ol></details>
    <details className="studio-details"><summary>Saved viewpoints</summary><ul>{project.cameras.map(camera => <li key={camera.id}>{camera.kind === 'panorama' ? 'Panorama' : 'Image'}: {camera.position.map(value => value.toFixed(2)).join(', ')} m · {camera.kind === 'perspective' ? `${camera.fov}° vertical field of view` : 'Fixed-position 360° view'}</li>)}</ul><p className="studio-hint">Use Preview to check and adjust the cameras before confirming.</p></details>
    {artworks.length > 0 && <p className="studio-hint">The supplied artwork determines visible detail. Metallic response, surface depth and screen colours are illustrative unless supported by verified product data.</p>}
    {coverage.length > 0 && <div className="studio-error" role="alert"><strong>Complete the artwork coverage before confirming</strong><ul>{coverage.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul></div>}
    {quality.length > 0 && <div className="studio-notice"><strong>Check the source-image detail</strong><ul>{quality.map(message => <li key={message}>{message}</li>)}</ul><label className="studio-check"><input type="checkbox" checked={acknowledged} onChange={event => onAcknowledge(event.target.checked)} /><span>I have reviewed this limitation for the selected views.</span></label></div>}
    <p className="studio-hint">Confirmation freezes the room, finish placement, lighting and cameras. Later changes create a new draft.</p>
  </section>;
}
