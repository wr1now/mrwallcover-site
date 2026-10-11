/**
 * The one data source for the facts the AI-crawling layer adds on top of the
 * pages: /projects.json, /.well-known/facts.json, the project facts and key
 * facts on /for-ai/ (and so its Markdown twin and llms-full.txt), the notes in
 * /llms.txt and the ItemList JSON-LD on /for-ai/.
 *
 * Nothing here is typed in by hand. Every value is read from a file already in
 * the repository and already published on the site:
 *   - case-study frontmatter (title, client, location, years, role, wallcoverings)
 *   - the case study's own "At a glance" list, label by label
 *   - the bold-lead paragraphs of the case study's method ("**Setting out.** ...")
 *   - src/content/team.json (founder's start year), services.json (pillars and the
 *     wastage allowance), specialisms.json, areas.json, contact.json, facts.json
 * The field-to-source rules are written down in src/data/ai-sources.json, and
 * tests/ai-layer-data.test.ts re-reads the cited files and fails if any value in
 * /projects.json is not found in its source. Drafts never enter: only the
 * published `projects` and `caseStudies` collections are read.
 *
 * Codex's /ai/*.json resources are built separately (src/lib/ai-crawler.ts) and
 * are not touched from here; tests/ai-layer-consistency.test.ts compares the two.
 */
import { SITE_URL } from '../config';
import facts from '../data/facts.json';
import contactJson from '../content/contact.json';
import teamJson from '../content/team.json';
import buyerJson from '../data/buyer-answers.json';
import { areaHref, areas, caseStudies, projectHref, projects, services, specialismHref, specialisms } from './content';
import { phoneAvailable } from './phone';

const absolute = (path: string): string => new URL(path, SITE_URL).href;

/** Markdown inline syntax removed, wording kept exactly. */
export function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/|mailto:)[^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

const rawCaseStudies = import.meta.glob<string>('../content/case-studies/*.md', { eager: true, query: '?raw', import: 'default' });
const bodyBySlug = new Map<string, string>();
for (const raw of Object.values(rawCaseStudies)) {
  const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!front) continue;
  const record = JSON.parse(front[1]) as { slug: string; draft?: boolean };
  if (!record.draft) bodyBySlug.set(record.slug, raw.slice(front[0].length));
}

export interface GlanceItem { label: string; value: string; items?: string[] }

/** The "At a glance" list of a case study: "- **Label:** value", with any nested "  - item" lines kept as items. */
export function atAGlance(body: string): GlanceItem[] {
  const section = body.match(/^## At a glance\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] ?? '';
  const out: GlanceItem[] = [];
  for (const line of section.split(/\r?\n/)) {
    const top = line.match(/^- \*\*([^*]+?):\*\*\s*(.*)$/);
    if (top) {
      out.push({ label: top[1].trim(), value: plain(top[2]) });
      continue;
    }
    const nested = line.match(/^\s{2,}- (.+)$/);
    if (nested && out.length) (out.at(-1)!.items ??= []).push(plain(nested[1]));
  }
  return out.map((item) => (item.items ? item : { label: item.label, value: item.value }));
}

export interface MethodStep { step: string; text: string }

/** Method paragraphs that open with a bold lead ending in a full stop: "**Setting out.** Drops were planned ...". */
export function methodSteps(body: string): MethodStep[] {
  return [...body.matchAll(/^\*\*([^*]{2,60}?)\.\*\*\s+(.+)$/gm)].map((match) => ({ step: match[1].trim(), text: plain(match[2]) }));
}

const firstOf = (glance: GlanceItem[], labels: string[]) => {
  for (const label of labels) {
    const hit = glance.find((item) => item.label === label);
    if (hit) return hit;
  }
  return undefined;
};
const glanceText = (item: GlanceItem | undefined) => (item ? [item.value, ...(item.items ?? [])].filter(Boolean).join('; ') : null);

/** Labels read from "At a glance" for each field; first match wins. Mirrored in src/data/ai-sources.json. */
export const GLANCE_FIELDS = {
  venue: ['Venue', 'Hotel', 'Building', 'House'],
  scope: ['Scope', 'Our work', 'Our package', 'Our role'],
  dates: ['Years on site', 'Works', 'Installed', 'Dates', 'When', 'Duration', 'Years'],
  partners: ['In partnership with', 'Designer', 'Interior design', 'Scheme', 'Exhibitor', 'Event'],
  products: ['Wallcoverings', 'Wallpaper', 'Product', 'Collection', 'Window film'],
} as const;

const PREPARATION_STEP = /prepar|strip-out|priming/i;

export const projectFacts = projects.map((project) => {
  const study = caseStudies.find((mod) => mod.frontmatter.slug === project.slug)?.frontmatter;
  const body = bodyBySlug.get(project.slug) ?? '';
  const glance = atAGlance(body);
  const steps = methodSteps(body);
  const url = absolute(projectHref(project.slug));
  const glanceProducts = firstOf(glance, [...GLANCE_FIELDS.products]);
  return {
    slug: project.slug,
    title: project.title,
    url,
    markdownUrl: `${url}index.md`,
    recordType: project.caseStudy ? 'case-study' : 'project',
    venue: glanceText(firstOf(glance, [...GLANCE_FIELDS.venue])) ?? project.title,
    area: project.location,
    years: project.dates ?? null,
    dates: glanceText(firstOf(glance, [...GLANCE_FIELDS.dates])),
    client: project.client,
    partners: glanceText(firstOf(glance, [...GLANCE_FIELDS.partners])),
    role: project.role,
    makersAndProducts: study?.wallcoverings?.length ? [...study.wallcoverings] : [],
    productsAsWritten: glanceText(glanceProducts),
    scope: glanceText(firstOf(glance, [...GLANCE_FIELDS.scope])),
    preparation: steps.filter((s) => PREPARATION_STEP.test(s.step)).map((s) => `${s.step}. ${s.text}`),
    techniques: steps.map((s) => s.step),
    method: steps,
    atAGlance: glance,
    summary: project.summary,
    published: project.published ?? null,
    updated: project.updated ?? null,
    source: { url, markdownUrl: `${url}index.md`, sections: ['At a glance', ...(steps.length ? ['method paragraphs'] : [])] },
  };
});

export type ProjectFacts = (typeof projectFacts)[number];

/** Founder's start year, from the team record that the About page also reads. */
const founder = teamJson.members.find((member) => member.id === 'dorin-burcus');
if (!founder || founder.since !== 2012) throw new Error('team.json founder "since" must be present (2012)');
export const SINCE_YEAR = founder.since;
export const SINCE_TEXT = `In the trade since ${SINCE_YEAR}`;
/** The founder's one-line record, word for word from team.json. */
export const FOUNDER_SUMMARY = founder.summary;

/** The wastage allowance, quoted from the Surveying pillar on /services/ (the guides repeat the same sentence). */
const surveying = services.pillars.find((pillar) => pillar.id === 'surveying');
const wastageSentence = surveying?.paragraphs.flatMap((p) => p.split(/(?<=\.)\s+/)).find((s) => s.includes('15–30%'));
if (!wastageSentence) throw new Error('services.json surveying pillar must state the 15–30% allowance');
export const WASTAGE = { range: '15–30%', statement: wastageSentence, url: absolute('/services/#surveying') };

/**
 * The award, only once the fact sheet carries it (PR #24 adds facts.award).
 * Until then it is null and nothing about an award is printed.
 */
const award = (facts as { award?: { line: string; name: string; organiser: string; url?: string } }).award;
export const AWARD = award
  ? { text: `${award.line}: ${award.name.replace(/, 2021$/, '')}, ${award.organiser}`, name: award.name, organiser: award.organiser, evidenceUrl: award.url ?? null }
  : null;

export const serviceFacts = {
  workflow: services.pillars.map((pillar) => ({ id: pillar.id, name: pillar.title, url: absolute(`/services/#${pillar.id}`), includes: [...pillar.paragraphs] })),
  installation: specialisms.map((item) => ({ name: item.name, url: absolute(specialismHref(item.slug)), includes: item.description })),
};

export const areaFacts = {
  base: facts.place,
  coverage: facts.coverage,
  areaPages: areas.map((area) => ({ name: area.name, url: absolute(areaHref(area.slug)) })),
};

/** How to get in touch, as built. The phone number itself is never in the source; it is shown on request only when the build has it. */
export const enquiryRoutes = [
  { route: 'Enquiry form', url: absolute('/contact/'), note: contactJson.lede },
  { route: 'Email', url: `mailto:${facts.email}`, note: `${facts.email}. ${contactJson.directNoPhone.replace(/^Or write directly\. /, '')}` },
  ...(phoneAvailable
    ? [
        { route: 'Phone', url: absolute('/contact/'), note: contactJson.direct.replace(/^Or write directly\. /, '') },
        { route: 'WhatsApp', url: absolute('/contact/'), note: 'A WhatsApp link on the contact page; the number is added on the page, never printed in the HTML.' },
      ]
    : []),
];

export const PROJECTS_INDEX_URL = absolute('/projects.json');
export const WELL_KNOWN_FACTS_URL = absolute('/.well-known/facts.json');

export const projectsIndex = {
  name: `${facts.brand} published projects`,
  url: PROJECTS_INDEX_URL,
  isBasedOn: absolute('/for-ai/'),
  publisher: { name: facts.brand, url: SITE_URL },
  companion: absolute('/ai/projects.json'),
  notes: {
    source: 'Every value is read from the published case study at url (also available as Markdown at markdownUrl): its frontmatter, its At a glance list and its method paragraphs. Nothing is added that the page does not say.',
    makersAndProducts: 'A maker or product named here was installed on that project. It is not a maker approval, accreditation or endorsement.',
    nulls: 'null or an empty list means the case study does not record it.',
    privacy: 'Private homes appear by street or area only, as on their pages. Private clients are not named.',
  },
  count: projectFacts.length,
  projects: projectFacts,
};

/**
 * Buyer questions (src/data/buyer-answers.json, from the AI answer audit's FILL.md).
 * Each answer is FILL.md's sourced text with every [Pending Qn] sentence left out;
 * the standing entries repeat facts already on the site word for word. `pages`
 * names where each one is shown as a visible FAQ with FAQPage schema.
 */
export interface BuyerAnswer {
  id: string;
  question: string;
  answer: string;
  short?: string;
  shortNote?: string;
  questionNote?: string;
  status: string;
  auditRows: string[];
  pendingOmitted: string[];
  sources: { url?: string; note?: string }[];
  pages: string[];
}
export const buyerAnswers: BuyerAnswer[] = [...buyerJson.answers, ...buyerJson.standing];
for (const item of buyerAnswers) {
  if (/\[Pending|Pending Q\d/.test(`${item.question} ${item.answer} ${item.short ?? ''}`)) throw new Error(`buyer-answers.json ${item.id} still carries a [Pending] sentence`);
}
if (AWARD && !buyerAnswers.some((item) => item.answer.includes(AWARD.text))) throw new Error('buyer-answers.json must quote the award exactly as facts.json prints it');
/** The FILL.md questions only (not the standing repeats), in audit order: the /for-ai/ and llms.txt list. */
export const buyerQuestions = buyerJson.answers as BuyerAnswer[];
/** The answers shown on one page, in file order. */
export const buyerFaqFor = (path: string): BuyerAnswer[] => buyerAnswers.filter((item) => item.pages.includes(path));
/** FILL.md's proposed /.well-known/facts.json keys (add only). */
export const BUYER_FACTS = buyerJson.factsAdditions as Record<string, unknown>;
export const BUYER_FACTS_PENDING = buyerJson.factsAdditionsPending as string[];
