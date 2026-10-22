import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

/**
 * Builds the site with the Umami settings (owner's choice, 14 Oct 2026) into a temporary folder and checks
 * the script, the event allow-list and the privacy wording. The website ID is a fixture, not a real account.
 * The default build (no PUBLIC_ANALYTICS_SRC) is checked to load nothing.
 */
const run = promisify(execFile);
const SRC = 'https://cloud.umami.is/script.js';
const ID = '00000000-0000-4000-8000-000000000000';

async function build(on: boolean) {
  const dir = await mkdtemp(path.join(tmpdir(), `mw-analytics-${on ? 'on' : 'off'}-`));
  const env = { ...process.env };
  if (on) Object.assign(env, { PUBLIC_ANALYTICS_SRC: SRC, PUBLIC_ANALYTICS_WEBSITE_ID: ID });
  else {
    delete env.PUBLIC_ANALYTICS_SRC;
    delete env.PUBLIC_ANALYTICS_WEBSITE_ID;
  }
  await run(path.join('node_modules', '.bin', 'astro'), ['build', '--outDir', dir], { env, maxBuffer: 64 * 1024 * 1024 });
  const read = (file: string) => readFile(path.join(dir, file), 'utf8');
  return { dir, home: await read('index.html'), calculator: await read('calculator/index.html'), privacy: await read('privacy/index.html'), llms: await read('llms.txt') };
}

test('analytics on: Umami loads on the live host only, honours Do Not Track, ignores query and hash, and passes only the three calculator events', async () => {
  const on = await build(true);
  try {
    for (const html of [on.home, on.calculator]) {
      const tag = html.match(/<script[^>]*src="https:\/\/cloud\.umami\.is\/script\.js"[^>]*>/)?.[0] ?? '';
      assert.ok(tag, 'the Umami script is in the page');
      for (const attr of [`data-website-id="${ID}"`, 'data-domains="www.mrwallcover.com"', 'data-do-not-track="true"', 'data-exclude-search="true"', 'data-exclude-hash="true"', 'defer']) assert.ok(tag.includes(attr), attr);
      assert.match(html, /window\.__mwTrack = function/);
      assert.match(html, /calculator_complete/);
      assert.match(html, /measurements_click/);
      assert.match(html, /check_click/);
    }
    assert.match(on.privacy, /This site counts visits with Umami, a cookie-free analytics tool\./);
    assert.match(on.privacy, /cookie-free visit counts this site keeps with Umami/);
    assert.doesNotMatch(on.privacy, /does not run analytics|It is switched off on this site as published/);
    assert.match(on.llms, /cookie-free visit counts with Umami/);
  } finally {
    await rm(on.dir, { recursive: true, force: true });
  }
});

test('analytics off: no script, no event sink, and the privacy notice says no analytics run', async () => {
  const off = await build(false);
  try {
    for (const html of [off.home, off.calculator]) {
      assert.doesNotMatch(html, /<script[^>]*umami/i);
      assert.doesNotMatch(html, /umami\.track/);
      assert.doesNotMatch(html, /window\.__mwTrack = function/);
    }
    assert.match(off.privacy, /does not run analytics/);
    assert.match(off.privacy, /The quantity calculator works in this browser\./);
    assert.match(off.llms, /no cookies and no analytics by default/);
  } finally {
    await rm(off.dir, { recursive: true, force: true });
  }
});
