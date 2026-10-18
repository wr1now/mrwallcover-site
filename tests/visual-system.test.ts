import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { questionIcon } from '../src/lib/question-visual.ts';

test('question drawings follow the topic and do not imply approval or certification',()=>{
  assert.equal(questionIcon('What does the project cost?'),'tag');
  assert.equal(questionIcon('How many rolls are needed?'),'roll');
  assert.equal(questionIcon('When should we book?'),'calendar');
  assert.equal(questionIcon('What wall dimensions do you need?'),'ruler');
  assert.equal(questionIcon('Can this be confidential?'),'lock');
  assert.equal(questionIcon('What insurance do you hold?','f-q1'),'drawing');
  assert.equal(questionIcon('Who installs hand-painted scenic wallpaper?','f-a2'),'panels');
  assert.equal(questionIcon('Which accreditation do you have?'),'drawing');
  assert.equal(questionIcon('Where should the first drop of wallpaper go?'),'ruler');
  assert.equal(questionIcon('What happens when the walls are not straight?'),'ruler');
  assert.equal(questionIcon('What is overlap and splice?'),'layers');
});

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

test('opening professional evidence is prioritized while other evidence remains lazy', async()=>{
  const professionals=JSON.parse(await readFile('src/content/professionals.json','utf8'));
  for (const item of professionals.filter((item:any)=>item.visual?.evidence)) {
    const html=await readFile(`dist/professionals/${item.slug}/index.html`,'utf8');
    const opening=html.match(/<figure\b[^>]*class="[^"]*professional-opening-evidence[^\"]*"[^>]*>[\s\S]*?<\/figure>/)?.[0];
    assert.ok(opening,`${item.slug}: opening evidence remains rendered`);
    const image=opening.match(/<img\b[^>]*>/)?.[0]??'';
    assert.match(image,/loading="eager"/,`${item.slug}: opening project photograph is discoverable without layout`);
    assert.match(image,/fetchpriority="high"/,`${item.slug}: opening photograph is prioritized`);
    assert.match(image,/\bwidth="\d+"/);
    assert.match(image,/\bheight="\d+"/);
  }
  // The shared component also serves lower-page evidence: do not make every photograph eager.
  const aftercare=await readFile('dist/aftercare/index.html','utf8');
  const evidence=aftercare.match(/<figure\b[^>]*class="[^"]*evidence-figure[^\"]*"[^>]*>[\s\S]*?<\/figure>/g)??[];
  assert.ok(evidence.length,'exercise the default on a real lower-page photograph');
  for(const figure of evidence) {
    const image=figure.match(/<img\b[^>]*>/)?.[0]??'';
    assert.match(image,/loading="lazy"/,'other evidence retains lazy loading');
    assert.doesNotMatch(image,/fetchpriority="high"/);
  }
});
