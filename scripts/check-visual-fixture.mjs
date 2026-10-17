/** Build a genuinely new route in a temporary output, then remove its temporary source. */
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
const fixture='src/pages/visual-contract-fixture.astro';
let exists=false;
try { await access(fixture); exists=true; } catch {}
assert.equal(exists,false,'temporary fixture must never overwrite an existing route');
const out=await mkdtemp(join(tmpdir(),'mw-visual-fixture-'));
try {
  await writeFile(fixture,await readFile('tests/fixtures/visual-page.astro.txt','utf8'),{flag:'wx'});
  await promisify(execFile)(process.execPath,['node_modules/astro/bin/astro.mjs','build','--outDir',out],{maxBuffer:32*1024*1024});
  const html=await readFile(join(out,'visual-contract-fixture/index.html'),'utf8');
  assert.match(html,/<footer\b[^>]*data-footer/);
  assert.equal((html.match(/class="footer-group /g)||[]).length,4);
  assert.match(html,/<a\b[^>]*href="\/contact\/"[^>]*class="mw-action mw-action--primary"/);
  assert.match(html,/<button\b[^>]*type="button"[^>]*class="mw-action mw-action--secondary"/);
  const unavailable=html.match(/<a\b[^>]*aria-disabled="true"[^>]*>/)?.[0];
  assert.ok(unavailable,'disabled navigation remains labelled as unavailable');
  assert.doesNotMatch(unavailable,/\bhref=/,'disabled link has no navigable destination');
  assert.match(unavailable,/tabindex="-1"/);
  assert.match(html,/<button\b[^>]*aria-disabled="true"[^>]*disabled/,'unavailable button is natively disabled');
  assert.match(html,/noindex/);
  console.log('New route fixture: shared footer/actions inherited without local CSS; native button and disabled-link semantics pass. Fixture removed from source and public output.');
} finally { await rm(fixture,{force:true}); await rm(out,{recursive:true,force:true}); }
