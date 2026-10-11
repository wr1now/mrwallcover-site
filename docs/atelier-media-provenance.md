# Atelier media provenance

Prepared 10 October 2026 from the owner’s local iCloud Drive project archive. A local iCloud Drive path demonstrates local availability; remote sync was not verified.

## Processing and use

- Authentic owner-supplied project photographs; no generated imagery, retouching, replacement, or content removal.
- Derivatives preserve the complete original composition and aspect ratio. Processing is native decoding, orientation normalisation, proportional downsizing, colour-space conversion, and JPEG/WebP encoding only.
- Native macOS ImageIO via `sips -s format png` decoded HEIC originals to lossless temporary PNGs at original dimensions. This was necessary because the installed Sharp HEIF loader does not include the HEVC decoder.
- Sharp 0.35.5 resized the temporary PNGs and encoded sRGB output: WebP quality 86 / effort 6; JPEG quality 90 / mozjpeg. No upscaling.
- EXIF, XMP, IPTC and ICC metadata are absent from every output (checked by reopening each derivative). This strips location and camera metadata from public assets.
- Every derivative was fully decoded again and checked for dimensions and metadata. SHA-256 values below bind outputs to their local files.
- A rendered derivative from each of the five source photographs was visually inspected after conversion; the original compositions, correct orientation, and scene details are preserved.
- Venue photos identify the location; they do not imply a hotel endorsement or claim that MrWallcover performed exterior works.
- The corridor photograph must be labelled “During works”. The source visibly includes masking and protective coverings.

## Sources and derivatives

### browns-bedroom

- Original: `/Users/dorinburcus-coman/Library/Mobile Documents/com~apple~CloudDocs/Desktop/business & personal/Website new/Brown Hotel Mayfair London/Browns Hotel Mayfair @MrWallcover_5832.HEIC`
- Original dimensions: 4032 × 3024 pixels; 2,830,509 bytes.
- Original SHA-256: `3f32a583f98fa1480fa766a5265851fffeec4695fb2708f6d07f2cb516e4e66f`
- Suggested alt text: Botanical wallcovering around an upholstered bed in a finished bedroom at Brown’s Hotel, Mayfair.
- Use note: Finished bedroom; selected as the leading project photograph. The source is a HEIC original, despite earlier shorthand referring to it as JPG.

| Derivative | Dimensions | Bytes | SHA-256 |
|---|---:|---:|---|
| `public/media/atelier/browns-bedroom-640.webp` | 640 × 480 | 61,116 | `256553251d7d003f81cfd085051d5b5c5a9154ebb87ba8a78a2a9ccffa11424c` |
| `public/media/atelier/browns-bedroom-960.webp` | 960 × 720 | 124,046 | `e8805f29d9b3a2d4a609fbefe3eeea1452f94a6495b107892003308e3d88287d` |
| `public/media/atelier/browns-bedroom-1440.webp` | 1440 × 1080 | 258,692 | `271da179a33fc3e129710a8cef76f4a657781203c97249d0427c16929216e448` |
| `public/media/atelier/browns-bedroom-2000.webp` | 2000 × 1500 | 471,602 | `1f6cb32106ebd0892bf3c8a8e390d8cf757530d00c2e8cc73acc83884cdfff9b` |
| `public/media/atelier/browns-bedroom-2560.webp` | 2560 × 1920 | 747,552 | `5cf02e4e2a1415d4cf26ef17d17a2f7f0a4884c0f289afb5e629447017c50207` |
| `public/media/atelier/browns-bedroom-2000.jpg` | 2000 × 1500 | 604,767 | `b56df6a9524095042111827da5b08c0798ece6ea51525eae3f4d2cd1cbff4e19` |

### browns-facade-dusk

- Original: `/Users/dorinburcus-coman/Library/Mobile Documents/com~apple~CloudDocs/Desktop/business & personal/Website new/Brown Hotel Mayfair London/Browns Hotel Mayfair @MrWallcover_1848.HEIC`
- Original dimensions: 4032 × 3024 pixels; 1,869,508 bytes.
- Original SHA-256: `ffe94948a35186b13da983d6c62705db436b2cc5add274a8d4d380fee89a11c9`
- Suggested alt text: The illuminated entrance and facade of Brown’s Hotel in Mayfair at dusk.
- Use note: Venue exterior context, not evidence of exterior works. Includes an incidental hotel doorman and a passing vehicle; no claim of endorsement.

| Derivative | Dimensions | Bytes | SHA-256 |
|---|---:|---:|---|
| `public/media/atelier/browns-facade-dusk-960.webp` | 960 × 720 | 172,652 | `6af8bd828ad7c3cde659cce34e414f65ed7ff093213bad6eb4707d6a8e285f91` |
| `public/media/atelier/browns-facade-dusk-1600.webp` | 1600 × 1200 | 421,872 | `3a5f0a57cb39f7a28eaf670fc036b8d54d396a911ce5831c6cc72368be53da88` |
| `public/media/atelier/browns-facade-dusk-1600.jpg` | 1600 × 1200 | 519,520 | `73a543125b3c82f7f1b4fb83df38f08610faed6320986308fd87d32dd68ac72e` |

### browns-facade-day

- Original: `/Users/dorinburcus-coman/Library/Mobile Documents/com~apple~CloudDocs/Desktop/business & personal/Website new/Brown Hotel Mayfair London/Browns Hotel Mayfair @MrWallcover_3762.HEIC`
- Original dimensions: 4032 × 3024 pixels; 2,272,900 bytes.
- Original SHA-256: `7cd74cfb7866e08a04a457ae08a761c8679e1a148a858d2f062996e3be25f82a`
- Suggested alt text: The Brown’s Hotel facade along Albemarle Street, Mayfair, in daylight.
- Use note: Venue exterior context, not evidence of exterior works. Distant pedestrians and vehicles remain in the ordinary street photograph.

| Derivative | Dimensions | Bytes | SHA-256 |
|---|---:|---:|---|
| `public/media/atelier/browns-facade-day-1200.webp` | 1200 × 900 | 243,234 | `1b2293b2bd2eaf5bc39461954b8b7bd07ec1ff51c683383f6602eab9bdb6121c` |

### browns-cornice

- Original: `/Users/dorinburcus-coman/Library/Mobile Documents/com~apple~CloudDocs/Desktop/business & personal/Website new/Brown Hotel Mayfair London/Browns Hotel Mayfair @MrWallcover_5923.HEIC`
- Original dimensions: 3024 × 4032 pixels; 3,629,550 bytes.
- Original SHA-256: `c3db0be2f95d2b552c730768a82369601992f38a45c7dc4e66332c5737c9eca4`
- Suggested alt text: Bird-and-branch wallcovering beneath an ornate cornice at Brown’s Hotel, Mayfair.
- Use note: Wallcovering and cornice detail; this is source 5923, not the adjacent mirror photograph 5921. A small green tool handle is visible at the lower edge; describe this as a craft detail, not a fully staged room photograph.

| Derivative | Dimensions | Bytes | SHA-256 |
|---|---:|---:|---|
| `public/media/atelier/browns-cornice-960.webp` | 960 × 1280 | 211,030 | `8319881a7d894ad8a488e891f4feb1e6bc5e1c44c99e35b1c96859c2e6222461` |
| `public/media/atelier/browns-cornice-1440.webp` | 1440 × 1920 | 449,072 | `6e3982c104d8629dd76131707956129d3fea2c257a87263ebe56d23cab7a5f01` |

### browns-corridor

- Original: `/Users/dorinburcus-coman/Library/Mobile Documents/com~apple~CloudDocs/Desktop/business & personal/Website new/Brown Hotel Mayfair London/Browns Hotel Mayfair @MrWallcover_1941.HEIC`
- Original dimensions: 3024 × 4032 pixels; 1,841,289 bytes.
- Original SHA-256: `dfde63188e83eacf2b597d559345d3319c66dd334a54c03097febb5da028b642`
- Suggested alt text: A Brown’s Hotel corridor during works, with protective floor covering and masking visible.
- Use note: During-works image. Retain an explicit “During works” caption wherever used; protective floor covering and masking must not be described as a finished installation.

| Derivative | Dimensions | Bytes | SHA-256 |
|---|---:|---:|---|
| `public/media/atelier/browns-corridor-960.webp` | 960 × 1280 | 139,920 | `724ea7733e3f0e7d356abde3fce350a28024948720b298f2f50853f602322479` |
| `public/media/atelier/browns-corridor-1440.webp` | 1440 × 1920 | 341,380 | `c2ef1bcdbc1bf54209bf2d30a4ba99f5a62c4e0db9cbd076484f27ce081fd526` |
| `public/media/atelier/browns-corridor-960.jpg` | 960 × 1280 | 208,516 | `cf13c44cadba5e7f3845c4a225fccb203aba860b132efa279bc0ce76e2e06701` |
