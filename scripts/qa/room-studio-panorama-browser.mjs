import assert from 'node:assert/strict';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import sharp from 'sharp';
import { serve, launchBrowser, loadPage, waitForPageContent } from '../visual-browser.mjs';
// A private build harness, never an Astro route or a public application asset.
const root=resolve('.tmp/room-studio-panorama-harness');await mkdir(root+'/public',{recursive:true});
if(process.env.ROOM_STUDIO_PANORAMA)await copyFile(process.env.ROOM_STUDIO_PANORAMA,root+'/public/panorama.png');
else await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512"><rect width="1024" height="512" fill="#e3d8c2"/><path d="M0 100h1024v300H0Z" fill="#6d7755"/><path d="M128 100h128v300H128Z M640 100h128v300H640Z" fill="#cfc2aa"/><path d="M450 220h50v180H450Z" fill="#443824"/></svg>')).png().toFile(root+'/public/panorama.png');
await writeFile(root+'/index.html','<html><body><main id="root"></main><script type="module" src="/entry.tsx"></script></body></html>');
await writeFile(root+'/entry.tsx',`import React from 'react';import {DefaultLoadingManager} from 'three';DefaultLoadingManager.onLoad=()=>document.body.dataset.panoramaReady='true';import {createRoot} from 'react-dom/client';import PanoramaViewer from '${resolve('src/room-studio/components/PanoramaViewer.tsx')}';import '${resolve('src/room-studio/studio.css')}';createRoot(document.getElementById('root')!).render(<div style={{width:800}}><PanoramaViewer url="/panorama.png"/></div>);`);
await build({root,configFile:false,logLevel:'error',esbuild:{jsx:'automatic'},build:{outDir:root+'/dist',emptyOutDir:true}});
const server=await serve(root+'/dist'),browser=await launchBrowser();const errors=[];
try{const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1024,height:768});await loadPage(p,server.origin);await p.waitForSelector('.studio-panorama canvas');
  const canvas=await p.$('.studio-panorama canvas');await p.waitForSelector('[data-panorama-ready=true]');const before=await canvas.screenshot();
  const pixels=await sharp(before).stats();assert(pixels.channels.slice(0,3).every(c=>c.mean>15),'Interior sphere is visible rather than black/back-face culled');assert(pixels.channels.some(c=>c.stdev>12),'Panorama contains image detail');
  async function button(text){await p.evaluate(text=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===text).click(),text);await p.evaluate(()=>new Promise(requestAnimationFrame));}
  await button('Look right');const turned=await canvas.screenshot();assert(!before.equals(turned),'Look control changes the rendered view');
  for(let i=1;i<12;i++)await button('Look right');const wrap=await canvas.screenshot();const a=await sharp(before).removeAlpha().raw().toBuffer(),b=await sharp(wrap).removeAlpha().raw().toBuffer();const difference=a.reduce((n,v,i)=>n+Math.abs(v-b[i]),0)/a.length;assert(difference<1,'A complete turn returns to the same seam-free orientation');
  await button('Look up');assert(!before.equals(await canvas.screenshot()),'Keyboard-accessible up control changes pitch');await button('Look down');await button('Reset');const box=await canvas.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2,box.y+box.height-10,{steps:8});await p.mouse.up();const vertical=await canvas.screenshot();assert(!before.equals(vertical),'Pointer navigation changes pitch');assert.equal(await p.$('[role=alert]'),null);assert.deepEqual(errors,[]);
  const evidence=resolve('.review-screens/room-studio-panorama');await mkdir(evidence,{recursive:true});await sharp(before).jpeg({quality:85}).toFile(evidence+'/viewer.jpg');await writeFile(evidence+'/review.json',JSON.stringify({source:process.env.ROOM_STUDIO_PANORAMA?'local Blender render':'original test panorama',interiorVisible:true,turnControls:true,fullTurnMeanPixelDifference:difference,pointerPitch:true,keyboardPitch:true,errors},null,2));console.log('Panorama interior visibility, rotation, full-turn continuity and pointer navigation passed.');
}finally{await browser.close();await server.close();}
