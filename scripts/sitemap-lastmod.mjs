/**
 * Honest sitemap <lastmod> for every published URL (read by astro.config.mjs).
 *
 * The date is the last real change to the page's own content, never the build time:
 * - case studies and advice guides: the `updated` date in their frontmatter
 *   (case studies are stamped from git by scripts/stamp-case-study-dates.mjs);
 * - editorial pages (src/content/pages/*.md): their frontmatter `updated`, else the
 *   last commit that touched the file;
 * - pages built from one entry of a JSON collection (services, areas, materials,
 *   professionals): the last commit in which THAT entry changed, found by walking the
 *   file's git history and comparing the entry, so an edit to one service does not
 *   re-date the other ten;
 * - single pages and hubs: the newest of their own source files' last commits, and
 *   for hubs the newest of their children too.
 *
 * Shared layout, component and style files are deliberately not counted: a header or
 * CSS change is not a change to the page's main content.
 * A file with uncommitted changes counts as changed today (as the case-study stamp does).
 * Without usable git history (a shallow clone) the git-derived dates are left out
 * rather than guessed; frontmatter dates still apply.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function computeLastmod(root) {
  const rel = (p) => path.join(root, p);
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let gitOk = false;
  try {
    gitOk = git(['rev-parse', '--is-shallow-repository']) === 'false';
  } catch {
    gitOk = false;
  }
  const today = new Date().toISOString().slice(0, 10);
  const dirty = (file) => gitOk && Boolean(git(['status', '--porcelain', '--', file]));
  const fileCache = new Map();
  /** Last commit date of a whole file (today when it has uncommitted changes). */
  const fileDate = (file) => {
    if (!gitOk || !existsSync(rel(file))) return undefined;
    if (!fileCache.has(file)) fileCache.set(file, dirty(file) ? today : git(['log', '-1', '--format=%cs', '--', file]) || undefined);
    return fileCache.get(file);
  };
  const stable = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
  /** slug -> date of the last commit in which that entry of a JSON collection changed. */
  const entryDates = (file, pick) => {
    const out = new Map();
    if (!gitOk) return out;
    const items = (text) => {
      try {
        return new Map(pick(JSON.parse(text)).map((item) => [item.slug, stable(item)]));
      } catch {
        return new Map();
      }
    };
    const current = items(readFileSync(rel(file), 'utf8'));
    const history = git(['log', '--format=%H %cs', '--', file]).split('\n').filter(Boolean).map((line) => line.split(' '));
    const versions = history.map(([sha, date]) => ({ date, items: items(git(['show', `${sha}:${file}`])) }));
    for (const [slug, value] of current) {
      if (versions.length === 0 || versions[0].items.get(slug) !== value) { out.set(slug, today); continue; }
      // Walk back while the entry is unchanged; its date is the oldest commit in that unchanged run.
      let date = versions[0].date;
      for (let i = 1; i < versions.length && versions[i].items.get(slug) === value; i += 1) date = versions[i].date;
      // `date` is now the commit that introduced the current value (history is newest first).
      out.set(slug, date);
    }
    return out;
  };
  const frontmatter = (file) => {
    const m = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---\n/);
    if (!m) return {};
    try {
      return JSON.parse(m[1]);
    } catch {
      // YAML frontmatter (guides): read the few flat keys we need.
      const fm = {};
      for (const line of m[1].split('\n')) {
        const kv = line.match(/^([a-zA-Z]+):\s*"?([^"]*)"?\s*$/);
        if (kv) fm[kv[1]] = kv[2] === 'true' ? true : kv[2] === 'false' ? false : kv[2];
      }
      return fm;
    }
  };
  const max = (...dates) => dates.filter((d) => d && ISO.test(d)).sort().at(-1);

  const byPath = new Map();
  const set = (p, ...dates) => {
    const d = max(byPath.get(p), ...dates);
    if (d) byPath.set(p, d);
  };

  // Case studies and guides: their own frontmatter dates.
  const caseDates = [];
  for (const name of readdirSync(rel('src/content/case-studies')).filter((n) => n.endsWith('.md'))) {
    const fm = frontmatter(rel(`src/content/case-studies/${name}`));
    if (fm.draft || !ISO.test(fm.updated ?? '')) continue;
    set(`/projects/${fm.slug}/`, fm.updated);
    caseDates.push(fm.updated);
  }
  const guideDates = [];
  for (const name of readdirSync(rel('src/content/guides')).filter((n) => n.endsWith('.md'))) {
    const fm = frontmatter(rel(`src/content/guides/${name}`));
    if (fm.draft || !ISO.test(fm.updated ?? '')) continue;
    set(`/advice/${fm.slug}/`, fm.updated);
    guideDates.push(fm.updated);
  }
  // The fire-ratings reference: its own `updated` date (src/content/fire-ratings/page.json), set when the
  // visible guidance changes. Data rechecks that change nothing on the page do not move it.
  const fire = JSON.parse(readFileSync(rel('src/content/fire-ratings/page.json'), 'utf8'));
  if (ISO.test(fire.updated ?? '')) {
    set(`/advice/${fire.slug}/`, fire.updated);
    guideDates.push(fire.updated);
  }
  // Editorial pages.
  for (const name of readdirSync(rel('src/content/pages')).filter((n) => n.endsWith('.md'))) {
    const file = `src/content/pages/${name}`;
    const fm = frontmatter(rel(file));
    if (fm.draft || !fm.path) continue;
    set(fm.path, ISO.test(fm.updated ?? '') ? fm.updated : fileDate(file));
  }
  // One page per JSON collection entry.
  const collections = [
    ['src/content/specialisms.json', (d) => d.items, '/services/'],
    ['src/content/areas.json', (d) => d.items, '/areas/'],
    ['src/content/materials.json', (d) => d.items, '/materials/'],
    ['src/content/professionals.json', (d) => d, '/professionals/'],
  ];
  const childDates = {};
  for (const [file, pick, prefix] of collections) {
    childDates[prefix] = [];
    for (const [slug, date] of entryDates(file, pick)) {
      set(`${prefix}${slug}/`, date);
      childDates[prefix].push(date);
    }
  }
  const directory = JSON.parse(readFileSync(rel('src/data/makers-directory.json'), 'utf8'));
  if (directory.publication.approved === true) {
    set('/makers/', directory.updated); set('/buying-routes/', directory.updated);
    for (const maker of directory.makers) set(`/makers/${maker.slug}/`, directory.updated);
  }
  // Single pages and hubs: their own source files (and, for hubs, their children).
  const pages = {
    '/': ['src/pages/index.astro', 'src/content/home.json', 'src/content/hero.json'],
    '/practice/': ['src/pages/practice.astro', 'src/data/home-editorial.ts', 'src/content/home.json'],
    '/about/': ['src/pages/about.astro', 'src/content/about.json', 'src/content/team.json', 'src/content/hotels.json'],
    '/accessibility/': ['src/pages/accessibility.astro'],
    '/aftercare/': ['src/pages/aftercare.astro', 'src/content/aftercare.json'],
    '/details/': ['src/pages/details.astro'],
    '/get-in-touch/': ['src/pages/get-in-touch.astro', 'src/content/get-in-touch.json'],
    '/contact/': ['src/pages/contact.astro', 'src/content/contact.json'],
    '/faq/': ['src/pages/faq.astro', 'src/content/faq.json'],
    '/privacy/': ['src/pages/privacy.astro', 'src/content/privacy.json'],
    '/services/': ['src/pages/services.astro', 'src/content/services.json', 'src/content/specialisms.json'],
    '/for-ai/': ['src/pages/for-ai.astro', 'src/data/facts.json', 'src/data/buyer-answers.json', 'src/lib/ai-layer-data.ts'],
    '/wallcovering-installation-ai-crawler/': ['src/pages/wallcovering-installation-ai-crawler.astro', 'src/lib/ai-crawler.ts', 'src/lib/ai-decision-guide.ts'],
    '/advice/': ['src/pages/advice/index.astro'],
    '/wallpapering/': ['src/pages/wallpapering/index.astro', 'src/data/wallpapering.json'],
    '/calculator/': ['src/pages/calculator.astro', 'src/lib/quantity.ts', 'src/lib/materials.ts', 'src/data/wallpapering.json'],
    '/room-studio/': ['src/pages/room-studio.astro', 'src/room-studio/RoomStudio.tsx'],
    '/wallpapering/preparation/': ['src/pages/wallpapering/preparation.astro', 'src/data/wallpapering.json'],
    '/wallpapering/lining-and-adhesives/': ['src/pages/wallpapering/lining-and-adhesives.astro', 'src/data/wallpapering.json'],
    '/advice/quantities/': ['src/pages/advice/quantities.astro'],
    '/areas/': ['src/pages/areas/index.astro', 'src/content/areas.json'],
    '/materials/': ['src/pages/materials/index.astro', 'src/content/materials.json', 'src/content/makers-installed.json'],
    '/professionals/': ['src/pages/professionals.astro', 'src/content/professionals.json'],
    '/projects/': ['src/pages/projects/index.astro', 'src/content/projects.json', 'src/content/makers-installed.json', 'src/content/project-record.json', 'src/components/ProjectRecord.astro', 'src/content/hotels.json'],
  };
  for (const [p, files] of Object.entries(pages)) set(p, ...files.map(fileDate));
  set('/advice/', ...guideDates);
  set('/projects/', ...caseDates);
  for (const prefix of ['/areas/', '/materials/', '/professionals/']) set(prefix, ...childDates[prefix]);
  return byPath;
}
