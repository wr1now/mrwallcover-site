import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp, mkdir, writeFile, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {publishedHomeInventory, verifyHomePreservation} from '../scripts/home-preservation.mjs';
const faq={ '@context':'https://schema.org', '@type':'FAQPage', mainEntity:[{'@type':'Question',name:'Who returns for aftercare?',acceptedAnswer:{'@type':'Answer',text:'We return to inspect the installed wallcovering.'}}]};
const content='<h1>A genuine project</h1><p>The complete account stays available to visitors.</p><a href="/projects/example/">Project evidence</a><img src="/media/installed-800.webp" alt="Our completed scenic wallcovering." /><video src="/media/work.mp4"></video><h2>Who returns for aftercare?</h2><p>We return to inspect the installed wallcovering.</p>';
const document=(route:string,main:string,noindex=false)=>`<!doctype html><html><head><title>Preservation fixture</title><link rel="canonical" href="https://www.mrwallcover.com${route}">${noindex?'<meta name="robots" content="noindex">':''}<script type="application/ld+json">${JSON.stringify(faq)}</script></head><body><main id="main">${main}</main></body></html>`;

test('homepage relocation must survive in actual indexable main content with its real evidence',async()=>{
 const dist=await mkdtemp(path.join(tmpdir(),'mw-home-preservation-'));
 const inventory=publishedHomeInventory(document('/',content),'published-fixture');
 try {
  await mkdir(path.join(dist,'practice'));
  await writeFile(path.join(dist,'index.html'),document('/','<h1>A concise introduction</h1>'));
  await writeFile(path.join(dist,'practice/index.html'),document('/practice/',content.replace('installed-800.webp','installed-1600.webp')));
  assert.equal((await verifyHomePreservation(dist,inventory)).passed,true,'a responsive image equivalent and moved prose/links/film/FAQ are preserved');
  await writeFile(path.join(dist,'practice/index.html'),document('/practice/','<h1>Lost content</h1>'));
  await writeFile(path.join(dist,'archive.json'),JSON.stringify(inventory));
  const missing=await verifyHomePreservation(dist,inventory);
  assert.equal(missing.passed,false,'a JSON inventory cannot stand in for visitor-facing content');
  assert.deepEqual(new Set(missing.missing.map((item:any)=>item.kind)),new Set(['authored block','public link','real photograph','film','FAQ pair']));
  await writeFile(path.join(dist,'practice/index.html'),document('/practice/',content,true));
  assert.equal((await verifyHomePreservation(dist,inventory)).passed,false,'a noindex archive cannot clear publication preservation');
 } finally {await rm(dist,{recursive:true,force:true});}
});

test('the complete previously published home inventory remains available on the built site',async()=>{
 const inventory=JSON.parse(await readFile('scripts/home-content-preservation-2026-10-19.json','utf8'));
 const result=await verifyHomePreservation('dist',inventory);
 assert.deepEqual(result.missing,[]);
 assert.equal(result.passed,true);
 assert.equal(result.counts.photographs,46);
 assert.equal(result.counts.films,3);
 assert.equal(result.counts.faqPairs,6);
});
