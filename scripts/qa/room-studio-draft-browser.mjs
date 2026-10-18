/** Local recovery regressions in a disposable browser profile. No cloud calls. */
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixtureProject } from '../../src/room-studio/fixtures.ts';
import { launchBrowser, serve, waitForPagePredicate } from '../visual-browser.mjs';

const output = resolve('.review-screens/room-studio-drafts'); await mkdir(output, { recursive: true });
const server = await serve(process.env.ROOM_STUDIO_DIST ?? 'dist');
const browser = await launchBrowser();
try {
  const page = await browser.newPage(), errors = [], blocked = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => { if(request.url().startsWith(server.origin) && request.method() === 'GET' || request.url().startsWith('data:') || request.url().startsWith('blob:')) request.continue(); else { blocked.push(request.url().split('?')[0]); request.abort(); } });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${server.origin}/room-studio/`, { waitUntil: 'networkidle0' }); await page.waitForSelector('[data-studio-ready=true]');
  async function seed(value) {
    await page.evaluate(value => new Promise((resolve, reject) => { const request = indexedDB.open('mrwallcover-room-studio-v1', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(value, 'current'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; request.onerror = () => reject(request.error); }), value);
    await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('[data-studio-ready=true]');
  }
  async function stored() {
    return page.evaluate(() => new Promise((resolve, reject) => { const request = indexedDB.open('mrwallcover-room-studio-v1', 1); request.onsuccess = () => { const db = request.result, item = db.transaction('drafts').objectStore('drafts').get('current'); item.onsuccess = () => { db.close(); resolve(item.result); }; item.onerror = () => reject(item.error); }; request.onerror = () => reject(request.error); }));
  }
  async function click(text, selector = '.room-studio button') { const target = await page.evaluateHandle((text, selector) => [...document.querySelectorAll(selector)].find(button => button.textContent.trim() === text), text, selector); assert.ok(target.asElement(), `Button: ${text}`); await target.asElement().click(); await target.dispose(); }
  const pause = () => new Promise(resolve => setTimeout(resolve, 700));
  const invalid = fixtureProject(); invalid.name = 'Recoverable invalid draft'; invalid.assignments[0].toMm = invalid.room.heightMm + 400;
  await seed(invalid); await pause();
  assert.equal(await page.$eval('.studio-title input', input => input.value), invalid.name);
  assert.ok(await page.$('.room-studio>.studio-error'), 'Invalid editable room is restored with correction guidance');
  assert.deepEqual(await stored(), invalid, 'Invalid saved room is not overwritten with a blank room');

  const corrupt = { schemaVersion: 1, name: 'Preserve original bytes', room: null, sentinel: 'original unsupported fixture' };
  await seed(corrupt); await pause();
  assert.ok(await page.$eval('.room-studio', element => element.innerText.includes('original saved draft has not been overwritten')));
  await page.$eval('.studio-title input', input => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'Temporary recovery screen edit'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await pause(); assert.deepEqual(await stored(), corrupt, 'Unrecoverable original is protected even after editing the placeholder');
  const downloaded = resolve(output, 'room-studio-original-draft.json');
  await rm(downloaded, { force: true });
  const client = await page.createCDPSession(); await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: output });
  await click('Download original saved draft');
  for (let attempt = 0; attempt < 30; attempt++) { try { assert.deepEqual(JSON.parse(await readFile(downloaded, 'utf8')), corrupt); break; } catch (error) { if (attempt === 29) throw error; await new Promise(resolve => setTimeout(resolve, 100)); } }
  await click('New room'); await click('Start new room'); await pause();
  assert.equal((await stored()).name, 'My room', 'Explicit new room releases the recovery save gate');

  // Explicit local deletion releases a blocked recovery state and cancels any
  // old debounced save before the database is removed.
  await seed(corrupt);
  await (await page.$$('.studio-steps button'))[3].click();
  await page.evaluate(() => { const summary = [...document.querySelectorAll('.studio-details summary')].find(item => item.textContent === 'Local privacy & deletion'); summary.parentElement.open = true; });
  await click('Delete local room data'); await click('Delete local data'); await pause();
  assert.equal((await stored()).name, 'My room');
  assert.equal(await page.evaluate(() => document.querySelector('.room-studio').innerText.includes('original saved draft has not been overwritten')), false);
  await page.$eval('.studio-title input', input => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'After deletion'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await pause(); assert.equal((await stored()).name, 'After deletion', 'Saving resumes after deliberate deletion');
  const previousId = (await stored()).id;
  await page.$eval('.studio-title input', input => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'Pending save must not return'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('Delete local room data'); await click('Delete local data'); await pause();
  const erased = await stored(); assert.equal(erased.name, 'My room'); assert.notEqual(erased.id, previousId); assert.equal(erased.finishes.length, 1, 'Old uploaded finishes are removed');

  const lShape = fixtureProject('l-shape'); lShape.name = 'Existing L-shaped room';
  await seed(lShape); await pause();
  const shapeSelect = await page.evaluateHandle(() => [...document.querySelectorAll('.studio-field')].find(field => field.textContent.startsWith('Room shape'))?.querySelector('select'));
  assert.equal(await shapeSelect.asElement().evaluate(select => select.value), 'custom');
  await shapeSelect.asElement().select('custom'); await pause();
  assert.deepEqual((await stored()).room, lShape.room, 'Selecting edit outline preserves imported corners and openings');
  const step = await page.evaluateHandle(() => [...document.querySelectorAll('.studio-steps button')].find(button => button.textContent.endsWith('Finishes'))); await step.asElement().click();
  const back = await page.evaluateHandle(() => [...document.querySelectorAll('.studio-steps button')].find(button => button.textContent.endsWith('Room'))); await back.asElement().click();
  assert.ok(await page.$('.studio-vertex'), 'Returning to Room retains custom coordinate controls');
  assert.deepEqual((await stored()).room, lShape.room);

  // A trim edit must not erase a customer's still-valid custom viewpoints.
  const before = (await stored()).cameras;
  await page.$eval('.studio-details', details => { details.open = true; });
  const trim = await page.evaluateHandle(() => [...document.querySelectorAll('.studio-field')].find(field => field.textContent.startsWith('Skirting height'))?.querySelector('input'));
  await trim.asElement().evaluate(input => { input.focus(); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '100'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => new Promise(requestAnimationFrame)); await trim.asElement().evaluate(input => input.blur());
  await pause(); assert.equal((await stored()).room.skirtingMm, 100); assert.deepEqual((await stored()).cameras, before, 'Trim edits preserve saved camera coordinates and IDs');

  const bands = fixtureProject();
  bands.schemes = [{id:'height-scheme',name:'Height bands',finishes:structuredClone(bands.finishes),assignments:[
    {...bands.assignments[0],toMm:2600}, {...bands.assignments[1],fromMm:2500,toMm:2600}, {...bands.assignments[2],toMm:null},
  ]}];
  await seed(bands);
  const height = await page.evaluateHandle(() => [...document.querySelectorAll('.studio-field')].find(field => field.textContent.startsWith('Ceiling height')).querySelector('input'));
  await height.asElement().evaluate(input => { input.focus(); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input,'2400'); input.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.evaluate(() => new Promise(requestAnimationFrame)); await height.asElement().evaluate(input => input.blur()); await pause();
  const adapted = (await stored()).schemes[0].assignments;
  assert.equal(adapted.length,2); assert.equal(adapted.find(a=>a.wallId===bands.assignments[0].wallId).toMm,2400); assert.equal(adapted.find(a=>a.wallId===bands.assignments[2].wallId).toMm,null);

  const unsafe = fixtureProject(); unsafe.finishes.find(finish=>finish.type==='bauwerk').productUrl='javascript:alert(1)';
  unsafe.finishes[0].texture.dataUrl='https://example.invalid/private-texture.png';
  await seed(unsafe); await (await page.$$('.studio-steps button'))[1].click(); await page.waitForSelector('.studio-finish-panel');
  const savedFinish = await page.$('.studio-finish-application select');
  await savedFinish.select('fixture-bauwerk-olive');
  await page.waitForFunction(()=>document.querySelector('.studio-finish-application').innerText.includes('invalid product link'));
  assert.equal(await page.$('.studio-finish-application a'),null,'Damaged draft cannot expose an unsafe product anchor');
  await savedFinish.select(unsafe.finishes[0].id); await click('Edit crop and repeat proof');
  await page.waitForFunction(()=>document.querySelector('.studio-finish-panel [role=alert]')?.innerText.includes('Remote image links'));
  assert.equal(await page.$('.studio-crop-source image'),null,'Remote image metadata is not rendered by the crop SVG');
  await pause(); assert.deepEqual(blocked,[],'Damaged texture never initiates an external request');
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'review.json'), JSON.stringify({ editableInvalidRestored: true, unsupportedDraftProtected: true, originalDownload: true, explicitNewRoomUnblocksSaving: true, explicitDeletionUnblocksSaving: true, pendingSaveCannotRestoreDeletedData: true, customShapePreserved: true, camerasPreserved: true, savedHeightBandsAdapted:true,unsafeProductLinkOmitted:true,remoteArtworkNeverRequested:true,browserErrors: errors }, null, 2));
  console.log('Room Studio draft recovery, original download, custom outline and camera-preservation regressions passed.');
} finally { await browser.close(); await server.close(); }
