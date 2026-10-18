import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser, loadPage, serve } from '../scripts/visual-browser.mjs';
import { emptyProjectDraft } from '../src/designer-portal/validation.ts';
import { createEstimate } from '../server/designer-portal/pricing.ts';
import { createDefaultPricingConfig } from '../server/designer-portal/defaults.ts';
import { analyseActualWork, comparePilot, validateActualWork, validateHistoricalScope, validatePilotInput } from '../server/designer-portal/learning.ts';

async function clickText(page: any, selector: string, text: string) { for (const element of await page.$$(selector)) if ((await element.evaluate((node: HTMLElement) => node.textContent?.trim())) === text) { await element.click(); return; } throw new Error(`Missing ${selector}: ${text}`); }
async function openSection(page: any, text: string) { for (const summary of await page.$$('summary')) if ((await summary.evaluate((node: HTMLElement) => node.textContent?.trim())) === text) { if (!await summary.evaluate((node: HTMLElement) => node.parentElement?.hasAttribute('open'))) await summary.click(); return; } throw new Error(`Missing section ${text}`); }
async function setField(page: any, scope: string, label: string, value: string) {
  for (const field of await page.$$(`${scope} label.dp-field`)) if ((await field.$eval('span', (node: HTMLElement) => node.textContent?.trim())) === label) {
    const control = await field.$('input,textarea,select'); const tag = await control.evaluate((node: HTMLElement) => node.tagName);
    if (tag === 'SELECT') await control.select(value);
    else { await control.evaluate((node: HTMLInputElement | HTMLTextAreaElement, next: string) => { const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, next); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); }, value); } return;
  } throw new Error(`Missing field ${scope}: ${label}`);
}
async function checkLabel(page: any, scope: string, text: string, checked = true) { for (const label of await page.$$(`${scope} label.dp-checkbox`)) if ((await label.evaluate((node: HTMLElement) => node.textContent || '')).includes(text)) { const input = await label.$('input[type=checkbox]'); if (await input.evaluate((node: HTMLInputElement) => node.checked) !== checked) await input.click(); return; } throw new Error(`Missing checkbox ${scope}: ${text}`); }
async function waitMessage(page: any, text: string) { await page.waitForFunction((value: string) => document.querySelector('.dp-live-message')?.textContent?.includes(value), {}, text); }


test('connected owner journeys preserve incomplete budgets, reviewed services, historical evidence, actuals and independent pilots', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mw-designer-connected-'));
  const origin = 'https://portal.example.invalid';
  let browser: any, server: any;
  try {
    await promisify(execFile)('node_modules/.bin/astro', ['build', '--outDir', directory], { env: { ...process.env, PUBLIC_DESIGNER_PORTAL_ENABLED: 'true', PUBLIC_DESIGNER_PORTAL_URL: origin, PUBLIC_DESIGNER_PORTAL_ANON_KEY: 'synthetic-public-key' }, maxBuffer: 64 * 1024 * 1024 });
    server = await serve(directory); browser = await launchBrowser();
    const page = await browser.newPage(), actions: string[] = [], errors: string[] = [], requests: { action: string; payload: any }[] = [];
    const historyRecords: any[] = [], actualRecords: any[] = [], actualReviews: any[] = [], pilotRecords: any[] = []; let issued: any = null, configVersion = 0;
    page.setDefaultTimeout(10_000);
    page.on('dialog', async (dialog: any) => { assert.match(dialog.message(), /draft|save|download|unsaved/i); await dialog.accept(); });
    const studioId = '11111111-1111-4111-8111-111111111111', projectId = '22222222-2222-4222-8222-222222222222';
    const draft = { ...emptyProjectDraft(), name: 'Synthetic connected review' };
    let project = { id: projectId, studioId, name: draft.name, revision: 1, draft };
    const identity = { user: { id: '33333333-3333-4333-8333-333333333333', email: 'owner@example.invalid' }, staffRole: 'owner', studios: [{ id: studioId, name: 'Synthetic studio', role: 'owner' }], capabilities: { uploadsEnabled: false, workerEnabled: false } };
    const pricing = createDefaultPricingConfig();
    const preview = createEstimate(draft, pricing, { id: 'preview-fixture', projectId, projectRevision: 1, createdAt: '2026-10-18T12:00:00.000Z' });
    page.on('pageerror', (error: Error) => errors.push(error.message));
    page.on('console', (message: any) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setRequestInterception(true);
    page.on('request', async (request: any) => {
      if (request.url().startsWith(server.origin) || !/^https?:/.test(request.url())) return request.continue();
      // No synthetic sign-in, project or file request is sent to the internet.
      if (!request.url().startsWith(origin)) { errors.push('Unexpected external request'); return request.abort(); }
      if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': server.origin, 'Access-Control-Allow-Headers': 'apikey, Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
      let value: any = {}, status = 200;
      if (request.url().endsWith('/auth/v1/verify')) value = { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 3600 };
      else if (request.url().includes('/functions/v1/')) {
        const body = JSON.parse(request.postData() || '{}'); actions.push(body.action); requests.push(body);
        const data: Record<string, unknown> = {
          session: identity, 'project.list': { projects: [project] }, 'catalog.products': { products: [] },
          'project.get': { project, documents: [], jobs: [], evidence: [], estimates: issued ? [issued] : [], shares: [], notifications: [{ id: 'notification-fixture', state: 'provider_accepted', recipientUserId: identity.user.id, attempts: 1, providerAcceptedAt: '2026-10-18T12:00:00Z', deliveredAt: null, providerEvent: 'sent', providerPayload: 'provider-payload-private-fixture', error: null, createdAt: '2026-10-18T12:00:00Z' }] },
          'admin.notifications.get': { configuration: { enabled: false, provider: 'resend', sender: null, workspaceUrl: null, monthlyCap: null, dailyStudioCap: null, monthlyBudgetPence: null, worstCaseAttemptPence: null }, usage: [] },
          'estimate.preview': { estimate: preview }, 'admin.config.get': { config: pricing, version: configVersion },
          'estimate.list': { estimates: issued ? [issued] : [] }, 'admin.history.list': { records: historyRecords, ratesImported: false },
          'admin.actuals.list': { actuals: actualRecords, reviews: actualReviews }, 'admin.pilot.list': { comparisons: pilotRecords },
        };
        if (body.action === 'admin.agreement.save') { pricing.servicePlans = [structuredClone(body.payload.servicePlan)]; configVersion++; data[body.action] = { config: pricing, version: configVersion }; }
        if (body.action === 'admin.history.import') { const entries = body.payload.entries.map(validateHistoricalScope); const imported = entries.map((entry: any, index: number) => ({ id: `history-${historyRecords.length + index}`, body: entry, createdAt: '2026-10-18T12:00:00Z' })); historyRecords.push(...imported); data[body.action] = { records: imported, count: imported.length, ratesImported: false }; }
        if (body.action === 'admin.actuals.save') { const actual = { id: `actual-${actualRecords.length}`, projectRevision: project.revision, estimateId: body.payload.estimateId, supersedesId: body.payload.supersedesId, body: validateActualWork(body.payload.body, project.draft, new Date().toISOString().slice(0, 10)), analysis: analyseActualWork(body.payload.body, issued, pricing), createdAt: '2026-10-18T12:00:00Z' }; actualRecords.unshift(actual); data[body.action] = { actual }; }
        if (body.action === 'admin.actuals.review') { const review = { id: `review-${actualReviews.length}`, actualId: body.payload.actualId, decision: body.payload.decision, note: body.payload.note, createdAt: '2026-10-18T12:00:00Z' }; actualReviews.unshift(review); data[body.action] = { review }; }
        if (body.action === 'admin.pilot.save') { const input = validatePilotInput(body.payload.body, new Date().toISOString().slice(0, 10)); const comparison = { id: `pilot-${pilotRecords.length}`, estimateId: issued.id, historicalScopeId: body.payload.historicalScopeId, body: input, comparison: comparePilot(input, issued), createdAt: '2026-10-18T12:00:00Z' }; pilotRecords.unshift(comparison); data[body.action] = { comparison }; }
        if (!(body.action in data)) { errors.push(`Unexpected action ${body.action}`); status = 400; }
        value = { ok: status === 200, data: data[body.action] };
      }
      return request.respond({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': server.origin, 'Access-Control-Allow-Headers': 'apikey, Content-Type, Authorization' }, body: JSON.stringify(value) });
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await loadPage(page, server.origin + '/designer-portal/');
    await page.type('.dp-account input[type="email"]', identity.user.email);
    await page.click('.dp-account button[type="submit"]');
    await page.waitForSelector('input[autocomplete="one-time-code"]');
    await page.type('input[autocomplete="one-time-code"]', '123456');
    await page.click('.dp-account button[type="submit"]');
    await page.waitForSelector('.dp-account select').catch(async (error: Error) => { throw new Error(`Sign-in fixture failed: ${JSON.stringify({ actions, errors, message: await page.$eval('.dp-live-message', (element: HTMLElement) => element.textContent) })}`, { cause: error }); });
    const selects = await page.$$('.dp-account select'); await selects[1].select(projectId);
    await page.waitForFunction(() => document.querySelector('.dp-toolbar')?.textContent?.includes('Saved project'));
    await page.click('.dp-steps button:nth-of-type(5)');
    await page.click('.dp-editor > button.mw-action--primary');
    await page.waitForSelector('.dp-review-reasons');
    assert.match(await page.$eval('.dp-review-reasons', (element: HTMLElement) => element.textContent), /Complete the project, contact and site details/);
    assert.equal(await page.$('.dp-totals'), null); assert.equal(await page.$('.dp-sharing'), null);
    assert.equal(actions.includes('estimate.issue'), false, 'incomplete preview is never issued');
    const summaries = await page.$$('.dp-admin summary');
    for (const summary of summaries) if ((await summary.evaluate((element: HTMLElement) => element.textContent)) === 'Owner pricing configuration') await summary.click();
    const buttons = await page.$$('.dp-admin button');
    for (const button of buttons) if ((await button.evaluate((element: HTMLElement) => element.textContent)) === 'Load current configuration') await button.click();
    await page.waitForSelector('.dp-config-fields');
    const labels = await page.$eval('.dp-config-fields', (element: HTMLElement) => element.textContent);
    assert.match(labels, /Exact product references/); assert.match(labels, /Installation profiles/); assert.match(labels, /Small-project packages/);
    for (const summary of await page.$$('summary')) {
      const title = await summary.evaluate((element: HTMLElement) => element.textContent);
      if (title === 'Project email notifications' || title.startsWith('Project notification status')) await summary.click();
    }
    for (const button of await page.$$('.dp-admin button')) if ((await button.evaluate((element: HTMLElement) => element.textContent)) === 'Load notification settings') await button.click();
    await page.waitForFunction(() => document.body.textContent?.includes('Saved notification setting: disabled.'));
    const notificationText = await page.$eval('.dp-record-list', (element: HTMLElement) => element.textContent);
    assert.match(notificationText, /provider accepted/); assert.match(notificationText, /Delivery has not been confirmed/); assert.doesNotMatch(notificationText, /Delivery confirmed:/);
    assert.equal(actions.includes('admin.notifications.save'), false);

    // Owner service entries are explicit commercial inputs, including access and provisional supply review.
    await openSection(page, 'Project-specific pricing and service plan');
    await clickText(page, '.dp-admin button', 'Load project service plan');
    await page.waitForSelector('.dp-service-entries');
    await clickText(page, '.dp-service-entries button', 'Add a service allowance');
    await setField(page, '.dp-service-entries', 'Service scope / description', 'Synthetic setting-out visits');
    await setField(page, '.dp-service-entries', 'Quantity', '2');
    await setField(page, '.dp-service-entries', 'Current selling rate per visit', '150');
    // Browser-native date defaults remain explicit through the field; fixture date is before all test clocks.
    await page.$eval('.dp-service-entries input[type=date]', (input: HTMLInputElement) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2020-01-01'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
    await checkLabel(page, '.dp-service-entries', 'Owner approves this service scope');
    await checkLabel(page, '.dp-service-entries', 'Owner has reviewed and allowed for');
    await checkLabel(page, '.dp-service-entries', 'Owner has assessed provisional material availability');
    await clickText(page, '.dp-admin button', 'Validate and approve project services');
    await waitMessage(page, 'Project pricing and service plan saved');
    const planPayload = requests.find(request => request.action === 'admin.agreement.save')!.payload.servicePlan;
    assert.equal(planPayload.serviceEntries[0].quantity, 2); assert.equal(planPayload.serviceEntries[0].unit, 'visit'); assert.equal(planPayload.serviceEntries[0].ratePence, 15000);
    assert.equal(planPayload.serviceEntries[0].approved, true); assert.equal(planPayload.accessReviewed, true); assert.equal(planPayload.materialReadinessReviewed, true);

    // Local history review makes no request until acknowledgement and explicit import.
    await openSection(page, 'Historical scopes · private evidence import');
    const baseHistory = { externalRef: 'synthetic-selling', title: 'Synthetic historical selling scope', classification: 'selling-quotation', source: { fileName: 'synthetic-scope.xlsx', sha256: 'a'.repeat(64), reviewedOn: '2020-01-01', locations: [{ sheet: 'Scope', range: 'A1:D5' }] }, scopeNotes: 'Synthetic scope evidence only.', quantityBasis: 'Net covered m2', amounts: [{ label: 'Historical installation', valuePence: 10000, role: 'selling', locationIndex: 0 }, { label: 'Repeated grand total', valuePence: 10000, role: 'duplicate-total', locationIndex: 0 }], warnings: ['Synthetic old prices; excluded from current rates.'] };
    const workerHistory = { ...baseHistory, externalRef: 'synthetic-worker', title: 'Synthetic worker-cost scope', classification: 'worker-cost', amounts: [{ label: 'Historical worker payment', valuePence: 6000, role: 'worker-cost', locationIndex: 0 }] };
    const unpricedHistory = { ...baseHistory, externalRef: 'synthetic-unpriced', title: 'Synthetic unpriced scope', classification: 'unpriced-schedule', amounts: [{ label: 'Unpriced installation', valuePence: null, role: 'unpriced', locationIndex: 0 }] };
    const historyPath = join(directory, 'history-fixture.json'); await writeFile(historyPath, JSON.stringify({ entries: [baseHistory, workerHistory, unpricedHistory] }));
    const oversizedHistoryPath = join(directory, 'oversized-history.json'); await writeFile(oversizedHistoryPath, ' '.repeat(2_000_001));
    const beforeOversized = actions.length; await (await page.$('.dp-private-history input[type=file]')).uploadFile(oversizedHistoryPath); await waitMessage(page, 'no larger than 2 MB'); assert.equal(actions.length, beforeOversized);
    const beforePreview = actions.length;
    await (await page.$('.dp-private-history input[type=file]')).uploadFile(historyPath);
    await waitMessage(page, 'Nothing has been imported.'); assert.equal(actions.length, beforePreview);
    const importButton = await page.$('.dp-private-history button.mw-action--primary'); assert.equal(await importButton.evaluate((button: HTMLButtonElement) => button.disabled), true);
    for (const detail of await page.$$('.dp-private-history section details.dp-config-card')) await detail.$eval('summary', (summary: HTMLElement) => summary.click());
    await openSection(page, 'Source identity and citations');
    const historyText = await page.$eval('.dp-private-history', (element: HTMLElement) => element.innerText);
    assert.match(historyText, /worker cost/); assert.match(historyText, /duplicate total/); assert.match(historyText, /Unpriced \/ unknown/); assert.match(historyText, /Scope · A1:D5/);
    await checkLabel(page, '.dp-private-history', 'I have reviewed source citations'); await importButton.click(); await waitMessage(page, '3 reviewed historical scopes imported privately.');
    const historyRequest = requests.find(request => request.action === 'admin.history.import')!;
    assert.deepEqual(historyRequest.payload.entries.map((entry: any) => entry.classification), ['selling-quotation', 'worker-cost', 'unpriced-schedule']); assert.equal(historyRequest.payload.entries[2].amounts[0].valuePence, null);
    assert.deepEqual(Object.keys(historyRequest.payload), ['entries']); assert.equal(actions.includes('admin.config.save'), false);

    // Switch the synthetic saved record to a complete scope and retain an immutable ready budget for the operational journeys.
    const complete = { ...emptyProjectDraft(), name: 'Synthetic completed project', buildingType: 'private-home' as const, rooms: [{ id: 'room-1', label: 'Synthetic living room', floor: 'Ground' }, { id: 'room-2', label: 'Synthetic study', floor: 'First' }], contact: { name: 'Synthetic owner', email: 'owner@example.invalid' }, address: { line1: 'Synthetic test site', town: 'London', postcode: 'TEST', country: 'UK' }, programme: { startDate: '2020-01-01', endDate: '2020-01-05', occupied: 'no' as const, outOfHours: 'no' as const, phases: 1, materialReadiness: { status: 'checked-ready' as const, scopeItemIds: [] } }, logistics: { vehicleDays: [], vehicleDaysConfirmed: true, deliveriesRequired: 'no' as const, storageRequired: 'no' as const, accessEquipmentRequired: 'no' as const, wasteRemovalRequired: 'no' as const } };
    complete.items = complete.rooms.map((room, index) => ({ id: `scope-${index}`, roomId: room.id, label: `${room.label} fabric`, scopeKind: 'multiple_rooms' as const, confirmedMeasurements: true, walls: [{ id: `wall-${index}`, widthMm: 4000, heightMm: 2500, count: 1, openings: [], reveals: [] }], material: { groupId: 'standard-fabric' as const, verifiedTypeId: 'standard-fabric', clientProvided: true, acoustic: 'no' as const, velvet: 'no' as const, specialist: 'no' as const }, preparation: 'normal-prep-lining-hanging' as const, access: 'standard' as const }));
    project = { ...project, revision: 2, name: complete.name, draft: complete }; pricing.servicePlans = [{ id: 'ready-plan', projectId, projectRevision: 2, approved: true, programmeReviewed: true, propertyContextReviewed: true, surveyHours: 0, managementHours: 0, parking: [] }];
    issued = createEstimate(complete, pricing, { id: '55555555-5555-4555-8555-555555555555', projectId, projectRevision: 2, createdAt: '2020-01-01T12:00:00Z' }); assert.equal(issued.status, 'ready');
    await clickText(page, '.dp-toolbar button', 'Reload saved revision'); await page.waitForFunction(() => document.querySelector('.dp-toolbar')?.textContent?.includes('revision 2'));
    await openSection(page, 'Completed work · actual labour and logistics');
    await clickText(page, '.dp-project-learning button', 'Load completion records and budgets'); await waitMessage(page, 'completion records and issued budgets loaded');
    await clickText(page, '.dp-project-learning button', 'Add an installation date'); await clickText(page, '.dp-project-learning button', 'Add an installation date');
    for (const [index, input] of (await page.$$('.dp-project-learning form input[type=date]')).entries()) if (index > 0) await input.evaluate((element: HTMLInputElement, value: string) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); }, `2020-01-0${index}`);
    await clickText(page, '.dp-project-learning button', 'Add actual labour'); await setField(page, '.dp-project-learning', 'Work carried out', 'Synthetic combined installation time'); await setField(page, '.dp-project-learning', 'Actual person-hours', '16');
    await clickText(page, '.dp-project-learning button', 'Add actual vehicle attendance');
    await page.$eval('.dp-project-learning fieldset input[type=date]', (element: HTMLInputElement) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, '2020-01-01'); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); });
    await setField(page, '.dp-project-learning', 'Vehicle reference', 'synthetic-van');
    for (const label of ['Actual parking cost', 'Actual Congestion Charge', 'Actual ULEZ charge', 'Actual delivery cost', 'Actual storage cost']) await setField(page, '.dp-project-learning', label, label === 'Actual parking cost' ? '25' : '0');
    await checkLabel(page, '.dp-project-learning', 'All five vehicle cost amounts are known'); await setField(page, '.dp-project-learning', 'Compare with issued budget · optional', issued.id);
    await clickText(page, '.dp-project-learning button', 'Save completion evidence'); await waitMessage(page, 'Completion evidence saved as a preserved record.');
    const actualRequest = requests.find(request => request.action === 'admin.actuals.save')!;
    assert.deepEqual(actualRequest.payload.body.installationDates, ['2020-01-01', '2020-01-02']); assert.equal(actualRequest.payload.body.vehicles.length, 1); assert.equal(actualRequest.payload.body.labour[0].minutes, 960); assert.equal(actualRequest.payload.body.vehicles[0].parkingPence, 2500); assert.equal(actualRequest.payload.body.vehicles[0].ulezPence, 0); assert.equal(actualRequest.payload.body.vehicles[0].costsConfirmed, true);
    assert.match(await page.$eval('.dp-actual-records', (element: HTMLElement) => element.innerText), /2 installation days; 1 vehicle days/);
    await setField(page, '.dp-actual-records', 'Owner review note', 'Synthetic logistics variance needs owner attention'); await clickText(page, '.dp-actual-records button', 'Request rate-card review'); await waitMessage(page, 'Owner review recorded.'); assert.equal(actualReviews[0].decision, 'rate-card-review-needed');
    await clickText(page, '.dp-actual-records button', 'Prepare a correction'); await setField(page, '.dp-project-learning', 'Actual person-hours', '18'); await clickText(page, '.dp-project-learning button', 'Save corrected completion record'); await page.waitForFunction(() => document.querySelectorAll('.dp-actual-records > article').length === 2);
    assert.equal(actualRecords.length, 2); assert.equal(actualRecords[0].supersedesId, actualRecords[1].id); assert.equal(actualRecords[0].body.labour[0].minutes, 1080); assert.equal(actualRecords[1].body.labour[0].minutes, 960);

    // Independent pilot inputs start empty, remain gated by both confirmations, then show actual matching and mismatch results.
    await openSection(page, 'Current-price pilot comparisons'); await clickText(page, '.dp-pilot-reviews button', 'Load pilot comparisons and available sources'); await waitMessage(page, 'Private pilot comparisons');
    assert.equal(await page.$$('.dp-pilot-reviews form fieldset').then((elements: any[]) => elements.length), 0);
    assert.equal(await page.$eval('.dp-pilot-reviews button[type=submit]', (button: HTMLButtonElement) => button.disabled), true);
    await setField(page, '.dp-pilot-reviews', 'Issued budget to assess', issued.id); await setField(page, '.dp-pilot-reviews', 'Owner estimate reference', 'Synthetic independent owner estimate'); await setField(page, '.dp-pilot-reviews', 'Comparison scope and review note', 'Independently checked synthetic rooms, installation and current services.');
    await clickText(page, '.dp-pilot-reviews button', 'Add an owner estimate line'); await setField(page, '.dp-pilot-reviews', 'Work / service description', 'Synthetic fabric installation'); await setField(page, '.dp-pilot-reviews', 'Owner amount · excluding VAT', String(issued.subtotalPence / 100));
    await checkLabel(page, '.dp-pilot-reviews', 'I independently prepared this breakdown'); await checkLabel(page, '.dp-pilot-reviews', 'I checked that the owner breakdown'); await clickText(page, '.dp-pilot-reviews button', 'Save current-price pilot comparison'); await waitMessage(page, 'Current-price comparison saved');
    assert.equal(pilotRecords[0].comparison.withinTolerance, true); assert.match(await page.$eval('.dp-pilot-reviews', (element: HTMLElement) => element.innerText), /Within recorded tolerance/);
    await setField(page, '.dp-pilot-reviews', 'Owner amount · excluding VAT', String(issued.subtotalPence / 100 + 100)); assert.equal(await page.$eval('.dp-pilot-reviews button[type=submit]', (button: HTMLButtonElement) => button.disabled), true);
    await checkLabel(page, '.dp-pilot-reviews', 'I independently prepared this breakdown'); await checkLabel(page, '.dp-pilot-reviews', 'I checked that the owner breakdown'); await clickText(page, '.dp-pilot-reviews button', 'Save current-price pilot comparison'); await page.waitForFunction(() => document.querySelector('.dp-pilot-reviews')?.textContent?.includes('Owner review required'));
    assert.equal(pilotRecords[0].comparison.withinTolerance, false); assert.equal(pilotRecords.length, 2);
    assert.equal(actions.includes('admin.config.save'), false, 'historical, actual and pilot evidence never writes rates'); assert.equal(actions.some(action => /send|notification.*save/.test(action)), false);
    assert.doesNotMatch(await page.$eval('.dp-admin', (element: HTMLElement) => element.innerText), /synthetic-access|synthetic-refresh|RESEND_API_KEY|provider-payload/);

    await page.setViewport({ width: 390, height: 900 });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await setField(page, '.dp-project-learning', 'Completion notes', 'Synthetic note entered at mobile width');
    await page.$eval('.dp-project-learning', (element: HTMLElement) => element.scrollIntoView({ block: 'start' }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'owner forms fit a mobile viewport');
    if (process.env.MW_DESIGNER_REVIEW_DIR) { await mkdir(process.env.MW_DESIGNER_REVIEW_DIR, { recursive: true }); await page.screenshot({ path: join(process.env.MW_DESIGNER_REVIEW_DIR, 'mw-designer-owner-mobile.png'), fullPage: false }); }

    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); if (server) await server.close(); await rm(directory, { recursive: true, force: true }); }
});
