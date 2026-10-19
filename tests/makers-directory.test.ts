import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync('src/data/makers-directory.json','utf8'));
const routes=data.makers.flatMap((m:any)=>m.routes);
const read=(p:string)=>readFileSync(p,'utf8');
const plain=(html:string)=>html.replace(/<[^>]+>/g,' ').replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"').replace(/\s+/g,' ').trim();
const normalize=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
test('approved directory has 20 profiles, 42 routes and owner copy sign-off',()=>{
 assert.equal(data.makers.length,20);assert.equal(routes.length,42);assert.equal(new Set(routes.map((r:any)=>r.id)).size,42);
 assert.deepEqual(data.publication,{approved:true,approved_by:'Dorin Burcus (owner copy approval)',approved_on:'2026-10-18'});
 for(const m of data.makers){assert.ok(m.summary.length>=100);assert.ok(m.sources.length);for(const s of m.sources){assert.match(s.url,/^https:\/\//);assert.match(s.checked_on,/^2026-10-1[78]$/);}}
 for(const r of routes){assert.match(r.url,/^https:\/\//);assert.match(r.checked_on,/^2026-10-1[78]$/);assert.ok(r.scope);}
 assert.equal(data.makers.find((m:any)=>m.slug==='designers-guild').routes.length,0);
 assert.equal(data.makers.find((m:any)=>m.slug==='zoffany').routes.length,1);
});
test('production publishes approved routes, indexable pages and crawler projections',()=>{
 const pages=['makers/index.html','buying-routes/index.html',...data.makers.map((m:any)=>`makers/${m.slug}/index.html`)];
 const sitemap=read('dist/sitemap-0.xml');
 for(const p of pages){const html=read('dist/'+p);assert.equal((html.match(/<h1\b/g)||[]).length,1,p);assert.ok(!html.includes('noindex'),p);assert.match(html,/BreadcrumbList/);assert.ok(!html.includes('designers-guild-webshop-lead'));assert.ok(!html.includes('zoffany-consumer'));assert.ok(sitemap.includes('/'+p.replace('index.html','')),p);}
 assert.equal((read('dist/buying-routes/index.html').match(/class="maker-route"/g)||[]).length,42);
 assert.ok(read('dist/advice/index.html').includes('/makers/'));
 assert.ok(read('dist/where-to-buy/index.html').includes('/buying-routes/'));
});
test('review pages expose dated sources, shared chrome, noindex and no withheld purchase routes',()=>{
 const pages=['makers/index.html','buying-routes/index.html',...data.makers.map((m:any)=>`makers/${m.slug}/index.html`)];
 for(const p of pages){const html=read('dist-review/'+p);assert.equal((html.match(/<h1\b/g)||[]).length,1,p);assert.match(html,/noindex/);assert.match(html,/Editorial review preview/);assert.match(html,/BreadcrumbList/);assert.ok(!html.includes('designers-guild-webshop-lead'));assert.ok(!html.includes('zoffany-consumer'));assert.ok(!html.includes('/primevere-sage-wallpaper/'));}
 const index=read('dist-review/buying-routes/index.html');assert.equal((index.match(/class="maker-route"/g)||[]).length,42);
 assert.ok(!read('dist-review/makers/designers-guild/index.html').includes('Request a Panel Sample'));
 assert.ok(!read('dist-review/makers/zoffany/index.html').includes('/t-cs'));
});

test('every maker card has reviewed registered photography with a truthful direct or contextual attribution',()=>{
 const photography=JSON.parse(read('src/data/maker-card-photography.json'));
 const alts=JSON.parse(read('src/content/alts.json'));
 const sizes=JSON.parse(read('src/content/sizes.json'));
 const installed=JSON.parse(read('src/content/makers-installed.json')).items;
 assert.deepEqual(Object.keys(photography.entries).sort(),data.makers.map((maker:any)=>maker.slug).sort(),'new directory cards require a reviewed photograph rather than an inferred maker match');
 const photos=Object.values(photography.entries) as any[];
 assert.equal(photos.filter(photo=>photo.kind==='maker-installation').length,13);
 assert.equal(photos.filter(photo=>photo.kind==='craft-example').length,7);
 assert.equal(new Set(photos.map(photo=>photo.imageId)).size,20,'cards show distinct frames from actual work');
 assert.equal(photography.entries['morris-and-co'].kind,'craft-example','uncertain Morris photo identity must never become a direct installation claim');
 const html=read('dist/makers/index.html');
 const cards=html.match(/<article\b[^>]*class="[^"]*\bmaker-card\b[^"]*"[^>]*>[\s\S]*?<\/article>/g)??[];
 assert.equal(cards.length,20);
 assert.ok(plain(html).includes('“Craft example” names a different maker and project we have worked on; it illustrates the craft and is not an installation record for the directory brand.'),'the directory explains the distinction before the cards');
 for(const maker of data.makers){
  const photo=photography.entries[maker.slug];
  const label=`${maker.slug}: ${photo.imageId}`;
  const card=cards.find(card=>card.includes(`href="/makers/${maker.slug}/"`));assert.ok(card,label);
  const figure=card.match(/<figure\b[^>]*data-maker-photo="[^"]+"[^>]*>[\s\S]*?<\/figure>/)?.[0];assert.ok(figure,label);
  const image=figure.match(/<img\b[^>]*>/)?.[0]??'';
  assert.match(figure,new RegExp(`data-maker-photo="${photo.kind}"`),label);
  assert.match(image,/loading="lazy"/,label);assert.match(image,/\bwidth="\d+"/,label);assert.match(image,/\bheight="\d+"/,label);
  assert.equal((figure.match(/<source\b[^>]*srcset=/g)??[]).length,2,`${label}: responsive Picture sources`);
  assert.ok(alts[photo.imageId]?.alt?.length>15,label);assert.match(alts[photo.imageId].manifestNote,/own (?:site )?photo/i,label);
  assert.ok(sizes[photo.imageId]?.width>0&&sizes[photo.imageId]?.height>0,label);
  assert.equal(plain(image.match(/\balt="([^"]+)"/)?.[1]??''),alts[photo.imageId].alt,label);
  const caption=plain(figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/)?.[1]??'');
  assert.ok(caption.includes(photo.caption)&&caption.includes(photo.credit),`${label}: visible evidence and credit`);
  if(photo.stageLabel)assert.ok(caption.includes(photo.stageLabel),`${label}: work-stage label remains visible`);
  assert.ok(figure.includes(`href="${photo.evidenceHref}"`),label);
  assert.ok(photo.sources.length>=2&&photo.sources.some((source:string)=>source===photo.evidenceHref),`${label}: public evidence provenance`);
  assert.doesNotMatch(JSON.stringify(photo),/mrwallcover-private|private exclusion|seed record|\/Users\//i,`${label}: public-safe metadata`);
  const [path,fragment]=photo.evidenceHref.split('#');
  const evidence=read('dist'+path+'index.html');
  if(fragment)assert.ok(evidence.includes(`id="${fragment}"`),`${label}: live evidence anchor`);
  const record=installed.find((item:any)=>normalize(item.brand)===normalize(photo.actualMaker));
  if(photo.kind==='maker-installation'){
   assert.ok(record,`${label}: direct maker claim has a published installation-register record`);
   assert.equal(normalize(photo.actualMaker),normalize(maker.name),`${label}: direct claims match the directory maker`);
   assert.ok(caption.startsWith('Our installation'),label);
  }else{
   assert.notEqual(normalize(photo.actualMaker),normalize(maker.name),`${label}: context is explicitly a different maker`);
   assert.ok(caption.includes('Craft example:')&&caption.includes(photo.actualMaker),`${label}: context names the actual maker visibly`);
   assert.match(photo.evidenceNote,/not an installation or affiliation claim/);
  }
  if(!record||record.image!==photo.imageId){
   assert.match(path,/^\/projects\//,`${label}: an alternate frame has a published project record`);
   const source=read(`src/content/case-studies/${path.split('/')[2]}.md`);
   assert.ok(source.includes(photo.imageId)&&normalize(source).includes(normalize(photo.actualMaker)),`${label}: the linked case records the frame and actual maker`);
  }
 }
});
