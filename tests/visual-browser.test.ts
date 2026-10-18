import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, launchBrowser, loadPage, waitForPageContent } from '../scripts/visual-browser.mjs';
let server:any, browser:any;
before(async()=>{server=await serve('dist');browser=await launchBrowser();});
after(async()=>{await browser?.close();await server?.close();});

test('selected Guide filters remain readable when the library switches topic',async()=>{
  const page=await browser.newPage();
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  try {
    await loadPage(page,server.origin+'/advice/');
    for(const filter of ['all','choosing']) {
      await page.click(`[data-filter="${filter}"]`);
      const colors=await page.$eval(`[data-filter="${filter}"]`,(button:HTMLElement)=>{
        const style=getComputedStyle(button);
        return {foreground:style.color.match(/[\d.]+/g)!.map(Number),background:style.backgroundColor.match(/[\d.]+/g)!.map(Number),pressed:button.getAttribute('aria-pressed')};
      });
      assert.equal(colors.pressed,'true');
      assert.ok(colors.background.length===3||colors.background[3]===1,'selected button has an opaque background');
      const luminance=(channels:number[])=>channels.slice(0,3).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
      const a=luminance(colors.foreground),b=luminance(colors.background);
      assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${filter}: selected label keeps readable contrast`);
    }
    assert.equal(await page.$$eval('.guide-filters [aria-pressed="true"]',(buttons:HTMLElement[])=>buttons.length),1);
  } finally { await page.close(); }
});

test('responsive routes stay within viewport and footer switches from disclosures to columns', {timeout:120000}, async()=>{
  for(const width of [360,390,768,1024,1280,1440]) {
    const page=await browser.newPage();
    await page.setViewport({width,height:900});
    for(const path of ['/','/services/','/advice/','/contact/','/services/timorous-beasties-installer/','/materials/','/advice/set-out-and-pattern-matching/']) {
      assert.equal((await loadPage(page,server.origin+path)).status(),200,path);
      const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth, groups:[...document.querySelectorAll<HTMLDetailsElement>('.footer-group')].map(g=>g.open), broken:[...document.querySelectorAll<HTMLImageElement>('img')].filter(i=>i.loading!=='lazy'&&(!i.complete||!i.naturalWidth)).map(i=>i.src)}));
      assert.equal(result.overflow,false,`${path} @ ${width}`);
      assert.equal(result.groups.length,4);
      assert.ok(result.groups.every((open:boolean)=>open===(width>=1024)),`${path} footer @${width}`);
      assert.deepEqual(result.broken,[],`${path} eager images`);
    }
    await page.close();
  }
});

test('footer disclosure keyboard, effects preference, form/menu dock and no-JS navigation',async()=>{
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844});
  await loadPage(page,server.origin+'/contact/');
  await page.focus('.footer-group summary');
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('.footer-group',(g:HTMLDetailsElement)=>g.open),true);
  await page.click('[data-effects-toggle]');
  assert.equal(await page.$eval('[data-effects-toggle]',(b:HTMLElement)=>b.getAttribute('aria-pressed')),'true');
  await page.reload({waitUntil:'load'});
  await waitForPageContent(page);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.effects),'reduced');
  const input=await page.$('input[name="name"]');
  assert.ok(input,'real enquiry name field');
  await input.focus();
  assert.equal(await page.$eval('[data-dock]',(d:HTMLElement)=>getComputedStyle(d).display),'none');
  await page.click('[data-menu-toggle]');
  assert.equal(await page.$eval('[data-dock]',(d:HTMLElement)=>getComputedStyle(d).display),'none');
  await page.keyboard.press('Escape');
  await page.setJavaScriptEnabled(false);
  await loadPage(page,server.origin+'/services/timorous-beasties-installer/');
  assert.ok(await page.$$eval('.footer-group',(groups:HTMLDetailsElement[])=>groups.every(g=>g.open)),'server-rendered footer links accessible without JS');
  await page.close();
});
