import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
const paths=['advice','where-to-buy','how-we-check'];
test('standalone Guide pages use the shared shell and only published internal destinations',()=>{
 for(const p of paths){
  const html=read(`dist/${p}/index.html`);
  assert.equal((html.match(/<h1\b/g)||[]).length,1,p);
  assert.match(html,/data-footer/); assert.match(html,/aria-label="Footer navigation"/);
  for(const match of html.matchAll(/href="(\/[^"?#]*)(?:[?#][^"]*)?"/g)){
   const href=match[1]; assert.ok(existsSync(`dist${href}${href.endsWith('/')?'index.html':''}`),`${p}: ${href}`);
  }
  assert.doesNotMatch(html,/href="\/(?:calculator\/|wallpapering\/(?:preparation|lining-and-adhesives)\/)/);
 }
 assert.ok(!existsSync('dist/calculator/index.html'));

});
test('policy scopes review promises; discovery includes both editorial routes',()=>{
 const policy=read('dist/how-we-check/index.html');
 assert.match(policy,/does not claim that every older page/);
 assert.doesNotMatch(policy,/is checked twice before it appears/);
 for(const slug of ['where-to-buy','how-we-check'])for(const file of ['dist/search/index.html','dist/llms.txt','dist/sitemap-0.xml'])assert.ok(read(file).includes(`/${slug}/`),`${file}: ${slug}`);
 assert.match(read('src/content/navigation.json'),/"Guide"/);
 const workflow=read('.github/workflows/pages.yml'); assert.match(workflow,/MW_NAMES: \$\{\{ secrets.MW_NAMES \}\}/);
 assert.match(workflow,/run: npm run check:names/); assert.doesNotMatch(workflow,/--if-present/);
});
test('shared design rules and actions are inherited by future editorial pages',()=>{
 assert.match(read('src/layouts/Base.astro'),/visual-system.css/);
 assert.match(read('src/pages/[...page].astro'),/<Action href=\{cta.href\}/);
 assert.match(read('AGENTS.md'),/visual-standard/);
 const routes=JSON.parse(read('docs/design/route-review.json')).routes;
 for(const p of paths)assert.ok(routes.some((r:{path:string,decision:string})=>r.path===`/${p}/`&&r.decision.length>25));
});

test('footer preserves the published directory destinations',()=>{
 const html=read('dist/advice/index.html');const footer=html.slice(html.indexOf('<footer')).split('</footer>')[0];
 const expected=JSON.parse(read('tests/fixtures/footer-destinations.json'));
 for(const href of expected)assert.ok(footer.includes(`href="${href}"`),`Footer lost ${href}`);
 assert.match(footer,/data-effects-toggle/);assert.match(footer,/<details[^>]*open/);
});
