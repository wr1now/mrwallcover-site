import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser, loadPage, serve } from '../scripts/visual-browser.mjs';
import { emptyProjectDraft } from '../src/designer-portal/validation.ts';
import { createEstimate } from '../server/designer-portal/pricing.ts';
import { createDefaultPricingConfig } from '../server/designer-portal/defaults.ts';

test('connected UI uses verified sign-in, renders an incomplete preview and exposes structured owner controls', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mw-designer-connected-'));
  const origin = 'https://portal.example.invalid';
  let browser: any, server: any;
  try {
    await promisify(execFile)('node_modules/.bin/astro', ['build', '--outDir', directory], { env: { ...process.env, PUBLIC_DESIGNER_PORTAL_ENABLED: 'true', PUBLIC_DESIGNER_PORTAL_URL: origin, PUBLIC_DESIGNER_PORTAL_ANON_KEY: 'synthetic-public-key' }, maxBuffer: 64 * 1024 * 1024 });
    server = await serve(directory); browser = await launchBrowser();
    const page = await browser.newPage(), actions: string[] = [], errors: string[] = [];
    page.setDefaultTimeout(10_000);
    page.on('dialog', async (dialog: any) => { assert.match(dialog.message(), /draft|save|download|unsaved/i); await dialog.accept(); });
    const studioId = '11111111-1111-4111-8111-111111111111', projectId = '22222222-2222-4222-8222-222222222222';
    const draft = { ...emptyProjectDraft(), name: 'Synthetic connected review' };
    const project = { id: projectId, studioId, name: draft.name, revision: 1, draft };
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
        const body = JSON.parse(request.postData() || '{}'); actions.push(body.action);
        const data: Record<string, unknown> = {
          session: identity, 'project.list': { projects: [project] }, 'catalog.products': { products: [] },
          'project.get': { project, documents: [], jobs: [], evidence: [], estimates: [], shares: [], notifications: [{ id: 'notification-fixture', state: 'provider_accepted', recipientUserId: identity.user.id, attempts: 1, providerAcceptedAt: '2026-10-18T12:00:00Z', deliveredAt: null, providerEvent: 'sent', error: null, createdAt: '2026-10-18T12:00:00Z' }] },
          'admin.notifications.get': { configuration: { enabled: false, provider: 'resend', sender: null, workspaceUrl: null, monthlyCap: null, dailyStudioCap: null, monthlyBudgetPence: null, worstCaseAttemptPence: null }, usage: [] },
          'estimate.preview': { estimate: preview }, 'admin.config.get': { config: pricing, version: 0 },
        };
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
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); if (server) await server.close(); await rm(directory, { recursive: true, force: true }); }
});
