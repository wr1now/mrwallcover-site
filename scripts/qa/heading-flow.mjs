/**
 * A heading never touches what follows it. For every route in docs/design/route-review.json, at 390 and
 * 1440px, each visible main h1, h2 and h3 needs at least 8px between its bottom edge and the start of the next
 * visible in-flow sibling that sits below it and overlaps it horizontally (see visibleTop). Screen-reader-only
 * headings (1px tall) and meta-refresh stubs are skipped. Part of npm run check:dist.
 *
 *   node scripts/qa/heading-flow.mjs [--dist dist] [--origin http://127.0.0.1:4321]
 *
 * --origin checks an already running server (astro dev or preview) instead of serving the built folder.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { launchBrowser, loadPage, serve } from '../visual-browser.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const dist = option('dist', 'dist');
const origin = option('origin');
const MIN_GAP = 8;
const WIDTHS = [390, 1440];
const PAGES = 4;
const { routes } = JSON.parse(await readFile('docs/design/route-review.json', 'utf8'));
const paths = routes.map((route) => route.path);

/** Runs in the page: one record per heading whose following sibling starts less than MIN_GAP below it. */
function collisions(minGap) {
  const shown = (el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && box.height > 1 && box.width > 1;
  };
  const inFlow = (el) => !['absolute', 'fixed'].includes(getComputedStyle(el).position);
  // Where the next element starts: its own edge when it paints one (fill, top rule, shadow, media) or holds text
  // itself, otherwise its highest visible child, so a wrapper whose child carries the margin is not a false collision.
  const paintsEdge = (el) => {
    const style = getComputedStyle(el);
    return style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none' || parseFloat(style.borderTopWidth) > 0
      || style.boxShadow !== 'none' || el.matches('img, picture, video, svg, canvas, iframe, input, select, textarea, button, hr')
      || [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  };
  const visibleTop = (el) => {
    const edge = el.getBoundingClientRect().top;
    if (paintsEdge(el)) return edge;
    const tops = [...el.children].filter((child) => shown(child) && inFlow(child)).map((child) => visibleTop(child));
    return tops.length ? Math.min(...tops) : edge;
  };
  const label = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.classList.length ? `.${[...el.classList].slice(0, 3).join('.')}` : ''}`;
  const found = [];
  for (const heading of document.querySelectorAll('main h1, main h2, main h3')) {
    if (heading.classList.contains('sr-only') || !shown(heading)) continue;
    const top = heading.getBoundingClientRect();
    for (let next = heading.nextElementSibling; next; next = next.nextElementSibling) {
      if (!shown(next) || !inFlow(next)) continue;
      const box = next.getBoundingClientRect();
      const below = box.top > top.top && box.bottom > top.bottom;
      const overlaps = box.left < top.right && box.right > top.left;
      if (!below || !overlaps) continue;
      const gap = visibleTop(next) - top.bottom;
      if (gap < minGap) found.push({ heading: `${label(heading)} "${heading.textContent.trim().replace(/\s+/g, ' ').slice(0, 60)}"`, next: label(next), gap: Math.round(gap * 10) / 10 });
      break;
    }
  }
  return found;
}

const server = origin ? { origin: origin.replace(/\/$/, ''), close: async () => {} } : await serve(dist);
const browser = await launchBrowser();
const failures = [];
let checked = 0;
let skipped = 0;
try {
  const queue = WIDTHS.flatMap((width) => paths.map((path) => ({ width, path })));
  const worker = async () => {
    const page = await browser.newPage();
    try {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const url = server.origin + job.path;
        const html = await (await fetch(url)).text();
        if (/<meta\b[^>]*http-equiv="refresh"/i.test(html)) { skipped += 1; continue; }
        await page.setViewport({ width: job.width, height: 900 });
        await loadPage(page, url);
        for (const found of await page.evaluate(collisions, MIN_GAP)) failures.push({ path: job.path, width: job.width, ...found });
        checked += 1;
      }
    } finally {
      await page.close();
    }
  };
  await Promise.all(Array.from({ length: PAGES }, worker));
} finally {
  await browser.close();
  await server.close();
}

for (const failure of failures) console.error(`${failure.path} @${failure.width}px: ${failure.heading} then ${failure.next}, gap ${failure.gap}px`);
assert.ok(checked > 0, 'no route was checked');
assert.deepEqual(failures, [], `${failures.length} heading(s) closer than ${MIN_GAP}px to the next element (${checked} page loads)`);
console.log(`Heading flow: ${paths.length} routes at ${WIDTHS.join(' and ')}px (${checked} page loads, ${skipped} redirect stubs skipped), every heading at least ${MIN_GAP}px clear of the element below it.`);
