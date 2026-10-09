#!/usr/bin/env node
/**
 * Stamp `published` and `updated` into every case-study frontmatter from git.
 *
 *   node scripts/stamp-case-study-dates.mjs          # write
 *   node scripts/stamp-case-study-dates.mjs --check  # exit 1 if any file is missing a date
 *
 * `published` is the date the file first entered the repository (first commit
 * that added it, following renames) and is never changed once set.
 * `updated` is the date of the last commit that touched the file, or today when
 * the file has uncommitted changes. Both are stored as data in the file, so the
 * build never invents a date and never uses the build time.
 *
 * Run this before committing a case-study change. The content guard test
 * fails when a case study lacks either date. The frontmatter is edited
 * textually so the rest of the file keeps its formatting.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'src/content/case-studies');
const check = process.argv.includes('--check');
const today = new Date().toISOString().slice(0, 10);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function firstAdded(file) {
  const out = git(['log', '--follow', '--diff-filter=A', '--format=%as', '--', file]);
  const lines = out.split('\n').filter(Boolean);
  return lines.at(-1) ?? null;
}

function lastTouched(file) {
  const dirty = git(['status', '--porcelain', '--', file]);
  if (dirty) return today;
  const out = git(['log', '-1', '--format=%as', '--', file]);
  return out || null;
}

/** Set or replace a top-level string key in a JSON frontmatter block, keeping the rest of the text as is. */
function setKey(block, key, value) {
  const re = new RegExp(`(\\n\\s*"${key}":\\s*)"[^"]*"`);
  if (re.test(block)) return block.replace(re, `$1"${value}"`);
  const end = block.lastIndexOf('}');
  const before = block.slice(0, end).replace(/\s+$/, '');
  return `${before},\n  "${key}": "${value}"\n}`;
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
      console.error(`${file}: published/updated missing or malformed`);
      problems += 1;
    }
    continue;
  }
  const published = ISO.test(fm.published ?? '') ? fm.published : (firstAdded(file) ?? today);
  let updated = lastTouched(file) ?? published;
  if (updated < published) updated = published;
  if (published === fm.published && updated === fm.updated) continue;
  let block = match[1];
  block = setKey(block, 'published', published);
  block = setKey(block, 'updated', updated);
  JSON.parse(block); // still valid frontmatter
  writeFileSync(path.join(root, file), `---\n${block}\n---\n${text.slice(match[0].length)}`);
  console.log(`${file}: published ${published}, updated ${updated}`);
}
if (check && problems) process.exit(1);
