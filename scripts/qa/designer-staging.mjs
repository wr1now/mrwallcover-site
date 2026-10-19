/** Real staging protocol verification. Never creates users, approves rates or sends email. */
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PREFIX = 'SYNTHETIC QA ';
const MANUAL = [
  ['region-and-budgets', 'Inspect Supabase London eu-west-2, UK Modal execution/European routing, provider controls and owner-approved worker/price budgets.'],
  ['worker-recovery', 'Interrupt a staging worker and verify retry limits, lease fencing, stale output rejection and cost accounting against deployed records.'],
  ['commercial-pilots', 'Review representative current-owner pricing comparisons for every profile before enabling automatic issuance.'],
  ['operations', 'Verify backups/restore, abandoned-upload reconciliation, retention/deletion and separate notification-provider activation.'],
];
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
class CheckError extends Error { constructor(code) { super(code); this.code = code; } }
const requireThat = (value, code) => { if (!value) throw new CheckError(code); };

export function stagingConfiguration(env) {
  const required = ['DESIGNER_STAGING_ORIGIN', 'DESIGNER_STAGING_PROJECT_REF', 'DESIGNER_STAGING_PRODUCTION_REFS', 'DESIGNER_STAGING_ANON_KEY', 'DESIGNER_STAGING_USER_A_TOKEN', 'DESIGNER_STAGING_USER_B_TOKEN', 'DESIGNER_STAGING_VIEWER_TOKEN', 'DESIGNER_STAGING_OWNER_TOKEN', 'DESIGNER_STAGING_STUDIO_A_ID', 'DESIGNER_STAGING_STUDIO_B_ID', 'DESIGNER_STAGING_READY_PROJECT_ID', 'DESIGNER_STAGING_EXPECTED_TOTAL_PENCE'];
  const missing = required.filter(name => !env[name]);
  if (missing.length || env.DESIGNER_STAGING_CONFIRM !== 'RUN_SYNTHETIC_STAGING_ONLY') return { configured: false, missing: [...missing, ...(env.DESIGNER_STAGING_CONFIRM === 'RUN_SYNTHETIC_STAGING_ONLY' ? [] : ['DESIGNER_STAGING_CONFIRM'])] };
  const ref = env.DESIGNER_STAGING_PROJECT_REF;
  requireThat(/^[a-z0-9]{20}$/.test(ref), 'invalid-staging-ref');
  const origin = new URL(env.DESIGNER_STAGING_ORIGIN);
  requireThat(origin.origin === env.DESIGNER_STAGING_ORIGIN && origin.protocol === 'https:' && origin.hostname === `${ref}.supabase.co` && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash, 'invalid-staging-origin');
  const forbidden = env.DESIGNER_STAGING_PRODUCTION_REFS.split(',').map(value => value.trim());
  requireThat(forbidden.every(value => /^[a-z0-9]{20}$/.test(value) || value === 'NONE_PROVISIONED') && !forbidden.includes(ref), 'production-project-forbidden');
  requireThat(['DESIGNER_STAGING_STUDIO_A_ID', 'DESIGNER_STAGING_STUDIO_B_ID', 'DESIGNER_STAGING_READY_PROJECT_ID'].every(name => uuid(env[name])) && env.DESIGNER_STAGING_STUDIO_A_ID !== env.DESIGNER_STAGING_STUDIO_B_ID, 'invalid-synthetic-resources');
  const tokens = ['USER_A', 'USER_B', 'VIEWER', 'OWNER'].map(role => env[`DESIGNER_STAGING_${role}_TOKEN`]);
  requireThat(tokens.every(value => typeof value === 'string' && value.length >= 20 && value.length <= 12000 && !/\s/.test(value)) && new Set(tokens).size === 4, 'invalid-test-tokens');
  requireThat(/^\d+$/.test(env.DESIGNER_STAGING_EXPECTED_TOTAL_PENCE || '') && Number.isSafeInteger(Number(env.DESIGNER_STAGING_EXPECTED_TOTAL_PENCE)) && Number(env.DESIGNER_STAGING_EXPECTED_TOTAL_PENCE) > 0, 'owner-total-required');
  return { configured: true, origin: origin.origin, ref, anonKey: env.DESIGNER_STAGING_ANON_KEY, tokens: { a: tokens[0], b: tokens[1], viewer: tokens[2], owner: tokens[3] }, studioA: env.DESIGNER_STAGING_STUDIO_A_ID, studioB: env.DESIGNER_STAGING_STUDIO_B_ID, readyProjectId: env.DESIGNER_STAGING_READY_PROJECT_ID, expectedTotal: Number(env.DESIGNER_STAGING_EXPECTED_TOTAL_PENCE), expiredToken: env.DESIGNER_STAGING_EXPIRED_SHARE_TOKEN, expiredGrant: env.DESIGNER_STAGING_EXPIRED_SHARE_ID };
}

/** A small generated source; no customer file, executable content or inferred dimensions. */
export function syntheticPdf(label) {
  const text = label.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 180);
  const stream = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n', offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
export async function extractPdfText(bytes, python = 'python3', timeoutMs = 20000) {
  return new Promise((accept, reject) => {
    const child = spawn(python, ['-c', 'import io,sys;from pypdf import PdfReader;r=PdfReader(io.BytesIO(sys.stdin.buffer.read()));assert 0<len(r.pages)<=200;print("\\n".join(p.extract_text() or "" for p in r.pages))'], { stdio: ['pipe', 'pipe', 'ignore'] });
    const chunks = []; let size = 0; const timeout = setTimeout(() => { child.kill(); reject(new CheckError('pdf-parser-unavailable')); }, Math.max(1, Math.min(timeoutMs, 20000)));
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 2_000_000) { child.kill(); reject(new CheckError('pdf-text-limit')); } else chunks.push(chunk); });
    child.on('error', () => { clearTimeout(timeout); reject(new CheckError('pdf-parser-unavailable')); });
    child.on('close', code => { clearTimeout(timeout); if (code === 0) accept(Buffer.concat(chunks).toString('utf8')); else reject(new CheckError('pdf-parser-unavailable')); });
    child.stdin.on('error', () => {}); child.stdin.end(bytes);
  });
}

export async function runStaging({ env = process.env, fetcher = globalThis.fetch, now = Date.now, sleep = milliseconds => new Promise(accept => setTimeout(accept, milliseconds)), pdfText = (bytes, timeoutMs) => extractPdfText(bytes, env.DESIGNER_STAGING_PYTHON || 'python3', timeoutMs), limits = {} } = {}) {
  const started = now(), receipt = { schemaVersion: 1, scope: 'deployed-designer-staging-protocol', status: 'unconfigured', automatedStatus: 'unverified', checks: [], resources: { projects: [], documents: [], estimates: [], shares: [] }, requests: 0, durationMs: 0 };
  let config;
  try { config = stagingConfiguration(env); } catch { receipt.status = 'fail'; receipt.checks.push({ id: 'staging-guards', status: 'fail', detail: 'The isolated staging declaration is invalid or names a production project.' }); return receipt; }
  if (!config.configured) { receipt.checks.push({ id: 'configuration', status: 'unconfigured', detail: `Missing private staging configuration: ${config.missing.join(', ')}. No network request or write was made.` }); return receipt; }
  const maxRequests = Math.min(limits.maxRequests ?? 180, 180), maxMs = Math.min(limits.maxMs ?? 600000, 600000), pollMs = limits.pollMs ?? 5000, pollLimit = Math.min(limits.pollLimit ?? 45, 60);
  const runId = randomUUID(), canary = `SYNTHETIC_PRIVATE_DOCUMENT_${runId.replaceAll('-', '')}`;
  receipt.runId = runId; receipt.projectRef = config.ref;
  const ok = (id, detail) => receipt.checks.push({ id, status: 'pass', detail });
  const manual = (id, detail) => receipt.checks.push({ id, status: 'manual', detail });
  async function bytes(response, maximum) { const declared = Number(response.headers.get('content-length')); requireThat(!declared || declared <= maximum, 'response-too-large'); const chunks = []; let total = 0; if (response.body) for await (const chunk of response.body) { total += chunk.length; requireThat(total <= maximum, 'response-too-large'); chunks.push(chunk); } return Buffer.concat(chunks); }
  async function request(url, options, { binary = false, maximum = 2_100_000 } = {}) {
    requireThat(receipt.requests < maxRequests && now() - started < maxMs, 'verification-budget-exhausted'); receipt.requests++;
    const target = new URL(url, config.origin); requireThat(target.origin === config.origin && !target.username && !target.password, 'foreign-storage-origin');
    let response; try { response = await fetcher(target.href, { ...options, redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.min(15000, maxMs - (now() - started)))) }); } catch { throw new CheckError('staging-request-unavailable'); }
    const raw = await bytes(response, maximum); if (binary) return { response, bytes: raw };
    let body; try { body = JSON.parse(raw.toString('utf8')); } catch { throw new CheckError('invalid-api-response'); } return { response, body };
  }
  async function action(actor, name, payload = {}, expected = 200) {
    const readOnly = new Set(['session', 'project.get', 'project.list', 'admin.notifications.get', 'admin.config.get', 'document.status', 'document.url', 'estimate.preview', 'estimate.get', 'estimate.pdf', 'share.get']);
    for (let attempt = 0; attempt < 2; attempt++) {
      let result;
      try { result = await request('/functions/v1/designer-portal', { method: 'POST', headers: { apikey: config.anonKey, 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${config.tokens[actor]}` } : {}) }, body: JSON.stringify({ action: name, payload }) }); }
      catch (error) { if (attempt === 0 && readOnly.has(name) && error.code === 'staging-request-unavailable') { await sleep(200); continue; } throw error; }
      const { response, body } = result;
      if (attempt === 0 && readOnly.has(name) && [429, 502, 503, 504].includes(response.status)) { await sleep(200); continue; }
      requireThat((Array.isArray(expected) ? expected : [expected]).includes(response.status), `unexpected-status-${name.replaceAll('.', '-')}`);
      if (response.status !== 200) { requireThat(body?.ok === false && typeof body.error?.code === 'string', 'invalid-error-protocol'); return body; }
      requireThat(body?.ok === true && body.data && typeof body.data === 'object', 'invalid-success-protocol'); return body.data;
    }
  }
  async function denied(actor, name, payload) { return action(actor, name, payload, [401, 403, 404]); }
  async function poll(read, complete, terminal) { for (let i = 0; i < pollLimit; i++) { const value = await read(); if (complete(value)) return value; requireThat(!terminal?.(value), 'worker-terminal-failure'); await sleep(pollMs); } throw new CheckError('worker-observation-timeout'); }
  function safeProjection(value, privateStrings = []) { const serialized = JSON.stringify(value); for (const key of ['contact', 'propertyValuePence', 'source_manifest', 'provenance', 'configVersion', 'managementRatePence', 'surveyRatePence', 'storage_path', 'provider_id', 'providerPayload', 'profileId', 'packageTemplateId']) requireThat(!new RegExp(`"${key}"\\s*:`).test(serialized), 'private-fields-in-client-output'); for (const secret of privateStrings.filter(Boolean)) requireThat(!serialized.includes(secret), 'private-value-in-client-output'); }
  try {
    const sessions = {}; for (const actor of ['a', 'b', 'viewer', 'owner']) sessions[actor] = await action(actor, 'session');
    requireThat(Object.values(sessions).every(session => /^synthetic-[^@]+@[^@]+\.invalid$/i.test(session.user?.email || '')) && new Set(Object.values(sessions).map(session => session.user.id)).size === 4, 'synthetic-actors-required');
    requireThat(sessions.owner.staffRole === 'owner' && !sessions.a.staffRole && !sessions.b.staffRole && !sessions.viewer.staffRole, 'test-role-mismatch');
    requireThat(sessions.a.studios.some(studio => studio.id === config.studioA && studio.role === 'owner') && sessions.b.studios.some(studio => studio.id === config.studioB) && sessions.viewer.studios.some(studio => studio.id === config.studioA && studio.role === 'viewer'), 'test-membership-mismatch');
    const notification = await action('owner', 'admin.notifications.get'); requireThat(notification.configuration?.enabled === false, 'notifications-must-already-be-disabled');
    requireThat(sessions.a.capabilities?.uploadsEnabled && sessions.a.capabilities?.workerEnabled, 'staging-processing-not-enabled');
    const ready = await action('a', 'project.get', { projectId: config.readyProjectId });
    requireThat(ready.project.studioId === config.studioA && ready.project.name.startsWith(PREFIX) && ready.project.draft.address.line1.startsWith('SYNTHETIC') && ready.project.draft.contact.name.startsWith('SYNTHETIC') && ready.project.draft.contact.email.endsWith('.invalid'), 'synthetic-ready-project-required');
    const forbiddenOrigin = await request('/functions/v1/designer-portal', { method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${config.tokens.a}`, Origin: `https://${runId}.invalid`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'session', payload: {} }) }); requireThat(forbiddenOrigin.response.status === 403 && forbiddenOrigin.body?.error?.code === 'origin_denied', 'origin-restriction-failed');
    ok('staging-preflight', 'Four distinct synthetic verified actors, isolated memberships, a synthetic owner-prepared project, enabled processing and disabled notifications were observed.');

    const draft = { schemaVersion: 1, name: `${PREFIX}${runId}`, buildingType: 'unknown', rooms: [], items: [], contact: { name: 'SYNTHETIC PRIVATE CONTACT', email: 'synthetic-contact@example.invalid' }, address: { line1: 'SYNTHETIC TEST SITE', town: '', postcode: '', country: 'UK' }, programme: { occupied: 'unknown', outOfHours: 'unknown', phases: 1 }, logistics: { vehicleDays: [], vehicleDaysConfirmed: false, deliveriesRequired: 'unknown', storageRequired: 'unknown', accessEquipmentRequired: 'unknown', wasteRemovalRequired: 'unknown' } };
    const created = (await action('a', 'project.create', { studioId: config.studioA, name: draft.name, draft })).project; receipt.resources.projects.push(created.id);
    await denied('b', 'project.get', { projectId: created.id }); await denied('a', 'project.list', { studioId: config.studioB }); await denied('a', 'admin.config.get');
    await action('viewer', 'project.get', { projectId: created.id }); await denied('viewer', 'project.save', { projectId: created.id, expectedRevision: created.revision, name: draft.name, draft });
    const revised = (await action('a', 'project.save', { projectId: created.id, expectedRevision: created.revision, name: draft.name, draft })).project;
    requireThat(revised.revision > created.revision, 'revision-did-not-increment'); await action('a', 'project.save', { projectId: created.id, expectedRevision: created.revision, name: draft.name, draft }, 409);
    const incomplete = (await action('a', 'estimate.preview', { projectId: created.id })).estimate;
    requireThat(incomplete.status !== 'ready' && incomplete.totalPence === null && incomplete.reviewReasons.length > 0, 'incomplete-total-exposed'); await action('a', 'estimate.issue', { projectId: created.id, expectedRevision: revised.revision, idempotencyKey: `synthetic-incomplete-${runId}` }, 409);
    ok('isolation-and-revisions', 'Cross-studio reads and ordinary-owner price access were denied; viewer read/write separation, optimistic revisions and incomplete-estimate refusal passed.');

    const source = syntheticPdf(canary); let previous;
    for (let revision = 1; revision <= 2; revision++) {
      const documentBytes = revision === 1 ? source : syntheticPdf(`${canary}_REVISION_2`);
      const uploadPayload = { projectId: config.readyProjectId, fileName: `synthetic-staging-${runId}-r${revision}.pdf`, mime: 'application/pdf', bytes: documentBytes.length, sha256: digest(documentBytes), ...(previous ? { priorDocumentId: previous } : {}) };
      if (revision === 1) { await denied('b', 'upload.reserve', uploadPayload); await denied('viewer', 'upload.reserve', uploadPayload); }
      const reserved = await action('a', 'upload.reserve', uploadPayload); receipt.resources.documents.push(reserved.document.id);
      const uploaded = await request(reserved.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: documentBytes }, { binary: true }); requireThat(uploaded.response.ok, 'private-upload-failed');
      await action('a', 'upload.complete', { projectId: config.readyProjectId, documentId: reserved.document.id });
      const verified = await poll(() => action('a', 'document.status', { projectId: config.readyProjectId, documentId: reserved.document.id }), value => value.document.verified === true, value => ['quarantined', 'failed'].includes(value.document.state));
      requireThat(verified.document.sha256 === digest(documentBytes) && verified.document.revision === revision && (revision === 1 || verified.document.supersedesDocumentId === previous), 'document-revision-or-hash-mismatch');
      await denied('b', 'document.url', { projectId: config.readyProjectId, documentId: reserved.document.id }); await denied(null, 'document.url', { projectId: config.readyProjectId, documentId: reserved.document.id });
      const file = await action('a', 'document.url', { projectId: config.readyProjectId, documentId: reserved.document.id }); const downloaded = await request(file.url, { method: 'GET' }, { binary: true }); requireThat(downloaded.response.ok && digest(downloaded.bytes) === digest(documentBytes), 'private-document-byte-mismatch');
      previous = reserved.document.id;
    }
    await action('a', 'document.extract', { projectId: config.readyProjectId, documentId: previous });
    const extracted = await poll(() => action('a', 'project.get', { projectId: config.readyProjectId }), value => value.evidence.some(fact => fact.documentId === previous), value => value.jobs.some(job => job.type === 'document.extract' && job.state === 'failed'));
    const fact = extracted.evidence.find(value => value.documentId === previous); requireThat(fact.confirmed === false && fact.source?.documentId === previous, 'evidence-not-unconfirmed-or-cited');
    await action('a', 'evidence.confirm', { projectId: config.readyProjectId, evidenceId: fact.id, expectedRevision: ready.project.revision, checked: true });
    ok('private-documents-and-workers', 'Two real private upload revisions passed verification and byte/hash download checks. Deployed extraction produced cited unconfirmed evidence and accepted an explicit source confirmation.');

    requireThat((await action('owner', 'admin.notifications.get')).configuration.enabled === false, 'notification-setting-changed');
    const preview = (await action('a', 'estimate.preview', { projectId: config.readyProjectId })).estimate;
    requireThat(preview.status === 'ready' && preview.totalPence === config.expectedTotal, 'owner-approved-ready-total-mismatch');
    const key = `synthetic-ready-${runId}`, issuePayload = { projectId: config.readyProjectId, expectedRevision: ready.project.revision, idempotencyKey: key };
    const issued = (await action('a', 'estimate.issue', issuePayload)).estimate; receipt.resources.estimates.push(issued.id);
    requireThat((await action('a', 'estimate.issue', issuePayload)).estimate.id === issued.id, 'estimate-idempotency-failed');
    const snapshot = await poll(() => action('a', 'estimate.get', { projectId: config.readyProjectId, estimateId: issued.id }), value => value.pdfState === 'ready');
    requireThat(snapshot.estimate.totalPence === config.expectedTotal && snapshot.estimate.totalPence === snapshot.estimate.subtotalPence + snapshot.estimate.vatPence && snapshot.estimate.lines.reduce((sum, line) => sum + line.amountPence, 0) === snapshot.estimate.subtotalPence, 'snapshot-total-mismatch');
    const pdfUrl = await action('a', 'estimate.pdf', { projectId: config.readyProjectId, estimateId: issued.id }); const pdf = await request(pdfUrl.url, { method: 'GET' }, { binary: true, maximum: 20_971_520 }); requireThat(pdf.response.ok && pdf.bytes.subarray(0, 5).toString() === '%PDF-', 'invalid-generated-pdf');
    const privateStrings = [ready.project.draft.contact.name, ready.project.draft.contact.email, canary];
    if (ready.project.draft.propertyValuePence) privateStrings.push(String(ready.project.draft.propertyValuePence), `£${(ready.project.draft.propertyValuePence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    else manual('private-property-value-case', 'The synthetic ready project has no private property-value context; verify that high-value service assessment and private-value PDF exclusion separately.');
    try { const text = await pdfText(pdf.bytes, Math.max(1, maxMs - (now() - started))), compact = text.replace(/\s/g, ''); for (const [label, amount] of [['Subtotal', issued.subtotalPence], [`VAT(${issued.vatRateBps / 100}%)`, issued.vatPence], ['TotalincludingVAT', issued.totalPence]]) requireThat(compact.includes(`${label}£${(amount / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`), 'pdf-total-mismatch'); for (const value of privateStrings) requireThat(!text.includes(value), 'private-value-in-pdf'); ok('pdf-totals-and-privacy', 'A real worker-generated PDF was parsed; labelled subtotal, VAT and gross total match the issued snapshot and private canaries are absent.'); } catch (error) { if (error.code === 'pdf-parser-unavailable') manual('pdf-totals-and-privacy', 'Install pypdf for the selected private Python runtime and rerun; PDF text/totals/privacy remain unverified.'); else throw error; }
    ok('ready-estimate-and-idempotency', 'Already owner-approved staging scope produced the independently supplied total and one immutable issued estimate for the repeated request key.');

    const shared = await action('a', 'share.create', { projectId: config.readyProjectId, estimateId: issued.id, expiresInDays: 1 }); receipt.resources.shares.push(shared.share.id);
    requireThat(Date.parse(shared.share.expiresAt) > now() && Date.parse(shared.share.expiresAt) <= Math.min(now() + 86_400_000, Date.parse(issued.validUntil)) + 5000, 'share-expiry-bound-mismatch');
    const client = await action(null, 'share.get', { token: shared.token }); safeProjection(client.estimate, privateStrings);
    const clientPdf = await request('/functions/v1/designer-portal', { method: 'POST', headers: { apikey: config.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'share.pdf', payload: { token: shared.token } }) }, { binary: true, maximum: 20_971_520 }); requireThat(clientPdf.response.ok && digest(clientPdf.bytes) === digest(pdf.bytes), 'shared-pdf-mismatch');
    await action('a', 'share.revoke', { projectId: config.readyProjectId, shareId: shared.share.id }); await action(null, 'share.get', { token: shared.token }, 404); await action(null, 'share.pdf', { token: shared.token }, 404);
    ok('client-sharing-and-revocation', 'Anonymous client projection and matching PDF exclude private fields; revocation denies both subsequent reads. Expiry is bounded by the selected duration and estimate validity.');
    if (config.expiredToken && config.expiredGrant) { requireThat(/^[a-f0-9]{64}$/.test(config.expiredToken) && uuid(config.expiredGrant), 'invalid-expired-share-fixture'); const old = ready.shares.find(share => share.id === config.expiredGrant); requireThat(old && !old.revokedAt && Date.parse(old.expiresAt) < now(), 'expired-share-evidence-missing'); await action(null, 'share.get', { token: config.expiredToken }, 404); await action(null, 'share.pdf', { token: config.expiredToken }, 404); ok('expired-client-endpoints', 'The supplied expired-fixture token is denied by both client endpoints, and the supplied grant record is unrevoked with a past expiry.'); manual('expired-client-grant', 'Confirm the supplied token belongs to that exact expired grant against the original private issue receipt or stored token hash. The client API cannot reveal that binding; a denied arbitrary token is not proof of expiry.'); }
    else manual('expired-client-grant', 'Supply a known unrevoked synthetic grant issued at least one day earlier, plus its private token, and rerun expiry verification. No clock or database expiry bypass is provided.');
    for (const [id, detail] of MANUAL) manual(id, detail);
    receipt.automatedStatus = 'pass'; receipt.status = receipt.checks.some(check => check.status === 'manual') ? 'manual' : 'pass';
  } catch (error) { receipt.status = 'fail'; receipt.automatedStatus = 'fail'; receipt.checks.push({ id: 'execution', status: 'fail', detail: error instanceof CheckError ? error.code : 'unexpected-verification-error' }); }
  receipt.durationMs = now() - started; return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const receipt = await runStaging();
  if (process.env.DESIGNER_STAGING_RECEIPT_PATH) await writeFile(resolve(process.env.DESIGNER_STAGING_RECEIPT_PATH), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  process.exitCode = receipt.status === 'pass' ? 0 : receipt.status === 'fail' ? 1 : 2;
}
