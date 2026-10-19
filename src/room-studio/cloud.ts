import type { PhotoProject } from './photo-types.ts';
import type { RenderOrder, RenderQuote } from './commerce-types.ts';
import { collectPhotoTextures } from './photo-validation.ts';
import { assertPortableJson, PORTABLE_DOCUMENT_BUDGET_BYTES } from './portable.ts';
import type { RoomProject, RoomRevision, ProcessingJob, PlanCandidate } from './types.ts';

export interface CloudConfiguration { enabled: boolean; url: string; anonKey: string; }
export interface CloudSession { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email?: string; email_confirmed_at?: string }; }
export interface CloudPhoto { project:PhotoProject; expiresAt:string; expiryNoticeAt:string|null; headRevision:number; }
export interface CloudProject { project: RoomProject; expiresAt: string; expiryNoticeAt: string | null; }
export interface CloudAsset { id: string; storagePath: string; sha256: string; mime: string; bytes: number; }
export interface CloudJob extends ProcessingJob { candidate?: PlanCandidate; }
export interface PlanCrop { x:number; y:number; width:number; height:number; }
export interface CloudCapabilities { analysisEnabled:boolean; renderEnabled:boolean; checkoutEnabled?:boolean; renderPricePence?:number|null; currency?:string; projects:number; analysesPerDay:number; rendersPerDay:number; activeJobs:number; }
const SESSION_KEY='mw-room-cloud-session';
/** Publishable URL and anon key only. Service/worker/model credentials are never
 * read by this module. An enabled flag is required even when a URL is present. */
function configuration(): CloudConfiguration {
  const env=(import.meta as ImportMeta & {env?:Record<string,string>}).env ?? {};
  return {enabled:env.PUBLIC_ROOM_STUDIO_CLOUD_ENABLED==='true',url:env.PUBLIC_ROOM_STUDIO_SUPABASE_URL||'',anonKey:env.PUBLIC_ROOM_STUDIO_SUPABASE_ANON_KEY||''};
}
export function createCloudClient(config: CloudConfiguration=configuration(), fetcher: typeof fetch=fetch) {
  const enabled=config.enabled && /^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(config.url) && !!config.anonKey;
  const base=config.url.replace(/\/$/,'');
  let session: CloudSession|null=null;
  let refreshing: Promise<void>|null=null;
  const heads=new Map<string,number>();
  try { if(enabled && typeof sessionStorage!=='undefined') session=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null'); } catch { /* Optional tab-local session. */ }
  function requireEnabled() { if(!enabled) throw new Error('Cloud saving and processing are not configured. Your room still works locally; download a copy to keep it.'); }
  function refreshStoredSession(){try{if(enabled&&typeof sessionStorage!=='undefined'){const next=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null') as CloudSession|null;if(next?.user.id!==session?.user.id)heads.clear();session=next;}}catch{/* Memory session remains available. */}}
  function store(value: CloudSession|null) { if(value?.user.id!==session?.user.id)heads.clear();session=value; try { if(value) sessionStorage.setItem(SESSION_KEY,JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY); } catch { /* Memory session remains available. */ } if(typeof window!=='undefined')window.dispatchEvent(new Event('mw-room-auth-change')); }
  async function auth(path:string,payload:unknown,token?:string) {
    requireEnabled();
    const response=await fetcher(`${base}/auth/v1/${path}`,{method:'POST',headers:{apikey:config.anonKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.msg||data.error_description||data.message||'Sign-in could not be completed.');
    return data;
  }
  async function token():Promise<string> {
    requireEnabled();
    refreshStoredSession();
    if(!session) throw new Error('Verify your email to save a room or request processing.');
    if(session.expires_at*1000<Date.now()+60_000) {
      refreshing ??= auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(value=>store(value)).catch(error=>{store(null);throw error;}).finally(()=>{refreshing=null;});
      await refreshing;
    }
    if(!session?.access_token) throw new Error('Sign in again to continue.');
    return session.access_token;
  }
  async function action<T>(name:string,payload:Record<string,unknown>={}):Promise<T> {
    const access=await token();
    const response=await fetcher(`${base}/functions/v1/room-studio`,{method:'POST',headers:{apikey:config.anonKey,Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({action:name,...payload})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||'The room service could not complete this request. Try again; your local room is unchanged.');
    return data as T;
  }
  async function uploadAsset(projectId:string,file:Blob,kind:'artwork'|'plan'|'room-photo'|'mask'):Promise<CloudAsset> {
    requireEnabled();
    if(!file.size||file.size>20*1024*1024) throw new Error('Choose a file no larger than 20 MB.');
    const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
    const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const upload=await action<{asset:CloudAsset;url?:string;reused?:boolean;authenticatedUpload?:boolean}>('prepareUpload',{projectId,kind,mime:file.type,bytes:file.size,sha256});
    if(upload.reused===true) {
      // The service has freshly verified this immutable object. Do not retain a
      // path cache: a later save must recheck ownership and object availability.
      if(upload.asset.sha256!==sha256||upload.asset.mime!==file.type||upload.asset.bytes!==file.size)throw new Error('Private artwork did not match this file. Try saving again.');
      return upload.asset;
    }
    if(!upload.url)throw new Error('Invalid private upload destination.');
    const url=new URL(upload.url,base);
    if(upload.authenticatedUpload!==true||url.origin!==new URL(base).origin || url.pathname!==`/storage/v1/object/room-studio/${upload.asset.storagePath}`) throw new Error('Invalid private upload destination.');
    try {
      const result=await fetcher(url.href,{method:'POST',headers:{apikey:config.anonKey,Authorization:`Bearer ${await token()}`,'Content-Type':file.type,'x-upsert':'false'},body:file});
      if(!result.ok) throw new Error('The private upload did not finish. Try again.');
      return await action<CloudAsset>('completeUpload',{projectId,assetId:upload.asset.id});
    } catch(error) {
      await action('abortUpload',{projectId,assetId:upload.asset.id}).catch(()=>{});
      throw error;
    }
  }
  async function saveProject(project:RoomProject):Promise<CloudProject> {
    assertPortableJson(project,PORTABLE_DOCUMENT_BUDGET_BYTES);
    // Reserve a new project atomically before uploading. Existing saved content is
    // untouched until all uploads have passed server checksum/signature checks.
    const prepared=await action<CloudProject>('prepareProject',{project:{...project,revision:0,finishes:[],assignments:[],schemes:[],...(project.wallRuns?{wallRuns:[]}: {})}});
    const copy=structuredClone(project);
    // Local confirmation numbers are independent of cloud revision numbers.
    // Keep the cloud head observed by this session for optimistic concurrency.
    copy.revision=heads.get(project.id)??prepared.project.revision;
    await uploadTextures(copy.id,roomTextures(copy));
    const saved=await action<CloudProject>('saveProject',{project:copy});heads.set(project.id,saved.project.revision);return saved;
  }
  async function getProject(projectId:string):Promise<CloudProject> {
    const saved=await action<CloudProject>('getProject',{projectId});
    heads.set(projectId,saved.project.revision);
    await hydrateProject(saved.project,new Map());
    saved.project.revision=Math.max(1,saved.project.revision);
    return saved;
  }
  async function getRevision(projectId:string,revisionId:string):Promise<RoomRevision> {
    const revision=await action<RoomRevision>('getRevision',{projectId,revisionId});
    const sameId=(value:unknown,expected:string)=>typeof value==='string'&&value.toLowerCase()===expected.toLowerCase();
    if(!revision||!sameId(revision.id,revisionId)||!sameId(revision.projectId,projectId)||
      !sameId(revision.project?.id,projectId)||!sameId(revision.project?.ownerId,session?.user.id??'')||
      !Number.isSafeInteger(revision.number)||revision.number<1||revision.project.revision!==revision.number) {
      throw new Error('The confirmed room version did not match this request. Open the results again.');
    }
    // Reading a historical snapshot must not replace the mutable head used by
    // optimistic cloud saves, or require downloading its source artwork.
    return revision;
  }
  function roomTextures(project:RoomProject) {
    return [...project.finishes,...project.schemes.flatMap(s=>s.finishes)].flatMap(f=>(f.type==='wallpaper'||f.type==='mural')?[f.texture,...(f.panels??[]).map(p=>p.texture)]:[]);
  }
  async function uploadTextures(projectId:string,textures:ReturnType<typeof roomTextures>,photoSource?:ReturnType<typeof roomTextures>[number]) {
    const uploaded=new Map<string,CloudAsset>();
    for(const texture of textures) {
      if(!texture.dataUrl&&texture.storagePath)continue;
      if(!texture.dataUrl)throw new Error('Attach the source image before saving.');
      const match=texture.dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
      if(!match)throw new Error('Use a PNG, JPEG or WebP image.');
      const kind=texture===photoSource?'room-photo':'artwork',key=kind+':'+texture.sha256;
      let asset=uploaded.get(key);
      if(!asset){const raw=atob(match[2]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));asset=await uploadAsset(projectId,new Blob([bytes],{type:match[1]}),kind);uploaded.set(key,asset);}
      texture.storagePath=asset.storagePath;texture.sha256=asset.sha256;delete texture.dataUrl;
    }
  }
  async function hydrateTextures(projectId:string,textures:ReturnType<typeof roomTextures>,loaded:Map<string,string>,portable=false):Promise<void> {
    for(const texture of textures) {
      if(!texture.storagePath)continue;
      const path=texture.storagePath;
      if(!loaded.has(path)) {
        const {url}=await action<{url:string}>('signedAssetUrl',{projectId,storagePath:path});
        if(new URL(url).origin!==new URL(base).origin)throw new Error('Invalid private image destination');
        const response=await fetcher(url);if(!response.ok)throw new Error('Private image could not be loaded. Try opening the saved project again.');
        const blob=await response.blob();if(blob.size>20*1024*1024)throw new Error('Private image exceeds the file limit');
        const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
        for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
        loaded.set(path,`data:${texture.mime};base64,${btoa(binary)}`);
      }
      texture.dataUrl=loaded.get(path);if(portable)delete texture.storagePath;
    }
  }
  async function hydrateProject(project:RoomProject,loaded:Map<string,string>,portable=false):Promise<void> {return hydrateTextures(project.id,roomTextures(project),loaded,portable);}
  async function savePhotoProject(project:PhotoProject):Promise<CloudPhoto> {
    assertPortableJson(project,PORTABLE_DOCUMENT_BUDGET_BYTES);
    const prepared=await action<CloudPhoto>('preparePhotoProject',{projectId:project.id,name:project.name});
    const copy=structuredClone(project);await uploadTextures(copy.id,collectPhotoTextures(copy),copy.source);
    const saved=await action<CloudPhoto>('savePhotoProject',{project:copy,expectedRevision:heads.get(copy.id)??prepared.headRevision});
    heads.set(copy.id,saved.headRevision);return saved;
  }
  async function getPhotoProject(projectId:string,portable=false):Promise<CloudPhoto>{
    const saved=await action<CloudPhoto>(portable?'exportPhotoProject':'getPhotoProject',{projectId});
    if(saved.project.id!==projectId||saved.project.ownerId!==session?.user.id||saved.project.kind!=='photo')throw new Error('Photo identity did not match this account');
    if(!portable)heads.set(projectId,saved.headRevision);
    await hydrateTextures(projectId,collectPhotoTextures(saved.project),new Map(),portable);if(portable)assertPortableJson(saved.project);return saved;
  }
  async function exportProject(projectId:string) {
    const value=await action<{project:RoomProject;revisions:RoomRevision[];assets:(CloudAsset&{url:string})[];expiresAt:string}>('exportProject',{projectId});
    const loaded=new Map<string,string>();
    await hydrateProject(value.project,loaded,true);
    value.project.revision=Math.max(1,value.project.revision);
    for(const revision of value.revisions)await hydrateProject(revision.project,loaded,true);
    const exported={...value,exportedAt:new Date().toISOString(),editableArtworkIncluded:true,outputLinksExpireInSeconds:300};assertPortableJson(exported);return exported;
  }
  async function exportRevision(projectId:string,revisionId:string):Promise<RoomRevision> {
    const revision=await getRevision(projectId,revisionId);
    await hydrateProject(revision.project,new Map(),true);
    assertPortableJson(revision);
    return revision;
  }
  return {
    enabled, configured:enabled,
    get session(){refreshStoredSession();return session;},
    async signIn(email:string):Promise<void>{ await auth('otp',{email,create_user:true}); },
    async completeSignIn(email:string,code:string):Promise<CloudSession>{const value=await auth('verify',{email,token:code,type:'email'});store(value);return value;},
    async signOut():Promise<void>{try{if(session)await auth('logout',{},await token());}finally{store(null);}},
    listProjects:()=>action<CloudProject[]>('listProjects'),
    getProject,
    getRevision,
    capabilities:()=>action<CloudCapabilities>('capabilities'),
    saveProject,
    savePhotoProject,
    getPhotoProject,
    listPhotoProjects:()=>action<CloudPhoto[]>('listPhotoProjects'),
    exportPhotoProject:(projectId:string)=>getPhotoProject(projectId,true),
    renderQuote:()=>action<RenderQuote>('renderQuote'),
    createRenderCheckout:(projectId:string,revisionId:string)=>action<RenderOrder>('createRenderCheckout',{projectId,revisionId}),
    listRenderOrders:(projectId?:string)=>action<RenderOrder[]>('listRenderOrders',projectId?{projectId}:{}),
    cancelRenderOrder:(orderId:string)=>action<RenderOrder>('cancelRenderOrder',{orderId}),
    confirmRevision:async(project:RoomProject)=>{const saved=await saveProject(project);const revision=await action<RoomRevision>('confirmRevision',{project:saved.project});heads.set(project.id,revision.number);return revision;},
    uploadAsset,
    enqueueAnalysis:(projectId:string,assetId:string,pageIndex=0,crop?:PlanCrop)=>action<CloudJob>('enqueueAnalysis',{projectId,assetId,pageIndex,crop}),
    enqueueRender:(projectId:string,revisionId:string)=>action<CloudJob>('enqueueRender',{projectId,revisionId}),
    listJobs:(projectId:string)=>action<CloudJob[]>('listJobs',{projectId}),
    getJob:(jobId:string)=>action<CloudJob>('getJob',{jobId}),
    signedAssetUrl:(projectId:string,storagePath:string)=>action<{url:string;expiresIn:number}>('signedAssetUrl',{projectId,storagePath}),
    exportProject,
    exportRevision,
    deleteProject:(projectId:string)=>action<{deleted:true}>('deleteProject',{projectId}),
  };
}
export type CloudClient=ReturnType<typeof createCloudClient>;
