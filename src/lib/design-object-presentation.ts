import type { DesignObjectKind } from './design-object-kinds';
import { questionIcon } from './question-visual.ts';
/** Match the existing topic/icon family to the corresponding original object study. */
const objects: Partial<Record<string, DesignObjectKind>> = {
  panels:'panels', calendar:'calendar', roll:'roll', book:'folio', drawing:'document',
  tag:'price', lock:'privacy', room:'room', tools:'care', layers:'layers', swatch:'samples',
  ruler:'measure', pin:'room', search:'samples', check:'document', access:'room', mail:'document',
};
export const objectKindForIcon = (icon: string): DesignObjectKind => objects[icon] ?? 'document';

/** A seam, measured wall and applied film need different physical studies even when their small icons overlap. */
const questionObjects: Readonly<Partial<Record<string, DesignObjectKind>>> = Object.freeze({
  's-joinery':'panels', 'mural-measure':'measure', 'mayfair-survey':'measure', 'cost-survey':'measure',
  'gc-seams':'junction', 'silk-marks':'samples',
  'af-what':'film', 'af-occupied':'film', 'af-sample':'film',
  'wf-types':'film', 'wf-double':'film', 'wf-remove':'film',
  'jp-doors':'film', 'jp-film-or-paper':'film',
});
export function objectKindForQuestion(question: string, id?: string): DesignObjectKind {
  const assigned=id?questionObjects[id]:undefined;
  if(assigned)return assigned;
  const text=question.normalize('NFKD').replace(/\p{M}+/gu,'').toLowerCase();
  const icon=questionIcon(question,id);
  // Paperwork remains paperwork; the graphic never stands in for technical evidence or an approval.
  if(/fire|euroclass|insurance|accredit|certific|qualified|qualification|training|approv|endorse|\brams\b|\bjct\b/.test(text))return objectKindForIcon(icon);
  if(/\b(film|films|wrapping|wrap|glazing|self-adhesive)\b/.test(text))return 'film';
  if(/\b(seam|seams|corner|corners|junction|junctions|reveal|reveals|splice|splicing)\b|first drop|not straight|true vertical|plumb|pattern match/.test(text))return 'junction';
  if(/\b(measure|measured|measurement|measurements|dimensions|dimension|survey|surveying)\b/.test(text)&&!['tag','calendar','roll'].includes(icon))return 'measure';
  return objectKindForIcon(icon);
}
