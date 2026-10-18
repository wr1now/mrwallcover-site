# Designer portal

Status: implementation for review; private services require separately verified staging activation.
Decision date: 18 October 2026.

## Decision

Keep the public Astro website on Pages. A route-local React application uses a verified-email Supabase API, Postgres and private Storage. A deterministic TypeScript engine prices confirmed scope using versioned owner-approved installation profiles. Python workers inspect documents and produce estimate PDFs. Documents and worker outputs never enter the public build.

This follows the existing website's cloud-service pattern without merging the unfinished Room Studio feature. A contact-form attachment relay cannot provide studio permissions, immutable revisions or auditable pricing. A full website replatform is unnecessary.

## Commercial contract

- The public catalogue is an allowlisted guide, not the private pricing configuration.
- Resolve one installation profile from the actual product/construction/instructions. Collection inheritance requires matching evidence. Velvet, relief and acoustic descriptions do not stack percentage surcharges.
- Eligible standard fabric: £120/net covered m², including normal preparation, lining and hanging labour. Specialist fabric products require their own approved profile.
- Wide contract vinyl: approximately £26/m² is public guidance only. The project must have an approved agreement for hanging on prepared walls.
- Feature walls and single rooms use approved project packages, never a square-metre fallback. Setup, positive labour hours/rate, surveying and management components must all be configured. A legacy package total is retained only as reference; it cannot establish today's package price.
- Wallcoverings, lining, primer and adhesives are client supplied. VAT is additional; the normal configured rate is 20%.
- Deduct openings and include covered reveals. Ordered material/waste quantities are separate from labour area.
- Survey, management and additional preparation are approved hour/day/visit allowances. Property value is confidential assessment context, never a price multiplier. Package inclusions and separately charged services cannot overlap.
- Road charges are deduplicated per actual vehicle/date/scheme. Installation days do not create vehicle attendance or parking automatically.
- A missing price, unclear specification or unapproved allowance produces information/review required, never a completed zero-price estimate.
- Issued estimates retain their source revision and rate version. A changed product, preparation or access condition cannot retain incompatible approval. Default budget validity is 30 days. Firm quotes remain reviewed.

## Data and trust

The API authenticates against Supabase Auth rather than trusting decoded client claims. Studio membership controls project access; staff privileges come from the separate staff allowlist. Only staff with the required owner role can approve commercial configuration. Client-supplied drafts cannot supply their own rates or approval flags.

Documents start in quarantine. Upload completion creates a verification job; it does not declare the file safe. A bounded parser and local ClamAV scan must pass before extraction/download. Native CAD/BIM/programme sources remain marked for specialist review. Office macros/embedded executable objects are rejected; formulas without cached values are never converted to zero. Extraction returns cited, unconfirmed evidence. It never derives geometry from a printed scale alone or treats source instructions as commands.

Jobs use transactional leases, bounded attempts and idempotent identities. PDF output paths include the attempt's lease token so a stale attempt cannot delete another attempt's completed output. The queue carries references; document bytes are read and written directly in private Storage.

An estimate share is a separate, expiring, revocable grant. Only the safe estimate projection is returned: work, assumptions, totals and project identification. Contact details, property value, internal cost/rate configuration and original documents are excluded. Share tokens use the URL fragment so they are not sent as website request paths. The application route is noindex, excluded from the sitemap/public corpus, and disables analytics.

## Project scope and private learning

The workspace retains building type, floors/rooms, measured walls or ceilings, openings/reveals, product references, programme phases, material readiness and vehicle attendance. Missing dimensions can be saved as incomplete placeholders; they cannot produce a complete budget. Material requirements, preparation actions, sample decisions and aftercare references are separate typed resources. Original-document references are checked against the current project; checked samples and issued aftercare require verified documents. Relevant changes invalidate the bound assessment, including a changed site address.

Historical scopes, completion observations and pilot comparisons have separate private records. Owner-reviewed imports preserve source hashes and page/cell citations, distinguishing selling amounts, worker costs, alternatives, duplicate totals and genuinely unpriced work. The importer has no rate-card mutation path. Staff can append actual person-time and vehicle/cost observations; corrections preserve the previous record. Owner review can propose changes but never updates selling prices automatically. Package-time comparisons use the exact template identity and frozen configuration version, not a matching label or an inferred labour allowance from an area rate.

An owner pilot comparison starts with a blank independent current-price breakdown and explicit scope checks. It preserves expected and calculated category totals, VAT, tolerance and differences against an immutable issued estimate. Offsetting errors between service categories cannot pass on the gross total alone. Synthetic local comparisons prove this mechanism; they do not constitute the required commercial pilot.

## Known activation requirements

No Supabase project, email sender, Modal service, billing limit or live model is provisioned by the source change. Production credentials are not stored here. Stage and verify authentication, RLS, Storage, scanner/image compatibility, worker leases, PDF generation, sharing and provider spending controls before activation.

Only the two expressly supplied guide rates are seeded. Small-job allowances, additional product rates, current survey/management prices, project eligibility and private parking arrangements need owner configuration. Existing archived estimates are evidence of structure, not current price approval. Real historical scopes stay in private research and must never be copied to this repository.

Optional AI extraction is off. The initial worker performs bounded text/Office extraction and local image OCR; scanned PDF pages with no extractable text request a readable export/manual review. No automatic take-off accuracy or acoustic/fire performance is asserted.
