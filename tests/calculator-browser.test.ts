import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, launchBrowser, loadPage, waitForPageContent } from '../scripts/visual-browser.mjs';

let server: any, browser: any;
before(async () => { server = await serve('dist'); browser = await launchBrowser(); });
after(async () => { await browser?.close(); await server?.close(); });

// Each case owns its browser context. External requests and every POST are blocked; these tests
// exercise the enquiry hand-off without sending a message or using a visitor's browser session.
async function withCalculator(query: Record<string, string>, check: (page: any) => Promise<void>) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors: string[] = [];
  let posts = 0;
  page.on('pageerror', (error: Error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', (request: any) => {
    if (request.method() === 'POST') posts++;
    if (request.method() === 'POST' || !request.url().startsWith(server.origin + '/')) void request.abort();
    else void request.continue();
  });
  try {
    await page.setViewport({ width: 1440, height: 1000 });
    const response = await loadPage(page, `${server.origin}/calculator/?${new URLSearchParams(query)}`);
    assert.equal(response.status(), 200);
    await page.waitForSelector('[name="widthUnit"][data-was]');
    await check(page);
    assert.deepEqual(errors, [], 'calculator and enquiry execute without JavaScript exceptions');
    assert.equal(posts, 0, 'the test never attempts to submit an enquiry');
  } finally { await context.close(); }
}

const ownerExample = { f: 'other-roll', rw: '55', rl: '10', m: 'straight', r: '65', ms: 'wall', w: '230x265' };
const ledger = (page: any) => page.$$eval('[data-docket-body] .qc-order dd strong', (nodes: Element[]) => nodes.map((node) => node.textContent));
const working = (page: any) => page.$eval('[data-quantity-output]', (node: HTMLElement) => node.innerText);
const cuts = (page: any) => page.$$eval('[data-quantity-output] .qc-roll-text', (nodes: Element[]) => nodes.map((node) => node.textContent));
const submit = (page: any) => page.$eval('[data-quantity]', (form: HTMLFormElement) => form.requestSubmit());
const fill = (page: any, selector: string, value: string) => page.$eval(selector, (input: HTMLInputElement, next: string) => {
  input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

test('calculator owner example: exact working/spare/order ledger and accessible cut positions', async () => {
  await withCalculator(ownerExample, async (page) => {
    assert.deepEqual(await ledger(page), ['2 rolls', '1 roll', '3 rolls']);
    const text = await working(page);
    assert.match(text, /5 drops across the wall/);
    assert.match(text, /65 cm is allowed at the start of each roll/);
    const rolls = await cuts(page);
    assert.match(rolls[0], /drop 1 \(275 cm\) at 65 cm, drop 2 \(275 cm\) at 390 cm, drop 3 \(275 cm\) at 715 cm\. 10 cm left/);
    assert.match(rolls[1], /drop 4 \(275 cm\) at 65 cm, drop 5 \(275 cm\) at 390 cm\. 335 cm left/);
    assert.match(text, /including the spare, from one batch/);
  });
});

test('half-drop chooses the lower-roll phase plan and keeps the order ledger separate', async () => {
  await withCalculator({ ...ownerExample, rw: '52', r: '52', m: 'half', w: '300x280' }, async (page) => {
    assert.deepEqual(await ledger(page), ['2 rolls', '1 roll', '3 rolls']);
    assert.match(await working(page), /same point are cut together, which needs fewer rolls here/);
    assert.match((await cuts(page))[0], /52(?: cm|,).*364(?: cm| and).*676 cm/);
  });
});

test('window reveals match the worked plan and impossible opening sizes remove the result', async () => {
  await withCalculator({ ...ownerExample, w: '400x265', o: 'window:1:120:135:90:20:sides-head' }, async (page) => {
    assert.deepEqual(await ledger(page), ['3 rolls', '1 roll', '4 rolls']);
    const text = await working(page);
    assert.match(text, /6 full-height drops and 6 shorter pieces/);
    const roll = (await cuts(page)).find((text: string) => text.includes('reveal part-drop'))!;
    assert.match(roll, /reveal part-drop \(130 cm\) at 65 cm.*reveal part-drop \(130 cm\) at 195 cm/);
    assert.match(roll, /below a window \(100 cm\) at 370 cm.*above an opening \(70 cm\) at 650 cm/);
    await fill(page, '[data-opening] [name="o-width"]', '500');
    await submit(page);
    assert.match(await page.$eval('[data-docket-body]', (node: HTMLElement) => node.innerText), /openings are wider than the wall/);
    assert.equal(await page.$eval('[data-quantity-output]', (node: HTMLElement) => node.hidden), true);
    assert.deepEqual(await ledger(page), []);
  });
});

test('a repeat changes units without changing its measurement or order quantity', async () => {
  await withCalculator(ownerExample, async (page) => {
    const initialCuts = await cuts(page);
    await page.select('[name="repeatUnit"]', 'in');
    assert.equal(await page.$eval('[name="repeat"]', (input: HTMLInputElement) => input.value), '25.59');
    await submit(page);
    assert.deepEqual(await ledger(page), ['2 rolls', '1 roll', '3 rolls']);
    assert.deepEqual(await cuts(page), initialCuts);
    await page.select('[name="repeatUnit"]', 'cm');
    assert.equal(await page.$eval('[name="repeat"]', (input: HTMLInputElement) => input.value), '65');
  });
});

test('changing to an imperial preset replaces an earlier exact measurement in centimetres', async () => {
  await withCalculator({ f: 'other-roll', rw: '20.5', rl: '10.05', m: 'free', w: '400x240', ms: 'wall' }, async (page) => {
    // A round trip creates the exact-size metadata used to avoid rounding drift.
    await page.select('[name="widthUnit"]', 'in');
    await page.select('[name="widthUnit"]', 'cm');
    await page.select('[name="format"]', 'us-double');
    await submit(page);
    assert.deepEqual(await ledger(page), ['2 double rolls', '1 double roll', '3 double rolls']);
    assert.match(await working(page), /8 drops across the wall/);
    assert.equal(await page.$eval('[name="rollWidth"]', (input: HTMLInputElement) => input.value), '20.5');
    assert.equal(await page.$eval('[name="widthUnit"]', (input: HTMLSelectElement) => input.value), 'in');
  });
});

test('measurement-unit changes and shared-link reload retain millimetres at a roll threshold', async () => {
  // At exactly 318 cm six 53 cm strips fit: 2 working rolls. A rounded 10.43 ft reload would
  // become 318.11 cm and incorrectly require a seventh strip and a third working roll.
  await withCalculator({ rw: '53', rl: '10.05', m: 'free', w: '318x270', ms: 'wall' }, async (page) => {
    assert.deepEqual(await ledger(page), ['2 rolls', '1 roll', '3 rolls']);
    await page.click('label:has([name="mu"][value="ft"])');
    assert.equal(await page.$eval('[name="width"]', (input: HTMLInputElement) => input.value), '10.43');
    await submit(page);
    assert.deepEqual(await ledger(page), ['2 rolls', '1 roll', '3 rolls']);
    await page.$eval('.qc-utility button', (button: HTMLButtonElement) => button.click());
    await page.waitForFunction(() => new URLSearchParams(location.search).get('mu') === 'ft');
    const shared = new URL(page.url());
    assert.ok(Math.abs(Number(shared.searchParams.get('w')!.split('x')[0]) * 30.48 - 318) < 0.000001);
    await page.reload({ waitUntil: 'load' });
    await waitForPageContent(page);
    assert.deepEqual(await ledger(page), ['2 rolls', '1 roll', '3 rolls']);
    assert.match(await working(page), /Wall: 318 cm wide/);
    await page.click('label:has([name="mu"][value="cm"])');
    assert.equal(await page.$eval('[name="width"]', (input: HTMLInputElement) => input.value), '318');
  });
});

test('malformed enum query values cannot break the calculator and ordinary fields remain usable', async () => {
  await withCalculator({ ...ownerExample, mu: '\"]', b: '\"]', m: 'unknown-match' }, async (page) => {
    await page.select('[name="match"]', 'straight');
    await fill(page, '[name="repeat"]', '65');
    await submit(page);
    assert.deepEqual(await ledger(page), ['2 rolls', '1 roll', '3 rolls']);
    assert.equal(await page.$$eval('[name="bespoke"]:checked', (nodes: Element[]) => nodes.length), 0);
  });
});

test('measurement hand-off preserves the calculation and product link in the local enquiry brief', async () => {
  const product = 'https://example.com/wallpaper/sample';
  await withCalculator({ ...ownerExample, link: product }, async (page) => {
    const next = '[data-docket-body] a[href^="/contact/?intent=install"]';
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click(next)]);
    await waitForPageContent(page);
    assert.match(page.url(), /\/contact\/\?intent=install&from=calculator/);
    await page.waitForFunction(() => (document.querySelector<HTMLTextAreaElement>('[name="message"]')?.value ?? '').includes('From the quantity calculator'));
    const message = await page.$eval('[name="message"]', (input: HTMLTextAreaElement) => input.value);
    assert.match(message, /Wall: 230 cm wide, height to paper 265 cm/);
    assert.match(message, /2 rolls working \+ 1 roll spare = 3 rolls/);
    assert.ok(message.includes(product));
    assert.equal(await page.$eval('[name="intent"]', (input: HTMLSelectElement) => input.value), 'install');
  });
});

test('stairwells give a measurement request without a quantity', async () => {
  await withCalculator({ ...ownerExample, b: 'stairs' }, async (page) => {
    const text = await page.$eval('[data-docket-body]', (node: HTMLElement) => node.innerText);
    assert.match(text, /stairwell has sloping lines/);
    assert.match(text, /Send us your measurements/);
    assert.deepEqual(await ledger(page), []);
    assert.equal(await page.$eval('[data-quantity-output]', (node: HTMLElement) => node.hidden), true);
  });
});

test('made-to-measure murals show maker margin and area, followed by the measurement request', async () => {
  await withCalculator({ f: 'mural', w: '350x260', ms: 'wall', mg: '10' }, async (page) => {
    const text = await page.$eval('[data-docket-body]', (node: HTMLElement) => node.innerText);
    assert.match(text, /9.72 m²/);
    assert.match(text, /360 × 270 cm, including the 10 cm margin/);
    assert.match(text, /Send us your measurements/);
    assert.equal(await page.$eval('[data-quantity-output]', (node: HTMLElement) => node.hidden), true);
  });
});

test('a mural requires the maker margin explicitly, including an intentional zero', async () => {
  await withCalculator({ f: 'mural', w: '350x260', ms: 'wall' }, async (page) => {
    assert.equal(await page.$eval('[name="margin"]', (input: HTMLInputElement) => input.value), '');
    await submit(page);
    assert.equal(await page.$eval('[name="margin"]', (input: HTMLInputElement) => input.getAttribute('aria-invalid')), 'true');
    assert.deepEqual(await ledger(page), []);
    await fill(page, '[name="margin"]', '0');
    await submit(page);
    const text = await page.$eval('[data-docket-body]', (node: HTMLElement) => node.innerText);
    assert.match(text, /9.1 m²/);
    assert.match(text, /350 × 260 cm, including the 0 cm margin/);
  });
});

test('clearing a measured dimension marks the old plan stale and disables sending or sharing it', async () => {
  await withCalculator(ownerExample, async (page) => {
    assert.deepEqual(await ledger(page), ['2 rolls', '1 roll', '3 rolls']);
    await fill(page, '[name="width"]', '');
    await page.waitForFunction(() => document.querySelector('[data-docket]')!.classList.contains('is-stale'));
    assert.match(await page.$eval('[data-docket]', (node: HTMLElement) => node.innerText), /Update the measurement to refresh this result/);
    assert.equal(await page.$eval('[data-quantity-output]', (node: HTMLElement) => node.classList.contains('is-stale')), true);
    assert.equal(await page.$$eval('.qc-actions-wrap, .qc-utility', (nodes: HTMLElement[]) => nodes.every((node) => node.inert)), true);
    const before = page.url();
    await page.$eval('[data-docket-body] a[href^="/contact/"]', (link: HTMLAnchorElement) => link.click());
    await page.$eval('.qc-utility button', (button: HTMLButtonElement) => button.click());
    assert.equal(page.url(), before);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('mw-quantity-brief')), null);
  });
});

test('pattern guide follows each match and stays explanatory rather than changing quantities', async () => {
  await withCalculator(ownerExample, async (page) => {
    await page.locator('[data-match-guide] summary').click();
    for (const match of ['free', 'reverse', 'straight', 'half', 'third', 'quarter']) {
      await page.select('[name="match"]', match);
      const shown = await page.$$eval('[data-match-example]', (nodes: HTMLElement[]) => nodes.filter((node) => !node.hidden).map((node) => node.dataset.matchExample));
      assert.deepEqual(shown, [match]);
      assert.match(await page.$eval(`[data-match-example="${match}"]`, (node: HTMLElement) => node.innerText), /Illustrative/);
    }
    await page.select('[name="format"]', 'mural');
    assert.equal(await page.$eval('[data-match-guide]', (node: HTMLElement) => node.hidden), true);
  });
});

test('worked-example shortcut fills a transparent example and shows working, spare and total on mobile', async () => {
  await withCalculator({}, async (page) => {
    await page.setViewport({ width: 390, height: 844 });
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('.qc-start-options a')]);
    await waitForPageContent(page);
    await page.waitForSelector('[data-docket-body] .qc-order');
    assert.deepEqual(await ledger(page), ['2 rolls', '1 roll', '3 rolls']);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  });
});
