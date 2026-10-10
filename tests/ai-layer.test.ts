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
  // "Who runs it" prints the stable About fields, not paragraphs picked by index.
  const about = JSON.parse(await readFile('src/content/about.json', 'utf8')) as { founderSummary: string; publicRecord: string };
  assert.ok(html.includes(`>${facts.founder.name}</a>, founder. ${about.founderSummary}</p>`), 'founder sentence from about.founderSummary');
  assert.ok(html.includes(`<p>${about.publicRecord}</p>`), 'privacy sentence from about.publicRecord');
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
  // Every professional audience page is listed by name, not only the /professionals/ hub.
  for (const slug of ['designers', 'developers', 'hotels']) {
    assert.ok(urls.includes(`${SITE}/professionals/${slug}/`), `/professionals/${slug}/ is listed`);
  }
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

test('forbidden strings are absent from every text file in dist, and no phone-number pattern appears in any Markdown, text, JSON or XML file (nor in HTML or JS when SITE_PHONE is unset)', async () => {
  const files = await filesUnder('dist', (name) => /\.(html|md|txt|json|xml|js|css|csv)$/.test(name));
  assert.ok(files.length > 140, `${files.length} text files`);
  // Without the SITE_PHONE secret nothing in the build may hold a number, so the HTML and scripts are scanned too.
  // With it, the number ships only inside the reversed payload, which tests/dist-guards.test.ts and phone-build check.
  const phoneUnset = !process.env.SITE_PHONE;
  const phonePattern = /\b0?7\d{3}\s?\d{6}\b|\+?44\s?\(?0?\)?\s?7\d{9}|\+?44\s?\(?0?\)?\s?20\s?\d{4}\s?\d{4}|\b020\s?\d{4}\s?\d{4}\b/;
  const problems: string[] = [];
  let scannedForPhone = 0;
  for (const file of files) {
    // Inline image placeholders are base64 and can spell anything; strip them before matching words.
    const text = (await readFile(file, 'utf8')).replace(/data:image\/[^"')\s]+/g, '');
    for (const banned of ['CLAUDI', 'Landmark', 'Threadneedles', 'Threadneedle', 'third party', 'third-party', 'subcontract', 'TODO', 'lorem']) {
      if (text.toLowerCase().includes(banned.toLowerCase())) problems.push(`${file}: ${banned}`);
    }
    const scanPhone = /\.(md|txt|json|xml)$/.test(file) || (phoneUnset && /\.(html|js)$/.test(file));
    if (scanPhone) {
      scannedForPhone += 1;
      if (phonePattern.test(text)) problems.push(`${file}: phone number pattern`);
    }
  }
  assert.deepEqual(problems, []);
  if (phoneUnset) assert.ok(files.filter((file) => /\.(html|js)$/.test(file)).length > 70 && scannedForPhone > 140, `${scannedForPhone} files scanned for a phone number`);
});

test('no draft URL appears in the sitemap, llms.txt, llms-full.txt or the feed', async () => {
  const drafts: string[] = [];
  for (const name of (await readdir('src/content/case-studies')).filter((entry) => entry.endsWith('.md'))) {
    const fm = JSON.parse((await readFile(`src/content/case-studies/${name}`, 'utf8')).match(/^---\n([\s\S]*?)\n---\n/)![1]) as { slug: string; draft?: boolean };
    if (fm.draft) drafts.push(`/projects/${fm.slug}/`);
  }
  for (const name of (await readdir('src/content/pages')).filter((entry) => entry.endsWith('.md'))) {
    const fm = JSON.parse((await readFile(`src/content/pages/${name}`, 'utf8')).match(/^---\n([\s\S]*?)\n---\n/)![1]) as { path: string; draft?: boolean };
    if (fm.draft) drafts.push(fm.path);
  }
  for (const name of (await readdir('src/content/guides')).filter((entry) => entry.endsWith('.md'))) {
    if (/^draft: true$/m.test(await readFile(`src/content/guides/${name}`, 'utf8'))) drafts.push(`/advice/${name.slice(0, -3)}/`);
  }
  assert.ok(drafts.length >= 3, `${drafts.length} drafts found; the showroom case study and the editorial scaffolds are expected to be drafts`);
  const outputs = Object.fromEntries(await Promise.all(['sitemap-0.xml', 'llms.txt', 'llms-full.txt', 'feed.xml'].map(async (name) => [name, await readFile(`dist/${name}`, 'utf8')])));
  const problems: string[] = [];
  for (const draft of drafts) {
    // Any occurrence of the draft path is a leak: absolute or relative, quoted or bare, with or without its trailing slash.
    // The lookahead stops "/advice/cost" from matching a published "/advice/cost-…" page.
    const leak = new RegExp(`${draft.replace(/\/$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9-])`);
    for (const [name, text] of Object.entries(outputs)) if (leak.test(text)) problems.push(`${draft} in ${name}`);
    let built = true;
    try {
      await readFile(`dist${draft}index.html`, 'utf8');
    } catch {
      built = false;
    }
    if (built) problems.push(`${draft} is built`);
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
  assert.match(robots, /^Sitemap: https:\/\/www\.mrwallcover\.com\/sitemap\.xml$/m);
  assert.equal(await readFile('dist/sitemap.xml', 'utf8'), await readFile('dist/sitemap-index.xml', 'utf8'), '/sitemap.xml is a copy of the sitemap index');
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

test('/feed.xml is Atom with exactly the published guides and case studies, their frontmatter dates and no drafts; every page links it', async () => {
  const feed = await readFile('dist/feed.xml', 'utf8');
  assert.ok(feed.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"'), 'Atom root');
  assert.match(feed, /<link rel="self" type="application\/atom\+xml" href="https:\/\/www\.mrwallcover\.com\/feed\.xml"\/>/);
  assert.match(feed, /<updated>\d{4}-\d{2}-\d{2}T00:00:00Z<\/updated>/);
  const entries = [...feed.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
  const byUrl = new Map(entries.map((entry) => [entry.match(/<id>([^<]+)<\/id>/)![1], entry]));
  assert.equal(byUrl.size, entries.length, 'ids are unique');
  const expected = new Map<string, { published: string; updated: string; title: string }>();
  for (const name of (await readdir('src/content/guides')).filter((entry) => entry.endsWith('.md'))) {
    const text = await readFile(`src/content/guides/${name}`, 'utf8');
    if (/^draft: true$/m.test(text)) continue;
    expected.set(`${SITE}/advice/${name.slice(0, -3)}/`, {
      published: text.match(/^published: "([^"]+)"$/m)![1],
      updated: text.match(/^updated: "([^"]+)"$/m)![1],
      title: JSON.parse(text.match(/^title: (".*")$/m)![1]),
    });
  }
  for (const name of (await readdir('src/content/case-studies')).filter((entry) => entry.endsWith('.md'))) {
    const fm = JSON.parse((await readFile(`src/content/case-studies/${name}`, 'utf8')).match(/^---\n([\s\S]*?)\n---\n/)![1]) as { slug: string; draft?: boolean; published: string; updated: string; title: string };
    if (fm.draft) {
      assert.equal(feed.includes(`/projects/${fm.slug}/`), false, `${fm.slug} is a draft`);
      continue;
    }
    expected.set(`${SITE}/projects/${fm.slug}/`, { published: fm.published, updated: fm.updated, title: fm.title });
  }
  assert.deepEqual([...byUrl.keys()].sort(), [...expected.keys()].sort(), 'the feed lists exactly the published guides and case studies');
  // The feed filters drafts itself, on both sources, rather than trusting the content modules alone.
  const feedSource = await readFile('src/pages/feed.xml.ts', 'utf8');
  assert.match(feedSource, /caseStudies\.filter\(\(study\) => !study\.frontmatter\.draft\)/, 'case studies filtered on !draft in the feed');
  assert.match(feedSource, /publishedGuides\.filter\(\(guide\) => !guide\.frontmatter\.draft\)/, 'guides filtered on !draft in the feed');
  for (const [url, item] of expected) {
    const entry = byUrl.get(url)!;
    assert.ok(entry.includes(`<published>${item.published}T00:00:00Z</published>`), `${url} published`);
    assert.ok(entry.includes(`<updated>${item.updated}T00:00:00Z</updated>`), `${url} updated`);
    assert.ok(entry.includes(`<link rel="alternate" type="text/html" href="${url}"/>`), `${url} link`);
    assert.ok(entry.includes(`<title>${item.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</title>`), `${url} title`);
    assert.match(entry, /<summary>\S[^<]*<\/summary>/, `${url} summary`);
  }
  // Newest first, and no unescaped ampersand anywhere.
  const updates = entries.map((entry) => entry.match(/<updated>([^<]+)<\/updated>/)![1]);
  assert.deepEqual(updates, [...updates].sort().reverse());
  assert.doesNotMatch(feed, /&(?!amp;|lt;|gt;|quot;|apos;|#)/);
  for (const page of await publishedPages()) {
    assert.ok(page.html.includes('<link rel="alternate" type="application/atom+xml" href="/feed.xml"'), `${page.pathname} links the feed`);
  }
  assert.match(await readFile('dist/llms.txt', 'utf8'), /\(https:\/\/www\.mrwallcover\.com\/feed\.xml\)/);
});

test('schema audit: business coverage matches the fact sheet and the area pages, Person present, Service on service pages, Article on guides and case studies, FAQPage only with visible questions, BreadcrumbList on every non-home page, credited ImageObjects without copyright claims, no SearchAction, no ratings, reviews, offers or prices', async () => {
  type Node = Record<string, any>;
  const graphOf = (html: string): Node[] => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])['@graph'];
  const areas = (JSON.parse(await readFile('src/content/areas.json', 'utf8')) as { items: { slug: string; name: string; heading: string }[] }).items;
  const facts = JSON.parse(await readFile('src/data/facts.json', 'utf8')) as { place: string; coverage: string };
  // The fact-sheet coverage line is "<local>; <national>"; the schema must carry both halves word for word.
  const [coverageLocal, coverageNational] = facts.coverage.split('; ');
  assert.ok(coverageLocal && coverageNational, 'facts.coverage reads "<local>; <national>"');
  // Each area Place is named exactly as areas.json names it, and that name is what the area page's H1 reads.
  for (const area of areas) {
    const areaHtml = await readFile(`dist/areas/${area.slug}/index.html`, 'utf8');
    const h1 = stripTags(areaHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1]);
    assert.ok(h1.includes(area.name), `/areas/${area.slug}/ H1 "${h1}" names "${area.name}"`);
    const service = graphOf(areaHtml).find((node) => node['@type'] === 'Service' && node['@id'] === `${SITE}/areas/${area.slug}/#service`);
    assert.equal(service?.areaServed?.name, area.name, `/areas/${area.slug}/ Service areaServed uses the area's own name`);
  }
  const specialisms = (JSON.parse(await readFile('src/content/specialisms.json', 'utf8')) as { items: { slug: string }[] }).items;
  const credits = new Map<string, string>();
  const drafts = new Set<string>();
  for (const name of (await readdir('src/content/case-studies')).filter((entry) => entry.endsWith('.md'))) {
    const fm = JSON.parse((await readFile(`src/content/case-studies/${name}`, 'utf8')).match(/^---\n([\s\S]*?)\n---\n/)![1]) as { slug: string; draft?: boolean; gallery: { id: string; credit: string | null }[] };
    if (fm.draft) drafts.add(fm.slug);
    else for (const item of fm.gallery) if (item.credit && /^(Photography|Image):/.test(item.credit)) credits.set(item.id, item.credit);
  }
  assert.ok(credits.size >= 10, 'credited photographs exist in the published case studies');
  const problems: string[] = [];
  let creditedImages = 0;
  for (const page of await publishedPages()) {
    const graph = graphOf(page.html);
    const types = graph.map((node) => (Array.isArray(node['@type']) ? node['@type'].join('+') : node['@type']));
    const serialised = JSON.stringify(graph);
    // copyrightNotice is banned: a printed photo credit is a credit, not a copyright claim.
    for (const banned of ['aggregateRating', 'reviewRating', '"review"', '"reviews"', '"offers"', 'priceRange', '"price"', 'priceCurrency', 'SearchAction', 'potentialAction', 'telephone', '"award"', 'copyrightNotice']) {
      if (serialised.includes(banned)) problems.push(`${page.pathname}: schema contains ${banned}`);
    }
    const business = graph.find((node) => node['@id'] === `${SITE}/#business`);
    if (!business) problems.push(`${page.pathname}: no business node`);
    else {
      const servedNodes = business.areaServed as Node[];
      const served = servedNodes.map((area) => area.name);
      if (!served.includes(facts.place)) problems.push(`${page.pathname}: areaServed lacks ${facts.place}`);
      if (!servedNodes.some((area) => area['@type'] === 'AdministrativeArea' && area.name === coverageLocal)) problems.push(`${page.pathname}: areaServed lacks the fact-sheet coverage "${coverageLocal}"`);
      if (!servedNodes.some((area) => area['@type'] === 'Country' && area.name === 'United Kingdom' && area.description === coverageNational)) problems.push(`${page.pathname}: areaServed Country lacks the fact-sheet reach "${coverageNational}"`);
      for (const area of areas) {
        if (!servedNodes.some((node) => node['@type'] === 'Place' && node.name === area.name && node.url === `${SITE}/areas/${area.slug}/`)) problems.push(`${page.pathname}: areaServed lacks Place "${area.name}" at /areas/${area.slug}/`);
      }
      if (served.length !== areas.length + 3) problems.push(`${page.pathname}: areaServed has ${served.length} entries, expected ${areas.length + 3}`);
    }
    if (!graph.some((node) => node['@type'] === 'Person' && node['@id'] === `${SITE}/about/#dorin`)) problems.push(`${page.pathname}: no Person node`);
    const website = graph.find((node) => node['@type'] === 'WebSite');
    if (!website || website['@id'] !== `${SITE}/#website`) problems.push(`${page.pathname}: no WebSite node`);
    if (page.pathname !== '/') {
      const crumbs = graph.find((node) => node['@type'] === 'BreadcrumbList');
      if (!crumbs) problems.push(`${page.pathname}: no BreadcrumbList`);
      else {
        const last = crumbs.itemListElement.at(-1);
        if (last.item !== `${SITE}${page.pathname}`) problems.push(`${page.pathname}: breadcrumb ends at ${last.item}`);
        if (crumbs.itemListElement[0].item !== `${SITE}/`) problems.push(`${page.pathname}: breadcrumb does not start at home`);
      }
    }
    const faqVisible = /<details id="[a-z-]+">|<section class="guide-faq"/.test(page.html);
    if (types.includes('FAQPage') !== faqVisible) problems.push(`${page.pathname}: FAQPage ${types.includes('FAQPage') ? 'without' : 'missing despite'} visible questions`);
    if (/^\/services\/[a-z-]+\/$/.test(page.pathname)) {
      const service = graph.find((node) => node['@type'] === 'Service' && node['@id'] === `${SITE}${page.pathname}#service`);
      if (!service) problems.push(`${page.pathname}: no Service node with the page @id`);
    }
    if (/^\/(advice\/(?!quantities\/)[a-z-]+|projects\/[a-z0-9-]+)\/$/.test(page.pathname)) {
      const article = graph.find((node) => node['@type'] === 'Article');
      if (!article) problems.push(`${page.pathname}: no Article`);
      else if (article.author?.['@id'] !== `${SITE}/about/#dorin`) problems.push(`${page.pathname}: Article author is not the founder`);
    }
    // Every ImageObject whose photograph carries a printed credit names the credit holder.
    for (const match of serialised.matchAll(/\{"@type":"ImageObject","url":"https:\/\/www\.mrwallcover\.com\/media\/img\/([a-z0-9-]+)\.jpg"([^}]*)\}/g)) {
      const credit = credits.get(match[1]);
      if (!credit) continue;
      creditedImages += 1;
      const holder = credit.replace(/^(Photography|Image):\s*/, '').replace(/\s*\(official\)$/, '');
      if (!match[2].includes(`"creditText":"${holder}"`)) problems.push(`${page.pathname}: ${match[1]} lacks creditText "${holder}"`);
      if (!page.html.includes(credit)) problems.push(`${page.pathname}: credit "${credit}" is in schema but not printed on the page`);
    }
    for (const slug of drafts) if (serialised.includes(`/projects/${slug}/`)) problems.push(`${page.pathname}: schema mentions draft ${slug}`);
  }
  assert.deepEqual(problems, []);
  assert.ok(creditedImages >= 10, `${creditedImages} credited ImageObjects checked`);
  const hoh = await readFile('dist/projects/house-of-hackney-st-michaels/index.html', 'utf8');
  assert.match(hoh, /"creditText":"House of Hackney"/);
  assert.doesNotMatch(hoh, /copyrightNotice/);
  // Specialism pages each carry their Service; the business node is the HomeAndConstructionBusiness already in use.
  for (const item of specialisms) assert.match(await readFile(`dist/services/${item.slug}/index.html`, 'utf8'), /"@type":"Service"/);
  const home = graphOf(await readFile('dist/index.html', 'utf8'));
  assert.deepEqual(home.find((node) => node['@id'] === `${SITE}/#business`)!['@type'], ['HomeAndConstructionBusiness', 'ProfessionalService']);
  // No SearchAction because /search/ filters a static list in the browser and never reads a query parameter.
  const search = await readFile('src/pages/search.astro', 'utf8');
  assert.doesNotMatch(search, /location\.search|URLSearchParams|searchParams/, 'if /search/ starts honouring ?q=, add a SearchAction and update this test');
});

test('every published page shows one author and date line: the page\'s own date for guides and case studies, the site-wide review date elsewhere; the twins carry the same date', async () => {
  const facts = JSON.parse(await readFile('src/data/facts.json', 'utf8')) as { lastReviewed: string };
  const guideDates = new Map<string, string>();
  for (const name of (await readdir('src/content/guides')).filter((entry) => entry.endsWith('.md'))) {
    const text = await readFile(`src/content/guides/${name}`, 'utf8');
    if (!/^draft: true$/m.test(text)) guideDates.set(`/advice/${name.slice(0, -3)}/`, text.match(/^updated: "([^"]+)"$/m)![1]);
  }
  const studyDates = new Map<string, string>();
  for (const name of (await readdir('src/content/case-studies')).filter((entry) => entry.endsWith('.md'))) {
    const fm = JSON.parse((await readFile(`src/content/case-studies/${name}`, 'utf8')).match(/^---\n([\s\S]*?)\n---\n/)![1]) as { slug: string; draft?: boolean; updated: string };
    if (!fm.draft) studyDates.set(`/projects/${fm.slug}/`, fm.updated);
  }
  const problems: string[] = [];
  for (const page of await publishedPages()) {
    const main = page.html.match(/<main id="main"[^>]*>([\s\S]*?)<\/main>/)![1];
    const stamps = [...main.matchAll(/By <a href="\/about\/#dorin">Dorin Burcus<\/a>, founder · (Last updated|Last reviewed) <time datetime="(\d{4}-\d{2}-\d{2})" data-page-updated="(updated|reviewed)">(\d{1,2} [A-Z][a-z]+ \d{4})<\/time>/g)];
    if (stamps.length !== 1) {
      problems.push(`${page.pathname}: ${stamps.length} author/date lines`);
      continue;
    }
    const [, label, iso, kind] = stamps[0];
    const own = guideDates.get(page.pathname) ?? studyDates.get(page.pathname);
    if (own) {
      if (label !== 'Last updated' || kind !== 'updated' || iso !== own) problems.push(`${page.pathname}: expected "Last updated ${own}", got "${label} ${iso}"`);
    } else if (label !== 'Last reviewed' || kind !== 'reviewed' || iso !== facts.lastReviewed) {
      problems.push(`${page.pathname}: expected "Last reviewed ${facts.lastReviewed}", got "${label} ${iso}"`);
    }
    if (iso < '2026-10-09') problems.push(`${page.pathname}: date ${iso} precedes the 9 October 2026 review`);
    const twin = await readFile(path.join('dist', page.pathname, 'index.md'), 'utf8');
    const key = own ? 'last_updated' : 'last_reviewed';
    if (!twin.includes(`\n${key}: ${iso}\n---\n`)) problems.push(`${page.pathname}: twin front matter lacks "${key}: ${iso}"`);
    // Answer-first: a real opening paragraph of at least 60 characters within the first three paragraphs after the H1.
    const after = main.split(/<\/h1>/)[1] ?? '';
    const paragraphs = [...after.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].slice(0, 3).map((m) => stripTags(m[1]));
    if (!paragraphs.some((text) => text.length >= 60)) problems.push(`${page.pathname}: no opening paragraph of substance after the H1`);
  }
  assert.deepEqual(problems, []);
  const full = await readFile('dist/llms-full.txt', 'utf8');
  assert.equal(full.match(/^Last (updated|reviewed): \d{4}-\d{2}-\d{2}$/gm)?.length, (await publishedPages()).length, 'every page in llms-full carries its date line');
});
