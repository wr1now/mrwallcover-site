import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// Owner rule (Dorin Burcus, 11 Oct 2026, PR #60): Mr Wallcover always sets out with a laser.
// A plumb line or plumb bob may appear only as the traditional method, as context, in the same sentence as "traditional".
// "Plumbed", "plumbing in" a room and "plumb each/every drop" describe our method with a plumb line, so they are barred.
const TEXT = /\.(html?|txt|md|json|ts|astro|xml)$/i;
const TOOL = /plumb[\s-]*(line|bob)s?/i;
const BARRED = /\bplumbed\b|\bplumb(ing)? (each|every|the) drops?\b|\bplumbing in a room\b/i;

function sentences(text: string): string[] {
  return text.replace(/<[^>]+>/g, ' ').split(/(?<=[.;!?])\s+/);
}

function offences(file: string): string[] {
  const out: string[] = [];
  for (const s of sentences(readFileSync(file, 'utf8'))) {
    if (BARRED.test(s)) out.push(`${file}: ${s.trim().slice(0, 160)}`);
    else if (TOOL.test(s) && !/traditional/i.test(s)) out.push(`${file}: ${s.trim().slice(0, 160)}`);
  }
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (TEXT.test(name)) acc.push(p);
  }
  return acc;
}

test('sources never say we set out with a plumb line or bob (laser set-out on every job)', () => {
  const tracked = execFileSync('git', ['ls-files', '-z', 'src', 'docs'], { encoding: 'utf8' }).split('\0').filter((f) => f && TEXT.test(f));
  assert.ok(tracked.length > 50);
  assert.deepEqual(tracked.flatMap(offences), []);
});

test('the built site and AI layer never say we set out with a plumb line or bob', () => {
  assert.ok(existsSync('dist/index.html'), 'build first');
  assert.deepEqual(walk('dist').flatMap(offences), []);
});

test('the laser is stated as our method on the set-out guide, with the plumb line only as the traditional method', () => {
  const html = readFileSync('dist/advice/set-out-and-pattern-matching/index.html', 'utf8');
  assert.match(html, /We set out every wall with a laser level; the plumb line is the traditional method/);
});
