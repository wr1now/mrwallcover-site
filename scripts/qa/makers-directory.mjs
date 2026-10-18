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
   const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,h1:document.querySelectorAll('main h1').length,wideReading:[...document.querySelectorAll('.maker-intro p,.maker-section>p')].filter(e=>e.getBoundingClientRect().width>44*parseFloat(getComputedStyle(document.documentElement).fontSize)+1).length,small:[...document.querySelectorAll('main .maker-card p:not(.eyebrow), main .maker-route p:not(.eyebrow), main .maker-route dd, main .lede')].filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).length}));
   assert.equal(result.overflow,false,path+' '+width);assert.equal(result.h1,1);assert.equal(result.small,0,path+' text floor');assert.equal(result.wideReading,0,path+' reading measure');report.push({path,width,...result});
   if(output&&['/makers/','/buying-routes/','/makers/designers-guild/'].includes(path))await page.screenshot({path:`${output}/${path.replaceAll('/','-')}-${width}.png`,fullPage:false});
  }
 }
 await page.goto(server.origin+'/makers/');await page.type('[data-directory-search]','Calico');assert.equal(await page.$$eval('.maker-card',es=>es.filter(e=>!e.hidden).length),1);
 await page.goto(server.origin+'/buying-routes/?maker=designers-guild');assert.equal(await page.$$eval('.maker-route',es=>es.filter(e=>!e.hidden).length),0);
 await page.select('[data-directory-maker]','arte');assert.equal(await page.$$eval('.maker-route',es=>es.filter(e=>!e.hidden).length),2);
 await page.select('[data-directory-maker]','zoffany');assert.equal(await page.$$eval('.maker-route',es=>es.filter(e=>!e.hidden).length),1);
 await page.setJavaScriptEnabled(false);await page.goto(server.origin+'/buying-routes/');assert.equal((await page.$$('.maker-route')).length,42);await page.click('.maker-route summary');assert.equal(await page.$eval('.maker-route details',e=>e.open),true);
 await page.goto(server.origin+'/makers/');assert.equal((await page.$$('.maker-card')).length,20);assert.deepEqual(errors,[]);
 if(output)writeFileSync(`${output}/verification.json`,JSON.stringify({cases:report.length,errors,report},null,2));
 console.log(`Makers review: ${report.length} responsive cases; filters, exclusions and no-JS passed.`);
}finally{await browser.close();await server.close();}
