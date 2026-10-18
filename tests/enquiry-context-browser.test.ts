import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type { Page } from 'puppeteer-core';

async function click(page: Page, selector: string) {
  // Cancel the site's smooth scrolling so the real pointer click lands on its intended control.
  await page.$eval(selector, (element: HTMLElement) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.click(selector);
}

import { serve, launchBrowser } from '../scripts/visual-browser.mjs';
import { EMAIL_MARKETING_VERSION, PRIVACY_NOTICE_VERSION, ENQUIRY_TOPICS } from '../src/lib/enquiry-context.ts';

test('published topic actions and private notice projections use the shared intake contract', async () => {
  for (const topic of ENQUIRY_TOPICS) {
    const html = await readFile(`dist${topic.path}index.html`, 'utf8');
    // Care is served by an inline form, rather than a contact action.
    if (topic.path === '/aftercare/') continue;
    assert.ok(html.includes(`topic=${encodeURIComponent(topic.id)}`), `${topic.path}: a shared action carries the reviewed topic`);
  }
  for (const file of ['dist/contact/index.html', 'dist/aftercare/index.html']) {
    const html = await readFile(file, 'utf8');
    assert.ok(html.includes(EMAIL_MARKETING_VERSION));
    assert.ok(html.includes(PRIVACY_NOTICE_VERSION));
    assert.match(html, /Read the privacy notice/);
    assert.doesNotMatch(html, /<script[^>]*umami|window\.__mwTrack = function/);
  }
  for (const file of ['dist/privacy/index.html', 'dist/privacy/index.md', 'dist/llms-full.txt']) {
    const text = await readFile(file, 'utf8');
    assert.match(text, /occasional Mr Wallcover project and material updates/);
    assert.match(text, /does not run analytics/);
  }
});

test('real form behavior preserves explicit context and email choice at mobile and desktop, without sending a live enquiry', async () => {
  const server = await serve('dist');
  const browser = await launchBrowser().catch(async (error) => { await server.close(); throw error; });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900 });
      let intercepted: string | null = null;
      const external: string[] = [];
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        if (request.url().startsWith('https://formsubmit.co/')) {
          intercepted = request.postData() || '';
          await request.respond({ status: 200, contentType: 'text/html', body: '<p>Intercepted test submission. No message sent.</p>' });
        } else if (!request.url().startsWith(server.origin) && !request.url().startsWith('data:')) {
          external.push(request.url());
          await request.abort();
        } else await request.continue();
      });
      await page.goto(`${server.origin}/services/window-film/`, { waitUntil: 'load' });
      const action = await page.$eval('main a[href*="topic=service%3Awindow-film"]', (link: HTMLAnchorElement) => link.getAttribute('href'));
      assert.ok(action?.includes('service=window-film'));
      await page.goto(server.origin + action, { waitUntil: 'load' });
      assert.equal(await page.$eval('[name="service"]', (field: HTMLSelectElement) => field.value), 'window-film');
      assert.equal(await page.$eval('[data-enquiry-context]', (panel: HTMLElement) => panel.hidden), false);
      assert.equal(await page.$eval('[data-enquiry-context-text]', (node: HTMLElement) => node.textContent), 'Window film installation');
      await page.type('[name="name"]', 'Ada Test');
      await page.type('[name="message"]', 'Please discuss the windows in this room.');
      await click(page, '[data-clear-enquiry-context]');
      assert.equal(await page.$eval('[name="topic"]', (field: HTMLInputElement) => field.value), '');
      assert.equal(await page.$eval('[name="service"]', (field: HTMLSelectElement) => field.value), '');
      assert.equal(await page.$eval('[name="name"]', (field: HTMLInputElement) => field.value), 'Ada Test');
      assert.equal(await page.$eval('[name="service"]', (field: HTMLSelectElement) => document.activeElement === field), true);
      const chosenService = width === 390 ? 'architectural-film' : 'aftercare';
      await page.select('[name="service"]', chosenService);
      assert.equal(await page.$eval('[name="sourceDeclared"]', (field: HTMLSelectElement) => field.value), '');
      assert.equal(await page.$eval('[name="marketing"]', (field: HTMLInputElement) => field.checked || !field.disabled), false);
      await click(page, '[name="replyBy"][value="email"]');
      await page.type('[name="email"]', 'ada@example.invalid');
      assert.equal(await page.$eval('[data-email-marketing]', (panel: HTMLElement) => panel.hidden), false);
      await click(page, '[name="marketing"]');
      await click(page, '[name="replyBy"][value="phone"]');
      assert.equal(await page.$eval('[name="marketing"]', (field: HTMLInputElement) => field.checked), false);
      assert.equal(await page.$eval('[name="marketing"]', (field: HTMLInputElement) => field.disabled), true);
      await click(page, '[name="replyBy"][value="email"]');
      assert.equal(await page.$eval('[name="marketing"]', (field: HTMLInputElement) => field.checked), false);
      await page.select('[name="sourceDeclared"]', 'instagram');
      await click(page, '[name="marketing"]');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await Promise.all([page.waitForNavigation(), click(page, 'form [type="submit"]')]);
      assert.ok(intercepted, 'the actual native POST was intercepted before reaching FormSubmit');
      assert.ok(intercepted!.includes(chosenService));
      assert.match(intercepted!, new RegExp('name="kind"\\r\\n\\r\\n' + (chosenService === 'aftercare' ? 'aftercare' : 'enquiry') + '\\r\\n'));
      assert.ok(intercepted!.includes('instagram'));
      assert.ok(intercepted!.includes(EMAIL_MARKETING_VERSION));
      assert.ok(intercepted!.includes(PRIVACY_NOTICE_VERSION));
      assert.ok(intercepted!.includes('name="marketing"'));
      assert.deepEqual(external, [], 'no analytics or other external request made by the form');
      await page.close();
    }
    const invalid = await browser.newPage();
    await invalid.setRequestInterception(true);
    invalid.on('request', async (request) => {
      if (request.url().startsWith(server.origin) || request.url().startsWith('data:')) await request.continue();
      else await request.abort();
    });
    await invalid.goto(`${server.origin}/contact/?service=window-film&topic=private%40example.invalid&sourceDeclared=instagram&utm_source=instagram&audience=contractor`, { waitUntil: 'load' });
    assert.equal(await invalid.$eval('[name="topic"]', (field: HTMLInputElement) => field.value), '');
    assert.equal(await invalid.$eval('[name="sourceDeclared"]', (field: HTMLSelectElement) => field.value), '');
    assert.equal(await invalid.$eval('[name="audience"]', (field: HTMLSelectElement) => field.value), 'developer');
    await click(invalid, 'form [type="submit"]');
    assert.equal(await invalid.$eval('[data-error-summary]', (summary: HTMLElement) => summary.hidden), false);
    assert.ok(await invalid.$('form a[href="/privacy/"]'));
    await invalid.close();
    const nojs = await browser.newPage();
    await nojs.setJavaScriptEnabled(false);
    await nojs.goto(`${server.origin}/contact/`);
    assert.ok(await nojs.$('a[href="mailto:info@mrwallcover.com"]'));
    await nojs.close();
  } finally {
    await browser.close();
    await server.close();
  }
});
