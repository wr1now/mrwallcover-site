import { preferencesFromJSON } from './material-advice.ts';

/**
 * Enquiry validation shared by the browser form and the private lead API.
 * One reliable reply method is required: email or phone, not both.
 */

export const FILE_LIMITS = {
  maxFiles: 8,
  maxFileBytes: 12 * 1024 * 1024,
  maxTotalBytes: 36 * 1024 * 1024,
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ReplyBy = 'email' | 'phone';
export type EnquiryKind = 'enquiry' | 'aftercare';

export interface EnquiryFields {
  kind: string;
  name: string;
  email: string;
  phone: string;
  replyBy: string;
  message: string;
  audience: string;
  intent: string;
  area: string;
  rooms: string;
  wallNotes: string;
  product: string;
  timing: string;
  access: string;
  programme: string;
  materialResponsibility: string;
  specificationNotes: string;
  materialPreferences: string;
  budget: string;
  marketing: boolean;
  shortlist: string;
  honeypot: string;
  idempotencyKey: string;
  projectReference: string;
}

export interface ValidEnquiry {
  kind: EnquiryKind;
  name: string;
  email: string;
  phone: string;
  replyBy: ReplyBy;
  message: string;
  audience: string;
  intent: string;
  area: string;
  rooms: string;
  wallNotes: string;
  product: string;
  timing: string;
  access: string;
  programme: string;
  materialResponsibility: string;
  specificationNotes: string;
  materialPreferences: string;
  budget: string;
  marketing: boolean;
  shortlist: string[];
  idempotencyKey: string;
  projectReference: string;
}

export type EnquiryErrors = Partial<Record<'name' | 'email' | 'phone' | 'replyBy' | 'message' | 'form', string>>;

export const PROFESSIONAL_AUDIENCES = ['designer', 'developer', 'hotel', 'commercial'] as const;
const AUDIENCES = new Set(['', 'homeowner', ...PROFESSIONAL_AUDIENCES]);
const INTENTS = new Set(['', 'install', 'source', 'advice', 'prepare', 'repair', 'aftercare']);

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function emptyEnquiry(partial: Partial<EnquiryFields> = {}): EnquiryFields {
  return {
    kind: 'enquiry',
    name: '',
    email: '',
    phone: '',
    replyBy: '',
    message: '',
    audience: '',
    intent: '',
    area: '',
    rooms: '',
    wallNotes: '',
    product: '',
    timing: '',
    access: '',
    programme: '',
    materialResponsibility: '',
    specificationNotes: '',
    materialPreferences: '',
    budget: '',
    marketing: false,
    shortlist: '',
    honeypot: '',
    idempotencyKey: '',
    projectReference: '',
    ...partial,
  };
}

export function validateEnquiry(input: EnquiryFields): { ok: true; value: ValidEnquiry } | { ok: false; errors: EnquiryErrors; spam?: boolean } {
  if (input.honeypot.trim()) return { ok: false, errors: {}, spam: true };

  const errors: EnquiryErrors = {};
  const name = clip(input.name, 120);
  const email = clip(input.email, 160);
  const phone = clip(input.phone, 40);
  const message = input.message.replace(/\r\n/g, '\n').trim().slice(0, 4000);
  const replyBy = input.replyBy;

  if (name.length < 2) errors.name = 'Enter your name.';
  if (replyBy !== 'email' && replyBy !== 'phone') {
    errors.replyBy = 'Choose email or phone for the reply.';
  }
  if (replyBy === 'email') {
    if (!EMAIL.test(email)) errors.email = 'Enter an email address we can reply to.';
  }
  if (replyBy === 'phone') {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) errors.phone = 'Enter a phone number we can reply to.';
  }
  if (message.length < 8) errors.message = 'Add a short note about the project, or what you need us to look at.';

  const kind: EnquiryKind = input.kind === 'aftercare' ? 'aftercare' : 'enquiry';
  const audience = AUDIENCES.has(input.audience) ? input.audience : '';
  const intent = INTENTS.has(input.intent) ? input.intent : '';
  if (kind === 'enquiry' && !intent && !errors.message) {
    /* intent may be empty on a short note */
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  const shortlist = input.shortlist
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^[a-z0-9-]{2,60}$/.test(item))
    .slice(0, 12);

  const preferences = preferencesFromJSON(input.materialPreferences);
  const professional = PROFESSIONAL_AUDIENCES.some((value) => value === audience);
  return {
    ok: true,
    value: {
      kind,
      name,
      email: replyBy === 'email' ? email : email && EMAIL.test(email) ? email : '',
      phone: replyBy === 'phone' ? phone : '',
      replyBy: replyBy as ReplyBy,
      message,
      audience,
      intent: kind === 'aftercare' ? 'aftercare' : intent,
      area: clip(input.area, 80),
      rooms: clip(input.rooms, 40),
      wallNotes: clip(input.wallNotes, 500),
      product: clip(input.product, 200),
      timing: clip(input.timing, 120),
      access: clip(input.access, 400),
      programme: clip(input.programme, 400),
      materialResponsibility: professional ? clip(input.materialResponsibility, 200) : '',
      specificationNotes: professional ? clip(input.specificationNotes, 1200) : '',
      materialPreferences: kind === 'enquiry' && preferences ? JSON.stringify(preferences) : '',
      budget: clip(input.budget, 80),
      marketing: Boolean(input.marketing),
      shortlist,
      idempotencyKey: clip(input.idempotencyKey, 80),
      projectReference: clip(input.projectReference, 40),
    },
  };
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function makeReference(random?: Uint8Array): string {
  const bytes = random ?? crypto.getRandomValues(new Uint8Array(8));
  let out = 'MW-';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

export function sanitiseEvent(detail: Record<string, unknown>): Record<string, string | number | boolean> {
  const blocked = /name|email|phone|message|postcode|address|photo|file|note/i;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (blocked.test(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string' && value.length <= 48 && !value.includes('@')) out[key] = value;
  }
  return out;
}
