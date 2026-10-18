/** Drawn-outline acceptance in a disposable local browser; no cloud requests. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixtureProject } from '../../src/room-studio/fixtures.ts';
import { signedPlanArea, validateProject } from '../../src/room-studio/validation.ts';
import { launchBrowser, serve } from '../visual-browser.mjs';

const output = resolve('.review-screens/room-studio-drawing'); await mkdir(output, { recursive: true });
const server = await serve(process.env.ROOM_STUDIO_DIST ?? 'dist'), browser = await launchBrowser();
try {
  const page = await browser.newPage(), errors = [], blocked = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.method() === 'GET' && request.url().startsWith(server.origin) || request.url().startsWith('data:') || request.url().startsWith('blob:')) request.continue();
    else { blocked.push(request.url().split('?')[0]); request.abort(); }
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${server.origin}/room-studio/`, { waitUntil: 'networkidle0' }); await page.waitForSelector('[data-studio-ready=true]');
  const original = fixtureProject('l-shape');
  original.schemes = [{ id: 'saved-scheme', name: 'Original walls', finishes: structuredClone(original.finishes), assignments: structuredClone(original.assignments) }];
  const roomFile = resolve(output, 'original-room.json'); await writeFile(roomFile, JSON.stringify(original));
  await (await page.$('input[type=file][accept*="application/json"]')).uploadFile(roomFile);
  await page.waitForFunction(() => document.querySelector('.studio-title input').value === 'Illustrative l-shape room');
  const pause = () => new Promise(resolve => setTimeout(resolve, 600));
  async function stored() { return page.evaluate(() => new Promise((resolve, reject) => { const request = indexedDB.open('mrwallcover-room-studio-v1', 1); request.onsuccess = () => { const db = request.result, item = db.transaction('drafts').objectStore('drafts').get('current'); item.onsuccess = () => { db.close(); resolve(item.result); }; item.onerror = () => reject(item.error); }; })); }
  async function click(text) { const handle = await page.evaluateHandle(text => [...document.querySelectorAll('.room-studio button')].find(button => button.textContent.trim() === text), text); assert.ok(handle.asElement(), text); await handle.asElement().click(); await handle.dispose(); }
  async function disabled(text) { return page.evaluate(text => [...document.querySelectorAll('.room-studio button')].find(button => button.textContent.trim() === text)?.disabled, text); }
  async function extent(label, value) {
    const handle = await page.evaluateHandle(label => [...document.querySelectorAll('.studio-outline-sketch .studio-field')].find(field => field.textContent.startsWith(label)).querySelector('input'), label);
    await handle.asElement().evaluate((input, value) => { input.focus(); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, String(value)); input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await page.evaluate(() => new Promise(requestAnimationFrame)); await handle.asElement().evaluate(input => input.blur()); await handle.dispose();
  }
  async function point(x, z) {
    const previousCount = await page.$$eval('.studio-outline-sketch circle', circles => circles.length);
    await page.$eval('.studio-outline-sketch svg', svg => svg.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const position = await page.$eval('.studio-outline-sketch svg', (svg, point) => { const p = svg.createSVGPoint(); p.x = point.x; p.y = point.z; const screen = p.matrixTransform(svg.getScreenCTM()); return { x: screen.x, y: screen.y }; }, { x, z });
    await page.mouse.click(position.x, position.y);
    await page.waitForFunction(count => document.querySelectorAll('.studio-outline-sketch circle').length === count, {}, previousCount + 1).catch(async e=>{await page.screenshot({path:resolve(output,'failed.png')});throw e;});
  }
  await pause(); const before = await stored();
  await click('Draw a new outline'); await extent('Drawing width', 5000); await extent('Drawing depth', 4000);
  await point(0, 0); await point(5000, 4000);
  assert.equal(await disabled('Use drawn outline'), true, 'A two-corner sketch cannot replace the room');
  await point(5000, 0); await point(0, 4000);
  assert.equal(await disabled('Use drawn outline'), true, 'Crossed outline cannot be used');
  assert.ok(await page.$('.studio-outline-sketch [role=alert]'));
  await pause(); assert.deepEqual((await stored()).room, before.room, 'Drawing never changes existing room before Use');
  await click('Undo corner'); assert.equal(await page.$$eval('.studio-outline-sketch circle', circles => circles.length), 3);
  await click('Clear drawing'); assert.equal(await page.$$eval('.studio-outline-sketch circle', circles => circles.length), 0);
  await point(0, 0); await point(5000, 0); await point(5000, 4000);
  await click('Cancel drawing'); await pause(); assert.deepEqual((await stored()).room, before.room, 'Cancel preserves all openings and corners');

  await click('Draw a new outline'); await extent('Drawing width', 5000); await extent('Drawing depth', 4000);
  // Clockwise drawn L is normalized to the compiler's CCW model.
  for (const [x, z] of [[0, 0], [0, 4000], [3000, 4000], [3000, 2000], [5000, 2000], [5000, 0]]) await point(x, z);
  assert.equal(await disabled('Use drawn outline'), false);
  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: 1000 }); await page.$eval('.studio-outline-sketch', element => element.scrollIntoView({ block: 'center' }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Drawing layout at ${width}px`);
    await page.screenshot({ path: resolve(output, `sketch-${width}.png`), fullPage: false });
  }
  await click('Use drawn outline'); await pause(); const after = await stored();
  assert.equal(after.room.vertices.length, 6); assert.equal(after.room.openings.length, 0); assert.equal(after.room.confirmed, false);
  assert.ok(signedPlanArea(after.room.vertices) > 0); assert.deepEqual(validateProject(after), []);
  assert.deepEqual(after.schemes[0].assignments, [], 'Saved combinations discard replaced wall references');
  assert.equal(Math.max(...after.room.vertices.map(v => v.x)), 5000); assert.equal(Math.max(...after.room.vertices.map(v => v.z)), 4000);
  assert.equal(after.room.vertices.every(v => v.x % 50 === 0 && v.z % 50 === 0), true);
  assert.equal(await page.$$eval('.studio-vertex', vertices => vertices.length), 6, 'Keyboard coordinate fields remain after applying');
  await click('Undo'); await pause(); assert.deepEqual((await stored()).room, before.room, 'Undo restores original geometry and openings');
  assert.deepEqual((await stored()).schemes, before.schemes);
  assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
  await writeFile(resolve(output, 'review.json'), JSON.stringify({ preservedUntilUse: true, invalidCrossingBlocked: true, undoClearCancel: true, clockwiseLNormalized: true, measuredGrid: true, savedSchemesAdapted: true, originalRestoredByUndo: true, keyboardAlternative: true, widths: [390, 1440], errors }, null, 2));
  console.log('Drawn outline: measured grid, validation, cancel/undo, L-shape, saved bands and keyboard fields passed.');
} finally { await browser.close(); await server.close(); }
