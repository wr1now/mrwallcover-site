#!/usr/bin/env node
/**
 * Stamp `published` and `updated` into every case-study frontmatter from git.
 *
 *   node scripts/stamp-case-study-dates.mjs          # write
 *   node scripts/stamp-case-study-dates.mjs --check  # exit 1 if any date is missing, malformed or stale
 *
 * `published` is the date the file first entered the repository (first commit
 * that added it, following renames) and is never changed once set.
 * `updated` is the date of the last commit that touched the file, or today when
 * the file has uncommitted changes. Both are stored as data in the file, so the
 * build never invents a date and never uses the build time.
 *
 * Dates are commit dates (git %cs), so `--check` and the stamp agree with
 * `git log -1 --format=%cs -- <file>`.
 *
 * Run this before committing a case-study change. `--check` runs in CI before
 * the build (with the full history checked out) and fails when a case study
 * lacks either date or when `updated` no longer matches the last commit that
 * touched the file, naming the file and the command that fixes it. The
 * frontmatter is edited textually so the rest of the file keeps its formatting.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'src/content/case-studies');
const check = process.argv.includes('--check');
const today = new Date().toISOString().slice(0, 10);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const FIX = 'Run: node scripts/stamp-case-study-dates.mjs, then commit the result.';

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function firstAdded(file) {
  const out = git(['log', '--follow', '--diff-filter=A', '--format=%cs', '--', file]);
  const lines = out.split('\n').filter(Boolean);
  return lines.at(-1) ?? null;
}

function isDirty(file) {
  return Boolean(git(['status', '--porcelain', '--', file]));
}

/** Date of the last commit that touched the file, or null when it has never been committed. */
function lastCommitted(file) {
  return git(['log', '-1', '--format=%cs', '--', file]) || null;
}

/** The `updated` value the file should carry right now: today while it has uncommitted changes, else its last commit date. */
function expectedUpdated(file) {
  if (isDirty(file)) return today;
  return lastCommitted(file);
}

/** Set or replace a top-level string key in a JSON frontmatter block, keeping the rest of the text as is. */
function setKey(block, key, value) {
  const re = new RegExp(`(\\n\\s*"${key}":\\s*)"[^"]*"`);
  if (re.test(block)) return block.replace(re, `$1"${value}"`);
  const end = block.lastIndexOf('}');
  const before = block.slice(0, end).replace(/\s+$/, '');
  return `${before},\n  "${key}": "${value}"\n}`;
}

if (check && !lastCommitted('src/content/case-studies')) {
  console.error('No git history for src/content/case-studies. In CI, check out with fetch-depth: 0 so the last commit date of each file is known.');
  process.exit(1);
}

let problems = 0;
for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.md')).sort()) {
  const file = path.join('src/content/case-studies', name);
  const text = readFileSync(path.join(root, file), 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`${file}: no frontmatter`);
  const fm = JSON.parse(match[1]);
  if (check) {
    if (!ISO.test(fm.published ?? '') || !ISO.test(fm.updated ?? '') || fm.updated < fm.published) {
      console.error(`${file}: published/updated missing, malformed or out of order (published ${fm.published}, updated ${fm.updated}). ${FIX}`);
      problems += 1;
      continue;
    }
    const expected = expectedUpdated(file);
    if (expected === null) {
      console.error(`${file}: has never been committed, so its updated date ${fm.updated} cannot be verified. Commit the file. ${FIX}`);
      problems += 1;
    } else if (fm.updated !== expected) {
      const why = isDirty(file) ? 'the file has uncommitted changes, so it should read today' : 'the last commit that touched it is dated';
      console.error(`${file}: updated is ${fm.updated} but ${why} ${expected}. ${FIX}`);
      problems += 1;
    }
    continue;
  }
  const published = ISO.test(fm.published ?? '') ? fm.published : (firstAdded(file) ?? today);
  let updated = expectedUpdated(file) ?? published;
  if (updated < published) updated = published;
  if (published === fm.published && updated === fm.updated) continue;
  let block = match[1];
  block = setKey(block, 'published', published);
  block = setKey(block, 'updated', updated);
  JSON.parse(block); // still valid frontmatter
  writeFileSync(path.join(root, file), `---\n${block}\n---\n${text.slice(match[0].length)}`);
  console.log(`${file}: published ${published}, updated ${updated}`);
}
if (check) {
  if (problems) {
    console.error(`${problems} case stud${problems === 1 ? 'y' : 'ies'} with stale or missing dates.`);
    process.exit(1);
  }
  console.log('Case-study dates match git.');
}
