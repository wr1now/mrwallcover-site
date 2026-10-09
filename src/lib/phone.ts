/**
 * Click-to-reveal contact details. The number is not stored in the repository.
 * Set SITE_PHONE at build time (GitHub Actions secret of the same name).
 * When it is missing, the phone and WhatsApp controls are not rendered.
 */

export interface ContactDetails {
  t: string;
  d: string;
  w: string;
}

export function contactDetailsFrom(raw: string | undefined): ContactDetails | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  const e164 = trimmed.startsWith('+') || !digits.startsWith('0') ? `+${digits}` : `+44${digits.slice(1)}`;
  const national = e164.startsWith('+44') ? `0${e164.slice(3)}` : e164;
  const display = national.startsWith('07') && national.length === 11 ? `${national.slice(0, 5)} ${national.slice(5)}` : national;
  const message = "Hello, I'd like to ask about wallcovering.";
  return {
    t: e164,
    d: display,
    w: `https://wa.me/${e164.slice(1)}?text=${encodeURIComponent(message)}`,
  };
}

export function contactPayloadFrom(raw: string | undefined): string {
  const details = contactDetailsFrom(raw);
  if (!details) return '';
  return btoa(JSON.stringify(details).split('').reverse().join(''));
}

export const CONTACT_PAYLOAD = contactPayloadFrom(process.env.SITE_PHONE);
export const phoneAvailable = CONTACT_PAYLOAD.length > 0;
