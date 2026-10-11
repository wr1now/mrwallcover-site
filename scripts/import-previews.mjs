/**
 * Encode cleaned preview stills into the same library shape as scripts/prepare-media.mjs:
 * full webp + jpeg, 800px thumbs, sizes, alts and blur placeholders.
 *
 * Usage: node scripts/import-previews.mjs <source-root>
 * Frames with a person in view are omitted on purpose.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const sourceRoot = process.argv[2];
if (!sourceRoot) {
  console.error('Usage: node scripts/import-previews.mjs <source-root>');
  process.exit(1);
}

const note = 'own photo, preview, metadata stripped';

/** @type {Record<string, { file: string, alt: string }>} */
const frames = {
  'pimlico-st-georges-square-exterior-01': {
    file: 'pimlico-st-georges-square-exterior/pimlico-st-georges-square-exterior-01.jpg',
    alt: "Rear brick elevation on St George's Square, seen from an upper balcony, under scaffold and sheeting.",
  },
  'pimlico-st-georges-square-exterior-02': {
    file: 'pimlico-st-georges-square-exterior/pimlico-st-georges-square-exterior-02.jpg',
    alt: "Front elevation on St George's Square under scaffold, with a columned portico and sash windows.",
  },
  'pimlico-st-georges-square-exterior-03': {
    file: 'pimlico-st-georges-square-exterior/pimlico-st-georges-square-exterior-03.jpg',
    alt: "Close view of a white stucco cornice and sash window on St George's Square, with scaffold poles in front.",
  },
  'pimlico-st-georges-square-exterior-04': {
    file: 'pimlico-st-georges-square-exterior/pimlico-st-georges-square-exterior-04.jpg',
    alt: "Scaffolded corner on St George's Square, with the cornice and upper sash windows.",
  },
  'pimlico-st-georges-square-exterior-06': {
    file: 'pimlico-st-georges-square-exterior/pimlico-st-georges-square-exterior-06.jpg',
    alt: "Rear elevation on St George's Square under a full scaffold, red brick and white render, with paint buckets on the boards.",
  },
  'pimlico-st-georges-square-exterior-07': {
    file: 'pimlico-st-georges-square-exterior/pimlico-st-georges-square-exterior-07.jpg',
    alt: "Ground-floor entrance on St George's Square under scaffold, with white columns, steps and black railings.",
  },
  'pimlico-st-georges-square-exterior-08': {
    file: 'pimlico-st-georges-square-exterior/pimlico-st-georges-square-exterior-08.jpg',
    alt: "Upper facade on St George's Square under scaffold, with sash windows, a cornice and a black balcony railing.",
  },
  'pimlico-st-georges-square-exterior-10': {
    file: 'pimlico-st-georges-square-exterior/pimlico-st-georges-square-exterior-10.jpg',
    alt: "Close view of a white stucco cornice on St George's Square, with scaffold beside the moulding.",
  },
  'pimlico-st-georges-square-exterior-11': {
    file: 'pimlico-st-georges-square-exterior/pimlico-st-georges-square-exterior-11.jpg',
    alt: "Finished white columned entrance and black railings on St George's Square, Pimlico, with the scaffold down.",
  },
  'inverness-terrace-exterior-01': {
    file: 'inverness-terrace-exterior/inverness-terrace-exterior-01.jpg',
    alt: "Rear brick elevation on Inverness Terrace, seen from above, under scaffold.",
  },
  'inverness-terrace-exterior-02': {
    file: 'inverness-terrace-exterior/inverness-terrace-exterior-02.jpg',
    alt: "Inverness Terrace front under scaffold netting, with black balcony ironwork and sash windows.",
  },
  'inverness-terrace-exterior-03': {
    file: 'inverness-terrace-exterior/inverness-terrace-exterior-03.jpg',
    alt: "Close view of ornamental capitals and a balcony railing on Inverness Terrace, with scaffold poles in front.",
  },
  'inverness-terrace-exterior-04': {
    file: 'inverness-terrace-exterior/inverness-terrace-exterior-04.jpg',
    alt: "Rear elevation on Inverness Terrace under scaffold, with white render, brick and sash windows.",
  },
  'inverness-terrace-exterior-05': {
    file: 'inverness-terrace-exterior/inverness-terrace-exterior-05.jpg',
    alt: "Close view of a sash window and white stucco surround on Inverness Terrace, with scaffold poles in front.",
  },
  'inverness-terrace-exterior-07': {
    file: 'inverness-terrace-exterior/inverness-terrace-exterior-07.jpg',
    alt: "Inverness Terrace front under scaffold netting, with a columned entrance, balconies and sash windows.",
  },
  'inverness-terrace-exterior-08': {
    file: 'inverness-terrace-exterior/inverness-terrace-exterior-08.jpg',
    alt: "Inverness Terrace front under scaffold, with a columned entrance and a first-floor balcony.",
  },
  'inverness-terrace-exterior-09': {
    file: 'inverness-terrace-exterior/inverness-terrace-exterior-09.jpg',
    alt: "Upper facade on Inverness Terrace under scaffold, with a stucco cornice, balcony brackets and a black iron railing.",
  },
  'inverness-terrace-exterior-10': {
    file: 'inverness-terrace-exterior/inverness-terrace-exterior-10.jpg',
    alt: "Finished white stucco frieze and sash windows on Inverness Terrace, Bayswater, with the scaffold down.",
  },
  'inverness-terrace-exterior-11': {
    file: 'inverness-terrace-exterior/inverness-terrace-exterior-11.jpg',
    alt: "Inverness Terrace front with balconies and sash windows, scaffold still on the facade.",
  },
  'penny-morrison-showroom-01': {
    file: 'penny-morrison-showroom/penny-morrison-showroom-01.jpg',
    alt: "Penny Morrison showroom at 9 Langton Street, with floral wallpaper, a marble fireplace and upholstered seating.",
  },
  'penny-morrison-showroom-02': {
    file: 'penny-morrison-showroom/penny-morrison-showroom-02.jpg',
    alt: "Floral wallpaper and upholstered seating in the Penny Morrison showroom.",
  },
  'penny-morrison-showroom-03': {
    file: 'penny-morrison-showroom/penny-morrison-showroom-03.jpg',
    alt: "Stair hall at the Penny Morrison showroom, lined with a scenic landscape wallpaper.",
  },
  'penny-morrison-showroom-04': {
    file: 'penny-morrison-showroom/penny-morrison-showroom-04.jpg',
    alt: "Penny Morrison showroom with floral wallpaper, a fireplace and a patterned red carpet.",
  },
  'penny-morrison-showroom-05': {
    file: 'penny-morrison-showroom/penny-morrison-showroom-05.jpg',
    alt: "Shelves of fabric samples beside floral wallpaper in the Penny Morrison showroom.",
  },
  'penny-morrison-showroom-06': {
    file: 'penny-morrison-showroom/penny-morrison-showroom-06.jpg',
    alt: "Close view of large-scale floral wallpaper in the Penny Morrison showroom.",
  },
  'penny-morrison-showroom-07': {
    file: 'penny-morrison-showroom/penny-morrison-showroom-07.jpg',
    alt: "Front elevation of the Penny Morrison showroom at 9 Langton Street during exterior decorating.",
  },
  'penny-morrison-showroom-08': {
    file: 'penny-morrison-showroom/penny-morrison-showroom-08.jpg',
    alt: "Upper sash windows on the Penny Morrison showroom front, with brick and stucco being prepared.",
  },
  'penny-morrison-showroom-09': {
    file: 'penny-morrison-showroom/penny-morrison-showroom-09.jpg',
    alt: "Finished white stucco and sash windows on the Penny Morrison showroom front.",
  },
  'penny-morrison-showroom-10': {
    file: 'penny-morrison-showroom/penny-morrison-showroom-10.jpg',
    alt: "Brick and stucco bay of the Penny Morrison showroom, with sash windows.",
  },
  'house-of-hackney-st-michaels-01': {
    file: 'house-of-hackney-st-michaels/house-of-hackney-st-michaels-01.jpg',
    alt: "Reception at the House of Hackney showroom in St Michael's Clergy House, with floral wallpaper and a stone fireplace.",
  },
  'house-of-hackney-st-michaels-02': {
    file: 'house-of-hackney-st-michaels/house-of-hackney-st-michaels-02.jpg',
    alt: "Concept room at the House of Hackney showroom, with scenic wallpaper above blue-grey panelling.",
  },
  'house-of-hackney-st-michaels-03': {
    file: 'house-of-hackney-st-michaels/house-of-hackney-st-michaels-03.jpg',
    alt: "Wallpapered walls and a wooden counter in a concept room at the House of Hackney showroom.",
  },
  'house-of-hackney-st-michaels-04': {
    file: 'house-of-hackney-st-michaels/house-of-hackney-st-michaels-04.jpg',
    alt: "Tiled cloakroom at the House of Hackney showroom, with botanical wallpaper above the tile line.",
  },
  'house-of-hackney-st-michaels-05': {
    file: 'house-of-hackney-st-michaels/house-of-hackney-st-michaels-05.jpg',
    alt: "Bedroom set at the House of Hackney showroom, with large floral wallpaper and a four-poster bed.",
  },
  'house-of-hackney-st-michaels-06': {
    file: 'house-of-hackney-st-michaels/house-of-hackney-st-michaels-06.jpg',
    alt: "Close view of large-scale floral wallpaper meeting the ceiling in the House of Hackney showroom.",
  },
  'house-of-hackney-st-michaels-08': {
    file: 'house-of-hackney-st-michaels/house-of-hackney-st-michaels-08.jpg',
    alt: "Passage at the House of Hackney showroom, with scenic wallpaper above panelling.",
  },
  'house-of-hackney-st-michaels-09': {
    file: 'house-of-hackney-st-michaels/house-of-hackney-st-michaels-09.jpg',
    alt: "Concept room at the House of Hackney showroom, with dense floral wallpaper and a daybed.",
  },
  'house-of-hackney-st-michaels-10': {
    file: 'house-of-hackney-st-michaels/house-of-hackney-st-michaels-10.jpg',
    alt: "Wallpapered room at the House of Hackney showroom, with a blue sofa and a gilded mirror.",
  },
  'house-of-hackney-st-michaels-11': {
    file: 'house-of-hackney-st-michaels/house-of-hackney-st-michaels-11.jpg',
    alt: "Mark Street front of St Michael's Clergy House, the House of Hackney showroom in Shoreditch.",
  },
};

// Street names only for the two private residential buildings: no house number, no full postcode.
const banned = [/Threadneedle/i, /Mulberry/i, /\bAethos\b/i, /\bLandmark\b/i, /\b\d{1,4}[a-z]?\s+St\.?\s?George'?s?\s+Square/i, /\b\d{1,4}[a-z]?\s+Inverness\s+Terrace/i, /\bSW1V\s?\d[A-Z]{2}\b/, /\bW2\s?\d[A-Z]{2}\b/];
for (const [id, frame] of Object.entries(frames)) {
  for (const pattern of banned) {
    if (pattern.test(frame.alt) || pattern.test(id)) throw new Error(`${id} failed ${pattern}`);
  }
}

const imgOut = path.join(root, 'public/media/img');
const thumbOut = path.join(root, 'public/media/img/thumbs');
await mkdir(imgOut, { recursive: true });
await mkdir(thumbOut, { recursive: true });

const sizes = JSON.parse(await readFile(path.join(root, 'src/content/sizes.json'), 'utf8'));
const alts = JSON.parse(await readFile(path.join(root, 'src/content/alts.json'), 'utf8'));
const placeholders = JSON.parse(await readFile(path.join(root, 'src/content/placeholders.json'), 'utf8'));

for (const [id, frame] of Object.entries(frames)) {
  const input = path.join(sourceRoot, frame.file);
  const image = sharp(input).rotate();
  await image.clone().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 76 }).toFile(path.join(imgOut, `${id}.webp`));
  await image.clone().resize({ width: 1800, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(imgOut, `${id}.jpg`));
  await image.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 74 }).toFile(path.join(thumbOut, `${id}-800.webp`));
  await image.clone().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 76, mozjpeg: true }).toFile(path.join(thumbOut, `${id}-800.jpg`));

  const full = await sharp(path.join(imgOut, `${id}.webp`)).metadata();
  const thumb = await sharp(path.join(thumbOut, `${id}-800.webp`)).metadata();
  const blur = await image.clone().resize({ width: 24 }).webp({ quality: 20 }).toBuffer();

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
  alts[id] = { alt: frame.alt, manifestNote: note };
  placeholders[id] = `data:image/webp;base64,${blur.toString('base64')}`;
  console.log(id, full.width, full.height);
}

await writeFile(path.join(root, 'src/content/sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`);
await writeFile(path.join(root, 'src/content/alts.json'), `${JSON.stringify(alts, null, 2)}\n`);
await writeFile(path.join(root, 'src/content/placeholders.json'), `${JSON.stringify(placeholders, null, 2)}\n`);
