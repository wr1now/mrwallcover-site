import { wallLength } from './geometry.ts';
import type { RoomProject, RoomRevision } from './types.ts';
/** Plain text for a customer to review and paste into the existing enquiry form. */
export function finishSummary(project:RoomProject,confirmed?:Pick<RoomRevision,'id'|'number'>):string {
  const version=confirmed?`Confirmed version ${confirmed.number}\nRevision ID: ${confirmed.id}`:`Draft revision ${project.revision}`;
  const lines=[`Mr Wallcover Room Studio — ${project.name}`,version,`Ceiling height: ${project.room.heightMm} mm`,project.room.confirmed?'Measurements checked by customer.':'Measurements remain provisional.',''];
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
  for(const finish of project.finishes){
    if(finish.catalogue)lines.push(`Catalogue: ${finish.name}; product ${finish.catalogue.productId}; version ${finish.catalogue.version}; ${finish.catalogue.verification}.`);
    if(finish.type==='wallpaper'||finish.type==='mural'){
      if(finish.panels?.length){lines.push(`Finite panels for ${finish.name} (never repeated):`);for(const panel of finish.panels)lines.push(`  Panel ${panel.number}: ${panel.widthMm} × ${panel.heightMm} mm; source ${panel.texture.sha256}.`);}
      if(finish.appearance)lines.push(`${finish.name}: illustrative roughness ${finish.appearance.roughness}, metalness ${finish.appearance.metalness}${finish.appearance.relief?`, ${finish.appearance.relief.kind} relief ${finish.appearance.relief.depthMm} mm`:''}.`);
    }
  }
  for(const run of project.wallRuns??[])lines.push(`Connected set-out: ${project.finishes.find(finish=>finish.id===run.finishId)?.name??run.finishId}; walls ${run.wallIds.map(id=>project.room.vertices.findIndex(wall=>wall.wallId===id)+1).join(' → ')}; start ${run.startOffsetMm} mm.`);
  lines.push('','Colour and limewash movement are approximate. Test a sample in your room before ordering.','This summary does not calculate an ordering quantity. Please check the room and installation requirements.');return lines.join('\n');
}
