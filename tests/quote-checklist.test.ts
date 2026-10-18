import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// "What to send for a fast quote": supporting copy follows the enquiry form in the
// adjacent briefing rail, each item resting on something the site already says, and no reply-time
// promise until Dorin states one.
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const checklist = JSON.parse(readFileSync('src/content/quote-checklist.json', 'utf8'));
const contact = readFileSync('dist/contact/index.html', 'utf8');

test('/contact/: the enquiry form comes first and its adjacent checklist retains every item and link', () => {
  const at = contact.indexOf('data-quote-checklist');
  assert.ok(at > 0, 'checklist on the contact page');
  assert.ok(contact.indexOf('<form') > 0 && contact.indexOf('</form>') < at, 'the form precedes the supporting checklist');
  assert.match(contact.slice(contact.indexOf('</form>'), at), /<aside\b[^>]*class="contact-aside"/, 'the checklist lives in the adjacent briefing rail');
  const section = decode(contact.slice(at, contact.indexOf('</section>', at)));
  assert.ok(section.includes(`>${checklist.heading}</h2>`));
  const items = [...section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
  assert.equal(items.length, checklist.items.length, 'one list item per checklist point');
  for (const [index, item] of checklist.items.entries()) {
    const markup = items[index];
    const lead = markup.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/)?.[1];
    assert.equal(lead, item.lead, 'the lead stays visible and emphasised');
    const text = markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    assert.ok(text.includes(`${item.lead} ${item.text}`), item.lead);
    assert.match(markup, /<svg\b[^>]*aria-hidden="true"/, 'the icon is decorative beside the full label');
    if (item.href) {
      assert.ok(markup.includes(`href="${item.href}"`));
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
