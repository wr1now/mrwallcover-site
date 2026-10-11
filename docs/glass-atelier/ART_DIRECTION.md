# Art direction: three Glass Atelier variants (contract stage 4)

Three treatments of the same pages, same copy, same markup, same photographs. Produced as a non-shipped preview: `scripts/glass-screens.cjs` injects `scripts/glass-variants.preview.css` into a running `astro preview` and sets `<html data-variant>`. Nothing in that stylesheet is imported by the site, so `dist/` carries none of it: the built CSS has no `[data-variant` selector (the enquiry form's own `data-variant="enquiry|aftercare"` attribute on the `<form>` is unrelated and predates this work).

Screenshots (18 PNGs, viewport only, device scale 1) are in the operator folder `screens/glass/variants/`, named `<variant>-<page>-<width>.png`, for home `/`, material `/materials/paper-and-non-woven/` and project `/projects/browns-hotel-mayfair/` at 1440x900 and 390x844. They are not committed.

## The variants

| | A. Champagne inset | B. Smoked gallery | C. Clear minimal |
|---|---|---|---|
| Header | Floating inset bar, ivory 74% + 20px blur, white 62% hairline, inner highlight, soft shadow, 1.1rem radius | Same geometry, ink 64% + 18px blur, light text, gold current-page rule, ivory action button | Full-width, white 34% + 10px blur, one hairline, no shadow, square button |
| Dock (phone) | Floating champagne pill inset 0.75rem from the edges, ink "Start" cell | Anchored smoked bar with rounded top corners, ivory "Start" cell | Flat clear bar on a hairline |
| Page background | Ivory `#F4F0E8` | Ivory | Paper `#F7F4EE` |
| Material head | Finished-room photograph full-bleed, title on a champagne panel, breadcrumb on a champagne chip | Same photograph, smoked panel, gold eyebrow | No photograph, larger type, more air |
| Project head | Paper head, photograph framed with radius and shadow | Full-bleed finished bedroom, smoked title panel, the inline figure hidden | Paper head, unchanged figure |
| Cards | Paper panel with hairline and radius | Same | Top rule only (as today) |
| Hero (home) | Ink panel with a warm gradient, pill buttons | Header floats over the top of the hero on desktop | Unchanged |

Shared in all three: eyebrow 0.8rem, page-head display `clamp(2.6rem, 1.4rem + 4.6vw, 5.5rem)`, hero sentence `clamp(2.8rem, 2.1rem + 1.6vw, 3.9rem)` on desktop, content width 80rem at 2.5rem gutters, 44px header action.

## Scored comparison

Reviewer judgments, 1 to 5. Art direction counts double because section 6 of the contract makes the glass "visible and intentional" the point of this stage.

| Criterion | A | B | C | Notes |
|---|---|---|---|---|
| Art direction (x2) | 5 | 4 | 3 | A is the contract's description. B is handsome but the dark panel reads as a gallery caption, not a studio. C is the current site with better type. |
| Legibility and contrast over imagery | 4 | 4 | 5 | A: ink on champagne over a pale wall is safe; the brass eyebrow on glass needs the G3 contrast record. B: ivory on smoked passes by eye; gold eyebrow on smoked is the pair to measure. C puts nothing over photographs except the header. |
| Proof visibility | 4 | 3 | 3 | A keeps the finished room visible through the panel. B's smoked panel covers and darkens the room, worst at 390. C shows no photograph on the material page at all. |
| Mobile first view | 4 | 4 | 4 | All three keep the H1 and two actions in the first screen. In A the pill dock sits over the third hero button; in B and C the anchored dock cuts it the same way the current site does. G6 fixes this with the body padding rule. |
| Restraint | 4 | 3 | 5 | A has three glass surfaces on a material page (header, chip, panel). B adds a dark band that competes with the material. C is nearly all paper. |
| Performance cost | 3 | 3 | 4 | A and B: 20px/18px blur on the sticky header plus a fixed dock on phones, two backdrops repainting on scroll. C: 10px blur, cheaper. |
| Total (AD x2) | 29 | 25 | 27 | |

## Chosen default: A, champagne inset, with two rules borrowed from the others

A is the default for G3 to G6. Two decisions from the comparison:

1. **One moving blur surface at a time.** On phones the header keeps the blur and the dock uses its opaque champagne fallback (ivory at 96%, no blur). On desktop there is no dock, so the header is the only blurred surface. Smoked glass (B's recipe) is kept for controls over dark photography and the material studio, not for page heads.
2. **Reading surfaces stay paper.** C's restraint applies to everything below the head: cards keep the hairline-on-paper treatment, no glass around paragraphs, no gradient bands.

Why not B: the smoked head band hides the finished room, which is the proof, and the dark header over the pale hero makes the first screen heavier than the photography deserves. Why not C: it does not change what a visitor feels in the first second, and the contract asks for exactly that.

Known seam in the preview: the champagne panel is three stacked elements (eyebrow, title, lede) each carrying the glass recipe, so faint horizontal joins show at 1440. In G4 the Glass component wraps them once.

## Image choices per page

All photographs are the practice's own site photographs from the Brown's Hotel case study. No credit line is required for own photographs; the only credited set on the site is House of Hackney ("Photography: House of Hackney"), which is not used here because the credited images belong to that case study page.

| Page | Image | Why | Crop and focal point |
|---|---|---|---|
| Home (all variants) | `browns-hotel-mayfair-02` (existing hero, not changed; hero markup and crops are PR #12 territory) | Finished bedroom, two lit wall lights, symmetrical | Unchanged: desktop grid 1.2fr / 0.8fr, phone `object-fit: cover` capped at 75vw |
| Material, A and B | `browns-hotel-mayfair-11` | Finished wall at Brown's: large-repeat printed paper, cornice, door and mirror. The only paper-family photograph that shows the material as a wall rather than a room | `center 30%`, so the cornice sits under the header and the title panel covers the mirror, not the pattern |
| Project, B only | `browns-hotel-mayfair-09` | Finished bedroom, lit wall lights, leaf paper behind the headboard, cushions in the foreground. The strongest finished-room photograph in the repo | `center 45%`, headboard across the top, the smoked panel over the bedside lamp |
| Project, A and C | `browns-hotel-mayfair-11` (the page's existing hero) | Unchanged | Unchanged |

Images checked by eye and rejected for this work:

- `browns-hotel-mayfair-07` and `-08`: a room mid-works (vacuum cleaner, dust sheets, protective film on the windows). **Flag for Dorin:** `-07` is the homepage "Selected work" lead image (`home.json` leadImage) and the Brown's card image in `projects.json` and `areas.json`, so the lead card currently opens on an unfinished room. Content data, not changed in this slice.
- **Flag for Dorin:** several Brown's alt texts in `alts.json` describe different photographs from the files they name. Seen: `-01` is a blue door, not "a pale floral wallcovering"; `-04` is a bedroom corner, not "a classical landscape on a green ground"; `-07` and `-08` are the unfinished room, not a console with flowers or a bamboo paper beside a headboard; `-10` is a bedside lamp against leaf paper, not "chinoiserie with birds above a patterned headboard". The images look shifted against their captions. Not changed here (content data), but it matters for accessibility and for the AI layer, which republishes these alts.

## What will NOT be done in this slice

- No change to the homepage hero images, their markup or crops.
- No visible copy changes, no routes, no content data, no schema, no AI-layer files.
- No photograph added to material pages in shipped code. The preview shows what a material head could be; adding images to the material template is stage 6 work and needs a photograph per family, which the repo does not have (only paper and non-woven can be illustrated from own photographs today).
- No B-style full-bleed project heads. The project template keeps its inline figure.
- No Three.js use and no new runtime dependency.
- No variant switcher in the shipped site. `data-variant` exists only in the preview stylesheet and the runner.

## Independent critique and response

An independent art-direction critique of the three variants (Grok Heavy, verified by Grok Bot, 9 October 2026, filed outside the repository as `grok/glass-artdirection-critique.md`) re-scored A 25, B 23, C 27 and confirmed A as the default: C wins only a paper tally and does not do what the contract asks. What stage 5 took from it, and what it deferred:

Applied in stage 5 (G3 to G6):

1. The champagne page-head panel in the preview was three glass boxes with visible seams. The Glass component wraps one element: one blur, one border, one inner highlight. No shipped page head carries glass in this slice (see stage 6 below), so the rule is enforced in the component rather than on a page.
2. The 74% ivory dock sat over the hero's buttons and "Start your project" ghosted through it. The shipped dock is champagne without blur (ivory at 96%, 1px ink at 8%, soft shadow), the body gets bottom padding equal to the dock's full clearance on phones, and the header is the only blurred surface on a phone.
3. "Paper and non-woven" hyphenated inside the narrow preview panel. Display headings now set `hyphens: manual` and `text-wrap: balance`, with a title measure of `min(42rem, 100%)`.
4. One radius language: pill (999px) only for the header action and small chips; 12px for buttons, fields and panels; 18px for the header bar (16px on phones) and the dock. The "Save to shortlist" rectangle was fixed through the shared button tokens only, with no copy or markup change.
5. Breadcrumb separator spacing (the " / " lost its spaces as a flex item) is fixed in CSS. Eyebrows on glass are stone or ink, 12px, 0.12em tracking, never gold or brass; brass on champagne is allowed only at display size (the wordmark). The measurements are in `CONTRAST.md`.

Token direction taken as starting values (champagne ivory 82% / blur 20px / saturate 1.15; smoked ink 72% / blur 16px; clear white 40% / blur 16px with a 1px ink ring at 12%; opaque surfaces for the page, cards, ledes, the hero sentence, primary buttons and the dock). The critique allowed clear glass a 12px blur; the final review (F8) held every variant to the brief's 16 to 24px, so clear is 16px. The contrast record (`scripts/contrast-record.mjs`, `tests/contrast.test.ts`) measures each glass tint over white and over ink and the worst case wins; the expected failures the critique named (gold on ivory and champagne, gold eyebrow on smoked over light paper, brass at small sizes on champagne, clear glass over ink) are recorded there as forbidden pairs.

Not in this slice (direction recorded for later stages, not implemented):

- Project heads should lead with `browns-hotel-mayfair-09` as one image and drop the second figure (the B project frame at 1440 was the best of the set). A project template and content change: stage 7.
- Home: running the photograph to the top behind the inset bar is a homepage hero layout change, which is PR #12 territory.
- Material pages with a photographic head in shipped code: stage 6, and it needs a finished-room photograph per family.
- `browns-hotel-mayfair-07` as the homepage "Selected work" lead image and the Brown's card image shows freshly hung walls in an empty room with floor protection, a vacuum cleaner and film on the windows. Whether that is a "finished room" is Dorin's call; the content data is unchanged.
- The Brown's alt texts that describe a different photograph from the file they name (`-01`, `-04`, `-07`, `-08`, `-10`, see "Image choices per page") are handed to another agent; this slice leaves `alts.json` unchanged.
