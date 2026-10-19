# Room Studio private services

The browser editor works locally. Cloud saving, photo projects, standalone Stripe checkout, refund recovery, live plan analysis and finished
rendering are implemented here but **disabled and undeployed**. No account,
credential, model request or paid processing has been provisioned by this change.
Production activation is an explicit later operation. The public website remains
on GitHub Pages; it cannot host the private API or workers.

## Components and contracts

- `src/room-studio/cloud.ts` provides a dependency-free Supabase Auth/Edge REST
  client. `createCloudClient()` exposes `enabled`, `session`, email OTP sign-in,
  capabilities, project CRUD/export, revocable authenticated uploads, immutable confirmation,
  historical revision reads/portable exports, asynchronous job submission/status
  and five-minute asset links. Nothing reads a
  service or model key in browser code. Sessions live in tab-local sessionStorage.
- `supabase/functions/room-studio/index.ts` verifies the access token against Auth
  and requires a verified non-anonymous email. It then performs short actions,
  validates the shared room model and checks ownership for every asset/revision.
  Finish artwork is uploaded privately; data URLs never enter database snapshots.
  Repeated saves reuse ready artwork with the same owner, project, MIME, byte
  count and checksum after freshly checking the stored file. Missing objects
  fall back to a new immutable upload; corrupt objects fail the integrity check.
  Local originals remain embedded for offline editing, without a permanent
  upload-path cache or permission to overwrite an existing object.
  Imported projects and saved combinations use the same closed, bounded schema;
  source links must use the official Bauwerk UK HTTPS product route. Unknown
  metadata, remote artwork URLs, invalid timestamps and malformed nested schemes
  are rejected before database writes.
- `supabase/migrations/` contains the executable base and commerce/photo schema:
  private owner reads through RLS; writes only through the Edge service; immutable
  revisions; atomic project/storage/job allowances and global budget reservations.
  Security-definer functions are revoked from PUBLIC/anon/authenticated.
- `workers/room_studio/modal_app.py` claims durable database jobs with fencing
  tokens and a 15-minute lease. Each execution has a 660-second container timeout,
  a 600-second Blender subprocess timeout and at most two total attempts. The
  scheduled dispatcher does not call a model or renderer inside an Edge request.
- `workers/room_studio/import_plan.py` extracts a selected PDF page/room crop or
  raster crop, pdfplumber text/lines, OpenCV segments and PaddleOCR when needed.
  One structured vision proposal and at most one repair are checked for finite,
  bounded geometry, crossing walls, opening extents and evidence-grounded scale.
  Printed metric or feet/inches units must be explicit for automatic scale;
  the complete label must appear in extracted text and both reference endpoints
  stay inside the crop.
  Missing scale never silently becomes metres. Unknown ceiling height uses an
  invalid zero marker until the customer enters its measured value. Floor-plan
  openings lack measured head/sill/reveal evidence, so they are omitted with a
  separate instruction for each detected opening to add its measured dimensions.
  No plausible door/window sizes are manufactured. A source ceiling height must
  match an explicit height label and dimension. Imperial values are converted
  to millimetres before geometry validation. Imported rooms always
  remain unconfirmed until the customer checks them.

The checkout Edge action compiles the approved immutable `RoomRevision` using the
same `compileRoom` TypeScript function as the browser. It stores the resulting
mesh/UV/material/camera package with its SHA-256. The worker downloads only assets
registered to that owner/project, verifies checksums, strips image metadata and
passes the package to Blender 4.5.0. It never accepts remote texture URLs or derives
a second room geometry. The renderer returns two 1920×1080 stills and one
4096×2048 panorama. No image-generation rewrite is part of this pipeline.
Only finishes assigned in the confirmed active combination enter that package;
unused library items and historical saved combinations do not add render assets.

Completed render results resolve `job.revisionId` through an owned immutable
revision read. Their finish summary uses that snapshot, and the editable room
download embeds its historical artwork. Neither operation reads the current
mutable draft or changes the optimistic save head. The API checks project
availability and filters revisions by owner, project and revision ID; the client
also checks the returned identity before exposing either companion download.

A cloud project has database revision zero until its first confirmed snapshot.
The API accepts that draft head explicitly; the browser keeps it separately for
optimistic saves and opens/exports the editable draft at local revision one.
Confirmed snapshots always retain matching positive project/revision numbers.

## Default limits and cost controls

| Resource | Limit |
| --- | --- |
| Active saved projects | 5 per verified account |
| Saved finish combinations | 3 per room; each has up to 48 finishes and 96 wall bands |
| Uploaded file | 20 MiB; PNG/JPEG/WebP, or PDF for a plan |
| Image decoding | 25 megapixels |
| PDF | Up to 200 pages; only the selected page and normalized room crop are rendered |
| Project assets, including outputs | 100 MiB |
| Plan analyses | 2 accepted distinct requests per account per UTC day |
| Finished render packages | Purchased per confirmed design; no free daily render entitlement |
| Pending checkout or queued/running processing | 1 per account |
| Complete output storage hold | 60 MiB (three maximum 20 MiB output files) |
| Queued/running jobs | 1 per account |
| Attempts | 2 total per job, including automatic recovery after a lost lease |
| Signed download URL | 300 seconds |
| Inactive project retention | 90 days, followed by the notice rule below |

Analysis identity includes the project, source checksum, selected page/crop and
extractor version. Two analyses per UTC day remains independent of purchased
renders. Render identity is the **order ID**, not the revision ID: duplicate
payment notifications return one job, while a refunded failed revision may be
purchased again. Both the legacy Edge action and legacy database enqueue function
refuse unpaid render submissions. Existing paid results remain downloadable
without another purchase during project retention.

Paid-job settings default to false and all monetary fields default to NULL.
Set a positive monthly cap **and** a conservative worst-case reservation per job
before enabling paid work. Each reservation must cover both attempts, GPU/CPU
time and model tokens at the configured providers' current prices. The database
atomically rejects reservations exceeding the monthly cap. Once execution starts,
the whole reservation is conservatively committed even on failure; cancellation
before execution refunds it. This ledger is a processing ceiling, not an invoice
or a promise of the providers' total monthly bill. Storage, email, database and
idle/scheduled infrastructure costs need their own provider spending controls.

The application cannot manufacture a safe monetary cap on the owner's behalf.
An unset cap must keep paid jobs disabled. Live AI additionally requires its own
explicit database **and** Edge/worker flags; having a model key is insufficient.

## Standalone checkout and recovery

`commerce.ts` uses Stripe-hosted Checkout over the fixed Stripe HTTPS API. Both
TypeScript and Python requests pin **2026-09-30.endive**, verified against the
[official version documentation](https://docs.stripe.com/api/versioning) on
19 October 2026. It accepts cards only, fixes quantity to one, uses the frozen GBP
total with inclusive pricing and never accepts client-provided prices or discounts.
An approved, versioned tax profile chooses Stripe automatic tax or merchant-managed
inclusive tax. Neither tax setup nor merchant status has been selected or verified;
the NULL profile blocks activation. Merchant-managed mode requires the owner to
configure its receipts/invoicing appropriately before approving that profile.

Activation requires **all** database values: `checkout_enabled=true`,
`paid_jobs_enabled=true`, positive `render_price_pence`, `monthly_cap_pence`,
`render_reservation_pence`, `operating_allowance_pence`, and an approved `tax_profile`
with mode, Stripe tax code and version. Edge also requires
`ROOM_STUDIO_CHECKOUT_ENABLED=true`, `ROOM_STUDIO_PAYMENT_PIPELINE_VERIFIED=true`,
server-only `ROOM_STUDIO_STRIPE_SECRET_KEY` and `ROOM_STUDIO_STRIPE_WEBHOOK_SECRET`.
Test keys are accepted; live keys additionally require
`ROOM_STUDIO_PAYMENTS_LIVE_ENABLED=true`. Every setting remains unset/off here.
The pipeline-verified switch is an operator attestation after real staging checks,
not a claim that offline tests have verified a deployed webhook.

A service-only transaction reserves worst-case compute and 60 MiB output capacity
before taking payment. The initial handshake hold lasts 31 minutes. The requested
Stripe expiry is frozen at 30 minutes plus ten seconds of clock/network safety
above Stripe's minimum; binding the session aligns the persisted hold exactly with
the returned Stripe expiry. Retries use identical order-specific idempotency
parameters. Expiry releases both holds. A late paid notification either reserves
current capacity afresh or records a full-refund obligation. New source uploads
cannot consume capacity held for a paid package. Output writes transfer bytes
from the hold into registered private assets; incomplete-output cleanup restores
capacity for the bounded worker retry. Each cleanup atomically fences publication
before deleting object bytes, then releases the registry reservation. Killed
attempts are cleaned before retry; maintenance reaps terminal orphans. Delivered
outputs cannot enter cleanup, including after a lost success response. Successful
publication verifies three ready job-owned output paths and hashes again in SQL.

`room-studio-payments` has `verify_jwt=false` so Stripe can reach it; it authenticates
with the **untouched request-body HMAC**, a five-minute timestamp window and the
webhook secret. Create its Stripe endpoint using the same pinned API version.
It retrieves the session from Stripe before checking paid status, order/owner,
revision, package hash, exact total and currency. No customer redirect fulfils an
order. Duplicate/out-of-order completion events cannot create another job.
A bounded scheduled reconciler also retrieves unsettled sessions to recover a
missed webhook, even while new checkout is disabled. Expired worker leases are
reconciled independently of the new-work switch. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`
and `checkout.session.expired`. Only the server may transition payment state.

Unstarted cancellation and terminal failure enter refund recovery. The worker
atomically claims refunds with fencing tokens, submits full refunds using stable
idempotency keys and checks provider identity, amount and currency. Pending refunds
are polled; failed refunds retain an explicit retry/attention state. An explicitly
failed provider refund receives a new idempotency generation. This maintenance
continues while new checkout/processing is disabled. Ensure its Stripe recovery
key and schedule remain configured until outstanding refunds are resolved.
Cancellation racing with claim is serialized: once an attempt has started, it
records a support request and keeps the worker valid. Compute already consumed
stays committed even when the customer is refunded.

Paid order specifications have a database immutability trigger. Private project
sources can be deleted after all work/refunds finish; minimal order/payment records
remain separate from the 90-day project lifecycle. Deleting an Auth account directly
is intentionally blocked while its accounting records remain; operations must use
an approved account/record retention procedure rather than cascading financial data.

## Photo projects and catalogue versions

`PhotoProject` is a separate closed document stored in `room_projects` with
`document_kind=photo`, sharing the same five-project account quota. Source images
use private `room-photo` assets, artwork uses `artwork`, and bounded erase/restore
strokes live in the private snapshot. Photo saves use optimistic revision heads;
portable export hydrates the source and every current/saved-comparison texture.
Room and photo actions reject the other document kind. No photo document can be
submitted to the measured-room renderer.

Room documents accept immutable v1 files and editable v2 contracts. Panel sets
upload/hydrate every image, retaining original SHA-256 and 0.1 mm calibration.
The server resolves approved catalogue versions and rejects edited manufacturer
claims; approved selections upload exact versioned bytes into project-owned storage.
Finite-artwork coverage is checked again at confirmation and checkout. Insufficient
source resolution remains an explicit quality warning; output resolution is not a
claim of extra source detail. Supplier studies are not an approved catalogue.

## Deployment preparation

1. Create a separate Supabase environment, apply both migrations and configure Auth
   email verification. Use an OTP email template containing `{{ .Token }}` because
   the client completes sign-in with the email and code. Allow only approved site
   redirect/origin URLs. The public site URL is `/room-studio/`.
2. Deploy `room-studio` with JWT verification enabled and the separately signed
   `room-studio-payments` endpoint with JWT verification disabled. Its runtime
   provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   Set `ROOM_STUDIO_ALLOWED_ORIGINS` to exact comma-separated origins. Keep
   `ROOM_STUDIO_CLOUD_ENABLED=false` and `ROOM_STUDIO_LIVE_AI_ENABLED=false` until
   environment-specific verification is complete.
3. Public build configuration accepts only
   `PUBLIC_ROOM_STUDIO_CLOUD_ENABLED`, `PUBLIC_ROOM_STUDIO_SUPABASE_URL` and
   `PUBLIC_ROOM_STUDIO_SUPABASE_ANON_KEY`. These are public connection values, never
   service credentials. Enabling cloud saving does not enable paid jobs or AI.
4. Build/deploy the Modal app only when authorised. The worker image installs the
   pinned requirements (including Modal 1.6.2) and official Blender 4.5.0, checking
   its pinned SHA-256 before extraction. PaddleOCR weights must be warmed
   and the pinned OCR dependency combination smoke-tested in that image before a
   customer job. This repository has not downloaded those weights or run Modal.
5. Supply worker-only values in a Modal secret named `mrwallcover-room-studio`:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ROOM_STUDIO_CLOUD_ENABLED`, `ROOM_STUDIO_PAID_JOBS_ENABLED` and
   `ROOM_STUDIO_LIVE_AI_ENABLED`. Keep the two processing flags false. When plan
   analysis is separately activated, it also requires `ROOM_STUDIO_VISION_MODEL`
   and `ROOM_STUDIO_VISION_API_KEY` for the fixed OpenAI Responses HTTPS endpoint
   using strict JSON schema and `store: false`. No key
   setup or API invocation is part of this implementation.
6. Configure approved expiry emails using `ROOM_STUDIO_NOTICE_FROM` and
   `ROOM_STUDIO_NOTICE_TOKEN` in the worker only. These send through the fixed
   Resend endpoint. Never send test emails to real customers during verification.
7. In a staging account, verify the private bucket, authenticated upload RLS and response shape,
   Auth email delivery, CORS, two-account isolation, disabled switches, actual
   worker image compatibility and full output lifecycle before enabling anything
   for customers. Start with non-customer fixture artwork and a fixed small budget.

Use normal Supabase migration/Edge and Modal deployment tooling. Do not place
customer room files in this public repository, Pages output, logs or AI crawler
datasets. The private research archive and exclusion lists remain separate.

## Expiry, export, deletion and operations

Saving or confirming extends inactivity expiry by 90 days and invalidates old
expiry notices. Seven days before expiry, the daily maintenance job prepares an
email notice. Automatic deletion occurs only after a notice has been delivered
at least seven days earlier. If notification credentials or delivery are missing,
expiry deletion is postponed; operators must resolve notice delivery rather than
silently purge rooms. The cloud UI also receives the expiry timestamp.

Export includes embedded wallpaper artwork for the current project, every saved
scheme and each revision, deduplicating private downloads in memory. The editable
export remains usable after signed links expire; private storage paths are removed
from its embedded textures. An asset manifest retains temporary private links to
the original plans and finished outputs, which should be downloaded separately
while those links are valid. Explicit delete first tombstones the project,
cancels/fences its work and collects registered storage paths. It deletes storage
before removing database rows. Failed deletion leaves a tombstone for the daily
maintenance retry. Workers cannot publish after their lease is cancelled and
clean up their own incomplete output files. Delete projects before administratively
deleting an Auth account so its private storage remains discoverable for cleanup.

Monitor old queued jobs, exhausted leases, failed outputs, failed expiry notices,
budget reservations/commits, expired checkout holds, failed/pending refunds and private storage growth. Do not log upload bodies,
access tokens, signed URLs, model prompts or room images. Service errors shown to
customers omit provider credentials and raw model responses. Keep cloud/model
switches off during an incident; local editing/export remains available.

## Verification recorded for this change

`node --experimental-strip-types --test tests/room-studio-processing.test.ts`
executes the real SQL in an isolated PGlite PostgreSQL engine, plus offline request
guards/client and Python proposal tests. It checks owner isolation and denied
privileged RPC access, project limits, immutable confirmation/deduplication, paid order identity, shared photo quotas, one
active job, analysis allowances, global budget reservation/release, hard-kill output reclamation, worker lease
fencing, two-attempt retry bounds and advance-notice retention. It also proves the
disabled client/model gates make no network call and rejects missing/false scale,
crossed polygons, unsupported files, unsafe asset paths and escaping crops.

These tests do not constitute deployed Supabase/RLS/storage, email, OCR-model,
Modal GPU or live vision-provider verification. Those services are deliberately
unconfigured. Live AI remains disabled.

Historical revision API tests additionally check owner/project isolation, portable
artwork and unchanged optimistic save heads. The offline browser results suite
downloads actual files from the real results component after editing the current
draft, proving that its room/finish companions still identify the rendered version.
The [worker preparation review](review/worker-dependencies.md) records Linux
dependency resolution, the isolated SDK definition check and archive integrity;
it does not replace the pending real worker-image smoke test.

`python3 workers/room_studio/test_import_plan.py` generates original temporary
schematic PDFs and a PNG. Twelve fixture tests passed using the bundled Python
runtime: actual metric/vector PDF extraction and preview, a rotated metric sheet,
unknown height, absent scale, grounded imperial labels converted to millimetres, selected
room crop excluding a neighbouring room, explicit ceiling evidence and omitted
unmeasured openings, full scale-token/reference bounds, UK grouped millimetres,
a 201-page rejection and an honest raster dependency failure. Only the selected
page is rendered in a supported plan set.
This runtime has pdfplumber/Pillow/numpy/reportlab/pypdfium2, but lacks OpenCV and
PaddleOCR; it uses the implemented vector fallback and does not claim raster OCR
accuracy or model extraction accuracy. The deployed worker requirements include
those packages, whose pinned image and model weights still need staging checks.

Protocol references: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
and [Supabase authenticated uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads).


Four additional local asset tests run the actual pure image-normalization boundary
without importing Modal. They check unchanged PNG pixels, EXIF orientation and
metadata removal, rejection of dimensions that differ from the approved revision,
and animated-PNG rejection. Run `python3 workers/room_studio/test_asset_normalization.py`
with Pillow installed. No provider object or paid service is initialized.

Commerce verification adds `tests/room-studio-commerce.test.ts`, executing **all**
migrations in PGlite and using signed offline provider fixtures for the actual
Stripe boundary/webhook handler. It covers fail-closed settings, frozen pricing,
legacy entitlement denial, duplicate payments, late payment admission/refund,
cancellation versus claim, failure accounting, refund fencing, repurchase of a
failed revision, output-capacity recovery and cross-account RLS. These are offline
protocol/transaction tests. No Stripe test-mode checkout, deployed webhook, staging
Supabase or Modal service has been called or provisioned.

Upload preparation returns a standard authenticated Storage POST destination,
not an irrevocable signed-upload token. The bucket retains its hard 20 MiB file
limit. A non-exposed `room_studio_private.upload_allowed` function verifies
`auth.uid()`, exact registered path, customer-upload kind, pending state, active
owned project and two-hour admission window. It locks the asset/project rows for
the Storage insert, serializing abort/delete against completion. Only authenticated
INSERT is permitted; restrictive guards protect this bucket even if an unrelated
bucket has a broad permissive policy. Ready files cannot be overwritten; customer
SELECT/UPDATE/DELETE is blocked and downloads still use five-minute signed links.
Unverified pending/cancelled uploads reserve a full 20 MiB each, regardless of
claimed size, until successful checksum verification or object/registry cleanup.
This bounds actual storage while a malicious/mistaken declared size is checked.
Staging must still verify the current hosted Storage protocol and concurrent
abort/delete interleavings; local policy tests are not a hosted concurrency test.
