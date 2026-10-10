/**
 * Homepage hero (the LCP image): AVIF + WebP at 480/800/1200/1600/2000 from the 2000px Brown's master,
 * written to public/media/hero/<id>-<w>.avif|webp and recorded in src/content/hero.json.
 * Usage: node scripts/build-hero.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const heroPath = path.join(root, 'src/content/hero.json');
const hero = JSON.parse(await readFile(heroPath, 'utf8'));
const master = path.join(root, `public/media/img/${hero.id}.jpg`);
const outDir = path.join(root, 'public/media/hero');
await mkdir(outDir, { recursive: true });
const meta = await sharp(master).metadata();
const widths = [...new Set([480, 800, 1200, 1600].filter((w) => w < meta.width).concat(meta.width))];
const avif = [];
const webp = [];
for (const w of widths) {
  const base = sharp(master).rotate().resize({ width: w });
  await base.clone().avif({ quality: 50, effort: 6 }).toFile(path.join(outDir, `${hero.id}-${w}.avif`));
  await base.clone().webp({ quality: 74, effort: 6 }).toFile(path.join(outDir, `${hero.id}-${w}.webp`));
  avif.push({ src: `/media/hero/${hero.id}-${w}.avif`, width: w });
  webp.push({ src: `/media/hero/${hero.id}-${w}.webp`, width: w });
}
hero.width = meta.width;
hero.height = meta.height;
hero.avif = avif;
hero.sources = webp;
hero.fallback = `/media/hero/${hero.id}-800.webp`;
/** One sizes value shared by the <picture> and the preload, so both pick the same file. */
hero.sizes = '(min-width: 1024px) 60vw, 100vw';
await writeFile(heroPath, JSON.stringify(hero, null, 2) + '\n');
console.log('hero', widths.join('/'));
