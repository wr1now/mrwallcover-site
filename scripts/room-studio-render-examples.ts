/** Render the same authored example projects the browser opens. No services or
 * model requests: shared TypeScript geometry/UVs are passed verbatim to Blender.
 */
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { compileRoom, wallLength } from '../src/room-studio/geometry.ts';
import { rotatedCropSize } from '../src/room-studio/finishes.ts';
import { createExampleProject, roomStudioExamples } from '../src/room-studio/examples.ts';
import type { RoomStudioExampleId } from '../src/room-studio/examples.ts';
import type { ArtworkFinish } from '../src/room-studio/types.ts';

const args=process.argv.slice(2);
const option=(flag:string,fallback:string)=>{
  const index=args.indexOf(flag);
  if(index<0)return fallback;
  const value=args[index+1];
  if(!value||value.startsWith('--'))throw new Error(`Supply a value after ${flag}.`);
  return value;
};
const selected=option('--id','all');
const ids=roomStudioExamples.map(example=>example.id).filter(id=>selected==='all'||id===selected);
if(!ids.length)throw new Error(`Choose --id all or ${roomStudioExamples.map(example=>example.id).join(', ')}.`);
const output=resolve(option('--output-dir','.tmp/room-studio-examples'));
const publish=resolve(option('--publish-dir','public/media/room-studio/examples'));
const executable=option('--blender',process.env.BLENDER_BIN||'blender');
const fast=args.includes('--fast');
const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
async function compressionMetrics(original:Uint8Array,encoded:Uint8Array,lossless:boolean){
  const a=await sharp(original).toColourspace('srgb').removeAlpha().raw().toBuffer();
  const b=await sharp(encoded).toColourspace('srgb').removeAlpha().raw().toBuffer();
  if(a.length!==b.length)throw new Error('Compression comparison changed pixel dimensions.');
  let absolute=0,squared=0,maximum=0;
  for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);absolute+=delta;squared+=delta*delta;maximum=Math.max(maximum,delta);}
  const rmse=Math.sqrt(squared/a.length);
  return {encoding:lossless?'lossless':'lossy',...(lossless?{}:{webpQuality:96}),pixelIdentical:squared===0,comparison:'Decoded full-resolution 8-bit sRGB RGB channels',meanAbsoluteError:Number((absolute/a.length).toFixed(4)),rmse:Number(rmse.toFixed(4)),psnrDb:rmse?Number((20*Math.log10(255/rmse)).toFixed(3)):null,psnrUnbounded:rmse===0,maximumChannelError:maximum};
}
await mkdir(output,{recursive:true});

async function render(id:RoomStudioExampleId){
  const project=createExampleProject(id);
  // Authoring review approves this technical fixture snapshot. Customer-loaded
  // examples stay unconfirmed and still require the customer's measurements.
  project.room.confirmed=true;
  const revision={id:`${project.id}-revision-${project.revision}`,projectId:project.id,number:project.revision,createdAt:project.updatedAt,project};
  const compiled=compileRoom(revision);
  const directory=resolve(output,id);
  await mkdir(directory,{recursive:true});
  const packagePath=resolve(directory,'render-package.json');
  const packageJson=JSON.stringify(compiled,null,2);
  await writeFile(packagePath,packageJson);
  await writeFile(resolve(directory,'room-revision.json'),JSON.stringify(revision,null,2));
  console.log(`${id}: compiled ${compiled.meshes.length} meshes; ${project.room.openings.length} openings.`);
  if(!args.includes('--render'))return;
  const logPath=resolve(directory,'blender.log');
  const log=createWriteStream(logPath,{flags:'w'});
  console.log(`${id}: rendering ${fast?'fast proof':'two HD stills + 4K panorama'}; log ${logPath}`);
  try{
    await new Promise<void>((accept,reject)=>{
      const child=spawn(executable,['-b','--python-exit-code','1','--python',resolve('workers/room_studio/render.py'),'--','--package',packagePath,'--output-dir',resolve(directory,'images'),'--quality',fast?'fast':'production'],{stdio:['ignore','pipe','pipe']});
      child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
      child.once('error',reject);
      child.once('close',code=>code===0?accept():reject(new Error(`${id}: Blender exited ${code}. See ${logPath}`)));
    });
  }finally{await new Promise<void>(done=>log.end(done));}
  const rendered=JSON.parse(await readFile(resolve(directory,'images/render-manifest.json'),'utf8'));
  if(rendered.revisionId!==revision.id||!rendered.renderedGeometryVerified)throw new Error(`${id}: renderer did not verify the approved room geometry.`);
  if(fast){console.log(`${id}: fast proof complete (${rendered.elapsedSeconds}s); full-size media was not published.`);return;}
  if(rendered.quality!=='production'||rendered.outputs.length!==3)throw new Error(`${id}: incomplete production render.`);
  await mkdir(publish,{recursive:true});
  const outputs=[];
  let preview:{file:string;width:number;height:number;bytes:number;sha256:string}|undefined;
  for(const image of rendered.outputs){
    const expected=image.kind==='panorama'?[4096,2048]:[1920,1080];
    if(image.width!==expected[0]||image.height!==expected[1])throw new Error(`${id}: unexpected ${image.kind} dimensions.`);
    const original=await readFile(resolve(directory,'images',basename(image.path)));
    if(digest(original)!==image.sha256)throw new Error(`${id}: ${image.kind} checksum changed after rendering.`);
    const suffix=image.kind==='panorama'?'panorama':image.kind==='still-1'?'1':'2';
    const filename=`${id}-${suffix}.webp`;
    // Fine indigo/gold lines benefit most from exact RGB preservation. Making
    // all nine outputs lossless exceeded the reviewed 15 MB showcase budget.
    const lossless=id==='indigo-bay';
    const webp=await sharp(original).webp(lossless?{lossless:true,effort:4}:{quality:96,effort:6}).toBuffer();
    const dimensions=await sharp(webp).metadata();
    if(dimensions.width!==expected[0]||dimensions.height!==expected[1])throw new Error(`${id}: showcase conversion changed its dimensions.`);
    await writeFile(resolve(publish,filename),webp);
    if(suffix==='1'){
      const thumbnail=await sharp(original).resize(960,540).webp({quality:88,effort:6}).toBuffer();
      const file=`${id}-preview.webp`;
      await writeFile(resolve(publish,file),thumbnail);
      preview={file,width:960,height:540,bytes:thumbnail.length,sha256:digest(thumbnail)};
    }
    const compression=await compressionMetrics(original,webp,lossless);
    if(lossless&&!compression.pixelIdentical)throw new Error(`${id}: lossless output changed rendered pixels.`);
    outputs.push({kind:image.kind,file:filename,width:image.width,height:image.height,encoding:compression.encoding,pixelIdentical:compression.pixelIdentical,bytes:webp.length,sha256:digest(webp),originalPng:{file:basename(image.path),bytes:original.length,sha256:image.sha256},renderSeconds:image.renderSeconds,compression});
  }
  const report={
    id,provenance:'Original illustrative room and wallpaper artwork. No supplier endorsement or completed-project claim.',
    revisionId:revision.id,packageSha256:digest(packageJson),compilerVersion:compiled.compilerVersion,
    sourceSha256:digest(JSON.stringify({room:{...project.room,confirmed:undefined},finishes:project.finishes,assignments:project.assignments,cameras:project.cameras,lighting:project.lighting})),
    meshUvSha256:digest(JSON.stringify(compiled.meshes)),
    room:{corners:project.room.vertices.length,heightMm:project.room.heightMm,doors:project.room.openings.filter(o=>o.kind==='door').length,windows:project.room.openings.filter(o=>o.kind==='window').length},
    wallpaper:project.finishes.filter((f):f is ArtworkFinish=>f.type==='wallpaper'||f.type==='mural').map(f=>{
      const prepared=rotatedCropSize(f.texture.widthPx,f.texture.heightPx,f.calibration);
      return {name:f.name,sourcePixels:[f.texture.widthPx,f.texture.heightPx],sourceSha256:f.texture.sha256,physicalMm:[f.calibration.widthMm,f.calibration.heightMm],repeatKind:f.calibration.repeatKind,match:f.calibration.match,offsetAlreadyIncluded:f.calibration.offsetAlreadyIncluded,crop:f.calibration.crop,rotation:f.calibration.rotation,nativePixelsPerInch:[Number((prepared.width/f.calibration.widthMm*25.4).toFixed(1)),Number((prepared.height/f.calibration.heightMm*25.4).toFixed(1))]};
    }),
    setOut:project.assignments.flatMap(assignment=>{
      const finish=project.finishes.find(f=>f.id===assignment.finishId);
      if(finish?.type!=='wallpaper')return [];
      const length=wallLength(project.room,assignment.wallId),width=finish.calibration.widthMm;
      return [{wallId:assignment.wallId,lengthMm:Number(length.toFixed(3)),offsetXmm:assignment.offsetXmm,offsetYmm:assignment.offsetYmm,startU:Number((-assignment.offsetXmm/width).toFixed(6)),endU:Number(((length-assignment.offsetXmm)/width).toFixed(6))}];
    }),
    renderer:{blenderVersion:rendered.blenderVersion,device:rendered.device,samples:rendered.samples,seed:rendered.seed,elapsedSeconds:rendered.elapsedSeconds,renderedGeometryVerified:rendered.renderedGeometryVerified,geometrySha256:rendered.geometrySha256},
    preview,outputs,
  };
  await writeFile(resolve(publish,`${id}-manifest.json`),JSON.stringify(report,null,2)+'\n');
  console.log(`${id}: published ${outputs.length} verified full-resolution WebPs (${rendered.elapsedSeconds}s).`);
}
for(const id of ids)await render(id);
if(!args.includes('--render'))console.log('Add --render --blender /absolute/path/to/blender for full-size Cycles outputs. --fast produces private proof images only.');
