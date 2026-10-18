import data from './bauwerk-uk.json' with { type: 'json' };

export interface BauwerkShade {
  id: string; name: string; slug: string; colour: string;
  colourMethod: 'manufacturer-web-preview'; families: string[]; available: boolean;
  productUrl: string; sampleUrl: string; sourceUpdatedAt: string;
}
export interface BauwerkCatalogue {
  schemaVersion: number; provider: 'bauwerk'; market: 'GB'; checkedAt: string; version: string;
  source: string; collectionUrl: string; sourcePages: string[]; sourceMetadataSha256: string;
  shadeCount: number; colourNote: string; shades: BauwerkShade[];
}
export const bauwerkCatalogue = data as BauwerkCatalogue;
export const bauwerkFamilies = [...new Set(bauwerkCatalogue.shades.flatMap(shade => shade.families))].sort();

export function findBauwerkShades(query = '', family = '', favourites?: ReadonlySet<string>): BauwerkShade[] {
  const normalised = query.trim().toLocaleLowerCase('en-GB');
  return bauwerkCatalogue.shades.filter(shade => shade.available &&
    (!normalised || shade.name.toLocaleLowerCase('en-GB').includes(normalised)) &&
    (!family || shade.families.includes(family)) && (!favourites || favourites.has(shade.id)));
}
