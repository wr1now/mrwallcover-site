/**
 * The crawler page and JSON endpoints share this public-only projection.
 * Content is selected through the same published collections as the website.
 * Fields are allowlisted; build secrets and editorial notes never enter it.
 */
import { SITE_URL } from '../config';
import facts from '../data/facts.json';
import creditedMedia from '../content/credited-media.json';
import { about, areas, areaHref, caseStudies, media, projects, projectHref, services, specialisms, specialismHref } from './content';
import { glanceDetails, glanceRows } from './glance';
import { commissionScope } from './commission-scope';

export const CRAWLER_PATH = '/wallcovering-installation-ai-crawler/';
export const CRAWLER_TITLE = 'Wallcovering Installation AI Crawler';
/** Editorial review of this reference resource, separate from the underlying business fact-sheet date. */
export const CRAWLER_SCHEMA_VERSION = '1.1';
export const CRAWLER_PROJECT_SCHEMA_VERSION = '1.2';
export const CRAWLER_REVIEWED = '2026-10-10';
const absolute = (path: string): string => new URL(path, SITE_URL).href;

/** Only HTTP(S) references written in the published case study or photo record. */
function referenceUrls(text: string): string[] {
  return [...new Set((text.match(/https?:\/\/[^\s<>"\\)\]]+/g) ?? [])
    .map((url) => url.replace(/[.,;:]+$/, ''))
    .filter((url) => {
      try { return ['http:', 'https:'].includes(new URL(url).protocol); }
      catch { return false; }
    }))];
}

const caseStudySources = import.meta.glob<string>('../content/case-studies/*.md', {
  eager: true, query: '?raw', import: 'default',
});
const sourceBySlug = new Map<string, string>();
for (const source of Object.values(caseStudySources)) {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!frontmatter) throw new Error('A case study has no JSON frontmatter.');
  const record = JSON.parse(frontmatter[1]) as { slug: string; draft?: boolean };
  if (!record.draft) sourceBySlug.set(record.slug, source.slice(frontmatter[0].length));
}
const photoRecords = creditedMedia as Record<string, { manifestNote: string }>;

const installationHeadings: Record<string, 'scope' | 'approach' | 'outcome'> = {
  'At a glance': 'scope',
  'Project record': 'scope',
  'The brief': 'scope',
  'The work': 'scope',
  'Our work': 'approach',
  'Our approach': 'approach',
  'Outcome': 'outcome',
  'The dinner flats': 'scope',
  'Launch dinner panels for Calico': 'scope',
  'Working airside, in a live terminal': 'approach',
};

/** Preserve published wording while removing only Markdown presentation syntax. */
function plainExcerpt(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,;:]|$)/g, '$1$2')
    .replace(/^#{3,6} /gm, '')
    .trim();
}

function installationSections(body: string) {
  const headings = [...body.matchAll(/^## ([^\r\n]+)\r?$/gm)];
  return headings.flatMap((heading, index) => {
    const kind = installationHeadings[heading[1]];
    if (!kind) return [];
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? body.length;
    const text = plainExcerpt(body.slice(start, end));
    return text ? [{ heading: heading[1], kind, text }] : [];
  });
}

export const crawlerBusiness = {
  schemaVersion: CRAWLER_SCHEMA_VERSION,
  resourceReviewed: CRAWLER_REVIEWED,
  id: `${SITE_URL}/#business`,
  url: absolute('/ai/business.json'),
  sourceUrl: absolute(CRAWLER_PATH),
  website: SITE_URL,
  name: facts.brand,
  description: facts.description,
  lastReviewed: facts.lastReviewed,
  award: `${facts.award.line}: ${facts.award.name.replace(/, 2021$/, '')}, ${facts.award.organiser}`,
  founder: {
    name: facts.founder.name,
    jobTitle: facts.founder.jobTitle,
    url: absolute(`${facts.founder.path}#${facts.founder.fragment}`),
    summary: about.founderSummary,
  },
  base: facts.place,
  coverage: facts.coverage,
  commissionScope,
  areas: areas.map((area) => ({ name: area.name, url: absolute(areaHref(area.slug)) })),
  contact: { email: facts.email, url: absolute('/contact/') },
  profiles: facts.profiles.map((profile) => ({ name: profile.name, handle: profile.handle, url: profile.url })),
  workflow: services.pillars.map((item) => ({
    name: item.title, description: item.paragraphs[0], paragraphs: [...item.paragraphs], url: absolute(`/services/#${item.id}`),
  })),
  services: specialisms.map((item) => ({
    name: item.name, description: item.description, url: absolute(specialismHref(item.slug)),
  })),
  projectsUrl: absolute('/ai/projects.json'),
  decisionGuideUrl: absolute('/ai/decision-guide.json'),
};

export const crawlerProjects = {
  schemaVersion: CRAWLER_PROJECT_SCHEMA_VERSION,
  resourceReviewed: CRAWLER_REVIEWED,
  url: absolute('/ai/projects.json'),
  sourceUrl: absolute(CRAWLER_PATH),
  publisher: { name: facts.brand, url: SITE_URL },
  fieldNotes: {
    projectDates: 'The Year field from the published project page’s At a glance record, where available, or its published project period. It is separate from the publication and update dates of that page.',
    nullValues: 'A null value means the information is not recorded in this published record.',
    references: 'Links cited in the published record or its photograph credits. They provide building, material or image context; they do not independently confirm the installation role.',
    photographs: 'Photograph credits are reproduced as recorded. A picture of a venue illustrates its setting; the written project record defines the installation role.',
    materials: 'A material name records a product installed on that project. It does not establish maker approval, accreditation or endorsement.',
    standardGlance: 'The same seven public fields as the project page’s At a glance definition list. Materials include the published wallcovering names and any additional makers or products in that list, preserving their recorded wording.',
    installationRecord: 'Installation roles, methods and outcomes are reported by Mr Wallcover in its own published case studies. Extracts retain the source wording with Markdown presentation removed. External references provide context, not independent confirmation of the installation role.',
    pageContent: 'The complete published main content, generated from the final canonical HTML: Markdown, headings, links, image descriptions and captions, diagrams, film references, structured data and source dates. It matches the corresponding page in /ai/pages.json. Media links are references, not transcripts or interpretations of the visual content.',
    formats: 'Each project links to its canonical HTML, Markdown twin and individual JSON record. The aggregate includes the same complete records; individual JSON addresses allow a reader to retrieve one project at a time.',
  },
  projects: projects.map((project) => {
    const study = caseStudies.find((item) => item.frontmatter.slug === project.slug)?.frontmatter;
    const publicGlance = study ? glanceDetails(study) : null;
    const photographs = project.gallery.map((id) => {
      const picture = media(id);
      return {
        id,
        url: absolute(picture.src),
        alt: picture.alt,
        credit: study?.gallery.find((item) => item.id === id)?.credit ?? project.credits?.[id] ?? null,
        sourceUrls: referenceUrls(photoRecords[id]?.manifestNote ?? ''),
      };
    });
    return {
      id: `${absolute(projectHref(project.slug))}#project`,
      slug: project.slug,
      title: project.title,
      url: absolute(projectHref(project.slug)),
      recordType: project.caseStudy ? 'case-study' : 'project',
      role: project.role,
      client: project.client,
      location: project.location,
      projectDates: publicGlance?.year ?? project.dates ?? null,
      summary: project.summary,
      materials: study && (study.wallcoverings.length || publicGlance?.makers?.length) ? [...new Set([...study.wallcoverings, ...(publicGlance?.makers ?? [])])] : null,
      standardGlance: study ? glanceRows(study) : null,
      published: project.published ?? null,
      updated: project.updated ?? null,
      references: referenceUrls(sourceBySlug.get(project.slug) ?? ''),
      installationRecord: {
        basis: 'Company-reported project record',
        sourceUrl: absolute(projectHref(project.slug)),
        sections: installationSections(sourceBySlug.get(project.slug) ?? ''),
      },
      photographs,
    };
  }),
};
