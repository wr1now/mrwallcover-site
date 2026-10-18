import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { questionIcon } from '../src/lib/question-visual.ts';
import { questionVisualForPath } from '../src/lib/question-visual-policy.ts';

test('future FAQ pages inherit dimensional studies while factual and reference utilities remain static',()=>{
  for(const path of ['/services/future-finish/','/areas/future-area/','/materials/future-weave/','/advice/future-installation-note/','/professionals/future-specialist/','/a-new-briefing-page/','/visual-contract-fixture/']) {
    assert.equal(questionVisualForPath(path),'dimensional',`${path}: deliberate shared FAQ use inherits the dimensional default`);
  }
  for(const path of ['/for-ai/','/for-ai/future-facts/','/wallcovering-installation-ai-crawler/','/privacy/','/accessibility/','/image-use/','/legal/future-notice/','/policies/future-policy/','/reference/future-table/','/search/','/thank-you/','/404.html','/calculator/','/wallpapering/preparation/','/wallpapering/lining-and-adhesives/']) {
    assert.equal(questionVisualForPath(path),'drawing',`${path}: factual reading and utility controls stay static`);
  }
  assert.equal(questionVisualForPath('/for-ai/?view=facts#questions'),'drawing','query strings and fragments do not change the factual presentation');
});

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

test('every normal built page inherits the shared footer, visual actions and critical font preloads', async () => {
  async function walk(dir:string):Promise<string[]> {
    const entries = await readdir(dir,{withFileTypes:true});
    return (await Promise.all(entries.map(e=>e.isDirectory()?walk(join(dir,e.name)):e.name.endsWith('.html')?[join(dir,e.name)]:[]))).flat();
  }
  const css=(await Promise.all((await readdir('dist/_astro')).filter(n=>n.endsWith('.css')).map(n=>readFile('dist/_astro/'+n,'utf8')))).join('');
  const fontPaths=['cormorant-garamond-latin-500-normal','outfit-latin-400-normal','outfit-latin-500-normal'].map(face=>{
    const path=css.match(new RegExp(`/_astro/${face}\\.[^\\s()"']+\\.woff2`))?.[0];
    assert.ok(path,`${face}: critical face must match a stylesheet font URL`);
    return path;
  }).sort();
  await Promise.all(fontPaths.map(path=>access('dist'+path)));
  let count=0;
  for (const file of await walk('dist')) {
    const html=await readFile(file,'utf8');
    if (/http-equiv="refresh"/.test(html)) continue;
    assert.equal((html.match(/<footer\b/g)||[]).length,1,file);
    assert.match(html,/data-footer/,file);
    assert.match(html,/data-effects-toggle/,file);
    const fontTags=html.match(/<link rel="preload" as="font"[^>]*>/g)??[];
    const fonts=fontTags.map(tag=>{
      assert.match(tag,/\stype="font\/woff2"/,`${file}: font preload type`);
      assert.match(tag,/\scrossorigin="anonymous"/,`${file}: font preload CORS`);
      return tag.match(/\shref="([^"]+)"/)?.[1];
    });
    assert.equal(new Set(fonts).size,3,`${file}: critical fonts preload once each`);
    assert.deepEqual(fonts.sort(),fontPaths,`${file}: heading, body and navigation font URLs match the stylesheet`);
    count++;
  }
  assert.ok(count>=90,'check the published page family, not a single example');
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
