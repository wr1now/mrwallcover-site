import { useEffect, useState } from 'react';
import Action from '../../components/react/Action.tsx';
import NumberField from './NumberField.tsx';
import PlanImport from './PlanImport.tsx';
import OutlineSketch from './OutlineSketch.tsx';
import { createRectangle, createLShape, suggestCameras, wallLength } from '../geometry.ts';
import { pointInsideRoom } from '../validation.ts';
import type { CloudClient } from '../cloud.ts';
import type { Opening, RoomDefinition, RoomProject } from '../types.ts';
function initialShape(room:RoomDefinition){
  const v=room.vertices;
  return v.length===4&&v.every((a,i)=>{const b=v[(i+1)%v.length];return (a.x===b.x)!==(a.z===b.z);})?'rectangle':'custom';
}
export default function RoomPanel({project,onChange,selectedWallId,onSelect,openingId,onOpeningSelect,cloud}:{cloud:CloudClient;project:RoomProject;onChange:(p:RoomProject)=>void;selectedWallId:string;onSelect:(s:string)=>void;openingId:string|null;onOpeningSelect:(s:string|null)=>void}) {
  const [route,setRoute]=useState<'measure'|'plan'>('measure'); const [shape,setShape]=useState(()=>initialShape(project.room));
  const [cameraNotice,setCameraNotice]=useState('');
  const [sketching,setSketching]=useState(false);
  useEffect(()=>{setShape(initialShape(project.room));setSketching(false);},[project.id]);
  const room=project.room, selected=room.vertices.findIndex(v=>v.wallId===selectedWallId), wall=room.vertices[selected];
  const opening=room.openings.find(o=>o.id===openingId);
  function update(next:RoomDefinition){
    let moved=0;
    const wallIds=new Set(next.vertices.map(vertex=>vertex.wallId));
    const fitBands=(assignments:RoomProject['assignments'])=>assignments.filter(a=>wallIds.has(a.wallId)&&a.fromMm<next.heightMm).map(a=>a.toMm!==null&&a.toMm>next.heightMm?{...a,toMm:next.heightMm}:a);
    const assignments=fitBands(project.assignments);
    let adapted=0;
    const schemes=project.schemes.map(scheme=>{const assignments=fitBands(scheme.assignments);if(JSON.stringify(assignments)!==JSON.stringify(scheme.assignments))adapted++;return {...scheme,assignments};});
    const suggestions=suggestCameras(next);
    const cameras=project.cameras.length?project.cameras.map(camera=>{
      if(camera.position[1]>.1&&camera.position[1]<next.heightMm/1000-.1&&pointInsideRoom(next,{x:camera.position[0]*1000,z:camera.position[2]*1000}))return camera;
      moved++;
      const choices=suggestions.filter(candidate=>candidate.kind===camera.kind);
      const kindIndex=project.cameras.filter(candidate=>candidate.kind===camera.kind).findIndex(candidate=>candidate.id===camera.id);
      const replacement=choices[kindIndex%choices.length]??suggestions[0];
      return replacement?{...replacement,id:camera.id}:camera;
    }):suggestions;
    setCameraNotice([moved?`${moved===1?'A saved viewpoint was':`${moved} saved viewpoints were`} moved inside the updated room. Check the Preview stage.`:'',adapted?'Saved finish combinations were adjusted to fit the updated walls and ceiling.':''].filter(Boolean).join(' '));
    onChange({...project,room:{...next,confirmed:false},assignments,schemes,cameras});
  }
  function resetShape(value:string){setShape(value);setSketching(false);if(value==='custom')return;const next=value==='l-shape'?createLShape():createRectangle();update(next);onSelect(next.vertices[0].wallId);onOpeningSelect(null);}
  function changeOpening(key:keyof Opening,value:number){if(opening)update({...room,openings:room.openings.map(o=>o.id===opening.id?{...o,[key]:value}:o)});}
  function addOpening(kind:'door'|'window'){const length=wallLength(room,selectedWallId);const next:Opening={id:crypto.randomUUID(),wallId:selectedWallId,kind,offsetMm:Math.max(0,Math.round((length-900)/2)),widthMm:900,heightMm:kind==='door'?2100:1200,sillMm:kind==='door'?0:900,revealMm:150};update({...room,openings:[...room.openings,next]});onOpeningSelect(next.id);}
  const minX=Math.min(...room.vertices.map(v=>v.x)),minZ=Math.min(...room.vertices.map(v=>v.z));
  const width=Math.max(...room.vertices.map(v=>v.x))-minX,depth=Math.max(...room.vertices.map(v=>v.z))-minZ;
  return <div className="studio-panel-content"><p className="eyebrow">01 / Room</p><h2>Start with your space</h2><p className="studio-hint">Measure to the finished inside wall faces. All fields use millimetres.</p>
    {cameraNotice&&<p className="studio-notice" role="status">{cameraNotice}</p>}
    <div className="studio-segmented" aria-label="Room starting method"><button aria-pressed={route==='measure'} onClick={()=>setRoute('measure')}>Measurements</button><button aria-pressed={route==='plan'} onClick={()=>setRoute('plan')}>Floor plan</button></div>
    {route==='plan'&&<PlanImport project={project} cloud={cloud} onUse={r=>{update(r);onSelect(r.vertices[0].wallId);setShape('custom');setRoute('measure');}}/>}
    {route==='measure'&&<><label className="studio-field"><span>Room shape</span><select value={shape} onChange={e=>resetShape(e.target.value)}><option value="rectangle">Rectangle</option><option value="l-shape">L-shape</option><option value="custom">Draw / edit outline</option></select></label>
    <div className="studio-row"><NumberField label="Width" value={width} min={500} onChange={n=>update({...room,vertices:room.vertices.map(v=>({...v,x:Math.round(minX+(v.x-minX)*n/width)}))})}/><NumberField label="Depth" value={depth} min={500} onChange={n=>update({...room,vertices:room.vertices.map(v=>({...v,z:Math.round(minZ+(v.z-minZ)*n/depth)}))})}/></div>
    <NumberField label="Ceiling height" value={room.heightMm} min={1000} max={10000} onChange={heightMm=>update({...room,heightMm})}/>
    {shape==='custom'&&(sketching?<OutlineSketch room={room} onCancel={()=>setSketching(false)} onUse={next=>{update(next);setSketching(false);onSelect(next.vertices[0].wallId);onOpeningSelect(null);}}/>:<><p className="studio-hint">Edit each corner in order, or draw a replacement outline. Use Floor plan to trace over a drawing.</p><Action onClick={()=>setSketching(true)}>Draw a new outline</Action>{room.vertices.map((v,i)=><div className="studio-vertex" key={v.wallId}><span>Corner {i+1}</span><div className="studio-row"><NumberField label={`X ${i+1}`} value={v.x} min={-50000} onChange={x=>update({...room,vertices:room.vertices.map((p,j)=>i===j?{...p,x}:p)})}/><NumberField label={`Z ${i+1}`} value={v.z} min={-50000} onChange={z=>update({...room,vertices:room.vertices.map((p,j)=>i===j?{...p,z}:p)})}/></div>{room.vertices.length>3&&<Action variant="quiet" onClick={()=>{update({...room,vertices:room.vertices.filter((_,j)=>i!==j),openings:room.openings.filter(o=>o.wallId!==v.wallId)});onSelect(room.vertices[i===0?1:0].wallId);}}>Remove corner {i+1}</Action>}</div>)}<Action disabled={room.vertices.length>=12} onClick={()=>{const a=room.vertices.at(-1)!,b=room.vertices[0];update({...room,vertices:[...room.vertices,{wallId:crypto.randomUUID(),x:Math.round((a.x+b.x)/2+250),z:Math.round((a.z+b.z)/2)}]});}}>Add corner</Action></>)}
    <div className="studio-divider"/><label className="studio-field"><span>Selected wall</span><select value={selectedWallId} onChange={e=>{onSelect(e.target.value);onOpeningSelect(null);}}>{room.vertices.map((v,i)=><option value={v.wallId} key={v.wallId}>Wall {i+1} · {(wallLength(room,v.wallId)/1000).toFixed(2)} m</option>)}</select></label>
    {wall&&<NumberField label="Wall length" value={Math.round(wallLength(room,selectedWallId))} min={200} onChange={len=>{const next=room.vertices[(selected+1)%room.vertices.length],factor=len/wallLength(room,selectedWallId);update({...room,vertices:room.vertices.map((v,i)=>i===(selected+1)%room.vertices.length?{...v,x:Math.round(wall.x+(next.x-wall.x)*factor),z:Math.round(wall.z+(next.z-wall.z)*factor)}:v)});}}/>}
    <div className="studio-button-row"><Action onClick={()=>addOpening('door')}>Add door</Action><Action onClick={()=>addOpening('window')}>Add window</Action></div>
    {room.openings.length>0&&<label className="studio-field"><span>Opening to edit</span><select value={openingId||''} onChange={e=>{onOpeningSelect(e.target.value||null);const o=room.openings.find(o=>o.id===e.target.value);if(o)onSelect(o.wallId);}}><option value="">Choose a door or window</option>{room.openings.map((o,i)=><option value={o.id} key={o.id}>{o.kind==='door'?'Door':'Window'} {i+1} · wall {room.vertices.findIndex(v=>v.wallId===o.wallId)+1}</option>)}</select></label>}
    {opening&&<div className="studio-inset"><h3>{opening.kind==='door'?'Door':'Window'} position</h3><NumberField label="Distance from wall start" value={opening.offsetMm} onChange={n=>changeOpening('offsetMm',n)}/><div className="studio-row"><NumberField label="Opening width" value={opening.widthMm} min={100} onChange={n=>changeOpening('widthMm',n)}/><NumberField label="Opening height" value={opening.heightMm} min={100} onChange={n=>changeOpening('heightMm',n)}/></div>{opening.kind==='window'&&<><NumberField label="Sill height" value={opening.sillMm} onChange={n=>changeOpening('sillMm',n)}/><NumberField label="Simple frame width" value={opening.frameMm??0} max={100} onChange={n=>changeOpening('frameMm',n)}/><p className="studio-hint">Optional plain frame inside the measured opening. Use 0 for a bare opening.</p></>}<NumberField label="Reveal depth" value={opening.revealMm} max={1000} onChange={n=>changeOpening('revealMm',n)}/><Action variant="quiet" onClick={()=>{update({...room,openings:room.openings.filter(o=>o.id!==opening.id)});onOpeningSelect(null);}}>Delete {opening.kind}</Action></div>}
    <details className="studio-details"><summary>Skirting &amp; cornice</summary><NumberField label="Skirting height" value={room.skirtingMm} max={500} onChange={skirtingMm=>update({...room,skirtingMm})}/><NumberField label="Cornice height" value={room.corniceMm} max={500} onChange={corniceMm=>update({...room,corniceMm})}/></details>
    <label className="studio-check"><input type="checkbox" checked={room.confirmed} onChange={e=>onChange({...project,room:{...room,confirmed:e.target.checked}})}/><span>I have checked the outline, dimensions and openings.</span></label></>}
  </div>;
}
