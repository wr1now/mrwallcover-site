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
  for (const banned of ['CLAUDI', 'Landmark', 'Samantha', 'Koroseal', 'Admiralty', 'Metropole', 'Canary Wharf', 'subcontract', 'third party', 'third-party', 'Threadneedle', 'Mulberry', 'Aethos']) {
    assert.equal(html.toLowerCase().includes(banned.toLowerCase()), false, banned);
  }
  // The two private residential buildings: street only, never a house number or a full postcode.
  for (const pattern of [/\b\d{1,4}[a-z]?\s+St\.?\s?George'?s?\s+Square/i, /\b\d{1,4}[a-z]?\s+Inverness\s+Terrace/i, /\bSW1V\s?\d[A-Z]{2}\b/, /\bW2\s?\d[A-Z]{2}\b/]) {
    assert.doesNotMatch(html, pattern);
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
  // No phone number in clear, whatever SITE_PHONE was at build time. The number only ever ships inside the reversed payload.
  assert.doesNotMatch(html, /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|wa\.me/);
  assert.doesNotMatch(html, /loadedAt/);
});

test('the homepage H1 and meta description define the firm', async () => {
  const facts = JSON.parse(await readFile('src/data/facts.json', 'utf8')) as { description: string };
  const home = await readFile('dist/index.html', 'utf8');
  const h1 = home.match(/<h1>([\s\S]*?)<\/h1>/)![1].replace(/<[^>]+>/g, '');
  assert.match(h1, /^Mr Wallcover is a London specialist wallcovering installer, founded by Dorin Burcus\.$/);
  assert.equal(home.match(/<meta name="description" content="([^"]*)"/)![1], facts.description);
  assert.equal(home.match(/<meta property="og:description" content="([^"]*)"/)![1], facts.description);
  assert.match(home, /Wallcoverings, hung properly\./);
});

test('the fact-sheet sentence appears identically in the footer, the JSON-LD and llms.txt', async () => {
  const facts = JSON.parse(await readFile('src/data/facts.json', 'utf8')) as { description: string; founder: { name: string } };
  const sentence = facts.description;
  assert.ok(sentence.length <= 160);
  const home = await readFile('dist/index.html', 'utf8');
  const about = await readFile('dist/about/index.html', 'utf8');
  const footerText = home.match(/<p[^>]*data-fact-sheet[^>]*>([^<]*)<\/p>/)?.[1];
  assert.equal(footerText, sentence, 'footer');
  const graph = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]) as { '@graph': Record<string, unknown>[] };
  const business = graph['@graph'].find((node) => node['@id'] === 'https://www.mrwallcover.com/#business')!;
  assert.equal(business.description, sentence, 'schema');
  assert.deepEqual(business.founder, { '@id': 'https://www.mrwallcover.com/about/#dorin' });
  assert.deepEqual(business.sameAs, ['https://www.instagram.com/mrwallcover/']);
  for (const key of ['award', 'aggregateRating', 'memberOf', 'hasCredential', 'legalName', 'telephone', 'foundingDate']) {
    assert.equal(key in business, false, key);
  }
  const person = graph['@graph'].find((node) => node['@id'] === 'https://www.mrwallcover.com/about/#dorin')!;
  assert.equal(person['@type'], 'Person');
  assert.equal(person.name, facts.founder.name);
  assert.equal(person.url, 'https://www.mrwallcover.com/about/');
  assert.match(about, /about\/#dorin/);
  const llms = await readFile('dist/llms.txt', 'utf8');
  assert.ok(llms.split('\n').includes(`> ${sentence}`), 'llms.txt');
  assert.doesNotMatch(llms, /Lanesborough|Moxy/);
});

test('each case-study Article carries its frontmatter dates and Dorin as author; the sitemap lastmod matches', async () => {
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  assert.ok(entries.length > 30);
  const lastmods = new Map<string, string | undefined>();
  for (const entry of entries) {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)![1];
    lastmods.set(new URL(loc).pathname, entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]);
  }
  let articles = 0;
  for (const name of (await readdir('src/content/case-studies')).filter((entry) => entry.endsWith('.md'))) {
    const text = await readFile(`src/content/case-studies/${name}`, 'utf8');
    const fm = JSON.parse(text.match(/^---\n([\s\S]*?)\n---\n/)![1]) as { slug: string; draft?: boolean; published: string; updated: string };
    const pagePath = `/projects/${fm.slug}/`;
    if (fm.draft) {
      assert.equal(lastmods.has(pagePath), false, `${pagePath} is a draft`);
      continue;
    }
    const html = await readFile(`dist${pagePath}index.html`, 'utf8');
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]) as { '@graph': Record<string, any>[] };
    const article = graph['@graph'].find((node) => node['@type'] === 'Article');
    assert.ok(article, `${pagePath} has an Article`);
    assert.equal(article.datePublished, fm.published, `${pagePath} datePublished`);
    assert.equal(article.dateModified, fm.updated, `${pagePath} dateModified`);
    assert.equal(article.author['@id'], 'https://www.mrwallcover.com/about/#dorin', `${pagePath} author`);
    assert.equal(article.author.name, 'Dorin Burcus');
    // @astrojs/sitemap prints the date as an ISO timestamp at midnight; the date part is the frontmatter value.
    assert.equal(lastmods.get(pagePath)?.slice(0, 10), fm.updated, `${pagePath} sitemap lastmod`);
    articles += 1;
  }
  assert.ok(articles >= 10);
  for (const [pagePath, lastmod] of lastmods) {
    if (!pagePath.startsWith('/projects/') || pagePath === '/projects/') assert.equal(lastmod, undefined, `${pagePath} must not carry a build-time lastmod`);
  }
});

test('draft editorial pages are not built, not in the sitemap, not in llms.txt and not linked', async () => {
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  const llms = await readFile('dist/llms.txt', 'utf8');
  const files = await htmlFiles('dist');
  const html = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  const names = (await readdir('src/content/pages')).filter((entry) => entry.endsWith('.md'));
  assert.ok(names.length >= 6);
  for (const name of names) {
    const text = await readFile(`src/content/pages/${name}`, 'utf8');
    const fm = JSON.parse(text.match(/^---\n([\s\S]*?)\n---\n/)![1]) as { draft?: boolean; path: string; heading: string };
    const url = `https://www.mrwallcover.com${fm.path}`;
    let built = true;
    try {
      await stat(`dist${fm.path}index.html`);
    } catch {
      built = false;
    }
    if (fm.draft) {
      assert.equal(built, false, `${fm.path} must not be built`);
      assert.equal(sitemap.includes(url), false, `${fm.path} in sitemap`);
      assert.equal(llms.includes(url), false, `${fm.path} in llms.txt`);
      assert.equal(html.includes(`href="${fm.path}"`), false, `${fm.path} is linked`);
      assert.equal(html.includes('TODO(Dorin)'), false, 'a TODO(Dorin) marker reached the build');
    } else {
      assert.equal(built, true, `${fm.path} must be built`);
      assert.ok(sitemap.includes(url), `${fm.path} missing from sitemap`);
    }
  }
});

test('no public dist file contains TODO', async () => {
  async function textFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...await textFiles(full));
      else if (/\.(html|xml|txt|csv|json|js|css)$/.test(entry.name)) out.push(full);
    }
    return out;
  }
  const files = await textFiles('dist');
  assert.ok(files.length > 50);
  const offenders: string[] = [];
  for (const file of files) {
    if ((await readFile(file, 'utf8')).includes('TODO')) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test('each published guide carries an Article with the founder as author, the business as publisher and its frontmatter dates', async () => {
  const names = (await readdir('src/content/guides')).filter((entry) => entry.endsWith('.md'));
  let articles = 0;
  for (const name of names) {
    const text = await readFile(`src/content/guides/${name}`, 'utf8');
    if (/^draft: true$/m.test(text)) continue;
    const slug = name.slice(0, -3);
    const published = text.match(/^published: "(\d{4}-\d{2}-\d{2})"$/m)![1];
    const updated = text.match(/^updated: "(\d{4}-\d{2}-\d{2})"$/m)![1];
    const html = await readFile(`dist/advice/${slug}/index.html`, 'utf8');
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]) as { '@graph': Record<string, any>[] };
    const article = graph['@graph'].find((node) => node['@type'] === 'Article');
    assert.ok(article, `${slug} has an Article`);
    assert.equal(article.datePublished, published, `${slug} datePublished`);
    assert.equal(article.dateModified, updated, `${slug} dateModified`);
    assert.equal(article.author['@id'], 'https://www.mrwallcover.com/about/#dorin', `${slug} author`);
    assert.equal(article.author.name, 'Dorin Burcus');
    assert.deepEqual(article.publisher, { '@id': 'https://www.mrwallcover.com/#business' }, `${slug} publisher`);
    assert.equal(article.mainEntityOfPage['@id'], `https://www.mrwallcover.com/advice/${slug}/#webpage`);
    assert.ok(graph['@graph'].some((node) => node['@type'] === 'BreadcrumbList'), `${slug} breadcrumbs`);
    // FAQPage only where the page shows the questions.
    const faqPage = graph['@graph'].find((node) => node['@type'] === 'FAQPage');
    assert.equal(Boolean(faqPage), html.includes('id="questions"'), `${slug} FAQPage must match a visible question block`);
    if (faqPage) for (const q of faqPage.mainEntity) assert.ok(html.includes(`<h3>${q.name}</h3>`), `${slug}: ${q.name} is not visible`);
    assert.match(html, /By <a href="\/about\/#dorin">Dorin Burcus<\/a>, founder · Last updated/);
    articles += 1;
  }
  assert.ok(articles >= 1, 'at least one guide is published');
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

test('every indexable page has an https canonical, a description, JSON-LD, one H1 and no de Gournay title', async () => {
  const files = await htmlFiles('dist');
  const problems: string[] = [];
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    if (/<meta name="robots" content="noindex">/.test(html) || /http-equiv="refresh"/.test(html)) continue;
    const rel = file.replace(/^dist/, '');
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    if (!canonical || !canonical.startsWith('https://www.mrwallcover.com/') || !canonical.endsWith('/')) problems.push(`${rel}: canonical ${canonical}`);
    const expectedPath = rel.replace(/index\.html$/, '');
    if (canonical && new URL(canonical).pathname !== expectedPath) problems.push(`${rel}: canonical points at ${canonical}`);
    const description = html.match(/<meta name="description" content="([^"]*)">/)?.[1];
    if (!description || description.length < 40 || description.length > 170) problems.push(`${rel}: description ${description?.length ?? 0} chars`);
    if (!/<script type="application\/ld\+json">/.test(html)) problems.push(`${rel}: no JSON-LD`);
    const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
    if (h1s !== 1) problems.push(`${rel}: ${h1s} H1s`);
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    if (/gournay/i.test(title)) problems.push(`${rel}: title names de Gournay`);
    if (/gournay/i.test(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '')) problems.push(`${rel}: H1 names de Gournay`);
    for (const name of html.matchAll(/"name":"([^"]*gournay[^"]*)"/gi)) problems.push(`${rel}: schema name ${name[1]}`);
  }
  assert.deepEqual(problems, []);
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
