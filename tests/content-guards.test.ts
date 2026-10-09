import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await filesUnder(full));
    else if (/\.(astro|ts|json|css|md|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const forbidden = [/CLAUDI/i, /\bLandmark\b/i, /\bSamantha\b/, /third[\s-]party/i, /subcontract/i, /Threadneedle/i, /Mulberry/i, /\bAethos\b/i, /95 St George/i, /26 Inverness/i, /SW1V 3QW/, /W2 3JA/];

test('public copy keeps the brand boundaries', async () => {
  const roots = ['src/content', 'src/pages', 'src/components', 'src/layouts', 'src/lib'];
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of await filesUnder(root)) {
      const text = await readFile(file, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(text)) hits.push(`${file} matched ${pattern}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});

test('privacy notice keeps Dorin Burcus trading as Mr Wallcover', async () => {
  const privacy = await readFile('src/content/privacy.json', 'utf8');
  assert.match(privacy, /Dorin Burcus, trading as Mr Wallcover/);
  assert.doesNotMatch(privacy, /PRIMEST|CLAUDI LTD|Renovart/i);
});

test('Search Console token and the unnamed award stay in config', async () => {
  const config = await readFile('src/config.ts', 'utf8');
  assert.match(config, /98zhpiyda4qDA6fYcKJ-zC6pItC6-LZKqqEugO5-fKo/);
  assert.match(config, /label: 'Award-winning'/);
  assert.match(config, /from '\.\/data\/facts\.json'/);
});

const REQUIRED_OPENING = 'Mr Wallcover is a London specialist wallcovering installer founded by Dorin Burcus';

test('the fact sheet holds one description sentence of 160 characters or fewer, and the footer, schema and llms.txt read it', async () => {
  const facts = JSON.parse(await readFile('src/data/facts.json', 'utf8')) as {
    brand: string;
    description: string;
    email: string;
    founder: { name: string; path: string; fragment: string };
    profiles: { name: string; url: string }[];
  };
  assert.equal(facts.brand, 'Mr Wallcover');
  assert.equal(facts.email, 'info@mrwallcover.com');
  assert.equal(facts.founder.name, 'Dorin Burcus');
  assert.equal(facts.founder.path, '/about/');
  assert.equal(facts.founder.fragment, 'dorin');
  assert.ok(facts.description.startsWith(REQUIRED_OPENING), 'description must start with the fixed opening');
  assert.ok(facts.description.length <= 160, `description is ${facts.description.length} characters`);
  assert.doesNotMatch(facts.description, /["'&<>]/, 'keep the sentence free of characters that HTML or JSON would escape');
  assert.ok(facts.profiles.some((profile) => profile.url === 'https://www.instagram.com/mrwallcover/'));
  const blob = JSON.stringify(facts);
  assert.doesNotMatch(blob, /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|Ltd|Limited|Companies House|award/i);
  for (const file of ['src/components/Footer.astro', 'src/lib/schema.ts', 'src/pages/llms.txt.ts']) {
    const text = await readFile(file, 'utf8');
    assert.match(text, /from '\.\.\/data\/facts\.json'/, `${file} must import the fact sheet`);
    assert.match(text, /facts\.description/, `${file} must print facts.description`);
  }
});

test('draft case studies are filtered out before they are built', async () => {
  const content = await readFile('src/lib/content.ts', 'utf8');
  assert.match(content, /!\s*mod\.frontmatter\.draft/);
});

test('every case study carries ISO published and updated dates as data, and the sitemap never uses the build time', async () => {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const name of (await readdir('src/content/case-studies')).filter((entry) => entry.endsWith('.md'))) {
    const text = await readFile(`src/content/case-studies/${name}`, 'utf8');
    const fm = JSON.parse(text.match(/^---\n([\s\S]*?)\n---\n/)![1]) as { published?: string; updated?: string };
    assert.match(fm.published ?? '', iso, `${name} published`);
    assert.match(fm.updated ?? '', iso, `${name} updated`);
    assert.ok((fm.updated as string) >= (fm.published as string), `${name} updated before published`);
  }
  const config = await readFile('astro.config.mjs', 'utf8');
  assert.doesNotMatch(config, /lastmod:\s*new Date/);
  const schema = await readFile('src/lib/schema.ts', 'utf8');
  assert.doesNotMatch(schema, /new Date\(/);
});

test('held hotels stay out of the public content module', async () => {
  const content = await readFile('src/lib/content.ts', 'utf8');
  const hotels = await readFile('src/content/hotels.json', 'utf8');
  const held = await readFile('src/content/unpublished/hotels-held.json', 'utf8');
  assert.doesNotMatch(content, /hotels-held/);
  assert.match(hotels, /The Lanesborough/);
  assert.match(hotels, /Pendley Manor Hotel/);
  assert.match(hotels, /Moxy London ExCeL/);
  assert.doesNotMatch(hotels, /Admiralty|Metropole|Canary Wharf|Koroseal|Landmark|Threadneedle/);
  const hotelItems = JSON.parse(hotels).items as { name: string; nameOnly: boolean; years: string; scope: string }[];
  const moxy = hotelItems.find((item) => item.name === 'Moxy London ExCeL');
  assert.equal(moxy?.nameOnly, true);
  assert.equal(moxy?.years, '');
  assert.equal(moxy?.scope, '');
  const pendley = hotelItems.find((item) => item.name === 'Pendley Manor Hotel');
  assert.equal(pendley?.nameOnly, false);
  assert.match(pendley?.scope ?? '', /Wallpapering/);
  assert.doesNotMatch(held, /"publish": true/);
  assert.match(held, /Waldorf Astoria London Admiralty Arch/);
});

test('exterior works lists only the three cleared projects', async () => {
  const data = JSON.parse(await readFile('src/content/specialisms.json', 'utf8')) as {
    items: { slug: string; projects: string[]; paragraphs: string[]; lede: string }[];
  };
  const page = data.items.find((item) => item.slug === 'exterior-works');
  assert.ok(page);
  assert.deepEqual(page.projects, ['pimlico-st-georges-square', 'inverness-terrace', 'penny-morrison-showroom']);
  const blob = JSON.stringify(page);
  assert.match(blob, /all the internal works plus the full exterior/i);
  assert.match(blob, /scaffolding supplied and managed/i);
  assert.doesNotMatch(blob, /House of Hackney|Lanesborough|Chesham|Threadneedle|Mulberry|Aethos/i);
  const services = await readFile('src/pages/services.astro', 'utf8');
  assert.match(services, /exterior-works/);
  const hackney = await readFile('src/content/case-studies/house-of-hackney-st-michaels.md', 'utf8');
  assert.doesNotMatch(hackney, /exterior-works/);
});

test('House of Hackney client photographs are committed, so the build does not download them', async () => {
  const manifest = JSON.parse(await readFile('scripts/credited/house-of-hackney.json', 'utf8')) as {
    images: Record<string, { image: string }>;
  };
  const missing: string[] = [];
  for (const id of Object.keys(manifest.images)) {
    for (const file of [
      `public/media/img/${id}.webp`,
      `public/media/img/${id}.jpg`,
      `public/media/img/thumbs/${id}-800.webp`,
      `public/media/img/thumbs/${id}-800.jpg`,
    ]) {
      try {
        await stat(file);
      } catch {
        missing.push(file);
      }
    }
  }
  assert.deepEqual(missing, []);
  const rights = await readFile('docs/asset-rights.md', 'utf8');
  for (const frame of Object.values(manifest.images)) {
    assert.match(rights, new RegExp(frame.image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('the four-second submit trap is gone', async () => {
  const form = await readFile('src/components/EnquiryForm.astro', 'utf8');
  const script = await readFile('src/scripts/enquiry-form.ts', 'utf8');
  assert.doesNotMatch(form + script, /4000|time-trap|loadedAt/);
});
