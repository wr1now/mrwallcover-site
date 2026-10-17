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

/**
 * Why a parsed notation cannot exist under BS EN 13501-1, or null when it can: A1 and F carry no
 * subclass, and E carries no smoke subclass and only d2 for droplets.
 */
export function invalidCombination(c: Classification): string | null {
  if ((c.class === 'A1' || c.class === 'F') && (c.smoke || c.droplets)) return `Class ${c.class} carries no smoke or droplet subclass.`;
  if (c.class === 'E' && (c.smoke || (c.droplets && c.droplets !== 'd2'))) return 'Class E carries no smoke subclass, and d2 is its only droplet subclass.';
  return null;
}

/** "B-s2,d0", "B (smoke and droplet subclasses not stated)", "A1 (no smoke or droplet subclass applies)". */
export function formatClassification(c: Classification): string {
  if (!c.class) return 'Not stated';
  if (c.class === 'A1' || c.class === 'F') return `${c.class} (no smoke or droplet subclass applies)`;
  if (c.class === 'E') return c.droplets === 'd2' ? 'E-d2 (no smoke subclass applies)' : 'E (no smoke subclass applies; d2 is added only if the filter paper ignited)';
  if (c.smoke && c.droplets) return `${c.class}-${c.smoke},${c.droplets}`;
  const missing = [c.smoke ? null : 'smoke', c.droplets ? null : 'droplet'].filter(Boolean);
  const known = [c.smoke, c.droplets].filter(Boolean).join(',');
  return `${c.class}${known ? `-${known}` : ''} (${missing.join(' and ')} subclass${missing.length > 1 ? 'es' : ''} not stated)`;
}
