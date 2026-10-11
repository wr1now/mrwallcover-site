#!/usr/bin/env node
/**
 * IndexNow: tell Bing, Yandex and the other IndexNow engines which URLs
 * changed, straight after a deploy. One POST to api.indexnow.org fans out to
 * every participating engine. Google does not use IndexNow; it reads the
 * sitemap.
 *
 * Safe by default. The script is a no-op unless INDEXNOW_ENABLED=1, so a
 * stray `npm run indexnow` can never ping accidentally. Nothing in the
 * GitHub Pages workflow calls it yet; see README.md for enabling it on the
 * Cloudflare move.
 *
 * The key file public/<key>.txt is served at https://www.mrwallcover.com/<key>.txt
 * so the engines can verify the host owns the key.
 *
 * Usage: INDEXNOW_ENABLED=1 node scripts/indexnow-ping.mjs [distDir]
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const HOST = 'www.mrwallcover.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const dist = path.resolve(process.argv[2] ?? 'dist');

async function findKey() {
  const names = (await readdir(path.resolve('public'))).filter((name) => /^[0-9a-f]{32}\.txt$/.test(name));
  if (names.length !== 1) throw new Error(`expected exactly one public/<32 hex>.txt key file, found ${names.length}`);
  const key = names[0].slice(0, -4);
  const body = (await readFile(path.join('public', names[0]), 'utf8')).trim();
  if (body !== key) throw new Error(`public/${names[0]} must contain its own name as the key`);
  return key;
}

async function sitemapUrls() {
  const index = await readFile(path.join(dist, 'sitemap-index.xml'), 'utf8');
  const parts = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => path.basename(new URL(m[1]).pathname));
  const urls = new Set();
  for (const part of parts) {
    const xml = await readFile(path.join(dist, part), 'utf8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const url = new URL(m[1]);
      if (url.host === HOST) urls.add(url.href);
    }
  }
  return [...urls].sort();
}

async function main() {
  if (process.env.INDEXNOW_ENABLED !== '1') {
    console.log('[indexnow] INDEXNOW_ENABLED is not 1; nothing sent.');
    return;
  }
  const key = await findKey();
  const urlList = await sitemapUrls();
  if (urlList.length === 0) throw new Error('no sitemap URLs found; build first');
  const payload = { host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList };
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  // 200 OK, 202 Accepted (key validation pending); anything else is a problem worth seeing.
  console.log(`[indexnow] POST ${ENDPOINT}: ${response.status} ${response.statusText} for ${urlList.length} URLs`);
  if (response.status !== 200 && response.status !== 202) {
    console.error(await response.text());
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[indexnow] ${error.message}`);
  process.exit(1);
});
