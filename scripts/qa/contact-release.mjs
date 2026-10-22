import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {serve,launchBrowser} from '../visual-browser.mjs';
const server=await serve(process.env.CONTACT_DIST||'dist');const browser=await launchBrowser();const results=[];
await mkdir('.review-screens/contact',{recursive:true});
try {
 for(const width of [360,390,768,1024,1280,1440]) {
  const page=await browser.newPage();await page.setViewport({width,height:900});await page.goto(server.origin+'/get-in-touch/',{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);
  const data=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,rowOverflow:document.querySelector('.site-header-row').scrollWidth>document.querySelector('.site-header-row').clientWidth,headings:document.querySelectorAll('h1').length,current:!!document.querySelector('[href="/get-in-touch/"][aria-current="page"]'),reveal:!!document.querySelector('main button[data-phone-reveal]'),navReveal:!!document.querySelector('header [data-phone-reveal],footer [data-phone-reveal],[data-dock] [data-phone-reveal]')}));
  assert.equal(data.overflow,false,`${width}: overflow`);assert.equal(data.rowOverflow,false,`${width}: header`);assert.equal(data.headings,1);assert.ok(data.current);assert.equal(data.navReveal,false);
  if([390,1440].includes(width))await page.screenshot({path:`.review-screens/contact/after-${width}.png`,fullPage:true});
  if(width<1280){await page.focus('[data-menu-toggle]');await page.keyboard.press('Enter');assert.equal(await page.$eval('[data-menu-toggle]',e=>e.getAttribute('aria-expanded')),'true');assert.equal(await page.$eval('[data-dock]',e=>getComputedStyle(e).display),'none');await page.keyboard.press('Escape');assert.ok(await page.$eval('[data-menu-toggle]',e=>document.activeElement===e));}
  if(data.reveal){await page.$eval('main [data-phone-reveal]',e=>e.scrollIntoView({block:'center'}));await new Promise(r=>setTimeout(r,200));await page.click('main [data-phone-reveal]');assert.ok(await page.$('main a[href^="tel:"]'));}
  results.push({width,...data});await page.close();
 }
 const nojs=await browser.newPage();await nojs.setJavaScriptEnabled(false);await nojs.goto(server.origin+'/get-in-touch/');assert.ok(await nojs.$('a[href^="mailto:info@mrwallcover.com"]'));assert.ok(await nojs.$('[data-contact-ways] a[href="mailto:info@mrwallcover.com?subject=Wallcovering%20enquiry"]'));await nojs.close();
 const live=await browser.newPage();const response=await live.goto('https://www.mrwallcover.com/get-in-touch/',{waitUntil:'networkidle0'});console.log('Production /get-in-touch/: HTTP',response.status());await live.close();
 await writeFile('.review-screens/contact/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
