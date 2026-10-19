import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildReaderMirror, expectedReaderMirrorFiles, verifyReaderMirror } from '../scripts/ai-reader-mirror.mjs';

const SITE = 'https://www.mrwallcover.com';
const config = { repositoryUrl: 'https://github.com/wr1now/mrwallcover-site', rawBaseUrl: 'https://raw.githubusercontent.com/wr1now/mrwallcover-site/main/ai-reference/' };
const pretty = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const json = async (file: string) => JSON.parse(await readFile(file, 'utf8'));
const put = async (file: string, text: string) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, text); };

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'mw-reader-mirror-'));
  const distDir = path.join(dir, 'dist-fixture');
  const outputDir = path.join(dir, 'mirror-fixture');
  const projectPath = '/projects/public-work/';
  const bodies = [
    '# Public home\n\nThe house practice and a reviewed enquiry.\n',
    '# Public project\n\n## Entire published story\n\nExact public wording beyond the summary.\n\n[Photograph: installed linen. Credit: recorded photographer](https://www.mrwallcover.com/media/public.jpg)\n\n[Film: site work](https://www.mrwallcover.com/media/public.mp4)\n\n[Source](https://example.com/public-context) provides venue context, not independent installation verification.\n',
  ];
  const pages = ['/', projectPath].map((pathname, index) => ({
    id: `${SITE}${pathname}`, url: `${SITE}${pathname}`, path: pathname,
    title: index ? 'Public project [fixture]' : 'Public home', description: 'Published fixture wording.', language: 'en-GB', author: 'Published author',
    dates: { published: '2026-10-01', modified: '2026-10-09', reviewed: null },
    formats: { html: `${SITE}${pathname}`, markdown: `${SITE}${pathname}index.md`, json: `${SITE}/ai/pages${pathname}index.json`, corpus: `${SITE}/ai/pages.json#/pages/${index}` },
  }));
  const records = pages.map((page, index) => ({ ...page, markdown: bodies[index], headings: [{ level: 1, text: index ? 'Public project' : 'Public home', id: null }],
    links: [{ url: 'https://example.com/public-context', text: 'Source' }],
    images: index ? [{ url: `${SITE}/media/public.jpg`, alt: 'installed linen', caption: 'Credit: recorded photographer' }] : [],
    diagrams: index ? [{ description: 'Measured junction drawing, illustrative', caption: 'Illustrative, not project evidence' }] : [],
    media: index ? [{ type: 'video', urls: [`${SITE}/media/public.mp4`], caption: 'Site work' }] : [],
    structuredData: [{ '@type': 'Article', datePublished: page.dates.published, dateModified: page.dates.modified }],
  }));
  const metadata = { schemaVersion: '1.0', source: SITE, pageCount: pages.length };
  await put(path.join(distDir, 'ai/index.json'), pretty({ ...metadata, pages }));
  await put(path.join(distDir, 'ai/pages.json'), pretty({ ...metadata, pages: records }));
  for (const [index, page] of pages.entries()) {
    await put(path.join(distDir, `ai/pages${page.path}index.json`), pretty(records[index]));
    await put(path.join(distDir, page.path, 'index.md'), `---\ntitle: ${JSON.stringify(page.title)}\nurl: ${page.url}\nlast_updated: 2026-10-09\n---\n\n${bodies[index]}`);
    await put(path.join(distDir, page.path, 'index.html'), `<html><head><link rel="canonical" href="${page.url}"><meta name="robots" content="index, follow"></head><body><main id="main"><h1>Public fixture</h1></main><script>const payload = "PRIVATE-HTML-PAYLOAD";</script></body></html>`);
  }
  await put(path.join(distDir, 'private-source.json'), pretty({ _note: 'PRIVATE-SOURCE-NOTE', telephone: '07700900000' }));
  await put(path.join(distDir, 'hidden/index.html'), '<meta name="robots" content="noindex"><main>PRIVATE-NOINDEX-CONTENT</main>');
  for (const topic of ['business', 'decision-guide', 'wallpapering', 'fire-ratings']) {
    await put(path.join(distDir, `ai/${topic}.json`), pretty({ schemaVersion: '1.0', url: `${SITE}/ai/${topic}.json`, sourceUrl: `${SITE}/`,
      resourceReviewed: '2026-10-09', notes: ['Public source/evidence limitation stays.'], fieldNotes: { scope: 'General guidance, not technical approval.' },
      _note: 'PRIVATE-PROJECTION-NOTE', nested: { telephone: '07700900000', token: 'PRIVATE-TOKEN', notes: ['Public note'] } }));
  }
  const project = { schemaVersion: '1.2', url: `${SITE}/ai/projects/public-work.json`, sourceUrl: pages[1].url,
    resourceReviewed: '2026-10-09', fieldNotes: { references: 'Venue context is not independent confirmation.' },
    project: { slug: 'public-work', url: pages[1].url, projectDates: '2022–2024 (published exact wording)', materials: ['Recorded linen'],
      standardGlance: [{ label: 'Client', value: null }], installationRecord: { basis: 'Company-reported project record', sections: [] },
      formats: { html: pages[1].url, markdown: pages[1].formats.markdown, json: `${SITE}/ai/projects/public-work.json` }, pageContent: records[1] },
  };
  await put(path.join(distDir, 'ai/projects/public-work.json'), pretty(project));
  return { dir, distDir, outputDir, pages, records, project, options: { distDir, outputDir, production: true, config } };
}

test('reader fallback fixture preserves every canonical Markdown byte, full project semantics, public dates and raw selective links', async () => {
  const f = await fixture();
  try {
    const files = await expectedReaderMirrorFiles({ distDir: f.distDir, config });
    assert.equal(files.size, 11, 'two Markdown pages, two full page JSON records, four topic records, one full project record, README and index');
    for (const [i, page] of f.pages.entries()) {
      assert.equal(files.get(`pages${page.path}index.md`), await readFile(path.join(f.distDir, page.path, 'index.md'), 'utf8'));
      assert.deepEqual(JSON.parse(files.get(`ai/pages${page.path}index.json`)!), f.records[i], 'complete bare page record retains all public semantics, not only Markdown');
    }
    const index = JSON.parse(files.get('index.json')!);
    assert.equal(index.pageCount, 2);
    assert.equal(index.projectCount, 1);
    assert.deepEqual(index.pages.map((page: any) => page.dates), f.pages.map((page) => page.dates));
    assert.equal(index.pages[0].markdownUrl, `${config.rawBaseUrl}pages/index.md`);
    assert.equal(index.pages[1].markdownUrl, `${config.rawBaseUrl}pages/projects/public-work/index.md`);
    assert.equal(index.pages[0].jsonUrl, `${config.rawBaseUrl}ai/pages/index.json`);
    assert.equal(index.pages[1].jsonUrl, `${config.rawBaseUrl}ai/pages/projects/public-work/index.json`);
    assert.equal(index.pages[1].canonicalJsonUrl, `${SITE}/ai/pages/projects/public-work/index.json`);
    assert.equal(index.projects[0].jsonUrl, `${config.rawBaseUrl}ai/projects/public-work.json`);
    for (const page of index.pages) {
      assert.ok(files.get('README.md')!.includes(page.markdownUrl));
      assert.ok(files.get('README.md')!.includes(page.jsonUrl));
      assert.ok(files.get('README.md')!.includes(page.sourceUrl));
    }
    const project = JSON.parse(files.get('ai/projects/public-work.json')!);
    assert.deepEqual(project, f.project, 'complete project wrapper, dates, credits, film references, diagrams, notes and structured data survive');
    assert.match(files.get('README.md')!, /company-reported/);
    assert.match(files.get('README.md')!, /does not create a new content review/);
    assert.match(files.get('README.md')!, /noindex pages, redirect aliases/);
    await buildReaderMirror(f.options);
    assert.deepEqual(await verifyReaderMirror({ distDir: f.distDir, outputDir: f.outputDir, config }), { files: 11, pages: 2 });
    assert.deepEqual(await expectedReaderMirrorFiles({ distDir: f.distDir, config }), files, 'generation uses no build-time timestamp');
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('reader fallback fixture omits private projection fields and unrelated files while preserving published notes and evidence limits', async () => {
  const f = await fixture();
  try {
    const files = await expectedReaderMirrorFiles({ distDir: f.distDir, config });
    for (const [name, text] of files) assert.doesNotMatch(text, /PRIVATE-|07700900000|"(?:telephone|token|_note)"\s*:/, name);
    assert.equal([...files.keys()].some((name) => /hidden|private-source|facts\.json/.test(name)), false);
    const business = JSON.parse(files.get('ai/business.json')!);
    assert.deepEqual(business.notes, ['Public source/evidence limitation stays.']);
    assert.deepEqual(business.nested, { notes: ['Public note'] });
    assert.equal(business.resourceReviewed, '2026-10-09');
    assert.deepEqual(business.fieldNotes, { scope: 'General guidance, not technical approval.' });
    assert.ok(!files.get('README.md')!.includes('Private fixture'));
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('reader fallback fixture rejects inconsistent, excluded, duplicate and unsafe canonical records before replacing an existing mirror', async () => {
  const f = await fixture();
  try {
    await buildReaderMirror(f.options);
    const original = await readFile(path.join(f.outputDir, 'index.json'), 'utf8');
    const manifestFile = path.join(f.distDir, 'ai/index.json');
    const manifest = await json(manifestFile);
    await writeFile(manifestFile, pretty({ ...manifest, pages: [...manifest.pages, manifest.pages[0]], pageCount: 3 }));
    await assert.rejects(buildReaderMirror(f.options), /complete canonical production manifest/);
    await writeFile(manifestFile, pretty({ ...manifest, pages: [manifest.pages[0], manifest.pages[0]] }));
    await assert.rejects(buildReaderMirror(f.options), /duplicate canonical/);
    await writeFile(manifestFile, pretty({ ...manifest, pages: [{ ...manifest.pages[0], path: '/../private/' }, manifest.pages[1]] }));
    await assert.rejects(buildReaderMirror(f.options), /safe canonical page path/);
    await writeFile(manifestFile, pretty(manifest));
    const htmlFile = path.join(f.distDir, 'index.html');
    const html = await readFile(htmlFile, 'utf8');
    await writeFile(htmlFile, html.replace('index, follow', 'noindex, follow'));
    await assert.rejects(buildReaderMirror(f.options), /excluded\/noindex\/redirect/);
    await writeFile(htmlFile, html.replace('<meta name="robots" content="index, follow">', '<meta http-equiv="refresh" content="0;url=/">'));
    await assert.rejects(buildReaderMirror(f.options), /excluded\/noindex\/redirect/);
    await writeFile(htmlFile, html.replace(`href="${SITE}/"`, `href="${SITE}/alias/"`));
    await assert.rejects(buildReaderMirror(f.options), /not its canonical source/);
    assert.equal(await readFile(path.join(f.outputDir, 'index.json'), 'utf8'), original, 'validation failure preserves the existing mirror');
    assert.equal((await readdir(f.dir)).some((name) => name.startsWith('.ai-reference-build-')), false, 'failed validation does not leave a replacement tree');
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('reader fallback fixture rejects lost Markdown, stale dates, incomplete page/project JSON and sources outside the indexable corpus', async () => {
  const f = await fixture();
  try {
    const twinFile = path.join(f.distDir, 'projects/public-work/index.md');
    const twin = await readFile(twinFile, 'utf8');
    await writeFile(twinFile, twin.replace('Exact public wording beyond the summary.', 'Shortened summary.'));
    await assert.rejects(expectedReaderMirrorFiles({ distDir: f.distDir, config }), /entire published body/);
    await writeFile(twinFile, twin.replace('last_updated: 2026-10-09', 'last_updated: 2099-01-01'));
    await assert.rejects(expectedReaderMirrorFiles({ distDir: f.distDir, config }), /source dates disagree/);
    await writeFile(twinFile, twin);
    const pageJsonFile = path.join(f.distDir, 'ai/pages/projects/public-work/index.json');
    const pageJson = await readFile(pageJsonFile, 'utf8');
    await rm(pageJsonFile);
    await assert.rejects(expectedReaderMirrorFiles({ distDir: f.distDir, config }), /ENOENT/);
    await writeFile(pageJsonFile, pretty({ ...f.records[1], media: [], structuredData: [] }));
    await assert.rejects(expectedReaderMirrorFiles({ distDir: f.distDir, config }), /complete bare page JSON must agree/);
    await writeFile(pageJsonFile, pageJson);
    const shardFile = path.join(f.distDir, 'ai/projects/public-work.json');
    await rm(shardFile);
    await assert.rejects(expectedReaderMirrorFiles({ distDir: f.distDir, config }), /shards do not exactly match/);
    await writeFile(shardFile, pretty({ ...f.project, project: { ...f.project.project, pageContent: { ...f.records[1], markdown: 'Summary only.' } } }));
    await assert.rejects(expectedReaderMirrorFiles({ distDir: f.distDir, config }), /complete project JSON must agree/);
    await writeFile(shardFile, pretty(f.project));
    const topicFile = path.join(f.distDir, 'ai/business.json');
    await writeFile(topicFile, pretty({ ...await json(topicFile), sourceUrl: `${SITE}/hidden/` }));
    await assert.rejects(expectedReaderMirrorFiles({ distDir: f.distDir, config }), /source is not an indexable canonical page/);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('reader fallback fixture refuses exported phone/payload content rather than overwriting the safe fallback', async () => {
  const f = await fixture();
  try {
    await buildReaderMirror(f.options);
    const before = await readFile(path.join(f.outputDir, 'ai/business.json'), 'utf8');
    const topicFile = path.join(f.distDir, 'ai/business.json');
    const business = await json(topicFile);
    for (const unsafe of ['07700900000', '<script>const payload = "secret";</script>', '/Users/private/source.json']) {
      await writeFile(topicFile, pretty({ ...business, description: unsafe }));
      await assert.rejects(buildReaderMirror(f.options), /private\/contact payload/);
      assert.equal(await readFile(path.join(f.outputDir, 'ai/business.json'), 'utf8'), before);
    }
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('reader fallback fixture detects missing, changed and extra files, and regeneration removes stale records', async () => {
  const f = await fixture();
  try {
    await buildReaderMirror(f.options);
    await rm(path.join(f.outputDir, 'pages/index.md'));
    await assert.rejects(verifyReaderMirror({ distDir: f.distDir, outputDir: f.outputDir, config }), /1 missing, 0 extra, 0 changed/);
    await buildReaderMirror(f.options);
    await writeFile(path.join(f.outputDir, 'README.md'), 'Stale content.');
    await assert.rejects(verifyReaderMirror({ distDir: f.distDir, outputDir: f.outputDir, config }), /0 missing, 0 extra, 1 changed/);
    await put(path.join(f.outputDir, 'pages/retired/index.md'), 'Removed page.');
    await assert.rejects(verifyReaderMirror({ distDir: f.distDir, outputDir: f.outputDir, config }), /0 missing, 1 extra, 1 changed/);
    await buildReaderMirror(f.options);
    await verifyReaderMirror({ distDir: f.distDir, outputDir: f.outputDir, config });
    await assert.rejects(access(path.join(f.outputDir, 'pages/retired/index.md')), /ENOENT/);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('reader fallback fixture production guards exclude preview, phone and outDir builds from tracked output', async () => {
  const f = await fixture();
  const preview = process.env.MW_CONTENT_PREVIEW;
  try {
    assert.equal((await buildReaderMirror({ distDir: f.distDir, config })).skipped, true, 'default is never opt-in');
    assert.equal((await buildReaderMirror({ distDir: f.distDir, production: true, config })).skipped, true, 'phone/temp outDir never targets tracked output');
    assert.equal((await buildReaderMirror({ distDir: path.resolve('dist-review'), production: true, config })).skipped, true, 'review directory never targets tracked output');
    process.env.MW_CONTENT_PREVIEW = '1';
    assert.equal((await buildReaderMirror(f.options)).skipped, true, 'preview does not write even an explicit output directory');
    await assert.rejects(access(f.outputDir), /ENOENT/);
    if (preview === undefined) delete process.env.MW_CONTENT_PREVIEW;
    else process.env.MW_CONTENT_PREVIEW = preview;
    await assert.rejects(buildReaderMirror({ distDir: f.distDir, outputDir: path.resolve('scripts'), production: true, config }), /outside the website repository/);
  } finally {
    if (preview === undefined) delete process.env.MW_CONTENT_PREVIEW;
    else process.env.MW_CONTENT_PREVIEW = preview;
    await rm(f.dir, { recursive: true, force: true });
  }
});

test('tracked reader fallback exactly matches the current production exports and is staged or committed in full', async () => {
  const result = await verifyReaderMirror();
  const manifest = await json('dist/ai/index.json');
  assert.equal(result.pages, manifest.pageCount);
  assert.ok(result.pages > 50, 'real public page corpus, never a fixture');
  const index = await json('ai-reference/index.json');
  for (const page of manifest.pages) assert.deepEqual(
    await json(`ai-reference/ai/pages${page.path}index.json`), await json(`dist/ai/pages${page.path}index.json`),
    `${page.path}: every complete sanitized public record has a fallback with identical semantics`,
  );
  assert.equal(index.projectCount, manifest.pages.filter((page: any) => /^\/projects\/[a-z0-9-]+\/$/.test(page.path)).length);
});
