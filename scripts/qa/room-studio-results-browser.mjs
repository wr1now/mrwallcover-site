/** Completed-render companions in a disposable local harness. No live service or job submission. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import sharp from 'sharp';
import { fixtureRevision } from '../../src/room-studio/fixtures.ts';
import { isProject } from '../../src/room-studio/storage.ts';
import { validateProject } from '../../src/room-studio/validation.ts';
import { launchBrowser, loadPage, serve, waitForPageContent, waitForPagePredicate } from '../visual-browser.mjs';

const root = resolve('.tmp/room-studio-results-harness');
const output = resolve('.review-screens/room-studio-results');
const downloads = resolve(output, 'downloads');
await mkdir(root + '/public', { recursive: true });
await mkdir(output, { recursive: true });
await rm(downloads, { recursive: true, force: true });
await mkdir(downloads, { recursive: true });

// Original generated image fixtures stand in for the three completed outputs.
// They exercise the actual image/panorama consumers without contacting storage.
for (const [index, name] of ['still-1', 'still-2', 'panorama'].entries()) {
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512"><rect width="1024" height="512" fill="#e3d8c2"/><path d="M0 100h1024v300H0Z" fill="#6d7755"/><path d="M${128 + index * 32} 100h128v300H${128 + index * 32}Z M640 100h128v300H640Z" fill="#cfc2aa"/></svg>`)).png().toFile(`${root}/public/${name}.png`);
}
await writeFile(root + '/index.html', '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Offline rendered-results fixture</title><style>body{margin:0;padding:16px;font-family:Arial,sans-serif}main{max-width:720px;margin:auto}</style></head><body><main id="root"></main><script type="module" src="/entry.tsx"></script></body></html>');
await writeFile(root + '/entry.tsx', `
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import CloudPanel from '${resolve('src/room-studio/components/CloudPanel.tsx')}';
import type {CloudClient,CloudJob} from '${resolve('src/room-studio/cloud.ts')}';
import type {RoomProject,RoomRevision} from '${resolve('src/room-studio/types.ts')}';
import {fixtureRevision} from '${resolve('src/room-studio/fixtures.ts')}';
import '${resolve('src/styles/visual-system.css')}';
import '${resolve('src/room-studio/studio.css')}';
type Call={method:string;args:string[]};
declare global {interface Window {resultFixture:{calls:Call[];currentDraft:RoomProject|null;frozen:RoomRevision}}}
const frozen=fixtureRevision();frozen.project.ownerId='offline-fixture-owner';
const metadata=structuredClone(frozen);
for(const finish of metadata.project.finishes)if('texture' in finish){finish.texture.storagePath='offline-fixture/artwork/original.png';delete finish.texture.dataUrl;}
const calls:Call[]=[];
window.resultFixture={calls,currentDraft:null,frozen:structuredClone(frozen)};
function record(method:string,...args:string[]){calls.push({method,args});}
function forbidden(method:string):never{record('unexpected:'+method);throw new Error('Offline results fixture forbids '+method);}
function requireVersion(projectId:string,revisionId:string){if(projectId!==frozen.projectId||revisionId!==frozen.id)throw new Error('Requested mutable or unrelated version');}
const job:CloudJob={id:'offline-completed-render',ownerId:'offline-fixture-owner',type:'render',inputIdentity:frozen.id,revisionId:frozen.id,state:'succeeded',reservedPence:0,attempts:1,error:null,outputs:['still-1','still-2','panorama'].map(kind=>({kind,storagePath:'offline-fixture/results/'+kind+'.png',sha256:'0'.repeat(64)})),createdAt:frozen.createdAt,updatedAt:frozen.createdAt};
// Satisfying the actual client type, plus compiling this entry before Vite,
// prevents a permissive mock from silently drifting from the production API.
const cloud={
  enabled:true,configured:true,
  session:{access_token:'offline-only',refresh_token:'offline-only',expires_at:4102444800,user:{id:'offline-fixture-owner',email:'offline-fixture@example.invalid'}},
  listProjects:async()=>{record('listProjects');return [];},
  capabilities:async()=>{record('capabilities');return {analysisEnabled:false,renderEnabled:false,projects:5,analysesPerDay:0,rendersPerDay:0,activeJobs:0};},
  listJobs:async(projectId:string)=>{record('listJobs',projectId);if(projectId!==frozen.projectId)throw new Error('Unexpected project');return [structuredClone(job)];},
  signedAssetUrl:async(projectId:string,storagePath:string)=>{record('signedAssetUrl',projectId,storagePath);const item=job.outputs.find(output=>output.storagePath===storagePath);if(projectId!==frozen.projectId||!item)throw new Error('Unexpected result asset');return {url:new URL('/'+item.kind+'.png',location.origin).href,expiresIn:300};},
  getRevision:async(projectId:string,revisionId:string)=>{record('getRevision',projectId,revisionId);requireVersion(projectId,revisionId);return structuredClone(metadata);},
  exportRevision:async(projectId:string,revisionId:string)=>{record('exportRevision',projectId,revisionId);requireVersion(projectId,revisionId);return structuredClone(frozen);},
  signIn:async()=>forbidden('signIn'),completeSignIn:async()=>forbidden('completeSignIn'),signOut:async()=>forbidden('signOut'),
  getProject:async()=>forbidden('getProject'),saveProject:async()=>forbidden('saveProject'),confirmRevision:async()=>forbidden('confirmRevision'),
  uploadAsset:async()=>forbidden('uploadAsset'),enqueueAnalysis:async()=>forbidden('enqueueAnalysis'),enqueueRender:async()=>forbidden('enqueueRender'),
  getJob:async()=>forbidden('getJob'),exportProject:async()=>forbidden('exportProject'),deleteProject:async()=>forbidden('deleteProject'),
} satisfies CloudClient;
function changeDraft(source:RoomProject,again=false):RoomProject{
  const draft=structuredClone(source);draft.name=again?'Later draft after opening results':'Later unrendered draft';draft.room.heightMm=again?3500:3200;draft.revision=again?10:9;
  const paint=draft.finishes.find(finish=>finish.type==='paint')!;if(paint.type==='paint'){paint.name=again?'Later blue paint':'Later red paint';paint.colour=again?'#1122cc':'#cc2211';paint.sheen='eggshell';}
  const artwork=draft.finishes.find(finish=>'texture' in finish)!;if('texture' in artwork){artwork.name='Later changed artwork';artwork.calibration.widthMm=890;artwork.calibration.heightMm=920;}
  return draft;
}
function App(){
  const[draft,setDraft]=useState(()=>changeDraft(frozen.project));
  useEffect(()=>{window.resultFixture.currentDraft=structuredClone(draft);},[draft]);
  const activeRevision:RoomRevision={id:'offline-active-confirmation-version-8',projectId:draft.id,number:8,createdAt:frozen.createdAt,project:{...draft,revision:8}};
  return <><button onClick={()=>setDraft(current=>changeDraft(current,true))}>Change current draft again</button><p data-current-draft>{draft.name} / {draft.room.heightMm} mm</p><div className="room-studio"><div className="studio-panel-content"><CloudPanel cloud={cloud} project={draft} revision={activeRevision} onOpen={()=>forbidden('onOpen')}/></div></div></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
`);
await writeFile(root + '/tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', allowImportingTsExtensions: true, noEmit: true, strict: true, skipLibCheck: true, esModuleInterop: true, resolveJsonModule: true, types: ['vite/client'] }, include: ['./entry.tsx'] }));
execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '--project', root + '/tsconfig.json'], { stdio: 'inherit' });
await build({ root, configFile: false, logLevel: 'error', esbuild: { jsx: 'automatic' }, build: { outDir: root + '/dist', emptyOutDir: true } });

const server = await serve(root + '/dist');
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage(), errors = [], consoleErrors = [], blocked = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    requests.push(request.url());
    if (request.method() === 'GET' && (request.url().startsWith(server.origin + '/') || request.url().startsWith('data:') || request.url().startsWith('blob:'))) void request.continue();
    else { blocked.push({ url: request.url().split('?')[0], method: request.method() }); void request.abort(); }
  });
  await page.setViewport({ width: 1440, height: 1000 });
  const client = await browser.target().createCDPSession(), downloadNames = new Map(), completedDownloads = new Set();
  client.on('Browser.downloadWillBegin', event => downloadNames.set(event.guid, event.suggestedFilename));
  client.on('Browser.downloadProgress', event => { if (event.state === 'completed') completedDownloads.add(downloadNames.get(event.guid)); });
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  await loadPage(page, server.origin);
  async function click(text) {
    const target = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text), text);
    assert.ok(target.asElement(), `Button: ${text}`);
    await target.asElement().click();
    await target.dispose();
  }
  const idle = () => waitForPagePredicate(page, () => ![...document.querySelectorAll('[role=status]')].some(node => node.textContent === 'Working…'));
  async function download(name) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (completedDownloads.has(name)) return readFile(resolve(downloads, name), 'utf8');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Browser download did not complete: ${name}`);
  }
  await waitForPagePredicate(page, () => [...document.querySelectorAll('button')].some(button => button.textContent === 'Open results'));
  assert.equal(await page.$('.studio-results img'), null);
  assert.equal(await page.evaluate(() => document.body.textContent.includes('Download editable rendered room')), false, 'Companions wait for a completed result to be opened');
  await click('Open results');
  await waitForPagePredicate(page, () => [...document.querySelectorAll('h3')].some(heading => heading.textContent === 'Confirmed version 1'));
  await idle();
  await page.waitForSelector('.studio-panorama canvas');
  await waitForPageContent(page);
  assert.equal(await page.$$eval('.studio-results img', images => images.filter(image => image.complete && image.naturalWidth > 0).length), 2, 'Both completed stills load');
  assert.deepEqual(await page.$$eval('.studio-results a', links => links.map(link => link.textContent)), ['Download still-1', 'Download still-2', 'Download panorama']);

  // Change the active project after opening results as well as before. Neither
  // the current draft nor its other confirmed revision may supply a companion.
  await click('Change current draft again');
  await waitForPagePredicate(page, () => window.resultFixture.currentDraft?.room.heightMm === 3500);
  await click('Download editable rendered room');
  const original = fixtureRevision(); original.project.ownerId = 'offline-fixture-owner';
  const portableText = await download(`${original.project.name}-version-${original.number}.room.json`);
  const portable = JSON.parse(portableText);
  assert.equal(portable.id, original.id);
  assert.equal(portable.projectId, original.projectId);
  assert.equal(portable.number, original.number);
  assert.ok(isProject(portable.project), 'The actual downloaded wrapper contains an editable Room Studio project');
  assert.deepEqual(validateProject(portable.project), [], 'The downloaded project passes the production importer validation');
  assert.deepEqual(portable.project, original.project, 'Geometry, openings, cameras, lighting, finishes and assignments are the rendered snapshot');
  assert.equal(portableText.includes('storagePath'), false, 'Portable artwork does not depend on an expiring private path');
  for (const finish of portable.project.finishes.filter(finish => 'texture' in finish)) assert.match(finish.texture.dataUrl, /^data:image\/png;base64,/, 'Historical source artwork is embedded');
  await idle();
  await click('Download rendered finish summary');
  const summary = await download(`${original.project.name}-version-${original.number}-finishes.txt`);
  assert.ok(summary.includes(`Mr Wallcover Room Studio — ${original.project.name}\nConfirmed version ${original.number}\nRevision ID: ${original.id}`), 'Summary identifies the rendered revision');
  assert.ok(summary.includes(`Ceiling height: ${original.project.room.heightMm} mm`));
  const paint = original.project.finishes.find(finish => finish.type === 'paint');
  assert.ok(summary.includes(`paint ${paint.name}, ${paint.colour}, ${paint.sheen}.`));
  const artwork = original.project.finishes.find(finish => 'texture' in finish);
  assert.ok(summary.includes(`artwork ${artwork.calibration.widthMm} × ${artwork.calibration.heightMm} mm`));
  const shade = original.project.finishes.find(finish => finish.type === 'bauwerk');
  assert.ok(summary.includes(`${shade.name} (${shade.shadeId}); catalogue ${shade.catalogueVersion}.`));
  for (const later of ['Later unrendered draft', 'Later draft after opening results', '3200', '3500', 'Later red paint', 'Later blue paint', '#cc2211', '#1122cc', 'Later changed artwork', '890 × 920', 'offline-active-confirmation-version-8']) {
    assert.equal(summary.includes(later), false, `Summary excludes mutable draft value: ${later}`);
    assert.equal(portableText.includes(later), false, `Editable room excludes mutable draft value: ${later}`);
  }

  const calls = await page.evaluate(() => window.resultFixture.calls);
  assert.deepEqual(calls.filter(call => call.method === 'getRevision'), [{ method: 'getRevision', args: [original.projectId, original.id] }]);
  assert.deepEqual(calls.filter(call => call.method === 'exportRevision'), [{ method: 'exportRevision', args: [original.projectId, original.id] }]);
  assert.deepEqual(calls.filter(call => call.method === 'signedAssetUrl').map(call => call.args), ['still-1', 'still-2', 'panorama'].map(kind => [original.projectId, `offline-fixture/results/${kind}.png`]));
  assert.deepEqual(calls.filter(call => call.method.startsWith('unexpected:')), [], 'No mutable-project read, write, sign-in, upload or job submission is allowed');
  assert.ok(requests.some(url => url === server.origin + '/panorama.png'), 'The actual panorama consumer requests its local result');
  const widths = [];
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, panel: document.querySelector('.studio-cloud').getBoundingClientRect().width }));
    assert.ok(dimensions.document <= width + 1, `Results have no horizontal overflow at ${width}px`);
    widths.push(dimensions);
    await page.screenshot({ path: resolve(output, `${width === 390 ? 'mobile' : 'desktop'}.png`), fullPage: true });
  }
  assert.equal(await page.$('[role=alert]'), null, 'The rendered output consumers have no visible error');
  assert.deepEqual(blocked, [], 'Every request stays on the local harness or a browser-local URL');
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  await writeFile(resolve(output, 'review.json'), JSON.stringify({ source: 'original offline fixtures and actual CloudPanel', immutableRevision: original.id, editablePortableDownload: true, importerValidation: true, frozenGeometryFinishesArtwork: true, confirmedPlainTextSummary: true, laterDraftExcluded: true, completedImages: 3, apiCalls: calls, widths, browserErrors: errors, consoleErrors, blockedRequests: blocked }, null, 2));
  console.log('Room Studio results: completed images, portable historical room download, confirmed finish summary, revision-bound API calls and desktop/mobile layout passed offline.');
} finally { if (browser) await browser.close(); await server.close(); }
