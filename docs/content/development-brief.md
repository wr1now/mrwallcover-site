# Mr Wallcover — Wallcovering Guide and development brief

Prepared 9 October 2026. Ten first-edition article drafts, customer decision data, professional page copy and an implementation contract.

Status: original editorial and build specification. The branch implementation is described in [implementation status](implementation-status.md); it has not been deployed. Dorin should review the technical advice and any wording presented as Mr Wallcover's practice before publication. Repository inspected at main commit 38bcc5bd9992155e0e9851544b361e282db14f56. Preserve the existing Astro implementation and reconcile these additions with current code. Production rendering and delivery remain unverified.

## 1. Direction

Use “Wallcovering Guide” as the public navigation label. Within it, organise articles under Choosing, Preparing, Planning and Caring. It should feel like advice from someone who understands the work, rather than a stream of search-engine posts.

The important question is not just “What colour do you like?” It is “Will this material give you the finish you expect, in this room, with this level of use and this budget?” Connect every guide to a material family, relevant service and enquiry route. Keep the articles freely readable in HTML; downloadable versions can be supplementary.

Use the premium visual system from the redesign brief: generous typography, real room photographs, useful close-ups and glass controls for navigation or selection. Keep article text on a calm, opaque surface. Avoid autoplay effects in reading pages.

## 2. Search and ChatGPT discovery

There is no required plugin and no guaranteed placement in ChatGPT. OpenAI says public websites can appear in ChatGPT search and recommends allowing OAI-SearchBot. Search access and GPTBot training access are independent choices. See the official sources at the end.

Recommended implementation:

1. Inspect the actual production robots.txt, page robots directives, canonical URLs, HTTP responses and sitemap. Check CDN/firewall behaviour as well as source code. A tool's failed fetch is not proof that OpenAI is blocked.
2. Ensure public, intended-for-search pages are accessible to OAI-SearchBot, with any firewall exception based on OpenAI's current published IP ranges. Never disable security across the whole site just to admit a crawler.
3. Keep private enquiries, uploads and customer records behind access controls. Robots.txt is not access control. Do not override private-route exclusions with an indiscriminate Allow rule.
4. Deliver headings, summaries, material facts and complete guide copy in initial HTML. An animated canvas must not be the sole source of information.
5. Maintain an XML sitemap of canonical public URLs. Validate the sitemap against the built routes. Verify Google Search Console and Bing Webmaster Tools when the owner has access; submit the sitemap through those services. These are search maintenance steps, not guarantees of ChatGPT inclusion.
6. Add structured data that matches visible facts: an appropriate business entity, services, Article and BreadcrumbList. Product data belongs only on genuine product pages. Do not invent reviews, stock or prices to fill schema fields.
7. Establish one consistent public identity, operating area, service scope and contact route. Confirm legal/trading details instead of copying old information.
8. Track received and qualified enquiries attributable to ChatGPT referrals, not only visits. OpenAI documents the utm_source=chatgpt.com referral parameter. Preserve attribution without collecting unnecessary personal information.
9. Keep any existing llms.txt accurate if retained. Treat it as an optional summary, not an indexing mechanism or a ranking promise. Google explicitly says new AI text files and special schema are unnecessary for its AI search features.
10. Check crawl and enquiry evidence after release. Report what was observed; avoid calling a manual search a reliable ranking measure.

The current repository uses Astro, Tailwind and @astrojs/sitemap. Its robots.txt allows public crawling with a thank-you exclusion, and its configured canonical host is https://www.mrwallcover.com. A Search Console verification tag already exists in configuration. Verify production behaviour before declaring these live. WordPress SEO plugins would only make sense on a WordPress installation. An on-site chatbot, custom GPT or ChatGPT app would be a separate customer tool; it would not make public search recommend the business automatically.

## 3. What each material record needs

Separate general material-family guidance from verified product information. A grasscloth family page cannot stand in for the care instructions, dimensions or certification of a particular product.

| Field group | Public information | Evidence and operational rule |
| --- | --- | --- |
| Identity | Manufacturer, collection, product code, colourway, family and backing | Named products need a current manufacturer reference; inspiration must be labelled |
| Appearance | Pattern scale, texture, sheen, panel/joint character and colour variation | Use rights-cleared images; explain that screen colour is approximate |
| Room fit | Suggested uses, traffic considerations, splash/humidity limitations and suitability caveats | Distinguish an editorial suggestion from a manufacturer approval |
| Care | Actual cleaning category, method and restrictions | Link to the exact product's instructions; unknown is not washable |
| Dimensions | Usable width, roll or panel dimensions, sale unit, repeat and match type | Store units explicitly; distinguish repeat from usable drop length |
| Installation | Hanging direction, substrate requirements, preparation and adhesive reference | Product instructions take priority; do not publish one universal adhesive recipe |
| Quantity | Ordering constraints, panel sequence, minimums and waste assumptions | Unsupported layouts require review; do not calculate murals as generic rolls |
| Commercial documents | Applicable fire test/classification documentation, care sheets and substantiated environmental information | Record the exact document, product, revision and conditions; no family-wide compliance badge |
| Supply | Sample route, supply status, lead-time basis and availability timestamp | Confirm supply rights and current availability; do not scrape a supplier's stock promise |
| Cost | Approved price basis or request-quote route; material and installation distinguished | State currency, unit, date and VAT basis where a price is shown |
| Alternatives | Visual, practical or cost alternatives and the reason for the comparison | An alternative is not automatically technically equivalent |
| Evidence | Real installed examples, captions, scope and image rights | Context photos and concept renders must be labelled |

In the editor, also store source URL, document revision, last-checked date, reviewer, verification status, image licence and publication status. Unknown fields should stay visibly unknown or absent. Structured uncertainty is much better than a guessed answer.

### The selection journey

Ask for room/use, approximate light, traffic, desired appearance, attitude to visible natural panels, cleaning needs, dimensions if known, budget band and timing. Allow “not sure” throughout. Do not require contact details just to explore.

Return two or three suitable families with a short explanation, a compromise to consider and a suggested next step. For example: “Natural grasscloth gives this room texture, but the panels remain part of the finished appearance. If you want a more uniform surface, compare a woven-look vinyl.” This is a conceptual comparison, not approval of an unidentified product.

Do not return a hard recommendation for fire performance, wet-area use or cleaning chemicals without verified product information. Offer sample review or a specification check. Carry the customer's shortlist and answers into the enquiry so they do not repeat the work.

## 4. Coverage: rooms, audiences and geography

Cover living rooms, bedrooms, dining rooms, studies, entrance halls, stairs, cloakrooms and suitable bathroom locations; separately address hotel bedrooms, corridors, restaurants, reception areas and communal interiors. Organise by both appearance and practical use.

Geographic coverage should follow where the team actually works. Current source coverage is London and surrounding areas, with UK-wide selected projects. Existing area pages cover Mayfair, Belgravia, Chelsea, Kensington, the City of London and the Cotswolds. Retain those routes; additional coverage needs confirmation. Do not infer a branch office from a completed job. Do not advertise same-day service, nationwide teams or permanent Cotswolds coverage without operational support.

Create location pages only when there is a distinct useful reason: genuine project evidence, access/logistics information or a service arrangement. Avoid dozens of pages with interchangeable place names. Keep exact private addresses out of case studies.

## 5. Ten launch guides

| No. | Title | Main reader | Suggested slug |
| --- | --- | --- | --- |
| 1 | How to choose wallpaper you will still like once it is on the wall | Homeowners | choosing-wallpaper |
| 2 | Grasscloth: understand the seams before you buy | Homeowners and designers | grasscloth-seams-and-shading |
| 3 | Wallpaper for hallways, kitchens and bathrooms: start with how the room is used | Homeowners | wallpaper-by-room |
| 4 | Why expensive wallpaper still needs proper wall preparation | All clients | wall-preparation |
| 5 | How much wallpaper do you need? Why wall area is only the start | All clients | wallpaper-quantity |
| 6 | Scenic murals and panoramic wallpaper: plan the room before ordering | Homeowners and designers | planning-scenic-wallpaper |
| 7 | What affects the cost of wallpaper installation? | Homeowners and procurement | installation-cost-factors |
| 8 | A designer's checklist before specifying wallcoverings | Designers and architects | designer-specification-checklist |
| 9 | Planning a wallcovering package for a development or hotel | Developers and contractors | commercial-wallcovering-planning |
| 10 | Caring for wallpaper, and what to do when something goes wrong | Existing customers | wallcovering-care-and-repairs |

The linked guide files hold the proposed public copy. Editorial notes are internal and must not appear on published pages. These are complete concise launch drafts; expand only where a real photograph, tested example or verified product adds useful information.

---

## 6. Separate professional approaches

Use one public brand with distinct entry points. Keep homeowner language easy to understand; offer professional detail without forcing it on everyone.

| Audience | Their main decision | What to show | Primary action |
| --- | --- | --- | --- |
| Homeowners | Will this suit my room and what is involved? | Room/material guidance, honest samples, scope and practical installation process | Discuss my room |
| Designers and architects | Can the intended finish be specified and delivered? | Layout detail, material constraints, schedule intake, coordinated examples | Submit a specification |
| Property developers and main contractors | Can this package be priced, programmed and handed over? | Scope boundaries, preparation responsibility, phasing, verified documents and tender intake | Send drawings and schedule |
| Hotels and operators | How will works fit an occupied building and future maintenance? | Access planning, cleaning requirements, phased works and handover | Discuss a phased project |

### Proposed designers page copy

**Your specification. Considered down to the last return.**

Bring the material, elevations and design intent together before installation begins. We can discuss pattern placement, natural panel variation, wall preparation and the details where a wallcovering meets joinery, corners and openings.

Already specified the material? Send the references and room schedule. Still comparing options? Tell us the finish you want and the conditions it needs to work in.

**What to send:** material codes and colourways; elevations or plans; sample status; approximate quantities; project location and programme; procurement responsibilities; unresolved technical questions.

**Action:** Submit a specification.

*Internal: confirm the actual review scope. Do not promise free consultancy, trade discounts, sampling access or a turnaround time unless those arrangements exist.*

### Proposed developers page copy

**Wallcovering packages planned around the site.**

For developments and refurbishment projects, the finish depends on more than the installation date. Material delivery, wall readiness, access and the sequence of other trades all need to work together.

Send the scope, drawings and material schedule for a discussion of preparation, installation and handover. Where the building remains occupied, include working-hour and access restrictions so they can be considered from the start.

**What to send:** drawing revisions; room and material schedules; areas and quantities; supply responsibility; substrate and preparation information; programme; access rules; project documentation requirements; tender deadline.

**Action:** Send drawings and schedule.

*Internal: only display insurance, accreditations, RAMS, warranties and contract capabilities with verified current evidence. Do not imply the team provides regulatory certification.*

## 7. Editorial voice and proof

Use short, specific explanations and real decisions. Words such as repeat, return, reveal, panel layout and wall readiness are useful when explained. Luxury should come from care and precision, not repeated claims that everything is exceptional.

Avoid “transform your space”, “elevate your interiors”, “seamless grasscloth”, invented client stories and unearned superlatives. Do not insert first-person anecdotes from Dorin's private conversations. Never turn a technical dispute into a public case study without checking the facts and permissions.

Suggested human editing process:

1. Dorin reviews each technical draft and changes anything that does not reflect his practice.
2. Add one real observation or detail photograph where available. A brief voice note can supply more useful texture than another page of generic prose.
3. Match product-specific claims to current manufacturer documents.
4. Verify names, project scope and image rights separately.
5. Publish a byline only for the person who actually wrote or reviewed the article. Use accurate reviewed/published dates; do not prefill an expert approval.

## 8. Development handoff — extension to the master prompt

Implement this pack as an addition to the existing Mr Wallcover redesign contract. First inspect current repository instructions, stack, uncommitted changes, route inventory and deployment. The previous Astro description is context, not proof of the current state. Preserve existing work and use an isolated branch with a preview. Do not trigger a main-branch deployment as part of content drafting.

### Content model

Create typed collections for guides and material records using the current framework's supported content mechanism. Guides need title, slug, summary, audience, category, draft/published state, author/reviewer, dates, source references, related materials/services/guides and optional rights-cleared media. Preserve these ten drafts without publishing their internal notes. Keep drafts out of public output and the sitemap until reviewed. A content preview should make review status obvious.

Use the existing /advice/ route family for these guides. Keep /advice/quantities/ as the calculator and link the explanatory quantity guide to it. Do not create a competing /guides/ hub. Never redirect every removed URL to the homepage.

### Reading experience

Build a guide hub with descriptive cards and audience/topic filters. Individual pages need a clear heading, useful introduction, readable body, optional contents navigation, related guidance and one context-appropriate action. Use meaningful image captions. Supply keyboard access, visible focus, sensible mobile line length and reduced-motion behaviour. Keep glass effects away from body text and maintain contrast.

### Material decision interface

Extend the existing family library and shortlist with comparisons before introducing a supplier catalogue. Seed only editorial family facts and approved product records. Filter by room/use, desired texture, panel expectations and cleaning needs. Explain every recommendation and uncertainty. Save a visitor's shortlist locally with a clear reset option; do not require an account. Send the shortlist with an enquiry only when the visitor submits it. No fake stock, fabricated ratings or unsupported compliance badges.

### Professional journeys

Extend the existing /professionals/ page with distinct designer and developer entry points and intake variants. Designers can attach specifications/elevations and record design intent. Developers can attach schedules/drawings and record programme, supply responsibility and tender deadline. Hotels can record occupancy and phasing. Do not make every professional field mandatory. Enquiry storage, private uploads and notification handling must follow the original reliable-backend contract.

### Discovery work

Inspect and safely amend production crawl controls as required, generate a real sitemap, ensure textual server-rendered content and accurate structured data. Record what cannot be verified without hosting or webmaster access. Keep training crawler preference independent of search discovery. Never promise search placement. Add analytics events for guide-to-enquiry and professional intake using the site's approved privacy approach.

### Acceptance evidence

- All ten guide drafts render correctly in preview; internal notes, invented bylines and unreviewed claims are absent from public output.
- At least one guide is checked at mobile and desktop sizes, with keyboard and reduced-motion use; all guide routes and internal links are validated.
- View-source or fetched HTML contains the article text and material decision facts without running WebGL.
- A grasscloth comparison explains panel variation and sends the saved choice into an enquiry.
- Unknown cleaning, fire and wet-area facts never become affirmative suitability results.
- A homeowner, designer, developer and aftercare submission each reaches durable lead storage with the relevant context. Demonstrate upload errors and failed notifications as well as success.
- Private uploads are not publicly readable or included in search output, sitemap or public content feeds.
- The built sitemap contains only intended canonical public routes, and changed routes have tested migration behaviour.
- Crawler evidence distinguishes source settings, observed production responses and actual verified crawler traffic.
- Return the branch/commit, preview, screenshots, checks performed and remaining evidence requirements. Do not describe draft copy or a local build as a live release.

### Publication order

Prepare all ten in preview together. Review Choosing, Grasscloth, Preparation and Cost first because they answer common buying questions. Then review the two professional guides and pages; follow with Quantity, Room Suitability, Scenic Planning and Aftercare. All ten belong in the completed release once reviewed. Do not publish placeholder articles to reach a target count.

## 9. Official and manufacturer references

References checked 9 October 2026. These support the general discovery and material principles; they do not certify individual products or the current Mr Wallcover installation.

- OpenAI, Publishers and Developers FAQ: https://help.openai.com/en/articles/12627856-publishers-and-developers-faq
- OpenAI, Overview of OpenAI Crawlers: https://developers.openai.com/api/docs/bots
- Google Search Central, AI features and your website: https://developers.google.com/search/docs/appearance/ai-features
- Vescom, Adhesives and accessories: https://vescom.com/en/adhesives-accessories
- Phillip Jeffries, The Art of Smooth Shading: https://blog.phillipjeffries.com/the-hang-guide-to-grasscloth-shading
- Phillip Jeffries, Engineering a Room: https://blog.phillipjeffries.com/the-hang-how-many-wallcovering-panels-in-a-room
- Phillip Jeffries, Hanging instructions: https://www.phillipjeffries.com/hanging-instructions

Live-site limitation: the public retrieval tool could not retrieve the homepage, robots.txt or sitemap in this turn. No conclusion has been drawn about their actual settings, indexing or hosting availability.
