# Room Studio finish data and provenance

## Bauwerk Colour UK

The owner requested the full current UK palette. `src/room-studio/catalogue/bauwerk-uk.json` contains 358 unique published Colour products verified on 18 October 2026 from the manufacturer's public UK shop collection:

- Discovery: https://www.bauwerkcolour.com/en-gb/collection/colour-lab
- Source: https://ukcheckout.bauwerkcolour.com/collections/colour-lab/products.json?limit=250&page=1 and page 2 (pagination is fetched until complete).
- Corroborating UK full-palette information: https://www.bauwerkcolour.com/en-gb/clp/product-info-colour-card-box-set (350+ colours; updated 23 September 2026).

The UK source supplies product IDs, names, handles, `colour:` families, `colour-code:#RRGGBB` metadata, source update dates and available variants. The stored digital values are the manufacturer's website-preview metadata, **not measured paint colour, colourimetric specifications, RAL matches or guarantees of appearance**. Earlier cached web search showed 357; the live UK endpoint returned 358 when imported. The dated import is authoritative for this snapshot, not a promise about future availability.

Only these factual fields are retained. No product prose, logos, photographs, texture maps, private research, credentials or customer material is copied. This public-source reference does not imply a partnership, accreditation or endorsement. The preview material is original procedural work, not a manufacturer's approved material simulation. Do not use this file as an inventory or price feed.

Refresh with `node scripts/sync-bauwerk-catalogue.mjs --date YYYY-MM-DD`. Use `--dry-run` for a source check without replacement; `--check` verifies the saved catalogue offline. The script fails before writing if the source is unavailable, paginates unexpectedly, has duplicate identities, loses shade codes/families, or returns an implausible partial palette. Review the diff and provenance after every refresh. A failed source request retains the last verified snapshot; the UI always shows its date. The source metadata SHA-256 checks the selected fields in the stored roster, not the manufacturer's entire response.

The interface provides all currently available imported shades, name search, family filters and local-device favourites. Every named shade links to its official UK product and samples. Saved projects retain the product ID, catalogue version and saved digital colour so a future refresh does not recolour an agreed scheme.

## Screen colour and material limits

Bauwerk's own UK guidance explains why limewash does not have a direct conventional-paint/RAL equivalent and why light, substrate, application and tonal movement affect perception:

- https://www.bauwerkcolour.com/en-gb/information
- https://www.bauwerkcolour.com/en-gb/ai-policy
- https://www.bauwerkcolour.com/en-gb/clp/product-info-colour-card-box-set

The customer preview says that colour and limewash movement are approximate and links to physical samples. Do not add official HEX/RGB claims beyond the explicitly sourced website-preview metadata. Do not infer a manufacturer's measured PBR properties or render a guaranteed finished wall from a single colour value.

## Customer wallpaper and murals

The uploader accepts signature-checked still PNG/JPEG/WebP files up to 20 MiB and rejects SVG and animated PNG/WebP. Image headers are checked before decoding; dimensions above 8,192 px per side or 25 megapixels are rejected to bound graphics memory. The customer confirms their ability to use the artwork and checks a four-width repeat proof before it can become a saved finish. Crop coordinates refer to the original image; quarter-turn rotation follows cropping clockwise. Physical dimensions describe the selected and rotated tile, in integer millimetres up to 30,000 mm. Complete seamless tiles repeat as supplied; strip half-drop is applied once in wall UVs, unless the artwork already includes the stagger. Murals use a single non-repeating image.

User files belong to the private project. They are not a public wallpaper catalogue, evidence of installation or permission to publish branded artwork elsewhere. The original geometric test fixture is explicitly illustrative, with no maker attribution.

## Original limewash illustration

`createLimewashPixels` in `src/room-studio/finishes.ts` creates a deterministic original cloudy/brush-grain texture from the saved colour and seed. Coarse noise is periodic to avoid obvious tile edges. Its bytes can be baked for a rendering worker; no generated image service or live AI job is involved. Preserve the seed and algorithm version when reproducing an agreed scene. Any future manufacturer-provided texture assets need their own provenance and permitted-use record.
