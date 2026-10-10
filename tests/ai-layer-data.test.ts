import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

/**
 * The sourced facts the AI-crawling layer adds (src/lib/ai-layer-data.ts),
 * checked on the built site in dist/ against the repository files they come
 * from (src/data/ai-sources.json). Also the no-loss floor for every AI URL and
 * its fact counts: they may grow, never shrink or disappear.
 */

const SITE = 'https://www.mrwallcover.com';
const read = (file: string) => readFile(file, 'utf8');
const json = async <T = any>(file: string): Promise<T> => JSON.parse(await read(file)) as T;
async function isFile(file: string) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}
const distPath = (url: string) => path.join('dist', decodeURIComponent(new URL(url).pathname));

/** The same Markdown-to-plain rule as src/lib/ai-layer-data.ts. */
function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/|mailto:)[^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

interface CaseStudyFile { slug: string; draft?: boolean; title: string; client: string; location: string; years: string | null; role: string; wallcoverings: string[]; body: string }
async function caseStudyFiles(): Promise<CaseStudyFile[]> {
  const out: CaseStudyFile[] = [];
  for (const name of (await readdir('src/content/case-studies')).filter((n) => n.endsWith('.md'))) {
    const text = await read(`src/content/case-studies/${name}`);
    const front = text.match(/^---\n([\s\S]*?)\n---\n/)!;
    out.push({ ...(JSON.parse(front[1]) as Omit<CaseStudyFile, 'body'>), body: text.slice(front[0].length) });
  }
  return out;
}

/** Terms that must never reach the AI layer: brand rules, unpublished and private projects, drafts. */
const FORBIDDEN = [
  'CLAUDI', 'Landmark', 'Threadneedle', 'third party', 'third-party', 'subcontract',
  '3163', 'Horsehair', 'Metallic Ombre', 'penthouse', 'Private residence, Kensington', 'Calico - private residence',
  'unidentified-', 'awaiting Dorin', 'biltmore-mayfair', 'penny-morrison', 'since 2014',
];
const PHONE = /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|\b020\s?\d{4}\s?\d{4}\b/;
const PRIVATE_ADDRESS = [/\b\d{1,4}[a-z]?[ \t]+St\.?\s?George'?s?\s+Square/i, /\b\d{1,4}[a-z]?[ \t]+Inverness\s+Terrace/i, /\bSW1V\s?\d[A-Z]{2}\b/, /\bW2\s?\d[A-Z]{2}\b/, /\bPL12\b/, /\bN\d{1,2}\s?\d[A-Z]{2}\b/, /\bflat\s+\d+/i];

test('every /projects.json entry resolves to a built, indexable case study and its Markdown twin, and the list is exactly the published case studies (Lee Broom included)', async () => {
  const index = await json<{ url: string; count: number; projects: any[] }>('dist/projects.json');
  assert.equal(index.url, `${SITE}/projects.json`);
  assert.equal(index.count, index.projects.length);
  const published = (await caseStudyFiles()).filter((cs) => !cs.draft).map((cs) => cs.slug).sort();
  assert.deepEqual(index.projects.map((p) => p.slug).sort(), published, 'projects.json lists exactly the published case studies');
  assert.ok(index.projects.some((p) => p.slug === 'calico-lee-broom-overture'), 'Lee Broom is listed');
  const problems: string[] = [];
  for (const entry of index.projects) {
    assert.equal(entry.url, `${SITE}/projects/${entry.slug}/`);
    assert.equal(entry.markdownUrl, `${entry.url}index.md`);
    const html = path.join(distPath(entry.url), 'index.html');
    if (!(await isFile(html))) { problems.push(`${entry.slug}: no page`); continue; }
    const page = await read(html);
    if (/<meta name="robots" content="noindex">|http-equiv="refresh"/.test(page)) problems.push(`${entry.slug}: page is noindex or a redirect`);
    if (!(await isFile(distPath(entry.markdownUrl)))) problems.push(`${entry.slug}: no Markdown twin`);
  }
  assert.deepEqual(problems, []);
});

test('every value in /projects.json is read from its case study, word for word', async () => {
  const index = await json<{ projects: any[] }>('dist/projects.json');
  const sources = new Map((await caseStudyFiles()).map((cs) => [cs.slug, cs]));
  const problems: string[] = [];
  for (const entry of index.projects) {
    const cs = sources.get(entry.slug);
    if (!cs) { problems.push(`${entry.slug}: no source file`); continue; }
    const text = plain(cs.body);
    const has = (field: string, value: unknown) => {
      if (value === null || value === undefined || value === '') return;
      if (!text.includes(String(value))) problems.push(`${entry.slug}.${field}: "${String(value).slice(0, 80)}" is not in src/content/case-studies/${cs.slug}.md`);
    };
    // Frontmatter fields are copied, not rewritten.
    assert.equal(entry.title, cs.title, `${entry.slug}.title`);
    assert.equal(entry.client, cs.client, `${entry.slug}.client`);
    assert.equal(entry.area, cs.location, `${entry.slug}.area`);
    assert.equal(entry.years, cs.years, `${entry.slug}.years`);
    assert.equal(entry.role, cs.role, `${entry.slug}.role`);
    assert.deepEqual(entry.makersAndProducts, cs.wallcoverings, `${entry.slug}.makersAndProducts`);
    if (entry.venue !== cs.title) has('venue', entry.venue);
    for (const field of ['dates', 'partners', 'productsAsWritten']) {
      // Joined "value; item; item" strings: each part is checked on its own.
      for (const part of String(entry[field] ?? '').split('; ').filter(Boolean)) has(field, part);
    }
    for (const part of String(entry.scope ?? '').split('; ').filter(Boolean)) has('scope', part);
    for (const step of entry.method) { has('method.step', `${step.step}.`); has('method.text', step.text); }
    for (const technique of entry.techniques) has('techniques', `${technique}.`);
    for (const prep of entry.preparation) has('preparation', prep);
    for (const item of entry.atAGlance) {
      has('atAGlance.label', `${item.label}:`);
      has('atAGlance.value', item.value);
      for (const sub of item.items ?? []) has('atAGlance.item', sub);
    }
  }
  assert.deepEqual(problems, []);
});

test('the source map names every /projects.json field and site fact', async () => {
  const map = await json<{ projects: Record<string, string>; site: Record<string, string> }>('src/data/ai-sources.json');
  const mapped = new Set(Object.keys(map.projects).flatMap((key) => key.split(/,\s*/)).map((key) => key.replace(/\s*\(.*\)$/, '')));
  mapped.add('area');
  const index = await json<{ projects: Record<string, unknown>[] }>('dist/projects.json');
  for (const key of Object.keys(index.projects[0])) {
    if (['source'].includes(key)) continue;
    assert.ok(mapped.has(key), `src/data/ai-sources.json does not say where "${key}" comes from`);
  }
  for (const key of ['since', 'wastage', 'award', 'services.workflow', 'services.installation', 'areas', 'enquiryRoutes']) assert.ok(map.site[key], key);
});

test('/.well-known/facts.json keeps every /facts.json field and adds the sourced site facts', async () => {
  const base = await json<Record<string, unknown>>('dist/facts.json');
  const known = await json<Record<string, any>>('dist/.well-known/facts.json');
  for (const [key, value] of Object.entries(base)) {
    if (key === 'url') continue;
    assert.deepEqual(known[key], value, `/.well-known/facts.json.${key} differs from /facts.json`);
  }
  assert.equal(known.url, `${SITE}/.well-known/facts.json`);
  assert.equal(known.sameAs, `${SITE}/facts.json`);
  const team = await json<{ members: { id: string; since: number }[] }>('src/content/team.json');
  assert.equal(known.inTradeSince, team.members.find((m) => m.id === 'dorin-burcus')!.since);
  assert.equal(known.inTradeSince, 2012);
  const services = await json<{ pillars: { id: string; title: string; paragraphs: string[] }[] }>('src/content/services.json');
  assert.ok(services.pillars.find((p) => p.id === 'surveying')!.paragraphs.join(' ').includes(known.wastageAllowance.statement));
  assert.equal(known.wastageAllowance.range, '15–30%');
  assert.deepEqual(known.services.workflow.map((s: { name: string }) => s.name), services.pillars.map((p) => p.title));
  for (const [i, pillar] of services.pillars.entries()) assert.deepEqual(known.services.workflow[i].includes, pillar.paragraphs);
  const specialisms = await json<{ items: { name: string; description: string }[] }>('src/content/specialisms.json');
  assert.deepEqual(known.services.installation.map((s: { includes: string }) => s.includes), specialisms.items.map((s) => s.description));
  const areas = await json<{ items: { name: string }[] }>('src/content/areas.json');
  assert.deepEqual(known.areasServed.areaPages.map((a: { name: string }) => a.name), areas.items.map((a) => a.name));
  const routes = known.enquiryRoutes.map((r: { route: string }) => r.route);
  assert.ok(routes.includes('Enquiry form') && routes.includes('Email'), 'form and email are always routes');
  const projects = await json<{ projects: { url: string }[] }>('dist/projects.json');
  assert.deepEqual(known.projects.items.map((p: { url: string }) => p.url), projects.projects.map((p) => p.url));
  const facts = await json<{ award?: unknown }>('src/data/facts.json');
  assert.equal('awardText' in known, 'award' in facts, 'the award line appears exactly when the fact sheet carries it');
  if ('award' in facts) assert.equal(known.awardText, 'Award-winning (2021): Most Outstanding for Wallcovering Installation, BUILD Magazine 2021 Design & Build Awards');
});

test('the AI layer carries no forbidden, private or unpublished terms and no phone number', async () => {
  const files = ['dist/projects.json', 'dist/.well-known/facts.json', 'dist/llms.txt', 'dist/llms-full.txt', 'dist/for-ai/index.html', 'dist/for-ai/index.md'];
  for (const file of files) {
    const text = await read(file);
    for (const term of FORBIDDEN) assert.equal(text.toLowerCase().includes(term.toLowerCase()), false, `${file}: "${term}"`);
    assert.doesNotMatch(text, PHONE, `${file}: phone number`);
    for (const pattern of PRIVATE_ADDRESS) assert.doesNotMatch(text, pattern, `${file}: ${pattern}`);
  }
});

test('/for-ai/ and /llms.txt carry the sourced facts and link the new resources and the crawler page', async () => {
  const html = await read('dist/for-ai/index.html');
  for (const href of ['/projects.json', '/.well-known/facts.json', '/wallcovering-installation-ai-crawler/', '/services/#surveying']) assert.ok(html.includes(`href="${href}"`), `/for-ai/ links ${href}`);
  assert.ok(html.includes('In the trade since 2012'));
  assert.ok(html.includes('15–30%'));
  const index = await json<{ projects: { slug: string; markdownUrl: string; scope: string | null }[] }>('dist/projects.json');
  for (const p of index.projects) assert.ok(html.includes(`href="/projects/${p.slug}/index.md"`), `/for-ai/ links the ${p.slug} twin`);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const nodes = ld.flatMap((block) => block['@graph'] ?? [block]);
  const list = nodes.find((node: { '@type': string }) => node['@type'] === 'ItemList');
  assert.ok(list, 'ItemList JSON-LD on /for-ai/');
  assert.equal(list.numberOfItems, index.projects.length);
  assert.deepEqual(list.itemListElement.map((i: { url: string }) => i.url), index.projects.map((p) => `${SITE}/projects/${p.slug}/`));
  const llms = await read('dist/llms.txt');
  assert.ok(llms.includes('## Key facts'));
  assert.ok(llms.includes(`(${SITE}/projects.json)`) && llms.includes(`(${SITE}/.well-known/facts.json)`));
  for (const p of index.projects) assert.ok(llms.includes(`Markdown: ${p.markdownUrl}`), `llms.txt note for ${p.slug}`);
});

test('no-loss floor: every AI URL is still built and no fact count has dropped', async () => {
  const floor = await json<Record<string, any>>('tests/ai-layer-floor.json');
  for (const url of floor.urls as string[]) {
    const file = url.endsWith('/') ? path.join('dist', url, 'index.html') : path.join('dist', url);
    assert.ok(await isFile(file), `${url} is missing from the build`);
  }
  const robots = await read('dist/robots.txt');
  for (const agent of floor.robotsAllowed as string[]) assert.match(robots, new RegExp(`User-agent: ${agent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\nAllow: /\\n`), `robots.txt still allows ${agent}`);
  const { counts } = (await import('../scripts/ai-fact-counts.mjs')) as { counts: (dir: string) => Promise<Record<string, any>> };
  const now = await counts('dist');
  const drops: string[] = [];
  const compare = (prefix: string, min: any, cur: any) => {
    if (typeof min === 'number') { if (typeof cur !== 'number' || cur < min) drops.push(`${prefix}: ${cur} < ${min}`); return; }
    for (const [key, value] of Object.entries(min ?? {})) compare(`${prefix}.${key}`, value, cur?.[key]);
  };
  compare('counts', floor.counts, now);
  assert.deepEqual(drops, []);
});
