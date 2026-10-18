import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { startLeadServer } from '../server/index.ts';

let close: () => Promise<void>;
let base: string;
let dir: string;
const token = 'staff-test-token';

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'mw-leads-'));
  process.env.LEAD_API_ENABLED = '1';
  process.env.LEAD_DATA_DIR = dir;
  process.env.LEAD_STAFF_TOKEN = token;
  process.env.LEAD_NOTIFIER = 'fail';
  process.env.LEAD_RATE_LIMIT = '100';
  process.env.LEAD_ALLOWED_ORIGINS = 'http://127.0.0.1:4321';
  const server = await startLeadServer(0);
  close = server.close;
  base = `http://127.0.0.1:${server.port}`;
});

after(async () => {
  await close();
  await rm(dir, { recursive: true, force: true });
});

function form(extra?: (body: FormData) => void) {
  const body = new FormData();
  body.set('name', 'Ada Lovelace');
  body.set('replyBy', 'email');
  body.set('email', 'ada@example.com');
  body.set('message', 'Wallpaper is already purchased for one bedroom.');
  body.set('intent', 'install');
  body.set('idempotencyKey', `key-${Math.random()}`);
  extra?.(body);
  return body;
}

async function post(body: FormData, headers: Record<string, string> = {}) {
  return fetch(`${base}/api/leads`, {
    method: 'POST',
    body,
    headers: { origin: 'http://127.0.0.1:4321', ...headers },
  });
}

test('stores a lead, returns one reference, and keeps it when mail fails', async () => {
  const key = 'idem-mail-fail';
  const response = await post(form((body) => body.set('idempotencyKey', key)));
  assert.equal(response.status, 201);
  const payload = await response.json() as { reference: string; notification: string; received: boolean };
  assert.match(payload.reference, /^MW-/);
  assert.equal(payload.received, true);
  assert.equal(payload.notification, 'failed');
  const stored = JSON.parse(await readFile(path.join(dir, payload.reference, 'lead.json'), 'utf8'));
  assert.equal(stored.enquiry.email, 'ada@example.com');
  assert.equal(stored.notification.state, 'failed');
  assert.equal(stored.files.length, 0);

  const replay = await post(form((body) => body.set('idempotencyKey', key)));
  assert.equal(replay.status, 200);
  const again = await replay.json() as { reference: string; replayed: boolean };
  assert.equal(again.reference, payload.reference);
  assert.equal(again.replayed, true);
});

test('a designer brief with a PDF stays private', async () => {
  const pdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])], { type: 'application/pdf' });
  const response = await post(form((body) => {
    body.set('audience', 'designer');
    body.set('message', 'Room schedule for three bedrooms. Drawings attached.');
    body.set('programme', 'Tender Friday. Occupied house.');
    body.set('materialResponsibility', 'Free-issue, batch to be checked on delivery.');
    body.append('files', pdf, 'schedule.pdf');
  }));
  assert.equal(response.status, 201);
  const payload = await response.json() as { reference: string };
  const open = await fetch(`${base}/api/leads/${payload.reference}`);
  assert.equal(open.status, 401);
  const leaked = await open.text();
  assert.equal(leaked.includes('Ada'), false);
  assert.equal(leaked.includes('schedule'), false);
  const staff = await fetch(`${base}/api/leads/${payload.reference}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(staff.status, 200);
  const lead = await staff.json() as { enquiry: { audience: string; programme: string }; files: { name: string }[] };
  assert.equal(lead.enquiry.audience, 'designer');
  assert.match(lead.enquiry.programme, /Tender/);
  assert.equal(lead.files[0].name, '01.pdf');
  const file = await fetch(`${base}/api/leads/${payload.reference}/files/01.pdf`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(file.status, 200);
  const stranger = await fetch(`${base}/api/leads/${payload.reference}/files/01.pdf`);
  assert.equal(stranger.status, 401);
});

test('rejects an unsupported upload and an aftercare note is distinguishable', async () => {
  const bad = await post(form((body) => {
    body.append('files', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
  }));
  assert.equal(bad.status, 400);

  const heic = new Uint8Array(20);
  heic.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 0);
  const photo = await post(form((body) => {
    body.set('kind', 'aftercare');
    body.set('message', 'The corner has lifted. Photograph attached.');
    body.set('projectReference', 'MW-PREVJOB');
    body.append('files', new Blob([heic], { type: 'image/heic' }), 'IMG.HEIC');
  }));
  assert.equal(photo.status, 201);
  const payload = await photo.json() as { reference: string; kind: string };
  assert.equal(payload.kind, 'aftercare');
  const staff = await fetch(`${base}/api/leads/${payload.reference}`, { headers: { authorization: `Bearer ${token}` } });
  const lead = await staff.json() as { kind: string; files: { type: string; metadata: string }[]; enquiry: { message: string } };
  assert.equal(lead.kind, 'aftercare');
  assert.equal(lead.files[0].type, 'heic');
  assert.equal(lead.files[0].metadata, 'stored');
  assert.doesNotMatch(lead.enquiry.message, /excluded|guarantee does not/i);
});

test('a foreign origin and a bad token do not reveal a lead', async () => {
  const response = await fetch(`${base}/api/leads`, {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Ada', replyBy: 'email', email: 'ada@example.com', message: 'Should not store this note.' }),
  });
  assert.equal(response.status, 403);
  const wrong = await fetch(`${base}/api/leads`, { headers: { authorization: 'Bearer nope' } });
  assert.equal(wrong.status, 401);
  const missing = await fetch(`${base}/api/leads/MW-ZZZZZZZZ`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(missing.status, 404);
  const body = await missing.json() as { error: string };
  assert.equal(body.error, 'Not found.');
  assert.equal(JSON.stringify(body).includes('lead.json'), false);
});

test('developer and hotel context survives storage with specification and material choices', async () => {
  for (const audience of ['developer', 'hotel']) {
    const preferences = { use: 'commercial', look: 'uniform', cleaning: 'frequent', panels: 'discreet', light: 'mixed' };
    const response = await post(form((body) => {
      body.set('audience', audience);
      body.set('programme', 'Phase one in November');
      body.set('specificationNotes', 'Drawing revision C; sample area to agree.');
      body.set('materialResponsibility', 'Client supply');
      body.set('materialPreferences', JSON.stringify(preferences));
      body.set('shortlist', 'contract-vinyl,paper-and-non-woven');
    }));
    assert.equal(response.status, 201);
    const { reference } = await response.json() as { reference: string };
    const stored = JSON.parse(await readFile(path.join(dir, reference, 'lead.json'), 'utf8'));
    assert.equal(stored.enquiry.audience, audience);
    assert.equal(stored.enquiry.specificationNotes, 'Drawing revision C; sample area to agree.');
    assert.equal(stored.enquiry.materialResponsibility, 'Client supply');
    assert.deepEqual(JSON.parse(stored.enquiry.materialPreferences), preferences);
    assert.deepEqual(stored.enquiry.shortlist, ['contract-vinyl', 'paper-and-non-woven']);
  }
});

test('explicit service context and email permission evidence survive private storage with server receipt time', async () => {
  const { EMAIL_MARKETING_TEXT, EMAIL_MARKETING_VERSION, PRIVACY_NOTICE_VERSION } = await import('../src/lib/enquiry-context.ts');
  const started = Date.now();
  const response = await post(form((body) => {
    body.set('service', 'window-film');
    body.set('topic', 'service:window-film');
    body.set('topicOrigin', 'link');
    body.set('sourceDeclared', 'instagram');
    body.set('marketing', 'yes');
    body.set('marketingTextVersion', EMAIL_MARKETING_VERSION);
    body.set('privacyNoticeVersion', PRIVACY_NOTICE_VERSION);
    body.set('receivedAt', '1900-01-01T00:00:00Z');
    body.set('marketingWording', 'arbitrary client statement');
  }));
  assert.equal(response.status, 201);
  const { reference } = await response.json() as { reference: string };
  const stored = JSON.parse(await readFile(path.join(dir, reference, 'lead.json'), 'utf8'));
  assert.equal(stored.schemaVersion, 2);
  assert.equal(stored.enquiry.service, 'window-film');
  assert.equal(stored.enquiry.topic, 'service:window-film');
  assert.equal(stored.enquiry.sourceDeclared, 'instagram');
  assert.equal(stored.permissions.emailMarketing.state, 'granted');
  assert.equal(stored.permissions.emailMarketing.textVersion, EMAIL_MARKETING_VERSION);
  assert.equal(stored.permissions.emailMarketing.noticeVersion, PRIVACY_NOTICE_VERSION);
  assert.equal(stored.permissions.emailMarketing.wording, EMAIL_MARKETING_TEXT);
  assert.equal(stored.permissions.emailMarketing.receivedAt, stored.createdAt);
  assert.ok(Date.parse(stored.permissions.emailMarketing.receivedAt) >= started);
});

test('legacy Boolean, forged versions and phone-only replies cannot grant email marketing', async () => {
  const { EMAIL_MARKETING_VERSION, PRIVACY_NOTICE_VERSION } = await import('../src/lib/enquiry-context.ts');
  for (const variant of ['legacy', 'wrong-version', 'phone']) {
    const response = await post(form((body) => {
      body.set('marketing', 'yes');
      body.set('sourceDeclared', 'private@example.invalid');
      body.set('topic', 'private@example.invalid');
      if (variant !== 'legacy') {
        body.set('marketingTextVersion', variant === 'wrong-version' ? 'forged' : EMAIL_MARKETING_VERSION);
        body.set('privacyNoticeVersion', PRIVACY_NOTICE_VERSION);
      }
      if (variant === 'phone') { body.set('replyBy', 'phone'); body.set('phone', '07700900000'); }
    }));
    assert.equal(response.status, 201);
    const { reference } = await response.json() as { reference: string };
    const stored = JSON.parse(await readFile(path.join(dir, reference, 'lead.json'), 'utf8'));
    assert.equal(stored.enquiry.marketing, false);
    assert.equal(stored.permissions.emailMarketing.state, 'not-granted');
    assert.equal(stored.enquiry.topic, '');
    assert.equal(stored.enquiry.sourceDeclared, '');
  }
});

test('JSON objects and non-string field types return 400 rather than failing inside validation', async () => {
  for (const body of [null, [], { name: 7 }, { name: 'Ada', message: { private: 'brief' } }]) {
    const response = await fetch(`${base}/api/leads`, { method: 'POST', headers: { origin: 'http://127.0.0.1:4321', 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
    assert.doesNotMatch(await response.text(), /private|TypeError|lead\.json/);
  }
});
