/**
 * Responsive AVIF + WebP sets for the legacy photographs that never had `variants`
 * (audit 22 Oct 2026, C-P1 and H-P2).
 *
 * Without `variants`, src/lib/picture.ts can only offer the 800w thumb and the full file, so a
 * DPR-3 phone fetched the 1500-1800w original for a 390px card. These entries have no larger
 * master in the repository, so the set is cut from the best copy already published.
 *
 * Usage: node scripts/build-legacy-variants.mjs [--dry-run] [--hero-original=<HEIC>]
 *
 * For every src/content/sizes.json entry without `variants`, writes
 * public/media/img/r/<id>-<w>.avif|webp (the same shape as MediaFile.variants) at 480/640/800/
 * 1200/1600/2000 plus the source width itself, never upscaling, and adds `variants` last.
 * With --hero-original, also writes the 1080w homepage hero candidate from the browns-bedroom
 * HEIC original and lists it in src/content/hero.json.
 * Existing media files are never overwritten (writes use the `wx` flag) and nothing is deleted;
 * the old src/jpg/thumb fields stay, so layouts and image-rights lookups keep their paths.
 * Metadata is never copied: sharp drops it unless asked, and we never ask.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const outDir = path.join(root, 'public/media/img/r');
const sizesPath = path.join(root, 'src/content/sizes.json');
const heroPath = path.join(root, 'src/content/hero.json');
const WIDTHS = [480, 640, 800, 1200, 1600, 2000];

let written = 0;
let bytes = 0;
const skipped = [];

/** Writes a new file only; an existing file is left untouched and reported. */
async function writeNew(file, buffer) {
  if (dryRun) return;
  try {
    await writeFile(file, buffer, { flag: 'wx' });
    written += 1;
    bytes += buffer.length;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    skipped.push(path.relative(root, file));
  }
}

/**
 * The best published copy: the most pixels, and the JPEG when the sizes match. Both are lossy
 * copies of one original and the JPEG carries more bytes per pixel, so it discarded less.
 */
async function bestSource(entry) {
  let best;
  for (const url of [entry.src, entry.jpg]) {
    const file = path.join(root, 'public', url);
    const { width, height } = await sharp(file).metadata();
    if (!best || width * height >= best.width * best.height) best = { file, width, height };
  }
  return best;
}

async function cut(id, entry) {
  const source = await bestSource(entry);
  // The source width tops the set (as scripts/build-originals.mjs does) so no display loses
  // resolution it has today; a 625w preview keeps 625w rather than dropping to 480w.
  const widths = [...new Set([...WIDTHS.filter((w) => w < source.width), source.width])];
  for (const w of dryRun ? [] : widths) {
    const resized = sharp(source.file).rotate().resize({ width: w, withoutEnlargement: true });
    const [avif, webp] = await Promise.all([
      resized.clone().avif({ quality: 52, effort: 5 }).toBuffer({ resolveWithObject: true }),
      resized.clone().webp({ quality: 76, effort: 5 }).toBuffer({ resolveWithObject: true }),
    ]);
    if (avif.info.width !== w || webp.info.width !== w) throw new Error(`${id}: ${w}w came out ${avif.info.width}w`);
    await writeNew(path.join(outDir, `${id}-${w}.avif`), avif.data);
    await writeNew(path.join(outDir, `${id}-${w}.webp`), webp.data);
  }
  entry.variants = { base: `/media/img/r/${id}`, widths };
  console.log(`${id}: ${widths.join('/')} from ${path.relative(root, source.file)} (${source.width}x${source.height})`);
}

await mkdir(outDir, { recursive: true });
const sizes = JSON.parse(await readFile(sizesPath, 'utf8'));
const queue = Object.entries(sizes).filter(([, entry]) => !entry.variants);
// libvips threads each encode already; a few entries at once keeps the cores busy without thrashing.
const lanes = Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));
await Promise.all(
  Array.from({ length: lanes }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) await cut(...next);
  }),
);
if (!dryRun) await writeFile(sizesPath, JSON.stringify(sizes, null, 2) + '\n');

// Hero (H-P2): between 960w and 1440w a DPR-3 phone had to take 1440w (259 KB) for a ~366px box.
// Cut like its siblings in docs/atelier-media-provenance.md, so it matches them per pixel: sips
// decodes the HEIC losslessly (this Sharp has no HEVC decoder), then WebP quality 86 / effort 6.
// That route reproduces the published 960w and 1440w files byte for byte.
const HERO_WIDTH = 1080;
const HERO_ORIGINAL_SHA256 = '3f32a583f98fa1480fa766a5265851fffeec4695fb2708f6d07f2cb516e4e66f';
const heroOriginal = process.argv.find((arg) => arg.startsWith('--hero-original='))?.slice('--hero-original='.length);
const hero = JSON.parse(await readFile(heroPath, 'utf8'));
if (hero.sources.some((source) => source.width === HERO_WIDTH)) {
  // Already listed; the file and its provenance row exist.
} else if (!heroOriginal) {
  console.log(`hero: skipped; pass --hero-original=<browns-bedroom HEIC> to cut the ${HERO_WIDTH}w file`);
} else {
  // Only the recorded original, so the provenance row stays true.
  const digest = createHash('sha256').update(await readFile(heroOriginal)).digest('hex');
  if (digest !== HERO_ORIGINAL_SHA256) throw new Error(`hero: ${heroOriginal} is not the recorded browns-bedroom original`);
  const tmp = await mkdtemp(path.join(tmpdir(), 'mw-hero-'));
  try {
    const png = path.join(tmp, 'browns-bedroom.png');
    execFileSync('sips', ['-s', 'format', 'png', heroOriginal, '--out', png], { stdio: 'ignore' });
    const src = `/media/atelier/browns-bedroom-${HERO_WIDTH}.webp`;
    const { data, info } = await sharp(png)
      .resize({ width: HERO_WIDTH, withoutEnlargement: true })
      .webp({ quality: 86, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    if (info.width !== HERO_WIDTH) throw new Error(`hero came out ${info.width}w`);
    await writeNew(path.join(root, 'public', src), data);
    hero.sources = [...hero.sources, { src, width: HERO_WIDTH }].sort((a, b) => a.width - b.width);
    if (!dryRun) await writeFile(heroPath, JSON.stringify(hero, null, 2) + '\n');
    console.log(`hero: ${src} (${info.width}x${info.height}, ${data.length} bytes, sha256 ${createHash('sha256').update(data).digest('hex')})`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

console.log(`${dryRun ? 'Dry run: ' : ''}${written} files written, ${bytes} bytes added.`);
if (skipped.length) console.log(`Left existing files untouched: ${skipped.join(', ')}`);
