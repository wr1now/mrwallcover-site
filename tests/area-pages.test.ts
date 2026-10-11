import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// Area pages (competitor-analysis follow-up b): Mayfair, Belgravia, Chelsea, Kensington and
// Knightsbridge are built only from real published jobs in the area. An area with at least two
// published case studies has a page that links every one of them; an area with fewer gets no new
// page (existing pages are kept, never removed).
const AREAS = ['Mayfair', 'Belgravia', 'Chelsea', 'Kensington', 'Knightsbridge'];
const areas = JSON.parse(readFileSync('src/content/areas.json', 'utf8')).items as { slug: string; name: string; projects: string[] }[];
const studies = readdirSync('src/content/case-studies')
  .filter((f) => f.endsWith('.md'))
  .map((f) => JSON.parse(readFileSync(`src/content/case-studies/${f}`, 'utf8').split('\n---')[0].replace(/^---\n/, '')))
  .filter((fm) => !fm.draft) as { slug: string; location: string }[];
// Chelsea has one published job on main (Masterpiece London 2019, Royal Hospital Chelsea), so it
// gets no change here. PR #43 publishes Penny Morrison (Chelsea), which brings it to two; Chelsea's
// page and its "No Chelsea commission is on the public record yet" caption are then updated in a
// follow-up, kept out of this PR because #43 edits the same lines of areas.json.
const FOLLOW_UP = new Set(['Chelsea']);
const inArea = (name: string) => studies.filter((s) => new RegExp(`\\b${name}\\b`).test(s.location));

for (const name of AREAS) {
  const jobs = inArea(name);
  const page = areas.find((a) => a.name === name);
  test(`${name}: ${jobs.length} published job(s); a page only from real jobs`, () => {
    if (jobs.length >= 2 && !FOLLOW_UP.has(name)) {
      assert.ok(page, `${name} has ${jobs.length} published jobs, so it needs an area page`);
      const h = readFileSync(`dist/areas/${page!.slug}/index.html`, 'utf8');
      for (const job of jobs) {
        assert.ok(page!.projects.includes(job.slug), `${name} lists ${job.slug}`);
        assert.ok(h.includes(`href="/projects/${job.slug}/"`), `/areas/${page!.slug}/ links ${job.slug}`);
        const study = readFileSync(`dist/projects/${job.slug}/index.html`, 'utf8');
        assert.ok(study.includes(`href="/areas/${page!.slug}/"`), `${job.slug} links back to /areas/${page!.slug}/`);
      }
    } else if (!page) {
      assert.ok(!existsSync(`dist/areas/${name.toLowerCase()}/index.html`), `no ${name} page from fewer than two jobs`);
    }
  });
}

test('every project an area page lists is a published job located in that area (or a project record)', () => {
  const records = (JSON.parse(readFileSync('src/content/projects.json', 'utf8')).items as { slug: string }[]).map((p) => p.slug);
  for (const area of areas) {
    for (const slug of area.projects) {
      const study = studies.find((s) => s.slug === slug);
      assert.ok(study || records.includes(slug), `${area.slug} lists ${slug}, which is not published`);
      if (study && AREAS.includes(area.name)) assert.match(study.location, new RegExp(`\\b${area.name}\\b`), `${slug} is not in ${area.name}`);
    }
  }
});
