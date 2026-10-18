import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { EMAIL_MARKETING_VERSION, PRIVACY_NOTICE_VERSION, ENQUIRY_TOPICS, enquiryAudience, enquiryContext, enquiryHrefForPage, enquiryTopicLabel } from '../src/lib/enquiry-context.ts';
import { emptyEnquiry, validateEnquiry } from '../src/lib/enquiry.ts';

const valid = (partial = {}) => validateEnquiry(emptyEnquiry({ name: 'Ada', replyBy: 'email', email: 'ada@example.invalid', message: 'Please discuss this project with me.', ...partial }));

test('service/material topic links preserve intent and carry only allowlisted context', () => {
  const href = enquiryHrefForPage('/materials/grasscloth-and-weaves/', '/contact/?intent=source&email=private@example.invalid&utm_source=arbitrary#enquiry');
  const url = new URL(href, 'https://www.mrwallcover.com');
  assert.equal(url.pathname, '/contact/');
  assert.equal(url.searchParams.get('topic'), 'material:grasscloth-and-weaves');
  assert.equal(url.searchParams.get('service'), 'wallcovering');
  assert.equal(url.searchParams.get('intent'), 'source');
  assert.equal(url.hash, '#enquiry');
  assert.equal(url.searchParams.has('email'), false);
  assert.equal(url.searchParams.has('utm_source'), false);
  assert.equal(enquiryHrefForPage('/services/window-film/').includes('service=window-film'), true);
});

test('existing calculator handoff and external/non-contact destinations keep their purpose', () => {
  assert.equal(enquiryHrefForPage('/calculator/', '/contact/?intent=install&from=calculator'), '/contact/?intent=install&from=calculator');
  for (const href of ['/projects/', '#support', 'mailto:info@mrwallcover.com', 'https://example.invalid/contact/', '//example.invalid/contact/']) assert.equal(enquiryHrefForPage('/services/window-film/', href), href);
  assert.equal(enquiryHrefForPage('/services/window-film/', '/contact/other/'), '/contact/other/');
});

test('unknown, contact-like, object and mismatched context cannot become a submitted topic', () => {
  for (const topic of ['person@example.invalid', 'service:unknown', '<script>', { id: 'service:window-film' }, 'x'.repeat(10000)]) {
    assert.deepEqual(enquiryContext({ topic, service: 'private@example.invalid', sourceDeclared: 'person@example.invalid' }), { service: '', topic: '', topicOrigin: '', sourceDeclared: '' });
  }
  assert.deepEqual(enquiryContext({ service: 'window-film', topic: 'material:grasscloth-and-weaves', topicOrigin: 'link' }), { service: 'window-film', topic: '', topicOrigin: '', sourceDeclared: '' });
  assert.equal(enquiryTopicLabel('person@example.invalid'), '');
});

test('source is a declared enum and cannot be inferred from a query/referrer', () => {
  assert.equal(enquiryContext({ sourceDeclared: 'instagram' }).sourceDeclared, 'instagram');
  assert.equal(enquiryContext({ sourceDeclared: 'https://www.instagram.com/?email=someone' }).sourceDeclared, '');
  assert.equal(enquiryContext({}).sourceDeclared, '');
  assert.equal(enquiryAudience('contractor'), 'developer');
  assert.equal(enquiryAudience('person@example.invalid'), '');
});

test('every catalog topic is unique and corresponds to a current public material/service/professional entry', async () => {
  assert.equal(new Set(ENQUIRY_TOPICS.map((topic) => topic.id)).size, ENQUIRY_TOPICS.length);
  assert.equal(new Set(ENQUIRY_TOPICS.map((topic) => topic.path)).size, ENQUIRY_TOPICS.length);
  for (const [file, prefix, route] of [['specialisms', 'service', 'services'], ['materials', 'material', 'materials']] as const) {
    const data = JSON.parse(await readFile(`src/content/${file}.json`, 'utf8'));
    for (const item of data.items) {
      const topic = ENQUIRY_TOPICS.find((topic) => topic.id === `${prefix}:${item.slug}`);
      assert.equal(topic?.path, `/${route}/${item.slug}/`);
      assert.equal(topic?.label, item.name);
    }
  }
});

test('marketing requires valid email reply, affirmative choice, and both current statement versions', () => {
  const versions = { marketingTextVersion: EMAIL_MARKETING_VERSION, privacyNoticeVersion: PRIVACY_NOTICE_VERSION };
  for (const partial of [{}, { marketing: true }, { marketing: true, ...versions, marketingTextVersion: 'old' }, { marketing: true, ...versions, privacyNoticeVersion: 'future' }, { marketing: true, ...versions, replyBy: 'phone', phone: '07700900000' }]) {
    const result = valid(partial);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.marketing, false);
  }
  const granted = valid({ marketing: true, ...versions });
  assert.equal(granted.ok, true);
  if (granted.ok) assert.equal(granted.value.marketing, true);
});

test('aftercare cannot acquire a sales-service topic through query manipulation', () => {
  const result = valid({ kind: 'aftercare', service: 'window-film', topic: 'service:window-film', topicOrigin: 'link' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.service, 'aftercare');
  assert.equal(result.value.intent, 'aftercare');
  assert.equal(result.value.topic, '');
});


test('choosing care on the main contact form is classified as aftercare, not a new-installation lead', () => {
  const result = valid({ kind: 'enquiry', service: 'aftercare' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.kind, 'aftercare');
  assert.equal(result.value.intent, 'aftercare');
  assert.equal(result.value.service, 'aftercare');
});
