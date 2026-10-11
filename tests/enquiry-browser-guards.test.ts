import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const form = await readFile('src/components/EnquiryForm.astro', 'utf8');
const script = await readFile('src/scripts/enquiry-form.ts', 'utf8');
const thanks = await readFile('src/pages/thank-you.astro', 'utf8');

test('receipt visibility uses the hidden attribute controlled by the receipt script', () => {
  const receipt = thanks.match(/<p\b[^>]*data-receipt-line[^>]*>/)?.[0];
  assert.ok(receipt);
  assert.match(receipt, /\shidden(?:\s|>)/);
  assert.doesNotMatch(receipt, /class="[^"]*\bhidden\b/);
  assert.match(thanks, /line\.hidden = false/);
});

test('reply-method and attachment errors have real summary destinations and attachment help is associated', () => {
  assert.match(form, /<fieldset id="field-replyBy">/);
  assert.match(form, /id="field-attachment"/);
  assert.match(form, /aria-describedby="attachment-help attachment-error"/);
  assert.match(form, /id="attachment-error"[^>]*data-error="attachment"[^>]*aria-live="polite"/);
  assert.match(form, /attachmentLimits\(LEAD_API_URL \? 'lead-api' : FORM_PROVIDER\)/);
  assert.match(script, /if \(!validated\.ok \|\| uploadError\)\s*\{\s*event\.preventDefault\(\)/);
});

test('returning from the provider through BFCache re-enables the submit button', () => {
  const listener = script.match(/window\.addEventListener\('pageshow', \(event\) => \{([\s\S]*?)\n  \}\);/)?.[1];
  assert.ok(listener, 'the real pageshow recovery callback exists');
  const button = { disabled: true };
  const context = { event: { persisted: true }, sending: true, form: { querySelector: () => button } };
  runInNewContext(`(() => {${listener.replace(/querySelector<HTMLButtonElement>/g, 'querySelector')} })()`, context);
  assert.equal(button.disabled, false);
  assert.equal(context.sending, false);
  button.disabled = true;
  context.sending = true;
  context.event.persisted = false;
  runInNewContext(`(() => {${listener.replace(/querySelector<HTMLButtonElement>/g, 'querySelector')} })()`, context);
  assert.equal(button.disabled, true, 'ordinary page-show does not interrupt a current submission');
  assert.equal(context.sending, true);
});

test('brief navigation disables Back on the first step and removes Continue from the final step', () => {
  const showStep = script.match(/const showStep = \(index: number\) => \{([\s\S]*?)\n  \};/)?.[1];
  assert.ok(showStep, 'exercise the real step presentation function');
  const steps = Array.from({ length: 4 }, () => ({ hidden: true }));
  const label = { textContent: '' };
  const back = { disabled: false };
  const next = { hidden: false };
  const controls = { '[data-step-label]': label, '[data-step-back]': back, '[data-step-next]': next };
  const context = {
    index: 0, stepIndex: 0, steps, intent: { value: 'install' }, track: () => {},
    form: { querySelector: (selector: keyof typeof controls) => controls[selector] },
  };
  const visit = (index: number) => {
    context.index = index;
    runInNewContext(`(() => {${showStep.replace(/querySelector<\w+>/g, 'querySelector')} })()`, context);
    assert.equal(context.stepIndex, index);
    assert.deepEqual(steps.map((step) => step.hidden), steps.map((_, i) => i !== index));
  };
  visit(0);
  assert.equal(label.textContent, 'Step 1 of 4');
  assert.equal(back.disabled, true);
  assert.equal(next.hidden, false);
  visit(1);
  assert.equal(label.textContent, 'Step 2 of 4');
  assert.equal(back.disabled, false);
  assert.equal(next.hidden, false);
  visit(3);
  assert.equal(label.textContent, 'Step 4 of 4');
  assert.equal(back.disabled, false);
  assert.equal(next.hidden, true);
  visit(2);
  assert.equal(label.textContent, 'Step 3 of 4');
  assert.equal(next.hidden, false, 'Continue returns when moving back from the final step');
  visit(0);
  assert.equal(back.disabled, true, 'Back becomes disabled again on returning to the first step');
});
