import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const requiredDestinations = [
  '/projects/', '/projects/#hotels', '/services/', '/materials/', '/professionals/',
  '/trade/', '/services/joinery-wallcoverings-and-panels/', '/advice/', '/advice/cost/',
  '/aftercare/', '/about/', '/reviews/', '/faq/', '/areas/', '/accessibility/',
  '/privacy/', '/image-use/', '/for-ai/', '/contact/', 'mailto:info@mrwallcover.com',
  'https://www.instagram.com/mrwallcover/',
];
const footerOf = (html: string) => html.match(/<footer\b[^>]*class="site-footer"[^>]*>[\s\S]*?<\/footer>/)?.[0] ?? '';
const hrefsOf = (html: string) => new Set([...html.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1]));

// A route added through the normal Base layout must inherit the same complete directory.
// Assert rendered destinations, rather than the implementation's chosen data structure.
test('every published route inherits the complete footer destination set', async () => {
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  const routes = [...sitemap.matchAll(/<loc>https:\/\/www\.mrwallcover\.com([^<]*)<\/loc>/g)].map((match) => match[1]);
  const areas = JSON.parse(await readFile('src/content/areas.json', 'utf8')) as { items: { slug: string }[] };
  const required = [
    ...requiredDestinations,
    ...routes.filter((route) => /^\/(services|materials)\/[a-z0-9-]+\/$/.test(route)),
    ...areas.items.map((area) => `/areas/${area.slug}/`),
  ];
  assert.ok(routes.length > 20, 'the built sitemap contains the website');
  for (const route of routes) {
    const footer = footerOf(await readFile(`dist${route}index.html`, 'utf8'));
    assert.ok(footer, `${route}: a shared footer is rendered`);
    const hrefs = hrefsOf(footer);
    for (const href of required) assert.ok(hrefs.has(href), `${route}: footer must retain ${href}`);
  }
});

test('the directory is real labelled HTML and starts expanded without JavaScript', async () => {
  const footer = footerOf(await readFile('dist/services/timorous-beasties-installer/index.html', 'utf8'));
  const groups = [...footer.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)];
  assert.equal(groups.length, 4, 'four manageable navigation groups');
  const names = groups.map((group) => {
    assert.match(group[1], /\bopen(?:[\s=>]|$)/, 'the server-rendered directory is usable without JavaScript');
    assert.match(group[2], /<ul>/, 'navigation links are real lists');
    assert.match(group[2], /<a\b[^>]*href=/, 'links remain in the initial HTML');
    return group[2].match(/<summary><span>([^<]+)<\/span>/)?.[1];
  });
  assert.deepEqual(names, ['Explore', 'Expertise', 'Materials', 'Areas']);
  assert.ok(footer.indexOf('footer-contact') < footer.indexOf('footer-directory'), 'contact precedes the directory on mobile');
  assert.match(footer, /<a\b[^>]*href="\/contact\/"[^>]*>[\s\S]*?Start your project[\s\S]*?<\/a>/);
  assert.match(footer, /<button\b[^>]*type="button"[^>]*data-effects-toggle aria-pressed="false">Reduce visual effects<\/button>/);
  const utilities = footer.slice(footer.indexOf('footer-utilities'));
  for (const href of ['/accessibility/', '/privacy/', '/image-use/', '/for-ai/']) {
    assert.ok(hrefsOf(utilities).has(href), `${href} is in the utility row`);
  }
});
