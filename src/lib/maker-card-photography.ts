import photography from '../data/maker-card-photography.json';

export interface MakerCardPhotograph {
  kind: 'maker-installation' | 'craft-example';
  imageId: string;
  actualMaker: string;
  caption: string;
  credit: string;
  stageLabel?: string;
  evidenceHref: string;
  evidenceLabel: string;
  sources: string[];
  evidenceNote: string;
}

/** A directory entry is not itself evidence of an installation or a photo's maker. */
export const makerCardPhotographs = photography.entries as Record<string, MakerCardPhotograph>;

export function makerCardPhotograph(slug: string): MakerCardPhotograph {
  const photograph = makerCardPhotographs[slug];
  if (!photograph) throw new Error(`Review the installation or contextual photography for maker ${slug} before publishing its card.`);
  return photograph;
}
