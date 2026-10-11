import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Source-level guard for src/data/image-rights.json (read by imageRights() in src/lib/schema.ts):
// no credited third-party photograph may be listed as Dorin's own, and every library
// image has a maker on record (a credit, an "own" note or an image-rights.json entry).
type Entry = { manifestNote?: string };
const readJson = async <T>(file: string) => JSON.parse(await readFile(file, 'utf8')) as T;

test('image-rights.json never lists a credited photograph as ours, and every image has a maker on record', async () => {
  const rights = await readJson<{ dorin: { patterns: string[] }; unrecorded: { patterns: string[] }; photographers: { pattern: string }[]; owner: { name: string } }>('src/data/image-rights.json');
  const notes = { ...(await readJson<Record<string, Entry>>('src/content/alts.json')), ...(await readJson<Record<string, Entry>>('src/content/credited-media.json')) };
  const dorin = rights.dorin.patterns.map((p) => new RegExp(p));
  const named = [...rights.unrecorded.patterns, ...rights.photographers.map((p) => p.pattern)].map((p) => new RegExp(p));
  for (const [id, entry] of Object.entries(notes)) {
    const note = entry?.manifestNote ?? '';
    if (id.startsWith('video-') || /own site video/.test(note)) continue;
    const credited = /credit\s+(?:Photography|Photograph|Photo|Image|Images)\s*:/i.test(note);
    if (credited) {
      assert.ok(!dorin.some((r) => r.test(id)), `${id} is credited but listed as Dorin's own`);
      assert.doesNotMatch(note, new RegExp(`credit\\s+\\w+:\\s*${rights.owner.name}`), `${id}`);
    }
    assert.ok(credited || /^own\b/i.test(note) || named.some((r) => r.test(id)), `${id} has no maker on record (note: "${note}")`);
  }
});
