// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import { computeLastmod } from './scripts/sitemap-lastmod.mjs';

/**
 * Sitemap lastmod is only ever a real date of the page's own content (see
 * scripts/sitemap-lastmod.mjs): frontmatter dates for case studies, guides and
 * editorial pages, and git dates of each page's own source (per entry for the JSON
 * collections). Never the build time; a URL with no known date gets no lastmod.
 */
const lastmodByPath = computeLastmod(import.meta.dirname);

/**
 * Image sitemap entries: every photograph a page describes in its JSON-LD
 * (the ImageObjects from src/lib/schema.ts imageObject(), so every gallery frame,
 * hero and credited photograph, with its rights already on the page). Read from the
 * built HTML, so the sitemap lists exactly what the page shows. Google uses only
 * <image:loc>; the licence lives in the ImageObject.
 */
let outDir = path.resolve(import.meta.dirname, 'dist');
function imagesFor(pathname) {
  const file = path.join(outDir, pathname, 'index.html');
  if (!existsSync(file)) return [];
  const html = readFileSync(file, 'utf8');
  const urls = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      if (node['@type'] === 'ImageObject' && typeof (node.contentUrl ?? node.url) === 'string') urls.add(node.contentUrl ?? node.url);
      Object.values(node).forEach(walk);
    }
  };
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      /* unparsable block: the dist guards report it */
    }
  }
  // Photographs shown in the page's main content but not described in its JSON-LD (the
  // About roll-call, for example): one entry per photograph, the size the page serves.
  const idOf = (u) => new URL(u, 'https://www.mrwallcover.com').pathname.match(/^\/media\/(?:img\/(?:r\/|thumbs\/)?)?([a-z0-9/-]+?)(?:-(?:\d+|preview))?\.(?:jpe?g|webp|avif|png)$/)?.[1];
  const seen = new Set([...urls].map(idOf).filter(Boolean));
  const main = html.slice(Math.max(0, html.indexOf('<main')), html.indexOf('</main>') + 1 || undefined);
  for (const m of main.matchAll(/<img[^>]*?\ssrc="(\/media\/[^"]+)"/g)) {
    const id = idOf(m[1]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    urls.add(new URL(m[1], 'https://www.mrwallcover.com').href);
  }
  // /og.jpg is the site-wide share image, not a photograph of the page: listed for the home page only.
  return [...urls]
    .filter((u) => u.startsWith('https://www.mrwallcover.com/') && (pathname === '/' || u !== 'https://www.mrwallcover.com/og.jpg'))
    .map((url) => ({ url }));
}

export default defineConfig({
  site: 'https://www.mrwallcover.com',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'auto' },
  integrations: [
    {
      name: 'mw-sitemap-outdir',
      hooks: {
        'astro:config:done': ({ config }) => {
          outDir = new URL(config.outDir).pathname;
        },
      },
    },
    sitemap({
      // Old project URLs now redirect to case studies; keep them out of the sitemap.
      filter: (page) =>
        process.env.MW_CONTENT_PREVIEW !== '1' &&
        !page.includes('/thank-you') &&
        !page.includes('/404') &&
        !page.includes('/search') &&
        !['/projects/owo-whitehall/', '/projects/four-seasons-ten-trinity/', '/projects/hilton-silverstone/', '/projects/hilton-holborn/', '/projects/the-lanesborough/'].some((old) =>
          page.endsWith(old),
        ),
      serialize: (item) => {
        const pathname = new URL(item.url).pathname;
        const lastmod = lastmodByPath.get(pathname);
        const img = imagesFor(pathname);
        return { ...item, ...(lastmod ? { lastmod } : {}), ...(img.length ? { img } : {}) };
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      modulePreload: false,
    },
  },
});
