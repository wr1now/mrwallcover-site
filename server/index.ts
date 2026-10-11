/**
 * Private enquiry API. It does not run on GitHub Pages.
 * Start it only with LEAD_API_ENABLED=1 (`npm run lead-api`).
 * Leads are written to disk before the response says they were received.
 * A failed notification leaves the lead in place and records the failure.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { emptyEnquiry, makeReference, validateEnquiry, FILE_LIMITS, type EnquiryFields, type ValidEnquiry } from '../src/lib/enquiry.ts';
import { extensionFor, prepareUpload } from '../src/lib/files.ts';

interface StoredFile {
  name: string;
  type: string;
  bytes: number;
  metadata: string;
}

interface NotificationAttempt {
  at: string;
  ok: boolean;
  error?: string;
}

interface StoredLead {
  reference: string;
  idempotencyKey: string;
  createdAt: string;
  kind: 'enquiry' | 'aftercare';
  status: 'new';
  notification: { state: 'pending' | 'sent' | 'failed'; attempts: NotificationAttempt[] };
  enquiry: ValidEnquiry;
  files: StoredFile[];
}

const MAX_ATTEMPTS = 3;
const rateBuckets = new Map<string, number[]>();

function enabled(): boolean {
  return process.env.LEAD_API_ENABLED === '1';
}

function dataDir(): string {
  return path.resolve(process.env.LEAD_DATA_DIR || path.join(process.cwd(), 'data', 'leads'));
}

function allowedOrigins(): string[] {
  const raw = process.env.LEAD_ALLOWED_ORIGINS || 'http://127.0.0.1:4321,http://localhost:4321,http://127.0.0.1:4173,http://localhost:4173';
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function staffToken(): string {
  return process.env.LEAD_STAFF_TOKEN || '';
}

function json(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
  });
  res.end(payload);
}

function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  const allowed = allowedOrigins();
  if (typeof origin === 'string' && allowed.includes(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-headers', 'content-type, authorization, idempotency-key');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (typeof origin === 'string') return allowedOrigins().includes(origin);
  const remote = req.socket.remoteAddress || '';
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
}

function authorised(req: IncomingMessage): boolean {
  const expected = staffToken();
  if (!expected) return false;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

function rateLimited(ip: string): boolean {
  const limit = Number(process.env.LEAD_RATE_LIMIT || 8);
  const windowMs = 10 * 60 * 1000;
  const now = Date.now();
  const hits = (rateBuckets.get(ip) || []).filter((at) => now - at < windowMs);
  if (hits.length >= limit) {
    rateBuckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  return false;
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limit) throw new Error('too_large');
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(body: Buffer, contentType: string): { fields: Record<string, string>; files: { filename: string; data: Buffer }[] } {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!match) throw new Error('boundary');
  const boundary = Buffer.from(`--${(match[1] || match[2]).trim()}`);
  const fields: Record<string, string> = {};
  const files: { filename: string; data: Buffer }[] = [];
  let cursor = body.indexOf(boundary);
  if (cursor < 0) throw new Error('boundary');
  while (cursor >= 0) {
    let start = cursor + boundary.length;
    if (body.subarray(start, start + 2).toString() === '--') break;
    if (body.subarray(start, start + 2).toString() === '\r\n') start += 2;
    const next = body.indexOf(boundary, start);
    if (next < 0) break;
    let part = body.subarray(start, next);
    if (part.subarray(part.length - 2).toString() === '\r\n') part = part.subarray(0, part.length - 2);
    const split = part.indexOf(Buffer.from('\r\n\r\n'));
    if (split < 0) {
      cursor = next;
      continue;
    }
    const head = part.subarray(0, split).toString('utf8');
    const data = part.subarray(split + 4);
    const name = /name="([^"]+)"/.exec(head)?.[1] || '';
    const filename = /filename="([^"]*)"/.exec(head)?.[1];
    if (filename !== undefined && filename !== '') files.push({ filename, data });
    else if (name) fields[name] = data.toString('utf8');
    cursor = next;
  }
  return { fields, files };
}

function fieldsFrom(raw: Record<string, string>): EnquiryFields {
  return emptyEnquiry({
    kind: raw.kind || 'enquiry',
    name: raw.name || '',
    email: raw.email || '',
    phone: raw.phone || '',
    replyBy: raw.replyBy || '',
    message: raw.message || '',
    audience: raw.audience || '',
    intent: raw.intent || '',
    area: raw.area || '',
    rooms: raw.rooms || '',
    wallNotes: raw.wallNotes || '',
    product: raw.product || '',
    timing: raw.timing || '',
    access: raw.access || '',
    programme: raw.programme || '',
    materialResponsibility: raw.materialResponsibility || '',
    specificationNotes: raw.specificationNotes || '',
    materialPreferences: raw.materialPreferences || '',
    budget: raw.budget || '',
    marketing: raw.marketing === 'yes' || raw.marketing === 'true',
    shortlist: raw.shortlist || '',
    honeypot: raw._honey || raw.honeypot || '',
    idempotencyKey: raw.idempotencyKey || '',
    projectReference: raw.projectReference || '',
  });
}

async function notify(lead: StoredLead): Promise<NotificationAttempt> {
  const mode = process.env.LEAD_NOTIFIER || 'unconfigured';
  const at = new Date().toISOString();
  if (mode === 'file') {
    const note = {
      reference: lead.reference,
      kind: lead.kind,
      replyBy: lead.enquiry.replyBy,
      at,
    };
    await writeFile(path.join(dataDir(), lead.reference, 'notification.json'), JSON.stringify(note, null, 2));
    return { at, ok: true };
  }
  if (mode === 'fail') return { at, ok: false, error: 'delivery_failed' };
  return { at, ok: false, error: 'notifier_not_configured' };
}

async function saveLead(lead: StoredLead) {
  const dir = path.join(dataDir(), lead.reference);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, 'lead.json');
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(lead, null, 2));
  await rename(tmp, target);
  if (lead.idempotencyKey) {
    const keys = path.join(dataDir(), '_keys');
    await mkdir(keys, { recursive: true });
    await writeFile(path.join(keys, encodeURIComponent(lead.idempotencyKey)), lead.reference);
  }
}

async function loadLead(reference: string): Promise<StoredLead | null> {
  if (!/^MW-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(reference)) return null;
  try {
    const raw = await readFile(path.join(dataDir(), reference, 'lead.json'), 'utf8');
    return JSON.parse(raw) as StoredLead;
  } catch {
    return null;
  }
}

async function findByKey(key: string): Promise<StoredLead | null> {
  if (!key) return null;
  try {
    const reference = (await readFile(path.join(dataDir(), '_keys', encodeURIComponent(key)), 'utf8')).trim();
    return loadLead(reference);
  } catch {
    return null;
  }
}

function publicLead(lead: StoredLead) {
  return {
    reference: lead.reference,
    createdAt: lead.createdAt,
    kind: lead.kind,
    status: lead.status,
    notification: lead.notification,
    enquiry: {
      ...lead.enquiry,
    },
    files: lead.files,
  };
}

async function deliver(lead: StoredLead): Promise<StoredLead> {
  if (lead.notification.attempts.length >= MAX_ATTEMPTS && lead.notification.state === 'failed') return lead;
  const attempt = await notify(lead);
  lead.notification.attempts.push(attempt);
  lead.notification.state = attempt.ok ? 'sent' : 'failed';
  await saveLead(lead);
  console.log(JSON.stringify({ reference: lead.reference, notification: lead.notification.state, error: attempt.error || null }));
  return lead;
}

async function acceptLead(rawFields: Record<string, string>, uploads: { filename: string; data: Buffer }[], idempotencyHeader: string) {
  const fields = fieldsFrom(rawFields);
  if (!fields.idempotencyKey) fields.idempotencyKey = idempotencyHeader;
  const validated = validateEnquiry(fields);
  if (!validated.ok) {
    if (validated.spam) return { status: 204, body: null };
    return { status: 400, body: { error: 'Check the form and try again.', fields: validated.errors } };
  }

  const existing = await findByKey(validated.value.idempotencyKey);
  if (existing) return { status: 200, body: { ok: true, reference: existing.reference, replayed: true, notification: existing.notification.state } };

  if (uploads.length > FILE_LIMITS.maxFiles) return { status: 400, body: { error: 'Too many files.' } };
  let total = 0;
  const prepared: { type: string; bytes: Uint8Array; metadata: string }[] = [];
  for (const upload of uploads) {
    total += upload.data.length;
    if (upload.data.length > FILE_LIMITS.maxFileBytes || total > FILE_LIMITS.maxTotalBytes) {
      return { status: 413, body: { error: 'A file is over the limit. Email the photographs instead.' } };
    }
    const ready = prepareUpload(new Uint8Array(upload.data));
    if (ready.metadata === 'rejected') return { status: 400, body: { error: 'Use a JPEG, PNG, WebP, HEIC or PDF.' } };
    prepared.push(ready);
  }

  const reference = makeReference();
  const lead: StoredLead = {
    reference,
    idempotencyKey: validated.value.idempotencyKey,
    createdAt: new Date().toISOString(),
    kind: validated.value.kind,
    status: 'new',
    notification: { state: 'pending', attempts: [] },
    enquiry: validated.value,
    files: [],
  };
  const dir = path.join(dataDir(), reference, 'files');
  await mkdir(dir, { recursive: true });
  for (let i = 0; i < prepared.length; i += 1) {
    const item = prepared[i];
    const name = `${String(i + 1).padStart(2, '0')}.${extensionFor(item.type as 'jpeg')}`;
    await writeFile(path.join(dir, name), item.bytes);
    lead.files.push({ name, type: item.type, bytes: item.bytes.byteLength, metadata: item.metadata });
  }
  await saveLead(lead);
  await deliver(lead);
  return {
    status: 201,
    body: {
      ok: true,
      reference: lead.reference,
      kind: lead.kind,
      notification: lead.notification.state,
      received: true,
    },
  };
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (applyCors(req, res)) return;
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const ip = req.socket.remoteAddress || 'unknown';

  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, { ok: true, storage: 'file' });
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/api/leads' || url.pathname.startsWith('/api/leads/'))) {
    if (!authorised(req)) {
      json(res, staffToken() ? 401 : 503, { error: 'Not available.' });
      return;
    }
    if (url.pathname === '/api/leads') {
      const indexPath = dataDir();
      const { readdir } = await import('node:fs/promises');
      let names: string[] = [];
      try {
        names = await readdir(indexPath);
      } catch {
        names = [];
      }
      const leads = [];
      for (const name of names) {
        if (!name.startsWith('MW-')) continue;
        const lead = await loadLead(name);
        if (lead) leads.push({ reference: lead.reference, kind: lead.kind, createdAt: lead.createdAt, notification: lead.notification.state, status: lead.status });
      }
      json(res, 200, { leads });
      return;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    const reference = parts[2] || '';
    const lead = await loadLead(reference);
    if (!lead) {
      json(res, 404, { error: 'Not found.' });
      return;
    }
    if (parts[3] === 'files' && parts[4]) {
      const safe = path.basename(parts[4]);
      if (!lead.files.some((file) => file.name === safe)) {
        json(res, 404, { error: 'Not found.' });
        return;
      }
      const bytes = await readFile(path.join(dataDir(), lead.reference, 'files', safe));
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
      res.end(bytes);
      return;
    }
    json(res, 200, publicLead(lead));
    return;
  }

  if (req.method === 'POST' && /^\/api\/leads\/MW-[A-Z0-9]+\/notify$/.test(url.pathname)) {
    if (!authorised(req)) {
      json(res, staffToken() ? 401 : 503, { error: 'Not available.' });
      return;
    }
    const reference = url.pathname.split('/')[3];
    const lead = await loadLead(reference);
    if (!lead) {
      json(res, 404, { error: 'Not found.' });
      return;
    }
    if (lead.notification.state === 'sent') {
      json(res, 200, { ok: true, reference, notification: 'sent' });
      return;
    }
    if (lead.notification.attempts.length >= MAX_ATTEMPTS) {
      json(res, 409, { error: 'Notification needs a person to look at it.', reference, notification: lead.notification.state });
      return;
    }
    await deliver(lead);
    json(res, 200, { ok: true, reference, notification: lead.notification.state });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/leads') {
    if (!originAllowed(req)) {
      json(res, 403, { error: 'This form could not be sent from that address.' });
      return;
    }
    if (rateLimited(ip)) {
      json(res, 429, { error: 'Too many enquiries from this network just now. Email info@mrwallcover.com.' });
      return;
    }
    const type = String(req.headers['content-type'] || '');
    let raw: Record<string, string> = {};
    let files: { filename: string; data: Buffer }[] = [];
    try {
      const body = await readBody(req, FILE_LIMITS.maxTotalBytes + 1024 * 1024);
      if (type.includes('multipart/form-data')) {
        const parsed = parseMultipart(body, type);
        raw = parsed.fields;
        files = parsed.files;
      } else if (type.includes('application/json')) {
        raw = JSON.parse(body.toString('utf8')) as Record<string, string>;
      } else {
        json(res, 415, { error: 'Send the enquiry as a form.' });
        return;
      }
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'too_large';
      json(res, tooLarge ? 413 : 400, { error: tooLarge ? 'The upload is too large.' : 'The enquiry could not be read.' });
      return;
    }
    const headerKey = String(req.headers['idempotency-key'] || '');
    const result = await acceptLead(raw, files, headerKey);
    if (result.status === 204) {
      res.writeHead(204);
      res.end();
      return;
    }
    json(res, result.status, result.body);
    return;
  }

  json(res, 404, { error: 'Not found.' });
}

export function startLeadServer(port = 0): Promise<{ port: number; close: () => Promise<void> }> {
  if (!enabled()) {
    return Promise.reject(new Error('LEAD_API_ENABLED is not 1. The API stays off until you start it on purpose.'));
  }
  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.log(JSON.stringify({ error: 'lead_api_failed', detail: error instanceof Error ? error.name : 'error' }));
      if (!res.headersSent) json(res, 500, { error: 'The enquiry was not stored. Nothing was discarded on purpose. Email info@mrwallcover.com.' });
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const listening = typeof address === 'object' && address ? address.port : port;
      resolve({
        port: listening,
        close: () => new Promise((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}

const calledDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (calledDirectly) {
  const port = Number(process.env.PORT || 8787);
  startLeadServer(port).then(({ port: listening }) => {
    console.log(JSON.stringify({ leadApi: true, port: listening, dir: dataDir(), notifier: process.env.LEAD_NOTIFIER || 'unconfigured' }));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
