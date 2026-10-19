#!/usr/bin/env node
/**
 * IndexNow: tell Bing, Yandex and the other IndexNow engines which URLs
 * changed. One POST to api.indexnow.org fans out to every participating
 * engine. Google does not use IndexNow; it reads the sitemap.
 *
 * The GitHub Pages workflow runs it in two halves around the deploy:
 * - `plan dist` (build job, before deploy) compares this build's sitemap with
 *   the one still live and prints, as a JSON array, the URLs that are new or
 *   carry a new <lastmod>. The sitemap dates are honest content dates
 *   (scripts/sitemap-lastmod.mjs), so an unchanged page is never resubmitted.
 *   `--all` prints every sitemap URL instead. It sends nothing.
 * - `send` (indexnow job, after deploy) posts the list in INDEXNOW_URLS.
 * Run by hand, `node scripts/indexnow-ping.mjs dist` posts every sitemap URL.
 *
 * Safe by default. Nothing is posted unless INDEXNOW_ENABLED=1, so a stray
 * `npm run indexnow` can never ping accidentally.
 *
 * The key file public/<key>.txt is served at https://www.mrwallcover.com/<key>.txt
 * so the engines can verify the host owns the key. Every post checks it is live first.
 *
 * Usage: node scripts/indexnow-ping.mjs plan [distDir] [--all]
 *        INDEXNOW_ENABLED=1 INDEXNOW_URLS='[...]' node scripts/indexnow-ping.mjs send
 *        INDEXNOW_ENABLED=1 node scripts/indexnow-ping.mjs [distDir]
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const HOST = 'www.mrwallcover.com';
const ORIGIN = `https://${HOST}`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

async function findKey() {
  const names = (await readdir(path.resolve('public'))).filter((name) => /^[0-9a-f]{32}\.txt$/.test(name));
  if (names.length !== 1) throw new Error(`expected exactly one public/<32 hex>.txt key file, found ${names.length}`);
  const key = names[0].slice(0, -4);
  const body = (await readFile(path.join('public', names[0]), 'utf8')).trim();
  if (body !== key) throw new Error(`public/${names[0]} must contain its own name as the key`);
  return key;
}

/** Every <url> on this host in one sitemap file, as url -> lastmod ('' when absent). */
export function parseSitemap(xml) {
  const entries = new Map();
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!loc) continue;
    const url = new URL(loc);
    if (url.host === HOST) entries.set(url.href, block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? '');
  }
  return entries;
}

/** URLs in `next` that `previous` lacks or dates differently, sorted. */
export function changedUrls(next, previous) {
  return [...next].filter(([url, lastmod]) => previous.get(url) !== lastmod).map(([url]) => url).sort();
}

/** The whole sitemap behind a sitemap index, read through `load(fileName)`. */
async function readSitemap(load) {
  const index = await load('sitemap-index.xml');
  const parts = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => path.basename(new URL(m[1]).pathname));
  if (parts.length === 0) throw new Error('the sitemap index lists no sitemaps');
  const entries = new Map();
  for (const part of parts) for (const [url, lastmod] of parseSitemap(await load(part))) entries.set(url, lastmod);
  return entries;
}

const distSitemap = (dist) => readSitemap((name) => readFile(path.join(dist, name), 'utf8'));

// The query string skips the Pages CDN cache, so this reads the release that is live now.
const liveSitemap = () =>
  readSitemap(async (name) => {
    const response = await fetch(`${ORIGIN}/${name}?indexnow=${Date.now()}`);
    if (!response.ok) throw new Error(`live ${name}: ${response.status} ${response.statusText}`);
    return response.text();
  });

async function post(urlList) {
  if (process.env.INDEXNOW_ENABLED !== '1') {
    console.log('[indexnow] INDEXNOW_ENABLED is not 1; nothing sent.');
    return;
  }
  if (urlList.length === 0) {
    console.log('[indexnow] no URLs to send.');
    return;
  }
  const key = await findKey();
  const keyLocation = `${ORIGIN}/${key}.txt`;
  const live = await fetch(keyLocation);
  if (!live.ok || (await live.text()).trim() !== key) throw new Error(`${keyLocation} does not serve the key (${live.status})`);
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key, keyLocation, urlList }),
  });
  // 200 OK, 202 Accepted (key validation pending); anything else is a problem worth seeing.
  console.log(`[indexnow] POST ${ENDPOINT}: ${response.status} ${response.statusText} for ${urlList.length} URLs`);
  if (response.status !== 200 && response.status !== 202) {
    console.error(await response.text());
    process.exit(1);
  }
  for (const url of urlList) console.log(`  ${url}`);
}

async function main(args) {
  if (args[0] === 'plan') {
    const all = args.includes('--all');
    const dist = path.resolve(args.slice(1).find((arg) => arg !== '--all') ?? 'dist');
    const next = await distSitemap(dist);
    if (next.size === 0) throw new Error('no sitemap URLs found; build first');
    const urls = all ? [...next.keys()].sort() : changedUrls(next, await liveSitemap());
    console.error(`[indexnow] ${urls.length} of ${next.size} sitemap URLs ${all ? '(--all)' : 'are new or re-dated since the live release'}`);
    // stdout carries only the JSON, for $GITHUB_OUTPUT.
    console.log(JSON.stringify(urls));
    return;
  }
  if (args[0] === 'send') {
    const urls = JSON.parse(process.env.INDEXNOW_URLS || '[]');
    if (!Array.isArray(urls) || !urls.every((url) => typeof url === 'string' && new URL(url).host === HOST)) {
      throw new Error(`INDEXNOW_URLS must be a JSON array of ${ORIGIN} URLs`);
    }
    await post(urls);
    return;
  }
  const urls = [...(await distSitemap(path.resolve(args[0] ?? 'dist'))).keys()].sort();
  if (urls.length === 0) throw new Error('no sitemap URLs found; build first');
  await post(urls);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`[indexnow] ${error.message}`);
    process.exit(1);
  });
}
