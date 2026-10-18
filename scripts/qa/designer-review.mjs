/** Local built-site review. Synthetic draft only; no external account or submission. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchBrowser, loadPage, serve } from '../visual-browser.mjs';

const argument = name => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const output = resolve(argument('--out') || '.review-screens/designer-portal');
await mkdir(output, { recursive: true });
const server = await serve('dist');
const baseline = argument('--base-dist') ? await serve(argument('--base-dist')) : null;
const browser = await launchBrowser();
const observations = [];
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1000 });
    if (baseline) {
      await loadPage(page, baseline.origin + '/professionals/designers/');
      await page.screenshot({ path: `${output}/before-designers-${width}.jpg`, type: 'jpeg', quality: 82 });
    }
    await loadPage(page, server.origin + '/professionals/designers/');
    await page.screenshot({ path: `${output}/after-designers-${width}.jpg`, type: 'jpeg', quality: 82 });
    await page.$eval('#installation-price-guide', element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 120));
    await page.screenshot({ path: `${output}/guide-${width}.jpg`, type: 'jpeg', quality: 82 });
    await loadPage(page, server.origin + '/designer-portal/');
    await page.waitForFunction(() => !document.querySelector('astro-island[component-export="default"]')?.hasAttribute('ssr'));
    await page.$eval('[data-designer-portal]', element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 110));
    await page.screenshot({ path: `${output}/workspace-${width}.jpg`, type: 'jpeg', quality: 82 });
    await page.click('.dp-steps button:nth-of-type(2)');
    const add = await page.$('.dp-editor > button'); await add.click();
    const inputs = await page.$$('.dp-room input');
    // Only synthetic room labels and basic measured dimensions are entered.
    for (const [i, value] of [[0, 'Study'], [1, 'Ground floor']]) await inputs[i].type(value);
    const dimensions = await page.$$('.dp-dimensions input');
    await dimensions[0].type('3000'); await dimensions[1].type('2700');
    await page.$eval('.dp-wall', element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 125));
    await page.screenshot({ path: `${output}/measurements-${width}.jpg`, type: 'jpeg', quality: 82 });
    observations.push({ width, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), netArea: await page.$eval('.dp-area strong', element => element.textContent) });
  }
  await writeFile(`${output}/checks.json`, JSON.stringify({ fixture: 'Synthetic draft; cloud disabled; no submission', observations, browserErrors: errors }, null, 2) + '\n');
  if (errors.length || observations.some(x => x.overflow)) throw new Error('Visual capture reported a browser error or horizontal overflow');
  console.log(`Designer review captures: ${output}`);
} finally { await browser.close(); await server.close(); if (baseline) await baseline.close(); }
