# Enquiry context and email permission

The website remains a static Astro build. Its public form keeps the existing FormSubmit alias, with FormSubmit's existing reCAPTCHA page enabled (`_captcha` is "true" in src/components/EnquiryForm.astro); the honeypot remains, and without JavaScript the send button stays disabled and the email notice shows first; the optional private API and Umami remain off unless deliberately configured. This change does not add visitor tracking, connect an analytics identity to a contact, send email, or turn the thank-you page into proof of delivery.

## Shared contract

`src/lib/enquiry-context.ts` is the public allowlist for services, topics and declared sources. `Action.astro` adds the current allowlisted page/topic to local contact actions, preserving reviewed intent, audience and calculator handoffs. Material, service, professional and Guide templates inherit this behavior. Generic footer contact actions opt out with `contextualEnquiry={false}` and retain their plain contact destination. A new page only supplies context when its public path is deliberately added to the catalog; not every page requires a topic.

The form shows the topic, lets the visitor remove it or change the service, and sends it only with their submitted note. It does not save topic history, store referrers, persist campaigns or read arbitrary UTM/click identifiers. Source is a separate optional answer supplied by the visitor. A source answer or prefilled topic is context, not proof of an acquisition journey.

The existing `audience=contractor` link resolves to the main-contractor/developer intake. Unknown or mismatched service/topic values are cleared. The care form keeps its `aftercare` kind and service; it cannot acquire a new-installation topic through a manipulated query.

## Reply channels and attachments

The short form shows both the email and the phone field. The visitor chooses a preferred reply, and only that field is required; `validateEnquiry` keeps the other one only when it is usable (a valid address, or a number with at least eight digits). The "I am a…" question and "When would you like to start?" sit in the short form; the fuller brief keeps its own three parts. The prompt for a professional choice (designer, developer, hotel, other commercial) shows under "I am a…" as a polite live region, so it appears whether or not the fuller brief is open; the professional fields themselves stay in part 1 of the fuller brief. The privacy notice describes the email address and phone number the visitor provides. Native submissions receive the validated contact values, so unusable optional details are discarded just as on the API path.

When a visitor chooses a JPEG, PNG or WebP longer than 2,400 pixels, the form script redraws it at 2,400 pixels on the long edge as a JPEG (quality 0.85) before listing it, so the running total under the list is what will be sent. HEIC, PDF, smaller images and anything the browser cannot draw are sent exactly as chosen. The send button waits while the files are prepared.

## Email updates

The separate checkbox is unchecked and disabled by default. It becomes available only for a syntactically valid email reply address. Switching to a phone reply or making the email invalid clears the choice. It does not grant permission for text messages, calls, analytics, ad audiences or browsing-history recording.

The form posts `marketingTextVersion` and `privacyNoticeVersion` alongside its choice. Both map to server-owned constants; arbitrary client wording/timestamps are not accepted as evidence. Versions must describe the actual rendered text. Preserve historical statements when introducing a future version; do not reinterpret an old Boolean as permission.

The public FormSubmit path forwards these form fields into the existing correspondence. It has no trusted server acceptance timestamp in this application and does not populate a CRM automatically. An unchecked box is omitted from a native POST. Honour withdrawal requests received at the published email address; before running any campaign, establish a working suppression/unsubscribe process and review eligible recipients. A subsequent enquiry must not lift an earlier marketing objection.

## Optional private server JSON: version 2

This remains a local prototype, not a hosted CRM or email system. A new stored record and the authenticated staff export carry `schemaVersion: 2`. Existing records may have no version or permission object; their marketing permission is unknown.

```text
schemaVersion: 2
reference: server-generated reference
createdAt: server receipt time in ISO format
kind: enquiry | aftercare
status: new
enquiry:
  [existing validated fields]
  service: allowlisted service or empty
  topic: allowlisted topic key or empty
  topicOrigin: link or empty
  sourceDeclared: allowlisted visitor answer or empty
  marketing: true only with valid email reply + affirmative choice + supported versions
  marketingTextVersion: supported version or empty
  privacyNoticeVersion: supported version or empty
permissions:
  emailMarketing:
    state: granted | not-granted
    receivedAt: same server time as createdAt
    textVersion: supported statement version or empty
    noticeVersion: supported privacy version or empty
    wording: server-owned statement or empty
    source: website-form
```

The staff API includes the same permission object. The `source` value describes this intake contract, not an authentication proof. An external importer must verify where a JSON file came from before treating it as evidence. Browser-supplied properties such as `receivedAt`, arbitrary consent wording and unexpected context fields do not control this record. JSON requests must be objects containing string form-field values; malformed types receive 400.

The prototype still uses private JSON files and a shared staff token. Its notifier has only local/test implementations. Transactional idempotency, an outbox, individual staff authentication, durable hosting, encrypted backups/restore, retention, suppression and a real mail provider are separate work before production API activation. Do not set `PUBLIC_LEAD_API` merely because unit tests pass.

## Verification

- `npm run check` covers allowlisted context, matching/current permission versions, phone-only refusal, aftercare separation, private storage/export, and malformed JSON input.
- `npm run build` followed by `node --experimental-strip-types --test tests/enquiry-context-browser.test.ts` verifies every registered page action, privacy HTML/Markdown projections, actual mobile/desktop form interaction and the reduction of a 4032 × 3024 photograph to 2,400 pixels (HEIC and PDF unchanged). FormSubmit POSTs are intercepted; no synthetic email is delivered.
- `npm run check:analytics` retains on/off fixture behavior and the existing three-event allowlist. This change sends no new enquiry/context/source fields to analytics.
- `node scripts/qa/enquiry-review.mjs` captures the form at 390 and 1440 pixels and checks layout across representative widths. It uses a synthetic example address without submitting the form.

The release review records checks and screenshots separately. A green test does not establish real mailbox delivery, a configured analytics account or production CRM readiness.
