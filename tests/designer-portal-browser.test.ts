import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser, loadPage, serve } from '../scripts/visual-browser.mjs';

async function clickText(page: any, selector: string, text: string) {
  const handles = await page.$$(selector);
  for (const handle of handles) if ((await handle.evaluate((el: HTMLElement) => el.textContent?.trim())) === text) { await handle.click(); return; }
  throw new Error(`Control not found: ${text}`);
}
async function field(page: any, label: string, value: string, root = '') {
  const labels = await page.$$(`${root} label`);
  for (const item of labels) {
    if (await item.evaluate((el: HTMLElement, text: string) => el.firstElementChild?.textContent?.trim() === text, label)) {
      const input = await item.$('input,select,textarea');
      assert.ok(input, label);
      if (await input.evaluate((el: HTMLElement) => el.tagName === 'SELECT')) await input.select(value);
      else { await input.focus(); await input.press('End'); const length = await input.evaluate((el: HTMLInputElement) => el.value.length); for (let i = 0; i < length; i++) await input.press('Backspace'); if (value) await input.type(value); }
      return;
    }
  }
  throw new Error(`Field not found: ${label}`);
}
async function section(page: any, index: number) {
  const selector = `.dp-steps button:nth-of-type(${index})`;
  const target = await page.waitForSelector(selector, { visible: true });
  // Long forms may leave the section menu above a sticky header. Center the
  // actual target and verify its hit area before dispatching the native click.
  await target.evaluate((button: HTMLElement) => button.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  await page.waitForFunction((selector: string) => {
    const button = document.querySelector<HTMLElement>(selector); if (!button) return false;
    const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return rect.width > 0 && rect.height > 0 && hit !== null && button.contains(hit);
  }, {}, selector);
  await target.click();
  await page.waitForFunction((selector: string) => {
    const button = document.querySelector(selector), heading = document.querySelector('#dp-section-title');
    // Missing nodes must fail; comparing two missing nodes previously allowed
    // an unexpected page navigation to masquerade as a completed section change.
    return button !== null && heading !== null && button.getAttribute('aria-current') === 'step' && heading.textContent === button.querySelector('span:last-child')?.textContent;
  }, {}, selector);
}
async function noOverflow(page: any) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page must fit viewport');
}

test('public guide filters real types and exact-product examples; no invented unknown prices', async () => {
  const server = await serve('dist'), browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 920 });
      await loadPage(page, server.origin + '/professionals/designers/');
      assert.equal(await page.$$eval('[data-price-card]', (els: HTMLElement[]) => els.length), 9);
      await page.type('[data-price-search]', 'Arte Grandeur');
      await page.waitForFunction(() => document.querySelector('[data-price-count]')?.textContent === '1 matching wallpaper group');
      const specialist = await page.$eval('[data-price-card]:not([hidden])', (el: HTMLElement) => el.innerText);
      assert.match(specialist, /Grandeur/); assert.doesNotMatch(specialist, /£120|£26|£0\b/);
      await page.$eval('[data-price-search]', (el: HTMLInputElement) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.select('[data-price-group]', 'printed-paper');
      assert.equal(await page.$$eval('[data-price-card]:not([hidden])', (els: HTMLElement[]) => els.length), 1);
      await page.select('[data-price-group]', '');
      await page.type('[data-price-search]', 'unknown-product-no-match');
      assert.equal(await page.$eval('[data-price-empty]', (el: HTMLElement) => el.hidden), false);
      await noOverflow(page);
    }
  } finally { await browser.close(); await server.close(); }
});

test('private draft journey works on desktop/mobile; area changes reset confirmation and drafts round-trip', async () => {
  const server = await serve('dist'), browser = await launchBrowser();
  const downloads = await mkdtemp(join(tmpdir(), 'mw-designer-browser-'));
  try {
    const page = await browser.newPage(), errors: string[] = [], external: string[] = [];
    page.on('pageerror', (error: Error) => errors.push(error.message));
    page.on('request', (request: any) => { if (/^https?:/.test(request.url()) && !request.url().startsWith(server.origin)) external.push(request.url()); });
    const cdp = await page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 920 });
      await loadPage(page, server.origin + '/designer-portal/');
      await page.waitForSelector('[data-designer-portal]');
      assert.match(await page.$eval('.dp-activation', (el: HTMLElement) => el.textContent), /awaiting activation/);
      await field(page, 'Project name or reference', 'Synthetic browser review');
      await section(page, 2);
      await clickText(page, 'button', 'Add a room / area');
      await field(page, 'Room / area', 'Study'); await field(page, 'Floor / phase reference', 'Ground');
      await field(page, 'Covered width', '3000'); await field(page, 'Covered height', '2700');
      assert.equal(await page.$eval('.dp-area strong', (el: HTMLElement) => el.textContent), '8.10 m²');
      await clickText(page, 'summary', 'Uncovered openings to deduct · 0');
      await clickText(page, 'button', 'Add an opening');
      await field(page, 'Width', '900', '.dp-opening'); await field(page, 'Height', '2100', '.dp-opening');
      assert.equal(await page.$eval('.dp-area strong', (el: HTMLElement) => el.textContent), '6.21 m²');
      await page.click('.dp-scope > .dp-checkbox input');
      assert.equal(await page.$eval('.dp-scope > .dp-checkbox input', (el: HTMLInputElement) => el.checked), true);
      await field(page, 'Covered height', '2800');
      assert.equal(await page.$eval('.dp-scope > .dp-checkbox input', (el: HTMLInputElement) => el.checked), false);
      await noOverflow(page);
      await section(page, 3); await noOverflow(page);
      await section(page, 4); assert.match(await page.$eval('.dp-editor', (el: HTMLElement) => el.textContent), /PDF|drawings/);
      await section(page, 5);
      const request = await page.$('button.mw-action--primary[disabled]'); assert.ok(request, 'budget issuance must stay disabled before activation');
      assert.equal(await page.$('.dp-totals'), null, 'an incomplete brief must not display a complete estimate');
      await noOverflow(page);
    }
    await clickText(page, 'button', 'Download draft');
    let files: string[] = [];
    for (let i = 0; i < 100; i++) { files = (await readdir(downloads)).filter(x => x.endsWith('.json')); if (files.length) break; await new Promise(resolve => setTimeout(resolve, 30)); }
    assert.equal(files.length, 1);
    const path = join(downloads, files[0]), draft = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(draft.name, 'Synthetic browser review'); assert.equal(draft.items[0].walls[0].heightMm, 2800);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-designer-portal]');
    const upload = await page.$('input[aria-label="Open a project draft JSON file"]');
    await upload.uploadFile(path);
    await page.waitForFunction(() => document.querySelector('.dp-live-message')?.textContent?.includes('Draft opened'));
    assert.equal(await page.$eval('input[maxlength="160"]', (el: HTMLInputElement) => el.value), 'Synthetic browser review');
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.deepEqual(external, [], 'private workspace must not send draft data or analytics externally');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); await rm(downloads, { recursive: true, force: true }); }
});

test('private workspace stays out of indexing and public content exports', async () => {
  const html = await readFile('dist/designer-portal/index.html', 'utf8');
  assert.match(html, /name="robots" content="noindex,\s*nofollow"/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.doesNotMatch(await readFile('dist/sitemap-0.xml', 'utf8'), /\/designer-portal\//);
  assert.equal((await readdir('dist/designer-portal')).includes('index.md'), false);
});

test('intake validation accepts incomplete legacy drafts and measured ceilings, rejects mixed surfaces and unsafe references', async () => {
  const { emptyProjectDraft, measureScopeArea, validateProjectDraft, draftInformationNeeded } = await import('../src/designer-portal/validation.ts');
  const project = emptyProjectDraft();
  delete project.buildingType; delete project.resources; delete project.programme.materialReadiness;
  assert.equal(validateProjectDraft(project).ok, true, 'old incomplete drafts remain readable');
  project.rooms = [{ id: 'room', label: 'Study', floor: 'Ground' }];
  project.items = [{ id: 'ceiling', roomId: 'room', label: 'Ceiling textile', scopeKind: 'single_room', surfaceKind: 'ceiling', confirmedMeasurements: false, walls: [], ceilings: [{ id: 'face', widthMm: 4000, lengthMm: 5000, count: 2, openings: [{ id: 'rooflight', widthMm: 1000, lengthMm: 500, count: 1 }] }], material: { groupId: 'standard-fabric', clientProvided: true, acoustic: 'no', velvet: 'no', specialist: 'no' }, preparation: 'unknown', access: 'unknown' }];
  assert.equal(validateProjectDraft(project).ok, true);
  assert.equal(measureScopeArea(project.items[0]).netM2, 39);
  assert.ok(draftInformationNeeded(project).some(reason => reason.key === 'ceiling-confirmation'));
  const mixed = structuredClone(project); mixed.items[0].walls = [{ id: 'wall', widthMm: 1000, heightMm: 2000, count: 1, openings: [], reveals: [] }];
  const mixedResult = validateProjectDraft(mixed); assert.equal(mixedResult.ok, false); if (!mixedResult.ok) assert.ok(mixedResult.issues.some(issue => issue.code === 'mixed-surfaces'));
  project.resources = { materialRequirements: [], preparationChecklist: [], sampleApprovals: [], aftercareReferences: [{ id: 'care', label: 'Maker care', scopeItemIds: ['missing-scope'], status: 'to-confirm', url: 'javascript:alert(1)' }] };
  const unsafe = validateProjectDraft(project); assert.equal(unsafe.ok, false); if (!unsafe.ok) { assert.ok(unsafe.issues.some(issue => issue.code === 'scope')); assert.ok(unsafe.issues.some(issue => issue.code === 'url')); }
  project.resources.aftercareReferences[0].scopeItemIds = ['ceiling']; project.resources.aftercareReferences[0].url = 'https://example.invalid/care';
  assert.equal(validateProjectDraft(project).ok, true, 'unconfirmed project records are saveable without claiming readiness');
  project.items[0].ceilings![0].openings[0].lengthMm = 0; project.items[0].confirmedMeasurements = true; assert.equal(validateProjectDraft(project).ok, true, 'an explicitly unknown opening remains an incomplete draft'); assert.ok(draftInformationNeeded(project).some(reason => reason.key === 'ceiling-parts' && /Zero-sized rectangles/.test(reason.message)), 'confirmation cannot hide an unknown ceiling opening'); project.items[0].ceilings![0].openings[0].lengthMm = 500; assert.equal(draftInformationNeeded(project).some(reason => reason.key === 'ceiling-parts'), false);
  project.programme.materialReadiness = { status: 'ordered', scopeItemIds: ['ceiling'], readyDate: '2026-02-30' }; assert.equal(validateProjectDraft(project).ok, false, 'invalid material dates cannot be saved');
  project.programme.materialReadiness.readyDate = '2026-11-10'; project.programme.startDate = '2026-11-01'; assert.equal(validateProjectDraft(project).ok, true, 'a late delivery plan is saveable but requires review'); assert.ok(draftInformationNeeded(project).some(reason => reason.key === 'readiness-programme'));
});

test('ceiling intake and project-specific resources round-trip; changed scope invalidates approvals and readiness', async () => {
  const server = await serve('dist'), browser = await launchBrowser(), downloads = await mkdtemp(join(tmpdir(), 'mw-designer-resources-'));
  try {
    const page = await browser.newPage(), errors: string[] = [], external: string[] = [];
    page.on('pageerror', (error: Error) => errors.push(error.message));
    page.on('request', (request: any) => { if (/^https?:/.test(request.url()) && !request.url().startsWith(server.origin)) external.push(request.url()); });
    const cdp = await page.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 920 }); await loadPage(page, server.origin + '/designer-portal/'); await page.waitForSelector('[data-designer-portal]');
      await field(page, 'Building type', 'hotel');
      await section(page, 2); await clickText(page, 'button', 'Add a room / area'); await field(page, 'Room / area', 'Ceiling study');
      await field(page, 'Surface to cover', 'ceiling');
      assert.equal(await page.$$eval('.dp-scope label > span:first-child', (labels: HTMLElement[]) => labels.some(label => label.textContent === 'Covered height')), false, 'ceiling input must use plane length rather than wall height');
      assert.equal(await page.$eval('.dp-ceiling input[type="number"]', (input: HTMLInputElement) => input.value), '', 'surface change must not invent dimensions');
      await field(page, 'Ceiling covered width', '4000'); await field(page, 'Ceiling covered length', '5000');
      await clickText(page, 'summary', 'Uncovered ceiling openings to deduct · 0'); await clickText(page, 'button', 'Add a ceiling opening');
      await field(page, 'Ceiling opening width', '1000'); await field(page, 'Ceiling opening length', '500');
      assert.equal(await page.$eval('.dp-area strong', (el: HTMLElement) => el.textContent), '19.50 m²');
      await page.click('.dp-scope > .dp-checkbox input'); assert.equal(await page.$eval('.dp-scope > .dp-checkbox input', (input: HTMLInputElement) => input.checked), true);
      await section(page, 3); await field(page, 'Material readiness', 'checked-ready'); await field(page, 'Material constraints / outstanding items', 'Materials checked for this ceiling scope.');
      await section(page, 6); await clickText(page, 'button', 'Add a material requirement'); await field(page, 'Material requirement', 'Maker ceiling panels'); await field(page, 'Ordering quantity', '12'); await field(page, 'Ordering unit', 'panel'); await field(page, 'Quantity source / drawing revision', 'Reviewed panel schedule C-02'); await field(page, 'Supply status', 'client-confirmed');
      await clickText(page, 'button', 'Add a preparation check'); await field(page, 'Preparation check', 'Ceiling substrate inspection'); await field(page, 'Checked by', 'Synthetic reviewer'); await field(page, 'Preparation status', 'ready');
      await clickText(page, 'button', 'Add a sample approval'); await field(page, 'Sample / setting-out reference', 'Panel setting-out C-02'); await field(page, 'Approved by', 'Synthetic designer'); await field(page, 'Sample status', 'approved');
      await clickText(page, 'button', 'Add an aftercare reference'); await field(page, 'Aftercare reference', 'Maker ceiling care instructions'); await field(page, 'Product-specific aftercare / handover notes', 'Care instructions to be confirmed against exact finish.');
      await noOverflow(page);
      await section(page, 2); await field(page, 'Product code / colourway', 'REVISED-CEILING');
      await field(page, 'Ceiling covered length', '5100');
      assert.equal(await page.$eval('.dp-scope > .dp-checkbox input', (input: HTMLInputElement) => input.checked), false);
      await section(page, 3); assert.equal(await page.$eval('.dp-readiness select', (select: HTMLSelectElement) => select.value), 'unknown');
      await section(page, 6); assert.equal(await page.$eval('[data-resource-group="materials"] select', (select: HTMLSelectElement) => select.value), 'wallcovering');
      assert.equal(await page.$eval('[data-resource-group="preparation"] select', (select: HTMLSelectElement) => select.value), 'needs-review');
      assert.equal(await page.$eval('[data-resource-group="samples"] select', (select: HTMLSelectElement) => select.value), 'needs-review');
      assert.equal(await page.$eval('[data-resource-group="samples"] input', (input: HTMLInputElement) => input.value), 'Panel setting-out C-02');
      await noOverflow(page);
    }
    await clickText(page, 'button', 'Download draft');
    let files: string[] = []; for (let i = 0; i < 100; i++) { files = (await readdir(downloads)).filter(name => name.endsWith('.json')); if (files.length) break; await new Promise(resolve => setTimeout(resolve, 30)); }
    assert.equal(files.length, 1); const path = join(downloads, files[0]), draft = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(draft.buildingType, 'hotel'); assert.equal(draft.items[0].surfaceKind, 'ceiling'); assert.deepEqual(draft.items[0].walls, []); assert.equal(draft.items[0].ceilings[0].lengthMm, 5100);
    assert.equal(draft.resources.materialRequirements[0].status, 'to-confirm'); assert.equal(draft.resources.sampleApprovals[0].approvedBy, undefined); assert.equal(draft.resources.preparationChecklist[0].checkedBy, undefined); assert.equal(draft.programme.materialReadiness.status, 'unknown');
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('[data-designer-portal]'); const upload = await page.$('input[aria-label="Open a project draft JSON file"]'); await upload.uploadFile(path);
    await page.waitForFunction(() => document.querySelector('.dp-live-message')?.textContent?.includes('Draft opened')); await section(page, 6);
    assert.equal(await page.$eval('[data-resource-group="materials"] input', (input: HTMLInputElement) => input.value), 'Maker ceiling panels');
    await clickText(page, 'summary', (await page.$eval('.dp-missing summary', (element: HTMLElement) => element.textContent)));
    assert.match(await page.$eval('.dp-missing', (element: HTMLElement) => element.textContent), /Incomplete briefs can be saved|Material readiness|material readiness/);
    assert.deepEqual(external, []); assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
  } finally { await browser.close(); await server.close(); await rm(downloads, { recursive: true, force: true }); }
});
