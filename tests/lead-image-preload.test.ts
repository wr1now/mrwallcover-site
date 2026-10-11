import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// Case-study LCP and CLS (SEO fix pack C): every case study preloads its hero with the exact
// srcset, sizes and type of the hero's first <source>, at high priority, and preloads the two
// faces its head paints, so the font swap does not shift the page.
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

test('each case study preloads its hero image exactly as the <picture> will choose it', () => {
  const css = readdirSync('dist/_astro').filter((f) => f.endsWith('.css')).map((f) => readFileSync(`dist/_astro/${f}`, 'utf8')).join('\n');
  let checked = 0;
  for (const slug of readdirSync('dist/projects')) {
    const file = `dist/projects/${slug}/index.html`;
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    if (html.includes('http-equiv="refresh"')) continue;
    const hero = html.match(/<picture>\s*(<source[^>]*>)[\s\S]*?<img[^>]*fetchpriority="high"[^>]*>/);
    if (!hero) continue;
    const head = html.slice(0, html.indexOf('</head>'));
    const preload = head.match(/<link rel="preload" as="image"[^>]*>/g)?.find((tag) => attr(tag, 'imagesrcset') === attr(hero[1], 'srcset'));
    assert.ok(preload, `${slug}: no preload matching the hero srcset`);
    assert.equal(attr(preload!, 'imagesizes'), attr(hero[1], 'sizes'), `${slug}: preload sizes`);
    assert.equal(attr(preload!, 'type'), attr(hero[1], 'type'), `${slug}: preload type`);
    assert.equal(attr(preload!, 'fetchpriority'), 'high', `${slug}: fetchpriority`);
    const fonts = [...head.matchAll(/<link rel="preload" as="font" type="font\/woff2" href="([^"]+)" crossorigin>/g)].map((m) => m[1]);
    assert.equal(fonts.length, 2, `${slug}: two font preloads`);
    for (const href of fonts) {
      assert.ok(existsSync(`dist${href}`), `${href} is built`);
      assert.ok(css.includes(href), `${href} is the file the stylesheet uses`);
    }
    checked += 1;
  }
  assert.ok(checked >= 25, `case studies checked: ${checked}`);
});

test('the lead image is exempt from the fade-in, so it paints as soon as it decodes', () => {
  const css = readdirSync('dist/_astro').filter((f) => f.endsWith('.css')).map((f) => readFileSync(`dist/_astro/${f}`, 'utf8')).join('\n');
  assert.match(css, /\.js \.media-frame img\[fetchpriority=(?:'|")?high(?:'|")?\]\{opacity:1;transition:none\}/);
});
await import('./quote-checklist.test.ts');
