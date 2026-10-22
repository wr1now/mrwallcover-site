import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { createCloudClient } from '../src/room-studio/cloud.ts';
import { fixtureProject } from '../src/room-studio/fixtures.ts';
import { validateProject } from '../src/room-studio/validation.ts';
import { ownedPath, uploadSpec, sniffMime, planCrop, paidProcessingAvailable, storageSignedUrl } from '../supabase/functions/room-studio/guards.ts';

const OWNER='10000000-0000-4000-8000-000000000001';
const OTHER='20000000-0000-4000-8000-000000000002';
const PROJECT='30000000-0000-4000-8000-000000000003';
const sha='a'.repeat(64);
async function database() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    insert into auth.users(id) values('${OWNER}'),('${OTHER}');`);
  for(const file of readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(v=>v.endsWith('.sql')).sort())await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  return db;
}
const save=(db:PGlite,id=PROJECT,owner=OWNER)=>db.query('select * from room_save_project($1::uuid,$2::uuid,$3,$4::jsonb,0)',[owner,id,'My room','{}']);
const enable=(db:PGlite)=>db.exec('update room_studio_settings set paid_jobs_enabled=true,live_ai_enabled=true,monthly_cap_pence=1000,analysis_reservation_pence=30,render_reservation_pence=100');
const enqueue=(db:PGlite,type='analysis',identity='input-1',owner=OWNER,project=PROJECT,revision:string|null=null)=>db.query<any>('select * from room_enqueue_job($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::jsonb)',[owner,project,type,identity,revision,'{}']);

test('all cloud and paid processing remains off without explicit flags, even with keys',async()=>{
  let calls=0;
  const client=createCloudClient({enabled:false,url:'https://example.supabase.co',anonKey:'publishable'},async()=>{calls++;return new Response('{}');});
  await assert.rejects(()=>client.signIn('customer@example.test'),/not configured/);
  await assert.rejects(()=>client.listProjects(),/not configured/);
  assert.equal(calls,0);
  assert.equal(paidProcessingAvailable({paidJobsEnabled:true,reservationPence:100},'render'),false);
  assert.equal(paidProcessingAvailable({paidJobsEnabled:true,monthlyCapPence:1000,reservationPence:100,liveAiEnabled:false},'analysis'),false);
});

test('private upload guards reject hostile paths, wrong files and invalid crops',()=>{
  const path=`${OWNER}/${PROJECT}/40000000-0000-4000-8000-000000000004.png`;
  assert.equal(ownedPath(path,OWNER,PROJECT),path);
  assert.throws(()=>ownedPath(path,OTHER,PROJECT),/unavailable/);
  assert.throws(()=>ownedPath('https://example.test/secret',OWNER,PROJECT),/unavailable/);
  assert.throws(()=>ownedPath(`${OWNER}/${PROJECT}/../secret.png`,OWNER,PROJECT),/unavailable/);
  assert.throws(()=>uploadSpec({kind:'artwork',mime:'image/svg+xml',bytes:20,sha256:sha}),/PNG/);
  assert.throws(()=>uploadSpec({kind:'artwork',mime:'application/pdf',bytes:20,sha256:sha}),/PNG/);
  assert.equal(uploadSpec({kind:'plan',mime:'application/pdf',bytes:20,sha256:sha}).extension,'pdf');
  assert.equal(sniffMime(new TextEncoder().encode('<svg></svg>')),null);
  assert.equal(sniffMime(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
  assert.deepEqual(planCrop({x:.1,y:.2,width:.5,height:.4}),{x:.1,y:.2,width:.5,height:.4});
  assert.throws(()=>planCrop({x:.9,y:0,width:.3,height:1}),/inside/);
  assert.equal(storageSignedUrl('https://example.supabase.co','/object/upload/sign/room-studio/image.png?token=example'),'https://example.supabase.co/storage/v1/object/upload/sign/room-studio/image.png?token=example');
  assert.throws(()=>storageSignedUrl('https://example.supabase.co','//elsewhere.example/upload'),/Invalid/);
});

test('Edge actions verify email/origin, keep AI disabled, and hide another owner project',async()=>{
  const host=globalThis as typeof globalThis&{Deno?:unknown};
  const oldDeno=host.Deno,oldFetch=globalThis.fetch;
  const env:Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-token',SUPABASE_ANON_KEY:'publishable-test',ROOM_STUDIO_CLOUD_ENABLED:'true'};
  let handler:((request:Request)=>Promise<Response>)|undefined;
  let verified=true;const requests:string[]=[], writes:Record<string,any>[]=[];
  host.Deno={env:{get:(key:string)=>env[key]},serve:(fn:typeof handler)=>{handler=fn;}};
  globalThis.fetch=async(input,init)=>{
    const url=String(input);requests.push(url);
    if(url.endsWith('/auth/v1/user'))return Response.json({id:OWNER,email:'customer@example.test',email_confirmed_at:verified?'2026-10-18T00:00:00Z':null,is_anonymous:false});
    if(url.includes('/room_studio_settings?'))return Response.json([{paid_jobs_enabled:true,live_ai_enabled:true,monthly_cap_pence:1000,analysis_reservation_pence:30,render_reservation_pence:100}]);
    if(url.includes('/rest/v1/rpc/room_prepare_project')||url.includes('/rest/v1/rpc/room_save_project')) {
      const body=JSON.parse(String(init?.body));writes.push(body);
      assert.equal(body.p_snapshot.revision,0,'first cloud draft keeps its optimistic database head at zero');
      if(url.includes('room_save_project'))assert.equal(body.p_expected_revision,0);
      return Response.json({id:PROJECT,owner_id:OWNER,snapshot:body.p_snapshot,revision:0,updated_at:'2026-10-18T00:00:00+00:00',expires_at:'2027-01-16T00:00:00+00:00',expiry_notice_at:null});
    }
    if(url.includes('/room_assets?'))return Response.json([]);
    if(url.includes('/room_projects?')){assert.match(url,new RegExp(`owner_id=eq.${OWNER}`));return Response.json([]);}
    throw new Error('Unexpected network route in offline test: '+url);
  };
  try {
    await import('../supabase/functions/room-studio/index.ts');
    const request=(body:unknown,origin='https://www.mrwallcover.com')=>new Request('https://example.supabase.co/functions/v1/room-studio',{method:'POST',headers:{Origin:origin,Authorization:'Bearer customer-test','Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await handler!(request({action:'listProjects'},'https://other.example'))).status,403);
    assert.equal(requests.length,0);
    verified=false;assert.equal((await handler!(request({action:'listProjects'}))).status,403);
    verified=true;
    const capability=await handler!(request({action:'capabilities'}));
    assert.deepEqual(await capability.json(),{analysisEnabled:false,renderEnabled:false,checkoutEnabled:false,renderPricePence:null,currency:'gbp',projects:5,analysesPerDay:2,rendersPerDay:0,activeJobs:1});
    const ai=await handler!(request({action:'enqueueAnalysis',projectId:PROJECT,assetId:PROJECT}));assert.equal(ai.status,503);
    const other=await handler!(request({action:'getProject',projectId:PROJECT}));assert.equal(other.status,400);assert.match((await other.json()).error,/unavailable/);
    const draft={...fixtureProject(),id:PROJECT,revision:0,finishes:[],assignments:[]};
    for(const action of ['prepareProject','saveProject']) {
      const result=await handler!(request({action,project:draft}));
      assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
      assert.equal((await result.json()).project.revision,0);
    }
    assert.equal(writes.length,2);
    const invalid={...draft,schemes:[{id:'bad',name:'Bad import',finishes:[{...fixtureProject().finishes[2],productUrl:'javascript:alert(1)'}],assignments:[]}]};
    const rejected=await handler!(request({action:'saveProject',project:invalid}));
    assert.equal(rejected.status,400);assert.match((await rejected.json()).error,/official Bauwerk/);
    assert.equal(writes.length,2,'invalid nested metadata never reaches a mutation');
    assert.equal(requests.some(url=>url.includes('openai.com')),false);
  } finally {globalThis.fetch=oldFetch;if(oldDeno===undefined)delete host.Deno;else host.Deno=oldDeno;}
});

test('cloud exports embed artwork across revisions and schemes, surviving signed link expiry',async()=>{
  const path=`${OWNER}/${PROJECT}/40000000-0000-4000-8000-000000000004.png`;
  const finish={id:'wallpaper',type:'wallpaper',name:'Original fixture',texture:{id:'texture-fixture',mime:'image/png',sha256:sha,widthPx:1,heightPx:1,storagePath:path},calibration:{}};
  const project={schemaVersion:1,id:PROJECT,ownerId:OWNER,name:'Export fixture',revision:1,updatedAt:new Date().toISOString(),room:{},finishes:[finish],assignments:[],cameras:[],lighting:'daylight',schemes:[{id:'scheme',name:'Scheme',finishes:[structuredClone(finish)],assignments:[]}]};
  let imageRequests=0;
  const fetcher:typeof fetch=async(input)=>{
    const url=String(input);
    if(url.endsWith('/auth/v1/verify'))return Response.json({access_token:'test',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:OWNER,email:'customer@example.test'}});
    if(url.includes('/storage/v1/')){imageRequests++;return new Response(new Uint8Array([137,80,78,71,13,10,26,10]),{headers:{'Content-Type':'image/png'}});}
    return Response.json({project:structuredClone(project),revisions:[{id:PROJECT,number:1,projectId:PROJECT,createdAt:new Date().toISOString(),project:structuredClone(project)}],assets:[],expiresAt:'2027-01-01T00:00:00Z'});
  };
  const wrapped:typeof fetch=async(input,init)=>{
    if(String(input).endsWith('/functions/v1/room-studio')&&JSON.parse(String(init?.body)).action==='signedAssetUrl')return Response.json({url:'https://example.supabase.co/storage/v1/object/sign/room-studio/image.png?token=expires',expiresIn:300});
    return fetcher(input,init);
  };
  const client=createCloudClient({enabled:true,url:'https://example.supabase.co',anonKey:'publishable'},wrapped);
  await client.completeSignIn('customer@example.test','123456');
  const exported=await client.exportProject(PROJECT);
  assert.equal(imageRequests,1,'same asset is downloaded once across snapshots and schemes');
  for(const p of [exported.project,...exported.revisions.map(r=>r.project)]) {
    for(const f of [...p.finishes,...p.schemes.flatMap(s=>s.finishes)]) {
      if(f.type==='wallpaper'||f.type==='mural'){assert.match(f.texture.dataUrl||'',/^data:image\/png;base64,/);assert.equal(f.texture.storagePath,undefined);}
    }
  }
  assert.equal(exported.editableArtworkIncluded,true);
});

test('cloud draft zero head reopens and exports as editable local revision one while saves retain zero',async()=>{
  const project={...fixtureProject(),id:PROJECT,ownerId:OWNER,revision:0,finishes:[],assignments:[]};
  const actions:Record<string,any>[]=[];
  const fetcher:typeof fetch=async(input,init)=>{
    if(String(input).endsWith('/auth/v1/verify'))return Response.json({access_token:'test',refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:OWNER}});
    const body=JSON.parse(String(init?.body));actions.push(body);
    if(body.action==='exportProject')return Response.json({project:structuredClone(project),revisions:[],assets:[],expiresAt:'2027-01-01T00:00:00Z'});
    return Response.json({project:structuredClone(project),expiresAt:'2027-01-01T00:00:00Z',expiryNoticeAt:null});
  };
  const client=createCloudClient({enabled:true,url:'https://example.supabase.co',anonKey:'publishable'},fetcher);
  await client.completeSignIn('customer@example.test','123456');
  const reopened=await client.getProject(PROJECT);
  assert.equal(reopened.project.revision,1);assert.deepEqual(validateProject(reopened.project),[]);
  reopened.project.revision=15;
  await client.saveProject(reopened.project);
  assert.equal(actions.find(a=>a.action==='saveProject')?.project.revision,0,'local revision never replaces the observed SQL head');
  const exported=await client.exportProject(PROJECT);
  assert.equal(exported.project.revision,1);assert.deepEqual(validateProject(exported.project),[]);
});

test('database enforces five projects, ownership, immutable revision numbering and RLS',async()=>{
  const db=await database();
  try {
    await save(db);
    for(let i=4;i<8;i++)await save(db,`30000000-0000-4000-8000-00000000000${i}`);
    await assert.rejects(()=>save(db,'30000000-0000-4000-8000-000000000008'),/Five project/);
    await assert.rejects(()=>save(db,PROJECT,OTHER),/unavailable/);
    const first=await db.query<any>('select * from room_confirm_revision($1::uuid,$2::uuid,$3::jsonb,0)',[OWNER,PROJECT,'{"room":{"confirmed":true}}']);
    const again=await db.query<any>('select * from room_confirm_revision($1::uuid,$2::uuid,$3::jsonb,0)',[OWNER,PROJECT,'{"room":{"confirmed":true}}']);
    assert.equal(first.rows[0].id,again.rows[0].id);
    await assert.rejects(()=>db.query('select room_confirm_revision($1::uuid,$2::uuid,$3::jsonb,0)',[OWNER,PROJECT,'{"room":{"confirmed":false}}']),/Revision conflict/);
    await assert.rejects(()=>db.exec("update room_revisions set snapshot='{}'"),/immutable/);
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${OTHER}',false)`);
    assert.equal((await db.query('select * from room_projects')).rows.length,0);
    assert.equal((await db.query('select * from room_revisions')).rows.length,0);
    await assert.rejects(()=>db.exec(`select room_prepare_project('${OWNER}','${PROJECT}','intrusion','{}')`),/permission denied/);
    await assert.rejects(()=>db.exec(`update room_revisions set snapshot='{}'`),/permission denied/);
  } finally {await db.close();}
});

test('atomic job admission deduplicates input, enforces one active job and bounded retries',async()=>{
  const db=await database();
  try {
    await save(db);
    await assert.rejects(()=>enqueue(db),/disabled/);
    await db.exec('update room_studio_settings set paid_jobs_enabled=true,monthly_cap_pence=1000,analysis_reservation_pence=30');
    await assert.rejects(()=>enqueue(db),/Live AI/);
    await enable(db);
    const a=(await enqueue(db)).rows[0];
    const duplicate=(await enqueue(db)).rows[0];assert.equal(a.id,duplicate.id);
    await assert.rejects(()=>enqueue(db,'analysis','input-2'),/One active/);
    const claimed=(await db.query<any>("select * from room_claim_job('analysis')")).rows[0];
    assert.equal(claimed.attempts,1);assert.equal(claimed.state,'running');
    await db.query('select room_finish_job($1::uuid,$2::uuid,false,$3::jsonb,$4,true)',[a.id,claimed.lease_token,'[]','Temporary failure']);
    const retry=(await db.query<any>("select * from room_claim_job('analysis')")).rows[0];assert.equal(retry.attempts,2);
    await assert.rejects(()=>db.query('select room_finish_job($1::uuid,$2::uuid,true,$3::jsonb,null,false)',[a.id,claimed.lease_token,'[]']),/lease/);
    await db.query('select room_finish_job($1::uuid,$2::uuid,false,$3::jsonb,$4,true)',[a.id,retry.lease_token,'[]','Final failure']);
    const job=(await db.query<any>('select * from room_jobs where id=$1',[a.id])).rows[0];assert.equal(job.state,'failed');
    const budget=(await db.query<any>('select * from room_budget_months')).rows[0];assert.equal(budget.reserved_pence,0);assert.equal(budget.committed_pence,30);
    await enqueue(db,'analysis','input-2');
    const second=(await db.query<any>("select * from room_claim_job('analysis')")).rows[0];
    await db.query('select room_finish_job($1::uuid,$2::uuid,true,$3::jsonb,null,false)',[second.id,second.lease_token,'[]']);
    await assert.rejects(()=>enqueue(db,'analysis','input-3'),/Daily allowance/);
  } finally {await db.close();}
});

test('global budget is shared across owners, and deleting a queued project releases its reservation',async()=>{
  const db=await database();
  try {
    await save(db);await save(db,'30000000-0000-4000-8000-000000000009',OTHER);await enable(db);
    await db.exec('update room_studio_settings set monthly_cap_pence=40');
    await enqueue(db);
    await assert.rejects(()=>enqueue(db,'analysis','other',OTHER,'30000000-0000-4000-8000-000000000009'),/Monthly/);
    await db.query('select room_mark_delete($1::uuid,$2::uuid)',[OWNER,PROJECT]);
    const budget=(await db.query<any>('select * from room_budget_months')).rows[0];assert.equal(budget.reserved_pence,0);assert.equal(budget.committed_pence,0);
    await enqueue(db,'analysis','other',OTHER,'30000000-0000-4000-8000-000000000009');
  } finally {await db.close();}
});

test('legacy render submissions reject missing payment even with an owned revision and processing budget',async()=>{
  const db=await database();
  try {
    await save(db);await enable(db);
    const revision=(await db.query<any>('select * from room_confirm_revision($1::uuid,$2::uuid,$3::jsonb,0)',[OWNER,PROJECT,'{"room":{"confirmed":true}}'])).rows[0];
    await assert.rejects(()=>enqueue(db,'render',revision.id,OWNER,PROJECT,revision.id),/paid render order/);
    assert.equal((await db.query('select * from room_jobs')).rows.length,0);
  } finally {await db.close();}
});

test('upload cancellation cannot make a cancelled object ready or remove an already ready object',async()=>{
  const db=await database();
  try {
    await save(db);
    const id='40000000-0000-4000-8000-000000000004';
    await db.query('select room_reserve_asset($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::bigint,$7,$8)',[OWNER,PROJECT,id,'artwork','image/png',8,sha,'png']);
    await db.query('select room_finish_upload($1::uuid,$2::uuid,true)',[OWNER,id]);
    await assert.rejects(()=>db.query('select room_finish_upload($1::uuid,$2::uuid,false)',[OWNER,id]),/cancelled/);
    const other='40000000-0000-4000-8000-000000000005';
    await db.query('select room_reserve_asset($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::bigint,$7,$8)',[OWNER,PROJECT,other,'artwork','image/png',8,sha,'png']);
    await db.query('select room_finish_upload($1::uuid,$2::uuid,false)',[OWNER,other]);
    const cancellation=(await db.query<any>('select room_finish_upload($1::uuid,$2::uuid,true) as asset',[OWNER,other])).rows[0];assert.equal(cancellation.asset,null);
    assert.equal((await db.query<any>('select state from room_assets where id=$1',[other])).rows[0].state,'ready');
  } finally {await db.close();}
});

test('retention requires an advance notice, and a save cancels a stale notice',async()=>{
  const db=await database();
  try {
    await save(db);
    await db.exec("update room_projects set expires_at=now()-interval '1 day'");
    assert.equal((await db.query('select * from room_retention_candidates()')).rows.length,0);
    assert.equal((await db.query('select * from room_expiry_notices')).rows.length,1);
    await db.exec("update room_projects set expiry_notice_at=now()-interval '8 days'");
    assert.equal((await db.query('select * from room_retention_candidates()')).rows.length,1);
    await save(db);
    assert.equal((await db.query('select * from room_expiry_notices')).rows.length,0);
    assert.equal((await db.query('select * from room_retention_candidates()')).rows.length,0);
    assert.equal((await db.query<any>('select room_mark_delete($1::uuid,$2::uuid,true) as paths',[OWNER,PROJECT])).rows[0].paths,null);
    assert.equal((await db.query<any>('select deleting from room_projects where id=$1',[PROJECT])).rows[0].deleting,false);
  } finally {await db.close();}
});

test('floor-plan worker validates offline proposals, never fabricates scale, and bounds model repair',()=>{
  const python=String.raw`
import json,os,sys
sys.path.insert(0,'workers/room_studio')
from import_plan import analyse_plan,validate_proposal,validate_crop,PlanError
e={'widthPx':800,'heightPx':600,'text':'Room 4 m','source':'offline fixture','lines':[],'previewBase64':''}
p={'verticesPx':[[0,0],[400,0],[400,300],[0,300]],'openings':[],'scaleEvidence':{'fromPx':[0,0],'toPx':[400,0],'lengthMm':4000,'sourceText':'4 m'},'ceilingHeightMm':None,'ceilingHeightSource':''}
r=analyse_plan('unused',proposal=p,evidence=e)
assert r['scaleKnown'] and not r['heightKnown'] and r['room']['vertices'][1]['x']==4000 and not r['room']['confirmed']
assert r['room']['heightMm']==0
opening=dict(p,openings=[{'kind':'window','wallIndex':0,'offsetPx':50,'widthPx':80}])
unmeasured=analyse_plan('unused',proposal=opening,evidence=e)
assert not unmeasured['room']['openings'] and any('not added' in issue['message'] for issue in unmeasured['issues'])
outside=dict(p,scaleEvidence=dict(p['scaleEvidence'],fromPx=[-1,0]))
assert validate_proposal(outside,e)
assert validate_proposal(p,dict(e,text='Room 24 m'))
unknown=dict(p,scaleEvidence=None)
assert analyse_plan('unused',proposal=unknown,evidence=e)['room'] is None
bad=dict(p,verticesPx=[[0,0],[400,300],[400,0],[0,300]])
assert validate_proposal(bad,e)
wrong=dict(p,scaleEvidence=dict(p['scaleEvidence'],lengthMm=9000))
assert validate_proposal(wrong,e)
os.environ['ROOM_STUDIO_VISION_API_KEY']='present-but-unused'
os.environ.pop('ROOM_STUDIO_LIVE_AI_ENABLED',None)
try: analyse_plan('unused',evidence=e,model_call=lambda *args: (_ for _ in ()).throw(Exception('must not call')))
except PlanError as error: assert 'disabled' in str(error)
else: raise AssertionError('AI enabled without flag')
os.environ['ROOM_STUDIO_LIVE_AI_ENABLED']='true'
calls=[]
def model(*args): calls.append(1);return bad
assert analyse_plan('unused',evidence=e,model_call=model)['room'] is None and len(calls)==2
try: validate_crop({'x':0.9,'y':0,'width':.3,'height':1})
except PlanError: pass
else: raise AssertionError('crop escapes image')
print('offline proposal checks passed')
`;
  const output=execFileSync('python3',['-c',python],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.match(output,/offline proposal checks passed/);
});
