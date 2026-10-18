import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudClient } from '../src/room-studio/cloud.ts';
import { fixtureProject } from '../src/room-studio/fixtures.ts';
import type { RoomProject } from '../src/room-studio/types.ts';

const OWNER='10000000-0000-4000-8000-000000000001';
const OTHER='20000000-0000-4000-8000-000000000002';
const PROJECT='30000000-0000-4000-8000-000000000003';
const SECOND='30000000-0000-4000-8000-000000000004';
const THIRD='30000000-0000-4000-8000-000000000005';
const BASE='https://example.supabase.co';

test('cloud saves reuse freshly verified owned artwork across sessions and recover missing objects',async()=>{
  const host=globalThis as typeof globalThis&{Deno?:unknown};
  const oldDeno=host.Deno,oldFetch=globalThis.fetch;
  const env:Record<string,string>={SUPABASE_URL:BASE,SUPABASE_SERVICE_ROLE_KEY:'server-only-test',SUPABASE_ANON_KEY:'publishable',ROOM_STUDIO_CLOUD_ENABLED:'true'};
  let handler:((request:Request)=>Promise<Response>)|undefined;
  host.Deno={env:{get:(key:string)=>env[key]},serve:(fn:typeof handler)=>{handler=fn;}};
  const projects=new Map<string,Record<string,any>>(),assets=new Map<string,Record<string,any>>(),objects=new Map<string,Uint8Array>();
  let uploads=0,signatures=0,integrityReads=0,missingStatus=404;
  const queries:URL[]=[];
  function rows(values:Map<string,Record<string,any>>,url:URL){
    return [...values.values()].filter(row=>[...url.searchParams].every(([key,filter])=>!filter.startsWith('eq.')||String(row[key])===filter.slice(3)));
  }
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input));
    if(url.pathname==='/auth/v1/user')return Response.json({id:new Headers(init?.headers).get('Authorization')?.endsWith(OTHER)?OTHER:OWNER,email:'fixture@example.test',email_confirmed_at:'2026-10-18T00:00:00Z',is_anonymous:false});
    if(url.pathname==='/rest/v1/room_projects')return Response.json(rows(projects,url));
    if(url.pathname==='/rest/v1/room_assets'){
      queries.push(url);
      const matched=rows(assets,url);
      if(init?.method==='PATCH')for(const row of matched)Object.assign(row,JSON.parse(String(init.body)));
      return Response.json(matched);
    }
    if(url.pathname.startsWith('/rest/v1/rpc/')){
      const name=url.pathname.split('/').at(-1),body=JSON.parse(String(init?.body));
      if(name==='room_prepare_project'||name==='room_save_project'){
        let row=projects.get(body.p_id);
        if(row&&row.owner_id!==body.p_owner)return Response.json({message:'Project unavailable'},{status:400});
        if(!row){row={id:body.p_id,owner_id:body.p_owner,revision:0,snapshot:body.p_snapshot,updated_at:'2026-10-18T00:00:00Z',expires_at:'2027-01-16T00:00:00Z',expiry_notice_at:null,deleting:false};projects.set(row.id,row);}
        if(name==='room_save_project')row.snapshot=body.p_snapshot;
        return Response.json(row);
      }
      if(name==='room_reserve_asset'){
        const row={id:body.p_id,owner_id:body.p_owner,project_id:body.p_project,storage_path:`${body.p_owner}/${body.p_project}/${body.p_id}.${body.p_extension}`,kind:body.p_kind,mime:body.p_mime,bytes:body.p_bytes,sha256:body.p_sha,state:'pending'};
        assets.set(row.id,row);return Response.json(row);
      }
      if(name==='room_finish_upload'){
        const row=assets.get(body.p_asset)!;assert.equal(row.owner_id,body.p_owner);row.state=body.p_cancel?'cancelled':'ready';return Response.json(row);
      }
    }
    const storage='/storage/v1/object/authenticated/room-studio/';
    if(url.pathname.startsWith(storage)){
      integrityReads++;const bytes=objects.get(url.pathname.slice(storage.length));return bytes?new Response(bytes):Response.json({statusCode:'404',error:'Object not found'},{status:missingStatus});
    }
    if(url.pathname.startsWith('/storage/v1/object/sign/room-studio/'))return Response.json({signedURL:url.pathname.slice('/storage/v1'.length)+'?token=offline'});
    const signing='/storage/v1/object/upload/sign/room-studio/';
    if(url.pathname.startsWith(signing)){
      assert.equal(JSON.parse(String(init?.body)).upsert,false,'existing objects must never be overwritten');
      signatures++;return Response.json({url:'/object/upload/sign/room-studio/'+url.pathname.slice(signing.length)+'?token=offline'});
    }
    throw new Error('Unexpected offline service route: '+url.pathname);
  };
  const clientFetch:typeof fetch=async(input,init)=>{
    const url=new URL(String(input));
    if(url.pathname==='/auth/v1/verify'){
      const owner=JSON.parse(String(init?.body)).email==='other@example.test'?OTHER:OWNER;
      return Response.json({access_token:owner,refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:owner}});
    }
    if(url.pathname==='/functions/v1/room-studio')return handler!(new Request(url,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),Origin:'https://www.mrwallcover.com'}}));
    const prefix='/storage/v1/object/upload/sign/room-studio/';
    if(url.pathname.startsWith(prefix)){
      uploads++;const path=url.pathname.slice(prefix.length);assert.equal(objects.has(path),false,'PUT targets must be fresh immutable paths');objects.set(path,new Uint8Array(await (init!.body as Blob).arrayBuffer()));return new Response('');
    }
    if(url.pathname.startsWith('/storage/v1/object/sign/room-studio/'))return new Response(objects.get(url.pathname.slice('/storage/v1/object/sign/room-studio/'.length)));
    throw new Error('Unexpected offline client route: '+url.pathname);
  };
  const client=()=>createCloudClient({enabled:true,url:BASE,anonKey:'publishable'},clientFetch);
  const artwork=(project:RoomProject)=>project.finishes.find(f=>f.type==='wallpaper')!;
  try{
    await import('../supabase/functions/room-studio/index.ts');
    const original={...fixtureProject(),id:PROJECT};
    const first=client();await first.completeSignIn('fixture@example.test','123456');
    const saved1=await first.saveProject(original),path1=artwork(saved1.project).texture.storagePath!;
    assert.equal(uploads,1);assert.equal(signatures,1);
    const saved2=await first.saveProject(original);
    assert.equal(uploads,1,'unchanged repeated saves do not use another upload or reservation');
    assert.equal(artwork(saved2.project).texture.storagePath,path1);
    const nextSession=client();await nextSession.completeSignIn('fixture@example.test','123456');
    await nextSession.saveProject(original);
    assert.equal(uploads,1,'reuse survives a new client session');
    assert.equal(artwork(original).texture.dataUrl?.startsWith('data:image/png;base64,'),true,'offline original remains embedded');
    assert.equal(artwork(original).texture.storagePath,undefined);
    assert.ok(integrityReads>=3,'reuse checks actual private storage again');
    const reuseQueries=queries.filter(url=>url.searchParams.has('sha256'));
    for(const url of reuseQueries){assert.equal(url.searchParams.get('owner_id'),'eq.'+OWNER);assert.equal(url.searchParams.get('project_id'),'eq.'+PROJECT);assert.equal(url.searchParams.get('kind'),'eq.artwork');assert.equal(url.searchParams.get('state'),'eq.ready');}
    const hydrated=await first.getProject(PROJECT);
    objects.delete(path1);
    const restored=await first.saveProject(hydrated.project),path2=artwork(restored.project).texture.storagePath!;
    assert.equal(uploads,2,'a hydrated but missing storage path is uploaded to a fresh path');assert.notEqual(path2,path1);assert.ok(objects.has(path2));
    objects.delete(path2);missingStatus=400;
    const legacyRestored=await first.saveProject(original),path3=artwork(legacyRestored.project).texture.storagePath!;
    assert.equal(uploads,3,'legacy missing-object response also recovers through a fresh path');assert.notEqual(path3,path2);
    await first.saveProject({...original,id:SECOND});
    assert.equal(uploads,4,'another project cannot reuse the first project asset');
    const other=client();await other.completeSignIn('other@example.test','123456');
    await assert.rejects(()=>other.saveProject(original),/Project unavailable/);
    await other.saveProject({...original,id:THIRD});
    assert.equal(uploads,5,'another owner receives a separately owned asset');
    objects.set(path3,new Uint8Array([137,80,78,71,13,10,26,10]));
    await assert.rejects(()=>first.saveProject(original),/integrity check/);
    assert.equal(uploads,5,'corrupt existing artwork is never silently reused or overwritten');
  }finally{globalThis.fetch=oldFetch;if(oldDeno===undefined)delete host.Deno;else host.Deno=oldDeno;}
});
