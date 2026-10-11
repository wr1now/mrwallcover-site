import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// The built site (npm run build, no SITE_PHONE): WhatsApp and the booking button follow their
// build-time inputs. With no phone there is no WhatsApp control; the booking button appears in the
// dock, the desktop header, the footer and on the contact page only if src/config.ts holds a URL.
// Never a dead link, never the number, no tracking. The full on/off builds are in check:phone.
const files: string[] = [];
const walk = (dir: string) => { for (const e of readdirSync(dir)) { const f = path.join(dir, e); if (statSync(f).isDirectory()) walk(f); else if (f.endsWith('.html')) files.push(f); } };
walk('dist');
const config = readFileSync('src/config.ts', 'utf8');
const fromFile = config.match(/const bookingFromFile = '([^']*)';/)![1];

test('dist: booking and WhatsApp render only from their build inputs, with no dead link and no tracking', () => {
  assert.ok(files.length > 50);
  const home = readFileSync('dist/index.html', 'utf8');
  const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  if (!process.env.SITE_PHONE) assert.doesNotMatch(all, /data-wa\b/, 'no WhatsApp control without SITE_PHONE');
  if (!fromFile && process.env.BOOKING_URL === undefined) {
    assert.doesNotMatch(all, /data-book\b/, 'no booking button while BOOKING_URL is empty');
  } else if (fromFile) {
    assert.match(fromFile, /^https:\/\/calendar\.google\.com\/calendar\/appointments\/schedules\//);
    const contact = readFileSync('dist/contact/index.html', 'utf8');
    assert.ok(contact.slice(contact.indexOf('contact-quick')).includes(`href="${fromFile}"`), 'booking on the contact page');
    for (const a of all.match(/<a\b[^>]*\bdata-book\b[^>]*>[\s\S]*?<\/a>/g) ?? []) {
      assert.match(a, /rel="noopener noreferrer"/);
      assert.match(a, /aria-label="Book a 20-minute call \(opens Google Calendar in a new tab\)"/);
      assert.equal(a.replace(/^<a\b[^>]*>/, '').replace(/<[^>]+>/g, ''), 'Book a 20-minute call');
    }
    for (const part of ['data-dock', 'class="primary-nav"', '<footer']) assert.ok(home.slice(home.indexOf(part)).includes(`href="${fromFile}"`), `booking in ${part}`);
  }
  for (const a of all.match(/<a\b[^>]*\bdata-(?:book|wa)\b[^>]*>/g) ?? []) {
    assert.match(a, /target="_blank"/);
    assert.match(a, /rel="noopener( noreferrer)?"/);
    assert.doesNotMatch(a, /utm_|gclid|fbclid/, 'no tracking parameters');
  }
});
