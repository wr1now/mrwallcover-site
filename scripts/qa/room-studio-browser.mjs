import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve, launchBrowser } from '../visual-browser.mjs';
import { fixtureProject } from '../../src/room-studio/fixtures.ts';
const output=resolve('.review-screens/room-studio');await mkdir(output,{recursive:true});await mkdir('.tmp/room-studio',{recursive:true});
const server=await serve(process.env.ROOM_STUDIO_DIST||'dist'),browser=await launchBrowser();const errors=[];const evidence=[];
async function button(page,name,scope='.room-studio'){const previous=await page.$eval('.room-studio',e=>e.dataset.studioRevision);const h=await page.evaluateHandle(({name,scope})=>[...document.querySelectorAll(`${scope} button`)].find(b=>b.textContent.trim()===name),{name,scope});const el=h.asElement();assert(el,`Button missing: ${name}`);await el.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await el.click();if(['Undo','Redo','Add door'].includes(name))await page.waitForFunction(previous=>document.querySelector('.room-studio').dataset.studioRevision!==previous,{},previous);await h.dispose();}
async function field(page,label,value){const previous=await page.$eval('.room-studio',e=>e.dataset.studioRevision);const h=await page.evaluateHandle(label=>[...document.querySelectorAll('.room-studio label')].find(l=>l.querySelector('span')?.textContent.trim().replace(/\s+(mm|°|px)$/,'')===label)?.querySelector('input'),label);const el=h.asElement();assert(el,`Field missing: ${label}`);await el.asLocator().fill(String(value));await el.press('Tab');await page.waitForFunction(previous=>document.querySelector('.room-studio').dataset.studioRevision!==previous,{},previous);await h.dispose();}
async function draft(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('mrwallcover-room-studio-v1',1);r.onsuccess=()=>{const db=r.result;const q=db.transaction('drafts').objectStore('drafts').get('current');q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=reject;};r.onerror=reject;}));}
async function saved(page){await page.waitForFunction(()=>new Promise(resolve=>{if(document.querySelector('.studio-title>span:last-child')?.textContent!=='Saved on this device')return resolve(false);const r=indexedDB.open('mrwallcover-room-studio-v1');r.onsuccess=()=>{const db=r.result,q=db.transaction('drafts').objectStore('drafts').get('current');q.onsuccess=()=>{resolve(String(q.result?.revision)===document.querySelector('.room-studio').dataset.studioRevision);db.close();};};}));}
async function newPage(width){const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width,height:900,deviceScaleFactor:1});await page.goto(server.origin+'/room-studio/',{waitUntil:'networkidle0'});await page.waitForSelector('[data-studio-ready="true"]');return page;}
try{
  const page=await newPage(1440);await saved(page);
  assert.equal((await draft(page)).room.heightMm,2600);
  await field(page,'Width',4800);await saved(page);assert.equal((await draft(page)).room.vertices[1].x,4800);
  await button(page,'Undo');await saved(page);assert.equal((await draft(page)).room.vertices[1].x,4200);
  await button(page,'Redo');await saved(page);assert.equal((await draft(page)).room.vertices[1].x,4800);
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-studio-ready="true"]');assert.equal((await draft(page)).room.vertices[1].x,4800);
  await button(page,'Add door');await field(page,'Distance from wall start',5000);await page.waitForSelector('.studio-error');await field(page,'Distance from wall start',200);await page.waitForFunction(()=>!document.querySelector('.studio-error'));
  await page.locator('label.studio-check input').click();await saved(page);assert.equal((await draft(page)).room.confirmed,true);
  await page.$eval('.studio-steps button:nth-child(4)',b=>b.click());await button(page,'Confirm room version');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>/Version \d+ confirmed/.test(b.textContent)));
  assert(await page.$eval('.studio-controls',e=>e.textContent.includes('Cloud services are not enabled')));
  const original=await draft(page);await page.$eval('.studio-steps button:first-child',b=>b.click());await field(page,'Ceiling height',2700);await saved(page);assert.equal((await draft(page)).room.confirmed,false);
  // Frozen revisions remain exact snapshots even after later draft edits.
  const frozen=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('mrwallcover-room-studio-v1');r.onsuccess=()=>{const db=r.result,q=db.transaction('revisions').objectStore('revisions').getAll();q.onsuccess=()=>{resolve(q.result);db.close();};};}));
  assert.equal(frozen.at(-1).project.room.heightMm,original.room.heightMm);assert.equal(frozen.at(-1).project.room.confirmed,true);
  evidence.push('Manual dimensions, opening bounds, undo/redo, local reopen, exact frozen revision, disabled cloud');
  // Open independently created fixture rooms through the customer file picker.
  for(const shape of ['rectangle','l-shape','angled']){const fixture=fixtureProject(shape);if(shape==='angled'){fixture.room.vertices[3].z=3901;Object.assign(fixture.room.openings.find(o=>o.kind==='window'),{wallId:'wall-northeast',offsetMm:200,widthMm:800,heightMm:1000,sillMm:900});}const path=resolve(`.tmp/room-studio/${shape}.json`);await writeFile(path,JSON.stringify(fixture));await (await page.$('input[type=file][accept="application/json,.json"]')).uploadFile(path);await page.waitForFunction(name=>document.querySelector('.studio-title input')?.value===name,{},fixture.name);await saved(page);assert.deepEqual((await draft(page)).room.vertices,fixture.room.vertices);assert.equal(await page.$('.studio-error'),null);}
  evidence.push('Rectangle, L-shaped and angled JSON round trips with original fixture artwork and sourced finishes');
  // Drag to the end of a non-integral angled wall. Integer-mm positions must
  // clamp down, rather than rounding beyond the finished inside wall face.
  const angled=await draft(page),windowOpening=angled.room.openings.find(o=>o.kind==='window'),wallIndex=angled.room.vertices.findIndex(v=>v.wallId===windowOpening.wallId),a=angled.room.vertices[wallIndex],b=angled.room.vertices[(wallIndex+1)%angled.room.vertices.length],wallLength=Math.hypot(b.x-a.x,b.z-a.z);
  await page.$eval('.studio-plan svg',svg=>svg.scrollIntoView({block:'center',behavior:'instant'}));
  const positions=await page.$eval('.studio-plan svg',(svg,{a,b,length,opening})=>{const matrix=svg.getScreenCTM(),point=svg.createSVGPoint(),at=offset=>{point.x=a.x+(b.x-a.x)*offset/length;point.y=a.z+(b.z-a.z)*offset/length;const p=point.matrixTransform(matrix);return{x:p.x,y:p.y};};return{start:at(opening.offsetMm+opening.widthMm/2),end:at(length+300)};},{a,b,length:wallLength,opening:windowOpening});
  await page.mouse.move(positions.start.x,positions.start.y);await page.mouse.down();await page.mouse.move(positions.end.x,positions.end.y,{steps:8});await page.mouse.up();await saved(page);
  assert.equal((await draft(page)).room.openings.find(o=>o.id===windowOpening.id).offsetMm,Math.floor(wallLength-windowOpening.widthMm));assert.equal(await page.$('.studio-error'),null);evidence.push('Pointer drag clamps window to integer-mm boundary on an angled wall');

  // Keyboard camera controls do not depend on dragging the canvas.
  const reset=await page.$('.studio-scene-tools button:last-child');await reset.focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');
  for(const width of [360,390,768,1024,1280,1440]){await page.setViewport({width,height:900,deviceScaleFactor:1});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/editor-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width}px`);evidence.push(`No overflow and screenshot at ${width}px`);}
  const beforeLoss=(await draft(page)).id;
  await page.$eval('.studio-scene canvas',canvas=>{const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');const extension=gl?.getExtension('WEBGL_lose_context');if(!extension)throw new Error('Context loss extension unavailable');extension.loseContext();});
  await page.waitForFunction(()=>document.querySelector('.studio-scene')?.textContent.includes('Restore 3D view'));await button(page,'Restore 3D view');await page.waitForSelector('.studio-scene canvas');assert.equal((await draft(page)).id,beforeLoss);evidence.push('Forced WebGL loss recovers with the same saved room');
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});await button(page,'Plan');assert(await page.$eval('.studio-plan-pane',e=>getComputedStyle(e).display!=='none'));await button(page,'3D room');assert(await page.$eval('.studio-3d-pane',e=>getComputedStyle(e).display!=='none'));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);assert(await page.$('.studio-scene canvas'),'Essential 3D remains available under reduced motion');
  await page.close();
  const nojs=await browser.newPage();await nojs.setJavaScriptEnabled(false);await nojs.goto(server.origin+'/room-studio/');assert(await nojs.$eval('main',e=>e.textContent.includes('Room Studio needs JavaScript')));await nojs.close();
  // Ordinary marketing pages must not pull in the room engine or React runtime.
  const marketing=await browser.newPage(),requests=[];marketing.on('request',r=>requests.push(r.url()));await marketing.goto(server.origin+'/contact/',{waitUntil:'networkidle0'});assert(!requests.some(u=>/RoomStudio|RoomScene|FinishPanel|pdf\.worker|client\.[a-zA-Z0-9_-]+\.js/.test(u)), 'Room application leaked into marketing route');await marketing.close();
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/browser-results.json`,JSON.stringify({evidence,errors,scope:'Chromium desktop and responsive emulation. Not physical iPhone Safari or Android validation.'},null,2));console.log(`Room Studio browser journeys passed (${evidence.length} evidence items). Screenshots: ${output}`);
}finally{await browser.close();await server.close();}
