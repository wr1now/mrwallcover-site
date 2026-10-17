import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve, launchBrowser } from './visual-browser.mjs';

const output = resolve(process.env.MW_VISUAL_OUTPUT || '.review-screens');
const root = process.env.MW_VISUAL_DIST || 'dist';
const label = process.env.MW_VISUAL_LABEL || 'after';
const routes = [['home','/'],['services','/services/'],['guide','/advice/'],['contact','/contact/'],['timorous','/services/timorous-beasties-installer/']];
await mkdir(output, { recursive:true });
const server = await serve(root);
const browser = await launchBrowser();
const metrics = [];
try {
  for (const [name, path] of routes) for (const width of [390,1440]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height:width === 390 ? 844 : 1000, deviceScaleFactor:1 });
    await page.goto(server.origin + path, { waitUntil:'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    // Exercise the real lazy-loading/placeholder lifecycle before a full-page capture.
    await page.evaluate(async () => {
      for (let y=0; y<document.documentElement.scrollHeight; y+=innerHeight*.8) {
        scrollTo(0,y);
        await new Promise(requestAnimationFrame);
      }
      const images=[...document.images];
      await Promise.all(images.map(async (img) => { img.loading='eager'; try { await img.decode(); } catch {} }));
      scrollTo(0,0);
      await new Promise(requestAnimationFrame);
    });
    await page.waitForNetworkIdle({ idleTime:700 });
    await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
    await page.screenshot({ path:`${output}/${label}-${name}-${width}.jpg`, fullPage:true, type:'jpeg', quality:80 });
    const footer = await page.$('.site-footer');
    // Isolate the footer without the fixed navigation covering the component crop.
    const mask = await page.addStyleTag({ content:'.site-header, .dock { visibility:hidden !important; }' });
    await footer.screenshot({ path:`${output}/${label}-${name}-footer-${width}.jpg`, type:'jpeg', quality:85 });
    await mask.evaluate((element) => element.remove());
    metrics.push(await page.evaluate((route) => ({ route, width:innerWidth, domContentLoadedMs:Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd), resources:performance.getEntriesByType('resource').length, transferredBytes:performance.getEntriesByType('resource').reduce((n,r)=>n+r.transferSize,0), documentBytes:performance.getEntriesByType('navigation')[0].transferSize, overflow:document.documentElement.scrollWidth > innerWidth }), path));
    await page.close();
  }
  await writeFile(`${output}/${label}-metrics.json`, JSON.stringify(metrics,null,2)+'\n');
  console.log(`Saved ${label} screenshots and local lab transfer/timing observations to ${output}`);
} finally { await browser.close(); await server.close(); }
