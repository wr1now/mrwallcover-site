import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { serve, launchBrowser, loadPage, waitForPageContent, waitForPagePredicate } from '../scripts/visual-browser.mjs';

const route = '/professionals/designers/';
const objectSelector = '.guide-faq-item [data-design-object]';
const professionalRoutes = ['/professionals/designers/', '/professionals/developers/', '/professionals/hotels/', '/professionals/fit-out-contractors/', '/trade/'];
const representativeRoutes = ['/services/grasscloth-installation/', '/materials/', '/materials/grasscloth-and-weaves/', '/advice/', '/advice/set-out-and-pattern-matching/', '/areas/chelsea/', '/faq/', '/contact/', ...professionalRoutes];
const staticRoutes = ['/for-ai/', '/wallcovering-installation-ai-crawler/', '/privacy/', '/image-use/', '/accessibility/', '/calculator/', '/wallpapering/preparation/', '/wallpapering/lining-and-adhesives/'];
type Answer = { id: string; question: string; answer: string; pages: string[] };
const source = JSON.parse(await readFile('src/data/buyer-answers.json', 'utf8')) as { answers: Answer[]; standing: Answer[] };
type VisibleAnswer = Pick<Answer, 'id' | 'question' | 'answer'>;
const editorialAnswers = new Map<string, VisibleAnswer[]>(await Promise.all(['fit-out-contractors', 'trade'].map(async slug => {
  const markdown = await readFile(`src/content/pages/${slug}.md`, 'utf8');
  const frontmatter = JSON.parse(markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]) as { path: string; faq: { id: string; question: string; paragraphs: string[] }[] };
  return [frontmatter.path, frontmatter.faq.map(item => ({ id: item.id, question: item.question, answer: item.paragraphs.join(' ') }))];
})));
const answersFor = (path: string): VisibleAnswer[] => editorialAnswers.get(path)
  ?? [...source.answers, ...source.standing].filter(item => item.pages.includes(path));
let server: any, browser: any;

before(async () => { server = await serve('dist'); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

// Every case uses an isolated session and the built site. No external resource or form submission
// is needed to exercise the real Three.js renderer and the existing motion preferences.
async function withPage(check: (page: any, requests: string[]) => Promise<void>, holdRequest?: (request: any) => boolean) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request: any) => {
    requests.push(request.url());
    if (request.method() !== 'GET' || !request.url().startsWith(server.origin + '/')) void request.abort();
    else if (!holdRequest?.(request)) void request.continue();
  });
  try {
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    await check(page, requests);
    assert.deepEqual(errors, [], 'the production page executes without JavaScript exceptions');
  } finally { await context.close(); }
}

async function load(page: any, path = route) {
  const response = await loadPage(page, server.origin + path);
  assert.equal(response.status(), 200, path);
  await page.addStyleTag({ content: 'html { scroll-behavior:auto!important; }' });
  await page.evaluate(() => {
    document.querySelectorAll<HTMLImageElement>('[data-design-object] img').forEach(image => { image.loading = 'eager'; });
  });
  try {
    await waitForPagePredicate(page, () => [...document.querySelectorAll<HTMLImageElement>('[data-design-object] img')].every(image => image.complete), { timeout: 20000 });
  } catch(cause) {
    throw new Error(`${path} @${page.viewport()?.width}: illustration posters did not finish loading`, { cause });
  }
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

async function focusObject(page: any, selector = objectSelector) {
  await page.$eval(selector, (object: HTMLElement) => object.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForFunction((selector: string) => {
    const object = document.querySelector(selector);
    return object?.hasAttribute('data-live') && !!object.querySelector('canvas');
  }, { timeout: 20000 }, selector);
}

async function pixels(page: any, selector = objectSelector) {
  return page.$eval(selector + ' canvas', (canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261, visible = 0;
    for (let i = 0; i < data.length; i++) {
      hash = Math.imul(hash ^ data[i], 16777619);
      if (i % 4 === 3 && data[i]) visible++;
    }
    return { hash: hash >>> 0, visible, width: canvas.width, height: canvas.height };
  });
}

async function waitForPixelChange(page: any, previous: number, selector = objectSelector) {
  await page.waitForFunction((selector: string, before: number) => {
    const canvas = document.querySelector<HTMLCanvasElement>(selector + ' canvas');
    if (!canvas) return false;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (const value of data) hash = Math.imul(hash ^ value, 16777619);
    return (hash >>> 0) !== before;
  }, { polling: 100, timeout: 10000 }, selector, previous);
}

function assertControls(actual: Awaited<ReturnType<typeof controls>>, state: 'running' | 'paused' | 'reduced') {
  assert.ok(actual.length > 0, 'every dimensional surface provides a motion control');
  const expected = state === 'running'
    ? { hidden: false, disabled: false, pressed: 'false', label: 'Pause motion' }
    : state === 'paused'
      ? { hidden: false, disabled: false, pressed: 'true', label: 'Resume motion' }
      : { hidden: false, disabled: true, pressed: 'true', label: 'Motion reduced' };
  assert.deepEqual(actual, actual.map(() => expected), 'all controls share the actual motion state');
}

async function staticPosters(page: any) {
  // Media-query changes can update attributes before the next style/rendering pass. Await the
  // actual fallback appearance as well as stopped live markers, without a fixed settling delay.
  await waitForPagePredicate(page, () => document.querySelectorAll('[data-design-object][data-live]').length === 0
    && [...document.querySelectorAll<HTMLImageElement>('[data-design-object] img')].every(image =>
      image.complete && image.naturalWidth > 0 && getComputedStyle(image).visibility === 'visible'
    ), { timeout: 10000 });
}

test('shared page families ship complete SSR studies and preserve responsive question layouts', { timeout: 120000 }, async () => {
  await withPage(async page => {
    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      for (const path of representativeRoutes) {
        const html = await readFile(`dist${path}index.html`, 'utf8');
        const objectCount = (html.match(/data-design-object="/g) ?? []).length;
        assert.ok(objectCount > 0, `${path}: the shared family supplies an illustrative study`);
        assert.equal((html.match(/src="\/media\/design-objects\/[^"/]+\.webp"/g) ?? []).length, objectCount, `${path}: each SSR object has a poster`);
        await load(page, path);
        if (professionalRoutes.includes(path)) {
          assert.deepEqual(await content(page), answersFor(path).map(item => ({
            id: item.id, question: item.question, answer: item.answer, visible: true,
          })), `${path}: sourced buyer answers stay open at ${width}px`);
        }
        const result = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          objects: document.querySelectorAll('[data-design-object]').length,
          posters: [...document.querySelectorAll<HTMLImageElement>('[data-design-object] img')].every(image => image.complete && image.naturalWidth > 0 && image.alt === '' && image.closest('[aria-hidden="true"]')),
          controls: document.querySelectorAll('button[data-object-motion]').length,
          questions: [...document.querySelectorAll<HTMLElement>('.question-heading-row, .faq summary')].map(item => {
            const question = item.querySelector('h2,h3')!.getBoundingClientRect();
            const drawing = item.querySelector('[data-question-visual]')!.getBoundingClientRect();
            return { question: item.querySelector('h2,h3')?.textContent, rightOfQuestion: drawing.left >= question.right - 1, insideViewport: drawing.right <= innerWidth + 1 };
          }),
        }));
        assert.equal(result.objects, objectCount, `${path}: enhancement preserves the complete SSR study collection`);
        assert.equal(result.posters, true, `${path}: posters are loaded and decorative`);
        assert.ok(result.controls > 0, `${path}: shared motion controls`);
        assert.equal(result.overflow, false, `${path}: no horizontal overflow at ${width}px`);
        for (const question of result.questions) {
          assert.equal(question.rightOfQuestion, true, `${path}: ${question.question} stays right at ${width}px`);
          assert.equal(question.insideViewport, true, `${path}: question object stays in the viewport at ${width}px`);
        }
      }
    }
  });
});

test('lazy scene activation preserves the material controls and shortlist position', { timeout: 60000 }, async () => {
  for (const width of [390, 1440]) {
    let sceneRequest: any;
    let notifyRequest!: () => void;
    const sceneRequested = new Promise<void>(resolve => { notifyRequest = resolve; });
    await withPage(async page => {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await loadPage(page, server.origin + '/materials/grasscloth-and-weaves/');
      await page.evaluate(async () => {
        await document.fonts.ready;
        const study = document.querySelector<HTMLElement>('.design-study')!;
        await Promise.all([...study.querySelectorAll('img')].map(async image => {
          image.loading = 'eager';
          await image.decode();
        }));
        document.documentElement.style.scrollBehavior = 'auto';
        study.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([sceneRequested, new Promise<void>((_, reject) => {
          timer = setTimeout(() => reject(new Error('the visible study must request its lazy scene')), 15000);
        })]);
      } finally { clearTimeout(timer); }
      const measure = () => page.evaluate(() => {
        const rect = (element: Element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left + scrollX, top: box.top + scrollY, width: box.width, height: box.height };
        };
        const controls = document.querySelector('.design-study [data-object-controls]')!;
        return {
          controls: rect(controls), shortlist: rect(document.querySelector('[data-shortlist]')!),
          hidden: controls.querySelector<HTMLButtonElement>('[data-object-motion]')!.hidden,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      const before = await measure();
      assert.equal(before.hidden, true, `${width}px: measure the poster before the real scene module loads`);
      await sceneRequest.continue();
      await page.waitForFunction(() => document.querySelector('.design-study [data-design-object][data-live]'), { timeout: 20000 });
      const after = await measure();
      assert.equal(after.hidden, false, `${width}px: scene activation reveals the working motion control`);
      assert.deepEqual(after.controls, before.controls, `${width}px: lazy activation must preserve the control rectangle`);
      assert.deepEqual(after.shortlist, before.shortlist, `${width}px: lazy activation must not move the shortlist action`);
      assert.equal(before.overflow || after.overflow, false, `${width}px: both poster and live states fit the viewport`);
    }, request => {
      if (!/\/design-object-scenes\.[^/]+\.js(?:\?|$)/.test(request.url())) return false;
      sceneRequest = request;
      notifyRequest();
      return true;
    });
  }
});

test('real rendered pixels animate and all local controls pause and resume every object', { timeout: 90000 }, async () => {
  await withPage(async (page, requests) => {
    await load(page);
    await focusObject(page);
    const first = await pixels(page);
    assert.ok(first.visible > 100 && first.width > 0 && first.height > 0, 'the live scene renders actual nonempty pixels');
    await waitForPixelChange(page, first.hash);
    assert.ok(requests.some(url => /\/design-object-scenes\.[^/]+\.js(?:\?|$)/.test(url)), 'the production scene module is lazy loaded');
    assertControls(await controls(page), 'running');

    await page.click('.guide-faq [data-object-motion]');
    await staticPosters(page);
    assertControls(await controls(page), 'paused');
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
    assertControls(await controls(page), 'paused');

    await page.click('button[data-object-motion]');
    await focusObject(page);
    assertControls(await controls(page), 'running');
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
    assertControls(await controls(page), 'reduced');

    await page.reload({ waitUntil: 'load' });
    await waitForPageContent(page);
    await page.evaluate(() => {
      document.querySelectorAll<HTMLImageElement>('[data-design-object] img').forEach(image => { image.loading = 'eager'; });
    });
    await waitForPagePredicate(page, () => [...document.querySelectorAll<HTMLImageElement>('[data-design-object] img')].every(image => image.complete), { timeout: 20000 });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.effects), 'reduced');
    assert.equal(await page.$$eval('[data-design-object] canvas', (canvases: HTMLCanvasElement[]) => canvases.length), 0, 'stored preference prevents renderer startup');
    await staticPosters(page);

    await page.click('[data-effects-toggle]');
    await page.waitForFunction(() => document.documentElement.dataset.effects !== 'reduced');
    await focusObject(page);
    assertControls(await controls(page), 'running');
  });
});

test('a live operating-system reduced-motion change restores posters and can resume safely', { timeout: 90000 }, async () => {
  await withPage(async page => {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await load(page);
    await focusObject(page);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await staticPosters(page);
    assertControls(await controls(page), 'reduced');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.effects), undefined, 'the OS preference does not rewrite the footer preference');

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await focusObject(page);
    assertControls(await controls(page), 'running');
    await waitForPixelChange(page, (await pixels(page)).hash);
  });
});

test('without JavaScript each shared family keeps complete posters and readable answers', { timeout: 90000 }, async () => {
  await withPage(async page => {
    await page.setJavaScriptEnabled(false);
    for (const path of representativeRoutes) {
      await load(page, path);
      assert.ok(await page.$$eval('[data-design-object]', (objects: HTMLElement[]) => objects.length > 0), path);
      assert.equal(await page.$$eval('[data-design-object] canvas', (canvases: HTMLCanvasElement[]) => canvases.length), 0);
      await staticPosters(page);
      if (professionalRoutes.includes(path)) assert.deepEqual(await content(page), answersFor(path).map(item => ({
        id: item.id, question: item.question, answer: item.answer, visible: true,
      })), `${path}: all sourced buyer answers are available without scripts`);
      assert.equal(await page.$$eval('button[data-object-motion]', (buttons: HTMLButtonElement[]) => buttons.length > 0 && buttons.every(button => button.hidden && button.getClientRects().length === 0)), true, `${path}: unavailable enhancement controls stay hidden`);
    }
  });
});

// A growing route inventory must not share one aggregate deadline on software-rendered CI.
// Each route keeps the same bounded readiness/pixel checks and an isolated browser context.
for (const path of representativeRoutes) {
  test(`${path}: actual animated pixels, pause and reduced-motion fallbacks`, { timeout: 60000 }, async () => {
    await withPage(async page => {
      await load(page, path);
      await focusObject(page, '[data-design-object]');
      const first = await pixels(page, '[data-design-object]');
      assert.ok(first.visible > 100, `${path}: real rendered object pixels`);
      await waitForPixelChange(page, first.hash, '[data-design-object]');
      assertControls(await controls(page), 'running');
      await page.$eval('button[data-object-motion]', (button: HTMLButtonElement) => button.click());
      await staticPosters(page);
      assertControls(await controls(page), 'paused');
      await page.$eval('button[data-object-motion]', (button: HTMLButtonElement) => button.click());
      await focusObject(page, '[data-design-object]');
      assertControls(await controls(page), 'running');
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await staticPosters(page);
      assertControls(await controls(page), 'reduced');
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      await focusObject(page, '[data-design-object]');
    });
  });
}

test('native service, area and FAQ disclosures keep keyboard and drawing-click behaviour with and without JavaScript', { timeout: 90000 }, async () => {
  await withPage(async page => {
    for (const javascript of [true, false]) {
      await page.setJavaScriptEnabled(javascript);
      for (const path of ['/services/grasscloth-installation/', '/areas/chelsea/', '/faq/']) {
        await load(page, path);
        assert.equal(await page.$eval('.faq details', (details: HTMLDetailsElement) => details.open), false, `${path}: native disclosure starts closed`);
        await page.focus('.faq summary');
        await page.keyboard.press('Enter');
        assert.equal(await page.$eval('.faq details', (details: HTMLDetailsElement) => details.open), true, `${path}: Enter opens the answer (JS=${javascript})`);
        assert.equal(await page.$eval('.faq details', (details: HTMLDetailsElement) => !!details.querySelector('summary [data-design-object]') && !!details.querySelector('summary .plus') && (details.querySelector('.prose')?.textContent?.trim().length ?? 0) > 10), true, 'the original answer and native marker remain beside the illustration');
        await page.keyboard.press('Enter');
        assert.equal(await page.$eval('.faq details', (details: HTMLDetailsElement) => details.open), false);
        await page.$eval('.faq summary', (summary: HTMLElement) => summary.scrollIntoView({ block: 'center', behavior: 'instant' }));
        const point = await page.$eval('.faq summary [data-design-object]', (object: HTMLElement) => {
          const rect = object.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        });
        await page.mouse.click(point.x, point.y);
        assert.equal(await page.$eval('.faq details', (details: HTMLDetailsElement) => details.open), true, `${path}: the decorative object does not intercept summary clicks`);
      }
    }
  });
});

test('AI facts, legal reading and reference utilities stay static and never request the 3D scene module', { timeout: 90000 }, async () => {
  await withPage(async (page, requests) => {
    for (const path of staticRoutes) {
      const response = await loadPage(page, server.origin + path);
      assert.equal(response.status(), 200, path);
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      assert.equal(await page.$$eval('[data-design-object]', (objects: HTMLElement[]) => objects.length), 0, path);
    }
    assert.deepEqual(requests.filter(url => /\/design-object-scenes\.[^/]+\.js(?:\?|$)/.test(url)), [], 'static content incurs no scene-module request');
  });
});
