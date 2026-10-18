/** Isolated layout inventory. This never attaches to the owner's browser or submits a form. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve, launchBrowser, loadPage, waitForPageContent } from '../visual-browser.mjs';

const options = Object.fromEntries(process.argv.slice(2).map(argument => argument.replace(/^--/, '').split('=')));
const directory = resolve(options.dist || 'dist');
const phase = options.phase || 'after';
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('Use a simple phase name.');
const output = resolve(options.output || 'docs/design/sitewide-editorial');
const ledger = JSON.parse(await readFile('docs/design/route-review.json', 'utf8'));
const omitted = new Set(['/404.html', '/search/', '/thank-you/']);
const routes = ledger.routes.map(route => route.path).filter(path => !omitted.has(path));
const representatives = new Map([
  ['/', ['.home-trust', '.atelier-intro']],
  ['/services/', ['#supply', '#surveying']],
  ['/services/timorous-beasties-installer/', ['.faq', '#questions', '.landing-sections', '.landing-body']],
  ['/materials/', ['.material-finder', '.material-grid']],
  ['/materials/paper-and-non-woven/', ['.reading', '.material-study']],
  ['/advice/', ['.guide-grid', '.guide-filters']],
  ['/advice/wall-preparation/', ['#questions', '.guide-faq', '.guide-body']],
  ['/professionals/', ['.professional-route-grid']],
  ['/professionals/designers/', ['#questions', '.guide-faq']],
  ['/projects/', ['.work-controls', '.work-filters', '.work-grid']],
  ['/projects/browns-hotel-mayfair/', ['.case-study', '.project-details']],
  ['/about/', ['#how-heading', '#values-heading']],
  ['/aftercare/', ['#care-heading', '.aftercare-evidence']],
  ['/contact/', ['form', '.enquiry-layout']],
  ['/faq/', ['.faq']],
  ['/areas/', ['.area-directory']],
  ['/trade/', ['.editorial-body', '.guide-faq']],
  ['/reviews/', ['.editorial-body', '.prose']],
  ['/wallpapering/preparation/', ['.preparation-grid', '.prose', 'main h2']],
  ['/advice/wallcovering-fire-ratings-uk/', ['table', '.fire-evidence']],
]);

await mkdir(output, { recursive: true });
const server = await serve(directory);
const browser = await launchBrowser().catch(async error => { await server.close(); throw error; });
const results = [];
const queue = routes.flatMap(path => [390, 1440].map(width => ({ path, width })));
const started = Date.now();
try {
  const worker = async () => {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.method() !== 'GET' || !request.url().startsWith(server.origin + '/')) void request.abort();
      else void request.continue();
    });
    let task;
    while ((task = queue.shift())) {
      const { path, width } = task;
      const errors = [];
      const errorListener = error => errors.push(error.message);
      page.on('pageerror', errorListener);
      try {
        await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
        const response = await loadPage(page, server.origin + path);
        await page.addStyleTag({ content: '* { content-visibility:visible!important; contain-intrinsic-size:none!important; } html { scroll-behavior:auto!important; overflow-anchor:none!important; }' });
        const metrics = await page.evaluate(() => {
          const visible = element => {
            if (!element.getClientRects().length || !element.getBoundingClientRect().width) return false;
            for (let node = element; node instanceof Element; node = node.parentElement) {
              if (node.getAttribute('aria-hidden') === 'true') return false;
              const style = getComputedStyle(node);
              if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
              if (node instanceof HTMLDetailsElement && !node.open && !element.closest('summary')) return false;
            }
            return true;
          };
          const reading = [...document.querySelectorAll('main p, main li, main dd')].filter(element => visible(element) && !element.querySelector('p, li, dd, h2, h3') && (element.textContent || '').trim().length >= 120);
          const measure = element => {
            const box = element.getBoundingClientRect(), style = getComputedStyle(element);
            return { text:(element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 84), width:Math.round(box.width), font:Number.parseFloat(style.fontSize), line:Number.parseFloat(style.lineHeight), classes:element.className || undefined };
          };
          const wideReading = reading.filter(element => element.getBoundingClientRect().width > 720).map(measure);
          const narrowReading = reading.filter(element => element.getBoundingClientRect().width < 230).map(measure);
          const clippedControls = [...document.querySelectorAll('main button, main input:not([type="hidden"]):not([type="file"]), main textarea, main select, main .mw-action, main .btn')].filter(element => {
            if (!visible(element)) return false;
            const box = element.getBoundingClientRect();
            if (box.left < -1 || box.right > innerWidth + 1) return true;
            const style = getComputedStyle(element);
            return !element.matches('input, textarea, select') && element.scrollWidth > element.clientWidth + 2 && ['hidden', 'clip'].includes(style.overflowX);
          }).map(measure);
          const tables = [...document.querySelectorAll('main table')].map(table => {
            const box = table.getBoundingClientRect();
            let scrollContainer = null;
            for (let parent = table; parent instanceof HTMLElement; parent = parent.parentElement) {
              if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) { scrollContainer = parent; break; }
            }
            const scrollerBox = scrollContainer?.getBoundingClientRect();
            return { width:Math.round(box.width), outsideViewport:box.left < -1 || box.right > innerWidth + 1, contained:!!scrollContainer && scrollerBox.left >= -1 && scrollerBox.right <= innerWidth + 1, accessibleScrollLabel:scrollContainer?.getAttribute('aria-label') || null };
          });
          return {
            title:document.title, noindex:document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex') || false,
            documentWidth:document.documentElement.scrollWidth, overflow:Math.max(0, document.documentElement.scrollWidth - innerWidth),
            readingBlocks:reading.length, wideReadingCount:wideReading.length, wideReading:wideReading.slice(0, 12), narrowReadingCount:narrowReading.length, narrowReading:narrowReading.slice(0, 12), clippedControls, tables,
            questionRows:document.querySelectorAll('.guide-faq-item, .faq details').length,
            studies:document.querySelectorAll('[data-design-object]').length,
            ambiance:document.querySelector('[data-atelier-atmosphere]')?.getAttribute('data-atelier-motion') || 'absent',
          };
        });
        const result = { path, width, status:response.status(), ...metrics, errors };
        if (representatives.has(path)) {
          const target = await page.evaluate(selectors => {
            const element = selectors.map(selector => document.querySelector(selector)).find(Boolean) || document.querySelector('main');
            const top = Math.max(0, element.getBoundingClientRect().top + scrollY - 112);
            window.scrollTo({ top, behavior:'instant' });
            return { selector:selectors.find(selector => document.querySelector(selector)) || 'main', top:Math.round(top) };
          }, representatives.get(path));
          await waitForPageContent(page);
          // Allow below-fold registered photographs/posters to finish before the captured viewport.
          await page.waitForFunction(() => [...document.images].filter(image => {
            const box = image.getBoundingClientRect();
            return box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
          }).every(image => image.complete), { timeout:20000 });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const name = path.split('/').filter(Boolean).join('-') || 'home';
          const filename = `${phase}-${name}-${width}.jpg`;
          await page.screenshot({ path:resolve(output, filename), type:'jpeg', quality:76, fullPage:false });
          result.screenshot = { file:filename, ...target };
        }
        results.push(result);
        if (results.length % 25 === 0) console.log(`${phase}: ${results.length}/${routes.length * 2} route/viewport checks`);
      } catch (error) {
        results.push({ path, width, failure:error.message, errors });
      } finally { page.off('pageerror', errorListener); }
    }
    await context.close();
  };
  await Promise.all([worker(), worker(), worker()]);
  results.sort((a, b) => a.path.localeCompare(b.path) || a.width - b.width);
  const summary = {
    phase, source:options.source || directory, captured:new Date().toISOString(),
    motion:'OS reduced motion for the layout inventory; live animation is checked separately.',
    routeCount:routes.length, viewportCount:results.length, widths:[390, 1440], elapsedSeconds:Math.round((Date.now() - started) / 1000),
    failures:results.filter(result => result.failure || result.status !== 200).length,
    overflowCases:results.filter(result => result.overflow > 1).length,
    wideReadingCases:results.filter(result => result.wideReading?.length).length,
    narrowReadingCases:results.filter(result => result.narrowReading?.length).length,
    clippedControlCases:results.filter(result => result.clippedControls?.length).length,
    uncontainedTableCases:results.filter(result => result.tables?.some(table => table.outsideViewport && !table.contained)).length,
    screenshots:results.filter(result => result.screenshot).length,
    limitations:'Copy widths are review indicators, not automatic design failures; short labels and list containers are excluded. Inputs may scroll their values internally, so controls are checked for viewport clipping while button/link labels are also checked for hidden overflow. At most 12 examples per width indicator are listed. Screenshots show selected content sections, not the full page. No forms submitted.',
  };
  await writeFile(resolve(output, `${phase}-audit.json`), JSON.stringify({ summary, results }, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
} finally { await browser.close(); await server.close(); }
