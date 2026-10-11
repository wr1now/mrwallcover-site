/**
 * Homepage trust signals, from data only. The proof strip, the "Dorin Burcus and the team" block,
 * llms.txt and /for-ai/ all read this module, so the three cannot drift apart.
 * - Case-study count: the published case studies (drafts are already filtered out), never typed in.
 * - Programme figures: facts.json programmeFigures entries that carry a short 'figure' label
 *   (the five Instagram-sourced figures Dorin approved; each links to its case study).
 * - Makers: six makers whose installs are documented on /materials/ (makers-installed.json),
 *   each linked to its anchor there.
 * - Team: the About page's own sentences (about.json howWeWork and founderSummary), quoted as written.
 */
import facts from '../data/facts.json';
import { about, caseStudies } from './content';

export const caseStudyCount = caseStudies.length;

export const programmeFigures = (facts.programmeFigures as { fact: string; url: string; source: string; figure?: string; where?: string }[])
  .filter((item) => item.figure && item.where)
  .map((item) => ({ figure: item.figure!, where: item.where!, href: new URL(item.url).pathname, source: item.source }));

export const trustMakers = [
  { name: 'de Gournay', href: '/materials/#maker-de-gournay' },
  { name: 'Fromental', href: '/materials/#maker-fromental' },
  { name: 'House of Hackney', href: '/materials/#maker-house-of-hackney' },
  { name: 'Phillip Jeffries', href: '/materials/#maker-phillip-jeffries' },
  { name: 'Muraspec', href: '/materials/#maker-muraspec' },
  { name: 'Calico Wallpaper', href: '/materials/#maker-calico-wallpaper' },
];

const items = about.howWeWork.items;
const find = (re: RegExp) => {
  const hit = items.find((item) => re.test(item));
  if (!hit) throw new Error(`trust: no About "How we work" sentence matches ${re}`);
  return hit;
};

/** The team facts, each an About sentence as written (src/content/about.json howWeWork). */
export const teamFacts = {
  founder: about.founderSummary,
  supervision: find(/RAMS/),
  team: find(/six wallpaper hangers and six decorators/),
  hours: find(/^Nights and weekends/),
};

export const trustSummary = `In the trade since 2012; ${caseStudyCount} published case studies; makers installed include ${trustMakers.slice(0, -1).map((m) => m.name).join(', ')} and ${trustMakers.at(-1)!.name}. ${teamFacts.team} ${teamFacts.supervision}`;
