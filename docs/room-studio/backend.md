# Room Studio private services

The browser editor works locally. Cloud saving, live plan analysis and finished
rendering are implemented here but **disabled and undeployed**. No account,
credential, model request or paid processing has been provisioned by this change.
Production activation is an explicit later operation. The public website remains
on GitHub Pages; it cannot host the private API or workers.

## Components and contracts

- `src/room-studio/cloud.ts` provides a dependency-free Supabase Auth/Edge REST
  client. `createCloudClient()` exposes `enabled`, `session`, email OTP sign-in,
  capabilities, project CRUD/export, private uploads, immutable confirmation,
  asynchronous job submission/status and five-minute asset links. Nothing reads a
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
- `supabase/migrations/202610180001_room_studio.sql` is the executable schema:
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

The render Edge action compiles the approved immutable `RoomRevision` using the
same `compileRoom` TypeScript function as the browser. It stores the resulting
mesh/UV/material/camera package with its SHA-256. The worker downloads only assets
registered to that owner/project, verifies checksums, strips image metadata and
passes the package to Blender 4.5.0. It never accepts remote texture URLs or derives
a second room geometry. The renderer returns two 1920×1080 stills and one
4096×2048 panorama. No image-generation rewrite is part of this pipeline.
Only finishes assigned in the confirmed active combination enter that package;
unused library items and historical saved combinations do not add render assets.

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
| Finished render packages | 1 accepted distinct request per account per UTC day |
| Queued/running jobs | 1 per account |
| Attempts | 2 total per job, including automatic recovery after a lost lease |
| Signed download URL | 300 seconds |
| Inactive project retention | 90 days, followed by the notice rule below |

Exact duplicates return the original job without using another allowance. Render
identity is the approved revision ID; analysis identity includes project, file
checksum, selected page/crop and extractor version. A failed request that was
accepted still consumes its daily allowance; bounded worker retries use the same
job. These limits are enforced transactionally, not just by disabled UI buttons.

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

## Deployment preparation

1. Create a separate Supabase environment, apply the migration and configure Auth
   email verification. Use an OTP email template containing `{{ .Token }}` because
   the client completes sign-in with the email and code. Allow only approved site
   redirect/origin URLs. The public site URL is `/room-studio/`.
2. Deploy the `room-studio` Edge function with JWT verification enabled. Its runtime
   provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   Set `ROOM_STUDIO_ALLOWED_ORIGINS` to exact comma-separated origins. Keep
   `ROOM_STUDIO_CLOUD_ENABLED=false` and `ROOM_STUDIO_LIVE_AI_ENABLED=false` until
   environment-specific verification is complete.
3. Public build configuration accepts only
   `PUBLIC_ROOM_STUDIO_CLOUD_ENABLED`, `PUBLIC_ROOM_STUDIO_SUPABASE_URL` and
   `PUBLIC_ROOM_STUDIO_SUPABASE_ANON_KEY`. These are public connection values, never
   service credentials. Enabling cloud saving does not enable paid jobs or AI.
4. Build/deploy the Modal app only when authorised. The worker image installs the
   pinned requirements and official Blender 4.5.0. PaddleOCR weights must be warmed
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
7. In a staging account, verify the private bucket, signed upload response shape,
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
budget reservations/commits and private storage growth. Do not log upload bodies,
access tokens, signed URLs, model prompts or room images. Service errors shown to
customers omit provider credentials and raw model responses. Keep cloud/model
switches off during an incident; local editing/export remains available.

## Verification recorded for this change

`node --experimental-strip-types --test tests/room-studio-processing.test.ts`
executes the real SQL in an isolated PGlite PostgreSQL engine, plus offline request
guards/client and Python proposal tests. It checks owner isolation and denied
privileged RPC access, project limits, immutable confirmation/deduplication, one
active job, daily allowances, global budget reservation/refund, worker lease
fencing, two-attempt retry bounds and advance-notice retention. It also proves the
disabled client/model gates make no network call and rejects missing/false scale,
crossed polygons, unsupported files, unsafe asset paths and escaping crops.

These tests do not constitute deployed Supabase/RLS/storage, email, OCR-model,
Modal GPU or live vision-provider verification. Those services are deliberately
unconfigured. Live AI remains disabled.

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
and [Supabase signed uploads](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).


Four additional local asset tests run the actual pure image-normalization boundary
without importing Modal. They check unchanged PNG pixels, EXIF orientation and
metadata removal, rejection of dimensions that differ from the approved revision,
and animated-PNG rejection. Run `python3 workers/room_studio/test_asset_normalization.py`
with Pillow installed. No provider object or paid service is initialized.
