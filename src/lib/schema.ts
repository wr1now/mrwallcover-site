import { SITE_URL } from '../config';
import areasJson from '../content/areas.json';
import specialismsJson from '../content/specialisms.json';
import facts from '../data/facts.json';
import altsJson from '../content/alts.json';
import creditedMediaJson from '../content/credited-media.json';
import sizesJson from '../content/sizes.json';
import rights from '../data/image-rights.json';
import type { FaqItem } from './types';

const BRAND_NAME = facts.brand;

/** The one award, exactly as the trophy names it (src/data/facts.json). */
export const AWARD_TEXT = `${facts.award.line}: ${facts.award.name.replace(/, 2021$/, '')}, ${facts.award.organiser}`;
export const AWARD_SCHEMA = `${facts.award.name}, ${facts.award.organiser}`;
export const AWARD_URL = facts.award.url;
/** On-site links to the named line open About, where the archived source sits beside it. */
export const RECOGNITION_HREF = '/about/#recognition';
const PUBLIC_EMAIL = facts.email;

export const BUSINESS_ID = `${SITE_URL}/#business`;
export const LOGO_URL = `${SITE_URL}/logo-512.png`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
/** The founder's Person node. Lives on the About page; referenced from the business and every case-study Article. */
export const FOUNDER_ID = `${SITE_URL}${facts.founder.path}#${facts.founder.fragment}`;
export const FOUNDER_URL = `${SITE_URL}${facts.founder.path}`;

/**
 * The fact-sheet coverage line is written "<local>; <national>", today
 * "London and the surrounding areas; UK-wide for selected projects". The two
 * halves become the AdministrativeArea name and the Country description, so
 * the schema carries the same wording as /for-ai/, llms.txt and facts.json.
 */
const coverageParts = facts.coverage.split('; ');
if (coverageParts.length !== 2 || coverageParts.some((part) => !part.trim())) {
  throw new Error(`facts.coverage must read "<local area>; <national reach>", got "${facts.coverage}"`);
}
const [COVERAGE_LOCAL, COVERAGE_NATIONAL] = coverageParts;

/**
 * Coverage, matching what the site shows: the fact-sheet line split as
 * above, and one Place per area page in src/content/areas.json, named
 * exactly as areas.json names the area and as its page heading reads
 * ("the City of London", "the Cotswolds"), never a rewritten string.
 * No invented offices. The phone number is deliberately not published in
 * schema (Dorin's request: no openly visible number). Add telephone back
 * here if that changes.
 */
export const AREAS_SERVED = [
  { '@type': 'City', name: facts.place },
  { '@type': 'AdministrativeArea', name: COVERAGE_LOCAL },
  { '@type': 'Country', name: 'United Kingdom', description: COVERAGE_NATIONAL },
  ...(areasJson.items as { slug: string; name: string }[]).map((area) => ({
    '@type': 'Place',
    name: area.name,
    url: `${SITE_URL}/areas/${area.slug}/`,
  })),
];

/**
 * Who made each photograph, for the schema.org ImageObject fields Google reads as
 * image metadata: creator, copyrightNotice, license and acquireLicensePage.
 *
 * Driven by the data, never by guesswork:
 * - A credited photograph carries a credit in its manifestNote
 *   (src/content/alts.json, src/content/credited-media.json), the same credit the
 *   page prints beside it: "credit Photograph: House of Hackney", "credit Image:
 *   Raffles London at The OWO (official)", "credit Photograph: The wub / Wikimedia
 *   Commons (CC BY-SA 4.0)". The creator and copyright notice name that holder
 *   exactly. A Creative Commons image keeps its own licence URL from the note.
 * - src/data/image-rights.json records what the notes cannot: Dorin's own iPhone
 *   photographs (creator Person Dorin Burcus), sets whose photographer is named
 *   only in docs/asset-rights.md (JRH), sets whose maker is not recorded, and
 *   site files outside the media library (/og.jpg, /media/atelier/).
 * - A manifestNote that starts "own" (own photo, own photograph, own site photo)
 *   is ours: creator Mr Wallcover, "© Mr Wallcover".
 *
 * Anything else throws, so the build fails rather than publish an image without
 * a known maker, and a credited image can never be given the Mr Wallcover creator.
 *
 * creditText (Google's fifth image-licence field) always matches the creator:
 * "Mr Wallcover" for our photographs, "Dorin Burcus / Mr Wallcover" for Dorin's own,
 * "Photo: <holder exactly as credited>" for a credited photograph (a Wikimedia
 * Commons image keeps its author and licence, e.g. "Photo: The wub / Wikimedia
 * Commons (CC BY-SA 4.0)"), "Photo: JRH" for the SCP set, and the neutral
 * "Photographer not recorded" where the record names no maker. Never ours unless ours.
 */

type Creator = { '@type': 'Person' | 'Organization'; name: string; url?: string; '@id'?: string };
export interface ImageRights {
  creator: Creator;
  copyrightNotice: string;
  license: string;
  acquireLicensePage: string;
  creditText: string;
  /** Why: which record decided it. */
  basis: 'credit' | 'own' | 'dorin' | 'photographer' | 'unrecorded' | 'file';
}

export const IMAGE_USE_URL = new URL(rights.imageUsePath, SITE_URL).href;
/** Our own creator node carries the business @id, so Google reads it as the same Organization as the site's business node (logo, email, sameAs). */
const OWNER: Creator = { '@type': 'Organization', '@id': BUSINESS_ID, name: rights.owner.name, url: rights.owner.url };
const DORIN: Creator = { '@type': 'Person', '@id': `${SITE_URL}${facts.founder.path}#${facts.founder.fragment}`, name: facts.founder.name, url: `${SITE_URL}${facts.founder.path}` };

type Entry = { manifestNote?: string; src?: string; jpg?: string; thumb?: string; thumbJpg?: string };
const notes: Record<string, string> = {};
for (const [id, entry] of Object.entries({ ...(altsJson as Record<string, Entry>), ...(creditedMediaJson as Record<string, Entry>) })) {
  if (entry && typeof entry === 'object' && entry.manifestNote) notes[id] = entry.manifestNote;
}

/** Every URL path the media library can produce for an image, back to its id. */
const byPath = new Map<string, string>();
for (const [id, entry] of Object.entries({ ...(sizesJson as Record<string, Entry>), ...(creditedMediaJson as Record<string, Entry>) })) {
  for (const key of ['src', 'jpg', 'thumb', 'thumbJpg'] as const) if (entry?.[key]) byPath.set(entry[key] as string, id);
}
const ids = new Set([...byPath.values()]);

export function mediaIdFor(url: string): string | undefined {
  const path = new URL(url, SITE_URL).pathname;
  const exact = byPath.get(path);
  if (exact) return exact;
  // Responsive variants: /media/img/r/<id>-<width>.<ext>
  const m = path.match(/^\/media\/img\/(?:r\/|thumbs\/)?([a-z0-9-]+?)(?:-(?:\d+|preview))?\.(?:jpe?g|webp|avif|png)$/);
  return m && ids.has(m[1]) ? m[1] : undefined;
}

const SOURCE = /\bsource\s+(https?:\/\/[^\s;]+)/i;
const CREDIT = /credit\s+(?:Photography|Photograph|Photo|Image|Images)\s*:\s*([^;]+)/i;
const LICENCE = /licen[cs]e\s+CC\s+[A-Z-]+\s+[\d.]+\s+(https?:\/\/[^\s;]+)/i;
const TERMS = /(?:^|;\s*)terms\s+(https?:\/\/[^\s;]+)/i;
const OWNER_URL = /(?:^|;\s*)owner\s+(https?:\/\/[^\s;]+)/i;

/** The credit holder as the record writes it, e.g. "The wub / Wikimedia Commons (CC BY-SA 4.0)". */
export function creditFor(id: string): string | undefined {
  return notes[id]?.match(CREDIT)?.[1].trim().replace(/\.$/, '');
}

function fromCredit(holder: string, note: string): ImageRights {
  const commons = /Wikimedia Commons/i.test(holder);
  const name = holder.replace(/\s*\/\s*Wikimedia Commons.*$/i, '').replace(/\s*\(official\)\s*$/i, '').trim();
  const licence = note.match(LICENCE)?.[1];
  // An organisation's url is the site its credited source page lives on (e.g. houseofhackney.com,
  // stories.hilton.com), only when the record gives that source. A Wikimedia author has no recorded page.
  // An official hotel or brand photograph may record the owner's own page ("owner <url>"), which wins.
  const source = note.match(SOURCE)?.[1];
  const ownerUrl = note.match(OWNER_URL)?.[1];
  const url = commons ? undefined : ownerUrl ?? (source ? new URL(source).origin + '/' : undefined);
  // It may also record the owner's terms page ("terms <url>"): that page is where its use is
  // governed, so it is both the license and where to ask.
  const terms = note.match(TERMS)?.[1];
  return {
    creator: { '@type': commons ? 'Person' : 'Organization', name, ...(url ? { url } : {}) },
    copyrightNotice: `© ${name}`,
    license: licence ?? terms ?? IMAGE_USE_URL,
    acquireLicensePage: terms ?? IMAGE_USE_URL,
    creditText: `Photo: ${holder.replace(/\s*\(official\)\s*$/i, '')}`,
    basis: 'credit',
  };
}

const ours = (creator: Creator, basis: ImageRights['basis']): ImageRights => ({
  creator,
  copyrightNotice: rights.owner.copyrightNotice,
  license: IMAGE_USE_URL,
  acquireLicensePage: IMAGE_USE_URL,
  creditText: creator === DORIN ? `${facts.founder.name} / ${rights.owner.name}` : rights.owner.name,
  basis,
});

const matches = (patterns: string[], id: string) => patterns.some((p) => new RegExp(p).test(id));

export function imageRights(url: string): ImageRights {
  const path = new URL(url, SITE_URL).pathname;
  const id = mediaIdFor(url);
  if (!id) {
    const file = rights.files.find((f) => path.startsWith(f.prefix));
    if (file) return ours(OWNER, 'file');
    throw new Error(`image-rights: ${path} is not in the media library or src/data/image-rights.json, so its maker is unknown`);
  }
  const note = notes[id] ?? '';
  const holder = creditFor(id);
  let result: ImageRights;
  if (holder) result = fromCredit(holder, note);
  else {
    const named = rights.photographers.find((p) => new RegExp(p.pattern).test(id));
    if (named) {
      result = { creator: named.creator as Creator, copyrightNotice: named.copyrightNotice, license: IMAGE_USE_URL, acquireLicensePage: IMAGE_USE_URL, creditText: `Photo: ${named.creator.name}`, basis: 'photographer' };
    } else if (matches(rights.unrecorded.patterns, id)) {
      result = { creator: rights.unrecorded.creator as Creator, copyrightNotice: rights.unrecorded.copyrightNotice, license: IMAGE_USE_URL, acquireLicensePage: IMAGE_USE_URL, creditText: rights.unrecorded.creditText, basis: 'unrecorded' };
    } else if (/^own\b/i.test(note)) {
      result = ours(matches(rights.dorin.patterns, id) ? DORIN : OWNER, matches(rights.dorin.patterns, id) ? 'dorin' : 'own');
    } else {
      throw new Error(`image-rights: ${id} has no credit, is not marked "own" and is not listed in src/data/image-rights.json (note: "${note}")`);
    }
  }
  // Guard: a credited image (or one whose maker is someone else) may never be claimed as ours.
  const claimsOurs = result.creator.name === rights.owner.name || result.creator.name === facts.founder.name || result.copyrightNotice === rights.owner.copyrightNotice || result.creditText.includes(rights.owner.name);
  if (claimsOurs && (holder || result.basis === 'photographer' || result.basis === 'unrecorded')) {
    throw new Error(`image-rights: ${id} is credited to "${holder ?? result.creator.name}" but would be given the Mr Wallcover creator`);
  }
  return result;
}

/**
 * The one ImageObject helper. Every photograph the schema describes gets all five
 * Google image-licence fields (creator, creditText, copyrightNotice, license,
 * acquireLicensePage) from imageRights() above, plus contentUrl (Google's preferred
 * image URL; url is kept as before). A plain
 * caption such as "Before" passed as `credit` is not a credit and adds nothing. A
 * credit printed on the page must match the record, so the two cannot drift apart.
 */
export function imageObject(url: string, credit?: string | null) {
  const r = imageRights(url);
  const printed = credit && /\b(?:Photography|Photograph|Photo|Image|Images)\s*:/i.test(credit);
  if (printed && r.basis !== 'credit') {
    throw new Error(`image-rights: ${url} is printed with a credit ("${credit}") but its record has none; add the credit to its manifestNote`);
  }
  const node = {
    '@type': 'ImageObject',
    url,
    contentUrl: url,
    creditText: r.creditText,
    creator: r.creator,
    copyrightNotice: r.copyrightNotice,
    license: r.license,
    acquireLicensePage: r.acquireLicensePage,
  };
  for (const key of ['creator', 'creditText', 'copyrightNotice', 'license', 'acquireLicensePage'] as const) {
    if (!node[key]) throw new Error(`ImageObject for ${url} is missing ${key}`);
  }
  if ((node.creator['@type'] !== 'Person' && node.creator['@type'] !== 'Organization') || !node.creator.name?.trim()) {
    throw new Error(`ImageObject for ${url} needs a creator with @type Person or Organization and a name`);
  }
  return node;
}

/**
 * The services the business offers, one per built /services/<slug>/ page.
 * Names, @ids and service types match the Service node each page emits.
 * No prices: the site publishes none.
 */
export function offerCatalogNode() {
  return {
    '@type': 'OfferCatalog',
    name: `${BRAND_NAME} services`,
    itemListElement: (specialismsJson.items as { slug: string; name: string; serviceType?: string }[]).map((item) => {
      const url = `${SITE_URL}/services/${item.slug}/`;
      return {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          '@id': `${url}#service`,
          name: item.name,
          // Same fallback as src/pages/services/[slug].astro, so the catalogue and the page agree.
          serviceType: item.serviceType ?? item.name,
          url,
          provider: { '@id': BUSINESS_ID },
        },
      };
    }),
  };
}

export function businessNode() {
  return {
    '@type': ['HomeAndConstructionBusiness', 'ProfessionalService'],
    '@id': BUSINESS_ID,
    name: BRAND_NAME,
    url: SITE_URL,
    image: `${SITE_URL}/og.jpg`,
    // 512 x 512 render of the site's logo mark (src/pages/logo-512.png.ts); Google asks for 112 px or more.
    logo: LOGO_URL,
    description: facts.description,
    email: PUBLIC_EMAIL,
    founder: { '@id': FOUNDER_ID },
    award: AWARD_SCHEMA,
    // Locality, region and country only (src/data/facts.json). Never a street, postcode or the private address.
    address: {
      '@type': 'PostalAddress',
      addressLocality: facts.place,
      addressRegion: facts.region,
      addressCountry: 'GB',
    },
    areaServed: AREAS_SERVED,
    slogan:
      'Specialist wallcovering installation for hotels and prime homes: survey, management, supply, installation and aftercare.',
    knowsAbout: [
      'Wallpaper installation',
      'Wallcovering installation for hotels',
      'Grasscloth installation',
      'Hand-painted wallcoverings',
      'Acoustic wallcoverings',
      'Silk wallcovering installation',
      'Fabric walling',
      'Wallpaper mural installation',
      'Contract vinyl wallcoverings',
      'Wallcoverings on joinery',
      'Bespoke wallcovering panels',
      'Architectural and furniture film wrapping',
      'Window film installation',
    ],
    /** Only profiles that exist. Add each new one to src/data/facts.json as it goes live. */
    sameAs: facts.profiles.map((profile) => profile.url),
    hasOfferCatalog: offerCatalogNode(),
    contactPoint: {
      '@type': 'ContactPoint',
      email: PUBLIC_EMAIL,
      url: `${SITE_URL}/contact/`,
      // A value Google documents for contactType; quotation requests are sales enquiries.
      contactType: 'sales',
      areaServed: AREAS_SERVED,
      availableLanguage: ['English'],
    },
  };
}

export function serviceNodes(
  items: { title: string; paragraphs: string[] }[],
) {
  return items.map((item) => ({
    '@type': 'Service',
    name: item.title,
    description: item.paragraphs[0],
    serviceType: item.title,
    areaServed: AREAS_SERVED,
    provider: { '@id': BUSINESS_ID },
  }));
}

export function faqNode(items: FaqItem[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.paragraphs.join(' '),
      },
    })),
  };
}

export function breadcrumbNode(items: { name: string; href: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.href, SITE_URL).href,
    })),
  };
}

export function jsonLd(nodes: object[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': nodes,
  }).replace(/</g, '\\u003c');
}

/** Dorin Burcus as a Person node, anchored on the About page. */
export function founderNode() {
  return {
    '@type': 'Person',
    '@id': FOUNDER_ID,
    name: facts.founder.name,
    jobTitle: facts.founder.jobTitle,
    url: FOUNDER_URL,
    image: imageObject(`${SITE_URL}${facts.founder.image}`),
    worksFor: { '@id': BUSINESS_ID },
  };
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: BRAND_NAME,
    inLanguage: 'en-GB',
    publisher: { '@id': BUSINESS_ID },
  };
}

export function webPageNode(opts: { url: string; name: string; description: string; image?: string; imageCredit?: string | null; type?: string }) {
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': `${opts.url}#webpage`,
    url: opts.url,
    name: opts.name,
    description: opts.description,
    inLanguage: 'en-GB',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': BUSINESS_ID },
    ...(opts.image ? { primaryImageOfPage: imageObject(opts.image, opts.imageCredit) } : {}),
  };
}

export function singleServiceNode(opts: {
  name: string;
  description: string;
  url: string;
  areaName?: string;
  serviceType?: string;
}) {
  return {
    '@type': 'Service',
    '@id': `${opts.url}#service`,
    name: opts.name,
    description: opts.description,
    serviceType: opts.serviceType ?? 'Wallcovering installation',
    url: opts.url,
    areaServed: opts.areaName ? { '@type': 'Place', name: opts.areaName } : AREAS_SERVED,
    provider: { '@id': BUSINESS_ID },
  };
}

/** A completed commission, described only with facts already on the page. */
export function projectNode(opts: { url: string; name: string; description: string; location: string; image?: string; dates?: string | null }) {
  return {
    '@type': 'CreativeWork',
    '@id': `${opts.url}#project`,
    name: opts.name,
    description: opts.description,
    url: opts.url,
    creator: { '@id': BUSINESS_ID },
    locationCreated: { '@type': 'Place', name: opts.location },
    ...(opts.dates ? { temporalCoverage: opts.dates.replace('–', '/') } : {}),
    ...(opts.image ? { image: opts.image } : {}),
  };
}

/**
 * An Article's publisher: the business node by @id, with its type, name, url and logo
 * repeated inline so a reader that does not follow @id still sees a complete publisher.
 */
function publisherRef() {
  return { '@type': 'Organization', '@id': BUSINESS_ID, name: BRAND_NAME, url: SITE_URL, logo: LOGO_URL };
}

/**
 * Advice-guide Article. The founder's Person node is the author; the business
 * is the publisher. Dates come from the guide's frontmatter, never the build.
 */
export function guideArticleNode(opts: { url: string; headline: string; description: string; published: string; updated: string }) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(opts.published) || !iso.test(opts.updated)) {
    throw new Error(`Guide ${opts.url} needs ISO published and updated dates in its frontmatter`);
  }
  return {
    '@type': 'Article',
    '@id': `${opts.url}#article`,
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    mainEntityOfPage: { '@id': `${opts.url}#webpage` },
    inLanguage: 'en-GB',
    datePublished: opts.published,
    dateModified: opts.updated,
    author: { '@type': 'Person', '@id': FOUNDER_ID, name: facts.founder.name, url: FOUNDER_URL },
    publisher: publisherRef(),
    image: [imageObject(`${SITE_URL}/og.jpg`)],
  };
}

/** FAQPage for a page's visible buyer-questions block (src/components/BuyerFaq.astro). Only call it when that block is rendered. */
export function buyerFaqNode(items: { question: string; answer: string }[]) {
  return guideFaqNode(items.map((item) => ({ q: item.question, a: item.answer })));
}

/** FAQPage for a guide's visible question-and-answer block. Only call it when that block is rendered. */
export function guideFaqNode(items: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** Case-study article about a completed commission. Facts only from the page itself. */
export function caseStudyArticleNode(opts: {
  url: string;
  headline: string;
  description: string;
  /** Absolute image URLs with the credit printed beside each on the page, if any. */
  images: { url: string; credit?: string | null }[];
  location: string;
  dates?: string | null;
  mentions?: string[];
  /** ISO dates from the case-study frontmatter (stamped from git by scripts/stamp-case-study-dates.mjs). Required, never the build time. */
  published: string;
  updated: string;
}) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(opts.published) || !iso.test(opts.updated)) {
    throw new Error(`Case study ${opts.url} needs ISO published and updated dates in its frontmatter`);
  }
  return {
    '@type': 'Article',
    '@id': `${opts.url}#article`,
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    mainEntityOfPage: { '@id': `${opts.url}#webpage` },
    inLanguage: 'en-GB',
    datePublished: opts.published,
    dateModified: opts.updated,
    author: { '@type': 'Person', '@id': FOUNDER_ID, name: facts.founder.name, url: FOUNDER_URL },
    publisher: publisherRef(),
    ...(opts.images.length ? { image: opts.images.map((img) => imageObject(img.url, img.credit)) } : {}),
    about: {
      '@type': 'CreativeWork',
      '@id': `${opts.url}#project`,
      name: opts.headline,
      creator: { '@id': BUSINESS_ID },
      locationCreated: { '@type': 'Place', name: opts.location },
      ...(opts.dates ? { temporalCoverage: opts.dates.replace('–', '/') } : {}),
    },
    ...(opts.mentions?.length ? { mentions: opts.mentions.map((name) => ({ '@type': 'Thing', name })) } : {}),
  };
}

/**
 * VideoObject for one of the site's own films (src/content/videos.json).
 * uploadDate is the date the file was first committed to the repository
 * (git log --diff-filter=A), because the MP4s carry no creation_time tag;
 * duration is measured with ffprobe and rounded to the second the caption
 * states. Never the build time, never an invented date.
 */
export function videoNode(film: { id: string; name: string; caption: string; src: string; poster: string; uploadDate: string; duration?: string; width: number; height: number }, pageUrl: string) {
  return {
    '@type': 'VideoObject',
    '@id': `${SITE_URL}${film.src}#video`,
    name: film.name,
    description: film.caption,
    thumbnailUrl: [new URL(film.poster, SITE_URL).href],
    contentUrl: new URL(film.src, SITE_URL).href,
    uploadDate: film.uploadDate,
    ...(film.duration ? { duration: film.duration } : {}),
    width: film.width,
    height: film.height,
    inLanguage: 'en-GB',
    isFamilyFriendly: true,
    publisher: { '@id': BUSINESS_ID },
    creator: { '@id': BUSINESS_ID },
    mainEntityOfPage: pageUrl,
  };
}
