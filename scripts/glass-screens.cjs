#!/usr/bin/env node
/**
 * Glass Atelier screenshot runner (dev tool, not part of the build).
 *
 * Captures the three art-direction variants (A champagne inset, B smoked
 * gallery, C clear minimal) over a running `astro preview`, by injecting the
 * scratch stylesheet scripts/glass-variants.preview.css with page.addStyleTag
 * and setting <html data-variant="a|b|c">. Nothing in that file is imported by
 * the site, so no variant code reaches dist/. tests/glass-system.test.ts
 * asserts that.
 *
 * Usage:
 *   npx astro preview --port 4401 &
 *   MW_PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/glass-screens.cjs
 *
 * Env:
 *   MW_PLAYWRIGHT_MODULE  path to a playwright package (required; the repo has none)
 *   MW_BASE               origin of the preview server (default http://127.0.0.1:4401)
 *   MW_SHOTS_OUT          output directory for PNGs (default ./.glass-shots, untracked)
 *   MW_VARIANTS           comma list, default "base,a,b,c" ("base" = no injected CSS)
 *   MW_PAGES              comma list of name=path pairs, default home, material, project
 *   MW_FULL               "1" to also save full-page captures as <name>-full.png
 */
const fs = require('node:fs');
const path = require('node:path');

const modulePath = process.env.MW_PLAYWRIGHT_MODULE;
if (!modulePath) {
  console.error('Set MW_PLAYWRIGHT_MODULE to a playwright package directory.');
  process.exit(2);
}
const { chromium } = require(modulePath);

const BASE = process.env.MW_BASE || 'http://127.0.0.1:4401';
const OUT = process.env.MW_SHOTS_OUT || path.join(process.cwd(), '.glass-shots');
const CSS = path.join(__dirname, 'glass-variants.preview.css');
const VARIANTS = (process.env.MW_VARIANTS || 'base,a,b,c').split(',').map((v) => v.trim()).filter(Boolean);
const PAGES = (process.env.MW_PAGES || 'home=/,material=/materials/paper-and-non-woven/,project=/projects/browns-hotel-mayfair/')
  .split(',')
  .map((pair) => pair.split('='))
  .map(([name, route]) => ({ name, route }));
const SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844, mobile: true },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    for (const size of SIZES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 1,
        isMobile: Boolean(size.mobile),
        hasTouch: Boolean(size.mobile),
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      page.on('pageerror', (err) => errors.push(`${size.width}: ${err.message}`));
      for (const { name, route } of PAGES) {
        for (const variant of VARIANTS) {
          await page.goto(BASE + route, { waitUntil: 'networkidle' });
          if (variant !== 'base') {
            await page.addStyleTag({ path: CSS });
            await page.evaluate((v) => {
              document.documentElement.dataset.variant = v;
            }, variant);
          }
          // Fonts, then any in-viewport image still decoding. Lazy images below
          // the fold never complete, so the wait is bounded.
          await page.evaluate(async () => {
            await document.fonts.ready;
            const pending = Array.from(document.images).filter((img) => {
              const box = img.getBoundingClientRect();
              return !img.complete && box.bottom > 0 && box.top < window.innerHeight;
            });
            await Promise.race([
              Promise.all(pending.map((img) => new Promise((resolve) => { img.onload = img.onerror = resolve; }))),
              new Promise((resolve) => setTimeout(resolve, 4000)),
            ]);
          });
          await page.waitForTimeout(250);
          const file = path.join(OUT, `${variant}-${name}-${size.width}.png`);
          await page.screenshot({ path: file });
          if (process.env.MW_FULL === '1') {
            await page.screenshot({ path: file.replace(/\.png$/, '-full.png'), fullPage: true });
          }
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
          console.log(`${variant.padEnd(5)} ${name.padEnd(9)} ${size.width}  overflow=${overflow}`);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  if (errors.length) {
    console.error('page errors:', errors);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
