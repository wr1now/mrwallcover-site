# Implementation and verification

Prepared 9 October 2026. Changes are on PR #14, based on the repository's existing Astro/Tailwind implementation. Production deployment has not been performed.

Reconciled with `main` at `0c85c86932f2e8e72082edc1fd59d35856ea26b8`, including the shared fact sheet, founder schema, case-study dates, separate draft maker/trade pages, build-time phone configuration and homepage heading adjustment.

## Implemented

- Ten single-source Markdown guides under `src/content/guides/`, with an advice hub, topic filters, article contents, related guidance, material links and relevant calls to action.
- Separate editorial review output: `npm run build:review` includes drafts, marks every page noindex and omits a sitemap. Normal production builds exclude unpublished guides from routes, site search, sitemap and the public text summary.
- Three professional pages: `/professionals/designers/`, `/professionals/developers/` and `/professionals/hotels/`. Existing `/professionals/` and its designer/commercial anchors remain useful.
- Professional enquiries open the full brief and retain the selected audience. Programme, supply responsibilities and specification notes reach the existing lead API. Existing general commercial enquiries remain supported.
- Two blank CSV planning templates for material specification and room/phase coordination.
- A material finder covering room use, appearance, cleaning, natural panel expectations and light. It explains comparison choices; wet positions require product review. All seven material families now have decision guidance and relevant article links.
- Material choices shown on the enquiry form, with a removal control. They stay in browser session storage until submitted or cleared. The existing shortlist has a clear action and handles storage failure without throwing.
- Navigation, internal search, relevant material pages and the optional text summary connected to the guide publication state. No additional search plugin or training crawler permission was required.

## Validation

Executed locally:

- `npm run check`: 38 passing tests, including existing content/privacy guards and new material-selection and professional storage checks.
- `npm run build` and `npm run check:dist`: production build completed; eight built-site checks passed.
- `npm run check:phone`: both builds passed, with and without a reserved test phone number.
- `npm run build:review` and `npm run check:guides`: review build completed; three checks passed for publication boundaries, complete draft rendering and local route/download targets.
- Browser scenarios covered guide filters, keyboard skip navigation, material comparison, saved shortlist and preferences, three professional form payloads, wet-position review, reset/clear controls, CSV download and article readability with JavaScript disabled.
- Browser layout checks at widths 390, 768, 1024 and 1440 on advice, article, materials, professional and contact pages: no horizontal overflow and no page JavaScript errors in the checked journeys.
- Screenshots were inspected at desktop and mobile sizes. See [review evidence](review/).

The browser transport test intercepted FormSubmit locally. It sent no external customer enquiry. API integration tests used a temporary store and a failed notifier to verify that enquiry details survive a notification failure. These tests do not prove production email delivery.

## Reproduce

```bash
npm ci
npm run check
npm run build
npm run check:dist
npm run check:phone
npm run build:review
npm run check:guides
```

The optional `scripts/check-content-browser.cjs` runs against its own local static server and writes screenshots and a result file into `docs/content/review/`. Supply Playwright through your verification environment (`MW_PLAYWRIGHT_MODULE` can point to that installed package). `MW_CHROMIUM_EXECUTABLE` can point to an available Chromium executable. Otherwise Playwright's default browser is used. The repository runtime does not require Playwright.

## Boundaries still to resolve

- On 9 October 2026 the nine articles were rewritten to the section 27.6 standard and published under Dorin Burcus's byline as founder, with that date as published and updated. The installation cost guide publishes without price bands; the bands and worked examples stay in the draft `src/content/pages/cost-guide-2026.md` as TODO(Dorin) until approved, then move into the guide. Guide 4 is the `/advice/quantities/` calculator page. Dorin should read the published guides and change anything that does not reflect his practice; the PR is the review gate.
- Production still uses the existing FormSubmit path. The private lead API exists but is not a deployed email service. Live notification delivery and hosting remain separate operational checks.
- Requests from this environment to the live robots.txt, sitemap and advice page returned 502 responses. That is a retrieval limitation, not a diagnosis that the website is down or blocks OpenAI. Source permits public crawling and already configures a sitemap and Search Console verification.
- The material finder operates at family level. Exact product dimensions, stock, cleaning and performance claims require verified product data before a product catalogue is added.
- The existing on-demand Three.js bundle still produces a build size warning. The production test confirms it is not loaded in the initial homepage scripts.

## Release and rollback

Review the PR's content and evidence. Production publishes only when the approved work reaches `main`. Keep review output separate from `dist/`. Revert the merge to roll back the site; no DNS or mail configuration change is part of this work.
