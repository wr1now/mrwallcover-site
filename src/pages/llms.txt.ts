import type { APIRoute } from 'astro';
import { SITE_URL } from '../config';
import factSheet from '../content/fact-sheet.json';
import { areaHref, areas, faqItems, projectHref, projects, specialismHref, specialisms } from '../lib/content';

const abs = (path: string) => new URL(path, SITE_URL).href;

export const GET: APIRoute = () => {
  const lines = [
    `# ${factSheet.name}`,
    '',
    `> ${factSheet.oneLine}`,
    '',
    `${factSheet.name}, ${factSheet.place}, founded by ${factSheet.founder.name}. Contact: ${factSheet.email} or ${SITE_URL}/contact/.`,
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
    `- [About](${abs('/about/')}): ${factSheet.founder.name}, founder`,
    '',
    '## Makers named on published case studies',
    ...factSheet.makers.map((maker) => `- ${maker.name}: ${abs(projectHref(maker.project))}`),
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
