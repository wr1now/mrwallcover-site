/**
 * /logo-512.png: the site's own logo mark (public/favicon.svg, the gold "M" on the dark
 * square) rendered at 512 x 512 for the schema `logo`. Google asks for at least 112 px;
 * the 180 px /apple-touch-icon.png stays as the touch icon. Rendered at build time from
 * the SVG, so no binary lives in the repository and the two can never drift apart.
 */
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

export const LOGO_SIZE = 512;

export const GET: APIRoute = () => {
  const svg = readFileSync(path.join(process.cwd(), 'public/favicon.svg'), 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: LOGO_SIZE } }).render().asPng();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
