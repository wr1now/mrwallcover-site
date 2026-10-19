import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { runStaging, stagingConfiguration, syntheticPdf } from '../scripts/qa/designer-staging.mjs';

const REF = 'abcdefghijklmnopqrst', origin = `https://${REF}.supabase.co`;
const ids = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222', ready: '33333333-3333-4333-8333-333333333333', created: '44444444-4444-4444-8444-444444444444', estimate: '55555555-5555-4555-8555-555555555555', share: '66666666-6666-4666-8666-666666666666', expired: '77777777-7777-4777-8777-777777777777' };
function environment() { return { DESIGNER_STAGING_CONFIRM: 'RUN_SYNTHETIC_STAGING_ONLY', DESIGNER_STAGING_ORIGIN: origin, DESIGNER_STAGING_PROJECT_REF: REF, DESIGNER_STAGING_PRODUCTION_REFS: 'zzzzzzzzzzzzzzzzzzzz', DESIGNER_STAGING_ANON_KEY: 'synthetic-public-key', DESIGNER_STAGING_USER_A_TOKEN: 'synthetic-private-user-a-token', DESIGNER_STAGING_USER_B_TOKEN: 'synthetic-private-user-b-token', DESIGNER_STAGING_VIEWER_TOKEN: 'synthetic-private-viewer-token', DESIGNER_STAGING_OWNER_TOKEN: 'synthetic-private-owner-token', DESIGNER_STAGING_STUDIO_A_ID: ids.a, DESIGNER_STAGING_STUDIO_B_ID: ids.b, DESIGNER_STAGING_READY_PROJECT_ID: ids.ready, DESIGNER_STAGING_EXPECTED_TOTAL_PENCE: '12000' }; }
const response = (data: unknown, status = 200) => Response.json(status === 200 ? { ok: true, data } : { ok: false, error: { code: status === 409 ? 'revision_conflict' : 'forbidden', message: 'Synthetic protocol failure' } }, { status });

/** Stateful HTTP adapter: the production orchestration, request checks, worker polling and byte checks run unchanged. */
function adapter(options: { foreignUpload?: boolean; leakProjection?: boolean; neverVerify?: boolean; badPdfTotal?: boolean; notificationsEnabled?: boolean; transientSession?: boolean; failCreate?: boolean } = {}) {
  const env = environment(), requests: { actor: string | undefined; action: string; payload: any }[] = [], storage = new Map<string, Buffer>(), docs: any[] = [];
  let transientReturned = false; let created: any, extracted = false, confirmed = false, revoked = false, pdfReads = 0;
  const now = Date.parse('2026-10-18T12:00:00Z'), shareToken = 'a'.repeat(64);
  const ready = { id: ids.ready, studioId: ids.a, name: 'SYNTHETIC QA prepared scope', revision: 1, draft: { name: 'SYNTHETIC QA prepared scope', contact: { name: 'SYNTHETIC PRIVATE CONTACT', email: 'synthetic-contact@example.invalid' }, address: { line1: 'SYNTHETIC TEST SITE' }, propertyValuePence: 3000000000 } };
  const issued = { id: ids.estimate, projectId: ids.ready, projectRevision: 1, status: 'ready', subtotalPence: 10000, vatRateBps: 2000, vatPence: 2000, totalPence: 12000, validUntil: '2026-11-17T12:00:00Z', lines: [{ id: 'l', label: 'Synthetic installation', amountPence: 10000 }] };
  const pdf = Buffer.from('%PDF-1.4\nsynthetic offline worker output\n%%EOF');
  const tokens = { a: env.DESIGNER_STAGING_USER_A_TOKEN, b: env.DESIGNER_STAGING_USER_B_TOKEN, viewer: env.DESIGNER_STAGING_VIEWER_TOKEN, owner: env.DESIGNER_STAGING_OWNER_TOKEN };
  const fetcher = async (target: string, init: RequestInit) => {
    const url = new URL(target); assert.equal(url.origin, origin); assert.equal(init.redirect, 'error'); assert.ok(init.signal);
    if (url.pathname.startsWith('/storage/upload/')) { assert.equal(init.method, 'PUT'); assert.equal((init.headers as Record<string, string>)['x-upsert'], 'false'); storage.set(url.pathname.split('/').at(-1)!, Buffer.from(init.body as any)); return new Response('{}'); }
    if (url.pathname.startsWith('/storage/download/')) return new Response(storage.get(url.pathname.split('/').at(-1)!) || Buffer.alloc(0));
    if (url.pathname === '/storage/estimate.pdf') return new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } });
    assert.equal(url.pathname, '/functions/v1/designer-portal'); assert.equal(init.method, 'POST'); assert.equal((init.headers as Record<string, string>).apikey, env.DESIGNER_STAGING_ANON_KEY);
    const bearer = (init.headers as Record<string, string>).Authorization?.replace('Bearer ', ''), actor = Object.entries(tokens).find(([, value]) => value === bearer)?.[0];
    const { action, payload } = JSON.parse(init.body as string); requests.push({ actor, action, payload });
    if ((init.headers as Record<string, string>).Origin) return Response.json({ ok: false, error: { code: 'origin_denied' } }, { status: 403 });
    if (action === 'session' && options.transientSession && !transientReturned) { transientReturned = true; return response(null, 503); }
    if (action === 'session') return response({ user: { id: `${actor}-synthetic-id`, email: `synthetic-${actor}@example.invalid` }, staffRole: actor === 'owner' ? 'owner' : null, studios: [{ id: actor === 'b' ? ids.b : ids.a, role: actor === 'viewer' ? 'viewer' : 'owner' }], capabilities: { uploadsEnabled: true, workerEnabled: true } });
    if (action === 'admin.notifications.get') return response({ configuration: { enabled: options.notificationsEnabled ?? false } });
    if (action === 'admin.config.get' || (action === 'project.list' && payload.studioId === ids.b)) return response(null, 403);
    if (['project.get', 'upload.reserve', 'document.url'].includes(action) && actor === 'b') return response(null, 403);
    if (['project.save', 'upload.reserve'].includes(action) && actor === 'viewer') return response(null, 403);
    if (action === 'document.url' && !actor) return response(null, 401);
    if (action === 'project.create' && options.failCreate) return response(null, 503);
    if (action === 'project.create') { created = { id: ids.created, studioId: ids.a, revision: 1, name: payload.name, draft: payload.draft }; return response({ project: created }); }
    if (action === 'project.save') { if (payload.expectedRevision !== created.revision) return response(null, 409); created = { ...created, revision: created.revision + 1 }; return response({ project: created }); }
    if (action === 'project.get') return response({ project: payload.projectId === ids.ready ? ready : created, shares: [{ id: ids.expired, expiresAt: '2026-10-17T12:00:00Z', revokedAt: null }], documents: docs, jobs: [], evidence: extracted ? [{ id: '88888888-8888-4888-8888-888888888888', documentId: docs.at(-1).id, confirmed, source: { documentId: docs.at(-1).id, page: 1 } }] : [] });
    if (action === 'estimate.preview') return response({ estimate: payload.projectId === ids.ready ? issued : { status: 'information_required', totalPence: null, reviewReasons: [{ code: 'scope-required' }] } });
    if (action === 'estimate.issue') return payload.projectId === ids.ready ? response({ estimate: issued }) : response(null, 409);
    if (action === 'upload.reserve') { const id = `99999999-9999-4999-8999-${String(docs.length + 1).padStart(12, '0')}`, row = { id, revision: docs.length + 1, verified: false, state: 'queued', sha256: payload.sha256, supersedesDocumentId: payload.priorDocumentId || null, observations: 0 }; docs.push(row); return response({ document: row, uploadUrl: `${options.foreignUpload ? 'https://unsafe.example.invalid' : origin}/storage/upload/${id}` }); }
    if (action === 'upload.complete') return response({ job: { state: 'queued' } });
    if (action === 'document.status') { const row = docs.find(doc => doc.id === payload.documentId); row.observations++; if (!options.neverVerify && row.observations > 1) { row.verified = true; row.state = 'ready'; } return response({ document: row, jobs: [] }); }
    if (action === 'document.url') return response({ url: `${origin}/storage/download/${payload.documentId}` });
    if (action === 'document.extract') { extracted = true; return response({ job: { state: 'queued' } }); }
    if (action === 'evidence.confirm') { assert.equal(payload.checked, true); confirmed = true; return response({ confirmation: { evidenceId: payload.evidenceId } }); }
    if (action === 'estimate.get') { pdfReads++; return response({ estimate: issued, pdfState: pdfReads > 1 ? 'ready' : 'pending' }); }
    if (action === 'estimate.pdf') return response({ url: `${origin}/storage/estimate.pdf` });
    if (action === 'share.create') return response({ share: { id: ids.share, expiresAt: new Date(now + 86_400_000).toISOString() }, token: shareToken });
    if (action === 'share.revoke') { revoked = true; return response({ revoked: true }); }
    if (action === 'share.get' || action === 'share.pdf') { assert.equal(actor, undefined); if (revoked || payload.token !== shareToken) return response(null, 404); if (action === 'share.pdf') return new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } }); return response({ estimate: { estimateId: ids.estimate, totalPence: 12000, ...(options.leakProjection ? { propertyValuePence: 3000000000 } : {}) }, pdfAvailable: true }); }
    throw new Error(`Unexpected synthetic request ${action}`);
  };
  const pdfText = async (bytes: Buffer) => { assert.deepEqual(bytes, pdf); return `Subtotal £100.00\nVAT (20%) £20.00\nTotal including VAT £${options.badPdfTotal ? '121' : '120'}.00`; };
  return { env, fetcher, pdfText, requests, docs, storage, now: () => now, sleep: async () => {}, limits: { pollMs: 0, pollLimit: 4, maxMs: 600000, maxRequests: 180 } };
}

test('missing configuration and production/origin declarations make no request or write', async () => {
  let called = false; const fetcher = async () => { called = true; throw new Error('Must not contact a service'); };
  assert.equal((await runStaging({ env: {}, fetcher })).status, 'unconfigured');
  for (const change of [(env: any) => { env.DESIGNER_STAGING_PRODUCTION_REFS = REF; }, (env: any) => { env.DESIGNER_STAGING_ORIGIN = 'https://www.mrwallcover.com'; }, (env: any) => { env.DESIGNER_STAGING_ORIGIN += '/functions/v1/designer-portal'; }]) { const env = environment(); change(env); assert.equal((await runStaging({ env, fetcher })).status, 'fail'); }
  assert.equal(called, false);
});
test('stateful adapter exercises actual envelopes, Storage bytes, worker polling, private PDF, shares and explicit manual gates', async () => {
  const setup = adapter(); const receipt = await runStaging(setup);
  assert.equal(receipt.automatedStatus, 'pass', JSON.stringify(receipt)); assert.equal(receipt.status, 'manual'); assert.equal(receipt.resources.documents.length, 2);
  assert.ok(setup.docs.every(doc => doc.observations >= 2)); assert.equal(receipt.checks.find(check => check.id === 'expired-client-grant')!.status, 'manual');
  assert.ok(setup.requests.some(request => request.action === 'project.save' && request.actor === 'viewer'));
  assert.ok(setup.requests.some(request => request.action === 'share.pdf' && !request.actor));
  assert.equal(setup.requests.some(request => /auth|studio.create|config.save|operations.save|notifications.save/.test(request.action)), false);
  const serialized = JSON.stringify(receipt); for (const secret of Object.values(setup.env).filter(value => value.includes('token') || value.includes('public-key'))) assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('SYNTHETIC PRIVATE CONTACT'), false); assert.equal(serialized.includes('uploadUrl'), false);
});
test('a known already-expired grant is checked against recorded expiry and both real client actions', async () => {
  const setup = adapter(); Object.assign(setup.env, { DESIGNER_STAGING_EXPIRED_SHARE_TOKEN: 'b'.repeat(64), DESIGNER_STAGING_EXPIRED_SHARE_ID: ids.expired });
  const receipt = await runStaging(setup); assert.equal(receipt.automatedStatus, 'pass'); assert.equal(receipt.checks.find(check => check.id === 'expired-client-endpoints')!.status, 'pass'); assert.equal(receipt.checks.find(check => check.id === 'expired-client-grant')!.status, 'manual');
  assert.equal(setup.requests.filter(request => ['share.get', 'share.pdf'].includes(request.action) && request.payload.token === 'b'.repeat(64)).length, 2);
});
test('cross-origin signed URLs, private-field leakage, PDF totals and enabled email fail closed', async () => {
  for (const options of [{ foreignUpload: true }, { leakProjection: true }, { badPdfTotal: true }, { notificationsEnabled: true }]) { const setup = adapter(options); const receipt = await runStaging(setup); assert.equal(receipt.status, 'fail', JSON.stringify({ options, receipt })); if (options.notificationsEnabled) assert.equal(setup.requests.some(request => request.action === 'project.create'), false); }
});
test('worker observation and global request limits cannot become a verified success', async () => {
  const waiting = adapter({ neverVerify: true }); const receipt = await runStaging(waiting); assert.equal(receipt.status, 'fail'); assert.match(receipt.checks.at(-1)!.detail, /worker-observation-timeout/);
  const bounded = adapter(); bounded.limits.maxRequests = 2; const stopped = await runStaging(bounded); assert.equal(stopped.status, 'fail'); assert.equal(bounded.requests.length, 2);
});
test('synthetic source generator makes bounded PDF bytes with a stable SHA-256 and no customer inputs', () => {
  const bytes = syntheticPdf('SYNTHETIC PRIVATE GENERATED SOURCE'); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); assert.ok(bytes.length < 2000); assert.match(bytes.toString(), /xref\n0 6/); assert.match(createHash('sha256').update(bytes).digest('hex'), /^[a-f0-9]{64}$/);
  assert.equal(stagingConfiguration(environment()).configured, true);
});

test('transient read envelopes retry once while mutation failures are never automatically replayed', async () => {
  const read = adapter({ transientSession: true }); const receipt = await runStaging(read); assert.equal(receipt.automatedStatus, 'pass'); assert.equal(read.requests.filter(request => request.action === 'session' && request.actor === 'a').length, 3); // two actor reads plus the deliberately denied Origin check
  const write = adapter({ failCreate: true }); assert.equal((await runStaging(write)).status, 'fail'); assert.equal(write.requests.filter(request => request.action === 'project.create').length, 1);
});

test('the real CLI exits nonzero with an unconfigured receipt and no inherited credentials', () => {
  const result = spawnSync(process.execPath, ['scripts/qa/designer-staging.mjs'], { env: {}, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 2); const receipt = JSON.parse(result.stdout); assert.equal(receipt.status, 'unconfigured'); assert.equal(receipt.requests, 0);
});
