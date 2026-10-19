import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

type Item = { id: string; group: string; name: string; place: string; years: string; text: string; images: string[] };
const read = async (file: string) => JSON.parse(await readFile(file, 'utf8'));

/**
 * The fuller project record on /projects/ (src/content/project-record.json): jobs approved one by one by
 * Dorin on 19 Oct 2026. Private homes are named by area only; each entry carries at most three of our
 * own registered photographs.
 */
test('every project-record entry is complete, unique and uses registered photographs', async () => {
  const record = await read('src/content/project-record.json');
  const sizes = await read('src/content/sizes.json');
  const alts = await read('src/content/alts.json');
  const groups = new Set((record.groups as { id: string }[]).map((group) => group.id));
  const items = record.items as Item[];
  assert.ok(items.length >= 100, `the record lists ${items.length} jobs`);
  const ids = new Set<string>();
  for (const item of items) {
    assert.match(item.id, /^[a-z0-9-]+$/, item.id);
    assert.ok(!ids.has(item.id), `duplicate id ${item.id}`);
    ids.add(item.id);
    assert.ok(groups.has(item.group), `${item.id}: unknown group ${item.group}`);
    for (const field of ['name', 'text'] as const) assert.ok(item[field].trim().length > 3, `${item.id}: ${field}`);
    assert.match(item.years, /^(19|20)\d{2}(–(\d{2}|\d{4}))?$/, `${item.id}: years "${item.years}"`);
    assert.ok(item.images.length <= 3, `${item.id}: at most three photographs`);
    for (const id of item.images) {
      assert.ok(sizes[id], `${item.id}: ${id} has no sizes entry`);
      assert.ok(alts[id]?.alt?.length > 10, `${item.id}: ${id} needs alt text`);
      assert.match(alts[id].manifestNote, /^own photograph/, `${id}: own photograph provenance`);
    }
  }
});

test('private homes in the record are named by area only', async () => {
  const items = (await read('src/content/project-record.json')).items as Item[];
  // A named street or building ("Chesham Street", "Radley Mews"); a house type ("a mews house") is fine.
  const street = /\b[A-Z][a-z']+\s+(Street|Road|Mews|Square|Gardens|Place|Terrace|Avenue|Lane|Crescent|Row|Walk|Court|Close|Grove|House|Mansions|Buildings)\b|\bflat\s+\d/;
  for (const item of items.filter((entry) => entry.group === 'homes')) {
    const label = `${item.name} ${item.place}`;
    assert.doesNotMatch(label, /\d/, `${item.id}: no house numbers or postcodes`);
    assert.doesNotMatch(label, street, `${item.id}: area only, no street or building name`);
    assert.doesNotMatch(`${label} ${item.text}`, /penthouse/i, `${item.id}`);
  }
});

test('record hotels in the hotel list point at a record entry', async () => {
  const items = (await read('src/content/project-record.json')).items as Item[];
  const hotels = (await read('src/content/hotels.json')).items as { name: string; href: string; publish: boolean }[];
  const ids = new Set(items.map((item) => item.id));
  const anchored = hotels.filter((hotel) => hotel.href?.startsWith('/projects/#record-'));
  assert.ok(anchored.length >= 8);
  for (const hotel of anchored) assert.ok(ids.has(hotel.href.slice('/projects/#record-'.length)), `${hotel.name}: ${hotel.href}`);
});
