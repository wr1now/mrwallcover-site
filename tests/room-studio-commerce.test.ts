import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'node:child_process';
import { checkoutConfigured,createStripe,verifyStripeSignature } from '../supabase/functions/room-studio/commerce.ts';
import { paymentHandler } from '../supabase/functions/room-studio/payment-handler.ts';

const OWNER='10000000-0000-4000-8000-000000000001',OTHER='20000000-0000-4000-8000-000000000002',PROJECT='30000000-0000-4000-8000-000000000003',ASSET='40000000-0000-4000-8000-000000000004',HASH='a'.repeat(64);
const config={enabled:true,secret:'sk_test_offline',webhookSecret:'whsec_offline',liveEnabled:false,origin:'https://www.mrwallcover.com'};
async function database(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);insert into auth.users values('${OWNER}'),('${OTHER}');`);
 for(const file of readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(v=>v.endsWith('.sql')).sort())await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.query('select room_save_project($1::uuid,$2::uuid,$3,$4::jsonb,0)',[OWNER,PROJECT,'Test room','{}']);
 const revision=(await db.query<any>('select * from room_confirm_revision($1::uuid,$2::uuid,$3::jsonb,0)',[OWNER,PROJECT,'{"room":{"confirmed":true}}'])).rows[0];
 await db.query('select room_reserve_asset($1::uuid,$2::uuid,$3::uuid,$4,$5,1024,$6,$7)',[OWNER,PROJECT,ASSET,'package','application/json',HASH,'json']);await db.exec(`update room_assets set state='ready'`);
 return {db,revision};
}
const enable=(db:PGlite)=>db.exec(`update room_studio_settings set checkout_enabled=true,paid_jobs_enabled=true,monthly_cap_pence=1000,render_reservation_pence=100,render_price_pence=1500,operating_allowance_pence=1000,tax_profile='{"approved":true,"mode":"inclusive","taxCode":"txcd_10000000","version":"test-only"}'`);
const prepare=async(db:PGlite,revision:string)=>(await db.query<any>('select * from room_prepare_order($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::jsonb)',[OWNER,PROJECT,revision,ASSET,'room-studio-geometry/2.0.0','[]'])).rows[0];
const pay=async(db:PGlite,o:any,event='evt_paid')=>(await db.query<any>('select * from room_receive_payment($1,$2,$3::uuid,$4,$5,$6,$7,$8::uuid,$9::uuid,$10::uuid,$11)',[event,'checkout.session.completed',o.id,'cs_offline_'+o.id.replaceAll('-',''),'pi_offline_'+o.id.replaceAll('-',''),o.amount_pence,o.currency,OWNER,PROJECT,o.revision_id,HASH])).rows[0];
async function readyOutputs(db:PGlite,job:any,bytes=1){
 const outputs=[];
 for(const kind of ['still-1','still-2','panorama']){const a=(await db.query<any>('select * from room_reserve_output($1::uuid,$2::uuid,gen_random_uuid(),$3,$4::bigint,$5,$6)',[job.id,job.lease_token,'image/png',bytes,HASH,'png'])).rows[0];await db.query("update room_assets set state='ready' where id=$1",[a.id]);outputs.push({kind,storagePath:a.storage_path,sha256:a.sha256});}
 return JSON.stringify(outputs);
}

test('unset price, tax, operating allowance and compute budget each fail closed; legacy render API cannot bypass checkout',async()=>{
 const {db,revision}=await database();try{
  await assert.rejects(()=>prepare(db,revision.id),/disabled/);await enable(db);
  for(const column of ['render_price_pence','tax_profile','operating_allowance_pence','monthly_cap_pence']){
   await db.exec('begin');await db.exec(`update room_studio_settings set ${column}=null`);await assert.rejects(()=>prepare(db,revision.id),/disabled/);await db.exec('rollback');
  }
  await assert.rejects(()=>db.query("select room_enqueue_job($1::uuid,$2::uuid,'render',$3,$4::uuid,'{}')",[OWNER,PROJECT,revision.id,revision.id]),/paid render order/);
 }finally{await db.close();}
});

test('checkout freezes price, reserves full output+compute capacity, deduplicates and admits only one account job',async()=>{
 const {db,revision}=await database();try{await enable(db);const o=await prepare(db,revision.id);assert.equal(o.amount_pence,1500);assert.equal(o.output_reserved_bytes,60*1024*1024);assert.equal((await prepare(db,revision.id)).id,o.id);
  await db.exec('update room_studio_settings set render_price_pence=9999');const paid=await pay(db,o);assert.equal(paid.amount_pence,1500);
  assert.equal((await pay(db,o,'evt_duplicate')).job_id,paid.job_id);assert.equal((await db.query('select * from room_jobs')).rows.length,1);
  assert.equal((await db.query<any>('select * from room_budget_months')).rows[0].reserved_pence,100);
  await assert.rejects(()=>prepare(db,revision.id),/One checkout/);
  await db.query('select room_reserve_asset($1::uuid,$2::uuid,gen_random_uuid(),$3,$4,20971520,$5,$6)',[OWNER,PROJECT,'artwork','image/png',HASH,'png']);
  await assert.rejects(()=>db.query('select room_reserve_asset($1::uuid,$2::uuid,gen_random_uuid(),$3,$4,20971520,$5,$6)',[OWNER,PROJECT,'artwork','image/png',HASH,'png']),/storage/);
 }finally{await db.close();}
});

test('expired late payment reserves again or creates a full-refund obligation without a job',async()=>{
 const {db,revision}=await database();try{await enable(db);const o=await prepare(db,revision.id);await db.exec("update room_render_orders set expires_at=now()-interval '1 second'");await db.exec('select room_expire_checkouts()');assert.equal((await db.query<any>('select * from room_budget_months')).rows[0].reserved_pence,0);
  const late=await pay(db,o);assert.equal(late.state,'queued');assert.equal((await db.query<any>('select * from room_budget_months')).rows[0].reserved_pence,100);
 }finally{await db.close();}
 const second=await database();try{await enable(second.db);const o=await prepare(second.db,second.revision.id);await second.db.exec("update room_render_orders set expires_at=now()-interval '1 second';select room_expire_checkouts();update room_studio_settings set monthly_cap_pence=50");const late=await pay(second.db,o);assert.equal(late.state,'refund_pending');assert.equal((await second.db.query('select * from room_jobs')).rows.length,0);}finally{await second.db.close();}
});

test('cancellation before claim refunds; cancellation after claim records support without invalidating the worker',async()=>{
 const {db,revision}=await database();try{await enable(db);const o=await pay(db,await prepare(db,revision.id));const cancelled=(await db.query<any>('select * from room_cancel_order($1::uuid,$2::uuid)',[OWNER,o.id])).rows[0];assert.equal(cancelled.state,'refund_pending');assert.equal((await db.query<any>("select * from room_claim_job('render')")).rows[0]?.id,null);assert.equal((await db.query<any>('select * from room_budget_months')).rows[0].committed_pence,0);
 }finally{await db.close();}
 const next=await database();try{await enable(next.db);const o=await pay(next.db,await prepare(next.db,next.revision.id));const j=(await next.db.query<any>("select * from room_claim_job('render')")).rows[0];const cancelled=(await next.db.query<any>('select * from room_cancel_order($1::uuid,$2::uuid)',[OWNER,o.id])).rows[0];assert.equal(cancelled.state,'running');assert.ok(cancelled.support_requested_at);await next.db.query('select room_finish_job($1::uuid,$2::uuid,true,$3::jsonb,null,false)',[j.id,j.lease_token,await readyOutputs(next.db,j)]);assert.equal((await next.db.query<any>('select * from room_render_orders')).rows[0].state,'delivered');}finally{await next.db.close();}
});

test('terminal failure commits compute, fences refund retries and permits a newly paid order for the same revision',async()=>{
 const {db,revision}=await database();try{await enable(db);const o=await pay(db,await prepare(db,revision.id));const j=(await db.query<any>("select * from room_claim_job('render')")).rows[0];await db.query('select room_finish_job($1::uuid,$2::uuid,false,$3::jsonb,$4,false)',[j.id,j.lease_token,'[]','failure']);
  const b=(await db.query<any>('select * from room_budget_months')).rows[0];assert.equal(b.committed_pence,100);assert.equal(b.reserved_pence,0);
  const refund=(await db.query<any>('select * from room_claim_refund()')).rows[0];assert.ok(refund.refund_token);assert.equal((await db.query<any>('select * from room_claim_refund()')).rows[0]?.id,null);
  await assert.rejects(()=>db.query('select room_finish_refund($1::uuid,$2::uuid,null,$3)',[o.id,OTHER,'succeeded']),/lease/);
  await db.query('select room_finish_refund($1::uuid,$2::uuid,$3,$4)',[o.id,refund.refund_token,'re_offline','succeeded']);assert.equal((await db.query<any>('select * from room_budget_months')).rows[0].committed_pence,100);
  const replacement=await prepare(db,revision.id);assert.notEqual(replacement.id,o.id);const again=await pay(db,replacement,'evt_repurchase');assert.notEqual(again.job_id,j.id);assert.equal((await db.query('select * from room_jobs')).rows.length,2);
 }finally{await db.close();}
});

test('output reservations convert to owned assets, recover on failed attempts and deny stale lease writes',async()=>{
 const {db,revision}=await database();try{await enable(db);const o=await pay(db,await prepare(db,revision.id));const j=(await db.query<any>("select * from room_claim_job('render')")).rows[0];
  await assert.rejects(()=>db.query('select room_reserve_output($1::uuid,$2::uuid,gen_random_uuid(),$3,100,$4,$5)',[j.id,OTHER,'image/png',HASH,'png']),/lease/);
  const a=(await db.query<any>('select * from room_reserve_output($1::uuid,$2::uuid,gen_random_uuid(),$3,100,$4,$5)',[j.id,j.lease_token,'image/png',HASH,'png'])).rows[0];
  assert.equal((await db.query<any>('select * from room_render_orders where id=$1',[o.id])).rows[0].output_reserved_bytes,62914560-100);
  await db.query('select room_claim_output_cleanup($1::uuid,$2::uuid)',[j.id,a.id]);await db.query('select room_release_output($1::uuid,$2::uuid)',[j.id,a.id]);assert.equal((await db.query<any>('select * from room_render_orders where id=$1',[o.id])).rows[0].output_reserved_bytes,62914560);
 }finally{await db.close();}
});

test('a killed attempt with an uploaded output can reclaim its full 60 MiB reservation and finish attempt two',async()=>{
 const {db,revision}=await database();try{await enable(db);const o=await pay(db,await prepare(db,revision.id));const first=(await db.query<any>("select * from room_claim_job('render')")).rows[0];
  const orphan=(await db.query<any>('select * from room_reserve_output($1::uuid,$2::uuid,gen_random_uuid(),$3,20971520,$4,$5)',[first.id,first.lease_token,'image/png',HASH,'png'])).rows[0];await db.query("update room_assets set state='ready' where id=$1",[orphan.id]);
  await db.query("update room_jobs set lease_until=now()-interval '1 second' where id=$1",[first.id]);const retry=(await db.query<any>("select * from room_claim_job('render')")).rows[0];assert.equal(retry.attempts,2);assert.notEqual(retry.lease_token,first.lease_token);
  // Actual worker recovery deletes the object first, then calls this fenced
  // registry release before writing any new output (separate Python test).
  await db.query('select room_claim_output_cleanup($1::uuid,$2::uuid)',[retry.id,orphan.id]);await db.query('select room_release_output($1::uuid,$2::uuid)',[retry.id,orphan.id]);
  const outputs=await readyOutputs(db,retry,20971520);
  assert.equal((await db.query<any>('select * from room_render_orders where id=$1',[o.id])).rows[0].output_reserved_bytes,0);
  await db.query('select room_finish_job($1::uuid,$2::uuid,true,$3::jsonb,null,false)',[retry.id,retry.lease_token,outputs]);assert.equal((await db.query<any>('select * from room_render_orders where id=$1',[o.id])).rows[0].state,'delivered');
 }finally{await db.close();}
});

test('immutable order metadata rejects price edits and mismatched payments; late payment after source deletion refunds safely',async()=>{
 const {db,revision}=await database();try{await enable(db);const o=await prepare(db,revision.id);
  await assert.rejects(()=>db.query('update room_render_orders set amount_pence=1 where id=$1',[o.id]),/immutable/);
  await assert.rejects(()=>pay(db,{...o,amount_pence:1}),/immutable order/);
  await db.query('select room_cancel_order($1::uuid,$2::uuid)',[OWNER,o.id]);await db.query('select room_mark_delete($1::uuid,$2::uuid)',[OWNER,PROJECT]);await db.query('delete from room_projects where id=$1',[PROJECT]);
  assert.equal((await pay(db,o,'evt_late_deleted')).state,'refund_pending');assert.equal((await db.query('select * from room_jobs')).rows.length,0);
 }finally{await db.close();}
});

test('publication and cleanup are mutually fenced; lease recovery refunds even after processing is disabled',async()=>{
 const {db,revision}=await database();try{await enable(db);await pay(db,await prepare(db,revision.id));const j=(await db.query<any>("select * from room_claim_job('render')")).rows[0],outputs=await readyOutputs(db,j),first=JSON.parse(outputs)[0];
  const asset=(await db.query<any>('select * from room_assets where storage_path=$1',[first.storagePath])).rows[0];await db.query('select room_claim_output_cleanup($1::uuid,$2::uuid)',[j.id,asset.id]);
  await assert.rejects(()=>db.query('select room_finish_job($1::uuid,$2::uuid,true,$3::jsonb,null,false)',[j.id,j.lease_token,outputs]),/ready output/);
  await db.query("update room_jobs set lease_until=now()-interval '1 second' where id=$1",[j.id]);await db.exec('update room_studio_settings set paid_jobs_enabled=false;select room_expire_worker_leases()');assert.equal((await db.query<any>('select * from room_render_orders')).rows[0].state,'refund_pending');
 }finally{await db.close();}
 const delivered=await database();try{await enable(delivered.db);await pay(delivered.db,await prepare(delivered.db,delivered.revision.id));const j=(await delivered.db.query<any>("select * from room_claim_job('render')")).rows[0],outputs=await readyOutputs(delivered.db,j);await delivered.db.query('select room_finish_job($1::uuid,$2::uuid,true,$3::jsonb,null,false)',[j.id,j.lease_token,outputs]);
  const asset=(await delivered.db.query<any>("select * from room_assets where job_id=$1 and kind='output' limit 1",[j.id])).rows[0];assert.equal((await delivered.db.query<any>('select (room_claim_output_cleanup($1::uuid,$2::uuid)).id as id',[j.id,asset.id])).rows[0].id,null);assert.equal((await delivered.db.query<any>('select state from room_assets where id=$1',[asset.id])).rows[0].state,'ready');
 }finally{await delivered.db.close();}
});

test('actual corrupt PNG/JPEG/WebP decode failures reach the paid-order full-refund path without Blender or published outputs',async()=>{
 const reports=JSON.parse(execFileSync('python3',['workers/room_studio/test_payments.py','--asset-failure-reports'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}));
 assert.equal(reports.length,3);
 for(const report of reports){assert.equal(report.blenderInvocations,0);assert.equal(report.finish.p_retryable,false);const {db,revision}=await database();try{
  await enable(db);const order=await pay(db,await prepare(db,revision.id));const job=(await db.query<any>("select * from room_claim_job('render')")).rows[0];
  await db.query('select room_finish_job($1::uuid,$2::uuid,$3,$4::jsonb,$5,$6)',[job.id,job.lease_token,report.finish.p_success,JSON.stringify(report.finish.p_outputs),report.finish.p_error,report.finish.p_retryable]);
  assert.equal((await db.query<any>('select * from room_render_orders where id=$1',[order.id])).rows[0].state,'refund_pending');
  const refund=(await db.query<any>('select * from room_claim_refund()')).rows[0];await db.query('select room_finish_refund($1::uuid,$2::uuid,$3,$4)',[order.id,refund.refund_token,'re_corrupt_fixture','succeeded']);
  assert.equal((await db.query<any>('select * from room_render_orders where id=$1',[order.id])).rows[0].state,'refunded');assert.equal((await db.query("select * from room_assets where kind='output'")).rows.length,0);
 }finally{await db.close();}}
});

test('photo saves share five-project quota, use optimistic heads and owner-isolated order reads',async()=>{
 const {db,revision}=await database();try{await enable(db);await prepare(db,revision.id);
  for(let i=4;i<=7;i++){const id=`30000000-0000-4000-8000-00000000000${i}`;await db.query("select room_save_photo_project($1::uuid,$2::uuid,'Photo','{}',0,true)",[OWNER,id]);}
  await assert.rejects(()=>db.query("select room_save_photo_project($1::uuid,$2::uuid,'Photo','{}',0,true)",[OWNER,'30000000-0000-4000-8000-000000000008']),/Five project/);
  const photo='30000000-0000-4000-8000-000000000004';await db.query("select room_save_photo_project($1::uuid,$2::uuid,'Photo','{}',0,false)",[OWNER,photo]);await assert.rejects(()=>db.query("select room_save_photo_project($1::uuid,$2::uuid,'Photo','{}',0,false)",[OWNER,photo]),/Revision conflict/);
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${OTHER}',false)`);assert.equal((await db.query('select * from room_render_orders')).rows.length,0);await assert.rejects(()=>db.exec('select room_claim_refund()'),/permission/);
 }finally{await db.close();}
});

test('authenticated storage uploads are exact-path, owner-bound, revocable and count worst-case pending file capacity',async()=>{
 const {db}=await database();try{
  const a=(await db.query<any>('select * from room_reserve_asset($1::uuid,$2::uuid,gen_random_uuid(),$3,$4,1,$5,$6)',[OWNER,PROJECT,'artwork','image/png',HASH,'png'])).rows[0];
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${OTHER}',false)`);
  await assert.rejects(()=>db.query("insert into storage.objects(bucket_id,name) values('room-studio',$1)",[a.storage_path]),/row-level security/);
  await db.exec(`select set_config('request.jwt.claim.sub','${OWNER}',false)`);
  await assert.rejects(()=>db.query("insert into storage.objects(bucket_id,name) values('room-studio',$1)",[a.storage_path+'-other']),/row-level security/);
  await db.query("insert into storage.objects(bucket_id,name) values('room-studio',$1)",[a.storage_path]);
  await db.exec('reset role');await db.query('select room_finish_upload($1::uuid,$2::uuid,true)',[OWNER,a.id]);
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${OWNER}',false)`);
  await assert.rejects(()=>db.query("insert into storage.objects(bucket_id,name) values('room-studio',$1)",[a.storage_path]),/row-level security/);
  await assert.rejects(()=>db.exec('update storage.objects set name=name'),/permission/);
  await db.exec('reset role');
  // One declared byte still reserves the bucket's maximum 20 MiB until the
  // checksum-verified completion. Cancelled rows retain capacity until removed.
  for(let i=0;i<3;i++)await db.query('select room_reserve_asset($1::uuid,$2::uuid,gen_random_uuid(),$3,$4,1,$5,$6)',[OWNER,PROJECT,'room-photo','image/png',HASH,'png']);
  await assert.rejects(()=>db.query('select room_reserve_asset($1::uuid,$2::uuid,gen_random_uuid(),$3,$4,1,$5,$6)',[OWNER,PROJECT,'plan','image/png',HASH,'png']),/storage limit/);
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${OWNER}',false)`);
  assert.equal((await db.query<any>("select has_function_privilege('anon','room_studio_private.upload_allowed(text)','EXECUTE') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

async function signature(raw:string,stamp=Math.floor(Date.now()/1000)){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.webhookSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(stamp+'.'+raw)));return `t=${stamp},v1=${Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}`;}
test('Stripe boundary uses hosted, frozen, idempotent checkout; live secrets stay blocked by default',async()=>{
 assert.equal(checkoutConfigured({...config,secret:'sk_live_disabled'}),false);assert.equal(checkoutConfigured({...config,webhookSecret:''}),false);let calls=0;
 const stripe=createStripe(config,async(url,init)=>{calls++;assert.equal(String(url),'https://api.stripe.com/v1/checkout/sessions');const p=new URLSearchParams(String(init?.body));assert.equal(p.get('line_items[0][price_data][unit_amount]'),'1500');assert.equal(p.get('payment_method_types[0]'),'card');assert.equal(new Headers(init?.headers).get('Idempotency-Key'),'room-checkout-test');assert.equal(new Headers(init?.headers).get('Stripe-Version'),'2026-09-30.endive');return Response.json({id:'cs_offline',url:'https://checkout.stripe.com/c/pay/offline',expires_at:Number(p.get('expires_at'))});});
 await stripe.checkout({id:'test',owner_id:OWNER,project_id:PROJECT,revision_id:OTHER,amount_pence:1500,currency:'gbp',expires_at:new Date(Date.now()+1860000).toISOString(),package_sha256:HASH,tax_profile:{approved:true,mode:'inclusive',taxCode:'txcd_10000000',version:'test'}});assert.equal(calls,1);
});

test('raw-body signatures reject alteration/replay; webhook retrieves provider truth and ignores unpaid/out-of-order events',async()=>{
 const event={id:'evt_offline',type:'checkout.session.completed',data:{object:{id:'cs_offline',payment_status:'paid'}}},raw=JSON.stringify(event);await verifyStripeSignature(raw,await signature(raw),config.webhookSecret);await assert.rejects(()=>verifyStripeSignature(raw+' ',null,config.webhookSecret),/signature/);await assert.rejects(async()=>verifyStripeSignature(raw,await signature(raw,1),config.webhookSecret),/Expired/);
 let paid=false,calls=0;const handler=paymentHandler(config,async(name,args)=>{calls++;assert.equal(name,'room_receive_payment');assert.equal(args.p_amount,1500);return {};},async()=>({id:'cs_offline',expires_at:0,payment_status:paid?'paid':'unpaid',amount_total:1500,currency:'gbp',client_reference_id:'order',metadata:{orderId:'order',ownerId:OWNER,projectId:PROJECT,revisionId:OTHER,packageSha256:HASH},payment_intent:'pi_offline',livemode:false}));
 const request=async()=>new Request('https://example.test/webhook',{method:'POST',headers:{'stripe-signature':await signature(raw)},body:raw});assert.equal((await handler(await request())).status,200);assert.equal(calls,0);paid=true;assert.equal((await handler(await request())).status,200);assert.equal(calls,1);
});
