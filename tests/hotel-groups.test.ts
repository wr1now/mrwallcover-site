import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The hotel-group strip (competitor-analysis follow-up e): plain-text names, no logos, each linked
// to published case studies at that group's hotels; only groups from the brief with a published
// case study, each tied to its hotels by the repo itself.
const BRIEF = ['Hilton', 'Four Seasons', 'Rosewood', 'Jumeirah', 'Ennismore', 'Raffles', 'Accor', 'Rocco Forte'];
const groups = JSON.parse(readFileSync('src/content/hotel-groups.json', 'utf8')).items as { name: string; projects: string[] }[];
const published = new Set(
  readdirSync('src/content/case-studies')
    .filter((f) => f.endsWith('.md'))
    .map((f) => JSON.parse(readFileSync(`src/content/case-studies/${f}`, 'utf8').split('\n---')[0].replace(/^---\n/, '')))
    .filter((fm) => !fm.draft)
    .map((fm) => fm.slug),
);
const sources = readFileSync('docs/sources.md', 'utf8');

test('hotel-groups.json: only groups from the brief, each with published case studies the repo ties to it', () => {
  for (const group of groups) {
    const token = BRIEF.find((b) => group.name.includes(b));
    assert.ok(token, `${group.name} is not one of the brief's groups`);
    assert.ok(group.projects.length > 0, `${group.name} has a published case study`);
    for (const slug of group.projects) {
      assert.ok(published.has(slug), `${slug} is published`);
      const md = readFileSync(`src/content/case-studies/${slug}.md`, 'utf8');
      assert.ok(md.includes(token!) || sources.includes(token!), `the repo ties ${slug} to ${token}`);
    }
  }
  // Rosewood London hosted a job for Calico Wallpaper and Ahluwalia; Rosewood was the venue, not the client.
  assert.ok(!groups.some((g) => /Rosewood/.test(g.name)));
});

for (const path of ['/professionals/hotels/', '/services/hotel-wallcovering-installation/']) {
  test(`${path}: the strip is plain text, no logos, every link a built case study`, () => {
    const h = readFileSync(`dist${path}index.html`, 'utf8');
    const at = h.indexOf('data-hotel-groups');
    assert.ok(at > 0, 'strip on the page');
    const strip = h.slice(at, h.indexOf('</section>', at));
    assert.doesNotMatch(strip, /<img|<svg|<picture|background-image/, 'no logos or images');
    for (const group of groups) {
      assert.ok(strip.includes(`>${group.name.replace('&', '&amp;')}</p>`), group.name);
      for (const slug of group.projects) assert.ok(strip.includes(`href="/projects/${slug}/"`), `${group.name} links ${slug}`);
    }
  });
}
