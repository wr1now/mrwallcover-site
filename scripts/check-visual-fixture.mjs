/** Build a genuinely new route in a temporary output, then remove its temporary source. */
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { serve, launchBrowser } from './visual-browser.mjs';
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
  const server=await serve(out);
  const browser=await launchBrowser();
  try {
    const page=await browser.newPage();
    await page.goto(server.origin+'/visual-contract-fixture/',{waitUntil:'networkidle0'});
    await page.type('[data-action-form] input',' changed');
    await page.click('[data-action-form] button[type="reset"]');
    assert.equal(await page.$eval('[data-action-form] input',input=>input.value),'Original','reset action performs a native form reset');
    await page.click('[data-action-form] button[type="submit"]');
    assert.equal(await page.$eval('[data-action-submissions]',output=>output.textContent),'1','submit action fires the native submit event');
    for (const width of [360,390,768,1024,1280,1440]) {
      await page.setViewport({width,height:900});
      await page.goto(server.origin+'/contact/',{waitUntil:'networkidle0'});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`phone-enabled layout @${width}`);
      assert.ok(await page.$('[data-wa]'),'phone-enabled WhatsApp control');
      assert.match(await page.$eval('[data-wa]',(link)=>link.href),/^https:\/\/wa\.me\//,'WhatsApp payload resolves without opening a chat');
      if (width >= 1024) {
        const header = await page.evaluate(() => {
          const bar = document.querySelector('.site-header').getBoundingClientRect();
          const mark = document.querySelector('.wordmark').getBoundingClientRect();
          const nav = document.querySelector('.primary-nav').getBoundingClientRect();
          const action = document.querySelector('.header-action').getBoundingClientRect();
          const text = document.createRange();
          text.selectNodeContents(document.querySelector('.header-action > span'));
          return { lines: text.getClientRects().length, clear: nav.left >= mark.right + 8 && action.right <= bar.right - 8, book: getComputedStyle(document.querySelector('.header-book')).display !== 'none' };
        });
        assert.equal(header.lines, 1, `phone-enabled header action stays on one line @${width}`);
        assert.equal(header.clear, true, `phone-enabled header controls fit inside the bar @${width}`);
        assert.equal(header.book, width >= 1440, `booking link uses the wider header @${width}`);
      }
      if (width<1280) {
        await page.focus('input[name="name"]');
        assert.equal(await page.$eval('[data-dock]',(dock)=>getComputedStyle(dock).display),'none','phone-enabled dock hides for form focus');
      }
    }
    await page.goto(server.origin+'/get-in-touch/',{waitUntil:'networkidle0'});
    await page.click('main [data-phone-reveal]');
    assert.ok(await page.$('main a[href^="tel:"]'),'phone reveal becomes a dial link without placing a call');
  } finally { await browser.close(); await server.close(); }
  console.log('New route fixture: shared footer/actions inherited without local CSS; native button and disabled-link semantics pass. Fixture removed from source and public output.');
  console.log('Phone-enabled browser fixture: six widths, single-line desktop contact action within the bar, booking from 1440px, WhatsApp href decoding, field-focus dock hiding and phone reveal pass; no call or message sent.');
} finally { await rm(fixture,{force:true}); await rm(out,{recursive:true,force:true}); }
