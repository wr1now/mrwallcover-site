/** Fresh-customer v2 acceptance: upload original finite panels through the public controls. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, serve, loadPage, waitForPagePredicate } from '../visual-browser.mjs';
import { validateProject } from '../../src/room-studio/validation.ts';
import { artworkCoverageIssues } from '../../src/room-studio/wall-runs.ts';
import { compileRoom } from '../../src/room-studio/geometry.ts';
const output=resolve('.review-screens/room-studio-v2');await mkdir(output,{recursive:true});
const files=[];
for(let number=1;number<=6;number++){
  const path=resolve(output,`original-panel-${number}.png`);
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="${['#d8c2a1','#c4cbbb','#c1b0a6','#b4bec9','#c9b887','#b8b5a1'][number-1]}"/><path d="M0 100h512M0 300h512M100 0v512M300 0v512" stroke="#52694e" stroke-width="22"/><circle cx="256" cy="256" r="85" fill="#f4eee1"/><text x="256" y="280" font-size="72" text-anchor="middle" fill="#33452d">${number}</text></svg>`)).png().toFile(path);files.push(path);
}
const server=process.env.ROOM_STUDIO_ORIGIN?null:await serve(process.env.ROOM_STUDIO_DIST??'dist');
const origin=process.env.ROOM_STUDIO_ORIGIN??server.origin,browser=await launchBrowser();
try{
  const page=await browser.newPage(),errors=[],blocked=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>{if(request.method()==='GET'&&(request.url().startsWith(origin)||/^(data|blob):/.test(request.url())))request.continue();else{blocked.push(request.url().split('?')[0]);request.abort();}});
  await page.setViewport({width:1440,height:1050});await loadPage(page,`${origin}/room-studio/`);await page.waitForSelector('[data-studio-ready="true"]');
  const click=async(text,scope='.room-studio')=>{const handle=await page.evaluateHandle((text,scope)=>[...document.querySelectorAll(`${scope} button`)].find(button=>button.textContent.trim()===text||button.textContent.trim().endsWith(text)),text,scope);const button=handle.asElement();assert.ok(button,`Button exists: ${text}`);await button.evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));await button.click();await handle.dispose();await page.evaluate(()=>new Promise(requestAnimationFrame));};
  const fill=async(element,value,blur=false)=>{await element.evaluate((input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},String(value));if(blur){await element.focus();await page.keyboard.press('Enter');}await page.evaluate(()=>new Promise(requestAnimationFrame));};
  const field=async(label,scope='.studio-finish-panel',tag='input')=>{const handle=await page.evaluateHandle((label,scope,tag)=>[...document.querySelectorAll(`${scope} label.studio-field`)].find(labelElement=>labelElement.textContent.trim().startsWith(label))?.querySelector(tag),label,scope,tag);assert.ok(handle.asElement(),`Field exists: ${label}`);return handle.asElement();};
  const current=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('mrwallcover-room-studio-v1',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,get=db.transaction('drafts','readonly').objectStore('drafts').get('current');get.onsuccess=()=>{db.close();resolve(get.result);};};}));
  const saved=async(predicate)=>{const deadline=Date.now()+15000;let value;do{value=await current();if(value&&predicate(value))return value;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<deadline);throw new Error(`Expected saved draft: ${JSON.stringify({revision:value?.revision,cameras:value?.cameras,finishes:value?.finishes.map(f=>({name:f.name,type:f.type,panels:f.panels?.length,appearance:f.appearance})),assignments:value?.assignments,wallRuns:value?.wallRuns})}`);};
  await click('Finishes','.studio-steps');await page.waitForSelector('.studio-finish-panel');await click('Wallpaper / mural');
  await (await field('Artwork type','.studio-finish-panel','select')).select('mural');
  const panelBox=await page.evaluateHandle(()=>[...document.querySelectorAll('.studio-finish-panel label')].find(label=>label.textContent.includes('Upload a finite numbered panel sequence'))?.querySelector('input'));await panelBox.asElement().click();await panelBox.dispose();
  await (await page.$('.studio-finish-panel input[type=file]')).uploadFile(...files);
  await page.waitForSelector('.studio-panels');
  for(let index=0;index<6;index++){
    const heights=await page.$$('.studio-panels fieldset input[type=number]');await fill(heights[index*2+1],2800);for(const height of heights)await height.dispose();
  }
  await waitForPagePredicate(page,()=>document.querySelector('.studio-repeat-proof img')?.complete&&!document.querySelector('.studio-artwork-calibration')?.textContent.includes('Preparing the pattern proof'));
  const rights=await page.evaluateHandle(()=>[...document.querySelectorAll('.studio-finish-panel label')].find(label=>label.textContent.includes('I may use this artwork'))?.querySelector('input'));await rights.asElement().evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));await rights.asElement().click();await rights.dispose();
  await click('Accept proof and save artwork');
  const allWalls=await page.evaluateHandle(()=>[...document.querySelectorAll('.studio-finish-panel label')].find(label=>label.textContent.trim()==='Apply to all walls')?.querySelector('input'));await allWalls.asElement().evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));await allWalls.asElement().click();await allWalls.dispose();await click('Apply finish');
  let project=await saved(value=>value.finishes.some(finish=>finish.panels?.length===6)&&value.wallRuns?.length===1);
  assert.equal(project.schemaVersion,2);assert.deepEqual(validateProject(project),[]);assert.deepEqual(artworkCoverageIssues(project),[]);assert.equal(project.assignments.filter(assignment=>assignment.runId).length,4);
  const scene=compileRoom({id:'fresh-customer-panels',projectId:project.id,number:project.revision,createdAt:project.updatedAt,project});assert.equal(scene.materials.filter(material=>material.type==='mural').length,6);assert.equal(scene.textures.length,6);
  await click('Metallic');project=await saved(value=>value.finishes.find(finish=>finish.panels)?.appearance?.metalness===.7);await click('Raised');project=await saved(value=>value.finishes.find(finish=>finish.panels)?.appearance?.relief?.depthMm===6);
  await click('Preview','.studio-steps');await click('Suggest camera positions');
  await page.waitForSelector('svg[aria-label^="Camera placement plan"]');
  const cameraPlan=await page.$('svg[aria-label^="Camera placement plan"]');await cameraPlan.evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));const box=await cameraPlan.boundingBox();await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);project=await saved(value=>Math.abs(value.cameras[0].position[0]-2.1)<.05&&Math.abs(value.cameras[0].position[2]-1.8)<.05);
  const placedX=project.cameras[0].position[0];await cameraPlan.evaluate(element=>element.focus());await page.keyboard.press('ArrowRight');project=await saved(value=>Math.abs(value.cameras[0].position[0]-(placedX+.01))<1e-6);
  const before=project.cameras[0].position;await fill(await field('Camera X','.studio-panel-content'),-1000,true);await waitForPagePredicate(page,()=>document.querySelector('.studio-controls [role=alert]')?.textContent.includes('Keep the camera inside'));project=await current();assert.deepEqual(project.cameras[0].position,before,'Out-of-room camera edit is rejected');assert.equal(await (await field('Camera X','.studio-panel-content')).evaluate(input=>Number(input.value)),Math.round(before[0]*1000),'Rejected numeric text resets to the saved inside camera');
  await page.screenshot({path:resolve(output,'customer-panels-camera-rejection.png'),fullPage:true});
  await click('Suggest camera positions');
  await waitForPagePredicate(page,()=>!document.querySelector('.studio-controls [role=alert]'));
  await saved(value=>Math.hypot(value.cameras[0].position[0]-before[0],value.cameras[0].position[2]-before[2])>.1);
  await (await page.$('.studio-visuals')).screenshot({path:resolve(output,'customer-panels-camera-desktop.png')});
  await page.setViewport({width:390,height:844});await page.screenshot({path:resolve(output,'customer-panels-camera-phone.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No phone horizontal overflow');
  await click('Room','.studio-steps');
  const checked=await page.evaluateHandle(()=>[...document.querySelectorAll('.studio-controls label')].find(label=>label.textContent.includes('I have checked the outline'))?.querySelector('input'));await checked.asElement().evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));await checked.asElement().click();await checked.dispose();
  await click('Save & render','.studio-steps');
  const acknowledgement=await page.evaluateHandle(()=>[...document.querySelectorAll('.studio-review label')].find(label=>label.textContent.includes('I have reviewed this limitation'))?.querySelector('input'));if(acknowledgement.asElement()){await acknowledgement.asElement().evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));await acknowledgement.asElement().click();}await acknowledgement.dispose();
  await click('Confirm room version');
  await waitForPagePredicate(page,()=>[...document.querySelectorAll('.studio-controls button')].some(button=>/^Version \d+ confirmed$/.test(button.textContent.trim())));
  project=await saved(value=>value.room.confirmed===true);
  const revision=await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('mrwallcover-room-studio-v1',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,get=db.transaction('revisions','readonly').objectStore('revisions').getAll();get.onsuccess=()=>{db.close();resolve(get.result.at(-1));};};}));
  assert.deepEqual(revision.project,project,'Confirmed customer revision freezes the exact edited project');
  const exportFolder=resolve('.tmp/room-studio-v2/runs',revision.id);await mkdir(exportFolder,{recursive:true});await writeFile(resolve(exportFolder,'customer-project.json'),JSON.stringify(project,null,2));await writeFile(resolve(exportFolder,'customer-revision.json'),JSON.stringify(revision,null,2));await writeFile(resolve('.tmp/room-studio-v2/latest.json'),JSON.stringify({revisionId:revision.id,projectId:project.id,project:resolve(exportFolder,'customer-project.json'),revision:resolve(exportFolder,'customer-revision.json')},null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  await writeFile(resolve(output,'observations.json'),JSON.stringify({journey:'Blank measured room → six user-uploaded finite panels → calibrated proof → whole-room run → metallic/raised presets → camera placement/keyboard/rejection',schemaVersion:project.schemaVersion,revisionId:revision.id,projectFile:resolve(exportFolder,'customer-project.json'),revisionFile:resolve(exportFolder,'customer-revision.json'),panelCount:6,wallRun:project.wallRuns[0],materialCount:scene.materials.length,errors,blocked},null,2));
  await click('Preview','.studio-steps');
  await (await field('Lighting','.studio-panel-content','select')).select('warm');
  let branch=await saved(value=>value.lighting==='warm');
  await click('Save & render','.studio-steps');
  const detailBox=()=>page.$('.studio-review .studio-check input');
  let ackBox=await detailBox();assert(ackBox,'Low-detail sources require acknowledgement');assert.equal(await ackBox.evaluate(input=>input.checked),false);await ackBox.evaluate(input=>input.scrollIntoView({block:'center',behavior:'instant'}));await ackBox.click();await ackBox.dispose();
  const acknowledgedNumber=branch.revision;await click('Undo');
  await click('Preview','.studio-steps');await (await field('Lighting','.studio-panel-content','select')).select('warm');
  branch=await saved(value=>value.revision===acknowledgedNumber&&value.lighting==='warm');
  await click('Save & render','.studio-steps');ackBox=await detailBox();assert.equal(await ackBox.evaluate(input=>input.checked),false,'A different edit reusing a revision number cannot reuse the previous quality acknowledgement');await ackBox.dispose();
  await writeFile(resolve(output,'quality-confirmation.json'),JSON.stringify({reusedRevisionNumber:acknowledgedNumber,acknowledgementReset:true},null,2));
  console.log('Fresh-customer finite-panel workflow, material presets and camera controls passed at desktop/phone widths.');
}catch(error){throw error;}finally{await browser.close();if(server)await server.close();}
