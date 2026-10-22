import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, Group, CanvasTexture, FrontSide, LinearMipmapLinearFilter, PerspectiveCamera, PMREMGenerator, RepeatWrapping, ClampToEdgeWrapping, SRGBColorSpace, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { CompiledMaterial, CompiledMesh, RenderPackage, RoomDefinition, StudioCamera, TextureAsset } from '../types.ts';
import Action from '../../components/react/Action.tsx';
import { prepareArtworkCanvas, createLimewashCanvas } from '../finishes.ts';

class SceneBoundary extends Component<{children:ReactNode;onRetry:()=>void},{failed:boolean}> {
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div className="studio-scene-fallback"><p>The 3D view could not start. Your room is safe; you can continue in the plan.</p><Action onClick={this.props.onRetry}>Retry 3D view</Action></div>:this.props.children;}
}
function Navigation({cameraView,reset,rotate,zoom,roomSize}:{cameraView:StudioCamera|null;reset:number;rotate:number;zoom:number;roomSize:number}) {
  const {camera,gl,invalidate}=useThree(); const control=useRef<OrbitControls|null>(null); const previousRotate=useRef(rotate), previousZoom=useRef(zoom);
  useEffect(()=>{const c=new OrbitControls(camera,gl.domElement);control.current=c;c.enableDamping=false;c.minDistance=.15;c.maxDistance=roomSize*4;c.maxPolarAngle=Math.PI*.49;c.addEventListener('change',()=>invalidate());return()=>{c.dispose();control.current=null;};},[camera,gl,invalidate,roomSize]);
  useEffect(()=>{const c=control.current;if(!c)return; if(cameraView){camera.position.fromArray(cameraView.position);c.target.fromArray(cameraView.target);(camera as PerspectiveCamera).fov=cameraView.fov;c.minDistance=0;c.minPolarAngle=0;c.maxPolarAngle=Math.PI;}else{c.minDistance=.15;c.minPolarAngle=0;c.maxPolarAngle=Math.PI*.49;camera.position.set(roomSize*1.25,roomSize*.95,roomSize*1.25);c.target.set(roomSize*.35,.8,roomSize*.3);(camera as PerspectiveCamera).fov=44;} (camera as PerspectiveCamera).updateProjectionMatrix();c.update();invalidate();},[cameraView,reset,camera,invalidate,roomSize]);
  useEffect(()=>{const c=control.current;const diff=rotate-previousRotate.current;previousRotate.current=rotate;if(!c||!diff)return;const delta=camera.position.clone().sub(c.target);delta.applyAxisAngle(new Vector3(0,1,0),diff*Math.PI/12);camera.position.copy(c.target).add(delta);c.update();invalidate();},[rotate]);
  useEffect(()=>{const c=control.current;const changed=zoom!==previousZoom.current;previousZoom.current=zoom;if(!c||!changed)return;const delta=camera.position.clone().sub(c.target);delta.multiplyScalar(zoom>0?.85:1.18);camera.position.copy(c.target).add(delta);c.update();invalidate();},[zoom]);
  return null;
}
function useMaterialMaps(scene:RenderPackage,maximumAnisotropy:number|null) {
  const [prepared,setPrepared]=useState<{key:string;maps:Record<string,CanvasTexture>}>({key:'',maps:{}});
  const [narrow,setNarrow]=useState(()=>typeof window!=='undefined'&&window.innerWidth<761);
  useEffect(()=>{const query=window.matchMedia('(max-width:760px)'),update=()=>setNarrow(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  const used=new Set(scene.meshes.map(m=>m.materialId));
  const active=scene.materials.filter(m=>used.has(m.id));
  // Scalar shading controls do not change prepared pixels. Retire maps during
  // render as soon as any actual preparation input changes, before effect cleanup
  // disposes them; a disposed texture must never be rebound while decoding.
  const signature=JSON.stringify(active.filter(m=>m.textureId||m.type==='bauwerk').map(({id,type,colour,textureId,texturePreparation,repeat,seed})=>({id,type,colour,textureId,texturePreparation,repeat,seed})))+scene.textures.map(t=>`${t.id}:${t.sha256}:${Boolean(t.dataUrl)}`).join();
  const preparationKey=JSON.stringify([signature,narrow,maximumAnisotropy]);
  useEffect(()=>{if(maximumAnisotropy===null)return;let disposed=false;const owned:CanvasTexture[]=[];const anisotropy=Math.max(1,Math.min(16,maximumAnisotropy));
    async function prepare(){const entries:Record<string,CanvasTexture>={};
      // Reserve a quarter of the total GPU pixel budget for mipmaps, including
      // each used limewash map. Decode originals sequentially; never upscale.
      const count=Math.max(1,active.filter(m=>m.textureId).length);
      const baseBudget=Math.floor((narrow?6_000_000:12_000_000)*.75);
      const limewashPixels=active.filter(m=>m.type==='bauwerk'&&!m.textureId).length*256*256;
      const edge=Math.max(128,Math.min(narrow?1024:2048,Math.floor(Math.sqrt(Math.max(0,baseBudget-limewashPixels)/count))));
      for(const material of active){if(disposed)return;const texture=scene.textures.find(t=>t.id===material.textureId);let canvas:HTMLCanvasElement|undefined;
        try{if(texture?.dataUrl)canvas=await prepareArtworkCanvas(texture,material.texturePreparation??{crop:{x:0,y:0,width:1,height:1},rotation:0},edge);
        else if(material.type==='bauwerk')canvas=createLimewashCanvas(material.colour,material.seed??17);}catch{continue;}
        if(!canvas||disposed)continue;const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;map.wrapS=map.wrapT=material.repeat||material.type==='bauwerk'?RepeatWrapping:ClampToEdgeWrapping;map.anisotropy=anisotropy;map.minFilter=LinearMipmapLinearFilter;map.generateMipmaps=true;owned.push(map);entries[material.id]=map;
      }
      if(!disposed)setPrepared({key:preparationKey,maps:entries});
    }
    void prepare();return()=>{disposed=true;owned.forEach(t=>t.dispose());};
  },[preparationKey]);return prepared.key===preparationKey?prepared.maps:{};
}
function IllustrativeReflections({enabled}:{enabled:boolean}) {
  const {gl,scene,invalidate}=useThree();
  useEffect(()=>{
    if(!enabled)return;
    // A neutral generated studio supplies reflections without external HDR files.
    // It illustrates the scalar controls; it is not a measured room environment.
    const generator=new PMREMGenerator(gl),room=new RoomEnvironment();
    const target=generator.fromScene(room,.04),previous=scene.environment;
    scene.environment=target.texture;invalidate();
    room.dispose();generator.dispose();
    return()=>{if(scene.environment===target.texture)scene.environment=previous;target.dispose();invalidate();};
  },[enabled,gl,scene,invalidate]);
  return null;
}
function Surface({mesh,material,map,selected,onSelect}:{mesh:CompiledMesh;material:CompiledMaterial;map?:CanvasTexture;selected:boolean;onSelect:(id:string)=>void}) {
  const geometry=useMemo(()=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(mesh.positions),3));g.setAttribute('normal',new BufferAttribute(new Float32Array(mesh.normals),3));g.setAttribute('uv',new BufferAttribute(new Float32Array(mesh.uvs),2));g.setIndex(mesh.indices);return g;},[mesh]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  // A newly available map changes Three.js shader defines; recreate that material.
  return <mesh name={mesh.id} geometry={geometry} castShadow receiveShadow onClick={e=>{if(mesh.wallId){e.stopPropagation();onSelect(mesh.wallId);}}}><meshStandardMaterial key={`${material.id}:${map?.uuid??'untextured'}`} name={material.id} color={map?'#ffffff':material.colour} map={map??null} roughness={material.appearance?.roughness??material.roughness} metalness={material.appearance?.metalness??0} side={FrontSide} emissive={selected?'#443216':'#000000'} emissiveIntensity={selected?.1:0}/></mesh>;
}
function CutawayWall({meshes,room,interior,children}:{meshes:CompiledMesh[];room:RoomDefinition;interior:boolean;children:ReactNode}) {
  const group=useRef<Group>(null);
  const wallIndex=room.vertices.findIndex(vertex=>vertex.wallId===meshes[0]?.wallId);
  const a=room.vertices[wallIndex],b=room.vertices[(wallIndex+1)%room.vertices.length];
  const wallNormal=a&&b?[-(b.z-a.z),0,b.x-a.x]:null;
  // Visibility follows the surveyed plane, including bare zero-depth openings.
  // Relief shading normals must never move the cutaway boundary.
  useFrame(({camera})=>{if(group.current)group.current.visible=interior||!wallNormal||!a||wallNormal[0]*(camera.position.x-a.x/1000)+wallNormal[2]*(camera.position.z-a.z/1000)>=0;});
  return <group ref={group}>{children}</group>;
}
export default function RoomScene({scene,room,selectedWallId,onSelect,cameraView=null}:{scene:RenderPackage;room:RoomDefinition;selectedWallId:string|null;onSelect:(id:string)=>void;cameraView?:StudioCamera|null}) {
  const [retry,setRetry]=useState(0),[lost,setLost]=useState(false),[reset,setReset]=useState(0),[rotation,setRotation]=useState(0),[zoom,setZoom]=useState(0);
  const [maximumAnisotropy,setMaximumAnisotropy]=useState<number|null>(null);
  const maps=useMaterialMaps(scene,maximumAnisotropy);
  const size=useMemo(()=>{let maximum=3;for(const mesh of scene.meshes)for(const coordinate of mesh.positions)maximum=Math.max(maximum,Math.abs(coordinate));return maximum;},[scene]);
  const warm=scene.lighting==='warm';
  const usedMaterials=new Set(scene.meshes.map(mesh=>mesh.materialId));
  const reflective=scene.materials.some(material=>usedMaterials.has(material.id)&&(material.appearance?.metalness??0)>0);
  return <div className="studio-scene"><div className="studio-view-label"><span>{cameraView?'Camera preview':'Interactive 3D'}</span><small>Illustrative · {warm?'warm light':'daylight'}</small></div>
    <SceneBoundary key={retry} onRetry={()=>{setLost(false);setRetry(n=>n+1);}}>{lost?<div className="studio-scene-fallback"><p>The graphics connection was interrupted. Your room remains saved.</p><Action onClick={()=>{setLost(false);setRetry(n=>n+1);}}>Restore 3D view</Action></div>:<Canvas frameloop="demand" dpr={[1,1.6]} shadows camera={{position:[6,5,6],fov:44,near:.02,far:120}} gl={{antialias:true,alpha:false,powerPreference:'low-power'}} onCreated={({gl})=>{gl.setClearColor('#e8e4db');setMaximumAnisotropy(gl.capabilities.getMaxAnisotropy());const canvas=gl.domElement;canvas.setAttribute('aria-label','Interactive room preview. Drag to rotate, pinch to zoom, or use the buttons below.');canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setLost(true);},{once:true});}}>
      <ambientLight intensity={warm?.45:.55} color={warm?'#ffe3bc':'#ffffff'}/><hemisphereLight args={[warm?'#ffe0af':'#e7f0ff','#a49b87',.65]}/><directionalLight position={[-2,6,1]} intensity={warm?1.8:2.4} color={warm?'#ffd5a0':'#fff7e9'} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-bias={-.001}/><pointLight position={[size*.5,2.2,size*.4]} intensity={warm?12:2} color={warm?'#ffe0aa':'#ffffff'}/>
      <IllustrativeReflections enabled={reflective}/><Navigation cameraView={cameraView} reset={reset} rotate={rotation} zoom={zoom} roomSize={size}/>
      <Suspense fallback={null}>{[...new Set(scene.meshes.map(m=>m.wallId??'room'))].map(wall=>{const meshes=scene.meshes.filter(m=>(m.wallId??'room')===wall);return <CutawayWall key={wall} meshes={meshes} room={room} interior={Boolean(cameraView)}>{meshes.filter(m=>cameraView||(m.surface!=='ceiling'&&!m.id.endsWith('-outside'))).map(mesh=>{const mat=scene.materials.find(m=>m.id===mesh.materialId)!;return <Surface key={mesh.id} mesh={mesh} material={mat} map={maps[mat.id]} selected={Boolean(selectedWallId&&mesh.wallId===selectedWallId)} onSelect={onSelect}/>;})}</CutawayWall>;})}</Suspense>
    </Canvas>}</SceneBoundary>
    <div className="studio-scene-tools"><Action onClick={()=>setRotation(n=>n-1)} aria-label="Rotate room left">↶</Action><Action onClick={()=>setRotation(n=>n+1)} aria-label="Rotate room right">↷</Action><Action onClick={()=>setZoom(n=>n>0?n+1:1)} aria-label="Zoom in">＋</Action><Action onClick={()=>setZoom(n=>n<0?n-1:-1)} aria-label="Zoom out">−</Action><Action onClick={()=>setReset(n=>n+1)}>Reset view</Action></div>
  </div>;
}
