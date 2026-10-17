/** Isolated visual review. No enquiry is submitted and no external browser session is used. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, launchBrowser } from '../visual-browser.mjs';

const server = await serve('dist');
const baseline = await serve('../mw-main-base/dist');
const browser = await launchBrowser();
const out = '.review-screens/calculator';
await mkdir(out, { recursive: true });
const owner = '?f=other-roll&rw=55&rl=10&m=straight&r=65&w=230x265';
const observations = [], performance = [];
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.method() !== 'GET' || !request.url().startsWith(server.origin)) request.abort();
    else request.continue();
  });
  for (const width of [320, 360, 375, 390, 768, 1024, 1280, 1440]) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    for (const query of ['', owner]) {
      await page.goto(server.origin + '/calculator/' + query, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      const result = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          h1: document.querySelectorAll('main h1').length,
          menuCalculator: [...document.querySelectorAll('.mobile-links a')].some(a => a.getAttribute('href') === '/calculator/'),
          headerFits: innerWidth < 1280 || (rect('.primary-nav').left >= rect('.wordmark').right + 8 && rect('.header-action').right <= rect('.site-header').right - 8),
          actions: [...document.querySelectorAll('main .mw-action')].filter(a => a.getClientRects().length).every(a => a.getBoundingClientRect().height >= 44),
          title: document.title,
        };
      });
      assert.equal(result.overflow, false, `calculator ${query ? 'result' : 'first load'} @${width}`);
      assert.equal(result.h1, 1);
      assert.equal(result.menuCalculator, true);
      assert.equal(result.headerFits, true, `desktop menu @${width}`);
      assert.equal(result.actions, true, `action targets @${width}`);
      assert.deepEqual(errors, []);
      observations.push({ width, state: query ? 'result' : 'first load', ...result });
      if ([390, 1440].includes(width)) {
        if (query) await page.$eval('#qc-docket-heading', el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await page.screenshot({ path: `${out}/${query ? 'order' : 'first-load'}-${width}.png` });
        if (query) {
          await page.$eval('.qc-rolls', el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await page.screenshot({ path: `${out}/cutting-plan-${width}.png` });
        }
      }
    }
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(server.origin + '/calculator/' + owner, { waitUntil: 'networkidle0' });
  await page.$eval('[data-quantity]', form => form.requestSubmit());
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const focus = await page.evaluate(() => ({ id: document.activeElement.id, y: document.activeElement.getBoundingClientRect().top, headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom }));
  assert.equal(focus.id, 'qc-docket-heading');
  assert.ok(focus.y >= focus.headerBottom, 'result focus clears the sticky header with reduced motion');
  await page.focus('input[name="width"]');
  assert.equal(await page.$eval('[data-dock]', d => getComputedStyle(d).display), 'none');
  await page.click('[data-menu-toggle]');
  assert.equal(await page.$eval('[data-dock]', d => getComputedStyle(d).display), 'none');
  assert.equal(await page.$eval('.mobile-links a[href="/calculator/"]', a => a.getAttribute('aria-current')), 'page');
  await page.keyboard.press('Escape');
  await page.click('[data-effects-toggle]');
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.effects), 'reduced');
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateMediaType('print');
  assert.equal(await page.$eval('.qc-step', el => getComputedStyle(el).display), 'none');
  assert.ok(await page.$eval('.qc-result', el => getComputedStyle(el).display) !== 'none');
  await page.pdf({ path: `${out}/order-print.pdf`, format: 'A4', printBackground: true });
  await page.emulateMediaType('screen');
  await page.setJavaScriptEnabled(false);
  await page.goto(server.origin + '/calculator/', { waitUntil: 'networkidle0' });
  assert.equal(await page.$eval('[data-docket]', el => getComputedStyle(el).display), 'none');
  assert.ok(await page.$('noscript a[href="/advice/quantities/"]'));
  assert.ok(await page.$('main a[href="/contact/?intent=install"]'));
  assert.equal(await page.$$eval('.footer-group', groups => groups.every(g => g.open)), true);
  await page.close();

  for (const route of ['/', '/advice/', '/advice/quantities/']) {
    for (const [label, origin] of [['main', baseline.origin], ['updated', server.origin]]) {
      const sample = await browser.newPage();
      await sample.setViewport({ width: 390, height: 844 });
      await sample.evaluateOnNewDocument(() => {
        window.__reviewCLS = 0;
        new PerformanceObserver(list => {
          for (const item of list.getEntries()) if (!item.hadRecentInput) window.__reviewCLS += item.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await sample.goto(origin + route, { waitUntil: 'networkidle0' });
      performance.push({ route, build: label, ...await sample.evaluate(() => ({
        cls: window.__reviewCLS,
        resources: performance.getEntriesByType('resource').reduce((total, item) => total + item.transferSize, 0),
        scripts: performance.getEntriesByType('resource').filter(item => item.initiatorType === 'script').reduce((total, item) => total + item.transferSize, 0),
      })) });
      await sample.close();
    }
  }
  await writeFile(`${out}/review.json`, JSON.stringify({ observations, errors, reducedMotion: true, resultFocus: focus, noJavaScript: true, print: true, dockMenu: true, performance }, null, 2));
  console.log('Calculator visual review: eight widths, first load/result, menu/dock, reduced effects/motion, no-JS and print pass. Screenshots, PDF and performance observations saved.');
} finally {
  await browser.close();
  await server.close();
  await baseline.close();
}
