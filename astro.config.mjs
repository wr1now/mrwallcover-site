// @ts-check
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/**
 * Sitemap lastmod is only ever a real date: the `updated` field a case study
 * carries in its frontmatter (stamped from git by scripts/stamp-case-study-dates.mjs).
 * Every other page gets no lastmod rather than the build time.
 */
const caseStudyDir = path.resolve(import.meta.dirname, 'src/content/case-studies');
/** @type {Map<string, string>} path -> ISO date */
const lastmodByPath = new Map();
for (const name of readdirSync(caseStudyDir).filter((entry) => entry.endsWith('.md'))) {
  const text = readFileSync(path.join(caseStudyDir, name), 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) continue;
  const fm = JSON.parse(match[1]);
  if (fm.draft || !/^\d{4}-\d{2}-\d{2}$/.test(fm.updated ?? '')) continue;
  lastmodByPath.set(`/projects/${fm.slug}/`, fm.updated);
}

export default defineConfig({
  site: 'https://www.mrwallcover.com',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'auto' },
  integrations: [
    sitemap({
      // Old project URLs now redirect to case studies; keep them out of the sitemap.
      filter: (page) =>
        process.env.MW_CONTENT_PREVIEW !== '1' &&
        !page.includes('/thank-you') &&
        !page.includes('/404') &&
        !page.includes('/search') &&
        !['/projects/owo-whitehall/', '/projects/four-seasons-ten-trinity/', '/projects/hilton-silverstone/', '/projects/hilton-holborn/'].some((old) =>
          page.endsWith(old),
        ),
      serialize: (item) => {
        const pathname = new URL(item.url).pathname;
        const lastmod = lastmodByPath.get(pathname);
        return lastmod ? { ...item, lastmod } : item;
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
