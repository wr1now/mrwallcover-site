import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { serve, launchBrowser, loadPage, waitForPagePredicate } from '../scripts/visual-browser.mjs';
let server:any, browser:any;
before(async () => { server = await serve('dist'); browser = await launchBrowser({ ignoreDefaultArgs:['--hide-scrollbars'] }); });
after(async () => { await browser?.close(); await server?.close(); });

async function session(check:(page:any, requests:string[]) => Promise<void>) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const requests:string[] = [], errors:string[] = [];
  page.on('pageerror', (error:Error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request:any) => {
    requests.push(request.url());
    if (request.method() !== 'GET' || !request.url().startsWith(server.origin + '/')) void request.abort();
    else void request.continue();
  });
  try { await check(page, requests); assert.deepEqual(errors, []); }
  finally { await context.close(); }
}

async function assertGutterPaint(page:any, width:number) {
  const selector = '[data-atelier-atmosphere]';
  // A classic vertical scrollbar is inside the screenshot's innerWidth but outside the fixed
  // paper's layout viewport. Sample the actual edge, never the browser's scrollbar pixels.
  const clip = await page.$eval('.atelier-atmosphere__edge--right', (edge:HTMLElement) => {
    const box = edge.getBoundingClientRect();
    const left = Math.max(0, Math.ceil(box.left));
    const right = Math.min(document.documentElement.clientWidth, innerWidth, Math.floor(box.right));
    const top = Math.max(0, Math.ceil(box.top) + 180);
    const bottom = Math.min(innerHeight, Math.floor(box.bottom), top + 600);
    return { left, top, width:right - left, height:bottom - top };
  });
  assert.ok(clip.width > 0 && clip.height > 0, 'the actual paper gutter intersects the layout viewport');
  const original = await page.$eval(selector, (layer:HTMLElement) => layer.style.visibility);
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const capture = async (hidden:boolean) => {
    await page.bringToFront();
    await page.$eval(selector, (layer:HTMLElement, visibility:string) => {
      if (visibility) layer.style.visibility = visibility;
      else layer.style.removeProperty('visibility');
    }, hidden ? 'hidden' : original);
    await settle();
    // Two DOM animation frames do not guarantee that a cold/background compositor surface has
    // been captured. Flush one real viewport before sampling, as in the reviewed screenshot run.
    await page.screenshot();
    await settle();
    assert.equal(await page.$eval(selector, (layer:HTMLElement) => getComputedStyle(layer).visibility), hidden ? 'hidden' : 'visible');
    return sharp(await page.screenshot()).extract(clip).raw().toBuffer();
  };
  const difference = (left:Buffer, right:Buffer) => left.reduce((count:number, value:number, index:number) => count + (Math.abs(value - right[index]) > 2 ? 1 : 0), 0);
  const observations:{ visibleToHidden:number; restoredToHidden:number; visibleToRestored:number }[] = [];
  const deadline = Date.now() + 12000;
  let painted = false;
  try {
    do {
      const visible = await capture(false), hidden = await capture(true), restored = await capture(false);
      const sample = { visibleToHidden:difference(visible, hidden), restoredToHidden:difference(restored, hidden), visibleToRestored:difference(visible, restored) };
      observations.push(sample);
      // Both visible views must contain the actual paper, and hiding/restoring it must reproduce
      // the same static view. A permanently invisible product has zero A/B differences and fails.
      painted = sample.visibleToHidden > 100 && sample.restoredToHidden > 100
        && sample.visibleToRestored <= 10;
      if (painted) break;
    } while (Date.now() < deadline);
  } finally {
    await page.$eval(selector, (layer:HTMLElement, visibility:string) => {
      if (visibility) layer.style.visibility = visibility;
      else layer.style.removeProperty('visibility');
    }, original);
  }
  const diagnostics = await page.evaluate(() => {
    const describe = (selector:string) => {
      const element = document.querySelector(selector)!, style = getComputedStyle(element), box = element.getBoundingClientRect();
      return { rect:{ x:box.x, y:box.y, width:box.width, height:box.height }, display:style.display, visibility:style.visibility, opacity:style.opacity, transform:style.transform };
    };
    return { innerWidth, clientWidth:document.documentElement.clientWidth, effects:document.documentElement.dataset.effects ?? 'default', hidden:document.hidden, layer:describe('[data-atelier-atmosphere]'), edge:describe('.atelier-atmosphere__edge--right'), fan:describe('.atelier-atmosphere__fan') };
  });
  assert.ok(painted, `${width}px: actual paper pixels are visible in the outer gutter; ${JSON.stringify({ observations, diagnostics })}`);
}

test('the shared ambiance is visible in gutters without changing reading layout or hit testing', { timeout:60000 }, async () => {
  await session(async (page, requests) => {
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'reduce' }]);
    for (const { width, classicScrollbar } of [{ width:390, classicScrollbar:false }, { width:1440, classicScrollbar:false }, { width:390, classicScrollbar:true }]) {
      await page.setViewport({ width, height:1000, deviceScaleFactor:1 });
      await loadPage(page, server.origin + '/about/');
      if (classicScrollbar) {
        await page.addStyleTag({ content:'html { overflow-y:scroll!important; scrollbar-gutter:stable!important; } html::-webkit-scrollbar { width:16px!important; }' });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.ok(await page.evaluate(() => innerWidth - document.documentElement.clientWidth >= 15), 'the portability case really reserves a classic scrollbar gutter');
      }
      const before = await page.evaluate(() => {
        const layer = document.querySelector<HTMLElement>('[data-atelier-atmosphere]')!;
        const rect = document.querySelector('main')!.getBoundingClientRect();
        return { active:layer.dataset.atelierMotion, running:layer.hasAttribute('data-running'), overflow:document.documentElement.scrollWidth > innerWidth, hiddenFromAT:layer.getAttribute('aria-hidden'), inert:layer.inert, pointer:getComputedStyle(layer).pointerEvents, reading:{ x:rect.x, y:rect.y, width:rect.width, height:rect.height }, hits:[document.elementFromPoint(1, 300), document.elementFromPoint(document.documentElement.clientWidth - 1, 300)].some(element => !!element?.closest('[data-atelier-atmosphere]')) };
      });
      assert.equal(before.active, 'active'); assert.equal(before.running, false);
      assert.equal(before.overflow, false); assert.equal(before.hiddenFromAT, 'true');
      assert.equal(before.inert, true); assert.equal(before.pointer, 'none'); assert.equal(before.hits, false);
      await assertGutterPaint(page, width);
      const after = await page.evaluate(() => { const rect = document.querySelector('main')!.getBoundingClientRect(); return { x:rect.x, y:rect.y, width:rect.width, height:rect.height }; });
      assert.deepEqual(after, before.reading, 'decoration has no influence on the reading layout');
    }
    assert.equal(requests.some(url => /design-object-scenes\./.test(url)), false, 'ambiance never imports the WebGL scene family');
  });
});

test('live paper motion follows OS/footer preferences, document lifecycle and the existing shared pause state', { timeout:60000 }, async () => {
  await session(async page => {
    await page.setViewport({ width:1440, height:1000 });
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
    await loadPage(page, server.origin + '/about/');
    const running = () => page.evaluate(() => document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    await waitForPagePredicate(page, () => document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    const transform = await page.$eval('.atelier-atmosphere__fan', (element:HTMLElement) => getComputedStyle(element).transform);
    await page.waitForFunction((before:string) => getComputedStyle(document.querySelector('.atelier-atmosphere__fan')!).transform !== before, { polling:100 }, transform);
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'reduce' }]);
    await waitForPagePredicate(page, () => !document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
    await waitForPagePredicate(page, () => document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    await page.click('[data-effects-toggle]');
    await waitForPagePredicate(page, () => getComputedStyle(document.querySelector('[data-atelier-atmosphere]')!).display === 'none');
    assert.equal(await running(), false);
    await page.click('[data-effects-toggle]');
    await waitForPagePredicate(page, () => document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    // Exercise the event-driven visibility handler explicitly: headless-shell does not consistently
    // mark a background target hidden. This changes only the isolated test document's getter.
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable:true, get:() => true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await running(), false, 'a hidden document stops CSS motion');
    await page.evaluate(() => { delete (document as any).hidden; document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await running(), true);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted:true })));
    assert.equal(await running(), false);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted:true })));
    assert.equal(await running(), true, 'bfcache restoration resumes through the same preference checks');
    await page.evaluate(() => { document.documentElement.dataset.objectMotionState = 'paused'; });
    await waitForPagePredicate(page, () => !document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    assert.equal(await page.$eval('.atelier-atmosphere__fan', (element:HTMLElement) => getComputedStyle(element).animationPlayState), 'paused');
    await page.evaluate(() => { delete document.documentElement.dataset.objectMotionState; });
    await waitForPagePredicate(page, () => document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    // One real study is enough to verify that the existing shared control also owns this new layer.
    await loadPage(page, server.origin + '/services/#supply');
    const pause = '[data-object-motion]:not([hidden]):not([disabled])';
    await page.waitForSelector(pause, { visible:true, timeout:20000 });
    await page.click(pause);
    await waitForPagePredicate(page, () => document.documentElement.dataset.objectMotionState === 'paused' && !document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    await page.click(pause);
    await waitForPagePredicate(page, () => document.documentElement.dataset.objectMotionState !== 'paused' && document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
  });
});

test('new shared content families inherit the motif while utilities stay static and noindex pages omit it', { timeout:60000 }, async () => {
  await session(async (page, requests) => {
    await page.setViewport({ width:390, height:1000 });
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'reduce' }]);
    for (const path of ['/', '/services/', '/materials/', '/advice/', '/professionals/', '/projects/', '/contact/']) {
      await loadPage(page, server.origin + path);
      assert.equal(await page.$eval('[data-atelier-atmosphere]', (layer:HTMLElement) => layer.dataset.atelierMotion), 'active', path);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path);
    }
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
    for (const path of ['/for-ai/', '/privacy/', '/wallcovering-installation-ai-crawler/', '/wallpapering/preparation/', '/makers/', '/makers/de-gournay/', '/buying-routes/']) {
      await loadPage(page, server.origin + path);
      assert.equal(await page.$eval('[data-atelier-atmosphere]', (layer:HTMLElement) => layer.dataset.atelierMotion), 'static', path);
      const stationary = await page.$eval('.atelier-atmosphere__fan', (element:HTMLElement) => ({
        markedRunning:element.closest('[data-atelier-atmosphere]')!.hasAttribute('data-running'),
        activeAnimations:element.getAnimations().filter(animation => animation.playState === 'running').length,
      }));
      assert.deepEqual(stationary, { markedRunning:false, activeAnimations:0 }, path);
    }
    for (const path of ['/404.html', '/thank-you/', '/search/']) {
      await loadPage(page, server.origin + path);
      assert.equal(await page.$('[data-atelier-atmosphere]'), null, path);
    }
    assert.equal(requests.some(url => /design-object-scenes\./.test(url)), false);
    await page.setJavaScriptEnabled(false);
    await loadPage(page, server.origin + '/about/');
    assert.equal(await page.$eval('[data-atelier-atmosphere]', (layer:HTMLElement) => layer.hasAttribute('data-running')), false);
    assert.equal(await page.$eval('.atelier-atmosphere__fan', (element:HTMLElement) => element.getAnimations().filter(animation => animation.playState === 'running').length), 0);
    assert.ok(await page.$eval('main h1', (heading:HTMLElement) => !!heading.textContent?.trim()), 'server-rendered reading remains complete without enhancement');
  });
});
