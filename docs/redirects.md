# Redirects

GitHub Pages does not emit an HTTP 301 for an arbitrary old path. A meta refresh is not a 301. This repository does not pretend otherwise.

Existing project aliases (`replaces` in a case study) are extra HTML pages with `noindex`, a canonical link and a meta refresh to the case study. They already shipped. They are not permanent redirects at the edge.

| Old path | Closest page | Status |
| --- | --- | --- |
| `/projects/owo-whitehall/` | `/projects/raffles-london-the-owo/` | HTML refresh already in the build |
| `/projects/four-seasons-ten-trinity/` | `/projects/four-seasons-ten-trinity-square/` | HTML refresh already in the build |
| `/projects/hilton-silverstone/` | `/projects/hilton-garden-inn-silverstone/` | HTML refresh already in the build |
| `/projects/hilton-holborn/` | `/projects/doubletree-west-end/` | HTML refresh, because the new case study replaces that slug |
| `/projects/the-lanesborough/` | `/projects/` | HTML refresh (src/content/retired-projects.json); the name stays in the hotel record on /projects/ |
| `/projects/biltmore-mayfair/` | `/projects/` | 404 page script: a draft may not have a built route (ai-layer and dist guards) |
| `/projects/penny-morrison-showroom/` | `/projects/` | 404 page script: draft since Dorin's 9 Oct decisions; no route may be built |
| The retired Regent Street flagship URL (brand never named) | `/projects/` | 404 page script; the brand may not appear in source or output |
| `/portfolio/`, `/about-3/`, `/contact-8/` | Projects, About, Contact | No 301 until the host can send one. Do not point them all at the homepage. |

Canonical host in the build is `https://www.mrwallcover.com`. Trailing slashes are always on. The certificate for the live domain was still being issued by GitHub when this branch was prepared, so HTTPS behaviour was not re-tested against production.

## Retired project URLs

`src/pages/404.astro` sends any unknown single-segment `/projects/<slug>/` URL to `/projects/` with `location.replace`. GitHub Pages serves 404.html for every unknown path, so this covers project URLs that can't have a stub of their own. It is still a 404 response, not a redirect at the edge.
