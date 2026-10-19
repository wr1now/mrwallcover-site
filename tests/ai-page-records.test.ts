import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { build, pageRecordPath, readPage, toMarkdown } from '../scripts/build-ai-layer.mjs';

const SITE = 'https://www.mrwallcover.com';
const json = async (file: string): Promise<any> => JSON.parse(await readFile(file, 'utf8'));
async function filesUnder(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(file));
    else files.push(file);
  }
  return files.sort();
}

test('every published canonical page has a bounded JSON record equal to its corpus entry and advertised in its HTML head', async () => {
  const corpus = await json('dist/ai/pages.json');
  const manifest = await json('dist/ai/index.json');
  assert.equal(corpus.schemaVersion, '1.0', 'the additive format preserves the corpus schema');
  const published = (await Promise.all((await filesUnder('dist')).filter(file => file.endsWith('.html')).map(file => readPage(file)))).filter(Boolean);
  assert.deepEqual(corpus.pages.map((record: any) => record.url).sort(), published.map(page => page.canonical).sort(), 'every built published canonical page is included');
  const expectedFiles: string[] = [];
  for (const [index, record] of corpus.pages.entries()) {
    const address = `${SITE}/ai/pages${record.path}index.json`;
    const file = path.join('dist', new URL(address).pathname);
    expectedFiles.push(file);
    assert.equal(record.formats.json, address);
    assert.equal(record.formats.corpus, `${SITE}/ai/pages.json#/pages/${index}`, 'legacy aggregate pointer remains usable');
    const shard = await json(file);
    assert.deepEqual(shard, record, `${record.path}: the individual response contains the complete record`);
    assert.deepEqual(manifest.pages[index].formats, record.formats);
    const html = await readFile(`dist${record.path}index.html`, 'utf8');
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/)![1];
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)![1];
    const alternates = [...head.matchAll(/<link\b[^>]*>/g)].filter(([tag]) => tag.includes('data-ai-page-record'));
    assert.equal(alternates.length, 1, `${record.path}: one generated discovery link`);
    assert.ok(alternates[0][0].includes(`rel="alternate" type="application/json" href="${address}"`));
    assert.doesNotMatch(main, /data-ai-page-record/, 'discovery stays in the head');
    assert.equal(shard.markdown, toMarkdown(main, { base: record.url }));
    const twin = await readFile(`dist${record.path}index.md`, 'utf8');
    assert.equal(shard.markdown, twin.replace(/^---\n[\s\S]*?\n---\n\n/, ''));
    const source = await readPage(`dist${record.path}index.html`);
    assert.ok(source);
    assert.equal(shard.url, source.canonical);
    assert.deepEqual(shard.dates, source.dates, 'source dates are retained without stamping build time');
    for (const key of ['headings', 'links', 'images', 'diagrams', 'media', 'structuredData']) {
      assert.deepEqual(shard[key], source[key], `${record.path}: all ${key} survive`);
    }
    for (const link of shard.links) assert.match(link.url, /^(https?:|mailto:)/);
    assert.doesNotMatch(JSON.stringify(shard), /"(?:phone|telephone|faxNumber|apiKey|token|_note|manifestNote|placeholder)"\s*:/i);
    assert.doesNotMatch(JSON.stringify(shard), /\/Users\/|localhost|SITE_PHONE|data-endpoint|data-phone-reveal|const payload|_honey|<script\b|\btel:/);
  }
  assert.deepEqual(await filesUnder('dist/ai/pages'), expectedFiles.sort(), 'no extra or stale individual records');
  const projectPayload = await json('dist/ai/projects.json');
  for (const project of projectPayload.projects) {
    const html = await readFile(`dist/projects/${project.slug}/index.html`, 'utf8');
    const projectAlternates = [...html.matchAll(/<link\b[^>]*>/g)].filter(([tag]) => tag.includes('type="application/json"') && tag.includes(`href="${project.formats.json}"`));
    assert.equal(projectAlternates.length, 1, `${project.slug}: existing complete project alternate is preserved once`);
    assert.deepEqual(project.pageContent, corpus.pages.find((record: any) => record.url === project.url));
  }
});

test('record paths reject ambiguous, noncanonical or traversing input instead of normalising it', () => {
  assert.equal(pageRecordPath('/'), '/ai/pages/index.json');
  assert.equal(pageRecordPath('/about/'), '/ai/pages/about/index.json');
  assert.equal(pageRecordPath('/advice/wall-preparation/'), '/ai/pages/advice/wall-preparation/index.json');
  for (const input of ['', 'about/', '/about', '//about/', '/about//', '/About/', '/about/../private/', '/./', '/../', '/%2e%2e/', '/%252e%252e/', '/about\\private/', '/about/?key=value', '/about/#fragment', '/about/index.json', 'https://www.mrwallcover.com/about/', null, undefined]) {
    assert.throws(() => pageRecordPath(input), /invalid canonical page path/, String(input));
  }
});

test('postbuild removes stale generated page records, keeps excluded pages untouched and is byte-idempotent', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mw-ai-page-records-'));
  const canonicalPaths = ['/', '/projects/example/', ...Array.from({ length: 48 }, (_, i) => `/fixture-${i}/`)];
  const excluded: Record<string, string> = {};
  const htmlFor = (pathname: string, extraHead = '') => `<!doctype html><html lang="en-GB"><head><title>Public fixture</title><meta name="description" content="Published fixture"><meta name="author" content="Site owner"><link rel="canonical" href="${SITE}${pathname}">${extraHead}</head><body><main id="main"><h1>Public fixture</h1><p>Published explanatory text.</p><time datetime="2024-10-10" data-page-updated="reviewed">10 October 2024</time><input value="PRIVATE_INPUT_MARKER"><script>const payload = 'PRIVATE_SCRIPT_MARKER';</script><a href="tel:PRIVATE_PHONE_MARKER">PRIVATE_PHONE_MARKER</a></main></body></html>`;
  const put = async (file: string, body: string) => { await mkdir(path.dirname(path.join(dir, file)), { recursive: true }); await writeFile(path.join(dir, file), body); };
  try {
    for (const pathname of canonicalPaths) await put(`${pathname}index.html`, htmlFor(pathname, pathname === '/projects/example/' ? `<link rel="alternate" type="application/json" href="${SITE}/ai/projects/example.json" title="Complete project record as JSON">` : ''));
    excluded['/preview/'] = htmlFor('/preview/', '<meta content="noindex, follow" name="robots">');
    excluded['/retired/'] = htmlFor('/retired/', '<meta content="0; url=/projects/example/" http-equiv="refresh">');
    for (const [pathname, html] of Object.entries(excluded)) await put(`${pathname}index.html`, html);
    await put('ai/projects.json', JSON.stringify({ schemaVersion: '1.2', projects: [{ slug: 'example', url: `${SITE}/projects/example/` }] }));
    await put('sitemap-index.xml', '<?xml version="1.0"?><sitemapindex/>');
    await put('ai/keep.json', '{"untouched":true}\n');
    await put('ai/pages/stale/index.json', '{"stale":true}\n');
    await put('ai/pages/preview/index.json', '{"staleExcluded":true}\n');
    const result = await build(dir);
    assert.deepEqual(result, { pages: canonicalPaths.length, twins: canonicalPaths.length });
    assert.equal(await readFile(path.join(dir, 'ai/keep.json'), 'utf8'), '{"untouched":true}\n', 'cleanup is limited to generated page records');
    const files = await filesUnder(path.join(dir, 'ai/pages'));
    assert.equal(files.length, canonicalPaths.length);
    assert.equal(files.some(file => /\/(?:stale|preview|retired)\//.test(file)), false);
    for (const [pathname, html] of Object.entries(excluded)) {
      assert.equal(await readFile(path.join(dir, pathname, 'index.html'), 'utf8'), html, `${pathname}: excluded HTML is unchanged`);
      await assert.rejects(readFile(path.join(dir, pathname, 'index.md')));
    }
    for (const file of files) {
      const raw = await readFile(file, 'utf8');
      assert.doesNotMatch(raw, /PRIVATE_INPUT_MARKER|PRIVATE_SCRIPT_MARKER|PRIVATE_PHONE_MARKER/);
      assert.deepEqual(JSON.parse(raw).dates, { published: null, modified: null, reviewed: '2024-10-10' });
    }
    const snapshot = async () => Object.fromEntries(await Promise.all((await filesUnder(dir)).map(async file => [path.relative(dir, file), await readFile(file, 'utf8')])));
    const first = await snapshot();
    await build(dir);
    assert.deepEqual(await snapshot(), first, 'repeated postbuild has identical HTML, JSON, Markdown and aggregate output');
    const projectHead = (await readFile(path.join(dir, 'projects/example/index.html'), 'utf8')).match(/<head>([\s\S]*?)<\/head>/)![1];
    assert.equal((projectHead.match(/data-ai-page-record/g) ?? []).length, 1);
    assert.equal((projectHead.match(/\/ai\/projects\/example\.json/g) ?? []).length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
