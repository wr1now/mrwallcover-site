import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Action from '../../components/react/Action.tsx';
import { roomStudioExamples, type RoomStudioExampleId } from '../example-metadata.ts';
const PanoramaViewer=lazy(()=>import('./PanoramaViewer.tsx'));
export default function ExamplePanel({id,onSelect,onOpen,onCancel,onDownload,loading,protectedDraft}:{id:RoomStudioExampleId;onSelect:(id:RoomStudioExampleId)=>void;onOpen:()=>void;onCancel:()=>void;onDownload?:(()=>void);loading:boolean;protectedDraft:boolean}) {
  const example=roomStudioExamples.find(example=>example.id===id)!;
  const [panorama,setPanorama]=useState(false);
  const select=useRef<HTMLSelectElement>(null);useEffect(()=>select.current?.focus(),[id]);
  const base=`/media/room-studio/examples/${id}`;
  return <section id="studio-examples" className="studio-example-panel" aria-label="Choose an illustrative room">
    <div><p className="eyebrow">Three rooms to explore</p><h2>See the finish in context.</h2><p>Original illustrative wallpapers, measured rooms and real rendered views. Choose an example, then open it in the editable 3D room.</p>
      <label className="studio-field"><span>Example room</span><select ref={select} value={id} onChange={event=>{onSelect(event.target.value as RoomStudioExampleId);setPanorama(false);}}>{roomStudioExamples.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <p>{example.description}</p><p className="studio-hint">{example.artworkLabel} · {example.repeatMm.width} × {example.repeatMm.height} mm repeat. Artwork: {example.pixelSize.width} × {example.pixelSize.height} pixels.</p>
      {protectedDraft?<p role="status">{onDownload?'Your saved draft needs recovery. Download the protected draft, then use New room to explicitly start again before opening an example.':'Your saved draft could not be read and remains protected. Resolve recovery, or use New room to explicitly start again before opening an example.'}</p>:<p>Opening this example replaces the draft in the editor. You can download your current room first; Undo also brings it back.</p>}
      <div className="studio-button-row"><Action variant="primary" disabled={loading||protectedDraft} onClick={onOpen}>{loading?'Opening…':'Open this example in 3D'}</Action>{onDownload&&<Action onClick={onDownload}>{protectedDraft?'Download protected draft':'Download current room'}</Action>}<Action variant="quiet" onClick={onCancel}>Cancel</Action></div>
    </div>
    <div className="studio-example-media"><figure><img src={`${base}-1.webp`} width="1920" height="1080" alt={`Rendered illustrative room: ${example.name}`} /><figcaption>Blender Cycles render · Original illustrative design · 1920 × 1080</figcaption></figure>
      <div className="studio-button-row"><a href={`${base}-1.webp`} download>Download view 1</a><a href={`${base}-2.webp`} download>Download view 2</a><a href={`${base}-panorama.webp`} download>Download 4K panorama</a><Action aria-expanded={panorama} onClick={()=>setPanorama(value=>!value)}>{panorama?'Close example panorama':'Look around in 360°'}</Action></div>
      {panorama&&<div className="studio-example-panorama"><p className="studio-hint">Pre-rendered example panorama: {example.name}. Changes in the editor do not change this image.</p><Suspense fallback={<p>Opening 360° view…</p>}><PanoramaViewer url={`${base}-panorama.webp`}/></Suspense></div>}
    </div>
  </section>;
}
