# Mr Wallcover Atelier (the room preview)

`/atelier/` shows a pattern on one wall of a photograph at true scale. It
is a tool page on the wallpapering templates, beside the calculator, and the quick
entry point for a customer who has a photo of their wall and a wallpaper in mind.

## What the visitor does

1. **The room.** Their own photo (the phone's camera opens on a phone) or our sample
   room, one real commission photographed before the works so the wall is bare.
2. **The corners.** Four handles mark the wall's rectangle in the picture. Pointer or
   keyboard. "Find the wall for me" optionally downloads a 4 MB segmentation model
   once and runs it on the device: it cuts windows, doors, radiators and furniture
   out of the wall and, when a single wall sits inside the frame, moves the handles
   to it. The copy calls it a guess.
3. **The wall.** Its real width and height in centimetres. This is the scale: one
   honest measurement (a door is 198 cm) is what maker visualisers lack.
4. **The pattern.** Five routes in: four illustrative patterns drawn in code; the
   visitor's own sample or saved image; an image pasted from anywhere; a link to the
   wallpaper; a paint colour. "What it is" switches between a repeating wallpaper
   (roll width, repeat, straight or half-drop, shift across and up) and a mural
   fitted to the wall. Because makers' pictures often show two or three drops or a
   square crop, "the image shows W × H cm" can be set apart from the roll; it follows
   the roll until changed. A plain border around a product picture is trimmed off
   on load. The room's own light and shade are kept.
5. **Next.** Download the preview (labelled *illustrative, not a colour match*),
   open the calculator with this wall and roll filled in, or send us the wall: the
   enquiry form picks up a plain-text brief from `sessionStorage` when it arrives
   with `?from=room-preview`.

Nothing is uploaded, no account exists and no cookie is set. The explanation under
the tool reads without JavaScript and says what a preview cannot show.

## Files

| File | Role |
| --- | --- |
| `src/pages/atelier.astro` | The page: shared head, wallpapering sub-navigation, four fieldsets, explanation. |
| `src/scripts/room-preview.ts` | The tool: inputs, handles, detection, pattern sources, hand-offs. |
| `src/lib/room-preview/homography.ts` | Pure maths: four corners ↔ a wall rectangle in millimetres; mask → seed corners. Tested in Node. |
| `src/lib/room-preview/engine.ts` | WebGL2 renderer with a CPU fallback; procedural tiles; labelled download. |
| `src/lib/link-preview.ts` | Reads a product page's image and stated sizes; the public-address guard. Shared with the API. |
| `server/index.ts` | `GET /api/link-preview?url=` and `GET /api/link-image?url=` on the private enquiry API. |
| `src/styles/room-preview.css` | Page styles on the shared tokens. |
| `tests/room-preview.test.ts`, `tests/link-preview.test.ts` | Source tests, in `npm run check`. |

## The link route

A static page cannot read another website, so a pasted link is read by a small
server: `GET /api/link-preview?url=` returns the product's JSON-LD or Open Graph
image, its title, and the roll width, repeat and match where the page states them,
and `GET /api/link-image?url=` serves the image back with CORS headers so the canvas
can use it. Both fetch with a 10 s timeout, a 2 MB cap for a page and 15 MB for an
image, up to three redirects each checked again, only to public http(s) hosts, and
only for the site's own origin.

Two servers have the routes:

- **The Cloudflare Worker in `workers/link-preview/`**, for the live site. GitHub
  Pages cannot run a server, so this is the routes' public home. Its README has the
  owner's deploy steps and the exact behaviour, including the two differences from the
  API: no DNS check (a Worker has no lookup and Cloudflare does not route to private
  addresses) and a best-effort, per-isolate rate limit.
- **The private enquiry API (`server/index.ts`)**, for local development, where it also
  resolves each hostname and refuses names that point at a private address.

The page reads the server's origin from the `data-link-api` attribute on
`src/pages/atelier.astro`, which is `LINK_API_URL` in `src/config.ts`:

| Variable | Read by | Meaning |
| --- | --- | --- |
| `PUBLIC_LINK_API` | the room preview only | Origin of the link routes, no trailing slash: the Worker on the live site (`https://mw-link-preview.<account-subdomain>.workers.dev`, or a custom route). Baked in at build time. |
| `PUBLIC_LEAD_API` | the enquiry form, and the room preview when `PUBLIC_LINK_API` is empty | Origin of the private API. Setting it switches the form to post enquiries to `<origin>/api/leads`, so it must never be pointed at the Worker, which has no such route. |

So the live site is built with `PUBLIC_LINK_API` set to the Worker and
`PUBLIC_LEAD_API` left empty, and the enquiry form keeps posting where it always
has. For GitHub Pages that means a repository variable `PUBLIC_LINK_API` passed into
the Build step of `.github/workflows/pages.yml` (the snippet is in the Worker
README); that workflow change, like the deploy itself, waits for the owner.

Without either server the page still tries a direct image address, and otherwise asks
the visitor to save or paste the image; the link always travels with the enquiry brief.

## Rights and labelling

The sample room is a registered own photograph. The illustrative patterns are drawn
in code and labelled on the tile, on the canvas and in the download. A visitor's
sample, pasted image or linked image is theirs and stays in their browser; the API
keeps nothing beyond the five-minute image copy the Worker README describes. No maker artwork ships with the site.

## Run and check

```sh
npm run dev -- --host 127.0.0.1   # http://127.0.0.1:4321/atelier/
npm run check                      # includes tests/room-preview.test.ts and tests/link-preview.test.ts
npm run build && npm run check:dist
LEAD_API_ENABLED=1 npm run lead-api   # optional: the link route, on the private API (or see workers/link-preview/README.md)
```
