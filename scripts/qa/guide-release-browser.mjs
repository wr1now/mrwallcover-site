import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {serve,launchBrowser,loadPage} from '../visual-browser.mjs';
const chrome=process.env.CHROME_PATH;
assert.ok(chrome,'Set CHROME_PATH to Chrome');
const server=await serve('dist'); const origin=server.origin;
const browser=await launchBrowser();
const captures=process.env.MW_CAPTURE==='1'; await mkdir('docs/design/guide-release',{recursive:true});
const results=[];
try{
 for(const route of ['/advice/','/where-to-buy/','/how-we-check/'])for(const width of [360,390,768,1024,1280,1440]){
  const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width,height:900,deviceScaleFactor:1});await loadPage(page,origin+route);
  const check=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('h1').length,footer:!!document.querySelector('[data-footer]'),smallParagraphs:[...document.querySelectorAll('main p')].filter(p=>p.getBoundingClientRect().height&&parseFloat(getComputedStyle(p).fontSize)<16&&!p.matches('.eyebrow,.page-meta,.guide-byline')).map(p=>p.className)}));
  assert.equal(check.overflow,false,`${route} ${width}: overflow`);assert.equal(check.h1,1);assert.ok(check.footer);assert.deepEqual(errors,[]);assert.deepEqual(check.smallParagraphs,[],`${route} ${width}: small body paragraphs`);
  if(captures&&[390,1440].includes(width)){await page.screenshot({path:`docs/design/guide-release/${route.split('/')[1]}-${width}.jpg`,type:'jpeg',quality:75});}
  if(width===390){
   await page.focus('.footer-group summary');await page.keyboard.press('Enter');assert.equal(await page.$eval('.footer-group',e=>e.open),true);await page.keyboard.press('Enter');
   await page.focus('[data-effects-toggle]');await page.keyboard.press('Space');assert.equal(await page.$eval('[data-effects-toggle]',e=>e.getAttribute('aria-pressed')),'true');await page.keyboard.press('Space');
  }
  results.push({route,width,...check});await page.close();
 }
 for(const route of ['/','/services/','/contact/','/services/timorous-beasties-installer/'])for(const width of [390,1440]){
  const page=await browser.newPage();await page.setViewport({width,height:900});await loadPage(page,origin+route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} footer overflow`);
  if(captures){await page.addStyleTag({content:'* { content-visibility: visible !important; }'});await page.$eval('footer',e=>e.scrollIntoView());await new Promise(r=>setTimeout(r,200));const footer=await page.$('footer');await footer.screenshot({path:`docs/design/guide-release/footer-${route.split('/').filter(Boolean).join('-')||'home'}-${width}.jpg`,type:'jpeg',quality:75});}await page.close();
 }
 const nojs=await browser.newPage();await nojs.setJavaScriptEnabled(false);await nojs.setViewport({width:390,height:900});await loadPage(nojs,origin+'/where-to-buy/');assert.ok(await nojs.$eval('main',e=>e.textContent.includes('Order a sample')));assert.equal(await nojs.$eval('.footer-group',e=>e.open),true);await nojs.close();
 const keyboard=await browser.newPage();await keyboard.setViewport({width:390,height:900});await loadPage(keyboard,origin+'/advice/');await keyboard.focus('.menu-toggle');await keyboard.keyboard.press('Enter');assert.equal(await keyboard.$eval('.menu-toggle',e=>e.getAttribute('aria-expanded')),'true');await keyboard.keyboard.press('Escape');assert.equal(await keyboard.$eval('.menu-toggle',e=>e.getAttribute('aria-expanded')),'false');await keyboard.close();
 await mkdir('.review-screens',{recursive:true});
 await writeFile('.review-screens/guide-browser-results.json',JSON.stringify(results,null,2));console.log(`Guide browser checks: ${results.length} route/width cases, 8 shared-footer cases, keyboard, disclosure, effects and no-JavaScript passed.`);
}finally{await browser.close();await server.close();}
