# Deployed staging verification

`scripts/qa/designer-staging.mjs` exercises the deployed private API, signed private Storage, document workers, estimate PDF worker and client grants. Offline adapter tests verify the harness protocol and failure handling. They do **not** establish that any cloud service is deployed, configured or working.

Current source delivery has no verified staging credentials or live acceptance receipt. A missing configuration produces `unconfigured`, makes no network request and exits nonzero. Keep the portal's activation gates in [operations](operations.md).

## Prepare an isolated staging environment

An operator must prepare these resources outside the harness. It never provisions an account, creates an Auth user, requests an OTP, changes memberships, enables workers, approves prices or sends a notification.

1. Use a separate Supabase project explicitly in London `eu-west-2`. Record its project reference and every production project reference. Inspect the actual platform region rather than relying on a project label. Where no production backend has been provisioned, explicitly declare `NONE_PROVISIONED` instead of omitting the production guard.
2. Apply the portal migrations and deploy the Edge Function from the source under review. Deploy the pinned UK Modal worker and European routing. Record source revision, deployment identifiers, scanner definition age and worker settings privately. Source-only tests do not verify a deployed image.
3. Supply four existing, independently verified synthetic Auth sessions: studio A owner, studio B member, studio A viewer and a Mr Wallcover business owner. The four accounts must be distinct and use `synthetic-…@….invalid` test identities. Their access tokens are provided privately. The harness verifies the resulting server session and memberships; it does not decode a JWT to grant itself privileges.
4. Confirm A and B have separate studios, A has owner access to studio A and the viewer has only viewer access there. A, B and viewer must have no business staff role. Bootstrap the synthetic business owner's separate owner role only after checking its verified Auth identity, using the existing owner setup in [operations](operations.md). Studio ownership alone must not approve prices.
5. Through the owner interface, approve the **current staging** profile/package and service inputs needed for one representative synthetic ready project. Do not import old totals as current prices. Set measured upload/worker budgets and provider billing controls before enabling staging processing. The harness requires processing to be enabled already and never changes those settings.
6. Keep transactional notifications disabled throughout this run. The harness checks the saved disabled setting before creating resources and before issuing the budget. Run without concurrent configuration changes. It does not call any Auth/OTP/email sending endpoint; separate owner-controlled notification delivery verification remains a manual gate.
7. Save and review a synthetic ready project in studio A. Its name must begin `SYNTHETIC QA `, its address line 1 and contact name must begin `SYNTHETIC`, and its contact email must end `.invalid`. Use measured synthetic room geometry, a known eligible profile, a confirmed programme/material assessment and an owner-approved service plan. An optional private £30m property context provides a useful high-value surveying/management privacy case; do not use a customer address, plan, quote or contact. Calculate the expected gross total independently using current owner prices and record it in whole pence.
8. Install `pypdf` in the selected local Python runtime for PDF inspection. `DESIGNER_STAGING_PYTHON` can name that interpreter. Missing PDF tooling leaves the PDF total/privacy check manual and non-successful; a `%PDF-` signature is insufficient evidence.

The ready-project approval is intentionally prepared beforehand. The runner can create a separate incomplete project, upload unmistakably synthetic generated PDFs and issue against the already approved ready scope. It cannot silently approve its own rates or project agreement to force a pass.

## Private configuration and execution

Load configuration from an uncommitted private environment file; do not paste tokens into chat, source, a command argument, screenshots or receipts. Never provide the service-role key to this harness. It uses a public API key and the supplied user bearer sessions.

| Variable | Meaning |
| --- | --- |
| `DESIGNER_STAGING_CONFIRM` | Exactly `RUN_SYNTHETIC_STAGING_ONLY`. |
| `DESIGNER_STAGING_ORIGIN` | Exact `https://<project-ref>.supabase.co` origin, with no path, query, fragment or embedded credentials. |
| `DESIGNER_STAGING_PROJECT_REF` | Exact 20-character lowercase Supabase project reference, matching the origin. |
| `DESIGNER_STAGING_PRODUCTION_REFS` | Comma-separated production references which must not match staging, or explicit `NONE_PROVISIONED`. |
| `DESIGNER_STAGING_ANON_KEY` | Staging public API key. |
| `DESIGNER_STAGING_USER_A_TOKEN` | Existing verified synthetic studio A owner's access token. |
| `DESIGNER_STAGING_USER_B_TOKEN` | Existing verified synthetic studio B member's access token. |
| `DESIGNER_STAGING_VIEWER_TOKEN` | Existing verified synthetic studio A viewer's access token. |
| `DESIGNER_STAGING_OWNER_TOKEN` | Existing verified synthetic Mr Wallcover business owner's access token. |
| `DESIGNER_STAGING_STUDIO_A_ID`, `DESIGNER_STAGING_STUDIO_B_ID` | Separate prepared studio UUIDs. |
| `DESIGNER_STAGING_READY_PROJECT_ID` | Prepared synthetic ready project UUID. |
| `DESIGNER_STAGING_EXPECTED_TOTAL_PENCE` | Independently owner-prepared current gross total, positive integer pence. |
| `DESIGNER_STAGING_PYTHON` | Optional Python executable with `pypdf`; defaults to `python3`. |
| `DESIGNER_STAGING_RECEIPT_PATH` | Optional private output path for the JSON receipt; created with restrictive permissions. Keep outside the repository. |
| `DESIGNER_STAGING_EXPIRED_SHARE_TOKEN`, `DESIGNER_STAGING_EXPIRED_SHARE_ID` | Optional known, unrevoked, already-expired synthetic grant and its private token. Both are needed for the real expiry check. |

Run from the repository root after loading the private environment:

```bash
node scripts/qa/designer-staging.mjs
```

No token refresh or interactive sign-in occurs. Renew expired test sessions through the approved staging account procedure outside this script. Never substitute a production session or disable verification to make a run pass.

The JSON receipt contains synthetic resource identifiers, check statuses, request count and duration. It excludes bearer keys, Auth emails, signed URLs, share tokens, source bytes, property values and raw server/provider error messages. Keep receipts private nevertheless. Review the source revision alongside the receipt; a run against a previous deployment cannot verify a new change.

## What the automated protocol proves

- Four distinct synthetic verified actors, expected roles, separate studio membership, an existing synthetic ready scope, saved disabled notifications and enabled bounded processing.
- Rejection of a deliberately unlisted Origin; cross-studio project access and uploads; anonymous document access; viewer mutations; and an ordinary studio owner's pricing-administration request.
- A saved incomplete project, successful revision increment, stale-revision rejection, incomplete preview without a gross total and refusal to issue it.
- Two real signed private Storage upload revisions, source SHA-256/download byte equality, retained supersession, deployed verification and extraction, cited unconfirmed evidence and explicit source confirmation.
- A real ready preview matching the independently supplied total, idempotent issuance, durable PDF completion, snapshot arithmetic and parsed labelled PDF subtotal/VAT/gross amounts. Selected synthetic contact/document/property-value canaries must be absent from client output.
- A selected-estimate client projection, matching shared PDF, bounded expiry and immediate rejection of both client endpoints after revocation.

Every Storage URL must stay on the declared staging origin; redirects and foreign signed destinations are rejected. Generated source PDFs contain only a synthetic private canary, with no customer data, executable content, drawing scale or inferred dimensions.

Requests time out after 15 seconds. Read actions may retry a transient request once; mutations are not automatically replayed. Worker observations are bounded to 45 polls per operation by default, within an overall ceiling of 180 requests and ten minutes. A timeout, exhausted budget, failed worker, unexpected response or missing evidence cannot produce a pass. The receipt retains created synthetic project/document/estimate/share IDs for operator reconciliation. It does not delete project records or change retention policy. Following a failed run, revoke any listed outstanding synthetic shares and reconcile abandoned reservations through the verified staff workflow before rerunning repeatedly.

## Real expiry and manual evidence

The API's shortest client-link lifetime is one day. Prepare a synthetic client grant at least one day before the expiry run, retaining its token privately. Supply its ID and token. The runner checks that the declared grant appears in the prepared project's records, is unrevoked and has a past expiry, then verifies both client endpoints reject the supplied token. The token-to-record binding is deliberately absent from the client API. An operator must verify that binding against the original private issue receipt or stored token hash; this part remains manual. A made-up token or an ordinary revoked link is not proof of expiry. The harness provides no clock override or SQL expiry backdoor.

These checks remain manual and must have separately inspected deployment evidence:

- London database/storage placement, UK execution/European routing and provider data handling; configured prices, processing budgets and billing controls.
- Worker interruption/reclaim, maximum attempts, stale-output fencing and measured cost accounting; hostile/malformed source and scanner-failure handling under deployed limits.
- Representative current-owner comparisons for each installation profile, small package, high-value service assessment, contract approval and actual vehicle/logistics arrangement.
- Multi-page PDF presentation, backups and restore, retention/deletion, abandoned uploads, and separate transactional notification acceptance/delivery verification using owner-controlled recipients.

## Receipt and exit semantics

| Status | Exit | Meaning |
| --- | --- | --- |
| `unconfigured` | `2` | Required private staging inputs are absent; no request or write occurred. |
| `fail` | `1` | A guard, protocol, worker observation or output check failed. |
| `manual` | `2` | Automated checks may have passed, but explicit required acceptance evidence remains unverified. Inspect `automatedStatus` and each check. |
| `pass` | `0` | No failed or unverified check remains within the receipt's declared scope. The current bounded harness deliberately reports the operational/manual gates, so a normal successful protocol run remains `manual`. |

`automatedStatus: "pass"` is not a claim that the complete portal is ready for production. Review all manual evidence, approved prices and publication blockers separately. Do not replace these statuses with success merely to satisfy CI.

Run offline harness verification with:

```bash
node --experimental-strip-types --test tests/designer-staging-harness.test.ts
```

The stateful HTTP adapter tests exercise the production runner's actual action envelopes, headers, signed byte transfers, worker polling, output checks, retries, role errors and request ceilings. They use synthetic responses and never contact a deployed service.
