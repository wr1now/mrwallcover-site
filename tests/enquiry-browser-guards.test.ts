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
  // The fuller brief counts only its own three parts; the always-visible reply fieldset is the send step.
  assert.equal([...form.matchAll(/<div data-step\b/g)].length, 3);
  assert.match(form, /data-step-label>Fuller brief: part 1 of 3</);
  const steps = Array.from({ length: 3 }, () => ({ hidden: true }));
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
  assert.equal(label.textContent, 'Fuller brief: part 1 of 3');
  assert.equal(back.disabled, true);
  assert.equal(next.hidden, false);
  visit(1);
  assert.equal(label.textContent, 'Fuller brief: part 2 of 3');
  assert.equal(back.disabled, false);
  assert.equal(next.hidden, false);
  visit(2);
  assert.equal(label.textContent, 'Fuller brief: part 3 of 3');
  assert.equal(back.disabled, false);
  assert.equal(next.hidden, true);
  visit(1);
  assert.equal(label.textContent, 'Fuller brief: part 2 of 3');
  assert.equal(next.hidden, false, 'Continue returns when moving back from the final step');
  visit(0);
  assert.equal(back.disabled, true, 'Back becomes disabled again on returning to the first step');
});

test('the short form marks what is required, shows both reply fields and keeps the moved fields in the enquiry variant only', () => {
  assert.match(form, /<label for="name">Name <span class="text-stone">Required<\/span><\/label>/);
  assert.match(form, /<legend>Preferred reply <span class="text-stone">Required<\/span><\/legend>/);
  assert.match(form, /'Your note'\} <span class="text-stone">Required<\/span><\/label>/);
  assert.match(form, /<div class="field" id="field-phone" data-reply="phone">/, 'the phone field is not hidden');
  assert.doesNotMatch(script, /\.hidden = reply ===/, 'the script no longer hides a reply field');
  assert.match(script, /aria-required', String\(reply === 'email'\)/);
  assert.match(script, /aria-required', String\(reply === 'phone'\)/);
  const contact = form.slice(form.indexOf('<fieldset class="grid gap-5" data-contact>'));
  const builder = form.slice(form.indexOf('<div data-builder hidden>'), form.indexOf('<fieldset class="grid gap-5" data-contact>'));
  for (const id of ['audience', 'timing']) {
    assert.ok(contact.includes(`id="${id}" name="${id}"`), `${id} sits in the short form`);
    assert.ok(!builder.includes(`id="${id}"`), `${id} is not repeated in the fuller brief`);
  }
  assert.ok(contact.indexOf('id="field-name"') < contact.indexOf('id="field-audience"'), 'I am a… follows the name');
  assert.match(contact, /\{variant === 'enquiry' && \(\s*<div class="field" id="field-audience">/, 'the care form has no audience question');
  // The professional prompt follows the choice in the short form, so it shows while the fuller brief is closed.
  const audienceField = contact.slice(contact.indexOf('id="field-audience"')).split('</div>')[0];
  assert.match(audienceField, /<\/select>\s*<p data-professional-help class="form-note[^"]*" aria-live="polite"><\/p>/);
  assert.ok(!builder.includes('data-professional-help'), 'the prompt is not left inside the fuller brief');
  assert.match(form, /\.enquiry \[data-professional-help\]:empty \{ margin-top: 0; \}/, 'an empty prompt takes no space but stays a live region');
  // The no-JavaScript notice is the only one: no duplicate <noscript> line.
  assert.doesNotMatch(form, /<noscript>/);
  assert.match(form, /<p class="enquiry-nojs">[^\n]*href=\{ENQUIRY_MAILTO\}/);
});

test('links in the form notes are underlined text, and the WhatsApp offer is not drawn as the icon button', () => {
  const style = form.match(/<style is:global>([\s\S]*?)<\/style>/)?.[1] || '';
  assert.match(style, /\.enquiry \.form-note a \{ text-decoration: underline;/);
  assert.match(style, /\.enquiry \.form-note \.wa-link \{ display: inline; \}/);
  assert.match(style, /\.enquiry \.form-note \.wa-glyph \{ display: none; \}/);
  // A scoped <style> would stamp data-astro-cid on every form element and break the markup checks.
  assert.doesNotMatch(form, /<style(?! is:global)/);
});

test('the attachment list ends with the running total in the help line units', () => {
  assert.match(script, /\$\{unit\.name\} of \$\{totalLimit \/ unit\.bytes\} \$\{unit\.name\} used/);
  assert.match(script, /attachmentProvider === 'lead-api' \? \{ bytes: 1024 \* 1024, name: 'MiB' \} : \{ bytes: 1_000_000, name: 'MB' \}/);
  // Only JPEG, PNG and WebP are redrawn; HEIC and PDF go as chosen.
  assert.match(script, /const PHOTO_TYPES = \/\^image\\\/\(jpeg\|png\|webp\)\$\/;/);
  assert.match(script, /const PHOTO_MAX_EDGE = 2400;/);
});

test('both contact pages take the booking hours and the enquiry email subject from src/config.ts', async () => {
  const config = await readFile('src/config.ts', 'utf8');
  assert.match(config, /export const BOOKING_DAYS = 'Mon–Fri, 9am–5pm UK';/);
  assert.match(config, /export const BOOKING_HOURS = `Calls \$\{BOOKING_DAYS\}\.`;/);
  assert.match(config, /export const ENQUIRY_MAILTO = `mailto:\$\{PUBLIC_EMAIL\}\?subject=Wallcovering%20enquiry`;/);
  for (const file of ['src/pages/contact.astro', 'src/pages/get-in-touch.astro']) {
    const page = await readFile(file, 'utf8');
    assert.match(page, /\{BOOKING_HOURS\} Each call is 20&nbsp;minutes\./, `${file}: the hours line comes from BOOKING_HOURS`);
    assert.doesNotMatch(page, /Calls Mon–Fri/, `${file}: no hand-copied hours`);
    assert.match(page, /<a href=\{ENQUIRY_MAILTO\}>\{PUBLIC_EMAIL\}<\/a>/, `${file}: the direct email opens with a subject`);
  }
});
