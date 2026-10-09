import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPreferences, parsePreferences, recommendFamilies } from '../src/lib/material-advice.ts';
import { emptyEnquiry, validateEnquiry } from '../src/lib/enquiry.ts';

test('wet positions require review instead of suggesting a supposedly waterproof family', () => {
  const result = recommendFamilies({ ...defaultPreferences, use: 'wet', look: 'natural', cleaning: 'frequent' });
  assert.deepEqual(result.slugs, []);
  assert.match(result.explanation, /product and wall-condition review/);
});

test('a customer who wants discreet panels is not steered to natural grasscloth', () => {
  const result = recommendFamilies({ ...defaultPreferences, look: 'natural', panels: 'discreet' });
  assert.equal(result.slugs.includes('grasscloth-and-weaves'), false);
});

test('frequent cleaning does not become a family-wide washable claim', () => {
  const result = recommendFamilies({ ...defaultPreferences, use: 'busy', cleaning: 'frequent' });
  assert.ok(result.slugs.includes('contract-vinyl'));
  assert.match(result.explanation, /not all washable/);
});

test('untrusted preference values are rejected and unrelated keys never reach a lead', () => {
  assert.equal(parsePreferences({ ...defaultPreferences, use: '<script>' }), null);
  assert.equal(parsePreferences([]), null);
  const preferences = parsePreferences({ ...defaultPreferences, email: 'private@example.com' });
  assert.deepEqual(preferences, defaultPreferences);
  const result = validateEnquiry(emptyEnquiry({ name: 'Sample User', replyBy: 'email', email: 'sample@example.com', message: 'A room to discuss.', materialPreferences: JSON.stringify({ ...defaultPreferences, email: 'private@example.com' }) }));
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(JSON.parse(result.value.materialPreferences), defaultPreferences);
});
