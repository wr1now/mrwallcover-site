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

/**
 * Brand boundaries and privacy. The two private residential buildings are
 * named by street only; any house number before those street names, and any
 * full postcode in their districts, is banned by pattern so that the real
 * number and postcode never appear in this file either.
 */
const forbidden = [
  /CLAUDI/i,
  /\bLandmark\b/i,
  /\bSamantha\b/,
  /third[\s-]party/i,
  /subcontract/i,
  /Threadneedle/i,
  /Mulberry/i,
  /\bAethos\b/i,
  /\b\d{1,4}[a-z]?\s+St\.?\s?George'?s?\s+Square/i,
  /\b\d{1,4}[a-z]?\s+Inverness\s+Terrace/i,
  /\bSW1V\s?\d[A-Z]{2}\b/,
  /\bW2\s?\d[A-Z]{2}\b/,
  // No phone number anywhere in public source. Tests use Ofcom's drama range 07700 900000.
  /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}/,
];

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

test('Search Console token stays in config and no award line exists in source', async () => {
  const config = await readFile('src/config.ts', 'utf8');
  assert.match(config, /98zhpiyda4qDA6fYcKJ-zC6pItC6-LZKqqEugO5-fKo/);
  assert.doesNotMatch(config, /Award-winning|AWARD/);
  assert.match(config, /from '\.\/data\/facts\.json'/);
  for (const file of ['src/content/about.json', 'src/content/home.json', 'src/pages/index.astro', 'src/pages/about.astro']) {
    assert.doesNotMatch(await readFile(file, 'utf8'), /award/i, `${file} must not mention an award`);
  }
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

test('the six Workstream 4 scaffolds exist as drafts on the same mechanism, with TODO(Dorin) markers and no invented figures', async () => {
  const content = await readFile('src/lib/content.ts', 'utf8');
  assert.match(content, /editorialModules\)\.filter\(\(mod\) => !mod\.frontmatter\.draft\)/);
  const names = (await readdir('src/content/pages')).filter((entry) => entry.endsWith('.md')).sort();
  const expected = ['calico-wallpaper-installer.md', 'cost-guide-2026.md', 'house-of-hackney-wallpaper-installer.md', 'reviews.md', 'timorous-beasties-installer.md', 'trade.md'];
  for (const name of expected) assert.ok(names.includes(name), name);
  for (const name of names) {
    const text = await readFile(`src/content/pages/${name}`, 'utf8');
    const fm = JSON.parse(text.match(/^---\n([\s\S]*?)\n---\n/)![1]) as { draft?: boolean; path: string; title: string };
    assert.match(fm.path, /^\/[a-z0-9-]+(\/[a-z0-9-]+)*\/$/, `${name} path`);
    if (fm.draft) {
      assert.match(text, /TODO\(Dorin\)/, `${name} draft needs TODO(Dorin) markers`);
      assert.match(text, /^DRAFT\. Not built/m, `${name} must say it is a draft`);
    }
    // No pound figures, star ratings or maker endorsement wording may be typed into these pages.
    assert.doesNotMatch(text, /£\s?\d|\d\s?(stars?|★)|approved installer[^.]*\b(we are|Mr Wallcover is)\b|recommended by (Calico|House of Hackney|Timorous)/i, `${name} invented claim`);
  }
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
  // The stamp script's --check compares `updated` with the last commit that touched the file, and CI runs it with full history before the build.
  const stamp = await readFile('scripts/stamp-case-study-dates.mjs', 'utf8');
  assert.match(stamp, /\['log', '-1', '--format=%cs', '--', file\]/);
  assert.match(stamp, /fm\.updated !== expected/);
  const workflow = await readFile('.github/workflows/pages.yml', 'utf8');
  assert.match(workflow, /uses: actions\/checkout@v4\n\s+with:\n(\s+#.*\n)*\s+fetch-depth: 0/, 'checkout needs fetch-depth: 0');
  const checkStep = workflow.indexOf('node scripts/stamp-case-study-dates.mjs --check');
  const buildStep = workflow.indexOf('run: npm run build');
  assert.ok(checkStep > 0, 'CI must run the case-study date check');
  assert.ok(buildStep > checkStep, 'the date check must run before the build');
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

test('exterior works lists only the two cleared projects while the showroom case study is a draft', async () => {
  const data = JSON.parse(await readFile('src/content/specialisms.json', 'utf8')) as {
    items: { slug: string; projects: string[]; paragraphs: string[]; lede: string }[];
  };
  const page = data.items.find((item) => item.slug === 'exterior-works');
  assert.ok(page);
  // The Penny Morrison showroom returns to this list only when its case study leaves draft (client confirmation in writing).
  assert.deepEqual(page.projects, ['pimlico-st-georges-square', 'inverness-terrace']);
  const blob = JSON.stringify(page);
  assert.match(blob, /all the internal works plus the full exterior/i);
  assert.match(blob, /scaffolding supplied and managed/i);
  assert.doesNotMatch(blob, /House of Hackney|Lanesborough|Chesham|Threadneedle|Mulberry|Aethos|Penny Morrison|penny-morrison/i);
  const showroom = await readFile('src/content/case-studies/penny-morrison-showroom.md', 'utf8');
  assert.match(showroom, /"draft": true/);
  assert.match(showroom, /9 Langton Street/, 'the showroom address stays in the draft source (commercial, approved)');
  const services = await readFile('src/pages/services.astro', 'utf8');
  assert.match(services, /exterior-works/);
  const hackney = await readFile('src/content/case-studies/house-of-hackney-st-michaels.md', 'utf8');
  assert.doesNotMatch(hackney, /exterior-works/);
});

test('the hand-painted service names the Brown\'s paper its case study records', async () => {
  const data = JSON.parse(await readFile('src/content/specialisms.json', 'utf8')) as { items: { slug: string; paragraphs: string[] }[] };
  const page = data.items.find((item) => item.slug === 'hand-painted-wallpaper-installation');
  assert.ok(page);
  const proof = page.paragraphs.find((p) => p.includes("Brown's Hotel"));
  assert.ok(proof, 'the hand-painted page cites Brown\'s Hotel');
  assert.match(proof, /Lewis & Wood's Adam's Eden/);
  const study = await readFile('src/content/case-studies/browns-hotel-mayfair.md', 'utf8');
  assert.match(study, /Lewis & Wood – Adam's Eden/, 'the case study must still record the same paper');
  assert.doesNotMatch(proof, /de Gournay|Fromental/, 'the proof sentence names the paper actually hung, not a maker it is compared with');
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
