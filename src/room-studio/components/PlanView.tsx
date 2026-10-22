import { useRef, useState } from 'react';
import type { Opening, RoomProject } from '../types.ts';
export default function PlanView({ project, selectedWallId, onSelect, onChange, onOpeningSelect }: { project: RoomProject; selectedWallId: string; onSelect: (id:string)=>void; onChange: (p:RoomProject)=>void; onOpeningSelect:(id:string)=>void }) {
  const svg=useRef<SVGSVGElement>(null);
  const [drag,setDrag]=useState<{id:string; offset:number}|null>(null);
  const points=project.room.vertices;
  const minX=Math.min(...points.map(p=>p.x)), minZ=Math.min(...points.map(p=>p.z));
  const w=Math.max(...points.map(p=>p.x))-minX, d=Math.max(...points.map(p=>p.z))-minZ;
  const pad=Math.max(w,d,500)*.17, scale=Math.max(w,d,500)/440;
  function locate(o: Opening, offset=o.offsetMm) { const i=points.findIndex(p=>p.wallId===o.wallId); const a=points[i], b=points[(i+1)%points.length]; if(!a)return null; const len=Math.hypot(b.x-a.x,b.z-a.z); if(!len)return null; return {a,b,len,x:a.x+(b.x-a.x)*offset/len,z:a.z+(b.z-a.z)*offset/len,x2:a.x+(b.x-a.x)*(offset+o.widthMm)/len,z2:a.z+(b.z-a.z)*(offset+o.widthMm)/len}; }
  function move(e: React.PointerEvent<SVGSVGElement>) {
    if(!drag||!svg.current)return; const o=project.room.openings.find(o=>o.id===drag.id); if(!o)return;
    const wall=locate(o); if(!wall)return;
    const pt=svg.current.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const inv=svg.current.getScreenCTM()?.inverse();if(!inv)return;const p=pt.matrixTransform(inv);
    const along=((p.x-wall.a.x)*(wall.b.x-wall.a.x)+(p.y-wall.a.z)*(wall.b.z-wall.a.z))/wall.len;
    setDrag({id:o.id,offset:Math.max(0,Math.min(Math.floor(wall.len-o.widthMm),Math.round(along-o.widthMm/2)))});
  }
  function end(){if(!drag)return;onChange({...project,room:{...project.room,confirmed:false,openings:project.room.openings.map(o=>o.id===drag.id?{...o,offsetMm:drag.offset}:o)}});setDrag(null);}
  return <div className="studio-plan"><div className="studio-view-label"><span>Measured plan</span><small>Inside wall faces</small></div><svg ref={svg} viewBox={`${minX-pad} ${minZ-pad} ${w+pad*2} ${d+pad*2}`} aria-label="Room floor plan. Select a wall or drag an opening; all positions also have number controls." onPointerMove={move} onPointerUp={end} onPointerCancel={()=>setDrag(null)}>
    <defs><pattern id="studio-grid" width={500} height={500} patternUnits="userSpaceOnUse"><path d="M 500 0 L 0 0 0 500" fill="none" stroke="#d9d5ca" strokeWidth={scale*.5}/></pattern></defs>
    <rect x={minX-pad} y={minZ-pad} width={w+pad*2} height={d+pad*2} fill="url(#studio-grid)"/>
    <polygon points={points.map(p=>`${p.x},${p.z}`).join(' ')} fill="#f5f1e8" stroke="none"/>
    {points.map((a,i)=>{const b=points[(i+1)%points.length],len=Math.hypot(b.x-a.x,b.z-a.z); const selected=a.wallId===selectedWallId; if(!len)return null; return <g key={a.wallId} role="button" tabIndex={0} aria-label={`Select wall ${i+1}, ${(len/1000).toFixed(2)} metres`} aria-pressed={selected} onClick={()=>onSelect(a.wallId)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(a.wallId);}}}>
      <line x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="transparent" strokeWidth={scale*30}/><line x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke={selected?'#8a6a35':'#42483d'} strokeWidth={scale*(selected?6:4)}/>
      <text x={(a.x+b.x)/2+(b.z-a.z)/len*scale*24} y={(a.z+b.z)/2-(b.x-a.x)/len*scale*24} textAnchor="middle" dominantBaseline="middle" fontSize={scale*13} fill="#343a31">{i+1} · {(len/1000).toFixed(2)} m</text>
    </g>;})}
    {project.room.openings.map(o=>{const pos=locate(o,drag?.id===o.id?drag.offset:o.offsetMm);if(!pos)return null;return <g key={o.id} role="button" tabIndex={0} aria-label={`Select ${o.kind}, ${o.widthMm} millimetres wide`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(o.wallId);onOpeningSelect(o.id);}}} onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);onSelect(o.wallId);onOpeningSelect(o.id);setDrag({id:o.id,offset:o.offsetMm});}} style={{cursor:'grab'}}>
      <line x1={pos.x} y1={pos.z} x2={pos.x2} y2={pos.z2} stroke="#f5f1e8" strokeWidth={scale*12}/><line x1={pos.x} y1={pos.z} x2={pos.x2} y2={pos.z2} stroke={o.kind==='door'?'#9e663e':'#457984'} strokeWidth={scale*5}/><line x1={pos.x} y1={pos.z} x2={pos.x2} y2={pos.z2} stroke="transparent" strokeWidth={scale*32}/>
    </g>;})}
    <text x={minX+w/2} y={minZ+d/2} fontSize={scale*13} textAnchor="middle" fill="#6b7064">{project.room.heightMm} mm ceiling</text>
  </svg><p className="studio-hint">Select a wall. Drag doors and windows along it.</p><div className="studio-plan-key"><span><i style={{background:'#9e663e'}}/>Door</span><span><i style={{background:'#457984'}}/>Window</span></div></div>;
}
