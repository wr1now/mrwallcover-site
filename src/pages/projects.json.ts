/**
 * /projects.json: one entry per published project, each linked to its case
 * study and Markdown twin, with the venue, area, years, client, products,
 * scope, preparation and method that page records. Generated from
 * src/lib/ai-layer-data.ts; see src/data/ai-sources.json for where each field
 * comes from. /ai/projects.json (src/lib/ai-crawler.ts) is a separate resource
 * with the same project list.
 */
import type { APIRoute } from 'astro';
import { projectsIndex } from '../lib/ai-layer-data';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(projectsIndex, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
