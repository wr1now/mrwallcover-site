import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, launchBrowser } from '../scripts/visual-browser.mjs';

let server: any, browser: any;
before(async () => { server = await serve('dist'); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });
const route = '/advice/wallcovering-fire-ratings-uk/';

test('fire reference and hub: responsive reading, real evidence, decoder and keyboard navigation', { timeout: 90000 }, async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  const report: object[] = [];
  await mkdir('.review-screens/fire-release', { recursive: true });
  try {
    for (const width of [360, 390, 768, 1024, 1280, 1440]) {
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
      for (const path of ['/wallpapering/', route]) {
        const response = await page.goto(server.origin + path, { waitUntil: 'networkidle0' });
        assert.equal(response.status(), 200);
        const reading = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          brokenLinks: [...document.querySelectorAll<HTMLAnchorElement>('main a')].filter((a) => /\/(calculator|wallpapering\/(preparation|lining-and-adhesives))\//.test(a.getAttribute('href') ?? '')).map((a) => a.href),
          navTargets: [...document.querySelectorAll<HTMLAnchorElement>('[aria-label="Wallpapering"] a')].map((a) => a.getBoundingClientRect().height),
          footer: !!document.querySelector('.footer-directory'),
          classTextSize: document.querySelector('.fr-products code') ? parseFloat(getComputedStyle(document.querySelector('.fr-products code')!).fontSize) : null,
        }));
        assert.equal(reading.overflow, false, `${path} @${width}`);
        assert.deepEqual(reading.brokenLinks, [], 'unreleased calculator routes are absent');
        assert.ok(reading.navTargets.every((height) => height >= 44));
        assert.ok(reading.footer, 'new pages inherit the shared footer');
        if (reading.classTextSize !== null) assert.ok(reading.classTextSize >= 14, 'classification text stays readable');
        report.push({ path, width, ...reading });
        if (width === 390 || width === 1440) {
          await page.screenshot({ path: `.review-screens/fire-release/${path === route ? 'reference' : 'hub'}-${width}.jpg`, type: 'jpeg', quality: 85 });
          if (path === route) {
            await page.$eval('.fire-evidence', (el: HTMLElement) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.screenshot({ path: `.review-screens/fire-release/build-up-${width}.jpg`, type: 'jpeg', quality: 85 });
            await page.$eval('#product-muraspec-fbv-woven-type-i-360', (el: HTMLElement) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.screenshot({ path: `.review-screens/fire-release/evidence-${width}.jpg`, type: 'jpeg', quality: 85 });
          }
        }
      }
    }
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(server.origin + route, { waitUntil: 'networkidle0' });
    for (const [input, expected] of [['B-s2,d0', 'Read as B-s2,d0'], ['A1-s1,d0', 'Not a valid combination'], ['Class 0', 'not a European reaction-to-fire class']]) {
      await page.$eval('[name="notation"]', (el: HTMLInputElement, value: string) => { el.value = value; }, input);
      await page.$eval('[data-fr-decoder]', (form: HTMLFormElement) => form.requestSubmit());
      assert.ok((await page.$eval('[data-fr-out]', (el: HTMLElement) => el.textContent)).includes(expected), input);
    }
    await page.focus('[aria-label="Wallpapering"] a');
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement?.getAttribute('href') === '/advice/wall-preparation/'));
    await page.click('[data-menu-toggle]');
    assert.equal(await page.$eval('[data-menu-toggle]', (el: HTMLElement) => el.getAttribute('aria-expanded')), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('[data-menu-toggle]', (el: HTMLElement) => el.getAttribute('aria-expanded')), 'false');
    await page.setJavaScriptEnabled(false);
    await page.goto(server.origin + route, { waitUntil: 'networkidle0' });
    assert.equal(await page.$$eval('.fr-products tbody tr', (rows: Element[]) => rows.length), 26);
    const conflicting = await page.$eval('#product-muraspec-fbv-woven-type-i-360', (row: HTMLElement) => row.textContent);
    assert.match(conflicting, /not resolved/);
    assert.match(conflicting, /B-s2/);
    assert.ok(await page.$eval('[data-fr-decoder]', (form: HTMLFormElement) => form.hidden));
    assert.deepEqual(errors, []);
    await writeFile('.review-screens/fire-release/report.json', JSON.stringify({ report, errors, noJavaScript: true, decoder: true, keyboard: true }, null, 2));
  } finally { await page.close(); }
});
