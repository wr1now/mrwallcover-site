/**
 * Reading a reaction-to-fire class notation, with no data attached, so the page's small decoder
 * script and the build-time checks share one parser.
 *
 * The rule throughout: report only what the notation prints. "Euroclass B" gives class B with the
 * smoke and droplet subclasses unknown; nothing is filled in.
 */
export type EuroClass = 'A1' | 'A2' | 'B' | 'C' | 'D' | 'E' | 'F';
export type SmokeClass = 's1' | 's2' | 's3';
export type DropletClass = 'd0' | 'd1' | 'd2';

export interface Classification {
  class: EuroClass | null;
  smoke: SmokeClass | null;
  droplets: DropletClass | null;
}

const NOTATION = /^(A1|A2|B|C|D|E|F)(?:[-\s,]*(S[123]))?(?:[-\s,]*(D[012]))?$/;

/** "B-s2,d0", "B-s2, d0", "Euroclass B", "Class B s1 d0", "B – s1, d0". Anything else gives all nulls. */
export function parseClassification(raw: string): Classification {
  const cleaned = raw
    .replace(/\b(BS\s*)?(EN\s*)?13501(-1)?(:\d{4}(\+A\d:\d{4})?)?/gi, ' ')
    .replace(/\b(euro\s*class(es|ification)?|classification|class|reaction to fire)\b:?/gi, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:.\s-]+|[,;:.\s]+$/g, '')
    .toUpperCase();
  const match = cleaned.match(NOTATION);
  if (!match) return { class: null, smoke: null, droplets: null };
  return {
    class: match[1] as EuroClass,
    smoke: match[2] ? (match[2].toLowerCase() as SmokeClass) : null,
    droplets: match[3] ? (match[3].toLowerCase() as DropletClass) : null,
  };
}

/** "B-s2,d0", or "B (smoke and droplet subclasses not stated)". */
export function formatClassification(c: Classification): string {
  if (!c.class) return 'Not stated';
  if (c.smoke && c.droplets) return `${c.class}-${c.smoke},${c.droplets}`;
  const missing = [c.smoke ? null : 'smoke', c.droplets ? null : 'droplet'].filter(Boolean);
  const known = [c.smoke, c.droplets].filter(Boolean).join(',');
  return `${c.class}${known ? `-${known}` : ''} (${missing.join(' and ')} subclass${missing.length > 1 ? 'es' : ''} not stated)`;
}
