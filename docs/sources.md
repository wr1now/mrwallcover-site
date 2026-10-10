# Sources

Published facts on mrwallcover.com that come from outside sources, with the source checked. Case studies also carry their own "Notes and sources" section.

## Hyde London City (15 Old Bailey)

- **Fact:** 111 guest rooms across seven storeys. Grade II-listed Spiers & Pond building, originally built 1874. Opened 2 September 2024. Interior design by Studio Moren.
- **Sources (checked 10 Oct 2026):**
  - Ennismore, "Hyde London City has officially opened its doors", 2 September 2024: https://ennismore.com/stories/hyde-london-city-has-officially-opened-its-doors/ ("Spanning seven storeys, Hyde London City boasts 111 stylish guest rooms").
  - Ennismore press release PDF, "Hyde London City opens as a slick new spot to stay…": https://ennismore.com/wp-content/uploads/sites/9/2024/09/Hyde-London-City-Hotel-Now-Open.pdf (same sentence; notes to editors give 15 Old Bailey, London, EC4M 7EF). The PDF is not linked from the story page; it is on the same Ennismore uploads path (2024/09).
- **Used in:** src/content/case-studies/old-bailey-hotel.md (standfirst, At a glance, Outcome, Notes and sources), src/content/pages/timorous-beasties-installer.md, src/content/guides/hotel-wallcovering-specification.md. /ai/projects.json, /projects.json, /llms.txt, /llms-full.txt and the Markdown twins are built from these files.
- **History:** "111 bedrooms across seven storeys" was on the first Old Bailey write-up and became "110 rooms" in #5 (b3b7d58). Dorin confirmed 111 on 10 Oct 2026 against the sources above.
- **Follow-up (claude/ai-answers):** the sample-room paragraph of the case study read "the next 109" (110 rooms less the sample room); with 111 rooms it now reads "the next 110". The new buyer answers in src/data/buyer-answers.json (F-a20, F-b1, F-b9) and the `largestPublishedHotelProgramme` key in /.well-known/facts.json state 111 rooms on the same Ennismore sources. tests/ai-answers.test.ts fails the build if any built page or AI file pairs Hyde London City or Old Bailey with 110 or 109 rooms.

## Buyer questions (AI answer audit, 10 Oct 2026)

- **What:** the answers in src/data/buyer-answers.json, shown on /for-ai/, the three /professionals/ pages, the hotel guide and /aftercare/, in /llms.txt (Buyer questions) and in /.well-known/facts.json.
- **Source:** the audit's FILL.md, where every sentence carries a link to the page of mrwallcover.com it comes from (kept per answer in `sources`). Sentences that wait for Dorin ([Pending Qn]) are left out; `pendingOmitted` records which of QUESTIONS_FOR_DORIN.md would complete each answer. The standing entries quote the site word for word.
