# Implementation and staging verification — 19 October 2026

The implementation has passed local checks and a deployed private staging exercise with synthetic projects and documents. Production remains disabled, and commercial calibration is incomplete. Synthetic Auth sessions used for testing do not prove email-code delivery or real owner approval of prices.

| Requirement | Verification evidence |
| --- | --- |
| Separate paper, coated paper, vinyl, standard fabric, pile and 3D product handling | Pricing tests resolve distinct profiles and reject incompatible/unknown constructions; a textile backing cannot select a fabric-face rate. |
| One appropriate profile for overlapping specialist descriptions | Exact verified product-to-profile mapping; no stacked percentage premiums. |
| Small projects priced as bounded packages | Labour hours, hourly rate, setup and service allowances; aggregated once per room; zero/missing prices and exceeded bounds cannot issue. |
| Contract vinyl eligibility | Project approval, commercial area-pricing permission and prepared-wall verification. |
| Client-supplied materials | No supply-goods lines; material ordering quantity/waste separate from net installation area. |
| High-value surveying/management | Approved project time and additional-service checks; private value never determines a percentage or appears in the share. |
| Actual London logistics | Deduplicated vehicle/date/scheme, explicit parking allowances, scoped deliveries/storage and effective tariff windows. No installation-day parking multiplier. |
| Changed specification invalidates pricing | Revision checks and bound technical assumptions, including product instructions, geometry, programme and logistics. Issued snapshots remain immutable. |
| Incomplete scope gives actionable next steps | Preview returns specific reasons; only ready assessments issue or share. Browser check exercises this through the signed-in UI with synthetic responses. |
| Private documents and source evidence | Quarantine, bounded signature/parser/antivirus checks, version chains, source citations and explicit revision-bound confirmation. |
| PDF and client sharing | Local integer-pence, privacy and publication-fencing checks; deployed synthetic issue/idempotency, parsed PDF totals, anonymous share/PDF and revoked read/PDF rejection. Known-past expiry remains a separate acceptance gate. |
| Studio isolation and resilient processing | Migration exercised with PGlite/Postgres semantics, RLS and broad-policy regression cases; API role/origin/body limits; lease/retry and budget checks. |
| Durable transactional notification path | Disabled-by-default DB/environment gates, verified-member recipient resolution, immutable generic message/key, bounded leases/retries, count/money caps, provider acceptance and separate delivery reconciliation. Offline SQL/Python tests only; provider activation remains pending. |
| Ceiling, readiness and project resources | Typed measured ceilings, explicit incomplete geometry, material ordering/readiness and editable resource lists. API tests reject foreign/unverified resource document references. |
| Historical structure without old-price activation | Private preparation verifies original hashes and cited cells; import validation preserves selling/cost/alternative/unpriced roles. Six reviewed historical scope records and 27 old amount observations were imported privately into staging. No selling rates were imported or activated. Original documents, provenance and import receipts remain private. |
| Actual work and current-price pilot tooling | Staff completion/correction records, owner-only reviews and independent pilot comparison UI. Database, domain and intercepted browser checks prove the mechanism; no real current-price pilot is asserted. |
| Shared design standard and public-page preservation | Responsive captures, native controls, shared footer/buttons, full existing site suite and no-loss comparison. |

## Deployed synthetic staging evidence

The bounded API/Storage/worker harness completed six automated checks with 77 requests. It verified two private document revisions and their hashes/downloads, cited extraction remaining unconfirmed until an explicit source check, ready-estimate issuance/idempotency, independently calculated PDF totals, private-field exclusion, anonymous client sharing and revoked read/PDF rejection. All four processing jobs succeeded on their first attempt, and their temporary worker apps stopped afterward. The harness honestly retained `automatedStatus: pass` with overall `status: manual` and a nonzero exit because manual acceptance gates remained.

A separate bounded recovery test caused a real provider timeout after a synthetic verification job claimed its lease. The lease expired naturally; a fresh claim received a new token, and an otherwise valid completion using the old token was rejected without changing the current job or document. The actual antivirus-backed worker then succeeded on attempt two, cleared the lease and settled its reservation. Both temporary apps were confirmed stopped. This demonstrates one timeout/lease-fencing/recovery path; it does not establish every failure or retry-exhaustion scenario, or alter the original harness's manual status.

A separate Playwright journey used an existing synthetic studio-owner session in memory. Only the two Auth bootstrap responses were intercepted; session, catalogue and project reads used the real deployed API. All six workspace sections were inspected at desktop and phone widths, with no saving, uploading, issuing, sharing or signing out. Private-route metadata, empty browser storage, no analytics and studio-only administration boundaries held. Its context was closed to discard the in-memory session. This is authenticated UI/API evidence, not an OTP delivery test.

The isolated staging service ran in London, with UK worker execution and European routing reviewed separately. The actual scanner image passed benign/EICAR and missing-scanner/database error checks. Upload/worker switches were restored to false and processing budgets cleared after the exercise; notifications and recurring schedules remained off. Temporary QA administrative access was removed, with no active processing jobs or client shares remaining. No customer project or source document was used in the processing tests. QA service-plan allowances and synthetic administrative approval do not establish a current commercial rate card.

## Required before activation

The additional pricing/database, Python-worker and portal browser CI steps are now installed in [the branch workflow](../../.github/workflows/pages.yml). The connected GitHub App accepted the update on 19 October 2026 without an authentication or permission change. Hosted verification is pending: check every added step on the current pull-request head before treating this gate as complete. Local passes do not establish hosted execution.

Complete real new/returning-user email-code delivery and invalid/expired/reused-code checks; known-past share expiry; provider region/budget review; broader worker-failure/retry-exhaustion coverage; backup/restore, retention and abandoned-upload cleanup. Every worker replacement requires reviewed disabled deployment, runtime probing and bounded scan verification, recorded in private environment receipts. Load and approve current package/product/service rates and complete independent owner-prepared current-price pilots. Production stays disabled until the relevant [operations](operations.md) gates pass.

The [staging runner](staging-verification.md) retains reproducible private API/Storage/PDF/share checks and explicit manual gates. Its offline adapter tests exercise orchestration only; an unconfigured run exits unsuccessfully. The actual synthetic run above does not turn unresolved manual gates into a full acceptance pass.

Original historical scopes were reviewed in the private research workspace. They are not a current rate card, and source documents were not imported into this website repository. Private designer contact lists were not imported.

Optional hosted AI and automated storage/retention cleanup are not active implementations. Transactional notifications remain disabled pending sender, budget, delivery and US-storage/transfer review described in operations. Native CAD/BIM/programme originals can be kept for review; PDF exports/manual measurements are required where supported extraction is unavailable. A draft JSON download is not a full project archive. These limits must remain explicit during the pilot.
