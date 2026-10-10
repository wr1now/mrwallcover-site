/**
 * Our own photographs, cut from the full-size camera originals into a responsive AVIF + WebP set
 * (the same <base>-<width>.avif|webp shape as MediaFile.variants), plus a JPEG at 800 and 1600 for
 * share cards and schema, and a blur placeholder. Re-encoding strips all EXIF, XMP and GPS data.
 *
 * The manifest (scripts/originals/<name>.json) lists, per image id: the photo number from the
 * numbered photo labels, the original file name, the widths to cut, the alt text and any
 * redact boxes ([x0, y0, x1, y1] as fractions of the upright image) to blur before encoding.
 * Window views, framed photographs and anything else that could identify a private home are
 * blurred here, so no unblurred pixel ever reaches public/media.
 *
 *   node scripts/build-own-originals.mjs scripts/originals/arch-trim.json <originals-dir>
 *     Encode into public/media/img/r/ and add each id to src/content/sizes.json, alts.json and
 *     placeholders.json (existing entries for other ids are left as they are). The originals stay off the repository; the encoded files are committed.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public/media/img/r');
const sizesFile = path.join(root, 'src/content/sizes.json');
const altsFile = path.join(root, 'src/content/alts.json');
const placeholderFile = path.join(root, 'src/content/placeholders.json');

const [manifestPath, sourceDir] = process.argv.slice(2);
if (!manifestPath || !sourceDir) {
  console.error('Usage: node scripts/build-own-originals.mjs <manifest.json> <originals-dir>');
  process.exit(1);
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const sizes = JSON.parse(await readFile(sizesFile, 'utf8'));
const alts = JSON.parse(await readFile(altsFile, 'utf8'));
const placeholders = JSON.parse(await readFile(placeholderFile, 'utf8'));
await mkdir(outDir, { recursive: true });

async function upright(file, redact = []) {
  const { data, info } = await sharp(path.join(sourceDir, file)).rotate().toBuffer({ resolveWithObject: true });
  if (!redact.length) return { buffer: data, width: info.width, height: info.height };
  const layers = [];
  for (const [x0, y0, x1, y1] of redact) {
    const left = Math.round(x0 * info.width);
    const top = Math.round(y0 * info.height);
    const width = Math.round((x1 - x0) * info.width);
    const height = Math.round((y1 - y0) * info.height);
    // Pixelate first, then blur heavily, so nothing in the box can be recovered.
    const small = await sharp(data).extract({ left, top, width, height }).resize(Math.max(4, Math.round(width / 120))).toBuffer();
    // A feathered mask fades the edge of the patch into the room, so it reads as soft focus, not a box.
    const feather = Math.round(Math.min(width, height) * 0.08);
    const box = Buffer.alloc(width * height);
    for (let y = feather; y < height - feather; y += 1) box.fill(255, y * width + feather, y * width + width - feather);
    const mask = await sharp(box, { raw: { width, height, channels: 1 } })
      .blur(Math.max(1, feather / 2))
      .extractChannel(0)
      .raw()
      .toBuffer();
    const patch = await sharp(small)
      .resize(width, height, { kernel: 'cubic' })
      .blur(40)
      .removeAlpha()
      .joinChannel(mask, { raw: { width, height, channels: 1 } })
      .png()
      .toBuffer();
    layers.push({ input: patch, left, top });
  }
  const buffer = await sharp(data).composite(layers).jpeg({ quality: 95 }).toBuffer();
  return { buffer, width: info.width, height: info.height };
}

for (const [id, frame] of Object.entries(manifest.images)) {
  const { buffer, width, height } = await upright(frame.file, frame.redact);
  const widths = frame.widths.filter((w) => w <= width);
  for (const w of widths) {
    const resized = sharp(buffer).resize({ width: w });
    await resized.clone().avif({ quality: 52, effort: 6 }).toFile(path.join(outDir, `${id}-${w}.avif`));
    await resized.clone().webp({ quality: 76 }).toFile(path.join(outDir, `${id}-${w}.webp`));
  }
  for (const w of [800, 1600]) {
    await sharp(buffer).resize({ width: w }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(outDir, `${id}-${w}.jpg`));
  }
  const top = widths.at(-1);
  const h = Math.round((height * top) / width);
  const thumbH = Math.round((height * 800) / width);
  sizes[id] = {
    width: top,
    height: h,
    src: `/media/img/r/${id}-${top}.webp`,
    jpg: `/media/img/r/${id}-1600.jpg`,
    thumb: `/media/img/r/${id}-800.webp`,
    thumbJpg: `/media/img/r/${id}-800.jpg`,
    thumbWidth: 800,
    thumbHeight: thumbH,
    hasFull: true,
    variants: { base: `/media/img/r/${id}`, widths },
  };
  alts[id] = {
    alt: frame.alt,
    manifestNote: `own photograph, photo #${frame.photo}, ${manifest.caseStudy}${frame.redact ? ', identifying detail blurred' : ''}`,
  };
  const tiny = await sharp(buffer).resize(24).webp({ quality: 40 }).toBuffer();
  placeholders[id] = `data:image/webp;base64,${tiny.toString('base64')}`;
  console.log(`${id} (#${frame.photo}) ${widths.join('/')}${frame.redact ? ' blurred' : ''}`);
}

await writeFile(sizesFile, `${JSON.stringify(sizes, null, 2)}\n`);
await writeFile(altsFile, `${JSON.stringify(alts, null, 2)}\n`);
await writeFile(placeholderFile, `${JSON.stringify(placeholders, null, 2)}\n`);
