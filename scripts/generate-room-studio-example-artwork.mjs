/** Original vector wallpaper studies, authored for Room Studio examples.
 * No supplier artwork, product photographs, fonts or external assets are used.
 * SVG source and lossless embedded PNGs are deterministic. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
const folder=resolve('src/room-studio/example-artwork'),size=1536;
const generated=resolve('src/room-studio/example-artwork.generated.ts');
const check=process.argv.includes('--check');
function paper(seed,width,height,colour,opacity=.11){let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};let marks='';for(let i=0;i<1050;i++){const x=random()*width,y=random()*height,length=.35+random()*1.6;marks+=`<path d="M${x.toFixed(2)} ${y.toFixed(2)}l${length.toFixed(2)} ${(.2+random()*.55).toFixed(2)}"/>`;}return `<g fill="none" stroke="${colour}" stroke-width=".25" opacity="${opacity}">${marks}</g>`;}
function document(id,width,height,body){return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><title>Original illustrative ${id} wallpaper study</title>${body}</svg>\n`;}
function willow(){let leaf='';for(let i=0;i<6;i++){const y=111-i*35,reach=39+(i%3)*6;for(const side of [-1,1]){const a=side*5,b=side*reach,tip=side*(reach+16);leaf+=`<path d="M${a} ${y}C${b} ${y-7} ${tip} ${y-35} ${tip} ${y-42}C${side*34} ${y-39} ${side*12} ${y-21} ${a} ${y}Z" fill="${i%2?'#526a58':'#385447'}"/><path d="M${a} ${y}Q${side*30} ${y-18} ${tip} ${y-42}" stroke="#b8bd9e" stroke-width=".7" fill="none"/>`;}}
const frond=`<g id="frond"><path d="M0 145C-12 42 13-58 0-137" stroke="#4c5e49" stroke-width="2.5" fill="none"/>${leaf}<path d="M0-117C-17-132-11-151 0-164C12-148 15-132 0-117Z" fill="#385447"/><path d="M0 131Q-47 120-64 91M0 132Q42 119 61 94" stroke="#9d8354" stroke-width="1.2" fill="none"/></g>`;
let body=`<rect width="640" height="640" fill="#e9e4d6"/><defs>${frond}</defs><g fill="none" stroke="#b0af8e" stroke-width="1" opacity=".48">`;
for(let i=-2;i<4;i++)body+=`<path d="M${i*320} 0l640 640M${i*320} 0l-640 640"/>`;body+='</g>';
for(const [x,y,rotation] of [[160,170,-7],[480,170,7],[160,490,7],[480,490,-7]])body+=`<use href="#frond" transform="translate(${x} ${y}) rotate(${rotation})"/>`;
body+=`<g fill="#9d8354" opacity=".8">${[[0,160],[320,160],[640,160],[0,480],[320,480],[640,480]].map(([x,y])=>`<path d="M${x} ${y-8}l5 8-5 8-5-8Z"/>`).join('')}</g>`;
return document('Willow lattice',640,640,body+paper(7231,640,640,'#746c55'));}
function ochre(){let body='<rect width="530" height="640" fill="#f0e3ca"/><path d="M265 49C327 133 420 220 443 320C418 421 325 507 265 591C204 507 111 421 87 320C110 220 203 133 265 49Z" fill="#b98143"/><path d="M265 78C317 151 391 226 414 320C392 412 315 490 265 562C215 490 139 412 116 320C139 226 212 151 265 78Z" fill="#ebd5ad"/>';
for(let inset=0;inset<4;inset++){const rx=118-inset*23,ry=209-inset*35;body+=`<path d="M265 ${320-ry}Q${265+rx} 217 ${265+rx} 320Q${265+rx} 425 265 ${320+ry}Q${265-rx} 425 ${265-rx} 320Q${265-rx} 217 265 ${320-ry}Z" fill="${inset%2?'#d2a262':'#a85c35'}" stroke="#f0e3ca" stroke-width="3"/>`;}
body+='<path d="M265 260l34 60-34 60-34-60Z" fill="#f0e3ca"/><path d="M265 278l22 42-22 42-22-42Z" fill="#813f2d"/>';
for(const side of [-1,1])for(let i=0;i<9;i++){const y=120+i*50,x=side<0?35:495;body+=`<path d="M${x} ${y-13}q${side*17} 12 0 26q${side*-17}-13 0-26Z" fill="${i%2?'#8c4a31':'#bd8848'}"/><path d="M${x} ${y-9}v18" stroke="#efdcbc" stroke-width=".8"/>`;}
for(const y of [0,640])body+=`<g transform="translate(265 ${y})"><path d="M-43 0Q0-67 43 0Q0 67-43 0Z" fill="#9e5c34"/><path d="M-26 0Q0-43 26 0Q0 43-26 0Z" fill="#f0e3ca"/><circle r="8" fill="#bd8848"/></g>`;
return document('Ochre cadence',530,640,body+paper(18027,530,640,'#875e3c',.13));}
function indigo(){let fan='<g id="fan"><path d="M-300 0A300 300 0 0 1 300 0Z" fill="#233d52"/>';
for(let radius=45;radius<=292;radius+=24)fan+=`<path d="M${-radius} 0A${radius} ${radius} 0 0 1 ${radius} 0" stroke="${radius%48===45?'#bda16d':'#e6d6b3'}" stroke-width="${radius%48===45?1.7:1}" fill="none"/>`;
for(let i=0;i<=12;i++){const a=Math.PI+i*Math.PI/12,x=Math.cos(a)*292,y=Math.sin(a)*292;fan+=`<path d="M0 0L${x.toFixed(3)} ${y.toFixed(3)}" stroke="#d8c497" stroke-width=".9" fill="none"/>`;}
fan+='<path d="M-300 0A300 300 0 0 1 300 0" fill="none" stroke="#d5bd89" stroke-width="3"/><path d="M-28 0A28 28 0 0 1 28 0Z" fill="#b99961"/></g>';
let body=`<rect width="600" height="600" fill="#1a3043"/><defs>${fan}</defs>`;
for(const [x,y] of [[0,0],[600,0],[300,300],[0,600],[600,600]])body+=`<use href="#fan" transform="translate(${x} ${y})"/>`;
return document('Indigo arcade',600,600,body+paper(64191,600,600,'#e1d4b4',.075));}
const sources={'willow-chimney':willow(),'ochre-lshape':ochre(),'indigo-bay':indigo()},assets={};
for(const [id,svg] of Object.entries(sources)){const png=await sharp(Buffer.from(svg)).png({compressionLevel:9,adaptiveFiltering:false,palette:false}).toBuffer();const metadata=await sharp(png).metadata();assert.equal(metadata.width,size);assert.equal(metadata.height,size);assets[id]={mime:'image/png',widthPx:size,heightPx:size,sha256:createHash('sha256').update(png).digest('hex'),dataUrl:'data:image/png;base64,'+png.toString('base64')};const sourcePath=resolve(folder,id+'.svg');if(check)assert.equal(await readFile(sourcePath,'utf8'),svg,`${id} SVG differs from its generator`);else await writeFile(sourcePath,svg);console.log(`${id}: ${size}×${size} lossless PNG, ${png.length.toLocaleString('en-GB')} bytes`);}
const module='// Generated by scripts/generate-room-studio-example-artwork.mjs.\n// Original illustrative art only; no supplier image or completed-project evidence.\nexport const exampleArtwork = '+JSON.stringify(assets,null,2)+' as const;\n';
if(check)assert.equal(await readFile(generated,'utf8'),module,'Embedded original artwork needs regeneration');else await writeFile(generated,module);
