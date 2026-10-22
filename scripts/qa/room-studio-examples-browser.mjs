/** Public examples through the actual editor and downloads. No service credentials or paid calls. */
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { roomStudioExamples } from '../../src/room-studio/example-metadata.ts';
import { createExampleProject } from '../../src/room-studio/examples.ts';
import { compileRoom } from '../../src/room-studio/geometry.ts';
import { validateProject } from '../../src/room-studio/validation.ts';
import { launchBrowser, loadPage, serve } from '../visual-browser.mjs';
const output=resolve('.review-screens/room-studio-examples');await mkdir(output,{recursive:true});const downloads=resolve(output,'downloads');await mkdir(downloads,{recursive:true});
const dist=process.env.ROOM_STUDIO_DIST??'dist',server=await serve(dist),browser=await launchBrowser(),report={examples:[],navigation:[],errors:[],externalRequests:[],noJavaScript:false};
try {
  const page=await browser.newPage(),requests=[];let holdExamples=false,heldExample=null;page.on('pageerror',error=>report.errors.push(error.message));await page.setRequestInterception(true);page.on('request',request=>{requests.push(request.url());if(holdExamples&&/\/examples\.[^/]+\.js$/.test(request.url())){heldExample=request;return;}if(request.url().startsWith(server.origin)||/^(data|blob):/.test(request.url()))void request.continue();else{report.externalRequests.push(request.url());void request.abort();}});
  await page.setViewport({width:1440,height:1000});await loadPage(page,server.origin+'/room-studio/');await page.waitForSelector('[data-studio-ready=true]');
  assert.equal(await page.$eval('link[rel=canonical]',element=>element.href),'https://www.mrwallcover.com/room-studio/');
  assert.equal(await page.$eval('meta[name=robots]',element=>element.content.includes('noindex')),false);
  assert.equal(await page.$$eval('.studio-example-card',elements=>elements.length),3);
  const scriptRequests=requests.filter(url=>/\.js(?:\?|$)/.test(url));assert(!scriptRequests.some(url=>/examples\.|example-artwork/.test(url)),'Original source artwork is lazy, outside the initial application load');
  const client=await browser.target().createCDPSession(),finished=new Set(),names=new Map();client.on('Browser.downloadWillBegin',event=>names.set(event.guid,event.suggestedFilename));client.on('Browser.downloadProgress',event=>{if(event.state==='completed')finished.add(names.get(event.guid));});await client.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
  async function click(text){await page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text);assertButton(button,text);function assertButton(button,label){if(!button)throw new Error('Missing '+label);button.click();}},text);}
  async function download(name,action){finished.delete(name);const file=resolve(downloads,name);await rm(file,{force:true});await action();const deadline=Date.now()+15000;while(!finished.has(name)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));assert(finished.has(name),'Download completed: '+name);return JSON.parse(await readFile(file,'utf8'));}
  async function captureInteractive(example){
    await click('03Preview');const view=await page.evaluateHandle(()=>[...document.querySelectorAll('.studio-field')].find(field=>field.querySelector('span')?.textContent==='Preview view')?.querySelector('select'));assert(view.asElement(),'Saved camera selector');await view.asElement().select(createExampleProject(example.id).cameras[0].id);await view.dispose();
    const captures=[];
    for(const width of [1440,390]){
      await page.setViewport({width,height:width===390?844:1000});await page.evaluate(async()=>{document.activeElement?.blur();await document.fonts.ready;document.querySelector('.studio-scene canvas').scrollIntoView({block:'center',behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
      const canvas=await page.$('.studio-scene canvas');assert(canvas,'Actual interactive WebGL canvas');let pixels,ratio=0;
      // Source-colour evidence waits for the real async texture decode/upload,
      // rather than accepting a newly mounted, still-untextured canvas.
      const deadline=Date.now()+10000;
      do{pixels=await canvas.screenshot();const {data,info}=await sharp(pixels).removeAlpha().raw().toBuffer({resolveWithObject:true});let matched=0;for(let i=0;i<data.length;i+=info.channels){const r=data[i],g=data[i+1],b=data[i+2];if(example.id==='willow-chimney'?g>r*1.08&&g>b*1.08:example.id==='ochre-lshape'?r>g*1.2&&g>b*1.1:b>r*1.15&&g>r*1.05)matched++;}ratio=matched/(info.width*info.height);if(ratio>.0025)break;await new Promise(resolve=>setTimeout(resolve,150));}while(Date.now()<deadline);
      const image=`${example.id}-interactive-${width}.png`;await writeFile(resolve(output,image),pixels);assert(ratio>.0025,`Original ${example.name} artwork visibly renders at ${width}px`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Example editor has no overflow at '+width);
      await page.screenshot({path:resolve(output,`${example.id}-editor-${width}.jpg`),type:'jpeg',quality:88});const size=await sharp(pixels).metadata();captures.push({viewport:width,canvasPixels:[size.width,size.height],originalColourPixelRatio:ratio,image});
    }
    await page.setViewport({width:1440,height:1000});return captures;
  }
  // Locator.fill clears the DOM value without an input event before typing;
  // an autosave rerender can restore this controlled field in that gap.
  const title=await page.$('.studio-title input');await title.focus();await title.evaluate(input=>input.select());await title.type('Preserved customer draft');await title.press('Tab');
  assert.equal(await title.evaluate(input=>input.value),'Preserved customer draft','Draft name setup replaces the default before testing cancellation');
  // A slow artwork chunk must not replace a draft after the customer cancels.
  holdExamples=true;await page.click('.studio-example-card [data-room-example="willow-chimney"]');await page.waitForSelector('#studio-examples');await click('Open this example in 3D');
  const heldDeadline=Date.now()+10000;while(!heldExample&&Date.now()<heldDeadline)await new Promise(resolve=>setTimeout(resolve,100));assert(heldExample,'Held the actual lazy example module');await click('Cancel');holdExamples=false;await heldExample.continue();await page.waitForNetworkIdle({idleTime:500,timeout:20000});assert.equal(await page.$eval('.studio-title input',element=>element.value),'Preserved customer draft','Cancelled lazy import must leave the draft unchanged');
  let previous='Preserved customer draft';
  for(const example of roomStudioExamples){
    const expected=createExampleProject(example.id);
    await page.click(`.studio-example-card [data-room-example="${example.id}"]`);await page.waitForSelector('#studio-examples');assert.equal(await page.$eval('.studio-title input',element=>element.value),previous,'Choosing a card alone cannot replace a draft');
    await click('Open this example in 3D');await page.waitForFunction(name=>document.querySelector('.studio-title input').value===name,{},expected.name);await page.waitForSelector('.studio-3d-pane canvas');
    await click('Undo');assert.equal(await page.$eval('.studio-title input',element=>element.value),previous,'Undo restores previous room after loading an example');await click('Redo');
    await click('04Save & render');
    const exported=await download(`${expected.name}.room.json`,()=>click('Download editable room'));
    assert.deepEqual(validateProject(exported),[]);assert.equal(exported.ownerId,null);assert.notEqual(exported.id,expected.id);assert.equal(exported.room.confirmed,false,'Example dimensions must be checked by the customer');
    assert.deepEqual(exported.room,expected.room);assert.deepEqual(exported.finishes,expected.finishes);assert.deepEqual(exported.assignments,expected.assignments);
    const revision=project=>({id:'example-ui',projectId:project.id,number:project.revision,createdAt:project.updatedAt,project});const actualScene=compileRoom(revision(exported)),expectedScene=compileRoom(revision(expected));assert.deepEqual(actualScene.meshes,expectedScene.meshes,'Actual browser export retains exact physical mesh and UV data');
    for(const [index,path] of [...example.renders.stills,example.renders.panorama].entries()){const metadata=await sharp(resolve(dist,path.slice(1))).metadata();assert.deepEqual([metadata.width,metadata.height],index<2?[1920,1080]:[4096,2048]);}
    const preview=await sharp(resolve(dist,`media/room-studio/examples/${example.id}-preview.webp`)).metadata();assert.deepEqual([preview.width,preview.height],[960,540]);
    // Reopen the real download through the file input and preserve the same room and artwork.
    const input=await page.$('input[type=file][accept="application/json,.json"]');await input.uploadFile(resolve(downloads,`${expected.name}.room.json`));await page.waitForFunction(()=>document.querySelector('.studio-steps [aria-current]').textContent.includes('Room'));
    assert.equal(await page.$eval('.studio-title input',element=>element.value),expected.name);
    const interactiveCaptures=await captureInteractive(example);
    report.examples.push({id:example.id,layoutSegments:exported.room.vertices.length,windows:exported.room.openings.filter(opening=>opening.kind==='window').length,repeatMm:example.repeatMm,sourcePixels:example.pixelSize,exportReimport:true,undoRedo:true,meshUvParity:true,interactiveCaptures,outputs:[[1920,1080],[1920,1080],[4096,2048]]});previous=expected.name;
  }
  for(const width of [390,768,1024,1280,1440]){
    await page.setViewport({width,height:1000});await loadPage(page,server.origin+'/room-studio/');await page.waitForSelector('[data-studio-ready=true]');
    // DOM presence alone misses copy pushed below an overflow-hidden card.
    // Measure before scrolling a link, which can itself scroll a clipped card.
    const cardCopies=await page.$$eval('.studio-example-card',cards=>cards.map(card=>{const outer=card.getBoundingClientRect(),copy=card.querySelector('.studio-example-copy').getBoundingClientRect(),link=card.querySelector('.studio-example-copy [data-room-example]'),cta=link.getBoundingClientRect();return{id:link.dataset.roomExample,copyInsideCard:copy.top>=outer.top-1&&copy.bottom<=outer.bottom+1,ctaInsideCard:cta.top>=outer.top&&cta.bottom<=outer.bottom};}));
    for(const card of cardCopies){assert(card.copyInsideCard,`All ${card.id} copy is visible inside its card at ${width}px`);assert(card.ctaInsideCard,`Explore action is inside ${card.id} card at ${width}px`);const cta=await page.$(`.studio-example-copy [data-room-example="${card.id}"]`);await cta.evaluate(link=>link.scrollIntoView({block:'center',behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert(await cta.evaluate(link=>{const box=link.getBoundingClientRect();return link.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));}),`${card.id} Explore action can be clicked at ${width}px`);}
    if(width<1280){await page.click('[data-menu-toggle]');assert.equal(await page.$eval('#mobile-menu a[href="/room-studio/"]',element=>element.textContent.trim()),'Wallpaper my room');await page.keyboard.press('Escape');}
    else{assert.equal(await page.$$eval('.header-nav-links>a.nav-link', links=>links.length),11);assert.equal(await page.$eval('.header-nav-links a[href="/room-studio/"]',element=>element.textContent.trim()),'Wallpaper my room');}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No page overflow at '+width);report.navigation.push({width,menu:true,overflow:false,cardCopies,cardExploreHitTargets:true});
    if(width===390||width===1440){await page.evaluate(async()=>{document.activeElement?.blur();await document.fonts.ready;document.querySelector('.studio-showcase').scrollIntoView({block:'start',behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.screenshot({path:resolve(output,`showcase-${width}.jpg`),fullPage:false,type:'jpeg',quality:88});await(await page.$('.studio-showcase')).screenshot({path:resolve(output,`showcase-${width}-full.jpg`),type:'jpeg',quality:88});}
  }
  const nojs=await browser.newPage();await nojs.setJavaScriptEnabled(false);await loadPage(nojs,server.origin+'/room-studio/');assert.equal(await nojs.$$eval('.studio-example-card img',images=>images.length),3);assert.equal(await nojs.$$eval('.studio-full-view',links=>links.length),3);assert(await nojs.$('.mobile-links a[href="/room-studio/"]'));report.noJavaScript=true;await nojs.close();
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);await writeFile(resolve(output,'review.json'),JSON.stringify(report,null,2));console.log('Three examples: actual editor load/undo/download/reimport, mesh/UV parity, HD/4K dimensions, navigation, responsive and no-JS checks passed.');
}finally{await browser.close();await server.close();}
