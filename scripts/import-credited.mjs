/**
 * Credited client or press photographs for the media library.
 * Same output shape as scripts/import-previews.mjs: full webp + jpeg (1800px max), 800px thumbs,
 * plus sizes, alt text and blur placeholders in src/content/credited-media.json. Re-encoding strips
 * the source metadata.
 *
 * The manifest (scripts/credited/<name>.json) records, per image id: the original image URL,
 * the page it was published on, the alt text, and the credit for the whole set. The credit
 * must also be set on the case-study gallery entry and in docs/asset-rights.md.
 *
 *   node scripts/import-credited.mjs <manifest.json> [source-dir]
 *     Encode, then write credited-media.json. Without source-dir the originals are downloaded.
 *   node scripts/import-credited.mjs --build
 *     Run by `npm run build` (prebuild): make sure every manifest's encoded files exist in
 *     public/media, downloading and encoding any that are missing. Writes no JSON. Fails the
 *     build if an image cannot be produced, so a page never deploys with a missing photograph.
 *
 * The encoded files are produced at build time because they were added through a text-only
 * commit path. Committing the encoded files to public/media/img makes the download a no-op.
 */
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const imgOut = path.join(root, 'public/media/img');
const thumbOut = path.join(root, 'public/media/img/thumbs');

const exists = (file) => access(file).then(() => true, () => false);

async function original(frame, sourceDir) {
  if (sourceDir) return readFile(path.join(sourceDir, frame.file));
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(frame.image, { headers: { 'user-agent': 'Mozilla/5.0 (mrwallcover.com build)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error(`Could not download ${frame.image}: ${lastError?.message}`);
}

async function encode(id, input) {
  const image = sharp(input).rotate();
  await image.clone().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(imgOut, `${id}.webp`));
  await image.clone().resize({ width: 1800, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(imgOut, `${id}.jpg`));
  await image.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 74 }).toFile(path.join(thumbOut, `${id}-800.webp`));
  await image.clone().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 76, mozjpeg: true }).toFile(path.join(thumbOut, `${id}-800.jpg`));
  return image;
}

const outputs = (id) => [
  path.join(imgOut, `${id}.webp`),
  path.join(imgOut, `${id}.jpg`),
  path.join(thumbOut, `${id}-800.webp`),
  path.join(thumbOut, `${id}-800.jpg`),
];

await mkdir(thumbOut, { recursive: true });

if (process.argv[2] === '--build') {
  const dir = path.join(root, 'scripts/credited');
  for (const name of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
    const manifest = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    for (const [id, frame] of Object.entries(manifest.images)) {
      if ((await Promise.all(outputs(id).map(exists))).every(Boolean)) continue;
      await encode(id, await original(frame));
      console.log(`credited image ${id} encoded from ${frame.image}`);
    }
  }
  process.exit(0);
}

const [manifestPath, sourceDir] = process.argv.slice(2);
if (!manifestPath) {
  console.error('Usage: node scripts/import-credited.mjs <manifest.json> [source-dir] | --build');
  process.exit(1);
}
const manifest = JSON.parse(await readFile(path.resolve(manifestPath), 'utf8'));
const creditedPath = path.join(root, 'src/content/credited-media.json');
const credited = (await exists(creditedPath)) ? JSON.parse(await readFile(creditedPath, 'utf8')) : {};

for (const [id, frame] of Object.entries(manifest.images)) {
  const image = await encode(id, await original(frame, sourceDir));
  const full = await sharp(path.join(imgOut, `${id}.webp`)).metadata();
  const thumb = await sharp(path.join(thumbOut, `${id}-800.webp`)).metadata();
  const blur = await image.clone().resize({ width: 24 }).webp({ quality: 20 }).toBuffer();
  credited[id] = {
    width: full.width,
    height: full.height,
    src: `/media/img/${id}.webp`,
    jpg: `/media/img/${id}.jpg`,
    thumb: `/media/img/thumbs/${id}-800.webp`,
    thumbJpg: `/media/img/thumbs/${id}-800.jpg`,
    thumbWidth: thumb.width,
    thumbHeight: thumb.height,
    hasFull: true,
    alt: frame.alt,
    manifestNote: `${manifest.note}; credit ${manifest.credit}; source ${frame.page}`,
    placeholder: `data:image/webp;base64,${blur.toString('base64')}`,
  };
  console.log(id, full.width, full.height);
}

await writeFile(creditedPath, `${JSON.stringify(credited, null, 2)}\n`);
