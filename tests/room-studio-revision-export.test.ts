import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCloudClient } from '../src/room-studio/cloud.ts';
import { fixtureProject } from '../src/room-studio/fixtures.ts';
import { validateProject } from '../src/room-studio/validation.ts';
import type { RoomProject, RoomRevision } from '../src/room-studio/types.ts';

const OWNER='10000000-0000-4000-8000-000000000001';
const OTHER='20000000-0000-4000-8000-000000000002';
const PROJECT='30000000-0000-4000-8000-000000000003';
const SECOND='30000000-0000-4000-8000-000000000004';
const REVISION='40000000-0000-4000-8000-000000000004';
const OTHER_REVISION='40000000-0000-4000-8000-000000000005';
const MISSING='40000000-0000-4000-8000-000000000006';
const BASE='https://example.supabase.co';
const PATH=`${OWNER}/${PROJECT}/50000000-0000-4000-8000-000000000005.png`;

function historicalProject():RoomProject {
  const project={...fixtureProject(),id:PROJECT,ownerId:OWNER,revision:3};
  const artwork=project.finishes.find(f=>f.type==='wallpaper')!;
  artwork.texture.storagePath=PATH;
  delete artwork.texture.dataUrl;
  project.schemes=[{id:'historical-combination',name:'Confirmed combination',finishes:structuredClone(project.finishes),assignments:structuredClone(project.assignments)}];
  return project;
}

test('owned revision reads and portable exports stay bound to the historical snapshot',async t=>{
  const host=globalThis as typeof globalThis&{Deno?:unknown};
  const oldDeno=host.Deno,oldFetch=globalThis.fetch;
  const env:Record<string,string>={SUPABASE_URL:BASE,SUPABASE_SERVICE_ROLE_KEY:'server-only-fixture',SUPABASE_ANON_KEY:'publishable',ROOM_STUDIO_CLOUD_ENABLED:'true'};
  let handler:((request:Request)=>Promise<Response>)|undefined;
  host.Deno={env:{get:(key:string)=>env[key]},serve:(fn:typeof handler)=>{handler=fn;}};
  const historical=historicalProject(),snapshotBefore=structuredClone(historical);
  const current={...fixtureProject(),id:PROJECT,ownerId:OWNER,name:'Later mutable draft',revision:11,finishes:[],assignments:[]};
  current.room.heightMm=2900;
  const projects=new Map<string,Record<string,any>>([
    [PROJECT,{id:PROJECT,owner_id:OWNER,revision:11,snapshot:current,deleting:false,updated_at:'2026-10-19T00:00:00Z',expires_at:'2027-01-16T00:00:00Z',expiry_notice_at:null}],
    [SECOND,{id:SECOND,owner_id:OWNER,revision:0,snapshot:{...current,id:SECOND},deleting:false}],
  ]);
  const revisions=new Map<string,Record<string,any>>([
    [REVISION,{id:REVISION,owner_id:OWNER,project_id:PROJECT,number:3,snapshot:historical,created_at:'2026-10-18T12:00:00Z'}],
    [OTHER_REVISION,{id:OTHER_REVISION,owner_id:OTHER,project_id:PROJECT,number:4,snapshot:{...historical,ownerId:OTHER},created_at:'2026-10-18T12:00:00Z'}],
  ]);
  const assets:Map<string,Record<string,any>>=new Map([['historical-artwork',{id:'50000000-0000-4000-8000-000000000005',owner_id:OWNER,project_id:PROJECT,storage_path:PATH,kind:'artwork',state:'ready'}]]);
  const original=fixtureProject().finishes.find(f=>f.type==='wallpaper')!.texture;
  const bytes=Buffer.from(original.dataUrl!.split(',')[1],'base64');
  for(const asset of assets.values())Object.assign(asset,{sha256:original.sha256,mime:original.mime,bytes:bytes.length});
  const queries:URL[]=[],writes:Record<string,any>[]=[];
  let signedRequests=0,imageRequests=0;
  const rows=(values:Map<string,Record<string,any>>,url:URL)=>[...values.values()].filter(row=>[...url.searchParams].every(([key,filter])=>!filter.startsWith('eq.')||String(row[key])===filter.slice(3)));
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input));
    if(url.pathname==='/auth/v1/user')return Response.json({id:new Headers(init?.headers).get('Authorization')?.endsWith(OTHER)?OTHER:OWNER,email_confirmed_at:'2026-10-18T00:00:00Z',is_anonymous:false});
    if(url.pathname==='/rest/v1/room_projects'){queries.push(url);return Response.json(rows(projects,url));}
    if(url.pathname==='/rest/v1/room_revisions'){queries.push(url);return Response.json(rows(revisions,url));}
    if(url.pathname==='/rest/v1/room_assets'){queries.push(url);return Response.json(rows(assets,url));}
    if(url.pathname.startsWith('/storage/v1/object/sign/room-studio/')){signedRequests++;return Response.json({signedURL:url.pathname.slice('/storage/v1'.length)+'?token=offline'});}
    if(url.pathname.startsWith('/rest/v1/rpc/')){
      const body=JSON.parse(String(init?.body));writes.push({name:url.pathname.split('/').at(-1),...body});
      if(url.pathname.endsWith('/room_prepare_project'))return Response.json(projects.get(body.p_id));
      if(url.pathname.endsWith('/room_save_project')){const row=projects.get(body.p_id)!;row.snapshot=body.p_snapshot;return Response.json(row);}
    }
    throw new Error('Unexpected offline service route: '+url.pathname);
  };
  const clientFetch:typeof fetch=async(input,init)=>{
    const url=new URL(String(input));
    if(url.pathname==='/auth/v1/verify'){
      const owner=JSON.parse(String(init?.body)).email==='other@example.test'?OTHER:OWNER;
      return Response.json({access_token:owner,refresh_token:'offline-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:owner}});
    }
    if(url.pathname==='/functions/v1/room-studio')return handler!(new Request(url,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),Origin:'https://www.mrwallcover.com'}}));
    if(url.pathname==='/storage/v1/object/sign/room-studio/'+PATH){imageRequests++;return new Response(bytes,{headers:{'Content-Type':'image/png'}});}
    throw new Error('Unexpected offline client route: '+url.pathname);
  };
  const client=()=>createCloudClient({enabled:true,url:BASE,anonKey:'publishable'},clientFetch);
  try{
    await import('../supabase/functions/room-studio/index.ts');
    const owner=client();await owner.completeSignIn('fixture@example.test','123456');
    const mutable=await owner.getProject(PROJECT);
    await t.test('metadata reads do not hydrate artwork or replace a later mutable head',async()=>{
      const revision=await owner.getRevision(PROJECT,REVISION);
      assert.equal(revision.id,REVISION);assert.equal(revision.projectId,PROJECT);assert.equal(revision.number,3);
      assert.equal(revision.project.name,historical.name);assert.equal(revision.project.room.heightMm,2600);
      assert.equal(revision.project.finishes.find(f=>f.type==='wallpaper')!.texture.dataUrl,undefined);
      assert.equal(signedRequests,0);assert.equal(imageRequests,0);assert.equal(writes.length,0);
      projects.get(PROJECT)!.snapshot.room.heightMm=3100;
      assert.equal((await owner.getRevision(PROJECT,REVISION)).project.room.heightMm,2600);
      assert.deepEqual(revisions.get(REVISION)!.snapshot,snapshotBefore);
    });
    await t.test('export embeds exact historical artwork across finishes and combinations',async()=>{
      const exported=await owner.exportRevision(PROJECT,REVISION);
      assert.equal(exported.id,REVISION);assert.equal(exported.number,3);
      const portable=JSON.parse(JSON.stringify(exported)) as RoomRevision;
      assert.deepEqual(validateProject(portable.project),[]);
      assert.equal(portable.project.room.heightMm,2600);
      for(const finish of [...portable.project.finishes,...portable.project.schemes.flatMap(s=>s.finishes)])if(finish.type==='wallpaper'||finish.type==='mural'){
        assert.equal(finish.texture.storagePath,undefined);
        assert.equal(finish.texture.dataUrl,original.dataUrl);
        assert.equal(createHash('sha256').update(Buffer.from(finish.texture.dataUrl!.split(',')[1],'base64')).digest('hex'),original.sha256);
      }
      assert.equal(imageRequests,1,'one historical source is embedded once even when shared by a combination');
      assert.equal(signedRequests,1);assert.equal(writes.length,0);
      assert.deepEqual(revisions.get(REVISION)!.snapshot,snapshotBefore,'portable export never changes the stored immutable snapshot');
      await owner.saveProject({...mutable.project,name:'A later local edit',revision:900});
      assert.equal(writes.find(write=>write.name==='room_save_project')?.p_expected_revision,11,'historical reads and exports do not reset optimistic save heads');
    });
    await t.test('owner, project and revision filters reject mismatches before artwork is signed',async()=>{
      const other=client();await other.completeSignIn('other@example.test','123456');
      const beforeImages=imageRequests,beforeSigned=signedRequests;
      await assert.rejects(()=>other.getRevision(PROJECT,REVISION),/Project unavailable/);
      await assert.rejects(()=>other.exportRevision(PROJECT,REVISION),/Project unavailable/);
      await assert.rejects(()=>owner.getRevision(SECOND,REVISION),/version unavailable/);
      await assert.rejects(()=>owner.exportRevision(PROJECT,OTHER_REVISION),/version unavailable/);
      await assert.rejects(()=>owner.getRevision(PROJECT,MISSING),/version unavailable/);
      assert.equal(imageRequests,beforeImages);assert.equal(signedRequests,beforeSigned);
      for(const query of queries.filter(query=>query.pathname==='/rest/v1/room_revisions')){
        assert.ok(query.searchParams.get('id')?.startsWith('eq.'));
        assert.equal(query.searchParams.get('owner_id'),'eq.'+OWNER);
        assert.ok(['eq.'+PROJECT,'eq.'+SECOND].includes(query.searchParams.get('project_id')!));
      }
    });
    await t.test('missing and deleting projects hide their retained historical revisions',async()=>{
      const beforeQueries=queries.filter(query=>query.pathname==='/rest/v1/room_revisions').length;
      const beforeImages=imageRequests,beforeSigned=signedRequests;
      projects.get(PROJECT)!.deleting=true;
      await assert.rejects(()=>owner.getRevision(PROJECT,REVISION),/Project unavailable/);
      await assert.rejects(()=>owner.exportRevision(PROJECT,REVISION),/Project unavailable/);
      projects.delete(PROJECT);
      await assert.rejects(()=>owner.getRevision(PROJECT,REVISION),/Project unavailable/);
      await assert.rejects(()=>owner.exportRevision(PROJECT,REVISION),/Project unavailable/);
      assert.equal(queries.filter(query=>query.pathname==='/rest/v1/room_revisions').length,beforeQueries);
      assert.equal(imageRequests,beforeImages);assert.equal(signedRequests,beforeSigned);
      for(const query of queries.filter(query=>query.pathname==='/rest/v1/room_projects'))assert.equal(query.searchParams.get('deleting'),'eq.false');
    });
  }finally{globalThis.fetch=oldFetch;if(oldDeno===undefined)delete host.Deno;else host.Deno=oldDeno;}
});

test('revision exports reject a response for another identity before loading private artwork',async()=>{
  const project=historicalProject();
  const valid:RoomRevision={id:REVISION,projectId:PROJECT,number:3,createdAt:'2026-10-18T12:00:00Z',project};
  let response=valid,artworkRequests=0;
  const fetcher:typeof fetch=async(input,init)=>{
    if(String(input).endsWith('/auth/v1/verify'))return Response.json({access_token:'offline',refresh_token:'offline',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:OWNER}});
    if(JSON.parse(String(init?.body)).action==='getRevision')return Response.json(response);
    artworkRequests++;throw new Error('A mismatched revision must not request artwork');
  };
  const client=createCloudClient({enabled:true,url:BASE,anonKey:'publishable'},fetcher);
  await client.completeSignIn('fixture@example.test','123456');
  const variants=[{...valid,id:OTHER_REVISION},{...valid,projectId:SECOND},{...valid,project:{...project,id:SECOND}},{...valid,project:{...project,ownerId:OTHER}},{...valid,number:0},{...valid,project:{...project,revision:4}}];
  for(const value of variants){response=value;await assert.rejects(()=>client.exportRevision(PROJECT,REVISION),/version did not match/);}
  assert.equal(artworkRequests,0);
});
