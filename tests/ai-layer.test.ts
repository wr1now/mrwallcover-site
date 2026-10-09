import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

/**
 * The AI-crawling layer, checked on the built site in dist/. Everything here
 * is generated from src/data/facts.json and the content files, so these tests
 * read the output and compare it with those sources rather than with a second
 * copy of the facts.
 */

const SITE = 'https://www.mrwallcover.com';

async function filesUnder(dir: string, keep: (name: string) => boolean): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await filesUnder(full, keep)));
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

const htmlFiles = (dir: string) => filesUnder(dir, (name) => name.endsWith('.html'));

/** A page is published when it is built, indexable and not a redirect stub. */
async function publishedPages(): Promise<{ file: string; pathname: string; html: string }[]> {
  const out: { file: string; pathname: string; html: string }[] = [];
  for (const file of await htmlFiles('dist')) {
    const html = await readFile(file, 'utf8');
    if (/<meta name="robots" content="noindex">/.test(html) || /http-equiv="refresh"/.test(html)) continue;
    out.push({ file, pathname: file.replace(/^dist/, '').replace(/index\.html$/, ''), html });
  }
  assert.ok(out.length > 50, `only ${out.length} published pages found`);
  return out;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

test('/for-ai/ states the facts from facts.json, links every published case study and guide, carries one H1 and a dated byline, and is in the sitemap and footer', async () => {
  const facts = JSON.parse(await readFile('src/data/facts.json', 'utf8')) as {
    brand: string;
    description: string;
    email: string;
    coverage: string;
    lastReviewed: string;
    founder: { name: string; path: string; fragment: string };
  };
  const html = await readFile('dist/for-ai/index.html', 'utf8');
  assert.doesNotMatch(html, /<meta name="robots" content="noindex">/);
  assert.equal(html.match(/<h1[\s>]/g)?.length, 1, 'one H1');
  assert.match(html, new RegExp(`<h1>${facts.brand} in plain facts\\.</h1>`));
  assert.ok(html.includes(`<p class="lede mt-5">${facts.description}</p>`), 'the lede is the fact-sheet sentence');
  assert.ok(html.includes(facts.coverage), 'coverage sentence');
  assert.ok(html.includes(`href="mailto:${facts.email}"`), 'email link');
  assert.ok(html.includes('href="/contact/"'), 'contact link');
  assert.ok(html.includes(`href="${facts.founder.path}#${facts.founder.fragment}"`), 'founder link');
  assert.match(html, /By <a href="\/about\/#dorin">Dorin Burcus<\/a>, founder · Last reviewed <time datetime="\d{4}-\d{2}-\d{2}" data-page-updated="reviewed">\d{1,2} \w+ \d{4}<\/time>/);
  assert.ok(html.includes(`datetime="${facts.lastReviewed}"`), 'the byline date is the site-wide review date');
  // No endorsement wording, no phone, no draft route.
  assert.doesNotMatch(html, /approved by|accredited by|endorsed by|recommended by/i);
  assert.doesNotMatch(html, /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|\b020\s?\d{4}\s?\d{4}\b/);
  assert.doesNotMatch(html, /penny-morrison|biltmore-mayfair|doubletree-victoria/);
  // Every published case study and guide is linked; every draft is not.
  for (const name of (await readdir('src/content/case-studies')).filter((entry) => entry.endsWith('.md'))) {
    const text = await readFile(`src/content/case-studies/${name}`, 'utf8');
    const fm = JSON.parse(text.match(/^---\n([\s\S]*?)\n---\n/)![1]) as { slug: string; draft?: boolean; wallcoverings: string[] };
    const linked = html.includes(`href="/projects/${fm.slug}/"`);
    assert.equal(linked, !fm.draft, `${fm.slug} ${fm.draft ? 'is a draft and must not be linked' : 'must be linked'}`);
    if (!fm.draft) for (const product of fm.wallcoverings) assert.ok(stripTags(html).includes(product), `${fm.slug}: ${product}`);
  }
  for (const name of (await readdir('src/content/guides')).filter((entry) => entry.endsWith('.md'))) {
    const text = await readFile(`src/content/guides/${name}`, 'utf8');
    const draft = /^draft: true$/m.test(text);
    assert.equal(html.includes(`href="/advice/${name.slice(0, -3)}/"`), !draft, name);
  }
  const specialisms = (JSON.parse(await readFile('src/content/specialisms.json', 'utf8')) as { items: { slug: string }[] }).items;
  for (const item of specialisms) assert.ok(html.includes(`href="/services/${item.slug}/"`), item.slug);
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  assert.ok(sitemap.includes(`<loc>${SITE}/for-ai/</loc>`), 'sitemap');
  const home = await readFile('dist/index.html', 'utf8');
  assert.match(home, /<footer[\s\S]*href="\/for-ai\/"[\s\S]*<\/footer>/, 'footer link');
});

test('/llms.txt follows the llmstxt.org shape, lists only published pages that resolve, and ends with an Optional section', async () => {
  const llms = await readFile('dist/llms.txt', 'utf8');
  const lines = llms.split('\n');
  const facts = JSON.parse(await readFile('src/data/facts.json', 'utf8')) as { brand: string; description: string };
  assert.equal(lines[0], `# ${facts.brand}`, 'H1 first');
  assert.equal(lines[1], '');
  assert.equal(lines[2], `> ${facts.description}`, 'blockquote summary second');
  const h1s = lines.filter((line) => line.startsWith('# '));
  assert.equal(h1s.length, 1, 'exactly one H1');
  const sections = lines.filter((line) => line.startsWith('## '));
  assert.ok(sections.length >= 6, `${sections.length} sections`);
  assert.equal(sections.at(-1), '## Optional', 'Optional is the last section');
  assert.ok(sections.includes('## Wallcovering Guide'));
  // Paragraphs come before the first H2; after it, every non-blank line is a heading or a "- [Title](url): note" entry.
  const firstSection = lines.indexOf(sections[0]);
  const entryPattern = /^- \[[^\]]+\]\((https:\/\/www\.mrwallcover\.com\/[^)\s]*)\): \S.*$/;
  const urls: string[] = [];
  for (const line of lines.slice(firstSection)) {
    if (line === '' || line.startsWith('## ')) continue;
    const match = line.match(entryPattern);
    assert.ok(match, `not an llms.txt entry: ${line}`);
    urls.push(match![1]);
  }
  assert.ok(urls.length >= 60, `${urls.length} entries`);
  assert.ok(urls.includes(`${SITE}/for-ai/`), '/for-ai/ is listed');
  assert.ok(urls.includes(`${SITE}/advice/quantities/`), 'the quantity guide is listed');
  // Every listed page URL is a built, indexable page (fragments and non-HTML files aside).
  const pages = await publishedPages();
  const built = new Set(pages.map((page) => `${SITE}${page.pathname}`));
  for (const url of urls) {
    const clean = url.replace(/#.*$/, '');
    if (!clean.endsWith('/')) continue;
    assert.ok(built.has(clean), `${url} is not a published page`);
  }
  // Drafts and noindex pages never appear.
  for (const name of (await readdir('src/content/case-studies')).filter((entry) => entry.endsWith('.md'))) {
    const fm = JSON.parse((await readFile(`src/content/case-studies/${name}`, 'utf8')).match(/^---\n([\s\S]*?)\n---\n/)![1]) as { slug: string; draft?: boolean };
    assert.equal(urls.includes(`${SITE}/projects/${fm.slug}/`), !fm.draft, fm.slug);
  }
  for (const path of ['/thank-you/', '/search/', '/404/']) assert.equal(llms.includes(`${SITE}${path}`), false, path);
  assert.doesNotMatch(llms, /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|\b020\s?\d{4}\s?\d{4}\b/, 'no phone number');
});

test('every published page has a Markdown twin it links to, and its URL and main content are in llms-full.txt; noindex pages and drafts have neither', async () => {
  const pages = await publishedPages();
  const full = await readFile('dist/llms-full.txt', 'utf8');
  const facts = JSON.parse(await readFile('src/data/facts.json', 'utf8')) as { brand: string; description: string };
  assert.ok(full.startsWith(`# ${facts.brand}: full text of every published page\n\n> ${facts.description}\n`), 'llms-full header');
  const problems: string[] = [];
  for (const page of pages) {
    const canonical = `${SITE}${page.pathname}`;
    const twinPath = path.join('dist', page.pathname, 'index.md');
    let twin: string;
    try {
      twin = await readFile(twinPath, 'utf8');
    } catch {
      problems.push(`${page.pathname}: no twin at ${twinPath}`);
      continue;
    }
    const title = stripTags(page.html.match(/<title>([^<]*)<\/title>/)![1]);
    if (!twin.startsWith(`---\ntitle: ${JSON.stringify(title)}\nurl: ${canonical}\n`)) problems.push(`${page.pathname}: twin front matter does not open with its title and url`);
    if (!/\n---\n\n[\s\S]*\S/.test(twin)) problems.push(`${page.pathname}: twin has no body`);
    const h1 = stripTags(page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1]).replace(/\*/g, '');
    if (!twin.replace(/\*/g, '').includes(`# ${h1}`)) problems.push(`${page.pathname}: twin lacks its H1 "${h1}"`);
    if (!page.html.includes(`<link rel="alternate" type="text/markdown" href="${canonical}index.md" title="Markdown version">`)) problems.push(`${page.pathname}: no rel=alternate Markdown link`);
    if (!full.includes(`\n# ${title}\nURL: ${canonical}\n`)) problems.push(`${page.pathname}: not in llms-full.txt`);
    if (!full.replace(/\*/g, '').includes(`## ${h1}`)) problems.push(`${page.pathname}: H1 "${h1}" not in llms-full.txt`);
    // Twins and llms-full carry no scripts, no navigation chrome and no breadcrumb trail.
    // Only <main> is extracted: no HTML chrome, no skip link, no footer copyright line, no breadcrumb trail.
    if (/<script|<nav|<style|<\/?div/.test(twin)) problems.push(`${page.pathname}: twin contains HTML chrome`);
    if (/Skip to content|©|Home \/ /.test(twin)) problems.push(`${page.pathname}: twin contains header, footer or breadcrumb text`);
  }
  assert.deepEqual(problems, []);
  assert.doesNotMatch(full, /<script|<nav|<style|<\/?div|Skip to content|©|Home \/ /);
  const pageCount = full.match(/^URL: https:\/\/www\.mrwallcover\.com\//gm)?.length ?? 0;
  assert.equal(pageCount, pages.length, 'llms-full lists exactly the published pages');
  // Noindex pages, redirect stubs and drafts: no twin, not in llms-full.
  const allTwins = (await filesUnder('dist', (name) => name === 'index.md')).map((file) => file.replace(/^dist/, '').replace(/index\.md$/, ''));
  assert.deepEqual(allTwins.sort(), pages.map((page) => page.pathname).sort(), 'exactly one twin per published page');
  for (const pathname of ['/thank-you/', '/search/', '/404/', '/projects/owo-whitehall/', '/projects/penny-morrison-showroom/', '/projects/biltmore-mayfair/', '/trade/', '/advice/cost/']) {
    assert.equal(allTwins.includes(pathname), false, `${pathname} must have no twin`);
    assert.equal(full.includes(`${SITE}${pathname}`), false, `${pathname} must not be in llms-full.txt`);
  }
  const thankYou = await readFile('dist/thank-you/index.html', 'utf8');
  assert.doesNotMatch(thankYou, /type="text\/markdown"/, 'noindex pages do not advertise a twin');
});

test('no phone number, no forbidden word and no TODO in any text, Markdown, JSON or XML file in dist', async () => {
  const files = await filesUnder('dist', (name) => /\.(md|txt|json|xml)$/.test(name));
  assert.ok(files.length > 70, `${files.length} text files`);
  const problems: string[] = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    if (/\b0?7\d{3}\s?\d{6}\b|\+?44\s?\(?0?\)?\s?7\d{9}|\+?44\s?\(?0?\)?\s?20\s?\d{4}\s?\d{4}|\b020\s?\d{4}\s?\d{4}\b/.test(text)) problems.push(`${file}: phone number pattern`);
    for (const banned of ['CLAUDI', 'Landmark', 'Threadneedle', 'third party', 'third-party', 'subcontract', 'TODO', 'lorem']) {
      if (text.toLowerCase().includes(banned.toLowerCase())) problems.push(`${file}: ${banned}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('/facts.json carries only allowlisted public fields from the fact sheet, no phone, and agrees with the JSON-LD', async () => {
  const source = JSON.parse(await readFile('src/data/facts.json', 'utf8')) as Record<string, unknown> & {
    brand: string;
    description: string;
    email: string;
    place: string;
    coverage: string;
    lastReviewed: string;
    founder: { name: string; jobTitle: string; path: string; fragment: string };
    profiles: { name: string; url: string }[];
  };
  const raw = await readFile('dist/facts.json', 'utf8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  const endpoint = await readFile('src/pages/facts.json.ts', 'utf8');
  const allow = endpoint.match(/PUBLIC_FACT_FIELDS = \[([^\]]+)\]/)![1].match(/'([^']+)'/g)!.map((s) => s.replace(/'/g, ''));
  // Allowlist only: every fact-sheet field in the output is named in PUBLIC_FACT_FIELDS, and the underscore notes stay private.
  for (const key of Object.keys(data)) {
    if (key in source) assert.ok(allow.includes(key), `${key} is in facts.json but not allowlisted`);
    assert.doesNotMatch(key, /^_/, `${key} is a private note`);
  }
  assert.doesNotMatch(raw, /phone|telephone|\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|\b020\s?\d{4}\s?\d{4}\b|Ltd|Limited|award|licen[cs]e|price|rating/i);
  assert.equal(data.brand, source.brand);
  assert.equal(data.description, source.description);
  assert.equal(data.email, source.email);
  assert.equal(data.place, source.place);
  assert.equal(data.coverage, source.coverage);
  assert.equal(data.lastReviewed, source.lastReviewed);
  assert.deepEqual(data.founder, { name: source.founder.name, jobTitle: source.founder.jobTitle, url: `${SITE}${source.founder.path}#${source.founder.fragment}` });
  assert.deepEqual(data.profiles, source.profiles);
  assert.equal(data.website, SITE);
  assert.equal(data.isBasedOn, `${SITE}/for-ai/`);
  // The JSON-LD on every page reads the same fact sheet.
  const home = await readFile('dist/index.html', 'utf8');
  const graph = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]) as { '@graph': Record<string, any>[] };
  const business = graph['@graph'].find((node) => node['@id'] === `${SITE}/#business`)!;
  assert.equal(business.name, data.brand);
  assert.equal(business.description, data.description);
  assert.equal(business.email, data.email);
  assert.equal(business.address.addressLocality, data.place);
  assert.deepEqual(business.sameAs, source.profiles.map((profile) => profile.url));
  const person = graph['@graph'].find((node) => node['@id'] === (data.founder as { url: string }).url)!;
  assert.equal(person.name, source.founder.name);
  // Listed where readers look for it.
  assert.match(await readFile('dist/llms.txt', 'utf8'), /\(https:\/\/www\.mrwallcover\.com\/facts\.json\)/);
  assert.match(await readFile('dist/for-ai/index.html', 'utf8'), /href="\/facts\.json"/);
});

test('every published HTML page has exactly one H1', async () => {
  const problems: string[] = [];
  for (const page of await publishedPages()) {
    const count = page.html.match(/<h1[\s>]/g)?.length ?? 0;
    if (count !== 1) problems.push(`${page.pathname}: ${count} H1s`);
  }
  assert.deepEqual(problems, []);
});

test('robots.txt names every required crawler with the same Disallow lines as the default group, keeps the Sitemap line and notes the training controls', async () => {
  const robots = await readFile('dist/robots.txt', 'utf8');
  const required = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended'];
  // Parse groups: a run of User-agent lines followed by their rules.
  const groups: { agents: string[]; rules: string[] }[] = [];
  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (field.toLowerCase() === 'user-agent') {
      const last = groups.at(-1);
      if (last && last.rules.length === 0) last.agents.push(value);
      else groups.push({ agents: [value], rules: [] });
    } else if (field.toLowerCase() === 'sitemap') {
      continue;
    } else {
      groups.at(-1)!.rules.push(`${field}: ${value}`);
    }
  }
  const star = groups.find((group) => group.agents.includes('*'));
  assert.ok(star, 'User-agent: * group');
  assert.ok(star!.rules.includes('Allow: /'), 'default group allows /');
  assert.ok(star!.rules.includes('Disallow: /thank-you/'), 'default group keeps the thank-you Disallow');
  for (const bot of required) {
    const group = groups.find((item) => item.agents.includes(bot));
    assert.ok(group, `${bot} has a group`);
    assert.deepEqual(group!.rules, star!.rules, `${bot} must carry exactly the default rules`);
  }
  assert.match(robots, /^Sitemap: https:\/\/www\.mrwallcover\.com\/sitemap-index\.xml$/m);
  assert.match(robots, /AI-training controls[\s\S]*GPTBot[\s\S]*Google-Extended[\s\S]*Applebot-Extended[\s\S]*ClaudeBot/, 'comment naming the training controls');
  assert.doesNotMatch(robots, /Disallow: \/\s*$/m, 'nothing is blocked site-wide');
});

test('IndexNow: one 32-hex key file served from the site root, a script that is a no-op unless enabled, and no call from the Pages workflow', async () => {
  const keyFiles = (await readdir('public')).filter((name) => /^[0-9a-f]{32}\.txt$/.test(name));
  assert.equal(keyFiles.length, 1, 'exactly one key file');
  const key = keyFiles[0].slice(0, -4);
  assert.equal((await readFile(`public/${keyFiles[0]}`, 'utf8')).trim(), key, 'the key file contains its own name');
  assert.equal((await readFile(`dist/${keyFiles[0]}`, 'utf8')).trim(), key, 'the key file is in the build');
  const script = await readFile('scripts/indexnow-ping.mjs', 'utf8');
  assert.match(script, /process\.env\.INDEXNOW_ENABLED !== '1'/, 'guarded by INDEXNOW_ENABLED=1');
  assert.match(script, /https:\/\/api\.indexnow\.org\/indexnow/);
  assert.match(script, /const HOST = 'www\.mrwallcover\.com'/);
  assert.match(script, /keyLocation/);
  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts.indexnow, 'node scripts/indexnow-ping.mjs dist');
  for (const lifecycle of ['build', 'postbuild', 'prebuild']) assert.doesNotMatch(pkg.scripts[lifecycle] ?? '', /indexnow/, `${lifecycle} must not ping`);
  const workflow = await readFile('.github/workflows/pages.yml', 'utf8');
  assert.doesNotMatch(workflow, /indexnow/i, 'not wired into GitHub Pages yet');
  assert.match(await readFile('README.md', 'utf8'), /INDEXNOW_ENABLED=1 npm run indexnow/, 'README documents how to enable it');
  // Dry run: without the flag the script sends nothing and exits 0.
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const env = { ...process.env };
  delete env.INDEXNOW_ENABLED;
  const { stdout } = await promisify(execFile)('node', ['scripts/indexnow-ping.mjs', 'dist'], { env });
  assert.match(stdout, /nothing sent/);
});
