# Redirects

GitHub Pages does not emit an HTTP 301 for an arbitrary old path. A meta refresh is not a 301. This repository does not pretend otherwise.

Existing project aliases (`replaces` in a case study) are extra HTML pages with `noindex`, a canonical link and a meta refresh to the case study. They already shipped. They are not permanent redirects at the edge.

| Old path | Closest page | Status |
| --- | --- | --- |
| `/projects/owo-whitehall/` | `/projects/raffles-london-the-owo/` | HTML refresh already in the build |
| `/projects/four-seasons-ten-trinity/` | `/projects/four-seasons-ten-trinity-square/` | HTML refresh already in the build |
| `/projects/hilton-silverstone/` | `/projects/hilton-garden-inn-silverstone/` | HTML refresh already in the build |
| `/projects/hilton-holborn/` | `/projects/doubletree-west-end/` | HTML refresh, because the new case study replaces that slug |
| `/portfolio/`, `/about-3/`, `/contact-8/` | Projects, About, Contact | No 301 until the host can send one. Do not point them all at the homepage. |

Canonical host in the build is `https://www.mrwallcover.com`. Trailing slashes are always on. The certificate for the live domain was still being issued by GitHub when this branch was prepared, so HTTPS behaviour was not re-tested against production.
