import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

test('every normal built page inherits the shared footer and visual action stylesheet', async () => {
  async function walk(dir:string):Promise<string[]> {
    const entries = await readdir(dir,{withFileTypes:true});
    return (await Promise.all(entries.map(e=>e.isDirectory()?walk(join(dir,e.name)):e.name.endsWith('.html')?[join(dir,e.name)]:[]))).flat();
  }
  let count=0;
  for (const file of await walk('dist')) {
    const html=await readFile(file,'utf8');
    if (/http-equiv="refresh"/.test(html)) continue;
    assert.equal((html.match(/<footer\b/g)||[]).length,1,file);
    assert.match(html,/data-footer/,file);
    assert.match(html,/data-effects-toggle/,file);
    count++;
  }
  assert.ok(count>=90,'check the published page family, not a single example');
  const css=(await Promise.all((await readdir('dist/_astro')).filter(n=>n.endsWith('.css')).map(n=>readFile('dist/_astro/'+n,'utf8')))).join('');
  assert.match(css,/\.mw-action--primary/);
  assert.match(css,/\.mw-action--secondary/);
  assert.match(css,/\.mw-action--quiet/);
  assert.match(css,/body\.field-focus \.dock/,'dock remains hidden while fields have focus');
});

test('new page instructions require the shared standard, not an image quota', async()=>{
  assert.match(await readFile('AGENTS.md','utf8'),/visual-standard\.md/);
  assert.match(await readFile('README.md','utf8'),/visual-standard\.md/);
  assert.match(await readFile('.github/pull_request_template.md','utf8'),/visual/i);
  const action=await readFile('src/components/Action.astro','utf8');
  assert.match(action,/<a\b/);
  assert.match(action,/<button\b/);
  assert.match(action,/type=\{buttonType\}/,'explicit native submit/reset types survive rendering');
  assert.doesNotMatch(action,/role="button"/,'navigation anchors retain native semantics');
});
