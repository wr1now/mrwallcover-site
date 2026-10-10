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
import { publicFacts } from '../facts.json';
import {
  AWARD,
  PROJECTS_INDEX_URL,
  SINCE_TEXT,
  SINCE_YEAR,
  WASTAGE,
  WELL_KNOWN_FACTS_URL,
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
  };
}

export const GET: APIRoute = () =>
  new Response(JSON.stringify(wellKnownFacts(), null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
