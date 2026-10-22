import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createExampleProject, roomStudioExamples } from '../src/room-studio/examples.ts';
import type { RoomStudioExampleId } from '../src/room-studio/examples.ts';
import { compileRoom, wallLength } from '../src/room-studio/geometry.ts';
import { isProject } from '../src/room-studio/storage.ts';
import { validateProject } from '../src/room-studio/validation.ts';
import type { ArtworkFinish, RoomProject } from '../src/room-studio/types.ts';

const near=(actual:number,expected:number,label:string)=>assert.ok(Math.abs(actual-expected)<1e-5,`${label}: ${actual} != ${expected}`);
const compile=(project:RoomProject)=>compileRoom({id:project.id+'-revision-1',projectId:project.id,number:project.revision,createdAt:project.updatedAt,project});
const art=(project:RoomProject)=>project.finishes.find(finish=>finish.type==='wallpaper') as ArtworkFinish;
const footprints:Record<RoomStudioExampleId,{corners:number;windows:number;doors:number;area:number}>={
  'willow-chimney':{corners:8,windows:3,doors:1,area:27.8},
  'ochre-lshape':{corners:6,windows:3,doors:2,area:25.6},
  'indigo-bay':{corners:6,windows:4,doors:1,area:24.56},
};

test('three distinct original high-resolution PNGs are embedded with exact pixel and physical calibration',async()=>{
  const hashes=new Set<string>();
  assert.equal(roomStudioExamples.length,3);
  for(const metadata of roomStudioExamples){
    const project=createExampleProject(metadata.id),finish=art(project),bytes=Buffer.from(finish.texture.dataUrl!.split(',')[1],'base64');
    assert.match(finish.name,/Original illustrative/);
    assert.equal(finish.texture.mime,'image/png');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),finish.texture.sha256);
    const png=await sharp(bytes).metadata();
    assert.equal(png.format,'png');assert.equal(png.width,1536);assert.equal(png.height,1536);
    assert.deepEqual(metadata.pixelSize,{width:png.width,height:png.height});
    assert.equal(finish.texture.widthPx,png.width);assert.equal(finish.texture.heightPx,png.height);
    assert.equal(finish.calibration.widthMm,metadata.repeatMm.width);assert.equal(finish.calibration.heightMm,metadata.repeatMm.height);
    assert.equal(finish.texture.storagePath,undefined);assert.ok(bytes.length<20*1024*1024);
    hashes.add(finish.texture.sha256);
  }
  assert.equal(hashes.size,3,'Each example needs independently authored wallpaper, not a recoloured reference to one asset');
});

for(const metadata of roomStudioExamples)test(`${metadata.id}: portable measured room, real opening cut-outs and calibrated wallpaper UVs`,()=>{
  const project=createExampleProject(metadata.id),expected=footprints[metadata.id],finish=art(project),room=project.room;
  assert.deepEqual(validateProject(project),[]);assert.equal(room.confirmed,false,'Illustrative example dimensions must still be checked by the customer');
  assert.equal(room.vertices.length,expected.corners);
  assert.equal(room.openings.filter(opening=>opening.kind==='window').length,expected.windows);
  assert.equal(room.openings.filter(opening=>opening.kind==='door').length,expected.doors);
  const portable=JSON.parse(JSON.stringify(project));assert.equal(isProject(portable),true);assert.deepEqual(validateProject(portable),[]);
  const scene=compile(project),floor=scene.meshes.find(mesh=>mesh.id==='room-floor')!;
  let area=0;
  for(let i=0;i<floor.indices.length;i+=3){const [a,b,c]=floor.indices.slice(i,i+3).map(index=>({x:floor.positions[index*3],z:floor.positions[index*3+2]}));area+=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/2;}
  near(area,expected.area,'Triangulated floor follows the concave or angled footprint');
  assert.ok(scene.meshes.some(mesh=>mesh.id==='room-ceiling'));
  assert.equal(scene.cameras.filter(camera=>camera.kind==='perspective').length,2);assert.equal(scene.cameras.filter(camera=>camera.kind==='panorama').length,1);

  const wallpaperMeshes=scene.meshes.filter(mesh=>mesh.materialId===finish.id&&mesh.id.endsWith('-inside'));
  assert.ok(wallpaperMeshes.length>5);
  for(const mesh of wallpaperMeshes){
    const index=room.vertices.findIndex(vertex=>vertex.wallId===mesh.wallId),a=room.vertices[index],b=room.vertices[(index+1)%room.vertices.length],length=wallLength(room,a.wallId),dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
    const assignment=project.assignments.find(assignment=>assignment.wallId===mesh.wallId)!;
    const along=(offset:number)=>(mesh.positions[offset]*1000-a.x)*dx+(mesh.positions[offset+2]*1000-a.z)*dz;
    const middle=(along(0)+along(3))/2,strip=Math.floor((middle-assignment.offsetXmm)/finish.calibration.widthMm);
    const shift=metadata.id==='ochre-lshape'&&strip%2===1?finish.calibration.heightMm/2:0;
    for(let vertex=0;vertex<4;vertex++){
      near(mesh.uvs[vertex*2],(along(vertex*3)-assignment.offsetXmm)/finish.calibration.widthMm,'U uses the real repeat width and continuous corner phase, including wall cells beside openings');
      near(mesh.uvs[vertex*2+1],(mesh.positions[vertex*3+1]*1000-shift)/finish.calibration.heightMm,'V uses the real repeat height and exactly one requested half-drop');
    }
  }
  for(const opening of room.openings){
    const index=room.vertices.findIndex(vertex=>vertex.wallId===opening.wallId),a=room.vertices[index],b=room.vertices[(index+1)%room.vertices.length],length=wallLength(room,a.wallId),dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
    for(const mesh of scene.meshes.filter(mesh=>mesh.wallId===opening.wallId&&mesh.id.endsWith('-inside'))){
      const x=mesh.positions.filter((_,i)=>i%3===0).reduce((sum,value)=>sum+value,0)/4*1000,z=mesh.positions.filter((_,i)=>i%3===2).reduce((sum,value)=>sum+value,0)/4*1000,y=mesh.positions.filter((_,i)=>i%3===1).reduce((sum,value)=>sum+value,0)/4*1000;
      const along=(x-a.x)*dx+(z-a.z)*dz;
      assert.equal(along>opening.offsetMm&&along<opening.offsetMm+opening.widthMm&&y>opening.sillMm&&y<opening.sillMm+opening.heightMm,false,`${opening.id} must cut out the wall surface`);
    }
    for(const suffix of ['reveal-left','reveal-right','reveal-top'])assert.ok(scene.meshes.some(mesh=>mesh.id===`${opening.id}-${suffix}`));
    assert.ok(scene.meshes.some(mesh=>mesh.id===`${opening.id}-${opening.kind==='window'?'sill':'threshold'}`));
  }
});

test('chimney breast has an actual projecting front and two returns, not a flat decorative rectangle',()=>{
  const project=createExampleProject('willow-chimney');
  near(wallLength(project.room,'willow-chimney-front'),1800,'Chimney front width');
  near(wallLength(project.room,'willow-chimney-left'),400,'Left return depth');
  near(wallLength(project.room,'willow-chimney-right'),400,'Right return depth');
  const scene=compile(project);
  for(const wall of ['willow-chimney-front','willow-chimney-left','willow-chimney-right'])assert.ok(scene.meshes.some(mesh=>mesh.wallId===wall&&mesh.surface==='wall'&&mesh.id.endsWith('-inside')));
});

test('straight, half-drop strip and already-included stagger remain distinct example calibrations',()=>{
  const willow=art(createExampleProject('willow-chimney')).calibration,ochre=art(createExampleProject('ochre-lshape')).calibration,indigo=art(createExampleProject('indigo-bay')).calibration;
  assert.deepEqual([willow.repeatKind,willow.match,willow.offsetAlreadyIncluded],['tile','straight',false]);
  assert.deepEqual([ochre.repeatKind,ochre.match,ochre.offsetAlreadyIncluded],['strip','half-drop',false]);
  assert.deepEqual([indigo.repeatKind,indigo.match,indigo.offsetAlreadyIncluded],['tile','half-drop',true]);
});

test('wallpaper continues around chimney returns and L-shaped corners without resetting strip phase',()=>{
  for(const metadata of roomStudioExamples){
    const project=createExampleProject(metadata.id),finish=art(project);
    let cumulative=0;
    const papered=project.assignments.filter(assignment=>assignment.finishId===finish.id);
    for(const assignment of papered){
      assert.equal(assignment.offsetXmm,Math.round(cumulative)===0?0:-Math.round(cumulative),'Each wall begins at the cumulative papered distance');
      assert.ok(Math.abs(-assignment.offsetXmm-cumulative)<=.5,'Angled-wall cumulative set-out stays within half a millimetre');
      cumulative+=wallLength(project.room,assignment.wallId);
    }
    for(let i=0;i<papered.length-1;i++){
      const left=papered[i],right=papered[i+1],end=wallLength(project.room,left.wallId)-left.offsetXmm,start=-right.offsetXmm;
      assert.ok(Math.abs(end-start)<=1,'Adjacent corners retain the same physical pattern phase within integer-mm tolerance');
      if(metadata.id!=='indigo-bay')assert.equal(end,start,'Axis-aligned chimney and L-shaped corners match exactly');
    }
  }
  const lshape=createExampleProject('ochre-lshape'),finish=art(lshape),returnWall=lshape.assignments.find(assignment=>assignment.wallId==='ochre-return-north')!;
  assert.equal(-returnWall.offsetXmm,3000);assert.equal(Math.floor(-returnWall.offsetXmm/finish.calibration.widthMm)%2,1,'The return begins inside an odd global strip');
  const firstCell=compile(lshape).meshes.find(mesh=>mesh.wallId===returnWall.wallId&&mesh.materialId===finish.id&&mesh.id.endsWith('-inside'))!;
  near(firstCell.uvs[1],-.5,'The half-drop remains applied on the odd strip after turning the corner');
});

test('using an example creates a fresh detached project while retaining stable wall and opening IDs',()=>{
  for(const metadata of roomStudioExamples){
    const first=createExampleProject(metadata.id),second=createExampleProject(metadata.id);
    assert.notEqual(first.id,second.id);assert.equal(first.ownerId,null);assert.equal(first.revision,1);
    assert.deepEqual(first.room.vertices.map(vertex=>vertex.wallId),second.room.vertices.map(vertex=>vertex.wallId));
    assert.deepEqual(first.room.openings.map(opening=>opening.id),second.room.openings.map(opening=>opening.id));
    first.room.vertices[0].x=999;first.cameras[0].position[0]=99;art(first).calibration.widthMm=1;
    assert.equal(second.room.vertices[0].x,0);assert.notEqual(second.cameras[0].position[0],99);assert.equal(art(second).calibration.widthMm,metadata.repeatMm.width);
    assert.deepEqual(validateProject(createExampleProject(metadata.id)),[]);
  }
  assert.throws(()=>createExampleProject('unknown' as RoomStudioExampleId),/three original Room Studio examples/);
});
