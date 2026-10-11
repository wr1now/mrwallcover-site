import type { APIRoute } from 'astro';
import { crawlerBusiness } from '../../lib/ai-crawler';

export const GET: APIRoute = () => new Response(JSON.stringify(crawlerBusiness, null, 2) + '\n', {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
