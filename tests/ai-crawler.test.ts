import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';

const SITE = 'https://www.mrwallcover.com';
const CRAWLER = '/wallcovering-installation-ai-crawler/';

interface Photo {
  id: string;
  url: string;
  alt: string;
  credit: string | null;
  sourceUrls: string[];
}
interface CrawlerProject {
  slug: string;
  title: string;
  url: string;
  role: string;
  client: string;
  location: string;
  projectDates: string | null;
  summary: string;
  materials: string[] | null;
  published: string | null;
  updated: string | null;
  references: string[];
  photographs: Photo[];
  installationRecord: { basis: string; sourceUrl: string; sections: { heading: string; kind: string; text: string }[] };
}
interface CaseStudy {
  slug: string;
  title: string;
  role: string;
  client: string;
  location: string;
  years: string | null;
  standfirst: string;
  wallcoverings: string[];
  gallery: { id: string; credit: string | null }[];
  published: string;
  updated: string;
  draft?: boolean;
  replaces: string | null;
}

const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, 'utf8')) as T;
const visibleText = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');

async function sourceStudies(): Promise<{ data: CaseStudy; body: string }[]> {
  return Promise.all((await readdir('src/content/case-studies')).filter((name) => name.endsWith('.md')).map(async (name) => {
    const text = await readFile(`src/content/case-studies/${name}`, 'utf8');
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)!;
    return { data: JSON.parse(frontmatter[1]) as CaseStudy, body: text.slice(frontmatter[0].length) };
  }));
}

test('crawler entry point is indexable, canonical, readable without scripts and linked from existing discovery formats', async () => {
  const html = await readFile(`dist${CRAWLER}index.html`, 'utf8');
  assert.match(html, /<h1[^>]*>Wallcovering Installation AI Crawler<\/h1>/);
  assert.equal(html.match(/<h1[\s>]/g)?.length, 1);
  assert.ok(html.includes(`<link rel="canonical" href="${SITE}${CRAWLER}">`));
  assert.doesNotMatch(html, /<meta name="robots" content="noindex">/);
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)![1];
  assert.match(main, /id="practice"/);
  assert.match(main, /id="projects"/);
  assert.match(main, /same published content/);
  for (const href of ['/ai/business.json', '/ai/projects.json', '/llms.txt', '/llms-full.txt', '/contact/', '/facts.json', '/for-ai/']) {
    assert.ok(main.includes(`href="${href}"`), `missing ${href}`);
  }
  for (const file of ['dist/llms.txt', 'dist/for-ai/index.html', 'dist/sitemap-0.xml']) {
    assert.ok((await readFile(file, 'utf8')).includes(CRAWLER), `${file} must discover the resource`);
  }
  for (const file of ['dist/llms.txt', 'dist/for-ai/index.html']) {
    const text = await readFile(file, 'utf8');
    assert.ok(text.includes('/ai/business.json'));
    assert.ok(text.includes('/ai/projects.json'));
  }
  const markdown = await readFile(`dist${CRAWLER}index.md`, 'utf8');
  const full = await readFile('dist/llms-full.txt', 'utf8');
  assert.ok(markdown.includes('# Wallcovering Installation AI Crawler'));
  assert.ok(full.includes(`URL: ${SITE}${CRAWLER}`));
  assert.ok(markdown.includes('References & photograph credits'), 'native details content must reach the plain-text version');
});

test('business JSON is an allowlisted copy of public facts, services and coverage visible on the resource page', async () => {
  const facts = await readJson<{ brand: string; description: string; founder: { name: string; jobTitle: string; path: string; fragment: string }; email: string; place: string; coverage: string; lastReviewed: string; profiles: { name: string; handle: string; url: string }[] }>('src/data/facts.json');
  const business = await readJson<{ schemaVersion: string; name: string; website: string; sourceUrl: string; description: string; lastReviewed: string; founder: { name: string; jobTitle: string; url: string }; base: string; coverage: string; contact: { email: string; url: string }; profiles: typeof facts.profiles; services: { name: string; description: string; url: string }[]; areas: { name: string; url: string }[] }>('dist/ai/business.json');
  assert.equal(business.schemaVersion, '1.1');
  assert.equal(business.name, facts.brand);
  assert.equal(business.website, SITE);
  assert.equal(business.sourceUrl, `${SITE}${CRAWLER}`);
  assert.equal(business.description, facts.description);
  assert.equal(business.base, facts.place);
  assert.equal(business.coverage, facts.coverage);
  assert.equal(business.lastReviewed, facts.lastReviewed);
  assert.equal(business.founder.name, facts.founder.name);
  assert.equal(business.founder.jobTitle, facts.founder.jobTitle);
  assert.equal(business.founder.url, `${SITE}${facts.founder.path}#${facts.founder.fragment}`);
  assert.deepEqual(business.contact, { email: facts.email, url: `${SITE}/contact/` });
  assert.deepEqual(business.profiles, facts.profiles);
  const specialisms = await readJson<{ items: { name: string; description: string; slug: string }[] }>('src/content/specialisms.json');
  assert.deepEqual(business.services, specialisms.items.map((item) => ({ name: item.name, description: item.description, url: `${SITE}/services/${item.slug}/` })));
  const areas = await readJson<{ items: { name: string; slug: string }[] }>('src/content/areas.json');
  assert.deepEqual(business.areas, areas.items.map((item) => ({ name: item.name, url: `${SITE}/areas/${item.slug}/` })));
  const html = await readFile(`dist${CRAWLER}index.html`, 'utf8');
  const text = visibleText(html);
  for (const value of [business.name, business.description, business.coverage, business.founder.name, business.contact.email]) assert.ok(text.includes(value), value);
  for (const item of business.services) {
    assert.ok(text.includes(item.name));
    assert.ok(text.includes(item.description));
    await stat(`dist${new URL(item.url).pathname}index.html`);
  }
});

test('every published project preserves exact roles, material names, project periods, content dates and photograph credits', async () => {
  const payload = await readJson<{ projects: CrawlerProject[] }>('dist/ai/projects.json');
  const studies = await sourceStudies();
  const published = studies.filter(({ data }) => !data.draft);
  const base = await readJson<{ items: { slug: string }[] }>('src/content/projects.json');
  const replaced = new Set(published.map(({ data }) => data.replaces ?? data.slug));
  assert.deepEqual(payload.projects.map((item) => item.slug).sort(), [...published.map(({ data }) => data.slug), ...base.items.filter((item) => !replaced.has(item.slug)).map((item) => item.slug)].sort());
  const html = await readFile(`dist${CRAWLER}index.html`, 'utf8');
  const text = visibleText(html);
  const credited = await readJson<Record<string, { manifestNote: string }>>('src/content/credited-media.json');
  for (const { data, body } of studies) {
    const project = payload.projects.find((item) => item.slug === data.slug);
    if (data.draft) {
      assert.equal(project, undefined, `draft ${data.slug}`);
      assert.equal(html.includes(`/projects/${data.slug}/`), false);
      continue;
    }
    assert.ok(project, data.slug);
    assert.equal(project.title, data.title);
    assert.equal(project.role, data.role);
    assert.equal(project.client, data.client);
    assert.equal(project.location, data.location);
    assert.equal(project.projectDates, data.years);
    assert.deepEqual(project.materials, data.wallcoverings.length ? data.wallcoverings : null);
    assert.equal(project.published, data.published);
    assert.equal(project.updated, data.updated);
    assert.equal(project.url, `${SITE}/projects/${data.slug}/`);
    assert.equal(project.summary, data.standfirst);
    assert.deepEqual(project.photographs.map(({ id, credit }) => ({ id, credit })), data.gallery);
    for (const value of [project.title, project.role, project.client, project.location, project.projectDates, ...(project.materials ?? [])]) {
      if (value !== null) assert.ok(text.includes(value), `${data.slug}: HTML omits ${value}`);
    }
    for (const url of project.references) {
      assert.ok(/^https?:/.test(url));
      assert.ok(body.includes(url), `${data.slug}: reference not in source ${url}`);
      assert.ok(html.includes(`href="${url.replace(/&/g, '&amp;')}"`), `${data.slug}: reference not visible ${url}`);
    }
    for (const photo of project.photographs) {
      assert.ok(photo.url.startsWith(`${SITE}/media/`));
      await stat(`dist${new URL(photo.url).pathname}`);
      if (photo.credit !== null) assert.ok(text.includes(photo.credit), `${data.slug}: missing credit ${photo.credit}`);
      for (const url of photo.sourceUrls) assert.ok(credited[photo.id]?.manifestNote.includes(url), `${photo.id}: source not in provenance`);
    }
  }
  const silverstone = payload.projects.find((item) => item.slug === 'hilton-garden-inn-silverstone')!;
  assert.equal(silverstone.projectDates, null, 'the name-only hotel list must not supply missing project dates');
  assert.ok(payload.projects.some((project) => project.photographs.some((photo) => photo.credit === null)), 'unknown photograph credits remain null');
  const owo = payload.projects.find((project) => project.slug === 'raffles-london-the-owo')!;
  assert.ok(owo.references.includes('https://www.raffles.com/london/rooms-and-suites/'), 'case-study sources must be discoverable');
});

test('structured endpoints preserve privacy and record limitations without adding unsupported claims', async () => {
  const business = await readFile('dist/ai/business.json', 'utf8');
  const projects = await readFile('dist/ai/projects.json', 'utf8');
  const decision = await readFile('dist/ai/decision-guide.json', 'utf8');
  for (const text of [business, projects, decision]) {
    assert.doesNotMatch(text, /"(?:phone|telephone|price|aggregateRating|award|apiKey|token|_note|manifestNote|placeholder)"\s*:/i);
    assert.doesNotMatch(text, /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}|\b020\s?\d{4}\s?\d{4}\b/);
    assert.doesNotMatch(text, /\/Users\/|localhost|SITE_PHONE|data:image/);
  }
  for (const { data } of await sourceStudies()) {
    if (data.draft) assert.equal(decision.includes(`/projects/${data.slug}/`), false, `decision guide mentions draft ${data.slug}`);
  }
  const payload = JSON.parse(projects) as { fieldNotes: Record<string, string> };
  const page = visibleText(await readFile(`dist${CRAWLER}index.html`, 'utf8'));
  for (const value of Object.values(payload.fieldNotes)) assert.ok(page.includes(value), 'HTML must carry the interpretation notes from JSON');
  assert.ok(payload.fieldNotes.nullValues.includes('null'));
  assert.ok(payload.fieldNotes.references.includes('do not independently confirm'));
  assert.ok(payload.fieldNotes.materials.includes('endorsement'));
});

interface EvidenceLink { title: string; url: string; role: string; projectDates: string | null; basis: string }
interface DecisionGuide {
  schemaVersion: string;
  resourceReviewed: string;
  purpose: string;
  overview: Record<string, string>;
  evidencePolicy: Record<string, string>;
  shortlistReasons: { id: string; title: string; relevance: string; recorded: string; confirm: string; evidence: EvidenceLink }[];
  fitMatrix: { id: string; audience: string; considerWhen: string; evidence: EvidenceLink[]; source: { title: string; url: string }; confirm: string[] }[];
  materialCapabilities: { name: string; sourceUrl: string; serviceUrl: string; setting: string; appearance: string; joins: string; care: string; handling: string; considerWhen: string; tradeoff: string; confirmBeforeOrdering: string; relatedServiceProjects: (EvidenceLink & { relation: string })[]; evidenceNote: string }[];
  deliveryStages: { name: string; description: string; paragraphs: string[]; url: string }[];
  aftercare: Record<string, unknown>;
  briefInputs: { title: string; items: string[]; source: { title: string; url: string } }[];
  professionalChecklists: { audience: string; items: string[]; sourceUrl: string }[];
  confirmForCommission: { subject: string; status: string; request: string }[];
  handoff: { description: string; instructions: string[]; minimumToEnquire: string; template: { requester: { name: null; email: null; permissionToShare: false }; [key: string]: unknown } };
}

test('decision guide is substantive, source-linked and has complete visible HTML parity', async () => {
  const guide = await readJson<DecisionGuide>('dist/ai/decision-guide.json');
  const html = await readFile(`dist${CRAWLER}index.html`, 'utf8');
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)![1];
  const text = visibleText(main);
  const present = (value: string) => assert.ok(text.includes(value.replace(/\s+/g, ' ')), `decision content missing from HTML: ${value.slice(0, 100)}`);
  assert.equal(guide.schemaVersion, '1.1');
  assert.equal(guide.resourceReviewed, '2026-10-10');
  present(guide.purpose);
  Object.values(guide.overview).forEach(present);
  Object.values(guide.evidencePolicy).forEach(present);
  assert.equal(guide.shortlistReasons.length, 4);
  for (const reason of guide.shortlistReasons) {
    [reason.title, reason.relevance, reason.recorded, reason.confirm, reason.evidence.title, reason.evidence.role, reason.evidence.basis].forEach(present);
  }
  assert.deepEqual(guide.fitMatrix.map((row) => row.id).sort(), ['hotels', 'designers', 'homes', 'retail', 'events', 'developers', 'existing-paper', 'aftercare'].sort());
  for (const row of guide.fitMatrix) [row.audience, row.considerWhen, row.source.title, ...row.confirm].forEach(present);
  assert.match(main, /<table[^>]*class="crawler-fit-table"/);
  assert.match(main, /<caption[^>]*>/);
  assert.ok((main.match(/scope="row"/g)?.length ?? 0) >= 8);
  assert.match(main, /role="region"[^>]*aria-label="Project fit comparison"[^>]*tabindex="0"/);
  for (const material of guide.materialCapabilities) {
    [material.name, material.setting, material.appearance, material.joins, material.care, material.handling, material.considerWhen, material.tradeoff, material.confirmBeforeOrdering, material.evidenceNote].forEach(present);
    for (const link of material.relatedServiceProjects) present(link.relation);
  }
  for (const stage of guide.deliveryStages) [stage.name, ...stage.paragraphs].forEach(present);
  for (const group of guide.briefInputs) [group.title, ...group.items, group.source.title].forEach(present);
  for (const group of guide.professionalChecklists) [group.audience, ...group.items].forEach(present);
  for (const item of guide.confirmForCommission) [item.subject, item.status, item.request].forEach(present);
  [guide.handoff.description, guide.handoff.minimumToEnquire, ...guide.handoff.instructions].forEach(present);
  const code = main.match(/<pre[^>]*class="crawler-template"[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>/)![1];
  assert.deepEqual(JSON.parse(visibleText(code)), guide.handoff.template, 'the displayed blank brief must be exactly the JSON template');
  assert.deepEqual(guide.handoff.template.requester, { name: null, email: null, permissionToShare: false });
  assert.doesNotMatch(await readFile('src/pages/wallcovering-installation-ai-crawler.astro', 'utf8'), /fetch\(|XMLHttpRequest|<form\b/);
  for (const file of ['dist/llms.txt', 'dist/for-ai/index.html']) assert.ok((await readFile(file, 'utf8')).includes('/ai/decision-guide.json'));
});

test('all decision evidence points to a published record and carries that record’s exact role and project period', async () => {
  const guide = await readJson<DecisionGuide>('dist/ai/decision-guide.json');
  const { projects } = await readJson<{ projects: CrawlerProject[] }>('dist/ai/projects.json');
  const links = [
    ...guide.shortlistReasons.map((reason) => reason.evidence),
    ...guide.fitMatrix.flatMap((row) => row.evidence),
    ...guide.materialCapabilities.flatMap((material) => material.relatedServiceProjects),
  ];
  assert.ok(links.length > 15);
  for (const link of links) {
    const project = projects.find((item) => item.url === link.url);
    assert.ok(project, `${link.url} is not in the published portfolio`);
    assert.equal(link.title, project.title);
    assert.equal(link.role, project.role);
    assert.equal(link.projectDates, project.projectDates);
    assert.equal(link.basis, 'Company-reported project record');
  }
  // Inspect every internal URL in the decision payload, including guide sources and service anchors.
  const urls = new Set<string>();
  function collect(value: unknown) {
    if (typeof value === 'string' && value.startsWith(`${SITE}/`)) urls.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  }
  collect(guide);
  assert.ok(urls.size >= 25);
  for (const value of urls) {
    const url = new URL(value);
    const file = `dist${url.pathname}${url.pathname.endsWith('/') ? 'index.html' : ''}`;
    const content = await readFile(file, 'utf8');
    if (file.endsWith('.html')) {
      assert.doesNotMatch(content, /http-equiv="refresh"|<meta name="robots" content="noindex">/, value);
      if (url.hash) assert.ok(content.includes(`id="${url.hash.slice(1)}"`), `unresolved anchor ${value}`);
    }
  }
  for (const material of guide.materialCapabilities) {
    assert.equal('projectEvidence' in material, false, 'service links must not masquerade as material-use proof');
    for (const link of material.relatedServiceProjects) assert.match(link.relation, /does not establish use of this material family/);
  }
});

test('delivery and aftercare preserve every source paragraph, including guarantee exclusions and material seam limits', async () => {
  const guide = await readJson<DecisionGuide>('dist/ai/decision-guide.json');
  const services = await readJson<{ pillars: { title: string; paragraphs: string[]; id: string }[] }>('src/content/services.json');
  assert.deepEqual(guide.deliveryStages, services.pillars.map((stage) => ({ name: stage.title, description: stage.paragraphs[0], paragraphs: stage.paragraphs, url: `${SITE}/services/#${stage.id}` })));
  const source = await readJson<Record<string, unknown>>('src/content/aftercare.json');
  for (const key of ['inspection', 'seams', 'callout', 'humidity', 'guarantee', 'care']) assert.deepEqual(guide.aftercare[key], source[key], `altered aftercare.${key}`);
  const html = visibleText(await readFile(`dist${CRAWLER}index.html`, 'utf8'));
  function checkVisible(value: unknown) {
    if (typeof value === 'string') assert.ok(html.includes(value), `aftercare term omitted: ${value}`);
    else if (Array.isArray(value)) value.forEach(checkVisible);
    else if (value && typeof value === 'object') Object.values(value).forEach(checkVisible);
  }
  for (const key of ['inspection', 'seams', 'callout', 'humidity', 'guarantee', 'care']) checkVisible(guide.aftercare[key]);
  const materials = await readJson<{ items: { name: string; joins: string; care: string; handling: string; decision: { considerWhen: string; tradeoff: string; checkBeforeOrdering: string } }[] }>('src/content/materials.json');
  for (const material of guide.materialCapabilities) {
    const original = materials.items.find((item) => item.name === material.name)!;
    assert.equal(material.joins, original.joins);
    assert.equal(material.care, original.care);
    assert.equal(material.handling, original.handling);
    assert.equal(material.considerWhen, original.decision.considerWhen);
    assert.equal(material.tradeoff, original.decision.tradeoff);
    assert.equal(material.confirmBeforeOrdering, original.decision.checkBeforeOrdering);
  }
  assert.match(guide.materialCapabilities.find((item) => item.name === 'Grasscloth and natural weaves')!.joins, /Seams show/);
});

test('project extracts preserve the installation wording and keep external context separate', async () => {
  const { projects } = await readJson<{ projects: CrawlerProject[] }>('dist/ai/projects.json');
  const sources = await sourceStudies();
  const html = visibleText(await readFile(`dist${CRAWLER}index.html`, 'utf8'));
  let checked = 0;
  for (const project of projects) {
    const original = sources.find(({ data }) => data.slug === project.slug)!;
    assert.equal(original.data.draft ?? false, false);
    assert.equal(project.installationRecord.basis, 'Company-reported project record');
    assert.equal(project.installationRecord.sourceUrl, project.url);
    for (const section of project.installationRecord.sections) {
      assert.ok(['scope', 'approach', 'outcome'].includes(section.kind));
      const start = original.body.indexOf(`## ${section.heading}\n`);
      assert.ok(start >= 0, `${project.slug}: heading absent ${section.heading}`);
      const tail = original.body.slice(start + section.heading.length + 4);
      const end = tail.indexOf('\n## ');
      const source = end < 0 ? tail : tail.slice(0, end);
      // Compare words independently of presentation markup, while keeping punctuation and numbers.
      const words = (text: string) => text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*#]/g, '').replace(/\s+/g, ' ').trim();
      assert.equal(words(section.text), words(source), `${project.slug}: altered source extract ${section.heading}`);
      assert.ok(html.includes(section.text.replace(/\s+/g, ' ')), `${project.slug}: source extract absent in HTML`);
      checked += 1;
    }
  }
  assert.ok(checked >= 40, `${checked} installation sections checked`);
  const event = projects.find((project) => project.slug === 'calico-ahluwalia-estuary-rosewood')!;
  assert.ok(event.installationRecord.sections.some((section) => section.text.includes('We did not hang them at the hotel.')), 'workshop/venue distinction must survive extraction');
});
