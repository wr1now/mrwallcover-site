/** Cold local transfer/CLS comparison, with real visible studies. These are not field speed timings. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve, launchBrowser, loadPage, waitForPagePredicate } from '../visual-browser.mjs';
const options = Object.fromEntries(process.argv.slice(2).map(argument => argument.replace(/^--/, '').split('=')));
const output = resolve(options.output || 'docs/design/sitewide-editorial');
const before = await serve(options.before || '/tmp/mw-editorial-base-20261018');
const after = await serve(options.after || 'dist');
const browser = await launchBrowser();
const routes = ['/', '/services/', '/professionals/designers/', '/contact/'];
const results = [];
await mkdir(output, { recursive:true });
try {
  for (const [build, origin] of [['before', before.origin], ['after', after.origin]]) {
    for (const path of routes) for (const width of [390, 1440]) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewport({ width, height:1000, deviceScaleFactor:1 });
      await page.setCacheEnabled(false);
      await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'no-preference' }]);
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.method() !== 'GET' || !request.url().startsWith(origin + '/')) void request.abort();
        else void request.continue();
      });
      await page.evaluateOnNewDocument(() => {
        window.__editorialCLS = 0;
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__editorialCLS += entry.value;
        }).observe({ type:'layout-shift', buffered:true });
      });
      try {
        assert.equal((await loadPage(page, origin + path)).status(), 200);
        await page.waitForNetworkIdle({ idleTime:150, timeout:20000 });
        const initial = await page.evaluate(() => ({ cls:window.__editorialCLS, bytes:performance.getEntriesByType('resource').reduce((sum, entry) => sum + entry.encodedBodySize, 0) }));
        const selector = path === '/services/' ? '#supply [data-design-object]' : 'main [data-design-object]';
        await page.$eval(selector, element => element.scrollIntoView({ block:'center', behavior:'instant' }));
        // The 3D scene loads only on wide fine-pointer screens; a phone in the new build keeps the poster.
        const liveExpected = build === 'before' || width >= 1024;
        if (liveExpected) {
        await waitForPagePredicate(page, selector => {
          const element = document.querySelector(selector), canvas = element?.querySelector('canvas');
          if (!element?.hasAttribute('data-live') || !canvas) return false;
          return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0);
        }, { timeout:30000 }, selector);
        const hash = await page.$eval(selector + ' canvas', canvas => {
          let hash = 2166136261;
          for (const value of canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data) hash = Math.imul(hash ^ value, 16777619);
          return hash >>> 0;
        });
        await page.waitForFunction((selector, before) => {
          const canvas = document.querySelector(selector + ' canvas');
          let hash = 2166136261;
          for (const value of canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data) hash = Math.imul(hash ^ value, 16777619);
          return (hash >>> 0) !== before;
        }, { polling:100, timeout:10000 }, selector, hash);
        }
        await page.waitForNetworkIdle({ idleTime:150, timeout:20000 });
        const metrics = await page.evaluate(() => {
          const resources = performance.getEntriesByType('resource');
          const sum = filter => resources.filter(filter).reduce((total, entry) => total + entry.encodedBodySize, 0);
          return {
            cls:window.__editorialCLS,
            documentBytes:performance.getEntriesByType('navigation')[0].encodedBodySize,
            resourceBytes:sum(() => true),
            scriptBytes:sum(entry => new URL(entry.name).pathname.endsWith('.js')),
            cssBytes:sum(entry => new URL(entry.name).pathname.endsWith('.css')),
            posterBytes:sum(entry => new URL(entry.name).pathname.startsWith('/media/design-objects/')),
            photoBytes:sum(entry => /\.(avif|webp|png|jpe?g)$/.test(new URL(entry.name).pathname) && !new URL(entry.name).pathname.startsWith('/media/design-objects/')),
            fontBytes:sum(entry => /\.(woff2?|otf)$/.test(new URL(entry.name).pathname)),
            requests:resources.length,
            sceneRequested:resources.some(entry => /\/design-object-scenes\./.test(entry.name)),
            liveStudies:document.querySelectorAll('[data-design-object][data-live]').length,
            ambiance:document.querySelector('[data-atelier-atmosphere]')?.hasAttribute('data-running') || false,
            overflow:document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.equal(metrics.sceneRequested, liveExpected, liveExpected ? 'the real lazy scene module was measured' : 'a phone requests no scene module');
        assert.equal(metrics.liveStudies > 0, liveExpected);
        assert.equal(metrics.overflow, false);
        assert.deepEqual(errors, []);
        results.push({ build, path, width, initial, ...metrics });
        console.log(`${build}: ${path} @${width} script ${metrics.scriptBytes}B, CSS ${metrics.cssBytes}B, CLS ${metrics.cls}`);
      } finally { await context.close(); }
    }
  }
  const deltas = results.filter(result => result.build === 'after').map(result => {
    const base = results.find(item => item.build === 'before' && item.path === result.path && item.width === result.width);
    const delta = field => result[field] - base[field];
    return { path:result.path, width:result.width, documentBytes:delta('documentBytes'), resourceBytes:delta('resourceBytes'), scriptBytes:delta('scriptBytes'), cssBytes:delta('cssBytes'), posterBytes:delta('posterBytes'), photoBytes:delta('photoBytes'), cls:delta('cls') };
  });
  const report = { captured:new Date().toISOString(), beforeSource:options['before-source'] || options.before || 'caller-supplied baseline build', afterSource:options.source || 'working dist', method:'Fresh isolated context and disabled cache for each page. Same 390/1440 widths, OS no-preference, first relevant study scrolled into view and actual changing canvas pixels verified. GET-only local origin, no submissions. encodedBodySize is the exact uncompressed body served by this local static server; transfer timings are deliberately omitted. Initial CLS precedes scripted scrolling; final CLS includes lazy study activation.', results, deltas };
  await writeFile(resolve(output, 'performance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ comparisons:deltas.length, maxScriptDelta:Math.max(...deltas.map(delta => delta.scriptBytes)), maxCssDelta:Math.max(...deltas.map(delta => delta.cssBytes)), maxAfterCLS:Math.max(...results.filter(result => result.build === 'after').map(result => result.cls)) }, null, 2));
} finally { await browser.close(); await before.close(); await after.close(); }
