import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';

test('editorial homepage serves the real room first, with matching preload and photograph credit', async()=>{
 const html=await readFile('dist/index.html','utf8');
 const hero=JSON.parse(await readFile('src/content/hero.json','utf8')) as {sources:{src:string;width:number}[];fallback:string};
 assert.match(html,/fetchpriority="high"/);
 assert.ok(html.includes(`href="${hero.sources[1].src}"`));
 for(const source of hero.sources){assert.ok(html.includes(source.src));assert.ok((await stat(`dist${source.src}`)).size>20000);}
 assert.match(html,/Venue photograph · Raffles London at The OWO \(official\)/);
 assert.match(html,/Our photograph of the hotel exterior/);
 assert.match(html,/href="\/wallcovering-installation-ai-crawler\/"/);
 assert.match(html,/<nav[^>]+aria-label="Primary"[\s\S]*?AI Crawler/);
 assert.match(html,/prefers-reduced-motion/);
});

test('every homepage local link and image resolves in the production output',async()=>{
 const html=await readFile('dist/index.html','utf8');
 const urls=[...html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)].map(m=>m[1]);
 const errors:string[]=[];
 for(const url of new Set(urls)){try{const file=`dist${url}${url.endsWith('/')?'index.html':''}`;await stat(file);}catch{errors.push(url);}}
 assert.deepEqual(errors,[]);
});
