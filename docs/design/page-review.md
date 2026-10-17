# Page and template review

Review date: 17 October 2026. This record covers PR #66, including the second pass across all remaining page families. The branch was rebased onto public main 2849676, preserving the separate #67 privacy cleanup; open calculator/reference/Contact PRs were not merged into it. The user authorised completion and publication on 17 October. The route-by-route design decisions are recorded in [route-review.json](route-review.json), including the three noindex utility pages. Final validation results follow below.

## Template inheritance

All normal HTML routes below use `src/layouts/Base.astro`, directly or through their data-driven page. The shared shell supplies the footer, navigation, mobile dock and visual stylesheet. New pages must retain that inheritance. Redirect responses/stubs and machine-readable endpoints are separate cases; do not add visual chrome to JSON, XML or text resources.

| Source/template | Routes or content | Review decision |
| --- | --- | --- |
| `src/pages/index.astro` | `/` | Keep the real hero and finished-room photography; refine stage and enquiry navigation with meaningful icons. Browser reviewed at 390px and 1440px. |
| `src/pages/services.astro` | `/services/` | Break the five stages into readable illustrated sections using site photography and schematic graphics. Browser reviewed at 390px and 1440px. |
| `src/pages/services/[slug].astro` + `LandingBody.astro` | 12 specialisms from `specialisms.json`, with `service-depth.json` | All 12 pages use shared quotation actions, accurately matched lead photographs and linked project evidence cards. Architectural film has an original edge-return schematic. Every original project destination remains available. |
| `src/pages/areas/[slug].astro` + `LandingBody.astro` | Six areas from `areas.json`; index at `/areas/` | All six areas inherit project evidence cards and shared actions. The index uses scannable location cards. Corrected the Chelsea lead image/caption; retained every real local project link. |
| `src/pages/[...page].astro` | Editorial Markdown pages listed below | Maker and heritage pages have relevant, credited project imagery and project evidence cards. Trade/fit-out pages use the shared briefing checklist and download actions. Reviews, image-use terms and specified-paper records stay text-led for accurate close reading. |
| `src/pages/advice/index.astro` + `GuideCard.astro` | `/advice/`, published Guide cards and quantities card | Add consistent purposeful visual anchors; retain filters and publication boundaries. Browser reviewed at 390px and 1440px. |
| `src/pages/advice/[slug].astro` | 12 Markdown guides from `src/content/guides/` | Each of the 12 published guides has an individually selected photograph or explanatory diagram. Added natural-panel variation and tested-build-up schematics; retain exact-product and fire-documentation caveats. Real file downloads use the shared download glyph. |
| `src/pages/advice/quantities.astro` | `/advice/quantities/` | Preserve the existing restricted calculator and its quantity logic. Static roll-cutting and reveal drawings explain the article; any future live diagram must derive from its real result. New calculator features remain a separate publication decision. |
| `src/pages/materials/index.astro` + `MaterialFinder.astro` / `MaterialStudio.astro` | `/materials/` | Retain comparisons, finder and illustrative studio. All prominent controls use Action with native button types/data attributes; shortlist and preset selected states are visually distinct. |
| `src/pages/materials/[slug].astro` | Seven material families from `materials.json` | All seven families now pair their decision guidance with relevant registered installation/material close-ups and honest captions. Preserve the maker-installed record, exact-product caveats and real shortlist behaviour. |
| `src/pages/projects/index.astro` | `/projects/`, including `#hotels` | Retain real project photography, filtering and hotel record. Standardise enquiry arrows and shared action states. |
| `src/pages/projects/[slug].astro` | Published case studies, legacy projects and redirects | Keep all image policies, gallery credits and measured claims. Add consistent labelled glance/method icons and shared quotation actions to the case-study template. Alias/retired routes remain redirects. |
| `src/pages/professionals.astro` + `professionals/[slug].astro` | `/professionals/`, `/professionals/designers/`, `/professionals/developers/`, `/professionals/hotels/` | Audience cards and each profile now use recorded project evidence, meaningful section/checklist icons, shared briefing/download actions and preserved FAQ/audience handoffs. The fit-out and trade routes share the same briefing component. |
| `src/pages/contact.astro` + `EnquiryForm.astro` | `/contact/` | Improve the optional quote checklist with meaningful icons. Preserve submissions, attachments, intent and phone/email preferences. Browser reviewed at 390px and 1440px. |
| `src/pages/aftercare.astro` | `/aftercare/` | Correct the door photograph to an actual finished wallcovering junction; pair it with an inspection schematic and care-family icons. Keep terms and repair form intact; use shared next-step actions. |
| `src/pages/about.astro` | `/about/` | Retain real founder/project photography; add values icons, a programme schematic and a readable timeline. Use a shared closing enquiry action. |
| `src/pages/details.astro` | `/details/` | Keep the existing real seam, corner, edge and join photographs with their captions and project links. This is already a useful evidence-led visual page. |
| `src/pages/faq.astro` | `/faq/` | Deliberately text-led: question-and-answer disclosure provides the hierarchy. No generic illustration is needed. |
| `src/pages/privacy.astro`, `accessibility.astro` | `/privacy/`, `/accessibility/` | Deliberately text-only reading content; clear headings, links and usable controls serve the purpose. Shared footer still applies. |
| `src/pages/for-ai.astro`, `wallcovering-installation-ai-crawler.astro` | `/for-ai/`, `/wallcovering-installation-ai-crawler/` | Keep plain facts and brief-building tools accurate. Use existing shared controls; decorative evidence is unnecessary. |
| `src/pages/search.astro` | `/search/` | Add a search glyph and generous result-row hit areas with directional icons. Keep the live client-side filter. No decorative image competes with finding content. |
| `src/pages/404.astro`, `thank-you.astro` | `/404.html`, `/thank-you/` | Deliberately text-led: concise status, next-step content and shared actions serve these noindex utility pages. |
| `src/pages/*.ts`, `src/pages/ai/*.ts`, `.well-known/facts.json.ts` | Facts, public AI data, feed, `llms.txt`, project JSON and logo endpoint | Machine-readable/asset outputs; no visual redesign. Preserve projection consistency and publication filtering. |

### Editorial routes from the catch-all

The source inventory includes `/services/calico-wallpaper-installer/`, `/services/heritage-listed-buildings/`, `/services/house-of-hackney-wallpaper-installer/`, `/services/timorous-beasties-installer/`, `/professionals/fit-out-contractors/`, `/trade/`, `/reviews/`, `/materials/specified-papers/`, `/image-use/` and `/advice/cost/`. These ten editorial sources have no draft flag in this baseline. The existing draft rule remains authoritative for future content: a new source file alone does not establish publication approval.

- Timorous Beasties: add only a relevant Hyde London City photograph, with its real caption and attribution; retain the no-endorsement explanation.
- Maker, heritage, trade and contractor pages: use relevant existing project evidence when available; clear text and links can remain appropriate without another image.
- Reviews: keep evidence and quotes faithful; a decorative rating badge or invented review graphic would mislead.
- Specified papers: preserve the factual distinction between installed products and maker approval.
- Image use: deliberately text-only because this page explains provenance and reuse terms.
- Installation cost: retain the current survey-based explanation and existing wording. This design pass does not authorise new price bands or unpublished calculator features.

### Technical Guide decisions

| Article family | Visual decision |
| --- | --- |
| Set-out and pattern matching; hand-painted papers and murals | Original, labelled match and panel-sequence schematics clarify an existing technical explanation. |
| Wall preparation | A labelled layer/inspection diagram can explain preparation; avoid implying one universal substrate specification. |
| Quantities | Only show a live cutting plan derived from the existing result. Schematic examples need explicit not-to-scale labels. |
| Grasscloth seams and variation | Use a cleared relevant seam image if available; otherwise retain honest text and linked project evidence. |
| Choosing; designer checklist; hotel specification; developer package | Shared GuideCard icons improve discovery. Keep checklists and tables readable; add diagrams only for a concrete decision. |
| Cost; aftercare; ceilings and staircases | Preserve clear instructions and sources. Shared shell/actions apply; a generic room picture is not required. |
| Hotel fire safety and compliance | Keep sources and product/build-up caveats. A decorative fire or certification badge adds no reliable information. |

## Evidence to complete before delivery

| Check | Status / evidence |
| --- | --- |
| Before/after home, services, Guide, contact, Timorous Beasties at 390px and 1440px | Captured and inspected. Full-page plus footer crops: `.review-screens/` (reproducible with `npm run capture:visual`). Representative footer evidence is committed below. Lazy images are decoded before capture. Off-screen sections are rendered and long pages use instant-scroll viewport tiles to avoid Chrome raster capture artifacts. |
| Overflow and header/menu/dock checks at 360, 768, 1024 and 1280px | Real Chrome test passes for seven representative routes at these widths plus 390/1440; mobile groups collapse and desktop groups expand. |
| Keyboard, focus, disclosures, contrast and reduced effects | Keyboard Enter opens native disclosure; effects preference survives reload; form/menu dock hides. Token contrast checks pass; hero contrast and type-floor browser tests pass on 12 pages at five widths. |
| No-JavaScript footer navigation and article content | Chrome with JavaScript disabled sees expanded server-rendered footer groups and links. Article/diagram content is static HTML/SVG. |
| Form/shortlist/calculator and query-intent regression checks | Existing source/unit/build checks pass; enquiry field focus checked in Chrome. No enquiry was submitted. Quantity algorithm and enquiry submission code were unchanged. |
| Build, repository checks and no-loss comparison | `check`: 84; `check:dist`: 196 plus temporary new-route fixture; `check:type`: 2; `check:phone`: 2; `check:guides`: 5. Production/review builds and case-study date check pass. No-loss passes: 98 pages, 3,609 media files, 98 Markdown twins and JSON-LD node/property counts did not decrease (7,706 baseline nodes). `check:analytics` is absent. The #67 private-list guard is present after rebasing; its five unit tests pass, but `check:names` explicitly reports no configured list and does not scan other firms’ names. This is a skipped scan, not a pass. |
| Representative new route inherits Base/footer/action styling without local CSS | `scripts/check-visual-fixture.mjs` builds a new route in temporary output, verifies shared footer/actions and native/disabled semantics, then removes its source and output. The fixture is not published. |
| Before/after performance on the same representative pages | Local transfer/resource/DOMContentLoaded observations collected for the same five pages at 390/1440, before and after. Images add transfer cost to Services/Guide; they remain lazy, sized and use existing responsive derivatives. See observations below. |

When adding or substantially changing a page, update its family row (or add a route row), state the visual choice and reason, and link the evidence. Do not change a status to passed based only on implementation or historical screenshots.

## Footer evidence

Component crops omit fixed header/dock overlays so the directory itself can be assessed. Captures use the no-phone build; conditional WhatsApp/phone rendering and payload are covered by both phone builds. A separate phone-enabled browser fixture checks six widths, WhatsApp href decoding, field-focus dock hiding and phone reveal without opening a chat or dialling.

| Before, desktop | After, desktop |
| --- | --- |
| ![Old footer](screens/footer-before-1440.jpg) | ![Grouped footer](screens/footer-after-1440.jpg) |

[Mobile before](screens/footer-before-390.jpg) · [Mobile after](screens/footer-after-390.jpg)

## Local performance observations

These are fully visited local-page transfer totals, including decoded below-fold images, recorded by the capture script. Local DOMContentLoaded timings are not a network-throttled performance score or field Core Web Vitals. CLS, LCP, INP and throttled loading were not measured; no Core Web Vitals improvement is claimed. The browser overflow checks passed for every captured route.

| Page | Width | Before transferred | After transferred |
| --- | ---: | ---: | ---: |
| `/` | 390 | 2240 KiB | 2255 KiB |
| `/` | 1440 | 2934 KiB | 2949 KiB |
| `/services/` | 390 | 255 KiB | 413 KiB |
| `/services/` | 1440 | 255 KiB | 678 KiB |
| `/advice/` | 390 | 187 KiB | 274 KiB |
| `/advice/` | 1440 | 187 KiB | 623 KiB |
| `/contact/` | 390 | 204 KiB | 220 KiB |
| `/contact/` | 1440 | 204 KiB | 220 KiB |
| `/services/timorous-beasties-installer/` | 390 | 185 KiB | 217 KiB |
| `/services/timorous-beasties-installer/` | 1440 | 185 KiB | 217 KiB |

The current branch preserves the conditional phone reveal from main. PR #63 removes it from the footer and changes Contact navigation; reconcile those placements when integrating that sibling PR. Future calculator, fire-reference and sourcing pages must inherit the standard when they are published. Shared landing pages support a specific `visualDiagram` and editorial pages support `featureMedia` or `featureDiagram` metadata; new content inherits the shared presentation instead of copying local layouts.


## Completion pass across the remaining pages

All 98 published pages and the three noindex utility pages have a route-level visual decision in [route-review.json](route-review.json). The production browser audit opens each of those 101 pages at 390px and 1440px, checks image loading, horizontal overflow, headings, action height, icon semantics and browser exceptions. Shared boundary-width tests still cover 360, 768, 1024 and 1280px. The CI route ledger check fails when a new normal HTML page has no recorded design decision.

The second pass adds real material evidence beside the seven family decisions, project cards on all service/area/maker templates, individual visuals for all 12 Guide articles, professional audience/briefing layouts, aftercare inspection guidance and practice/story icons. Existing photograph-rich project galleries are retained. Privacy, accessibility, image-use terms, plain facts and FAQ pages stay text-led where a picture would interrupt their purpose. Search and utility pages use clear controls without decorative photography.

Production audit artifacts are locally reproducible with `MW_VISUAL_AUDIT_OUTPUT=.review-screens/all-routes npm run check:dist`. The screenshot option captures a representative evidence region per route; full before/after captures for the additional page families are in `.review-screens/pass1-*` and `complete-*`. `pass1` is PR #66 before the remaining-family pass. The earlier `before-*` captures compare with deployed main. The local before/after viewer is `.review-screens/review.html`.

The interaction review exercised shortlist persistence and enquiry handoff, finder recommendations/reset/session restore, professional audience/intent, calculator submit/match/room/add-wall/refusal states and search results/empty state. No enquiry was submitted and no call or chat was opened. A caught Action wrapper defect is fixed: explicit native submit/reset types render once, and the temporary future-page fixture now exercises actual native submit/reset events. Care icon choices remain presentation metadata so they do not leak into the public factual data projections. Meaningful stage-link labels preserve homepage links in its Markdown twin.

Local verification passed: 84 source tests, 196 built-site tests plus the new-page/native-form/phone browser fixture, 2 typography/hero-contrast tests, both phone builds, 5 guide-boundary tests and 5 names-guard unit tests. Production and review builds, case-study dates and no-loss pass. The hosted workflow must also pass at the final PR head before publication. Separate draft feature PRs #61–65 are outside this release.


### Remaining-family evidence

| Material page, before | Material page, after |
| --- | --- |
| ![Silk page before](screens/material-before-1440.jpg) | ![Silk material evidence and controls](screens/material-after-1440.jpg) |

[Professional page before, mobile](screens/professional-before-390.jpg) · [Professional page after, mobile](screens/professional-after-390.jpg)

### Completion-pass local transfer observations

The same eight routes were fully visited before/after at 390px and 1440px. These totals include all lazy images decoded for evidence capture; they are local transfer measurements, not field performance or Core Web Vitals. Added photography remains responsive, dimensioned and lazy. No new client graphics library was introduced.

| Route | Width | Before | After |
| --- | ---: | ---: | ---: |
| `/services/grasscloth-installation/` | 390 | 162 KiB | 176 KiB |
| `/services/grasscloth-installation/` | 1440 | 161 KiB | 176 KiB |
| `/materials/silk-and-textiles/` | 390 | 192 KiB | 203 KiB |
| `/materials/silk-and-textiles/` | 1440 | 192 KiB | 219 KiB |
| `/areas/mayfair/` | 390 | 225 KiB | 275 KiB |
| `/areas/mayfair/` | 1440 | 225 KiB | 275 KiB |
| `/professionals/designers/` | 390 | 162 KiB | 174 KiB |
| `/professionals/designers/` | 1440 | 161 KiB | 174 KiB |
| `/advice/designer-specification-checklist/` | 390 | 166 KiB | 168 KiB |
| `/advice/designer-specification-checklist/` | 1440 | 174 KiB | 181 KiB |
| `/about/` | 390 | 493 KiB | 495 KiB |
| `/about/` | 1440 | 513 KiB | 515 KiB |
| `/faq/` | 390 | 161 KiB | 163 KiB |
| `/faq/` | 1440 | 161 KiB | 163 KiB |
| `/projects/browns-hotel-mayfair/` | 390 | 975 KiB | 977 KiB |
| `/projects/browns-hotel-mayfair/` | 1440 | 1098 KiB | 1100 KiB |


### Right-hand question illustrations

The shared buyer-question, Guide and FAQ templates now place a relevant framed topic drawing on the right of every question. Buyer answers remain open, as requested; native FAQ disclosures keep their behaviour. Explicit mappings cover current question IDs and unnumbered Guide questions, with topic matching for new entries. Cost, quantities, measuring, timing, care, privacy and evidence use different relevant drawings. Evidence/approval questions use neutral document imagery rather than badges. The all-route browser check verifies that each drawing stays to the right at both widths, and the factual FAQ/schema tests retain exact questions and answers.


[Question block before](screens/questions-before-1440.jpg) · [After with relevant right-hand drawings](screens/questions-after-1440.jpg) · [After on mobile](screens/questions-after-390.jpg)

The additional question review covered standard, buyer, Guide and home FAQ layouts at390/1440 (56 question instances). Every drawing remained to the right, buyer answers stayed open and there was no overflow. All196 built-site checks and both typography/contrast checks passed after the question treatment; a final build and64 focused shared-system/FAQ checks passed after the scenic-panel glyph refinement.
