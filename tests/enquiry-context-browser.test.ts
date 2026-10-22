import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import type { HTTPRequest, Page } from 'puppeteer-core';

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
    // "I am a…" sits in the short form: its professional prompt shows there while the fuller brief stays closed.
    const role = await browser.newPage();
    await role.setViewport({ width: 1280, height: 900 });
    await role.setRequestInterception(true);
    role.on('request', async (request) => {
      if (request.url().startsWith(server.origin) || request.url().startsWith('data:')) await request.continue();
      else await request.abort();
    });
    await role.goto(`${server.origin}/contact/`, { waitUntil: 'load' });
    assert.equal(await role.$eval('[data-professional-help]', (help: HTMLElement) => help.offsetHeight), 0, 'no prompt before a role is chosen');
    await role.select('#audience', 'designer');
    const prompt = await role.$eval('[data-professional-help]', (help: HTMLElement) => ({
      builderHidden: document.querySelector<HTMLElement>('[data-builder]')!.hidden,
      height: help.offsetHeight,
      inField: Boolean(help.closest('#field-audience')),
      text: help.textContent || '',
    }));
    assert.equal(prompt.builderHidden, true);
    assert.ok(prompt.inField && prompt.height > 0 && prompt.text.startsWith('Include material codes'), 'the designer prompt is visible beside the choice');
    // The WhatsApp offer in the attachment help is an underlined word on the line, not the icon button.
    if (await role.$('#attachment-help a[data-wa]')) {
      const wa = await role.$eval('#attachment-help a[data-wa]', (link: HTMLElement) => {
        const style = getComputedStyle(link);
        const words = document.createRange();
        words.selectNodeContents(link);
        const after = link.nextSibling!;
        const stop = document.createRange();
        stop.selectNodeContents(after);
        return { display: style.display, line: style.textDecorationLine, glyph: getComputedStyle(link.querySelector('.wa-glyph')!).display, top: words.getBoundingClientRect().top, stopTop: stop.getBoundingClientRect().top };
      });
      assert.deepEqual([wa.display, wa.line, wa.glyph], ['inline', 'underline', 'none']);
      assert.ok(Math.abs(wa.top - wa.stopTop) < 1, 'the link text and its full stop share a line box');
    }
    // The thank-you buttons stay evenly spaced: the booking hours line is not inside the first cell.
    await role.goto(`${server.origin}/thank-you/`, { waitUntil: 'load' });
    const gaps = await role.$eval('main a[data-book]', (book: HTMLElement) => {
      const cells = [...book.parentElement!.children].filter((cell) => !cell.classList.contains('booking-hint') && cell.getClientRects().length > 0).map((cell) => cell.getBoundingClientRect());
      const pairs = cells.slice(1).map((cell, i) => [cells[i], cell]);
      return pairs.filter(([a, b]) => Math.abs(a.top - b.top) < 1).map(([a, b]) => Math.round(b.left - a.right));
    });
    assert.ok(gaps.length > 0 && gaps.every((gap) => gap === gaps[0]), `even gaps in the thank-you row: ${gaps.join(', ')}`);
    await role.close();
    const nojs = await browser.newPage();
    await nojs.setJavaScriptEnabled(false);
    await nojs.goto(`${server.origin}/contact/`);
    assert.ok(await nojs.$('a[href^="mailto:info@mrwallcover.com"]'));
    // The notice and the direct card open the email with a subject.
    assert.ok(await nojs.$('.enquiry-nojs a[href="mailto:info@mrwallcover.com?subject=Wallcovering%20enquiry"]'));
    assert.ok(await nojs.$('.contact-direct a[href="mailto:info@mrwallcover.com?subject=Wallcovering%20enquiry"]'));
    await nojs.close();
  } finally {
    await browser.close();
    await server.close();
  }
});

test('native FormSubmit sends validated optional reply channels and retains provider CAPTCHA, without sending a live enquiry', async () => {
  const server = await serve('dist');
  const browser = await launchBrowser().catch(async (error) => { await server.close(); throw error; });
  const cases = [
    { reply: 'email', email: 'ada@example.invalid', phone: 'abc', expectedEmail: 'ada@example.invalid', expectedPhone: '' },
    { reply: 'email', email: 'ada@example.invalid', phone: '07700 900000', expectedEmail: 'ada@example.invalid', expectedPhone: '07700 900000' },
    { reply: 'phone', email: 'invalid-address', phone: '07700 900000', expectedEmail: '', expectedPhone: '07700 900000' },
    { reply: 'phone', email: 'ada@example.invalid', phone: '07700 900000', expectedEmail: 'ada@example.invalid', expectedPhone: '07700 900000' },
  ];
  try {
    for (const width of [390, 1440]) {
      for (const scenario of cases) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 900 });
        let intercepted: string | null = null;
        await page.setRequestInterception(true);
        page.on('request', async (request) => {
          if (request.url().startsWith('https://formsubmit.co/')) {
            intercepted = request.postData() || '';
            await request.respond({ status: 200, contentType: 'text/html', body: '<p>Intercepted test submission. No message sent.</p>' });
          } else if (request.url().startsWith(server.origin) || request.url().startsWith('data:')) await request.continue();
          else await request.abort();
        });
        await page.goto(`${server.origin}/contact/`, { waitUntil: 'load' });
        await page.waitForFunction(() => document.querySelector('[data-enquiry-form]')?.hasAttribute('data-ready'));
        await page.type('[name="name"]', 'Ada Test');
        await page.type('[name="message"]', 'Testing reply validation without sending.');
        await click(page, `[name="replyBy"][value="${scenario.reply}"]`);
        await page.type('[name="email"]', scenario.email);
        await page.type('[name="phone"]', scenario.phone);
        await Promise.all([page.waitForNavigation(), click(page, 'form [type="submit"]')]);
        assert.ok(intercepted, 'the actual native POST was intercepted before reaching FormSubmit');
        const fields = new Map([...intercepted!.matchAll(/name="([^"]+)"\r\n\r\n([^\r\n]*)\r\n/g)].map((match) => [match[1], match[2]]));
        assert.equal(fields.get('email'), scenario.expectedEmail, `${scenario.reply} reply @${width}: optional email is validated`);
        assert.equal(fields.get('phone'), scenario.expectedPhone, `${scenario.reply} reply @${width}: optional phone is validated`);
        assert.equal(fields.get('replyBy'), scenario.reply, 'the preferred reply is preserved');
        assert.equal(fields.get('_captcha'), 'true', 'the receiving provider retains its CAPTCHA check');
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

test('a large photograph is reduced to 2,400 px before it is listed and sent; HEIC and PDF go as chosen', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mw-photos-'));
  const server = await serve('dist');
  const browser = await launchBrowser().catch(async (error) => { await server.close(); throw error; });
  try {
    // A 4032 x 3024 phone-sized JPEG stored on its side (EXIF orientation 6), a small JPEG, a PDF and a HEIC.
    const photo = path.join(dir, 'IMG_0001.jpg');
    await sharp({ create: { width: 4032, height: 3024, channels: 3, background: '#b8a58c', noise: { type: 'gaussian', mean: 128, sigma: 24 } } })
      .jpeg({ quality: 90 }).withMetadata({ orientation: 6 }).toFile(photo);
    const small = path.join(dir, 'small.jpg');
    await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#8c7a63' } }).jpeg().toFile(small);
    const pdf = path.join(dir, 'plan.pdf');
    await writeFile(pdf, `%PDF-1.4\n${'0'.repeat(50_000)}\n%%EOF\n`);
    const heic = path.join(dir, 'IMG_0002.heic');
    await writeFile(heic, Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(60_000, 7)]));
    const before = Object.fromEntries(await Promise.all([photo, small, pdf, heic].map(async (file) => [path.basename(file), (await stat(file)).size])));

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 900 });
    let submission: HTTPRequest | null = null;
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      if (request.url().startsWith('https://formsubmit.co/')) {
        submission = request;
        await request.respond({ status: 200, contentType: 'text/html', body: '<p>Intercepted test submission. No message sent.</p>' });
      } else if (!request.url().startsWith(server.origin) && !request.url().startsWith('data:')) await request.abort();
      else await request.continue();
    });
    await page.goto(`${server.origin}/contact/`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('[data-enquiry-form]')?.hasAttribute('data-ready'));
    // Both reply fields stay on the page whichever is preferred.
    for (const reply of ['email', 'phone']) {
      await click(page, `[name="replyBy"][value="${reply}"]`);
      assert.deepEqual(await page.evaluate(() => [document.querySelector<HTMLElement>('#field-email')!.hidden, document.querySelector<HTMLElement>('#field-phone')!.hidden]), [false, false]);
    }
    const input = await page.$('#photos');
    await input!.uploadFile(photo, small, pdf, heic);
    await page.waitForFunction(() => document.querySelectorAll('[data-file-list] li').length === 5, { timeout: 30_000 });
    const files = await page.evaluate(async () => Promise.all([...document.querySelector<HTMLInputElement>('#photos')!.files!].map(async (file) => {
      let size: number[] | null = null;
      if (file.type === 'image/jpeg') { const bitmap = await createImageBitmap(file); size = [bitmap.width, bitmap.height]; bitmap.close(); }
      return { name: file.name, type: file.type, bytes: file.size, size };
    })));
    assert.deepEqual(files[0].size, [1800, 2400], 'turned upright and reduced to 2,400 px on the long edge');
    assert.equal(files[0].name, 'IMG_0001.jpg');
    assert.ok(files[0].bytes < before['IMG_0001.jpg']);
    assert.deepEqual(files[1], { name: 'small.jpg', type: 'image/jpeg', bytes: before['small.jpg'], size: [1200, 900] }, 'a smaller photograph is sent as chosen');
    assert.equal(files[2].bytes, before['plan.pdf']);
    assert.equal(files[3].bytes, before['IMG_0002.heic']);
    const list = await page.$$eval('[data-file-list] li', (rows) => rows.map((row) => row.textContent || ''));
    assert.match(list.at(-1)!, /^\d+\.\d MB of 10 MB used$/);
    assert.equal(await page.$eval('form [type="submit"]', (button: HTMLButtonElement) => button.disabled), false);
    await page.type('[name="name"]', 'Ada Test');
    await page.type('[name="phone"]', '07700 900000');
    await page.type('[name="message"]', 'Testing the attachment path only.');
    await Promise.all([page.waitForNavigation(), click(page, 'form [type="submit"]')]);
    assert.ok(submission, 'the native POST was intercepted before reaching FormSubmit');
    // A body with files is not inlined in the request event; fetch it (the part headers name each file).
    const posted = (await (submission as HTTPRequest).fetchPostData()) || '';
    assert.match(posted, /name="attachment"; filename="IMG_0001\.jpg"\r\nContent-Type: image\/jpeg/);
    assert.match(posted, /name="attachment"; filename="IMG_0002\.heic"/);
    await page.close();
  } finally {
    await browser.close();
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
