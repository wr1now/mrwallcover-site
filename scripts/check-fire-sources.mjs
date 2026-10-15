#!/usr/bin/env node
/**
 * On-demand check of every source behind /advice/wallcovering-fire-ratings-uk/.
 *
 *   npm run check:fire-sources            # report only; changes nothing
 *   npm run check:fire-sources -- --hash  # also re-hash PDFs that have a recorded sha256
 *
 * For each source in src/data/fire-ratings/sources.json it reports:
 * - the HTTP status (HEAD, falling back to GET), and any redirect target;
 * - whether a recorded SHA-256 still matches the document (with --hash), so a silently
 *   revised declaration or data sheet is noticed;
 * - stated expiry dates that have passed or fall within 90 days;
 * - regulatory effective dates that have passed since the last check (a forthcoming
 *   amendment that is now in force needs the page text reviewing);
 * - sources not opened for more than 92 days (the quarterly review).
 *
 * It never edits data or publishes anything. A change it reports is flagged for human review
 * (docs/research/fire-ratings/README.md, "Review and maintenance"); fire guidance is never updated
 * automatically. It is not part of CI and no schedule runs it.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const hashMode = process.argv.includes('--hash');
const { sources } = JSON.parse(readFileSync(new URL('../src/data/fire-ratings/sources.json', import.meta.url), 'utf8'));
const { products, checked } = JSON.parse(readFileSync(new URL('../src/data/fire-ratings/products.json', import.meta.url), 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const flags = [];
const flag = (id, text) => flags.push(`${id}: ${text}`);

async function fetchStatus(url) {
  const opts = { redirect: 'manual', headers: { 'user-agent': 'mrwallcover-source-check/1.0 (+https://www.mrwallcover.com/advice/wallcovering-fire-ratings-uk/)' }, signal: AbortSignal.timeout(20_000) };
  let res = await fetch(url, { ...opts, method: 'HEAD' }).catch(() => null);
  if (!res || res.status === 405 || res.status === 403) res = await fetch(url, { ...opts, method: 'GET' }).catch((e) => ({ status: `error ${e.cause?.code ?? e.name}` }));
  return { status: res.status, location: res.headers?.get?.('location') ?? null };
}

for (const s of sources) {
  const { status, location } = await fetchStatus(s.url);
  const ok = typeof status === 'number' && status >= 200 && status < 300;
  const redirect = typeof status === 'number' && status >= 300 && status < 400;
  console.log(`${ok ? 'ok  ' : redirect ? 'move' : 'FAIL'} ${status} ${s.id}${location ? ` -> ${location}` : ''}`);
  if (!ok && !redirect) flag(s.id, `HTTP ${status} for ${s.url}`);
  if (redirect) flag(s.id, `redirects to ${location}; confirm it is the same document`);
  if (s.statedExpiry) {
    const left = days(today, s.statedExpiry);
    if (left < 0) flag(s.id, `stated expiry ${s.statedExpiry} has passed`);
    else if (left <= 90) flag(s.id, `stated expiry ${s.statedExpiry} is within 90 days`);
  }
  if (s.effective && s.effective <= today && s.effective > s.accessed) flag(s.id, `came into force ${s.effective}, after it was last checked (${s.accessed}); review the page text`);
  if (days(s.accessed, today) > 92) flag(s.id, `last checked ${s.accessed}, more than a quarter ago`);
  if (hashMode && s.sha256 && ok) {
    const res = await fetch(s.url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
    if (res?.ok) {
      const hash = createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex');
      if (hash !== s.sha256) flag(s.id, `document has changed since it was read (sha256 ${hash.slice(0, 12)}… recorded ${s.sha256.slice(0, 12)}…)`);
    }
  }
}
if (days(checked, today) > 92) flag('products.json', `product evidence last checked ${checked}, more than a quarter ago`);
for (const p of products) if (p.status !== 'current') flag(p.id, `status is ${p.status}`);

console.log(`\n${sources.length} sources, ${products.length} product rows.`);
if (flags.length) {
  console.log(`\nFor review (${flags.length}):\n- ${flags.join('\n- ')}`);
  process.exitCode = 1;
} else console.log('Nothing to review.');
