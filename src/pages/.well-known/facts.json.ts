/**
 * /.well-known/facts.json: the public fact sheet (exactly what /facts.json
 * serves, from the same allowlist) plus the sourced specifics answer engines
 * ask for: start year, services and what each includes, areas served, how to
 * enquire, the wastage allowance, the award once the fact sheet carries it,
 * and a short index of the published projects. Every added value comes from
 * src/lib/ai-layer-data.ts. No phone number is in the source, so none can
 * reach this file.
 */
import type { APIRoute } from 'astro';
import { SITE_URL } from '../../config';
import { publicFacts } from '../facts.json';
import {
  AWARD,
  PROJECTS_INDEX_URL,
  SINCE_TEXT,
  SINCE_YEAR,
  WASTAGE,
  WELL_KNOWN_FACTS_URL,
  BUYER_FACTS,
  buyerQuestions,
  areaFacts,
  enquiryRoutes,
  projectFacts,
  serviceFacts,
} from '../../lib/ai-layer-data';

export function wellKnownFacts() {
  const base = publicFacts();
  return {
    ...base,
    url: WELL_KNOWN_FACTS_URL,
    sameAs: base.url,
    inTradeSince: SINCE_YEAR,
    inTradeSinceText: SINCE_TEXT,
    // facts.award (when the fact sheet has it) is already copied above, unchanged; this is the printed line.
    ...(AWARD ? { awardText: AWARD.text } : {}),
    services: serviceFacts,
    areasServed: areaFacts,
    enquiryRoutes,
    wastageAllowance: WASTAGE,
    projects: {
      url: PROJECTS_INDEX_URL,
      count: projectFacts.length,
      items: projectFacts.map((p) => ({ title: p.title, url: p.url, markdownUrl: p.markdownUrl, area: p.area, years: p.years, client: p.client, role: p.role, makersAndProducts: p.makersAndProducts })),
    },
    // The AI answer audit's proposed keys (src/data/buyer-answers.json factsAdditions), added alongside; nothing above is replaced.
    ...BUYER_FACTS,
    buyerQuestions: {
      url: `${SITE_URL}/for-ai/#questions`,
      count: buyerQuestions.length,
      note: 'Answered only from the published record. Where more is to be confirmed, the answer stops at what the site already states.',
      items: buyerQuestions.map((q) => ({ id: q.id, question: q.question, answer: q.answer, url: `${SITE_URL}/for-ai/#${q.id}`, sources: q.sources })),
    },
  };
}

export const GET: APIRoute = () =>
  new Response(JSON.stringify(wellKnownFacts(), null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
