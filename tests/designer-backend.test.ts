import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createDesignerPortalHandler, safeStorageUrl, tokenHash, uploadSpecification } from '../server/designer-portal/service.ts';
import { emptyProjectDraft, measureScopeArea } from '../src/designer-portal/validation.ts';
import type { ProjectDraft } from '../src/designer-portal/types.ts';
import { createDefaultPricingConfig } from '../server/designer-portal/defaults.ts';
import { computeApprovalScope, validatePricingConfig } from '../server/designer-portal/pricing.ts';

const OWNER = '10000000-0000-4000-8000-000000000001';
const OTHER = '20000000-0000-4000-8000-000000000002';
const VIEWER = '20000000-0000-4000-8000-000000000003';
const EDITOR = '20000000-0000-4000-8000-000000000004';
const PROJECT = '30000000-0000-4000-8000-000000000001';
const DOC = '40000000-0000-4000-8000-000000000001';
const ESTIMATE = '50000000-0000-4000-8000-000000000001';
const SHA = 'a'.repeat(64);
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant all on storage.objects to authenticated,anon;
    create policy another_feature_broad_policy on storage.objects for all to authenticated using(true) with check(true);
    insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
      ('${OWNER}','owner@example.test',now(),'{"full_name":"Synthetic owner"}'),
      ('${OTHER}','other@example.test',now(),'{}'),('${VIEWER}','viewer@example.test',now(),'{}'),('${EDITOR}','editor@example.test',now(),'{}');`);
  await db.exec(readFileSync(new URL('../supabase/migrations/202610180002_designer_portal.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/202610180003_designer_notifications.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/202610180004_designer_learning.sql', import.meta.url), 'utf8'));
  return db;
}
async function setup(db: PGlite) {
  const studio = (await db.query<any>('select * from designer_create_studio($1,$2)', [OWNER, 'Synthetic studio'])).rows[0];
  await db.query('select designer_save_project($1,$2,$3,$4,$5::jsonb,0)', [OWNER, studio.id, PROJECT, 'Synthetic project', '{}']);
  await db.query('insert into designer_memberships(studio_id,user_id,role) values($1,$2,$3),($1,$4,$5)', [studio.id, VIEWER, 'viewer', EDITOR, 'editor']);
  return studio;
}
async function enable(db: PGlite, budget = 1000, cost = 10) { await db.query('update designer_settings set uploads_enabled=true,worker_enabled=true,monthly_budget_pence=$1,worst_case_job_pence=$2', [budget, cost]); }
async function reserve(db: PGlite, id = DOC, bytes = 8) { return (await db.query<any>('select * from designer_reserve_document($1,$2,$3,$4,$5,$6,$7,$8)', [OWNER, PROJECT, id, 'synthetic.pdf', 'application/pdf', bytes, SHA, 'pdf'])).rows[0]; }
async function complete(db: PGlite, id = DOC) { return (await db.query<any>('select * from designer_complete_upload($1,$2)', [OWNER, id])).rows[0]; }
async function claim(db: PGlite, types = ['document.verify']) { return (await db.query<any>('select * from designer_claim_job($1::text[],120)', [types])).rows[0]; }
async function finish(db: PGlite, job: any, success: boolean, output: unknown = {}, retryable = false) { return (await db.query<any>('select * from designer_finish_job($1,$2,$3,$4::jsonb,$5,$6)', [job.id, job.lease_token, success, JSON.stringify(output), success ? null : 'Synthetic worker failure', retryable])).rows[0]; }
async function issue(db: PGlite, studioId: string) {
  await db.query('select designer_set_staff($1,$2,$3)', [OWNER, 'owner@example.test', 'owner']);
  const config = (await db.query<any>('select * from designer_save_config($1,0,$2::jsonb)', [OWNER, '{"version":"v1"}'])).rows[0];
  const snapshot = { schemaVersion: 1, id: ESTIMATE, projectId: PROJECT, projectRevision: 1, configVersion: 'v1', status: 'ready', validUntil: '2099-10-18T12:00:00Z', project: { contact: { email: 'private@example.test' }, propertyValuePence: 900000000 } };
  const projection = { schemaVersion: 1, estimateId: ESTIMATE, createdAt: '2026-10-18T12:00:00Z', validUntil: snapshot.validUntil, status: 'ready', currency: 'GBP', lines: [], subtotalPence: 10000, vatPence: 2000, totalPence: 12000, vatStatus: 'exclusive', assumptions: [], reviewReasons: [], project: snapshot.project, maliciousExtra: 'never share this' };
  const e = (await db.query<any>('select * from designer_issue_estimate($1,$2,1,$3,$4,$5::jsonb,$6::jsonb,$7)', [OWNER, PROJECT, ESTIMATE, config.id, JSON.stringify(snapshot), JSON.stringify(projection), 'synthetic-issue-1'])).rows[0];
  assert.equal(e.studio_id, studioId); return { e, snapshot, projection, config };
}
async function notificationSettings(db: PGlite, changes: Record<string, unknown> = {}) {
  await db.query('select designer_set_staff($1,$2,$3)', [OWNER, 'owner@example.test', 'owner']);
  return db.query('select designer_save_notification_settings($1,$2::jsonb)', [OWNER, JSON.stringify({ enabled: true, provider: 'resend', sender: 'sender@example.test', workspaceUrl: 'https://workspace.example.test/designer-portal/', monthlyCap: 10, dailyStudioCap: 10, monthlyBudgetPence: 100, worstCaseAttemptPence: 1, ...changes })]);
}
async function claimNotification(db: PGlite) { return (await db.query<any>('select * from designer_claim_notification(120)')).rows[0]; }
async function finishNotification(db: PGlite, job: any, outcome: string, providerId: string | null = null) { return (await db.query<any>('select * from designer_finish_notification($1,$2,$3,$4,$5)', [job.id, job.lease_token, outcome, providerId, outcome === 'accepted' ? null : 'Synthetic provider outcome'])).rows[0]; }

test('backend is disabled by default and origin/auth failures do not mutate private records', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => { requests++; return Response.json({}); };
  const off = createDesignerPortalHandler({ env: { get: () => undefined }, fetch: fetcher });
  const request = () => new Request('https://example.test/functions/v1/designer-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'session', payload: {} }) });
  assert.equal((await off(request())).status, 503); assert.equal(requests, 0);
  const env = { DESIGNER_PORTAL_ENABLED: 'true', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-token', SUPABASE_ANON_KEY: 'synthetic-publishable-key' };
  const on = createDesignerPortalHandler({ env: { get: key => env[key as keyof typeof env] }, fetch: fetcher });
  assert.equal((await on(request())).status, 401); assert.equal(requests, 0);
  const hostile = request(); hostile.headers.set('Origin', 'https://untrusted.example');
  assert.equal((await on(hostile)).status, 403); assert.equal(requests, 0);
  const oversized = request(); oversized.headers.set('Content-Length', '2000001');
  assert.equal((await on(oversized)).status, 413); assert.equal(requests, 0);
  const streamed = new Request('https://example.test/functions/v1/designer-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(2_000_001) });
  assert.equal((await on(streamed)).status, 413); assert.equal(requests, 0);
});

test('file reservation guards bound types, paths, checksums and sizes before signing', () => {
  const spec = { projectId: PROJECT, fileName: 'plan.pdf', mime: 'application/pdf', bytes: 8, sha256: SHA };
  assert.equal(uploadSpecification(spec).extension, 'pdf');
  assert.equal(uploadSpecification({ ...spec, fileName: 'details.dwg', mime: '' }).extension, 'dwg');
  for (const changed of [{ fileName: '../plan.pdf' }, { fileName: 'active.svg', mime: 'image/svg+xml' }, { fileName: 'plan.pdf.exe' }, { mime: 'text/html' }, { bytes: 104857601 }, { sha256: 'x' }, { approved: true }]) assert.throws(() => uploadSpecification({ ...spec, ...changed }));
  assert.equal(safeStorageUrl('https://fixture.supabase.co', '/object/upload/sign/designer-portal/file?token=fixture'), 'https://fixture.supabase.co/storage/v1/object/upload/sign/designer-portal/file?token=fixture');
  for (const url of ['//hostile.example/file', 'https://hostile.example/file', '/auth/v1/user']) assert.throws(() => safeStorageUrl('https://fixture.supabase.co', url));
});

test('RLS isolates studios and blocks direct writes/RPCs/storage even with broad storage policy', async () => {
  const db = await database();
  try {
    const s = await setup(db);
    await db.exec(`insert into storage.objects(bucket_id,name) values('designer-portal','private.pdf'),('another-feature','public.png')`);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${OTHER}',false)`);
    assert.equal((await db.query('select * from designer_projects')).rows.length, 0);
    assert.equal((await db.query('select * from designer_revisions')).rows.length, 0);
    assert.equal((await db.query('select * from designer_memberships')).rows.length, 0);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    await assert.rejects(() => db.query('select designer_save_project($1,$2,$3,$4,$5::jsonb,1)', [OWNER, s.id, PROJECT, 'Intrusion', '{}']), /permission denied/);
    await assert.rejects(() => db.exec("insert into storage.objects(bucket_id,name) values('designer-portal','intrusion.pdf')"), /row-level security/);
    await assert.rejects(() => db.exec("update designer_projects set name='Intrusion'"), /permission denied/);
    await assert.rejects(() => db.exec('select * from designer_configs'), /permission denied/);
    await assert.rejects(() => db.exec('select * from designer_shares'), /permission denied/);
    await db.exec(`select set_config('request.jwt.claim.sub','${VIEWER}',false)`);
    assert.equal((await db.query('select * from designer_projects')).rows.length, 1);
  } finally { await db.close(); }
});

test('optimistic revisions preserve history; viewer and cross-studio actor cannot write', async () => {
  const db = await database();
  try {
    const s = await setup(db);
    const saved = (await db.query<any>('select * from designer_save_project($1,$2,$3,$4,$5::jsonb,1)', [EDITOR, s.id, PROJECT, 'Changed draft', '{"fixture":"second"}'])).rows[0];
    assert.equal(saved.revision, 2);
    await assert.rejects(() => db.query('select designer_save_project($1,$2,$3,$4,$5::jsonb,1)', [OWNER, s.id, PROJECT, 'Stale', '{}']), /Revision conflict/);
    for (const actor of [VIEWER, OTHER]) await assert.rejects(() => db.query('select designer_save_project($1,$2,$3,$4,$5::jsonb,2)', [actor, s.id, PROJECT, 'Intrusion', '{}']), /unavailable/);
    assert.deepEqual((await db.query<any>('select number,draft from designer_revisions order by number')).rows, [{ number: 1, draft: {} }, { number: 2, draft: { fixture: 'second' } }]);
    await assert.rejects(() => db.exec("update designer_revisions set draft='{}'"), /immutable/);
  } finally { await db.close(); }
});

test('pending upload reservations consume byte/document quotas and completion deduplicates', async () => {
  const db = await database();
  try {
    await setup(db); await assert.rejects(() => reserve(db), /disabled/); await enable(db);
    await db.exec('update designer_settings set max_project_bytes=8,max_project_documents=1');
    const d = await reserve(db); assert.equal(d.verified, false); assert.equal(d.state, 'reserved');
    await assert.rejects(() => reserve(db, OTHER), /limit/);
    const first = await complete(db), second = await complete(db); assert.equal(first.id, second.id);
    assert.equal((await db.query('select * from designer_jobs')).rows.length, 1);
    assert.equal((await db.query('select * from designer_outbox')).rows.length, 1);
    await assert.rejects(() => db.query('select designer_enqueue_extract($1,$2)', [OWNER, DOC]), /Verified document/);
  } finally { await db.close(); }
});

test('document revisions preserve prior sources and reject stale or foreign revision parents', async () => {
  const db = await database();
  try {
    await setup(db); await enable(db); const original = await reserve(db);
    const revisedId = '40000000-0000-4000-8000-000000000002';
    const revised = (await db.query<any>('select * from designer_reserve_document($1,$2,$3,$4,$5,$6,$7,$8,$9)', [OWNER, PROJECT, revisedId, 'synthetic-v2.pdf', 'application/pdf', 8, SHA, 'pdf', DOC])).rows[0];
    assert.equal(original.revision, 1); assert.equal(revised.revision, 2); assert.equal(revised.supersedes_document_id, DOC); assert.notEqual(original.storage_path, revised.storage_path);
    await assert.rejects(() => db.query('select designer_reserve_document($1,$2,$3,$4,$5,$6,$7,$8,$9)', [OWNER, PROJECT, OTHER, 'stale.pdf', 'application/pdf', 8, SHA, 'pdf', DOC]), /revision conflict/);
    await assert.rejects(() => db.query('select designer_reserve_document($1,$2,$3,$4,$5,$6,$7,$8,$9)', [OWNER, PROJECT, OTHER, 'foreign.pdf', 'application/pdf', 8, SHA, 'pdf', VIEWER]), /unavailable/);
    assert.equal((await db.query('select * from designer_documents')).rows.length, 2);
  } finally { await db.close(); }
});

test('worker cannot run without budget; first claim reserves all attempts and final output commits ceiling', async () => {
  const db = await database();
  try {
    await setup(db); await enable(db); await reserve(db); await complete(db);
    await db.exec('update designer_settings set monthly_budget_pence=null');
    assert.equal((await claim(db)).id, null);
    await db.exec('update designer_settings set monthly_budget_pence=29');
    assert.equal((await claim(db)).id, null);
    await db.exec('update designer_settings set monthly_budget_pence=30');
    const j = await claim(db); assert.equal(j.state, 'running'); assert.equal(j.reserved_pence, 30);
    await assert.rejects(() => finish(db, j, true, { verified: false, bytes: 8, sha256: SHA, mime: 'application/pdf' }), /Invalid verification/);
    await assert.rejects(() => finish(db, j, true, { verified: true, bytes: 9, sha256: SHA, mime: 'application/pdf' }), /Invalid verification/);
    await finish(db, j, true, { verified: true, bytes: 8, sha256: SHA, mime: 'application/pdf', reviewRequired: false });
    const d = (await db.query<any>('select * from designer_documents')).rows[0]; assert.equal(d.state, 'ready'); assert.equal(d.verified, true);
    const b = (await db.query<any>('select * from designer_budget_months')).rows[0]; assert.equal(b.reserved_pence, 0); assert.equal(b.committed_pence, 30);
    await assert.rejects(() => finish(db, j, true, {}), /lease/);
  } finally { await db.close(); }
});

test('expired leases retry at most three times and stale workers cannot publish', async () => {
  const db = await database();
  try {
    await setup(db); await enable(db); await reserve(db); await complete(db);
    const first = await claim(db);
    await db.exec("update designer_jobs set lease_until=now()-interval '1 second'");
    await assert.rejects(() => finish(db, first, true, { verified: true, bytes: 8, sha256: SHA, mime: 'application/pdf' }), /lease/);
    const second = await claim(db); assert.equal(second.attempts, 2); assert.notEqual(second.lease_token, first.lease_token);
    await assert.rejects(() => finish(db, first, false, {}), /lease/);
    await db.exec("update designer_jobs set lease_until=now()-interval '1 second'");
    const third = await claim(db); assert.equal(third.attempts, 3);
    await db.exec("update designer_jobs set lease_until=now()-interval '1 second'");
    assert.equal((await claim(db)).id, null);
    assert.equal((await db.query<any>('select state from designer_jobs')).rows[0].state, 'failed');
    assert.equal((await db.query<any>('select state from designer_documents')).rows[0].state, 'failed');
    assert.equal((await db.query<any>('select committed_pence from designer_budget_months')).rows[0].committed_pence, 30);
    assert.equal((await claim(db)).id, null);
    assert.equal((await db.query<any>('select committed_pence from designer_budget_months')).rows[0].committed_pence, 30);
  } finally { await db.close(); }
});

test('extraction evidence stays proposed, provenance checked, immutable and studio-bound', async () => {
  const db = await database();
  try {
    const studio = await setup(db); await enable(db); await reserve(db); await complete(db); const verify = await claim(db);
    await finish(db, verify, true, { verified: true, bytes: 8, sha256: SHA, mime: 'application/pdf', reviewRequired: true });
    await db.query('select designer_enqueue_extract($1,$2)', [OWNER, DOC]);
    const job = await claim(db, ['document.extract']);
    await assert.rejects(() => finish(db, job, true, { evidence: [{ kind: 'dimension', value: '4 m', source: { documentId: OTHER } }] }), /provenance/);
    await finish(db, job, true, { evidence: [{ id: 'fixture', kind: 'dimension', value: '4 m', source: { documentId: DOC, page: 1 }, confirmed: true }] });
    const e = (await db.query<any>('select * from designer_evidence')).rows[0]; assert.equal(e.evidence.confirmed, false); assert.equal(e.document_id, DOC);
    await assert.rejects(() => db.query('select designer_confirm_evidence($1,$2,$3,1)', [VIEWER, PROJECT, e.id]), /unavailable/);
    const checked = (await db.query<any>('select * from designer_confirm_evidence($1,$2,$3,1)', [OWNER, PROJECT, e.id])).rows[0]; assert.equal(checked.project_revision, 1); assert.equal(checked.checked_by, OWNER);
    assert.equal((await db.query<any>('select evidence from designer_evidence')).rows[0].evidence.confirmed, false, 'source evidence remains an immutable proposal');
    await assert.rejects(() => db.exec("update designer_evidence_checks set project_revision=2"), /immutable/);
    await db.query('select designer_save_project($1,$2,$3,$4,$5::jsonb,1)', [OWNER, studio.id, PROJECT, 'Revised scope', '{}']);
    await assert.rejects(() => db.query('select designer_confirm_evidence($1,$2,$3,1)', [OWNER, PROJECT, e.id]), /Revision conflict/);
    await assert.rejects(() => db.exec("update designer_evidence set evidence='{}'"), /immutable/);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${OTHER}',false)`);
    assert.equal((await db.query('select * from designer_evidence')).rows.length, 0);
  } finally { await db.close(); }
});

test('issued estimates are immutable/idempotent, PDFs fenced to lease path, shares expire/revoke with projection only', async () => {
  const db = await database();
  try {
    const s = await setup(db); await enable(db); const { e, config, snapshot, projection } = await issue(db, s.id);
    assert.equal(e.public_projection.project, undefined); assert.equal(e.public_projection.maliciousExtra, undefined);
    const repeat = (await db.query<any>('select * from designer_issue_estimate($1,$2,1,$3,$4,$5::jsonb,$6::jsonb,$7)', [OWNER, PROJECT, ESTIMATE, config.id, JSON.stringify(snapshot), JSON.stringify(projection), 'synthetic-issue-1'])).rows[0]; assert.equal(repeat.id, e.id);
    const newId = '50000000-0000-4000-8000-000000000002';
    await assert.rejects(() => db.query('select designer_issue_estimate($1,$2,1,$3,$4,$5::jsonb,$6::jsonb,$7)', [OWNER, PROJECT, newId, config.id, JSON.stringify({ ...snapshot, id: newId, configVersion: 'stale' }), JSON.stringify(projection), 'synthetic-issue-stale']), /Configuration conflict/);
    await assert.rejects(() => db.exec("update designer_estimates set snapshot='{}'"), /immutable/);
    const job = await claim(db, ['estimate.pdf']);
    await assert.rejects(() => finish(db, job, true, { storagePath: job.input.storagePath, mime: 'application/pdf', sha256: SHA, bytes: 8 }), /Invalid PDF/);
    const path = job.input.storagePath.replace(/\.pdf$/, `.${job.lease_token}.pdf`);
    await finish(db, job, true, { storagePath: path, mime: 'application/pdf', sha256: SHA, bytes: 8 });
    assert.equal((await db.query<any>('select storage_path,state from designer_estimate_files')).rows[0].storage_path, path);
    const secret = 'b'.repeat(64), hash = await tokenHash(secret);
    const share = (await db.query<any>('select * from designer_create_share($1,$2,$3,7)', [OWNER, ESTIMATE, hash])).rows[0];
    assert.equal(share.token_hash, hash); assert.notEqual(share.token_hash, secret);
    const shared = (await db.query<any>('select designer_resolve_share($1) as shared', [hash])).rows[0].shared;
    assert.deepEqual(Object.keys(shared).sort(), ['estimate', 'pdfAvailable']); assert.equal(shared.estimate.project, undefined); assert.equal(shared.pdfAvailable, true);
    await db.query('select designer_revoke_share($1,$2)', [OWNER, share.id]);
    assert.equal((await db.query<any>('select designer_resolve_share($1) as shared', [hash])).rows[0].shared, null);
    const expiredHash = await tokenHash('c'.repeat(64)); const expired = (await db.query<any>('select * from designer_create_share($1,$2,$3,1)', [OWNER, ESTIMATE, expiredHash])).rows[0];
    await db.query("update designer_shares set expires_at=now()-interval '1 second' where id=$1", [expired.id]);
    assert.equal((await db.query<any>('select designer_resolve_share($1) as shared', [expiredHash])).rows[0].shared, null);
    await assert.rejects(() => db.query('select designer_create_share($1,$2,$3,31)', [OWNER, ESTIMATE, SHA]), /duration/);
    await db.query('insert into designer_estimates(id,project_id,studio_id,project_revision,config_id,snapshot,public_projection,idempotency_key,created_by) select $1,project_id,studio_id,project_revision,config_id,$2::jsonb,public_projection,$3,created_by from designer_estimates where id=$4', [newId, JSON.stringify({ ...snapshot, id: newId, status: 'review_required' }), 'synthetic-nonready', ESTIMATE]);
    await assert.rejects(() => db.query('select designer_create_share($1,$2,$3,7)', [OWNER, newId, SHA]), /requires review/);
  } finally { await db.close(); }
});

test('issue freezes a private source inventory and checked-fact set independently of later uploads or source changes', async () => {
  const db = await database();
  try {
    const studio = await setup(db); await enable(db); await reserve(db);
    await db.query("update designer_documents set state='ready',verified=true,actual_mime='application/pdf' where id=$1", [DOC]);
    const source = { id: 'synthetic-fact', kind: 'text', value: 'Synthetic source fact', source: { documentId: DOC, page: 1 }, confirmed: false };
    const evidence = (await db.query<any>('insert into designer_evidence(document_id,project_id,studio_id,evidence) values($1,$2,$3,$4::jsonb) returning *', [DOC, PROJECT, studio.id, JSON.stringify(source)])).rows[0];
    await db.query('select designer_confirm_evidence($1,$2,$3,1)', [OWNER, PROJECT, evidence.id]);
    const { e } = await issue(db, studio.id);
    const manifest = e.source_manifest;
    assert.equal(manifest.scope, 'available-evidence-at-issue'); assert.match(manifest.note, /does not assert.*used/);
    assert.equal(manifest.documents.length, 1); assert.equal(manifest.documents[0].documentId, DOC);
    assert.equal(manifest.documents[0].revision, 1); assert.equal(manifest.documents[0].sha256, SHA); assert.equal(manifest.documents[0].verified, true);
    assert.equal(manifest.confirmedEvidence.length, 1); assert.equal(manifest.confirmedEvidence[0].evidenceId, evidence.id); assert.equal(manifest.confirmedEvidence[0].projectRevision, 1);
    assert.equal(e.public_projection.source_manifest, undefined); assert.equal(e.public_projection.provenance, undefined);
    const nextId = '40000000-0000-4000-8000-000000000003';
    await db.query('select designer_reserve_document($1,$2,$3,$4,$5,$6,$7,$8,$9)', [OWNER, PROJECT, nextId, 'later-revision.pdf', 'application/pdf', 16, 'b'.repeat(64), 'pdf', DOC]);
    await db.query("update designer_documents set state='quarantined',verified=false,error='Later source review' where id=$1", [DOC]);
    await db.query('select designer_save_project($1,$2,$3,$4,$5::jsonb,1)', [OWNER, studio.id, PROJECT, 'Later project revision', '{}']);
    assert.deepEqual((await db.query<any>('select source_manifest from designer_estimates where id=$1', [ESTIMATE])).rows[0].source_manifest, manifest);
    assert.equal((await db.query<any>("select input from designer_jobs where type='estimate.pdf'")).rows[0].input.publicEstimate.provenance, undefined);
    await assert.rejects(() => db.query("update designer_estimates set source_manifest='{}' where id=$1", [ESTIMATE]), /immutable/);
  } finally { await db.close(); }
});

test('owner administration cannot be self-approved by studio members or ordinary staff', async () => {
  const db = await database();
  try {
    const s = await setup(db);
    await assert.rejects(() => db.query('select designer_save_config($1,0,$2::jsonb)', [OWNER, '{}']), /Owner administrator/);
    await db.query('select designer_set_staff($1,$2,$3)', [OTHER, 'staff@example.test', 'staff']);
    await assert.rejects(() => db.query('select designer_save_config($1,0,$2::jsonb)', [OTHER, '{}']), /Owner administrator/);
    const team = (await db.query<any>('select designer_list_members($1,$2) as team', [OWNER, s.id])).rows[0].team;
    assert.equal(team.members.length, 3); assert.equal(team.members.find((m: any) => m.userId === OWNER).email, 'owner@example.test'); assert.equal(team.members.find((m: any) => m.userId === OWNER).name, 'Synthetic owner');
    assert.equal(team.members.some((m: any) => m.email === 'other@example.test'), false);
    await assert.rejects(() => db.query('select designer_list_members($1,$2)', [OTHER, s.id]), /Owner permission/);
    await assert.rejects(() => db.query('select designer_list_members($1,$2)', [VIEWER, s.id]), /Owner permission/);
    await assert.rejects(() => db.query('select designer_invite_member($1,$2,$3,$4)', [EDITOR, s.id, 'new@example.test', 'editor']), /Owner permission/);
    await assert.rejects(() => db.query('select designer_invite_member($1,$2,$3,$4)', [OWNER, s.id, 'new@example.test', 'owner']), /Invalid membership/);
    await db.query('select designer_set_staff($1,$2,$3)', [OWNER, 'owner@example.test', 'owner']);
    await db.query('select designer_save_config($1,0,$2::jsonb)', [OWNER, '{"version":"v1"}']);
    await assert.rejects(() => db.exec("update designer_configs set config='{\"version\":\"forged\"}'"), /immutable/);
    await assert.rejects(() => db.query('select designer_save_config($1,0,$2::jsonb)', [OWNER, '{}']), /conflict/);
    await db.query('select designer_invite_member($1,$2,$3,$4)', [OWNER, s.id, 'editor@example.test', 'viewer']);
    await db.query('select designer_accept_invitations($1,$2)', [EDITOR, 'editor@example.test']);
    assert.equal((await db.query<any>('select role from designer_memberships where studio_id=$1 and user_id=$2', [s.id, EDITOR])).rows[0].role, 'viewer');
    await db.query('select designer_remove_member($1,$2,$3,null)', [OWNER, s.id, VIEWER]);
    assert.equal((await db.query('select * from designer_memberships where studio_id=$1 and user_id=$2', [s.id, VIEWER])).rows.length, 0);
    await assert.rejects(() => db.query('select designer_remove_member($1,$2,$3,null)', [OWNER, s.id, OWNER]), /owner cannot/);
    await assert.rejects(() => db.query('select designer_invite_member($1,$2,$3,$4)', [OTHER, s.id, 'new@example.test', 'editor']), /Owner permission/);
  } finally { await db.close(); }
});

test('notifications are disabled by default and resolve only verified studio recipients with generic immutable messages', async () => {
  const db = await database();
  try {
    const studio = await setup(db);
    assert.equal((await db.query<any>('select designer_queue_notifications() as n')).rows[0].n, 0);
    assert.equal((await claimNotification(db)).id, null);
    await assert.rejects(() => db.query('select designer_save_notification_settings($1,$2::jsonb)', [OTHER, '{}']), /Owner administrator/);
    await notificationSettings(db);
    await db.query('insert into designer_memberships(studio_id,user_id,role) values($1,$2,$3)', [studio.id, OTHER, 'viewer']);
    await db.query('update auth.users set email_confirmed_at=null where id=$1', [OTHER]);
    await issue(db, studio.id);
    assert.equal((await db.query<any>('select designer_queue_notifications() as n')).rows[0].n, 3);
    assert.equal((await db.query<any>('select designer_queue_notifications() as n')).rows[0].n, 0);
    const notifications = (await db.query<any>('select * from designer_notifications')).rows;
    assert.equal(notifications.some(n => n.recipient_user_id === OTHER), false);
    for (const n of notifications) {
      assert.deepEqual(Object.keys(n.provider_payload).sort(), ['from', 'subject', 'text', 'to']);
      assert.equal(n.provider_payload.text, 'An update is available in your Mr Wallcover workspace. Sign in to review it: https://workspace.example.test/designer-portal/');
      assert.equal(n.provider_payload.to.length, 1); assert.equal(n.provider_payload.to[0], n.recipient_email);
      assert.equal(n.idempotency_key, `designer-workspace/${n.id}`);
    }
    await assert.rejects(() => db.exec("update designer_notifications set provider_payload='{}'"), /immutable/);
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${VIEWER}',false)`);
    await assert.rejects(() => db.exec('select * from designer_notifications'), /permission denied/);
    await assert.rejects(() => db.exec('select designer_claim_notification(120)'), /permission denied/);
  } finally { await db.close(); }
});

test('notifications recheck revoked membership, enforce atomic count/budget caps, and distinguish provider acceptance from delivery', async () => {
  const db = await database();
  try {
    const studio = await setup(db); await notificationSettings(db, { monthlyCap: 1, monthlyBudgetPence: 3 }); await issue(db, studio.id);
    await db.query('select designer_queue_notifications()');
    await db.query('delete from designer_memberships where studio_id=$1 and user_id=$2', [studio.id, VIEWER]);
    let claimed = await claimNotification(db); if (!claimed.id) claimed = await claimNotification(db);
    assert.ok(claimed.id); assert.notEqual(claimed.recipient_user_id, VIEWER); assert.equal(claimed.reserved_pence, 3);
    assert.equal((await db.query<any>('select designer_notification_send_authorized($1,$2) as ok', [claimed.id, claimed.lease_token])).rows[0].ok, true);
    assert.equal((await claimNotification(db)).id, null, 'monthly reservation prevents a second recipient claim');
    const accepted = await finishNotification(db, claimed, 'accepted', 'synthetic-provider-id');
    assert.equal(accepted.state, 'provider_accepted'); assert.equal(accepted.delivered_at, null);
    const usage = (await db.query<any>('select * from designer_notification_usage')).rows[0]; assert.equal(usage.reserved_count, 0); assert.equal(usage.committed_count, 1); assert.equal(usage.committed_pence, 3);
    await assert.rejects(() => finishNotification(db, claimed, 'accepted', 'synthetic-provider-id'), /lease/);
    await db.query('update designer_notifications set next_delivery_check_at=now() where id=$1', [claimed.id]);
    const check = (await db.query<any>('select * from designer_claim_delivery_check(120)')).rows[0];
    const delivered = (await db.query<any>('select * from designer_finish_delivery_check($1,$2,$3,null)', [check.id, check.delivery_lease_token, 'delivered'])).rows[0];
    assert.equal(delivered.state, 'delivered'); assert.ok(delivered.delivered_at); assert.equal(delivered.attempts, 1);
    await assert.rejects(() => db.query('select designer_finish_delivery_check($1,$2,$3,null)', [check.id, check.delivery_lease_token, 'delivered']), /lease/);
  } finally { await db.close(); }
});

test('notification retries retain their key, fence stale leases and stop after three attempts or the idempotency window', async () => {
  const db = await database();
  try {
    const studio = await setup(db); await db.query('delete from designer_memberships where studio_id=$1 and user_id<>$2', [studio.id, OWNER]);
    await notificationSettings(db); await issue(db, studio.id); await db.query('select designer_queue_notifications()');
    const first = await claimNotification(db); await finishNotification(db, first, 'retry');
    await db.exec('update designer_notifications set available_at=now()'); const second = await claimNotification(db);
    assert.equal(second.attempts, 2); assert.equal(second.idempotency_key, first.idempotency_key); assert.deepEqual(second.provider_payload, first.provider_payload);
    await db.exec("update designer_notifications set lease_until=now()-interval '1 second'");
    await assert.rejects(() => finishNotification(db, second, 'accepted', 'synthetic-provider-id'), /lease/);
    const third = await claimNotification(db); assert.equal(third.attempts, 3); assert.notEqual(third.lease_token, second.lease_token);
    assert.equal((await finishNotification(db, third, 'retry')).state, 'uncertain');
    assert.equal((await claimNotification(db)).id, null);
    assert.equal((await db.query<any>('select committed_count from designer_notification_usage')).rows[0].committed_count, 1);
    // A provider request could have been accepted before a worker crash. Never
    // issue a new key or automatically resend once its 24-hour guarantee expires.
    await db.exec("update designer_notifications set state='queued',attempts=1,first_attempt_at=now()-interval '24 hours',available_at=now()");
    assert.equal((await claimNotification(db)).id, null);
    assert.equal((await db.query<any>('select state from designer_notifications')).rows[0].state, 'uncertain');
    assert.equal((await db.query<any>('select committed_count from designer_notification_usage')).rows[0].committed_count, 1, 'budget is settled once');
  } finally { await db.close(); }
});

test('API verifies email with Auth, derives roles server-side and rejects client approval/prices', async () => {
  const env: Record<string, string> = { DESIGNER_PORTAL_ENABLED: 'true', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service', SUPABASE_ANON_KEY: 'synthetic-publishable' };
  let verified = false; const mutations: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: OWNER, email: 'fixture@example.test', email_confirmed_at: verified ? '2026-10-18T12:00:00Z' : null });
    if (url.includes('/rpc/')) { mutations.push(url); return Response.json(null); }
    if (url.includes('/designer_staff?')) return Response.json([]);
    if (url.includes('/designer_settings?')) return Response.json([{ uploads_enabled: false, worker_enabled: false }]);
    if (url.includes('/designer_projects?')) return Response.json([{ id: PROJECT, studio_id: OTHER, draft: {} }]);
    if (url.includes('/designer_memberships?')) return Response.json([]);
    throw new Error('Unexpected offline route: ' + url);
  };
  const handler = createDesignerPortalHandler({ env: { get: key => env[key] }, fetch: fetcher });
  const request = (action: string, payload: unknown) => new Request(`${env.SUPABASE_URL}/functions/v1/designer-portal`, { method: 'POST', headers: { Authorization: 'Bearer synthetic-session', 'Content-Type': 'application/json', Origin: 'https://www.mrwallcover.com' }, body: JSON.stringify({ action, payload }) });
  assert.equal((await handler(request('session', {}))).status, 403); assert.equal(mutations.length, 0);
  verified = true;
  assert.equal((await handler(request('admin.config.save', { expectedVersion: 0, config: {}, staffRole: 'owner' }))).status, 403);
  assert.equal(mutations.some(url => url.includes('designer_save_config')), false);
  assert.equal((await handler(request('project.get', { projectId: PROJECT }))).status, 404);
  const forged = await handler(request('estimate.issue', { projectId: PROJECT, expectedRevision: 1, idempotencyKey: 'synthetic-1', totalPence: 1 }));
  assert.equal(forged.status, 400); assert.equal(mutations.some(url => url.includes('designer_issue_estimate')), false);
});

test('historical scope imports are owner-only, immutable and idempotent without becoming current rates', async () => {
  const db = await database();
  try {
    await setup(db); await db.query('select designer_set_staff($1,$2,$3)', [OWNER, 'owner@example.test', 'owner']);
    const entry = { externalRef: 'synthetic-old-scope', title: 'Synthetic old scope', classification: 'mixed-schedule', source: { fileName: 'old-schedule.xlsx', sha256: SHA, reviewedOn: '2026-10-18', locations: [{ sheet: 'Scope', range: 'B4:F8' }] }, scopeNotes: 'Historical labour and delivery structure only', quantityBasis: 'm2/item', amounts: [{ label: 'Selling', role: 'selling', valuePence: 10000, locationIndex: 0 }, { label: 'Worker payment', role: 'worker-cost', valuePence: 5000, locationIndex: 0 }], warnings: ['Current prices require separate approval.'] };
    await assert.rejects(() => db.query('select designer_import_historical_scopes($1,$2::jsonb)', [VIEWER, JSON.stringify([entry])]), /Owner permission/);
    const first = (await db.query<any>('select designer_import_historical_scopes($1,$2::jsonb) as result', [OWNER, JSON.stringify([entry])])).rows[0].result;
    const again = (await db.query<any>('select designer_import_historical_scopes($1,$2::jsonb) as result', [OWNER, JSON.stringify([entry])])).rows[0].result;
    assert.equal(first.records[0].id, again.records[0].id); assert.equal(first.ratesImported, false); assert.equal((await db.query('select * from designer_configs')).rows.length, 0);
    await assert.rejects(() => db.query('select designer_import_historical_scopes($1,$2::jsonb)', [OWNER, JSON.stringify([{ ...entry, title: 'Changed source under same identity' }])]), /conflict/);
    await assert.rejects(() => db.exec("update designer_historical_scopes set body='{}'"), /immutable/);
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${OWNER}',false)`);
    await assert.rejects(() => db.exec('select * from designer_historical_scopes'), /permission denied/);
    await assert.rejects(() => db.query('select designer_import_historical_scopes($1,$2::jsonb)', [OWNER, JSON.stringify([entry])]), /permission denied/);
  } finally { await db.close(); }
});

test('actual work is staff-only, correction-linked and immutable; review never alters rate versions', async () => {
  const db = await database();
  try {
    await setup(db); await db.query('select designer_set_staff($1,$2,$3)', [OWNER, 'owner@example.test', 'owner']);
    const body = { completedOn: '2026-10-18', installationDates: ['2026-10-17','2026-10-18'], labour: [{ id: 'person-time', category: 'installation', label: 'Actual person-minutes', minutes: 960 }], vehicles: [] };
    const save = (actor: string, key: string, supersedes: string | null = null, data = body) => db.query<any>('select * from designer_record_actuals($1,$2,1,null,$3,$4,$5::jsonb,$6::jsonb)', [actor, PROJECT, supersedes, key, JSON.stringify(data), '{"rateChangesApplied":false}']);
    await assert.rejects(() => save(VIEWER, 'forbidden'), /staff permission/);
    const first = (await save(OWNER, 'first')).rows[0]; assert.equal((await save(OWNER, 'first')).rows[0].id, first.id);
    await assert.rejects(() => save(OWNER, 'no-correction-parent'), /conflict/);
    const next = (await save(OWNER, 'correction', first.id, { ...body, labour: [{ ...body.labour[0], minutes: 1020 }] })).rows[0]; assert.equal(next.supersedes_id, first.id);
    await assert.rejects(() => db.exec("update designer_actuals set body='{}'"), /immutable/);
    await assert.rejects(() => db.query('select designer_review_actuals($1,$2,$3,$4,$5)', [VIEWER, PROJECT, next.id, 'reviewed', 'Attempt']), /Owner permission/);
    await db.query('select designer_review_actuals($1,$2,$3,$4,$5)', [OWNER, PROJECT, next.id, 'rate-card-review-needed', 'Review package person-time; rates stay unchanged.']);
    assert.equal((await db.query('select * from designer_configs')).rows.length, 0); assert.equal((await db.query<any>('select completed_on::text as day from designer_projects')).rows[0].day, '2026-10-18');
    await db.query('select designer_save_project($1,$2,$3,$4,$5::jsonb,1)', [OWNER, next.studio_id, PROJECT, 'Revised project', '{"newScope":true}']);
    assert.equal((await db.query<any>('select completed_on from designer_projects')).rows[0].completed_on, null, 'a changed scope is no longer marked completed');
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${VIEWER}',false)`);
    await assert.rejects(() => db.exec('select * from designer_actuals'), /permission denied/);
  } finally { await db.close(); }
});

test('pilot comparisons preserve owner evidence and cannot mutate issued estimates or selling prices', async () => {
  const db = await database();
  try {
    const studio = await setup(db), { config, e } = await issue(db, studio.id);
    const body = { independentlyPrepared: true, scopeChecked: true, priceBasis: 'current-owner-prices', expectedLines: [{ label: 'Synthetic independent labour', category: 'installation', amountPence: 10000 }] };
    await assert.rejects(() => db.query('select designer_record_pilot($1,$2,$3,null,$4::jsonb,$5::jsonb)', [VIEWER, PROJECT, ESTIMATE, JSON.stringify(body), '{"withinTolerance":true}']), /Owner permission/);
    const saved = (await db.query<any>('select * from designer_record_pilot($1,$2,$3,null,$4::jsonb,$5::jsonb)', [OWNER, PROJECT, ESTIMATE, JSON.stringify(body), '{"withinTolerance":false,"rateChangesApplied":false}'])).rows[0];
    assert.equal(saved.estimate_id, e.id); assert.equal(saved.comparison.withinTolerance, false);
    assert.deepEqual((await db.query<any>('select config from designer_configs where id=$1', [config.id])).rows[0].config, config.config);
    assert.deepEqual((await db.query<any>('select snapshot from designer_estimates where id=$1', [e.id])).rows[0].snapshot, e.snapshot);
    await assert.rejects(() => db.exec("update designer_pilot_comparisons set comparison='{}'"), /immutable/);
    await assert.rejects(() => db.query('select designer_record_pilot($1,$2,$3,null,$4::jsonb,$5::jsonb)', [OWNER, PROJECT, ESTIMATE, JSON.stringify({ ...body, priceBasis: 'old-quotation' }), '{}']), /Current owner comparison/);
  } finally { await db.close(); }
});

/** Offline PostgREST adapter: real handler orchestration and migrated Postgres RPCs,
 * with every network request intercepted and every unsupported query rejected. */
function offlineDatabaseApi(db: PGlite, actor = OWNER) {
  const env: Record<string, string> = { DESIGNER_PORTAL_ENABLED: 'true', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service', SUPABASE_ANON_KEY: 'synthetic-publishable' };
  const reads: string[] = [], writes: string[] = [], adapterErrors: string[] = [];
  const identifier = (value: string) => { assert.match(value, /^[a-z_][a-z0-9_]*$/); return value; };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.origin, env.SUPABASE_URL, 'all test requests remain inside the offline adapter');
    try {
      if (url.pathname === '/auth/v1/user') return Response.json((await db.query('select id,email,email_confirmed_at from auth.users where id=$1', [actor])).rows[0]);
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = identifier(url.pathname.slice('/rest/v1/rpc/'.length)), body = JSON.parse(String(init?.body || '{}')), keys = Object.keys(body); writes.push(name);
        const parameters = keys.map(key => typeof body[key] === 'object' && body[key] !== null ? JSON.stringify(body[key]) : body[key]);
        const result = await db.query(`select * from ${name}(${keys.map((key, i) => `${identifier(key)} => $${i + 1}`).join(',')})`, parameters);
        return Response.json(result.rows);
      }
      assert.ok(url.pathname.startsWith('/rest/v1/'), 'only Auth and PostgREST fixtures are supported');
      const table = identifier(url.pathname.slice('/rest/v1/'.length)); reads.push(table);
      const clauses: string[] = [], parameters: unknown[] = [];
      for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'limit'].includes(key)) continue;
        assert.ok(value.startsWith('eq.'), `unsupported fixture filter: ${key}`); parameters.push(value.slice(3)); clauses.push(`${identifier(key)}=$${parameters.length}`);
      }
      const order = url.searchParams.get('order')?.split(',').map(term => { const [column, direction] = term.split('.'); assert.ok(['asc', 'desc'].includes(direction)); return `${identifier(column)} ${direction}`; }).join(',');
      const limit = url.searchParams.get('limit'); if (limit) assert.match(limit, /^\d+$/);
      const result = await db.query(`select * from ${table}${clauses.length ? ` where ${clauses.join(' and ')}` : ''}${order ? ` order by ${order}` : ''}${limit ? ` limit ${limit}` : ''}`, parameters);
      return Response.json(result.rows);
    } catch (error) { adapterErrors.push(String(error)); return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
  };
  const handler = createDesignerPortalHandler({ env: { get: key => env[key] }, fetch: fetcher, now: () => new Date('2026-10-18T12:00:00Z') });
  return { reads, writes, adapterErrors, async call(action: string, payload: unknown = {}) {
    const response = await handler(new Request(`${env.SUPABASE_URL}/functions/v1/designer-portal`, { method: 'POST', headers: { Authorization: 'Bearer synthetic-session', 'Content-Type': 'application/json', Origin: 'https://www.mrwallcover.com' }, body: JSON.stringify({ action, payload }) }));
    return { status: response.status, body: await response.json() };
  } };
}
function readyApiDraft(): ProjectDraft {
  const draft = emptyProjectDraft();
  return { ...draft, id: PROJECT, name: 'Synthetic API project', buildingType: 'private-home', contact: { name: 'Synthetic designer', email: 'designer@example.invalid' }, address: { line1: 'Synthetic site', town: 'London', postcode: 'TEST', country: 'UK' }, rooms: [{ id: 'room-one', label: 'Living room', floor: 'Ground' }, { id: 'room-two', label: 'Study', floor: 'First' }], items: ['one', 'two'].map(suffix => ({ id: `scope-${suffix}`, roomId: `room-${suffix}`, label: 'Fabric scope', scopeKind: 'multiple_rooms', confirmedMeasurements: true, walls: [{ id: `wall-${suffix}`, widthMm: 4000, heightMm: 2500, count: 1, openings: [], reveals: [] }], material: { groupId: 'standard-fabric', verifiedTypeId: 'standard-fabric', clientProvided: true, acoustic: 'no', velvet: 'no', specialist: 'no' }, preparation: 'normal-prep-lining-hanging', access: 'standard' })), programme: { startDate: '2026-11-01', endDate: '2026-11-06', phases: 1, occupied: 'no', outOfHours: 'no', materialReadiness: { status: 'ordered', readyDate: '2026-10-30', scopeItemIds: [] } }, logistics: { ...draft.logistics, vehicleDaysConfirmed: true, deliveriesRequired: 'no', storageRequired: 'no', accessEquipmentRequired: 'no', wasteRemovalRequired: 'no' } };
}

test('API resource approvals reject foreign and unverified source documents; new projects cannot reuse old-source IDs', async () => {
  const db = await database();
  try {
    const studio = await setup(db); await enable(db); await reserve(db);
    const secondProject = '30000000-0000-4000-8000-000000000002', foreignDoc = '40000000-0000-4000-8000-000000000002';
    await db.query('select designer_save_project($1,$2,$3,$4,$5::jsonb,0)', [OWNER, studio.id, secondProject, 'Other project same studio', '{}']);
    await db.query('select designer_reserve_document($1,$2,$3,$4,$5,$6,$7,$8)', [OWNER, secondProject, foreignDoc, 'foreign.pdf', 'application/pdf', 8, SHA, 'pdf']);
    await db.query("update designer_documents set verified=true,state='ready' where id=$1", [foreignDoc]);
    const api = offlineDatabaseApi(db), draft = readyApiDraft();
    const referenceDraft = (kind: 'sample' | 'aftercare', sourceDocumentId: string) => {
      const result = structuredClone(draft); result.resources = { materialRequirements: [], preparationChecklist: [], sampleApprovals: [], aftercareReferences: [] };
      if (kind === 'sample') result.resources.sampleApprovals.push({ id: 'sample', label: 'Approved setting-out', scopeItemIds: ['scope-one'], status: 'approved', approvedBy: 'Synthetic designer', approvedOn: '2026-10-18', sourceDocumentId });
      else result.resources.aftercareReferences.push({ id: 'care', label: 'Issued maker care', scopeItemIds: ['scope-one'], status: 'issued', sourceDocumentId });
      return result;
    };
    for (const kind of ['sample', 'aftercare'] as const) {
      const foreign = await api.call('project.save', { projectId: PROJECT, expectedRevision: 1, name: draft.name, draft: referenceDraft(kind, foreignDoc) });
      assert.equal(foreign.status, 404); assert.equal(foreign.body.error.code, 'not_found');
      const unverified = await api.call('project.save', { projectId: PROJECT, expectedRevision: 1, name: draft.name, draft: referenceDraft(kind, DOC) });
      assert.equal(unverified.status, 400); assert.equal(unverified.body.error.code, 'source_not_verified');
      const reused = await api.call('project.create', { studioId: studio.id, name: 'Copied source reference', draft: referenceDraft(kind, foreignDoc) });
      assert.equal(reused.status, 400); assert.equal(reused.body.error.code, 'invalid_draft');
    }
    assert.equal(api.writes.filter(name => name === 'designer_save_project').length, 0);
    assert.equal((await db.query<any>('select revision from designer_projects where id=$1', [PROJECT])).rows[0].revision, 1);
    await db.query("update designer_documents set verified=true,state='ready' where id=$1", [DOC]);
    const accepted = await api.call('project.save', { projectId: PROJECT, expectedRevision: 1, name: draft.name, draft: referenceDraft('sample', DOC) });
    assert.equal(accepted.status, 200); assert.equal(accepted.body.data.project.revision, 2);
    const aftercare = await api.call('project.save', { projectId: PROJECT, expectedRevision: 2, name: draft.name, draft: referenceDraft('aftercare', DOC) });
    assert.equal(aftercare.status, 200); assert.equal(aftercare.body.data.project.revision, 3);
    assert.deepEqual(api.adapterErrors, []);
  } finally { await db.close(); }
});

test('API owner approval binds exact-product scope to fingerprint and exact area when wider quantity changes are not requested', async () => {
  const db = await database();
  try {
    const studio = await setup(db), draft = readyApiDraft(), config = createDefaultPricingConfig();
    await db.query('select designer_set_staff($1,$2,$3)', [OWNER, 'owner@example.test', 'owner']);
    config.products!.push({ id: 'synthetic-fabric', manufacturer: 'Synthetic maker', name: 'Synthetic fabric', code: 'FAB-API', collection: 'Synthetic collection', groupId: 'standard-fabric', approved: true, verified: true, construction: 'Verified fabric face', faceMaterial: 'Fabric', suppliedFormat: 'roll', sourceUrl: 'https://example.invalid/fabric', instructionsUrl: 'https://example.invalid/fabric-instructions', sourceReviewedOn: '2026-10-18', verifiedTypeId: 'standard-fabric', traits: { acoustic: false, velvet: false, specialist: false } });
    draft.items[0].material.productId = 'synthetic-fabric';
    config.logistics.congestionEffectiveUntil = '2026-12-31'; config.logistics.ulezEffectiveUntil = '2026-12-31'; config.version = 'v1';
    assert.equal(validatePricingConfig(config).ok, true);
    await db.query('select designer_save_project($1,$2,$3,$4,$5::jsonb,1)', [OWNER, studio.id, PROJECT, draft.name, JSON.stringify(draft)]);
    await db.query('select designer_save_config($1,0,$2::jsonb)', [OWNER, JSON.stringify(config)]);
    const api = offlineDatabaseApi(db), revision = 2;
    const saved = await api.call('admin.agreement.save', { expectedVersion: 1, projectId: PROJECT, projectRevision: revision, agreement: { id: 'exact-fabric-agreement', itemId: 'scope-one', profileId: 'standard-fabric', approved: true, readyWallsVerified: false, allowAreaPricing: true }, servicePlan: { id: 'exact-fabric-service', approved: true, programmeReviewed: true, propertyContextReviewed: true, managementHours: 0, surveyHours: 0, parking: [] } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const approved = saved.body.data.config, agreement = approved.agreements[0], plan = approved.servicePlans[0];
    assert.equal(agreement.scopeFingerprint, computeApprovalScope(draft, 'scope-one', config)); assert.equal(agreement.minNetAreaMm2, 10_000_000); assert.equal(agreement.maxNetAreaMm2, 10_000_000);
    assert.equal(plan.scopeFingerprint, computeApprovalScope(draft, undefined, config)); assert.equal(plan.minNetAreaMm2, 20_000_000); assert.equal(plan.maxNetAreaMm2, 20_000_000);
    assert.equal(agreement.projectRevision, revision); assert.equal(plan.projectRevision, revision); assert.equal(approved.version, 'v2');
    const preview = await api.call('estimate.preview', { projectId: PROJECT }); assert.equal(preview.status, 200);
    assert.equal(preview.body.data.estimate.status, 'ready'); assert.equal(preview.body.data.estimate.lines.find((line: any) => line.itemId === 'scope-one').profileId, 'standard-fabric');
    let savedRevision = revision;
    for (const mutate of [(value: ProjectDraft) => { value.items[0].walls[0].widthMm = 4500; }, (value: ProjectDraft) => { value.items[0].material.productCode = 'REVISED-FABRIC'; }]) {
      const changed = structuredClone(draft); mutate(changed);
      const changedSave = await api.call('project.save', { projectId: PROJECT, expectedRevision: savedRevision, name: changed.name, draft: changed }); assert.equal(changedSave.status, 200); savedRevision++;
      const revised = await api.call('estimate.preview', { projectId: PROJECT }); assert.equal(revised.status, 200);
      assert.equal(revised.body.data.estimate.totalPence, null, 'exact approval cannot silently cover quantity or specification changes');
      assert.notEqual(revised.body.data.estimate.status, 'ready');
    }
    const persisted = (await db.query<any>('select config from designer_configs where active=true')).rows[0].config;
    assert.deepEqual(persisted, approved); assert.equal(measureScopeArea(draft.items[0]).netMm2, agreement.maxNetAreaMm2); assert.deepEqual(api.adapterErrors, []);
  } finally { await db.close(); }
});

test('API business roles keep history and pilot owner-only and actuals staff-only even for a studio owner', async () => {
  const db = await database();
  try {
    const studio = await setup(db); await issue(db, studio.id);
    await db.query('insert into designer_historical_scopes(external_ref,source_sha256,body,imported_by) values($1,$2,$3::jsonb,$4)', ['synthetic-role-history', SHA, '{"privateNote":"Synthetic historical evidence"}', OWNER]);
    await db.query('insert into designer_actuals(project_id,studio_id,project_revision,idempotency_key,body,analysis,recorded_by) values($1,$2,1,$3,$4::jsonb,$5::jsonb,$6)', [PROJECT, studio.id, 'synthetic-role-actual', '{"privateNote":"Synthetic actual labour"}', '{"rateChangesApplied":false}', OWNER]);
    await db.query('insert into designer_pilot_comparisons(project_id,studio_id,estimate_id,body,comparison,reviewed_by) values($1,$2,$3,$4::jsonb,$5::jsonb,$6)', [PROJECT, studio.id, ESTIMATE, '{"privateNote":"Synthetic independent comparison"}', '{"withinTolerance":true}', OWNER]);
    await db.query('delete from designer_staff where user_id=$1', [OWNER]);
    const api = offlineDatabaseApi(db), sensitiveTables = ['designer_historical_scopes', 'designer_actuals', 'designer_actual_reviews', 'designer_pilot_comparisons'];
    assert.equal((await db.query<any>('select role from designer_memberships where studio_id=$1 and user_id=$2', [studio.id, OWNER])).rows[0].role, 'owner');
    for (const [action, payload] of [['admin.history.list', {}], ['admin.actuals.list', { projectId: PROJECT }], ['admin.pilot.list', { projectId: PROJECT }]] as const) {
      const result = await api.call(action, payload); assert.equal(result.status, 403, action); assert.equal(result.body.error.code, 'forbidden');
    }
    assert.equal(api.reads.some(table => sensitiveTables.includes(table)), false, 'role checks happen before reading private business evidence');
    await db.query('select designer_set_staff($1,$2,$3)', [OWNER, 'owner@example.test', 'staff']);
    const actuals = await api.call('admin.actuals.list', { projectId: PROJECT }); assert.equal(actuals.status, 200); assert.equal(actuals.body.data.actuals[0].body.privateNote, 'Synthetic actual labour');
    assert.equal((await api.call('admin.history.list')).status, 403); assert.equal((await api.call('admin.pilot.list', { projectId: PROJECT })).status, 403);
    await db.query('select designer_set_staff($1,$2,$3)', [OWNER, 'owner@example.test', 'owner']);
    const history = await api.call('admin.history.list'), pilot = await api.call('admin.pilot.list', { projectId: PROJECT });
    assert.equal(history.status, 200); assert.equal(history.body.data.records[0].body.privateNote, 'Synthetic historical evidence'); assert.equal(pilot.status, 200); assert.equal(pilot.body.data.comparisons[0].body.privateNote, 'Synthetic independent comparison');
    assert.deepEqual(api.adapterErrors, []);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${OWNER}',false)`);
    for (const table of sensitiveTables) await assert.rejects(() => db.exec(`select * from ${table}`), /permission denied/);
  } finally { await db.close(); }
});
