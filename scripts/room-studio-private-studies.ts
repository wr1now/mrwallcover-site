/** Local manufacturer studies. Source files and generated pixels stay in .tmp.
 * This does not promote reference photographs into calibrated product assets.
 * Input: a private JSON array of {id,assetPath,sourceUrl,coverage?} records.
 */
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { createManufacturerPreviewProject } from '../src/room-studio/manufacturer-preview.ts';
import type { ManufacturerSelectionId } from '../src/room-studio/manufacturer-selections.ts';
import { compileRoom } from '../src/room-studio/geometry.ts';
import { validateProject } from '../src/room-studio/validation.ts';
import { roomStudioExamples } from '../src/room-studio/example-metadata.ts';

const args=process.argv.slice(2),root=await realpath('.');
function option(flag:string,fallback?:string){const i=args.indexOf(flag),value=i<0?fallback:args[i+1];if(value?.startsWith('--'))throw new Error(`Supply ${flag}.`);return value;}
const input=option('--input');
if(!input||!args.includes('--private-concept'))throw new Error('Supply --input private-manifest.json --private-concept. These studies do not establish image permissions, artwork scale or physical material fidelity.');
if(args.includes('--proof')&&args.includes('--build-preview'))throw new Error('A proof cannot build the production preview. Render all three production packages without --proof first.');
const output=resolve(option('--output-dir','.tmp/room-studio-private-studies')!);
const privateRoot=resolve('.tmp')+sep;
if(!output.startsWith(privateRoot))throw new Error('Private study output must stay inside ignored .tmp/.');
await mkdir(output,{recursive:true});
if(!(await realpath(output)).startsWith(privateRoot))throw new Error('Private output cannot be a link outside .tmp/.');
const records=JSON.parse(await readFile(resolve(input),'utf8')) as {id:ManufacturerSelectionId;assetPath:string;sourceUrl:string;coverage?:{widthMm:number;heightMm:number;status:'assumed'|'verified-full-image';evidence:string}}[];
const ids=['degournay-plum-blossom','phillip-jeffries-3163','arte-caisson-61533'];
if(records.length!==3||ids.some(id=>records.filter(row=>row.id===id).length!==1))throw new Error('Supply the three selected manufacturer records exactly once.');
const hash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
async function command(executable:string,argv:string[],cwd=root,logPath?:string){
  const log=logPath?createWriteStream(logPath,{flags:'w'}):null;
  try{await new Promise<void>((accept,reject)=>{const child=spawn(executable,argv,{cwd,stdio:log?['ignore','pipe','pipe']:'inherit',env:{...process.env,PUBLIC_ROOM_STUDIO_CLOUD_ENABLED:'false',MW_CONTENT_PREVIEW:'1'}});if(log){child.stdout?.pipe(log,{end:false});child.stderr?.pipe(log,{end:false});}child.once('error',reject);child.once('close',code=>code===0?accept():reject(new Error(`${basename(executable)} exited ${code}; ${logPath??'see output'}`)));});}
  finally{if(log)await new Promise<void>(done=>log.end(done));}
}
async function promotePrivateSite(stagedSite:string,site:string,stagedPreview:string,previewPath:string){
  const previousSite=`${stagedSite}-previous`;let previousMoved=false,nextMoved=false;
  try{await rename(site,previousSite);previousMoved=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  try{
    await rename(stagedSite,site);nextMoved=true;
    await rename(stagedPreview,previewPath);
  }catch(error){
    if(nextMoved)await rename(site,stagedSite);
    if(previousMoved)await rename(previousSite,site);
    throw error;
  }
  if(previousMoved)await rm(previousSite,{recursive:true,force:true});
}
const studies=[];
const activeRecords=records.filter(record=>!option('--id')||record.id===option('--id'));
if(!activeRecords.length)throw new Error('Unknown private study id.');
for(const record of activeRecords){
  const assetPath=await realpath(resolve(record.assetPath));
  if(!assetPath.startsWith(privateRoot))throw new Error('Keep manufacturer reference pixels inside ignored .tmp/.');
  const bytes=await readFile(assetPath),metadata=await sharp(bytes).metadata();
  const mime=metadata.format==='jpeg'?'image/jpeg':metadata.format==='png'?'image/png':metadata.format==='webp'?'image/webp':null;
  if(!mime||!metadata.width||!metadata.height||bytes.length>20*1024*1024||metadata.width*metadata.height>25000000)throw new Error('Choose an accepted reference image within source-upload limits.');
  const study=createManufacturerPreviewProject(record.id,{texture:{id:`private-${record.id}`,mime,widthPx:metadata.width,heightPx:metadata.height,sha256:hash(bytes),dataUrl:`data:${mime};base64,${bytes.toString('base64')}`},coverage:record.coverage});
  const index=ids.indexOf(record.id),example=roomStudioExamples[index],directory=join(output,record.id);await mkdir(directory,{recursive:true});
  const identity=(project:typeof study.project)=>JSON.stringify({...project,id:undefined,updatedAt:undefined});
  try{const previous=JSON.parse(await readFile(join(directory,'room.room.json'),'utf8'));if(identity(previous)===identity(study.project)){study.project.id=previous.id;study.project.updatedAt=previous.updatedAt;}}catch{}
  const issues=validateProject(study.project);if(issues.length)throw new Error(JSON.stringify(issues));
  await writeFile(join(directory,'room.room.json'),JSON.stringify(study.project));
  const revision={id:`private-${record.id}-revision`,projectId:study.project.id,number:study.project.revision,createdAt:study.project.updatedAt,project:study.project};
  const compiled=compileRoom(revision),packagePath=join(directory,'render-package.json');
  await writeFile(packagePath,JSON.stringify(compiled));
  await writeFile(join(directory,'study.json'),JSON.stringify({...study,project:undefined,sourceUrl:record.sourceUrl,sourceSha256:hash(bytes),sourcePixels:[metadata.width,metadata.height],meshUvSha256:hash(JSON.stringify(compiled.meshes)),publication:'Private reference study only. No website/image reuse permission, exact source-image scale, metallic BRDF or measured relief established.'},null,2));
  studies.push({...study,exampleId:example.id,record,directory,pixels:{width:metadata.width,height:metadata.height}});
  console.log(`${record.id}: ${compiled.meshes.length} shared meshes; ${metadata.width}×${metadata.height} reference pixels; ${study.assumptions.length} explicit assumptions.`);
  if(args.includes('--render')){
    const proof=args.includes('--proof'),imageDirectory=join(directory,proof?'proof-images':'images');
    await command(option('--blender',process.env.BLENDER_BIN||'blender')!,['-b','--python-exit-code','1','--python',join(root,'workers/room_studio/render.py'),'--','--package',packagePath,'--output-dir',imageDirectory,'--quality',proof?'fast':'production'],root,join(directory,proof?'blender-proof.log':'blender.log'));
    const manifest=JSON.parse(await readFile(join(imageDirectory,'render-manifest.json'),'utf8'));
    if(!manifest.renderedGeometryVerified||manifest.outputs.length!==3||manifest.revisionId!==revision.id)throw new Error('Private render differs from its shared compiled revision.');
    if(!proof)await writeFile(join(directory,'render-input-sha256.txt'),hash(JSON.stringify(compiled)));
    console.log(`${record.id}: verified ${proof?'draft':'full-size'} package rendered in ${manifest.elapsedSeconds}s.`);
  }
}
if(args.includes('--build-preview')&&studies.length!==3)throw new Error('Build the private preview with all three studies.');
if(!args.includes('--build-preview')){console.log(`Private projects saved in ${output}`);process.exit(0);}

// Verify every production package and its complete bitmap set before touching
// the served site. Retain the verified bytes through conversion, not fresh reads.
const preparedStudies=[];
for(const study of studies){
  const manifest=JSON.parse(await readFile(join(study.directory,'images/render-manifest.json'),'utf8'));
  const packageHash=hash(await readFile(join(study.directory,'render-package.json')));
  if((await readFile(join(study.directory,'render-input-sha256.txt'),'utf8')).trim()!==packageHash)throw new Error('Private render input changed; render this study again before building.');
  const kinds=['still-1','still-2','panorama'];
  if(!manifest.renderedGeometryVerified||manifest.quality!=='production'||manifest.revisionId!==`private-${study.record.id}-revision`||!Array.isArray(manifest.outputs)||manifest.outputs.length!==3||kinds.some(kind=>manifest.outputs.filter(image=>image.kind===kind).length!==1))throw new Error('Private preview requires a verified production render with two distinct stills and one panorama.');
  const images=[];
  for(const image of manifest.outputs){
    const expected=image.kind==='panorama'?[4096,2048]:[1920,1080];
    const bytes=await readFile(join(study.directory,'images',basename(image.path)));
    if(hash(bytes)!==image.sha256)throw new Error('Private render hash changed.');
    const metadata=await sharp(bytes).metadata();
    if(image.width!==expected[0]||image.height!==expected[1]||metadata.width!==expected[0]||metadata.height!==expected[1])throw new Error('Private output dimensions changed.');
    images.push({bytes,suffix:image.kind==='panorama'?'panorama':image.kind==='still-1'?'1':'2'});
  }
  preparedStudies.push({...study,images});
}

// A separate scratch site avoids inserting unlicensed media or reference-only
// calibration into the public application, rights registry or deployable dist.
// Build alongside the served site; a failed copy, conversion or build preserves it.
const publishedSite=join(output,'site'),site=await mkdtemp(join(output,'.site-next-')),stagedPreview=`${site}-preview.json`;
try{
const omitted=new Set(['.git','.tmp','.review-screens','node_modules','dist','dist-review','.astro','.env','.env.production','data','uploads']);
for(const entry of await readdir(root)){if(omitted.has(entry)||entry.startsWith('.env'))continue;await cp(join(root,entry),join(site,entry),{recursive:true});}
await symlink(join(root,'node_modules'),join(site,'node_modules'),'dir');
const privateBase=join(site,'src/layouts/Base.astro');
await writeFile(privateBase,(await readFile(privateBase,'utf8')).replace('Content review preview · Guide drafts await technical review.','Private material studies · Reference artwork and appearance.'));
const privateMedia=join(site,'public/media/room-studio/private-manufacturer');await mkdir(privateMedia,{recursive:true});
const cardData=[];
const labels:Record<string,string>={'degournay-plum-blossom':'de Gournay · Plum Blossom','phillip-jeffries-3163':'Phillip Jeffries · Gold on Horsehair 3163','arte-caisson-61533':'Arte · Caisson 61533'};
const specifications:Record<string,string>={'degournay-plum-blossom':'915 mm finite mural panels · Stock height 3048 mm · Design height 2150 mm','phillip-jeffries-3163':'863.6 mm trimmed width · 3352.8 mm panels · Approx. 1066.8 mm vertical repeat · No horizontal repeat','arte-caisson-61533':'1230 mm textile width · Straight 460 mm vertical repeat · 3D textile with a positive acoustic effect'};
for(const study of preparedStudies){
  for(const {bytes,suffix} of study.images){
    await sharp(bytes).webp({lossless:true,effort:4}).toFile(join(privateMedia,`${study.exampleId}-${suffix}.webp`));
    if(suffix==='1')await sharp(bytes).resize(960,540).webp({quality:92}).toFile(join(privateMedia,`${study.exampleId}-preview.webp`));
  }
  const original=roomStudioExamples.find(row=>row.id===study.exampleId)!;
  const finish=study.project.finishes.find(f=>'calibration'in f)!;
  cardData.push({...original,name:labels[study.record.id],specificationLabel:specifications[study.record.id],artworkLabel:finish.name,description:study.selection.assets.calibrationLabel+' '+study.selection.assets.materialLabel,repeatMm:{width:finish.calibration.widthMm,height:finish.calibration.heightMm},pixelSize:study.pixels,sourceUrl:study.record.sourceUrl,studyId:study.record.id,assumptions:study.assumptions,assumptionGroups:study.assumptionGroups,renders:{stills:[`/media/room-studio/private-manufacturer/${study.exampleId}-1.webp`,`/media/room-studio/private-manufacturer/${study.exampleId}-2.webp`],panorama:`/media/room-studio/private-manufacturer/${study.exampleId}-panorama.webp`}});
}
await writeFile(join(site,'src/room-studio/private-study-projects.json'),JSON.stringify(Object.fromEntries(studies.map(study=>[study.exampleId,study.project]))));
await writeFile(join(site,'src/room-studio/examples.ts'),`import projects from './private-study-projects.json';import type {RoomProject} from './types.ts';import type {RoomStudioExampleId} from './example-metadata.ts';export function createExampleProject(id:RoomStudioExampleId):RoomProject{return structuredClone(projects[id]) as RoomProject;}export {roomStudioExamples} from './example-metadata.ts';`);
await writeFile(join(site,'src/room-studio/example-metadata.ts'),`export type RoomStudioExampleId='willow-chimney'|'ochre-lshape'|'indigo-bay';export const roomStudioExamples=${JSON.stringify(cardData)};`);
const componentPath=join(site,'src/room-studio/components/ExamplePanel.tsx');
let component=await readFile(componentPath,'utf8');
component=component.replace('Original illustrative wallpapers, measured rooms and real rendered views. Choose an example, then open it in the editable 3D room.','Private full-room reference studies with illustrative metallic response and sculpted mesh relief. Artwork scale and material appearance are not installation proofs.');
component=component.replace('const base=`/media/room-studio/examples/${id}`','const base=`/media/room-studio/private-manufacturer/${id}`');
component=component.replace('{example.repeatMm.width} × {example.repeatMm.height} mm repeat.','Preview mapping: {example.repeatMm.width} × {example.repeatMm.height} mm. See the assumptions above.');
component=component.replace('Blender Cycles render · Original illustrative design · 1920 × 1080','Private material study · Blender Cycles · 1920 × 1080');
await writeFile(componentPath,component);
component=component.replace('src={`${base}-1.webp`}','src={example.renders.stills[0]}');
await writeFile(componentPath,component);
const pagePath=join(site,'src/pages/room-studio.astro'),page=await readFile(pagePath,'utf8'),styles=page.slice(page.indexOf('<style>'));
await writeFile(pagePath,`---
import Base from '../layouts/Base.astro';import Action from '../components/Action.astro';import RoomStudio from '../room-studio/RoomStudio.tsx';import StudySpecifications from '../room-studio/components/StudySpecifications.astro';import {roomStudioExamples} from '../room-studio/example-metadata';
---
<Base title="Private manufacturer room studies | Mr Wallcover" description="Local comparison of the three selected wallcoverings in measured rooms." path="/room-studio/" noindex={true}>
<div class="studio-page container-page pb-20"><header class="studio-page-head"><div><p class="eyebrow">Private local preview</p><h1>Wallpaper<br/><em>my room.</em></h1></div><div><p class="lede">Plum Blossom. Gold on Horsehair. Caisson.</p><p>Three manufacturer reference studies in the chimney, L-shaped and bay rooms. This local build uses the existing 3D room engine.</p><p><strong>Reference appearance only.</strong> Product specifications and preview assumptions are shown separately. The silver and gold have illustrative reflection settings. Caisson has an illustrative 8 mm geometric coffer profile; measured manufacturer material data is not available.</p><Action href="#example-rooms">Explore the three studies</Action></div></header>
<section id="example-rooms" class="studio-showcase"><div class="studio-showcase-heading"><h2>Three rooms.<br/><em>The selected finishes.</em></h2><p>Source artwork credited to its maker. These are private composition comparisons, not completed installations or approved production assets.</p></div><div class="studio-showcase-grid">{roomStudioExamples.map((example,index)=><article class="studio-example-card"><a href="#room-editor" data-room-example={example.id}><img src={'/media/room-studio/private-manufacturer/'+example.id+'-preview.webp'} width="960" height="540" loading={index===0?'eager':'lazy'} alt={example.name+' private appearance concept'}/></a><div class="studio-example-copy"><p class="eyebrow">{String(index+1).padStart(2,'0')} / Private reference</p><h3>{example.name}</h3><p>{example.layoutLabel}<br/>{example.dimensionsLabel}</p><p class="studio-example-repeat">{example.specificationLabel}</p><Action href="#room-editor" data-room-example={example.id}>Explore this room</Action><a class="studio-full-view" href={example.renders.stills[0]}>View full-resolution concept</a><a class="studio-full-view" href={example.sourceUrl} target="_blank" rel="noreferrer">Official product and specification</a></div></article>)}</div><p class="studio-example-caption">Each package contains two 1920 × 1080 images and one 4096 × 2048 panorama. Higher output resolution does not supply missing source detail or establish manufacturer colour, panel sequence, metallic reflection or relief accuracy. No public publication or indexing of these reference assets.</p></section>
<div id="room-editor"><RoomStudio client:only="react"/></div><StudySpecifications studies={roomStudioExamples}/></div></Base>
${styles}`);
await writeFile(join(site,'public/robots.txt'),'User-agent: *\nDisallow: /\n');
await command(process.execPath,[join(root,'node_modules/astro/bin/astro.mjs'),'build'],site,join(output,'build.log'));
await rm(join(site,'dist/sitemap-index.xml'),{force:true});await rm(join(site,'dist/sitemap-0.xml'),{force:true});
await writeFile(stagedPreview,JSON.stringify({createdAt:new Date().toISOString(),dist:join(publishedSite,'dist'),publicDeployment:false,paidCalls:0,studies:cardData.map(({description,...row})=>row)},null,2));
await promotePrivateSite(site,publishedSite,stagedPreview,join(output,'preview.json'));
console.log(`Private preview built: ${join(publishedSite,'dist')}. Serve on 127.0.0.1 only.`);
}finally{
  await rm(site,{recursive:true,force:true});await rm(stagedPreview,{force:true});
}
