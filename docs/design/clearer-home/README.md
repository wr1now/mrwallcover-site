# Clearer homepage and shared design — 19 October 2026

The owner requested a shorter introduction while preserving the complete published record on appropriate subject pages. This release starts from public main `40ee3d7e1985a360d2241855ce6aa13bc7ea801a`.

The homepage has seven sections. Extended practice/process copy is at `/practice/`, project stories, galleries and films are on `/projects/`, and enquiry choices sit after the contact form. Existing FAQ and Materials studio remain on their canonical routes. Native project disclosures open for direct fragment links. All 15 removed homepage anchors forward to their canonical destinations; eight existing anchors stay on the homepage. The shared header has six buyer links; reference utilities remain in the footer.

Shared typography uses serif display, 18px reading text and 15px detail/control text. Phone pages keep visible linen and hide botanical layers. Meaningful physical 3D studies remain; routine calendar/document questions use full-width typography. Makers cards show 20 registered work photographs: 13 directly evidenced maker installations and 7 explicitly labelled contextual craft examples, with actual maker/site captions. No new claim of maker endorsement or installation was introduced.

## Preservation evidence

- [Exact relocation ledger](content-relocations.json): 278 block occurrences, 55 real image/video occurrences, 82 hrefs, 23 fragment translations and 6 exact FAQ items at recorded destinations; all 483 source selectors independently verified against baseline HTML.
- [Independent published-content proof](content-preservation.json): 197 authored blocks, 81 public links, 46 photo identities with original alt text, 3 films and 6 visible/schema FAQ pairs. Content must exist in indexable page main content; JSON inventories and noindex archives do not qualify.
- [No-loss report](no-loss.json): checks both the fixed relocation inventory and actual baseline homepage, plus existing sitemap, project/media, schema and AI boundaries. 128→129 published pages and Markdown twins; 3,629 public media files preserved.
- [Typography/navigation audit](typography-navigation.json): 28 route/width cases, keyboard menus and actual phone-enabled controls.

## Visual evidence

[Homepage desktop](after-home-1440.jpg) · [Homepage phone](after-home-390.jpg) · [Selected hotels](after-selected-work-1440.jpg) · [Makers](shared-makers-1440.jpg) · [Context caption on phone](shared-makers-context-390.jpg) · [Questions](shared-questions-1440.jpg) · [Guide on phone](shared-guides-390.jpg)

[Local before/after measurement](composition.json) uses the same uncompressed static environment and viewport. Main content shrank from 21.39 to 4.68 screens at 1440×900, and 36.72 to 6.90 screens at 390×844. The final cold checks recorded CLS 0. These measurements describe page composition and local transfers, not field speed.

Reproduce: `CHROME_PATH=/path/to/chrome node scripts/qa/clearer-home.mjs --before=/path/to/baseline/dist --after=dist`. Build production with the documented reserved phone fixture to reproduce public channel availability; the actual deployment retains its existing secret.

## Release status

Local source, build and browser checks are recorded in the current section of [page-review.md](../page-review.md). Hosted checks and the live deployment must be verified before this is described as published. No unrelated draft, private seed or publication blocker is cleared by this design change.
