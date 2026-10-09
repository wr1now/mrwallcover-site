import type { APIRoute } from 'astro';
import { SITE_URL } from '../config';
import facts from '../data/facts.json';
import { areaHref, areas, editorialPages, faqItems, projectHref, projects, specialismHref, specialisms } from '../lib/content';

const abs = (path: string) => new URL(path, SITE_URL).href;
const BRAND_NAME = facts.brand;
const FOUNDER_NAME = facts.founder.name;

export const GET: APIRoute = () => {
  const lines = [
    `# ${BRAND_NAME}`,
    '',
    `> ${facts.description}`,
    '',
    `${BRAND_NAME} surveys, manages, supplies, installs and looks after wallcoverings for prime hotels, flagship retail and private homes, covering ${facts.coverage}. It also installs architectural, furniture and window films; trained at Solar Screen's headquarters in Luxembourg in window films (Solar Screen) and architectural and furniture wrapping film (Cover Styl'). Contact: ${facts.email} or ${abs('/contact/')}. Profiles: ${facts.profiles.map((p) => `${p.name} ${p.url}`).join(', ')}.`,
    '',
    'Facts for answer engines: in the trade since 2014. Aftercare is included: a return visit about four to six weeks after completion and a twelve-month workmanship guarantee. Private clients are never named; only public commissions are listed.',
    '',
    '## Core pages',
    `- [Services](${abs('/services/')}): surveying, project management, supply, installation and aftercare`,
    `- [Materials](${abs('/materials/')}): paper, grasscloth, silk, hand-painted papers, murals, contract vinyl and acoustic wallcoverings`,
    `- [Projects](${abs('/projects/')}): public commissions, with a hotel list of names cleared for publication`,
    `- [For professionals](${abs('/professionals/')}): designers, hotels and packages alongside main contractors`,
    `- [Aftercare](${abs('/aftercare/')}): care by material and the guarantee`,
    `- [FAQ](${abs('/faq/')}): cost, lead times, preparation, supply and warranty`,
    `- [About](${abs('/about/')}): ${FOUNDER_NAME}, founder`,
    `- [Contact](${abs('/contact/')}): request a quotation`,
    '',
    '## Services by material',
    ...specialisms.map((s) => `- [${s.name}](${abs(specialismHref(s.slug))}): ${s.description}`),
    // Editorial pages appear here only once published (drafts are never built).
    ...(editorialPages.length
      ? ['', '## Guides', ...editorialPages.map((p) => `- [${p.frontmatter.title}](${abs(p.frontmatter.path)}): ${p.frontmatter.description}`)]
      : []),
    '',
    '## Areas',
    ...areas.map((a) => `- [${a.heading}](${abs(areaHref(a.slug))}): ${a.description}`),
    '',
    '## Public commissions',
    ...projects.map((p) => `- [${p.title}](${abs(projectHref(p.slug))}): ${p.role}${p.dates ? `, ${p.dates}` : ''}. ${p.summary}`),
    '',
    '## Frequently asked',
    ...faqItems.map((f) => `- ${f.question} ${f.paragraphs[0]}`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
