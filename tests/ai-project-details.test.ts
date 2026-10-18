import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { enrichProjects, readPage, toMarkdown } from '../scripts/build-ai-layer.mjs';

const SITE = 'https://www.mrwallcover.com';
const json = async (file: string): Promise<any> => JSON.parse(await readFile(file, 'utf8'));
const unescapeMarkdown = (text: string) => text.replace(/\\([\[\]\\])/g, '$1');
const visible = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').trim();

test('every project JSON carries the complete canonical page with corpus, Markdown and individual-record parity', async () => {
  const payload = await json('dist/ai/projects.json');
  const corpus = await json('dist/ai/pages.json');
  assert.equal(payload.schemaVersion, '1.2');
  const publishedProjects = corpus.pages.filter((page: any) => /^\/projects\/[a-z0-9-]+\/$/.test(page.path));
  assert.deepEqual(payload.projects.map((project: any) => project.url).sort(), publishedProjects.map((page: any) => page.url).sort(), 'every canonical published project, with no redirect or draft');
  const shards = await readdir('dist/ai/projects');
  const crawler = await readFile('dist/wallcovering-installation-ai-crawler/index.html', 'utf8');
  assert.deepEqual(shards.sort(), payload.projects.map((project: any) => `${project.slug}.json`).sort());
  let films = 0;
  let captions = 0;
  let extraSections = 0;
  for (const project of payload.projects) {
    const record = corpus.pages.find((page: any) => page.url === project.url);
    assert.ok(record, `${project.slug}: published canonical page required`);
    assert.deepEqual(project.pageContent, record, `${project.slug}: same complete semantic record as page corpus`);
    assert.deepEqual(project.formats, { html: project.url, markdown: `${project.url}index.md`, json: `${SITE}/ai/projects/${project.slug}.json` });
    assert.equal(project.published, record.dates.published);
    assert.equal(project.updated, record.dates.modified);
    const html = await readFile(`dist${record.path}index.html`, 'utf8');
    const head = html.match(/<head>([\s\S]*?)<\/head>/)![1];
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)![1];
    assert.ok(head.includes(`<link rel="alternate" type="application/json" href="${project.formats.json}"`), `${project.slug}: complete JSON alternate in head`);
    assert.equal(main.includes('<link rel="alternate" type="application/json"'), false, 'metadata remains in head');
    assert.ok(crawler.includes(`href="/ai/projects/${project.slug}.json"`), `${project.slug}: crawler links to its individual record`);
    const page = await readPage(`dist${record.path}index.html`);
    assert.ok(page);
    assert.equal(project.pageContent.markdown, toMarkdown(page.main, { base: page.canonical }));
    const twin = await readFile(`dist${record.path}index.md`, 'utf8');
    assert.equal(project.pageContent.markdown, twin.replace(/^---\n[\s\S]*?\n---\n\n/, ''));
    for (const name of ['headings', 'links', 'images', 'diagrams', 'media', 'structuredData']) assert.deepEqual(project.pageContent[name], page[name], `${project.slug}: complete ${name}`);
    // Compare the standard public box, rather than assuming frontmatter contains its fuller fields.
    const box = html.match(/<section class="glance-box"[^>]*data-glance[^>]*>([\s\S]*?)<\/section>/)![1];
    const rows = [...box.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map((match) => ({
      label: visible(match[1]),
      value: visible(match[2].replace(/<span aria-hidden="true">–<\/span><span class="sr-only">Not recorded<\/span>/, '')) || null,
    }));
    assert.deepEqual(project.standardGlance, rows, `${project.slug}: public glance parity`);
    for (const section of record.headings) {
      assert.ok(record.markdown.includes(`${'#'.repeat(section.level)} ${section.text}`), `${project.slug}: ${section.text}`);
      if (!project.installationRecord.sections.some((excerpt: any) => excerpt.heading === section.text)) extraSections += 1;
    }
    const markdown = unescapeMarkdown(record.markdown);
    for (const image of record.images) {
      assert.ok(markdown.includes(image.alt));
      if (image.caption) { assert.ok(markdown.includes(image.caption), `${project.slug}: image caption/credit`); captions += 1; }
    }
    for (const media of record.media) {
      films += 1;
      for (const url of media.urls) assert.ok(markdown.includes(url));
      if (media.description) assert.ok(markdown.includes(media.description));
      if (media.caption) assert.ok(markdown.includes(media.caption), `${project.slug}: film caption`);
    }
    for (const diagram of record.diagrams) assert.ok(markdown.includes(diagram.description));
    const shard = await json(`dist/ai/projects/${project.slug}.json`);
    assert.equal(shard.schemaVersion, payload.schemaVersion);
    assert.equal(shard.url, project.formats.json);
    assert.equal(shard.sourceUrl, project.url);
    assert.deepEqual(shard.project, project);
    assert.deepEqual(shard.fieldNotes, payload.fieldNotes);
  }
  assert.ok(extraSections > 100, 'page detail includes all public sections outside the old selected installation excerpts');
  assert.ok(films >= 3, 'on-site films retain links and captions');
  assert.ok(captions > 10, 'photograph credits are preserved');
});

test('Hyde dates and Solar Screen, Silverstone year, and contextual sections are recoverable without fetching a second resource', async () => {
  const { projects } = await json('dist/ai/projects.json');
  const hyde = projects.find((project: any) => project.slug === 'old-bailey-hotel');
  assert.equal(hyde.projectDates, '2022–2024 (about two years on site; opened 2 September 2024)');
  assert.ok(hyde.materials.includes('Solar Screen window film'));
  for (const heading of ['The building', 'The design', 'Materials', 'Notes and sources']) assert.ok(hyde.pageContent.headings.some((item: any) => item.text === heading));
  const silverstone = projects.find((project: any) => project.slug === 'hilton-garden-inn-silverstone');
  assert.equal(silverstone.projectDates, '2022 (completed in time for the British Grand Prix)');
  const brown = projects.find((project: any) => project.slug === 'browns-hotel-mayfair');
  assert.equal(brown.pageContent.media.filter((media: any) => media.type === 'video').length, 3);
  const event = projects.find((project: any) => project.slug === 'calico-ahluwalia-estuary-rosewood');
  assert.ok(event.pageContent.markdown.includes('We did not hang them at the hotel.'));
  const repairs = projects.find((project: any) => project.slug === 'imperfect-arches-external-corner-trim');
  assert.ok(repairs.pageContent.headings.some((item: any) => item.text === 'When this detail is worth specifying'));
});

test('project enrichment is idempotent and fails on missing, excluded, duplicate or noncanonical project pages', async () => {
  const payload = await json('dist/ai/projects.json');
  const { pages } = await json('dist/ai/pages.json');
  assert.deepEqual(enrichProjects(payload, pages), payload);
  const first = payload.projects[0];
  assert.throws(() => enrichProjects(payload, pages.filter((page: any) => page.url !== first.url)), /requires its published, indexable canonical page/);
  assert.throws(() => enrichProjects({ ...payload, projects: [...payload.projects, first] }, pages), /duplicate project JSON slug/);
  assert.throws(() => enrichProjects({ ...payload, projects: [{ ...first, url: `${SITE}/projects/retired-url/` }] }, pages), /requires its published, indexable canonical page/);
  assert.throws(() => enrichProjects({ ...payload, projects: [{ ...first, slug: '../draft' }] }, pages), /invalid project JSON slug/);
});

test('full project records and individual exports exclude drafts, redirects, private payloads and telephone data', async () => {
  const payload = await json('dist/ai/projects.json');
  for (const project of payload.projects) {
    assert.equal(project.installationRecord.basis, 'Company-reported project record');
    const shard = await readFile(`dist/ai/projects/${project.slug}.json`, 'utf8');
    assert.doesNotMatch(shard, /"(?:phone|telephone|faxNumber|apiKey|token|_note|manifestNote|placeholder)"\s*:/i);
    assert.doesNotMatch(shard, /\/Users\/|localhost|SITE_PHONE|data:image|data-endpoint|data-phone-reveal|const payload|_honey|<script\b|\btel:/);
    assert.doesNotMatch(shard, /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|\b020\s?\d{4}\s?\d{4}\b/);
  }
  const slugs = payload.projects.map((project: any) => project.slug);
  assert.equal(slugs.includes('owo-whitehall'), false, 'redirect alias is excluded');
  for (const file of await readdir('src/content/case-studies')) {
    if (!file.endsWith('.md')) continue;
    const source = await readFile(`src/content/case-studies/${file}`, 'utf8');
    const data = JSON.parse(source.match(/^---\n([\s\S]*?)\n---\n/)![1]);
    if (data.draft) assert.equal(slugs.includes(data.slug), false, `${data.slug}: draft is excluded`);
  }
});
