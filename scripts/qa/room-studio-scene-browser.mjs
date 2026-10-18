import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import sharp from 'sharp';
import { serve, launchBrowser, loadPage, waitForPageContent } from '../visual-browser.mjs';
import { compileRoom } from '../../src/room-studio/geometry.ts';
import { fixtureRevision } from '../../src/room-studio/fixtures.ts';

// Exercise the real scene across material replacement. A fresh mount alone misses
// Three.js shader variants that need rebuilding when a map becomes available.
const root=resolve('.tmp/room-studio-scene-harness'),output=resolve('.review-screens/room-studio-scene');
await mkdir(root,{recursive:true});await mkdir(output,{recursive:true});
await writeFile(root+'/index.html','<html><body><main id="root"></main><script type="module" src="/entry.tsx"></script></body></html>');
await writeFile(root+'/entry.tsx',`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {_roots} from '@react-three/fiber';
import RoomScene from '${resolve('src/room-studio/components/RoomScene.tsx')}';
import {fixtureRevision} from '${resolve('src/room-studio/fixtures.ts')}';import {compileRoom} from '${resolve('src/room-studio/geometry.ts')}';import '${resolve('src/room-studio/studio.css')}';
const revision=fixtureRevision(),finished=compileRoom(revision),plainRevision=structuredClone(revision);
plainRevision.project.finishes=[{id:'plain-paint',type:'paint',name:'Plain test paint',colour:'#eeeeee',sheen:'matte'}];plainRevision.project.assignments.forEach(a=>a.finishId='plain-paint');
const plain=compileRoom(plainRevision),low={...finished.cameras[1],position:[3.85,.3,3.3],target:[2,1.2,1.8]};
window.studioSnapshot=()=>{const s=[..._roots.values()][0].store.getState(),meshes=[];s.scene.traverse(m=>{if(m.isMesh)meshes.push({id:m.name,material:m.material.name,map:!!m.material.map,positions:[...m.geometry.attributes.position.array],normals:[...m.geometry.attributes.normal.array],uvs:[...m.geometry.attributes.uv.array],indices:[...m.geometry.index.array]});});return {camera:{position:s.camera.position.toArray(),fov:s.camera.fov},meshes};};
function App(){const[scene,setScene]=useState(plain),[camera,setCamera]=useState(finished.cameras[1]);return <><button onClick={()=>setScene(finished)}>Apply finishes</button><button onClick={()=>setScene(plain)}>Remove finishes</button><button onClick={()=>setCamera(low)}>Low camera</button><div style={{width:800,height:540}}><RoomScene scene={scene} cameraView={camera} selectedWallId={null} onSelect={()=>{}}/></div></>;};createRoot(document.getElementById('root')!).render(<App/>);
`);
await build({root,configFile:false,logLevel:'error',esbuild:{jsx:'automatic'},build:{outDir:root+'/dist',emptyOutDir:true}});
const server=await serve(root+'/dist'),browser=await launchBrowser(),errors=[];
try {
  const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1000,height:720});await loadPage(p,server.origin);await p.waitForSelector('canvas');
  const canvas=await p.$('canvas');const green=async buffer=>{const {data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});let count=0;for(let i=0;i<data.length;i+=info.channels)if(data[i+1]>data[i]*1.15&&data[i+1]>data[i+2]*1.15)count++;return count/(info.width*info.height);};
  const before=await green(await canvas.screenshot());
  async function click(text){await p.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text).click(),text);}
  async function waitMaps(){await p.waitForFunction(()=>window.studioSnapshot().meshes.filter(m=>m.map).length>10);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
  await click('Apply finishes');await waitMaps();const screenshot=await canvas.screenshot(),after=await green(screenshot);
  assert(after>.01&&after>before+.01,'Mapped wallpaper must become visible on existing wall surfaces after paint');
  const actual=await p.evaluate(()=>window.studioSnapshot()),expected=compileRoom(fixtureRevision());
  assert.equal(actual.meshes.length,expected.meshes.length);
  for(const mesh of expected.meshes){const found=actual.meshes.find(m=>m.id===mesh.id);assert(found,mesh.id);assert.equal(found.material,mesh.materialId);for(const attribute of ['positions','normals','uvs','indices']){assert.equal(found[attribute].length,mesh[attribute].length);found[attribute].forEach((v,i)=>assert(Math.abs(v-mesh[attribute][i])<1e-5,`${mesh.id} ${attribute}`));}}
  await sharp(screenshot).jpeg({quality:85}).toFile(output+'/mapped-room.jpg');
  await click('Remove finishes');await p.waitForFunction(()=>window.studioSnapshot().meshes.every(m=>!m.map));const removed=await green(await canvas.screenshot());assert(removed<.01);
  await click('Apply finishes');await waitMaps();assert(await green(await canvas.screenshot())>.01,'Disposed maps can be prepared and applied again');
  await click('Low camera');await p.waitForFunction(()=>Math.abs(window.studioSnapshot().camera.position[1]-.3)<1e-6);const camera=await p.evaluate(()=>window.studioSnapshot().camera);assert.deepEqual(camera.position.map(n=>Math.round(n*1000)),[3850,300,3300]);assert.equal(camera.fov,65);assert.deepEqual(errors,[]);
  await writeFile(output+'/review.json',JSON.stringify({paintToWallpaperVisible:true,removeAndReapply:true,greenPixelRatio:{before,after,removed},actualMeshAttributeParity:true,meshes:actual.meshes.length,lowCameraPosePreserved:true,verticalFov:camera.fov,errors},null,2));
  console.log('Room Studio scene: live paint/map replacement, browser mesh/UV parity, repeated finish changes and saved camera pose passed.');
}finally{await browser.close();await server.close();}
