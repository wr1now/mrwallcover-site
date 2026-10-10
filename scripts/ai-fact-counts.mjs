#!/usr/bin/env node
/**
 * Fact counts for the AI-crawling layer, read from a built site. Used to put
 * before/after numbers in pull-request bodies and by tests/ai-layer-data.test.ts
 * as a no-shrink floor. Read-only.
 *
 * Usage: node scripts/ai-fact-counts.mjs [distDir] [--json]
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'dist');

export function leafCount(value) {
  if (value === null || typeof value !== 'object') return 1;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.reduce((sum, child) => sum + leafCount(child), 0);
}

function typeCount(value) {
  if (value === null || typeof value !== 'object') return 0;
  const self = !Array.isArray(value) && '@type' in value ? 1 : 0;
  const children = Array.isArray(value) ? value : Object.values(value);
  return self + children.reduce((sum, child) => sum + typeCount(child), 0);
}

async function walk(dir, test) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, test)));
    else if (test(entry.name)) out.push(full);
  }
  return out;
}

async function exists(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

function jsonLdNodes(html) {
  let nodes = 0;
  for (const [, raw] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) nodes += typeCount(JSON.parse(raw));
  return nodes;
}

function textStats(text) {
  return { lines: text.split('\n').filter((l) => l.trim()).length, links: (text.match(/\]\(https?:\/\/[^)\s]+\)/g) ?? []).length };
}

export async function counts(distDir = dist) {
  const json = {};
  for (const rel of ['facts.json', '.well-known/facts.json', 'projects.json', 'ai/business.json', 'ai/projects.json', 'ai/decision-guide.json']) {
    const file = path.join(distDir, rel);
    json[`/${rel}`] = (await exists(file)) ? leafCount(JSON.parse(await readFile(file, 'utf8'))) : null;
  }
  const text = {};
  for (const rel of ['llms.txt', 'llms-full.txt', 'for-ai/index.md']) {
    const file = path.join(distDir, rel);
    text[`/${rel}`] = (await exists(file)) ? textStats(await readFile(file, 'utf8')) : null;
  }
  const htmlFiles = await walk(distDir, (n) => n.endsWith('.html'));
  let jsonLdTotal = 0;
  let published = 0;
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    if (/<meta name="robots" content="noindex">/.test(html) || /http-equiv="refresh"/.test(html)) continue;
    published += 1;
    jsonLdTotal += jsonLdNodes(html);
  }
  const forAi = path.join(distDir, 'for-ai/index.html');
  const twins = (await walk(distDir, (n) => n === 'index.md')).length;
  const images = (await walk(path.join(distDir, 'media'), () => true)).length;
  return {
    json,
    text,
    jsonLd: { forAi: (await exists(forAi)) ? jsonLdNodes(await readFile(forAi, 'utf8')) : null, allPages: jsonLdTotal },
    pages: { html: htmlFiles.length, published, twins },
    images: { distMediaFiles: images },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  counts().then((result) => console.log(JSON.stringify(result, null, 2)));
}
