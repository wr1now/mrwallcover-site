# Repository alignment

Inspected `wr1now/mrwallcover-site` at `38bcc5bd9992155e0e9851544b361e282db14f56` on 9 October 2026. This is a documentation addition, not an application release.

The full recursive tree contained no AGENTS.md. Reviewed the README, architecture, owner guide, asset rights, redirects, package and Astro configuration, deployment workflow, content loader, public content guards, built-site guards, enquiry validation, material and area records, navigation and existing advice/professional pages. This was a targeted architectural and content review, not a claim to have audited every source line or media file.

## Existing foundation and the additions

| Existing implementation | Apply this pack by |
| --- | --- |
| Astro static build, Tailwind, Three.js | Retaining this stack; no WordPress plugin or framework migration |
| `src/pages/advice/index.astro` | Expanding the existing hub, with “Wallcovering Guide” as a possible display label |
| `src/pages/advice/quantities.astro` | Keeping the restricted calculator and linking the quantity article to it |
| `src/pages/professionals.astro` | Extending designers and commercial sections with a developer-specific route and copy |
| `src/content/materials.json` | Adding decision fields and comparisons to the existing seven family records |
| `src/components/MaterialStudio.astro` and `src/scripts/material-studio.ts` | Connecting useful guidance to the existing viewer; not rebuilding it by default |
| `src/scripts/shortlist.ts` | Reusing the existing saved selections; checking actual end-to-end enquiry propagation |
| `src/lib/content.ts` | Following its existing content-loading and draft-filter pattern; new guide drafts must be filtered explicitly |
| `src/lib/enquiry.ts` | Preserving email-or-phone choice and current audience contract; audiences are currently homeowner, designer and commercial |
| `src/content/areas.json` | Preserving Mayfair, Belgravia, Chelsea, Kensington, City of London and Cotswolds routes |
| `src/config.ts` | Keeping identity, contact, coverage and verification values centralised |
| `docs/asset-rights.md` | Respecting media scope, size, captions, credits and private-property restrictions |

## Enquiry capability: code versus production

The static site uses FormSubmit. The private store is implemented in `server/index.ts`, but the architecture document says it is off in the GitHub Pages build. A developer should not describe durable production storage as already active.

Current validation accepts `homeowner`, `designer` and `commercial`. A developer section can initially use `audience=commercial` with appropriate project context. Adding a new `developer` or `hotel` enum requires coordinated browser, validator and API changes. Do not pass an unrecognised value and assume it is stored.

Existing enquiry fields include programme and material responsibility. Reuse them. Only add missing professional fields after checking the actual form and notification payload. Upload capacity and delivery are provider-dependent; the private API's limits should not be advertised as the static FormSubmit path's limits.

## Discovery already present in source

- Canonical host: `https://www.mrwallcover.com`, with trailing slashes.
- `public/robots.txt` allows crawling generally, excludes `/thank-you/`, and points to `/sitemap-index.xml`.
- `@astrojs/sitemap` filters thank-you, error/search routes and old project aliases.
- A Google Search Console verification value is configured.
- An `llms.txt` endpoint exists. This is not evidence of ranking or a reason to replace ordinary HTML content.

Source settings are not proof of the production response. Production crawler access, canonical redirects, HTTPS and webmaster account verification still need observation. The earlier public retrieval failed; do not interpret that as a confirmed crawler block.

## Publication and privacy boundaries

`docs/` is not a website route. However, this GitHub repository is public: all documents committed here are publicly readable. These additions therefore contain no customer uploads, confidential project drawings, leads or private personal histories.

The ten guide files are editorial drafts in `docs/content/guides/`. Their proposed paths and frontmatter are a handoff convention, not an already-connected Astro collection. Move or load reviewed copies under `src/content/` during implementation, preserving review state and filtering drafts before routes, links and sitemap generation. Internal notes must not be rendered.

Preserve the repository's brand/privacy guard tests. Do not publish excluded names, street numbers, held hotel records or the telephone number in raw HTML. Do not broaden media permissions or aftercare commitments based on this pack.

## Release behaviour

The workflow runs on pushes to `main`, pull requests and manual dispatch. A pull request builds but does not deploy. A push to the documentation branch does not match the main push trigger. Merging to `main` publishes through GitHub Pages.

This change adds only documents. No production code, DNS, workflow or configuration is changed. A documentation-only validation checks ten complete drafts, unique proposed paths, explicit review state and links within the pack. Runtime tests become required when the guides and professional changes are wired into the site: `npm run check`, `npm run build`, `npm run check:dist`, followed by actual mobile/desktop and enquiry evidence.

## Remaining implementation

1. Review the ten drafts technically and add genuine, permitted detail photography where useful.
2. Load and render the guide collection under `/advice/`, using the existing Base and Breadcrumb components.
3. Add related material/service/professional links with accurate metadata and bylines.
4. Extend material records and comparisons using verified information rather than inferred product attributes.
5. Extend the professional page and intake using the current audience contract.
6. Validate build, accessibility, discovery settings and live enquiries. Decide separately whether to operate the private lead backend in production.
