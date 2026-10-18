/** Shared, dependency-free request guards; also exercised by offline Node tests. */
export const LIMITS = { projects: 5, analysesPerDay: 2, rendersPerDay: 1, activeJobs: 1, fileBytes: 20 * 1024 * 1024, projectBytes: 100 * 1024 * 1024, imagePixels: 25_000_000, projectJsonBytes: 2_000_000 } as const;
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new Error('Invalid reference');
  return value.toLowerCase();
}
export function sha256(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid file checksum');
  return value;
}
export function integer(value: unknown, min: number, max: number, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) throw new Error(`Check ${label}`);
  return value as number;
}
export function ownedPath(path: unknown, owner: string, project: string): string {
  if (typeof path !== 'string' || !path.startsWith(`${uuid(owner)}/${uuid(project)}/`) || !/^[a-f0-9/-]+\.(png|jpg|webp|pdf|json)$/.test(path) || path.includes('..')) throw new Error('Private asset unavailable');
  return path;
}
export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i])) return 'image/png';
  if (bytes.length >= 3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
  const ascii = (start: number,end: number) => String.fromCharCode(...bytes.slice(start,end));
  if (bytes.length >= 12 && ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP') return 'image/webp';
  if (ascii(0,5)==='%PDF-') return 'application/pdf';
  return null;
}
export function uploadSpec(input: Record<string,unknown>) {
  const kind=input.kind;
  if (kind!=='artwork' && kind!=='plan') throw new Error('Unsupported upload');
  const mime=String(input.mime);
  const extensions: Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf'};
  if (!extensions[mime] || (kind==='artwork' && mime==='application/pdf')) throw new Error('Use a PNG, JPEG or WebP image; floor plans also accept PDF');
  return {kind,mime,extension:extensions[mime],bytes:integer(input.bytes,1,LIMITS.fileBytes,'file size'),sha256:sha256(input.sha256)};
}
export function exactOrigin(value: string | null, allowed: string[]): boolean {
  return !!value && allowed.includes(value) && /^https?:\/\//.test(value);
}
export function planCrop(value:unknown):{x:number;y:number;width:number;height:number}|null {
  if(value===undefined||value===null)return null;
  if(typeof value!=='object')throw new Error('Select a valid plan crop');
  const c=value as Record<string,unknown>;
  if(!['x','y','width','height'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k])))throw new Error('Select a valid plan crop');
  const {x,y,width,height}=c as {x:number;y:number;width:number;height:number};
  if(x<0||y<0||width<=0||height<=0||x+width>1.000001||y+height>1.000001)throw new Error('Keep the crop inside the plan');
  return {x,y,width,height};
}
export function storageSignedUrl(base:string,relative:unknown):string {
  if(typeof relative!=='string'||!/^\/object\/(?:upload\/)?sign\//.test(relative))throw new Error('Invalid private storage URL');
  const url=new URL(base.replace(/\/$/,'')+'/storage/v1'+relative);
  if(url.origin!==new URL(base).origin)throw new Error('Invalid private storage URL');
  return url.href;
}
export function assertNoInlineOrRemoteAssets(value: unknown): void {
  if (!value || typeof value!=='object') return;
  for (const [key,child] of Object.entries(value)) {
    if (key==='dataUrl' && child) throw new Error('Upload artwork privately before saving this project');
    if (['url','textureUrl','filePath'].includes(key) && child) throw new Error('Remote or local asset references are not accepted');
    if (typeof child==='object') assertNoInlineOrRemoteAssets(child);
  }
}
export function paidProcessingAvailable(settings: {paidJobsEnabled?: boolean; monthlyCapPence?: number|null; reservationPence?: number|null; liveAiEnabled?: boolean}, type: 'analysis'|'render'): boolean {
  return settings.paidJobsEnabled===true && Number(settings.monthlyCapPence)>0 && Number(settings.reservationPence)>0 && (type!=='analysis'||settings.liveAiEnabled===true);
}
