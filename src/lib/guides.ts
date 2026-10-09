export interface GuideData {
  title: string;
  shortTitle: string;
  slug: string;
  description: string;
  category: 'choosing' | 'preparing' | 'planning' | 'caring';
  audience: string;
  order: number;
  draft: boolean;
  reviewStatus: string;
  reviewer: string | null;
  prepared: string;
  published?: string;
  updated?: string;
  relatedMaterials: string[];
  relatedGuides: string[];
  ctaLabel: string;
  ctaHref: string;
  sources: { label: string; url: string }[];
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
export const publishedGuides = modules.filter((guide) => !guide.frontmatter.draft);
export const guides = modules
  .filter((guide) => contentPreview || !guide.frontmatter.draft)
  .sort((a, b) => a.frontmatter.order - b.frontmatter.order);
export const guideHref = (slug: string) => `/advice/${slug}/`;

/**
 * Guide 4 of the ten is the existing quantity calculator page, not a Markdown
 * article. It sits in the hub between wall preparation and installation cost.
 */
export const quantityCalculatorCard: GuideCardData = {
  slug: 'quantities',
  shortTitle: 'How much wallpaper to order',
  description: 'Count drops, not square metres. A restricted roll calculator, and why repeat, batch and spares change the order.',
  category: 'planning',
  order: 4,
};

/** Everything the advice hub lists, in the agreed order. */
export const hubCards: GuideCardData[] = [...guides.map((guide) => guide.frontmatter), quantityCalculatorCard].sort((a, b) => a.order - b.order);
