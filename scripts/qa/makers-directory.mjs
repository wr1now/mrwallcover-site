import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {serve,launchBrowser} from '../visual-browser.mjs';
const data=JSON.parse(readFileSync('src/data/makers-directory.json','utf8'));
const server=await serve(process.env.MW_MAKERS_DIST || 'dist-review'),browser=await launchBrowser();
const report=[];const output=process.env.MW_MAKERS_SCREENSHOTS;
if(output)mkdirSync(output,{recursive:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [390,1024,1280,1440]){
  await page.setViewport({width,height:960});
  const paths=width===390||width===1440?['/makers/','/buying-routes/',...data.makers.map(m=>`/makers/${m.slug}/`)]:['/makers/','/buying-routes/'];
  for(const path of paths){const response=await page.goto(server.origin+path,{waitUntil:'load'});assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);
   const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('main h1').length,wideReading:[...document.querySelectorAll('.maker-intro p,.maker-section>p')].filter(e=>e.getBoundingClientRect().width>44*parseFloat(getComputedStyle(document.documentElement).fontSize)+1).length,small:[...document.querySelectorAll('main .maker-card p:not(.eyebrow):not(.maker-date), main .maker-route p:not(.eyebrow):not(.maker-date), main .maker-route dd, main .lede')].filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).length}));
   assert.equal(result.overflow,false,path+' '+width);assert.equal(result.h1,1);assert.equal(result.small,0,path+' text floor');assert.equal(result.wideReading,0,path+' reading measure');report.push({path,width,...result});
   if(path==='/makers/') {
    const photographs=await page.$$eval('[data-maker-photo]',async figures=>{
     await Promise.all(figures.map(async figure=>{const image=figure.querySelector('img');image.loading='eager';await image.decode();}));
     return figures.map(figure=>({kind:figure.dataset.makerPhoto,loaded:figure.querySelector('img').naturalWidth>0,caption:figure.querySelector('figcaption').textContent.trim(),captionSize:parseFloat(getComputedStyle(figure.querySelector('figcaption')).fontSize)}));
    });
    assert.equal(photographs.length,20);assert.equal(photographs.filter(photo=>photo.kind==='maker-installation').length,13);assert.equal(photographs.filter(photo=>photo.kind==='craft-example').length,7);
    assert.ok(photographs.every(photo=>photo.loaded&&photo.caption.length>30&&photo.captionSize===15),'all real card photos load with readable truthful captions');
    assert.equal(await page.$$eval('.maker-date',elements=>elements.every(element=>parseFloat(getComputedStyle(element).fontSize)===15)),true,'source-check metadata uses the shared detail role');
   }
   if(output&&['/makers/','/buying-routes/','/makers/designers-guild/'].includes(path))await page.screenshot({path:`${output}/${path.replaceAll('/','-')}-${width}.png`,fullPage:false});
  }
 }
 await page.goto(server.origin+'/makers/');await page.type('[data-directory-search]','Calico');assert.equal(await page.$$eval('.maker-card',es=>es.filter(e=>!e.hidden).length),1);
 await page.goto(server.origin+'/buying-routes/?maker=designers-guild');assert.equal(await page.$$eval('.maker-route',es=>es.filter(e=>!e.hidden).length),0);
 await page.select('[data-directory-maker]','arte');assert.equal(await page.$$eval('.maker-route',es=>es.filter(e=>!e.hidden).length),2);
 await page.select('[data-directory-maker]','zoffany');assert.equal(await page.$$eval('.maker-route',es=>es.filter(e=>!e.hidden).length),1);
 assert.deepEqual(await page.$$eval('.maker-route-group',gs=>gs.filter(g=>!g.hidden).map(g=>[g.dataset.maker,g.querySelector('details').open])),[['zoffany',true]],'the filter shows and opens only the chosen maker group');
 const routeId=data.makers.find(m=>m.slug==='vescom').routes[0].id;await page.goto(server.origin+'/buying-routes/#'+routeId);
 assert.equal(await page.$eval('#routes-vescom > details',e=>e.open),true,'a link to one route card opens its maker group');
 assert.equal(await page.$eval('#routes-arte > details',e=>e.open),false);
 await page.setJavaScriptEnabled(false);await page.goto(server.origin+'/buying-routes/');assert.equal((await page.$$('.maker-route')).length,42);
 // Routes sit in one closed group per maker: without JavaScript a reader opens the group, then the card's terms.
 assert.equal((await page.$$('.maker-route-group')).length,data.makers.filter(m=>m.routes.length).length);assert.equal(await page.$$eval('.maker-route-group > details',ds=>ds.every(d=>!d.open)),true);
 await page.click('.maker-route-group > details > summary');assert.equal(await page.$eval('.maker-route-group > details',e=>e.open),true);
 await page.click('.maker-route summary');assert.equal(await page.$eval('.maker-route details',e=>e.open),true);
 await page.goto(server.origin+'/makers/');assert.equal((await page.$$('.maker-card')).length,20);assert.deepEqual(errors,[]);
 if(output)writeFileSync(`${output}/verification.json`,JSON.stringify({cases:report.length,errors,report},null,2));
 console.log(`Makers review: ${report.length} responsive cases; filters, exclusions and no-JS passed.`);
}finally{await browser.close();await server.close();}
