import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { build as buildAiLayer } from '../scripts/build-ai-layer.mjs';
import { expectedReaderMirrorFiles } from '../scripts/ai-reader-mirror.mjs';

/**
 * Builds the site three times into temporary folders: without SITE_PHONE and
 * with two different values from Ofcom's reserved drama range. Checks the public
 * channel copy, payload exclusion and number-independent reader mirror bytes.
 */
const run = promisify(execFile);
const FAKE = '07700900000';
const OTHER_FAKE = '07700900001';
const PHONE_PATTERN = /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}/;

async function trackedMirrorSnapshot(dir = 'ai-reference'): Promise<Record<string, string>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: Record<string, string> = {};
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(out, await trackedMirrorSnapshot(file));
    else out[file] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
  return out;
}

function mirrorDigests(files: Map<string, string>) {
  return [...files].map(([name, text]) => [name, createHash('sha256').update(text).digest('hex')]);
}

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// A fixture, never the real booking page: the real URL lives in src/config.ts.
const BOOKING_FIXTURE = 'https://calendar.app.google/TEST-FIXTURE-not-real';

async function build(withPhone: boolean, phone = FAKE): Promise<{ dir: string; html: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), `mw-phone-${withPhone ? 'on' : 'off'}-`));
  const mirrorBefore = await trackedMirrorSnapshot();
  const env = { ...process.env };
  if (withPhone) env.SITE_PHONE = phone;
  else delete env.SITE_PHONE;
  // The phone build also sets a booking URL; the other build forces it empty, whatever src/config.ts holds.
  env.BOOKING_URL = withPhone ? BOOKING_FIXTURE : '';
  await run(path.join('node_modules', '.bin', 'astro'), ['build', '--outDir', dir], { env, maxBuffer: 64 * 1024 * 1024 });
  await buildAiLayer(dir);
  assert.deepEqual(await trackedMirrorSnapshot(), mirrorBefore, 'a real phone fixture build and its postbuild hook never mutate the tracked production mirror');
  const files = await htmlFiles(dir);
  assert.ok(files.length > 10, 'build produced pages');
  const html = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  return { dir, html };
}

async function assertAiExportsHaveNoPhone(dir: string) {
  for (const name of ['ai/index.json', 'ai/pages.json', 'llms-full.txt', 'get-in-touch/index.md', 'contact/index.md']) {
    const text = await readFile(path.join(dir, name), 'utf8');
    assert.doesNotMatch(text, PHONE_PATTERN, `${name}: no phone number in the machine-readable layer`);
    assert.doesNotMatch(text, /data-phone-reveal|const payload|data-endpoint|"(?:telephone|phone)"\s*:/i, `${name}: no phone or form payload`);
    assert.equal(text.includes(FAKE), false, `${name}: no input/default/reveal value`);
  }
}

test('without SITE_PHONE no phone or WhatsApp control is rendered and no payload is printed', { timeout: 180_000 }, async () => {
  const { dir, html } = await build(false);
  try {
    await assertAiExportsHaveNoPhone(dir);
    assert.doesNotMatch(html, /data-phone-reveal/);
    assert.doesNotMatch(html, /data-wa\b/);
    assert.doesNotMatch(html, /const payload =/);
    assert.doesNotMatch(html, /Show phone number|dock-phone/);
    assert.doesNotMatch(html, /WhatsApp/);
    assert.doesNotMatch(html, PHONE_PATTERN);
    assert.doesNotMatch(html, /wa\.me/);
    // With BOOKING_URL empty there is no booking button and no dead link.
    assert.doesNotMatch(html, /data-book|Book a 20-minute call|Book a call/);
    assert.doesNotMatch(html, /TEST-FIXTURE/);
    const contact = await readFile(path.join(dir, 'contact', 'index.html'), 'utf8');
    assert.doesNotMatch(contact, /contact-quick/);
    assert.match(contact, /Email is read by Dorin Burcus/);
    assert.doesNotMatch(contact, /shown on request/);
    const mirror = await expectedReaderMirrorFiles({ distDir: dir });
    assert.match(mirror.get('pages/contact/index.md')!, /Or write directly\. Email is read by Dorin Burcus\./);
    assert.match(mirror.get('pages/get-in-touch/index.md')!, /Email is the simplest way in\./);
    assert.doesNotMatch(mirror.get('pages/get-in-touch/index.md')!, /### Phone\b|### WhatsApp\b/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('with SITE_PHONE the reveal control and WhatsApp link render, and the number appears only in the reversed payload', { timeout: 180_000 }, async () => {
  const { dir, html } = await build(true);
  try {
    await assertAiExportsHaveNoPhone(dir);
    assert.match(html, /data-phone-reveal/);
    assert.match(html, /<a href="\/contact\/" data-wa/);
    assert.doesNotMatch(html, PHONE_PATTERN, 'the number must never appear in clear');
    assert.doesNotMatch(html, /wa\.me/);
    const payloads = new Set([...html.matchAll(/const payload = "([^"]+)"/g)].map((m) => m[1]));
    assert.equal(payloads.size, 1, 'one payload, the same on every page');
    const decoded = JSON.parse(atob([...payloads][0]).split('').reverse().join(''));
    assert.equal(decoded.t, '+447700900000');
    assert.equal(decoded.d, '07700 900000');
    assert.equal(decoded.w, 'https://wa.me/447700900000?text=Hello%20Mr%20Wallcover%2C%20I%27d%20like%20to%20discuss%20a%20project%3A');
    // Every WhatsApp link: href /contact/ until the payload script swaps in wa.me, the glyph, the label, a new tab.
    const wa = [...html.matchAll(/<a\b[^>]*\bdata-wa\b[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);
    assert.ok(wa.length > 0);
    for (const a of wa) {
      assert.match(a, /^<a href="\/contact\/" data-wa/);
      assert.match(a, /aria-label="WhatsApp us \(opens WhatsApp\)"/);
      assert.match(a, /target="_blank"/);
      assert.match(a, /rel="noopener"/);
      assert.match(a, /<svg class="wa-glyph" viewBox="0 0 24 24"[^>]*aria-hidden="true"/);
    }
    const home = await readFile(path.join(dir, 'index.html'), 'utf8');
    const contact = await readFile(path.join(dir, 'contact', 'index.html'), 'utf8');
    assert.match(contact, /shown on request/);
    // Placements: the mobile dock, the desktop header beside "Start your project", the footer and the contact page.
    const dock = home.slice(home.indexOf('data-dock')).split('</nav>')[0];
    const nav = home.slice(home.indexOf('class="primary-nav"')).split('</nav>')[0];
    const footer = home.slice(home.indexOf('<footer')).split('</footer>')[0];
    const quick = contact.slice(contact.indexOf('contact-quick')).split('</div>')[0];
    for (const [name, part] of [['dock', dock], ['footer', footer], ['contact', quick]] as const) {
      assert.match(part, /data-wa/, `WhatsApp in the ${name}`);
      assert.ok(part.includes(`href="${BOOKING_FIXTURE}"`), `booking in the ${name}`);
    }
    assert.ok(nav.indexOf('data-wa') < nav.indexOf('header-action'), 'WhatsApp sits just before Start your project');
    assert.match(quick, /Book a <span class="whitespace-nowrap">20-minute<\/span> call<\/span><\/a>/);
    const book = [...html.matchAll(/<a\b[^>]*\bdata-book\b[^>]*>/g)].map((m) => m[0]);
    for (const a of book) {
      assert.ok(a.includes(`href="${BOOKING_FIXTURE}"`));
      assert.match(a, /target="_blank"/);
      assert.match(a, /rel="noopener noreferrer"/);
      assert.match(a, /aria-label="Book a 20-minute call \(opens Google Calendar in a new tab\)"/);
    }
    const bookText = [...html.matchAll(/<a\b[^>]*\bdata-book\b[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
    assert.ok(bookText.length === book.length && bookText.every((t) => t === 'Book a 20-minute call'), 'the visible label is exactly "Book a 20-minute call"');
    assert.match(contact, /Calls Mon–Fri, 9am–5pm UK\./);
    assert.doesNotMatch(home, /Calls Mon–Fri/, 'the hours line is on the contact page only');
    // The phone reveal is unchanged: still a button, the number still only in the payload.
    assert.doesNotMatch(home, /<button\b[^>]*data-phone-reveal/);
    assert.doesNotMatch(nav, /data-book/);
    assert.match(nav, /href="\/get-in-touch\/"/);
    const touch = await readFile(path.join(dir, 'get-in-touch', 'index.html'), 'utf8');
    assert.match(touch, /<button\b[^>]*data-phone-reveal/);
    assert.match(touch, /data-wa/);
    const mirror = await expectedReaderMirrorFiles({ distDir: dir });
    assert.match(mirror.get('pages/contact/index.md')!, /The phone is answered by Dorin Burcus himself; the number is shown on request\./);
    assert.match(mirror.get('pages/get-in-touch/index.md')!, /Write, call or send a message, whichever suits you\./);
    assert.match(mirror.get('pages/get-in-touch/index.md')!, /### Phone\b/);
    assert.match(mirror.get('pages/get-in-touch/index.md')!, /### WhatsApp\b/);
    assert.match(mirror.get('pages/get-in-touch/index.md')!, /Select the button below to see the number\./, 'the fallback preserves the published conditional copy instead of normalising it away');
    const other = await build(true, OTHER_FAKE);
    try {
      await assertAiExportsHaveNoPhone(other.dir);
      const otherMirror = await expectedReaderMirrorFiles({ distDir: other.dir });
      assert.deepEqual(mirrorDigests(otherMirror), mirrorDigests(mirror), 'every sanitized production-mode mirror byte is independent of the particular phone number');
      for (const [name, text] of otherMirror) {
        assert.doesNotMatch(text, PHONE_PATTERN, `${name}: no phone number enters the versioned mirror`);
        assert.doesNotMatch(text, /data-phone-reveal|const payload|"(?:telephone|phone)"\s*:/i, `${name}: no encoded phone payload enters the versioned mirror`);
      }
    } finally { await rm(other.dir, { recursive: true, force: true }); }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
