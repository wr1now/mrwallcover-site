/**
 * The standard "At a glance" box on every case study: the same seven fields, in the same order,
 * on every page. Client, scope (role) and year come from the case study's own frontmatter;
 * src/content/case-study-glance.json adds only what a page states but its frontmatter does not
 * carry (a designer, the makers as written, a year where the frontmatter has none). An area or
 * room figure appears only when it is one of Dorin's approved programme figures in facts.json,
 * matched by the case study's URL. Anything not recorded is left blank (null): never guessed.
 */
import glanceJson from '../content/case-study-glance.json';
import facts from '../data/facts.json';
import { SITE_URL } from '../config';

export interface GlanceSource {
  slug: string;
  client: string;
  role: string;
  years: string | null;
  wallcoverings: string[];
}

interface GlanceExtra {
  designer?: string;
  mainContractor?: string;
  makers?: string[];
  size?: string;
  year?: string;
}

export interface GlanceRow {
  label: string;
  value: string | null;
}

export const GLANCE_LABELS = ['Client', 'Designer', 'Main contractor', 'Maker and paper', 'Area or rooms', 'Scope', 'Year'] as const;

const extras = glanceJson.items as Record<string, GlanceExtra>;

/** The approved programme figure for a case study, if Dorin cleared one (facts.json programmeFigures). */
export function approvedFigure(slug: string): string | null {
  const url = new URL(`/projects/${slug}/`, SITE_URL).href;
  return facts.programmeFigures.find((f) => f.url === url)?.fact ?? null;
}

/** A plain year or range (2019, 2016–2019) or a sentence that starts with one; anything else is not a year. */
const YEARISH = /^(c\. )?\d{4}(–\d{4})?\b/;

/** Public fields used by both the visible definition list and machine-readable project records. */
export function glanceDetails(study: GlanceSource) {
  const extra = extras[study.slug];
  if (!extra) throw new Error(`case-study-glance.json has no entry for ${study.slug}; add one (an empty {} is fine).`);
  if (extra.size && !approvedFigure(study.slug)) throw new Error(`${study.slug}: an area or room figure needs an approved programme figure in facts.json`);
  const makers = extra.makers ?? study.wallcoverings;
  const year = extra.year ?? (study.years && YEARISH.test(study.years) ? study.years : null);
  return {
    client: study.client,
    designer: extra.designer ?? null,
    mainContractor: extra.mainContractor ?? null,
    makers: makers.length ? [...makers] : null,
    size: extra.size ?? null,
    scope: study.role,
    year: year ?? null,
  };
}

export function glanceRows(study: GlanceSource): GlanceRow[] {
  const details = glanceDetails(study);
  const values = [details.client, details.designer, details.mainContractor, details.makers?.join('; '), details.size, details.scope, details.year];
  return GLANCE_LABELS.map((label, i) => ({ label, value: values[i]?.trim() || null }));
}

export const glanceSlugs = Object.keys(extras);
