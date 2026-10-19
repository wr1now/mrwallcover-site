import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureProject } from '../src/room-studio/fixtures.ts';
import type { RoomProject } from '../src/room-studio/types.ts';
import type { PhotoProject } from '../src/room-studio/photo-types.ts';
const OWNER='10000000-0000-4000-8000-000000000001',PROJECT='30000000-0000-4000-8000-000000000003',REVISION='40000000-0000-4000-8000-000000000004';
const ART=`${OWNER}/${PROJECT}/50000000-0000-4000-8000-000000000005.png`,SOURCE=`${OWNER}/${PROJECT}/50000000-0000-4000-8000-000000000006.png`;

test('metadata-only room/photo saves and exports budget every hydrated occurrence before writes or signed links',async()=>{
 const host=globalThis as typeof globalThis&{Deno?:unknown},oldDeno=host.Deno,oldFetch=globalThis.fetch;
 let handler:((request:Request)=>Promise<Response>)|undefined,writes=0,signed=0,bytes=20*1024*1024;
 const room:RoomProject={...fixtureProject(),schemaVersion:2,id:PROJECT,ownerId:OWNER,revision:0};
 const artwork=room.finishes.find(f=>f.type==='wallpaper')!;delete artwork.texture.dataUrl;artwork.texture.storagePath=ART;
 room.finishes.push({...structuredClone(artwork),id:'repeat-two'},{...structuredClone(artwork),id:'repeat-three'});
 room.schemes=Array.from({length:3},(_,i)=>({id:'scheme-'+i,name:'Scheme '+i,finishes:structuredClone(room.finishes),assignments:structuredClone(room.assignments)}));
 const photo:PhotoProject={kind:'photo',schemaVersion:1,id:PROJECT,ownerId:OWNER,name:'Metadata photo',source:{...artwork.texture,id:'source-photo',sha256:'b'.repeat(64),storagePath:SOURCE},surfaces:[],finishes:[structuredClone(artwork)],comparisons:[],revision:1,updatedAt:'2026-10-19T12:00:00Z'};
 photo.comparisons=Array.from({length:8},(_,i)=>({id:'comparison-'+i,name:'Comparison '+i,createdAt:photo.updatedAt,surfaces:[],finishes:[structuredClone(artwork)]}));
 const row:Record<string,any>={id:PROJECT,owner_id:OWNER,document_kind:'room',snapshot:room,revision:0,deleting:false,updated_at:room.updatedAt,expires_at:'2027-01-17T00:00:00Z',expiry_notice_at:null};
 let revisions:Record<string,any>[]=[];
 const env:Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-test',SUPABASE_ANON_KEY:'publishable',ROOM_STUDIO_CLOUD_ENABLED:'true'};
 host.Deno={env:{get:(key:string)=>env[key]},serve:(fn:typeof handler)=>{handler=fn;}};
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname==='/auth/v1/user')return Response.json({id:OWNER,email_confirmed_at:photo.updatedAt,is_anonymous:false});
  if(url.pathname==='/rest/v1/room_projects')return Response.json([row]);
  if(url.pathname==='/rest/v1/room_revisions')return Response.json(revisions);
  if(url.pathname==='/rest/v1/room_assets')return Response.json([{owner_id:OWNER,project_id:PROJECT,id:'asset-art',storage_path:ART,sha256:artwork.texture.sha256,mime:'image/png',kind:'artwork',state:'ready',bytes},{owner_id:OWNER,project_id:PROJECT,id:'asset-source',storage_path:SOURCE,sha256:photo.source.sha256,mime:'image/png',kind:'room-photo',state:'ready',bytes}]);
  if(url.pathname.startsWith('/storage/')){signed++;throw new Error('Oversized exports must stop before private asset hydration/signing');}
  if(url.pathname.startsWith('/rest/v1/rpc/')){writes++;const payload=JSON.parse(String(init?.body));return Response.json({...row,snapshot:payload.p_snapshot});}
  throw new Error('Unexpected offline path '+url.pathname);
 };
 const request=(body:unknown)=>handler!(new Request('https://example.supabase.co/functions/v1/room-studio',{method:'POST',headers:{Origin:'https://www.mrwallcover.com',Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify(body)}));
 try{
  await import('../supabase/functions/room-studio/index.ts');
  const largeRoom=await request({action:'saveProject',project:room});assert.equal(largeRoom.status,400);assert.match((await largeRoom.json()).error,/160 MB/);assert.equal(writes,0);
  row.document_kind='photo';row.snapshot=photo;
  for(const action of ['savePhotoProject','exportPhotoProject']){const response=await request({action,project:photo,projectId:PROJECT,expectedRevision:0});assert.equal(response.status,400);assert.match((await response.json()).error,/160 MB/);}
  assert.equal(writes,0);assert.equal(signed,0);
  // A small individually valid revision can still make an oversized complete
  // archive when its repeated originals are included across many snapshots.
  const small={...room,finishes:[artwork],schemes:[]};row.document_kind='room';row.snapshot=small;
  revisions=Array.from({length:6},(_,i)=>({id:i===0?REVISION:`40000000-0000-4000-8000-00000000000${i+4}`,owner_id:OWNER,project_id:PROJECT,number:i+1,snapshot:small,created_at:photo.updatedAt}));
  const archive=await request({action:'exportProject',projectId:PROJECT});assert.equal(archive.status,400);assert.match((await archive.json()).error,/160 MB/);assert.equal(signed,0);
  // Reducing actual owned source sizes admits the same document; the bound is
  // based on authoritative original bytes, not an arbitrary finish count.
  row.snapshot=room;bytes=1024;const accepted=await request({action:'saveProject',project:room});assert.equal(accepted.status,200);assert.equal(writes,1);
 }finally{globalThis.fetch=oldFetch;if(oldDeno===undefined)delete host.Deno;else host.Deno=oldDeno;}
});
