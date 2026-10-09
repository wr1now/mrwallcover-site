import { SITE_URL } from '../config';
import factSheet from '../content/fact-sheet.json';
import type { FaqItem } from './types';

export const FOUNDER_ID = `${SITE_URL}/about/#founder`;

export const BUSINESS_ID = `${SITE_URL}/#business`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * Coverage: London and the surrounding areas; UK-wide for selected projects.
 * The phone number is deliberately not published in schema (Dorin's request:
 * no openly visible number). Add telephone back here if that changes.
 */
export const AREAS_SERVED = [
  { '@type': 'City', name: 'London' },
  { '@type': 'AdministrativeArea', name: 'Greater London and the surrounding areas' },
  { '@type': 'Country', name: 'United Kingdom', description: 'Selected projects' },
];

export function businessNode() {
  return {
    '@type': ['HomeAndConstructionBusiness', 'ProfessionalService'],
    '@id': BUSINESS_ID,
    name: factSheet.name,
    url: SITE_URL,
    image: `${SITE_URL}/og.jpg`,
    logo: `${SITE_URL}/apple-touch-icon.png`,
    description: factSheet.oneLine,
    email: factSheet.email,
    founder: { '@id': FOUNDER_ID },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'London',
      addressCountry: 'GB',
    },
    areaServed: AREAS_SERVED,
    slogan: factSheet.oneLine,
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
    sameAs: factSheet.profiles.map((profile) => profile.url),
    contactPoint: {
      '@type': 'ContactPoint',
      email: factSheet.email,
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

export function founderNode() {
  return {
    '@type': 'Person',
    '@id': FOUNDER_ID,
    name: factSheet.founder.name,
    jobTitle: factSheet.founder.jobTitle,
    url: new URL(factSheet.founder.aboutPath, SITE_URL).href,
    worksFor: { '@id': BUSINESS_ID },
  };
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: factSheet.name,
    inLanguage: 'en-GB',
    publisher: { '@id': BUSINESS_ID },
  };
}

export function webPageNode(opts: { url: string; name: string; description: string; image?: string; type?: string }) {
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': `${opts.url}#webpage`,
    url: opts.url,
    name: opts.name,
    description: opts.description,
    inLanguage: 'en-GB',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': BUSINESS_ID },
    ...(opts.image ? { primaryImageOfPage: { '@type': 'ImageObject', url: opts.image } } : {}),
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

/** Case-study article about a completed commission. Facts only from the page itself. */
export function caseStudyArticleNode(opts: {
  url: string;
  headline: string;
  description: string;
  images: string[];
  location: string;
  dates?: string | null;
  mentions?: string[];
  published?: string;
  updated?: string;
}) {
  return {
    '@type': 'Article',
    '@id': `${opts.url}#article`,
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    mainEntityOfPage: { '@id': `${opts.url}#webpage` },
    inLanguage: 'en-GB',
    ...(opts.published ? { datePublished: opts.published } : {}),
    ...(opts.updated ? { dateModified: opts.updated } : {}),
    author: {
      '@type': 'Person',
      '@id': FOUNDER_ID,
      name: factSheet.founder.name,
      url: new URL(factSheet.founder.aboutPath, SITE_URL).href,
    },
    publisher: { '@id': BUSINESS_ID },
    ...(opts.images.length ? { image: opts.images } : {}),
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
