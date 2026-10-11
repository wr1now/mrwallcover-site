#!/usr/bin/env node
/**
 * Homepage content counts, shared by the no-loss guard and its committed baseline.
 *
 *   node scripts/home-counts.mjs <dist dir> [sha]   prints the counts as JSON
 *
 * Measured inside <main> of <dist>/index.html:
 *   sections      <section> elements
 *   headings      <h2> section headings
 *   projectLinks  distinct /projects/<slug>/ pages linked (cards, lists and the Calico section)
 *   images        distinct photographs (<img> file name without format, width or -preview suffix)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function homeCounts(html) {
  const main = (html.match(/<main[\s\S]*?<\/main>/) ?? [html])[0];
  const shot = (u) => u.split('/').pop().replace(/\.[a-z0-9]+$/i, '').replace(/-(?:\d{3,5}w?|preview|thumb)$/i, '');
  const images = [...new Set([...main.matchAll(/<img\s[^>]*src="([^"]+)"/g)].map((m) => shot(m[1])))].sort();
  const projectSlugs = [...new Set([...main.matchAll(/href="\/projects\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))].sort();
  return {
    sections: (main.match(/<section[\s>]/g) ?? []).length,
    headings: (main.match(/<h2[\s>]/g) ?? []).length,
    projectLinks: projectSlugs.length,
    images: images.length,
    projectSlugs,
    imageList: images,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dist = process.argv[2];
  if (!dist) {
    console.error('Usage: node scripts/home-counts.mjs <dist dir> [sha]');
    process.exit(2);
  }
  const counts = homeCounts(readFileSync(path.join(dist, 'index.html'), 'utf8'));
  console.log(JSON.stringify({ ...(process.argv[3] ? { commit: process.argv[3] } : {}), ...counts }, null, 2));
}
