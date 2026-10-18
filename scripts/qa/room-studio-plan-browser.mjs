import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { serve, launchBrowser } from '../visual-browser.mjs';
// Original rights-cleared engineering fixtures, generated without customer files.
const folder=resolve('.tmp/room-studio-plans');await mkdir(folder,{recursive:true});
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700"><rect width="1000" height="700" fill="white"/><path d="M100 100H900V600H100Z" fill="none" stroke="#222" stroke-width="5"/><text x="450" y="70" font-size="28">4000 mm</text><text x="400" y="650" font-size="20">Original test room, not a customer drawing</text></svg>';
await sharp(Buffer.from(svg)).png().toFile(`${folder}/plan.png`);
await sharp(Buffer.from(svg)).jpeg().toFile(`${folder}/plan.jpg`);
function pdf(){const contents='0.8 w 100 100 800 500 re S BT /F1 24 Tf 420 640 Td (4000 mm) Tj ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 700] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${contents.length} >>\nstream\n${contents}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 1000] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>'];let text='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(text);text+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return text;}
await writeFile(`${folder}/plan.pdf`,pdf());
const server=process.env.ROOM_STUDIO_ORIGIN?{origin:process.env.ROOM_STUDIO_ORIGIN,close:async()=>{}}:await serve(process.env.ROOM_STUDIO_DIST||'dist'),browser=await launchBrowser();const errors=[];
async function click(p,text){const h=await p.evaluateHandle(text=>[...document.querySelectorAll('.room-studio button')].find(b=>b.textContent.trim()===text),text);assert(h.asElement(),text);await h.asElement().evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await h.asElement().click();await h.dispose();}
async function field(p,text,value){const h=await p.evaluateHandle(text=>[...document.querySelectorAll('.studio-import label')].find(e=>e.querySelector('span')?.textContent.trim().replace(/\s+(mm|px)$/,'')===text)?.querySelector('input'),text);assert(h.asElement(),text);await h.asElement().asLocator().fill(String(value));await h.asElement().press('Tab');await p.evaluate(()=>new Promise(requestAnimationFrame));await h.dispose();}
async function point(p,x,y){await field(p,'Point X',x);await field(p,'Point Y',y);await click(p,'Add point');await p.evaluate(()=>new Promise(requestAnimationFrame));}
try{
  for(const ext of ['png','jpg','pdf']){const context=await browser.createBrowserContext();const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',msg=>{if(msg.type()==='error')console.error(msg.text());});await p.setViewport({width:1440,height:1000});await p.goto(server.origin+'/room-studio/',{waitUntil:'networkidle0'});await p.waitForSelector('[data-studio-ready=true]');await click(p,'Floor plan');await (await p.$('.studio-import input[type=file]')).uploadFile(`${folder}/plan.${ext}`);await p.waitForSelector('.studio-trace-viewport svg image',{timeout:30000}).catch(async e=>{console.error(ext,await p.$eval('.studio-import',e=>e.innerText),errors);throw e;});await p.waitForFunction(()=>!document.querySelector('.studio-import input[type=file]').disabled);
    if(ext==='pdf'){await p.select('.studio-import select','2');await p.waitForFunction(()=>document.querySelector('.studio-trace-viewport svg').viewBox.baseVal.height>document.querySelector('.studio-trace-viewport svg').viewBox.baseVal.width);}
    const dim=await p.$eval('.studio-trace-viewport svg',s=>({w:s.viewBox.baseVal.width,h:s.viewBox.baseVal.height}));
    const details=await p.$('.studio-import details');await details.$eval('summary',e=>e.click());await point(p,0,0);await point(p,dim.w,0);await field(p,'Known marked length',5000);await field(p,'Measured ceiling height',2700);await click(p,'2. Trace room');
    await point(p,0,0);await point(p,dim.w,0);await point(p,dim.w,dim.h);await point(p,0,dim.h);await click(p,'Use this room outline');await p.waitForFunction(()=>!document.querySelector('.studio-import'));await p.waitForFunction(()=>document.querySelector('.studio-plan')?.textContent.includes('5.00 m'));
    assert(await p.$eval('.studio-plan',e=>e.textContent.includes('2700 mm ceiling')));assert.equal(await p.$('.studio-error'),null);assert(await p.$eval('.studio-draft-note',e=>e.textContent.includes('Draft dimensions')));
    await context.close();
  }
  assert.deepEqual(errors,[]);console.log('Room Studio local PNG, JPEG and PDF preview, keyboard calibration, tracing and provisional confirmation journeys passed.');
}finally{await browser.close();await server.close();}
