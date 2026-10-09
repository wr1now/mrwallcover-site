const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium: playwright } = require(process.env.MW_PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const http=require('node:http'),path=require('node:path');
  const server=http.createServer((req,res)=>{
    let file=path.join(process.cwd(),'dist-review',new URL(req.url,'http://localhost').pathname);
    if(file.endsWith('/'))file+='index.html';
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.csv':'text/csv'};
    try { res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file)); } catch {res.statusCode=404;res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(4321,'127.0.0.1',resolve));
  const executablePath = process.env.MW_CHROMIUM_EXECUTABLE;
  const browser = await playwright.launch({ executablePath, args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'], headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  const base='http://127.0.0.1:4321';
  await page.goto(base+'/advice/');
  assert.equal(await page.locator('[data-guide-category]:visible').count(),10);
  await page.locator('[data-filter="choosing"]').click();
  assert.equal(await page.locator('[data-guide-category]:visible').count(),3);
  await page.locator('[data-filter="all"]').click();
  await page.waitForFunction(() => document.querySelector('[data-filter="all"]').getAttribute('aria-pressed') === 'true');
  assert.equal(await page.locator('[data-guide-category]:visible').count(),10);
  await page.screenshot({path:'docs/content/review/guide-desktop.png'});
  const overflow=[];
  for(const width of [390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for(const route of ['/advice/','/advice/grasscloth-seams-and-variation/','/materials/','/professionals/','/professionals/developers/','/contact/?audience=developer&intent=install']) {
      await page.goto(base+route);
      if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)) overflow.push({width,route});
    }
  }
  await page.setViewportSize({width:390,height:1000});
  await page.goto(base+'/advice/grasscloth-seams-and-variation/');
  await page.screenshot({path:'docs/content/review/guide-mobile.png'});
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Skip to content');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'/materials/#material-finder');
  await page.selectOption('#finder-use','quiet');
  await page.selectOption('#finder-look','natural');
  await page.selectOption('#finder-cleaning','gentle');
  await page.selectOption('#finder-panels','visible');
  await page.locator('[data-material-finder] button[type="submit"]').click();
  assert.equal(await page.locator('[data-material-result]:visible').count(),3);
  await page.locator('.material-finder').screenshot({path:'docs/content/review/material-finder.png'});
  await page.locator('[data-material-result="grasscloth-and-weaves"] [data-shortlist]').click();
  assert.match(await page.locator('[data-shortlist-count]').innerText(),/1/);
  await page.goto(base+'/contact/?audience=designer&intent=install');
  assert.equal(await page.locator('[data-builder]').isVisible(),true);
  assert.equal(await page.inputValue('[name="audience"]'),'designer');
  assert.equal(await page.inputValue('[name="shortlist"]'),'grasscloth-and-weaves');
  assert.match(await page.locator('[data-selection-text]').innerText(),/Natural texture/);
  let submissions=[];
  await page.route('https://formsubmit.co/**',async route=>{
    submissions.push(route.request().postData());
    await route.fulfill({status:200,contentType:'text/html',body:'<p>Test transport received</p>'});
  });
  for(const audience of ['designer','developer','hotel']) {
    await page.goto(base+`/contact/?audience=${audience}&intent=install`);
    await page.fill('[name="programme"]','November phase one');
    await page.fill('[name="materialResponsibility"]','Client supply');
    await page.fill('[name="specificationNotes"]','Revision C; sample area to agree');
    await page.fill('[name="name"]','Website Test');
    await page.check('[name="replyBy"][value="email"]');
    await page.fill('[name="email"]','website-test@example.com');
    await page.fill('[name="message"]','Test project brief for browser verification.');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('https://formsubmit.co/**');
    assert.match(submissions.at(-1),new RegExp(`name="audience"\\r\\n\\r\\n${audience}`));
    assert.match(submissions.at(-1),/Revision C; sample area to agree/);
    assert.match(submissions.at(-1),/grasscloth-and-weaves/);
    assert.match(submissions.at(-1),/name="materialPreferences"/);
  }
  await page.goto(base+'/materials/#material-finder');
  await page.selectOption('#finder-use','wet');
  await page.locator('[data-material-finder] button[type="submit"]').click();
  assert.equal(await page.locator('[data-material-result]:visible').count(),0);
  assert.match(await page.locator('[data-material-explanation]').innerText(),/review/);
  await page.locator('[data-material-finder] button[type="reset"]').click();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('mw-material-preferences')),null);
  await page.locator('[data-shortlist-clear]').click();
  assert.equal(await page.locator('[data-shortlist-count]').innerText(),'0');
  await page.goto(base+'/professionals/developers/');
  await page.screenshot({path:'docs/content/review/developers-desktop.png'});
  const downloadPromise=page.waitForEvent('download');
  await page.locator('a[download]').click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'wallcovering-package-schedule.csv');
  const noJs=await browser.newContext({javaScriptEnabled:false});
  const staticPage=await noJs.newPage();await staticPage.goto(base+'/advice/grasscloth-seams-and-variation/');
  assert.match(await staticPage.locator('article.guide-prose').innerText(),/panels are part of the appearance/);
  assert.equal(await staticPage.locator('h1').count(),1);
  await noJs.close();
  const result={filtering:true,keyboardSkipLink:true,materialPreferences:true,shortlist:true,professionalFormSubmissions:submissions.length,transport:'FormSubmit intercepted locally; no external enquiry sent',wetAreaReview:true,reset:true,scheduleDownload:true,noJavaScriptArticle:true,overflow,errors};
  fs.writeFileSync('docs/content/review/browser-results.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
  await browser.close();
  server.close();
  assert.deepEqual(errors,[]);assert.deepEqual(overflow,[]);
})().catch(e=>{console.error(e);process.exit(1)});
