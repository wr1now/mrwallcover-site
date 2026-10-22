import { useEffect, useRef, useState } from 'react';
import Action from '../../components/react/Action.tsx';
import NumberField from './NumberField.tsx';
import type { RoomDefinition, RoomProject, PlanCandidate } from '../types.ts';
import type { CloudClient, CloudJob } from '../cloud.ts';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { artworkHeaderDimensions, checkArtworkDimensions } from '../finishes.ts';
import { validateRoom } from '../validation.ts';
const LIMIT=20*1024*1024;
type Pixel={x:number;y:number};
export default function PlanImport({onUse,cloud,project}:{onUse:(room:RoomDefinition)=>void;cloud:CloudClient;project:RoomProject}) {
  const [source,setSource]=useState<string|null>(null), [pdf,setPdf]=useState<any>(null),[page,setPage]=useState(1),[total,setTotal]=useState(1);
  const [dimensions,setDimensions]=useState({width:1000,height:700}),[mode,setMode]=useState<'scale'|'outline'|'crop'>('scale');
  const [scalePoints,setScalePoints]=useState<Pixel[]>([]),[outline,setOutline]=useState<Pixel[]>([]),[known,setKnown]=useState(0),[height,setHeight]=useState(0);
  const [cropPoints,setCropPoints]=useState<Pixel[]>([]),[original,setOriginal]=useState<File|null>(null),[job,setJob]=useState<CloudJob|null>(null);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false); const svg=useRef<SVGSVGElement>(null), generation=useRef(0);
  const pdfRef=useRef<any>(null), loadingTask=useRef<any>(null),renderTask=useRef<any>(null);
  useEffect(()=>()=>{generation.current++;renderTask.current?.cancel();void loadingTask.current?.destroy();},[]);
  async function renderPage(doc:any,num:number,version=++generation.current){
    renderTask.current?.cancel();setBusy(true);
    try{
      const p=await doc.getPage(num);if(version!==generation.current)return;
      const v=p.getViewport({scale:1});
      if(!Number.isFinite(v.width)||!Number.isFinite(v.height)||v.width<=0||v.height<=0)throw new Error('Invalid page dimensions');
      const viewport=p.getViewport({scale:Math.min(2,2200/Math.max(v.width,v.height))});
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
      const task=p.render({canvasContext:canvas.getContext('2d')!,canvas,viewport});renderTask.current=task;await task.promise;
      if(version!==generation.current)return;
      setSource(canvas.toDataURL('image/png'));setDimensions({width:canvas.width,height:canvas.height});setScalePoints([]);setOutline([]);setCropPoints([]);setKnown(0);setMode('scale');
    }catch{if(version===generation.current)setMessage('This PDF page could not be opened. Try a JPG or PNG of the plan.');}
    finally{if(version===generation.current)setBusy(false);}
  }
  async function upload(file:File|undefined){
    if(!file||busy)return;setMessage('');
    if(file.size>LIMIT){setMessage('Choose a file smaller than 20 MB.');return;}
    if(!['application/pdf','image/jpeg','image/png'].includes(file.type)){setMessage('Choose a PDF, JPG or PNG floor plan.');return;}
    const version=++generation.current;setBusy(true);renderTask.current?.cancel();void loadingTask.current?.destroy();loadingTask.current=null;pdfRef.current=null;
    setPdf(null);setOriginal(file);setCropPoints([]);setJob(null);setSource(null);setScalePoints([]);setOutline([]);setKnown(0);setHeight(0);setMode('scale');
    try{
      const data=await file.arrayBuffer();if(version!==generation.current)return;
      if(file.type==='application/pdf'){
        // PDF.js' compatibility build includes the browser feature shims needed
        // by older supported Safari/Chromium versions, in both page and worker.
        const {getDocument,GlobalWorkerOptions}=await import('pdfjs-dist/legacy/build/pdf.mjs');if(version!==generation.current)return;
        GlobalWorkerOptions.workerSrc=workerUrl;const task=getDocument({data,enableXfa:false});loadingTask.current=task;
        const doc=await task.promise;if(version!==generation.current){await task.destroy();return;}
        if(doc.numPages>200){await task.destroy();throw new Error('This PDF has more than 200 pages. Export the page you need first.');}
        pdfRef.current=doc;setPdf(doc);setTotal(doc.numPages);setPage(1);await renderPage(doc,1,version);
      }else{
        setTotal(1);const header=artworkHeaderDimensions(new Uint8Array(data),file.type as 'image/png'|'image/jpeg');
        if(!header)throw new Error('This image could not be read. Export a PNG or JPG.');checkArtworkDimensions(header.width,header.height);
        const bitmap=await createImageBitmap(file);if(version!==generation.current){bitmap.close();return;}
        try{checkArtworkDimensions(bitmap.width,bitmap.height);const canvas=document.createElement('canvas');const ratio=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);setDimensions({width:canvas.width,height:canvas.height});setSource(canvas.toDataURL('image/png'));}finally{bitmap.close();}
      }
    }catch(e){if(version===generation.current)setMessage(e instanceof Error?e.message:'The drawing could not be opened.');}
    finally{if(version===generation.current)setBusy(false);}
  }
  function click(e:React.MouseEvent<SVGSVGElement>){const pt=svg.current!.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const inverse=svg.current!.getScreenCTM()?.inverse();if(!inverse)return;const p=pt.matrixTransform(inverse);if(mode==='crop')setCropPoints(s=>s.length===2?[p]:[...s,p]);else if(mode==='scale')setScalePoints(s=>s.length===2?[p]:[...s,p]);else if(outline.length<12)setOutline([...outline,{x:p.x,y:p.y}]);}
  const distance=scalePoints.length===2?Math.hypot(scalePoints[1].x-scalePoints[0].x,scalePoints[1].y-scalePoints[0].y):0;
  function useOutline(){if(distance<2||known<1||height<1000||outline.length<3){setMessage('Mark a known length, enter that length and the ceiling height, then trace at least three corners.');return;}const scale=known/distance;let vertices=outline.map(p=>({wallId:crypto.randomUUID(),x:Math.round((p.x-outline[0].x)*scale),z:Math.round((p.y-outline[0].y)*scale)}));const area=vertices.reduce((a,v,i)=>{const b=vertices[(i+1)%vertices.length];return a+v.x*b.z-b.x*v.z;},0);if(area<0)vertices=vertices.reverse();const room:RoomDefinition={vertices,heightMm:height,openings:[],skirtingMm:0,corniceMm:0,confirmed:false};const errors=validateRoom(room);if(errors.length){setMessage(errors.map(i=>i.message).join(' '));return;}onUse(room);}
  useEffect(()=>{if(!job||!['queued','running'].includes(job.state))return;let active=true;const timer=setTimeout(()=>{void cloud.getJob(job.id).then(next=>{if(active)setJob(next);}).catch(e=>setMessage(e.message));},5000);return()=>{active=false;clearTimeout(timer);};},[job,cloud]);
  async function analyze(){if(!original||cropPoints.length!==2)return;setBusy(true);setMessage('');try{const capabilities=await cloud.capabilities();if(!capabilities.analysisEnabled)throw new Error('Automatic plan reading is currently disabled. You can finish this room using the tracing tools.');await cloud.saveProject(project);const asset=await cloud.uploadAsset(project.id,original,'plan');const x=Math.min(cropPoints[0].x,cropPoints[1].x)/dimensions.width,y=Math.min(cropPoints[0].y,cropPoints[1].y)/dimensions.height;const width=Math.abs(cropPoints[1].x-cropPoints[0].x)/dimensions.width,height=Math.abs(cropPoints[1].y-cropPoints[0].y)/dimensions.height;if(width<.01||height<.01)throw new Error('Select a larger region around the room.');setJob(await cloud.enqueueAnalysis(project.id,asset.id,page-1,{x,y,width,height}));}catch(e){setMessage(e instanceof Error?e.message:'Automatic reading could not be started.');}finally{setBusy(false);}}
  function useCandidate(candidate:PlanCandidate){if(!candidate.room||!candidate.scaleKnown){setMessage('The detected room has no reliable scale. Calibrate and trace the drawing instead.');return;}if(height<1000){setMessage('Enter the measured ceiling height before using this outline.');return;}const room={...candidate.room,heightMm:height,confirmed:false};const errors=validateRoom(room);if(errors.length){setMessage(errors.map(x=>x.message).join(' '));return;}onUse(room);}
  return <div className="studio-import"><p>Upload your drawing, mark one known length, then trace the room’s inside corners.</p><label className="studio-upload"><span>Choose floor plan</span><input type="file" disabled={busy} accept="application/pdf,image/png,image/jpeg" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/><small>PDF, JPG or PNG · up to 20 MB · stays on this device</small></label>
    <p className="studio-hint">{cloud.enabled?'Automatic reading needs a verified email and an available processing allowance. Review all detected dimensions.':'Automatic plan reading is currently unavailable. The tracing tools below let you complete your room here.'}</p>
    {busy&&<p role="status">Opening your drawing…</p>}{message&&<p role="alert" className="studio-notice">{message}</p>}
    {source&&<>{total>1&&<label className="studio-field"><span>PDF page</span><select disabled={busy} value={page} onChange={e=>{const n=Number(e.target.value);setPage(n);void renderPage(pdf,n);}}>{Array.from({length:total},(_,i)=><option key={i+1} value={i+1}>Page {i+1}</option>)}</select></label>}
    <div className="studio-segmented"><button aria-pressed={mode==='scale'} onClick={()=>setMode('scale')}>1. Mark known length</button><button aria-pressed={mode==='outline'} onClick={()=>setMode('outline')}>2. Trace room</button>{cloud.enabled&&<button aria-pressed={mode==='crop'} onClick={()=>setMode('crop')}>Select room to analyse</button>}</div>
    <div className="studio-trace-viewport"><svg ref={svg} viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} onClick={click} aria-label={mode==='scale'?'Select two endpoints of a known dimension on the drawing':'Select the inside corners of one room in order'}><image href={source} width={dimensions.width} height={dimensions.height}/>{scalePoints.length===2&&<line x1={scalePoints[0].x} y1={scalePoints[0].y} x2={scalePoints[1].x} y2={scalePoints[1].y} stroke="#185f81" strokeWidth={dimensions.width/250}/>}<rect x={cropPoints.length===2?Math.min(cropPoints[0].x,cropPoints[1].x):0} y={cropPoints.length===2?Math.min(cropPoints[0].y,cropPoints[1].y):0} width={cropPoints.length===2?Math.abs(cropPoints[0].x-cropPoints[1].x):0} height={cropPoints.length===2?Math.abs(cropPoints[0].y-cropPoints[1].y):0} fill="#32703a20" stroke="#32703a" strokeWidth={dimensions.width/250}/><polygon points={outline.map(p=>`${p.x},${p.y}`).join(' ')} fill="#80633830" stroke="#806338" strokeWidth={dimensions.width/250}/>{[...scalePoints,...outline].map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={dimensions.width/70} fill={i<scalePoints.length?'#185f81':'#806338'} stroke="white" strokeWidth={dimensions.width/400}/>)}</svg></div>
    <p className="studio-hint">{mode==='crop'?'Click two opposite corners of a box around one room.':mode==='scale'?'Click the two ends of a dimension you know.':'Click each corner in order, without repeating the first corner. Maximum 12 corners.'}</p>
    <div className="studio-button-row"><Action onClick={()=>mode==='crop'?setCropPoints(s=>s.slice(0,-1)):mode==='scale'?setScalePoints(s=>s.slice(0,-1)):setOutline(s=>s.slice(0,-1))}>Undo point</Action><Action onClick={()=>{setScalePoints([]);setOutline([]);}}>Clear trace</Action></div>
    <NumberField label="Known marked length" value={known} min={0} onChange={setKnown}/><NumberField label="Measured ceiling height" value={height} min={0} max={10000} onChange={setHeight}/>
    <details className="studio-details"><summary>Keyboard / precise point entry</summary><p className="studio-hint">Coordinates are drawing pixels. Add the two scale endpoints, then room corners in order.</p><PointEntry dimensions={dimensions} onAdd={p=>mode==='crop'?setCropPoints(s=>s.length===2?[p]:[...s,p]):mode==='scale'?setScalePoints(s=>s.length===2?[p]:[...s,p]):setOutline(s=>s.length<12?[...s,p]:s)}/></details>
    {cloud.enabled&&<div className="studio-inset"><Action disabled={busy||cropPoints.length!==2||!cloud.session} onClick={()=>void analyze()}>Read selected room automatically</Action>{!cloud.session&&<p className="studio-hint">Verify your email in Save &amp; render first.</p>}{job&&<p role="status">Plan analysis: {job.state}{job.error?` · ${job.error}`:''}</p>}{job?.candidate&&<><ul>{job.candidate.issues.map((i,n)=><li key={n}>{i.message}</li>)}</ul><Action disabled={!job.candidate.room||!job.candidate.scaleKnown||height<1000} onClick={()=>useCandidate(job.candidate!)}>Review detected room</Action><p className="studio-hint">The next step is an editable proposal. Check every measurement and opening before confirming.</p></>}</div>}
    <Action variant="primary" disabled={busy||outline.length<3||scalePoints.length!==2||known===0||height===0} onClick={useOutline}>Use this room outline</Action></>}
  </div>;
}
function PointEntry({dimensions,onAdd}:{dimensions:{width:number;height:number};onAdd:(p:Pixel)=>void}){const [p,setP]=useState({x:0,y:0});return <><div className="studio-row"><NumberField label="Point X" suffix="px" value={p.x} max={dimensions.width} onChange={x=>setP({...p,x})}/><NumberField label="Point Y" suffix="px" value={p.y} max={dimensions.height} onChange={y=>setP({...p,y})}/></div><Action onClick={()=>onAdd(p)}>Add point</Action></>;}
