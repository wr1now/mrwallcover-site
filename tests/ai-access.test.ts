import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { serve, launchBrowser } from '../scripts/visual-browser.mjs';

const route = '/wallcovering-installation-ai-crawler/';
const endpoints = ['/ai/index.json', '/ai/pages.json', '/ai/business.json', '/ai/projects.json', '/ai/decision-guide.json', '/ai/wallpapering.json', '/ai/fire-ratings.json'];

test('machine reference and datasets are discoverable in initial HTML and existing text entry points', async () => {
  const html = await readFile(`dist${route}index.html`, 'utf8');
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)![1];
  assert.doesNotMatch(main, /<script\b|<iframe\b|<canvas\b|<form\b/);
  assert.match(main, /id="machine-access"/);
  assert.match(main, /Semantic records/);
  assert.match(main, /same main content/);
  assert.match(main, /Private enquiries and unpublished drafts are excluded/);
  const disclosures = [...main.matchAll(/<details\b([^>]*)>/g)];
  assert.ok(disclosures.length > 10, 'the complete evidence and terms remain in HTML');
  for (const disclosure of disclosures) assert.match(disclosure[1], /\bopen\b/, 'reference content starts expanded');
  for (const file of [`dist${route}index.html`, 'dist/for-ai/index.html', 'dist/llms.txt']) {
    const content = await readFile(file, 'utf8');
    for (const endpoint of endpoints) assert.ok(content.includes(endpoint), `${file} discovers ${endpoint}`);
  }
  for (const file of ['dist/index.html', 'dist/services/index.html', 'dist/calculator/index.html']) {
    assert.match(await readFile(file, 'utf8'), /rel="describedby" type="application\/json" href="\/ai\/index.json"/);
  }
});

test('reference is readable without JavaScript, responsive and the same for crawler user agents', { timeout: 60000 }, async () => {
  const server = await serve('dist');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    for (const width of [360, 390, 768, 1024, 1280, 1440]) {
      await page.setViewport({ width, height: 900 });
      const response = await page.goto(server.origin + route, { waitUntil: 'load' });
      assert.equal(response?.status(), 200);
      const state = await page.evaluate(() => {
        const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
        const luminance = (value: number[]) => value.slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, index) => sum + n * [.2126, .7152, .0722][index], 0);
        const lowContrast: string[] = [];
        for (const element of document.querySelectorAll<HTMLElement>('main a, main p, main dt, main summary, main h1, main h2')) {
          let parent: HTMLElement | null = element;
          let background: number[] = [255, 255, 255];
          while (parent) {
            const colour = rgb(getComputedStyle(parent).backgroundColor);
            if (colour.length < 4 || colour[3] === 1) { background = colour; break; }
            parent = parent.parentElement;
          }
          const foreground = luminance(rgb(getComputedStyle(element).color));
          const surface = luminance(background);
          const ratio = (Math.max(foreground, surface) + .05) / (Math.min(foreground, surface) + .05);
          if (ratio < 4.5) lowContrast.push(`${element.tagName}: ${element.textContent?.trim().slice(0, 60)} (${ratio.toFixed(2)})`);
        }
        return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        heading: document.querySelectorAll('main h1').length,
        hidden: [...document.querySelectorAll('main details')].some(d => !(d as HTMLDetailsElement).open),
        copy: document.querySelector('main')!.textContent,
        font: getComputedStyle(document.querySelector('main h1')!).fontFamily,
        lowContrast,
      }; });
      assert.equal(state.overflow, false, `no page overflow at ${width}px`);
      assert.equal(state.heading, 1);
      assert.equal(state.hidden, false);
      assert.match(state.copy!, /Reading the record/);
      assert.match(state.font, /monospace/);
      assert.deepEqual(state.lowContrast, [], `reference text contrast at ${width}px`);
    }
    const ordinary = await (await fetch(server.origin + route)).text();
    for (const agent of ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'PerplexityBot']) {
      assert.equal(await (await fetch(server.origin + route, { headers: { 'User-Agent': agent } })).text(), ordinary, agent);
    }
    for (const endpoint of endpoints) {
      const response = await fetch(server.origin + endpoint);
      assert.equal(response.status, 200, endpoint);
      assert.match(response.headers.get('content-type')!, /application\/json/);
      await response.json();
    }
    await page.close();
  } finally {
    await browser.close();
    await server.close();
  }
});
