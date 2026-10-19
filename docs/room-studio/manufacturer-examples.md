# Selected manufacturer room studies — 19 October 2026

The owner selected de Gournay **Plum Blossom** and requested a gold horsehair finish from Phillip Jeffries and an acoustic 3D design from Arte. The selected set is:

| Room | Selected product | Verified product specification | Preview asset gap |
| --- | --- | --- | --- |
| Chimney breast, three windows | de Gournay Plum Blossom, Original colourway on Tarnished Silver gilded paper; Ref 792575 / stock set 961463 | 915 mm finished panels; stock panel height 3048 mm and design height 2150 mm. Made-to-order heights can be tailored. Finite, sequential mural panels. | Public wide art preview has no established physical coverage or numbered panel mapping. It must not be treated as one 915 mm panel or an infinite repeat. |
| L-shaped room, three windows and two doors | Phillip Jeffries Metallic Ombre 3163 — Gold on Horsehair | 34 in trimmed width (863.6 mm); 11 ft panels (3352.8 mm); approximately 42 in vertical repeat (1066.8 mm); no horizontal repeat. Natural variation and hand-placed metallic leaf. | The square swatch has no established coverage. The separately identified official four-drop renderer sheet has 5100 × 4950 pixels and covers 3454.4 × 3352.8 mm, supported by its 11ft/4pnl filename, trim specification and exact image aspect. It stays a finite sheet. Metallic response is not established by a colour image. |
| Angled bay, four windows | Arte Babylon Adobe — Ecru 97031 | 3D textile on non-woven backing; 900 × 800 mm tiles, straight 800 mm match. Maker describes a positive acoustic effect. | A colour photograph does not supply measured relief or a relightable material. Full-tile pixel coverage must be checked separately. No quantified acoustic performance is implied by the preview. |

Official sources:

- [de Gournay selected colourway](https://degournay.com/product-details/originalontarnishedsilvergildedpaperwithpearlescentantiquing5), [stock set](https://degournay.com/shop-product-details/plumblossom961463), [hanging instructions](https://degournay.com/uploads/technical/document/2026_Hanging_Instructions-After-2025.pdf).
- [Phillip Jeffries selected product](https://www.phillipjeffries.com/shop/CARD-AG-METALUXEII/3163/tear-sheet), [website terms](https://www.phillipjeffries.com/legal).
- [Arte selected product](https://www.arte-international.com/en/collections/babylon/adobe/97031), [website terms](https://www.arte-international.com/en/legal).

The application records verified product dimensions separately from any assumed source-image coverage. Imported concept projects retain unconfirmed room measurements and unaccepted artwork proofs. A high-resolution output is not proof of source-image calibration, colour, metallic reflectance or physical relief.

Public website reuse of these reference images and rendered derivatives has not been established. Phillip Jeffries and Arte publish explicit restrictions on commercial reuse. Their publicly accessible product previews are not treated as permission. The current repository instruction also requires appropriate rights before reproducing branded wallpaper. No manufacturer has been contacted and no account terms have been accepted on the owner's behalf.

Source pixels, concept projects, private rendered derivatives and the alternate local preview build stay under ignored `.tmp/`. They are not added to `public/`, to the public image-rights register or to a deployable normal build. The locally generated study page is noindex, its robots file disallows crawling, cloud is disabled and it must be served on loopback only. Source URLs and assumptions stay beside the studies. This does not change the copyright ownership of the reference artwork.

For accurate production examples, obtain approved high-resolution flat artwork with physical crop dimensions; the de Gournay numbered panel set / EDM; approval to reuse the identified Phillip Jeffries full panel sheet, any additional unique drops and metallic material references; and Arte's measured relief/normal/height data or an approved scan. Permission scope needs to include website textures, rendered images/panoramas and any editable-room downloads containing the source pixels.

The normal public-safe build retains the original calibrated technical fixtures as engine tests. They are not renamed as manufacturer designs. The requested manufacturer presentation is held from public deployment and Google submission until its artwork and reuse scope are ready. Automatic AI calls and paid processing remain disabled as requested.

Private workflow (source manifest and images must already be under ignored `.tmp/`):

```sh
node --experimental-strip-types scripts/room-studio-private-studies.ts \
  --input .tmp/manufacturer-preview-input.json --private-concept \
  --render --blender /absolute/path/to/blender
node --experimental-strip-types scripts/room-studio-private-studies.ts \
  --input .tmp/manufacturer-preview-input.json --private-concept --build-preview
CHROME_PATH=/absolute/path/to/test-chromium node --experimental-strip-types \
  scripts/qa/room-studio-private-studies-browser.mjs
```

The optional `--id` flag renders one selected study. Building the scratch preview requires all three successful packages and verifies the complete compiled input hash and every rendered output hash before copying media. A cancelled or stale render cannot silently become the new preview. A normal `npm run build` does not read the private manifest or include this scratch site.
