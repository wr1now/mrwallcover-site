import type { APIRoute } from 'astro';
import { crawlerProjects } from '../../lib/ai-crawler';

export const GET: APIRoute = () => new Response(JSON.stringify(crawlerProjects, null, 2) + '\n', {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
