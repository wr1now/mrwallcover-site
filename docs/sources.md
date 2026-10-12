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

## Owner-confirmed claims (PR #35, 11 Oct 2026)

Each sentence below is published on the strength of the owner's own knowledge of the job. Source for all four: **Dorin Burcus, owner, confirmed 11 Oct 2026** (review of PR #35, 08:53 BST).

- **Hilton Garden Inn Silverstone:** "its rooms finished to one standard in time for the 2022 British Grand Prix". Used in src/content/case-studies/hilton-garden-inn-silverstone.md (standfirst). Source: Dorin Burcus, owner, confirmed 11 Oct 2026.
- **Ahluwalia / Calico, Estuary:** "hung in a single day" before the show. Used in src/content/case-studies/calico-ahluwalia-estuary-rosewood.md (standfirst; the wording is main's). Source: Dorin Burcus, owner, confirmed 11 Oct 2026.
- **About, Dorin Burcus:** "run wallcovering packages in prime London hotels". Used in src/content/about.json (founder paragraph and founderSummary, so also on /for-ai/ and the AI crawler summary). Source: Dorin Burcus, owner, confirmed 11 Oct 2026.
- **Standards block on every case study:** "The people who start are the people who finish." Used in src/content/method.json (item "One team, then the return visit"). Source: Dorin Burcus, owner, confirmed 11 Oct 2026.

## Instagram photo pack: programme figures and project facts (11 Oct 2026)

Source for every fact below: **the @mrwallcover Instagram** (https://www.instagram.com/mrwallcover/), harvested read-only into wr1now/mrwallcover-ops (`instagram/` at 192a6ad: EXPERIENCE.md, captions_clean.txt; photo pack `ig-pack/` at db42922, MANIFEST.json). Dorin cleared the five figures and the project names on 11 Oct 2026 (via the Website agent). Captions that name the trading company or a contractor are paraphrased, never quoted.

- **The OWO, 17,500 m² in 18 months.** Post [CPFPOA5FBZ4](https://www.instagram.com/p/CPFPOA5FBZ4/), 20 May 2021: "chosen to install 17.5 km square of wallcoverings … The target is 17500 smq in 18 months". Written as about 17,500 m², matching the caption's own "17500 smq". Used in src/content/about.json (hotels, timeline, collaborators) and src/data/facts.json programmeFigures (/facts.json, /.well-known/facts.json, /for-ai/, /llms.txt). No OWO photograph from the pack is used (official imagery only).
- **Four Seasons Ten Trinity Square, about 5,000 m².** Post [BxBEIajB-d5](https://www.instagram.com/p/BxBEIajB-d5/), 3 May 2019: "Our team completed installation of 5000 sqm of wallcoverings at Four Seasons Hotel London"; also [Btg-MdohwsS](https://www.instagram.com/p/Btg-MdohwsS/), Feb 2019. Materials from [BwS1XkFhWv6](https://www.instagram.com/p/BwS1XkFhWv6/) (Fromental hand-dyed silk), [B2U2Ry8F0rE](https://www.instagram.com/p/B2U2Ry8F0rE/) (Dedar lobbies), [B2U12SXFLHE](https://www.instagram.com/p/B2U12SXFLHE/) (Muraspec), [BdNs0wagJs9](https://www.instagram.com/p/BdNs0wagJs9/) (Phillip Jeffries). Used in the Four Seasons case study, About and the fact sheet.
- **The Biltmore Mayfair, 15,000+ m².** Post [BkBSc6AHX7U](https://www.instagram.com/p/BkBSc6AHX7U/), 14 Jun 2018: "Millennium Hotel Grosvenor Square, a 15000+ mtr sq of wallpaper … Phillip Jeffries". The caption carries a hashtag that is never quoted. Used in the Biltmore case study, About and the fact sheet.
- **Pendley Manor, 30 rooms in 30 days with 20 papers.** Post [B60Ncb2FWZS](https://www.instagram.com/p/B60Ncb2FWZS/), 2 Jan 2020: "30 rooms in 30 days for Pendley Manor; Anaglypta for the ceilings; Lining all walls; installation of 20 different types of wallpaper". Cole & Son Petroushka flock from [B6242AnFvaZ](https://www.instagram.com/p/B6242AnFvaZ/). Used in the Pendley case study, About and the fact sheet.
- **DoubleTree West End, 30 rooms on 2 floors while open.** Post [B0GpM3Vlmkh](https://www.instagram.com/p/B0GpM3Vlmkh/), 19 Jul 2019: "completed level 6&5, 30 rooms and hallways … a hotel that is still open for guests on the other floors". Tektura in Dec 2017 from [BdNpAgPArnf](https://www.instagram.com/p/BdNpAgPArnf/). Used in the DoubleTree West End case study, About and the fact sheet.
- **Jumeirah Carlton Tower: 8 months, finished end of 2020.** Post [CJtvVheldiT](https://www.instagram.com/p/CJtvVheldiT/), 6 Jan 2021. Named only in the About timeline (no card, no case study: no usable photograph). The caption's area figure is left out until Dorin confirms it.
- **Project facts on the new pages** (each page cites its posts): Huntsman [BhY3zp7nKhr](https://www.instagram.com/p/BhY3zp7nKhr/), [Bu6-mMFBdbt](https://www.instagram.com/p/Bu6-mMFBdbt/); Mercedes-AMG showroom [B2HM9AWlG3w](https://www.instagram.com/p/B2HM9AWlG3w/), [B2V9cZklfv9](https://www.instagram.com/p/B2V9cZklfv9/); Everyman Liverpool [BpT508uHLMu](https://www.instagram.com/p/BpT508uHLMu/), [BqsxZT2gAjQ](https://www.instagram.com/p/BqsxZT2gAjQ/); Hilton London Metropole [B3AAo9sFAE_](https://www.instagram.com/p/B3AAo9sFAE_/), [B5XtSRtFedQ](https://www.instagram.com/p/B5XtSRtFedQ/); Novotel Canary Wharf [CZVUfE5KWNA](https://www.instagram.com/p/CZVUfE5KWNA/); Masterpiece London [By-zBigFOAR](https://www.instagram.com/p/By-zBigFOAR/), [BzLSNUKFouL](https://www.instagram.com/p/BzLSNUKFouL/); Oxygen Freejumping [BoCE7LPnvqA](https://www.instagram.com/p/BoCE7LPnvqA/); Little Venice residence for Jaillon Studio [B0O1YqbF4Vp](https://www.instagram.com/p/B0O1YqbF4Vp/); Brown's start [CZqAHTMKcnj](https://www.instagram.com/p/CZqAHTMKcnj/); Trematon Lincrusta [CWksjiaKBnq](https://www.instagram.com/p/CWksjiaKBnq/). The About roll-call links each entry to its post.
- **Left out (not on Dorin's figure list):** Mercedes-AMG 650 m²; Everyman's 6 m × 6 m print; Metropole "in 3 days"; the Carlton Tower area; the Georgian manor and penthouse areas in ABOUT_DRAFT. **Not claimed:** the AD feature (the masthead in three 2021 posts is visual only; no source proves the feature).
- **Team and contract lines on About** (six hangers and six decorators, 25–35 at peak, RAMS, VAT and CIS, JCT) repeat what /trade/ and /professionals/fit-out-contractors/ already state; 3D scanning and the Belgravia restaurant night shifts come from ABOUT_DRAFT.md (Dorin's brief, cleared) and post CWW3yaCK79i (paraphrased).
## Huntsman and Everyman Liverpool: venue facts carried over from draft PR #10 (11 Oct 2026)

- **Huntsman, 11 Savile Row:** founded by Henry Huntsman in 1849; at 11 Savile Row since 1919; the stags' heads left by a customer in 1921; cutting room and workshops on the premises. Source: https://www.h-huntsman.com/heritage/11-savile-row/ (checked 11 Oct 2026). Left out because unverified: the 1809 roots, the c.1733 date of the building, the Kingsman films, and the Archer Electrical note on tweed and green walls (that note gives no evidence it was our work).
- **Everyman, Metquarter, Liverpool:** opened Tuesday 18 December 2018; four screens; 18,000 sq ft; bar, Spielburger kitchen, service to seats. Source: Place North West, 15 Nov 2018, https://www.placenorthwest.co.uk/everyman-to-open-before-christmas/ (checked 11 Oct 2026); also cited in the draft: https://www.liverpoolecho.co.uk/whats-on/everyman-cinema-opening-inside-liverpools-15415805. Our posts (Oct to Dec 2018; BqsxZT2gAjQ tags @everymancinema) fall in the run-up to that opening.

## Second review: designers strip, aftercare paperwork, quantities allowance, details (11 Oct 2026)

- **Designers we work with** (src/data/designers.json, on /about/ and /professionals/designers/). Jaillon Studio: the published case studies /projects/tea-house-jaillon-studio/ and /projects/private-residence-little-venice/. Posner Interiors: tagged @posnerinteriors on our post [B73YYaSlpPv](https://www.instagram.com/p/B73YYaSlpPv/), 28 Jan 2020, a private home near Sloane Square (Cole & Son, Little Greene; ig-pack plan). Diane Hill: our post [B4Puc1-FUT9](https://www.instagram.com/p/B4Puc1-FUT9/), 30 Oct 2019: "This wall art was beautifully hand painted after the installation of the silk on the walls … Artist @dianehilldesign Silk @PhillipJeffriesltd" (ig-pack MANIFEST; the caption itself is not reused). The three names were cleared for /about/ by Dorin (About brief, 11 Oct 2026). Calico Wallpaper (the one partnership), House of Hackney and Lee Broom: their published case studies.
- **Aftercare, "Guarantees and paperwork"** (src/content/aftercare.json, assurance). Insurance, site cards and accreditations, RAMS with Dorin supervising, and "If a fault comes from the installation, Mr Wallcover covers the cost of the material": the approved answers in src/data/buyer-answers.json. No limits and no payment terms are published.
- **Quantities allowance** (/advice/quantities/): "typically 15–30%, depending on the pattern repeat and the layout, with staircases at the high end (around 30%) because of the angles. Extra rolls for pattern matching are confirmed at survey", the approved wording in src/content/guides/installation-cost.md and buyer-answers.json.
- **Details** (/details/): ten of our own photographs, each already published on its case study or as maker evidence (records in src/content/alts.json: "own photograph" / "own photo").

## Jumeirah Carlton Tower case study (11 Oct 2026)

- **8 months, finished at the end of 2020.** Post [CJtvVheldiT](https://www.instagram.com/p/CJtvVheldiT/), 6 Jan 2021: "part of this spectacular project in the heart of London for 8 months … Completed at the end of 2020", location-tagged Carlton Tower, Knightsbridge. Dorin cleared the hotel for a full case study on 11 Oct 2026, with official photographs (the earlier "named only in the About timeline" note above is superseded). Used in the case study, About (hotels list; the timeline line is unchanged), hotels.json, facts.json and, through them, /for-ai/, llms and projects.json. The caption's area figure stays out.
- **The rooms:** "light oak wall panelling … textured inset wall coverings … a more residential feel": Jumeirah's fact sheet for the hotel, https://mediahub.jumeirah.com/wp-content/uploads/2026/05/fc6b9667f39a4beb1d258566117e572c.pdf (checked 11 Oct 2026). Reopening in 2021: Jumeirah Group release, 20 May 2021 ("will open … on June 1st, 2021"). No hotel figures (keys, cost) are used.

## Calico Wallpaper praise and Timorous Beasties (approved by Dorin Burcus, 11 Oct 2026)

- **Calico Wallpaper praise, restored.** The two lines removed by the 9 Oct claim fixes (commit b28e7c0) go back with their original wording exactly: "Gorgeous! Thank you so much!" (Calico Wallpaper, on the Beverly 1975 installation) and "Thank you for the update Dorin and for your hard work!" (Calico Wallpaper). Attributed to Calico Wallpaper only, never to a person. Data: src/data/approved-quotes.json. Used on /reviews/ (PR #43) and the homepage testimonials (PR #45). tests/dist-guards.test.ts fails the build if either line is altered or carries any other attribution. Source: **Dorin Burcus, 11 Oct 2026**.
- **Timorous Beasties is an installed maker.** Evidence: Tropical Clouded Leopard and Totem Damask, custom-printed as vinyl, through the 111 guest rooms of Hyde London City (see the Hyde London City section above and /projects/old-bailey-hotel/). Added to the confirmed makers in src/data/buyer-answers.json (makersInstalled, so /.well-known/facts.json and /for-ai/), the specified-papers lede, /services/timorous-beasties-installer/ (PR #43) and the homepage proof strip (PR #45). Not a maker approval or recommended-installer listing. Source: **Dorin Burcus, 11 Oct 2026**.

## Technique guides and technique additions (claude/technique-guides, 11 Oct 2026)

Every technique sentence added in this PR restates something already on our own record: a case study, a guide, service-depth.json, specialisms.json, materials.json or src/data/buyer-answers.json, with the Instagram posts those case studies cite. Nothing comes from the competitor research in mrwallcover-ops except the choice of topics; no competitor wording and no outside name is used. Techniques we could not confirm from our own record (for example kill points, open times, paste types, sizing ratios and a surface grade for metallic or thin papers) are left out.

- **Room sequence: ceiling papered, walls lined, then the paper hung; floors protected.** Pendley Manor case study ("Each room followed the same sequence"); post [B60Ncb2FWZS](https://www.instagram.com/p/B60Ncb2FWZS/), 2 Jan 2020. Used in /advice/papered-ceilings-and-staircases/ (body and FAQ).
- **Anaglypta on ceilings, hung first and painted afterwards; joints tight, pattern true wall to wall because window light rakes across the relief.** Pendley Manor case study ("The ceilings"); material-depth.json (paper-and-non-woven). Used in /advice/papered-ceilings-and-staircases/.
- **Ceilings papered in the same print as the walls; cutting around an oval lantern and a chandelier rose; box room papered on four walls and ceiling; rooms back to bare plaster and lined; reinforced lining materials.** Trematon case study ("Ceilings as a fifth wall", "Strip-out and preparation"); heritage-listed-buildings.md. Used in /advice/papered-ceilings-and-staircases/ and the heritage page's new link sentence.
- **Moulded heritage ceilings spray-finished rather than papered.** Brown's Hotel case study ("Ceilings"). Used in /advice/papered-ceilings-and-staircases/ (body and FAQ).
- **Lincrusta on the curved stair walls: laid out on the table, hung panel by panel to a laser line; made since 1877.** Trematon case study; posts [CWksjiaKBnq](https://www.instagram.com/p/CWksjiaKBnq/) and [CW5IdnPKgTP](https://www.instagram.com/p/CW5IdnPKgTP/), Nov 2021. Used in /advice/papered-ceilings-and-staircases/ and /advice/set-out-and-pattern-matching/.
- **Stair halls: tall stair halls change the preparation; Penny Morrison stair hall papered; Hyde London City stair cores and timber-railed staircase decorated around and protected; stair openings as edges that take traffic, with a corner profile rather than more adhesive.** heritage-listed-buildings.md; Penny Morrison, Hyde London City (old-bailey-hotel) and imperfect-arches case studies; wallcovering-problems-and-aftercare guide. Used in /advice/papered-ceilings-and-staircases/.
- **Wastage 15–30%, staircases around 30% "because of the angles"; extra rolls confirmed at survey.** services.json surveying pillar, installation-cost and developer guides, buyer-answers.json. Used in /advice/papered-ceilings-and-staircases/ (body and FAQ).
- **Set-out from focal points (chimneypieces, doorcases, bed walls), 108.5 cm half-drop repeat; a drop a few millimetres off shows at the seam.** Brown's Hotel case study ("Setting out"); installation-cost guide. Used in /advice/set-out-and-pattern-matching/.
- **Repeat set out from the mirrors rather than a corner; feathers matched drop by drop and around internal corners.** Tea house (Jaillon Studio) case study. Used in /advice/set-out-and-pattern-matching/.
- **Grasscloth: start from the visual centre, balance the end panels so neither is a sliver; a sliver that could have been balanced is a fault.** service-depth.json (grasscloth-installation, "Set-out and shading" and "What is normal"). Used in /advice/set-out-and-pattern-matching/.
- **Each drop set to a laser line in a room with sloping floors.** North London residence case study and material-depth.json. Used in /advice/set-out-and-pattern-matching/ (body and FAQ).
- **Laser levels so outlines run panel to panel on a design with no repeat.** Masterpiece London case study; post [By-zBigFOAR](https://www.instagram.com/p/By-zBigFOAR/). Used in /advice/set-out-and-pattern-matching/.
- **Match types (free, straight, half-drop, panel sequence); reversing is a separate instruction; half-drop and murals set out on site; half-drop wastes more at the top of each drop.** designer-specification-checklist guide, materials.json, installation-cost guide. Used in /advice/set-out-and-pattern-matching/.
- **Matches carried across corners, chimney breasts and door heads; batch checked from roll labels.** Trematon case study ("Pattern and seam control"). Used in /advice/set-out-and-pattern-matching/.
- **A check runs to a laser-set true vertical and level and meets at every joint and corner; boards wrapped with the pattern square on every face.** Huntsman case study; service-depth.json (joinery). Used in /advice/set-out-and-pattern-matching/.
- **Digital mural drops hung in sequence from the top down, never stretched as pasted; gradient hung in order and butted.** Everyman Liverpool and SCP showroom case studies. Used in /advice/set-out-and-pattern-matching/ and /advice/wall-preparation/.
- **Overlap and splice: edges overlapped, cut through both layers, offcuts removed, so fine lines stay continuous.** Oxygen Freejumping, The O2 case study ("Overlap and splice"); post [BoCE7LPnvqA](https://www.instagram.com/p/BoCE7LPnvqA/), 22 Sep 2018. Used in /advice/set-out-and-pattern-matching/ (body and FAQ) and the commercial service page (Venues and leisure).
- **Lee Broom concealed door: the curtain runs straight across a flush door, the pattern carried over it so the door disappears into the drape.** calico-lee-broom-overture case study ("Hiding the door"). Used on /services/joinery-wallcoverings-and-panels/ ("Doors papered in"), now linked to the case study.
- **Truest wall for dark matt, scenic and side-lit textile finishes.** Mercedes-AMG case study; service-depth.json (hand-painted, "The wall beneath a scenic paper"); designer checklist ("Conditions"). Used in /advice/wall-preparation/ ("Which finishes need the truest wall?").
- **Adhesive and paste (folded into wall preparation instead of a separate guide, because our own record holds no paste choice of our own):** adhesive and primer chosen as a pair and named by the maker's instruction (wall-preparation guide, designer checklist); paste-the-wall or paste-the-paper set by the product and changing the labour (installation-cost guide, cost-guide-2026.md); de Gournay lining hung with the panels' adhesive (wall-preparation guide); clean hands and adhesive kept off the face (specialisms.json grasscloth and silk, grasscloth service-depth, Pendley flock, Mercedes-AMG); pasted scenic panels never stretched (service-depth.json hand-painted); adhesive part of the tested fire build-up (buyer-answers.json, hotel fire guide). Used in /advice/wall-preparation/ ("Who chooses the paste, and how is it used?" and FAQ).
- **Lead times and site readiness.** buyer-answers.json lead-time answer (start date after survey; free-issue lead time inside the programme; scenic and mural installer before production; tender deadline vs start date; mobilise within two to three days) and its free-issue answer (deliveries checked against the measure; scenic panels checked dry before paste or cutting); developer guide (substrate handover, programme); service-depth.json hand-painted (filling, lining and drying planned into the programme). Used in /advice/developer-wallcovering-package/ and /advice/designer-specification-checklist/.
- **Hand-painted: panels checked dry against the layout before pasting.** Already on /services/hand-painted-wallpaper-installation/ ("The sequence is the artwork"), /advice/hand-painted-murals-set-out/ and buyer-answers.json; this PR only links that section to the new set-out guide.

## Laser set-out on every job (11 Oct 2026)

- **Laser set-out on every job: Dorin Burcus, 11 Oct 2026** (owner instruction on PR #60, 21:48 BST). Every wall is set out with a laser level. The plumb line appears on the site only as the traditional method, for context, at most once per page. Reworded in the set-out guide (description, meta description, FAQ, body), the North London residence and Huntsman case studies, the commercial service page (specialisms.json, Huntsman), material-depth.json (paper), the homepage "How we work" Hanging step, the heritage page, the choosing guide (stairs), the quantities example and the alt text of lee-broom-06 (the photograph shows the laser line on the panel). No other fact changed. tests/laser-setout.test.ts fails if any source or built page says we use a plumb line or plumb bob outside the "traditional method" framing, or describes our drops in the past tense of that verb.

## Lining, primers and adhesives guide and FAQ groups (11 Oct 2026)

Nothing here is a maker approval. Each maker's own hanging instruction for the product comes first; the guide says so in its opening and closing. Figures (widths, weights, soak times, dilutions, temperatures) appear only where a maker's document prints them.

### de Gournay

- **Fact:** All walls are lined with plain white 1000 or 1200 grade, acid-free paper, which must absorb water. Cross-lining is not needed if lining joints do not meet panel joints. The lining is hung with the panel adhesive, and no primer goes on it (in dry rooms the lining is sized with paste instead). New plaster is sized; flexible oil-based primers are out. Lime plaster, concrete and mould-inhibiting coatings are caustic. de Gournay's own Red Lid and Yellow Lid pastes; UK alternatives are Albany Super Smooth (Type I) and Bartoline Extra Strong Professional (Type II). Ready-mixed only, not watered down; no cellulose, self-mix or very liquid pastes. Yellow Lid products are hung within up to 10 minutes of pasting. Test on an offcut first. Goods made before 1 Jan 2026 have separate instructions.
- **Sources (checked 11 Oct 2026):**
  - de Gournay, Wallpaper Hanging Instructions (goods made after 1 Jan 2026): https://degournay.com/uploads/technical/document/2026_Hanging_Instructions-After-2025.pdf ("All walls should be lined with plain white 1000 or 1200 grade paper lining paper"; "Ensure the liner paper you choose is water absorbent, many problem solving liner papers are not"; "Cross lining (also known as railroaded lining) is not necessary so long as the vertical joints between the lining panels do not meet up"; "Do not use a primer on top of the lining paper"; "Do not use oil based priming products that remain flexible once dry"; "Lime plaster, solid concrete and mould inhibiting products or coating layers containing them are caustic"; "Only use ready mixed adhesives and do not water them down unless absolutely necessary"; "Generally cellulose based, self-mix or very liquid adhesives should be avoided"; "expect to have a limited time (up to 10 minutes) in which to hang the panel once pasted"; UK names "Albany Super Smooth Wallcovering Adhesive" and "Bartoline Extra Strong Professional Ready Mixed Wallcovering Adhesive").
- **Used in:** guide (opening; maker table; grades; paper or non-woven; cross-lining; primers; paste; soak table; closing); guide FAQ "Can the lining and the wallpaper share one paste?"; faq.json lining-required-or-recommended, lining-grade-or-weight, paper-or-non-woven-liner, prime-over-lining-paper, size-or-primer-new-plaster, paste-for-each-wallcovering, how-long-paper-soaks, ready-mixed-or-powder-paste, can-paste-be-diluted.

### Fromental

- **Fact:** Fromental's 2022 guide for its non-woven backed silk wallcoverings asks for walls sized with a PVA-based size, thinner on more absorbent walls, then lined with 1000 grade lining paper (USA: blank stock), hung vertically or horizontally. The surface must be clean and white because the silks are slightly translucent. The paste is a thick ready-mixed modified-starch tub paste, not diluted (UK: Murabond 'black top', Albany Yellow top), applied to the wall. The back of the silk is sponged and left 1–2 minutes. The guide names no lining brand and no non-woven liner: no 'Erfurt', 'Variovlies', '100 cm' or non-woven liner in its text (research: all ten archived Fromental guides say 1000 grade or blank stock only). The live file now returns 404, so only the archived copy can be cited.
- **Sources (checked 11 Oct 2026):**
  - Installation Guide, Non-Woven Backed Silk Wallcoverings (PDF created 4 Jul 2022; Wayback copy of 30 Nov 2023, SHA-1 matched the CDX digest): https://web.archive.org/web/20231130182143/https://fromental.co.uk/cdn/shop/files/Nonwoven_paper_backed_silk_Installation_Guide.pdf?v=17284818687869208217 ("The walls need to be lined with thousand grade lining paper (UK: 1000 grade lining paper / acid free blank stock USA: BLANK STOCK liner)"; "The more absorbent the wall, the thinner the size"; "The silk wallcoverings are slightly translucent"; "A thick ready mixed traditional modified starch 'tub paste' should be used. (UK - Murabond 'black top', Albany Yellow top"; "Stir well and do not dilute the paste!"; "The back of the paper should be wet with a sponge and allowed to soak for 1-2 minutes").
  - Installation Guide, Linen & Canvas (No Paper backing 2021; Wayback copy of 11 Jun 2024): https://web.archive.org/web/20240611074259/https://fromental.co.uk/cdn/shop/files/Linen_Canvas_Installation_Guide_-_No_Paper_backing_2021.pdf ("Lining paper should be left 24 hours to dry out before the top product is installed"; "If available a clay-based adhesive would be preferable"; booked for about 5–10 minutes).
  - Fromental Shop, printed rolls (live): https://fromental.com/pages/how-to-install-fromental-printed-wallpaper-rolls-pre-trimmed ("Lining paper is not mandatory"; "Apply a PVA-based size to the walls"; "Use a premium-quality tub adhesive (pH-neutral, solvent-free, fungicide-protected, light-grade). Avoid self-mix adhesives").
  - Fromental FAQ (live): https://fromental.com/pages/frequently-asked-questions ("Detailed information about installation for all of our products can be requested from your Fromental sales representative").
  - Fromental Shop, linen and specialist fabric (live): https://fromental.com/pages/fromental-shop-how-to-install-linen-and-specialist-fabric-wallpapers ("For guidance on installing Bespoke wallcoverings, please contact your Fromental Sales Representative").
- **Used in:** guide (maker table, two Fromental rows; cross-lining; the Fromental section; sizing; primers; paste; soak table; closing); guide FAQ "Is the Erfurt liner a Fromental requirement?" and "How long should lining dry before the wallpaper goes on?"; faq.json fromental-non-woven-silk-lining, lining-required-or-recommended, lining-grade-or-weight, what-is-cross-lining, pigmented-or-tinted-primer, pva-as-a-size, paste-for-each-wallcovering, paste-the-wall-or-the-paper, how-long-paper-soaks, ready-mixed-or-powder-paste, can-paste-be-diluted.
- **Not claimed:** that Fromental requires, recommends or names Erfurt or any non-woven liner. Our Erfurt practice is recorded under Owner-confirmed practice below.

### Farrow & Ball

- **Fact:** Horizontal cross-lining with 1200–1400 grade, dried for at least 12 hours. New plaster and other absorbent walls sized with its paste or a sizing solution, dried at least 1 hour. Alkali-resistant primer plus cross-lining against staining. Its own paste, or another suitable for papers over 140 gsm at pH 7 to 12. Paste the paper and soak 10 minutes until pliable.
- **Sources (checked 11 Oct 2026):** Farrow & Ball, Product Advice Sheet, Crivelli Rose: https://www.farrow-ball.com/media/wysiwyg/Product-Advice-Sheets/Wallpapers/Crivelli_Rose_GBD30BT.pdf ("horizontally cross lined with a good quality, medium to heavyweight lining paper (1200 - 1400 grade) and allowed to dry for a minimum of 12 hours"; "Absorbent surfaces such as new plaster should be sized with Farrow & Ball Wallpaper Paste or a suitable sizing solution and allowed to dry for a minimum of 1 hour"; "pH 7 to 12 as acidic pastes can damage the wallpaper"; "Apply an alkaline resistant primer. Walls should be cross-lined").
- **Used in:** guide (opening; maker table; cross-lining; primers; paste; soak table); guide FAQ (lining drying time); faq.json lining-required-or-recommended, lining-grade-or-weight, what-is-cross-lining, why-prime-and-with-what, size-or-primer-new-plaster, paste-for-each-wallcovering, how-long-paper-soaks.

### Sanderson Design Group (Sanderson, Zoffany, Harlequin)

- **Fact:** All three FAQs recommend cross-lining with a good lining paper. Sanderson and Zoffany say any starch-based, light, ready-mixed paste suits their papers; Harlequin's FAQ lacks that sentence. Thinning only to size a porous wall. No added fungicide in their pastes, only in-container preservatives. Sanderson's own-brand 1400 grade lining paper comes in 53 cm × 10 m rolls; the page does not name the mill. Zoffany lists the same 1000 and 1400 grade products.
- **Sources (checked 11 Oct 2026; FAQs fetched):**
  - https://www.sanderson.design/pages/faqs, https://www.zoffany.design/faqs, https://www.harlequin.design/faqs ("we recommend using a good quality lining paper to cross line the walls"; Sanderson and Zoffany: "any starch based, light, ready mixed adhesive would be suitable for our papers"; "Thinning is not recommended when using our paste unless you're sizing a porous wall"; "We do not add any fungicides to our paste, although they do contain in-container preservatives").
  - Sanderson, Lining Paper 1400 Grade: https://www.sanderson.design/wallpaper-accessories/lining-paper-1400-grade-sdg0039-06 ("Each roll is 53cm wide and 10m long").
- **Used in:** guide (opening; maker table; lining makers table; cross-lining; paste); faq.json lining-required-or-recommended, who-makes-lining-paper, what-is-cross-lining.

### Cole & Son

- **Fact:** Walls must be primed, and cross-lined if necessary. Lining recommended under highly metallic papers, always hung horizontally. Alkali-resistant primer under foils. 800 or 1000 grade lining. Its own ready-mixed starch paste for its non-woven, silk and grasscloth papers; no packet mixes or heavy-duty pastes. Most of its papers are paste-the-wall non-wovens. New plaster dries two or three weeks, or is sized.
- **Sources (checked 11 Oct 2026):**
  - Hanging instructions: https://cole-and-son.com/pages/hanging-instructions ("Walls must be primed and if necessary cross line with lining paper"; "We recommend lining walls where highly metallic papers are being installed"; "If in doubt, prepare the walls with an alkaline resistant primer"; "it should always be hung horizontally").
  - FAQs: https://cole-and-son.com/pages/frequently-asked-questions ("A good quality, 800 or 1000 grade lining paper is recommended"; "Please avoid packet mixes or heavy-duty pastes"; "Most Cole & Son wallpapers are non-woven paste the wall products"; "allow a newly plastered wall to fully dry out for two or three weeks").
- **Used in:** guide (maker table; grades; cross-lining; sizing; primers; paste; paste the wall); faq.json lining-required-or-recommended, lining-grade-or-weight, what-is-cross-lining, size-or-primer-new-plaster, paste-for-each-wallcovering, paste-the-wall-or-the-paper, ready-mixed-or-powder-paste.

### Timorous Beasties

- **Fact:** Standard-width papers are cross-lined with at least 1000 grade lining. Double-cut installs are not cross-lined, because the blade can slice the lining. No white lining under dark papers; tinted primer instead. Absorbent walls are sized. Tub paste containing a fungicide. Paste-the-paper papers soak 5–8 minutes.
- **Sources (checked 11 Oct 2026):**
  - Pre-Hanging Instructions: https://www.timorousbeasties.com/mediaLibrary/other/english/129404.pdf ("It is important that the walls are cross-lined for standard width wallpapers. Cross-lining walls for double cut installations isn't recommended due to the risk of slicing the lining paper, which can cause seams to split").
  - Standard Width, Paste The Paper: https://www.timorousbeasties.com/mediaLibrary/other/english/129405.pdf ("Cross-line the walls with at least 1000 grade lining paper. Avoid white lining paper for dark wallpapers. Paint wall with tinted primer that coordinates with wallpaper"; "Allow the paper to soak for 5-8 mins - be careful not to oversoak").
  - Standard Width Non-Woven: https://www.timorousbeasties.com/mediaLibrary/other/english/139878.pdf ("Size any absorbent surfaces"; a paste-the-wall "Tub" adhesive "containing a fungicide").
- **Used in:** guide (maker table; grades; cross-lining; primers; paste; soak table); faq.json lining-required-or-recommended, lining-grade-or-weight, what-is-cross-lining, pigmented-or-tinted-primer, how-long-paper-soaks.

### Lewis & Wood

- **Fact:** Wide-width non-woven paper is hung on cross-lining of at least 1,000 grade, pasted on the wall and double-cut through a 20 mm overlap. A pre-mixed heavy-duty paste.
- **Sources (checked 11 Oct 2026):** https://www.lewisandwood.co.uk/wallpapers/how-to-hang-our-wide-width-wallpaper/ ("Cross line the walls with at least 1,000 grade 1 lining paper"; "Paste the wall"; overlap "by approx 20mm"); https://www.lewisandwood.co.uk/wallpapers/wallpaper-guide/ ("a good quality, pre-mixed, heavy-duty paste such as Solvite, Polycell or Halls B-Line").
- **Used in:** guide (maker table; cross-lining); faq.json lining-required-or-recommended, lining-grade-or-weight, what-is-cross-lining.

### Little Greene

- **Fact:** Lining is not essential, and is cross-hung if used. Fresh plaster is sized with paste thinned by 10–15% water. Its own ready-mixed paste must be used with its papers; that paste is pH 6.0.
- **Sources (checked 11 Oct 2026):** https://www.littlegreene.eu/advice-hub/wallpaper-faqs ("Although not a necessity, lining paper will help cover a multitude of imperfections"; "should be cross-hung (applied horizontally)"; "Little Greene Ready Mixed Wallpaper Paste must be used with Little Greene wallpapers"); https://www.littlegreene.eu/advice-hub/howtohangwallpaper ("water down your wallpaper paste or adhesive with 10-15% addition water"); paste data sheet (July 2020): https://wwwlittlegreenecom.cdn.prismic.io/wwwlittlegreenecom/5c37d753-c685-4fb6-a47f-4f2db83e0408_LG+TDS+Wallpaper+Paste_EN.pdf (pH 6.0). littlegreene.com returned 403, so the official EU site was used.
- **Used in:** guide (maker table; cross-lining; sizing; paste); faq.json what-is-cross-lining, paste-for-each-wallcovering, can-paste-be-diluted.

### House of Hackney

- **Fact:** Digitally printed papers on a woven substrate are paste-the-wall. Its traditional non-woven papers are paste-the-paper.
- **Sources (checked 11 Oct 2026):** https://www.houseofhackney.com/blogs/stories/wallpaper-dilemmas ("a water-based, pre-mixed adhesive suitable for paste-the-wall installation"; "Our traditional wallpaper is made from a high-quality non-woven substrate. For this type, we recommend using a paste-the-paper adhesive").
- **Used in:** guide (paste the wall or the paper); faq.json paste-the-wall-or-the-paper.

### Phillip Jeffries

- **Fact:** Lining is not a necessity with most collections and tends to be mandatory under a metallic sheen; each item's instruction decides. Every product sheet checked asks for a hard, acrylic, pigmented, wall-protecting wallcovering primer and says "DO NOT USE R-35". Naturals take a clear pre-mixed (vinyl) adhesive pasted on the back and left to go tacky; silk takes a heavy-duty clear pre-mixed adhesive with no added water. Wood veneer takes clay adhesive. Aviator leaves a blank-stock liner to the hanger, dried overnight; Tailored Linens II suggests one where paint adhesion is poor. No claims after three strips. Its own guide says never a paint primer.
- **Sources (checked 11 Oct 2026; all fetched):**
  - Help centre, "Should I use lining paper?": https://support.phillipjeffries.com/en/articles/11056901-should-i-use-lining-paper ("Lining paper is not a necessity with most wallpaper collections"; "This tends to be mandatory for products with a metallic sheen").
  - Manila Hemp (HEMP 9.3.26): https://api.phillipjeffries.com/files/instructions/HEMP%209.3.26.pdf ("a hard, acrylic, pigmented, wall-protecting primer that is SPECIFICALLY made for WALLCOVERING INSTALLATION and WALL PROTECTION. DO NOT USE R-35"; "We recommend a clear, pre-mixed vinyl adhesive"; "Apply the paste to the back of the paper"; "Allow the paste to become tacky prior to hanging"; "NO CLAIMS WILL BE ALLOWED FOR MORE THAN (3) STRIPS ON THE WALL").
  - Silk (Star Dust, Sunset): https://api.phillipjeffries.com/files/instructions/SILK%20%28ALL%20Star%20Dust%2C%20Sunset%29.pdf ("We recommend a heavy duty clear, pre-mixed adhesive"; "Do not add water to the paste as it may cause the backing paper to pull away from the front").
  - Aviator: https://api.phillipjeffries.com/files/instructions/AV.pdf ("paper hanger may want to consider lining the walls with blankstock liner paper ... We leave this to the discretion of the paper hanger. Allow liner to dry overnight").
  - Tailored Linens II: https://api.phillipjeffries.com/files/instructions/TL.pdf ("If there is poor paint adhesion, consider using a blank stock lining paper").
  - Against the Grain (4.3.26): https://api.phillipjeffries.com/files/instructions/AGAINST%20THE%20GRAIN%204.3.26.pdf ("We recommend a Clay Adhesive").
  - The same primer line, checked on Grandview Grass, COT (Handira Cloth), Japanese Paper Weaves (8.28.25) and Vinyl (3.24.26) at api.phillipjeffries.com/files/instructions/.
  - Blog, "THE HANG: Prep, Prime, and Line" (3 Oct 2023): https://blog.phillipjeffries.com/the-hang-how-to-prep-wall-for-hanging-wallcovering ("a liquid wallcovering primer like Zinsser Sheildz (never a paint primer)").
- **Used in:** guide (opening; maker table; cross-lining; primers; paste; paste the wall; soak table; closing); faq.json lining-required-or-recommended, why-prime-and-with-what, pigmented-or-tinted-primer, paste-the-wall-or-the-paper, can-paste-be-diluted.
- **Not claimed:** what Phillip Jeffries' "R-35" refers to. Its sheets do not name a maker. Calico's own "Do not use Roman R-35 Pro-935" is quoted separately.

### Maya Romanoff

- **Fact:** Precious Metals (metal leaf): a heavy-duty non-woven liner is strongly recommended, painted with tinted flat paint at the seams. No sealing primer, and no eggshell, satin or semi-gloss walls. Clear strippable adhesive MR-RA-888 on the back. Ajiro Honeycomb: primer tinted close to the product colour.
- **Sources (checked 11 Oct 2026):** https://assets.mayaromanoff.com/web/pdf/Installation-guidelines/PM_Precious-Metals_Installation-Guide.pdf ("We strongly recommend hanging heavy-duty non-woven wall liner (available from Maya Romanoff)"; "Paint the wall liner with one coat of flat latex wall paint tinted close to the color of your product at the wallcovering seam locations"; "Do not use sealing primer/do not install on sealed walls (no eggshell, satin or semi-gloss paints)"); https://assets.mayaromanoff.com/web/pdf/Installation-guidelines/AZ_Ajiro-Honeycomb_Installation-Guide_1.pdf ("Roman Pro-977 Ultra Prime Primer or comparable tinted close to the color of your product").
- **Used in:** guide (maker table; primers); faq.json who-makes-lining-paper, prime-over-lining-paper, pigmented-or-tinted-primer.

### Pierre Frey

- **Fact:** The wall must be hard, smooth, clean, dry and normally absorbent (French standard DTU 59.4). Metylan pastes by backing and width, and Ovalit for wider or thicker coverings. Non-woven goes on a pasted wall, rolled 10 cm wider than the drop, with less glue at the seam. Paper backing is pasted on the back and soaked for the paste maker's time. No claim after three drops. No lining grade or primer is named in its five English hanging guides.
- **Sources (checked 11 Oct 2026):** 'Wallpapers hanging instructions – Non woven backing – Trimmed', embedded at https://www.pierrefrey.com/en/technical-assistance/wallpapers-hanging-instructions-non-woven-trimmed-1 (PDF via Calaméo: https://www.calameo.com/download/004916754eca70cea779a?authid=WOz6tIKm89jE) ("the wall must be normally absorbent"; "Width<80cm, non-woven backing => metylan intisse Henkel ... paper backing => metylan special Henkel Width >81cm ... ovalit TM or Ultra"; "adding 10 cm to the width of the drop ... Limit the amount of glue around the seam area"; "Excess paste can spill out on the front"; "no claim will be accepted after 3 drops have been hung"). Paper-backing guide: "Respect the soaking time indicated on the paste's instructions." pierrefrey.com returned 403 to curl; the research read the PDFs through the browser network log, with no bot check bypassed.
- **Used in:** guide (maker table; paste the wall; soak note; closing); faq.json paste-the-wall-or-the-paper, ready-mixed-or-powder-paste.

### Dedar

- **Fact:** Lehti Wall (linen on non-woven) goes on a pasted wall and is double-cut. It is best hung on an even surface painted the colour of the product.
- **Sources (checked 11 Oct 2026):** https://dedar.com/lehti-wall/ ("It is recommended installing this wallcovering on an even surface painted in the same colour as the chosen product"; "Apply paste directly to wall").
- **Used in:** guide (primers); faq.json pigmented-or-tinted-primer.

### Calico Wallpaper

- **Fact:** A wallpaper-specific primer on all surfaces. The paper guide names US products, rules out Roman R-35 Pro-935, and sends buyers outside the USA to Calico for local recommendations. Paste on the back, book about 5 minutes, clear adhesives.
- **Sources (checked 11 Oct 2026; guide fetched):** Paper Install Guide: https://calicowallpaper.com/wp-content/uploads/TearSheets/Install%20Guides/Wallpaper-Paper-Install-Guide.pdf ("Roman Pro-880 or Pro-838 Clear Adhesives"; "Do not use Roman R-35 Pro-935"; "If you are outside of the USA and require product recommendations in your local market, please contact us"; "book for ~ 5 min so the backing can relax and expand"); FAQs: https://calicowallpaper.com/about/faqs/ ("primed with a wallpaper-specific primer").
- **Used in:** guide (maker table; primers; soak table); guide FAQ "Can a primer or paste named in a US instruction be swapped for a UK one?"; faq.json pigmented-or-tinted-primer, how-long-paper-soaks.

### Vescom (Vescom wallcoverings only)

- **Fact:** No lining step: existing wallcoverings and backing papers are removed, and the wall is primed with Vescom Primer/Sealer, 1:3 with water on normally absorbent plaster or neat on highly absorbent surfaces, each about 5 hours. Wall at least 10 °C, building moisture no more than 6%. Used neat, the primer makes later removal easier. Sealed surfaces get adhesive 3000. Only Vescom adhesive: 1000 for vinyl up to 370 g/m², 2000 for textile and heavier vinyl, 2500 for digital print, 3000 for non-porous substrates. Dilution: 1000 up to 4% water, 2000 up to 6%, 2500 and 3000 none.
- **Sources (checked 11 Oct 2026; fetched):** General specifications for use, 2025: https://documents.vescom-cdn.com/f1873/EN%20-%20Algemeen%20verwerkingsvoorschrift%20-%20Vescom%20vinyl%2C%20olefin%20en%20textiel%20wandbekleding%202025.pdf ("Completely remove existing wallcoverings and backing papers"; "primed with Vescom primer/sealer in the ratio of 1 part primer to 3 parts water. Allow this to dry for ± 5 hours"; "The building moisture content of the underlying surface should not exceed 6%"; "If Vescom primer/sealer is used undiluted, it will be easier to remove the wallcovering"; "Use only Vescom adhesive for optimum results"; "Vescom 2500 and Vescom 3000 adhesive may not be diluted").
- **Used in:** guide (opening; maker table; sizing; primers; paste; fire); faq.json lining-required-or-recommended, why-prime-and-with-what, primer-under-contract-wallcoverings, can-paste-be-diluted.

### Lincrusta

- **Fact:** Porous walls get a size, which is diluted wallpaper adhesive. Non-porous walls are cross-lined. Lincrusta Adhesive only, not diluted.
- **Sources (checked 11 Oct 2026):** LIN-161 (2026-04-28): https://lincrusta.com/wp-content/uploads/2026/08/LIN-161-Hanging-Instructions-2026-04-28-1-Digital.pdf ("For POROUS surfaces, rub down before applying a coat of size (diluted regular wallpaper adhesive). For NON-POROUS surfaces (eg. solvent painted walls), cross-line"; "We DO NOT recommend using any other adhesives").
- **Used in:** guide (maker table; sizing; paste); faq.json paste-for-each-wallcovering.

### Naturals: Thibaut, Omexco, Iksel (contract-naturals key, verified by me)

- **Fact:** Thibaut grasscloth takes a universal pre-wallcovering primer on all surfaces and a clear pre-mixed vinyl adhesive, booked 2–5 minutes and not over-soaked. Omexco sheet [n] says never hang over new plaster or unprimed walls, and boards get an acrylic basecoat. The back is soaked with water for at least 1 hour, then the strip goes onto a wall pasted with ready-mixed PVA or EVA clear adhesive at about 200 g/m², not over-pasted. No claims after 3 strips. Iksel's standard non-woven is pasted on the wall only.
- **Sources (checked 11 Oct 2026; fetched):**
  - Thibaut, Instructions for hanging Thibaut Grasscloth: https://cdn.builder.io/o/assets%2F9da1c69eaad44798835fb0df36bc255a%2F257524a3f93248df8d4bdd7281d1c1c7?alt=media&token=4e87c787-99bc-45b3-a247-8b400e0d5982&apiKey=9da1c69eaad44798835fb0df36bc255a ("We recommend the use of a Universal Pre-Wallcovering Primer on all surfaces"; "We recommend a clear pre-mixed vinyl adhesive"; "Pasted rolls should be booked for 2 to 5 minutes"; "Do not over soak, as it may cause the grasscloth to separate from the paper backing").
  - Omexco, hanging instructions [n]: https://d1iq0uo1hfy704.cloudfront.net/files/N_hanging-instructions_humidify-abudantly-1-hour.pdf ("Never hang over new plaster or unprimed wall areas. For wallboard, ply or drywall, fill all cracks and prepare the surface with an acrylic basecoat"; "Abundantly humidify the back of the wallcovering and let it soak for at least 1 hour"; "Apply a ready mixed PVA or EVA clear adhesive to the wall"; "about 200 g/m2"; "No claims will be accepted beyond the installation of 3 strips").
  - Iksel, Standard Non-Woven (12 May 2025): https://iksel.com/wp-content/uploads/2025/11/IKSEL_Hanging_Instructions_SNW_Standard_Non_Woven_Untrimmed_250512.pdf ("Apply adhesive only to the wall, not to the wallpaper").
- **Used in:** guide (primers; paste; soak table; closing); faq.json pigmented-or-tinted-primer, paste-the-wall-or-the-paper, how-long-paper-soaks.

### Erfurt & Sohn (Wuppertal): Makulatur and Variovlies

- **Fact:** Makulatur 88 PRO is 80 g/m² paper, 33.50 × 0.53 m. Makulatur 95 PRO is 120 g/m², 17.00 × 0.53 m, separable so later wallcoverings strip off it. Both soak 5–10 minutes and are class C-s1,d0. Variovlies V 130, V 150 and V 180 PRO are about 130, 150 and 180 g/m² in 25.00 × 1.00 m rolls (and 0.75 m). Their sheets list no soaking, paste-the-wall, covers cracks and easy to remove. M 120 to M 160 PRO are 120–160 g/m²; M 120 PRO is B-s1,d0 and comes in 25.00 × 1.00 m. V 200 S PRO is about 200 g/m², 1.00 m. R 300 PRO is about 280 g/m², 25.00 × 1.00 m, hung on SR 2 PRO or SR 4 PRO system adhesive, class D-s1,d0; any wallcovering can go over it, at the very least on special adhesive at 1:20, and dry-strippable ones come off it. Erfurt's guide says dimensional stability lets Variovlies go on a pasted wall. Its "Can be wallpapered over" row rates V 130, V 150 and V 180 "Recommended" and the M grades and V 200 S "Limited suitability". Erfurt's pre-treatment table marks plasterboard for clear or pigmented primer only, not paste. Metylan and Pufas pastes are named for Variovlies.
- **Sources (checked 11 Oct 2026; fetched unless marked):**
  - Makulatur 88 PRO: https://www.erfurt.com/fileadmin/download/products/PRF_PVTM_Makulatur_88PRO_2025_GB01.pdf ("Weight: 80 g/m2"; "The soaking time is about 5-10 minutes"); Makulatur 95 PRO: https://www.erfurt.com/fileadmin/download/products/PRF_PVTM_Makulatur_95PRO_2025_GB01.pdf ("All wallcoverings can be removed with ease from the top of the separable lining paper").
  - Variovlies V 150 PRO: https://www.erfurt.com/fileadmin/download/products/PFRPVTM-VV_V150-Profi_2025_GB01.pdf ("Roll dimensions: 25.00 x 1.00 m"; "Weight: approx. 150 g/m2"; benefits "No soaking", "Paste-the-wall technique", "Covers cracks", "Easy to remove"); V 130 PRO: https://www.erfurt.com/fileadmin/download/products/PRFPVTM_VV130-Profi_2025_GB01.pdf ("Roll dimensions: 25.00 x 1.00 m", approx. 130 g/m2); V 180 PRO: https://www.erfurt.com/fileadmin/download/products/PRFPVTM-VV180PRO_Profi_2025_GB03.pdf ("Roll dimensions: 25.00 x 1.00 m", approx. 180 g/m²).
  - Variovlies M 120 PRO: https://www.erfurt.com/fileadmin/download/products/PRF_PVTM_Variovlies_M_120_2025_GB01.pdf ("Roll dimensions: 25.00 x 1.00 m"); M 160 PRO (research): https://www.erfurt.com/fileadmin/download/products/PRFPVTM_Variovlies_M_160_2025_GB01.pdf; V 200 S PRO (research, DE): https://www.erfurt.com/fileadmin/download/products/PRFPVTM-VV200-Profi-2025_DE06.pdf ("Rollenabmessung: 25,00 x 1,00 m ... Grammatur: ca. 200 g/m²").
  - Variovlies R 300 PRO: https://www.erfurt.com/fileadmin/download/products/PRFPVTM_Variovlies_R300_2025_GB01.pdf ("Weight: approx. 280 g/m2"; "All wallcoverings can be applied to ERFURT-Variovlies R 300 PRO"; "at the very least special adhesive at a ratio of 1:20 (200 g in 4 litres of water)"; "All dry-strippable wall coverings can be removed"; "D-s1,d0").
  - ERFURT-Variovlies Guide (professional handbook, GB): https://www.erfurt.com/fileadmin/download/service/Folder/Variovlies_Handbuch_Profi_GB.pdf ("Due to their dimensional stability, Variovlies wallpapers can be applied using the paste-the-wall technique"; page 31, "Coating recommendations for all Variovlies", row "Can be wallpapered over". The table is graphic, so I rendered page 31 and read it: Recommended for V 130, V 150, V 180, ECO 130 PLUS, ECO 150 PLUS and T 180 AQUA; Limited suitability for M 120, M 130, M 140, M 150, M 160, V 200 S and T 1100 MAGNET).
  - Pre-treatment table (research): https://www.erfurt.com/fileadmin/user_upload/tipps-inspirationen/faq/Erfurt_Tabelle_Vorbehandlung.pdf ("Wann und womit muss welcher Untergrund grundiert werden?"; Gipskarton: Tapetengrund farblos or pigmentiert only).
- **Used in:** guide (grades; paper or non-woven; lining makers table; Fromental section, Erfurt's description of its non-woven; sizing; paste; fire); guide FAQ "Can the lining and the wallpaper share one paste?"; faq.json lining-grade-or-weight, paper-or-non-woven-liner, who-makes-lining-paper, ready-mixed-or-powder-paste, adhesive-and-fire-classification.

### Erfurt MAV, Wallrock and Anaglypta (Gainsborough)

- **Fact:** Erfurt MAV is the UK business formed when MAV joined Erfurt & Sohn in 2005. Professional Lining Paper is described grade by grade:
  - 800: new plaster; 56 cm wide; soak 6–8 minutes.
  - 1000: older plaster in good condition; 53 cm; 8–10 minutes.
  - 1200 and 1400: minor and larger cracks; 10 minutes; ready-mixed paste.
  - 1700 to Supercover 2500: damaged plaster; 10–12 minutes; ready-mixed paste recommended.
  - Heavier grades cover more; worse walls go to the "back to flat" products. All grades are butt-jointed and dried thoroughly.
- **Fact, Wallrock Fibreliner:** paper reinforced with polyester fibres. 150 g/m² (Original, Smooth) in 55, 75 and 100 cm; Ultracover 210 is 210 g/m² in 55 and 100 cm. No soaking, ready-mixed adhesive, normally 24 hours to dry.
- **Fact, other Wallrock products:** Thermal Liner is class E and not for Building Regulations projects such as new builds and extensions. The Wallrock PVA sealer is diluted 1:3 with water.
- **Fact, Anaglypta:** lining 1000 to 2000 and Supercover 2500. The 1400 label says lining ideally runs at 90° to the finish, soaks 8–12 minutes, and absorbent walls are sized. Its FAQ says lining paper can expand up to 10 mm when soaked; gives a water-flick sizing test; and says ready-mixed pastes have good wet tack, unlike many dry flake types.
- **Sources (checked 11 Oct 2026):**
  - About: https://www.erfurtmav.com/about ("In 2005, the UK company of McMullen and Valentine (MAV) joined forces with the German Company of Erfurt & Sohn, trading as Erfurt MAV in the UK").
  - Professional Lining Paper 800, 1000, 1200, 1400, 1700, 2000 and Supercover 2500: https://www.erfurtmav.com/erfurt-mav-wallpaper-products/accessories/product/472-professional-lining-paper-800-grade ("Protects and prepares new plaster"; "6 - 8 mins"); …/491-professional-lining-paper-1000-grade ("older plaster in good condition"; "8 - 10 mins"); …/495-professional-lining-paper-1200-grade ("minor cracks"); …/499-professional-lining-paper-1400-grade ("larger cracks"; "The heavier the grade of lining the more effectively it will cover and smooth out defects"); …/503-professional-lining-paper-1700-grade ("damaged and crumbling plaster"); …/507-professional-lining-paper-2000-grade ("For Heavy grade papers, we recommend a good quality ready mixed adhesive"); https://www.erfurtmav.com/erfurt-mav-wallpaper-products/wallrock/product/577-supercover-2500-grade-lining-paper.
  - Wallrock Fibreliner Original 150: https://www.erfurtmav.com/erfurt-mav-wallpaper-products/wallrock/wallrock-fibreliner-150 ("double length: 20m x 100cm"; "no soaking is required"; "normally 24 hours is sufficient"); Smooth 150: https://www.erfurtmav.com/erfurt-mav-wallpaper-products/wallrock/wallrock-fibreliner-151 ("polyester textile fibres which act to reinforce the paper"); Ultracover 210 leaflet: https://www.anaglypta.co.uk/wp-content/uploads/2026/01/Wallrock-Fibreliner-ULTRA-210-55-double-FL.pdf ("at 210gsm"; "Available in 55 and 100cm widths").
  - Wallrock Thermal Liner: https://www.erfurtmav.com/erfurt-mav-wallpaper-products/wallrock/wallrock-thermal-liner ("This product is class E fire rated and should not be used for projects such as new builds and extensions where Building regulations are applicable").
  - Wallrock Multipurpose PVA Sealer & Primer: https://www.erfurtmav.com/erfurt-mav-wallpaper-products/accessories/wallrock-multipurpose-pva-sealer-primer ("a dilution of one part Sealer Primer to 3 parts water").
  - Anaglypta 1400 label: https://www.anaglypta.co.uk/wp-content/uploads/2026/01/Anaglypta-1400-D-Heritage-Homebase-bcode-53-GERMAN-FSC.pdf ("the lining paper should ideally be applied at 90° to the final wallcovering"; "we recommend 8-12 minutes"); FAQs: https://www.anaglypta.co.uk/faqs/ ("Lining paper can expand by as much as 10mm when soaked, though most wallpapers typically expand around 3–6mm"; "To check if your wall needs sizing, simply flick a little water onto the surface"; "Ready mixed adhesives typically have these properties, unlike many dry flake types"); range menu: https://www.anaglypta.co.uk/.
  - Late on 11 Oct 2026, erfurtmav.com and anaglypta.co.uk returned HTTP 403 to my curl re-check. The research team had read them earlier that day. Spot-check them in a browser before merging.
- **Used in:** guide (grades; paper or non-woven; lining makers table; cross-lining; sizing; soak; fire); guide FAQ (lining drying time); faq.json lining-grade-or-weight, paper-or-non-woven-liner, who-makes-lining-paper, what-is-cross-lining, why-prime-and-with-what, pva-as-a-size, how-long-paper-soaks, ready-mixed-or-powder-paste, adhesive-and-fire-classification.
- **Not claimed:** that Erfurt MAV calls Wallrock Fibreliner a non-woven (its English copy says "paper", "Reinforced Lining Paper"), or that it approves any liner under silk or textile.

### Other lining makers: Arte, Marburg

- **Fact:** Arte's Protecno Professional Liner is a smooth non-woven, sold as "the ideal substrate for wallpaper and paintwork". It is 150 g/m², 25.00 × 1.06 m, pasted on the wall. Marburg names PATENT VLIES (e.g. 9769) as the lining under its digital-print and photo wallpapers; 9769 Patent Decor is a non-woven roll of 2500 × 106 cm.
- **Sources (checked 11 Oct 2026):** ArteTechnics brochure (fetched): https://edge.arte-international.com/media/8c369ca9-7d9e-4a9d-8b9f-b50bf96205e2/ArteTechnics_Digitaal_EN.pdf ("The ideal substrate for wallpaper and paintwork"; "The smooth non-woven is ideal for obtaining a sleek, even result"; "Installed by applying adhesive to the wall"; "150 gr/m 2 - 25,00 m x 1,06 m"); Marburg, Technische Information (Stand Juni 2026): https://pub-4706ffacbd894a319bf1c397303d141e.r2.dev/2026/07/02074555/Technische-Infoblaetter_SCALE.pdf ("Durch die Verklebung eines PATENT VLIES (z. B. Artikel-Nr. 9769 oder 9792) als Makulatur erhält man einen gleichmäßigen Untergrund"); 9769 Patent Decor: https://marburg.com/en/search/9769-patent-decor/ ("Dimensions 2500 × 106 cm"; "Substrate Non-woven").
- **Used in:** guide (grades; lining makers table); faq.json lining-grade-or-weight, who-makes-lining-paper.

### Pastes named by makers: Albany, Bartoline, Murabond, Metylan

- **Fact, Albany (Brewers' own brand):**
  - Super Smooth, the yellow lid, is a starch and vinyl acetate dispersion "for hanging all wallpapers". It contains extra PVA.
  - Its label says to use the same adhesive for the lining paper. It also says to size porous surfaces with the paste mixed with an equal quantity of water.
  - Speciality, the red lid, lists silks, grasscloths, linens and hessians.
- **Fact, Bartoline:** Extra Strong Professional is a hot blend of starch and PVA emulsions. Bartoline's PVA data sheet thins PVA 1:4 for sealing porous surfaces and does not list wallpaper among its uses.
- **Fact, Murabond:** Heavy is for fabric-backed wallcoverings and Light for paper-backed vinyl. Sealed Surface Adhesive is for sealed surfaces. The Murabond PVA Primer is compatible with all Murabond adhesives.
- **Fact, Metylan (Henkel):**
  - Metylan Vlies is a methylcellulose (MHEC) paste with synthetic resin, for non-wovens.
  - Metylan NP is mixed 1:20 as a size and 1:10 for embossed non-woven.
  - In 2013 Henkel advised against paint-system primers before wallpapering. Its rule: paste where only absorbency needs regulating, a strengthening wallpaper primer where more is needed.
- **Sources (checked 11 Oct 2026):**
  - Albany Super Smooth data sheet: https://www.brewers.co.uk/uploads/datasheets/products/202334.pdf?v=1665669000 ("Ready To Use Wallpaper Adhesive is suitable for hanging all wallpapers ... It contains additional PVA"); safety data sheet AFS10: https://www.brewers.co.uk/uploads/datasheets/hands/200233.pdf?v=1665668970 ("Water based dispersion of Starch and Vinyl acetate homopolymer"); tub label image: https://www.brewers.co.uk/uploads/1200/14546106613005539094769_1200.jpg?v=1454610661 ("It is important to use the same adhesive for lining paper under finished paper"; "Porous Surfaces should be sized with this product mixed with an equal quantity of water"); Speciality data sheet: https://www.brewers.co.uk/uploads/datasheets/products/202333.pdf?v=1665668984 ("silks, grasscloths, linens, wools, hessians"). Brewers owns the brand ("Albany is Brewers' exclusive brand", brewers.co.uk/brands/albany), so these are the brand owner's documents. The 202334 data sheet returned 403 to my late curl re-check.
  - Bartoline product page: https://bartoline.co.uk/product_items/ready-mixed-adhesive-professional/ ("manufactured from a hot blend of high-quality starch and PVA emulsions"); PVA data sheet: https://bartoline.co.uk/wp-content/uploads/2018/08/BARTOLINE-PVA-Adhesive-Sealer-TDS.pdf ("dilute 1 part Bartoline PVA with 4 parts water").
  - Muraspec: https://www.muraspec.com/product/heavy10kg/ ("To be used when hanging any Muraspec fabric backed wallcovering. On sealed surfaces use Murabond Sealed Surface Adhesive"); https://www.muraspec.com/product/light10kg/ ("paper backed vinyl"); https://www.muraspec.com/product/primer2-5k/ ("Murabond Primer is compatible with all Murabond adhesives").
  - Henkel: https://datasheets.tdx.henkel.com/METYLAN-Vlies-de_DE.pdf ("Methylcellulose (MHEC), Kunstharz"); https://datasheets.tdx.henkel.com/METYLAN-NP-Raufaser--VliesPulver-de_DE.pdf (Vorkleistern 1:20; embossed non-woven 1:10); press release 7 Oct 2013: https://www.henkel.com/resource/blob/191636/7fa7229ba4f48e6690996c09420a8984/data/2013-10-07-presseinformation-konzentration-auf-das-wesentliche-pdf.pdf ("Generell ist die Verwendung von Grundierungen aus Anstrichsystemen oder gar Anstrichmitteln als Untergrundvorbehandlung vor Tapezierarbeiten nicht zu empfehlen").
- **Used in:** guide (cross-lining; sizing; paste); guide FAQ (shared paste); faq.json why-prime-and-with-what, pva-as-a-size, primer-under-contract-wallcoverings, paste-for-each-wallcovering, can-paste-be-diluted.

### Primers named by makers: Zinsser, Roman; plasterboard: British Gypsum

- **Fact:** New plaster is extremely porous and extremely alkaline, often pH 12.0 or more (Zinsser UK). Zinsser rates Gardz alkali-resistant to pH 12.5. Gardz goes on plaster cured at least 24 hours, takes wallpaper after 3 hours, and protects plasterboard when old wallcovering is stripped. Rust-Oleum's Gardz sheet says translucent wallcoverings may need an extra coat of opaque primer. Roman describes PRO-935 R-35 as a heavy-tack primer for non-porous surfaces such as tile and glass. British Gypsum says vinyl and other low-permeability wallcoverings should not go straight onto board treated with Gyproc Drywall Sealer.
- **Sources (checked 11 Oct 2026):** Zinsser UK (Tor Coatings) Gardz data sheet: https://zinsseruk.builtbybeluga.com/media/pages/products/gardz/271667e5f8-1727452047/gardz.pdf ("Freshly applied plaster is extremely porous but also extremely alkaline with a pH of 12.0 or more in many cases"; "Allow new plaster to cure at least 24 hours before applying Gardz"; "ready for finish coating or wallpapering after 3 hours"; "Gardz protects the surface of the drywall when the old wallcovering is stripped off"); Rust-Oleum, Gardz TDS GDZ-01: https://www.rustoleum.com/-/media/20879290034B43B58B6563DE2E611CC6.ashx ("translucent wallcoverings may require an additional coat of an opaque primer"); Roman, Wallpaper Primers (fetched): https://romandecoratingproducts.com/collections/wallpaper-primers ("For non-porous surfaces such as ceramic tile, glass, and Formica, PRO-935 R-35 dries with a heavy tack"); British Gypsum FAQ (Wayback copy, 17 Jun 2024; live site behind a bot check): https://web.archive.org/web/20240617105417/https://www.british-gypsum.com/technical-support/self-help-tools/faqs/how-do-you-apply-wallpaper-plasterboard ("Vinyl or other low-permeability wall coverings restrict drying of water-based adhesives. This combination should, therefore, not be applied direct to plasterboard treated with Gyproc Drywall Sealer").
- **Used in:** guide (sizing; primers); faq.json why-prime-and-with-what, size-or-primer-new-plaster, pigmented-or-tinted-primer, primer-under-contract-wallcoverings.

### Fire: the adhesive and liner in the build-up

- **Fact:** Arte's classification report for its natural wallcoverings was issued by Centexbel (Ghent, a CPR notified body) on 18 Sep 2026, report 19/745. It gives B-s1,d0 for one field of application: starch glue at 200 g/m² on substrates of at least 1350 kg/m³ classified A2-s1,d0 or A1. Liner classes appear in the Erfurt and Erfurt MAV entries above.
- **Sources (checked 11 Oct 2026; fetched):** https://edge.arte-international.com/media/2ee4d956-0c3e-4816-8cd9-d725b0c99db0/2.-Wallcovering-with-natural-materials.pdf ("B - s1, d0"; "field of application: glued (starch glue applied at the rate of 200 gr/m²) on end-use substrates having a density of 1350 kg/m3 or higher and classified A2-s1,d0 or A1"). The PDF is linked from Arte's All Naturals collection pages (e.g. https://www.arte-international.com/en/collections/all-naturals/agave-1).
- **Used in:** guide ("Why is the adhesive part of the fire-tested build-up?"); faq.json adhesive-and-fire-classification. The class names are the standard's own; nothing here says a Mr Wallcover wall is fire-rated.

### Sizing rationale (Graham & Brown)

- **Fact:** Sizing stops a porous wall drawing the moisture out of the paste.
- **Sources (checked 11 Oct 2026):** Graham & Brown, How to hang wallpaper: https://www.grahambrown.com/uk/blog/how-to-hang-wallpaper/ (sizing stops porous surfaces "sucking the moisture out of your thick wallpaper paste").
- **Used in:** faq.json why-prime-and-with-what (first sentence, maker not named). It also restates the existing wall-preparation guide ("A primer or size controls suction").

### Where to buy (stockists, named only as where to buy)

- **Fact:** Brewers lists Wallrock and MAV lining beside its own Albany range. Wallpaper Direct, Screwfix and Toolstation list Wallrock and Anaglypta lining.
- **Sources (checked 11 Oct 2026):** Brewers lining papers: https://www.brewers.co.uk/products/wallpapers-fabrics/lining-papers ("Brand Wallrock (14) MAV (7) Albany (6) Three In One (1)"); Wallpaper Direct: https://www.wallpaperdirect.com/wallpapering-tools/lining-papers (Wallrock Fibreliner; Anaglypta Supercover Lining 2500); Screwfix: https://www.screwfix.com/c/painting-decorating/lining-paper/cat6100030 ("Brand Anaglypta ( 2 ) Erfurt ( 2 ) Wallrock ( 10 )"); Toolstation: https://www.toolstation.com/wallrock-fibreliner/p14480 and https://www.toolstation.com/brands/anaglypta ("Anaglypta SuperCover 2500 Lining paper").
- **Used in:** guide (lining makers); faq.json who-makes-lining-paper. No prices are used.

## Owner-confirmed practice: lining and priming (FAQ brief, 11 Oct 2026)

These are the only first-person practice sentences in the guide and FAQ groups. They are published on the owner's word, not on a maker's document, and no reason is attached except where Erfurt's own data sheet states it.

- "For Fromental's non-woven-backed silks, we line the wall with Erfurt's 100 cm wide non-woven lining. That is our own practice and standard for those silks, not a Fromental rule." Used in the guide (section "What do we line Fromental's non-woven-backed silks with?", opening sentences); the guide FAQ "Is the Erfurt liner a Fromental requirement?"; and faq.json fromental-non-woven-silk-lining. Dorin described this liner as "required / recommended" for those silks. It is published as our practice and standard, never as Fromental's rule. Source: Dorin Burcus, owner, 11 Oct 2026 (FAQ brief in chat).
- "We prime the walls with a good primer before hanging, where the product's instruction allows it; the maker's instruction comes first." Used in the guide (section "When is a size enough, and when does the wall need a primer?", first sentence) and faq.json why-prime-and-with-what. Source: Dorin Burcus, owner, 11 Oct 2026 (FAQ brief in chat).

## Dust, damp and protection: room temperature and humidity for hanging (11 Oct 2026)

- **Fact:** Each maker sets its own room conditions. Erfurt: +18 to +25 °C at 30–60% relative humidity for its Variovlies non-woven. Fromental: 18–25 °C at 40–60% RH for linen and specialist fabric papers. Farrow & Ball: not below 10 °C or above 25 °C, not for high-humidity areas, ventilate kitchens and bathrooms. Muraspec: site heated to at least 12 °C, with good ventilation during hanging and drying. Vescom: wall surface at least 10 °C, building moisture content no more than 6%.
- **Sources (checked 11 Oct 2026):**
  - Erfurt & Sohn, Technical Data Sheet ERFURT-Variovlies M 120 PRO (GB, 07/2025): https://www.erfurt.com/fileadmin/download/products/PRF_PVTM_Variovlies_M_120_2025_GB01.pdf ("+18 to +25 °C and 30 to 60% relative air humidity").
  - Fromental, "How to Install Linen and Specialist Fabric Wallpapers": https://fromental.com/pages/fromental-shop-how-to-install-linen-and-specialist-fabric-wallpapers ("Maintain a room temperature of 18°C–25°C and relative humidity of 40%–60%").
  - Farrow & Ball, Product Advice Sheet, Crivelli Rose wallpaper: https://www.farrow-ball.com/media/wysiwyg/Product-Advice-Sheets/Wallpapers/Crivelli_Rose_GBD30BT.pdf ("Do not apply in temperatures below 10°C or in excessive heat above 25°C"; "Our papers are not suitable for high humidity areas").
  - Muraspec, UK Hanging Instructions (Feb 24): https://muraspec.com/wp-content/uploads/2024/05/Muraspec-UK-Hanging-Instructions-Feb-24.pdf ("heated to at least 12°C [55°F], and that ventilation is good").
  - Vescom, General specifications for use, vinyl, olefin and textile wallcovering (2025): https://documents.vescom-cdn.com/f1873/EN%20-%20Algemeen%20verwerkingsvoorschrift%20-%20Vescom%20vinyl%2C%20olefin%20en%20textiel%20wandbekleding%202025.pdf ("must be at least 10°C"; "should not exceed 6%").
- **Used in:** Guide, "What temperature and humidity does a room need for hanging?" (paragraph and table) and frontmatter FAQ 1. FAQ `damp` / `room-temperature-humidity`.

## Dust, damp and protection: acclimatising the rolls (11 Oct 2026)

- **Fact:** Fromental asks for its linen papers to be stored at normal room temperature and humidity for at least three days before installation. The building must be weather-tight, with heating and ventilation running normally from three days before. An earlier Fromental guide for bespoke non-woven-backed silk asked for the rolls to be kept in the room for at least three days, and for room conditions to stay the same before, during and for at least three days after the hang.
- **Sources (checked 11 Oct 2026):**
  - Fromental, "How to Install Linen and Specialist Fabric Wallpapers": https://fromental.com/pages/fromental-shop-how-to-install-linen-and-specialist-fabric-wallpapers ("for at least three days before installation"; "weather-tight and fully enclosed").
  - Fromental, Installation Guide, Non-Woven Backed Silk Wallcoverings (PDF created 4 July 2022; Wayback copy of 30 Nov 2023, live file now 404): https://web.archive.org/web/20231130182143/https://fromental.co.uk/cdn/shop/files/Nonwoven_paper_backed_silk_Installation_Guide.pdf?v=17284818687869208217 ("stored within the area it will be installed for at least 3 days").
- **Used in:** Guide, "Why do the rolls wait in the room before they are hung?". FAQ `damp` / `rolls-acclimatise`.

## Dust, damp and protection: drying too fast or too slow (11 Oct 2026)

- **Fact:** Erfurt says to avoid rapid drying by draughts or strong heating, which can open seams that show once the paper is painted, and to avoid drying too slowly below 10 °C. In arid, low-humidity rooms de Gournay sizes the lining paper with paste so its panels dry more slowly.
- **Sources (checked 11 Oct 2026):**
  - Erfurt & Sohn, Variovlies M 120 PRO data sheet (07/2025): https://www.erfurt.com/fileadmin/download/products/PRF_PVTM_Variovlies_M_120_2025_GB01.pdf ("avoid rapid drying by draughts or strong heating"; "Rapid drying can lead to openings along the seam").
  - de Gournay, Wallpaper Hanging Instructions (2026 edition): https://degournay.com/uploads/technical/document/2026_Hanging_Instructions-After-2025.pdf ("sizing the lining paper with paste which will slow down drying").
- **Used in:** Guide, "Why do sudden heat and draughts cause trouble?" and "When is a dehumidifier used, and which kind?" (do not aim a machine at fresh seams). Frontmatter FAQ 1. FAQ `damp` / `dehumidifier-when`.

## Dust, damp and protection: damp walls are not papered (11 Oct 2026)

- **Fact:** The makers rule out papering a damp wall. Sanderson: never hang wallpaper over a damp wall. Fromental: walls free from damp, moisture ingress or condensation. Muraspec and Vescom: dry in depth. Historic England: wet paper and paste can feed mould. UK government: mould can hide on the back of wallpaper. Of the instructions quoted, only Vescom gives a figure (6%). Historic England warns that forced drying can leave the surface dry and the bulk of the wall wet. For old buildings it asks for walls to be "dry for the purpose".
- **Sources (checked 11 Oct 2026):**
  - Sanderson, FAQs: https://www.sanderson.design/pages/faqs ("never hang wallpaper over a damp wall").
  - Fromental, linen guide (as above): "free from damp, moisture ingress or condensation".
  - Muraspec, UK Hanging Instructions (as above): "dry in depth and in a sound condition".
  - Vescom, General specifications (as above): "thoroughly dry in depth".
  - Historic England, Flooding and Historic Buildings: Repair (research file; see the note at the top): https://historicengland.org.uk/advice/technical-advice/flooding-and-historic-buildings/repair-and-emergency-works/repair/ ("paper and paste can provide food for mould growth").
  - Historic England, Flooding and Historic Buildings: Drying (research file): https://historicengland.org.uk/advice/technical-advice/flooding-and-historic-buildings/repair-and-emergency-works/drying/ ("a temporary and superficial result"; "dry for the purpose").
  - GOV.UK (MHCLG, DHSC, UKHSA), Understanding and addressing the health risks of damp and mould in the home (updated 1 April 2026): https://www.gov.uk/government/publications/damp-and-mould-understanding-and-addressing-the-health-risks-for-rented-housing-providers/understanding-and-addressing-the-health-risks-of-damp-and-mould-in-the-home--2 ("such as on the back of wallpaper").
- **Used in:** Guide, "Why is a damp wall not papered?" and frontmatter FAQ 2. FAQ `damp` / `damp-wall-papering`.
- **Not used:** Schumacher's moisture limits (5.5% and 4% on the same page, so they contradict each other). No UK official numeric limit was found.

## Dust, damp and protection: new plaster (11 Oct 2026)

- **Fact:** British Gypsum says Thistle plasters must be thoroughly dry before decorating, with permeable paint allowed in the meantime. Its data sheet gives no drying time in days; the full text was checked. Backgrounds must stay at 2 °C or above until the plaster is dry, with longer drying and setting allowed for. DriCoat is for replastering after a flood or a new damp-proof course, and replastering should be delayed as long as possible so the background can dry. Cole & Son: never hang over new plaster or unprimed walls. de Gournay: new plaster must be properly sized.
- **Sources (checked 11 Oct 2026):**
  - British Gypsum, PDS Thistle MultiFinish (9 Sep 2022; Wayback copy of 26 Jun 2023; the live site has a human check): https://web.archive.org/web/20230626085127/https://www.british-gypsum.com/documents/product-data-sheet-pds/british-gypsum-pds-thistle-multifinish.pdf ("Make sure Thistle plasters are thoroughly dry before decorating").
  - British Gypsum FAQ, minimum temperature for gypsum products (Wayback copy of 19 Apr 2024): https://web.archive.org/web/20240419061557/https://www.british-gypsum.com/technical-support/self-help-tools/faqs/what-minimum-temperature-gypsum-products ("2°C or above until dry"; "allowance should be made for longer drying and setting times").
  - British Gypsum, PDS Thistle DriCoat (Wayback copy of 19 Jan 2024): https://web.archive.org/web/20240119171459/https://www.british-gypsum.com/documents/product-data-sheet-pds/british-gypsum-pds-thistle-dricoat.pdf ("after flooding, or after fitting a new damp proof course"; "delay replastering ... for as long as possible").
  - Cole & Son, Hanging Instructions: https://cole-and-son.com/pages/hanging-instructions ("Never hang over new plaster or un-primed walls.").
  - de Gournay, 2026 Hanging Instructions (as above): "New plaster and very absorbent surfaces must be properly sized."
- **Used in:** Guide, "How long does new plaster need to dry?". FAQ `damp` / `new-plaster-drying`.

## Dust, damp and protection: a dehumidifier does not cure the cause (11 Oct 2026)

- **Fact:** A dehumidifier dries a room's air; the cause of the damp (a leak, a building defect, condensation) has to be found and fixed. Historic England says to find and resolve the cause, not just the symptoms. The UK government says the underlying causes must be tackled, and that removing surface mould alone will not stop it coming back.
- **Sources (checked 11 Oct 2026):**
  - Historic England, Understanding Decay in an Older Home (research file; see the note at the top): https://historicengland.org.uk/advice/your-home/maintain-repair/decay/ ("find and resolve the cause of the problem, not just the symptoms").
  - GOV.UK damp and mould guidance (as above): "identify and tackle the underlying causes of damp and mould, including building deficiencies, inadequate ventilation and condensation"; "Simply removing surface mould will not prevent the damp and mould from reappearing".
- **Used in:** Guide, "Will a dehumidifier fix damp?" and frontmatter FAQ 2. FAQ `damp` / `dehumidifier-damp-cure` and `dehumidifier-when`.
- **Checked but cut for length:** US EPA, Mold Remediation in Schools and Commercial Buildings: https://www.epa.gov/sites/default/files/2014-08/documents/moldremediation.pdf ("The key to mold control is moisture control.").

## Dust, damp and protection: refrigerant (compressor) and desiccant dehumidifiers (11 Oct 2026)

- **Fact:** For drying old buildings, Historic England names refrigerant and desiccant dehumidifiers controlled by humidistats, with background heating of around 19–20 °C. It advises against aggressive machines and warns that heaters used without enough ventilation can raise absolute humidity. Meaco, a UK maker of both types, says how they compare. A compressor machine condenses water on a cold surface and suits rooms above about 10 °C. A desiccant machine uses a wheel and an internal heater and suits rooms below about 10 °C. Below 10 °C compressors spend more and more time defrosting. Air leaves a compressor about 2 °C warmer and a desiccant about 10–12 °C warmer. Meaco's 10L page confirms that a compressor dehumidifier uses refrigerant, which is why the copy says "Refrigerant (compressor)".
- **Sources (checked 11 Oct 2026):**
  - Historic England, Flooding and Historic Buildings: Drying (research file; see the note at the top): https://historicengland.org.uk/advice/technical-advice/flooding-and-historic-buildings/repair-and-emergency-works/drying/ ("refrigerant or desiccant dehumidifiers controlled by humidistats"; "around 19-20°C"; "the absolute humidity may actually increase").
  - Meaco (U.K.) Limited, "When to buy a desiccant dehumidifier and when to buy a compressor dehumidifier" (last updated 20 Oct 2025): https://blog.meaco.com/when-to-buy-a-desiccant-dehumidifier-and-when-to-buy-a-compressor-dehumidifier/ ("suitable for a room with an air temperature above 10°C"; "about 10-12°C warmer").
  - Meaco, "Meaco 10L dehumidifier review" (last updated 20 May 2022): https://blog.meaco.com/meaco-10l-dehumidifier-review/ ("creating a cold surface inside the dehumidifier using refrigerant and a compressor").
- **Used in:** Guide, "When is a dehumidifier used, and which kind?" (paragraph and table). FAQ `damp` / `dehumidifier-when`.
- **Note:** this is a maker's own guidance. No UK public body was found saying which type suits a cold room. Meaco is cited as a source only; it has no connection with Mr Wallcover.

## Dust, damp and protection: HEPA classes H13 and H14 (11 Oct 2026)

- **Fact:** HEPA filters are classified under BS EN 1822-1 or ISO 29463-1. NHS England gives H13 at least 99.95% and H14 at least 99.995% at the most penetrating particle size (around 0.3 µm), and says a filter in a device sometimes performs below its class. The DfE specification for air cleaning units asks for H13 or better (or ISO 35H), with 100% of the airflow filtered. The US EPA uses the US Department of Energy definition: at least 99.97% at 0.3 µm.
- **Sources (checked 11 Oct 2026):**
  - NHS England, NHS Estates Technical Bulletin NETB 2023/01A (published 9 May 2023, updated 2 Oct 2023): https://www.england.nhs.uk/long-read/application-of-hepa-filter-devices-for-air-cleaning-in-healthcare-spaces-guidance-and-standards/ ("at least 99.95% (H13 filter) or 99.995% (H14 filter) for the MPPS"; "the performance in situ is sometimes lower").
  - Department for Education, Air cleaning unit specification (PDF, Feb 2026): https://assets.publishing.service.gov.uk/media/69832b1ba1758c98acc243cf/Air_cleaning_unit_specification_-_Department_for_Education.pdf ("meets or exceeds the filter class H13 (in accordance with BS EN 1822-1)").
  - US EPA, What is a HEPA filter? (updated 13 Jan 2026): https://www.epa.gov/indoor-air-quality-iaq/what-hepa-filter ("at least 99.97%"; "as officially defined by the U.S. Department of Energy").
- **Used in:** Guide, "What does a HEPA air purifier do, and what does it not do?". FAQ `protection` / `hepa-purifier-why`.
- **This fills the gaps.md damp-air ask.** BSI and ISO catalogue pages do not print the class figures. NHS England is the UK primary source used for them. Local (spot) efficiency values were not found and are not stated.

## Dust, damp and protection: what an air purifier does and does not do (11 Oct 2026)

- **Fact:** DfE says air cleaning units can help reduce airborne contaminants, including fungal spores, but do not improve ventilation and are no substitute for it. UKHSA says the same and lists the size of the area among things to consider. The US EPA makes three points. Portable air cleaners do not address the cause of mould. Gases, including odours, need an activated carbon filter or another gas filter. Removing the source and ventilating are the most effective ways to improve indoor air. It also notes that settled particles cannot be removed by an air cleaner unless disturbed. The UK government says removing wallpaper can release a significant amount of mould spores.
- **Sources (checked 11 Oct 2026):**
  - Department for Education, Ventilation and air quality in education and childcare settings (published 24 Feb 2026): https://www.gov.uk/government/publications/ventilation-and-air-quality-in-education-and-childcare-settings/ventilation-and-air-quality-in-education-and-childcare-settings ("ACUs can help to reduce airborne contaminants"; "They are not a substitute for ventilation.").
  - UKHSA, Ventilation to reduce the spread of respiratory infections, including COVID-19: https://www.gov.uk/guidance/ventilation-to-reduce-the-spread-of-respiratory-infections-including-covid-19 ("Air cleaning devices are not a substitute for good ventilation"; "appropriate for the size of the area").
  - US EPA, Guide to Air Cleaners in the Home (updated 1 Oct 2026): https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home ("do not address the cause of mold and musty odors"; "choose a portable air cleaner with an activated carbon filter"; "reduce or remove the sources of pollutants and to ventilate").
  - US EPA, Will air cleaners reduce health risks? (updated 18 Feb 2026): https://www.epa.gov/indoor-air-quality-iaq/will-air-cleaners-reduce-health-risks ("cannot be removed by an air cleaner unless disturbed").
  - GOV.UK damp and mould guidance (as above): "removal of carpets or wallpaper can lead to a significant release of mould spores".
- **Used in:** Guide, "What does a HEPA air purifier do, and what does it not do?" and "Can the work go ahead while the house or hotel is occupied?" (smell). Frontmatter FAQ 3. FAQ `protection` / `hepa-purifier-why` and `occupied-buildings`.
- **Checked but cut for length:**
  - DfE: "Filters typically need to be replaced every 6 to 12 months".
  - NHS England NETB: filters "at higher humidity" may need replacing more often.
  - DfE: it does not recommend ionisers, ozone generators or unenclosed UV.
- **No health claims are made.** The EPA says the allergy benefit is disputed ("Some controversy exists"), so none is stated.

## Dust, damp and protection: ZipWall temporary walls (11 Oct 2026)

- **Fact:** ZipWall LLC, a US company, makes the ZipWall Dust Barrier System. Spring-loaded telescopic poles hold plastic sheeting or reusable fabric panels against the ceiling. ZipWall says the head is non-skid and non-marking and holds the sheet without damaging the ceiling. Working heights are 1.27–3.12 m, 1.39–3.6 m and 1.57–6.1 m. Poles go 3–3.7 m apart, closer where the air moves. Access is by zips, ZipDoor kits or self-closing magnetic doors, which ZipWall says keep the barrier sealed. FoamRail seals close the sheet at ceiling, walls and floor without tape. ZipWall's mat stops dust being tracked out. ZipWall says to test its tape first because paint finishes vary. Its listed uses include covering a door and sealing off a hallway.
- **Sources (checked 11 Oct 2026):**
  - ZipWall, About Us: https://www.zipwall.com/about/ ("ZipWall LLC is the maker of the ZipWall® Dust Barrier System"; "covering a door, sealing off a hallway").
  - ZipWall, ZipWall 12 2-Pack: https://www.zipwall.com/product/zipwall-12-2-pack/ ("Two spring-loaded poles"; "without damaging the ceiling").
  - ZipWall UK site, FAQS: https://www.zipwall.eu/faqs/ ("Poles should be placed 3m to 3,7m apart"; "1,27m to 3,12m"). The research file cited https://www.zipwall.eu/faq/, which now serves the French page. Use /faqs/.
  - ZipWall UK site, Spring-Loaded Poles: https://www.zipwall.eu/springloaded-poles/ ("from floor to ceiling without tape, ladders or damage").
  - ZipWall, FAQs (US): https://www.zipwall.com/faqs/ ("self-closing, which ensures the barrier always remains sealed"; "Because paint jobs vary, we recommend testing the tape").
  - ZipWall UK site, ZipWall Mat: https://www.zipwall.eu/zipwall-mat/ ("Prevent tracking dust out of the work area!").
- **Used in:** Guide, "What are ZipWall temporary walls?", "How is sanding dust kept in one room or corridor?" and "Can the work go ahead…?". FAQ `protection` / `zipwall-walls` and `dust-contained`.
- **No brand relationship is claimed.** We use ZipWall equipment; ZipWall does not endorse us. The copy says "These descriptions are ZipWall's own".

## Dust, damp and protection: what ZipWall says about its sheeting (11 Oct 2026)

- **Fact:** ZipWall's sheeting statements:
  - The Commercial ZipDoor is made of 4 mil (0.10 mm) flame-retardant plastic sheeting.
  - The standard ZipDoor is not flame-retardant.
  - ZipWall's own 3-mil Dust Barrier Plastic Sheeting is not flame-retardant.
  - The poles take sheeting from 1 mil to about 10 mil, "including many fire-rated" plastics; the UK site says up to 0.2 mm.
  - ZipWall names no fire test standard (NFPA 701, LPS 1207, BS 476 or EN 13501).
  - Its only rating is "Class A ... Chapter 8 of the International Building Code", a US code class, for its flame-retardant ZipFast panels.
- **Sources (checked 11 Oct 2026):**
  - ZipWall, ZipDoor Commercial Door Kit: https://www.zipwall.com/product/zipdoor-commercial-door-kit/ ("made of 4 mil flame retardant plastic sheeting"; "The standard door is not flame retardant."). Searched for NFPA, LPS and ASTM: none.
  - ZipWall UK site, Commercial ZipDoor Kit: https://www.zipwall.eu/product/commercial-zipdoor-kit/ ("4 mil (0,10 mm) flame retardant plastic sheeting"). Searched for NFPA and 1207: none.
  - ZipWall, FAQs (US): https://www.zipwall.com/faqs/ ("(not flame-retardant) Dust Barrier Plastic Sheeting"; "including many fire-rated and reinforced plastics").
  - ZipWall UK site, ZipFast Reusable Barrier Panels, Flame Retardant: https://www.zipwall.eu/zipfast-panels-flame-retardant/ ("Class A flame retardant in accordance with Chapter 8 of the International Building Code").
- **Used in:** Guide, "Is the sheeting flame-retardant?" and frontmatter FAQ 4. FAQ `protection` / `sheeting-flame-retardant`.
- **This answers the gaps.md containment ask.** No standard is named on the pages re-checked today. The research file had also searched ZipWall's instruction library, media library, the zipwall.eu pages and Florprotec's data-sheet page, and found none.

## Dust, damp and protection: flame-retardant protective coverings in the UK (11 Oct 2026)

- **Fact:** HSE says protective coverings are common during fit-out to protect doors, handrails, floor coverings and panels. Coverings and their tape add substantially to fire load, so HSE advises flame-retardant coverings to LPS 1207 or an equivalent (Certifire TS63), marked with their certification. At least one fire escape stair must be kept free of coverings. A partly occupied site's emergency plan must consider occupants outside the work area, and risk is significantly reduced when a building is unoccupied. The FPA Joint Code requires LPS 1207 or TS63 coverings where it applies, keeps one escape stair free, and tells all parties to check with their insurers on each project. Visqueen's flame-retardant polythene is certified to LPS 1207 (certificate 1792a) for screening, draping, hanging and covering surfaces, indoors only.
- **Sources (checked 11 Oct 2026):**
  - HSE, HSG168 Fire safety in construction (3rd edition, 2022), para 205: https://www.hse.gov.uk/pubns/priced/hsg168.pdf ("Protective coverings are a common feature during fit-out stages"; "LPS 1207, or equivalent, such as Technical Standard 63"; "At least one fire escape stairway must be kept free"). Para 83: "the emergency plan must consider the occupants of the premises outside the construction area itself". Para 42: "risks can be significantly reduced if the work is undertaken when a building is unoccupied".
  - Fire Protection Association, Fire Prevention on Construction Sites: The Joint Code of Practice, 10th edition incorporating Amendments 1 (Jan 2023) and 2 (May 2025): https://www.thefpa.co.uk/resource-download/858. Clause 10.2: "must conform to the requirements of the LPCB's Loss Prevention Standard LPS 1207". Clause 10.6: "at least one fire escape stairway should be kept free of all protective coverings". Scope: "All parties must always check with their insurance providers on each project."
  - Visqueen, Technical Datasheet, Flame Retardant Polythene Protection (version 26211, published 30 Jul 2026): https://visqueen.com/datasheet/13871712/ ("LPS1207 certificate no. 1792a"; "suitable for screening off specific areas, draping, hanging, and covering surfaces"; "intended for indoor use only").
- **Naming:** HSE writes "Technical Standard 63" (CERTIFIRE scheme) and the FPA "Warringtonfire Certifire Technical Schedule 63". The copy uses "Certifire TS63".
- **Used in:** Guide, "Is the sheeting flame-retardant?", "How are floors, furniture and finished rooms protected?" and "Can the work go ahead…?". Frontmatter FAQ 4. FAQ `protection` / `floors-furniture`, `sheeting-flame-retardant` and `occupied-buildings`.
- **Not used:**
  - The Joint Code's contract-value threshold for its scope (no money figures on the site).
  - HSG168 para 206 ("installing vulnerable features as late as possible"), checked but cut for length.
  - Visqueen's thicknesses: white 65 micron (1792a/01) and orange 250 micron (1792a/02); the certificate covers 50–250 micron. Visqueen does not say whether either fits ZipWall poles. The 250 micron roll is thicker than the UK ZipWall page's "up to 0,2mm".

## Dust, damp and protection: containing and clearing construction dust (11 Oct 2026)

- **Fact:** HSE lists enclosing the work with sheeting or temporary screens as a dust control. It wants extraction through an H, M or L class unit, not a general commercial vacuum, and says a HEPA filter in a general commercial vacuum is not enough. It advises against dry sweeping, using an H or M class vacuum for fine material.
- **Sources (checked 11 Oct 2026):**
  - HSE, CIS36 Construction dust (revision 3, 03/20): https://www.hse.gov.uk/pubns/cis36.pdf ("enclosing the work to stop dust escaping. Use sheeting or temporary screens"; "Don't just use a general commercial vacuum.").
  - HSE, CIS69 Controlling construction dust with on-tool extraction: https://www.hse.gov.uk/pubns/cis69.pdf ("Don't just use a HEPA filter in a general commercial vacuum.").
  - HSE, Construction dust: Dry sweeping: https://www.hse.gov.uk/construction/healthrisks/hazardous-substances/sweeping-cleaning.htm ("Avoid dry sweeping where possible"; "H or M class extraction unit").
- **Used in:** Guide, "How is sanding dust kept in one room or corridor?" and "How are floors…?". FAQ `protection` / `dust-contained`.
- **Checked but cut for length:** NHS England / DH, HBN 00-09 Infection control in the built environment, Appendix 3: https://www.england.nhs.uk/wp-content/uploads/2021/05/HBN_00-09_infection_control.pdf. Its "Type C" work, "moderate-to-high level of dust", includes "sanding of walls for painting or wall covering". The guide only mentions in general terms that healthcare buildings follow their own infection-control guidance.

## Dust, damp and protection: when the advice stops being reliable (11 Oct 2026)

- **Fact:**
  - Mould: larger areas of mould should only be dealt with by qualified professionals.
  - Floods: Historic England says to remove and discard non-historic wallcoverings, consult a specialist conservator about historic ones, and not force-dry traditional buildings.
  - Asbestos: HSE says it can be in any building built or refurbished before 2000, including textured decorative coatings. Anyone who finds possible asbestos should stop work and ask their employer or the building owner. Some asbestos work must be done by a licensed contractor.
- **Sources (checked 11 Oct 2026):**
  - GOV.UK damp and mould guidance (as above): "larger areas of mould should only be addressed by qualified professionals".
  - Historic England, Flooding and Historic Buildings, Repair and Drying pages (research file; see the note at the top): "Non-historic wall coverings should be carefully removed and discarded"; "Consult a specialist conservator"; "not to attempt to dry buildings of traditional construction too quickly".
  - HSE, Diagrams showing where asbestos can occur in buildings: https://www.hse.gov.uk/asbestos/diagrams.htm ("built or refurbished before the year 2000"; "textured decorative coating").
  - HSE, A worker's guide to asbestos safety: https://www.hse.gov.uk/asbestos/workers.htm ("stop work"; "some work that must be carried out by a licensed asbestos contractor").
- **Used in:** Guide, "When does this advice stop being reliable?".
- **Not used:** old lead paint (not researched; no source). No regulation is named.

## Dust, damp and protection: restated from our own published pages (11 Oct 2026)

These sentences add no new claim. Each repeats something already on mrwallcover.com.

- "Where preparation is in our scope, sanding is done with dust extraction" restates src/content/faq.json item `preparation` ("sanding with dust extraction"). Used in: Guide (sanding section); FAQ `protection` / `dust-contained`.
- "protection of floors, furniture and finished joinery belongs in the scope, and in an occupied home or a working hotel the work has to be contained and tidied daily" restates src/content/guides/installation-cost.md ("What about access, protection and the awkward parts?"). Used in: Guide (floors section); FAQ `protection` / `floors-furniture`.
- "at Pendley Manor the floors were protected throughout" restates src/content/case-studies/pendley-manor-hotel.md ("Floors were protected throughout, as the photographs show."). Used in: Guide (floors section); FAQ `protection` / `floors-furniture`.
- "Most of the hotel work on our record was done in buildings that stayed open" restates src/content/guides/hotel-fire-safety-and-compliance.md. Used in: Guide (occupied section); FAQ `protection` / `occupied-buildings`.
- DoubleTree by Hilton London – West End: levels 5 and 6, 30 rooms and their corridors, completed July 2019 while the hotel stayed open, with guests on the other floors. Restates src/content/case-studies/doubletree-west-end.md (and the Instagram source already logged above). Used in: Guide (occupied section); FAQ `protection` / `occupied-buildings`.
- Brown's Hotel: open throughout; access, timing, protection and housekeeping worked out with the main contractor and the hotel's management; work kept contained and quiet. Restates src/content/case-studies/browns-hotel-mayfair.md ("A live hotel."). Used in: Guide (occupied section).
- "Paper and textile move with the moisture in a room", and the return visit waiting for the room to settle, restate src/content/aftercare.json (`humidity`; the intro paragraph). Used in: Guide (rolls section); FAQ `damp` / `rolls-acclimatise`.
- "steady heat, a ventilated room, and no fan heater pointed at a seam" restates src/content/guides/wallcovering-problems-and-aftercare.md ("What should you not do to the room?"). Used in: Guide (heat and draughts section).
- "The cause of the damp is investigated first" restates src/content/guides/wall-preparation.md ("Is it dry?" and its FAQ). Used in: FAQ `damp` / `damp-wall-papering`.

## Owner-confirmed practice: damp and dust (FAQ brief, 11 Oct 2026)

Dorin stated two practices. They are the only first-person practice claims in this work. They are written plainly as "we …", with no anecdote, client, figure or reason added. Where a reason appears next to one, it is a sourced fact about the equipment (DfE, GOV.UK, HSE), not a motive put in Dorin's mouth.

- "In damp areas we run a dehumidifier and an air purifier with a HEPA filter." Used in: Guide, "When is a dehumidifier used, and which kind?" (first sentence); FAQ `damp` / `dehumidifier-when` (first sentence). Source: Dorin Burcus, owner, 11 Oct 2026 (FAQ brief in chat).
- "The air purifier we run in damp areas has a HEPA filter." This restates the sentence above. Used in: Guide, "What does a HEPA air purifier do, and what does it not do?". Source: Dorin Burcus, owner, 11 Oct 2026 (FAQ brief in chat).
- "In damp areas we run an air purifier with a HEPA filter alongside the dehumidifier." This restates the sentence above. Used in: FAQ `protection` / `hepa-purifier-why`. Source: Dorin Burcus, owner, 11 Oct 2026 (FAQ brief in chat).
- "We put up ZipWall temporary walls to contain dust." Used in: Guide, "What are ZipWall temporary walls?"; FAQ `protection` / `zipwall-walls` and `dust-contained`. Source: Dorin Burcus, owner, 11 Oct 2026 (FAQ brief in chat).
