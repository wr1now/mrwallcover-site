import { exampleArtwork } from './example-artwork.generated.ts';
import { roomStudioExamples } from './example-metadata.ts';
import { continueWallpaperAroundCorners } from './finishes.ts';
import type { RoomStudioExampleId } from './example-metadata.ts';
import type { ArtworkFinish, Opening, RoomDefinition, RoomProject, StudioCamera } from './types.ts';
export { roomStudioExamples } from './example-metadata.ts';
export type { RoomStudioExampleId, RoomStudioExampleMetadata } from './example-metadata.ts';

/** Load this module on explicit example selection. Its original PNG artwork is
 * embedded so the returned room remains editable without a network or account. */
const windowOpening=(id:string,wallId:string,offsetMm:number,widthMm:number,heightMm=1600,sillMm=800):Opening=>({id,wallId,kind:'window',offsetMm,widthMm,heightMm,sillMm,revealMm:180});
const doorOpening=(id:string,wallId:string,offsetMm:number,widthMm=900):Opening=>({id,wallId,kind:'door',offsetMm,widthMm,heightMm:2150,sillMm:0,revealMm:160});
const definitions:Record<RoomStudioExampleId,{room:RoomDefinition;cameras:StudioCamera[]}>={
  'willow-chimney': {
    room: {
      vertices: [
        {x:0,z:0,wallId:'willow-south'}, {x:6200,z:0,wallId:'willow-east'},
        {x:6200,z:4600,wallId:'willow-north-right'}, {x:4100,z:4600,wallId:'willow-chimney-right'},
        {x:4100,z:4200,wallId:'willow-chimney-front'}, {x:2300,z:4200,wallId:'willow-chimney-left'},
        {x:2300,z:4600,wallId:'willow-north-left'}, {x:0,z:4600,wallId:'willow-west'},
      ], heightMm:2800,skirtingMm:140,corniceMm:100,confirmed:false,
      openings: [doorOpening('willow-door','willow-south',800,950),windowOpening('willow-east-window','willow-east',900,1500),windowOpening('willow-west-window','willow-west',1100,1500),windowOpening('willow-north-window','willow-north-left',600,1100)],
    },
    cameras: [
      {id:'still-1',kind:'perspective',position:[3.1,1.55,.75],target:[3.1,1.5,4.2],fov:65},
      {id:'still-2',kind:'perspective',position:[5.45,1.55,3.3],target:[2.7,1.4,4.1],fov:65},
      {id:'panorama-1',kind:'panorama',position:[3.1,1.55,2.4],target:[3.1,1.55,4.2],fov:90},
    ],
  },
  'ochre-lshape': {
    room: {
      vertices: [
        {x:0,z:0,wallId:'ochre-south'}, {x:6000,z:0,wallId:'ochre-east'},
        {x:6000,z:3000,wallId:'ochre-return-north'}, {x:3800,z:3000,wallId:'ochre-return-east'},
        {x:3800,z:5000,wallId:'ochre-north'}, {x:0,z:5000,wallId:'ochre-west'},
      ],heightMm:2700,skirtingMm:120,corniceMm:80,confirmed:false,
      openings: [doorOpening('ochre-entry-door','ochre-south',700),doorOpening('ochre-return-door','ochre-return-east',450,850),windowOpening('ochre-east-window','ochre-east',800,1400,1500,850),windowOpening('ochre-north-window','ochre-north',800,1600,1500,850),windowOpening('ochre-west-window','ochre-west',1300,1800,1500,850)],
    },
    cameras: [
      {id:'still-1',kind:'perspective',position:[.75,1.55,.65],target:[3.6,1.35,3.2],fov:65},
      {id:'still-2',kind:'perspective',position:[5.3,1.55,2.45],target:[2.1,1.35,3.8],fov:65},
      {id:'panorama-1',kind:'panorama',position:[2.2,1.55,2.4],target:[3.2,1.55,4.4],fov:90},
    ],
  },
  'indigo-bay': {
    room: {
      vertices: [
        {x:0,z:0,wallId:'indigo-south'}, {x:5600,z:0,wallId:'indigo-east'},
        {x:5600,z:3600,wallId:'indigo-bay-right'}, {x:4400,z:4600,wallId:'indigo-bay-centre'},
        {x:1200,z:4600,wallId:'indigo-bay-left'}, {x:0,z:3600,wallId:'indigo-west'},
      ],heightMm:2750,skirtingMm:120,corniceMm:90,confirmed:false,
      openings: [doorOpening('indigo-door','indigo-south',700),windowOpening('indigo-bay-right-window','indigo-bay-right',200,1100,1700,650),windowOpening('indigo-bay-centre-window','indigo-bay-centre',600,2000,1700,650),windowOpening('indigo-bay-left-window','indigo-bay-left',230,1050,1700,650),windowOpening('indigo-side-window','indigo-west',1100,1500,1500,850)],
    },
    cameras: [
      {id:'still-1',kind:'perspective',position:[2.8,1.55,.75],target:[2.8,1.4,4.2],fov:65},
      {id:'still-2',kind:'perspective',position:[4.9,1.55,2.8],target:[1.8,1.4,3.8],fov:65},
      {id:'panorama-1',kind:'panorama',position:[2.8,1.55,2.5],target:[2.8,1.55,4.6],fov:90},
    ],
  },
};

export function createExampleProject(id:RoomStudioExampleId):RoomProject {
  const metadata=roomStudioExamples.find(example=>example.id===id),definition=definitions[id];
  if(!metadata||!definition)throw new RangeError('Choose one of the three original Room Studio examples.');
  const {room,cameras}=structuredClone(definition);
  const wallpaper:ArtworkFinish={
    id:`example-${id}-wallpaper`,type:'wallpaper',name:metadata.artworkLabel,
    texture:{id:`example-${id}-artwork`,...exampleArtwork[id]},
    calibration:{widthMm:metadata.repeatMm.width,heightMm:metadata.repeatMm.height,crop:{x:0,y:0,width:1,height:1},rotation:0,repeatKind:id==='ochre-lshape'?'strip':'tile',match:id==='willow-chimney'?'straight':'half-drop',offsetAlreadyIncluded:id==='indigo-bay',proofAccepted:true},
  };
  const paint={id:`example-${id}-paint`,type:'paint' as const,name:'Example warm chalk',colour:'#e9e2d4',sheen:'matte' as const};
  const project:RoomProject={
    schemaVersion:2,id:crypto.randomUUID(),ownerId:null,name:`${metadata.name} · ${id==='willow-chimney'?'chimney room':id==='ochre-lshape'?'L-shaped room':'bay room'}`,
    room,finishes:[wallpaper,paint],assignments:room.vertices.map((vertex,index)=>({id:`example-${id}-wall-${index+1}`,wallId:vertex.wallId,finishId:index===0?paint.id:wallpaper.id,fromMm:0,toMm:null,offsetXmm:0,offsetYmm:0})),
    cameras,lighting:'daylight',schemes:[],revision:1,updatedAt:new Date().toISOString(),
  };
  return continueWallpaperAroundCorners(project,wallpaper.id,room.vertices[1].wallId);
}
