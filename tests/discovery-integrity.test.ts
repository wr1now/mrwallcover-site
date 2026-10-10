import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function htmlFiles(directory: string): Promise<string[]> {
 const entries=await readdir(directory,{withFileTypes:true});
 return (await Promise.all(entries.map(entry => entry.isDirectory() ? htmlFiles(path.join(directory,entry.name)) : entry.name.endsWith('.html') ? [path.join(directory,entry.name)] : []))).flat();
}
const files=await htmlFiles('dist');
const pages=new Map(await Promise.all(files.map(async file => [file,await readFile(file,'utf8')] as const)));

test('every content page advertises the same readable AI resources',async()=>{
 for(const [file,html] of pages){
  if(/http-equiv="refresh"/i.test(html))continue; // Legacy redirects only forward to the canonical content page.
  for(const [type,href] of [['text/plain','/llms.txt'],['application/json','/ai/business.json'],['application/json','/ai/decision-guide.json']]){
   assert.ok(html.includes(`rel="describedby" type="${type}" href="${href}"`),`${file}: missing ${href}`);
  }
 }
 for(const file of ['business','projects','decision-guide']){
  const record=JSON.parse(await readFile(`dist/ai/${file}.json`,'utf8')) as {schemaVersion:string;resourceReviewed:string};
  assert.equal(record.schemaVersion,'1.1');assert.equal(record.resourceReviewed,'2026-10-10');
 }
});

test('all local page links, downloads and fragments resolve in the release',async()=>{
 const problems:string[]=[];
 for(const [file,html] of pages){
  const pageUrl=new URL(file.replace(/^dist\//,'').replace(/index\.html$/,''),'https://www.mrwallcover.com/');
  for(const [,raw] of html.matchAll(/href="([^"\s]+)"/g)){
   if(!raw.startsWith('/')&&!raw.startsWith('#'))continue;
   const url=new URL(raw.replaceAll('&amp;','&'),pageUrl);
   if(url.origin!==pageUrl.origin)continue;
   const target=path.join('dist',decodeURIComponent(url.pathname),url.pathname.endsWith('/')?'index.html':'');
   try{assert.ok((await stat(target)).isFile());}catch{problems.push(`${file}: missing ${raw}`);continue;}
   if(url.hash&&target.endsWith('.html')){
    const text=pages.get(target)??await readFile(target,'utf8');
    const fragment=decodeURIComponent(url.hash.slice(1));
    if(!text.includes(`id="${fragment}"`)&&!text.includes(`name="${fragment}"`))problems.push(`${file}: missing fragment ${raw}`);
   }
  }
 }
 assert.deepEqual(problems,[]);
});
