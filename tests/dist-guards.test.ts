import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

test('the built site keeps private names and the verification token out of the wrong places', async () => {
  const files = await htmlFiles('dist');
  assert.ok(files.length > 10);
  const html = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  for (const banned of ['CLAUDI', 'Landmark', 'Samantha', 'Koroseal', 'Admiralty', 'Metropole', 'Canary Wharf', 'subcontract', 'Threadneedle', 'Mulberry', 'Aethos', '95 St George', '26 Inverness', 'SW1V 3QW', 'W2 3JA']) {
    assert.equal(html.toLowerCase().includes(banned.toLowerCase()), false, banned);
  }
  assert.match(html, /98zhpiyda4qDA6fYcKJ-zC6pItC6-LZKqqEugO5-fKo/);
  assert.match(html, /Dorin Burcus/);
  assert.match(html, /info@mrwallcover.com/);
  assert.match(html, /hung properly/);
  assert.match(html, /DoubleTree by Hilton London – West End/);
  assert.match(html, /DoubleTree by Hilton London – Victoria/);
  assert.match(html, /The Biltmore Mayfair/);
  assert.match(html, /The Lanesborough/);
  assert.match(html, /Pendley Manor Hotel/);
  assert.match(html, /Moxy London ExCeL/);
  assert.match(html, /St George's Square, Pimlico/);
  assert.match(html, /Inverness Terrace, Bayswater/);
  assert.match(html, /Penny Morrison showroom/);
  assert.match(html, /House of Hackney showroom/);
  const exterior = await readFile('dist/services/exterior-works/index.html', 'utf8');
  assert.match(exterior, /pimlico-st-georges-square/);
  assert.match(exterior, /inverness-terrace/);
  assert.match(exterior, /penny-morrison-showroom/);
  assert.match(exterior, /all the internal works plus the full exterior/i);
  assert.doesNotMatch(exterior, /House of Hackney|Lanesborough|Chesham|hackney/i);
  assert.doesNotMatch(html, /07450|447450843246/);
  assert.doesNotMatch(html, /loadedAt/);
});

test('the homepage does not load the 3D engine up front', async () => {
  const home = await readFile('dist/index.html', 'utf8');
  assert.equal(home.includes('three.module'), false);
  const sources = [...home.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(sources.length > 0);
  for (const source of sources) {
    const file = path.join('dist', source.replace(/^\//, ''));
    const info = await stat(file);
    assert.ok(info.size < 40_000, `${source} is ${info.size} bytes`);
  }
  const studio = await readFile(path.join('dist', sources.find((source) => source.includes('MaterialStudio'))!.replace(/^\//, '')), 'utf8');
  assert.match(studio, /import\(`\.\/three\.module/);
});

test('every media file the built pages point to exists', async () => {
  const files = await htmlFiles('dist');
  const missing = new Set<string>();
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    for (const match of html.matchAll(/\/media\/[^"'\s,)?#]+/g)) {
      const asset = path.join('dist', match[0]);
      try {
        await stat(asset);
      } catch {
        missing.add(match[0]);
      }
    }
  }
  assert.deepEqual([...missing], []);
});
