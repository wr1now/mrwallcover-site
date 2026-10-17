export const designObjectKinds = ['panels', 'samples', 'layers', 'roll', 'calendar', 'folio', 'document', 'price', 'privacy', 'room', 'care'] as const;
export type DesignObjectKind = typeof designObjectKinds[number];
