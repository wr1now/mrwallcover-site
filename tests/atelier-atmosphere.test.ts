import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { serve, launchBrowser, loadPage, waitForPagePredicate } from '../scripts/visual-browser.mjs';
let server:any, browser:any;
const activeArtwork = ['branch-birds.webp', 'ivory-linen.webp', 'plum-blossom.webp', 'water-lilies.webp'];
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

type Clip = { left:number; top:number; width:number; height:number };

async function comparePaint(page:any, selector:string, clip:Clip, { scripts = true, expectPaint = true } = {}) {
  assert.ok(clip.width > 0 && clip.height > 0, 'the sampled decoration intersects the layout viewport');
  const original = await page.$eval(selector, (layer:HTMLElement) => layer.style.visibility);
  const settle = () => scripts ? page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))) : Promise.resolve();
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
    return sharp(await page.screenshot()).extract(clip).removeAlpha().raw().toBuffer();
  };
  const difference = (left:Buffer, right:Buffer) => left.reduce((count:number, value:number, index:number) => count + (Math.abs(value - right[index]) > 2 ? 1 : 0), 0);
  const observations:{ visibleToHidden:number; restoredToHidden:number; visibleToRestored:number; maximumChannelChange:number }[] = [];
  const deadline = Date.now() + 12000;
  let painted = false;
  let visible:Buffer = Buffer.alloc(0);
  try {
    do {
      visible = await capture(false);
      const hidden = await capture(true), restored = await capture(false);
      const sample = { visibleToHidden:difference(visible, hidden), restoredToHidden:difference(restored, hidden), visibleToRestored:difference(visible, restored), maximumChannelChange:visible.reduce((maximum:number, value:number, index:number) => Math.max(maximum, Math.abs(value - hidden[index])), 0) };
      observations.push(sample);
      // Both visible views must contain the actual artwork, and hiding/restoring it must reproduce
      // the same static view. A permanently invisible product has zero A/B differences and fails.
      painted = sample.visibleToHidden > 100 && sample.restoredToHidden > 100
        && sample.visibleToRestored <= 10;
      if (painted || (!expectPaint && sample.visibleToHidden === 0 && sample.restoredToHidden === 0 && sample.visibleToRestored === 0)) break;
    } while (Date.now() < deadline);
  } finally {
    await page.$eval(selector, (layer:HTMLElement, visibility:string) => {
      if (visibility) layer.style.visibility = visibility;
      else layer.style.removeProperty('visibility');
    }, original);
  }
  const diagnostics = await page.evaluate((selector:string) => {
    const describe = (selector:string) => {
      const element = document.querySelector(selector)!, style = getComputedStyle(element), box = element.getBoundingClientRect();
      return { rect:{ x:box.x, y:box.y, width:box.width, height:box.height }, display:style.display, visibility:style.visibility, opacity:style.opacity, transform:style.transform };
    };
    return { innerWidth, clientWidth:document.documentElement.clientWidth, effects:document.documentElement.dataset.effects ?? 'default', hidden:document.hidden, layer:describe('[data-atelier-atmosphere]'), sampled:describe(selector) };
  }, selector);
  return { painted, observations, diagnostics, visible };
}

async function assertGutterPaint(page:any, width:number, { scripts = true } = {}) {
  if (width < 768) {
    assert.deepEqual(await page.$$eval('.atelier-atmosphere__edge, .atelier-atmosphere__pond', (layers:HTMLElement[]) => layers.map(layer => ({ display:getComputedStyle(layer).display, rects:layer.getClientRects().length }))), [{display:'none',rects:0},{display:'none',rects:0},{display:'none',rects:0}], 'phone reading keeps the linen ground and removes every botanical painting surface');
    return;
  }
  for (const side of ['right', 'left']) {
    // Classic scrollbars belong to innerWidth but are outside the fixed layer's layout viewport.
    // Sample the actual clipped edge, never the browser's scrollbar pixels.
    const clip = await page.$eval(`.atelier-atmosphere__edge--${side}`, (edge:HTMLElement) => {
      const box = edge.getBoundingClientRect();
      const left = Math.max(0, Math.ceil(box.left));
      const right = Math.min(document.documentElement.clientWidth, innerWidth, Math.floor(box.right));
      const top = Math.max(0, Math.ceil(box.top) + 180);
      const bottom = Math.min(innerHeight, Math.floor(box.bottom), top + 600);
      return { left, top, width:right - left, height:bottom - top };
    });
    const selector = `[data-atelier-botanical="${side === 'right' ? 'birds' : 'blossom'}"]`;
    const { painted, observations, diagnostics } = await comparePaint(page, selector, clip, { scripts });
    assert.ok(painted, `${width}px: actual ${side} botanical pixels are visible independently of linen; ${JSON.stringify({ observations, diagnostics })}`);
  }
  const pondClip = await page.$eval('.atelier-atmosphere__pond', (pond:HTMLElement) => {
    const box = pond.getBoundingClientRect();
    const left = Math.max(0, Math.ceil(box.left));
    const right = Math.min(document.documentElement.clientWidth, innerWidth, Math.floor(box.right));
    const top = Math.max(0, Math.ceil(box.top));
    const bottom = Math.min(innerHeight, Math.floor(box.bottom));
    return { left, top, width:right - left, height:bottom - top };
  });
  const { painted, observations, diagnostics } = await comparePaint(page, '[data-atelier-botanical="water-lilies"]', pondClip, { scripts });
  assert.ok(painted, `${width}px: actual water-lily pixels are visible independently of linen and branches; ${JSON.stringify({ observations, diagnostics })}`);
}

async function assertLinenPaint(page:any, width:number, { scripts = true } = {}) {
  // This empty band belongs to the reading region, well inside both botanical edge masks.
  const clip = await page.$eval('main p', (first:HTMLElement) => ({
    left:Math.floor((document.documentElement.clientWidth - 160) / 2),
    top:Math.floor(first.getBoundingClientRect().top) - 24,
    width:160, height:12,
  }));
  assert.equal(await page.evaluate((clip:Clip) => {
    const text = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT);
    while (text.nextNode()) {
      if (!text.currentNode.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(text.currentNode);
      if ([...range.getClientRects()].some(rect => rect.left < clip.left + clip.width && rect.right > clip.left && rect.top < clip.top + clip.height && rect.bottom > clip.top)) return true;
    }
    return false;
  }, clip), false, 'the linen contrast probe samples empty ground, never a breadcrumb or text glyph');
  const { painted, observations, diagnostics, visible } = await comparePaint(page, '[data-atelier-linen]', clip, { scripts });
  assert.ok(painted, `${width}px: real woven linen pixels are visible independently of botanical art; ${JSON.stringify({ observations, diagnostics })}`);
  assert.ok(observations.at(-1)!.maximumChannelChange <= 32, 'the linen stays a faint background rather than competing with the reading surface');
  const ink = await page.$$eval('main p', (paragraphs:HTMLElement[]) => getComputedStyle(paragraphs.find(paragraph => (paragraph.textContent?.trim().length ?? 0) > 80)!).color.match(/[\d.]+/g)!.slice(0, 3).map(Number));
  const luminance = (rgb:number[]) => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const inkLuminance = luminance(ink);
  let minimumContrast = Infinity;
  for (let index = 0; index < visible.length; index += 3) {
    const background = luminance([...visible.subarray(index, index + 3)]);
    minimumContrast = Math.min(minimumContrast, (Math.max(inkLuminance, background) + .05) / (Math.min(inkLuminance, background) + .05));
  }
  assert.ok(minimumContrast >= 4.5, `body text retains AA contrast against the actual linen ground (${minimumContrast.toFixed(2)}:1)`);
}

test('linen paints on phones and desktop botanicals paint without changing reading layout or hit testing', { timeout:60000 }, async () => {
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
        return { active:layer.dataset.atelierMotion, running:layer.hasAttribute('data-running'), linenOpacity:Number(getComputedStyle(layer.querySelector('[data-atelier-linen]')!).opacity), overflow:document.documentElement.scrollWidth > innerWidth, hiddenFromAT:layer.getAttribute('aria-hidden'), inert:layer.inert, pointer:getComputedStyle(layer).pointerEvents, reading:{ x:rect.x, y:rect.y, width:rect.width, height:rect.height }, hits:[document.elementFromPoint(1, 300), document.elementFromPoint(document.documentElement.clientWidth - 1, 300), document.elementFromPoint(document.documentElement.clientWidth - 1, innerHeight - 10)].some(element => !!element?.closest('[data-atelier-atmosphere]')) };
      });
      assert.equal(before.active, 'active'); assert.equal(before.running, false);
      assert.equal(before.overflow, false); assert.equal(before.hiddenFromAT, 'true');
      assert.equal(before.inert, true); assert.equal(before.pointer, 'none'); assert.equal(before.hits, false);
      assert.ok(before.linenOpacity >= .2 && before.linenOpacity <= .3, 'normal pages have a stronger but restrained linen ground');
      await assertGutterPaint(page, width);
      await assertLinenPaint(page, width);
      const after = await page.evaluate(() => { const rect = document.querySelector('main')!.getBoundingClientRect(); return { x:rect.x, y:rect.y, width:rect.width, height:rect.height }; });
      assert.deepEqual(after, before.reading, 'decoration has no influence on the reading layout');
    }
    assert.equal(requests.some(url => /design-object-scenes\./.test(url)), false, 'ambiance never imports the WebGL scene family');
    const requestedArtwork = [...new Set(requests.filter(url => /\/media\/atelier-botanicals\/[^/]+\.webp$/.test(url)).map(url => new URL(url).pathname.split('/').at(-1)))].sort();
    assert.deepEqual(requestedArtwork, activeArtwork, 'only the four active decorative WebPs are downloaded; the archived blossom is unused');
  });
});

test('live botanical motion follows OS/footer preferences, document lifecycle and the existing shared pause state', { timeout:60000 }, async () => {
  await session(async page => {
    await page.setViewport({ width:1440, height:1000 });
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
    await loadPage(page, server.origin + '/about/');
    const running = () => page.evaluate(() => document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    await waitForPagePredicate(page, () => document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    const transforms = await page.$$eval('[data-atelier-moving]', (elements:HTMLElement[]) => elements.map(element => getComputedStyle(element).transform));
    assert.equal(transforms.length, 3, 'birds, plum blossom and water lilies share the preference controller');
    await page.waitForFunction((before:string[]) => {
      const elements = [...document.querySelectorAll('[data-atelier-moving]')];
      return elements.length === before.length && elements.every((element, index) => getComputedStyle(element).transform !== before[index]);
    }, { polling:100 }, transforms);
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'reduce' }]);
    await waitForPagePredicate(page, () => !document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    assert.equal(await page.$eval('[data-atelier-atmosphere]', (layer:HTMLElement) => layer.getAnimations({ subtree:true }).filter(animation => animation.playState === 'running').length), 0, 'OS reduced motion stops all three botanical animations');
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
    assert.deepEqual(await page.$$eval('[data-atelier-moving]', (elements:HTMLElement[]) => elements.map(element => getComputedStyle(element).animationPlayState)), ['paused', 'paused', 'paused']);
    await page.evaluate(() => { delete document.documentElement.dataset.objectMotionState; });
    await waitForPagePredicate(page, () => document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    // One real study is enough to verify that the existing shared control also owns this new layer.
    await loadPage(page, server.origin + '/services/#supply');
    const pause = '[data-object-motion]:not([hidden]):not([disabled])';
    await page.waitForSelector(pause, { visible:true, timeout:20000 });
    await page.click(pause);
    await waitForPagePredicate(page, () => document.documentElement.dataset.objectMotionState === 'paused' && !document.querySelector('[data-atelier-atmosphere]')!.hasAttribute('data-running'));
    assert.deepEqual(await page.$$eval('[data-atelier-moving]', (elements:HTMLElement[]) => elements.map(element => getComputedStyle(element).animationPlayState)), ['paused', 'paused', 'paused'], 'the real shared motion control pauses all botanicals');
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
      const stationary = await page.$eval('[data-atelier-atmosphere]', (element:HTMLElement) => ({
        markedRunning:element.hasAttribute('data-running'),
        activeAnimations:element.getAnimations({ subtree:true }).filter(animation => animation.playState === 'running').length,
        left:getComputedStyle(element.querySelector('.atelier-atmosphere__edge--left')!).display,
        pond:getComputedStyle(element.querySelector('.atelier-atmosphere__pond')!).display,
      }));
      assert.deepEqual(stationary, { markedRunning:false, activeAnimations:0, left:'none', pond:'none' }, path);
    }
    for (const path of ['/404.html', '/thank-you/', '/search/']) {
      await loadPage(page, server.origin + path);
      assert.equal(await page.$('[data-atelier-atmosphere]'), null, path);
    }
    assert.equal(requests.some(url => /design-object-scenes\./.test(url)), false);
    await page.setJavaScriptEnabled(false);
    await loadPage(page, server.origin + '/about/');
    assert.equal(await page.$eval('[data-atelier-atmosphere]', (layer:HTMLElement) => layer.hasAttribute('data-running')), false);
    assert.equal(await page.$eval('[data-atelier-atmosphere]', (element:HTMLElement) => element.getAnimations({ subtree:true }).filter(animation => animation.playState === 'running').length), 0);
    assert.ok(await page.$eval('main h1', (heading:HTMLElement) => !!heading.textContent?.trim()), 'server-rendered reading remains complete without enhancement');
    await assertGutterPaint(page, 390, { scripts:false });
    await assertLinenPaint(page, 390, { scripts:false });
  });
});

test('the decoration leaves real photography unchanged and disappears in print and forced colours', { timeout:30000 }, async () => {
  await session(async page => {
    await page.setViewport({ width:1440, height:1000 });
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'reduce' }]);
    await loadPage(page, server.origin + '/about/');
    await page.$eval('main img', async (image:HTMLImageElement) => { image.scrollIntoView({ block:'center' }); await image.decode(); });
    const clip = await page.$eval('main img', (image:HTMLImageElement) => {
      const rect = image.getBoundingClientRect();
      return { left:Math.ceil(rect.x + rect.width / 2) - 90, top:Math.ceil(rect.y + rect.height / 2) - 90, width:180, height:180 };
    });
    const { painted, observations } = await comparePaint(page, '[data-atelier-atmosphere]', clip, { expectPaint:false });
    assert.equal(painted, false, 'background art never paints over the real portrait');
    assert.ok(observations.every(sample => sample.visibleToHidden === 0 && sample.restoredToHidden === 0 && sample.visibleToRestored === 0), `real-photo pixels remain identical: ${JSON.stringify(observations)}`);
    await page.emulateMediaType('print');
    await waitForPagePredicate(page, () => getComputedStyle(document.querySelector('[data-atelier-atmosphere]')!).display === 'none');
    assert.equal(await page.$eval('[data-atelier-atmosphere]', (layer:HTMLElement) => getComputedStyle(layer).display), 'none');
    assert.notEqual(await page.$eval('main h1', (heading:HTMLElement) => getComputedStyle(heading).display), 'none');
    await page.emulateMediaType('screen');
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setEmulatedMedia', { features:[{ name:'forced-colors', value:'active' }] });
    assert.equal(await page.evaluate(() => matchMedia('(forced-colors:active)').matches), true);
    await waitForPagePredicate(page, () => getComputedStyle(document.querySelector('[data-atelier-atmosphere]')!).display === 'none');
    assert.equal(await page.$eval('[data-atelier-atmosphere]', (layer:HTMLElement) => getComputedStyle(layer).display), 'none');
    await cdp.detach();
  });
});

test('the shared decorative images keep a bounded payload and transparent botanical artwork', async () => {
  const directory = 'dist/media/atelier-botanicals';
  const html = await readFile('dist/about/index.html', 'utf8');
  const styles = [...html.matchAll(/<link\b[^>]*>/g)].map(match => match[0]).filter(tag => /\brel=["']stylesheet["']/.test(tag)).map(tag => tag.match(/\bhref=["']([^"']+)["']/)![1]);
  assert.ok(styles.length > 0, 'the compiled reading page links its actual stylesheets');
  const css = (await Promise.all(styles.map(href => readFile('dist' + new URL(href, 'https://test.invalid').pathname, 'utf8')))).join('\n');
  const files = [...new Set([...css.matchAll(/\/media\/atelier-botanicals\/([^\s)'";]+\.webp)/g)].map(match => match[1]))].sort();
  assert.deepEqual(files, activeArtwork, 'the payload budget counts CSS-referenced artwork rather than retained archive files');
  let bytes = 0;
  for (const name of files) {
    const path = `${directory}/${name}`;
    const size = (await stat(path)).size;
    bytes += size;
    const metadata = await sharp(await readFile(path)).metadata();
    assert.equal(metadata.format, 'webp');
    assert.ok(metadata.width! > 0 && metadata.height! > 0, `${name}: image has intrinsic dimensions`);
    if (name !== 'ivory-linen.webp') {
      assert.equal(metadata.hasAlpha, true, `${name}: the painted branch keeps its transparent surround`);
    }
  }
  assert.ok(bytes <= 300 * 1024, `the complete shared artwork remains at most 300KiB, actual ${bytes}B`);
});
