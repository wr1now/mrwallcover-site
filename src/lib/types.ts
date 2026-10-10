export interface MediaFile {
  width: number;
  height: number;
  src: string;
  jpg: string;
  thumb: string;
  thumbJpg: string;
  thumbWidth: number;
  thumbHeight: number;
  hasFull: boolean;
  /** Responsive AVIF + WebP set cut from a full-size original: <base>-<w>.avif|webp for each width. */
  variants?: { base: string; widths: number[] };
  /** Display width a modest case study keeps for this image (the old preview width). */
  modestWidth?: number;
  source?: string;
}

export interface HeroImage {
  id: string;
  width: number;
  height: number;
  sources: { src: string; width: number }[];
  fallback: string;
}

export interface Project {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  role: string;
  client: string;
  location: string;
  dates: string | null;
  summary: string;
  paragraphs: string[];
  imagePolicy: 'own' | 'modest' | 'none';
  imageId: string | null;
  gallery: string[];
  videos: string[];
  caption: string | null;
  featured: boolean;
  /** Set when this entry is a full case study rendered from src/content/case-studies. */
  caseStudy?: boolean;
  /** Preview-size photographs: displayed small and never upscaled. */
  modest?: boolean;
  /** Room photographs are not published. Show a labelled placeholder, not a fake picture. */
  awaitingPhotos?: boolean;
  /** Listing group on /projects, e.g. 'design-weeks'. */
  group?: string;
  credits?: Record<string, string>;
  /** ISO dates for case-study pages, from frontmatter data (never the build time). */
  published?: string;
  updated?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  paragraphs: string[];
}
