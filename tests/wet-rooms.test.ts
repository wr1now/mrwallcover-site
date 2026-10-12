import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Bathrooms, wet rooms and the magnet table cut (12 Oct 2026): two guides and three case studies built
// from Dorin's numbered answers, our own Instagram posts and the makers' own documents (docs/sources.md).
// They name areas only, promise nothing, and keep the photographs Dorin has not cleared off the site.
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = (html: string) => decode(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const GUIDES = ['/advice/bathrooms-showers-and-wet-rooms/', '/advice/double-cutting-and-lining/'];
const STUDIES = ['/projects/wet-room-lotus-mural-shower-london/', '/projects/wet-room-marble-shower-london/', '/projects/wet-room-stone-effect-bathroom-belgravia/'];
const page = (path: string) => readFileSync(`dist${path}index.html`, 'utf8');

test('the wet-room guides and case studies are built and listed', () => {
  const hub = readFileSync('dist/advice/index.html', 'utf8');
  const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
  const llms = readFileSync('dist/llms.txt', 'utf8');
  for (const path of GUIDES) {
    assert.ok(hub.includes(`href="${path}"`), `${path} on the advice hub`);
    assert.ok(sitemap.includes(`https://www.mrwallcover.com${path}`), `${path} in the sitemap`);
    assert.ok(llms.includes(path), `${path} in llms.txt`);
  }
  for (const path of STUDIES) {
    assert.ok(page(path).includes('data-glance'), `${path} has the At a glance box`);
    assert.ok(sitemap.includes(`https://www.mrwallcover.com${path}`), `${path} in the sitemap`);
  }
});

test('the method lines are the owner-confirmed ones', () => {
  const wet = text(page(GUIDES[0]));
  for (const line of [
    'New plaster, new boarding or new walls. Never existing tiles.',
    'every niche is closed with a metal trim',
    'certified sealant specialist',
    'After about two days on our jobs. The system keeps curing for seven to fourteen days',
  ]) assert.ok(wet.includes(line), line);
  const cut = text(page(GUIDES[1]));
  for (const line of [
    'we never double cut on the wall over lining paper',
    'Six to eight strong magnets lock the two together through the paper',
    'We have never table cut vinyl.',
    'every wallpaper seam sits 20 to 50 mm away from the lining joints',
  ]) assert.ok(cut.includes(line), line);
});

// The site-wide commission panel under every case study carries the approved workmanship line, so the
// checks read each page's own source file, which is everything these pages add.
const SOURCES = [
  'src/content/guides/bathrooms-showers-and-wet-rooms.md',
  'src/content/guides/double-cutting-and-lining.md',
  ...STUDIES.map((path) => `src/content/case-studies/${path.split('/')[2]}.md`),
];

test('no promises, partner claims, plumb lines, addresses or competitor names in these pages', () => {
  for (const path of SOURCES) {
    const words = readFileSync(path, 'utf8');
    assert.doesNotMatch(words, /\bwarrant(y|ies)\b|\bguarantee/i, `${path}: no warranty or guarantee wording`);
    assert.doesNotMatch(words, /\bpartners?\b|approved installer|certified installer of/i, `${path}: no partner or approval claim`);
    assert.doesNotMatch(words, /\bplumb\b/i, `${path}: laser set-out only`);
    assert.doesNotMatch(words, /\b[A-Z]{1,2}\d{1,2}[A-Z]? \d[A-Z]{2}\b/, `${path}: no postcode`);
    assert.doesNotMatch(words, /CLAUDI|Landmark|Threadneedles|subcontract|third party|Wells Interiors|Hamiltons|Jouffre|Tapetenmeister|Maruni|Jegal|Nakamura|TP Decorating|Heritage Wallpaper|Wallpaper Installation Sydney/i, `${path}: barred names`);
  }
});

test('photographs: finished rooms lead, and the uncleared frames stay off the site', () => {
  const heroes: Record<string, string> = {
    '/projects/wet-room-lotus-mural-shower-london/': 'brand-wall-deco-01',
    '/projects/wet-room-marble-shower-london/': 'wet-marble-02',
    '/projects/wet-room-stone-effect-bathroom-belgravia/': 'wet-glamora-03',
  };
  for (const [path, id] of Object.entries(heroes)) {
    const html = page(path);
    const first = html.match(/\/media\/img\/r\/([a-z0-9-]+?)-\d+\.(?:avif|webp|jpg)/)?.[1];
    assert.equal(first, id, `${path} leads with ${id}`);
    assert.doesNotMatch(html, /wet-marble-04|CPFaYEiFRLw_01/, `${path}: installer frame and text-overlay frame are not used as images`);
  }
  const alts = JSON.parse(readFileSync('src/content/alts.json', 'utf8'));
  for (const id of ['wet-marble-01', 'wet-marble-02', 'wet-marble-05', 'wet-marble-06', 'wet-marble-07', 'wet-glamora-01', 'wet-glamora-03', 'wet-glamora-04', 'wet-glamora-05']) {
    assert.match(alts[id].manifestNote, /^own photograph, Instagram @mrwallcover post /, id);
  }
});
