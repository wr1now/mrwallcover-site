/**
 * Click-to-reveal contact details.
 *
 * The phone number is not stored in the repository in any form. It is read
 * from the SITE_PHONE environment variable at build time (a GitHub Actions
 * secret of the same name). When it is set, the pages carry it only as a
 * reversed, base64-encoded payload that the inline script in Base.astro
 * decodes on click. When it is missing, no phone or WhatsApp control is
 * rendered at all and the payload script is not printed.
 *
 * Reversible encoding is not a security boundary; it keeps the number out of
 * plain-text scrapes and search snippets, nothing more.
 */

export interface ContactDetails {
  /** tel: target, E.164 */
  t: string;
  /** Display form: a UK mobile prints with a space after the fifth digit, anything else prints as E.164 */
  d: string;
  /** WhatsApp link */
  w: string;
}

const WHATSAPP_MESSAGE = "Hello, I'd like to ask about wallcovering.";

export function contactDetailsFrom(raw: string | undefined): ContactDetails | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  let e164: string;
  if (trimmed.startsWith('+')) e164 = `+${digits}`;
  else if (digits.startsWith('0')) e164 = `+44${digits.slice(1)}`;
  else e164 = `+${digits}`;
  const national = e164.startsWith('+44') ? `0${e164.slice(3)}` : e164;
  const display =
    national.startsWith('07') && national.length === 11 ? `${national.slice(0, 5)} ${national.slice(5)}` : national;
  return {
    t: e164,
    d: display,
    w: `https://wa.me/${e164.slice(1)}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`,
  };
}

export function contactPayloadFrom(raw: string | undefined): string {
  const details = contactDetailsFrom(raw);
  if (!details) return '';
  return btoa(JSON.stringify(details).split('').reverse().join(''));
}

export const CONTACT_PAYLOAD: string = contactPayloadFrom(process.env.SITE_PHONE);
/** True only when SITE_PHONE was set for this build. Components use it to render, or not render, phone and WhatsApp controls. */
export const phoneAvailable: boolean = CONTACT_PAYLOAD.length > 0;
