/** Every owner-requested destination must be visible, reachable and usable. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchBrowser, loadPage, serve } from '../visual-browser.mjs';
const expected = [
  ['Projects','/projects/'], ['Expertise','/services/'], ['Materials','/materials/'],
  ['Wallpapering','/wallpapering/'], ['Wallpaper calculator','/calculator/'],
  ['Wallpaper my room','/room-studio/'], ['For designers','/professionals/'],
  ['Guide','/advice/'], ['About','/about/'], ['AI Crawler','/wallcovering-installation-ai-crawler/'], ['Contact','/get-in-touch/'],
  ['Start your project','/contact/'],
];
const output = resolve('.review-screens/navigation-all'); await mkdir(output,{recursive:true});
const server=await serve('dist'),browser=await launchBrowser(),observations=[],errors=[];
try {
  const page=await browser.newPage(); page.on('pageerror',error=>errors.push(error.message));
  for (const width of [360,390,768,1024,1280,1440]) {
    await page.setViewport({width,height:900}); await loadPage(page,server.origin+'/');
    const mobile=width<1280, scope=mobile?'#mobile-menu':'.primary-nav';
    if(mobile){await page.focus('[data-menu-toggle]');await page.keyboard.press('Enter');await page.waitForSelector('#mobile-menu.is-open');await page.waitForFunction(()=>getComputedStyle(document.querySelector('#mobile-menu')).opacity==='1');}
    const links=await page.$$eval(`${scope} a:not([data-wa])`,elements=>elements.map(element=>[element.textContent.trim(),element.getAttribute('href')]));
    assert.deepEqual(links,expected,`Full menu at ${width}px`);
    for(const [name,href] of expected){
      const link=await page.$(`${scope} a[href="${href}"]`);await link.evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
      const bounds=await link.evaluate(element=>{const box=element.getBoundingClientRect(),hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);return {height:box.height,inside:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight,hit:element.contains(hit)};});
      assert(bounds.height>=44&&bounds.inside&&bounds.hit,`${name} is reachable and clickable at ${width}px`);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`No overflow ${width}px`);
    if(mobile){await page.screenshot({path:resolve(output,`menu-${width}.png`)});await page.keyboard.press('Escape');assert.equal(await page.$eval('[data-menu-toggle]',button=>button===document.activeElement&&button.getAttribute('aria-expanded')==='false'),true);}
    else {const geometry=await page.evaluate(()=>{const bar=document.querySelector('.site-header').getBoundingClientRect(),mark=document.querySelector('.wordmark').getBoundingClientRect(),nav=document.querySelector('.primary-nav').getBoundingClientRect(),action=document.querySelector('.header-action').getBoundingClientRect();return {bar:bar.toJSON(),mark:mark.toJSON(),nav:nav.toJSON(),action:action.toJSON(),fits:nav.left>=mark.right+8&&action.right<=bar.right-8&&nav.top>=bar.top&&nav.bottom<=bar.bottom};});await page.screenshot({path:resolve(output,`menu-${width}.png`)});assert(geometry.fits,'Desktop wordmark and all controls fit: '+JSON.stringify(geometry));}
    observations.push({width,allTwelve:true,clickable:true,overflow:false,escapeFocus:mobile});
  }
  const nojs=await browser.newPage();await nojs.setJavaScriptEnabled(false);
  for(const width of [390,1440]){await nojs.setViewport({width,height:900});await loadPage(nojs,server.origin+'/');const scope=width<1280?'#mobile-menu':'.primary-nav';assert.deepEqual(await nojs.$$eval(`${scope} a:not([data-wa])`,elements=>elements.map(element=>[element.textContent.trim(),element.getAttribute('href')])),expected);}
  for(const [,path] of expected){const response=await fetch(server.origin+path);assert.equal(response.status,200,`Destination exists: ${path}`);}
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'checks.json'),JSON.stringify({expected,observations,noJavaScript:[390,1440],destinations:expected.length,errors},null,2));console.log('Full navigation: all 12 destinations, six widths, clickable controls, keyboard, no-JS and real route checks passed.');
} finally {await browser.close();await server.close();}
