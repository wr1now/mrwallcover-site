#!/usr/bin/env node
/**
 * Glass Atelier verification runner (stage 5, step G7; dev tool, not part of
 * the build). Against a running `astro preview`, it:
 *
 *   1. screenshots (device scale 1) home, /materials/, one project page at
 *      1440x900 and 390x844, the mobile menu open at 390, the desktop header
 *      at 1440 and the dock at 390 after scrolling;
 *   2. runs axe-core (wcag2a, wcag2aa, wcag21aa, wcag22aa) on home, /materials/,
 *      the project page, /contact/ and one guide at both widths, plus once with
 *      html[data-effects="reduced"];
 *   3. runs a scripted keyboard pass of the navigation (Tab to the toggle,
 *      Enter opens, focus lands inside, Tab cycles, Escape closes and returns
 *      focus; desktop Tab order through the bar);
 *   4. writes a JSON summary that docs/glass-atelier/A11Y_RESULTS.md is written from.
 *
 * Usage:
 *   npx astro preview --port 4401 &
 *   MW_PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
 *   MW_AXE_PATH=/path/to/axe-core/axe.min.js \
 *   MW_SHOTS_OUT=/path/for/pngs node scripts/glass-verify.cjs
 *
 * Env: MW_BASE (default http://127.0.0.1:4401), MW_SHOTS_OUT (default ./.glass-shots, untracked),
 *      MW_SUMMARY (default <MW_SHOTS_OUT>/summary.json), MW_ONLY=shots|axe|keys to run one part.
 */
const fs = require('node:fs');
const path = require('node:path');

const modulePath = process.env.MW_PLAYWRIGHT_MODULE;
const axePath = process.env.MW_AXE_PATH;
if (!modulePath) {
  console.error('Set MW_PLAYWRIGHT_MODULE to a playwright package directory.');
  process.exit(2);
}
const { chromium } = require(modulePath);

const BASE = process.env.MW_BASE || 'http://127.0.0.1:4401';
const OUT = process.env.MW_SHOTS_OUT || path.join(process.cwd(), '.glass-shots');
const SUMMARY = process.env.MW_SUMMARY || path.join(OUT, 'summary.json');
const ONLY = process.env.MW_ONLY || 'shots,axe,keys';
const PROJECT = '/projects/browns-hotel-mayfair/';
const GUIDE = '/advice/choosing-wallcoverings/';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844, mobile: true };

async function settle(page) {
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
  await page.waitForTimeout(200);
}

async function context(browser, size, extra = {}) {
  return browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    isMobile: Boolean(size.mobile),
    hasTouch: Boolean(size.mobile),
    ...extra,
  });
}

async function shots(browser, summary) {
  const pages = [
    ['home', '/'],
    ['materials', '/materials/'],
    ['project', PROJECT],
  ];
  for (const size of [DESKTOP, PHONE]) {
    const ctx = await context(browser, size);
    const page = await ctx.newPage();
    for (const [name, route] of pages) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await settle(page);
      await page.screenshot({ path: path.join(OUT, `${name}-${size.width}.png`) });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      summary.shots.push({ name, width: size.width, overflow });
      console.log(`shot ${name.padEnd(9)} ${size.width} overflow=${overflow}`);
    }
    if (size.mobile) {
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await settle(page);
      await page.click('[data-menu-toggle]');
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(OUT, `nav-open-${size.width}.png`) });
      const dockHiddenWhileMenuOpen = await page.evaluate(() => getComputedStyle(document.querySelector('.dock')).display === 'none');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      // The dock must never cover the hero's buttons in the first view.
      const hero = await page.evaluate(() => {
        const d = document.querySelector('.dock').getBoundingClientRect();
        const buttons = Array.from(document.querySelectorAll('.hero-copy .btn')).map((b) => ({ text: b.textContent.trim(), bottom: b.getBoundingClientRect().bottom }));
        return { dockTop: d.top, dockHeight: d.height, buttons, coveredInFirstView: buttons.filter((b) => b.bottom <= window.innerHeight && b.bottom > d.top).map((b) => b.text) };
      });
      // A focused text field hides the dock (keyboard likely up).
      await page.goto(BASE + '/contact/', { waitUntil: 'networkidle' });
      await page.focus('input[type="text"], input[type="email"], textarea');
      const dockHiddenWithField = await page.evaluate(() => getComputedStyle(document.querySelector('.dock')).display === 'none');
      await page.evaluate(() => document.activeElement.blur());
      const dockBackAfterBlur = await page.evaluate(() => getComputedStyle(document.querySelector('.dock')).display !== 'none');
      // Scrolled to the end: the footer's last control sits above the dock.
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `dock-scrolled-${size.width}.png`) });
      const footer = await page.evaluate(() => {
        const d = document.querySelector('.dock').getBoundingClientRect();
        const last = document.querySelector('.site-footer [data-effects-toggle]').getBoundingClientRect();
        return { scrollY: window.scrollY, dockTop: d.top, footerLastBottom: last.bottom, viewport: window.innerHeight, covered: last.bottom > d.top };
      });
      summary.dock = { cells: await page.evaluate(() => document.querySelectorAll('.dock a, .dock button').length), dockHiddenWhileMenuOpen, dockHiddenWithField, dockBackAfterBlur, hero, footer };
      console.log('dock', JSON.stringify(summary.dock));
    } else {
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await settle(page);
      await page.screenshot({ path: path.join(OUT, `nav-desktop-${size.width}.png`), clip: { x: 0, y: 0, width: size.width, height: 140 } });
    }
    await ctx.close();
  }
}

async function runAxe(page) {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const results = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    return {
      violations: results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) , count: v.nodes.length })),
      passes: results.passes.length,
      incomplete: results.incomplete.map((v) => ({ id: v.id, count: v.nodes.length })),
    };
  });
}

async function axe(browser, summary) {
  if (!axePath) {
    console.error('Set MW_AXE_PATH to axe.min.js to run the axe pass.');
    summary.axe = null;
    return;
  }
  const routes = ['/', '/materials/', PROJECT, '/contact/', GUIDE];
  summary.axe = [];
  for (const size of [DESKTOP, PHONE]) {
    const ctx = await context(browser, size);
    const page = await ctx.newPage();
    for (const route of routes) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await settle(page);
      const result = await runAxe(page);
      summary.axe.push({ route, width: size.width, effects: 'default', ...result });
      console.log(`axe ${route.padEnd(36)} ${size.width} violations=${result.violations.length} (${result.violations.map((v) => `${v.id}:${v.impact}x${v.count}`).join(', ') || 'none'})`);
    }
    await ctx.close();
  }
  // Once more with the reduced-effects preference, on the phone, home page.
  const ctx = await context(browser, PHONE);
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.dataset.effects = 'reduced';
  });
  await settle(page);
  const result = await runAxe(page);
  summary.axe.push({ route: '/', width: PHONE.width, effects: 'reduced', ...result });
  console.log(`axe / (reduced effects) ${PHONE.width} violations=${result.violations.length}`);
  await page.screenshot({ path: path.join(OUT, `home-reduced-${PHONE.width}.png`) });
  await ctx.close();
}

const describe = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return 'body';
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + String(el.className).split(' ')[0] : ''} "${text}"`;
};

async function keys(browser, summary) {
  summary.keyboard = { phone: [], desktop: [] };
  // Phone: Tab to the toggle, Enter opens, focus inside, Tab cycles, Escape closes and returns focus.
  let ctx = await context(browser, PHONE);
  let page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const log = summary.keyboard.phone;
  const step = async (label) => log.push({ step: label, focus: await page.evaluate(describe), expanded: await page.getAttribute('[data-menu-toggle]', 'aria-expanded'), bodyLocked: await page.evaluate(() => document.body.classList.contains('nav-open')) });
  await page.keyboard.press('Tab'); // skip link
  await step('Tab 1');
  await page.keyboard.press('Tab'); // wordmark
  await step('Tab 2');
  await page.keyboard.press('Tab'); // Start
  await step('Tab 3');
  await page.keyboard.press('Tab'); // Menu toggle
  await step('Tab 4 (toggle)');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  await step('Enter (opens)');
  const links = await page.evaluate(() => document.querySelectorAll('[data-mobile-menu] a, [data-mobile-menu] button').length);
  for (let i = 0; i < links + 3; i += 1) {
    await page.keyboard.press('Tab');
    await step(`Tab in panel ${i + 1}`);
  }
  await page.keyboard.press('Shift+Tab');
  await step('Shift+Tab');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(60);
  await step('Escape (closes, focus returns)');
  // Space opens too; a link click closes.
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  await step('Space (opens)');
  await page.click('[data-mobile-menu] a[href="/contact/"]', { noWaitAfter: true });
  await page.waitForURL(/\/contact\/$/);
  log.push({ step: 'link activation navigated to /contact/ (menu closed with the page)', focus: '-', expanded: await page.getAttribute('[data-menu-toggle]', 'aria-expanded'), bodyLocked: false });
  // Resize to desktop closes the panel.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.click('[data-menu-toggle]');
  await page.waitForTimeout(100);
  await page.setViewportSize(DESKTOP);
  await page.waitForTimeout(100);
  log.push({ step: 'resize to 1440 while open', focus: await page.evaluate(describe), expanded: await page.getAttribute('[data-menu-toggle]', 'aria-expanded'), bodyLocked: await page.evaluate(() => document.body.classList.contains('nav-open')) });
  // No-JS: links reachable without the script.
  await ctx.close();
  ctx = await context(browser, PHONE, { javaScriptEnabled: false });
  page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  summary.keyboard.noJs = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('[data-mobile-menu] a'));
    const toggle = document.querySelector('[data-menu-toggle]');
    return { visibleLinks: links.filter((a) => a.getClientRects().length > 0).length, toggleVisible: toggle ? toggle.getClientRects().length > 0 : null };
  });
  await ctx.close();
  // Desktop Tab order through the bar.
  ctx = await context(browser, DESKTOP);
  page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  for (let i = 0; i < 11; i += 1) {
    await page.keyboard.press('Tab');
    summary.keyboard.desktop.push({ step: `Tab ${i + 1}`, focus: await page.evaluate(describe) });
  }
  await ctx.close();
  console.log('keyboard phone:', log.map((l) => `${l.step} -> ${l.focus} [expanded=${l.expanded}]`).join('\n  '));
  console.log('keyboard no-js:', JSON.stringify(summary.keyboard.noJs));
  console.log('keyboard desktop:', summary.keyboard.desktop.map((l) => l.focus).join(' > '));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const summary = { base: BASE, at: new Date().toISOString(), shots: [], pageErrors: [] };
  const browser = await chromium.launch({ headless: true });
  browser.on('disconnected', () => {});
  try {
    if (ONLY.includes('shots')) await shots(browser, summary);
    if (ONLY.includes('axe')) await axe(browser, summary);
    if (ONLY.includes('keys')) await keys(browser, summary);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(SUMMARY, JSON.stringify(summary, null, 2));
  console.log(`summary: ${SUMMARY}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
