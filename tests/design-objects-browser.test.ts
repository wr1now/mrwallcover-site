import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { serve, launchBrowser } from '../scripts/visual-browser.mjs';

const route = '/professionals/designers/';
const objectSelector = '.guide-faq-item [data-design-object]';
type Answer = { id: string; question: string; answer: string; pages: string[] };
const source = JSON.parse(await readFile('src/data/buyer-answers.json', 'utf8')) as { answers: Answer[]; standing: Answer[] };
const expectedAnswers = [...source.answers, ...source.standing].filter(item => item.pages.includes(route));
let server: any, browser: any;

before(async () => { server = await serve('dist'); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

// Every case uses an isolated session and the built site. No external resource or form submission
// is needed to exercise the real Three.js renderer and the existing motion preferences.
async function withPage(check: (page: any, requests: string[]) => Promise<void>) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request: any) => {
    requests.push(request.url());
    if (request.method() !== 'GET' || !request.url().startsWith(server.origin + '/')) void request.abort();
    else void request.continue();
  });
  try {
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    await check(page, requests);
    assert.deepEqual(errors, [], 'the production page executes without JavaScript exceptions');
  } finally { await context.close(); }
}

async function load(page: any) {
  const response = await page.goto(server.origin + route, { waitUntil: 'networkidle0' });
  assert.equal(response.status(), 200);
  await page.addStyleTag({ content: 'html { scroll-behavior:auto!important; }' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('[data-design-object] img')].map(async image => {
      image.loading = 'eager';
      try { await image.decode(); } catch {}
    }));
  });
}

async function content(page: any) {
  return page.$$eval('.guide-faq-item', (items: HTMLElement[]) => items.map(item => ({
    id: item.id,
    question: item.querySelector('h3')?.textContent?.trim(),
    answer: item.querySelector(':scope > p')?.textContent?.trim(),
    visible: !item.closest('details') && getComputedStyle(item).display !== 'none'
      && getComputedStyle(item.querySelector(':scope > p')!).visibility !== 'hidden',
  })));
}

async function controls(page: any) {
  return page.$$eval('button[data-object-motion]', (buttons: HTMLButtonElement[]) => buttons.map(button => ({
    hidden: button.hidden, disabled: button.disabled, pressed: button.getAttribute('aria-pressed'),
    label: button.textContent?.trim(),
  })));
}

async function focusObject(page: any) {
  await page.$eval(objectSelector, (object: HTMLElement) => object.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForFunction((selector: string) => {
    const object = document.querySelector(selector);
    return object?.hasAttribute('data-live') && !!object.querySelector('canvas');
  }, { timeout: 20000 }, objectSelector);
}

async function pixels(page: any) {
  return page.$eval(objectSelector + ' canvas', (canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261, visible = 0;
    for (let i = 0; i < data.length; i++) {
      hash = Math.imul(hash ^ data[i], 16777619);
      if (i % 4 === 3 && data[i]) visible++;
    }
    return { hash: hash >>> 0, visible, width: canvas.width, height: canvas.height };
  });
}

async function waitForPixelChange(page: any, previous: number) {
  await page.waitForFunction((selector: string, before: number) => {
    const canvas = document.querySelector<HTMLCanvasElement>(selector + ' canvas');
    if (!canvas) return false;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (const value of data) hash = Math.imul(hash ^ value, 16777619);
    return (hash >>> 0) !== before;
  }, { polling: 100, timeout: 10000 }, objectSelector, previous);
}

async function staticPosters(page: any) {
  // Media-query changes can update attributes before the next style/rendering pass. Await the
  // actual fallback appearance as well as stopped live markers, without a fixed settling delay.
  await page.waitForFunction(() => document.querySelectorAll('[data-design-object][data-live]').length === 0
    && [...document.querySelectorAll<HTMLImageElement>('[data-design-object] img')].every(image =>
      image.complete && image.naturalWidth > 0 && getComputedStyle(image).visibility === 'visible'
    ), { timeout: 10000 });
}

test('designers ships eighteen SSR posters and fourteen open answers at mobile and desktop widths', { timeout: 90000 }, async () => {
  const html = await readFile('dist/professionals/designers/index.html', 'utf8');
  assert.equal((html.match(/data-design-object="/g) ?? []).length, 18, 'objects are present in the server-rendered page');
  assert.equal((html.match(/src="\/media\/design-objects\/[^"/]+\.webp"/g) ?? []).length, 18, 'each object has an SSR poster');
  assert.equal(expectedAnswers.length, 14);
  await withPage(async page => {
    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await load(page);
      assert.deepEqual(await content(page), expectedAnswers.map(item => ({
        id: item.id, question: item.question, answer: item.answer, visible: true,
      })), `all sourced answers remain open at ${width}px`);
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        objects: document.querySelectorAll('[data-design-object]').length,
        questions: [...document.querySelectorAll<HTMLElement>('.guide-faq-item')].map(item => {
          const question = item.querySelector('h3')!.getBoundingClientRect();
          const drawing = item.querySelector('[data-question-visual]')!.getBoundingClientRect();
          return { id: item.id, rightOfQuestion: drawing.left >= question.right - 1, insideViewport: drawing.right <= innerWidth + 1 };
        }),
      }));
      assert.equal(result.objects, 18);
      assert.equal(result.overflow, false, `no horizontal overflow at ${width}px`);
      for (const question of result.questions) {
        assert.equal(question.rightOfQuestion, true, `${question.id}: object stays right of the question at ${width}px`);
        assert.equal(question.insideViewport, true, `${question.id}: object stays inside the viewport at ${width}px`);
      }
    }
  });
});

test('real rendered pixels animate and both local controls pause and resume every object', { timeout: 90000 }, async () => {
  await withPage(async (page, requests) => {
    await load(page);
    await focusObject(page);
    const first = await pixels(page);
    assert.ok(first.visible > 100 && first.width > 0 && first.height > 0, 'the live scene renders actual nonempty pixels');
    await waitForPixelChange(page, first.hash);
    assert.ok(requests.some(url => /\/design-object-scenes\.[^/]+\.js(?:\?|$)/.test(url)), 'the production scene module is lazy loaded');
    assert.deepEqual(await controls(page), Array(2).fill({ hidden: false, disabled: false, pressed: 'false', label: 'Pause motion' }));

    await page.click('.guide-faq [data-object-motion]');
    await staticPosters(page);
    assert.deepEqual(await controls(page), Array(2).fill({ hidden: false, disabled: false, pressed: 'true', label: 'Resume motion' }));
    const paused = await pixels(page);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
    assert.equal((await pixels(page)).hash, paused.hash, 'paused canvases stop changing, in addition to showing posters');

    // Exercise the real lifecycle handlers deterministically; headless back navigation does not
    // consistently use bfcache. A paused restore must leave the document and Resume buttons usable.
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    assert.equal(await page.evaluate(() => document.documentElement.hidden), false, 'restoring a paused scene never hides the page');
    await staticPosters(page);
    assert.deepEqual(await controls(page), Array(2).fill({ hidden: false, disabled: false, pressed: 'true', label: 'Resume motion' }));

    await page.click('.design-study-controls [data-object-motion]');
    await focusObject(page);
    assert.deepEqual(await controls(page), Array(2).fill({ hidden: false, disabled: false, pressed: 'false', label: 'Pause motion' }));
    await waitForPixelChange(page, (await pixels(page)).hash);
  });
});

test('the footer preference stops live scenes, persists after reload and restores motion when cleared', { timeout: 90000 }, async () => {
  await withPage(async page => {
    await load(page);
    await focusObject(page);
    await page.click('[data-effects-toggle]');
    await page.waitForFunction(() => document.documentElement.dataset.effects === 'reduced');
    assert.equal(await page.evaluate(() => localStorage.getItem('mw-effects')), 'reduced');
    await page.$eval(objectSelector, (object: HTMLElement) => object.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await staticPosters(page);
    assert.deepEqual(await controls(page), Array(2).fill({ hidden: false, disabled: true, pressed: 'true', label: 'Motion reduced' }));

    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      await Promise.all([...document.querySelectorAll<HTMLImageElement>('[data-design-object] img')].map(async image => {
        image.loading = 'eager';
        try { await image.decode(); } catch {}
      }));
    });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.effects), 'reduced');
    assert.equal(await page.$$eval('[data-design-object] canvas', (canvases: HTMLCanvasElement[]) => canvases.length), 0, 'stored preference prevents renderer startup');
    await staticPosters(page);

    await page.click('[data-effects-toggle]');
    await page.waitForFunction(() => document.documentElement.dataset.effects !== 'reduced');
    await focusObject(page);
    assert.deepEqual(await controls(page), Array(2).fill({ hidden: false, disabled: false, pressed: 'false', label: 'Pause motion' }));
  });
});

test('a live operating-system reduced-motion change restores posters and can resume safely', { timeout: 90000 }, async () => {
  await withPage(async page => {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await load(page);
    await focusObject(page);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await staticPosters(page);
    assert.deepEqual(await controls(page), Array(2).fill({ hidden: false, disabled: true, pressed: 'true', label: 'Motion reduced' }));
    assert.equal(await page.evaluate(() => document.documentElement.dataset.effects), undefined, 'the OS preference does not rewrite the footer preference');

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await focusObject(page);
    assert.deepEqual(await controls(page), Array(2).fill({ hidden: false, disabled: false, pressed: 'false', label: 'Pause motion' }));
    await waitForPixelChange(page, (await pixels(page)).hash);
  });
});

test('without JavaScript all posters and the full buyer answers remain available', { timeout: 60000 }, async () => {
  await withPage(async page => {
    await page.setJavaScriptEnabled(false);
    await load(page);
    assert.equal(await page.$$eval('[data-design-object]', (objects: HTMLElement[]) => objects.length), 18);
    assert.equal(await page.$$eval('[data-design-object] canvas', (canvases: HTMLCanvasElement[]) => canvases.length), 0);
    await staticPosters(page);
    assert.deepEqual(await content(page), expectedAnswers.map(item => ({
      id: item.id, question: item.question, answer: item.answer, visible: true,
    })));
    assert.equal(await page.$$eval('button[data-object-motion]', (buttons: HTMLButtonElement[]) => buttons.every(button => button.hidden && button.getClientRects().length === 0)), true, 'unavailable controls are actually hidden from view');
  });
});

test('other professional profiles retain their drawings and never request the 3D scene module', { timeout: 90000 }, async () => {
  await withPage(async (page, requests) => {
    for (const path of ['/professionals/', '/professionals/developers/', '/professionals/hotels/', '/professionals/fit-out-contractors/', '/trade/']) {
      const response = await page.goto(server.origin + path, { waitUntil: 'networkidle0' });
      assert.equal(response.status(), 200, path);
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      assert.equal(await page.$$eval('[data-design-object]', (objects: HTMLElement[]) => objects.length), 0, path);
    }
    assert.deepEqual(requests.filter(url => /\/design-object-scenes\.[^/]+\.js(?:\?|$)/.test(url)), [], 'unselected profiles incur no scene-module request');
  });
});
