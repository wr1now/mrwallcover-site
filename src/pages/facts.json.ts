/**
 * /facts.json: the public fact sheet as data, generated from
 * src/data/facts.json through an allowlist. Only the fields named in
 * PUBLIC_FACT_FIELDS are copied; a new field in the fact sheet stays private
 * until it is added here. The phone number is never in the fact sheet, so it
 * can never reach this file. The site-wide JSON-LD (src/lib/schema.ts) reads
 * the same fact sheet, so the two always agree.
 */
import type { APIRoute } from 'astro';
import { SITE_URL } from '../config';
import facts from '../data/facts.json';

export const PUBLIC_FACT_FIELDS = ['brand', 'description', 'founder', 'email', 'place', 'coverage', 'profiles', 'lastReviewed', 'award'] as const;

export function publicFacts() {
  const source = facts as Record<string, unknown>;
  // Plain JSON, no licence statement: reuse terms are Dorin's decision, not the build's.
  const out: Record<string, unknown> = {
    name: `${facts.brand} public facts`,
    url: `${SITE_URL}/facts.json`,
    isBasedOn: `${SITE_URL}/for-ai/`,
  };
  for (const field of PUBLIC_FACT_FIELDS) {
    if (!(field in source)) continue;
    if (field === 'founder') {
      out.founder = {
        name: facts.founder.name,
        jobTitle: facts.founder.jobTitle,
        url: `${SITE_URL}${facts.founder.path}#${facts.founder.fragment}`,
      };
    } else {
      out[field] = source[field];
    }
  }
  out.website = SITE_URL;
  out.contact = `${SITE_URL}/contact/`;
  return out;
}

export const GET: APIRoute = () =>
  new Response(JSON.stringify(publicFacts(), null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
