# Wallcovering Installation AI Crawler

The resource at `/wallcovering-installation-ai-crawler/` supports a practical shortlisting decision: whether published experience fits a commission, what to confirm before appointment and how to prepare a useful enquiry. It uses ordinary, indexable HTML, readable without JavaScript or a special user agent. Deployment access controls are separate: a private Sites preview remains private. The same shared data produces three static JSON endpoints:

- `/ai/business.json`: the public identity, founder, contact email, coverage, workflow and service pages.
- `/ai/projects.json`: published project roles, clients, locations, project periods, materials, record dates, reference URLs and photo credits.
- `/ai/decision-guide.json`: conditional client/project fit, linked installation experience, material trade-offs, full delivery stages, complete aftercare terms, procurement checks and a blank briefing template.

`src/lib/ai-crawler.ts` contains the allowlisted public projection and selected installation-section extraction. `src/lib/ai-decision-guide.ts` assembles decision guidance around those records. `src/data/facts.json`, existing service/area/material/aftercare content and the published `projects` and `caseStudies` collections remain authoritative. Change those sources; do not edit generated JSON. Draft case studies stay out. The `sourceBySlug` lookup also rejects draft references before they can reach an endpoint. Decision guidance fails the build if a named evidence project is unpublished.

## Meaning of the fields

`schemaVersion` is `1.1`. The additive revision introduces `resourceReviewed` (10 October 2026), the decision guide, full workflow paragraphs and installation extracts. This is the editorial review date of the resource; it does not change the underlying business fact-sheet review date. `projectDates` retains the literal project period from the portfolio, including partial or descriptive dates. `published` and `updated` are the dates of the written case study, never the date the build ran. Missing dates, materials and photograph credits remain `null`; they are not inferred. An empty reference list means no URL was recorded in that source.

`url` identifies the published project page and `references` lists HTTP(S) links already cited within its published body. References can document a building, a material or the context of a photograph. They are not assertions that those sources verify Mr Wallcover's installation role. Photo `sourceUrls` are extracted only from the existing credited-media provenance notes. The complete private/editorial notes are not exposed. The exact gallery credits are retained; missing credits are not replaced with guessed ownership or permissions.

`installationRecord.sections` extracts only specifically named scope, approach and outcome sections from published case studies. It retains the source words and numbers while removing Markdown presentation syntax. The basis is explicitly **company-reported**. General building-history sections are not classified as installation evidence. Additional event sections preserve the distinction between a venue install and panels papered in a workshop. Missing sections remain absent rather than receiving a fabricated outcome.

Material `relatedServiceProjects` are service-page cross-references, labelled as such in HTML and JSON. They do not establish that every linked project used a material family. This matters particularly for Brown's: the named Adam's Eden product is printed non-woven; its presence on the scenic-installation service page is not evidence of hand-painted paper. Exact installed products remain in the project dataset. Material appearance, joins, care, handling and selection trade-offs come directly from the material library.

The decision guide reproduces all five delivery stages in full and copies the source aftercare blocks exactly, including workmanship coverage, building/substrate/damp exclusions, later damage and cleaning exclusions, natural seam variation, inspection and repair-callout conditions. Availability, quotation, contracting identity, insurance, current credentials and project performance acceptance are presented as items to confirm for the commission. The fit matrix is conditional and carries no invented score.

The handoff template is an unsent briefing document. Unknowns start as `null`; sharing permission starts as `false`. It exposes no submission API and triggers no transmission. A client reviews the completed brief and chooses the contact form or public email. Personal information or documents are added only when authorised for sharing.

No private phone, environment values, unverified endorsement, price, rating, availability promise or image licence is introduced. The source page contains the interpretation notes and the same project data as the JSON. References and credits use native HTML `details`, which remains readable without scripts. Canonical addresses continue to use `https://www.mrwallcover.com`.

## Discovery and compatibility

The old `/for-ai/`, `/facts.json`, Markdown twins, `/llms.txt`, `/llms-full.txt`, Atom feed and sitemap remain available. `/for-ai/` and `/llms.txt` link to the named resource and JSON files. Astro includes the new HTML page in the sitemap. The existing post-build process writes its Markdown twin and includes it in the full-text file. No new build step, bot-specific response, crawler bypass or indexing guarantee is involved.

For an assistant researching the business: start with the named page or business JSON, read the project JSON when evidence is relevant, then cite the individual project URL. Refresh the source before relying on a role, project period or service. Use the contact page for project-specific pricing and availability.

## Validation

After `npm run build`, run `node --experimental-strip-types --test tests/ai-crawler.test.ts`. It compares the rendered HTML and generated JSON with original facts, service/area/material/aftercare content and every published case study. It checks exact roles, dates, materials, references and image credits; excluded drafts; unknown values; canonical addresses; existing entry-point links; sitemap and Markdown discovery; and private-field omissions. Decision tests check complete HTML/JSON parity, the accessible comparison table, all internal evidence/source links and anchors, the exact unsent template, full guarantee inclusions/exclusions and the installation extracts. The broader `npm run check` and `npm run check:dist` guards remain required.

The JSON endpoints are generated by Astro during the existing build. No additional script or scheduled refresh is needed. Rebuild and deploy after source content changes. Endpoint availability on a deployment must be verified separately from local build success.
