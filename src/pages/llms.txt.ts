/**
 * /llms.txt in the llmstxt.org shape: an H1 with the name, a blockquote
 * summary, a few plain paragraphs, then H2 sections that are lists of
 * "- [Title](url): note" lines, ending with "## Optional" for the files a
 * reader can skip when context is short.
 *
 * Every line is generated from src/data/facts.json and the content files.
 * Drafts never reach it: publishedGuides, editorialPages and projects are
 * already filtered. This file is optional for search engines and promises
 * nothing about ranking; the crawlable HTML pages come first.
 */
import { publishedGuides, guideHref } from '../lib/guides';
import fireRatingsPage from '../content/fire-ratings/page.json';
import type { APIRoute } from 'astro';
import { ANALYTICS_SRC, SITE_URL } from '../config';
import facts from '../data/facts.json';
import aiReader from '../data/ai-reader.json';
import professionals from '../content/professionals.json';
import { areaHref, areas, editorialPages, faqItems, materials, privacy, projectHref, projects, specialismHref, specialisms } from '../lib/content';
import { caseStudyCount, trustMakers, trustSummary } from '../lib/trust';
import { AWARD, FOUNDER_SUMMARY, SINCE_TEXT, WASTAGE, buyerQuestions, enquiryRoutes, projectFacts, serviceFacts } from '../lib/ai-layer-data';

/** Sourced specifics appended to each Public commissions note (src/lib/ai-layer-data.ts). */
const factsBySlug = new Map(projectFacts.map((item) => [item.slug, item]));
function projectNote(slug: string): string {
  const item = factsBySlug.get(slug);
  if (!item) return '';
  const parts = [
    `Where: ${item.area}.`,
    `Client: ${item.client}.`,
    item.partners ? `With: ${item.partners}.` : '',
    item.makersAndProducts.length ? `Installed: ${item.makersAndProducts.join('; ')}.` : '',
    item.scope ? `Scope: ${item.scope}.` : '',
    item.techniques.length ? `Method: ${item.techniques.join('; ')}.` : '',
    `Markdown: ${item.markdownUrl}`,
  ];
  return ` ${parts.filter(Boolean).join(' ')}`;
}

const abs = (path: string) => new URL(path, SITE_URL).href;
const BRAND_NAME = facts.brand;
const FOUNDER_NAME = facts.founder.name;

/** One llms.txt list line. The note is a single line with no trailing full stop doubled. */
const entry = (title: string, path: string, note: string) => `- [${title}](${abs(path)}): ${note.replace(/\s+/g, ' ').trim()}`;

export const GET: APIRoute = () => {
  const guides = [...publishedGuides].sort((a, b) => a.frontmatter.order - b.frontmatter.order);
  const lines = [
    `# ${BRAND_NAME}`,
    '',
    `> ${facts.description}`,
    '',
    `${BRAND_NAME} surveys, manages, supplies, installs and looks after wallcoverings for prime hotels, flagship retail and private homes, covering ${facts.coverage}. It also installs architectural, furniture and window films; trained at Solar Screen's headquarters in Luxembourg in window films (Solar Screen) and architectural and furniture wrapping film (Cover Styl'). Contact: ${facts.email} or ${abs('/contact/')}. Profiles: ${facts.profiles.map((p) => `${p.name} ${p.url}`).join(', ')}.`,
    '',
    `Facts for answer engines: in the trade since 2012. Aftercare is included: a return visit about four to six weeks after completion and a twelve-month workmanship guarantee. Private clients are not named. Residential work appears only by street or area, with the owner's agreement. The site publishes no prices, ratings or response-time promises. Copy reviewed ${facts.lastReviewed}.`,
    '',
    `At a glance (the homepage proof strip): ${trustSummary}`,
    '',
    `${AWARD ? `${AWARD.text}. ` : ''}${WASTAGE.statement} Every published project, with venue, area, dates, client, products, scope and method as its case study records them, is in ${abs('/projects.json')}; the fact sheet with services, areas and enquiry routes is in ${abs('/.well-known/facts.json')}.`,
    '',
    `If the canonical domain cannot be retrieved, use the published-content mirror at ${aiReader.rawBaseUrl}README.md. It lists the same published page text and complete project records with their canonical sources, original dates and evidence limits. The canonical manifest also links an individual JSON record for every page, avoiding a whole-corpus download for a single page.`,
    '',
    '## Key facts',
    entry(SINCE_TEXT, `${facts.founder.path}#${facts.founder.fragment}`, FOUNDER_SUMMARY),
    entry('Founder portrait', facts.founder.image, `${FOUNDER_NAME}, founder of ${BRAND_NAME}; photograph © ${BRAND_NAME}, reuse terms at ${abs('/image-use/')}`),
    ...(AWARD ? [entry(AWARD.text, '/about/', 'as named on the trophy; the About page shows it')] : []),
    entry('Wastage allowance', '/services/#surveying', WASTAGE.statement),
    entry(`${caseStudyCount} published case studies`, '/projects/', 'every case study names the venue, the dates, the products and the scope; counted from the published pages'),
    entry('Makers installed', '/materials/#makers-installed', `${trustMakers.map((m) => m.name).join(', ')} and others, each linked to real install photographs`),
    ...facts.programmeFigures.map((figure) => `- [${figure.fact}](${figure.url}): source, our Instagram post ${figure.source}`),
    ...serviceFacts.workflow.map((pillar) => entry(`Service: ${pillar.name}`, `/services/#${pillar.id}`, pillar.includes.join(' '))),
    ...enquiryRoutes.map((route) => entry(`Enquire: ${route.route}`, '/contact/', route.note)),
    '',
    '## Core pages',
    entry('Wallcovering Installation AI Crawler', '/wallcovering-installation-ai-crawler/', 'project fit and evidence, material decisions, delivery stages, aftercare terms and exclusions, procurement questions and a blank project brief; the same facts are available to people and assistants'),
    entry('Mr Wallcover in plain facts', '/for-ai/', 'what the practice does, where it works, who runs it, the services, and the published projects with the products installed on them'),
    entry('Services', '/services/', 'surveying, project management, supply, installation and aftercare'),
    entry('Materials', '/materials/', 'paper, grasscloth, silk, hand-painted papers, murals, contract vinyl and acoustic wallcoverings'),
    entry('Projects', '/projects/', 'public commissions and the hotels on the public record'),
    entry('Details', '/details/', 'our own close-up photographs of seams, internal corners, edges and joins, each linked to its project'),
    entry('For professionals', '/professionals/', 'designers, hotels and packages alongside main contractors'),
    entry('Aftercare', '/aftercare/', 'care by material and the guarantee'),
    entry('FAQ', '/faq/', 'cost, lead times, preparation, supply and warranty'),
    entry('About', '/about/', `${FOUNDER_NAME}, founder`),
    entry('Get in touch', '/get-in-touch/', 'direct contact methods and areas covered'),
    entry('Contact', '/contact/', 'request a quotation'),
    '',
    '## Wallcovering Guide',
    entry('Wallcovering Guide', '/advice/', 'choosing, preparation, quantities and care'),
    entry(fireRatingsPage.title, guideHref(fireRatingsPage.slug), fireRatingsPage.description),
    entry('How much wallpaper to order', '/advice/quantities/', 'count drops, not square metres: width, height and trim, the pattern repeat, half-drop, doors and windows, worked by hand, with the spare from one batch'),
    ...guides.map((guide) => entry(guide.frontmatter.title, guideHref(guide.frontmatter.slug), guide.frontmatter.description)),
    '',
    '## Wallpapering',
    entry('Wallpaper calculator', '/calculator/', 'cuts every drop from the rolls (free, straight, half, third and quarter drop; doors, windows, reveals, niches and returns; rooms as one run), shows the cutting plan, working rolls, one spare on its own line and the order, and lists primer, lining and paste from data sheets; stairs, slopes, ceilings and panel sets go to an enquiry; no price'),
    entry('Wallpapering', '/wallpapering/', 'the quantity calculator, wall preparation by type and condition, lining papers, primers and pastes with their data sheets, and the hanging guides'),
    entry('Preparing walls for wallpaper', '/wallpapering/preparation/', 'treatment, primer, lining grade and site inspection for each wall type and condition; the maker first, then the house standard'),
    entry('Lining papers, pastes and primers', '/wallpapering/lining-and-adhesives/', 'Gardz, Erfurt lining grades, Wallrock Power and maker-named pastes, with coverage as printed, data sheet links and dates; the Mr Wallcover house paste scale, with maker instructions taking precedence'),
    '',
    '## Services by material',
    ...specialisms.map((s) => entry(s.name, specialismHref(s.slug), s.description)),
    '',
    '## Material families',
    ...materials.items.map((m) => entry(m.name, `/materials/${m.slug}/`, m.appearance)),
    '',
    '## For professionals',
    ...professionals.map((p) => entry(p.name, `/professionals/${p.slug}/`, p.description)),
    // Editorial pages appear here only once published (drafts are never built).
    ...(editorialPages.length
      ? ['', '## Editorial pages', ...editorialPages.map((p) => entry(p.frontmatter.title, p.frontmatter.path, p.frontmatter.description))]
      : []),
    '',
    '## Areas',
    ...areas.map((a) => entry(a.heading, areaHref(a.slug), a.description)),
    '',
    '## Public commissions',
    ...projects.map((p) => entry(p.title, projectHref(p.slug), `${p.role}${p.dates ? `, ${p.dates}` : ''}. ${p.summary}${projectNote(p.slug)}`)),
    '',
    '## Frequently asked',
    ...faqItems.map((f) => entry(f.question, `/faq/#${f.id}`, f.paragraphs[0])),
    '',
    // One line per buyer question (src/data/buyer-answers.json): the short form where the audit gives one, otherwise the answer.
    '## Buyer questions',
    ...buyerQuestions.map((q) => entry(q.question, `/for-ai/#${q.id}`, q.short ?? q.answer)),
    '',
    '## Optional',
    entry('Complete page manifest', '/ai/index.json', 'every published canonical page with its title, source dates and HTML, Markdown and JSON addresses; generated from the same build'),
    entry('Complete published page corpus', '/ai/pages.json', 'all published main content as Markdown, with headings, image descriptions, diagram text and page structured data; cite the original canonical page'),
    entry('Wallpapering and calculator reference data', '/ai/wallpapering.json', 'public product coverage, maker guidance, preparation rules and roll formats; retains sources, evidence status and house-practice distinctions; not a calculation API'),
    entry('Fire ratings reference data', '/ai/fire-ratings.json', 'published product, standard, regulation and source records with their limits; classification depends on the exact tested build-up'),
    entry('Project decision guide JSON', '/ai/decision-guide.json', 'conditional project fit, company-reported installation evidence, material guidance, complete aftercare terms and an unsent briefing template'),
    entry('Business and services JSON', '/ai/business.json', 'structured public identity, coverage, contact and service catalogue'),
    entry('Published projects JSON', '/ai/projects.json', 'complete published project pages with structured facts, full Markdown, media descriptions, source dates and individual JSON record links; null means absent from the published record'),
    entry('Published projects index', '/projects.json', 'every published project with its case study and Markdown version, venue, area, dates, client, products, scope and method, each value read from its case study'),
    entry('Fact sheet, extended', '/.well-known/facts.json', 'the facts.json fields plus start year, services and what each includes, areas served, enquiry routes and the wastage allowance'),
    entry('Full text', '/llms-full.txt', 'the main content of every published page, each headed by its title and canonical URL'),
    entry('Facts as data', '/facts.json', 'the public fact sheet: brand, description, founder, email, coverage, profiles'),
    entry('Feed', '/feed.xml', 'Atom feed of the published guides and case studies, with their dates'),
    entry('Sitemap', '/sitemap-index.xml', 'every published page'),
    entry('Accessibility', '/accessibility/', 'how the site is built for keyboard, mobile and reduced-motion use'),
    entry('Privacy', '/privacy/', ANALYTICS_SRC ? privacy.analyticsOn.llms : 'how enquiry details are handled; no cookies and no analytics by default'),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
