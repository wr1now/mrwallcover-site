import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// "What to send for a fast quote" (competitor-analysis follow-up c): copy above the enquiry form,
// outside the form stack, each item resting on something the site already says, and no reply-time
// promise until Dorin states one.
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const checklist = JSON.parse(readFileSync('src/content/quote-checklist.json', 'utf8'));
const contact = readFileSync('dist/contact/index.html', 'utf8');

test('/contact/: the checklist sits above the enquiry form, every item rendered, every link built', () => {
  const at = contact.indexOf('data-quote-checklist');
  assert.ok(at > 0, 'checklist on the contact page');
  assert.ok(at < contact.indexOf('<form'), 'above the enquiry form');
  const section = decode(contact.slice(at, contact.indexOf('</section>', at)));
  assert.ok(section.includes(`>${checklist.heading}</h2>`));
  for (const item of checklist.items) {
    assert.ok(section.includes(`<strong>${item.lead}</strong> ${item.text}`), item.lead);
    if (item.href) {
      assert.ok(section.includes(`href="${item.href}"`));
      assert.ok(existsSync(`dist${item.href}index.html`), `${item.href} is built`);
    }
    for (const file of item.source.match(/src\/[\w./[\]-]+/g) ?? []) assert.ok(existsSync(file), `source ${file} exists`);
  }
});

test('/contact/: no reply-time promise is printed (none is stated in the repo)', () => {
  const text = decode(contact.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' '));
  assert.doesNotMatch(text, /\b(reply|respond|response|get back to you|hear from us)\b[^.]{0,40}\b(within|in)\s+(one|a|two|24|48|\d+)\s+(working\s+)?(hours?|days?)\b/i);
  assert.doesNotMatch(JSON.stringify(checklist.items), /within \d|working day|24 hours|48 hours/i);
});

test('the checklist is not part of the enquiry form (Codex form stack untouched)', () => {
  const form = contact.slice(contact.indexOf('<form'), contact.indexOf('</form>'));
  assert.doesNotMatch(form, /data-quote-checklist|quote-checklist/);
});
