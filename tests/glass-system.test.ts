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
  assert.match(everything, /min-height:calc\(100svh - var\(--header-height\) - var\(--header-inset-top\) - var\(--dock-clearance\)\)/, 'phone hero fits between header and dock');
  assert.doesNotMatch(everything, /--dock-clearance\) \+ [\d.]+rem\)/, 'no allowance for a hero row below the fold');
  assert.match(everything, /padding-bottom:var\(--dock-clearance\)/, 'body clearance');
});
