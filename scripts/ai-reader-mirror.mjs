/**
 * A versioned fallback for readers that cannot fetch the canonical website.
 * Inputs are the sanitized production exports, never the content/research archive.
 * This module does not run on import. See buildReaderMirror's production guards.
 */
import { execFile } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTION_DIST = path.join(ROOT, 'dist');
export const READER_MIRROR_DIR = path.join(ROOT, 'ai-reference');
const SITE = 'https://www.mrwallcover.com';
const TOPICS = ['business', 'decision-guide', 'wallpapering', 'fire-ratings'];
const PRIVATE_KEY = /^_|^(?:phone|telephone|faxNumber|apiKey|token|accessToken|staffToken|password|secret|manifestNote|placeholder|submissionEndpoint)$/i;
const PRIVATE_TEXT = /\/Users\/|(?:^|\s)\/home\/|[A-Z]:\\Users\\|SITE_PHONE|data:image|data-phone-reveal|data-endpoint|const payload\s*=|<script\b|\btel:|https?:\/\/wa\.me\//i;
const PHONE = /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}\b|\b020\s?\d{4}\s?\d{4}\b/;
const stringify = (value) => `${JSON.stringify(value, null, 2)}\n`;
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/** Preserve public notes, evidence limits, credits and dates; omit payload fields. */
function cleanJson(value) {
  if (Array.isArray(value)) return value.map(cleanJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !PRIVATE_KEY.test(key))
    .map(([key, item]) => [key, cleanJson(item)]));
  return value;
}

function assertPublicText(text, name) {
  if (PRIVATE_TEXT.test(text) || PHONE.test(text)) throw new Error(`${name}: private/contact payload is not allowed in the reader fallback`);
}

function pagePath(page) {
  if (!page || typeof page.path !== 'string' || !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/.test(page.path)) {
    throw new Error('reader fallback requires a safe canonical page path');
  }
  const canonical = `${SITE}${page.path}`;
  if (page.url !== canonical || page.id !== canonical || page.formats?.html !== canonical || page.formats?.markdown !== `${canonical}index.md`
    || page.formats?.json !== `${SITE}/ai/pages${page.path}index.json`) {
    throw new Error(`${page.path}: reader fallback requires the exact canonical public formats`);
  }
  return canonical;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

async function assertIndexable(distDir, page) {
  const html = await readFile(path.join(distDir, page.path, 'index.html'), 'utf8');
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => tag);
  if (metas.some((tag) => (attribute(tag, 'name')?.toLowerCase() === 'robots' && /\bnoindex\b/i.test(attribute(tag, 'content') ?? ''))
    || attribute(tag, 'http-equiv')?.toLowerCase() === 'refresh')) {
    throw new Error(`${page.path}: excluded/noindex/redirect pages cannot enter the reader fallback`);
  }
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => tag)
    .find((tag) => attribute(tag, 'rel')?.split(/\s+/).includes('canonical'));
  if (attribute(canonicalTag ?? '', 'href') !== page.url) throw new Error(`${page.path}: built HTML is not its canonical source`);
}

async function readerConfig(override) {
  const config = override ?? await json(path.join(ROOT, 'src', 'data', 'ai-reader.json'));
  let repository;
  let raw;
  try { repository = new URL(config.repositoryUrl); raw = new URL(config.rawBaseUrl); } catch { throw new Error('invalid reader fallback public URL configuration'); }
  if (repository.origin !== 'https://github.com' || !/^\/[^/]+\/[^/]+$/.test(repository.pathname)
    || raw.origin !== 'https://raw.githubusercontent.com' || raw.pathname !== `${repository.pathname}/main/ai-reference/`
    || repository.search || repository.hash || raw.search || raw.hash || repository.username || raw.username) {
    throw new Error('reader fallback raw URL must identify the same public repository and main/ai-reference/');
  }
  return config;
}

function sourcePage(url, pagesByUrl, label) {
  let source;
  try { source = new URL(url); } catch { throw new Error(`${label}: missing canonical source URL`); }
  source.hash = '';
  if (!pagesByUrl.has(source.href)) throw new Error(`${label}: source is not an indexable canonical page`);
}

/**
 * Compute every expected file before touching an existing mirror. The manifest,
 * corpus, canonical HTML, Markdown twins, bare page JSON and project records agree.
 * The optional config override is for isolated fixtures; production uses the shared
 * public src/data/ai-reader.json configuration.
 */
export async function expectedReaderMirrorFiles({ distDir = PRODUCTION_DIST, config } = {}) {
  distDir = path.resolve(distDir);
  const { repositoryUrl, rawBaseUrl } = await readerConfig(config);
  const manifest = await json(path.join(distDir, 'ai', 'index.json'));
  const corpus = await json(path.join(distDir, 'ai', 'pages.json'));
  if (manifest.source !== SITE || corpus.source !== SITE || !Array.isArray(manifest.pages) || !manifest.pages.length
    || manifest.pageCount !== manifest.pages.length || corpus.pageCount !== manifest.pageCount || !Array.isArray(corpus.pages)
    || corpus.pages.length !== manifest.pageCount) throw new Error('reader fallback requires a complete canonical production manifest and corpus');
  const records = new Map(corpus.pages.map((page) => [page.url, page]));
  if (records.size !== corpus.pages.length || new Set(manifest.pages.map((page) => page.url)).size !== manifest.pages.length) {
    throw new Error('reader fallback has duplicate canonical page records');
  }
  const files = new Map();
  const pages = [];
  for (const page of manifest.pages) {
    pagePath(page);
    const record = records.get(page.url);
    pagePath(record);
    for (const [key, value] of Object.entries(page)) {
      if (!equal(value, record[key])) throw new Error(`${page.path}: manifest/corpus ${key} differs`);
    }
    if (typeof record.markdown !== 'string' || !record.markdown.trim()) throw new Error(`${page.path}: complete published Markdown is required`);
    await assertIndexable(distDir, page);
    const markdown = await readFile(path.join(distDir, page.path, 'index.md'), 'utf8');
    const twin = markdown.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
    if (!twin || !twin[1].split('\n').includes(`url: ${page.url}`) || twin[2] !== record.markdown) {
      throw new Error(`${page.path}: Markdown twin must preserve its canonical source and entire published body`);
    }
    for (const [field, date] of [['last_updated', page.dates?.modified], ['last_reviewed', page.dates?.reviewed]]) {
      const found = twin[1].match(new RegExp(`^${field}: (.+)$`, 'm'))?.[1];
      if (found && found !== date) throw new Error(`${page.path}: Markdown source dates disagree`);
    }
    assertPublicText(markdown, page.path);
    const mirrorPath = `pages${page.path}index.md`;
    files.set(mirrorPath, markdown);
    const jsonPath = `ai/pages${page.path}index.json`;
    const pageJson = await json(path.join(distDir, jsonPath));
    if (!equal(pageJson, record)) throw new Error(`${page.path}: complete bare page JSON must agree with its canonical corpus record`);
    const text = stringify(cleanJson(pageJson));
    assertPublicText(text, jsonPath);
    files.set(jsonPath, text);
    pages.push({ sourceUrl: page.url, title: page.title, dates: page.dates,
      canonicalMarkdownUrl: page.formats.markdown, markdownUrl: `${rawBaseUrl}${mirrorPath}`,
      canonicalJsonUrl: page.formats.json, jsonUrl: `${rawBaseUrl}${jsonPath}` });
  }
  const topics = [];
  for (const topic of TOPICS) {
    const mirrorPath = `ai/${topic}.json`;
    const payload = await json(path.join(distDir, mirrorPath));
    if (payload.url !== `${SITE}/${mirrorPath}` || !payload.schemaVersion) throw new Error(`${mirrorPath}: unexpected public endpoint`);
    const sources = payload.sourceUrls ?? [payload.sourceUrl];
    if (!Array.isArray(sources) || !sources.length) throw new Error(`${mirrorPath}: canonical source is required`);
    for (const source of sources) sourcePage(source, records, mirrorPath);
    const text = stringify(cleanJson(payload));
    assertPublicText(text, mirrorPath);
    files.set(mirrorPath, text);
    topics.push({ name: topic, sourceUrls: sources, canonicalJsonUrl: payload.url, jsonUrl: `${rawBaseUrl}${mirrorPath}` });
  }
  const projectPages = manifest.pages.filter((page) => /^\/projects\/[a-z0-9-]+\/$/.test(page.path));
  const projectNames = projectPages.map((page) => `${page.path.split('/')[2]}.json`).sort();
  const shardNames = (await readdir(path.join(distDir, 'ai', 'projects'))).sort();
  if (!equal(projectNames, shardNames)) throw new Error('reader fallback project shards do not exactly match published canonical projects');
  const projects = [];
  for (const page of projectPages) {
    const slug = page.path.split('/')[2];
    const mirrorPath = `ai/projects/${slug}.json`;
    const payload = await json(path.join(distDir, mirrorPath));
    if (payload.url !== `${SITE}/${mirrorPath}` || payload.sourceUrl !== page.url || payload.project?.slug !== slug
      || payload.project.url !== page.url || payload.project.formats?.json !== payload.url
      || payload.project.installationRecord?.basis !== 'Company-reported project record'
      || !equal(payload.project.pageContent, records.get(page.url))) {
      throw new Error(`${slug}: complete project JSON must agree with its canonical public page and company-reported evidence boundary`);
    }
    const text = stringify(cleanJson(payload));
    assertPublicText(text, mirrorPath);
    files.set(mirrorPath, text);
    projects.push({ sourceUrl: page.url, title: page.title, canonicalJsonUrl: payload.url, jsonUrl: `${rawBaseUrl}${mirrorPath}` });
  }
  const contentPolicy = 'Generated only from the production build’s indexable canonical public pages and sanitized public exports. Drafts, noindex pages, redirect aliases, telephone data, form payloads, private source files and research archives are excluded. Media remain described links with their published captions/credits, not embedded photographs or invented transcripts.';
  const datePolicy = 'Dates and null values are copied from the public source records. Creating or publishing this fallback does not create a new content review, availability statement or verification date.';
  const evidencePolicy = 'The canonical Mr Wallcover website is authoritative. Installation experience is company-reported; venue/maker/press context and photograph credits do not independently verify the installation role. Preserve each record’s limitations when answering.';
  const index = { schemaVersion: '1.0', source: SITE, repositoryUrl, indexUrl: `${rawBaseUrl}index.json`, contentPolicy, datePolicy, evidencePolicy, pageCount: pages.length, projectCount: projects.length, topics, projects, pages };
  files.set('index.json', stringify(index));
  const label = (value) => String(value).replace(/([\\\[\]])/g, '\\$1').replace(/[\r\n]+/g, ' ');
  files.set('README.md', [
    '# Mr Wallcover — public reader fallback', '',
    `Canonical website: [www.mrwallcover.com](${SITE}/). [Machine-readable index](${rawBaseUrl}index.json).`, '',
    'Use this versioned fallback when a web reader cannot retrieve the canonical website. Prefer the canonical source when accessible. Every page below has Markdown plus a complete semantic JSON record, retaining its source URL and original public date fields. JSON also preserves public JSON-LD, media semantics, captions and credits; canonical links inside the records remain unchanged.', '',
    contentPolicy, '', datePolicy, '', evidencePolicy, '',
    'The website supports a shortlist conversation. Scope, price, availability, technical suitability and acceptance still need confirmation for the particular commission.', '',
    '## Topic JSON', '', ...topics.map((item) => `- [${label(item.name)}](${item.jsonUrl})`), '',
    '## Complete project JSON', '', ...projects.map((item) => `- [${label(item.title)}](${item.jsonUrl}) — [canonical source](${item.sourceUrl})`), '',
    `## All ${pages.length} published pages`, '', ...pages.map((item) => `- [${label(item.title)}](${item.markdownUrl}) — [complete JSON](${item.jsonUrl}) — [canonical source](${item.sourceUrl})`), '',
  ].join('\n'));
  return new Map([...files.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}

async function existingFiles(dir, prefix = '') {
  const out = new Map();
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const name = `${prefix}${item.name}`;
    if (item.isSymbolicLink()) throw new Error(`${name}: symlinks are not allowed in the reader fallback`);
    if (item.isDirectory()) for (const entry of await existingFiles(path.join(dir, item.name), `${name}/`)) out.set(...entry);
    else if (item.isFile()) out.set(name, await readFile(path.join(dir, item.name), 'utf8'));
    else throw new Error(`${name}: reader fallback requires ordinary files`);
  }
  return out;
}

/** Writes are explicitly opt-in, standard production only for the tracked mirror. */
export async function buildReaderMirror({ distDir = PRODUCTION_DIST, outputDir = READER_MIRROR_DIR, production = false, config } = {}) {
  distDir = path.resolve(distDir);
  outputDir = path.resolve(outputDir);
  if (!production || process.env.MW_CONTENT_PREVIEW === '1' || (outputDir === READER_MIRROR_DIR && distDir !== PRODUCTION_DIST)) {
    return { skipped: true, reason: 'reader fallback writes require the explicit canonical production build', files: 0 };
  }
  if (outputDir !== READER_MIRROR_DIR && (outputDir === ROOT || outputDir.startsWith(`${ROOT}${path.sep}`))) {
    throw new Error('fixture reader fallback output must be outside the website repository');
  }
  const expected = await expectedReaderMirrorFiles({ distDir, config });
  const current = await lstat(outputDir).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
  if (current && !current.isDirectory()) throw new Error('reader fallback output must be an ordinary directory');
  const parent = path.dirname(outputDir);
  await mkdir(parent, { recursive: true });
  const staged = await mkdtemp(path.join(parent, '.ai-reference-build-'));
  const backup = `${staged}-previous`;
  let moved = false;
  try {
    for (const [name, text] of expected) {
      await mkdir(path.dirname(path.join(staged, name)), { recursive: true });
      await writeFile(path.join(staged, name), text);
    }
    if (current) { await rename(outputDir, backup); moved = true; }
    try { await rename(staged, outputDir); }
    catch (error) { if (moved) await rename(backup, outputDir); throw error; }
    await rm(backup, { recursive: true, force: true });
  } finally {
    await rm(staged, { recursive: true, force: true });
  }
  return { skipped: false, files: expected.size, pages: [...expected.keys()].filter((name) => name.startsWith('pages/')).length, projects: [...expected.keys()].filter((name) => name.startsWith('ai/projects/')).length };
}

/**
 * Compare exact generated bytes and file membership. For the tracked mirror,
 * generated changes must already be staged/committed, and every file tracked.
 * A CI build cannot silently update a stale commit and then pass freshness.
 */
export async function verifyReaderMirror({ distDir = PRODUCTION_DIST, outputDir = READER_MIRROR_DIR, config } = {}) {
  outputDir = path.resolve(outputDir);
  const expected = await expectedReaderMirrorFiles({ distDir, config });
  const actual = await existingFiles(outputDir);
  const missing = [...expected.keys()].filter((name) => !actual.has(name));
  const extra = [...actual.keys()].filter((name) => !expected.has(name));
  const changed = [...expected.keys()].filter((name) => actual.has(name) && actual.get(name) !== expected.get(name));
  if (missing.length || extra.length || changed.length) {
    throw new Error(`reader fallback is stale: ${missing.length} missing, ${extra.length} extra, ${changed.length} changed files`);
  }
  if (outputDir === READER_MIRROR_DIR) {
    const { stdout } = await run('git', ['ls-files', '-z', '--', 'ai-reference'], { cwd: ROOT, maxBuffer: 1024 * 1024 });
    const tracked = stdout.split('\0').filter(Boolean).map((name) => name.slice('ai-reference/'.length)).sort();
    if (!equal(tracked, [...expected.keys()].sort())) throw new Error('every generated reader fallback file must be tracked; stage the complete ai-reference tree');
    try { await run('git', ['diff', '--exit-code', '--', 'ai-reference'], { cwd: ROOT, maxBuffer: 1024 * 1024 }); }
    catch { throw new Error('reader fallback differs from the staged/committed version; regenerate and stage it with the source change'); }
  }
  return { files: expected.size, pages: [...expected.keys()].filter((name) => name.startsWith('pages/')).length };
}
