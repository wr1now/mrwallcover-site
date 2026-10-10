import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

/**
 * Glass Atelier (stage 5) guards on the built site: the tokens and the glass
 * system reach the shipped CSS with their fallbacks, the header toggle is a
 * real disclosure, the dock stays within four actions, and nothing from the
 * stage 4 art-direction preview ships.
 */
async function builtCss(): Promise<string> {
  const dir = path.join('dist', '_astro');
  const names = (await readdir(dir)).filter((name) => name.endsWith('.css'));
  assert.ok(names.length > 0, 'built CSS present');
  return (await Promise.all(names.map((name) => readFile(path.join(dir, name), 'utf8')))).join('\n');
}

/** Astro inlines small page stylesheets; the homepage hero rules live there. */
async function inlineCss(file: string): Promise<string> {
  const html = await readFile(file, 'utf8');
  return [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
}

test('the design tokens are in the built CSS', async () => {
  const css = await builtCss();
  for (const token of ['--color-ink:#141210', '--color-ivory:#f4f0e8', '--color-paper:#f7f4ee', '--color-brass:#6b542f', '--color-gold:#c6a36a', '--color-stone:#4e4942']) {
    assert.ok(css.includes(token), token);
  }
  for (const token of ['--text-display:', '--text-body:', '--text-lede:', '--text-eyebrow:', '--content-max:', '--grid-columns:', '--radius-control:', '--radius-bar:', '--radius-pill:', '--dur-control:', '--dur-panel:', '--dur-media:', '--ease-standard:', '--glass-champagne-alpha:', '--glass-smoked-alpha:', '--glass-clear-alpha:', '--dock-clearance:']) {
    assert.ok(css.includes(token), token);
  }
  assert.match(css, /--text-display:clamp\(/);
  // The minifier prints 180ms as .18s; read either.
  const ms = (name: string) => {
    const m = css.match(new RegExp(`--${name}:(\\.?\\d*\\.?\\d+)(ms|s)`))!;
    return Number(m[1]) * (m[2] === 's' ? 1000 : 1);
  };
  assert.ok(ms('dur-control') >= 150 && ms('dur-control') <= 250, 'controls 150 to 250ms');
  assert.ok(ms('dur-panel') >= 300 && ms('dur-panel') <= 500, 'panels 300 to 500ms');
  assert.ok(ms('dur-media') >= 500 && ms('dur-media') <= 800, 'media 500 to 800ms');
});

test('the three Glass variants ship with the @supports fallback, the reduced-effects preference and the reduced-motion rule', async () => {
  const css = await builtCss();
  for (const variant of ['.glass-champagne', '.glass-smoked', '.glass-clear']) assert.ok(css.includes(variant), variant);
  assert.match(css, /backdrop-filter:blur\(var\(--glass-blur\)\) saturate\(var\(--glass-saturate\)\)/);
  assert.match(css, /@supports not \(\((?:-webkit-)?backdrop-filter:blur\(1px\)\) or \((?:-webkit-)?backdrop-filter:blur\(1px\)\)\)\{[^}]*\.glass[^}]*\{background:var\(--glass-solid\)/);
  assert.match(css, /html\[data-effects=reduced\] \.glass[^{]*\{[^}]*backdrop-filter:none/);
  assert.match(css, /html\[data-effects=reduced\] \*[^{]*\{[^}]*transition:none!important/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{[^}]*\.glass[^}]*\{[^}]*backdrop-filter:none/);
  assert.match(css, /@media \(prefers-reduced-transparency:reduce\)\{[^}]*\.glass[^}]*\{[^}]*backdrop-filter:none/);
  // The dock is the opaque recipe and the old "plain" preference is gone.
  assert.match(css, /\.glass-opaque\{[^}]*backdrop-filter:none/);
  assert.doesNotMatch(css, /data-effects=plain/);
  // The menu's hidden state is keyed on a class the Header script sets itself, not on the head's html.js, so a failed module still shows the in-flow links and no dead toggle.
  assert.match(css, /html:not\(\.js-nav\) \.menu-toggle\{display:none\}/);
  assert.match(css, /\.js-nav \.mobile-menu:not\(\.is-open\)\{display:none\}/);
  assert.doesNotMatch(css, /\.js \.mobile-menu/);
  // Eyebrows on glass keep the measured colours even inside .on-dark (whose gold eyebrow rule has the same specificity as a plain .glass .eyebrow).
  assert.match(css, /\.on-dark \.glass \.eyebrow[^{]*\{color:var\(--color-stone\)\}/);
  assert.match(css, /\.on-dark \.glass-smoked \.eyebrow[^{]*\{color:var\(--color-ivory-soft\)\}/);
  assert.match(css, /\.hero\{[^}]*min-height:calc\(100svh - var\(--header-height\) - var\(--header-inset-top\)\)/, 'desktop hero height follows the header tokens');
});

test('every page: the header is one Glass element with a real disclosure toggle, the dock has at most four actions, the toggle is applied before first paint', async () => {
  const files = await (async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await walk(full)));
      else if (entry.name === 'index.html') out.push(full);
    }
    return out;
  })('dist');
  assert.ok(files.length > 50);
  let checked = 0;
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    if (/http-equiv="refresh"/.test(html)) continue;
    checked += 1;
    const headerTag = html.match(/<header\b[^>]*data-site-header[^>]*>/)?.[0];
    const header = headerTag?.match(/class="([^"]*)"/)?.[1];
    assert.ok(header, `${file}: glass header`);
    assert.ok(header!.split(' ').includes('glass') && header!.includes('glass-champagne') && header!.includes('site-header'), `${file}: ${header}`);
    assert.equal(html.match(/<header\b[^>]*data-site-header/g)?.length, 1, `${file}: one header`);
    assert.match(html, /<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle>/, `${file}: toggle`);
    assert.match(html, /<div class="mobile-menu" id="mobile-menu" data-mobile-menu>/, `${file}: panel`);
    assert.doesNotMatch(html, /<details class="mobile-nav"/, `${file}: no <details> menu`);
    const dockTag = html.match(/<nav\b[^>]*data-dock[^>]*>/);
    assert.ok(dockTag, `${file}: dock`);
    assert.match(dockTag![0], /aria-label="Contact shortcuts"/, `${file}: dock label`);
    const dockClass = dockTag![0].match(/class="([^"]*)"/)?.[1] ?? '';
    assert.ok(dockClass.includes('glass-opaque') && dockClass.includes('glass-champagne') && dockClass.includes('dock'), `${file}: dock is opaque champagne: ${dockClass}`);
    const dockInner = html.slice(dockTag!.index! + dockTag![0].length).match(/^([\s\S]*?)<\/nav>/)![1];
    const actions = dockInner.match(/<(a|button)\b/g)?.length ?? 0;
    assert.ok(actions >= 2 && actions <= 4, `${file}: ${actions} dock actions`);
    assert.match(dockInner, /^\s*<a class="dock-primary" href="\/contact\/">/, `${file}: Start first`);
    assert.match(html, /data-effects-toggle aria-pressed="false">Reduce visual effects<\/button>/, `${file}: footer toggle`);
    assert.match(html, /<head>[\s\S]*mwEffects === ['"]reduced['"][\s\S]*<\/head>/, `${file}: preference applied in <head>`);
  }
  assert.ok(checked > 50);
});

test('nothing from the art-direction preview ships, and the phone hero keeps its buttons above the dock', async () => {
  const css = await builtCss();
  const home = await readFile('dist/index.html', 'utf8');
  const hero = await inlineCss('dist/index.html');
  for (const text of [css, home, hero]) {
    assert.doesNotMatch(text, /\[data-variant/);
    assert.doesNotMatch(text, /--ga-/);
    assert.doesNotMatch(text, /glass-variants\.preview/);
  }
  const everything = `${css}\n${hero}`;
  assert.match(everything, /100svh - var\(--header-height\) - var\(--header-inset-top\) - var\(--dock-clearance\)/, 'phone hero accounts for header and dock');
  assert.doesNotMatch(everything, /--dock-clearance\) \+ [\d.]+rem\)/, 'no allowance for a hero row below the fold');
  assert.match(everything, /padding-bottom:var\(--dock-clearance\)/, 'body clearance');
});

test('mobile hero keeps the wallpaper in frame: phone object-position set, desktop untouched', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/styles/hero-mobile.css', import.meta.url), 'utf8');
  assert.match(css, /object-position:\s*61% 30%/);
  assert.match(css, /object-position:\s*50% 52%/);
  assert.match(css, /width:100%; max-width:100%/, 'copy is bounded at enlarged default text sizes');
});

test('every page: html.js-nav is set before first paint, with a load-time fallback if the Header script never confirms', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile('dist/index.html', 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.match(head, /classList\.add\('js-nav'\)/, 'js-nav added in <head>');
  assert.match(head, /data-nav-ready/, 'fallback checks data-nav-ready');
  const header = await readFile(new URL('../src/components/Header.astro', import.meta.url), 'utf8');
  assert.match(header, /setAttribute\('data-nav-ready'/);
});

test('skip link lands focus on <main>, and every "Start" link has the accessible name "Start your project"', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  assert.match(html, /<a[^>]+href="#main"/, 'skip link present');
  assert.match(html, /<main id="main" tabindex="-1"/, 'main is focusable from the skip link');
  const starts = [...html.matchAll(/<a[^>]*href="\/contact\/"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  assert.ok(starts.length > 0);
  assert.equal(starts.filter((text) => /^start$/i.test(text)).length, 0, `bare "Start" link text: ${JSON.stringify(starts)}`);
});

test('preview-only case-study heroes are never stretched past their own pixel width', async () => {
  const sizes = JSON.parse(await readFile('src/content/sizes.json', 'utf8')) as Record<string, { thumbWidth: number }>;
  for (const [slug, id] of [['old-bailey-hotel', 'old-bailey-06'], ['heathrow-terminal-4-calico', 'heathrow-05'], ['north-london-residence', 'north-london-residence-01']] as const) {
    const html = await readFile(`dist/projects/${slug}/index.html`, 'utf8');
    assert.match(html, new RegExp(`class="[^"]*modest-hero[^"]*"[^>]*style="max-width:${sizes[id].thumbWidth}px"`), slug);
  }
});

test('Calico case studies open their galleries on the finished frame used as the hero', async () => {
  for (const slug of ['calico-ahluwalia-estuary-rosewood', 'heathrow-terminal-4-calico', 'calico-lee-broom-overture', 'calico-beverly-1975-cadence']) {
    const text = await readFile(`src/content/case-studies/${slug}.md`, 'utf8');
    const data = JSON.parse(text.split('---')[1]) as { hero: string; gallery: { id: string }[] };
    assert.equal(data.gallery[0].id, data.hero, slug);
  }
});

test('every published page title is 60 characters or fewer', async () => {
  const long: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name === 'index.html') {
        const title = (await readFile(full, 'utf8')).match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
        const text = title.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"');
        if (text.length > 60) long.push(`${full}: ${text.length} ${text}`);
      }
    }
  }
  await walk('dist');
  assert.deepEqual(long, []);
});

test('home hero offers responsive original-photo derivatives for the full-width composition', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  const source = html.match(/<div class="atelier-hero-media">[\s\S]*?<source type="image\/webp" srcset="([^"]+)" sizes="([^"]+)"/);
  assert.ok(source, 'hero webp source');
  for (const width of [640, 960, 1440, 2000, 2560]) assert.match(source![1], new RegExp(` ${width}w`));
  assert.equal(source![2], '100vw');
});

test('home films: a finished room first, the mid-works film last, each with a visible description of what it shows', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  const posters = [...html.matchAll(/poster="\/media\/video\/(browns-hotel-mayfair-video-\d+)-poster\.jpg"/g)].map((m) => m[1]);
  assert.deepEqual(posters, ['browns-hotel-mayfair-video-02', 'browns-hotel-mayfair-video-01', 'browns-hotel-mayfair-video-03']);
  const captions = [...html.matchAll(/<figcaption class="caption">(Silent film[^<]*)<\/figcaption>/g)];
  assert.equal(captions.length, 3);
});
