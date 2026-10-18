# Makers directory — owner review

Based on public main `7d8afe0` (18 October 2026). Independent of open PRs. No merge or deployment is authorised by this change.

## Review scope

Twenty editorial maker profiles and 42 official sourcing links: brand shops, stock information, showrooms, trade enquiries, finder links and sample services. Each profile is written for comparison and specification, not an installer landing page or a claimed ranking of the world's largest companies. Each source has its own 17 or 18 October check date. This is website evidence, not a test order, stock guarantee, brand endorsement or proof of fulfilment.

The Designers Guild sample purchasing route and Zoffany consumer purchasing route are absent from the curated dataset and rendered pages. Designers Guild remains a short brand-information profile with no buying routes. Zoffany has the group trade route only. Individual results from finder links have not been verified and are labelled accordingly. No private research archive, exclusion list, review forms, local notes, unverified leads or original packets are included.

## Publication boundary

`src/data/makers-directory.json` has `publication.approved: false`, with no approving person or date. Normal builds generate no `/makers/` or `/buying-routes/` pages, no links to them and no directory dataset in the browser bundles or public AI projections. `npm run build:review` renders the directory using the existing `MW_CONTENT_PREVIEW` convention. The review build is noindex, has no sitemap and is supplied as the existing CI review artifact. Its server-rendered footer, Guide, search and Where to buy links let the reviewer discover the pages.

Owner approval is a remaining publication condition. After the copy is approved, record the approving person/date, enable the publication flag and move the 22 `draftRoutes` decisions into the published route ledger; then repeat the normal build, names, sitemap, crawler projection and no-loss checks. Do not interpret an AI source check as a completed human sign-off.

## Visual decision

Uses Base, Breadcrumb, Action, Icon and the shared footer. The header and homepage are unchanged. A shared reference navigation joins Makers, Buying routes, the buying checklist and How we check. Search and maker filters enhance fully rendered cards. No JavaScript is needed to read all profiles, routes, source links or native terms disclosures.

Typography, paper surfaces, meaningful route icons and dated sources support close comparison. Product photographs, logos, wallpaper patterns or artificial material textures would imply rights or product evidence not held for this directory; none is added. Static reference presentation follows the shared visual policy rather than loading decorative 3D scenes.

CI uses its existing check:names and check:guides commands to validate the review build and directory boundary; workflow permissions are unchanged.

## Verification

- Source tests and normal/review builds.
- Directory boundary tests: 20 profiles, 42 routes; both excluded purchasing routes absent; no directory output or links in production; noindex and dated citations in review.
- 48 responsive cases across 390, 1024, 1280 and 1440px; each profile at mobile and desktop, no horizontal overflow or browser errors. Search, maker query filters, zero-route brand, shared actions and no-JS terms disclosures checked.
- Existing built-site, typography/contrast, Guide, phone and analytics fixtures; no-loss comparison against a fresh build of the stated main revision.
- Required private-input names scan on production, review and tracked source; the list is never committed or printed.

Local responsive screenshots and machine results are retained outside the committed source tree under `.review-screens/makers/`. Hosted CI and its downloadable review artifact require the branch to be pushed; no hosted result is claimed by this local review.
