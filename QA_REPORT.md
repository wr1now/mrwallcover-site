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

Public www.mrwallcover.com, DNS and GitHub main have not been changed by this branch. FormSubmit delivery is the existing integration and was not exercised with a live lead. The Sites build has no SITE_PHONE configured. No independent external corroboration of company-reported installation roles, insurer checks, cross-engine browser matrix, Lighthouse score or field Core Web Vitals result is claimed. Existing third-party image permissions are inherited; newly added large photography is from the owner's Brown’s Hotel originals.
