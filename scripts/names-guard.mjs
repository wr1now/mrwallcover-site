#!/usr/bin/env node
/**
 * Names guard (owner's rule, 14 Oct 2026): other installers, decorating firms and training academies are never
 * named anywhere public, and nor are the products the owner keeps off the site.
 *
 *   node scripts/names-guard.mjs [--dist dist] [--repo] [--list <file>] [--if-present]
 *
 * The list of names is private. It lives in the private research repository, never in this public one, and this
 * script only ever reports a file and the number of the list entry it matched, never the name itself, so a CI log
 * does not publish it either. The list is read from, in order:
 *   --list <file>               a path, for a local run
 *   MW_NAMES_FILE=<file>        the same, as an environment variable
 *   MW_NAMES="<contents>"       the whole list as text (the repository secret of the same name in CI)
 * --if-present exits 0 with a warning when no list is given (CI before the secret exists). Without it, a missing
 * list is an error, so a local run can never pass by accident.
 *
 * List format: one entry per line; blank lines and lines starting with # are ignored.
 *   A name ("Example Interiors"): matched without regard to case or accents, with "&" read as "and", and with
 *   any spaces, hyphens, dots or underscores (or none) between its words, so a domain such as
 *   example-interiors.com or exampleinteriors.co.uk is caught too. Whole words only.
 *   re:<pattern>                a regular expression, case-insensitive, for names that need context.
 *
 * Scope: every text file in the built site (default dist/), read three ways (as built, with HTML entities and
 * percent-escapes decoded, and with tags removed so a name split by markup is still found). With --repo, every
 * file git tracks as well, because this repository is public too. A file counts as text by its content, not its
 * name (no NUL byte in its first 8 KB), so files such as CNAME, _headers or .gitignore are read too.
 *
 * A "re:" entry that is not a valid regular expression stops the guard with its entry number only, never the
 * pattern, so a typo in the private list cannot print a name in a public log.
 */
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const root = path.resolve(import.meta.dirname, '..');
const dist = path.resolve(root, opt('dist', 'dist'));

function readList() {
  const file = opt('list') ?? process.env.MW_NAMES_FILE;
  if (file) {
    if (!existsSync(file)) throw new Error(`The names list was not found at the path given (${file === opt('list') ? '--list' : 'MW_NAMES_FILE'}).`);
    return readFileSync(file, 'utf8');
  }
  return process.env.MW_NAMES ?? '';
}

/** Lower case, accents folded, "&" read as "and". The same folding is applied to the names and the text. */
export function fold(text) {
  return text.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/&/g, ' and ');
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Turns the list text into numbered patterns. Entry numbers count only real entries, from 1. */
export function parseList(text) {
  const entries = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    let pattern;
    if (line.startsWith('re:')) {
      try {
        pattern = new RegExp(line.slice(3).trim(), 'iu');
      } catch {
        // Never echo the pattern: the list is private and this may run in a public CI log.
        throw new Error(`Names list entry ${entries.length + 1} is not a valid regular expression. Fix it in the private list.`);
      }
    } else {
      const words = fold(line).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      if (!words.length) continue;
      pattern = new RegExp(`(?<![\\p{L}\\p{N}])${words.map(escape).join('[\\s._-]*')}(?![\\p{L}\\p{N}])`, 'iu');
    }
    entries.push({ n: entries.length + 1, pattern });
  }
  return entries;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'" };
function decode(text) {
  let out = text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
  out = out.replace(/(?:%[0-9a-f]{2})+/gi, (m) => {
    try {
      return decodeURIComponent(m);
    } catch {
      return m;
    }
  });
  return out;
}

/** The three readings of one file, each folded: as written, decoded, and decoded with tags replaced by spaces. */
export function readings(text) {
  const decoded = decode(text);
  return [text, decoded, decoded.replace(/<[^>]*>/g, ' ')].map(fold);
}

/** Entry numbers matched in a text. */
export function matches(entries, text) {
  const views = readings(text);
  return entries.filter((entry) => views.some((view) => entry.pattern.test(view))).map((entry) => entry.n);
}

/** True when a buffer looks like text: no NUL byte in its first 8 KB. */
export function looksLikeText(head) {
  return !head.subarray(0, 8192).includes(0);
}

/** A file's contents as UTF-8, or null for a binary file (only its first 8 KB are read to decide). */
export function readText(file) {
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(8192);
    const size = readSync(fd, head, 0, head.length, 0);
    if (!looksLikeText(head.subarray(0, size))) return null;
  } finally {
    closeSync(fd);
  }
  return readFileSync(file, 'utf8');
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function main() {
  let entries;
  try {
    entries = parseList(readList());
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  if (!entries.length) {
    const message = 'No names list was given (--list, MW_NAMES_FILE or MW_NAMES), so other firms’ names were not checked.';
    if (flag('if-present')) {
      console.log(process.env.GITHUB_ACTIONS ? `::warning::${message} Add the MW_NAMES repository secret.` : `Skipped: ${message}`);
      return 0;
    }
    console.error(message);
    return 2;
  }

  const hits = [];
  let scanned = 0;
  if (!existsSync(dist)) {
    console.error(`No built site at ${path.relative(root, dist) || dist}. Run npm run build first.`);
    return 2;
  }
  for (const file of walk(dist)) {
    const text = readText(file);
    if (text === null) continue;
    scanned += 1;
    for (const n of matches(entries, text)) hits.push(`${path.relative(root, file)}: list entry ${n}`);
  }
  if (flag('repo')) {
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    for (const file of tracked) {
      const full = path.join(root, file);
      if (!existsSync(full) || statSync(full).isDirectory()) continue;
      const text = readText(full);
      if (text === null) continue;
      scanned += 1;
      for (const n of matches(entries, text)) hits.push(`${file} (tracked): list entry ${n}`);
    }
  }

  if (hits.length) {
    console.error(`Names guard: ${hits.length} match${hits.length === 1 ? '' : 'es'} of the private names list (${entries.length} entries, ${scanned} files):`);
    for (const hit of hits) console.error(`  ${hit}`);
    console.error('Look the entry number up in the private list. Remove the name from the page or file; never add it to this repository.');
    return 1;
  }
  console.log(`Names guard: none of the ${entries.length} private list entries appear in ${scanned} files.`);
  return 0;
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) process.exit(main());
