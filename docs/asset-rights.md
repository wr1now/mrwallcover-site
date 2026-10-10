# Asset rights

This is a working register, not a licence. A small image is not permission to print it large.

| Group | Examples | Use on the site | Limit |
| --- | --- | --- | --- |
| Own site photography | Brown's Hotel stills and the three films. Alt text says `own site photo` or `own site video`. | Large, including the homepage. | Taken on site for this practice. |
| Own exterior and showroom previews | St George's Square, Inverness Terrace, the Penny Morrison showroom, and our own House of Hackney showroom stills at St Michael's Clergy House. Encoded by `scripts/import-previews.mjs`. Metadata stripped. Frames with a person in view are not in the library. | Case-study size. Street only for the two private residential buildings. | Own cleaned previews. Do not add a house number to the Pimlico or Inverness Terrace captions. |
| Own iPhone originals (formerly preview stills) | Calico event installs (Ahluwalia, Lee Broom, BEVERLY 1975, Heathrow T4, NoMad), the north London residence, the Old Bailey hotel and Trematon Castle: 85 images, each cut from Dorin's own full-size iPhone original in his Apple Photos library (exported read-only), same frame and crop as the old preview. See "Own iPhone originals" below. | Card, hero and gallery on those case studies. Modest case studies keep their small layout. | Own photography. Metadata (EXIF, GPS) stripped. Private houses stay unnamed. `old-bailey-hotel-01` has no larger original and stays at 625px. |
| Step 1b photographs (Four Seasons residences, tea house, SCP showroom) | `fs-residences-01`–`12`: Four Seasons Private Residences at Ten Trinity Square, own photographs (Sony A7 III, April–May 2019), photo #2–4, 12–14, 19, 20, 24–27. `tea-house-01`–`08`: a tea house in West London for Jaillon Studio, July 2021 (Canon 6D), photo #59–64, 66, 67. `scp-pimlico-01`–`05`: SCP short-term showroom, Pimlico, September 2019, photographer credited as JRH (Nikon D810 TIFFs), photo #45–49. All cleared for publication by Dorin on 10 October 2026 (numbered photo labels). | Gallery and hero on the Four Seasons case study and the two new case studies. | Metadata (EXIF, XMP, GPS) stripped by re-encoding. Lift floor indicators and wall signs (Four Seasons lobbies), a photographer's reflection and a passer-by (tea house), and the street through the shop window (SCP) are blurred before encoding. See "Step 1b photographs" below. |
| Contextual exteriors | Bonnington / DoubleTree West End facade, Silverstone, some hotel fronts. `imagePolicy: modest`. | Small. Caption them as the building, not the finished rooms. | Source is not a licence to reuse as craftsmanship proof. |
| Client photography | House of Hackney's own photographs of the finished St Michael's Clergy House showroom (`hoh-official-01` to `hoh-official-07`). The encoded JPEG, WebP and 800px thumbs are committed under `public/media/img`. Sources are listed below and in `scripts/credited/house-of-hackney.json`. `npm run build` skips a credited image when those four files are already present, so a deploy does not call houseofhackney.com. | Case-study card, hero and gallery for the House of Hackney showroom only. | Credit every use as "Photography: House of Hackney" (stored as the gallery credit, shown as the caption). Not our photography; do not use on other pages or as general craftsmanship imagery. |
| Credited venue photographs | Wikimedia Commons and Hilton press photographs of DoubleTree West End, DoubleTree Victoria, Ten Trinity Square and Hilton Garden Inn Silverstone (Dorin's decision, 10 October 2026). Listed below. | Hero and gallery on those case studies, captioned as a view of the building or venue, with the credit in the caption and the source and licence linked in the page text. | Never presented as our work. Commons files keep their licence (ShareAlike files stay under the same licence after resizing). Hilton files: no licence stated, permission not confirmed. |
| Before shots | `house-of-hackney-st-michaels-01` and `-03`: rooms as found, before works. | Lower in the gallery only, captioned "Before". | Never as a card or hero image. |
| Press or hotel images | Raffles / OWO credits in `alts.json`. | Only with the credit already stored, and not as if we photographed the interior. | Follow the credit. Do not crop the credit off. |
| Placeholders | “Interior photographs to follow” panel on The Biltmore only. DoubleTree Victoria and DoubleTree West End now carry credited photographs of the building instead. | A labelled empty panel. | Not a photograph. Do not replace with a generated room. |
| Material studio | Procedural colour and weave drawn in the browser. | Illustrative only, after the visitor opens it. | Not a named product and not acoustic proof. |

Held hotels in `src/content/unpublished/hotels-held.json` have no images on the site. Do not publish delivery labels.

### Own iPhone originals (award step 1, 10 October 2026)

- Source: Dorin Burcus's own iPhone photographs in his Apple Photos library, exported as originals (read-only; the library was not changed). Matched to the old previews by perceptual hash (pHash distance 0 to 6) and checked by eye; the three Heathrow crops (`heathrow-06`, `-07`, `-08`) are re-cut from the same originals as `heathrow-05` and `heathrow-04`; `beverly-04`, `-05` and `-07` are frames taken from the original videos at the preview's moment.
- None of the previews had a label or face blurred, so nothing needed re-blurring. The roll labels in `trematon-04` and `-05` show only the product, batch and job number.
- Encoded by `scripts/build-originals.mjs` from crop-matched masters kept outside the repo: AVIF and WebP at 480/800/1200/1600px, plus 2400px for case-study leads, never upscaled, into `public/media/img/r/`. sharp writes no EXIF, XMP or GPS. The old `*-preview` files stay for the blur placeholders and modest layout widths.
- Still small: `old-bailey-hotel-01` (625x421, source unknown, no larger copy on the Mac, in the pro-photo sweep or on the web).
- Held, never to be committed: Dorin's owner portraits and every unidentified-* set from the pro-photo sweep. `tests/held-images.test.ts` fails the check if any of them, renamed or re-encoded, appears under `public/`.

### Committed House of Hackney photographs

Encoded by `scripts/import-credited.mjs` and stored in the repository. The build downloads a file only if it is missing.

| Id | Published on | Image |
| --- | --- | --- |
| `hoh-official-01` | [The Transformation of St Michael's](https://www.houseofhackney.com/blogs/stories/the-transformation-of-st-michaels) | [SMC_TRANFORMATION_04.jpg](https://www.houseofhackney.com/cdn/shop/files/SMC_TRANFORMATION_04.jpg) |
| `hoh-official-02` | [London Showroom](https://www.houseofhackney.com/pages/london-showroom) | [apothecary.jpg](https://www.houseofhackney.com/cdn/shop/files/apothecary.jpg) |
| `hoh-official-03` | [London Showroom](https://www.houseofhackney.com/pages/london-showroom) | [WEB_SMC_DEC_26_02.jpg](https://www.houseofhackney.com/cdn/shop/files/WEB_SMC_DEC_26_02.jpg) |
| `hoh-official-04` | [London Showroom](https://www.houseofhackney.com/pages/london-showroom) | [apothecary2.jpg](https://www.houseofhackney.com/cdn/shop/files/apothecary2.jpg) |
| `hoh-official-05` | [London Showroom](https://www.houseofhackney.com/pages/london-showroom) | [WEB_SMC_DEC_26_01.jpg](https://www.houseofhackney.com/cdn/shop/files/WEB_SMC_DEC_26_01.jpg) |
| `hoh-official-06` | [The Transformation of St Michael's](https://www.houseofhackney.com/blogs/stories/the-transformation-of-st-michaels) | [OUR_SERVICES_03.jpg](https://www.houseofhackney.com/cdn/shop/files/OUR_SERVICES_03.jpg) |
| `hoh-official-07` | [The Transformation of St Michael's](https://www.houseofhackney.com/blogs/stories/the-transformation-of-st-michaels) | [SMC_TRANFORMATION_03.jpg](https://www.houseofhackney.com/cdn/shop/files/SMC_TRANFORMATION_03.jpg) |

### Credited venue photographs (Wikimedia Commons and Hilton press)

Encoded by `scripts/import-credited.mjs` from `scripts/credited/venues-commons.json` and `scripts/credited/hilton-press.json`, at most 1800px wide and 2400px high, metadata (including any location) stripped. Each shows the building or venue, not our work, and its caption says so.

| Id | Case study | Author | Source | Terms | Taken |
| --- | --- | --- | --- | --- | --- |
| `doubletree-west-end-commons-01` | DoubleTree West End | Frombowen | [Commons file](https://commons.wikimedia.org/wiki/File:DoubleTree_by_Hilton_Hotel_London_-_West_End.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0); attribution required, ShareAlike | 2024-09-11 |
| `doubletree-west-end-commons-02` | DoubleTree West End | APK | [Commons file](https://commons.wikimedia.org/wiki/File:DoubleTree_by_Hilton_-_Southampton_Row,_London.jpg) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0); attribution required | 2026-05-17 |
| `doubletree-victoria-commons-01` | DoubleTree Victoria | Stacey Harris | [Commons file](https://commons.wikimedia.org/wiki/File:Bridge_Place,_Victoria,_London_SW1V_-_geograph.org.uk_-_1766428.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0); attribution required, ShareAlike | 2010-03-22 |
| `four-seasons-ten-trinity-commons-01` | Four Seasons, Ten Trinity Square | The wub | [Commons file](https://commons.wikimedia.org/wiki/File:10_Trinity_Square,_London,_at_night.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0); attribution required, ShareAlike | 2022-01-17 |
| `four-seasons-ten-trinity-commons-02` | Four Seasons, Ten Trinity Square | APK | [Commons file](https://commons.wikimedia.org/wiki/File:10_Trinity_Square_in_2026.jpg) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0); attribution required | 2026-05-12 |
| `four-seasons-ten-trinity-commons-03` | Four Seasons, Ten Trinity Square | Jim Linwood from London | [Commons file](https://commons.wikimedia.org/wiki/File:10_Trinity_Square,_Tower_Hill_-_City_Of_London._(16459952029).jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0); attribution required | 2015-02-25 |
| `silverstone-circuit-commons-01` | Hilton Garden Inn Silverstone | fuji.tim | [Commons file](https://commons.wikimedia.org/wiki/File:Ferrari%27s_Charles_Leclerc_battles_for_the_podium_with_Mercedes%27_Lewis_Hamilton_at_the_2022_British_Grand_Prix_at_Silverstone._(52196620083).jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0); attribution required, ShareAlike | 2022-07-03 |
| `silverstone-circuit-commons-02` | Hilton Garden Inn Silverstone | Jen Ross | [Commons file](https://commons.wikimedia.org/wiki/File:2022_British_Grand_Prix_(52382657159).jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0); attribution required | 2022-07-02 |
| `hilton-garden-inn-silverstone-press-01` | Hilton Garden Inn Silverstone | Hilton | [Hilton press release, 20 July 2023](https://stories.hilton.com/emea/releases/hilton-garden-inn-silverstone-debuts-on-the-famous-racetrack); [file](https://stories.hilton.com/emea/uploads/sites/2/2023/07/Hilton-Garden-Inn-Silverstone-Exterior.jpg) | Press-release image. No reuse licence is stated on the page; Hilton's Site Usage Agreement applies. Permission not confirmed: ask Hilton's press office before wider use. | 2023 or earlier |
| `hilton-garden-inn-silverstone-press-02` | Hilton Garden Inn Silverstone | Hilton | [Hilton press release, 20 July 2023](https://stories.hilton.com/emea/releases/hilton-garden-inn-silverstone-debuts-on-the-famous-racetrack); [file](https://stories.hilton.com/emea/uploads/sites/2/2023/07/Hilton-Garden-Inn-Silverstone-Guest-Room.jpg) | Press-release image. No reuse licence is stated on the page; Hilton's Site Usage Agreement applies. Permission not confirmed: ask Hilton's press office before wider use. | 2023 or earlier |

Not found or not used:

- Four Seasons interiors. The official image library (Four Seasons Image Library, property code TRI) gives only small previews without an account, and its usage rights cover promotion of Four Seasons by Four Seasons staff or contractors and editorial use with the credit “[Photographer] / Four Seasons”. That does not cover this site, so no official interior is used. Ask the hotel press office (press.fourseasons.com/towerbridge) if interiors are wanted.
- DoubleTree Victoria: no current exterior on Commons; the 2010 Geograph view shows the building under its earlier name (Hesperia London Victoria). No Hilton press image found.
- Silverstone: no Commons photograph of the hotel itself; the hotel images are Hilton's.

### Step 1b photographs (10 October 2026)

- Encoded by `scripts/build-own-originals.mjs` from the full-size camera originals (6000px Sony, 5472px Canon, 7000px Nikon TIFF), manifests `scripts/originals/fs-residences.json`, `tea-house.json` and `scp-pimlico.json`. AVIF and WebP at 480/800/1200/1600, plus 2000/2400 for each case-study lead, and JPEG at 800/1600 for share cards. sharp writes no EXIF, XMP or GPS (checked).
- Privacy: no Four Seasons residence is identified (no flat or floor numbers, owners or views); lift floor indicators and wall signs are blurred. The tea house is located only as West London; the SCP showroom only as Pimlico, London, with the street outside the window blurred.
- Left out on purpose: #51–55 (square edits of the same tea-house scenes), #56–57 (garden entrance and street terrace, which would locate the venue; #57 shows a passer-by), #58 (the venue's name sign), #65 (near-duplicate of #64).
- Still held, never to be published without Dorin's OK: #1, #5–11, #15–18, #21–23, #41–44 and #50 (`tests/held-images.test.ts`).
- Rights to confirm: the SCP set is by a professional photographer credited only as JRH, and the tea-house set's photographer is not recorded. Both sets came to Dorin from the jobs; credit lines can be added once the photographers are named.
