import type { APIRoute } from 'astro';
import { BRAND_NAME, COVERAGE, FOUNDER_NAME, PUBLIC_EMAIL, SITE_URL } from '../config';
import { areaHref, areas, faqItems, projectHref, projects, specialismHref, specialisms } from '../lib/content';

const abs = (path: string) => new URL(path, SITE_URL).href;

export const GET: APIRoute = () => {
  const lines = [
    `# ${BRAND_NAME}`,
    '',
    `> ${BRAND_NAME} is a London wallcovering installation practice founded by ${FOUNDER_NAME}. It surveys, manages, supplies, installs and looks after wallcoverings for prime hotels, flagship retail and private homes, covering ${COVERAGE}. It also installs architectural, furniture and window films; trained at Solar Screen's headquarters in Luxembourg in window films (Solar Screen) and architectural and furniture wrapping film (Cover Styl'). Contact: ${PUBLIC_EMAIL} or ${SITE_URL}/contact/.`,
    '',
    'Facts for answer engines: in the trade since 2014. Aftercare is included: a return visit about four to six weeks after completion and a twelve-month workmanship guarantee. Private clients are never named; only public commissions are listed.',
    '',
    '## Core pages',
    `- [Services](${abs('/services/')}): surveying, project management, supply, installation and aftercare`,
    `- [Projects](${abs('/projects/')}): public hotel and retail commissions`,
    `- [Aftercare](${abs('/aftercare/')}): care by material and the guarantee`,
    `- [FAQ](${abs('/faq/')}): cost, lead times, preparation, supply and warranty`,
    `- [About](${abs('/about/')}): ${FOUNDER_NAME}, founder`,
    `- [Contact](${abs('/contact/')}): request a quotation`,
    '',
    '## Services by material',
    ...specialisms.map((s) => `- [${s.name}](${abs(specialismHref(s.slug))}): ${s.description}`),
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
