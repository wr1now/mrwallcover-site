import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/**
 * The cascade depends on the order the stylesheets load: tokens before the glass
 * recipes, the glass recipes before the navigation surfaces that set --glass-alpha,
 * then the unlayered atelier.css, unify.css (which overrides atelier.css) and
 * visual-system.css (which overrides unify.css). A reordered import silently changes
 * which rule wins, so the order is pinned here.
 */
const importsOf = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].map((match) => match[1]);

test('Base.astro loads the shared stylesheets in cascade order', async () => {
  const base = await readFile('src/layouts/Base.astro', 'utf8');
  const frontmatter = base.split('---')[1];
  const sheets = importsOf(frontmatter, /^import '\.\.\/styles\/([a-z-]+\.css)';$/gm);
  assert.deepEqual(sheets, ['global.css', 'atelier.css', 'unify.css', 'visual-system.css', 'editorial-layout.css']);
});

test('global.css imports Tailwind first, then the tokens, the glass system and the navigation surfaces', async () => {
  const global = await readFile('src/styles/global.css', 'utf8');
  const imports = importsOf(global, /^@import "([^"]+)";$/gm);
  assert.equal(imports[0], 'tailwindcss');
  const local = imports.filter((name) => name.startsWith('./'));
  assert.deepEqual(local, ['./tokens.css', './glass.css', './navigation.css']);
  const lastImport = global.lastIndexOf('@import ');
  assert.ok(lastImport < global.indexOf('@layer '), 'every @import precedes the first rule');
});
