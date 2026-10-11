import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// Owner decision (Dorin Burcus, 11 Oct 2026 20:58): the contractor-accreditation scheme is never named in public,
// neither as held nor as planned. It stays only in the private ops repo. This repository is public, so the guard
// covers the built site (dist/, every text file including _astro bundles) and every tracked text file in the repo
// (src/, public/, docs/, tests/, scripts/ ...). The pattern is assembled from pieces so this file holds no literal.
const SCHEME = new RegExp(['safe', 'contractor'].join('[\\s_-]*'), 'i');
const TEXT = /\.(html?|xml|txt|md|mdx|json|js|mjs|cjs|ts|astro|css|svg|csv|webmanifest|ya?ml)$/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (TEXT.test(name)) out.push(p);
  }
  return out;
}

test('the accreditation scheme is not named anywhere in the built site', () => {
  const hits = walk('dist').filter((f) => SCHEME.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});

test('the accreditation scheme is not named in any tracked source, content, doc or test file', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter((f) => f && TEXT.test(f));
  assert.ok(tracked.length > 100, 'git ls-files listed the repository');
  const hits = tracked.filter((f) => { try { return SCHEME.test(readFileSync(f, 'utf8')); } catch { return false; } });
  assert.deepEqual(hits, []);
});
