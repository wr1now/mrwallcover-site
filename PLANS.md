# MR WALLCOVER — Atelier redesign

Date: 10 October 2026. Owner: current Codex chat. Branch: `codex/mrwallcover-atelier-2026`.

## Objective and expanded brief

Create a complete, elegant Sites edition of MR WALLCOVER using the real WR1 website, its verified project history and genuine photographs. Put the grandeur of hotel interiors first, make the specialist installation service immediately understandable, and give customers a straightforward enquiry journey. Make published information equally accessible to humans, search engines and AI assistants through a clearly named Wallcovering Installation AI Crawler resource and structured data.

## Constraints and assumptions

- Baseline is `f83b60c`, the top of the existing #19/#20/#21 fix stack, isolated from all existing worktrees. At the initial audit public main was `5cb4fa1`. Final refresh found #19–#22 merged: main `1b387c6` is now integrated, including the 2012 trade-start correction.
- Preserve existing case studies, services, material guidance, forms, source records, phone privacy, draft exclusions and legal pages.
- Real site photography only; retain image credits and distinguish contextual venue photography from installation evidence.
- New Sites publication is private by default. Domain/DNS and public main are separate release surfaces and remain under their existing configuration.
- No fabricated endorsements, awards, prices, metrics or AI ranking guarantees. AI resources use the same facts visitors can read.
- Existing contact provider is retained; no test leads are sent to the business inbox.

## Milestones, acceptance and status

1. **Audit and source selection — complete.** Inspect live site, Git state, pending changes and asset provenance. Evidence: live HTTPS 200; repository/stack identified; current AI files exist; local originals located.
2. **Core design and AI resource — complete.** Create a visually distinct hotel-led homepage, coherent navigation and a crawler resource with structured services/projects. Preserve all existing published routes and functional enquiry paths.
3. **Benchmark cycle 1 — complete.** Compare installation competitors; close obvious presentation/service discovery gaps. Test and commit.
4. **Benchmark cycle 2 — complete.** Compare premium design portfolios; add a focused differentiated browsing improvement. Test and commit.
5. **Benchmark cycle 3 — complete.** Compare authoritative crawler/accessibility guidance; harden discoverability and market readiness. Test and commit.
6. **Final QA and owner-private publication — complete.** Run source, build, distribution, responsive/browser and accessibility checks; inspect rendered desktop/mobile; record exact results in QA_REPORT.md. Push branch and exact Sites source, publish private Site, verify returned deployment status.

## Ordered work and ownership

Parent owns homepage, shared design/navigation, hosting configuration, integration, commits and publication. Independent agents inspect repository facts and photography; bounded AI implementation and review are assigned after the plan exists. No agent modifies the existing site-* worktrees.

## Likely files

`src/pages/index.astro`, `src/components/Header.astro`, `src/components/Hero.astro`, `src/content/home.json`, `src/content/navigation.json`, `src/styles/atelier.css`, `src/layouts/Base.astro`, crawler page/data generators/tests, `.openai/hosting.json`, README, ROADMAP, BENCHMARK and QA_REPORT.

## Commands and validation

Use Sites dependency/build/package helpers; repository commands `npm run check`, `npm run build`, `npm run check:dist`, `npm run check:guides`, `npm run check:phone`. Inspect existing typecheck/lint availability. Test semantic headings, links, mobile navigation/focus, project filters, enquiry validation without transmission, reduced motion, image sizes and overflow. Validate crawler records against source, no drafts/private data. Run npm audit and record relevant findings.

## Rollback

Changes live on an isolated branch with the full baseline history. Prior local work and public deployment are untouched. Revert scoped commits or restore a prior saved Sites version if necessary; no destructive history rewrite.

## Blockers and proof log

- No implementation blocker. Instagram public profile inspected; individual posts hit the login gate. Genuine Brown’s originals were found locally and used.
- 10 October: found existing responsive fixes and substantive AI layer; chose to extend these rather than discard them.
- 10 October: private Site registered once; project ID retained in `.openai/hosting.json`. Publication pending final checks.

## 10 October — expanded owner direction and integration proof

The owner requested a substantially richer AI decision resource. Acceptance now includes evidence-backed reasons to shortlist, project-fit scenarios, material decisions, complete delivery and aftercare terms, an unsent structured enquiry brief, and source fidelity across HTML and JSON. All implemented. Source review caught and corrected material cross-links that could imply unproven material use; parent replaced an exterior-only residential example with a relevant wallcovering commission.

- Core source checks: 55/55 passed; production checks: 48/48 passed (including 8 enhanced AI assertions).
- Phone-on/off build tests: 2/2 passed. Editorial review build and guide checks: 4/4 passed.
- Dependency audit: 0 vulnerabilities. Whitespace check clean.
- Browser: mobile menu opens with focus, Escape closes; project filters produce 7 hotel / 4 home / 5 retail-design / 16 all; enquiry query prefill and empty-submit validation confirmed without sending a lead.
- Material studio: real browser opens, changes family, closes and reopens; 8 regression tests cover failure and cleanup.
- Narrow 320px layout at enlarged 24px root text revealed header overflow; corrected. Final screenshots pending.
- Next: finish cycle-2 checks/commit, machine-discovery refinement for cycle 3, final browser QA and private publication.

- Cycle 1 committed as `abeb10d`. Cycle 2: 6 focused filter/classification tests passed; production build included all 16 projects; browser filter counts and reset verified.

- Cycle 2 committed as `8552c0b`. Final Git refresh found main had advanced to `1b387c6`; merged the latest source, resolving one home.json formatting conflict in favour of the corrected 2012 fact. New describedby links and whole-site local link/fragment checks added for cycle 3.

- Final refreshed gates: source 61/61, production 50/50, phone 2/2, guides 4/4 (117 total). Production 75 pages and 68 Markdown twins. QA_REPORT.md records browser evidence and limits. All three benchmark cycles implemented and tested. Next: commit release refinement, push exact source, publish owner-private Site, then preserve release receipt.

## Release receipt — 10 October 2026

- Cycle 3 / source integration committed as `e606392129bf732adcc0b134a690a65fdd27b90c`.
- Exact source pushed to GitHub branch `codex/mrwallcover-atelier-2026` and the registered Sites source repository.
- Sites archive helper completed and owner-private publication returned **succeeded**.
- Published source: `e606392129bf732adcc0b134a690a65fdd27b90c`.
- Site: https://mr-wallcover-atelier.dorinburcus.chatgpt.site
- AI resource: https://mr-wallcover-atelier.dorinburcus.chatgpt.site/wallcovering-installation-ai-crawler/
- Deployment: `appgdep_6aca8bd88b4481919e8321e711cf5434`.
- Saved version: `appgprj_6aca85d3e31881919def66e8160e0fbe~appgver_bae9421c75f881918ad5a3fb6ab29afa`.
- Draft review PR: https://github.com/wr1now/mrwallcover-site/pull/23, targeting current main.
- Native successful deployment is the remote publication evidence. Local rendered production review is documented in QA_REPORT.md. This receipt is a documentation-only follow-up to the published source.
- No unblocked implementation work remains in this bounded release. Public-domain publication and additional documentary procurement claims are separate future decisions, not claimed complete here.

## Public-domain release — authorised 10 October 2026

Owner direction: merge PR #23 and verify the homepage, AI crawler and enquiry form on www.mrwallcover.com.

1. Confirm the exact PR head, clean checkout, main compatibility and CI. Acceptance: mergeable head with required checks passed. **Complete:** head `dddcb5a`, mergeable, build passed.
2. Mark the existing PR ready and merge it without a history rewrite. Follow the main-branch Pages workflow. Acceptance: merge recorded and matching production deployment succeeds. **Complete:** PR #23 merged as `90fccd184fb96a49ace2635d80ff176ea824cbaf`; production workflow `38079955213` succeeded.
3. Check HTTPS, homepage assets/navigation, crawler HTML/JSON/Markdown and enquiry browser behavior on the actual public domain. Acceptance: routes and assets resolve, desktop/mobile layouts work, form prefill and validation work, intended provider/return URLs correct. No synthetic lead will be sent; inbox delivery remains unverified unless separately exercised. **Complete within the documented limits:** live routes, desktop/mobile navigation and invalid-input behavior verified; no external enquiry submission made.
4. Record release proof and QA results. Preserve the private Sites edition and existing DNS. Rollback: revert the merge if a critical production defect cannot be safely fixed forward. **Complete:** release and QA records updated; private Sites edition and DNS unchanged.

Commands: gh pr ready/merge, gh run view/watch, Git fetch/status, live HTTP reads and Chrome interactions. Files: PLANS.md and QA_REPORT.md only unless live verification reveals a defect. No new paid services or credentials are needed.

Live QA identified a hidden confirmation-reference line, a missing reply-method error destination, and missing client-side attachment limits. A scoped follow-up branch `codex/mrwallcover-live-form-checks` corrects these, preserves existing private API limits, restores submit after browser back navigation and caps oversized hero text only on ultra-wide screens. The owner reaffirmed that the photographic hotel homepage must remain intact; all homepage photographs and sections are preserved. Focused enquiry regression tests: 18 passed. Next: full build/checks, browser checks, merge follow-up and verify live deployment.

Follow-up release gate: 70 source + 50 built-output + 2 phone + 4 guide tests pass (126 total), production/review builds succeed, case-study dates and whitespace pass. Added a tested fix for first/final-step controls. README and QA_REPORT.md document provider limits and real verification boundaries. Next: push scoped follow-up, require CI, merge, confirm deployment and recheck live form/photographic homepage.


### Public release receipt — 2026-10-10 19:39 UTC

- PR #23 merged and deployed, followed by corrective PR #25: https://github.com/wr1now/mrwallcover-site/pull/25.
- Follow-up implementation `08f2d6474408c123ddab9bbf10a88c3f1cad8cf0`; merge `1970b5a98705cb35a58f52c2dc80ebc24a206fa9`.
- Matching production workflow https://github.com/wr1now/mrwallcover-site/actions/runs/38080570164 succeeded, including build and deployment.
- Post-deployment HTTP receipt: `docs/live-release-qa-2026-10-10.json`. All 11 target routes returned 200; updated attachment help, reply error target, CAPTCHA configuration and production return URL confirmed in delivered HTML.
- Public browser: hotel/source prefill, invalid email, reply method, all four optional steps and corrected boundary controls verified; no inspected console warnings/errors. Mobile homepage and AI resource have no horizontal document overflow at 390px; mobile menu opens and reaches the AI page. The AI comparison table scrolls inside its own container.
- Hotel homepage photographs and all existing sections retained. Browser capture was briefly interrupted by a tool timeout, then recovered in a fresh normal-view tab. The live homepage screenshot `mrwallcover-live-home.jpg` and AI screenshot `mrwallcover-live-ai-crawler.jpg` were saved in the Codex visualization folder; the public homepage was left open.
- Known limits: Chrome prevented automated attachment selection because extension file-URL access is disabled; validator tests passed. No CAPTCHA completion or delivery to the business inbox was attempted.
- Temporary production preview server stopped. The bounded public release is complete; email delivery and native picker testing remain explicitly unverified checks, not false passes.
