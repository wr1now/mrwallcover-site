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
  // Private homes: street or area only. Trematon keeps "near Saltash, Cornwall" without its postcode district; North London stays North London.
  for (const pattern of [/\b\d{1,4}[a-z]?\s+St\.?\s?George'?s?\s+Square/i, /\b\d{1,4}[a-z]?\s+Inverness\s+Terrace/i, /\bSW1V\s?\d[A-Z]{2}\b/, /\bW2\s?\d[A-Z]{2}\b/, /\bPL12\b/, /\bN\d{1,2}\s?\d[A-Z]{2}\b/]) {
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
  assert.match(html, /House of Hackney showroom/);
  const exterior = await readFile('dist/services/exterior-works/index.html', 'utf8');
  assert.match(exterior, /pimlico-st-georges-square/);
  assert.match(exterior, /inverness-terrace/);
  assert.doesNotMatch(exterior, /penny-morrison-showroom/);
  assert.match(exterior, /all the internal works plus the full exterior/i);
  assert.doesNotMatch(exterior, /House of Hackney|Lanesborough|Chesham|hackney/i);
  // No phone number in clear, whatever SITE_PHONE was at build time. The number only ever ships inside the reversed payload.
  assert.doesNotMatch(html, /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|wa\.me/);
  assert.doesNotMatch(html, /loadedAt/);
});

test('claims decided by Dorin on 9 October 2026 hold in the built site', async () => {
  const files = await htmlFiles('dist');
  const html = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  const llms = await readFile('dist/llms.txt', 'utf8');
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  const everything = `${html}\n${llms}\n${sitemap}`;
  // 1) No award until its name is supplied.
  assert.doesNotMatch(everything, /award-winning|2021 award|award \(2021\)|\baward\b/i);
  // 2) Four Seasons: 2016–2019, guest room and suite wallpapering; no "main contractor 2014" wording.
  assert.doesNotMatch(everything, /main contractor 2014|2014 to 2019|2014–2019|main wallcovering installation contractor/i);
  assert.match(html, /Four Seasons Hotel London at Ten Trinity Square, 2016 to 2019, guest room and suite wallpapering/);
  assert.match(html, /in the trade since 2014/i);
  // 3) The OWO: 2020–2023 everywhere.
  assert.doesNotMatch(everything, /2020–2022|2020 to 2022|2020 and 2022/);
  const owo = await readFile('dist/projects/raffles-london-the-owo/index.html', 'utf8');
  assert.match(owo, /2020–2023/);
  // 4) No Calico praise quotes; the partnership line stays.
  assert.doesNotMatch(everything, /Gorgeous! Thank you so much|for your hard work|In Calico's words|Client praise/i);
  assert.match(html, /Delivered in partnership with/);
  assert.doesNotMatch(everything, /Trusted by Calico/i);
  // 5) North London residence is live, with no press links and no owner name.
  const northLondon = await readFile('dist/projects/north-london-residence/index.html', 'utf8');
  assert.match(northLondon, /BAMBUSA/);
  assert.doesNotMatch(everything, /Kate Moss|thesun\.co\.uk|As seen in the press|house-of-kate-moss|celebrated North London/i);
  // 6) Penny Morrison showroom is a draft: no route, no link, nowhere in the sitemap or llms.txt.
  let built = true;
  try {
    await stat('dist/projects/penny-morrison-showroom/index.html');
  } catch {
    built = false;
  }
  assert.equal(built, false, 'the Penny Morrison route must not be built');
  assert.doesNotMatch(everything, /penny-morrison-showroom|Penny Morrison|9 Langton Street/);
  // 7) The approved privacy sentence replaces "Private houses are not shown".
  assert.doesNotMatch(everything, /Private houses are not shown|Private houses are not named/i);
  assert.match(html, /Private clients are not named\. Residential work appears only by street or area, with the owner(?:'|&#39;|’)s agreement\./);
});

test('every project an area or service page lists resolves to a built page, is linked from that page, and is never a draft', async () => {
  const drafts = new Set<string>();
  const aliases = new Map<string, string>();
  for (const name of (await readdir('src/content/case-studies')).filter((entry) => entry.endsWith('.md'))) {
    const text = await readFile(`src/content/case-studies/${name}`, 'utf8');
    const fm = JSON.parse(text.match(/^---\n([\s\S]*?)\n---\n/)![1]) as { slug: string; replaces?: string | null; draft?: boolean };
    if (fm.draft) drafts.add(fm.slug);
    else if (fm.replaces) aliases.set(fm.replaces, fm.slug);
  }
  assert.ok(drafts.has('penny-morrison-showroom'), 'this guard expects the showroom to be a draft; update it if that changes');
  type Landing = { slug: string; projects: string[] };
  const areas = (JSON.parse(await readFile('src/content/areas.json', 'utf8')) as { items: Landing[] }).items;
  const specialisms = (JSON.parse(await readFile('src/content/specialisms.json', 'utf8')) as { items: Landing[] }).items;
  const problems: string[] = [];
  let checked = 0;
  for (const [kind, items] of [['areas', areas], ['services', specialisms]] as const) {
    for (const item of items) {
      const page = `/${kind}/${item.slug}/`;
      const html = await readFile(`dist${page}index.html`, 'utf8');
      for (const listed of item.projects) {
        checked += 1;
        if (drafts.has(listed) || drafts.has(aliases.get(listed) ?? '')) problems.push(`${page} lists draft case study ${listed}`);
        const target = aliases.get(listed) ?? listed;
        const href = `/projects/${target}/`;
        let built: string | undefined;
        try {
          built = await readFile(`dist${href}index.html`, 'utf8');
        } catch {
          problems.push(`${page} lists ${listed} but ${href} is not built`);
        }
        if (built && /http-equiv="refresh"/.test(built)) problems.push(`${page} lists ${listed} but ${href} is only a redirect`);
        if (!html.includes(`href="${href}"`)) problems.push(`${page} does not link ${href}`);
      }
      // No link on the page may point at a draft route or an unbuilt project page, whatever its source.
      for (const link of html.matchAll(/href="\/projects\/([a-z0-9-]+)\/"/g)) {
        const slug = link[1];
        if (drafts.has(slug)) problems.push(`${page} links the draft route /projects/${slug}/`);
        try {
          await stat(`dist/projects/${slug}/index.html`);
        } catch {
          problems.push(`${page} links /projects/${slug}/ which is not built`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(checked >= 15, `only ${checked} listed projects checked`);
  // Decisions of 9 October 2026: Kensington cites the published Lavery case study; Chelsea cites nothing while the showroom is a draft.
  assert.deepEqual(areas.find((a) => a.slug === 'kensington')?.projects, ['calico-beverly-1975-cadence']);
  assert.deepEqual(areas.find((a) => a.slug === 'chelsea')?.projects, []);
  const kensington = await readFile('dist/areas/kensington/index.html', 'utf8');
  assert.match(kensington, /On the public record/);
  assert.match(kensington, /href="\/projects\/calico-beverly-1975-cadence\/"/);
  const content = await readFile('src/lib/content.ts', 'utf8');
  assert.match(content, /export function linkedProjects/, 'pages must resolve listed projects through linkedProjects, which fails the build on an unknown slug');
  for (const file of ['src/components/LandingBody.astro', 'src/pages/[...page].astro']) {
    assert.match(await readFile(file, 'utf8'), /linkedProjects\(/, `${file} must use linkedProjects`);
    assert.doesNotMatch(await readFile(file, 'utf8'), /\.filter\(\(p\) => p !== undefined\)/, `${file} must not silently drop unresolved slugs`);
  }
});

test('no internal-drafting or defensive phrasing reaches the public pages', async () => {
  const files = await htmlFiles('dist');
  const raw = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  // Inline image placeholders are base64 and can contain any letters; strip them before matching words.
  const html = raw.replace(/data:image\/[^"')\s]+/g, '');
  const llms = await readFile('dist/llms.txt', 'utf8');
  const text = `${html}\n${llms}`;
  for (const banned of [
    /not a consumer quiz/i,
    /A library, not a shop/i,
    /\bnot a shop\b/i,
    /we do not publish/i,
    /partner level/i,
    /trade tier/i,
    /reply time/i,
    /response time/i,
    /respond within/i,
    /published waiting list/i,
    /cleared for the site/i,
    /form host/i,
    /private store/i,
    /What this page does not claim/i,
    /not a club you join/i,
    /No basket\./,
    /Not a homeowner form/i,
    /\bTBC\b/,
    /\blorem\b/i,
    /TODO/,
  ]) {
    assert.doesNotMatch(text, banned, String(banned));
  }
  assert.match(html, /Find the right wallcovering for your room\./);
  assert.match(html, /Wallcovering support for your specification|From specification<br>to the finished room\./);
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
  // The Person @id fragment must resolve: the About page element that introduces Dorin carries id="dorin" and holds the H1.
  assert.match(about, /<header[^>]*\sid="dorin"[^>]*>[\s\S]*?<h1>/, 'About page: the founder header must carry id="dorin"');
  assert.equal(about.match(/\sid="dorin"/g)?.length, 1, 'id="dorin" must appear exactly once');
  const llms = await readFile('dist/llms.txt', 'utf8');
  assert.ok(llms.split('\n').includes(`> ${sentence}`), 'llms.txt');
  assert.doesNotMatch(llms, /Lanesborough|Moxy/);
});

test('the business offers exactly the built service pages, by name and URL, with no price', async () => {
  const specialisms = (JSON.parse(await readFile('src/content/specialisms.json', 'utf8')) as { items: { slug: string; name: string }[] }).items;
  const home = await readFile('dist/index.html', 'utf8');
  const graph = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]) as { '@graph': Record<string, any>[] };
  const business = graph['@graph'].find((node) => node['@id'] === 'https://www.mrwallcover.com/#business')!;
  const catalog = business.hasOfferCatalog;
  assert.equal(catalog?.['@type'], 'OfferCatalog');
  assert.equal(catalog.itemListElement.length, specialisms.length);
  for (const [index, offer] of (catalog.itemListElement as Record<string, any>[]).entries()) {
    const expected = specialisms[index];
    assert.equal(offer['@type'], 'Offer');
    const service = offer.itemOffered;
    assert.equal(service['@type'], 'Service');
    assert.equal(service.name, expected.name);
    assert.equal(service.url, `https://www.mrwallcover.com/services/${expected.slug}/`);
    assert.equal(service['@id'], `${service.url}#service`);
    assert.deepEqual(service.provider, { '@id': 'https://www.mrwallcover.com/#business' });
    const page = await readFile(`dist/services/${expected.slug}/index.html`, 'utf8');
    assert.doesNotMatch(page, /http-equiv="refresh"/, `${service.url} must be a real page`);
    const pageGraph = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]) as { '@graph': Record<string, any>[] };
    const onPage = pageGraph['@graph'].find((node) => node['@id'] === service['@id']);
    assert.ok(onPage, `${service.url} must emit the Service node the catalogue points at`);
    assert.equal(onPage.name, service.name);
    assert.equal(onPage.serviceType, service.serviceType);
  }
  assert.doesNotMatch(JSON.stringify(catalog), /price|Price|offers"|availability|eligibleRegion/, 'the catalogue carries no price or stock claims');
  // The same catalogue is on every indexable page, because the business node is.
  const about = await readFile('dist/about/index.html', 'utf8');
  assert.match(about, /"hasOfferCatalog":\{"@type":"OfferCatalog"/);
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
