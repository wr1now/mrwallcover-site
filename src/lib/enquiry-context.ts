/** Public enquiry context: explicit choices, never a browsing history or analytics identifier. */
export const ENQUIRY_SERVICES = [
  { value: 'wallcovering', label: 'Wallcovering installation or sourcing' },
  { value: 'architectural-film', label: 'Architectural and furniture film wrapping' },
  { value: 'window-film', label: 'Window film' },
  { value: 'exterior-decorating', label: 'Exterior decorating' },
  { value: 'aftercare', label: 'Care or repair of existing work' },
] as const;
export type EnquiryService = (typeof ENQUIRY_SERVICES)[number]['value'];
export const ENQUIRY_SOURCES = [
  { value: 'google', label: 'Google Search' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'recommendation', label: 'A recommendation' },
  { value: 'returning-client', label: 'We have worked together before' },
  { value: 'professional', label: 'A designer, architect or contractor' },
  { value: 'other', label: 'Somewhere else' },
] as const;
export const INTAKE_SCHEMA_VERSION = 2;
export const EMAIL_MARKETING_VERSION = 'email-updates-2026-10-18';
export const PRIVACY_NOTICE_VERSION = '2026-10-18';
export const EMAIL_MARKETING_TEXT = 'Email me occasional Mr Wallcover project and material updates. Optional; withdraw at any time.';

export const ENQUIRY_TOPICS = [
  {"id": "service:calico-wallpaper-installer", "label": "Calico wallpaper installation", "service": "wallcovering", "path": "/services/calico-wallpaper-installer/"},
  {"id": "service:heritage-listed-buildings", "label": "Heritage and listed-building work", "service": "wallcovering", "path": "/services/heritage-listed-buildings/"},
  {"id": "service:house-of-hackney-wallpaper-installer", "label": "House of Hackney wallpaper installation", "service": "wallcovering", "path": "/services/house-of-hackney-wallpaper-installer/"},
  {"id": "service:timorous-beasties-installer", "label": "Timorous Beasties wallpaper installation", "service": "wallcovering", "path": "/services/timorous-beasties-installer/"},
  {"id": "material:specified-papers", "label": "Specified papers", "service": "wallcovering", "path": "/materials/specified-papers/"},
  {"id": "service:hand-painted-wallpaper-installation", "label": "Hand-painted wallpaper installation", "service": "wallcovering", "path": "/services/hand-painted-wallpaper-installation/"},
  {"id": "service:grasscloth-installation", "label": "Grasscloth installation", "service": "wallcovering", "path": "/services/grasscloth-installation/"},
  {"id": "service:silk-wallcovering-installation", "label": "Silk wallcovering installation", "service": "wallcovering", "path": "/services/silk-wallcovering-installation/"},
  {"id": "service:fabric-walling", "label": "Fabric walling", "service": "wallcovering", "path": "/services/fabric-walling/"},
  {"id": "service:hotel-wallcovering-installation", "label": "Hotel wallcovering installation", "service": "wallcovering", "path": "/services/hotel-wallcovering-installation/"},
  {"id": "service:mural-installation", "label": "Mural installation", "service": "wallcovering", "path": "/services/mural-installation/"},
  {"id": "service:acoustic-wallcovering-installation", "label": "Acoustic wallcovering installation", "service": "wallcovering", "path": "/services/acoustic-wallcovering-installation/"},
  {"id": "service:architectural-film-wrapping", "label": "Architectural & furniture film wrapping", "service": "architectural-film", "path": "/services/architectural-film-wrapping/"},
  {"id": "service:window-film", "label": "Window film installation", "service": "window-film", "path": "/services/window-film/"},
  {"id": "service:joinery-wallcoverings-and-panels", "label": "Joinery wallcoverings & bespoke panels", "service": "wallcovering", "path": "/services/joinery-wallcoverings-and-panels/"},
  {"id": "service:exterior-works", "label": "Exterior works", "service": "exterior-decorating", "path": "/services/exterior-works/"},
  {"id": "service:commercial-wallcovering-installation", "label": "Commercial and showroom wallcovering installation", "service": "wallcovering", "path": "/services/commercial-wallcovering-installation/"},
  {"id": "material:paper-and-non-woven", "label": "Paper and non-woven", "service": "wallcovering", "path": "/materials/paper-and-non-woven/"},
  {"id": "material:grasscloth-and-weaves", "label": "Grasscloth and natural weaves", "service": "wallcovering", "path": "/materials/grasscloth-and-weaves/"},
  {"id": "material:silk-and-textiles", "label": "Silk and textiles", "service": "wallcovering", "path": "/materials/silk-and-textiles/"},
  {"id": "material:hand-painted", "label": "Hand-painted scenic papers", "service": "wallcovering", "path": "/materials/hand-painted/"},
  {"id": "material:murals", "label": "Murals", "service": "wallcovering", "path": "/materials/murals/"},
  {"id": "material:contract-vinyl", "label": "Contract vinyl", "service": "wallcovering", "path": "/materials/contract-vinyl/"},
  {"id": "material:acoustic", "label": "Acoustic wallcoverings", "service": "wallcovering", "path": "/materials/acoustic/"},
  {"id": "professional:designers", "label": "Designers & architects", "service": "wallcovering", "path": "/professionals/designers/"},
  {"id": "professional:developers", "label": "Developers & main contractors", "service": "wallcovering", "path": "/professionals/developers/"},
  {"id": "professional:hotels", "label": "Hotels & operators", "service": "wallcovering", "path": "/professionals/hotels/"},
  {"id": "wallpapering", "label": "Wallpapering", "service": "wallcovering", "path": "/wallpapering/"},
  {"id": "preparation", "label": "Wall preparation", "service": "wallcovering", "path": "/wallpapering/preparation/"},
  {"id": "lining", "label": "Lining and adhesives", "service": "wallcovering", "path": "/wallpapering/lining-and-adhesives/"},
  {"id": "trade", "label": "Trade and main-contractor packages", "service": "wallcovering", "path": "/trade/"},
  {"id": "fit-out", "label": "Fit-out contractor packages", "service": "wallcovering", "path": "/professionals/fit-out-contractors/"},
  {"id": "aftercare", "label": "Care and repairs", "service": "aftercare", "path": "/aftercare/"},
  {"id": "guide:choosing-wallcoverings", "label": "Choosing wallcoverings", "service": "wallcovering", "path": "/advice/choosing-wallcoverings/"},
  {"id": "guide:designer-specification-checklist", "label": "Designer checklist", "service": "wallcovering", "path": "/advice/designer-specification-checklist/"},
  {"id": "guide:developer-wallcovering-package", "label": "Developer package", "service": "wallcovering", "path": "/advice/developer-wallcovering-package/"},
  {"id": "guide:grasscloth-seams-and-variation", "label": "Grasscloth seams and variation", "service": "wallcovering", "path": "/advice/grasscloth-seams-and-variation/"},
  {"id": "guide:hand-painted-murals-set-out", "label": "Hand-painted papers and murals", "service": "wallcovering", "path": "/advice/hand-painted-murals-set-out/"},
  {"id": "guide:hotel-fire-safety-and-compliance", "label": "Hotel fire safety", "service": "wallcovering", "path": "/advice/hotel-fire-safety-and-compliance/"},
  {"id": "guide:hotel-wallcovering-specification", "label": "Hotel wallcoverings", "service": "wallcovering", "path": "/advice/hotel-wallcovering-specification/"},
  {"id": "guide:installation-cost", "label": "Installation cost", "service": "wallcovering", "path": "/advice/installation-cost/"},
  {"id": "guide:papered-ceilings-and-staircases", "label": "Ceilings and staircases", "service": "wallcovering", "path": "/advice/papered-ceilings-and-staircases/"},
  {"id": "guide:set-out-and-pattern-matching", "label": "Set-out and pattern matching", "service": "wallcovering", "path": "/advice/set-out-and-pattern-matching/"},
  {"id": "guide:wall-preparation", "label": "Wall preparation", "service": "wallcovering", "path": "/advice/wall-preparation/"},
] as const;

const allowedService = (value: unknown): EnquiryService | '' => ENQUIRY_SERVICES.find((item) => item.value === value)?.value || '';
export function enquiryContext(input: { service?: unknown; topic?: unknown; topicOrigin?: unknown; sourceDeclared?: unknown }) {
  const service = allowedService(input.service);
  const match = ENQUIRY_TOPICS.find((item) => item.id === input.topic);
  const topic = match && (!service || service === match.service) ? match : undefined;
  return {
    service: service || topic?.service || '',
    topic: topic?.id || '',
    topicOrigin: topic && input.topicOrigin === 'link' ? 'link' : '',
    sourceDeclared: ENQUIRY_SOURCES.find((item) => item.value === input.sourceDeclared)?.value || '',
  };
}
export function enquiryTopicLabel(topic: string): string {
  return ENQUIRY_TOPICS.find((item) => item.id === topic)?.label || '';
}
/** Preserve reviewed intent/audience handoffs; the legacy contractor alias means main-contractor work. */
export function enquiryAudience(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (value === 'contractor') return 'developer';
  return ['', 'homeowner', 'designer', 'developer', 'hotel', 'commercial'].includes(value) ? value : '';
}

/** Add context only to an existing local contact action; never carry arbitrary query data. */
export function enquiryHrefForPage(path: string, href = '/contact/'): string {
  if (!href.startsWith('/contact/') || href.startsWith('//')) return href;
  const url = new URL(href, 'https://www.mrwallcover.com');
  if (url.pathname !== '/contact/') return href;
  const params = new URLSearchParams();
  const intent = url.searchParams.get('intent');
  if (intent && ['install', 'source', 'advice', 'prepare', 'repair', 'aftercare'].includes(intent)) params.set('intent', intent);
  const audience = enquiryAudience(url.searchParams.get('audience'));
  if (audience) params.set('audience', audience);
  if (url.searchParams.get('from') === 'calculator') params.set('from', 'calculator');
  const topic = ENQUIRY_TOPICS.find((item) => item.path === path);
  if (topic) {
    params.set('service', topic.service);
    params.set('topic', topic.id);
  }
  const query = params.toString();
  return `/contact/${query ? `?${query}` : ''}${url.hash === '#enquiry' ? '#enquiry' : ''}`;
}
