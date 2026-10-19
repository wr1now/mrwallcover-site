/** Inspect the alternate LOCAL build in an isolated browser, never a customer tab. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { compileRoom } from '../../src/room-studio/geometry.ts';
import { validateProject } from '../../src/room-studio/validation.ts';
import { launchBrowser, loadPage, serve } from '../visual-browser.mjs';

const root=resolve('.tmp/room-studio-private-studies'),dist=join(root,'site/dist'),output=join(root,'browser-review');
await mkdir(output,{recursive:true});const downloads=join(output,'downloads');await mkdir(downloads,{recursive:true});
const preview=JSON.parse(await readFile(join(root,'preview.json'),'utf8')),server=await serve(dist),browser=await launchBrowser();
const report={reviewedAt:new Date().toISOString(),scope:'Private loopback build, real WebGL, real editable downloads/reimports, responsive Chromium emulation. No live services or source-calibration/material accuracy claim.',examples:[],widths:[],errors:[],externalRequests:[]};
try{
  const page=await browser.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>{if(request.url().startsWith(server.origin)||/^(data|blob):/.test(request.url()))void request.continue();else{report.externalRequests.push(request.url());void request.abort();}});
  await page.setViewport({width:1440,height:1000});await loadPage(page,server.origin+'/room-studio/');await page.waitForSelector('[data-studio-ready=true]');
  assert.match(await page.$eval('meta[name=robots]',element=>element.content),/noindex/);
  assert.equal(await page.$$eval('.studio-example-card',elements=>elements.length),3);
  const client=await browser.target().createCDPSession(),finished=new Set(),names=new Map();
  client.on('Browser.downloadWillBegin',event=>names.set(event.guid,event.suggestedFilename));client.on('Browser.downloadProgress',event=>{if(event.state==='completed')finished.add(names.get(event.guid));});
  await client.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
  async function click(text){await page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(element=>element.textContent.trim()===text);if(!button)throw new Error('Missing '+text);button.click();},text);}
  async function downloaded(project){const name=`${project.name}.room.json`,path=join(downloads,name);finished.delete(name);await rm(path,{force:true});await click('Download editable room');const deadline=Date.now()+20000;while(!finished.has(name)&&Date.now()<deadline)await new Promise(done=>setTimeout(done,100));assert(finished.has(name),'Editable room download completed');return {path,project:JSON.parse(await readFile(path,'utf8'))};}
  for(const example of preview.studies){
    const expected=JSON.parse(await readFile(join(root,example.studyId,'room.room.json'),'utf8'));
    await page.click(`.studio-example-card [data-room-example="${example.id}"]`);await page.waitForSelector('#studio-examples');await click('Open this example in 3D');
    await page.waitForFunction(name=>document.querySelector('.studio-title input').value===name,{timeout:60000},expected.name);
    await page.waitForSelector('.studio-scene canvas');await page.waitForNetworkIdle({idleTime:500,timeout:60000});
    await click('04Save & render');const actual=await downloaded(expected);assert.deepEqual(validateProject(actual.project),[]);
    for(const key of ['room','finishes','assignments','cameras','lighting'])assert.deepEqual(actual.project[key],expected[key],`Actual browser export preserves ${key}`);
    assert.equal(actual.project.room.confirmed,false);assert(actual.project.finishes.filter(f=>'calibration'in f).every(f=>!f.calibration.proofAccepted));
    const revision=project=>({id:'private-ui-parity',projectId:project.id,number:project.revision,createdAt:project.updatedAt,project});
    const compiled=compileRoom(revision(actual.project));assert.deepEqual(compiled.meshes,compileRoom(revision(expected)).meshes);
    await (await page.$('input[type=file][accept="application/json,.json"]')).uploadFile(actual.path);
    await page.waitForFunction(()=>document.querySelector('.studio-steps [aria-current]').textContent.includes('Room'));
    await click('03Preview');const select=await page.evaluateHandle(()=>[...document.querySelectorAll('.studio-field')].find(field=>field.querySelector('span')?.textContent==='Preview view')?.querySelector('select'));
    await select.asElement().select(expected.cameras[0].id);await select.dispose();
    const captures=[];
    for(const width of [1440,390]){
      await page.setViewport({width,height:width===390?844:1000});
      await page.evaluate(async()=>{document.activeElement?.blur();await document.fonts.ready;document.querySelector('.studio-scene canvas').scrollIntoView({block:'center',behavior:'instant'});await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));});
      const canvas=await page.$('.studio-scene canvas');await new Promise(done=>setTimeout(done,1000));
      const pixels=await canvas.screenshot(),file=`${example.studyId}-interactive-${width}.png`;await writeFile(join(output,file),pixels);
      await page.screenshot({path:join(output,`${example.studyId}-editor-${width}.jpg`),type:'jpeg',quality:90});
      const dimensions=await sharp(pixels).metadata(),stats=await sharp(pixels).stats();assert(stats.entropy>2,'Canvas has a visible rendered room');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      captures.push({viewport:width,canvasPixels:[dimensions.width,dimensions.height],image:file,entropy:stats.entropy});
    }
    for(const [index,path] of [...example.renders.stills,example.renders.panorama].entries()){const metadata=await sharp(join(dist,path)).metadata();assert.deepEqual([metadata.width,metadata.height],index<2?[1920,1080]:[4096,2048]);}
    await page.setViewport({width:1440,height:1000});
    await page.click(`.studio-example-card [data-room-example="${example.id}"]`);await page.waitForSelector('#studio-examples');await click('Look around in 360°');await page.waitForSelector('.studio-example-panorama canvas');await page.waitForNetworkIdle({idleTime:500});await click('Cancel');
    report.examples.push({id:example.studyId,sourcePixels:example.pixelSize,segments:expected.room.vertices.length,windows:expected.room.openings.filter(opening=>opening.kind==='window').length,exportReimport:true,proofUnconfirmed:true,meshUvSha256:createHash('sha256').update(JSON.stringify(compiled.meshes)).digest('hex'),panoramaOpened:true,captures});
  }
  for(const width of [390,768,1024,1280,1440]){
    await page.setViewport({width,height:1000});await loadPage(page,server.origin+'/room-studio/');await page.waitForSelector('[data-studio-ready=true]');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const cards=await page.$$eval('.studio-example-card',elements=>elements.map(element=>{const outer=element.getBoundingClientRect(),inner=element.querySelector('.studio-example-copy').getBoundingClientRect();return inner.top>=outer.top-1&&inner.bottom<=outer.bottom+1;}));assert(cards.every(Boolean),'All card text/actions stay visible');
    await page.$eval('#example-rooms',element=>element.scrollIntoView({block:'start',behavior:'instant'}));
    if(width===1440||width===390)await page.screenshot({path:join(output,`showcase-${width}.jpg`),type:'jpeg',quality:90,fullPage:true});
    report.widths.push({width,noOverflow:true,visibleCards:true});
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
  await writeFile(join(output,'review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await server.close();}
