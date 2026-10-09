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
  credits?: Record<string, string>;
}

export interface FaqItem {
  id: string;
  question: string;
  paragraphs: string[];
}
