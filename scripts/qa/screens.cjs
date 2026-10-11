// Full-page screenshots that wait for every image to load AND decode, so no
// lazy-load blur placeholder is ever captured mid-load.
// Usage: NODE_PATH=<dir with playwright> node scripts/qa/screens.cjs <outDir> <name>=<url> ...
// SCREENS_VIEWPORT=1 also saves <name>-<w>-viewport.png: the first screen, after every image has decoded.
const { chromium } = require('playwright');
(async () => {
  const [outDir, ...jobs] = process.argv.slice(2);
  const b = await chromium.launch();
  for (const job of jobs) {
    const [name, url] = job.split(/=(.*)/s);
    for (const w of [1440, 390]) {
      const p = await b.newPage({ viewport: { width: w, height: 900 } });
      await p.goto(url, { waitUntil: 'networkidle' });
      // Promote every lazy image to eager, scroll the page through, then wait for load + decode.
      await p.evaluate(async () => {
        document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
        for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); }
        window.scrollTo(0, 0);
        const imgs = [...document.images];
        await Promise.all(imgs.map((img) => (img.complete && img.naturalWidth ? img.decode().catch(() => {}) : new Promise((r) => { img.addEventListener('load', () => img.decode().then(r, r), { once: true }); img.addEventListener('error', r, { once: true }); }))));
      });
      await p.waitForLoadState('networkidle');
      const pending = await p.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.currentSrc || i.src));
      if (pending.length) { console.error(`${name}@${w}: ${pending.length} images not loaded`, pending.slice(0, 3)); process.exitCode = 1; }
      if (process.env.SCREENS_VIEWPORT) await p.screenshot({ path: `${outDir}/${name}-${w}-viewport.png` });
      await p.screenshot({ path: `${outDir}/${name}-${w}.png`, fullPage: true });
      await p.close();
      console.log(`${name}@${w} ok`);
    }
  }
  await b.close();
})();
