/**
 * Official photographs published by a hotel or brand of its own finished rooms, used where we
 * have no (or too few) photographs of our own. They are credited to the hotel, never to us.
 * Each scripts/official/<hotel>.json records the hotel, the page the images were published on,
 * the original image URL per frame, the download date, the terms page and a summary of its terms,
 * the credit line and the alt text. The originals are downloaded, EXIF-stripped copies are kept
 * outside the repo, and this encodes the same responsive set as scripts/import-ig-pack.mjs
 * (<id>-<w>.avif|webp in public/media/img/r/, JPEGs at 800 and the top width, a blur placeholder),
 * writing sizes.json, alts.json and placeholders.json. Re-encoding drops any remaining metadata.
 *
 * The manifestNote carries "credit Photograph: <hotel>" and "terms <url>", so src/lib/schema.ts
 * gives every frame the hotel as creator and copyright holder (with "owner <url>", the
 * hotel's own page, as the creator url), and the hotel's terms page as
 * license and acquireLicensePage. The same credit must be set on the case-study gallery entry
 * and in docs/asset-rights.md.
 *
 *   node scripts/import-official-photos.mjs <source-dir> scripts/official/<hotel>.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public/media/img/r');
const files = {
  sizes: path.join(root, 'src/content/sizes.json'),
  alts: path.join(root, 'src/content/alts.json'),
  placeholders: path.join(root, 'src/content/placeholders.json'),
};
const [sourceDir, manifestPath] = process.argv.slice(2);
if (!sourceDir || !manifestPath) {
  console.error('Usage: node scripts/import-official-photos.mjs <source-dir> <manifest.json>');
  process.exit(1);
}
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const sizes = JSON.parse(await readFile(files.sizes, 'utf8'));
const alts = JSON.parse(await readFile(files.alts, 'utf8'));
const placeholders = JSON.parse(await readFile(files.placeholders, 'utf8'));
await mkdir(outDir, { recursive: true });

for (const [id, frame] of Object.entries(manifest.images)) {
  if (alts[id] && !alts[id].manifestNote.includes(frame.image)) throw new Error(`${id} already exists for another photograph`);
  const buffer = await sharp(path.join(sourceDir, frame.file)).rotate().toBuffer();
  const meta = await sharp(buffer).metadata();
  const top = Math.min(meta.width, 2400);
  const widths = [...new Set([480, 800, 1200, 1600].filter((w) => w < top).concat(top))];
  for (const w of widths) {
    const resized = sharp(buffer).resize({ width: w, withoutEnlargement: true });
    await resized.clone().avif({ quality: 52, effort: 4 }).toFile(path.join(outDir, `${id}-${w}.avif`));
    await resized.clone().webp({ quality: 76 }).toFile(path.join(outDir, `${id}-${w}.webp`));
  }
  for (const w of [...new Set([Math.min(800, top), top])]) {
    await sharp(buffer).resize({ width: w, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(outDir, `${id}-${w}.jpg`));
  }
  const thumbW = Math.min(800, top);
  sizes[id] = {
    width: top,
    height: Math.round((meta.height * top) / meta.width),
    src: `/media/img/r/${id}-${top}.webp`,
    jpg: `/media/img/r/${id}-${top}.jpg`,
    thumb: `/media/img/r/${id}-${thumbW}.webp`,
    thumbJpg: `/media/img/r/${id}-${thumbW}.jpg`,
    thumbWidth: thumbW,
    thumbHeight: Math.round((meta.height * thumbW) / meta.width),
    hasFull: true,
    variants: { base: `/media/img/r/${id}`, widths },
  };
  alts[id] = {
    alt: frame.alt,
    manifestNote: `${manifest.note}; credit ${frame.credit ?? manifest.credit}${manifest.ownerUrl ? `; owner ${manifest.ownerUrl}` : ''}; terms ${manifest.terms}; source ${manifest.page}; image ${frame.image}; downloaded ${manifest.downloaded}; ${manifest.caseStudy}`,
  };
  const tiny = await sharp(buffer).resize(24).webp({ quality: 40 }).toBuffer();
  placeholders[id] = `data:image/webp;base64,${tiny.toString('base64')}`;
  console.log(`${id} ${meta.width}x${meta.height} -> ${widths.join('/')}`);
}
await writeFile(files.sizes, `${JSON.stringify(sizes, null, 2)}\n`);
await writeFile(files.alts, `${JSON.stringify(alts, null, 2)}\n`);
await writeFile(files.placeholders, `${JSON.stringify(placeholders, null, 2)}\n`);
