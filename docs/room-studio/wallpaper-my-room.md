# Wallpaper my room — delivery record

Implemented on the Room Studio branch after integrating public main's concise homepage and shared design on 19 October 2026. The route remains `/room-studio/`. The owner subsequently requested full menu access: all eleven destinations now appear in the two-row desktop header and mobile menu, with a separate Start your project action. The Materials hub and shared footer also link to the studio.

## Customer journeys

- **Photo:** upload an orientation-corrected photograph, mark up to six wall planes, protect openings/furniture with erase/restore strokes, select or upload finishes, calibrate, compare, save locally and export a PNG. Perspective and original repeat coordinates share one deterministic compositor for preview/export. Shading uses a bounded low-frequency luminance field. Both wall dimensions and an accepted artwork proof are required for a physical-scale label. Export never exceeds source detail or 4096 pixels on its longest edge. Normalized photographs and PNG exports do not retain location metadata.
- **Measured room:** existing inside-face geometry/openings and tracing remain. Customers can apply a finish to selected walls or the whole room; upload finite numbered panels; select illustrative material presets; position camera/aim points; inspect source-detail/coverage warnings; confirm and download the exact revision. Panel runs consume the full wall length across openings and returns. Uncovered regions stay neutral and block confirmation.
- **Finished rendering:** an immutable order purchases two 1920 × 1080 stills, one 4096 × 2048 panorama and the editable specification. Live checkout remains disabled. Browser previews and local exports require neither registration nor payment.

The original Willow, Ochre and Indigo examples remain actual rendered, calibrated technical illustrations, not manufacturer installations. Four original versioned catalogue records include the three example patterns and the geometric test pattern. de Gournay, Phillip Jeffries and Arte studies remain private; no supplier artwork is approved for the public catalogue by this change.

## Compatibility and data boundaries

Editable room documents now use schema 2. V1 files remain readable and are backed up before editable migration; historical confirmed revisions are not rewritten. Finite panels retain per-panel dimensions at 0.1 mm precision while surveyed room coordinates remain integer millimetres. Browser and Blender consume the shared compiler's baked meshes, normals, UVs, materials and cameras.

Photo projects are separate versioned documents sharing finish assets. Both project kinds use the same five-project account allowance. Source photos and masks remain private. Saved catalogue versions resolve against canonical server records and cannot acquire verified status from client-supplied names or edited settings.

The commerce migration adds immutable orders, event deduplication, output-space/compute reservations and refund recovery. A checkout holds capacity for approximately 30 minutes, aligned with Stripe expiry; successful late payments re-reserve or enter refund recovery. A paid order admits one job. Legacy free render submission cannot bypass payment. Customer refunds and consumed compute use separate ledgers. Price changes do not mutate existing orders.

Cancellation before worker claim and terminal rendering failure initiate full refunds. Cancellation after claim enters support. Recovery retains pending/failed states and uses provider idempotency keys. Deleting room media does not erase the minimum financial references needed for reconciliation. Retention maintenance sends advance notices before expiring inactive projects; absent notice delivery configuration postpones deletion.

## Verification and activation

The new source tests cover panel continuity/exhaustion, migration, catalogue tampering, layout edits, photo perspective/masks/detail, checkout capacity, signed payment events, order isolation, cancellation, late payment, refunds and repurchase. Browser checks start from blank customer projects, upload source files through controls, export/reopen, exercise camera placement and compare pixels in downloaded composites. Results and exact commands are recorded in the accompanying implementation check record after execution.

Local test payment transports exercise the Stripe request and signed-webhook protocol without charging an account. They do not establish that a hosted Stripe Checkout session, deployed database, Modal GPU image or real expiry email works. Browser emulation does not establish physical iPhone Safari or Android Chrome compatibility.

Production activation requires all of the following:

- Verified staging Auth/Storage/Edge/worker delivery and real Stripe test checkout, using a separately bounded infrastructure/benchmark allowance.
- Measured cost per completed package, including failed attempts, storage/transfer, payment/refund fees and support; an owner-selected retail price, tax profile and processing ceiling.
- Configured secrets, verified payment pipeline and explicit live switches. Missing price, tax, operating allowance or compute cap keeps checkout closed. Missing/disabled AI configuration keeps automatic analysis closed.
- Physical mobile verification, current-head CI and release review. Manufacturer assets require separately documented permissions and calibration.

The existing website's sitemap and canonical route cover the public landing page. Private projects/results are not public indexable content. Search Console submission follows an authorised release and requires property access; it cannot guarantee indexing.

## Executed local evidence

The [implementation receipt](review/wallpaper-my-room/checks.json) records 156 core tests and 141 Studio tests passing, with the optional Blender cases enabled and zero skips. Both browser/Edge TypeScript entries pass. Browser acceptance covers a fresh photo project and a fresh measured room rather than importing prepared developer projects. Chromium exercises desktop and phone widths; cached desktop WebKit also covers photo upload, orientation, masking, export and deletion. Physical phones remain a release gate.

The fresh measured-room journey uploaded six original numbered panels through the customer controls, established physical sizes, accepted the proof, applied one connected wall run, adjusted materials/cameras and confirmed an immutable revision. Local Blender 4.5/Cycles consumed that exact package: 147 meshes, 13,047 vertices, 17,798 triangles; two 1920 × 1080 PNGs and one 4096 × 2048 panorama completed in 219.452 seconds on the local GPU at 128 samples. The worker verified actual geometry against the compiler, and both stills and the full panorama were inspected. The numbered 512px artwork is a deliberately low-detail test source and triggers the customer detail acknowledgement; it is not a premium presentation example or evidence of hosted turnaround.

Portable JSON has one compact 160 MiB import/export limit, independently of the unchanged 20 MiB image and 100 MiB unique-source quotas. Every snapshot occurrence is budgeted before edits and cloud saves. Existing oversized local drafts stay recoverable and accept reductions; rejected edits keep uploaded proofs and previous projects. Original v1 backups download individually. Serialized photo autosave prevents delayed writes or upload callbacks from recreating deleted source photos.

| Actual editor evidence | View |
| --- | --- |
| Fresh numbered-panel room, customer camera controls | [Browser](review/wallpaper-my-room/finite-panels-browser.jpg) |
| Exact confirmed revision, local production renderer | [Render](review/wallpaper-my-room/finite-panels-render.jpg) |
| Guided photo wall selection and finish preview | [Desktop](review/wallpaper-my-room/photo-editor.jpg) / [Phone](review/wallpaper-my-room/photo-editor-phone.jpg) |

All review imagery uses original generated fixtures. Supplier studies and customer files are excluded. Hosted compute, storage/transfer, payment fees, failure allowance and support costs are still unmeasured; the retail price and spending settings remain unset. The observed local render is not a production cost quotation or service guarantee.
