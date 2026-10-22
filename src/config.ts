/**
 * Public site configuration.
 * Business facts (brand, founder, email, coverage, profiles, the one-line
 * description) live in src/data/facts.json and are re-exported here.
 *
 * The phone number is not in the repository. It is read from the SITE_PHONE
 * environment variable at build time; see src/lib/phone.ts.
 *
 * The one award line is built from facts.award in src/data/facts.json, with
 * its full name and organiser (rule of 9 October 2026: never an unnamed award).
 * Do not add one here.
 */
import facts from './data/facts.json';
import { resolveBookingUrl } from './lib/booking';

export const SITE_URL = 'https://www.mrwallcover.com';
export const BRAND_NAME: string = facts.brand;
export const FOUNDER_NAME: string = facts.founder.name;
export const PUBLIC_EMAIL: string = facts.email;

/** Coverage line used across the site and in schema descriptions. */
export const COVERAGE: string = facts.coverage;

const instagram = facts.profiles.find((profile) => profile.name === 'Instagram');
export const INSTAGRAM_URL: string = instagram?.url ?? '';
export const INSTAGRAM_HANDLE: string = instagram?.handle ?? '';

export type FormProvider = 'mailto' | 'netlify' | 'formspree' | 'formsubmit';

const providerFromFile: FormProvider = 'formsubmit';
const endpointFromFile = 'https://formsubmit.co/569da49cb2508b0d1d180f0ca82da262';

function resolveProvider(): FormProvider {
  const fromEnv = import.meta.env.PUBLIC_FORM_PROVIDER;
  if (fromEnv === 'mailto' || fromEnv === 'netlify' || fromEnv === 'formspree' || fromEnv === 'formsubmit') return fromEnv;
  if (import.meta.env.PUBLIC_FORM_ENDPOINT) return 'formspree';
  return providerFromFile;
}

/**
 * FormSubmit (formsubmit.co) posts the form to info@ with its own captcha.
 * Uses FormSubmit's random alias (activated 9 Oct 2026) so the address never appears in the code.
 */
export const FORM_PROVIDER: FormProvider = resolveProvider();
export const FORM_ENDPOINT: string = import.meta.env.PUBLIC_FORM_ENDPOINT || endpointFromFile;

/**
 * "Book a 20-minute call" target: the Google Calendar booking page, supplied by
 * the Website agent. Set it to '' to hide the button; empty means no booking button is rendered anywhere (no dead
 * link). Put the real https:// URL in bookingFromFile. The BOOKING_URL environment
 * variable overrides it for one build (tests and screenshots use a dummy value
 * that is never committed). See src/lib/booking.ts.
 */
// Google Calendar appointment schedule 'Mr Wallcover: 20-minute project call', Mon–Fri 09:00–17:00 UK (supplied 11 Oct 2026).
const bookingFromFile = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ3Aimn0z8hHnmqvg0zrZGV0Zt2PVu8UNOZPnrUJ34DgohlLAwO6xXIPaeH3mr_rE_JeJHr_DzUk';
export const BOOKING_URL: string = resolveBookingUrl(bookingFromFile);
/** Booking hours from that schedule: one source for /contact/, /get-in-touch/ and the "Book a call" hint. */
export const BOOKING_DAYS = 'Mon–Fri, 9am–5pm UK';
export const BOOKING_HOURS = `Calls ${BOOKING_DAYS}.`;
/** The short line under "Book a call": BookCallLink's hint and the thank-you page. */
export const BOOKING_HINT = `20 minutes, ${BOOKING_DAYS}.`;

/** Direct email links on the enquiry path open with this subject. Privacy and AI-reader links keep the bare address. */
export const ENQUIRY_MAILTO = `mailto:${PUBLIC_EMAIL}?subject=Wallcovering%20enquiry`;

/**
 * Cookie-free analytics (Umami, chosen by the owner on 14 Oct 2026).
 * Leave PUBLIC_ANALYTICS_SRC empty and the site loads no analytics script and sets no cookies.
 * To switch it on, set PUBLIC_ANALYTICS_SRC to the Umami script URL (https://cloud.umami.is/script.js)
 * and PUBLIC_ANALYTICS_WEBSITE_ID to the website ID from the Umami account. The privacy notice
 * switches to its analytics wording in the same build.
 */
export const ANALYTICS_SRC: string = import.meta.env.PUBLIC_ANALYTICS_SRC || '';
export const ANALYTICS_WEBSITE_ID: string = import.meta.env.PUBLIC_ANALYTICS_WEBSITE_ID || '';
/** Only these events reach the analytics tool. Each carries counts and choices, never measurements or contact details. */
export const ANALYTICS_EVENTS = ['calculator_complete', 'measurements_click', 'check_click'] as const;

/**
 * Optional private enquiry API. Empty on the static GitHub Pages build.
 * Set PUBLIC_LEAD_API to the origin of `npm run lead-api` (no trailing slash)
 * only after that process is actually running. See docs/architecture.md.
 */
export const LEAD_API_URL: string = import.meta.env.PUBLIC_LEAD_API || '';

/**
 * Google Search Console HTML-tag verification (URL-prefix property).
 * Paste only the content value Google gives you, e.g. 'AbC123...'.
 * Empty means no tag is printed. Domain (DNS TXT) verification needs no change here.
 */
export const GOOGLE_SITE_VERIFICATION: string =
  import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION || '98zhpiyda4qDA6fYcKJ-zC6pItC6-LZKqqEugO5-fKo';
