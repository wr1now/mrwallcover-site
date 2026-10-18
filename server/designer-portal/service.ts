/** Private API orchestration. No service credentials or configuration are imported
 * into the browser bundle. All actor identities come from Supabase Auth /user. */
import { validateProjectDraft } from '../../src/designer-portal/validation.ts';
import { computeApprovalScope, createEstimate, getPublicProductCatalog, toSharedEstimate, validatePricingConfig } from './pricing.ts';
import { createDefaultPricingConfig } from './defaults.ts';
import type { PricingConfig } from './pricing.ts';
import type { ProjectDraft } from '../../src/designer-portal/types.ts';

type Row = Record<string, any>;
export type PortalEnvironment = { get(name: string): string | undefined };
export interface PortalServiceOptions {
  env: PortalEnvironment;
  fetch?: typeof fetch;
  now?: () => Date;
}
export class PortalError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const MAX_BODY_BYTES = 2_000_000;
const BUCKET = 'designer-portal';
const FILE_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'], webp: ['image/webp'],
  heic: ['image/heic', 'image/heif'], heif: ['image/heif', 'image/heic'], tif: ['image/tiff'], tiff: ['image/tiff'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  doc: ['application/msword'], xls: ['application/vnd.ms-excel'], ppt: ['application/vnd.ms-powerpoint'],
  dwg: ['application/acad', 'application/dwg', 'image/vnd.dwg', 'application/octet-stream'],
  dxf: ['application/dxf', 'image/vnd.dxf', 'application/octet-stream', 'text/plain'],
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'], txt: ['text/plain'],
  ifc: ['application/x-step', 'application/step', 'application/octet-stream', 'text/plain'],
  rvt: ['application/octet-stream', 'application/vnd.autodesk.revit'],
  mpp: ['application/vnd.ms-project', 'application/msproject', 'application/octet-stream'],
};
function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PortalError(400, 'invalid_request', 'An object is required.');
  return value as Row;
}
function fields(value: Row, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new PortalError(400, 'invalid_request', 'Unexpected request field.');
}
function uuid(value: unknown, label = 'ID'): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new PortalError(400, 'invalid_request', `Invalid ${label}.`);
  return value;
}
function textValue(value: unknown, min = 1, max = 120): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u001f]/.test(value)) throw new PortalError(400, 'invalid_request', 'Invalid text value.');
  return value.trim();
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) throw new PortalError(400, 'invalid_request', 'Invalid integer value.');
  return value as number;
}
async function boundedBody(body: ReadableStream<Uint8Array> | null, maximum: number): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const reader = body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new PortalError(413, 'request_too_large', 'The request is too large.'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
export function uploadSpecification(raw: unknown) {
  const data = object(raw); fields(data, ['projectId', 'fileName', 'mime', 'bytes', 'sha256', 'priorDocumentId']);
  const fileName = textValue(data.fileName, 1, 180);
  if (/[\\/]/.test(fileName) || fileName === '.' || fileName === '..') throw new PortalError(400, 'invalid_file', 'Use a file name without a path.');
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const mime = typeof data.mime === 'string' ? data.mime.toLowerCase().trim() : '';
  const accepted = FILE_TYPES[extension];
  // Browsers frequently supply an empty MIME for native CAD/Office. The server
  // still constrains the extension and the worker verifies the actual content.
  if (!accepted || (mime && !accepted.includes(mime) && mime !== 'application/octet-stream')) throw new PortalError(400, 'invalid_file', 'Unsupported document type or extension.');
  if (typeof data.sha256 !== 'string' || !SHA.test(data.sha256)) throw new PortalError(400, 'invalid_file', 'A SHA-256 checksum is required.');
  return { projectId: uuid(data.projectId, 'project ID'), fileName, extension, mime: mime || accepted[0], bytes: integer(data.bytes, 1, 104857600), sha256: data.sha256, priorDocumentId: data.priorDocumentId ? uuid(data.priorDocumentId, 'prior document ID') : null };
}
export function safeStorageUrl(base: string, raw: unknown): string {
  if (typeof raw !== 'string' || raw.startsWith('//')) throw new PortalError(502, 'invalid_storage_response', 'Storage did not return a usable link.');
  const baseUrl = new URL(base);
  const full = raw.startsWith('/storage/v1/') ? new URL(raw, baseUrl) : raw.startsWith('/') ? new URL(`/storage/v1${raw}`, baseUrl) : new URL(raw, `${baseUrl.origin}/storage/v1/`);
  if (full.origin !== baseUrl.origin || !full.pathname.startsWith('/storage/v1/object/') || full.username || full.password) throw new PortalError(502, 'invalid_storage_response', 'Storage did not return a usable link.');
  return full.href;
}
export async function tokenHash(token: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function newToken(): string { return [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
function projectView(row: Row) { return { id: row.id, studioId: row.studio_id, name: row.name, revision: row.revision, draft: row.draft, createdAt: row.created_at, updatedAt: row.updated_at }; }
function documentView(row: Row) { return { id: row.id, projectId: row.project_id, revision: row.revision, supersedesDocumentId: row.supersedes_document_id || null, fileName: row.file_name, mime: row.actual_mime || row.declared_mime, bytes: row.bytes, sha256: row.sha256, status: row.state, state: row.state, verified: row.verified, reviewRequired: row.review_required, error: row.error, createdAt: row.created_at }; }
function jobView(row: Row) { return { id: row.id, projectId: row.project_id, type: row.type, state: row.state, status: row.state, attempts: row.attempts, maxAttempts: row.max_attempts, error: row.error, createdAt: row.created_at, updatedAt: row.updated_at }; }
function shareView(row: Row) { return { id: row.id, estimateId: row.estimate_id, expiresAt: row.expires_at, revokedAt: row.revoked_at, createdAt: row.created_at }; }
function operationsView(row: Row) { return { uploadsEnabled: row.uploads_enabled === true, workerEnabled: row.worker_enabled === true, monthlyBudgetPence: row.monthly_budget_pence ?? null, worstCaseJobPence: row.worst_case_job_pence ?? null }; }
function notificationConfiguration(row: Row) { return { enabled: row.notifications_enabled === true, provider: 'resend', sender: row.notification_sender ?? null, workspaceUrl: row.notification_workspace_url ?? null, monthlyCap: row.notification_monthly_cap ?? null, dailyStudioCap: row.notification_daily_studio_cap ?? null, monthlyBudgetPence: row.notification_monthly_budget_pence ?? null, worstCaseAttemptPence: row.notification_worst_case_attempt_pence ?? null }; }
function notificationView(row: Row) { return { id: row.id, state: row.state, recipientUserId: row.recipient_user_id, attempts: row.attempts, providerAcceptedAt: row.provider_accepted_at, deliveredAt: row.delivered_at, providerEvent: row.provider_event, error: row.error, createdAt: row.created_at }; }
function processingReason(row: Row, usage?: Row): string | null {
  if (!row.worker_enabled) return 'Document processing is disabled by the owner.';
  if (!row.monthly_budget_pence || !row.worst_case_job_pence) return 'Processing awaits an owner-approved budget and maximum job cost.';
  if (Number(usage?.reserved_pence || 0) + Number(usage?.committed_pence || 0) + 3 * Number(row.worst_case_job_pence) > Number(row.monthly_budget_pence)) return 'The monthly processing allowance has no capacity for another job.';
  return null;
}
function mapDatabaseError(body: Row): PortalError {
  const message = String(body.message || '');
  if (/conflict|Idempotency key already used/i.test(message)) return new PortalError(409, 'revision_conflict', 'The saved version changed. Reload before continuing.');
  if (/Owner .*required|Owner permission/i.test(message)) return new PortalError(403, 'forbidden', 'Owner permission is required.');
  if (/unavailable/i.test(message)) return new PortalError(404, 'not_found', 'This private record is unavailable.');
  if (/disabled/i.test(message)) return new PortalError(503, 'not_configured', 'This service is not enabled yet.');
  if (/limit|Unsupported|expired|requires review|Verified document required|Native CAD|duration/i.test(message)) return new PortalError(400, 'action_unavailable', message.slice(0, 180));
  return new PortalError(503, 'backend_unavailable', 'The private service could not complete this action.');
}
class RestBackend {
  base: string; key: string; fetcher: typeof fetch;
  constructor(base: string, key: string, fetcher: typeof fetch) { this.base = base; this.key = key; this.fetcher = fetcher; }
  async request(path: string, method = 'GET', body?: unknown): Promise<any> {
    let response: Response;
    try { response = await this.fetcher(`${this.base}${path}`, { method, headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000) }); }
    catch { throw new PortalError(503, 'backend_unavailable', 'The private service is temporarily unavailable.'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw mapDatabaseError(data);
    return data;
  }
  async select(table: string, query = ''): Promise<Row[]> { return this.request(`/rest/v1/${table}?select=*&${query}`); }
  async rpc(name: string, args: Row): Promise<any> { const result = await this.request(`/rest/v1/rpc/${name}`, 'POST', args); return Array.isArray(result) ? result[0] : result; }
  async signedUpload(path: string) {
    const data = await this.request(`/storage/v1/object/upload/sign/${BUCKET}/${path}`, 'POST', {});
    return { uploadUrl: safeStorageUrl(this.base, data.url || data.signedURL || data.signedUrl), token: data.token, expiresIn: 7200 };
  }
  async signedDownload(path: string) {
    const data = await this.request(`/storage/v1/object/sign/${BUCKET}/${path}`, 'POST', { expiresIn: 300 });
    return { url: safeStorageUrl(this.base, data.signedURL || data.signedUrl || data.url), expiresIn: 300 };
  }
}
function configured(options: PortalServiceOptions) {
  const env = options.env;
  const base = env.get('SUPABASE_URL')?.replace(/\/$/, '');
  const serviceKey = env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = env.get('SUPABASE_ANON_KEY');
  if (env.get('DESIGNER_PORTAL_ENABLED') !== 'true' || !base || !serviceKey || !anonKey) return null;
  try { const url = new URL(base); if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/') return null; }
  catch { return null; }
  return { base, serviceKey, anonKey };
}
function emailList(raw?: string) { return (raw || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean); }
export function createDesignerPortalHandler(options: PortalServiceOptions) {
  const fetcher = options.fetch || globalThis.fetch;
  const now = options.now || (() => new Date());
  return async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    const origins = emailList(options.env.get('DESIGNER_PORTAL_ALLOWED_ORIGINS') || 'https://www.mrwallcover.com,https://mrwallcover.com,http://localhost:4321');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin' };
    if (origin && origins.includes(origin.toLowerCase())) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers });
    try {
      if (origin && !origins.includes(origin.toLowerCase())) throw new PortalError(403, 'origin_denied', 'This origin is not permitted.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info', 'Access-Control-Max-Age': '600' } });
      const config = configured(options);
      if (!config) throw new PortalError(503, 'not_configured', 'The private designer workspace is not configured yet.');
      if (request.method !== 'POST') throw new PortalError(405, 'method_not_allowed', 'Use a POST action.');
      if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new PortalError(415, 'invalid_request', 'Send JSON.');
      if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new PortalError(413, 'request_too_large', 'The request is too large.');
      const raw = new TextDecoder().decode(await boundedBody(request.body, MAX_BODY_BYTES));
      let envelope: Row;
      try { envelope = object(JSON.parse(raw)); } catch { throw new PortalError(400, 'invalid_request', 'Send a valid action object.'); }
      fields(envelope, ['action', 'payload']);
      const action = textValue(envelope.action, 1, 80), payload = object(envelope.payload ?? {});
      const db = new RestBackend(config.base, config.serviceKey, fetcher);
      // An unguessable token is the only public capability; it can resolve only
      // the saved allowlisted estimate. No raw project/document endpoint is public.
      if (action === 'share.get' || action === 'share.pdf') {
        fields(payload, ['token']);
        if (typeof payload.token !== 'string' || !SHA.test(payload.token)) throw new PortalError(404, 'not_found', 'This share is unavailable or has expired.');
        const hash = await tokenHash(payload.token);
        const shared = await db.rpc('designer_resolve_share', { p_hash: hash });
        if (!shared) throw new PortalError(404, 'not_found', 'This share is unavailable or has expired.');
        if (action === 'share.pdf') {
          if (!shared.pdfAvailable) throw new PortalError(409, 'pdf_pending', 'The PDF has not completed yet.');
          const share = (await db.select('designer_shares', `token_hash=eq.${hash}&revoked_at=is.null`))[0];
          const file = share ? (await db.select('designer_estimate_files', `estimate_id=eq.${share.estimate_id}&state=eq.ready`))[0] : null;
          if (!file) throw new PortalError(404, 'not_found', 'This share is unavailable or has expired.');
          const pdfResponse = await fetcher(`${config.base}/storage/v1/object/authenticated/${BUCKET}/${file.storage_path}`, { headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` }, signal: AbortSignal.timeout(15_000) });
          if (!pdfResponse.ok) throw new PortalError(503, 'pdf_unavailable', 'The saved PDF is temporarily unavailable.');
          const bytes = await boundedBody(pdfResponse.body, 20971520);
          if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new PortalError(503, 'pdf_unavailable', 'The saved PDF needs review.');
          return new Response(bytes.buffer as ArrayBuffer, { status: 200, headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="mr-wallcover-estimate-${share.estimate_id}.pdf"` } });
        }
        return reply(200, { ok: true, data: shared });
      }
      const auth = request.headers.get('Authorization');
      if (!auth || !/^Bearer [^\s]+$/.test(auth)) throw new PortalError(401, 'sign_in_required', 'Sign in with your verified email.');
      let authResponse: Response;
      try { authResponse = await fetcher(`${config.base}/auth/v1/user`, { headers: { apikey: config.anonKey, Authorization: auth }, signal: AbortSignal.timeout(15_000) }); }
      catch { throw new PortalError(503, 'auth_unavailable', 'Sign-in verification is temporarily unavailable.'); }
      if (!authResponse.ok) throw new PortalError(401, 'sign_in_required', 'Your sign-in expired. Sign in again.');
      const user = await authResponse.json();
      if (!user.email || !user.email_confirmed_at || user.is_anonymous || typeof user.id !== 'string' || !UUID.test(user.id)) throw new PortalError(403, 'email_not_verified', 'Confirm your email before opening this private workspace.');
      const actor = user.id, email = String(user.email).toLowerCase();
      const envRole = emailList(options.env.get('DESIGNER_PORTAL_OWNER_EMAILS')).includes(email) ? 'owner' : emailList(options.env.get('DESIGNER_PORTAL_STAFF_EMAILS')).includes(email) ? 'staff' : null;
      if (envRole) await db.rpc('designer_set_staff', { p_user: actor, p_email: email, p_role: envRole });
      const staff = (await db.select('designer_staff', `user_id=eq.${actor}`))[0];
      const staffRole = staff?.role === 'owner' ? 'owner' : staff?.role === 'staff' ? 'staff' : null;
      await db.rpc('designer_accept_invitations', { p_actor: actor, p_email: email });
      const settings = (await db.select('designer_settings', 'id=eq.true'))[0] || {};
      async function access(studioId: string, write = false, ownerOnly = false) {
        if (staffRole && (!ownerOnly || staffRole === 'owner')) return;
        const member = (await db.select('designer_memberships', `studio_id=eq.${studioId}&user_id=eq.${actor}`))[0];
        if (!member || (write && !['owner', 'editor'].includes(member.role)) || (ownerOnly && member.role !== 'owner')) throw new PortalError(404, 'not_found', 'This private workspace is unavailable.');
      }
      function ownerAdmin() { if (staffRole !== 'owner') throw new PortalError(403, 'forbidden', 'Only the owner administrator can approve pricing configuration.'); }
      async function project(id: unknown, write = false) {
        const row = (await db.select('designer_projects', `id=eq.${uuid(id, 'project ID')}`))[0];
        if (!row) throw new PortalError(404, 'not_found', 'This private project is unavailable.');
        await access(row.studio_id, write); return row;
      }
      async function document(p: Row, id: unknown) {
        const row = (await db.select('designer_documents', `id=eq.${uuid(id, 'document ID')}&project_id=eq.${p.id}&studio_id=eq.${p.studio_id}`))[0];
        if (!row) throw new PortalError(404, 'not_found', 'This private document is unavailable.'); return row;
      }
      async function estimate(p: Row, id: unknown) {
        const row = (await db.select('designer_estimates', `id=eq.${uuid(id, 'estimate ID')}&project_id=eq.${p.id}&studio_id=eq.${p.studio_id}`))[0];
        if (!row) throw new PortalError(404, 'not_found', 'This private estimate is unavailable.'); return row;
      }
      function validatedDraft(rawDraft: unknown): ProjectDraft {
        const validated = validateProjectDraft(rawDraft);
        if (!validated.ok) throw new PortalError(400, 'invalid_draft', validated.issues.map(issue => `${issue.path}: ${issue.message}`).slice(0, 3).join(' ').slice(0, 400));
        return validated.value;
      }
      async function activeConfig(): Promise<{ row: Row; value: PricingConfig }> {
        const row = (await db.select('designer_configs', 'active=eq.true&limit=1'))[0];
        if (!row) throw new PortalError(503, 'pricing_not_configured', 'Pricing is awaiting owner configuration. Your draft can still be saved.');
        const checked = validatePricingConfig(row.config);
        if (!checked.ok) throw new PortalError(503, 'pricing_not_configured', 'Pricing configuration needs owner review.');
        return { row, value: checked.value };
      }
      let result: unknown;
      switch (action) {
        case 'session': {
          fields(payload, []);
          const usage = (await db.select('designer_budget_months', `month=eq.${now().toISOString().slice(0, 7)}-01`))[0];
          const memberships = await db.select('designer_memberships', `user_id=eq.${actor}`);
          const studios = staffRole ? await db.select('designer_studios', 'order=created_at.desc&limit=100') : memberships.length ? await db.select('designer_studios', `id=in.(${memberships.map(m => m.studio_id).join(',')})`) : [];
          result = { user: { id: actor, email }, staffRole, studios: studios.map(studio => ({ id: studio.id, name: studio.name, role: memberships.find(m => m.studio_id === studio.id)?.role || 'editor' })), capabilities: { uploadsEnabled: settings.uploads_enabled === true, workerEnabled: settings.worker_enabled === true && !processingReason(settings, usage), processingReason: processingReason(settings, usage) } }; break;
        }
        case 'studio.create': {
          fields(payload, ['name']); const row = await db.rpc('designer_create_studio', { p_actor: actor, p_name: textValue(payload.name) }); result = { studio: { id: row.id, name: row.name, role: 'owner' } }; break;
        }
        case 'catalog.products': {
          fields(payload, []); const row = (await db.select('designer_configs', 'active=eq.true&limit=1'))[0];
          const checked = row ? validatePricingConfig(row.config) : null;
          result = { products: checked?.ok ? getPublicProductCatalog(checked.value) : [] }; break;
        }
        case 'studio.members.save': {
          fields(payload, ['studioId', 'email', 'role']); const studioId = uuid(payload.studioId); await access(studioId, true, true);
          const memberEmail = textValue(payload.email, 3, 254).toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(memberEmail) || !['editor', 'viewer'].includes(payload.role)) throw new PortalError(400, 'invalid_request', 'Use an email and editor or viewer role.');
          await db.rpc('designer_invite_member', { p_actor: actor, p_studio: studioId, p_email: memberEmail, p_role: payload.role });
          result = { invited: true, email: memberEmail, role: payload.role, delivery: 'not_sent', note: 'The member can sign in with this email. No invitation email has been sent.' }; break;
        }
        case 'studio.members.list': {
          fields(payload, ['studioId']); const studioId = uuid(payload.studioId); await access(studioId, false, true);
          result = await db.rpc('designer_list_members', { p_actor: actor, p_studio: studioId }); break;
        }
        case 'studio.members.remove': {
          fields(payload, ['studioId', 'userId', 'email']); const studioId = uuid(payload.studioId); await access(studioId, true, true);
          const userId = payload.userId ? uuid(payload.userId, 'member ID') : null;
          const invitedEmail = payload.email ? textValue(payload.email, 3, 254).toLowerCase() : null;
          if (!userId && !invitedEmail) throw new PortalError(400, 'invalid_request', 'Provide a member ID or invitation email.');
          await db.rpc('designer_remove_member', { p_actor: actor, p_studio: studioId, p_user: userId, p_email: invitedEmail }); result = { removed: true }; break;
        }
        case 'project.list': {
          fields(payload, ['studioId']); const studioId = uuid(payload.studioId); await access(studioId); result = { projects: (await db.select('designer_projects', `studio_id=eq.${studioId}&order=updated_at.desc&limit=100`)).map(projectView) }; break;
        }
        case 'project.create': case 'project.save': {
          fields(payload, action === 'project.create' ? ['studioId', 'name', 'draft'] : ['projectId', 'expectedRevision', 'name', 'draft']);
          const existing = action === 'project.save' ? await project(payload.projectId, true) : null;
          const studioId = existing?.studio_id || uuid(payload.studioId); await access(studioId, true);
          const id = existing?.id || crypto.randomUUID();
          const draft = validatedDraft(payload.draft);
          const row = await db.rpc('designer_save_project', { p_actor: actor, p_studio: studioId, p_id: id, p_name: textValue(payload.name || draft.name), p_draft: { ...draft, id }, p_expected_revision: existing ? integer(payload.expectedRevision, 1) : 0 });
          result = { project: projectView(row) }; break;
        }
        case 'project.get': {
          fields(payload, ['projectId']); const p = await project(payload.projectId);
          const query = `project_id=eq.${p.id}&studio_id=eq.${p.studio_id}`;
          const [revisions, documents, evidence, estimates, jobs, shares, files, checks, notifications] = await Promise.all([
            db.select('designer_revisions', `${query}&order=number.desc&limit=100`), db.select('designer_documents', `${query}&order=created_at`),
            db.select('designer_evidence', `${query}&order=created_at&limit=1000`), db.select('designer_estimates', `${query}&order=created_at.desc`),
            db.select('designer_jobs', `${query}&order=created_at.desc&limit=100`), db.select('designer_shares', `${query}&order=created_at.desc`), db.select('designer_estimate_files', query), db.select('designer_evidence_checks', `${query}&order=checked_at.desc&limit=2000`), db.select('designer_notifications', `${query}&order=created_at.desc&limit=100`),
          ]);
          result = { project: projectView(p), revisions: revisions.map(r => ({ id: r.id, number: r.number, draft: r.draft, createdAt: r.created_at })), documents: documents.map(documentView), evidence: evidence.map(e => ({ ...e.evidence, id: e.id, documentId: e.document_id, confirmed: checks.some(c => c.evidence_id === e.id && c.project_revision === p.revision), confirmations: checks.filter(c => c.evidence_id === e.id).map(c => ({ evidenceId: c.evidence_id, projectRevision: c.project_revision, checkedBy: c.checked_by, checkedAt: c.checked_at })) })), estimates: estimates.map(e => ({ ...e.snapshot, pdfState: files.find(f => f.estimate_id === e.id)?.state || 'pending' })), jobs: jobs.map(jobView), shares: shares.map(shareView), notifications: notifications.map(notificationView) }; break;
        }
        case 'upload.reserve': {
          const spec = uploadSpecification(payload); const p = await project(spec.projectId, true);
          if (!settings.uploads_enabled) throw new PortalError(503, 'uploads_disabled', 'Private uploads are not enabled yet.');
          const row = await db.rpc('designer_reserve_document', { p_actor: actor, p_project: p.id, p_id: crypto.randomUUID(), p_name: spec.fileName, p_mime: spec.mime, p_bytes: spec.bytes, p_sha: spec.sha256, p_extension: spec.extension, p_previous: spec.priorDocumentId });
          result = { document: documentView(row), ...await db.signedUpload(row.storage_path) }; break;
        }
        case 'upload.complete': case 'document.extract': case 'document.status': case 'upload.status': case 'document.url': {
          fields(payload, ['projectId', 'documentId']); const writes = ['upload.complete', 'document.extract'].includes(action); const p = await project(payload.projectId, writes); const d = await document(p, payload.documentId);
          if (action === 'upload.complete') { const job = await db.rpc('designer_complete_upload', { p_actor: actor, p_document: d.id }); result = { document: documentView({ ...d, state: job.state === 'succeeded' ? d.state : job.state === 'running' ? 'verifying' : job.state === 'failed' ? d.state : 'queued' }), job: jobView(job) }; }
          else if (action === 'document.extract') { const job = await db.rpc('designer_enqueue_extract', { p_actor: actor, p_document: d.id }); result = { job: jobView(job) }; }
          else if (action === 'document.url') { if (!d.verified || !['ready', 'review_required'].includes(d.state)) throw new PortalError(409, 'verification_pending', 'This file is not available until content verification completes.'); result = await db.signedDownload(d.storage_path); }
          else { const jobs = await db.select('designer_jobs', `project_id=eq.${p.id}&studio_id=eq.${p.studio_id}&identity=eq.${d.id}&order=created_at.desc`); result = { document: documentView(d), jobs: jobs.map(jobView) }; } break;
        }
        case 'jobs.status': {
          fields(payload, ['projectId']); const p = await project(payload.projectId); result = { jobs: (await db.select('designer_jobs', `project_id=eq.${p.id}&studio_id=eq.${p.studio_id}&order=created_at.desc&limit=100`)).map(jobView) }; break;
        }
        case 'notifications.status': {
          fields(payload, ['projectId']); const p = await project(payload.projectId);
          result = { notifications: (await db.select('designer_notifications', `project_id=eq.${p.id}&studio_id=eq.${p.studio_id}&order=created_at.desc&limit=100`)).map(notificationView) }; break;
        }
        case 'evidence.confirm': {
          fields(payload, ['projectId', 'evidenceId', 'expectedRevision', 'checked']); if (payload.checked !== true) throw new PortalError(400, 'source_check_required', 'Explicitly check the source before confirming this fact.');
          const p = await project(payload.projectId, true);
          const row = await db.rpc('designer_confirm_evidence', { p_actor: actor, p_project: p.id, p_evidence: uuid(payload.evidenceId, 'evidence ID'), p_expected_revision: integer(payload.expectedRevision, 1) });
          result = { confirmation: { evidenceId: row.evidence_id, projectRevision: row.project_revision, checkedBy: row.checked_by, checkedAt: row.checked_at } }; break;
        }
        case 'estimate.preview': case 'estimate.issue': {
          fields(payload, action === 'estimate.preview' ? ['projectId'] : ['projectId', 'expectedRevision', 'idempotencyKey']);
          const p = await project(payload.projectId, action === 'estimate.issue');
          if (action === 'estimate.issue') {
            const key = textValue(payload.idempotencyKey, 8, 100);
            const existing = (await db.select('designer_estimates', `studio_id=eq.${p.studio_id}&idempotency_key=eq.${encodeURIComponent(key)}&limit=1`))[0];
            if (existing) {
              if (existing.project_id !== p.id || existing.project_revision !== integer(payload.expectedRevision, 1)) throw new PortalError(409, 'revision_conflict', 'This issue request belongs to a different saved revision.');
              const jobs = await db.select('designer_jobs', `project_id=eq.${p.id}&studio_id=eq.${p.studio_id}&type=eq.estimate.pdf&identity=eq.${existing.id}`);
              result = { estimate: existing.snapshot, job: jobs[0] ? jobView(jobs[0]) : null }; break;
            }
          }
          const trusted = await activeConfig(); const draft = validatedDraft(p.draft);
          const id = crypto.randomUUID();
          const snapshot = createEstimate(draft, trusted.value, { id, projectId: p.id, projectRevision: p.revision, createdAt: now().toISOString() });
          if (action === 'estimate.preview') { result = { estimate: snapshot }; break; }
          if (snapshot.status !== 'ready') throw new PortalError(409, 'estimate_requires_review', 'Complete the missing information and owner review before issuing this estimate.');
          const row = await db.rpc('designer_issue_estimate', { p_actor: actor, p_project: p.id, p_expected_revision: integer(payload.expectedRevision, 1), p_estimate_id: id, p_config_id: trusted.row.id, p_snapshot: snapshot, p_projection: toSharedEstimate(snapshot), p_idempotency: textValue(payload.idempotencyKey, 8, 100) });
          const jobs = await db.select('designer_jobs', `project_id=eq.${p.id}&studio_id=eq.${p.studio_id}&type=eq.estimate.pdf&identity=eq.${row.id}`);
          result = { estimate: row.snapshot, job: jobs[0] ? jobView(jobs[0]) : null }; break;
        }
        case 'estimate.list': case 'estimate.get': case 'estimate.pdf': {
          fields(payload, action === 'estimate.list' ? ['projectId'] : ['projectId', 'estimateId']); const p = await project(payload.projectId);
          if (action === 'estimate.list') { result = { estimates: (await db.select('designer_estimates', `project_id=eq.${p.id}&studio_id=eq.${p.studio_id}&order=created_at.desc`)).map(e => e.snapshot) }; break; }
          const e = await estimate(p, payload.estimateId);
          const file = (await db.select('designer_estimate_files', `estimate_id=eq.${e.id}&studio_id=eq.${p.studio_id}`))[0];
          if (action === 'estimate.get') result = { estimate: e.snapshot, provenance: e.source_manifest, pdfState: file?.state || 'pending' };
          else { if (file?.state !== 'ready') throw new PortalError(409, 'pdf_pending', 'The PDF has not completed yet.'); result = await db.signedDownload(file.storage_path); } break;
        }
        case 'share.create': {
          fields(payload, ['projectId', 'estimateId', 'expiresInDays']); const p = await project(payload.projectId, true); const e = await estimate(p, payload.estimateId);
          const token = newToken(), hash = await tokenHash(token); const row = await db.rpc('designer_create_share', { p_actor: actor, p_estimate: e.id, p_hash: hash, p_days: integer(payload.expiresInDays ?? 7, 1, 30) });
          const shareOrigin = options.env.get('DESIGNER_PORTAL_SITE_URL') || 'https://www.mrwallcover.com';
          const url = new URL('/designer-portal/', shareOrigin); url.hash = `share=${token}`;
          result = { share: shareView(row), token, url: url.href }; break;
        }
        case 'share.revoke': {
          fields(payload, ['projectId', 'shareId']); const p = await project(payload.projectId, true);
          const s = (await db.select('designer_shares', `id=eq.${uuid(payload.shareId)}&project_id=eq.${p.id}&studio_id=eq.${p.studio_id}`))[0];
          if (!s) throw new PortalError(404, 'not_found', 'Share unavailable.');
          await db.rpc('designer_revoke_share', { p_actor: actor, p_share: s.id }); result = { revoked: true }; break;
        }
        case 'admin.notifications.get': {
          fields(payload, []); ownerAdmin(); result = { configuration: notificationConfiguration(settings), usage: await db.select('designer_notification_usage', 'order=month.desc&limit=12') }; break;
        }
        case 'admin.notifications.save': {
          ownerAdmin(); fields(payload, ['enabled', 'provider', 'sender', 'workspaceUrl', 'monthlyCap', 'dailyStudioCap', 'monthlyBudgetPence', 'worstCaseAttemptPence']);
          if (typeof payload.enabled !== 'boolean' || payload.provider !== 'resend') throw new PortalError(400, 'invalid_configuration', 'Choose the supported transactional notification provider and enabled flag.');
          const sender = payload.sender === null ? null : textValue(payload.sender, 3, 254).toLowerCase();
          const workspaceUrl = payload.workspaceUrl === null ? null : textValue(payload.workspaceUrl, 10, 300);
          if ((sender && !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(sender)) || (workspaceUrl && !/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?\/designer-portal\/?$/.test(workspaceUrl))) throw new PortalError(400, 'invalid_configuration', 'Use a plain sender email and HTTPS workspace URL.');
          const monthlyCap = payload.monthlyCap === null ? null : integer(payload.monthlyCap, 1, 10000), dailyStudioCap = payload.dailyStudioCap === null ? null : integer(payload.dailyStudioCap, 1, 100);
          const monthlyBudgetPence = payload.monthlyBudgetPence === null ? null : integer(payload.monthlyBudgetPence, 1, 1000000000), worstCaseAttemptPence = payload.worstCaseAttemptPence === null ? null : integer(payload.worstCaseAttemptPence, 1, 1000000);
          if (payload.enabled && (!sender || !workspaceUrl || !monthlyCap || !dailyStudioCap || !monthlyBudgetPence || !worstCaseAttemptPence || monthlyBudgetPence < 3 * worstCaseAttemptPence)) throw new PortalError(400, 'invalid_configuration', 'Configure the sender, workspace, count caps and maximum budget for all three attempts before enabling notifications.');
          const row = await db.rpc('designer_save_notification_settings', { p_actor: actor, p_config: { enabled: payload.enabled, provider: 'resend', sender, workspaceUrl, monthlyCap, dailyStudioCap, monthlyBudgetPence, worstCaseAttemptPence } });
          result = { configuration: notificationConfiguration(row) }; break;
        }
        case 'admin.operations.get': {
          fields(payload, []); ownerAdmin(); const usage = await db.select('designer_budget_months', 'order=month.desc&limit=12'); const current = usage.find(u => String(u.month).slice(0, 7) === now().toISOString().slice(0, 7)); result = { operations: operationsView(settings), processingStatus: { enabled: !processingReason(settings, current), reason: processingReason(settings, current) }, usage }; break;
        }
        case 'admin.operations.save': {
          fields(payload, ['uploadsEnabled', 'workerEnabled', 'monthlyBudgetPence', 'worstCaseJobPence']); ownerAdmin();
          if (typeof payload.uploadsEnabled !== 'boolean' || typeof payload.workerEnabled !== 'boolean') throw new PortalError(400, 'invalid_configuration', 'Use true or false for operational flags.');
          const budget = payload.monthlyBudgetPence === null ? null : integer(payload.monthlyBudgetPence, 1, 1000000000);
          const jobCost = payload.worstCaseJobPence === null ? null : integer(payload.worstCaseJobPence, 1, 100000000);
          if (payload.workerEnabled && (!budget || !jobCost || budget < 3 * jobCost)) throw new PortalError(400, 'invalid_configuration', 'A worker budget must cover the maximum cost of all three attempts.');
          const row = await db.rpc('designer_save_operations', { p_actor: actor, p_uploads: payload.uploadsEnabled, p_worker: payload.workerEnabled, p_budget: budget, p_job_cost: jobCost }); result = { operations: operationsView(row), processingStatus: { enabled: !processingReason(row), reason: processingReason(row) } }; break;
        }
        case 'admin.config.get': {
          fields(payload, []); ownerAdmin(); const row = (await db.select('designer_configs', 'active=eq.true&limit=1'))[0]; result = { config: row?.config || createDefaultPricingConfig(), version: row?.version || 0 }; break;
        }
        case 'admin.config.save': case 'admin.agreement.save': {
          ownerAdmin(); fields(payload, action === 'admin.config.save' ? ['expectedVersion', 'config'] : ['expectedVersion', 'projectId', 'projectRevision', 'agreement', 'servicePlan']);
          const expectedVersion = integer(payload.expectedVersion);
          let candidate: unknown = payload.config;
          if (action === 'admin.agreement.save') {
            const p = await project(payload.projectId, true); if (p.revision !== integer(payload.projectRevision, 1)) throw new PortalError(409, 'revision_conflict', 'The saved project changed. Reload before approval.');
            const trusted = await activeConfig(); if (trusted.row.version !== expectedVersion) throw new PortalError(409, 'revision_conflict', 'Pricing configuration changed. Reload before approval.');
            if (!payload.agreement && !payload.servicePlan) throw new PortalError(400, 'invalid_configuration', 'Provide an agreement or a service plan.');
            const agreement: Row | null = payload.agreement ? { ...object(payload.agreement), projectId: p.id, projectRevision: p.revision } : null;
            const servicePlan: Row | null = payload.servicePlan ? { ...object(payload.servicePlan), projectId: p.id, projectRevision: p.revision } : null;
            if (agreement?.scopeFingerprint === 'current') agreement.scopeFingerprint = computeApprovalScope(validatedDraft(p.draft), agreement.itemId, trusted.value);
            if (servicePlan?.scopeFingerprint === 'current') servicePlan.scopeFingerprint = computeApprovalScope(validatedDraft(p.draft), undefined, trusted.value);
            candidate = { ...trusted.value,
              agreements: agreement ? [...trusted.value.agreements.filter((a: any) => a.id !== agreement.id), agreement] : trusted.value.agreements,
              servicePlans: servicePlan ? [...trusted.value.servicePlans.filter((a: any) => a.id !== servicePlan.id), servicePlan] : trusted.value.servicePlans };
          }
          const checked = validatePricingConfig({ ...object(candidate), version: `v${expectedVersion + 1}` });
          if (!checked.ok) throw new PortalError(400, 'invalid_configuration', checked.issues.map(issue => `${issue.path}: ${issue.message}`).slice(0, 3).join(' ').slice(0, 400));
          const row = await db.rpc('designer_save_config', { p_actor: actor, p_expected_version: expectedVersion, p_config: checked.value }); result = { config: row.config, version: row.version }; break;
        }
        default: throw new PortalError(400, 'unknown_action', 'This action is not supported.');
      }
      return reply(200, { ok: true, data: result });
    } catch (error) {
      const known = error instanceof PortalError ? error : new PortalError(503, 'service_unavailable', 'The private service could not complete this action.');
      return reply(known.status, { ok: false, error: { code: known.code, message: known.message } });
    }
  };
}
