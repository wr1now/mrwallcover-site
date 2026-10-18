# Room Studio

Room Studio is a one-room wallpaper, mural, paint and limewash planner at
`/room-studio/`. The browser editor works without an account or a cloud service.
Private cloud saving, automatic plan analysis and finished rendering have an
implementation and an operations runbook, but are **disabled and undeployed**.
No paid model or cloud job is required to review the local editor.

## Customer workflow

1. Enter inside-face measurements for a rectangle, L-shaped or custom room, or
   open a PDF/image plan, select its page/crop, calibrate one known distance and
   trace the room. Draw a replacement outline on a measured grid or edit corner
   coordinates. Edit the ceiling, skirting and cornice. Position doors
   and windows in the plan or with labelled millimetre fields.
2. Add custom paint with a six-digit HEX value and matte/eggshell finish; choose
   a named Bauwerk shade; or upload wallpaper/mural artwork. Crop and rotate the
   artwork, enter its true physical dimensions, inspect the repeat proof and
   acknowledge it before saving. Mural dimensions remain proportional to the
   cropped, rotated image; wallpaper repeats retain their separate calibration. Apply a finish to one/all walls or a height band,
   with placement offsets and centring.
3. Compare up to three saved finish combinations in daylight or warm light. Set
   the two still viewpoints and panorama position numerically. Orbiting the live
   overview does not alter saved final-render cameras.
4. Check the measurements and confirm a version. The snapshot freezes geometry,
   finishes, lighting and cameras together. Further edits remain a draft until
   confirmed again. Download an editable room JSON or finish-summary JSON; the
   enquiry handoff uses a copied readable summary pasted into the contact form.
   A room is never sent automatically.

The initial room contains example dimensions and openings. It remains marked as
a draft until the customer checks it. Screen colours, limewash texture and
lighting are approximate; physical samples in the actual room remain necessary.
The first release has no furniture catalogue, room-photo reconstruction,
multi-room building model or generative image rewrite.

## Architecture and invariants

| Layer | Main files | Responsibility |
| --- | --- | --- |
| Astro route and shared site chrome | `src/pages/room-studio.astro`, shared React `Action` | Static introduction, loading/no-JavaScript fallback, site navigation/footer and shared actions |
| Editor state | `src/room-studio/RoomStudio.tsx`, `storage.ts` | Bounded undo/redo, IndexedDB draft/version storage, explicit JSON export/import and exact-snapshot confirmation |
| Room editing and plan tracing | `components/RoomPanel.tsx`, `PlanView.tsx`, `PlanImport.tsx` | Measured geometry, openings, selected-page PDF preview and manual scale/outline tracing |
| Materials | `finishes.ts`, `components/FinishPanel.tsx`, `catalogue/` | Crop/rotation, physical repeat, half-drop proof, mural set-out, paint and sourced Bauwerk shade selection |
| Shared model and compiler | `types.ts`, `validation.ts`, `geometry.ts` | Integer-mm room model, bounded validation, compiled meshes, opening reveals, wall UVs, material preparation and cameras |
| Browser preview | `components/RoomScene.tsx`, `PreviewPanel.tsx`, `PanoramaViewer.tsx` | Interactive Three.js display, lighting/combinations, saved viewpoints and completed panorama viewing |
| Private service implementation | `cloud.ts`, `supabase/`, `workers/room_studio/` | Verified ownership, private assets, immutable revisions, bounded jobs, extraction and Blender outputs; see [the backend runbook](backend.md) |

The browser and render worker consume the same compiled mesh/UV/material/camera
package. Blender does not infer another room from a screenshot. Its renderer
targets two 1920 × 1080 stills and one 4096 × 2048 panorama. Crop is applied to the
original artwork before clockwise quarter-turn rotation; physical dimensions
refer to that prepared image. Half-drop is applied once in wall UVs for alternate
strips unless the artwork already contains its stagger. Murals do not repeat.
The original deterministic limewash texture is reproduced from its saved seed;
the Python bake is checked against the browser algorithm.

Validation errors keep a structurally editable local draft available for repair.
An unreadable/unsupported draft is preserved for original-data download and
cannot be overwritten by automatic saving until the customer explicitly opens
a valid room or starts a new one. Local deletion waits for pending writes before
clearing the database. Room edits adapt saved finish bands to surviving walls and
ceiling height and retain saved cameras that remain inside the room.

React, Three.js and PDF.js are isolated to the interactive route. Finish controls,
the palette, scene and cloud panels load when needed; PDF.js loads when a PDF is
opened. Live scene textures are prepared at a bounded preview resolution and
released when replaced. The approved source artwork is retained for final
rendering. The local preview has no dependency on a live AI provider or private
backend. Its source plans remain on the device unless automatic reading is
explicitly requested after cloud activation.

## Catalogue and upload provenance

The UK Bauwerk snapshot contains **358 unique published colours**, checked on
**18 October 2026** against the manufacturer's public UK Colour Lab collection.
Shade IDs, names, family tags and website-preview HEX metadata are retained with
source/update dates, product/sample links and a metadata hash. Saved projects
retain their selected colour and catalogue version. No product photographs,
prose, logos or manufacturer material maps are included. This does not imply a
Bauwerk partnership or an approved paint simulation.

See [finish data and provenance](../room-studio-catalogue.md) for the exact public
sources and digital-colour limitations. Check or refresh the roster with:

```sh
node scripts/sync-bauwerk-catalogue.mjs --check
node scripts/sync-bauwerk-catalogue.mjs --date YYYY-MM-DD --dry-run
# After reviewing the source result, replace the snapshot and review its diff:
node scripts/sync-bauwerk-catalogue.mjs --date YYYY-MM-DD
```

Customer artwork is private project data, not a public wallpaper feed or project
photograph. Accepted still PNG/JPEG/WebP files are limited to 20 MiB, 8,192 px per
side and 25 megapixels. Signature, animation and header dimensions are checked
before browser decoding. SVG, animated PNG/WebP and remote image URLs are
rejected. Proof acknowledgement is cleared when calibration changes.

## Run and verify locally

Use Node 22.12 or newer. From the repository root:

```sh
npm ci
npm run dev -- --host 127.0.0.1
# Open http://127.0.0.1:4321/room-studio/

npm run check:studio-types
npm run check:studio
node scripts/sync-bauwerk-catalogue.mjs --check
npm run build
npm run check:studio-browser
```

Browser checks use a disposable Chromium profile and the built site. Set
`CHROME_PATH` to a compatible local Chromium executable if discovery fails.
They create original temporary plan/artwork fixtures and review captures under
ignored `.review-screens/`. `ROOM_STUDIO_DIST=/absolute/path/to/copied-dist` can
select a stable isolated build while another process rebuilds the default `dist`.
Run the source and built-site suites described in the repository README as well;
Studio checks do not replace those shared-site checks. The existing CI entry points
`npm run check` and `npm run check:dist` also run the Studio contracts/types and
browser suites respectively; no separate workflow permission is required.

Compile an original local fixture package without a renderer, or run Blender 4.5
LTS installed on the local machine:

```sh
node --experimental-strip-types scripts/room-studio-render-fixture.ts --shape l-shape
node --experimental-strip-types scripts/room-studio-render-fixture.ts \
  --shape rectangle --render --blender /absolute/path/to/blender
# Add --production for the full-size stills and panorama.
```

These fixture commands do not start paid cloud jobs. The backend runbook contains
the separate importer fixture command and all service activation settings. Keep
customer files, exports, signed links, credentials and private research outside
the public repository and generated crawler datasets.

## Acceptance and release status

Local verification and representative images are recorded in [the review receipt](review/checks.json), [browser review](review/browser-review.md) and [Blender review](review/render-review.md). These are implementation checks; service activation remains pending.

Local acceptance:

- [x] Integrated source, Studio types, built-site, catalogue and no-loss checks
  pass against main `63567b8`; hosted checks are tracked on the PR.
- [x] Manual measurements, custom/concave rooms, angle edits, doors/windows and
  overlapping/out-of-bounds validation work at mobile and desktop widths.
- [x] Actual PDF/JPEG/PNG preview and tracing prove page selection, known-distance
  scale, measured heights and provisional confirmation. Offline extraction
  fixtures check selected-room cropping and missing dimensions.
- [x] Custom paint, full-palette search/families/favourites, upload crop/rotation,
  physical repeat/half-drop, included stagger, bands and mural placement pass.
- [x] Undo/redo, reload, damaged-draft recovery, original export, pending-save
  deletion, saved cameras and stale-version confirmation regressions pass.
- [x] Keyboard controls, readable errors, WebGL failure, no-JavaScript fallback,
  mobile layout, browser exceptions and route-only loading are checked.
- [x] Local Blender stills and panorama use the approved fixture package; exact
  crop/rotation and deterministic limewash bake agree with the browser.

Desktop WebKit 26.5 also passes the focused editor, local export/reopen, artwork
proof and plan-tracing checks at desktop and narrow widths. Physical iPhone
Safari and Android Chrome testing remains pending. Desktop WebKit and responsive
Chromium emulation are recorded separately and do not replace those checks.

Service activation remains pending:

- [ ] Separate Supabase/Modal staging is provisioned and its Auth, CORS, private
  storage, two-account isolation, export/deletion/retention and signed links are
  tested against deployed services.
- [ ] The pinned worker image, OCR dependencies/weights, automatic raster-plan
  reading, vision proposal/repair and missing dimension handling are tested on
  original fixtures. Offline structural tests do not prove extraction accuracy.
- [ ] A positive processing cap, conservative per-job reservations, provider
  spending controls, retries and owner-approved activation flags are configured.
- [ ] The complete staged job lifecycle returns the two stills, panorama and
  summary for the immutable approved version, with failure/retry and deletion
  checked. No live AI, email, Modal GPU or paid request has been run by local QA.

See [backend implementation and deployment preparation](backend.md) for the
current limits and operational checklist. A passing local build must not be
presented as deployed service readiness.
