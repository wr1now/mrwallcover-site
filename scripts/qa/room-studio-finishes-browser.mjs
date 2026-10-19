/** Isolated local-browser acceptance. Never starts cloud/AI/render jobs or sends
 * artwork externally. Run after npm run build using --experimental-strip-types. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, serve, waitForPagePredicate, loadPage, waitForPageContent } from '../visual-browser.mjs';
import { fixtureProject } from '../../src/room-studio/fixtures.ts';
import { bauwerkCatalogue } from '../../src/room-studio/catalogue/index.ts';

const server = process.env.ROOM_STUDIO_ORIGIN ? null : await serve(process.env.ROOM_STUDIO_DIST ?? 'dist');
const origin = process.env.ROOM_STUDIO_ORIGIN ?? server.origin;
const output = '.review-screens/room-studio-finishes';
await mkdir(output, { recursive: true });
const roomFile = resolve(output, 'original-test-room.json');
const artworkFile = resolve(output, 'original-quadrant-test.png');
const rejectedFile = resolve(output, 'rejected-svg-content.png');
const oversizedFile = resolve(output, 'rejected-dimension-header.png');
const detailedFile = resolve(output, 'original-1024-detail-test.png');
await writeFile(roomFile, JSON.stringify(fixtureProject()));
const original = Buffer.alloc(400 * 200 * 3);
for (let y = 0; y < 200; y++) for (let x = 0; x < 400; x++) {
  const colour = y < 100 ? (x < 200 ? [230, 20, 20] : [20, 190, 20]) : (x < 200 ? [20, 20, 230] : [245, 245, 245]);
  colour.forEach((value, channel) => original[(y * 400 + x) * 3 + channel] = value);
}
const png = await sharp(original, { raw: { width: 400, height: 200, channels: 3 } }).png().toBuffer();
await writeFile(artworkFile, png);
await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#e8dec9"/><path d="M100 0h80v1024h-80zM420 0h80v1024h-80zM740 0h80v1024h-80z" fill="#52684d"/></svg>')).png().toFile(detailedFile);
await writeFile(rejectedFile, '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
const oversized = Buffer.from(png); oversized.writeUInt32BE(20000, 16); oversized.writeUInt32BE(20000, 20); await writeFile(oversizedFile, oversized);

const browser = await launchBrowser();
const observations = [];
try {
  const page = await browser.newPage();
  const errors = [], blocked = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if ((request.url().startsWith(origin) && request.method() === 'GET') || request.url().startsWith('data:') || request.url().startsWith('blob:')) request.continue();
    else { blocked.push({ method: request.method(), url: request.url().split('?')[0] }); request.abort(); }
  });
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await loadPage(page,`${origin}/room-studio/`);
  await page.waitForSelector('[data-studio-ready="true"]');
  await (await page.$('input[type=file][accept*="application/json"]')).uploadFile(roomFile);
  await waitForPagePredicate(page, () => document.querySelector('.studio-title input')?.value === 'Illustrative rectangle room');

  async function clickText(text, scope = '.studio-finish-panel') {
    const found = await page.evaluateHandle((text, scope) => [...document.querySelectorAll(`${scope} button`)].find(button => button.textContent.trim() === text), text, scope);
    const button = found.asElement(); assert.ok(button, `Button exists: ${text}`); await button.evaluate(element => element.scrollIntoView({block:'center',behavior:'instant'})); await button.click(); await page.evaluate(() => new Promise(requestAnimationFrame)); await found.dispose();
  }
  async function field(label, tag = 'input') {
    const handle = await page.evaluateHandle((label, tag) => [...document.querySelectorAll('.studio-finish-panel .studio-field')].find(item => item.textContent.trim().startsWith(label))?.querySelector(tag), label, tag);
    const element = handle.asElement(); assert.ok(element, `Field exists: ${label}`); return element;
  }
  async function fill(label, value) {
    const input = await field(label);
    await input.evaluate((element, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); }, String(value));
    await page.evaluate(() => new Promise(requestAnimationFrame)); await input.dispose();
  }
  async function select(label, value) { const element = await field(label, 'select'); await element.select(String(value)); await element.dispose(); }
  async function check(label, checked) {
    const handle = await page.evaluateHandle(label => [...document.querySelectorAll('.studio-finish-panel label')].find(item => item.textContent.trim() === label)?.querySelector('input[type=checkbox]'), label);
    const element = handle.asElement(); assert.ok(element, `Checkbox exists: ${label}`);
    if (await element.evaluate(input => input.checked) !== checked) { await element.evaluate(input => input.scrollIntoView({block:'center',behavior:'instant'})); await element.click(); await page.evaluate(() => new Promise(requestAnimationFrame)); } await handle.dispose();
  }
  async function draft() {
    return page.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open('mrwallcover-room-studio-v1', 1);
      open.onerror = () => reject(new Error('Could not read local QA project'));
      open.onsuccess = () => { const db = open.result; const request = db.transaction('drafts', 'readonly').objectStore('drafts').get('current'); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = () => reject(request.error); };
    }));
  }
  async function saved(predicate) {
    const end = Date.now() + 10000;
    do { const value = await draft(); if (value && predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 100)); } while (Date.now() < end);
    await page.screenshot({ path: `${output}/failed-state.png`, fullPage: true });
    const current = await draft();
    throw new Error(`Expected finish change was not saved to IndexedDB: ${JSON.stringify({ finishes: current?.finishes.map(f => ({ id: f.id, name: f.name, type: f.type, colour: f.colour })), assignments: current?.assignments, panel: await page.$eval('.studio-finish-panel', element => element.innerText), errors })}`);
  }
  async function proofReady() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await waitForPagePredicate(page, () => Boolean(document.querySelector('.studio-repeat-proof img')?.complete) && !document.querySelector('.studio-artwork-calibration')?.textContent.includes('Preparing the pattern proof')); }
  async function pixel(x, y) {
    return page.evaluate(async (x, y) => {
      const image = document.querySelector('.studio-repeat-proof img'); await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
    }, x, y);
  }
  const predominantly = (rgb, channel) => rgb[channel] > 150 && rgb.filter((_, i) => i !== channel).every(value => value < 90);

  const finishesStep = await page.evaluateHandle(() => [...document.querySelectorAll('.studio-steps button')].find(button => button.textContent.endsWith('Finishes'))); await finishesStep.asElement().click();
  await page.waitForSelector('.studio-finish-panel');
  await fill('Colour name', 'QA clay'); await fill('HEX', '#A46E50'); await select('Finish', 'eggshell');
  await clickText('Save paint colour'); await clickText('Apply finish');
  let project = await saved(p => p.finishes.some(f => f.name === 'QA clay') && p.assignments.some(a => a.finishId === p.finishes.find(f => f.name === 'QA clay')?.id));
  const clay = project.finishes.find(f => f.name === 'QA clay'); assert.equal(clay.colour, '#A46E50'); assert.equal(clay.sheen, 'eggshell');
  observations.push('Custom HEX paint saved with eggshell sheen and applied.');

  await clickText('Bauwerk limewash');
  assert.equal(await page.$$eval('.studio-shade', items => items.length), bauwerkCatalogue.shades.filter(shade => shade.available).length);
  await fill('Find a Bauwerk shade', 'Bone');
  await waitForPagePredicate(page, () => document.querySelectorAll('.studio-shade').length === 1);
  await (await page.$('.studio-shade')).click();
  await page.click('button[aria-label="Add Bone to favourites"]');
  await check('Show my favourites', true); await fill('Find a Bauwerk shade', '');
  assert.equal(await page.$$eval('.studio-shade', items => items.map(item => item.textContent.trim()).join()), 'Bone');
  await clickText('Apply finish');
  project = await saved(p => p.assignments.some(a => a.finishId === p.finishes.find(f => f.type === 'bauwerk' && f.name === 'Bone')?.id));
  const bone = project.finishes.find(f => f.type === 'bauwerk' && f.name === 'Bone');
  assert.equal(bone.colour, bauwerkCatalogue.shades.find(s => s.name === 'Bone').colour); assert.equal(bone.catalogueVersion, bauwerkCatalogue.version);
  assert.match(await page.$eval('.studio-finish-application a', link => link.href), /^https:\/\/www.bauwerkcolour.com\/en-gb\/product\/bone-/);
  await check('Show my favourites', false); await select('Colour family', 'green');
  assert.equal(await page.$$eval('.studio-shade', items => items.length), bauwerkCatalogue.shades.filter(shade => shade.available && shade.families.includes('green')).length);
  await page.$eval('.studio-finish-panel', element => element.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${output}/bauwerk-family-1440.png` });
  observations.push(`Full Bauwerk catalogue (${bauwerkCatalogue.shadeCount}), search, family filter, favourites, official link and source colour tested.`);

  await clickText('Wallpaper / mural');
  const upload = await page.waitForSelector('.studio-finish-panel input[type=file]'); await upload.uploadFile(artworkFile);
  await page.waitForSelector('.studio-artwork-calibration'); await proofReady();
  const detailText = () => page.$eval('.studio-source-detail', element => element.textContent);
  assert.ok((await detailText()).includes('Selected crop: 400 × 200 pixels'));
  assert.ok(await page.$('.studio-source-detail .studio-notice'), 'A small original receives the illustrative source-detail prompt');
  assert.ok((await detailText()).includes('Larger exports cannot restore detail missing from the original artwork.'));
  await fill('Artwork name', 'QA repeating artwork');
  await select('Orientation', 90); await proofReady(); assert.ok((await detailText()).includes('Selected crop: 200 × 400 pixels'), 'Source dimensions follow the prepared orientation');
  await fill('Crop width', 50); await fill('Real width', 100); await fill('Real height', 100); await proofReady();
  assert.ok((await detailText()).includes('Selected crop: 200 × 200 pixels over 100 × 100 mm (2000 × 2000 pixels per metre)'), 'Crop pixel density uses calibrated physical size');
  assert.ok(predominantly(await pixel(45, 45), 2), 'Clockwise prepared crop has blue on the left');
  assert.ok(predominantly(await pixel(135, 45), 0), 'Clockwise prepared crop has red on the right');
  await fill('Crop width', 100); await select('Orientation', 0); await fill('Real height', 200); await select('Image represents', 'strip'); await select('Pattern match', 'half-drop'); await proofReady();
  assert.ok(predominantly(await pixel(45, 45), 0)); assert.ok(predominantly(await pixel(225, 45), 2), 'Half-drop offsets alternating strips');
  await check('The stagger is already included in this artwork tile', true); await proofReady();
  assert.ok(predominantly(await pixel(225, 45), 0), 'Already included stagger does not receive a second drop');
  await check('The stagger is already included in this artwork tile', false); await proofReady();
  const acknowledgement = 'I may use this artwork and have checked the crop, real size and repeat proof.';
  await check(acknowledgement, true); await fill('Real width', 110); await proofReady();
  assert.equal(await page.evaluate(text => [...document.querySelectorAll('.studio-artwork-calibration label')].find(label => label.textContent.trim() === text).querySelector('input').checked, acknowledgement), false);
  await check(acknowledgement, true);
  await page.$eval('.studio-repeat-proof', element => element.scrollIntoView({ block: 'center' })); await page.screenshot({ path: `${output}/wallpaper-half-drop-proof-1440.png` });
  await clickText('Accept proof and save artwork');
  await check('Apply within a horizontal band', true); await fill('Band bottom', 800); await fill('Band top', 1500); await fill('Horizontal start', 120); await fill('Vertical start', 200); await clickText('Apply finish');
  project = await saved(p => p.assignments.some(a => a.fromMm === 800 && a.toMm === 1500 && p.finishes.find(f => f.id === a.finishId)?.name === 'QA repeating artwork'));
  const paper = project.finishes.find(f => f.name === 'QA repeating artwork'); assert.equal(paper.calibration.proofAccepted, true); assert.equal(paper.calibration.match, 'half-drop'); assert.equal(paper.calibration.widthMm, 110);
  const band = project.assignments.find(a => a.finishId === paper.id); assert.equal(band.offsetXmm, 120); assert.equal(band.offsetYmm, 200);
  assert.ok(project.assignments.some(a => a.wallId === band.wallId && a.toMm === 800)); assert.ok(project.assignments.some(a => a.wallId === band.wallId && a.fromMm === 1500));
  await check('Apply to all walls', true); await clickText('Apply finish');
  project = await saved(p => p.assignments.filter(assignment => assignment.finishId === paper.id).length === p.room.vertices.length);
  const beforeContinue = structuredClone(project);
  await clickText('Continue pattern around corners');
  project = await saved(p => p.assignments.find(assignment => assignment.wallId === p.room.vertices[1].wallId && assignment.finishId === paper.id)?.offsetXmm === -4080);
  let run = 0;
  for (const [index, vertex] of project.room.vertices.entries()) {
    const placed = project.assignments.find(assignment => assignment.wallId === vertex.wallId && assignment.finishId === paper.id);
    assert.equal(placed.offsetXmm, Math.round(120 - run)); assert.equal(placed.offsetYmm, 200); assert.equal(placed.fromMm, 800); assert.equal(placed.toMm, 1500);
    const next = project.room.vertices[(index + 1) % project.room.vertices.length]; run += Math.hypot(next.x - vertex.x, next.z - vertex.z);
  }
  assert.deepEqual(project.assignments.filter(assignment => assignment.finishId !== paper.id), beforeContinue.assignments.filter(assignment => assignment.finishId !== paper.id), 'Continuing wallpaper leaves adjacent paint/bands untouched');
  await check('Apply to all walls', false);
  observations.push('Actual upload, crop, clockwise rotation, real scale, half-drop proof pixels, no double-drop, acknowledgement reset and non-overlapping band saved.');
  observations.push('Explicit corner continuation preserves exact horizontal run, half-drop origin, vertical set-out and surrounding finishes; source-detail prompt follows crop, rotation and physical calibration.');

  await select('Artwork type', 'mural'); await upload.uploadFile(artworkFile); await page.waitForSelector('.studio-artwork-calibration'); await fill('Artwork name', 'QA mural'); await fill('Real width', 3000); await fill('Real height', 2000); await proofReady(); await check(acknowledgement, true); await clickText('Accept proof and save artwork');
  await check('Apply within a horizontal band', false); await clickText('Centre artwork on selected wall'); await clickText('Apply finish');
  project = await saved(p => p.assignments.some(a => p.finishes.find(f => f.id === a.finishId)?.name === 'QA mural'));
  const mural = project.finishes.find(f => f.name === 'QA mural'), placement = project.assignments.find(a => a.finishId === mural.id);
  const wallIndex = project.room.vertices.findIndex(v => v.wallId === placement.wallId), a = project.room.vertices[wallIndex], b = project.room.vertices[(wallIndex + 1) % project.room.vertices.length];
  assert.equal(mural.type, 'mural'); assert.equal(mural.calibration.widthMm, 4000); assert.equal(mural.calibration.heightMm, 2000); assert.equal(placement.toMm, null); assert.equal(placement.offsetXmm, Math.round((Math.hypot(b.x - a.x, b.z - a.z) - mural.calibration.widthMm) / 2)); assert.equal(placement.offsetYmm, Math.round((project.room.heightMm - mural.calibration.heightMm) / 2));
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.studio-finish-panel button')].some(button => button.textContent === 'Continue pattern around corners')), false, 'A mural is never offered automatic repeating placement');
  await upload.uploadFile(detailedFile); await page.waitForSelector('.studio-artwork-calibration'); await proofReady();
  assert.ok((await detailText()).includes('Selected crop: 1024 × 1024 pixels')); assert.equal(await page.$('.studio-source-detail .studio-notice'), null, 'A source at the illustrative threshold does not receive the small-source prompt');
  await fill('Crop width', 50); await proofReady(); assert.ok((await detailText()).includes('Selected crop: 512 × 1024 pixels')); assert.ok(await page.$('.studio-source-detail .studio-notice'), 'Cropping can reduce available detail even when the full source met the guide');
  await upload.uploadFile(rejectedFile); await waitForPagePredicate(page, () => document.querySelector('.studio-finish-panel [role=alert]')?.textContent.includes('Only PNG'));
  await upload.uploadFile(oversizedFile); await waitForPagePredicate(page, () => document.querySelector('.studio-finish-panel [role=alert]')?.textContent.includes('25 megapixels'));
  observations.push('Single mural accepted and centred; SVG content and oversized compressed dimension header rejected before decoding.');

  await page.reload({waitUntil:'load'});await waitForPageContent(page); await page.waitForSelector('[data-studio-ready="true"]');
  const step = await page.evaluateHandle(() => [...document.querySelectorAll('.studio-steps button')].find(button => button.textContent.endsWith('Finishes'))); await step.asElement().click(); await page.waitForSelector('.studio-finish-panel');
  await clickText('Bauwerk limewash'); await check('Show my favourites', true);
  assert.equal(await page.$$eval('.studio-shade', items => items.map(item => item.textContent.trim()).join()), 'Bone', 'Favourites survive reload');
  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 }); await page.$eval('.studio-shade-list', element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Finish panel fits ${width}px`);
    await page.screenshot({ path: `${output}/saved-finishes-${width}.png` });
  }
  assert.deepEqual(errors, [], 'No browser runtime errors');
  await writeFile(`${output}/review.json`, JSON.stringify({ origin, checkedAt: '2026-10-18', catalogueVersion: bauwerkCatalogue.version, observations, browserErrors: errors, blockedExternalRequests: blocked, paidJobsStarted: false }, null, 2));
  console.log(`Room Studio finish acceptance passed: ${observations.length} journeys, 390/1440px, screenshots in ${output}.`);
} finally { await browser.close(); if (server) await server.close(); }
