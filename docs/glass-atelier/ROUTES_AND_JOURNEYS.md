# Routes and journeys (Glass Atelier, contract stage 3)

Inventory of every route the build writes to `dist/` at commit 62834f3 (branch `claude/glass-atelier-design-system-20261009`), built with a test `SITE_PHONE` so the phone and WhatsApp controls render. 73 HTML pages, 66 Markdown twins. Nothing here proposes a new route; the gaps at the end are observations for later stages.

## Route inventory (from dist/)

| Family | Routes | Notes |
|---|---|---|
| Home | `/` | Hero, proof strip, five parts, selected work, materials teaser, professional and homeowner routes, FAQ, footer |
| Services | `/services/` and 11 pages: `acoustic-wallcovering-installation`, `architectural-film-wrapping`, `exterior-works`, `fabric-walling`, `grasscloth-installation`, `hand-painted-wallpaper-installation`, `hotel-wallcovering-installation`, `joinery-wallcoverings-and-panels`, `mural-installation`, `silk-wallcovering-installation`, `window-film` | Hub anchors `#surveying #management #supply #installation #aftercare #materials` |
| Materials | `/materials/` and 7 pages: `paper-and-non-woven`, `grasscloth-and-weaves`, `silk-and-textiles`, `hand-painted`, `murals`, `contract-vinyl`, `acoustic` | Hub has the material finder and the shortlist (client-side, no account) |
| Projects | `/projects/` and 15 published case studies: `browns-hotel-mayfair`, `raffles-london-the-owo`, `four-seasons-ten-trinity-square`, `trematon-castle`, `old-bailey-hotel`, `doubletree-west-end`, `house-of-hackney-st-michaels`, `pimlico-st-georges-square`, `inverness-terrace`, `north-london-residence`, `calico-ahluwalia-estuary-rosewood`, `calico-beverly-1975-cadence`, `calico-lee-broom-overture`, `heathrow-terminal-4-calico`, `hilton-garden-inn-silverstone` | Index anchors `#hotels #hotels-homes #design-weeks`. Drafts not built: `biltmore-mayfair`, `doubletree-victoria`, `penny-morrison-showroom` |
| Project aliases | `/projects/owo-whitehall/`, `four-seasons-ten-trinity/`, `hilton-silverstone/`, `hilton-holborn/` | Meta-refresh + canonical to the new slug, noindex, excluded from sitemap |
| Professionals | `/professionals/`, `/professionals/designers/`, `/professionals/developers/`, `/professionals/hotels/` | Each has a CSV schedule download under `/downloads/` and a guide link |
| Advice | `/advice/`, `/advice/quantities/` (estimator) and 9 guides: `choosing-wallcoverings`, `designer-specification-checklist`, `developer-wallcovering-package`, `grasscloth-seams-and-variation`, `hand-painted-murals-set-out`, `hotel-wallcovering-specification`, `installation-cost`, `wall-preparation`, `wallcovering-problems-and-aftercare` | Nav label is "Guide" |
| Areas | `/areas/` and 6 pages: `mayfair`, `belgravia`, `chelsea`, `kensington`, `city-of-london`, `cotswolds` | |
| About, aftercare, contact | `/about/` (`#dorin`), `/aftercare/` (`#support` form, variant `aftercare`), `/contact/` (full enquiry form), `/faq/`, `/thank-you/` (noindex) | |
| Utility | `/search/` (noindex, client-side), `/404.html`, `/accessibility/`, `/privacy/`, `/for-ai/` | |
| AI and feed files | `/llms.txt`, `/llms-full.txt`, `/facts.json`, `/feed.xml`, `/sitemap-index.xml`, `/sitemap-0.xml`, `/robots.txt`, `index.md` twin beside every indexable page | Postbuild `scripts/build-ai-layer.mjs` |
| Static | `/og.jpg`, `/favicon.svg`, `/apple-touch-icon.png`, `/CNAME`, `/_headers`, the Search Console token file, `/downloads/*.csv`, `/media/**`, `/_astro/**` | |

Editorial pages in `src/content/pages/` (`calico-wallpaper-installer`, `cost-guide-2026`, `house-of-hackney-wallpaper-installer`, `reviews`, `timorous-beasties-installer`, `trade`) are all draft and not built.

## Enquiry paths that exist today

- `/contact/` is the single enquiry form. Query prefill is read by the form script: `?audience=homeowner|designer|developer|hotel|commercial` and `?intent=install|source|advice|prepare|repair`.
- `/aftercare/#support` is a second instance of the same form (variant `aftercare`, subject "Aftercare note"), kept apart from new-installation leads.
- Phone reveal and WhatsApp (header, mobile dock, footer, contact column) exist only when `SITE_PHONE` is set at build time.
- Email `info@mrwallcover.com` is the no-JS fallback on every form.

## Five journeys

### 1. Homeowner
Entry: `/` hero, an area page from local search, or a guide (`/advice/choosing-wallcoverings/`, `/advice/installation-cost/`).
Pages: `/` → "Wallpaper already purchased" → `/contact/?intent=install`; or `/materials/` → material page → `/contact/?intent=source`; `/advice/quantities/` for a rough quantity; `/projects/pimlico-st-georges-square/`, `/projects/inverness-terrace/`, `/projects/north-london-residence/` as residential proof.
Enquiry: `/contact/` with audience Homeowner and intent prefilled where the link carried it. Dock "Start" on mobile.

### 2. Interior designer or architect
Entry: `/professionals/` from the nav, `/professionals/designers/` from search, or `/advice/designer-specification-checklist/`.
Pages: `/professionals/designers/` → specification schedule CSV → guide → `/projects/` (Brown's, The OWO, Four Seasons, House of Hackney) → `/materials/` shortlist.
Enquiry: `/contact/?audience=designer&intent=install` with files (drawings, schedule) attached.

### 3. Developer, main contractor or QS
Entry: `/professionals/developers/`, `/advice/developer-wallcovering-package/`, or `/services/hotel-wallcovering-installation/`.
Pages: package schedule CSV → guide → `/services/` (`#supply`, `#management`) → `/projects/#hotels`.
Enquiry: `/contact/?audience=developer&intent=install`; "Other commercial project" is available for non-hotel sites.

### 4. Hotel or commercial operator
Entry: `/professionals/hotels/`, `/services/hotel-wallcovering-installation/`, `/advice/hotel-wallcovering-specification/`, or `/projects/#hotels`.
Pages: room and phase schedule CSV → guide → hotel case studies (`browns-hotel-mayfair`, `raffles-london-the-owo`, `four-seasons-ten-trinity-square`, `old-bailey-hotel`, `doubletree-west-end`, `hilton-garden-inn-silverstone`) → `/materials/contract-vinyl/`, `/materials/acoustic/`.
Enquiry: `/contact/?audience=hotel&intent=install`.

### 5. Aftercare or repair
Entry: `/aftercare/` from the footer, home "five parts" strip, or `/advice/wallcovering-problems-and-aftercare/`.
Pages: `/aftercare/` care-by-material section → `#support`.
Enquiry: the aftercare form on the same page (photographs, reference), or `/contact/?intent=repair` from the full form. Reaches the same inbox with a distinct subject.

## Gaps seen (observations only, no routes added in this slice)

1. Material pages and project pages link to `/contact/` without `?intent=` or `?audience=`, so the prefill that the hubs and home use is lost on the pages most likely to convert.
2. Aftercare and repair have no top-level nav or dock presence; the only routes in are the footer and the home strip. The dock's four slots are Start, Projects, WhatsApp, Phone.
3. The nav label "Guide" and the footer label "Wallcovering Guide" name the same `/advice/` family differently.
4. `/search/` is client-side only and noindex; the 404 page offers the six nav links but no search box.
5. Project aliases rely on a meta refresh. GitHub Pages cannot serve the `_headers` or Netlify redirects, so the alias pages stay as built HTML; fine, but the canonical should be re-checked after any slug change.
6. The home page lists 15 project links before the "Wallpaper already purchased" and sourcing routes are repeated; the first enquiry path is in the hero, the second is far down.
7. Developer and QS visitors have no example of a tender return or package scope on the site; the CSV schedule is the only artefact.
8. Draft editorial pages (trade, cost guide, maker installer pages, reviews) would serve journeys 1 to 3 when their claims are approved; they remain correctly unbuilt.
