import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import sharp from 'sharp';
import { serve, launchBrowser, loadPage, waitForPageContent } from '../visual-browser.mjs';
import { compileRoom } from '../../src/room-studio/geometry.ts';
import { fixtureRevision } from '../../src/room-studio/fixtures.ts';
import { LinearMipmapLinearFilter } from 'three';
import { createExampleProject, roomStudioExamples } from '../../src/room-studio/examples.ts';

// Exercise the real scene across material replacement. A fresh mount alone misses
// Three.js shader variants that need rebuilding when a map becomes available.
const root=resolve('.tmp/room-studio-scene-harness'),output=resolve('.review-screens/room-studio-scene');
await mkdir(root,{recursive:true});await mkdir(output,{recursive:true});
const highDetailBytes=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="3072" height="3072"><defs><pattern id="fine" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#405f42"/><path d="M0 0h8v24H0Z" fill="#eee8d8"/><path d="M16 0h2v24h-2Z" fill="#b48b5c"/></pattern></defs><rect width="3072" height="3072" fill="url(#fine)"/></svg>')).png().toBuffer();
const highDetailTexture={id:'high-detail-original',widthPx:3072,heightPx:3072,mime:'image/png',sha256:createHash('sha256').update(highDetailBytes).digest('hex'),dataUrl:`data:image/png;base64,${highDetailBytes.toString('base64')}`};
await writeFile(root+'/index.html','<html><body><main id="root"></main><script type="module" src="/entry.tsx"></script></body></html>');
await writeFile(root+'/entry.tsx',`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {_roots} from '@react-three/fiber';
import RoomScene from '${resolve('src/room-studio/components/RoomScene.tsx')}';
import {fixtureRevision} from '${resolve('src/room-studio/fixtures.ts')}';import {compileRoom} from '${resolve('src/room-studio/geometry.ts')}';import '${resolve('src/room-studio/studio.css')}';
import {createExampleProject,roomStudioExamples} from '${resolve('src/room-studio/examples.ts')}';
const revision=fixtureRevision(),finished=compileRoom(revision),plainRevision=structuredClone(revision);
plainRevision.project.finishes=[{id:'plain-paint',type:'paint',name:'Plain test paint',colour:'#eeeeee',sheen:'matte'}];plainRevision.project.assignments.forEach(a=>a.finishId='plain-paint');
const plain=compileRoom(plainRevision),low={...finished.cameras[1],position:[3.85,.3,3.3],target:[2,1.2,1.8]};
const highRevision=structuredClone(revision);highRevision.project.finishes[0].texture=${JSON.stringify(highDetailTexture)};
// An unused library image must not reduce the active image's detail allowance.
highRevision.project.finishes.push({...structuredClone(highRevision.project.finishes[0]),id:'unused-high-detail',texture:{...structuredClone(highRevision.project.finishes[0].texture),id:'unused-high-detail'}});
const high=compileRoom(highRevision),budgetRevision=structuredClone(highRevision),template=structuredClone(highRevision.project.finishes[0]);
budgetRevision.project.finishes=Array.from({length:4},(_,i)=>({...structuredClone(template),id:'budget-'+i,texture:{...structuredClone(template.texture),id:'budget-source-'+i}}));
budgetRevision.project.assignments.forEach((assignment,i)=>assignment.finishId='budget-'+i);const budget=compileRoom(budgetRevision);
const examples=Object.fromEntries(roomStudioExamples.map(metadata=>{const project=createExampleProject(metadata.id);return [metadata.id,compileRoom({id:'example-fidelity',projectId:project.id,number:project.revision,createdAt:project.updatedAt,project})];}));
window.studioSnapshot=()=>{const s=[..._roots.values()][0].store.getState(),meshes=[],maps=new Map();s.scene.traverse(m=>{if(m.isMesh){const map=m.material.map;if(map)maps.set(map.uuid,{material:m.material.name,width:map.image.width,height:map.image.height,minFilter:map.minFilter,generateMipmaps:map.generateMipmaps,anisotropy:map.anisotropy});meshes.push({id:m.name,material:m.material.name,map:!!map,positions:[...m.geometry.attributes.position.array],normals:[...m.geometry.attributes.normal.array],uvs:[...m.geometry.attributes.uv.array],indices:[...m.geometry.index.array]});}});return {camera:{position:s.camera.position.toArray(),direction:s.camera.getWorldDirection(s.camera.position.clone()).toArray(),fov:s.camera.fov},maximumAnisotropy:s.gl.capabilities.getMaxAnisotropy(),maps:[...maps.values()],meshes};};
function App(){const[scene,setScene]=useState(plain),[camera,setCamera]=useState(finished.cameras[1]);return <><button onClick={()=>setScene(finished)}>Apply finishes</button><button onClick={()=>setScene(plain)}>Remove finishes</button><button onClick={()=>setCamera(low)}>Low camera</button><button onClick={()=>setScene(high)}>High detail source</button><button onClick={()=>setScene(budget)}>Four active images</button>{roomStudioExamples.map(metadata=><button key={metadata.id} onClick={()=>{setScene(examples[metadata.id]);setCamera(examples[metadata.id].cameras[0]);}}>Example {metadata.id}</button>)}<div style={{width:'min(800px,100%)',height:540}}><RoomScene scene={scene} cameraView={camera} selectedWallId={null} onSelect={()=>{}}/></div></>;};createRoot(document.getElementById('root')!).render(<App/>);
`);
await build({root,configFile:false,logLevel:'error',esbuild:{jsx:'automatic'},build:{outDir:root+'/dist',emptyOutDir:true}});
const server=await serve(root+'/dist'),browser=await launchBrowser(),errors=[],blocked=[];
try {
  const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);p.on('request',request=>{if(request.method()==='GET'&&(request.url().startsWith(server.origin)||/^(data|blob):/.test(request.url())))void request.continue();else{blocked.push(request.url().split('?')[0]);void request.abort();}});await p.setViewport({width:1000,height:720});await loadPage(p,server.origin);await p.waitForSelector('canvas');
  const canvas=await p.$('canvas');const green=async buffer=>{const {data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});let count=0;for(let i=0;i<data.length;i+=info.channels)if(data[i+1]>data[i]*1.15&&data[i+1]>data[i+2]*1.15)count++;return count/(info.width*info.height);};
  const before=await green(await canvas.screenshot());
  async function click(text){await p.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text).click(),text);}
  async function waitMaps(){await p.waitForFunction(()=>window.studioSnapshot().meshes.filter(m=>m.map).length>10);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
  await click('Apply finishes');await waitMaps();const screenshot=await canvas.screenshot(),after=await green(screenshot);
  assert(after>.01&&after>before+.01,'Mapped wallpaper must become visible on existing wall surfaces after paint');
  const actual=await p.evaluate(()=>window.studioSnapshot()),expected=compileRoom(fixtureRevision());
  function meshParity(actual,expected){assert.equal(actual.meshes.length,expected.meshes.length);for(const mesh of expected.meshes){const found=actual.meshes.find(m=>m.id===mesh.id);assert(found,mesh.id);assert.equal(found.material,mesh.materialId);for(const attribute of ['positions','normals','uvs','indices']){assert.equal(found[attribute].length,mesh[attribute].length);found[attribute].forEach((v,i)=>assert(Math.abs(v-mesh[attribute][i])<1e-5,`${mesh.id} ${attribute}`));}}}
  meshParity(actual,expected);
  await sharp(screenshot).jpeg({quality:85}).toFile(output+'/mapped-room.jpg');
  await click('Remove finishes');await p.waitForFunction(()=>window.studioSnapshot().meshes.every(m=>!m.map));const removed=await green(await canvas.screenshot());assert(removed<.01);
  await click('Apply finishes');await waitMaps();assert(await green(await canvas.screenshot())>.01,'Disposed maps can be prepared and applied again');
  await click('Low camera');await p.waitForFunction(()=>Math.abs(window.studioSnapshot().camera.position[1]-.3)<1e-6);const camera=await p.evaluate(()=>window.studioSnapshot().camera);assert.deepEqual(camera.position.map(n=>Math.round(n*1000)),[3850,300,3300]);assert.equal(camera.fov,65);assert.deepEqual(errors,[]);
  const detailChecks=[];
  function checkFiltering(snapshot){for(const map of snapshot.maps){assert.equal(map.minFilter,LinearMipmapLinearFilter,'Distance minification uses trilinear mipmaps');assert.equal(map.generateMipmaps,true);assert.equal(map.anisotropy,Math.max(1,Math.min(16,snapshot.maximumAnisotropy)),'Oblique filtering stays within the real renderer capability');}}
  function mipPixels(map){let pixels=0,width=map.width,height=map.height;do{pixels+=width*height;if(width===1&&height===1)break;width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2));}while(true);return pixels;}
  await click('High detail source');await p.waitForFunction(()=>window.studioSnapshot().maps.some(map=>map.material==='fixture-wallpaper'&&map.width===2048));
  let detail=await p.evaluate(()=>window.studioSnapshot());checkFiltering(detail);assert.equal(detail.maps.length,2,'Only the applied artwork and limewash are uploaded, excluding library images');assert.equal(detail.maps.find(map=>map.material==='fixture-wallpaper').height,2048);detailChecks.push({viewport:1000,maps:detail.maps});
  await p.setViewport({width:390,height:720});await p.waitForFunction(()=>window.studioSnapshot().maps.some(map=>map.material==='fixture-wallpaper'&&map.width===1024));detail=await p.evaluate(()=>window.studioSnapshot());checkFiltering(detail);detailChecks.push({viewport:390,maps:detail.maps});
  await p.setViewport({width:1000,height:720});await p.waitForFunction(()=>window.studioSnapshot().maps.some(map=>map.material==='fixture-wallpaper'&&map.width===2048));
  await click('Four active images');await p.waitForFunction(()=>window.studioSnapshot().maps.length===4&&window.studioSnapshot().maps.every(map=>map.material.startsWith('budget-')));detail=await p.evaluate(()=>window.studioSnapshot());checkFiltering(detail);assert(detail.maps.every(map=>map.width>1024),'Desktop retains more original detail when the aggregate budget permits');const desktopMipPixels=detail.maps.reduce((sum,map)=>sum+mipPixels(map),0);assert(desktopMipPixels<=12_000_000,'All desktop textures including mip levels fit the shared pixel budget');
  await p.setViewport({width:390,height:720});await p.waitForFunction(()=>window.studioSnapshot().maps.length===4&&window.studioSnapshot().maps.every(map=>map.width<=1024));detail=await p.evaluate(()=>window.studioSnapshot());const mobileMipPixels=detail.maps.reduce((sum,map)=>sum+mipPixels(map),0);assert(mobileMipPixels<=6_000_000,'All mobile textures including mip levels fit the shared pixel budget');assert.deepEqual(errors,[]);
  const exampleChecks=[];await p.setViewport({width:1000,height:720});
  for(const metadata of roomStudioExamples){
    await click('Example '+metadata.id);await p.waitForFunction(id=>window.studioSnapshot().maps.some(map=>map.material==='example-'+id+'-wallpaper'&&map.width===1536),{},metadata.id);
    const shown=await p.evaluate(()=>window.studioSnapshot()),project=createExampleProject(metadata.id),compiled=compileRoom({id:'example-fidelity',projectId:project.id,number:project.revision,createdAt:project.updatedAt,project});
    meshParity(shown,compiled);checkFiltering(shown);shown.camera.position.forEach((value,index)=>assert(Math.abs(value-compiled.cameras[0].position[index])<1e-8));const aim=compiled.cameras[0].target.map((value,index)=>value-compiled.cameras[0].position[index]),aimLength=Math.hypot(...aim);shown.camera.direction.forEach((value,index)=>assert(Math.abs(value-aim[index]/aimLength)<1e-8));assert.equal(shown.camera.fov,compiled.cameras[0].fov);
    assert.equal(shown.maps.find(map=>map.material==='example-'+metadata.id+'-wallpaper').height,1536,'The desktop preview preserves the complete native example artwork');
    const manifest=JSON.parse(await readFile(resolve('public/media/room-studio/examples',metadata.id+'-manifest.json'),'utf8'));
    assert.equal(manifest.meshUvSha256,createHash('sha256').update(JSON.stringify(compiled.meshes)).digest('hex'),'Published render and real browser consume identical measured surfaces and physical UVs');
    assert.equal(manifest.sourceSha256,createHash('sha256').update(JSON.stringify({room:{...project.room,confirmed:undefined},finishes:project.finishes,assignments:project.assignments,cameras:project.cameras,lighting:project.lighting})).digest('hex'),'The gallery render retains this exact artwork, placement and camera source');
    for(const output of manifest.outputs){const bytes=await readFile(resolve('public/media/room-studio/examples',output.file)),image=await sharp(bytes).metadata();assert.deepEqual([image.width,image.height],output.kind==='panorama'?[4096,2048]:[1920,1080]);assert.equal(createHash('sha256').update(bytes).digest('hex'),output.sha256);}
    await canvas.screenshot({path:output+'/'+metadata.id+'-actual-browser.png'});exampleChecks.push({id:metadata.id,meshUvParity:true,publishedRenderSourceParity:true,nativeArtworkPixels:[1536,1536],camera:shown.camera,outputsVerified:manifest.outputs.length});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  await writeFile(output+'/review.json',JSON.stringify({paintToWallpaperVisible:true,removeAndReapply:true,greenPixelRatio:{before,after,removed},actualMeshAttributeParity:true,meshes:actual.meshes.length,lowCameraPosePreserved:true,verticalFov:camera.fov,detailChecks,trilinearMipmaps:true,hardwareBoundedAnisotropy:true,activeImagesOnly:true,textureBudgetIncludingMips:{desktopPixels:desktopMipPixels,mobilePixels:mobileMipPixels},exampleChecks,errors,blocked},null,2));
  console.log('Room Studio scene: live material replacement, mesh/UV parity, saved camera pose, responsive source detail and bounded mipmapped texture budgets passed.');
}finally{await browser.close();await server.close();}
