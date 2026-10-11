// Computed-style checks on the built site (laptop visual audit, 10 Oct 2026). Needs a Chrome or Chromium:
// set CHROME_PATH, or it looks in the usual places (GitHub's ubuntu runners ship Google Chrome).
//  1. Type floors on /, /projects/, a case study, /about/ and /faq/ at 1280, 1440, 1920, 390 and 360:
//     no visible text under 14px, except uppercase labels, eyebrows and credits (13px floor); long
//     paragraphs at least 16px.
//  2. Hero contrast: the kicker, the title, the description and the award line reach 4.5:1 against the
//     photograph behind them, measured on the rendered pixels with the text hidden and no text-shadow help.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import sharp from 'sharp';

const DIST = 'dist';
const PAGES = ['/', '/projects/', '/projects/calico-lee-broom-overture/', '/about/', '/faq/',
  // Pages from #30-#32: buyer FAQs, the hotel guide, aftercare, the AI page and the three ads pages.
  '/professionals/hotels/', '/advice/hotel-wallcovering-specification/', '/aftercare/', '/for-ai/',
  '/services/heritage-listed-buildings/', '/materials/specified-papers/', '/professionals/fit-out-contractors/'];
const SIZES: [number, number][] = [[1280, 800], [1440, 900], [1920, 1080], [390, 844], [360, 640]];
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };

function chromePath(): string {
  const candidates = [process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  const found = candidates.find((p) => p && existsSync(p));
  assert.ok(found, 'No Chrome found: set CHROME_PATH to a Chrome or Chromium binary');
  return found!;
}

let server: Server; let origin = ''; let browser: Browser;
before(async () => {
  server = createServer(async (req, res) => {
    let path = normalize(decodeURIComponent((req.url || '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIST, path);
    try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(DIST, '404.html'); res.statusCode = 404; }
    try { const body = await readFile(file); res.setHeader('content-type', TYPES[extname(file)] || 'application/octet-stream'); res.end(body); } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const address = server.address(); origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ['--no-sandbox', '--hide-scrollbars'] });
});
after(async () => { await browser?.close(); server?.close(); });

test('type floors: 14px text, 13px labels and credits, 16px paragraphs, on twelve pages at five widths', async () => {
  const problems: string[] = [];
  for (const path of PAGES) for (const [width, height] of SIZES) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(origin + path, { waitUntil: 'networkidle0' });
    // content-visibility:auto skips layout far below the fold; measure every section, rendered.
    await page.addStyleTag({ content: '* { content-visibility: visible !important; }' });
    const found = await page.evaluate(() => {
      const LABEL = /kicker|eyebrow|credit|label|place|pillars|meta|count|number/;
      const out: string[] = []; const seen = new Set<Element>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode; const text = (node.textContent || '').trim(); if (!text) continue;
        const el = node.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
        if (el.closest('script,style,noscript,template,.sr-only,[hidden]')) continue;
        const box = el.getBoundingClientRect(); if (box.width <= 1 || box.height <= 1) continue;
        let hidden = false;
        for (let p: Element | null = el; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0) { hidden = true; break; } if (p.tagName === 'DETAILS' && !(p as HTMLDetailsElement).open && !el.closest('summary')) { hidden = true; break; } }
        if (hidden || /^[↗+×→←\s·|]+$/.test(text)) continue;
        const cs = getComputedStyle(el); const size = parseFloat(cs.fontSize);
        const classes = [el, el.parentElement, el.parentElement?.parentElement].map((e) => (e?.className?.toString?.() || '')).join(' ');
        const label = cs.textTransform === 'uppercase' || (text === text.toUpperCase() && /[A-Z]{2}/.test(text)) || LABEL.test(classes);
        const where = `<${el.tagName.toLowerCase()} class="${(el.className?.toString?.() || '').slice(0, 40)}"> "${text.slice(0, 40)}" ${size}px`;
        if (size < (label ? 13 : 14) - 0.01) out.push(`${label ? 'label' : 'text'} under floor: ${where}`);
        const paragraph = ['P', 'LI', 'DD'].includes(el.tagName) && !label && !/caption/.test(classes) && el.tagName !== 'FIGCAPTION' && text.length > 80;
        // The hero description keeps the hero's frozen layout; on phones it sits at the 14px floor (main's size).
        const heroLede = el.matches('.atelier-hero-description') && innerWidth < 768;
        // Form helper notes (enquiry stack, Codex-owned) are notes, not reading text: the 14px floor applies.
        const formNote = el.matches('.form-note, form p.text-sm, .text-sm.text-stone') ;
        if (paragraph && !heroLede && !formNote && size < 16 - 0.01) out.push(`paragraph under 16px: ${where}`);
      }
      return out;
    });
    for (const f of found) problems.push(`${path} @${width}x${height}: ${f}`);
    await page.close();
  }
  assert.deepEqual(problems, [], problems.slice(0, 40).join('\n'));
});

function luminance([r, g, b]: number[]): number {
  const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

test('hero text holds 4.5:1 against the photograph at every width', async () => {
  const problems: string[] = []; const report: string[] = [];
  const targets = ['.atelier-hero-content .atelier-kicker', '#hero-heading', '.atelier-hero-description', '.atelier-hero-award a'];
  for (const [width, height] of [...SIZES, [375, 667], [412, 915]] as [number, number][]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(origin + '/', { waitUntil: 'networkidle0' });
    await page.evaluate(async () => { const img = document.querySelector('.atelier-hero img') as HTMLImageElement | null; if (img && !img.complete) await new Promise((ok) => img.addEventListener('load', ok, { once: true })); });
    const boxes = await page.evaluate((sel: string[]) => sel.map((s) => {
      const el = document.querySelector(s) as HTMLElement | null; if (!el) return null;
      if (getComputedStyle(el).display === 'none') return null;
      // The ink itself: the text's own box, not the block's full width.
      const range = document.createRange(); range.selectNodeContents(el); const b = range.getBoundingClientRect(); if (b.width < 2) return null;
      const rgb = getComputedStyle(el).color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      return { s, x: b.left, y: b.top, w: b.width, h: b.height, rgb };
    }), targets);
    // Hide every word in the hero (no text, no shadow) and shoot what is behind it.
    await page.addStyleTag({ content: '.atelier-hero-content, .atelier-hero-content * { color: transparent !important; text-shadow: none !important; border-color: transparent !important; } .atelier-hero-actions, .atelier-hero-foot { visibility: hidden !important; } .site-header, .dock { visibility: hidden !important; }' });
    await new Promise((ok) => setTimeout(ok, 150));
    for (const box of boxes) {
      if (!box) continue;
      const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.w, width - Math.max(0, box.x)), height: box.h };
      const png = await page.screenshot({ clip, type: 'png' });
      const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const lums: number[] = [];
      for (let i = 0; i < data.length; i += info.channels) lums.push(luminance([data[i], data[i + 1], data[i + 2]]));
      lums.sort((a, b) => a - b);
      const bg = lums[Math.floor(lums.length * 0.95)]; // the brightest 5% of the photograph behind the words
      const fg = luminance(box.rgb);
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      report.push(`${width}x${height} ${box.s} ${ratio.toFixed(2)}`);
      if (ratio < 4.5) problems.push(`${width}x${height} ${box.s}: ${ratio.toFixed(2)}:1`);
    }
    await page.close();
  }
  console.log(report.join('\n'));
  assert.deepEqual(problems, [], problems.join('\n'));
});
