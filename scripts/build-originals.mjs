/**
 * Award step 1: replace the small preview stills with responsive AVIF + WebP derivatives
 * cut from Dorin's own full-size iPhone originals (exported read-only from Apple Photos).
 *
 * Usage: node scripts/build-originals.mjs <masters-dir> [id ...]
 *   <masters-dir>/<id>.jpg is a crop-matched master: the same frame and crop as the old preview,
 *   at full resolution (prepared outside the repo; originals never enter git).
 *
 * Writes public/media/img/r/<id>-<w>.avif|webp at 480/800/1200/1600 (cards) and 2400 (case-study
 * leads), never upscaling, and adds `variants` to src/content/sizes.json. Metadata (EXIF, GPS,
 * ICC beyond sRGB) is never copied: sharp drops it unless asked, and we never ask.
 * The old preview files and thumb fields stay, so modest layouts keep their footprint.
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const masters = process.argv[2];
if (!masters) {
  console.error('Usage: node scripts/build-originals.mjs <masters-dir> [id ...]');
  process.exit(1);
}
const outDir = path.join(root, 'public/media/img/r');
const sizesPath = path.join(root, 'src/content/sizes.json');

/** Case-study lead images get a 2400px top width; everything else stops at 1600. */
const LEADS = new Set([
  'ahluwalia-estuary-07',
  'beverly-08',
  'lee-broom-08',
  'heathrow-05',
  'north-london-residence-01',
  'old-bailey-06',
  'trematon-01',
]);
const WIDTHS = [480, 800, 1200, 1600, 2400];

await mkdir(outDir, { recursive: true });
const sizes = JSON.parse(await readFile(sizesPath, 'utf8'));
const wanted = process.argv.slice(3);
const ids = wanted.length
  ? wanted
  : (await readdir(masters)).filter((f) => f.endsWith('.jpg')).map((f) => f.replace(/\.jpg$/, ''));

for (const id of ids) {
  if (!sizes[id]) throw new Error(`${id} is not in sizes.json`);
  const file = path.join(masters, `${id}.jpg`);
  const meta = await sharp(file).metadata();
  const max = LEADS.has(id) ? 2400 : 1600;
  const top = Math.min(max, meta.width);
  const widths = [...new Set([...WIDTHS.filter((w) => w < top), top])];
  let height = 0;
  for (const w of widths) {
    const base = sharp(file).rotate().resize({ width: w, withoutEnlargement: true });
    const info = await base.clone().webp({ quality: 76, effort: 5 }).toFile(path.join(outDir, `${id}-${w}.webp`));
    await base.clone().avif({ quality: 52, effort: 5 }).toFile(path.join(outDir, `${id}-${w}.avif`));
    if (w === top) height = info.height;
  }
  const entry = sizes[id];
  if (entry.modestWidth === undefined) entry.modestWidth = entry.thumbWidth;
  entry.width = top;
  entry.height = height;
  entry.src = `/media/img/r/${id}-${top}.webp`;
  entry.hasFull = true;
  entry.variants = { base: `/media/img/r/${id}`, widths };
  entry.source = 'own iPhone original (Apple Photos), metadata stripped';
  console.log(`${id}: ${widths.join('/')} (${top}x${height})`);
}
await writeFile(sizesPath, JSON.stringify(sizes, null, 2) + '\n');
console.log(`Done: ${ids.length} images.`);
