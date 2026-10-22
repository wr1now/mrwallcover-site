# Wallpaper my room: three measured examples

The prepared public menu label is **Wallpaper my room**; its canonical page remains
`/room-studio/`. Three server-rendered cards show actual Blender output before
the editor loads. Visitors can inspect HD views and a 4K panorama, then explicitly
open a portable, editable example. Loading is reversible through Undo. Choosing
a card alone does not replace the current room. Protected damaged drafts cannot
be replaced through the example chooser, and cancelling a slow import leaves the
current room untouched.

All artwork is original procedural illustration authored for this application.
It is not a named manufacturer's product, a photograph, a customer room or evidence
of a completed commission. Source SVGs, deterministic generator and lossless PNG
checksums are retained in the repository. No external artwork or fonts are used.

| Example | Measured layout | Openings | Physical artwork repeat |
| --- | --- | --- | --- |
| Willow lattice | 6.2 × 4.6 m, 2.8 m high; eight walls including a 1,800 × 400 mm chimney breast | Three windows, one door | 640 × 640 mm, straight tile |
| Ochre cadence | 6.0 × 5.0 m L-shaped outline, 2.7 m high | Three windows, two doors | 530 × 640 mm strip, alternate strips dropped 320 mm |
| Indigo arcade | 5.6 × 4.6 m angled bay outline, 2.75 m high | Four windows, one door | 600 × 600 mm complete tile with its stagger already included |

Each lossless source tile is 1,536 × 1,536 pixels. This gives approximately
2,400–2,898 source pixels per metre horizontally, depending on the calibrated
repeat width. These figures describe the digital source, not print suitability.
Changing a room dimension reveals more pattern rather than enlarging it.

The examples deliberately continue horizontal set-out around adjacent papered
walls. Chimney returns and L-shaped corners have zero phase discontinuity. The
angled bay's integer-mm offsets create a maximum corner phase difference of
0.049935 mm. Half-drop is applied once to the strip example and never reapplied
to the complete staggered tile. The editor exposes the same operation as
**Continue pattern around corners**, from the selected starting wall; paint,
different finishes and different horizontal bands end the run. A closed room's
last meeting corner can still require a deliberate closing seam.

The browser receives the same compiled meshes, cut-outs, baked UVs and saved
cameras as Blender. Its adaptive texture preparation retains up to 2,048 pixels
per side on desktop and 1,024 on narrow screens within a shared memory budget;
trilinear mipmaps and bounded hardware anisotropy reduce distant shimmer.
Full rendering retains the source artwork independently of that preview budget.
Finish controls report cropped source pixels and density, with a clearly labelled
illustrative low-resolution guide. An HD or 4K output cannot restore missing
source-image detail.

Each final package contains two 1,920 × 1,080 images and a 4,096 × 2,048
equirectangular panorama, rendered with Blender 4.5/Cycles at 128 samples and
seed 217. Willow and Ochre full-resolution WebPs use quality 96 (measured PSNR
44.10–46.98 dB against the original PNGs). Indigo uses pixel-identical lossless
WebP to preserve its fine gold linework. Only the card previews are reduced to
960 × 540. All twelve images total approximately 9.68 MB, with the HD views and
panoramas requested only when chosen. Per-example manifests under
`public/media/room-studio/examples/` record exact source, geometry/UV and output
hashes, dimensions, local timing and measured compression error against the
original PNGs. The original full-size PNGs remain under ignored `.tmp/` locally.

These are useful architectural finish studies. The plain floor, simplified trim,
door leaves and window apertures do not reproduce the furnishing, detailed joinery,
surface relief or lighting of a photographed interior. They should not be sold as
an exact photorealistic prediction of the customer's finished room. Accurate
artwork scale and high output resolution are separate from that visual realism.

Reproduce locally with the existing dependencies and Blender:

```sh
node scripts/generate-room-studio-example-artwork.mjs --check
node --experimental-strip-types scripts/room-studio-render-examples.ts \
  --render --blender /absolute/path/to/blender
```

This uses no AI calls, hosted GPU jobs or customer data. Automatic plan reading,
cloud storage and finished rendering of customer rooms remain disabled until their
private services are configured and verified. The global spending limit remains
unset and paid processing therefore remains disabled.

Google discovery uses the canonical page, the shared menu/footer links, static
explanatory content and the normal published sitemap. Search Console submission
does not establish that a page has been indexed. Follow the
[official crawl-request procedure](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
only after the public page returns HTTP 200.

The later owner-selected manufacturer studies are separate [private local concepts](../manufacturer-examples.md). The public page/menu and Google submission have not been released as part of this local review.
