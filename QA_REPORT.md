# MR WALLCOVER Atelier — QA report

Verified 2026-10-10T19:01:52+00:00. macOS; Node v25.8.0; repository requires Node >=22.12.0. Branch `codex/mrwallcover-atelier-2026`, integrating origin/main `1b387c6`. Chrome browser checks used production output on localhost:4329, with representative earlier development checks on :4328.

## Results

| Check actually run | Result |
| --- | --- |
| Sites dependency setup / npm installation | Completed; dependency audit found 0 vulnerabilities |
| `npm run check` | 61 passed, 0 failed |
| Sites `build-site.mjs` (production build + AI postbuild) | 75 pages built; 68 published Markdown twins and llms-full generated |
| `npm run check:dist` | 50 passed, 0 failed |
| `npm run check:phone` | 2 passed; both no-phone and reserved-test-number builds |
| `npm run build:review` and `npm run check:guides` | Review build succeeds; 4 guide/publication-boundary tests passed |
| `node scripts/stamp-case-study-dates.mjs --check` | Case-study dates match Git |
| `npm audit --audit-level=moderate` | 0 vulnerabilities |
| `git diff --check` | Clean |

Total: **117 automated tests passed**. Source checks include 8 studio lifecycle tests and 6 project explorer tests. Distribution checks include 8 AI source/parity checks, all local page links/downloads/fragments, media existence, structured discovery and draft/privacy boundaries. No standalone lint or static typecheck command is configured; these were not claimed as passed. The review build intentionally excludes pages from search; its sitemap plugin reports no indexable pages, while the production sitemap checks pass.

## Browser and visual proof

- Desktop 1440×1000: original-photo homepage and AI resource inspected. Homepage and AI page had no horizontal document overflow. Real hero image loaded at the expected 1440px derivative. No production-origin console warning/error recorded in the inspected tab.
- Mobile 390×844 and compact 320×640, with the user's enlarged 24px root font: inspected homepage and AI page. At 320px homepage width equalled scroll width (320); hero actions ended at y472, above the dock at y538. Corrected a discovered header overflow and action overlap.
- Mobile menu opened with focus on the first link. Escape closed it and returned focus to the toggle.
- Project filters showed 7 Hotels, 4 Homes & heritage, 5 Retail & design and 16 All projects; URL selection and reset were verified. Server-rendered cards remain available without JavaScript (source/behavior tests).
- Enquiry `intent=source` selected the correct option. Submitting the empty form displayed name/reply/note errors locally. No test enquiry or personal data was sent.
- Material studio opened with rendered controls, switched to grasscloth, closed to the photograph, and reopened with default controls. Failure, pending-close cancellation, resource/listener cleanup and reset behavior have separate regression tests.
- AI page links and full decision data were checked against the built output; native disclosure content is server-rendered and available to crawlers without JavaScript. The comparison table scrolls within its container on narrow screens.

Review screenshots are saved outside the repository under the current Codex visualization folder as `mrwallcover-home.jpg` and `mrwallcover-ai-crawler.jpg`.

## Source and claim review

A separate source review checked shortlist claims, materials, delivery and aftercare against the repository. Material-service cross-links now explicitly avoid implying unproven product use. A residential example of exterior work was replaced by a relevant wallcovering commission. External hotel, manufacturer and photo links are contextual unless they explicitly substantiate the installation role. No insurance, accreditation, review score, availability or price was fabricated.

A final live Git refresh found the owner’s correction: **in the trade since 2012**. Main through `1b387c6` was integrated, the generated business JSON confirmed 2012, and all listed tests were rerun after integration.

## Readiness and limits

Implementation passed the documented QA and was published owner-private through Sites; native deployment status is succeeded. Published source: `e606392129bf732adcc0b134a690a65fdd27b90c`. The new version preserves public-domain canonicals but does not itself make the content publicly discoverable. Publication status and version are recorded by the Sites deployment receipt and the plan's release entry.

At the owner-private publication checkpoint, public www.mrwallcover.com, DNS and GitHub main had not yet changed. The authorised public release below supersedes that checkpoint. FormSubmit delivery is the existing integration and was not exercised with a live lead. The Sites build has no SITE_PHONE configured. No independent external corroboration of company-reported installation roles, insurer checks, cross-engine browser matrix, Lighthouse score or field Core Web Vitals result is claimed. Existing third-party image permissions are inherited; newly added large photography is from the owner's Brown’s Hotel originals.


## Public release and live QA — 10 October 2026

- PR #23 merged at 19:28:46 UTC as `90fccd184fb96a49ace2635d80ff176ea824cbaf`. GitHub Pages workflow [38079955213](https://github.com/wr1now/mrwallcover-site/actions/runs/38079955213) built and deployed successfully.
- Actual public HTTPS requests returned 200 for `/`, `/contact/`, `/thank-you/`, `/wallcovering-installation-ai-crawler/`, the three `/ai/*.json` endpoints, the crawler Markdown twin, `/llms.txt`, `/robots.txt` and `/sitemap-0.xml`. The project dataset contains 16 published projects; structured data version is 1.1. Fourteen directly linked homepage media/CSS assets returned 200. HTTP redirects to HTTPS.
- Homepage, contact and crawler canonicals use the public domain and are indexable. The thank-you page remains noindex.
- Live desktop menu navigation reaches the enhanced crawler resource and contact form. Inspected console logs contain no warning/error. The Brown’s finished-bedroom hero and large selected-project photographs remain intact, as expressly requested by the owner.
- Live QA exposed a confirmation reference hidden by a CSS class, a missing reply-method error anchor, and missing attachment size/type/count feedback. The follow-up fixes these and recovers the submit control after browser back navigation from the provider. A narrow desktop rule keeps hero text/buttons inside the photograph at 2880px with enlarged 24px root text; photographic content is unchanged.
- Follow-up production preview browser checks: empty submit is prevented, field errors appear, the reply-method error link resolves, malformed email is rejected, email/phone fields switch correctly, and all four optional brief steps can be reached. No data was submitted. At 390px document width equals scroll width; at 2880px hero actions end at y630 above the footer at y770. No inspected console warnings/errors.
- Automated attachment cases cover eight/nine files, exact 10 MB and one-byte excess, retained private API limits, supported/unsupported MIME-extension pairs, empty files and malformed sizes. Actual file-picker selection could not be exercised because Chrome’s extension has file-URL access disabled; no permission settings were changed. Native provider CAPTCHA and inbox delivery are not verified, and no synthetic lead was sent.
- Follow-up validation: source 70/70, built output 50/50, phone builds 2/2, guide boundaries 4/4 passed (126 tests). Final source/build/distribution/review/guide checks and Git date/whitespace checks passed after the brief-button refinement. Production build produced 75 pages and 68 Markdown twins. The follow-up is now merged and deployed; the receipt below records post-deployment checks. Existing lazy-loaded 3D chunk exceeds the build warning threshold; it is not loaded on the initial homepage. No configured standalone typecheck/lint.


### Final public verdict

**Deployed, with the stated verification limits.** Corrective PR #25 merged as `1970b5a98705cb35a58f52c2dc80ebc24a206fa9`; [production run 38080570164](https://github.com/wr1now/mrwallcover-site/actions/runs/38080570164) completed successfully. At 19:39:36 UTC the 11 public routes in `docs/live-release-qa-2026-10-10.json` returned 200. Delivered contact HTML confirms the 10 MB guidance, error anchor, enabled CAPTCHA and correct public thank-you return URL. The thank-you receipt uses the script-controlled hidden attribute.

The deployed form was exercised in Chrome: hotel/source query prefill, empty submission errors, reply-method error destination, invalid-email rejection, email/phone switching, all four brief steps, disabled first-step Back and hidden final-step Continue. These checks stayed on the site and sent no enquiry. No warnings/errors were found in the inspected browser logs. Live homepage and AI resource were inspected at desktop and 390px phone widths with no document overflow; the mobile menu and crawler navigation worked. Brown’s bedroom hero and large project photographs remain in place.

Live AI screenshot: `mrwallcover-live-ai-crawler.jpg` in the Codex visualization folder. The subsequent homepage screenshot attempt hit a browser-tool timeout; a fresh normal-view tab recovered successfully and `mrwallcover-live-home.jpg` was saved. It visibly confirms the Brown’s bedroom hero and photographic design on the public website. Attachment picker, CAPTCHA completion and email delivery retain the limits documented above. The temporary local preview server was stopped.

The successful workflow reports a non-blocking deprecation notice for older GitHub action runtimes and an upcoming runner-image change. No unrelated workflow upgrade was mixed into this release.
