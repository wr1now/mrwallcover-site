# House style for wording

How Mr Wallcover pages are written. It applies to new and rewritten copy, including alt text, captions, meta titles and descriptions. Facts come only from text already published on the site; this page adds none. The visual rules are in [visual-standard.md](visual-standard.md).

## Voice

- Calm, specific, expert. Say what was done, where, how big and in which years, and let the figure carry the weight.
- Write prose as "we". Use "Mr Wallcover" in headings, titles and project records, where the third person states the role plainly. Name Dorin where the point is personal.
- Present tense for how we work, past tense for finished projects.
- Write like the aftercare page (`src/content/aftercare.json`): "We do not paint over a problem and hope the light is kind." / "We would rather be called early than asked to hang the same wall twice over a wet substrate."
- State a limit once, on the page that owns it (guarantee exclusions live on `/aftercare/` and the FAQ), not on every page. Do not hedge, apologise or over-explain.

## Sentences

- About 18 words on average; split anything over 35. One idea per paragraph, four sentences at most.
- Lead with the fact, not the framing: "From a single guest room to a programme of about 17,500 m²" (`/projects/`).
- A project mention carries the role and the years: "Main decorating contractor at Brown's Hotel, Mayfair, 2022–2024" (meta description of `/projects/browns-hotel-mayfair/`, in `src/content/case-studies/browns-hotel-mayfair.md`).
- Use a list for three or more parallel items. Say each fact once per page and link to the page that owns it.

## Claims

- Only facts already stated on the site. Keep the site's own hedges ("about 17,500 m²"). The award, programme figures and trading history come from `src/data/facts.json`, and the guarantee terms from `src/content/aftercare.json`. Add no review, award or guarantee that is not there.
- No superlatives about other people's buildings.
- Endorsements: in new copy, prefer the line "Naming a maker records an installation, not an endorsement." (`tests/content-intent.test.ts` pins it on `/advice/designer-specification-checklist/`). The boundary sentences already published on the makers directory, the maker installer pages and the buying routes stay as written, for example "Inclusion does not imply an endorsement, supplier relationship or installation by Mr Wallcover." (`src/pages/makers/[...slug].astro`). They state the limit the website AGENTS.md requires: a named maker never implies installation, affiliation or supply.

## Words to leave out

- Filler used as decoration: considered, honest, composure, remarkable, extraordinary, impeccable, stunning, exquisite, world-class, unrivalled, state-of-the-art; ambitious and premium as praise; bespoke except for a genuinely custom-made product.
- Stock lines: "with composure", "something remarkable", "the detail is the difference", "the art of the finish", "we bring care to every stage".
- Build-state and self-referential words: private preview, staging, owner-confirmed, company-reported, recorded role, not recorded, not stated here, on the public record yet, to follow, being prepared, completing testing, Instagram post IDs. `tests/page-baseline.test.ts` fails a build that shows "private preview" or "staging".
- Scope of that list: the AI record surfaces (`/for-ai/`, `/wallcovering-installation-ai-crawler/`, `llms.txt`, `/ai/*.json` and the generated `ai-reference/` mirror) and the image-rights fields (`src/data/image-rights.json`, and the `creditText` and `copyrightNotice` built in `src/lib/schema.ts`) keep their provenance labels: company-reported, owner-confirmed, recorded role, not stated here, "Photographer not recorded". Tests pin some of them: `tests/ai-reader-mirror.test.ts` (company-reported), `tests/ai-crawler.test.ts` ("Company-reported project record", "Owner-confirmed commission-scope policy") and `tests/image-metadata.test.ts` ("Photographer not recorded"). On buyer pages the list applies; `tests/ai-crawler.test.ts` fails if the `/services/` scope section shows "Owner-confirmed", "Recorded role", "Company-reported" or "not stated here". A sentence that states a real gap in a project record, such as "the specific collection used on this project is not recorded here" (`src/content/case-studies/four-seasons-ten-trinity-square.md`), keeps that limit if it is reworded.
- Defensive framing that marks no real limit, such as "it is not a claim here". A sentence that states an endorsement, supply or certification boundary is not filler; say it once, plainly.

## Names and terms

| Use | Notes |
|---|---|
| Four Seasons Hotel London at Ten Trinity Square, then Four Seasons Ten Trinity Square | Full name at first mention on a page, short form after |
| Raffles London at The OWO, then The OWO | As above |
| Hyde London City (the Old Bailey Hotel), then Hyde London City | As above |
| twelve-month guarantee | In prose; not "12-month", "warranty" or "cover" |
| checks the quality of the work | Not "quality-controls" |
| Wallpaper installation in {area} | Area page headings; their questions read "Questions about papering in {area}" |
| wallpaper / wallcovering | "wallpaper" on homeowner and search-led pages; "wallcovering" on trade pages. Do not mix them in one sentence unless defining one |
| Start your project | The main action, to `/contact/` |
| Book a call | The 20-minute call; its published line on `/contact/` is "Calls Mon–Fri, 9am–5pm UK." |
| Send your note / Send the note | Enquiry and aftercare form buttons |

Navigation labels are the owner's and come from `src/content/navigation.json`; copy does not rename them. One action keeps one label, and new copy adds no variant. Contextual labels that say what the visitor gets, such as "Discuss a similar project" on project cards, stay; new copy uses the labels in this table.

## Spelling and typography

- British English: colour, grey, programme, organise, licence (noun), centre.
- Dates "9 October 2026"; times "9am–5pm"; ranges with an en dash, "2022–2024"; area in "m²".
- Hyphenate hand-painted, free-issue (adjective) and set-out (noun); "set out" is the verb. Spell out an acronym at first use.
- Typographic apostrophes and quotes (’ “ ”) in new copy.
- "×" for a collaboration in our own copy. Keep a third party's quoted title, and every URL, exactly as published.
- New photograph credits read "Photograph: {holder}". The same credit goes in the image's rights record: `imageObject` in `src/lib/schema.ts` fails the build when a printed credit has no record.

## Exemptions: published text kept verbatim

`scripts/home-content-preservation-2026-10-19.json` pins these published blocks, and the no-loss guard compares them character for character (NFKC does not equate ’ with ' or × with x). Leave them as published, even where they break a rule above, unless the owner retires the inventory entry.

| Inventory line | Text |
|---|---|
| 8 | "Specialist wallcovering installation for remarkable hotels, considered homes and ambitious spaces." (`home.practiceLede`, on `/practice/`) |
| 29, 31 | "Image: Raffles London at The OWO (official)" |
| 109 | "THE DETAIL IS THE DIFFERENCE" |
| 115 | "A considered return" |
| 136–137 | "On a longer commission, senior oversight quality-controls the work and agrees with you, each week, what happens next." |
| 158–160 | The three Calico Wallpaper collaboration titles written with "x" |
| 166 | "About four to six weeks later we come back, once the paper has had a chance to settle. …" (the original homepage aftercare paragraph, kept in `src/content/aftercare.json` guarantee paragraphs, on `/aftercare/`). It repeats the band's first two paragraphs; that is accepted until the owner retires the entry, and then the copy in `aftercare.json` and this row go. |
| 182, 482 | "There is no honest flat rate per roll. …" (`src/content/faq.json`) |
| 497 | "What aftercare and warranty do you offer?" (`src/content/faq.json` question, on `/faq/`) |

Line numbers can move; the quoted text is what counts. Do not edit the inventory to make a rewrite pass.
