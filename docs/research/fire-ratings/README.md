# Wallcovering fire ratings: research behind /advice/wallcovering-fire-ratings-uk/

Prepared 15 October 2026 for Mr Wallcover's public reference page "Wallcovering Fire Ratings: British Standards and Commercial Specification". This folder is public (the repository is public): it holds no client information, no competitor names and no copies of paid standards or manufacturer documents.

**Status.** Researched, implemented, checked by an independent AI reviewer and then by a second, adversarially verified multi-agent review; the owner has approved the recorded wording and maintenance decisions. Final publication is still subject to the release PR and its checks. It is general specification guidance, not professional fire-engineering approval. No human fire engineer has reviewed it.

## Where things are

| Path | What it holds |
| --- | --- |
| `src/data/fire-ratings/sources.json` | The source register: every document the page cites, with issuer, reference, issue, effective and stated-expiry dates, URL, checking date and SHA-256 of the file read |
| `src/data/fire-ratings/standards.json` | Standards table (editions from BSI catalogue records) and the class decoder (from Delegated Regulation (EU) 2016/364 and Approved Document B) |
| `src/data/fire-ratings/regulations.json` | England's Table 6.1 summary and the four UK jurisdictions |
| `src/data/fire-ratings/products.json` | The 26 public product rows (one per product or family, never per brand) |
| `src/content/fire-ratings/` | The page's prose, FAQ, checklists and scope note |
| `src/lib/fire-ratings.ts`, `src/lib/fire-classification.ts` | Loader, validation (run at build and in tests) and the class parser |
| `src/pages/advice/wallcovering-fire-ratings-uk.astro` | The page |
| `tests/fire-ratings.test.ts`, `tests/fire-ratings-build.test.ts` | Data and built-page tests |
| `scripts/check-fire-sources.mjs` | On-demand source and link check (`npm run check:fire-sources`) |
| `uk-regulations.md` | Agent A: England, Wales, Scotland and Northern Ireland, with page references |
| `standards-and-terminology.md` | Agent B: standards, class definitions, legacy classes, markings, other systems |
| `manufacturers/*.md` | Agents C–F: Muraspec, Tektura, Vescom, Arte International, Newmor; every product examined, not only those shown on the page |
| `claims-register.md` | Each public claim on the page, with its source |
| `conflicts-and-gaps.md` | Conflicts found, evidence gaps and questions to put to each maker |
| `verification-report.md` | The independent reviewer's findings and how they were resolved |

There is one source of truth. The page, its tables, the Markdown twin and `llms.txt` read the JSON files above; product claims are never typed into the article by hand. The full machine-readable research records produced by the agents are kept outside the repository (they contain long working notes); the Markdown files here summarise them.

## Method

1. **Research (15 October 2026).** Six Sonnet research agents worked in parallel, each writing its own files: A, UK regulations; B, standards and terminology; C, Muraspec; D, Tektura; E, Vescom; F, Arte International with Newmor as a supplementary maker. Each recorded source URLs, document references, dates, page references, scope, limitations, conflicts and open questions. The desktop app restarted once during the work; the agents resumed from their transcripts and re-downloaded what they needed.
2. **Rendered pages.** PDFs were downloaded to a temporary folder, hashed and read as rendered pages (a small PDFKit page extractor was used because the usual renderer was not installed). Pages read only as extracted text are marked as such in the agents' notes.
3. **Lead verification.** The lead read the rendered pages of England's 2025, 2026 and 2029 amendment booklets, the cover, Section 6, Table 6.1 and Appendix B of the current Volume 2, and Appendix B and Table B1 of the previous edition, before writing the England sections.
4. **Synthesis.** The lead selected 26 product rows (six each for Muraspec, Tektura and Vescom, five for Arte, three for Newmor) that show genuinely different products, documents and gaps, and rewrote all public wording.
5. **Independent review.** A separate Sonnet agent, which wrote none of the material, reopened the primary documents for every public regulatory assertion and product row (`verification-report.md`).
6. **Second review.** Five finder agents, one per dimension (regulations; standards and wording; Muraspec, Arte and Newmor rows; Tektura and Vescom rows; page quality, including the built HTML and Markdown twin), each followed by a separate agent told to refute every finding against the rendered documents, and a final completeness critic. Every confirmed finding was fixed or recorded; `verification-report.md` section 5 lists each one and its resolution.

## Evidence rules applied

- Primary sources only: government publications and legislation, BSI catalogue records (metadata only; no paid text read), manufacturer documents and named test or classification bodies.
- The class is recorded exactly as printed and separately as a notation; a missing smoke or droplet subclass stays unknown.
- Document type is recorded exactly (declaration of performance, classification report, test report, certificate, technical sheet, web page).
- Conflicts are shown, not resolved by choosing the strongest claim. Where two documents give different classes, the row shows both and no single class.
- Issue, effective and stated-expiry dates are kept apart from our checking date. No expiry is invented; a printed period ("five years from") is converted to its end date, and the page quotes the printed wording beside it.
- No brand-wide ratings. Window films and acoustic panels in combined documents are kept out of wallcovering rows.
- Printed fire lines are reproduced in full, as short factual data, so a reader can compare a row with the maker's document. Longer passages are paraphrased.
- Where a document gives a validity period rather than a date, the gap beside the row quotes the printed wording and names the document.

## Review and maintenance

**Ownership (owner's decision, 17 October 2026).** Dorin Burcus (founder) owns the review and approves the public wording. Second checks are done by someone other than the author, as the owner decided for the site's guides.

**Cadence: quarterly** (run `npm run check:fire-sources` every quarter), and also whenever one of these is due. The public page makes no review promise; it shows only each row's "last checked" date.

- a stated validity date in `sources.json` passes or falls within 90 days (for example certificate 0493-CPR-W038 on 28 July 2029, Centexbel report 19/721 on 28 July 2027, and the certificate expiry dates listed in Muraspec's declarations, from November 2026 to January 2028);
- a regulatory date passes: England's 2029 fire-resistance amendments take effect on 2 September 2029; Wales's promised move of national classes into an appendix; a new Scottish handbook or Northern Irish amendment;
- a maker publishes a new declaration, report or sheet for a product on the page.

**Procedure.**

1. Run `npm run check:fire-sources` (add `-- --hash` to re-hash PDFs). It reports broken or moved links, changed documents, passed or near expiry dates, effective dates passed since the last check and sources not opened for a quarter. It changes nothing.
2. Reopen each flagged document. Update the record in `src/data/fire-ratings/` and its research note here.
3. If the visible guidance changes, update `updated` in `src/content/fire-ratings/page.json` (it drives the visible date, the Article schema and the sitemap `lastmod`); if only the checking dates change, update `accessed`, `checked` and `scope.sourcesChecked`.
4. Run `npm run check`, `npm run build`, `npm run check:dist` and open a pull request for review. Fire guidance is never updated or published automatically, and no recurring job has been set up.

## Historical publication state (15 October 2026)

Implemented on branch `feat/wallcovering-fire-ratings-uk`, stacked on draft pull request #62. Not merged, not deployed, not indexed. See `PLANS.md` for the remaining publication steps.

## Independent release — 17 October 2026

The earlier implementation in PR #64 depends on the draft calculator (#62). This release extracts the reviewed reference from head `6960fc2` onto the shared visual foundation (#66, initially `28bd059`, updated through final `a8cbe54`) without the draft calculator, materials dataset, analytics setup or their history. It supplies a small `/wallpapering/` hub linking only to existing published guides and the fire reference. The original #64/#65 stack is preserved for later reconciliation.

A focused release review corrected two further points: the Muraspec woven Type I row now shows the conflicting smoke subclasses as unresolved, and the overview retains the narrow firefighter-facilities maintenance exception for shared parts in Scotland and Northern Ireland. This work is AI evidence review, not professional fire-engineering approval. See `docs/research/fire-ratings/release-review.md` for final checks and the release order.

On 17 October 2026 the owner authorised merging #66 and #68 after their publication gates, then deploying and verifying the live fire page, navigation and contact journey. #66 is merged as `07c1e864`; #68 is reconciled with that main tree and awaiting its final hosted gate before merge. The release PR records the eventual deployment and live-verification receipt; no indexing result is asserted here.
