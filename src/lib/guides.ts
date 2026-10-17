import fireRatingsPage from '../content/fire-ratings/page.json';

export interface GuideFaq {
  q: string;
  a: string;
}

export interface GuideData {
  title: string;
  shortTitle: string;
  slug: string;
  description: string;
  /** Optional search snippet (70-160 characters) when the visible description is longer. */
  metaDescription?: string;
  category: 'choosing' | 'preparing' | 'planning' | 'caring';
  audience: string;
  order: number;
  draft: boolean;
  reviewStatus: string;
  reviewer: string | null;
  prepared: string;
  /** Accountable author shown in the byline and in the Article schema. */
  author: string;
  authorRole: string;
  /** Site path of the author's Person node, e.g. /about/#dorin. */
  authorHref: string;
  /** ISO dates of the edit that published and last changed the article. Never the build time. */
  published: string;
  updated: string;
  relatedMaterials: string[];
  relatedGuides: string[];
  ctaLabel: string;
  ctaHref: string;
  sources: { label: string; url: string }[];
  /** Optional original schematic, shared with services. Never a product specification. */
  diagram?: 'survey' | 'programme' | 'supply' | 'setout' | 'inspection' | 'pattern-match' | 'preparation' | 'panel-sequence' | 'reveal' | 'roll-cutting' | 'tested-build-up' | 'natural-panels';
  diagramCaption?: string;
  /** Relevant cleared photograph rendered by the shared evidence component. */
  evidence?: { id: string; caption: string; credit: string; href?: string; linkLabel?: string };
  /** Optional real worksheet, also linked in the article copy. */
  download?: { href: string; label: string };
  /** Visible question-and-answer block; only guides that carry one emit FAQPage schema. */
  faq?: GuideFaq[];
}

/** What a hub card needs. Markdown guides and the quantity calculator both satisfy it. */
export type GuideCardData = Pick<GuideData, 'slug' | 'shortTitle' | 'description' | 'category' | 'order'>;

type GuideModule = {
  frontmatter: GuideData;
  Content: any;
  getHeadings: () => { depth: number; slug: string; text: string }[];
};

export const guideCategories = [
  { id: 'choosing', label: 'Choosing' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'planning', label: 'Planning' },
  { id: 'caring', label: 'Caring' },
] as const;

export const contentPreview = import.meta.env.MW_CONTENT_PREVIEW === '1';
const modules = Object.values(import.meta.glob<GuideModule>('../content/guides/*.md', { eager: true }));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
for (const { frontmatter } of modules) {
  const { slug, published, updated, author, authorHref } = frontmatter;
  if (!ISO_DATE.test(published ?? '') || !ISO_DATE.test(updated ?? '') || updated < published) {
    throw new Error(`Guide ${slug} needs ISO published and updated dates in its frontmatter`);
  }
  if (!author || !authorHref?.startsWith('/')) throw new Error(`Guide ${slug} needs an author and an authorHref`);
}

export const publishedGuides = modules.filter((guide) => !guide.frontmatter.draft);
export const guides = modules
  .filter((guide) => contentPreview || !guide.frontmatter.draft)
  .sort((a, b) => a.frontmatter.order - b.frontmatter.order);
export const guideHref = (slug: string) => `/advice/${slug}/`;

/** "9 October 2026" from an ISO date, for the visible byline. */
export function formatGuideDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Guide 4 of the ten is the existing quantity calculator page, not a Markdown
 * article. It sits in the hub between wall preparation and installation cost.
 */
export const quantityCalculatorCard: GuideCardData = {
  slug: 'quantities',
  shortTitle: 'How much wallpaper to order',
  description: 'Worked examples for drops, repeats, openings and spares, with a link to the wallpaper calculator.',
  category: 'planning',
  order: 4,
};

export const fireRatingsCard: GuideCardData = {
  slug: fireRatingsPage.slug, shortTitle: fireRatingsPage.shortTitle,
  description: fireRatingsPage.cardDescription, category: 'planning', order: 14,
};

/** Everything the advice hub lists, in the agreed order. */
export const hubCards: GuideCardData[] = [...guides.map((guide) => guide.frontmatter), quantityCalculatorCard, fireRatingsCard].sort((a, b) => a.order - b.order);
