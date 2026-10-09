import aboutJson from '../content/about.json';
import contactJson from '../content/contact.json';
import aftercareJson from '../content/aftercare.json';
import altsJson from '../content/alts.json';
import faqJson from '../content/faq.json';
import heroJson from '../content/hero.json';
import homeJson from '../content/home.json';
import navigationJson from '../content/navigation.json';
import privacyJson from '../content/privacy.json';
import projectsJson from '../content/projects.json';
import servicesJson from '../content/services.json';
import sizesJson from '../content/sizes.json';
import teamJson from '../content/team.json';
import videosJson from '../content/videos.json';
import type { FaqItem, HeroImage, MediaFile, Project } from './types';

export const home = homeJson;
export const contact = contactJson;
export const about = aboutJson;
export const aftercare = aftercareJson;
export const faq = faqJson;
export const privacy = privacyJson;
export const services = servicesJson;
export const navigation = navigationJson;
export const team = teamJson;

const alts = altsJson as Record<string, { alt: string; manifestNote: string }>;
const sizes = sizesJson as Record<string, MediaFile>;

export const hero = heroJson as HeroImage;

export function altFor(id: string): string {
  const entry = alts[id];
  if (!entry) throw new Error(`Missing alt text for ${id}`);
  return entry.alt;
}

export function media(id: string): MediaFile & { alt: string } {
  const size = sizes[id];
  if (!size) throw new Error(`Missing image sizes for ${id}`);
  return { ...size, alt: altFor(id) };
}

export const projects = projectsJson.items as Project[];

export function projectBySlug(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export function projectHref(slug: string): string {
  return `/projects/${slug}/`;
}

export const videos = videosJson;

export function videoById(id: string) {
  const video = videos.find((item) => item.id === id);
  if (!video) throw new Error(`Missing video ${id}`);
  return { ...video, alt: altFor(video.altKey) };
}

export const faqItems = faq.items as FaqItem[];
