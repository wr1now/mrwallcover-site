/**
 * Public site configuration.
 * Change the email address here. It is the address shown on the site,
 * used as the form fallback, and published in JSON-LD.
 *
 * Award name will be added later. Until then the public line is only
 * "Award-winning", with the year. Do not invent a title.
 */

export const SITE_URL = 'https://www.mrwallcover.com';
export const BRAND_NAME = 'Mr Wallcover';
export const FOUNDER_NAME = 'Dorin Burcus';
export const PUBLIC_EMAIL = 'info@mrwallcover.com';

/** Coverage line used across the site and in schema descriptions. */
export const COVERAGE = 'London and the surrounding areas; UK-wide for selected projects';

export const INSTAGRAM_URL = 'https://www.instagram.com/mrwallcover/';
export const INSTAGRAM_HANDLE = '@mrwallcover';

export const AWARD = {
  label: 'Award-winning',
  year: 2021,
} as const;

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
 * Cookie-free analytics placeholder.
 * Leave empty and the site loads no analytics script and sets no cookies.
 * Set PUBLIC_ANALYTICS_SRC to a cookie-free provider such as Plausible,
 * Fathom or Cloudflare Web Analytics when you want numbers.
 */
export const ANALYTICS_SRC: string = import.meta.env.PUBLIC_ANALYTICS_SRC || '';

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
