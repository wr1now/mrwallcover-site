import {
  BRAND_NAME,
  FOUNDER_NAME,
  INSTAGRAM_URL,
  PHONE_TEL,
  PUBLIC_EMAIL,
  SITE_URL,
} from '../config';
import type { FaqItem } from './types';

export const BUSINESS_ID = `${SITE_URL}/#business`;

export function businessNode() {
  return {
    '@type': ['HomeAndConstructionBusiness', 'ProfessionalService'],
    '@id': BUSINESS_ID,
    name: BRAND_NAME,
    url: SITE_URL,
    image: `${SITE_URL}/og.jpg`,
    telephone: PHONE_TEL,
    email: PUBLIC_EMAIL,
    founder: {
      '@type': 'Person',
      name: FOUNDER_NAME,
      jobTitle: 'Founder',
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'London',
      addressCountry: 'GB',
    },
    areaServed: [
      { '@type': 'City', name: 'London' },
      { '@type': 'AdministrativeArea', name: 'South East England' },
    ],
    slogan:
      'Premium wallcoverings services: surveying, management, supply, install and aftercare.',
    knowsAbout: [
      'Wallpaper installation',
      'Wallcovering installation for hotels',
      'Grasscloth installation',
      'Hand-painted wallcoverings',
      'Acoustic wallcoverings',
    ],
    sameAs: [INSTAGRAM_URL],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: PHONE_TEL,
      email: PUBLIC_EMAIL,
      contactType: 'quotations',
      areaServed: ['London', 'South East England'],
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
    areaServed: [
      { '@type': 'City', name: 'London' },
      { '@type': 'AdministrativeArea', name: 'South East England' },
    ],
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
