import { SITE_URL } from '../config';
import areasJson from '../content/areas.json';
import specialismsJson from '../content/specialisms.json';
import facts from '../data/facts.json';
import type { FaqItem } from './types';

const BRAND_NAME = facts.brand;
const PUBLIC_EMAIL = facts.email;

export const BUSINESS_ID = `${SITE_URL}/#business`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
/** The founder's Person node. Lives on the About page; referenced from the business and every case-study Article. */
export const FOUNDER_ID = `${SITE_URL}${facts.founder.path}#${facts.founder.fragment}`;
export const FOUNDER_URL = `${SITE_URL}${facts.founder.path}`;

/**
 * Coverage, matching what the site shows: the fact-sheet line
 * ("London and the surrounding areas; UK-wide for selected projects") and
 * one Place per area page in src/content/areas.json. No invented offices.
 * The phone number is deliberately not published in schema (Dorin's request:
 * no openly visible number). Add telephone back here if that changes.
 */
export const AREAS_SERVED = [
  { '@type': 'City', name: facts.place },
  { '@type': 'AdministrativeArea', name: 'Greater London and the surrounding areas' },
  { '@type': 'Country', name: 'United Kingdom', description: 'Selected projects' },
  ...(areasJson.items as { slug: string; name: string }[]).map((area) => ({
    '@type': 'Place',
    name: area.name.replace(/^the /, '').replace(/^./, (c) => c.toUpperCase()),
    url: `${SITE_URL}/areas/${area.slug}/`,
  })),
];

/**
 * An ImageObject for a photograph the site shows, carrying the credit the
 * page prints beside it. Credits are written "Photography: House of Hackney"
 * or "Image: Raffles London at The OWO (official)"; the name after the colon
 * is the credit holder and the copyright notice. A plain caption such as
 * "Before" is not a credit and adds nothing. Our own photographs carry no
 * credit line on the page, so none is invented here.
 */
export function imageObject(url: string, credit?: string | null) {
  const holder = credit?.match(/^(?:Photography|Photograph|Photo|Image|Images)\s*:\s*(.+?)\s*(?:\(official\))?$/i)?.[1];
  return {
    '@type': 'ImageObject',
    url,
    ...(holder ? { creditText: holder, copyrightNotice: holder } : {}),
  };
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
    logo: `${SITE_URL}/apple-touch-icon.png`,
    description: facts.description,
    email: PUBLIC_EMAIL,
    founder: { '@id': FOUNDER_ID },
    address: {
      '@type': 'PostalAddress',
      addressLocality: facts.place,
      addressCountry: 'GB',
    },
    areaServed: AREAS_SERVED,
    slogan:
      'Premium wallcoverings services: surveying, management, supply, install and aftercare.',
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
      'Bespoke wall panels and joinery',
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
      contactType: 'quotations',
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
    publisher: { '@id': BUSINESS_ID },
  };
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
    publisher: { '@id': BUSINESS_ID },
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
