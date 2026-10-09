// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.mrwallcover.com',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'auto' },
  integrations: [
    sitemap({
      // Old project URLs now redirect to case studies; keep them out of the sitemap.
      filter: (page) =>
        !page.includes('/thank-you') &&
        !page.includes('/404') &&
        !page.includes('/search') &&
        !['/projects/owo-whitehall/', '/projects/four-seasons-ten-trinity/', '/projects/hilton-silverstone/'].some((old) =>
          page.endsWith(old),
        ),
      lastmod: new Date(),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      modulePreload: false,
    },
  },
});
