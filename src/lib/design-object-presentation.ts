import type { DesignObjectKind } from './design-object-kinds';
/** Match the existing topic/icon family to the corresponding original object study. */
const objects: Partial<Record<string, DesignObjectKind>> = {
  panels:'panels', calendar:'calendar', roll:'roll', book:'folio', drawing:'document',
  tag:'price', lock:'privacy', room:'room', tools:'care', layers:'layers', swatch:'samples',
  ruler:'document', pin:'room', search:'samples', check:'document', access:'room', mail:'document',
};
export const objectKindForIcon = (icon: string): DesignObjectKind => objects[icon] ?? 'document';
