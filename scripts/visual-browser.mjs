/** Isolated test browser and static server; never attaches to a person's browser. */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer-core';

export async function serve(directory) {
  const root = resolve(directory);
  const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.webp':'image/webp', '.avif':'image/avif', '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2', '.json':'application/json' };
  const server = createServer(async (req, res) => {
    try {
      let file = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) file += '/index.html';
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { origin:`http://127.0.0.1:${server.address().port}`, close:() => new Promise((ok) => server.close(ok)) };
}

export async function launchBrowser() {
  const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
  if (!chrome) throw new Error('Set CHROME_PATH to the test Chrome/Chromium executable.');
  return puppeteer.launch({ executablePath:chrome, headless:true, args:['--no-sandbox'] });
}

/** Poll outside the page: disabling JavaScript also suppresses its interval/animation callbacks. */
export async function waitForPagePredicate(page, predicate, { timeout = 20000 } = {}, ...args) {
  const deadline = Date.now() + timeout;
  do {
    if (await page.evaluate(predicate, ...args)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Page state did not become ready within ${timeout}ms`);
}

/** Static-page readiness is the actual reading surface, independent of optional after-load scenes. */
export async function waitForPageContent(page) {
  try {
    await waitForPagePredicate(page, () => document.fonts.status === 'loaded'
      && [...document.images].filter(image => image.loading !== 'lazy').every(image => image.complete));
  } catch (cause) {
    const state = await page.evaluate(() => ({
      readyState: document.readyState, fontStatus: document.fonts.status,
      loadingFonts: [...document.fonts].filter(font => font.status === 'loading').map(font => font.family),
      pendingImages: [...document.images].filter(image => !image.complete).map(image => ({ src: image.currentSrc || image.src, loading: image.loading })),
    }));
    throw new Error(`Content readiness deadline exceeded: ${JSON.stringify(state)}`, { cause });
  }
}

export async function loadPage(page, url, navigationOptions = {}) {
  try {
    const response = await page.goto(url, { ...navigationOptions, waitUntil: 'load' });
    await waitForPageContent(page);
    return response;
  } catch (cause) {
    const viewport = page.viewport();
    throw new Error(`Page content not ready: ${url} @${viewport?.width ?? '?'}x${viewport?.height ?? '?'}`, { cause });
  }
}
