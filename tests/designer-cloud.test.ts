import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortalCloud } from '../src/designer-portal/cloud.ts';

const config = { enabled: true, url: 'https://portal.example.invalid', anonKey: 'synthetic-public-key' };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const identity = { user: { id: 'synthetic-user', email: 'designer@example.invalid' }, staffRole: null, studios: [], capabilities: { uploadsEnabled: false, workerEnabled: false } };

test('unconfigured/unsafe cloud origins cannot transmit a brief', async () => {
  let calls = 0;
  for (const url of ['', 'http://example.invalid', 'https://user:password@example.invalid', 'https://example.invalid/path', 'https://example.invalid?key=x', 'https://example.invalid#token']) {
    const cloud = createPortalCloud({ ...config, url }, async () => { calls++; return response({}); });
    assert.equal(cloud.enabled, false);
    await assert.rejects(() => cloud.action('project.create'), /not activated/);
  }
  assert.equal(calls, 0);
});

test('authentication stays in the transport instance and logout clears it even if the server fails', async () => {
  const seen: { url: string; options: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, options = {}) => {
    seen.push({ url: String(url), options });
    if (String(url).endsWith('/verify')) return response({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 3600 });
    if (String(url).endsWith('/logout')) return response({}, 500);
    return response({ ok: true, data: identity });
  };
  const cloud = createPortalCloud(config, fetcher);
  await assert.rejects(() => cloud.action('project.list'), /Sign in/);
  await cloud.verify(identity.user.email, '123456');
  assert.equal(cloud.signedIn, true);
  const sessionRequest = seen.find(x => x.url.endsWith('/designer-portal'))!;
  assert.equal(new Headers(sessionRequest.options.headers).get('Authorization'), 'Bearer synthetic-access');
  assert.ok(seen.every(x => x.options.referrerPolicy === 'no-referrer'));
  assert.equal(createPortalCloud(config, fetcher).signedIn, false);
  await assert.rejects(() => cloud.signOut());
  assert.equal(cloud.signedIn, false);
});

test('concurrent requests refresh one expired token rather than racing the session', async () => {
  let refreshCount = 0;
  const fetcher: typeof fetch = async (url) => {
    if (String(url).endsWith('/verify')) return response({ access_token: 'expired', refresh_token: 'refresh', expires_at: 1 });
    if (String(url).includes('grant_type=refresh_token')) { refreshCount++; return response({ access_token: 'renewed', refresh_token: 'rotated', expires_in: 3600 }); }
    return response({ ok: true, data: identity });
  };
  const cloud = createPortalCloud(config, fetcher);
  await cloud.verify(identity.user.email, '123456');
  await Promise.all([cloud.action('project.list'), cloud.action('project.list')]);
  assert.equal(refreshCount, 1);
});

test('upload refuses oversized buffers before reading them', async () => {
  const cloud = createPortalCloud(config, async () => { throw new Error('unexpected network'); });
  let read = false;
  const file = { size: 100 * 1024 * 1024 + 1, arrayBuffer() { read = true; throw new Error('must not read'); } } as File;
  await assert.rejects(() => cloud.upload('project', file), /100 MiB/);
  assert.equal(read, false);
});

test('upload reserves a hash, refuses foreign destinations and never confirms failed transfers', async () => {
  const actions: string[] = [];
  const fetcher: typeof fetch = async (url, options) => {
    if (String(url).endsWith('/verify')) return response({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 });
    assert.equal(new URL(String(url)).origin, config.url, 'must never send a document to a foreign origin');
    const payload = JSON.parse(String(options?.body)); actions.push(payload.action);
    if (payload.action === 'upload.reserve') {
      assert.match(payload.payload.sha256, /^[a-f0-9]{64}$/); assert.equal(payload.payload.bytes, 12);
      return response({ ok: true, data: { document: { id: 'document' }, uploadUrl: 'https://foreign.example.invalid/upload' } });
    }
    return response({ ok: true, data: identity });
  };
  const cloud = createPortalCloud(config, fetcher); await cloud.verify(identity.user.email, '123456');
  await assert.rejects(() => cloud.upload('project', new File(['test-content'], 'test.txt', { type: 'text/plain' })), /destination/);
  assert.equal(actions.includes('upload.complete'), false);
});

test('shared PDF is requested with its revocable token and no account credential', async () => {
  let body: any, headers: Headers | undefined;
  const cloud = createPortalCloud(config, async (_url, options) => { body = JSON.parse(String(options?.body)); headers = new Headers(options?.headers); return new Response('%PDF-synthetic', { headers: { 'Content-Type': 'application/pdf' } }); });
  const pdf = await cloud.sharedPdf('synthetic-share-token');
  assert.deepEqual(body, { action: 'share.pdf', payload: { token: 'synthetic-share-token' } });
  assert.equal(headers?.has('Authorization'), false); assert.equal(pdf.type, 'application/pdf');
});
