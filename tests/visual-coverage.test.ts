import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serve, launchBrowser } from '../scripts/visual-browser.mjs';

async function pages(dir:string):Promise<string[]> {
  const entries=await readdir(dir,{withFileTypes:true});
  return (await Promise.all(entries.map(e=>e.isDirectory()?pages(join(dir,e.name)):e.name.endsWith('.html')?[join(dir,e.name)]:[]))).flat();
}

test('every published and utility page has a visual decision and works at mobile and desktop widths', {timeout:300000}, async()=>{
  const review=JSON.parse(await readFile('docs/design/route-review.json','utf8'));
  const routes=[];
  for(const file of await pages('dist')) {
    const html=await readFile(file,'utf8');
    if(/http-equiv="refresh"/.test(html)) continue;
    const rel=file.slice(5);
    routes.push(rel==='index.html'?'/':rel.endsWith('index.html')?'/'+rel.slice(0,-10):'/'+rel);
  }
  assert.deepEqual(review.routes.map((r:any)=>r.path).sort(),routes.sort(),'record a visual decision for each new page');
  for(const r of review.routes) assert.ok(r.decision.length>40,`${r.path} needs a specific design decision`);
  const server=await serve('dist');
  const browser=await launchBrowser();
  const observations=[];
  const output=process.env.MW_VISUAL_AUDIT_OUTPUT;
  if(output) await mkdir(output,{recursive:true});
  try {
    for(const width of [390,1440]) {
      const page=await browser.newPage();
      await page.setViewport({width,height:900,deviceScaleFactor:1});
      const errors:string[]=[];
      page.on('pageerror',(error:Error)=>errors.push(error.message));
      for(const path of routes) {
        errors.length=0;
        const response=await page.goto(server.origin+path,{waitUntil:'load'});
        assert.equal(response?.status(),200,path);
        await page.evaluate(async()=>{
          await document.fonts.ready;
          await Promise.all([...document.images].map(async i=>{i.loading='eager';try {await i.decode();}catch{}}));
        });
        const result=await page.evaluate(()=>({
          overflow:document.documentElement.scrollWidth>innerWidth,
          h1:document.querySelectorAll('main h1').length,
          broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),
          icons:[...document.querySelectorAll('.mw-icon')].every(i=>i.getAttribute('aria-hidden')==='true'&&i.getAttribute('focusable')==='false'),
          actions:[...document.querySelectorAll<HTMLElement>('.mw-action')].filter(a=>a.getClientRects().length&&a.getBoundingClientRect().height<43).map(a=>a.textContent?.trim()),
          questionVisuals:[...document.querySelectorAll<HTMLElement>('.question-heading-row, .faq summary')].every(row=>{
            const drawing=row.querySelector('[data-question-visual]');
            const heading=row.querySelector('h2,h3');
            return drawing&&heading&&drawing.getBoundingClientRect().left>=heading.getBoundingClientRect().right;
          }),
          objects:document.querySelectorAll('[data-design-object]').length,
          objectContract:[...document.querySelectorAll<HTMLElement>('[data-design-object]')].every(object=>{
            const poster=object.querySelector('img');
            return object.getAttribute('aria-hidden')==='true'&&poster?.alt===''&&Number(poster.getAttribute('width'))>0&&Number(poster.getAttribute('height'))>0&&/\/media\/design-objects\/.+\.webp$/.test(poster.getAttribute('src')??'');
          }),
          objectControls:document.querySelectorAll('button[data-object-motion]').length,
        }));
        assert.equal(result.overflow,false,`${path} @${width}: horizontal overflow`);
        assert.equal(result.h1,1,`${path}: one main heading`);
        assert.deepEqual(result.broken,[],`${path}: broken image`);
        assert.equal(result.icons,true,`${path}: decorative icon semantics`);
        assert.deepEqual(result.actions,[],`${path} @${width}: action height`);
        assert.equal(result.questionVisuals,true,`${path} @${width}: relevant drawing remains to the right of each question`);
        assert.equal(result.objectContract,true,`${path}: original studies retain decorative, dimensioned SSR posters`);
        if(result.objects>0)assert.ok(result.objectControls>0,`${path}: dimensional studies inherit shared motion controls`);
        if(path==='/for-ai/')assert.equal(result.objects,0,'the factual AI page retains static question drawings');
        assert.deepEqual(errors,[],`${path}: browser exceptions`);
        observations.push({path,width,...result});
        if(output) {
          await page.addStyleTag({content:'* { content-visibility:visible!important; contain-intrinsic-size:none!important; transition:none!important; animation:none!important; } html { scroll-behavior:auto!important; } .dock { visibility:hidden!important; }'});
          const evidence=await page.$('main .evidence-figure, main .project-evidence-grid, main .technical-diagram, main .glance-box, main .professional-briefing, main .material-evidence');
          if(evidence) await evidence.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
          await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
          await page.screenshot({path:join(output,`${path.replace(/[^a-z0-9]+/g,'-')||'home'}-${width}.jpg`),type:'jpeg',quality:65});
        }
      }
      await page.close();
    }
    if(output) await writeFile(join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');
  } finally {await browser.close();await server.close();}
});
