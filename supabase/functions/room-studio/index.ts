// Supabase Edge actions are short authenticated database/storage operations.
// Rendering, OCR and model requests only run in the separately gated worker.
import { uuid, integer, ownedPath, uploadSpec, sniffMime, exactOrigin, assertNoInlineOrRemoteAssets, LIMITS, planCrop, paidProcessingAvailable, storageSignedUrl } from './guards.ts';
import { validateProject } from '../../../src/room-studio/validation.ts';
import { finishTextures, artworkCoverageIssues } from '../../../src/room-studio/wall-runs.ts';
import { resolveCatalogueFinish } from '../../../src/room-studio/catalogue-products.ts';
import { collectPhotoTextures, validatePhotoProject } from '../../../src/room-studio/photo-validation.ts';
import type { PhotoProject } from '../../../src/room-studio/photo-types.ts';
import { checkoutConfigured, createStripe, taxProfile } from './commerce.ts';
import { assertPortableJson, PORTABLE_DOCUMENT_BUDGET_BYTES } from '../../../src/room-studio/portable.ts';
import { compileRoom } from '../../../src/room-studio/geometry.ts';
import type { RoomProject, RoomRevision, TextureAsset } from '../../../src/room-studio/types.ts';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):unknown};

const env=(name:string)=>Deno.env.get(name)||'';
const SUPABASE=env('SUPABASE_URL').replace(/\/$/,'');
const SERVICE=env('SUPABASE_SERVICE_ROLE_KEY');
const ANON=env('SUPABASE_ANON_KEY');
const BUCKET='room-studio';
const origins=(env('ROOM_STUDIO_ALLOWED_ORIGINS')||'https://www.mrwallcover.com').split(',').map(v=>v.trim());
const safeMessage=(error:unknown)=>error instanceof Error?error.message:'The room service could not complete this request';
type Row=Record<string,any>;
async function service(path:string,init:RequestInit={}):Promise<any> {
  const response=await fetch(`${SUPABASE}${path}`,{...init,headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,'Content-Type':'application/json',...init.headers}});
  if(!response.ok){const result=await response.json().catch(()=>({}));throw new Error(result.message||result.error||'Private storage request failed');}
  return response.status===204?null:response.json().catch(()=>null);
}
const db=(table:string,query:string,init?:RequestInit)=>service(`/rest/v1/${table}?${query}`,init);
const rpc=(name:string,args:Record<string,unknown>)=>service(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(args)});
const eq=(value:string)=>encodeURIComponent(value);
async function projectRow(owner:string,id:string):Promise<Row> {
  const rows=await db('room_projects',`id=eq.${uuid(id)}&owner_id=eq.${owner}&deleting=eq.false`);
  if(rows.length!==1)throw new Error('Project unavailable');return rows[0];
}
const cloudPhoto=(row:Row)=>({project:{...row.snapshot,id:row.id,ownerId:row.owner_id,revision:Math.max(1,row.revision),updatedAt:row.updated_at},expiresAt:row.expires_at,expiryNoticeAt:row.expiry_notice_at,headRevision:row.revision});
const cloudOrder=(row:Row)=>({id:row.id,projectId:row.project_id,revisionId:row.revision_id,state:row.state,amountPence:row.amount_pence,currency:row.currency,packageSha256:row.package_sha256,expiresAt:row.expires_at,checkoutUrl:row.state==='checkout_pending'?row.checkout_url:undefined,jobId:row.job_id,processingStarted:Boolean(row.started_at),supportRequestedAt:row.support_requested_at,error:row.error,createdAt:row.created_at,updatedAt:row.updated_at});
const paymentConfig=()=>({enabled:env('ROOM_STUDIO_CHECKOUT_ENABLED')==='true'&&env('ROOM_STUDIO_PAYMENT_PIPELINE_VERIFIED')==='true',secret:env('ROOM_STUDIO_STRIPE_SECRET_KEY'),webhookSecret:env('ROOM_STUDIO_STRIPE_WEBHOOK_SECRET'),liveEnabled:env('ROOM_STUDIO_PAYMENTS_LIVE_ENABLED')==='true',origin:origins[0]});
const cloudProject=(row:Row)=>({project:{...row.snapshot,id:row.id,ownerId:row.owner_id,revision:row.revision,updatedAt:row.updated_at},expiresAt:row.expires_at,expiryNoticeAt:row.expiry_notice_at});
const cloudRevision=(row:Row):RoomRevision=>({id:row.id,projectId:row.project_id,number:row.number,createdAt:row.created_at,project:{...row.snapshot,revision:row.number,ownerId:row.owner_id} as RoomProject});
const cloudAsset=(row:Row)=>({id:row.id,storagePath:row.storage_path,sha256:row.sha256,mime:row.mime,bytes:row.bytes});
const cloudJob=(row:Row)=>({id:row.id,ownerId:row.owner_id,type:row.type,inputIdentity:row.input_identity,revisionId:row.revision_id,state:row.state,orderId:row.order_id,reservedPence:row.reserved_pence,attempts:row.attempts,error:row.error,outputs:row.outputs,createdAt:row.created_at,updatedAt:row.updated_at});
function cleanProject(input:unknown,owner:string):RoomProject {
  const p=structuredClone(input) as RoomProject;
  if(!p||typeof p!=='object'||![1,2].includes(p.schemaVersion))throw new Error('Unsupported room file');
  p.id=uuid(p.id);p.ownerId=owner;
  integer(p.revision,0,100000,'revision');
  // Zero is the database head before its first confirmed snapshot. Local scene
  // revisions start at one; validate the content without changing the SQL head.
  const issues=validateProject({...p,revision:Math.max(1,p.revision)});if(issues.length)throw new Error(issues[0].message);
  for(const finish of [...p.finishes,...p.schemes.flatMap(s=>s.finishes)])resolveCatalogueFinish(finish);
  assertNoInlineOrRemoteAssets(p);
  if(new TextEncoder().encode(JSON.stringify(p)).length>LIMITS.projectJsonBytes)throw new Error('Room file is too large');
  return p;
}
function textures(p:RoomProject):TextureAsset[] {
  return [...p.finishes,...p.schemes.flatMap(s=>s.finishes)].flatMap(f=>(f.type==='wallpaper'||f.type==='mural')?[f.texture,...finishTextures(f)]:[]);
}
function unconfirmedAppliedArtwork(p:RoomProject):boolean {
  const assigned=new Set(p.assignments.map(a=>a.finishId));
  return p.finishes.some(f=>assigned.has(f.id)&&(f.type==='wallpaper'||f.type==='mural')&&!f.calibration.proofAccepted);
}
async function verifyTextures(p:RoomProject,owner:string) {
  const rows:Row[]=await db('room_assets',`owner_id=eq.${owner}&project_id=eq.${p.id}&kind=eq.artwork&state=eq.ready`);
  for(const texture of textures(p)) {
    const path=ownedPath(texture.storagePath,owner,p.id);
    if(!rows.some(a=>a.storage_path===path&&a.sha256===texture.sha256&&a.mime===texture.mime))throw new Error('Upload each wallpaper image to this private project first');
    if(!Number.isInteger(texture.widthPx)||!Number.isInteger(texture.heightPx)||texture.widthPx<1||texture.heightPx<1||texture.widthPx*texture.heightPx>LIMITS.imagePixels)throw new Error('Artwork exceeds the image pixel limit');
  }
  assertPortableAssets(p,textures(p),rows,owner,p.id);
}
/** Budget every embedded occurrence, including saved schemes/panels. Unique
 * private storage bytes alone do not bound the size of a portable JSON file. */
function assertPortableAssets(value:unknown,references:TextureAsset[],rows:Row[],owner:string,project:string) {
  const bytes=new Map<string,number>();
  for(const texture of references) {
    const path=ownedPath(texture.storagePath,owner,project);
    const asset=rows.find(row=>row.storage_path===path&&row.sha256===texture.sha256&&row.mime===texture.mime);
    if(!asset||!Number.isSafeInteger(asset.bytes)||asset.bytes<1||asset.bytes>LIMITS.fileBytes)throw new Error('The original private image size is unavailable. Reattach the source before exporting.');
    bytes.set(texture.sha256,asset.bytes);
  }
  assertPortableJson(value,PORTABLE_DOCUMENT_BUDGET_BYTES,bytes);
}
async function signed(path:string):Promise<string> {
  const result=await service(`/storage/v1/object/sign/${BUCKET}/${path}`,{method:'POST',body:JSON.stringify({expiresIn:300})});
  return storageSignedUrl(SUPABASE,result.signedURL||result.signedUrl);
}
async function assetRow(owner:string,project:string,id?:string,path?:string):Promise<Row> {
  const filter=id?`id=eq.${uuid(id)}`:`storage_path=eq.${eq(ownedPath(path,owner,project))}`;
  const rows=await db('room_assets',`${filter}&owner_id=eq.${owner}&project_id=eq.${uuid(project)}`);
  if(rows.length!==1)throw new Error('Private asset unavailable');return rows[0];
}
async function downloadPrivate(path:string):Promise<Uint8Array>;
async function downloadPrivate(path:string,missingOk:true):Promise<Uint8Array|null>;
async function downloadPrivate(path:string,missingOk=false):Promise<Uint8Array|null> {
  const response=await fetch(`${SUPABASE}/storage/v1/object/authenticated/${BUCKET}/${path}`,{headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`}});
  if(missingOk&&response.status===404)return null;
  if(missingOk&&response.status===400) {
    // Older Storage versions wrap their missing-object status in a 400 body.
    const error=await response.json().catch(()=>({}));
    if(String(error.statusCode)==='404')return null;
  }
  if(!response.ok)throw new Error('Private upload has not completed');
  const contentLength=Number(response.headers.get('content-length'));
  if(contentLength>LIMITS.fileBytes)throw new Error('File is too large');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength>LIMITS.fileBytes)throw new Error('File is too large');return bytes;
}
async function digest(bytes:Uint8Array):Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes))),v=>v.toString(16).padStart(2,'0')).join('');
}
async function boundedText(request:Request):Promise<string> {
  if(Number(request.headers.get('content-length'))>LIMITS.projectJsonBytes)throw new Error('Room request is too large');
  const reader=request.body?.getReader();if(!reader)return '';
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>LIMITS.projectJsonBytes){await reader.cancel();throw new Error('Room request is too large');}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
async function storePackage(owner:string,projectId:string,value:unknown):Promise<Row> {
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  const hash=await digest(bytes);
  const existing=await db('room_assets',`owner_id=eq.${owner}&project_id=eq.${projectId}&kind=eq.package&sha256=eq.${hash}&state=eq.ready`);
  if(existing.length)return existing[0];
  const row=await rpc('room_reserve_asset',{p_owner:owner,p_project:projectId,p_id:crypto.randomUUID(),p_kind:'package',p_mime:'application/json',p_bytes:bytes.length,p_sha:hash,p_extension:'json'});
  const response=await fetch(`${SUPABASE}/storage/v1/object/${BUCKET}/${row.storage_path}`,{method:'POST',headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,'Content-Type':'application/json'},body:bytes});
  if(!response.ok)throw new Error('The render package could not be saved');
  await db('room_assets',`id=eq.${row.id}`,{method:'PATCH',body:JSON.stringify({state:'ready'})});return row;
}
async function deleteProject(owner:string,id:string) {
  const paths:string[]=await rpc('room_mark_delete',{p_owner:owner,p_project:uuid(id)});
  for(let start=0;start<paths.length;start+=100)await service(`/storage/v1/object/${BUCKET}`,{method:'DELETE',body:JSON.stringify({prefixes:paths.slice(start,start+100)})});
  await db('room_projects',`id=eq.${id}&owner_id=eq.${owner}&deleting=eq.true`,{method:'DELETE'});
  return {deleted:true};
}

Deno.serve(async request=>{
  const origin=request.headers.get('origin');
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(exactOrigin(origin,origins))Object.assign(headers,{'Access-Control-Allow-Origin':origin!,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(!exactOrigin(origin,origins))return reply({error:'Origin unavailable'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'Use POST'},405);
  if(env('ROOM_STUDIO_CLOUD_ENABLED')!=='true'||!SUPABASE||!SERVICE||!ANON)return reply({error:'Cloud saving and processing are not configured. Keep working locally or download your room.'},503);
  try {
    const authorization=request.headers.get('authorization')||'';
    if(!authorization.startsWith('Bearer '))return reply({error:'Verify your email to continue'},401);
    const auth=await fetch(`${SUPABASE}/auth/v1/user`,{headers:{apikey:ANON,Authorization:authorization}});
    if(!auth.ok)return reply({error:'Sign in again to continue'},401);
    const user=await auth.json();
    if(!user.email_confirmed_at||user.is_anonymous)return reply({error:'Verify your email before saving or processing'},403);
    const owner=uuid(user.id);
    const text=await boundedText(request);
    const input=JSON.parse(text);const action=input.action;
    if(action==='capabilities') {
      const [settings]=await db('room_studio_settings','id=eq.true');
      const common={paidJobsEnabled:settings?.paid_jobs_enabled,monthlyCapPence:settings?.monthly_cap_pence};
      return reply({analysisEnabled:env('ROOM_STUDIO_LIVE_AI_ENABLED')==='true'&&paidProcessingAvailable({...common,reservationPence:settings?.analysis_reservation_pence,liveAiEnabled:settings?.live_ai_enabled},'analysis'),renderEnabled:checkoutConfigured(paymentConfig())&&await rpc('room_checkout_available',{}),checkoutEnabled:checkoutConfigured(paymentConfig())&&await rpc('room_checkout_available',{}),renderPricePence:settings?.render_price_pence??null,currency:settings?.currency??'gbp',projects:5,analysesPerDay:2,rendersPerDay:0,activeJobs:1});
    }
    if(action==='listProjects')return reply((await db('room_projects',`owner_id=eq.${owner}&deleting=eq.false&document_kind=eq.room&order=updated_at.desc`)).map(cloudProject));
    if(action==='prepareProject'||action==='saveProject') {
      const p=cleanProject(input.project,owner);
      const existing=await db('room_projects',`id=eq.${p.id}&owner_id=eq.${owner}&deleting=eq.false`);if(existing.some((row:Row)=>row.document_kind==='photo'))throw new Error('Open this document in View in your room');
      if(action==='saveProject')await verifyTextures(p,owner);
      return reply(cloudProject(await rpc(action==='prepareProject'?'room_prepare_project':'room_save_project',{p_owner:owner,p_id:p.id,p_name:p.name,p_snapshot:p,...(action==='saveProject'?{p_expected_revision:p.revision}:{})})));
    }
    if(action==='getProject'){const row=await projectRow(owner,input.projectId);if(row.document_kind==='photo')throw new Error('Open this document in View in your room');return reply(cloudProject(row));}
    if(action==='getRevision') {
      const project=uuid(input.projectId);await projectRow(owner,project);
      const rows=await db('room_revisions',`id=eq.${uuid(input.revisionId)}&owner_id=eq.${owner}&project_id=eq.${project}`);
      if(rows.length!==1)throw new Error('Confirmed room version unavailable');
      const revision=cloudRevision(rows[0]);
      const assets:Row[]=await db('room_assets',`owner_id=eq.${owner}&project_id=eq.${project}&state=eq.ready`);
      assertPortableAssets(revision,textures(revision.project),assets,owner,project);
      return reply(revision);
    }
    if(action==='confirmRevision') {
      const p=cleanProject(input.project,owner);const existing=await projectRow(owner,p.id);if(existing.document_kind==='photo')throw new Error('Use the photo project workflow');await verifyTextures(p,owner);
      if(!p.room.confirmed)throw new Error('Confirm room dimensions and openings first');
      if(unconfirmedAppliedArtwork(p))throw new Error('Confirm the wallpaper repeat preview first');
      const coverage=artworkCoverageIssues(p);if(coverage.length)throw new Error(coverage[0].message);
      return reply(cloudRevision(await rpc('room_confirm_revision',{p_owner:owner,p_project:p.id,p_snapshot:p,p_expected_revision:p.revision})));
    }
    if(action==='prepareUpload') {
      const project=uuid(input.projectId);await projectRow(owner,project);const spec=uploadSpec(input);
      if(spec.kind==='artwork'||spec.kind==='room-photo'||spec.kind==='mask') {
        const matches:Row[]=await db('room_assets',`owner_id=eq.${owner}&project_id=eq.${project}&kind=eq.${spec.kind}&state=eq.ready&mime=eq.${eq(spec.mime)}&bytes=eq.${spec.bytes}&sha256=eq.${spec.sha256}&order=created_at.asc`);
        for(const candidate of matches) {
          const path=ownedPath(candidate.storage_path,owner,project);
          const bytes=await downloadPrivate(path,true);
          if(bytes===null)continue; // Missing storage cannot be reused or signed for overwrite.
          if(bytes.length!==spec.bytes||sniffMime(bytes)!==spec.mime||await digest(bytes)!==spec.sha256)throw new Error('Saved artwork failed its integrity check. Reattach the original file or contact support.');
          return reply({asset:cloudAsset(candidate),reused:true});
        }
      }
      // Authenticated upload policy never permits overwrites. Use a
      // fresh asset ID for uploads; application-level texture saves reuse paths.
      const row=await rpc('room_reserve_asset',{p_owner:owner,p_project:project,p_id:crypto.randomUUID(),p_kind:spec.kind,p_mime:spec.mime,p_bytes:spec.bytes,p_sha:spec.sha256,p_extension:spec.extension});
      return reply({asset:cloudAsset(row),url:`${SUPABASE}/storage/v1/object/${BUCKET}/${row.storage_path}`,authenticatedUpload:true});
    }
    if(action==='completeUpload') {
      const project=uuid(input.projectId);await projectRow(owner,project);const row=await assetRow(owner,project,input.assetId);
      if(!['artwork','plan','room-photo','mask'].includes(row.kind)||row.state==='cancelled')throw new Error('This asset cannot be completed as a customer upload');
      if(row.state==='ready')return reply(cloudAsset(row)); // Immutable successful uploads are safe to replay; never delete them.
      if(row.state!=='pending')throw new Error('This upload is not pending');
      const bytes=await downloadPrivate(row.storage_path);
      if(bytes.length!==row.bytes||sniffMime(bytes)!==row.mime||await digest(bytes)!==row.sha256) {
        const cancelled=await rpc('room_finish_upload',{p_owner:owner,p_asset:row.id,p_cancel:true});
        if(cancelled?.id){await service(`/storage/v1/object/${BUCKET}`,{method:'DELETE',body:JSON.stringify({prefixes:[row.storage_path]})});await db('room_assets',`id=eq.${row.id}&state=eq.cancelled`,{method:'DELETE'});}
        throw new Error('The uploaded file did not match its type or checksum');
      }
      await rpc('room_finish_upload',{p_owner:owner,p_asset:row.id,p_cancel:false});return reply(cloudAsset(row));
    }
    if(action==='abortUpload') {
      const project=uuid(input.projectId);await projectRow(owner,project);const row=await assetRow(owner,project,input.assetId);
      if(['artwork','plan','room-photo','mask'].includes(row.kind)) {
        const cancelled=await rpc('room_finish_upload',{p_owner:owner,p_asset:row.id,p_cancel:true});
        if(cancelled?.id){
          await service(`/storage/v1/object/${BUCKET}`,{method:'DELETE',body:JSON.stringify({prefixes:[row.storage_path]})});
          await db('room_assets',`id=eq.${row.id}&state=eq.cancelled`,{method:'DELETE'});
        }
      }
      return reply({aborted:true});
    }
    if(action==='signedAssetUrl') {
      const project=uuid(input.projectId);await projectRow(owner,project);const row=await assetRow(owner,project,undefined,input.storagePath);
      if(row.state!=='ready')throw new Error('The private asset is not ready');return reply({url:await signed(row.storage_path),expiresIn:300});
    }
    if(action==='enqueueAnalysis') {
      // This independent gate stays false even when model credentials exist.
      if(env('ROOM_STUDIO_LIVE_AI_ENABLED')!=='true')return reply({error:'Live AI analysis is disabled. Use the plan as a reference and enter or adjust the room measurements.'},503);
      const project=uuid(input.projectId);await projectRow(owner,project);const row=await assetRow(owner,project,input.assetId);
      if(row.kind!=='plan'||row.state!=='ready')throw new Error('Upload a floor plan first');
      const page=integer(input.pageIndex??0,0,199,'plan page');
      const crop=planCrop(input.crop);
      const identity=await digest(new TextEncoder().encode(`${project}:${row.sha256}:${page}:${JSON.stringify(crop)}:plan-v2`));
      return reply(cloudJob(await rpc('room_enqueue_job',{p_owner:owner,p_project:project,p_type:'analysis',p_identity:identity,p_revision:null,p_input:{assetId:row.id,pageIndex:page,crop,extractorVersion:'plan-v2'}})));
    }
    if(action==='enqueueRender')return reply({error:'A paid render order is required. Confirm your design and use secure checkout.'},402);
    if(action==='renderQuote') {
      const [settings]=await db('room_studio_settings','id=eq.true');
      const available=checkoutConfigured(paymentConfig())&&await rpc('room_checkout_available',{});
      return reply({available,amountPence:settings?.render_price_pence??null,currency:settings?.currency??'gbp',outputs:{stills:2,width:1920,height:1080,panoramaWidth:4096,panoramaHeight:2048},...(!available?{reason:'Checkout remains disabled while price, tax and operating allowances are unset.'}:{})});
    }
    if(action==='createRenderCheckout') {
      if(!checkoutConfigured(paymentConfig())||!await rpc('room_checkout_available',{}))return reply({error:'Checkout is disabled until pricing, tax and operating allowances are configured. Local previews remain free.'},503);
      const project=uuid(input.projectId);await projectRow(owner,project);
      const rows=await db('room_revisions',`id=eq.${uuid(input.revisionId)}&owner_id=eq.${owner}&project_id=eq.${project}`);
      if(rows.length!==1)throw new Error('Confirm a saved revision first');
      const revision=cloudRevision(rows[0]);await verifyTextures(revision.project,owner);
      if(!revision.project.room.confirmed||unconfirmedAppliedArtwork(revision.project))throw new Error('Confirm room dimensions and wallpaper proof first');
      const issues=artworkCoverageIssues(revision.project);if(issues.length)throw new Error(issues[0].message);
      for(const finish of revision.project.finishes)resolveCatalogueFinish(finish);
      const packageValue=compileRoom(revision);
      if(packageValue.cameras.filter(c=>c.kind==='perspective').length<2||packageValue.cameras.filter(c=>c.kind==='panorama').length<1)throw new Error('Choose two views and one panorama position inside the room');
      const asset=await storePackage(owner,project,packageValue);
      let order=await rpc('room_prepare_order',{p_owner:owner,p_project:project,p_revision:revision.id,p_package:asset.id,p_compiler:packageValue.compilerVersion,p_sources:packageValue.textures.map(t=>({id:t.id,sha256:t.sha256}))});
      if(!order.checkout_url) {
        taxProfile(order.tax_profile);
        const session=await createStripe(paymentConfig()).checkout(order);
        order=await rpc('room_bind_checkout',{p_owner:owner,p_order:order.id,p_session:session.id,p_url:session.url,p_expires:session.expires_at});
      }
      return reply(cloudOrder(order));
    }
    if(action==='listRenderOrders'){const filter=input.projectId?`&project_id=eq.${uuid(input.projectId)}`:'';if(input.projectId)await projectRow(owner,input.projectId);await rpc('room_expire_checkouts',{});return reply((await db('room_render_orders',`owner_id=eq.${owner}${filter}&order=created_at.desc&limit=30`)).map(cloudOrder));}
    if(action==='cancelRenderOrder') {
      const order=await rpc('room_cancel_order',{p_owner:owner,p_order:uuid(input.orderId)});
      if(order.state==='expired'&&order.checkout_session_id)await createStripe(paymentConfig()).expire(order.checkout_session_id).catch(()=>{});
      return reply(cloudOrder(order));
    }
    if(action==='preparePhotoProject') {
      const id=uuid(input.projectId),name=String(input.name??'').trim();if(!name||name.length>120||/[\u0000-\u001f]/.test(name))throw new Error('Give this photo project a name');
      return reply(cloudPhoto(await rpc('room_save_photo_project',{p_owner:owner,p_id:id,p_name:name,p_snapshot:{kind:'photo',schemaVersion:1,id,name},p_expected_revision:0,p_prepare:true})));
    }
    if(action==='savePhotoProject') {
      const p=structuredClone(input.project) as PhotoProject;p.id=uuid(p.id);p.ownerId=owner;
      const head=integer(input.expectedRevision??0,0,100000,'photo revision');
      const issues=validatePhotoProject(p);if(issues.length)throw new Error(issues[0].message);
      assertNoInlineOrRemoteAssets(p);if(new TextEncoder().encode(JSON.stringify(p)).length>LIMITS.projectJsonBytes)throw new Error('Photo project is too large');
      for(const finish of [...p.finishes,...p.comparisons.flatMap(c=>c.finishes)])resolveCatalogueFinish(finish);
      const assets:Row[]=await db('room_assets',`owner_id=eq.${owner}&project_id=eq.${p.id}&state=eq.ready`);
      for(const texture of collectPhotoTextures(p)) {
        const path=ownedPath(texture.storagePath,owner,p.id);
        if(!assets.some(a=>a.storage_path===path&&a.sha256===texture.sha256&&a.mime===texture.mime&&a.kind===(texture===p.source?'room-photo':'artwork')))throw new Error('Upload this photograph and artwork privately before saving');
      }
      assertPortableAssets(p,collectPhotoTextures(p),assets,owner,p.id);
      return reply(cloudPhoto(await rpc('room_save_photo_project',{p_owner:owner,p_id:p.id,p_name:p.name,p_snapshot:p,p_expected_revision:head,p_prepare:false})));
    }
    if(action==='listPhotoProjects')return reply((await db('room_projects',`owner_id=eq.${owner}&deleting=eq.false&document_kind=eq.photo&order=updated_at.desc`)).map(cloudPhoto));
    if(action==='getPhotoProject'){const row=await projectRow(owner,input.projectId);if(row.document_kind!=='photo')throw new Error('Photo project unavailable');return reply(cloudPhoto(row));}
    if(action==='exportPhotoProject'){const row=await projectRow(owner,input.projectId);if(row.document_kind!=='photo')throw new Error('Photo project unavailable');const value=cloudPhoto(row);const assets:Row[]=await db('room_assets',`owner_id=eq.${owner}&project_id=eq.${row.id}&state=eq.ready`);assertPortableAssets(value.project,collectPhotoTextures(value.project),assets,owner,row.id);return reply(value);}
    if(action==='listJobs') {const id=uuid(input.projectId);await projectRow(owner,id);return reply((await db('room_jobs',`owner_id=eq.${owner}&project_id=eq.${id}&order=created_at.desc&limit=30`)).map(cloudJob));}
    if(action==='getJob') {
      const rows=await db('room_jobs',`id=eq.${uuid(input.jobId)}&owner_id=eq.${owner}`);if(rows.length!==1)throw new Error('Job unavailable');
      const job=cloudJob(rows[0]);
      const candidate=rows[0].outputs?.find((o:Row)=>o.kind==='candidate');
      if(candidate){const asset=await assetRow(owner,rows[0].project_id,undefined,candidate.storagePath);return reply({...job,candidate:JSON.parse(new TextDecoder().decode(await downloadPrivate(asset.storage_path)))});}
      return reply(job);
    }
    if(action==='exportProject') {
      const project=await projectRow(owner,input.projectId);if(project.document_kind==='photo')throw new Error('Export this document from View in your room');
      const assets=await db('room_assets',`project_id=eq.${project.id}&owner_id=eq.${owner}&state=eq.ready`);
      const revisions=await db('room_revisions',`project_id=eq.${project.id}&owner_id=eq.${owner}&order=number.asc`);
      const value={...cloudProject(project),revisions:revisions.map(cloudRevision),assets:assets.map(cloudAsset)};
      const references=[...textures(value.project),...value.revisions.flatMap((revision:RoomRevision)=>textures(revision.project))];
      assertPortableAssets(value,references,assets,owner,project.id);
      const exported={...value,assets:await Promise.all(assets.map(async(row:Row)=>({...cloudAsset(row),url:await signed(row.storage_path)})))};
      assertPortableAssets(exported,references,assets,owner,project.id);
      return reply(exported);
    }
    if(action==='deleteProject')return reply(await deleteProject(owner,uuid(input.projectId)));
    return reply({error:'Unknown room action'},400);
  } catch(error) { return reply({error:safeMessage(error)},400); }
});
