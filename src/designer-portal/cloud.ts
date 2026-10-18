/** Browser transport only. Project drafts and credentials are never written to browser storage. */
export interface PortalConnection { enabled: boolean; url: string; anonKey: string }
export interface PortalSession { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number }
export interface PortalIdentity {
  user: { id: string; email: string };
  staffRole: 'owner' | 'staff' | null;
  studios: { id: string; name: string; role: 'owner' | 'editor' | 'viewer' }[];
  capabilities: { uploadsEnabled: boolean; workerEnabled: boolean; processingReason?: string | null };
}
export class PortalError extends Error {
  code: string;
  constructor(message: string, code = 'request_failed') { super(message); this.name = 'PortalError'; this.code = code; }
}

export function createPortalCloud(connection: PortalConnection, fetcher: typeof fetch = fetch) {
  let session: PortalSession | null = null;
  let refreshing: Promise<string> | null = null;
  const base = connection.url.replace(/\/$/, '');
  let validOrigin = '';
  try {
    const parsed = new URL(base);
    const protocol = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname));
    if (protocol && parsed.origin === base && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash) validOrigin = parsed.origin;
  } catch { /* Invalid configuration stays off. */ }
  const enabled = connection.enabled && Boolean(validOrigin && connection.anonKey);
  function configured() { if (!enabled) throw new PortalError('Private saving, uploads and automatic budgets are not activated. You can prepare a draft and download it below.', 'not_configured'); }
  async function auth(path: string, body: unknown, bearer?: string) {
    configured();
    const response = await fetcher(`${base}/auth/v1/${path}`, { method: 'POST', headers: { apikey: connection.anonKey, 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body), referrerPolicy: 'no-referrer' });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new PortalError(value.msg || value.error_description || 'Sign-in could not finish. Check the code or request a new one.', 'authentication_failed');
    return value;
  }
  async function accessToken() {
    if (!session) throw new PortalError('Sign in with your email to use your private workspace.', 'sign_in_required');
    if (session.expires_at && session.expires_at * 1000 < Date.now() + 60_000) {
      refreshing ??= auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token }).then(value => { session = { ...value, expires_at: value.expires_at || Math.floor(Date.now() / 1000) + value.expires_in }; return session!.access_token; }).finally(() => { refreshing = null; });
      return refreshing;
    }
    return session.access_token;
  }
  async function action<T>(name: string, payload: Record<string, unknown> = {}, publicRequest = false): Promise<T> {
    configured();
    const response = await fetcher(`${base}/functions/v1/designer-portal`, { method: 'POST', headers: { apikey: connection.anonKey, 'Content-Type': 'application/json', ...(!publicRequest ? { Authorization: `Bearer ${await accessToken()}` } : {}) }, body: JSON.stringify({ action: name, payload }), referrerPolicy: 'no-referrer' });
    const value = await response.json().catch(() => null);
    if (!response.ok || !value?.ok) throw new PortalError(value?.error?.message || 'This request could not finish. Your draft is still on this page.', value?.error?.code || 'request_failed');
    return value.data as T;
  }
  function privateUrl(value: string) {
    const parsed = new URL(value, base);
    if (parsed.origin !== validOrigin || parsed.username || parsed.password || !['https:', 'http:'].includes(parsed.protocol)) throw new PortalError('The private file destination could not be verified.', 'invalid_destination');
    return parsed.href;
  }
  return {
    enabled,
    get signedIn() { return Boolean(session); },
    async signIn(email: string) { await auth('otp', { email, create_user: true }); },
    async verify(email: string, token: string) { const value = await auth('verify', { email, token, type: 'email' }); session = { ...value, expires_at: value.expires_at || Math.floor(Date.now() / 1000) + value.expires_in }; return action<PortalIdentity>('session'); },
    async signOut() { try { if (session) await auth('logout', {}, session.access_token); } finally { session = null; } },
    action,
    async upload(projectId: string, file: File, priorDocumentId?: string) {
      configured();
      if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > 100 * 1024 * 1024) throw new PortalError('Choose a non-empty document of at most 100 MiB.', 'upload_size');
      const bytes = await file.arrayBuffer();
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      const sha256 = [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
      const reserved = await action<{ document: { id: string }; uploadUrl: string; token?: string }>('upload.reserve', { projectId, fileName: file.name, mime: file.type || 'application/octet-stream', bytes: file.size, sha256, ...(priorDocumentId ? { priorDocumentId } : {}) });
      const response = await fetcher(privateUrl(reserved.uploadUrl), { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: bytes, referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new PortalError('The document upload did not finish. Try again; the document is not confirmed as received.', 'upload_failed');
      return action<{ document: unknown; job?: unknown }>('upload.complete', { projectId, documentId: reserved.document.id });
    },
    async fileUrl(name: string, payload: Record<string, unknown>) { const value = await action<{ url: string }>(name, payload); return privateUrl(value.url); },
    async sharedPdf(token: string) {
      configured();
      const response = await fetcher(`${base}/functions/v1/designer-portal`, { method: 'POST', headers: { apikey: connection.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share.pdf', payload: { token } }), referrerPolicy: 'no-referrer' });
      if (!response.ok || !response.headers.get('Content-Type')?.includes('application/pdf')) { const value = await response.json().catch(() => null); throw new PortalError(value?.error?.message || 'The shared PDF is not available. Its link may have expired or been revoked.', value?.error?.code || 'pdf_unavailable'); }
      return response.blob();
    },
  };
}
export type PortalCloud = ReturnType<typeof createPortalCloud>;
