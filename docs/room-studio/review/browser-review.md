# Room Studio browser review

The original illustrative rooms use authored test artwork and sourced colour metadata. They do not represent a completed Mr Wallcover installation or a Bauwerk-approved rendering.

The seven focused Chromium suites cover manual dimensions, outline drawing, angled-wall opening dragging, actual PDF/JPEG/PNG preview and tracing, upload/crop/rotation, repeat-proof pixels, proportional murals, paint and full-catalogue selection. Undo/redo, frozen versions, reload, invalid-draft recovery, original-data export and deletion during a pending save are exercised. WebGL loss is forced and recovered with the same project. A no-JavaScript visitor receives the contact fallback.

The scene test changes existing paint surfaces to textured finishes and checks rendered pixels, removes/reapplies the finishes, compares actual browser mesh/normal/UV/index data with the compiler's 105-mesh fixture, and verifies a low saved camera pose and vertical field of view. The panorama test uses the real 4K Blender result locally: interior visibility, pointer and keyboard-accessible viewing controls, and complete-turn continuity pass.

A separate [desktop WebKit 26.5 receipt](webkit.json) covers the live WebGL editor at 1440px and 390px, local persistence and undo/redo, crop/rotation proof, actual JSON download and re-import, and PNG/JPEG/two-page PDF calibration and tracing. No browser errors or external requests occurred. The narrow context uses a coarse pointer and dispatched touch events; it remains desktop WebKit, not an iPhone or Android device result.

The [test receipt](checks.json) records local source/build/type/worker checks and their scope. The [performance receipt](performance.json) lists requested script sizes and confirms that the Contact page requests no React editor or PDF runtime. The PDF compatibility runtime and worker are lazy; byte sizes are gzip estimates, not network speed measurements.

| Review surface | Image |
| --- | --- |
| Complete editor, desktop | [1440px](editor-1440.jpg) |
| Complete editor, mobile emulation | [390px](editor-390.jpg) |
| Finish selection | [Desktop](finishes-1440.jpg), [mobile](finishes-390.jpg) |
| Uploaded repeat proof | [Proof](repeat-proof.jpg) |
| Measured room sketch | [Drawing](outline-drawing.jpg) |
| Browser cutaway | [Overview](browser-overview.jpg) |
| Saved camera framing | [Camera](browser-camera.jpg) |

Detailed receipts: [editing](editor.json), [finishes](finishes.json), [draft recovery](draft-recovery.json), [drawing](drawing.json), [scene parity](scene-parity.json), [panorama](panorama-viewer.json), [Blender output](render-review.md).

Cloud Auth/storage/worker services remain undeployed. These local checks do not establish live OCR/model accuracy, cloud cost/turnaround, physical iPhone Safari/Android compatibility or deployed signed-link/retention behaviour. Those checks remain in the [activation checklist](../README.md).
