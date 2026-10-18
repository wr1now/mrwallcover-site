import type { DesignObjectKind } from './design-object-kinds';

/** Illustrations explain a topic; photographs and approved facts remain the evidence. */
export function materialStudyKind(slug: string): DesignObjectKind {
  if (slug === 'paper-and-non-woven') return 'roll';
  if (/hand-painted|mural/.test(slug)) return 'panels';
  if (/acoustic|vinyl|film/.test(slug)) return 'layers';
  return 'samples';
}

export function guideStudyKind(slug: string, category: string): DesignObjectKind {
  if (/quantit|roll|sourc|buy/.test(slug)) return 'roll';
  if (/cost|price/.test(slug)) return 'price';
  if (/hotel/.test(slug)) return 'room';
  if (/pattern|set-out|scenic|mural/.test(slug)) return 'panels';
  if (/fire|specification|checklist/.test(slug)) return 'document';
  if (category === 'preparing') return 'layers';
  if (category === 'caring') return 'care';
  if (category === 'choosing') return 'samples';
  return 'document';
}
