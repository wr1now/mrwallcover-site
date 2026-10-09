# Asset rights

This is a working register, not a licence. A small image is not permission to print it large.

| Group | Examples | Use on the site | Limit |
| --- | --- | --- | --- |
| Own site photography | Brown's Hotel stills and the three films. Alt text says `own site photo` or `own site video`. | Large, including the homepage. | Taken on site for this practice. |
| Own exterior and showroom previews | St George's Square, Inverness Terrace, the Penny Morrison showroom, and our own House of Hackney showroom stills at St Michael's Clergy House. Encoded by `scripts/import-previews.mjs`. Metadata stripped. Frames with a person in view are not in the library. | Case-study size. Street only for the two private residential buildings. | Own cleaned previews. Do not add a house number to the Pimlico or Inverness Terrace captions. |
| Own preview stills | Calico event installs, north London residence previews. Metadata stripped. | Case-study size already in the library. | Do not invent a larger original. Private houses stay unnamed. |
| Contextual exteriors | Bonnington / DoubleTree West End facade, Silverstone, some hotel fronts. `imagePolicy: modest`. | Small. Caption them as the building, not the finished rooms. | Source is not a licence to reuse as craftsmanship proof. |
| Client photography | House of Hackney's own photographs of the finished St Michael's Clergy House showroom (`hoh-official-01` to `hoh-official-07`). The encoded JPEG, WebP and 800px thumbs are committed under `public/media/img`. Sources are listed below and in `scripts/credited/house-of-hackney.json`. `npm run build` skips a credited image when those four files are already present, so a deploy does not call houseofhackney.com. | Case-study card, hero and gallery for the House of Hackney showroom only. | Credit every use as "Photography: House of Hackney" (stored as the gallery credit, shown as the caption). Not our photography; do not use on other pages or as general craftsmanship imagery. |
| Before shots | `house-of-hackney-st-michaels-01` and `-03`: rooms as found, before works. | Lower in the gallery only, captioned "Before". | Never as a card or hero image. |
| Press or hotel images | Raffles / OWO credits in `alts.json`. | Only with the credit already stored, and not as if we photographed the interior. | Follow the credit. Do not crop the credit off. |
| Placeholders | “Interior photographs to follow” panels on DoubleTree Victoria, DoubleTree West End and The Biltmore. | A labelled empty panel. | Not a photograph. Do not replace with a generated room. |
| Material studio | Procedural colour and weave drawn in the browser. | Illustrative only, after the visitor opens it. | Not a named product and not acoustic proof. |

Held hotels in `src/content/unpublished/hotels-held.json` have no images on the site. Do not publish delivery labels.

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
