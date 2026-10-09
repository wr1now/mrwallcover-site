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
export const PHONE_DISPLAY = '07450 843246';
export const PHONE_TEL = '+447450843246';
export const WHATSAPP_URL =
  'https://wa.me/447450843246?text=Hello%2C%20I%27d%20like%20to%20ask%20about%20wallcovering.';
export const INSTAGRAM_URL = 'https://www.instagram.com/mrwallcover/';
export const INSTAGRAM_HANDLE = '@mrwallcover';

export const AWARD = {
  label: 'Award-winning',
  year: 2021,
} as const;

export type FormProvider = 'mailto' | 'netlify' | 'formspree';

const providerFromFile: FormProvider = 'mailto';
const endpointFromFile = '';

function resolveProvider(): FormProvider {
  const fromEnv = import.meta.env.PUBLIC_FORM_PROVIDER;
  if (fromEnv === 'mailto' || fromEnv === 'netlify' || fromEnv === 'formspree') return fromEnv;
  if (import.meta.env.PUBLIC_FORM_ENDPOINT) return 'formspree';
  return providerFromFile;
}

/** mailto works on GitHub Pages with no extra service. Override for Netlify Forms or Formspree. */
export const FORM_PROVIDER: FormProvider = resolveProvider();
export const FORM_ENDPOINT: string = import.meta.env.PUBLIC_FORM_ENDPOINT || endpointFromFile;

/**
 * Cookie-free analytics placeholder.
 * Leave empty and the site loads no analytics script and sets no cookies.
 * Set PUBLIC_ANALYTICS_SRC to a cookie-free provider such as Plausible,
 * Fathom or Cloudflare Web Analytics when you want numbers.
 */
export const ANALYTICS_SRC: string = import.meta.env.PUBLIC_ANALYTICS_SRC || '';
