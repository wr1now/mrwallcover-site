import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const data=JSON.parse(readFileSync('src/data/makers-directory.json','utf8'));
const routes=data.makers.flatMap((m:any)=>m.routes);
const read=(p:string)=>readFileSync(p,'utf8');
test('curated draft has 20 profiles, 42 routes and no publication sign-off',()=>{
 assert.equal(data.makers.length,20);assert.equal(routes.length,42);assert.equal(new Set(routes.map((r:any)=>r.id)).size,42);
 assert.deepEqual(data.publication,{approved:false,approved_by:null,approved_on:null});
 for(const m of data.makers){assert.ok(m.summary.length>=100);assert.ok(m.sources.length);for(const s of m.sources){assert.match(s.url,/^https:\/\//);assert.match(s.checked_on,/^2026-10-1[78]$/);}}
 for(const r of routes){assert.match(r.url,/^https:\/\//);assert.match(r.checked_on,/^2026-10-1[78]$/);assert.ok(r.scope);}
 assert.equal(data.makers.find((m:any)=>m.slug==='designers-guild').routes.length,0);
 assert.equal(data.makers.find((m:any)=>m.slug==='zoffany').routes.length,1);
});
test('production omits draft routes, links, bundles and all public text projections',()=>{
 assert.equal(existsSync('dist/makers'),false);assert.equal(existsSync('dist/buying-routes'),false);
 function walk(dir:string){for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(html|json|md|txt|xml|js)$/.test(p)){const s=read(p);assert.ok(!s.includes('/makers/')&&!s.includes('/buying-routes/'),p+' leaks a draft directory link');assert.ok(!s.includes('brand_stock_information_enquiry'),p+' leaks draft data');}}}walk('dist');
});
test('review pages expose dated sources, shared chrome, noindex and no withheld purchase routes',()=>{
 const pages=['makers/index.html','buying-routes/index.html',...data.makers.map((m:any)=>`makers/${m.slug}/index.html`)];
 for(const p of pages){const html=read('dist-review/'+p);assert.equal((html.match(/<h1\b/g)||[]).length,1,p);assert.match(html,/noindex/);assert.match(html,/Draft for owner review/);assert.match(html,/BreadcrumbList/);assert.ok(!html.includes('designers-guild-webshop-lead'));assert.ok(!html.includes('zoffany-consumer'));assert.ok(!html.includes('/primevere-sage-wallpaper/'));}
 const index=read('dist-review/buying-routes/index.html');assert.equal((index.match(/class="maker-route"/g)||[]).length,42);
 assert.ok(!read('dist-review/makers/designers-guild/index.html').includes('Request a Panel Sample'));
 assert.ok(!read('dist-review/makers/zoffany/index.html').includes('/t-cs'));
});
