# Original linen and botanical assets

Created on 18 October 2026 with OpenAI's built-in image-generation tool. These are original decorative illustrations and a generated linen texture, not photographs of completed work, named wallcovering products or evidence of a maker relationship. No maker reference image, logo or pattern was supplied or reproduced. The direction draws on the general craft of hand-painted botanical decoration on silk.

The website consumes the three WebP files in `public/media/atelier-botanicals/`. The complete generated compositions were proportionally downsized and encoded with Sharp; the botanical alpha channels are retained. Source PNG copies remain in the local ignored `.review-screens/linen-source/` directory and the original generated files remain in the generation output directory. No project photograph was edited.

[Asset provenance](asset-provenance.json) records source and derivative hashes, dimensions, exact byte sizes and encoding. The three delivered assets total 274,754 bytes before HTTP compression. Linen is static; only the positioned botanical elements receive the existing slow CSS motion. These files do not introduce a WebGL renderer, animation loop or third-party request.

## Bird branch prompt

> Use case: illustration-story. Asset type: original transparent botanical ornament for the outer margin of a luxury London wallcovering website. Create one exquisite, naturally irregular branch growing upward, curving gently, with fine olive and sage leaves, a few soft ivory/blush magnolia blossoms and TWO SMALL realistic garden songbirds perched at different heights. It should evoke the general craft of hand-painted chinoiserie on silk without copying any maker's design. Delicate layered brushwork, fine feather detail, subtle satin highlights, warm sepia stems, very restrained antique gold accents, calm muted natural palette. Refined and lifelike, not cartoon, not clip art, not a flat outlined icon. Portrait composition about 2:3, whole botanical composition comfortably inside the canvas with transparent negative space around it; main branch begins near bottom right and rises toward upper left, balanced irregular offshoots, small birds relative to leaves and blossoms. Suitable for being softly faded as a website edge decoration. Isolated on genuinely transparent background; no linen ground in this image, no room, no wall panel, no frame, no text, no logo, no watermark, no paper rectangle, no cast drop shadow. This is original decorative artwork, not a photograph of a named wallpaper product.

Tool setting: `transparent_background: true`.

## Linen prompt

> Use case: photorealistic-natural. Asset type: an original seamless repeatable texture tile for a discreet luxury website background. An extreme close-up of fine warm ivory LINEN cloth, flat, front-on orthographic view, no perspective. Realistic fine woven warp and weft, tiny irregular natural flax slubs and soft thread highlights. The weave must feel tactile and elegant, subtle rather than coarse burlap. Entire square filled by cloth, perfectly even diffuse lighting, very low contrast, neutral warm off-white / light oatmeal, no yellow cast. Uniform brightness from edge to edge so the image can tile without visible seams. No folds, no objects, no flowers, no birds, no border, no text, no watermark, no vignette, no dramatic shadows. This is a decorative linen texture, not a named fabric product.

Tool setting: `transparent_background: false`.

## Blossom sprig prompt

> Use case: illustration-story. Asset type: original transparent botanical margin ornament for a luxury wallcovering website. A slender asymmetrical branch with gracefully spaced olive and sage green leaves and a few delicate ivory and pale blush magnolia blossoms and buds. NO BIRDS in this asset. Refined hand-painted chinoiserie-on-silk character: realistic petal shading and fine leaf veins, softly translucent brush layers and quiet satin sheen, warm sepia stems, sparse antique gold details. Lifelike, exquisite craft, not cartoon, not clipart, not an outlined vector icon. Original design; do not reproduce any named maker's pattern. Portrait 2:3 composition, whole graceful sprig inside the image with transparent breathing space, stem begins near bottom left and rises toward upper right, a modest airy branching arrangement rather than a bouquet. Genuinely transparent background. No fabric rectangle, no landscape, no room, no wall panel, no frame, no text, no logos, no watermark, no cast drop shadow.

Tool setting: `transparent_background: true`.
