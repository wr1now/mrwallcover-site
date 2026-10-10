import aboutJson from '../content/about.json';
import areasJson from '../content/areas.json';
import specialismsJson from '../content/specialisms.json';
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
import creditedMediaJson from '../content/credited-media.json';
import teamJson from '../content/team.json';
import videosJson from '../content/videos.json';
import hotelsJson from '../content/hotels.json';
import materialsJson from '../content/materials.json';
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
export const hotels = hotelsJson.items.filter((item) => item.publish);
export const materials = materialsJson;

/** Credited client/press photographs carry their own sizes, alt and note (scripts/import-credited.mjs). */
const credited = creditedMediaJson as Record<string, MediaFile & { alt: string; manifestNote: string }>;
const alts = { ...altsJson, ...credited } as Record<string, { alt: string; manifestNote: string }>;
const sizes = { ...sizesJson, ...credited } as Record<string, MediaFile>;

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

interface CaseStudyData {
  title: string;
  slug: string;
  replaces: string | null;
  client: string;
  location: string;
  years: string | null;
  role: string;
  wallcoverings: string[];
  standfirst: string;
  hero: string | null;
  gallery: { id: string; credit: string | null }[];
  modest?: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  group?: string | null;
  /** Draft case studies stay in the repo for review and are never built or listed. */
  draft?: boolean;
  /** Interior photographs are not in the repo. The page shows a labelled placeholder. */
  awaitingPhotos?: boolean;
  /** ISO date the page first entered the repository. Stamped by scripts/stamp-case-study-dates.mjs, never by the build. */
  published: string;
  /** ISO date of the last change to the file. Stamped by the same script. */
  updated: string;
}

type CaseStudyModule = { frontmatter: CaseStudyData; Content: any };

const caseStudyModules = import.meta.glob<CaseStudyModule>('../content/case-studies/*.md', { eager: true });

/**
 * Display order for case studies. trematon-castle is reserved: it is published
 * automatically as soon as src/content/case-studies/trematon-castle.md exists.
 */
const CASE_STUDY_ORDER = [
  'browns-hotel-mayfair',
  'raffles-london-the-owo',
  'four-seasons-ten-trinity-square',
  'trematon-castle',
  'old-bailey-hotel',
  'doubletree-west-end',
  'doubletree-victoria',
  'biltmore-mayfair',
  'house-of-hackney-st-michaels',
  'penny-morrison-showroom',
  'pimlico-st-georges-square',
  'inverness-terrace',
  'north-london-residence',
  'calico-ahluwalia-estuary-rosewood',
  'calico-beverly-1975-cadence',
  'calico-lee-broom-overture',
  'hilton-garden-inn-silverstone',
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
for (const mod of Object.values(caseStudyModules)) {
  const { slug, published, updated } = mod.frontmatter;
  if (!ISO_DATE.test(published ?? '') || !ISO_DATE.test(updated ?? '')) {
    throw new Error(`Case study ${slug} lacks ISO published/updated dates. Run: node scripts/stamp-case-study-dates.mjs`);
  }
}

export const caseStudies = Object.values(caseStudyModules)
  .filter((mod) => !mod.frontmatter.draft)
  .sort(
    (a, b) =>
      (CASE_STUDY_ORDER.indexOf(a.frontmatter.slug) + 1 || 99) - (CASE_STUDY_ORDER.indexOf(b.frontmatter.slug) + 1 || 99),
  );

/**
 * Editorial pages (maker installer pages, the trade page, the cost guide, the
 * reviews page) in src/content/pages/*.md. Same draft rule as case studies:
 * `"draft": true` keeps a page in the repo for review and out of the build,
 * the sitemap, llms.txt and every link.
 */
export interface EditorialPageData {
  /** Site path the page is served at, with leading and trailing slash. */
  path: string;
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  heading: string;
  lede: string;
  /** Breadcrumb parent, e.g. Services or Advice. */
  parent: { name: string; href: string };
  /** Case-study slugs this page may cite. */
  projects: string[];
  faq: FaqItem[];
  draft?: boolean;
}

type EditorialPageModule = { frontmatter: EditorialPageData; Content: any };

const editorialModules = import.meta.glob<EditorialPageModule>('../content/pages/*.md', { eager: true });

for (const mod of Object.values(editorialModules)) {
  const { path, title } = mod.frontmatter;
  if (!/^\/[a-z0-9-]+(\/[a-z0-9-]+)*\/$/.test(path ?? '')) throw new Error(`Editorial page "${title}" needs a path like /trade/ or /services/x/`);
}

export const editorialPages = Object.values(editorialModules).filter((mod) => !mod.frontmatter.draft);

export function caseStudyBySlug(slug: string): CaseStudyModule | undefined {
  return caseStudies.find((mod) => mod.frontmatter.slug === slug);
}

/** Old project URL -> case-study slug. Used for redirects and old links. */
export const projectAliases: Record<string, string> = Object.fromEntries(
  caseStudies.filter((m) => m.frontmatter.replaces).map((m) => [m.frontmatter.replaces as string, m.frontmatter.slug]),
);

function fromCaseStudy(cs: CaseStudyData, base?: Project): Project {
  const full = `${cs.role} at ${cs.title.replace(/^A /, "a ")}${cs.years ? `, ${cs.years}` : ''}. ${cs.standfirst}`;
  const description = cs.metaDescription ? cs.metaDescription : full.length <= 158 ? full : `${full.slice(0, 155).replace(/\s+\S*$/, '')}…`;
  return {
    slug: cs.slug,
    title: cs.title,
    metaTitle: cs.metaTitle ?? (`${cs.title} | Case Study | Mr Wallcover`.length <= 60 ? `${cs.title} | Case Study | Mr Wallcover` : `${cs.title} | Mr Wallcover`),
    description,
    role: cs.role,
    client: cs.client,
    location: cs.location,
    dates: cs.years,
    summary: cs.standfirst || base?.summary || '',
    paragraphs: [],
    imagePolicy: cs.hero ? 'own' : 'none',
    imageId: cs.hero,
    gallery: cs.gallery.map((g) => g.id),
    videos: base?.videos ?? [],
    caption: null,
    featured: base?.featured ?? true,
    caseStudy: true,
    modest: Boolean(cs.modest),
    awaitingPhotos: Boolean(cs.awaitingPhotos),
    group: cs.group ?? undefined,
    credits: Object.fromEntries(cs.gallery.filter((g) => g.credit).map((g) => [g.id, g.credit as string])),
    published: cs.published,
    updated: cs.updated,
  };
}

const baseProjects = projectsJson.items as Project[];
const replacedSlugs = new Set(caseStudies.map((m) => m.frontmatter.replaces ?? m.frontmatter.slug));

export const projects: Project[] = [
  ...caseStudies.map((m) =>
    fromCaseStudy(m.frontmatter, baseProjects.find((p) => p.slug === (m.frontmatter.replaces ?? m.frontmatter.slug))),
  ),
  ...baseProjects.filter((p) => !replacedSlugs.has(p.slug)),
];

export function projectBySlug(slug: string): Project | undefined {
  const target = projectAliases[slug] ?? slug;
  return projects.find((project) => project.slug === target);
}

/**
 * Resolve the project slugs an area, service or editorial page lists, in
 * order. Published case studies and their old aliases resolve; a slug that
 * does not (a typo, or a case study that has gone to draft) fails the build
 * with the page named, so a link to a route that is not built can never be
 * silently dropped.
 */
export function linkedProjects(slugs: string[], owner: string): Project[] {
  return slugs.map((slug) => {
    const project = projectBySlug(slug);
    if (!project) {
      throw new Error(
        `${owner} lists project "${slug}", which is not a published case study or project. Remove it from the list, or publish the case study (remove its draft flag).`,
      );
    }
    return project;
  });
}

export function projectHref(slug: string): string {
  return `/projects/${slug}/`;
}

export const videos = videosJson;

export function videoById(id: string) {
  const video = videos.find((item) => item.id === id);
  if (!video) throw new Error(`Missing video ${id}`);
  /* videos.json carries a description of what each film actually shows; it wins over the older alts.json entry. */
  return { ...video, alt: (video as { alt?: string }).alt ?? altFor(video.altKey) };
}

export const faqItems = faq.items as FaqItem[];

export interface LandingPage {
  slug: string;
  name: string;
  title: string;
  description: string;
  heading: string;
  lede: string;
  paragraphs: string[];
  projects: string[];
  imageId: string | null;
  /** Visible caption under the page image: says where the photograph was taken, with a [label](href) link to the project. */
  imageCaption?: string;
  faq: FaqItem[];
  serviceType?: string;
  links?: { label: string; href: string }[];
  materialKey?: string;
}

export const areasIndex = areasJson.index;
export const areas = areasJson.items as LandingPage[];
export const specialisms = specialismsJson.items as LandingPage[];

export function areaHref(slug: string): string {
  return `/areas/${slug}/`;
}

export function specialismHref(slug: string): string {
  return `/services/${slug}/`;
}

/** Absolute-path JPEG for an image id, used for Open Graph and schema images. */
export function ogImageFor(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  const size = sizes[id];
  if (!size) return undefined;
  return size.hasFull ? size.jpg : size.thumbJpg;
}
