import type { RoomProject, RoomRevision, ProcessingJob, PlanCandidate } from './types.ts';

export interface CloudConfiguration { enabled: boolean; url: string; anonKey: string; }
export interface CloudSession { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email?: string; email_confirmed_at?: string }; }
export interface CloudProject { project: RoomProject; expiresAt: string; expiryNoticeAt: string | null; }
export interface CloudAsset { id: string; storagePath: string; sha256: string; mime: string; bytes: number; }
export interface CloudJob extends ProcessingJob { candidate?: PlanCandidate; }
export interface PlanCrop { x:number; y:number; width:number; height:number; }
export interface CloudCapabilities { analysisEnabled:boolean; renderEnabled:boolean; projects:number; analysesPerDay:number; rendersPerDay:number; activeJobs:number; }
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
  function store(value: CloudSession|null) { session=value; try { if(value) sessionStorage.setItem(SESSION_KEY,JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY); } catch { /* Memory session remains available. */ } }
  async function auth(path:string,payload:unknown,token?:string) {
    requireEnabled();
    const response=await fetcher(`${base}/auth/v1/${path}`,{method:'POST',headers:{apikey:config.anonKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.msg||data.error_description||data.message||'Sign-in could not be completed.');
    return data;
  }
  async function token():Promise<string> {
    requireEnabled();
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
  async function uploadAsset(projectId:string,file:Blob,kind:'artwork'|'plan'):Promise<CloudAsset> {
    requireEnabled();
    if(!file.size||file.size>20*1024*1024) throw new Error('Choose a file no larger than 20 MB.');
    const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
    const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const upload=await action<{asset:CloudAsset;url:string}>('prepareUpload',{projectId,kind,mime:file.type,bytes:file.size,sha256});
    const url=new URL(upload.url,base);
    if(url.origin!==new URL(base).origin || !url.pathname.startsWith('/storage/v1/object/upload/sign/')) throw new Error('Invalid private upload destination.');
    try {
      const result=await fetcher(url.href,{method:'PUT',headers:{'Content-Type':file.type},body:file});
      if(!result.ok) throw new Error('The private upload did not finish. Try again.');
      return await action<CloudAsset>('completeUpload',{projectId,assetId:upload.asset.id});
    } catch(error) {
      await action('abortUpload',{projectId,assetId:upload.asset.id}).catch(()=>{});
      throw error;
    }
  }
  async function saveProject(project:RoomProject):Promise<CloudProject> {
    // Reserve a new project atomically before uploading. Existing saved content is
    // untouched until all uploads have passed server checksum/signature checks.
    const prepared=await action<CloudProject>('prepareProject',{project:{...project,revision:0,finishes:[],assignments:[],schemes:[]}});
    const copy=structuredClone(project);
    // Local confirmation numbers are independent of cloud revision numbers.
    // Keep the cloud head observed by this session for optimistic concurrency.
    copy.revision=heads.get(project.id)??prepared.project.revision;
    const uploaded=new Map<string,CloudAsset>();
    for(const finish of [...copy.finishes,...copy.schemes.flatMap(s=>s.finishes)]) {
      if(finish.type!=='wallpaper'&&finish.type!=='mural') continue;
      if(finish.texture.storagePath) { delete finish.texture.dataUrl; continue; }
      if(finish.texture.dataUrl) {
        let asset=uploaded.get(finish.texture.sha256);
        if(!asset) {
          const match=finish.texture.dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
          if(!match) throw new Error('Artwork must be a PNG, JPEG or WebP image.');
          const raw=atob(match[2]); const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
          asset=await uploadAsset(copy.id,new Blob([bytes],{type:match[1]}),'artwork');
          uploaded.set(finish.texture.sha256,asset);
        }
        finish.texture.storagePath=asset.storagePath;
        finish.texture.sha256=asset.sha256;
        delete finish.texture.dataUrl;
      }
    }
    const saved=await action<CloudProject>('saveProject',{project:copy});heads.set(project.id,saved.project.revision);return saved;
  }
  async function getProject(projectId:string):Promise<CloudProject> {
    const saved=await action<CloudProject>('getProject',{projectId});
    heads.set(projectId,saved.project.revision);
    await hydrateProject(saved.project,new Map());
    saved.project.revision=Math.max(1,saved.project.revision);
    return saved;
  }
  async function hydrateProject(project:RoomProject,loaded:Map<string,string>,portable=false):Promise<void> {
    for(const finish of [...project.finishes,...project.schemes.flatMap(s=>s.finishes)]) {
      if((finish.type!=='wallpaper'&&finish.type!=='mural')||!finish.texture.storagePath)continue;
      const path=finish.texture.storagePath;
      if(!loaded.has(path)) {
        const {url}=await action<{url:string}>('signedAssetUrl',{projectId:project.id,storagePath:path});
        if(new URL(url).origin!==new URL(base).origin)throw new Error('Invalid private image destination');
        const response=await fetcher(url);if(!response.ok)throw new Error('Private wallpaper could not be loaded. Try opening the saved room again.');
        const blob=await response.blob();if(blob.size>20*1024*1024)throw new Error('Private image exceeds the file limit');
        const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
        for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
        loaded.set(path,`data:${finish.texture.mime};base64,${btoa(binary)}`);
      }
      finish.texture.dataUrl=loaded.get(path);
      if(portable)delete finish.texture.storagePath;
    }
  }
  async function exportProject(projectId:string) {
    const value=await action<{project:RoomProject;revisions:RoomRevision[];assets:(CloudAsset&{url:string})[];expiresAt:string}>('exportProject',{projectId});
    const loaded=new Map<string,string>();
    await hydrateProject(value.project,loaded,true);
    value.project.revision=Math.max(1,value.project.revision);
    for(const revision of value.revisions)await hydrateProject(revision.project,loaded,true);
    return {...value,exportedAt:new Date().toISOString(),editableArtworkIncluded:true,outputLinksExpireInSeconds:300};
  }
  return {
    enabled, configured:enabled,
    get session(){return session;},
    async signIn(email:string):Promise<void>{ await auth('otp',{email,create_user:true}); },
    async completeSignIn(email:string,code:string):Promise<CloudSession>{const value=await auth('verify',{email,token:code,type:'email'});store(value);return value;},
    async signOut():Promise<void>{try{if(session)await auth('logout',{},await token());}finally{store(null);}},
    listProjects:()=>action<CloudProject[]>('listProjects'),
    getProject,
    capabilities:()=>action<CloudCapabilities>('capabilities'),
    saveProject,
    confirmRevision:async(project:RoomProject)=>{const saved=await saveProject(project);const revision=await action<RoomRevision>('confirmRevision',{project:saved.project});heads.set(project.id,revision.number);return revision;},
    uploadAsset,
    enqueueAnalysis:(projectId:string,assetId:string,pageIndex=0,crop?:PlanCrop)=>action<CloudJob>('enqueueAnalysis',{projectId,assetId,pageIndex,crop}),
    enqueueRender:(projectId:string,revisionId:string)=>action<CloudJob>('enqueueRender',{projectId,revisionId}),
    listJobs:(projectId:string)=>action<CloudJob[]>('listJobs',{projectId}),
    getJob:(jobId:string)=>action<CloudJob>('getJob',{jobId}),
    signedAssetUrl:(projectId:string,storagePath:string)=>action<{url:string;expiresIn:number}>('signedAssetUrl',{projectId,storagePath}),
    exportProject,
    deleteProject:(projectId:string)=>action<{deleted:true}>('deleteProject',{projectId}),
  };
}
export type CloudClient=ReturnType<typeof createCloudClient>;
