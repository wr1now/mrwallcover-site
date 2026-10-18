import { wallLength } from './geometry.ts';
import type { RoomProject } from './types.ts';
/** Plain text for a customer to review and paste into the existing enquiry form. */
export function finishSummary(project:RoomProject):string {
  const lines=[`Mr Wallcover Room Studio — ${project.name}`,`Draft revision ${project.revision}`,`Ceiling height: ${project.room.heightMm} mm`,project.room.confirmed?'Measurements checked by customer.':'Measurements remain provisional.',''];
  for(const [i,wall] of project.room.vertices.entries()){
    lines.push(`Wall ${i+1}: ${Math.round(wallLength(project.room,wall.wallId))} mm`);
    for(const assignment of project.assignments.filter(a=>a.wallId===wall.wallId)){
      const f=project.finishes.find(f=>f.id===assignment.finishId);if(!f)continue;
      const band=`${assignment.fromMm}–${assignment.toMm??project.room.heightMm} mm above floor`;
      if(f.type==='paint')lines.push(`  ${band}: paint ${f.name}, ${f.colour}, ${f.sheen}.`);
      else if(f.type==='bauwerk')lines.push(`  ${band}: Bauwerk ${f.name} (${f.shadeId}); catalogue ${f.catalogueVersion}.`);
      else lines.push(`  ${band}: ${f.type} ${f.name}; artwork ${f.calibration.widthMm} × ${f.calibration.heightMm} mm; ${f.calibration.repeatKind} / ${f.calibration.match}; offset included in artwork: ${f.calibration.offsetAlreadyIncluded?'yes':'no'}; placement ${assignment.offsetXmm}, ${assignment.offsetYmm} mm.`);
    }
    for(const o of project.room.openings.filter(o=>o.wallId===wall.wallId))lines.push(`  ${o.kind}: ${o.widthMm} × ${o.heightMm} mm; ${o.offsetMm} mm along wall; sill ${o.sillMm} mm; reveal ${o.revealMm} mm.`);
  }
  lines.push('','Colour and limewash movement are approximate. Test a sample in your room before ordering.','This summary does not calculate an ordering quantity. Please check the room and installation requirements.');return lines.join('\n');
}
