import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(import.meta.dirname, '..');
const source = '/tmp/mw-assets/assets';
const imgOut = path.join(root, 'public/media/img');
const thumbOut = path.join(root, 'public/media/img/thumbs');
const videoOut = path.join(root, 'public/media/video');
const heroOut = path.join(root, 'public/media/hero');

const own = Array.from({ length: 12 }, (_, i) => `browns-hotel-mayfair-${String(i + 1).padStart(2, '0')}`);
const modest = [
  'owo-whitehall-01',
  'four-seasons-ten-trinity-01',
  'hilton-holborn-01',
  'hilton-silverstone-01',
  'old-bailey-hotel-01',
];

async function copyPair(id, full) {
  const thumbBase = `${id}-800`;
  await cp(path.join(source, 'img/thumbs', `${thumbBase}.webp`), path.join(thumbOut, `${thumbBase}.webp`));
  await cp(path.join(source, 'img/thumbs', `${thumbBase}.jpg`), path.join(thumbOut, `${thumbBase}.jpg`));
  if (full) {
    await cp(path.join(source, 'img', `${id}.webp`), path.join(imgOut, `${id}.webp`));
    await cp(path.join(source, 'img', `${id}.jpg`), path.join(imgOut, `${id}.jpg`));
  }
}

async function measure(file) {
  const meta = await sharp(file).metadata();
  return { width: meta.width, height: meta.height };
}

await mkdir(imgOut, { recursive: true });
await mkdir(thumbOut, { recursive: true });
await mkdir(videoOut, { recursive: true });
await mkdir(heroOut, { recursive: true });

const sizes = {};
for (const id of own) {
  await copyPair(id, true);
  const full = await measure(path.join(imgOut, `${id}.webp`));
  const thumb = await measure(path.join(thumbOut, `${id}-800.webp`));
  sizes[id] = {
    width: full.width,
    height: full.height,
    src: `/media/img/${id}.webp`,
    jpg: `/media/img/${id}.jpg`,
    thumb: `/media/img/thumbs/${id}-800.webp`,
    thumbJpg: `/media/img/thumbs/${id}-800.jpg`,
    thumbWidth: thumb.width,
    thumbHeight: thumb.height,
    hasFull: true,
  };
}
for (const id of modest) {
  await copyPair(id, false);
  const thumb = await measure(path.join(thumbOut, `${id}-800.webp`));
  sizes[id] = {
    width: thumb.width,
    height: thumb.height,
    src: `/media/img/thumbs/${id}-800.webp`,
    jpg: `/media/img/thumbs/${id}-800.jpg`,
    thumb: `/media/img/thumbs/${id}-800.webp`,
    thumbJpg: `/media/img/thumbs/${id}-800.jpg`,
    thumbWidth: thumb.width,
    thumbHeight: thumb.height,
    hasFull: false,
  };
}

const heroSource = path.join(source, 'img/browns-hotel-mayfair-02.jpg');
const heroWidths = [640, 960, 1280, 1920];
for (const width of heroWidths) {
  await sharp(heroSource)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 74 })
    .toFile(path.join(heroOut, `corridor-${width}.webp`));
}
await sharp(heroSource)
  .rotate()
  .resize({ width: 1280, withoutEnlargement: true })
  .jpeg({ quality: 76, mozjpeg: true })
  .toFile(path.join(heroOut, 'corridor-1280.jpg'));

const heroFull = await measure(path.join(source, 'img/browns-hotel-mayfair-02.webp'));
const hero = {
  id: 'browns-hotel-mayfair-02',
  width: heroFull.width,
  height: heroFull.height,
  sources: await Promise.all(
    heroWidths.map(async (width) => {
      const file = path.join(heroOut, `corridor-${width}.webp`);
      const meta = await measure(file);
      return { src: `/media/hero/corridor-${width}.webp`, width: meta.width };
    }),
  ),
  fallback: '/media/hero/corridor-1280.jpg',
};

for (const name of [
  'browns-hotel-mayfair-video-01.mp4',
  'browns-hotel-mayfair-video-02.mp4',
  'browns-hotel-mayfair-video-03.mp4',
  'browns-hotel-mayfair-video-01-poster.jpg',
  'browns-hotel-mayfair-video-02-poster.jpg',
  'browns-hotel-mayfair-video-03-poster.jpg',
]) {
  await cp(path.join(source, 'video', name), path.join(videoOut, name));
}

function renderSvg(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      fontFiles: [
        '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      ],
      loadSystemFonts: false,
    },
  });
  return resvg.render().asPng();
}

const photo = await sharp(heroSource)
  .rotate()
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .toBuffer();
const panel = renderSvg(
  `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="560" height="630" fill="#141210"/>
    <text x="56" y="268" fill="#c6a36a" font-family="Liberation Sans" font-size="18">WALLPAPER INSTALLER, LONDON</text>
    <text x="56" y="348" fill="#f4f0e8" font-family="Liberation Serif" font-size="68">Mr Wallcover</text>
    <text x="56" y="404" fill="#f4f0e8" font-family="Liberation Sans" font-size="22">Surveying, supply, install, aftercare</text>
  </svg>`,
  1200,
);
await sharp(photo)
  .composite([{ input: panel, top: 0, left: 0 }])
  .jpeg({ quality: 80, mozjpeg: true })
  .toFile(path.join(root, 'public/og.jpg'));

const icon = renderSvg(
  `<svg width="180" height="180" xmlns="http://www.w3.org/2000/svg">
    <rect width="180" height="180" fill="#141210"/>
    <text x="90" y="118" text-anchor="middle" fill="#c6a36a" font-family="Liberation Serif" font-size="92">M</text>
  </svg>`,
  180,
);
await sharp(icon).png().toFile(path.join(root, 'public/apple-touch-icon.png'));

await writeFile(path.join(root, 'src/content/sizes.json'), JSON.stringify(sizes, null, 2) + '\n');
await writeFile(path.join(root, 'src/content/hero.json'), JSON.stringify(hero, null, 2) + '\n');

const placeholders = {};
for (const [id, file] of Object.entries(sizes)) {
  const blurred = await sharp(path.join(root, 'public' + file.thumb))
    .resize(32)
    .blur(1)
    .webp({ quality: 30 })
    .toBuffer();
  placeholders[id] = `data:image/webp;base64,${blurred.toString('base64')}`;
}
await writeFile(path.join(root, 'src/content/placeholders.json'), JSON.stringify(placeholders) + '\n');

const alts = JSON.parse(await readFile(path.join(root, 'src/content/alts.json'), 'utf8'));
const missing = Object.keys(sizes).filter((id) => !alts[id]);
if (missing.length) throw new Error(`Missing alts: ${missing.join(', ')}`);
console.log(`Media ready: ${Object.keys(sizes).length} images, hero, og.`);
