import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { serve, launchBrowser, loadPage } from '../visual-browser.mjs';
const server = await serve('dist');
const browser = await launchBrowser().catch(async (error) => { await server.close(); throw error; });
const results = [];
await mkdir('docs/design/enquiry-release', { recursive: true });
try {
  for (const width of [360, 390, 768, 1024, 1280, 1440]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    await loadPage(page, `${server.origin}/contact/?intent=source&service=wallcovering&topic=material%3Agrasscloth-and-weaves`);
    await page.click('[name="replyBy"][value="email"]');
    await page.type('[name="email"]', 'example@example.invalid');
    const state = await page.evaluate(() => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      topic: document.querySelector('[data-enquiry-context-text]').textContent,
      marketingChecked: document.querySelector('[name="marketing"]').checked,
      marketingAvailable: !document.querySelector('[name="marketing"]').disabled,
      privacyLink: !!document.querySelector('form a[href="/privacy/"]'),
    }));
    assert.equal(state.overflow, false);
    assert.equal(state.topic, 'Grasscloth and natural weaves');
    assert.equal(state.marketingChecked, false);
    assert.equal(state.marketingAvailable, true);
    assert.equal(state.privacyLink, true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    if ([390, 1440].includes(width)) await page.screenshot({ path: `docs/design/enquiry-release/contact-${width}.jpg`, type: 'jpeg', quality: 82, fullPage: true });
    results.push(state);
    await page.close();
  }
  await writeFile('docs/design/enquiry-release/layout.json', JSON.stringify({ syntheticExample: true, noSubmission: true, results }, null, 2) + '\n');
  console.log(JSON.stringify(results));
} finally { await browser.close(); await server.close(); }
