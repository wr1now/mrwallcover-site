/**
 * The fire-ratings reference (/advice/wallcovering-fire-ratings-uk/) as typed, checked data.
 *
 * One source of truth: src/data/fire-ratings/sources.json holds every document we cite,
 * standards.json the standards and the class decoder, regulations.json the four UK jurisdictions,
 * products.json the product-by-product evidence. The page, its tables, the Markdown twin and
 * llms.txt all read these files; nothing is copied by hand into the article.
 *
 * The checks below run at build time (the page imports this module) and in the tests, so a
 * product row without a source, a classification that adds a smoke or droplet subclass the
 * document never printed, or a date in the wrong form stops the build instead of reaching the page.
 */
import sourcesData from '../data/fire-ratings/sources.json' with { type: 'json' };
import standardsData from '../data/fire-ratings/standards.json' with { type: 'json' };
import regulationsData from '../data/fire-ratings/regulations.json' with { type: 'json' };
import productsData from '../data/fire-ratings/products.json' with { type: 'json' };
import { invalidCombination, parseClassification, type Classification } from './fire-classification.ts';

export { formatClassification, invalidCombination, parseClassification, type Classification } from './fire-classification.ts';

export type SourceType =
  | 'legislation'
  | 'government_guidance'
  | 'standard_catalogue'
  | 'eu_legislation'
  | 'declaration_of_performance'
  | 'classification_report'
  | 'test_report'
  | 'certificate'
  | 'technical_sheet'
  | 'installation_guide'
  | 'brochure'
  | 'webpage'
  | 'international_code';

export type SourceGroup = 'england' | 'wales' | 'scotland' | 'northern-ireland' | 'gb' | 'standards' | 'eu' | 'international' | 'manufacturer';

export interface Source {
  id: string;
  issuer: string;
  title: string;
  reference: string | null;
  type: SourceType;
  group: SourceGroup;
  /** Document issue or revision date as printed (ISO when the day is known, else as printed). */
  issued: string | null;
  /** A regulatory effective date, kept apart from the issue date. */
  effective: string | null;
  /** Only when the document itself states an expiry. Never inferred. */
  statedExpiry: string | null;
  /** The validity wording as printed, when the document gives a period rather than a date. */
  expiryWording?: string;
  url: string;
  /** Our own checking date: when we last opened the source. */
  accessed: string;
  sha256: string | null;
  /** Where in the document the cited material is. */
  pages: string | null;
  /** What the source establishes, in our words. */
  establishes: string;
  /** What it does not establish. */
  limits: string | null;
  status: 'current' | 'superseded' | 'forthcoming' | 'unclear';
}

export type EvidenceType = 'declaration_of_performance' | 'classification_report' | 'test_report' | 'certificate' | 'technical_sheet' | 'webpage' | 'brochure';

export interface ProductEvidence {
  sourceId: string;
  evidenceType: EvidenceType;
  documentReference: string | null;
  testBody: string | null;
  pageRef: string | null;
}

export interface Product {
  id: string;
  manufacturer: string;
  product: string;
  reference: string | null;
  scope: string;
  construction: string | null;
  weight: string | null;
  /** The fire line exactly as the main document prints it, conditions and all. */
  classificationRaw: string;
  /** The class notation alone, copied from classificationRaw (e.g. "B-s2, d0"); null when the documents conflict or print no European class. */
  notation: string | null;
  classification: Classification;
  classificationStandardCited: string | null;
  testMethodsCited: string[];
  productStandardCited: string | null;
  evidence: ProductEvidence[];
  testedBuildup: { substrate: string | null; adhesive: string | null; other: string | null };
  fieldOfApplication: string | null;
  limitations: string[];
  conflicts: string[];
  unresolved: string[];
  status: 'current' | 'superseded' | 'unclear';
  evidenceLevel: 'classification_report' | 'declaration_of_performance' | 'technical_sheet' | 'webpage' | 'brochure';
  checked: string;
}

export interface Standard {
  id: string;
  designation: string;
  title: string;
  latestEdition: string | null;
  published: string | null;
  status: string;
  role: string;
  editionNote: string | null;
  sourceIds: string[];
}

export interface DecoderEntry {
  code: string;
  label: string;
  meaning: string;
  basis: string;
  sourceIds: string[];
}

export interface Jurisdiction {
  id: string;
  name: string;
  document: string;
  edition: string;
  linings: string;
  nationalClasses: string;
  dates: { label: string; date: string; kind: 'published' | 'effective' | 'transition' | 'forthcoming' }[];
  notes: string[];
  sourceIds: string[];
}

export const sources = sourcesData.sources as Source[];
export const standards = standardsData.standards as Standard[];
export const classes = standardsData.classes as DecoderEntry[];
export const smokeClasses = standardsData.smoke as DecoderEntry[];
export const dropletClasses = standardsData.droplets as DecoderEntry[];
export const decoderExamples = standardsData.examples as { notation: string; reading: string; note: string | null }[];
export const jurisdictions = regulationsData.jurisdictions as Jurisdiction[];
export const englandLinings = regulationsData.englandLinings as {
  document: string;
  table: string;
  rows: { location: string; detail: string; euroclass: string }[];
  notes: string[];
  sourceIds: string[];
};
export const products = productsData.products as Product[];
export const FIRE_CHECKED = productsData.checked as string;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const sourceById = new Map(sources.map((source) => [source.id, source]));

export function source(id: string): Source {
  const found = sourceById.get(id);
  if (!found) throw new Error(`fire-ratings: unknown source id "${id}"`);
  return found;
}

/** Classes A2 to D carry both a smoke and a droplet subclass; A1 and F carry none, and E only an optional d2. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

export const takesSubclasses = (c: Classification) => c.class === 'A2' || c.class === 'B' || c.class === 'C' || c.class === 'D';

export interface Gap {
  kind: 'subclass-unknown' | 'stated-expiry-passed' | 'no-buildup' | 'no-field-of-application' | 'superseded' | 'unclear-status' | 'conflict' | 'unresolved' | 'sheet-only';
  text: string;
}

/** The evidence gaps shown beside a product row. Built from the record, so the page cannot hide one. */
export function gapsFor(product: Product, today = FIRE_CHECKED, lookup: (id: string) => Source = source): Gap[] {
  const gaps: Gap[] = [];
  const c = product.classification;
  if (takesSubclasses(c) && (!c.smoke || !c.droplets)) gaps.push({ kind: 'subclass-unknown', text: 'The document gives the class without the full smoke and droplet subclasses; treat the missing subclass as unknown.' });
  for (const ev of product.evidence) {
    const s = lookup(ev.sourceId);
    const expiry = s.statedExpiry;
    if (expiry && ISO.test(expiry) && expiry < today) {
      const printed = s.expiryWording ? ` (printed as “${s.expiryWording}”)` : '';
      gaps.push({ kind: 'stated-expiry-passed', text: `${ev.documentReference ?? s.title} states a validity that ended on ${longDate(expiry)}${printed}; ask the maker for the current document.` });
    }
  }
  if (!product.testedBuildup.substrate && !product.testedBuildup.adhesive) gaps.push({ kind: 'no-buildup', text: 'The document we read does not name the tested substrate or adhesive.' });
  if (!product.fieldOfApplication) gaps.push({ kind: 'no-field-of-application', text: 'No field of application (permitted variations) is stated in the document we read.' });
  if (product.status === 'superseded') gaps.push({ kind: 'superseded', text: 'This document has been superseded; do not rely on it.' });
  if (product.status === 'unclear') gaps.push({ kind: 'unclear-status', text: 'Ask the maker to confirm this document is still current before you rely on it.' });
  if (product.evidenceLevel === 'technical_sheet' || product.evidenceLevel === 'webpage' || product.evidenceLevel === 'brochure') gaps.push({ kind: 'sheet-only', text: 'Only a maker’s sheet or page was available to us, not the declaration of performance or classification report behind it.' });
  for (const text of product.conflicts) gaps.push({ kind: 'conflict', text });
  for (const text of product.unresolved) gaps.push({ kind: 'unresolved', text });
  return gaps;
}

export const evidenceLabel: Record<EvidenceType | Product['evidenceLevel'], string> = {
  declaration_of_performance: 'Declaration of performance',
  classification_report: 'Classification report',
  test_report: 'Test report',
  certificate: 'Certificate',
  technical_sheet: 'Technical data sheet',
  webpage: 'Maker’s web page',
  brochure: 'Brochure',
};

export interface FireData {
  sources: Source[];
  products: Product[];
  standards: Standard[];
  decoder: DecoderEntry[];
  jurisdictions: Jurisdiction[];
  englandSourceIds: string[];
  checked: string;
}

export const fireData: FireData = {
  sources,
  products,
  standards,
  decoder: [...classes, ...smokeClasses, ...dropletClasses],
  jurisdictions,
  englandSourceIds: englandLinings.sourceIds,
  checked: FIRE_CHECKED,
};

/** Problems with the dataset; empty when it is sound. The build throws on any of them. */
export function validateFireData(data: FireData = fireData, today = new Date().toISOString().slice(0, 10)): string[] {
  const { sources, products, standards, jurisdictions } = data;
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const problems: string[] = [];
  if (!ISO.test(data.checked) || data.checked > today) problems.push('products.json: checked must be an ISO date not in the future');
  const ids = new Set<string>();
  for (const s of sources) {
    if (ids.has(s.id)) problems.push(`duplicate source id ${s.id}`);
    ids.add(s.id);
    if (!/^https:\/\//.test(s.url)) problems.push(`${s.id}: url must be https`);
    if (!ISO.test(s.accessed) || s.accessed > today) problems.push(`${s.id}: accessed must be an ISO date not in the future`);
    if (!s.establishes?.trim()) problems.push(`${s.id}: says nothing about what it establishes`);
    for (const key of ['effective', 'statedExpiry'] as const) if (s[key] !== null && !ISO.test(s[key]!)) problems.push(`${s.id}: ${key} must be ISO or null`);
    if (s.sha256 !== null && !/^[0-9a-f]{64}$/.test(s.sha256)) problems.push(`${s.id}: sha256 must be 64 hex characters or null`);
  }
  const productIds = new Set<string>();
  for (const p of products) {
    if (productIds.has(p.id)) problems.push(`duplicate product id ${p.id}`);
    productIds.add(p.id);
    if (!p.product.trim() || p.product.trim().toLowerCase() === p.manufacturer.toLowerCase()) problems.push(`${p.id}: a row must name a product, never just the brand`);
    if (!p.scope.trim()) problems.push(`${p.id}: scope is required`);
    if (!p.evidence.length) problems.push(`${p.id}: no evidence`);
    for (const ev of p.evidence) {
      const s = sourceById.get(ev.sourceId);
      if (!s) problems.push(`${p.id}: unknown source ${ev.sourceId}`);
      else if (s.status === 'superseded' && p.status === 'current') problems.push(`${p.id}: marked current but relies on superseded source ${s.id}`);
    }
    if (!ISO.test(p.checked) || p.checked > today) problems.push(`${p.id}: checked must be an ISO date not in the future`);
    if (!p.limitations.length) problems.push(`${p.id}: every row states at least one limitation`);
    if (p.notation === null && !p.conflicts.length && !p.unresolved.length) problems.push(`${p.id}: no readable class, so the row must say why (conflicts or unresolved)`);
    // The notation must be copied from the printed line, and the normalised value may only repeat what the notation prints.
    const squash = (t: string) => t.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
    if (p.notation !== null && !squash(p.classificationRaw).includes(squash(p.notation))) problems.push(`${p.id}: notation "${p.notation}" is not in the printed line "${p.classificationRaw}"`);
    const parsed = p.notation === null ? { class: null, smoke: null, droplets: null } : parseClassification(p.notation);
    if (p.notation !== null && !parsed.class) problems.push(`${p.id}: notation "${p.notation}" is not a European class`);
    const impossible = invalidCombination(parsed);
    if (impossible) problems.push(`${p.id}: notation "${p.notation}" is not a valid combination: ${impossible}`);
    const c = p.classification;
    if (c.class !== parsed.class) problems.push(`${p.id}: normalised class ${c.class} does not match "${p.notation}"`);
    if (c.smoke !== parsed.smoke) problems.push(`${p.id}: normalised smoke ${c.smoke} does not match "${p.notation}"`);
    if (c.droplets !== parsed.droplets) problems.push(`${p.id}: normalised droplets ${c.droplets} does not match "${p.notation}"`);
  }
  for (const s of standards) for (const id of s.sourceIds) if (!sourceById.has(id)) problems.push(`standard ${s.id}: unknown source ${id}`);
  for (const entry of data.decoder) {
    if (!entry.sourceIds.length) problems.push(`decoder ${entry.code}: unsourced`);
    for (const id of entry.sourceIds) if (!sourceById.has(id)) problems.push(`decoder ${entry.code}: unknown source ${id}`);
  }
  for (const j of jurisdictions) {
    if (!j.sourceIds.length) problems.push(`jurisdiction ${j.id}: unsourced`);
    for (const id of j.sourceIds) if (!sourceById.has(id)) problems.push(`jurisdiction ${j.id}: unknown source ${id}`);
    for (const d of j.dates) {
      if (!ISO.test(d.date)) problems.push(`jurisdiction ${j.id}: date ${d.date} must be ISO`);
      // A dated change after our checking date can only be shown as forthcoming, never as in force.
      else if (d.date > data.checked && d.kind !== 'forthcoming') problems.push(`jurisdiction ${j.id}: ${d.date} (${d.label}) is after the check date, so it must be marked forthcoming`);
      else if (d.date <= data.checked && d.kind === 'forthcoming') problems.push(`jurisdiction ${j.id}: ${d.date} (${d.label}) has passed but is still marked forthcoming`);
    }
  }
  for (const id of data.englandSourceIds) if (!sourceById.has(id)) problems.push(`englandLinings: unknown source ${id}`);
  return problems;
}

/** Sources grouped for the library at the foot of the page, in reading order. */
export const sourceGroups: { id: SourceGroup; label: string }[] = [
  { id: 'england', label: 'England' },
  { id: 'wales', label: 'Wales' },
  { id: 'scotland', label: 'Scotland' },
  { id: 'northern-ireland', label: 'Northern Ireland' },
  { id: 'gb', label: 'Great Britain and the UK' },
  { id: 'standards', label: 'Standards (catalogue records)' },
  { id: 'eu', label: 'European classification rules' },
  { id: 'international', label: 'Other systems' },
  { id: 'manufacturer', label: 'Manufacturers’ documents' },
];
