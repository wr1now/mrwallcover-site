/** Build a genuinely new route in a temporary output, then remove its temporary source. */
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { serve, launchBrowser, loadPage, waitForPagePredicate } from './visual-browser.mjs';
const fixture='src/pages/visual-contract-fixture.astro';
let exists=false;
try { await access(fixture); exists=true; } catch {}
assert.equal(exists,false,'temporary fixture must never overwrite an existing route');
const out=await mkdtemp(join(tmpdir(),'mw-visual-fixture-'));
const contact=JSON.parse(await readFile('tests/fixtures/contact.json','utf8'));
try {
  await writeFile(fixture,await readFile('tests/fixtures/visual-page.astro.txt','utf8'),{flag:'wx'});
  await promisify(execFile)(process.execPath,['node_modules/astro/bin/astro.mjs','build','--outDir',out],{maxBuffer:32*1024*1024,env:{...process.env,SITE_PHONE:contact.phone}});
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
  assert.equal((html.match(/type="submit"/g)||[]).length,1,'native submit type rendered once');
  assert.equal((html.match(/type="reset"/g)||[]).length,1,'native reset type rendered once');
  assert.doesNotMatch(html,/<button\b[^>]*\btype="[^"]*"[^>]*\btype=/,'no duplicate native button types');
  assert.match(html,/data-design-object="roll"/,'a new FAQ inherits a relevant dimensional study without an opt-in');
  const poster=html.match(/<img\b[^>]*src="\/media\/design-objects\/roll\.webp"[^>]*>/)?.[0];
  assert.ok(poster,'the default study includes its complete server-rendered poster');
  assert.match(poster,/\bwidth="[1-9]\d*"/);
  assert.match(poster,/\bheight="[1-9]\d*"/);
  assert.match(poster,/\balt=""/,'the adjacent question supplies the meaning');
  assert.match(poster,/\bloading="lazy"/);
  const motion=html.match(/<button\b[^>]*data-object-motion[^>]*>/)?.[0];
  assert.ok(motion,'the shared FAQ provides a native motion control');
  assert.match(motion,/\btype="button"/);
  assert.match(motion,/\baria-pressed="false"/);
  assert.match(motion,/\bhidden(?:\s|>|=)/,'unavailable enhancement control starts hidden');
  const server=await serve(out);
  const browser=await launchBrowser();
  try {
    const page=await browser.newPage();
    await loadPage(page,server.origin+'/visual-contract-fixture/');
    await page.type('[data-action-form] input',' changed');
    await page.click('[data-action-form] button[type="reset"]');
    assert.equal(await page.$eval('[data-action-form] input',input=>input.value),'Original','reset action performs a native form reset');
    await page.click('[data-action-form] button[type="submit"]');
    assert.equal(await page.$eval('[data-action-submissions]',output=>output.textContent),'1','submit action fires the native submit event');
    await page.$eval('[data-design-object] img',image=>{image.loading='eager';});
    await waitForPagePredicate(page,()=>document.querySelector('[data-design-object] img').complete);
    for(const width of [390,1440]) {
      await page.setViewport({width,height:900});
      await page.$eval('.faq summary',summary=>summary.scrollIntoView({block:'center',behavior:'instant'}));
      await page.waitForFunction(()=>document.querySelector('[data-design-object][data-live]'));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`new default-dimensional route @${width}`);
      await page.focus('.faq summary');
      await page.keyboard.press('Enter');
      assert.equal(await page.$eval('.faq details',details=>details.open),true,'the new shared FAQ keeps native keyboard disclosure');
      await page.keyboard.press('Enter');
      assert.equal(await page.$eval('.faq details',details=>details.open),false);
    }
    await page.click('button[data-object-motion]');
    await page.waitForFunction(()=>!document.querySelector('[data-design-object][data-live]')&&getComputedStyle(document.querySelector('[data-design-object] img')).visibility==='visible');
    assert.equal(await page.$eval('button[data-object-motion]',button=>button.getAttribute('aria-pressed')),'true','new-route motion control pauses the shared enhancement');
    await page.click('button[data-object-motion]');
    await page.$eval('[data-design-object]',object=>object.scrollIntoView({block:'center',behavior:'instant'}));
    await page.waitForFunction(()=>document.querySelector('[data-design-object][data-live]'));

    const plain=await browser.newPage();
    await plain.setJavaScriptEnabled(false);
    await plain.setViewport({width:390,height:900});
    await loadPage(plain,server.origin+'/visual-contract-fixture/');
    await plain.$eval('[data-design-object] img',image=>{image.loading='eager';});
    await waitForPagePredicate(plain,()=>document.querySelector('[data-design-object] img').complete);
    assert.equal(await plain.$eval('[data-design-object] img',image=>image.naturalWidth>0&&getComputedStyle(image).visibility==='visible'),true,'a genuinely new route keeps its complete illustration without JavaScript');
    assert.equal(await plain.$$eval('button[data-object-motion]',buttons=>buttons.length>0&&buttons.every(button=>button.hidden&&button.getClientRects().length===0)),true,'no-JavaScript motion controls are actually hidden');
    assert.equal(await plain.$$eval('[data-design-object] canvas',canvases=>canvases.length),0);
    await plain.focus('.faq summary');
    await plain.keyboard.press('Enter');
    assert.equal(await plain.$eval('.faq details',details=>details.open),true,'the future-page FAQ works without JavaScript');
    await plain.close();
    for (const width of [360,390,768,1024,1280,1440]) {
      await page.setViewport({width,height:900});
      await loadPage(page,server.origin+'/contact/');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`phone-enabled layout @${width}`);
      assert.ok(await page.$('[data-wa]'),'phone-enabled WhatsApp control');
      assert.match(await page.$eval('[data-wa]',(link)=>link.href),/^https:\/\/wa\.me\//,'WhatsApp payload resolves without opening a chat');
      if (width >= 1280) {
        const header = await page.evaluate(() => {
          const bar = document.querySelector('.site-header').getBoundingClientRect();
          const mark = document.querySelector('.wordmark').getBoundingClientRect();
          const nav = document.querySelector('.primary-nav').getBoundingClientRect();
          const action = document.querySelector('.header-action').getBoundingClientRect();
          const text = document.createRange();
          text.selectNodeContents(document.querySelector('.header-action > span'));
          return { lines: text.getClientRects().length, clear: nav.left >= mark.right + 8 && action.right <= bar.right - 8, book: !!document.querySelector('.header-book') };
        });
        assert.equal(header.lines, 1, `phone-enabled header action stays on one line @${width}`);
        assert.equal(header.clear, true, `phone-enabled header controls fit inside the bar @${width}`);
        assert.equal(header.book, false, `booking stays on contact pages, footer and dock @${width}`);
      }
      if (width<1280) {
        await page.focus('input[name="name"]');
        assert.equal(await page.$eval('[data-dock]',(dock)=>getComputedStyle(dock).display),'none','phone-enabled dock hides for form focus');
      }
    }
    await loadPage(page,server.origin+'/get-in-touch/');
    await page.click('main [data-phone-reveal]');
    assert.ok(await page.$('main a[href^="tel:"]'),'phone reveal becomes a dial link without placing a call');
  } finally { await browser.close(); await server.close(); }
  console.log('New route fixture: shared footer/actions and default dimensional FAQ inherited without local CSS or opt-in; native controls, pause/resume, mobile/desktop layout and complete no-JavaScript poster/disclosure pass. Fixture removed from source and public output.');
  console.log('Phone-enabled browser fixture: six widths, single-line desktop contact action within the bar, booking outside the header, WhatsApp href decoding, field-focus dock hiding and phone reveal pass; no call or message sent.');
} finally { await rm(fixture,{force:true}); await rm(out,{recursive:true,force:true}); }
