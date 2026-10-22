import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (file: string) => readFile(file, 'utf8');
const main = (html: string) => html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
const methodSection = (html: string) => main(html).match(/<section\b[^>]*aria-labelledby="method-heading"[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';
const normal = (text: string) => text.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

test('exterior case studies describe exterior work without inheriting wallpaper guarantees', async () => {
  const exterior = JSON.parse(await read('src/content/method-exterior.json')) as { title: string; items: { title: string; text: string }[] };
  const wallpaper = JSON.parse(await read('src/content/method.json')) as typeof exterior;
  for (const slug of ['inverness-terrace', 'pimlico-st-georges-square']) {
    const html = await read(`dist/projects/${slug}/index.html`);
    const method = methodSection(html);
    assert.ok(method, `${slug}: method section exists`);
    assert.ok(normal(method).includes(exterior.title), `${slug}: correct method selected`);
    assert.equal((method.match(/<li\b/g) ?? []).length, exterior.items.length);
    assert.doesNotMatch(method, /guarantee|twelve months|batch and shade|pattern.*focal|before anyone orders paper/i);
    assert.ok(method.includes('href="/services/exterior-works/"'));
    assert.ok(method.includes('href="/details/"'), 'existing detail destination preserved with wallcovering context');
    assert.match(method, /For our wallcovering work:/);
    const twin = await read(`dist/projects/${slug}/index.md`);
    for (const item of exterior.items) {
      assert.ok(normal(method).includes(normal(item.text)), `${slug}: exterior fact in HTML`);
      assert.ok(normal(twin).includes(normal(item.text)), `${slug}: exterior fact in Markdown`);
    }
    assert.doesNotMatch(twin, /workmanship is guaranteed for twelve months/);
  }
  const interior = methodSection(await read('dist/projects/browns-hotel-mayfair/index.html'));
  assert.ok(normal(interior).includes(wallpaper.title));
  assert.ok(normal(interior).includes(wallpaper.items.at(-1)!.text), 'interior return visit and guarantee remain intact');
});

test('quotation and cost-factor journeys retain their URLs, enquiry action and exact existing FAQ answers', async () => {
  const source = await read('src/content/pages/cost-guide-2026.md');
  const metadata = JSON.parse(source.match(/^---\n([\s\S]*?)\n---/)![1]) as { faq: { question: string; paragraphs: string[] }[] };
  const html = await read('dist/advice/cost/index.html');
  const body = main(html);
  const twin = await read('dist/advice/cost/index.md');
  assert.match(html, /<title>Wallpaper Installation Quotation Checklist \| Mr Wallcover<\/title>/);
  assert.match(body, /<h1[^>]*>What to send for a wallpaper installation quotation<\/h1>/);
  assert.ok(body.includes('href="/contact/?intent=install"'));
  assert.match(html, /rel="canonical" href="https:\/\/www\.mrwallcover\.com\/advice\/cost\/"/);
  const schema = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  const allNodes = schema.flatMap((node) => node['@graph'] ?? node);
  const faq = allNodes.find((node) => node['@type'] === 'FAQPage');
  assert.ok(faq, 'existing FAQ schema remains');
  for (const item of metadata.faq) {
    const expected = normal(item.paragraphs.join(' '));
    assert.ok(normal(body).includes(expected), `visible answer retained: ${item.question}`);
    assert.ok(normal(twin).includes(expected), `Markdown answer retained: ${item.question}`);
    const answer = faq.mainEntity.find((entry: { name: string }) => entry.name === item.question)?.acceptedAnswer.text;
    assert.equal(normal(answer ?? ''), expected, `FAQ structured answer matches visible source: ${item.question}`);
  }
  assert.ok(body.includes('href="/advice/installation-cost/"'));
  const detailed = main(await read('dist/advice/installation-cost/index.html'));
  assert.match(detailed, /What changes the cost of wallpaper installation\?/);
  assert.ok(detailed.includes('href="/advice/cost/"'), 'detailed explanation links to the practical checklist');
  for (const heading of ['The rooms and the location', 'The chosen wallcovering', 'Photographs and access', 'Preparation and timing', 'What the survey settles']) {
    assert.ok(normal(body).includes(heading));
    assert.ok(normal(twin).includes(heading));
  }
});

test('preparation lookup and designer evidence links remain readable in HTML and Markdown', async () => {
  const html = await read('dist/wallpapering/preparation/index.html');
  const twin = await read('dist/wallpapering/preparation/index.md');
  assert.match(html, /<title>Wallpaper Preparation Tables by Wall Type \| Mr Wallcover<\/title>/);
  assert.match(main(html), /<h1[^>]*>Wallpaper preparation tables<\/h1>/);
  assert.equal((main(html).match(/<table\b/g) ?? []).length, 2, 'both actual reference tables preserved');
  assert.ok(main(html).includes('href="/advice/wall-preparation/"'));
  assert.match(twin, /Wallpaper preparation tables/);
  assert.match(twin, /https:\/\/www\.mrwallcover\.com\/advice\/wall-preparation\//);
  const designer = main(await read('dist/advice/designer-specification-checklist/index.html'));
  const designerTwin = await read('dist/advice/designer-specification-checklist/index.md');
  assert.ok(designer.includes('href="/materials/specified-papers/"'));
  assert.match(normal(designer), /records an installation, not an endorsement/);
  assert.match(designerTwin, /https:\/\/www\.mrwallcover\.com\/materials\/specified-papers\//);
});
