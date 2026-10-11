import type { APIRoute } from 'astro';
import { decisionGuide } from '../../lib/ai-decision-guide';

export const GET: APIRoute = () => new Response(JSON.stringify(decisionGuide, null, 2) + '\n', {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
