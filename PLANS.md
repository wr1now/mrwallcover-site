# MR WALLCOVER — Atelier redesign

Date: 10 October 2026. Owner: current Codex chat. Branch: `codex/mrwallcover-atelier-2026`.

## Objective and expanded brief

Create a complete, elegant Sites edition of MR WALLCOVER using the real WR1 website, its verified project history and genuine photographs. Put the grandeur of hotel interiors first, make the specialist installation service immediately understandable, and give customers a straightforward enquiry journey. Make published information equally accessible to humans, search engines and AI assistants through a clearly named Wallcovering Installation AI Crawler resource and structured data.

## Constraints and assumptions

- Baseline is `f83b60c`, the top of the existing #19/#20/#21 fix stack, isolated from all existing worktrees. Public main is `5cb4fa1`; pending fixes are not described as deployed.
- Preserve existing case studies, services, material guidance, forms, source records, phone privacy, draft exclusions and legal pages.
- Real site photography only; retain image credits and distinguish contextual venue photography from installation evidence.
- New Sites publication is private by default. Domain/DNS and public main are separate release surfaces and remain under their existing configuration.
- No fabricated endorsements, awards, prices, metrics or AI ranking guarantees. AI resources use the same facts visitors can read.
- Existing contact provider is retained; no test leads are sent to the business inbox.

## Milestones, acceptance and status

1. **Audit and source selection — complete.** Inspect live site, Git state, pending changes and asset provenance. Evidence: live HTTPS 200; repository/stack identified; current AI files exist; local originals located.
2. **Core design and AI resource — complete.** Create a visually distinct hotel-led homepage, coherent navigation and a crawler resource with structured services/projects. Preserve all existing published routes and functional enquiry paths.
3. **Benchmark cycle 1 — complete.** Compare installation competitors; close obvious presentation/service discovery gaps. Test and commit.
4. **Benchmark cycle 2 — implementation complete, validation in progress.** Compare premium design portfolios; add a focused differentiated browsing improvement. Test and commit.
5. **Benchmark cycle 3 — pending.** Compare authoritative crawler/accessibility guidance; harden discoverability and market readiness. Test and commit.
6. **Final QA and publication — pending.** Run source, build, distribution, responsive/browser and accessibility checks; inspect rendered desktop/mobile; record exact results in QA_REPORT.md. Push branch and exact Sites source, publish private Site, verify returned deployment status.

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
