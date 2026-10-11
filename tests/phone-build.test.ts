import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

/**
 * Builds the site twice, with and without SITE_PHONE, into temporary folders,
 * and checks what each build prints. 07700 900000 is Ofcom's reserved drama
 * range, not a real number.
 */
const run = promisify(execFile);
const FAKE = '07700900000';
const PHONE_PATTERN = /\b0?7\d{3}\s?\d{6}\b|\+?44\s?7\d{9}/;

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

async function build(withPhone: boolean): Promise<{ dir: string; html: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), `mw-phone-${withPhone ? 'on' : 'off'}-`));
  const env = { ...process.env };
  if (withPhone) env.SITE_PHONE = FAKE;
  else delete env.SITE_PHONE;
  await run(path.join('node_modules', '.bin', 'astro'), ['build', '--outDir', dir], { env, maxBuffer: 64 * 1024 * 1024 });
  const files = await htmlFiles(dir);
  assert.ok(files.length > 10, 'build produced pages');
  const html = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  return { dir, html };
}

test('without SITE_PHONE no phone or WhatsApp control is rendered and no payload is printed', { timeout: 180_000 }, async () => {
  const { dir, html } = await build(false);
  try {
    assert.doesNotMatch(html, /data-phone-reveal/);
    assert.doesNotMatch(html, /data-wa\b/);
    assert.doesNotMatch(html, /const payload =/);
    assert.doesNotMatch(html, /Show phone number|dock-phone/);
    assert.doesNotMatch(html, /WhatsApp/);
    assert.doesNotMatch(html, PHONE_PATTERN);
    assert.doesNotMatch(html, /wa\.me/);
    const contact = await readFile(path.join(dir, 'contact', 'index.html'), 'utf8');
    assert.match(contact, /Email is read by Dorin Burcus/);
    assert.doesNotMatch(contact, /shown on request/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('with SITE_PHONE the reveal control and WhatsApp link render, and the number appears only in the reversed payload', { timeout: 180_000 }, async () => {
  const { dir, html } = await build(true);
  try {
    assert.match(html, /data-phone-reveal/);
    assert.match(html, /<a href="\/contact\/" data-wa/);
    assert.doesNotMatch(html, PHONE_PATTERN, 'the number must never appear in clear');
    assert.doesNotMatch(html, /wa\.me/);
    const payloads = new Set([...html.matchAll(/const payload = "([^"]+)"/g)].map((m) => m[1]));
    assert.equal(payloads.size, 1, 'one payload, the same on every page');
    const decoded = JSON.parse(atob([...payloads][0]).split('').reverse().join(''));
    assert.equal(decoded.t, '+447700900000');
    assert.equal(decoded.d, '07700 900000');
    assert.match(decoded.w, /^https:\/\/wa\.me\/447700900000\?/);
    const contact = await readFile(path.join(dir, 'contact', 'index.html'), 'utf8');
    assert.match(contact, /shown on request/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
