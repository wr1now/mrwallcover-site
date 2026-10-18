import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser, loadPage, serve } from '../scripts/visual-browser.mjs';

async function clickText(page: any, selector: string, text: string) {
  const handles = await page.$$(selector);
  for (const handle of handles) if ((await handle.evaluate((el: HTMLElement) => el.textContent?.trim())) === text) { await handle.click(); return; }
  throw new Error(`Control not found: ${text}`);
}
async function field(page: any, label: string, value: string, root = '') {
  const labels = await page.$$(`${root} label`);
  for (const item of labels) {
    if (await item.evaluate((el: HTMLElement, text: string) => el.firstElementChild?.textContent?.trim() === text, label)) {
      const input = await item.$('input,select,textarea');
      assert.ok(input, label);
      if (await input.evaluate((el: HTMLElement) => el.tagName === 'SELECT')) await input.select(value);
      else { await input.focus(); await input.press('End'); const length = await input.evaluate((el: HTMLInputElement) => el.value.length); for (let i = 0; i < length; i++) await input.press('Backspace'); if (value) await input.type(value); }
      return;
    }
  }
  throw new Error(`Field not found: ${label}`);
}
async function section(page: any, index: number) {
  await page.click(`.dp-steps button:nth-of-type(${index})`);
  await page.waitForFunction((n: number) => document.querySelector('.dp-steps button[aria-current="step"]') === document.querySelector(`.dp-steps button:nth-of-type(${n})`), {}, index);
}
async function noOverflow(page: any) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page must fit viewport');
}

test('public guide filters real types and exact-product examples; no invented unknown prices', async () => {
  const server = await serve('dist'), browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 920 });
      await loadPage(page, server.origin + '/professionals/designers/');
      assert.equal(await page.$$eval('[data-price-card]', (els: HTMLElement[]) => els.length), 9);
      await page.type('[data-price-search]', 'Arte Grandeur');
      await page.waitForFunction(() => document.querySelector('[data-price-count]')?.textContent === '1 matching wallpaper group');
      const specialist = await page.$eval('[data-price-card]:not([hidden])', (el: HTMLElement) => el.innerText);
      assert.match(specialist, /Grandeur/); assert.doesNotMatch(specialist, /£120|£26|£0\b/);
      await page.$eval('[data-price-search]', (el: HTMLInputElement) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.select('[data-price-group]', 'printed-paper');
      assert.equal(await page.$$eval('[data-price-card]:not([hidden])', (els: HTMLElement[]) => els.length), 1);
      await page.select('[data-price-group]', '');
      await page.type('[data-price-search]', 'unknown-product-no-match');
      assert.equal(await page.$eval('[data-price-empty]', (el: HTMLElement) => el.hidden), false);
      await noOverflow(page);
    }
  } finally { await browser.close(); await server.close(); }
});

test('private draft journey works on desktop/mobile; area changes reset confirmation and drafts round-trip', async () => {
  const server = await serve('dist'), browser = await launchBrowser();
  const downloads = await mkdtemp(join(tmpdir(), 'mw-designer-browser-'));
  try {
    const page = await browser.newPage(), errors: string[] = [], external: string[] = [];
    page.on('pageerror', (error: Error) => errors.push(error.message));
    page.on('request', (request: any) => { if (/^https?:/.test(request.url()) && !request.url().startsWith(server.origin)) external.push(request.url()); });
    const cdp = await page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 920 });
      await loadPage(page, server.origin + '/designer-portal/');
      await page.waitForSelector('[data-designer-portal]');
      assert.match(await page.$eval('.dp-activation', (el: HTMLElement) => el.textContent), /awaiting activation/);
      await field(page, 'Project name or reference', 'Synthetic browser review');
      await section(page, 2);
      await clickText(page, 'button', 'Add a room / area');
      await field(page, 'Room / area', 'Study'); await field(page, 'Floor / phase reference', 'Ground');
      await field(page, 'Covered width', '3000'); await field(page, 'Covered height', '2700');
      assert.equal(await page.$eval('.dp-area strong', (el: HTMLElement) => el.textContent), '8.10 m²');
      await clickText(page, 'summary', 'Uncovered openings to deduct · 0');
      await clickText(page, 'button', 'Add an opening');
      await field(page, 'Width', '900', '.dp-opening'); await field(page, 'Height', '2100', '.dp-opening');
      assert.equal(await page.$eval('.dp-area strong', (el: HTMLElement) => el.textContent), '6.21 m²');
      await page.click('.dp-scope > .dp-checkbox input');
      assert.equal(await page.$eval('.dp-scope > .dp-checkbox input', (el: HTMLInputElement) => el.checked), true);
      await field(page, 'Covered height', '2800');
      assert.equal(await page.$eval('.dp-scope > .dp-checkbox input', (el: HTMLInputElement) => el.checked), false);
      await noOverflow(page);
      await section(page, 3); await noOverflow(page);
      await section(page, 4); assert.match(await page.$eval('.dp-editor', (el: HTMLElement) => el.textContent), /PDF|drawings/);
      await section(page, 5);
      const request = await page.$('button.mw-action--primary[disabled]'); assert.ok(request, 'budget issuance must stay disabled before activation');
      assert.equal(await page.$('.dp-totals'), null, 'an incomplete brief must not display a complete estimate');
      await noOverflow(page);
    }
    await clickText(page, 'button', 'Download draft');
    let files: string[] = [];
    for (let i = 0; i < 100; i++) { files = (await readdir(downloads)).filter(x => x.endsWith('.json')); if (files.length) break; await new Promise(resolve => setTimeout(resolve, 30)); }
    assert.equal(files.length, 1);
    const path = join(downloads, files[0]), draft = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(draft.name, 'Synthetic browser review'); assert.equal(draft.items[0].walls[0].heightMm, 2800);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-designer-portal]');
    const upload = await page.$('input[aria-label="Open a project draft JSON file"]');
    await upload.uploadFile(path);
    await page.waitForFunction(() => document.querySelector('.dp-live-message')?.textContent?.includes('Draft opened'));
    assert.equal(await page.$eval('input[maxlength="160"]', (el: HTMLInputElement) => el.value), 'Synthetic browser review');
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.deepEqual(external, [], 'private workspace must not send draft data or analytics externally');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); await rm(downloads, { recursive: true, force: true }); }
});

test('private workspace stays out of indexing and public content exports', async () => {
  const html = await readFile('dist/designer-portal/index.html', 'utf8');
  assert.match(html, /name="robots" content="noindex,\s*nofollow"/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.doesNotMatch(await readFile('dist/sitemap-0.xml', 'utf8'), /\/designer-portal\//);
  assert.equal((await readdir('dist/designer-portal')).includes('index.md'), false);
});
