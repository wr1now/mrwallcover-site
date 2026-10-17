import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
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
    // Render off-screen sections too; contain-intrinsic-size placeholders are not evidence.
    await page.addStyleTag({ content:'* { content-visibility:visible !important; contain-intrinsic-size:none !important; } html { scroll-behavior:auto !important; overflow-anchor:none !important; }' });
    await page.evaluate(() => document.fonts.ready);
    // Exercise the real lazy-loading/placeholder lifecycle before a full-page capture.
    await page.evaluate(async () => {
      for (let y=0; y<document.documentElement.scrollHeight; y+=innerHeight*.8) {
        scrollTo({ top:y, left:0, behavior:'instant' });
        await new Promise(requestAnimationFrame);
      }
      const images=[...document.images];
      await Promise.all(images.map(async (img) => { img.loading='eager'; try { await img.decode(); } catch {} }));
      scrollTo({ top:0, left:0, behavior:'instant' });
      await new Promise(requestAnimationFrame);
    });
    await page.waitForNetworkIdle({ idleTime:700 });
    await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
    const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const file = `${output}/${label}-${name}-${width}.jpg`;
    if (fullHeight > 12000) {
      // Chrome can repeat raster tiles beyond 16,384px. Stitch real viewport captures instead.
      const height = page.viewport().height;
      const tiles = [];
      const dockMask = await page.addStyleTag({ content:'.dock { visibility:hidden !important; }' });
      let headerMask;
      for (let top=0; top<fullHeight;) {
        if (top && !headerMask) headerMask=await page.addStyleTag({ content:'.site-header { visibility:hidden !important; }' });
        await page.evaluate(async (y) => {
          scrollTo({ top:y, left:0, behavior:'instant' });
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        },top);
        const { actual, currentHeight } = await page.evaluate(() => ({ actual:Math.round(scrollY), currentHeight:document.documentElement.scrollHeight }));
        if (currentHeight !== fullHeight) throw new Error(`${name} ${width}px changed height during capture: ${fullHeight} -> ${currentHeight}`);
        const offset = top - actual;
        // The final viewport is clamped to the document bottom. Crop only its
        // still-unrecorded rows so every document row is written exactly once.
        const tileHeight = Math.min(height - offset, fullHeight - top);
        if (offset < 0 || tileHeight <= 0) throw new Error(`${name} ${width}px cannot capture row ${top} from viewport ${actual}`);
        const tile = await page.screenshot({ type:'png' });
        const input = await sharp(tile).extract({ left:0, top:offset, width, height:tileHeight }).toBuffer();
        tiles.push({ input, left:0, top });
        top += tileHeight;
      }
      await sharp({create:{width,height:fullHeight,channels:3,background:'#f4f0e8'}}).composite(tiles).jpeg({quality:80}).toFile(file);
      await dockMask.evaluate((element)=>element.remove());
      if (headerMask) await headerMask.evaluate((element)=>element.remove());
    } else {
      await page.screenshot({ path:file, fullPage:true, type:'jpeg', quality:80 });
    }
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
