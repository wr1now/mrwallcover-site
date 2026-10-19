/** Reproducible local before/after composition and cold-transfer audit. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {serve,launchBrowser,loadPage} from '../visual-browser.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(value=>value.replace(/^--/,'').split('=')));
const output=args.output||'docs/design/clearer-home';
const base=await serve(args.before||'/tmp/mw-clear-base-40ee3d7/dist');
const candidate=await serve(args.after||'dist');
const browser=await launchBrowser();
const results=[];
await mkdir(output,{recursive:true});
try {
 for (const [build,origin] of [['before',base.origin],['after',candidate.origin]]) for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  const context=await browser.createBrowserContext(),page=await context.newPage();
  try {
   await page.setViewport({...viewport,deviceScaleFactor:1});
   await page.setCacheEnabled(false);
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.setRequestInterception(true);
   page.on('request',request=>request.method()==='GET'&&request.url().startsWith(origin+'/')?request.continue():request.abort());
   await page.evaluateOnNewDocument(()=>{window.__clearCLS=0;new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__clearCLS+=entry.value}).observe({type:'layout-shift',buffered:true})});
   assert.equal((await loadPage(page,origin+'/')).status(),200);
   await page.waitForNetworkIdle({idleTime:200,timeout:20000});
   const metrics=await page.evaluate(()=>{
    const resources=performance.getEntriesByType('resource'),main=document.querySelector('main'),rect=main.getBoundingClientRect();
    return {mainHeight:Math.round(rect.height),pageHeight:document.documentElement.scrollHeight,screens:Number((rect.height/innerHeight).toFixed(2)),sections:main.querySelectorAll('section').length,headings:[...main.querySelectorAll('h2')].map(element=>element.textContent.trim()),nav:[...document.querySelectorAll('.primary-nav a')].filter(element=>!element.classList.contains('header-action')&&!element.hasAttribute('data-wa')).map(element=>element.textContent.trim()),cls:window.__clearCLS,htmlBytes:performance.getEntriesByType('navigation')[0].encodedBodySize,resourceBytes:resources.reduce((sum,entry)=>sum+entry.encodedBodySize,0),scriptBytes:resources.filter(entry=>new URL(entry.name).pathname.endsWith('.js')).reduce((sum,entry)=>sum+entry.encodedBodySize,0),overflow:document.documentElement.scrollWidth>innerWidth,botanicalSurfaces:[...document.querySelectorAll('.atelier-atmosphere__edge,.atelier-atmosphere__pond')].map(element=>getComputedStyle(element).display)};
   });
   assert.equal(metrics.overflow,false);assert.deepEqual(errors,[]);
   if(build==='after'){assert.equal(metrics.sections,7);assert.equal(metrics.nav.length,6);assert.equal(await page.$('main [data-design-object]'),null);if(viewport.width<768)assert.ok(metrics.botanicalSurfaces.every(display=>display==='none'));}
   results.push({build,...viewport,...metrics});
   await page.screenshot({path:`${output}/${build}-home-${viewport.width}.jpg`,type:'jpeg',quality:80,fullPage:true});
  } finally {await context.close();}
 }
 const page=await browser.newPage();await page.setViewport({width:1440,height:900});
 await loadPage(page,candidate.origin+'/');await page.$eval('#selected-work',element=>element.scrollIntoView({block:'start',behavior:'instant'}));
 await page.screenshot({path:`${output}/after-selected-work-1440.jpg`,type:'jpeg',quality:88});
 await page.close();
 await writeFile(`${output}/composition.json`,JSON.stringify({context:'Cold local uncompressed static builds; transferred bytes and length are reproducible diagnostics, not field speed scores.',baseline:'40ee3d7e1985a360d2241855ce6aa13bc7ea801a',results},null,2)+'\n');
 console.log(JSON.stringify(results.map(({build,width,mainHeight,screens,sections,cls,htmlBytes,resourceBytes,scriptBytes})=>({build,width,mainHeight,screens,sections,cls,htmlBytes,resourceBytes,scriptBytes})),null,2));
} finally {await browser.close();await base.close();await candidate.close();}
