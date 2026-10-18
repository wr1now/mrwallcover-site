# Implementation acceptance — 18 October 2026

This is a source implementation for review, with local verification. It is not a deployed or commercially calibrated estimating service.

| Requirement | Local evidence |
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
| PDF and client sharing | Integer-pence totals, private-field exclusion, expiring/revocable grants, fresh token check for PDF download and fenced worker publication. |
| Studio isolation and resilient processing | Migration exercised with PGlite/Postgres semantics, RLS and broad-policy regression cases; API role/origin/body limits; lease/retry and budget checks. |
| Durable transactional notification path | Disabled-by-default DB/environment gates, verified-member recipient resolution, immutable generic message/key, bounded leases/retries, count/money caps, provider acceptance and separate delivery reconciliation. Offline SQL/Python tests only; provider activation remains pending. |
| Shared design standard and public-page preservation | Responsive captures, native controls, shared footer/buttons, full existing site suite and no-loss comparison. |

## Required before activation

Install the additional hosted CI steps from [ci-workflow.patch](ci-workflow.patch) using a workflow-authorised credential; the connected OAuth credential cannot publish workflow changes. Dedicated checks have passed locally, but the existing hosted workflow does not yet execute all of them.

Provision and verify the selected UK/European private services; configure OTP email, owner identity, upload/worker budgets, backup and retention procedures; load and approve actual package/service rates; then run the staging scenarios in [operations](operations.md). Production stays disabled until those checks and the owner-prepared pricing comparisons pass.

Original historical scopes were reviewed in the private research workspace. They are not a current rate card, and source documents were not imported into this website repository. Private designer contact lists were not imported.

Optional hosted AI and automated storage/retention cleanup are not active implementations. Transactional notifications have an implemented but unconfigured source path; the Resend adapter stays disabled pending sender, budget, staging and US-storage/transfer review described in operations. Native CAD/BIM/programme originals can be kept for review; PDF exports/manual measurements are required where supported extraction is unavailable. A draft JSON download is not a full project archive. These limits must remain explicit during the pilot.
