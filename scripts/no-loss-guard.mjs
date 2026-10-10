#!/usr/bin/env node
/**
 * No-loss guard (Dorin's standing rule, 10 Oct 2026: nothing on mrwallcover.com may be lost).
 *
 *   node scripts/no-loss-guard.mjs --base-dist <main build> [--dist dist] [--base-ref origin/main] [--json report.json]
 *
 * Compares this branch with origin/main and exits 1 when anything published would be lost:
 *  (a) a URL in main's sitemap is missing from this build's sitemap;
 *  (b) a case study disappears, is unpublished (draft), or its gallery frame count drops;
 *  (c) a file under public/media (or an image at the top of public/) is deleted without a
 *      replacement: the same base name or slot (base name minus a -800 / -1600w / -preview size
 *      suffix), in any format, with pixel dimensions at least as large. Reorders are allowed;
 *  (d) the Lee Broom case study or any project card that main lists on /projects/ or the home
 *      page is missing;
 *  (e) the AI layer shrinks: /for-ai/, /llms.txt, /llms-full.txt, /facts.json, /.well-known/*,
 *      /feed.xml, every Markdown twin, /wallcovering-installation-ai-crawler/ and /ai/*.json must
 *      all still exist with no lower count (JSON leaves and array entries, text lines and links,
 *      feed items, list items and links on HTML pages); robots.txt keeps every User-agent/Allow
 *      line; and no page has fewer JSON-LD nodes or properties than on main.
 *
 * The baseline is never a hand-kept list: (a), (d) and (e) read main's own build (CI builds
 * origin/main in a worktree), and (b) and (c) read main's committed files with git.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const root = path.resolve(import.meta.dirname, '..');
const baseDist = opt('base-dist');
const dist = path.resolve(root, opt('dist', 'dist'));
const baseRef = opt('base-ref', 'origin/main');
const jsonOut = opt('json');
if (!baseDist) {
  console.error('Usage: node scripts/no-loss-guard.mjs --base-dist <main build> [--dist dist] [--base-ref origin/main]');
  process.exit(2);
}
const base = path.resolve(baseDist);

const failures = [];
const fail = (check, message) => failures.push(`(${check}) ${message}`);
const report = { baseRef, counts: { base: {}, pr: {} }, galleries: {}, ai: {} };

const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'buffer', maxBuffer: 1 << 28 });
const gitText = (...a) => git(...a).toString('utf8');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (dir, file) => path.relative(dir, file).split(path.sep).join('/');
const read = (dir, file) => readFileSync(path.join(dir, file), 'utf8');
const has = (dir, file) => existsSync(path.join(dir, file));

// (a) Sitemap URLs.
function sitemapUrls(dir) {
  const urls = new Set();
  for (const f of readdirSync(dir).filter((n) => /^sitemap-\d+\.xml$/.test(n))) {
    for (const m of read(dir, f).matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(m[1].trim());
  }
  return urls;
}
const baseUrls = sitemapUrls(base);
const prUrls = sitemapUrls(dist);
report.counts.base.pages = baseUrls.size;
report.counts.pr.pages = prUrls.size;
for (const u of baseUrls) if (!prUrls.has(u)) fail('a', `sitemap URL missing: ${u}`);

// (b) Case studies and gallery frames, from main's committed files.
const csDir = 'src/content/case-studies';
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? JSON.parse(m[1]) : {};
}
const baseStudies = gitText('ls-tree', '--name-only', `${baseRef}:${csDir}`).split('\n').filter((n) => n.endsWith('.md'));
for (const name of baseStudies) {
  const b = frontmatter(gitText('show', `${baseRef}:${csDir}/${name}`));
  const prPath = path.join(root, csDir, name);
  const slug = b.slug ?? name.replace(/\.md$/, '');
  const bFrames = (b.gallery ?? []).length;
  if (!existsSync(prPath)) {
    fail('b', `case study removed: ${csDir}/${name}`);
    report.galleries[slug] = { base: bFrames, pr: null };
    continue;
  }
  const p = frontmatter(readFileSync(prPath, 'utf8'));
  const pFrames = (p.gallery ?? []).length;
  report.galleries[slug] = { base: bFrames, pr: pFrames, draft: { base: !!b.draft, pr: !!p.draft } };
  if (pFrames < bFrames) fail('b', `${slug}: gallery frames dropped from ${bFrames} to ${pFrames}`);
  if (!b.draft && p.draft) fail('b', `${slug}: published on main, set to draft here`);
}

// (c) Media files: deleted only with an equal-or-larger replacement of the same shot.
const MEDIA = /^public\/(media\/.+|[^/]+\.(jpe?g|png|webp|avif|gif|svg))$/i;
const IMAGE = /\.(jpe?g|png|webp|avif|gif|tiff?)$/i;
const baseMedia = gitText('ls-tree', '-r', '--name-only', baseRef, '--', 'public').split('\n').filter((f) => MEDIA.test(f));
const prMedia = walk(path.join(root, 'public')).map((f) => rel(root, f)).filter((f) => MEDIA.test(f));
report.counts.base.mediaFiles = baseMedia.length;
report.counts.pr.mediaFiles = prMedia.length;
report.counts.base.imageFiles = baseMedia.filter((f) => IMAGE.test(f)).length;
report.counts.pr.imageFiles = prMedia.filter((f) => IMAGE.test(f)).length;
const prSet = new Set(prMedia);
const stem = (f) => path.basename(f).replace(/\.[^.]+$/, '');
const slot = (f) => stem(f).replace(/-(?:\d{2,5}w?|preview|thumb)$/i, '');
const bySlot = new Map();
for (const f of prMedia) {
  for (const key of new Set([stem(f), slot(f)])) {
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key).push(f);
  }
}
async function dims(input) {
  try {
    const m = await sharp(input).metadata();
    return m.width && m.height ? { w: m.width, h: m.height } : null;
  } catch {
    return null;
  }
}
for (const f of baseMedia) {
  if (prSet.has(f)) continue;
  const candidates = [...new Set([...(bySlot.get(stem(f)) ?? []), ...(bySlot.get(slot(f)) ?? [])])];
  if (!candidates.length) {
    fail('c', `media deleted with no replacement: ${f}`);
    continue;
  }
  if (!IMAGE.test(f)) continue; // a video or other file: the same base name in any format is enough
  const was = await dims(git('show', `${baseRef}:${f}`));
  if (!was) continue;
  let ok = false;
  for (const c of candidates) {
    const now = await dims(path.join(root, c));
    if (now && now.w >= was.w && now.h >= was.h) { ok = true; break; }
  }
  if (!ok) fail('c', `media deleted and only replaced at a smaller size: ${f} (${was.w}x${was.h}); candidates ${candidates.join(', ')}`);
}

// (d) Lee Broom, and every project card main lists on /projects/ and the home page.
const LEE = 'calico-lee-broom-overture';
const leePage = `projects/${LEE}/index.html`;
if (!has(dist, leePage)) fail('d', `Lee Broom case study page missing: /${leePage.replace('index.html', '')}`);
else if (/<meta name="robots" content="noindex/.test(read(dist, leePage))) fail('d', 'Lee Broom case study is noindex');
if (!has(dist, 'projects/index.html') || !read(dist, 'projects/index.html').includes(`data-project-slug="${LEE}"`)) fail('d', 'Lee Broom card missing from /projects/');
if (!prUrls.has(`https://www.mrwallcover.com/projects/${LEE}/`)) fail('d', 'Lee Broom page missing from the sitemap');
const cardSlugs = (html) => new Set([...html.matchAll(/data-project-slug="([^"]+)"/g)].map((m) => m[1]));
const projectLinks = (html) => new Set([...html.matchAll(/href="\/projects\/([a-z0-9-]+)\/"/g)].map((m) => m[1]));
for (const [page, extract] of [['projects/index.html', cardSlugs], ['projects/index.html', projectLinks], ['index.html', projectLinks]]) {
  if (!has(base, page)) continue;
  const before = extract(read(base, page));
  const after = has(dist, page) ? extract(read(dist, page)) : new Set();
  for (const s of before) if (!after.has(s)) fail('d', `/${page.replace('index.html', '')}: project card or link to /projects/${s}/ missing`);
}

// (e) AI layer.
function leaves(v) {
  if (Array.isArray(v)) return v.reduce((n, x) => n + leaves(x), 0);
  if (v && typeof v === 'object') return Object.values(v).reduce((n, x) => n + leaves(x), 0);
  return 1;
}
function maxArray(v) {
  if (Array.isArray(v)) return Math.max(v.length, ...v.map(maxArray));
  if (v && typeof v === 'object') return Math.max(0, ...Object.values(v).map(maxArray));
  return 0;
}
const textMeasures = (t) => ({ lines: t.split('\n').filter((l) => l.trim()).length, links: (t.match(/\]\([^)]+\)|https?:\/\/\S+/g) ?? []).length });
const htmlMain = (t) => (t.match(/<main[\s\S]*?<\/main>/) ?? [t])[0];
const htmlMeasures = (t) => ({ listItems: (htmlMain(t).match(/<li[\s>]/g) ?? []).length, links: (htmlMain(t).match(/<a\s[^>]*href=/g) ?? []).length });
function measure(dir, file) {
  const t = read(dir, file);
  if (file.endsWith('.json')) { const d = JSON.parse(t); return { jsonLeaves: leaves(d), largestList: maxArray(d) }; }
  if (file.endsWith('.xml')) return { items: (t.match(/<item[\s>]|<entry[\s>]/g) ?? []).length };
  if (file.endsWith('.html')) return htmlMeasures(t);
  return textMeasures(t);
}
const baseFiles = walk(base).map((f) => rel(base, f));
const aiFiles = baseFiles.filter((f) =>
  ['for-ai/index.html', 'llms.txt', 'llms-full.txt', 'facts.json', 'feed.xml', 'wallcovering-installation-ai-crawler/index.html'].includes(f) ||
  f.startsWith('.well-known/') || /^ai\/[^/]+\.json$/.test(f) || f.endsWith('.md'));
report.counts.base.markdownTwins = baseFiles.filter((f) => f.endsWith('.md')).length;
report.counts.pr.markdownTwins = walk(dist).filter((f) => f.endsWith('.md')).length;
for (const f of aiFiles) {
  if (!has(dist, f)) { fail('e', `AI layer file missing: /${f}`); continue; }
  const b = measure(base, f);
  const p = measure(dist, f);
  if (!f.endsWith('.md') || f.startsWith('wallcovering-installation-ai-crawler/')) report.ai[f] = { base: b, pr: p };
  for (const k of Object.keys(b)) if ((p[k] ?? 0) < b[k]) fail('e', `/${f}: ${k} dropped from ${b[k]} to ${p[k] ?? 0}`);
}
// robots.txt: every User-agent / Allow line on main stays, in the same group.
function robotGroups(t) {
  const out = new Set();
  let agents = [];
  let inRules = false;
  for (const line of t.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)) {
    const [k, ...v] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = v.join(':').trim();
    if (key === 'user-agent') { if (inRules) { agents = []; inRules = false; } agents.push(val); }
    else { inRules = true; if (key === 'allow') for (const a of agents) out.add(`${a} Allow ${val}`); }
  }
  return out;
}
if (has(base, 'robots.txt')) {
  const b = robotGroups(read(base, 'robots.txt'));
  const p = has(dist, 'robots.txt') ? robotGroups(read(dist, 'robots.txt')) : new Set();
  report.ai['robots.txt'] = { base: { allowLines: b.size }, pr: { allowLines: p.size } };
  for (const line of b) if (!p.has(line)) fail('e', `robots.txt lost "${line}"`);
}
// JSON-LD node and property counts per page.
function ldCounts(html) {
  let nodes = 0, props = 0;
  const visit = (v) => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (v && typeof v === 'object') {
      if ('@type' in v) nodes += 1;
      props += Object.keys(v).length;
      Object.values(v).forEach(visit);
    }
  };
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) visit(JSON.parse(m[1]));
  return { nodes, props };
}
let ldBase = { nodes: 0, props: 0 }, ldPr = { nodes: 0, props: 0 };
for (const f of baseFiles.filter((x) => x.endsWith('.html'))) {
  const b = ldCounts(read(base, f));
  ldBase.nodes += b.nodes; ldBase.props += b.props;
  if (!has(dist, f)) { if (b.nodes) fail('e', `/${f}: page with JSON-LD missing`); continue; }
  const p = ldCounts(read(dist, f));
  if (p.nodes < b.nodes) fail('e', `/${f}: JSON-LD nodes dropped from ${b.nodes} to ${p.nodes}`);
  if (p.props < b.props) fail('e', `/${f}: JSON-LD properties dropped from ${b.props} to ${p.props}`);
}
for (const f of walk(dist).map((x) => rel(dist, x)).filter((x) => x.endsWith('.html'))) {
  const p = ldCounts(read(dist, f));
  ldPr.nodes += p.nodes; ldPr.props += p.props;
}
report.counts.base.jsonLd = ldBase;
report.counts.pr.jsonLd = ldPr;

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 2));
console.log(`no-loss: pages ${report.counts.base.pages} -> ${report.counts.pr.pages}; media ${report.counts.base.mediaFiles} -> ${report.counts.pr.mediaFiles}; markdown twins ${report.counts.base.markdownTwins} -> ${report.counts.pr.markdownTwins}; JSON-LD nodes ${ldBase.nodes} -> ${ldPr.nodes}, properties ${ldBase.props} -> ${ldPr.props}`);
if (failures.length) {
  console.error(`NO-LOSS GUARD FAILED (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('NO-LOSS GUARD PASS');
