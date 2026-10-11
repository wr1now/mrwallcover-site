/**
 * Photographs from the @mrwallcover Instagram photo pack (wr1now/mrwallcover-ops, branch ig-pack,
 * MANIFEST.json): web-ready JPEGs, long edge up to 2400px, EXIF and GPS already stripped. Each
 * scripts/originals/ig-<name>.json lists, per image id, the pack file, the source post and date,
 * and the alt text. This encodes the same responsive set as build-own-originals.mjs
 * (<id>-<w>.avif|webp in public/media/img/r/, JPEGs at 800 and the top width for share cards and
 * schema, a blur placeholder) and writes sizes.json, alts.json and placeholders.json entries.
 * Never upscales: the top width is the photo's own width (Instagram frames are 1080-1440px).
 * The manifestNote records the source post, so the schema's image rights and the credits read
 * from the record (src/lib/schema.ts): "own photograph, Instagram @mrwallcover post <code>, <date>".
 *
 *   node scripts/import-ig-pack.mjs <ig-pack-dir> scripts/originals/ig-pendley-manor.json [more manifests ...]
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
const [packDir, ...manifestPaths] = process.argv.slice(2);
if (!packDir || !manifestPaths.length) {
  console.error('Usage: node scripts/import-ig-pack.mjs <ig-pack-dir> <manifest.json> [...]');
  process.exit(1);
}
const sizes = JSON.parse(await readFile(files.sizes, 'utf8'));
const alts = JSON.parse(await readFile(files.alts, 'utf8'));
const placeholders = JSON.parse(await readFile(files.placeholders, 'utf8'));
await mkdir(outDir, { recursive: true });

const jobs = [];
for (const manifestPath of manifestPaths) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const [id, frame] of Object.entries(manifest.images)) jobs.push({ id, frame, manifest });
}
async function encode({ id, frame, manifest }) {
  if (alts[id] && !alts[id].manifestNote.includes(frame.post)) throw new Error(`${id} already exists for another photograph`);
  const buffer = await sharp(path.join(packDir, frame.file)).rotate().toBuffer();
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
  const height = Math.round((meta.height * top) / meta.width);
  const thumbW = Math.min(800, top);
  sizes[id] = {
    width: top,
    height,
    src: `/media/img/r/${id}-${top}.webp`,
    jpg: `/media/img/r/${id}-${top}.jpg`,
    thumb: `/media/img/r/${id}-${thumbW}.webp`,
    thumbJpg: `/media/img/r/${id}-${thumbW}.jpg`,
    thumbWidth: thumbW,
    thumbHeight: Math.round((meta.height * thumbW) / meta.width),
    hasFull: true,
    variants: { base: `/media/img/r/${id}`, widths },
  };
  alts[id] = { alt: frame.alt, manifestNote: `own photograph, Instagram @mrwallcover post ${frame.post}, ${frame.date}, ${manifest.caseStudy}` };
  const tiny = await sharp(buffer).resize(24).webp({ quality: 40 }).toBuffer();
  placeholders[id] = `data:image/webp;base64,${tiny.toString('base64')}`;
  console.log(`${id} ${widths.join('/')}`);
}
// A small pool: AVIF encoding is the slow part, and each encode uses few threads.
const queue = [...jobs];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) await encode(queue.shift());
}));
await writeFile(files.sizes, `${JSON.stringify(sizes, null, 2)}\n`);
await writeFile(files.alts, `${JSON.stringify(alts, null, 2)}\n`);
await writeFile(files.placeholders, `${JSON.stringify(placeholders, null, 2)}\n`);
