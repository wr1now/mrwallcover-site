import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';

/**
 * Photographs on hold must never enter the repo: Dorin's owner portraits (his face, his OK
 * needed) and every unidentified-* set from the pro-photo sweep (project not identified, rights
 * unknown). tests/fixtures/held-images.json holds a 256-bit difference hash (16x16) of each held
 * frame; any image under public/ within 40 bits of one fails, so a renamed or re-encoded copy is caught.
 * The two Trematon House of Hackney sets were cleared by House of Hackney on 10 October 2026 and
 * are not on this list.
 */
const HELD_SET_NAMES = /(owner-portraits|unidentified-)/i;
const MAX_DISTANCE = 40;

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function dhash(file: string): Promise<bigint> {
  const { data } = await sharp(file)
    .rotate()
    .greyscale()
    .resize(17, 16, { fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) bits = (bits << 1n) | (data[y * 17 + x + 1] > data[y * 17 + x] ? 1n : 0n);
  }
  return bits;
}

function distance(a: bigint, b: bigint): number {
  let v = a ^ b;
  let n = 0;
  while (v) {
    n += Number(v & 1n);
    v >>= 1n;
  }
  return n;
}

test('no held photograph (owner portraits, unidentified sets) is in the repo, by name or by picture', async () => {
  const files = await walk('public');
  const named = files.filter((f) => HELD_SET_NAMES.test(f));
  assert.deepEqual(named, [], 'held set names must not appear under public/');

  const held = Object.entries(JSON.parse(await readFile('tests/fixtures/held-images.json', 'utf8')) as Record<string, string>).map(
    ([name, hex]) => [name, BigInt(`0x${hex}`)] as const,
  );
  assert.ok(held.length >= 70, 'the held-image fingerprint list is present');

  // One file per picture is enough: the largest-but-one responsive width, or the plain file.
  const images = files.filter(
    (f) => /\.(jpe?g|png|webp|avif)$/i.test(f) && !/-(480|1200|1600|2000|2400)\.(webp|avif)$/.test(f) && !/\.avif$/.test(f),
  );
  const hits: string[] = [];
  for (const file of images) {
    let h: bigint;
    try {
      h = await dhash(file);
    } catch {
      continue;
    }
    for (const [name, ref] of held) if (distance(h, ref) <= MAX_DISTANCE) hits.push(`${file} ~ ${name}`);
  }
  assert.deepEqual(hits, [], 'a held photograph matched an image under public/');
});
