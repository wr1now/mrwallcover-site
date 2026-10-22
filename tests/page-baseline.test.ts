import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Per-page baseline for every indexable page in the built site: properties the 22 Oct 2026 audit found
// true of all 130 pages but that nothing else in CI enforced. Canonical, description, JSON-LD, one H1,
// title length and en-GB stay in dist-guards, seo-step2 and ai-layer; this file does not repeat them.

const SITE = 'https://www.mrwallcover.com';

async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

// Text a visitor can read: scripts (JSON-LD included), styles, templates and comments are not shown.
const visibleText = (html: string) => html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ');

// 592,416 bytes is the largest page on 22 Oct 2026 (/projects/, which carries the full project explorer).
// The ceiling sits about 10% above it, so that page can take a few more records but cannot double unnoticed.
const HTML_BUDGET = 650_000;

// Words that belong to interface state, not to a page's name. None appears in a title today.
const UI_TITLE = /\b(menu|click|button|loading|untitled|lorem|undefined)\b/i;

// Build-state labels that must never reach a published page. Neither appears in visible text today; if a
// guide ever needs "staging" in its ordinary sense, allow that one page here rather than loosen the pattern.
const BUILD_LABEL = /private preview|\bstaging\b/i;

test('every indexable page meets the per-page publishing baseline', async () => {
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  const problems: string[] = [];
  let checked = 0;
  for (const file of await htmlFiles('dist')) {
    const html = await readFile(file, 'utf8');
    // Redirect stubs and noindex utilities are not published pages; dist-guards covers them separately.
    if (/<meta name="robots" content="noindex/.test(html) || /http-equiv="refresh"/.test(html)) continue;
    checked += 1;

    // (1) A share image on this site that exists in the build.
    const og = html.match(/<meta property="og:image" content="https:\/\/www\.mrwallcover\.com\/([^"]+)"/);
    if (!og) problems.push(`${file}: og:image missing or not on ${SITE}`);
    else {
      const asset = decodeURIComponent(og[1].split(/[?#]/)[0]);
      if (!existsSync(join('dist', asset))) problems.push(`${file}: og:image /${asset} is not in dist`);
    }

    // (2) No placeholder links.
    if (/href="#"/.test(html)) problems.push(`${file}: href="#"`);

    // (3) No build-state labels in visible text.
    const label = visibleText(html).match(BUILD_LABEL);
    if (label) problems.push(`${file}: visible label "${label[0]}"`);

    // (4) The canonical URL is listed in the sitemap.
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (!canonical) problems.push(`${file}: no canonical`);
    else if (!sitemap.includes(`<loc>${canonical}</loc>`)) problems.push(`${file}: canonical ${canonical} not in sitemap-0.xml`);

    // (5) Every image has an alt attribute, header and footer included; alt="" is the decorative case.
    for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
      if (!/\balt="/.test(img)) problems.push(`${file}: <img> without alt: ${img.slice(0, 120)}`);
    }

    // (6) HTML size budget.
    const bytes = Buffer.byteLength(html);
    if (bytes > HTML_BUDGET) problems.push(`${file}: ${bytes} bytes, over the ${HTML_BUDGET} budget`);

    // (7) The title names the page, not interface state.
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    if (UI_TITLE.test(title)) problems.push(`${file}: title "${title}" contains interface text`);
  }
  // 130 indexable pages on 22 Oct 2026. The floor only stops an empty or partial dist passing vacuously;
  // the no-loss guard owns page counts.
  assert.ok(checked >= 120, `checked ${checked} indexable pages`);
  assert.deepEqual(problems, []);
});
