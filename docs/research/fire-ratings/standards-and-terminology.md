# Wallcovering fire ratings: standards and terminology (research note B)

Checked 15 October 2026. Machine-readable twin: `B-standards.json` (sources, claims, standards register, open questions). Every statement below carries a source ID in square brackets; the IDs are defined in the source index at the end and in the JSON.

## How to read this note

- **What was read.** Legislation, government guidance, the IMO resolution and Approved Document B (ADB) were opened as documents; the key pages were rendered as images and read, not only text-extracted. Where a page was only text-extracted, the note says so.
- **What was not read.** No paywalled standard was read. For BSI, ASTM and UL we saw catalogue records only, which establish title, edition, status, dates and supersession, nothing inside the clauses. Class criteria below come from the public legislation that defines the classes, not from BS EN 13501-1 itself.
- **Date types are kept apart.** Document issue date, regulatory effective date and our checking date (15 October 2026) are different things in every table.
- **Notation.** Raw class notation is shown exactly as written in each worked example; nothing is filled in.
- **England.** ADB is guidance for England. Wales, Scotland and Northern Ireland were not checked beyond the conformity-marking guidance.

## Findings that matter most

1. **The class system is public law, and it is a closed set of definitions.** Delegated Regulation (EU) 2016/364 (carried on legislation.gov.uk) sets class criteria A1 to F and the smoke (s1 to s3) and droplet (d0 to d2) subclasses [src-reg-2016-364-legis] [src-reg-2016-364-oj]. s1 to s3 are defined by two smoke quantities from the SBI test, with no toxicity criterion [src-reg-2016-364-legis].
2. **Edition drift is normal and must be recorded, not repaired.** BSI shows BS EN 13501-1:2018 as current, but the 2007+A1:2009 edition was current until January 2019 and is what many older documents cite [src-bsi-13501-1-landing]. Three other test standards changed edition in 2026 [src-bsi-11925-2-kn] [src-bsi-13238-kn].
3. **EN 15102 has an edition conflict.** BSI treats the 2019 roll-form edition as current and the 2007+A1:2011 edition as withdrawn [src-bsi-15102-2019-kn] [src-bsi-15102-2007-kn], yet the GB designated-standards notice and the European Commission list both cite only the 2007+A1:2011 edition [src-gov-ds-notice-0123-25] [src-ec-cpr-summary-2026].
4. **A public "no test needed" route for wallcoverings exists but is narrow.** Commission Decision 2010/82/EU gives class D-s3,d2 to seven listed wallcovering types up to stated mass and thickness, on a specified substrate with a specified adhesive; it lists nothing higher [src-dec-2010-82].
5. **National classes (Class 0, Class 1) have been removed from ADB for England from 2 March 2025.** Class 0 was never a test result; it was a lining category built from BS 476 results [src-adb2-2006ed] [src-adb-2025-amend]. ADB itself says national and European classes do not automatically equate [src-adb2-2006ed] [src-adb2-2019ed].
6. **Class F, "NPD" and "unclassified" are three different things** (section 5) [src-reg-2016-364-legis] [src-cpr-art6-gb] [src-adb2-2026].
7. **A conformity mark is not evidence of suitability for a particular use** [src-gov-white-paper-2026]. Reaction to fire is not fire resistance and never implies minutes [src-adb2-2026].

---

## 1. Standards register

"Verified" means what we could confirm from the source named; "catalogue only" means metadata, not clauses. BSI uses two date conventions (landing page and BSI Knowledge); where they differ both are shown.

| Designation | Title | Latest edition and date | Status | Role | What we could verify | Source |
|---|---|---|---|---|---|---|
| BS EN 13501-1 | Fire classification of construction products and building elements. Classification using data from reaction to fire tests | BS EN 13501-1:2018. BSI Knowledge 31 Jan 2019; landing page 14/01/2019 | Current | Procedure that classifies reaction-to-fire test data into A1 to F with s and d subclasses | Catalogue only. Supersedes EN 13501-1:2007+A1:2009 (withdrawn, "current until 14/01/2019"). Committee FSH/22 | [src-bsi-13501-1-landing] [src-bsi-13501-1-kn] [src-bsi-13501-1-2007-kn] |
| BS EN 13823 | Reaction to fire tests for building products. Building products excluding floorings exposed to the thermal attack by a single burning item | BS EN 13823:2020+A1:2022. BSI Knowledge 31 Jan 2023 (landing page shows base-edition date 31/05/2020) | Current, Under Review | SBI test: heat release, flame spread, smoke and droplets for classes A2 to D | Catalogue only. 2020 edition current until 25/01/2023; 2010+A1:2014 until 28/05/2020 | [src-bsi-13823-kn] [src-bsi-13823-lp] |
| BS EN ISO 11925-2 | Reaction to fire tests. Ignitability of products subjected to direct impingement of flame. Single-flame source test | BS EN ISO 11925-2:2026. BSI Knowledge 31 Jan 2026; landing page 30/01/2026 | Current | Small-flame ignitability (classes B, C, D at 30 s; E and F at 15 s); paper ignition gives d2 | Catalogue only. 2020 edition current until 30/01/2026; 2010 until 18/03/2020 | [src-bsi-11925-2-kn] [src-bsi-11925-2-lp] |
| BS EN ISO 1716 | Reaction to fire tests for products. Determination of the gross heat of combustion (calorific value) | BS EN ISO 1716:2018. Knowledge 31 Jul 2018; landing 20/07/2018 | Current | Calorific potential (PCS), A1 and A2 only | Catalogue only. 2010 current until 20/07/2018 | [src-bsi-1716-kn] [src-bsi-1716-lp] |
| BS EN ISO 1182 | Reaction to fire tests for products. Non-combustibility test | BS EN ISO 1182:2020. Knowledge 30 Jun 2020 | Current | Furnace test, A1 and A2 only | Catalogue only. Supersedes 2010 (withdrawn 29 Jun 2020) | [src-bsi-1182-kn] |
| BS EN 15102 (2019) | Decorative wallcoverings. Roll form | BS EN 15102:2019. Knowledge 30 Jun 2019; landing 19/06/2019 | Current in BSI; not the edition in the GB or EU citation lists | Product standard for roll-form decorative wallcoverings; BSI's overview lists reaction to fire among its characteristics | Catalogue only. Panel form removed; Annex ZA changed to the new model (BSI overview). Annex ZA not read | [src-bsi-15102-2019-kn] [src-bsi-15102-lp] |
| BS EN 15102 (2007+A1:2011) | Decorative wall coverings. Roll and panel form | BS EN 15102:2007+A1:2011. Knowledge 30 Nov 2007 | BSI: withdrawn 19 Jun 2019 (tagged "Designated"). Still cited in the GB and EU lists | Edition cited as the designated/harmonised standard; edition ADB lists | GB designated list row 406 (rendered); EU summary list p.59 (rendered); ADB Appendix F p.183 (rendered) | [src-bsi-15102-2007-kn] [src-gov-ds-notice-0123-25] [src-ec-cpr-summary-2026] [src-adb2-2026] |
| BS EN 13238 | Reaction to fire tests for building products. Conditioning procedures and general rules for selection of substrates | BS EN 13238:2026. Knowledge 31 Jul 2026 | Current. The 2010 edition is shown withdrawn 3 Aug 2026 | Standard substrates and conditioning; basis of ADB's "direct field of application" rule | Catalogue only. ADB Appendix F still lists [2010] | [src-bsi-13238-kn] [src-adb2-2026] |
| BS EN 13501-2 | Fire classification ... Classification using data from fire resistance and/or smoke control tests, excluding ventilation services | BS EN 13501-2:2023. Knowledge 30 Jun 2023 | Current, Under Review | Fire resistance of elements (R, E, I in minutes); not reaction to fire | Catalogue only. 2016 edition withdrawn 9 Jun 2023; ADB lists [2016] | [src-bsi-13501-2-kn] [src-adb2-2026] |
| BS EN 15725 | Extended application on the fire performance of construction products and building elements: Principle of EXAP standards and EXAP reports | BS EN 15725:2023. Knowledge 31 Mar 2023 | Current | Principles for extended application reports; ADB B4 refers to it | Catalogue only. 2010 edition withdrawn 24 Mar 2023; ADB still lists [2010] | [src-bsi-15725-kn] [src-adb2-2026] |
| BS EN 233 | Wallcoverings in roll form. Specification for finished wallpapers, wall vinyls and plastics wallcoverings | BS EN 233:2016. Knowledge 30 Nov 2016 | Current | Product specification named in BSI's EN 15102 overview | Catalogue only. No fire provision verified | [src-bsi-233-kn] |
| BS EN 234 | Wallcoverings in roll form. Specification for wallcoverings for subsequent decoration | BS EN 234:2019. Knowledge 31 Jan 2020 | Current | As above | Catalogue only | [src-bsi-234-kn] |
| EN 259-1 (BS EN 259) | Heavy duty wallcoverings | Not found; BS EN 259:1997 found | BS EN 259:1997 withdrawn 15 Jun 2001; EN 259-1 status unknown | Named as EN 259-1 in BSI's EN 15102 overview | BSI record for EN 259-1 not located | [src-bsi-259-kn] [src-bsi-15102-2019-kn] |
| BS 476-6 | Fire tests on building materials and structures. Method of test for fire propagation for products | BS 476-6:1989+A1:2009 | Withdrawn 4 Mar 2025 | Legacy national test: fire propagation index I and sub-index i1 | Catalogue only. 1981 edition withdrawn 31 Mar 1989 | [src-bsi-476-6-kn] |
| BS 476-7 | ... Method of test to determine the classification of the surface spread of flame of products | BS 476-7:1997 | Withdrawn 4 Mar 2025 | Legacy national test: surface spread of flame Class 1 to 4 | Catalogue only. 1987 edition withdrawn 15 Jan 1997; 1971 edition withdrawn 30 Jun 1987 | [src-bsi-476-7-kn] |
| BS 476-20 to -24 | Fire resistance of elements (general principles, loadbearing, non-loadbearing, components, ventilation ducts) | [1987] editions as listed in ADB Appendix F | ADB lists them "effective until 1 September 2029" | Legacy fire-resistance tests, in minutes | BSI article and ADB only; individual BSI records not fetched | [src-bsi-476-article] [src-adb2-2026] |

Furniture, curtain and US/marine items are in section 10.

### 1.1 Edition history (the "edition trap")

Documents are usually issued against the edition current when the test was run. The following chains come from BSI records; none implies that an older citation is wrong.

| Standard | Editions, newest first, with BSI dates | Source |
|---|---|---|
| BS EN 13501-1 | 2018 (current); 2007+A1:2009 (to 14 Jan 2019); 2002 (to 30 Mar 2007) | [src-bsi-13501-1-landing] |
| BS EN 13823 | 2020+A1:2022 (current); 2020 (to 25 Jan 2023); 2010+A1:2014 (to 28 May 2020); 2010 (to 30 Nov 2014); 2002 (to 31 Oct 2010) | [src-bsi-13823-lp] |
| BS EN ISO 11925-2 | 2026 (current); 2020 (to 30 Jan 2026); 2010 (to 18 Mar 2020); 2002 (to 31 Jul 2011) | [src-bsi-11925-2-lp] |
| BS EN ISO 1716 | 2018 (current); 2010 (to 20 Jul 2018); 2002 (to 31 Aug 2010) | [src-bsi-1716-lp] |
| BS EN ISO 1182 | 2020 (current); 2010 (to 29 Jun 2020) | [src-bsi-1182-kn] |
| BS EN 13238 | 2026 (current); 2010 (withdrawn 3 Aug 2026); 2001 (withdrawn 28 Feb 2010) | [src-bsi-13238-kn] |
| BS EN 15102 | 2019 (current in BSI); 2007+A1:2011 (to 19 Jun 2019); 2007 (to 30 Nov 2011) | [src-bsi-15102-lp] |

ADB Appendix F (England) lists BS EN 13501-1 [2018], BS EN 13501-2 [2016], BS EN 15102 [2007 + A1 2011], BS EN 15725 [2010] and BS EN 13238 [2010], so its edition citations lag BSI's current records for three of these [src-adb2-2026] [src-bsi-13501-2-kn] [src-bsi-15725-kn] [src-bsi-13238-kn]. We do not treat either as overriding the other.

### 1.2 Date conflicts recorded, not resolved

- BS EN 13501-1:2018: landing page 14/01/2019, BSI Knowledge 31 Jan 2019 [src-bsi-13501-1-landing] [src-bsi-13501-1-kn].
- BS EN 13823:2020+A1:2022: Knowledge 31 Jan 2023; the landing page shows 31/05/2020, which looks like the base edition's date [src-bsi-13823-kn] [src-bsi-13823-lp].
- BS EN 15102:2019: landing page 19/06/2019, Knowledge 30 Jun 2019 [src-bsi-15102-lp] [src-bsi-15102-2019-kn].

---

## 2. Class decoder: A1, A2, B, C, D, E, F (construction products excluding floorings)

Source for the whole table: Delegated Regulation (EU) 2016/364, Annex Table 1 and notes, read from the rendered pages of the legislation.gov.uk PDF (pp.4 to 5) and cross-checked against the Official Journal text [src-reg-2016-364-legis] [src-reg-2016-364-oj]. The Regulation entered into force on the twentieth day after publication in OJ L 68 of 15 March 2016 (4 April 2016 by arithmetic) [src-reg-2016-364-oj]. In GB it is carried as assimilated law; no known outstanding UK amendments were shown when the page was generated (9 October 2025) [src-reg-2016-364-legis]. EU-side amendment status was not confirmed (section 13).

Symbols used by the Regulation: ΔT temperature rise; Δm mass loss; tf duration of flaming; PCS gross calorific potential; LFS lateral flame spread; FIGRA fire growth rate; THR total heat release (600 s); Fs flame spread (EN ISO 11925-2); SMOGRA smoke growth rate; TSP total smoke production (600 s) [src-reg-2016-364-legis].

| Class | Test methods named | Criteria (Table 1) | Subclasses carried |
|---|---|---|---|
| A1 | EN ISO 1182 **and** EN ISO 1716 | 1182: ΔT ≤ 30 °C, Δm ≤ 50 %, tf = 0 (no sustained flaming). 1716: PCS ≤ 2.0 MJ/kg for homogeneous products and substantial components; ≤ 2.0 MJ/kg for external non-substantial components (with an alternative route in note c); ≤ 1.4 MJ/m² for internal non-substantial components; ≤ 2.0 MJ/kg for the product as a whole | None |
| A2 | EN ISO 1182 **or** EN ISO 1716, **and** EN 13823 | 1182: ΔT ≤ 50 °C, Δm ≤ 50 %, tf ≤ 20 s. Or 1716: PCS ≤ 3.0 MJ/kg (homogeneous, substantial), ≤ 4.0 MJ/m² (external or internal non-substantial), ≤ 3.0 MJ/kg (whole product). And SBI: FIGRA ≤ 120 W/s, LFS < edge of specimen, THR600s ≤ 7.5 MJ | Smoke and droplets |
| B | EN 13823 **and** EN ISO 11925-2 (30 s exposure) | SBI: FIGRA ≤ 120 W/s, LFS < edge of specimen, THR600s ≤ 7.5 MJ. Small flame: Fs ≤ 150 mm within 60 s | Smoke and droplets |
| C | EN 13823 **and** EN ISO 11925-2 (30 s) | SBI: FIGRA ≤ 250 W/s, LFS < edge, THR600s ≤ 15 MJ. Small flame: Fs ≤ 150 mm within 60 s | Smoke and droplets |
| D | EN 13823 **and** EN ISO 11925-2 (30 s) | SBI: FIGRA ≤ 750 W/s (no LFS or THR limit). Small flame: Fs ≤ 150 mm within 60 s | Smoke and droplets |
| E | EN ISO 11925-2 (15 s exposure) | Fs ≤ 150 mm within 20 s | Droplets only (paper ignition gives d2; no ignition gives no addition) |
| F | EN ISO 11925-2 (15 s) | Fs > 150 mm within 20 s | None |

Notes from the same table: small-flame exposure is under surface flame attack and, where appropriate to the intended use, edge flame attack (note i). The Annex defines a "substantial component" as a layer of at least 1.0 kg/m² or at least 1.0 mm thick, and a "non-substantial component" as one below both thresholds; these definitions govern how the A1 and A2 calorific limits apply to layered products [src-reg-2016-364-legis].

What the ranking means. ADB describes reaction to fire as the degree to which a product contributes, by its own decomposition, to a fire under specified conditions, with A1 the highest performance and F the lowest [src-adb2-2026]. In the 2006 edition ADB defined non-combustible materials, in European terms, as class A1 and materials of limited combustibility as class A2-s3,d2, with national BS 476-4 and BS 476-11 limbs alongside [src-adb2-2006ed]. The Regulation applies where the intended use of a product may contribute to the generation and spread of fire and smoke in the room or area of origin or beyond [src-reg-2016-364-legis]. Classes are set for products in their end-use application [src-dec-2010-82] [src-bsi-13501-1-kn].

## 3. Subclass decoder

Source: Annex Table 1 notes f to h [src-reg-2016-364-legis]. All three smoke subclasses and three droplet subclasses are defined only where Table 1 attaches them (A2, B, C, D for both; E for droplets).

| Subclass | Definition (Regulation) | Measured in |
|---|---|---|
| s1 | SMOGRA ≤ 30 m²/s² and TSP600s ≤ 50 m² | EN 13823 (SBI) |
| s2 | SMOGRA ≤ 180 m²/s² and TSP600s ≤ 200 m² (and not s1) | EN 13823 (SBI) |
| s3 | Not s1 or s2: no limit on smoke production | EN 13823 (SBI) |
| d0 | No flaming droplets or particles in the SBI within 600 s | EN 13823 (SBI) |
| d1 | No flaming droplets or particles persisting longer than 10 s in the SBI within 600 s | EN 13823 (SBI) |
| d2 | Not d0 or d1: no limit. Ignition of the paper in EN ISO 11925-2 also gives d2 | EN 13823 and EN ISO 11925-2 |

ADB adds that s1 indicates the lowest smoke production and d0 the lowest production of flaming droplets or particles, and that s3, d2 means no limit is set for either [src-adb2-2026]. ADB B7 loosely lists class E with the classes that carry both kinds of subclass; the Regulation attaches droplets only to E [src-adb2-2026] [src-reg-2016-364-legis].

### What s1, s2 and s3 measure, and what they do not

- They are bands on two **computed smoke quantities from one small-scale test**: a smoke growth rate (SMOGRA) and a total smoke production over the first 600 seconds (TSP600s) [src-reg-2016-364-legis]. Whether a given product reaches a band depends on the product in the tested build-up, not on a brand or a generic material type.
- Neither quantity is a toxicity measure. The Regulation's classification table contains no criterion on gas species, toxic potency or visibility in an escape route, and ADB states that its linings guidance (requirement B2) does not cover generation of smoke and fumes [src-reg-2016-364-legis] [src-adb2-2026]. The note therefore says nothing about how harmful the smoke from a wallcovering is. We have not read how EN 13823 measures smoke (paywalled).
- "s1" does not mean "no smoke" and "d0" does not mean "no fire". Any page text should avoid "zero smoke", "fireproof" or "safe".

## 4. Worked decodes

These decode the notation only. They do not say a product complies with anything: that depends on the evidence for a named product and build-up and on the decision of the building control body.

| Notation as printed | Decode | What is not stated | Source |
|---|---|---|---|
| **B-s1,d0** | Class B: SBI FIGRA ≤ 120 W/s, LFS < specimen edge, THR600s ≤ 7.5 MJ, plus small-flame Fs ≤ 150 mm within 60 s (30 s exposure). s1: SMOGRA ≤ 30 m²/s² and TSP600s ≤ 50 m². d0: no flaming droplets or particles in the SBI within 600 s. ADB's wording that s3, d2 means "no limit" implies the smoke and droplet part sits inside a B-s3,d2 requirement; whether an installation complies is for building control | Edition of EN 13501-1 and the test standards; test body and report date; substrate, adhesive and any primer; product scope | [src-reg-2016-364-legis] [src-adb2-2026] |
| **B-s2,d0** | Class B as above. s2: SMOGRA ≤ 180 m²/s² and TSP600s ≤ 200 m² (so not s1). d0 as above | As above. A document showing B-s1,d0 and another showing B-s2,d0 for "the same" product is a conflict to record, not to average | [src-reg-2016-364-legis] |
| **C-s3,d2** | Class C: SBI FIGRA ≤ 250 W/s, LFS < edge, THR600s ≤ 15 MJ, plus small-flame Fs ≤ 150 mm within 60 s. s3: no limit on smoke. d2: not d0 or d1 (flaming droplets or particles persisting over 10 s in the SBI, or paper ignition in EN ISO 11925-2); ADB treats s3, d2 as no limit set on smoke or droplets. ADB uses C-s3,d2 for "other rooms" and D-s3,d2 for small rooms in its linings tables | Whether the product was tested or classified without testing (the CWFT route gives D-s3,d2, not C) | [src-reg-2016-364-legis] [src-adb2-2026] [src-dec-2010-82] |
| **Euroclass B** (no subclasses) | A class B statement with the smoke and droplet subclasses **not stated**. Table 1 attaches both to class B, so a full B classification has both; a bare "B" is incomplete. Record smoke = unknown, droplets = unknown. Do not read it as s1,d0 and do not read it as s3,d2 | The two subclasses, standard edition, build-up. "Euroclass" is trade and BSI shorthand; the Regulation speaks of "classes of reaction to fire performance" | [src-reg-2016-364-legis] [src-bsi-476-article] |

## 5. Class F, "NPD" and "unclassified" are different

| Term | Where it comes from | What it means | What it does not mean |
|---|---|---|---|
| **Class F** | Delegated Regulation 2016/364, Table 1 | A defined class. The product was tested in EN ISO 11925-2 (15 s exposure) and the flame spread exceeded 150 mm within 20 s, i.e. it did not reach E. ADB: class F is assigned when a product fails to attain class E | Not "no result". Not the same as NPD | [src-reg-2016-364-legis] [src-adb2-2026] |
| **NPD** | CPR art.6(3)(f), GB text on legislation.gov.uk: for listed essential characteristics where no performance is declared, the letters "NPD" (No Performance Determined) go on the declaration of performance | The manufacturer declares no performance for that characteristic on the DoP | Not a class. Not class F. Does not say the product was tested or failed | [src-cpr-art6-gb] [src-reg-2016-364-legis] |
| **Unclassified / untested** | ADB B6: untested products cannot be classified under BS EN 13501-1 | There is no classification document, so no class (and no "NPD" unless a DoP says so) | Not class F and not a pass | [src-adb2-2026] |

History that explains the confusion. Under the earlier Decision 2000/147/EC the classes F, FFL, FL and Fca were themselves defined as "no performance determined". Recitals (2) to (6) of 2016/364 record that a class must be a range of levels (CPR art.2(7)), that "no performance determined" does not fit that definition, that its place is the DoP under art.6(3)(f), and that the old F classes were therefore replaced by new defined classes F, FFL, FL and Fca for products not reaching E [src-reg-2016-364-legis] [src-cpr-art2-gb]. A pre-2016 document using "F" may therefore carry the older meaning; this was read from the recitals, not from the repealed Decision. How NPD is handled under Regulation (EU) 2024/3110 was not examined (section 13).

---

## 6. EN 15102 and wallcoverings: what governs testing and the field of application

### 6.1 The standard and its editions

BSI's overview of EN 15102:2019 says it covers decorative wallcoverings in roll form for hanging on internal walls, partitions or ceilings by adhesive, lists reaction to fire among its product characteristics, and covers assessment and verification of constancy of performance and marking; it excludes wallcoverings whose main purpose is structural or protective. It names EN 233, EN 234, EN 266, EN 13085 and EN 259-1 as product-specific standards that go with it [src-bsi-15102-2019-kn]. That is BSI's summary, not the clauses. The 2007+A1:2011 edition covered roll and panel form [src-bsi-15102-2007-kn].

**Edition conflict.** The GB designated-standards notice 0123/25 (26 September 2025, Part 2, row 406, rendered p.46) lists EN 15102:2007+A1:2011 "Decorative wall coverings, Roll and panel form" with no superseded standard shown, and EN 15102:2019 does not appear in the notice [src-gov-ds-notice-0123-25]. The Commission's summary of harmonised-standard references (generated 9 February 2026, rendered p.59) lists only EN 15102:2007+A1:2011, which superseded EN 15102:2007 with a coexistence period of 01/07/2012 to 01/07/2012 [src-ec-cpr-summary-2026]. ADB's Appendix F (printed p.183) also lists [2007 + A1 2011] [src-adb2-2026]. BSI, by contrast, shows 2019 as current [src-bsi-15102-2019-kn]. We cannot say from public sources why the 2019 edition is absent from both lists or which edition a given manufacturer's DoP cites. Both lists state that they do not themselves create legal effects; the notice is the legal publication [src-gov-ds-list-v2] [src-ec-cpr-summary-2026].

### 6.2 Classification without further testing for wallcoverings

Commission Decision 2010/82/EU (9 February 2010, C(2010) 397) lists decorative wallcoverings in roll and panel form that meet the reaction-to-fire characteristic without testing. Every entry is class D-s3,d2 (class as in Table 1 of the classification system). Read from the rendered legislation.gov.uk pages 1 to 3 [src-dec-2010-82]:

| Listed wallcovering type | Maximum mass per unit area (g/m²) | Maximum thickness (mm) |
|---|---|---|
| On cellulose fibre base | 190 | 0.9 |
| On cellulose fibre base, polymer coated or printed | 470 | 0.7 |
| On a mixture of cellulose and polyester fibre base | 160 | 0.3 |
| On a mixture of cellulose and polyester fibre base, polymer coated or printed | 410 | 0.5 |
| On a polymer coated fabric base | 510 | 0.7 |
| Woven textile with a backing of cellulose fibre or cellulose and polyester fibre | 450 | 0.8 |
| Foamed PVC with a backing of cellulose fibre or cellulose and polyester fibre | 310 | 1.8 |

Footnote a, the build-up: products in accordance with EN 15102 mounted on a substrate of at least class A2-s1,d0, minimum 12 mm thick and minimum density 800 kg/m³, using starch, starch/PVA or cellulose/PVA adhesive applied at a maximum of 200 g/m² [src-dec-2010-82].

What this establishes: a wallcovering that fits a listed type, within the mass and thickness limits and on that build-up, is D-s3,d2 without a test. What it does not: it gives no class above D-s3,d2, so B or C claims need test evidence; it says nothing about other substrates or adhesives. It was made under Directive 89/106/EEC; in GB legislation.gov.uk carries the text with only Article 4 (addressed to Member States) excluded from 31 December 2020 [src-dec-2010-82]. Its current EU status was not checked. ADB B6 points to CWFT materials on the Commission's website [src-adb2-2026].

### 6.3 What ADB says about wallcoverings

ADB Volume 2 Table 6.1 (printed p.55, rendered) lists D-s3,d2 for small rooms, C-s3,d2 for other rooms and B-s3,d2 for other circulation spaces, with a note: wallcoverings that conform to BS EN 15102, achieve at least class C-s3,d2 and are bonded to a class A2-s3,d2 substrate are also acceptable [src-adb2-2026]. Volume 1 Table 4.1 carries the same note (text-checked) [src-adb1-2026]. The note was added to the 2006 edition's Table 10 by the 2013 amendments (printed p.63, rendered) [src-adb2-2006ed]. The note is guidance; the decision on a building is for the building control body.

### 6.4 How reaction-to-fire testing is tied to the substrate

- ADB B8 and B9 (printed p.139, rendered): BS EN 13238 defines standard substrates; a classification from testing is valid only within its direct field of application, that is, when the product is fixed to a substrate of that class in end use; the substrate should represent end-use substrates of at least 75 % of its nominal density; standard substrates include gypsum plasterboard (700 ± 100 kg/m³), calcium silicate board (870 ± 50) and fibre-cement board (1800 ± 200); a plasterboard-substrate classification is also acceptable for products bonded to gypsum plaster [src-adb2-2026] [src-adb-2025-amend].
- ADB B2 to B4 (as replaced from 2 March 2025, text-read): check test evidence is applicable to the intended use; small differences in fixing, joints, dimensions, insulation and air gaps may significantly affect performance and should be tested or assessed; assessments do not replace a test where one is necessary; assessments follow the relevant extended-application standard or the principles of BS EN 15725; evidence from tests with different classification criteria is unlikely to be relevant [src-adb-2025-amend].
- Not verified: EN 15102's own mounting, substrate and adhesive provisions and its Annex ZA (paywalled) [src-bsi-15102-2019-kn].

---

## 7. Evidence-type glossary

Where no official definition was found, the entry says so and gives the working definition used for this project's evidence rules. A marketing statement is not a classification report.

| Term | What it is | What it can establish | Official basis or note |
|---|---|---|---|
| Manufacturer webpage | Marketing or information page | A claim, not evidence | No official definition; do not treat as classification evidence |
| Technical or product data sheet | Manufacturer document describing a product | Describes performance claims, often with a class and a cited standard | No official definition; check it names the report or DoP behind the class |
| Brochure | Promotional document | A claim only | No official definition |
| Declaration of performance (DoP) | Document the manufacturer draws up for a product covered by a designated (GB) or harmonised (EU) standard | The declared performance for listed essential characteristics, by class or level, with the standard and its date; "NPD" where no performance is declared | CPR art.6 (GB text): must reference the standard used and its date, state intended uses, give class or level and NPD entries [src-cpr-art6-gb]. UKCA labelling includes the DoP reference and the class declared [src-gov-cpr-gb] |
| Test report | Laboratory record of one test on a specimen (for example an SBI test) | A measured result for a stated build-up | ADB: specific tests; organisations such as notified bodies or UKAS-accredited laboratories can be assumed to have the expertise [src-adb2-2026] [src-adb-2025-amend]. Working definition |
| Classification report | Document applying the classification procedure of EN 13501-1 to test data to assign a class and subclasses, with the field of application | The class for the tested product and build-up, and the scope the report states | BSI describes EN 13501-1 as the classification procedure [src-bsi-13501-1-kn]. Which edition the report cites matters (section 1.1) |
| Certificate | independent document (for example conformity certification or a marine type-approval certificate) | Depends on the issuer and scheme; read scope and date | Not defined in the sources read. IMO FTP Code Part 5 sets low flame-spread criteria for ships [src-imo-msc307] |
| Extended application | An assessment that extends a tested result to variations, following an extended-application standard or EN 15725 principles | The variations the report expressly permits | ADB B3 and B4: assessments are not a way round a necessary test [src-adb-2025-amend]. BS EN 15725:2023 is the current BSI record [src-bsi-15725-kn] |
| Field of application | The tested build-up and the variations a report expressly covers (substrate, adhesive, any primer, lining, fixing, air gap) | The limits of a class | ADB B8: valid only within the direct field of application [src-adb2-2026] |
| CWFT (classification without further testing) | A Commission list of products deemed to have a class without testing | The listed class for listed products within stated limits | Decision 2010/82/EU for wallcoverings (D-s3,d2) [src-dec-2010-82]; ADB B1 note treats CWFT products as shown by test [src-adb-2025-amend] |

Age of a document. Nothing found says a classification report or DoP expires after a fixed period, and none is assumed; what matters is the standard edition cited, the product scope and whether the build-up matches.

---

## 8. Legacy terms: Class 0, Class 1 and BS 476

### 8.1 Timeline in ADB Volume 2 (England)

| Edition or event | Date and status | What it says about national classes | Source |
|---|---|---|---|
| 2006 edition incorporating 2007, 2010 and 2013 amendments | Superseded; read from an archive copy | Table 10 gives national and European classes side by side; Appendix A defines Class 0 and Classes 1 to 4 | [src-adb2-2006ed] |
| 2019 edition incorporating 2020 and 2022 amendments | Applied until the 2025 amendments (superseded; archive copy) | Appendix B Table B1 "transposition to national class" for products on the market under earlier editions; the term "Class 0" does not appear in a text search of the extracted text | [src-adb2-2019ed] |
| 2025 amendments | Published September 2024; effect 2 March 2025 for England | Section "National classifications for reaction to fire" deleted; the Appendix F list of BS 476 is replaced by the fire-resistance parts only (8, 20 to 24, 31.1) and index entries for BS 476-3, -6, -7 and -11 are deleted. Earlier text continues for work where a building notice, initial notice or full-plans application was given before 2 March 2025 and the work started and was sufficiently progressed before that day or within six months from it | [src-adb-2025-amend] |
| BS 476-6 and BS 476-7 | BSI Knowledge: withdrawn 4 Mar 2025 | BSI article: reaction-to-fire parts removed from ADB 2 Mar 2025 | [src-bsi-476-6-kn] [src-bsi-476-7-kn] [src-bsi-476-article] |
| 2029 amendments | Effect 2 September 2029 for England | Remove national classes for fire resistance (BS 476-8, -20 to -24, -31.1) | [src-adb2-2026] [src-bsi-476-article] |
| Current ADB Vol 2 and Vol 1 | 2019 edition incorporating 2020, 2022, 2025 and 2026 amendments, collated with 2029 amendments (gov.uk change note 16 Sep 2026) | European classes only for reaction to fire | [src-gov-adb-page] [src-adb2-2026] |

A superseded March 2024 circular gave 30 September 2026 as an effective date for an earlier amendment set; gov.uk marks that amendment booklet "No longer current", and it is not used for the national-class removal date [src-adb-circular-2024] [src-gov-adb-page].

### 8.2 How Class 0 was defined

In the 2006 edition (Appendix A para 13, printed p.120, rendered) the highest national lining classification was Class 0, achieved if a material or the surface of a composite product was either composed throughout of materials of limited combustibility, or a Class 1 material with a fire propagation index I of at most 12 and sub-index i1 of at most 6. A note says "Class 0 is not a classification identified in any British Standard test" [src-adb2-2006ed]. So Class 0 was never a stand-alone test result: it was an ADB category built from BS 476-6 and BS 476-7 results (or limited combustibility), and a data sheet saying "Class 0" cannot be traced to one test report without the BS 476 results behind it.

In Table 10 of that edition Class 0 matched B-s3,d2 for other circulation spaces, Class 1 matched C-s3,d2 and Class 3 matched D-s3,d2, with a note that the national classes do not automatically equate with the European ones [src-adb2-2006ed].

### 8.3 Classes 1 to 4 (surface spread of flame)

Under the national system, lining systems tested for surface spread of flame were rated Class 1, 2, 3 or 4 by reference to BS 476-7 (1971, 1987 or 1997 editions), with Class 1 the highest; fire propagation indices came from BS 476-6 (printed pp.119 to 120) [src-adb2-2006ed]. BSI shows BS 476-7:1997 and BS 476-6:1989+A1:2009 withdrawn on 4 March 2025 [src-bsi-476-7-kn] [src-bsi-476-6-kn].

### 8.4 No automatic conversion

ADB states in both editions that national classes do not automatically equate with European classes, so products cannot typically assume a European class unless tested accordingly (2006 Table 10 note 3, printed p.63; 2019 Table B1 notes, printed p.138) [src-adb2-2006ed] [src-adb2-2019ed]. The 2019 Table B1 note adds that where smoke or droplet performance is specified only European classes can be used, and gives the example that a national class may not stand in for a classification containing s1, d0 [src-adb2-2019ed]. So a Class 0 or Class 1 result cannot be turned into a Euroclass, and cannot support an s1 or d0 claim. BSI's catalogue calls BS 476-7 "superseded by" BS EN 13823; that is a supersession note, not an equivalence [src-bsi-476-article].

---

## 9. Reaction to fire is not fire resistance

| | Reaction to fire | Fire resistance |
|---|---|---|
| Question answered | How far a product contributes, by its own decomposition, to a fire under specified conditions | How long a building element keeps performing in a standard test: R (loadbearing capacity), E (integrity), I (insulation) |
| Classification | BS EN 13501-1: A1, A2, B, C, D, E, F with s and d subclasses | BS EN 13501-2 to -4; expressed as, for example, a time in minutes |
| Unit | Class letters and subclasses | Minutes of time elapsed in a standard test, not real time |
| Legacy tests | BS 476-6, -7 (and -4, -11) | BS 476-20 to -24 |
| Source | [src-adb2-2026] B6, B7 (printed p.139) | [src-adb2-2026] B18 to B24 (printed pp.141 to 142); [src-bsi-13501-2-kn] [src-bsi-476-article] |

A wallcovering has a reaction-to-fire class. It is not an element of structure and carries no 30, 60 or 120 minute rating; any page text must not imply one [src-adb2-2026]. ADB also notes that standard fire tests do not directly measure fire hazard and that performance in tests is one of several factors [src-adb2-2026].

---

## 10. Other systems, kept separate

None of these is evidence of a wallcovering's UK reaction-to-fire class. ADB states that evidence from tests with different classification criteria is unlikely to be relevant [src-adb-2025-amend].

| System | What it is | Catalogue facts | Source |
|---|---|---|---|
| ASTM E84 | US surface-burning ("tunnel") test of exposed wall and ceiling surfaces; reports flame spread and smoke developed indices | ASTM E84-26a, Active, last updated 15 Apr 2026. Class A/B/C bands are set by US codes and are not on the catalogue page (not verified) | [src-astm-e84] |
| UL 723 | UL edition of the same tunnel method | Edition 11, Active, published 21 Mar 2025, last revision 23 Jun 2025 | [src-ul-723] |
| IMO FTP Code Part 5 | Marine test for surface flammability (low flame spread) for ships, under SOLAS | 2010 FTP Code, Resolution MSC.307(88), adopted 3 Dec 2010. For bulkhead, wall and ceiling linings: CFE ≥ 20 kW/m², Qsb ≥ 1.5 MJ/m², Qt ≤ 0.7 MJ, Qp ≤ 4.0 kW, no burning droplets (printed pp.100 to 101, rendered). Later amendments not checked | [src-imo-msc307] |
| BS 5867-2 | Flammability of curtain, drape and blind fabrics | BS 5867-2:2008, Current. ADB uses it only inside the TP(a) flexible thermoplastic test | [src-bsi-5867-2-kn] [src-adb-2025-amend] |
| BS EN 13773 | Classification scheme for curtains and drapes | BS EN 13773:2003, Current | [src-bsi-13773-kn] |
| BS 5852 | Ignitability of upholstered seating | BS 5852:2006, Current | [src-bsi-5852-kn] |

---

## 11. Conformity marking in GB and Northern Ireland

### 11.1 What the official sources say

- **GB (England, Wales, Scotland).** Products covered by a designated standard or a UK technical assessment need a declaration of performance and can only be placed on the market with a conformity marking [src-gov-white-paper-2026]. Accepted markings are UKCA, CE, or CE with UK(NI) (table in the guidance). Following a written ministerial statement of 2 September 2024 the CE mark continues to be available; UKCA can also be used, with a UK approved body for products covered by a designated standard. The guidance describes the longer-term future of CE marking as conditional on wider reforms. It gives no end date [src-gov-cpr-gb].
- **Northern Ireland.** Products must meet EU harmonised standards and bear CE or CE with the UK(NI) indication; UKCA alone is not accepted [src-gov-cpr-ni].
- **Relationship to designated standards.** CE-marked products following harmonised standards do not benefit from a presumption of conformity with the UK regulations; only UKCA-marked products following GB designated standards do (31 March 2026 guidance), and the Construction Product Regulations 2011 are listed among those where continued recognition of EU requirements applies [src-gov-harm-ukca-ce].
- **Law changed in 2026.** SI 2025/1172, in force 8 January 2026, amends the GB version of Regulation 305/2011 so that compliance with Regulation (EU) 2024/3110, as well as 305/2011, satisfies specified manufacturer, importer and distributor obligations [src-si-2025-1172].
- **Latest policy statement (proposals, not law).** The Construction Products Reform White Paper (first published 25 February 2026; consultation closed 20 May 2026) says CE-marked products meeting the EU 2011 or 2024 regimes continue to be placed on the GB market without retesting, and that UKCA would remain a mandatory physical label for products regulated under the GB regime alongside recognition of CE [src-gov-white-paper-2026].

### 11.2 What a marking does and does not show

The White Paper states that product markings do not confirm product safety; they show that the manufacturer takes responsibility for conformity with the declared performance and applicable legal requirements, and the presence of a mark gives no assurance of suitability for a specific use. It also says UKCA and CE marks are not safety marks (printed pp.22 and 67, rendered) [src-gov-white-paper-2026]. So a mark on a wallcovering shows a DoP exists for the declared characteristics under the standard cited; it does not make the product suitable for every location or substrate. On a UKCA label the DoP reference, the declared level or class and the harmonised specification are given [src-gov-cpr-gb].

### 11.3 Dates (kept apart)

| Item | Issue date | Effective date | Our check |
|---|---|---|---|
| gov.uk CPR in GB guidance | Last change note 21 May 2025 (page metadata refreshed 13 Oct 2026) | Refers to ministerial statement of 2 Sep 2024 | 15 Oct 2026 |
| SI 2025/1172 | Made 6 Nov 2025 | In force 8 Jan 2026 | 15 Oct 2026 |
| gov.uk harmonised-standards guide | 31 Mar 2026 | n/a | 15 Oct 2026 |
| Reform White Paper | 25 Feb 2026 | Proposals only | 15 Oct 2026 |
| Designated standards notice 0123/25 | 26 Sep 2025 | 26 Sep 2025 | 15 Oct 2026 |
| EU summary of harmonised standards | Generated 9 Feb 2026 | Information only | 15 Oct 2026 |
| Delegated Regulation 2016/364 | 1 Jul 2015 (OJ 15 Mar 2016) | 20th day after OJ publication (4 Apr 2016 by arithmetic) | 15 Oct 2026 |

---

## 12. Limits of interpretation

- A BSI record proves title, edition, status, dates and supersession, nothing about the clauses. We state no clause content of any paywalled standard.
- A class belongs to a named product in a tested build-up. It does not belong to a brand or product family, and a variation is neither assumed covered nor assumed to need a new test; the report's stated field of application decides.
- ADB is statutory guidance for England, not a rule that a product "passes". Building control decides compliance for a building; no ADB statement here is advice for a specific site.
- Old documents are not assumed invalid and not assumed valid. No official source found sets an expiry period for a classification report or DoP.
- Raw notation is kept as printed. Unknown smoke or droplet subclasses stay unknown.
- Wales, Scotland and Northern Ireland building-regulation guidance was not checked.
- Archive copies were used for two superseded ADB editions (gov.uk now returns HTTP 410 for them); the originals could not be hashed.

## 13. Conflicts and open questions

**Conflicts recorded (none resolved by choosing a side):**

1. BSI treats EN 15102:2019 as current and the 2007+A1:2011 edition as withdrawn; the GB designated list, the EU summary list and ADB cite 2007+A1:2011 only (section 6.1).
2. ADB Appendix F edition years lag BSI's current records for BS EN 13501-2, BS EN 15725 and BS EN 13238 (section 1.1).
3. BSI landing-page and Knowledge dates differ for BS EN 13501-1:2018, BS EN 13823:2020+A1:2022 and BS EN 15102:2019 (section 1.2).
4. ADB B7 groups class E with the smoke and droplet subclasses; the Regulation attaches droplets only to E (section 3).
5. A superseded March 2024 circular gives 30 September 2026 for an earlier ADB amendment set; the September 2024 publication gives 2 March 2025 for removal of national reaction-to-fire classes (section 8.1).

**Open questions:**

- Which EN 15102 edition does a particular wallcovering DoP cite, and why is the 2019 edition missing from both citation lists? The manufacturer must say; neither edition should be substituted.
- EN 15102 Annex ZA, the AVCP system, and its mounting, substrate and adhesive provisions for fire testing were not read (paywalled).
- EU-side status of Decision 2010/82/EU, and whether Regulation 2016/364 has been amended on the EU side, could not be checked on EUR-Lex (automated requests returned an empty HTTP 202). The Publications Office had no consolidated version of 2016/364 (CELEX 02016R0364) at the address tried.
- How NPD operates under the declaration of performance and conformity in Regulation (EU) 2024/3110 was not examined.
- How EN 13823 measures smoke, and what changed in EN ISO 11925-2:2026 and BS EN 13238:2026, are in paywalled text.
- Whether a particular building control body accepts reports citing older editions (13501-1:2007+A1:2009, 13823:2010+A1:2014, ISO 11925-2:2010) is case by case; no official statement was found either way.
- ASTM and UL class bands and later amendments to IMO FTP Code Part 5 were not verified from primary text.
- The text of the 2 September 2024 written ministerial statement was not read; the position is taken from gov.uk guidance describing it. A "minimum two-year transition" for ending CE recognition appears only in secondary reports and is not asserted.
- BSI records for EN 259-1 and EN 266 were not located.

---

## Source index

IDs match `B-standards.json`. All sources accessed 15 October 2026. SHA-256 values are for the files downloaded in this session where a file was saved; "n/a" means a live catalogue page whose content changes.

| ID | Issuer and document | Reference | Issue or status date | Type | URL | SHA-256 |
|---|---|---|---|---|---|---|
| src-bsi-13501-1-landing | BSI: BS EN 13501-1 landing page (undated, all editions) | UPI 000000000030059106 | page shows 'published 14/01/2019' for the 2018 edition | standard_catalogue | https://landingpage.bsigroup.com/LandingPage/Undated?UPI=000000000030059106 | 58fa8a51a76f06f7e9ff26439b46582d0ac6098e1aec19951b983e3f933c3ffc |
| src-bsi-13501-1-kn | BSI: BS EN 13501-1:2018 BSI Knowledge record | BS EN 13501-1:2018 | 2019-01-31 (as shown by BSI Knowledge) | standard_catalogue | https://knowledge.bsigroup.com/products/fire-classification-of-construction-products-and-building-elements-classification-using-data-from-reaction-to-fire-tests | n/a |
| src-bsi-13501-1-2007-kn | BSI: BS EN 13501-1:2007+A1:2009 BSI Knowledge record | BS EN 13501-1:2007+A1:2009 | 2007-03-30 | standard_catalogue | https://knowledge.bsigroup.com/products/fire-classification-of-construction-products-and-building-elements-classification-using-test-data-from-reaction-to-fire-tests-1 | n/a |
| src-bsi-13823-kn | BSI: BS EN 13823:2020+A1:2022 BSI Knowledge record | BS EN 13823:2020+A1:2022 | 2023-01-31 (BSI Knowledge) | standard_catalogue | https://knowledge.bsigroup.com/products/reaction-to-fire-tests-for-building-products-building-products-excluding-floorings-exposed-to-the-thermal-attack-by-a-single-burning-item-3 | n/a |
| src-bsi-13823-lp | BSI: BS EN 13823 landing pages (undated UPI 000000000030059105; 2020+A1:2022 UPI 000000000030468215) | UPI 000000000030059105 / 000000000030468215 | landing page shows '(published 31/05/2020)' | standard_catalogue | https://landingpage.bsigroup.com/LandingPage/Undated?UPI=000000000030059105 | ac42cb99648e72a6298f4056d157b1358827705c2c534ee51f0d10953cb8da55 |
| src-bsi-11925-2-kn | BSI: BS EN ISO 11925-2:2026 BSI Knowledge record | BS EN ISO 11925-2:2026 | 2026-01-31 (BSI Knowledge) | standard_catalogue | https://knowledge.bsigroup.com/products/reaction-to-fire-tests-ignitability-of-products-subjected-to-direct-impingement-of-flame-single-flame-source-test-2 | n/a |
| src-bsi-11925-2-lp | BSI: BS EN ISO 11925-2 landing page (undated) | UPI 000000000030059103 | landing page shows '(published 30/01/2026)' | standard_catalogue | https://landingpage.bsigroup.com/LandingPage/Undated?UPI=000000000030059103 | 046d8daade006790a3fe073d94b106638f8bea8532877db553c9294eef77c102 |
| src-bsi-1716-kn | BSI: BS EN ISO 1716:2018 BSI Knowledge record | BS EN ISO 1716:2018 | 2018-07-31 (BSI Knowledge) | standard_catalogue | https://knowledge.bsigroup.com/products/reaction-to-fire-tests-for-products-determination-of-the-gross-heat-of-combustion-calorific-value-1 | n/a |
| src-bsi-1716-lp | BSI: BS EN ISO 1716 landing page (undated) | UPI 000000000030059104 | landing page shows '(published 20/07/2018)' | standard_catalogue | https://landingpage.bsigroup.com/LandingPage/Undated?UPI=000000000030059104 | 876688b6737a9e3824cd7df24d76ab25da48f87919fcdf4d7be23ad502026de9 |
| src-bsi-1182-kn | BSI: BS EN ISO 1182:2020 BSI Knowledge record | BS EN ISO 1182:2020 | 2020-06-30 (BSI Knowledge) | standard_catalogue | https://knowledge.bsigroup.com/products/reaction-to-fire-tests-for-products-non-combustibility-test | n/a |
| src-bsi-15102-2019-kn | BSI: BS EN 15102:2019 Decorative wallcoverings. Roll form: BSI Knowledge record | BS EN 15102:2019 | 2019-06-30 (BSI Knowledge) | standard_catalogue | https://knowledge.bsigroup.com/products/decorative-wallcoverings-roll-form | 2afadc9f651500c23a52cdb86a375b89f06b373cd5e0176dfc31ad7f232e6eb2 |
| src-bsi-15102-lp | BSI: BS EN 15102:2019 landing page | UPI 000000000030325908 | landing page shows '(published 19/06/2019)' | standard_catalogue | https://landingpage.bsigroup.com/LandingPage/Standard?UPI=000000000030325908 | 5f48734267f3dfdaad85bd5dbc2fdc2ee1e758c9c65d7b06374d83771c047163 |
| src-bsi-15102-2007-kn | BSI: BS EN 15102:2007+A1:2011 Decorative wall coverings. Roll and panel form: BSI Knowledge record | BS EN 15102:2007+A1:2011 | 2007-11-30 (BSI Knowledge) | standard_catalogue | https://knowledge.bsigroup.com/products/decorative-wall-coverings-roll-and-panel-form | 98febb33cce3bbeb80fca5ac005e27e470af277716dcf604d81f76c87ff45686 |
| src-bsi-13238-kn | BSI: BS EN 13238:2026 BSI Knowledge record | BS EN 13238:2026 | 2026-07-31 (BSI Knowledge) | standard_catalogue | https://knowledge.bsigroup.com/products/reaction-to-fire-tests-for-building-products-conditioning-procedures-and-general-rules-for-selection-of-substrates-2 | n/a |
| src-bsi-13501-2-kn | BSI: BS EN 13501-2:2023 BSI Knowledge record | BS EN 13501-2:2023 | 2023-06-30 (BSI Knowledge) | standard_catalogue | https://knowledge.bsigroup.com/products/fire-classification-of-construction-products-and-building-elements-classification-using-data-from-fire-resistance-and-or-smoke-control-tests-excluding-ventilation-services | n/a |
| src-bsi-233-kn | BSI: BS EN 233:2016 Wallcoverings in roll form. Specification for finished wallpapers, wall vinyls and plastics wallcoverings | BS EN 233:2016 | 2016-11-30 | standard_catalogue | https://knowledge.bsigroup.com/products/wallcoverings-in-roll-form-specification-for-finished-wallpapers-wall-vinyls-and-plastics-wallcoverings | n/a |
| src-bsi-234-kn | BSI: BS EN 234:2019 Wallcoverings in roll form. Specification for wallcoverings for subsequent decoration | BS EN 234:2019 | 2020-01-31 | standard_catalogue | https://knowledge.bsigroup.com/products/wallcoverings-in-roll-form-specification-for-wallcoverings-for-subsequent-decoration | n/a |
| src-bsi-259-kn | BSI: BS EN 259:1997 Wallcoverings in roll form. Specification for heavy duty wallcoverings | BS EN 259:1997 | 1997-05-15 | standard_catalogue | https://knowledge.bsigroup.com/products/wallcoverings-in-roll-form-specification-for-heavy-duty-wallcoverings | n/a |
| src-bsi-476-6-kn | BSI: BS 476-6:1989+A1:2009 Method of test for fire propagation for products | BS 476-6:1989+A1:2009 | 1989-03-31 | standard_catalogue | https://knowledge.bsigroup.com/products/fire-tests-on-building-materials-and-structures-method-of-test-for-fire-propagation-for-products | n/a |
| src-bsi-476-7-kn | BSI: BS 476-7:1997 Method of test to determine the classification of the surface spread of flame of products | BS 476-7:1997 | 1997-01-15 | standard_catalogue | https://knowledge.bsigroup.com/products/fire-tests-on-building-materials-and-structures-method-of-test-to-determine-the-classification-of-the-surface-spread-of-flame-of-products | n/a |
| src-bsi-476-article | BSI: The changing status of the BS 476 standard series: A summary (BSI Knowledge article) | BSI Knowledge article, 19 Feb 2025 | 2025-02-19 | standard_catalogue | https://knowledge.bsigroup.com/articles/the-changing-status-of-the-bs-476-standard-series-a-summary | 546403bed584d29cd098261becf1958d1d44e838c6b2f20b73828b1535e4718c |
| src-bsi-13773-kn | BSI: BS EN 13773:2003 Textiles and textile products. Burning behaviour. Curtains and drapes. Classification scheme | BS EN 13773:2003 | 2003-02-19 | standard_catalogue | https://knowledge.bsigroup.com/products/textiles-and-textile-products-burning-behaviour-curtains-and-drapes-classification-scheme | n/a |
| src-bsi-5867-2-kn | BSI: BS 5867-2:2008 Fabrics for curtains, drapes and window blinds. Flammability requirements. Specification | BS 5867-2:2008 | 2008-05-30 | standard_catalogue | https://knowledge.bsigroup.com/products/fabrics-for-curtains-drapes-and-window-blinds-flammability-requirements-specification | n/a |
| src-bsi-5852-kn | BSI: BS 5852:2006 Methods of test for assessment of the ignitability of upholstered seating by smouldering and flaming ignition sources | BS 5852:2006 | 2006-03-31 | standard_catalogue | https://knowledge.bsigroup.com/products/methods-of-test-for-assessment-of-the-ignitability-of-upholstered-seating-by-smouldering-and-flaming-ignition-sources | n/a |
| src-bsi-15725-kn | BSI: BS EN 15725:2023 Extended application on the fire performance of construction products and building elements: Principle of EXAP standards and EXAP reports | BS EN 15725:2023 | 2023-03-31 | standard_catalogue | https://knowledge.bsigroup.com/products/extended-application-on-the-fire-performance-of-construction-products-and-building-elements-principle-of-exap-standards-and-exap-reports | n/a |
| src-astm-e84 | ASTM International: ASTM E84-26a Standard Test Method for Surface Burning Characteristics of Building Materials (ASTM store page) | ASTM E84-26a | Last Updated 15 Apr 2026 (store page) | standard_catalogue | https://store.astm.org/e0084-26a.html | 0d2deadc1a80dbe6c254d70861a1d7885d615e9a4ac288d35cbbd81b92c4a90c |
| src-ul-723 | UL Standards & Engagement: UL 723 Standard for Test for Surface Burning Characteristics of Building Materials (UL standards shop page) | UL 723 Edition 11 | Published 21 Mar 2025; last revision 23 Jun 2025 | standard_catalogue | https://www.shopulstandards.com/ProductDetail.aspx?productId=UL723_11_C_20250321 | be7ee398faee71ec25f8f45e06dd56d1fe56dee38a19af7283c30c4c56acdf02 |
| src-imo-msc307 | International Maritime Organization: Resolution MSC.307(88) International Code for Application of Fire Test Procedures, 2010 (2010 FTP Code) | MSC.307(88) | 2010-12-03 (adopted) | legislation | https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/MSCResolutions/MSC.307(88).pdf | 3234a92d7f9596bdf0dad2edc79dac21aa7d2578f2b8b97146c0ad67b4fd19ff |
| src-reg-2016-364-legis | European Commission (text carried by legislation.gov.uk, National Archives): Commission Delegated Regulation (EU) 2016/364 of 1 July 2015 on the classification of the reaction to fire performance of construction products pursuant to Regulation (EU) No 305/2011 | Delegated Regulation (EU) 2016/364 | 2015-07-01 | legislation | https://www.legislation.gov.uk/eur/2016/364/contents | 21714eddcb7ad09c50a4ac171e0d73e819e227036a889714ca8f41f8dee336a3 |
| src-reg-2016-364-oj | Publications Office of the European Union (Official Journal): Commission Delegated Regulation (EU) 2016/364, OJ L 68, 15.3.2016, p.4 | OJ L 68/4 | 2016-03-15 | legislation | http://publications.europa.eu/resource/celex/32016R0364 | 315553acda9f3688b8e47a68b3c46316d1aa0cf31eb28dd6efda9b9abc3a9296 |
| src-cpr-art6-gb | UK Parliament / National Archives (legislation.gov.uk): Regulation (EU) No 305/2011 (as it has effect in Great Britain), Article 6 Content of the declaration of performance | EUR 2011/305 art.6 | 2011-03-09 (revised GB text) | legislation | https://www.legislation.gov.uk/eur/2011/305/article/6 | 3c4f5698a262ad71ae4ff0efa778b248f51e66e6e55b0f6cd8378ff861b2c269 |
| src-cpr-art2-gb | UK Parliament / National Archives (legislation.gov.uk): Regulation (EU) No 305/2011 (as it has effect in Great Britain), Article 2 Definitions | EUR 2011/305 art.2 | 2011-03-09 (revised GB text) | legislation | https://www.legislation.gov.uk/eur/2011/305/article/2 | 73f408d449ca045c4f466b469b3491b1c993cdced98533b3508d7e9395ef3d94 |
| src-dec-2010-82 | European Commission (text carried by legislation.gov.uk): Commission Decision of 9 February 2010 establishing the classes of reaction-to-fire performance for certain construction products as regards decorative wallcoverings in roll and panel form (2010/82/EU) | Decision 2010/82/EU, C(2010) 397 | 2010-02-09 | legislation | https://www.legislation.gov.uk/eudn/2010/82/contents | 53e47b9c292f60f13488725a36e4676c3c904846de73297dc243f5305c46b5ba |
| src-si-2025-1172 | UK Government (legislation.gov.uk): The Construction Products (Amendment) Regulations 2025 | SI 2025/1172 | 2025-11-06 | legislation | https://www.legislation.gov.uk/uksi/2025/1172/contents/made | 62cf2424a1ed4937f35f96bf91cd32a4b48108d1244a0d16bf5d6ae249f8abd5 |
| src-gov-cpr-gb | Department for Business and Trade / OPSS via gov.uk: Construction Products Regulation in Great Britain (guidance) | gov.uk detailed guide | last change note 2025-05-21 (gov.uk public_updated_at; page metadata refreshed 2026-10-13) | government_guidance | https://www.gov.uk/guidance/construction-products-regulation-in-great-britain | 3e4e7148ab1d72b8aadafdd259ef61a2d3cdbd8f03a5d5ca0c41deb868bc50e3 |
| src-gov-cpr-ni | Department for Business and Trade / OPSS via gov.uk: Construction Products Regulation in Northern Ireland (guidance) | gov.uk detailed guide | last change note 2025-05-21 | government_guidance | https://www.gov.uk/guidance/construction-products-regulation-in-northern-ireland | 2e2ef6aeed40f565c10cbf1c3f97054f13168bf4740fdb54012b52382890d802 |
| src-gov-harm-ukca-ce | Department for Business and Trade via gov.uk: Using harmonised standards to place CE marked products on the market in Great Britain: UKCA and CE regimes | gov.uk guidance | 2026-03-31 | government_guidance | https://www.gov.uk/government/publications/using-harmonised-standards-to-place-ce-marked-products-on-the-market-in-great-britain-ukca-and-ce-regimes | c17e1a9eea0f00eac63976e0fb6de94ee99a5fb9d14610c04aea0f5880e65f32 |
| src-gov-white-paper-2026 | Ministry of Housing, Communities and Local Government: Construction Products Reform White Paper (CP 1515) | Command Paper CP 1515 | 2026-02-25 (gov.uk first published); consultation closed 2026-05-20 | government_guidance | https://assets.publishing.service.gov.uk/media/699c68cad2b9c6ec5b6fbbe8/Construction_Products_Reform_White_Paper.pdf | 1574b561e76bbb5d0b4595f3a130ac634e62ce9247320cbec72419b01dff96e4 |
| src-gov-ds-notice-0123-25 | Ministry of Housing, Communities and Local Government: Notice of publication 0123/25 of 26 September 2025: references to standards for construction products (designated standards) | Notice 0123/25 | 2025-09-26 | government_guidance | https://assets.publishing.service.gov.uk/media/68da4a7a8c1db6022d0c9e44/ds-0123-25-construction-products-notice.pdf | 7865d88503b5eb781710478ca8af65ba5c87e90ce68343c4cb2a54682b2782c8 |
| src-gov-ds-list-v2 | Ministry of Housing, Communities and Local Government: Designated standards: construction products, consolidated list version 2, 26 September 2025 | gov.uk spreadsheet (ODS) | 2025-09-26 | government_guidance | https://assets.publishing.service.gov.uk/media/68d51425e65dc716bfb1dd94/ds-construction-products-list-v02.ods | b117082df8548f803959607cbaecfea86a2cd38cca5c353cf98b11b19bcd6d7f |
| src-ec-cpr-summary-2026 | European Commission, DG GROW: Summary of references of harmonised standards published in the Official Journal: Regulation (EU) No 305/2011 (generated 9 Feb 2026) | Commission summary list, 9.2.2026 | 2026-02-09 | government_guidance | https://single-market-economy.ec.europa.eu/document/download/b7ff8581-3a87-4d72-98d6-41301f56d888_en?filename=305_2011_CPR_Summary%20list%20of%20harmonised%20standards_Generated%20on%209.2.2026.pdf | 80a47bfde0a3c910125bc38e415b9b981e7252cb1d114209ec354ac1e8c495b3 |
| src-gov-adb-page | Ministry of Housing, Communities and Local Government via gov.uk: Fire safety: Approved Document B (publication page) | gov.uk statutory guidance | last change note 2026-09-16 | government_guidance | https://www.gov.uk/government/publications/fire-safety-approved-document-b | 20f478351dafeb7859105f30609d786a123074c471b113118b1dffb87948d7d7 |
| src-adb2-2026 | Ministry of Housing, Communities and Local Government: Approved Document B (fire safety) volume 2: Buildings other than dwellings, 2019 edition incorporating 2020, 2022, 2025 and 2026 amendments collated with 2029 amendments | AD B Vol 2 (online version) | 2026-09-16 (gov.uk change note) | government_guidance | https://assets.publishing.service.gov.uk/media/6aa3bb7492e72b8ac437f145/AD_B2_2026.pdf | 106cfbd5d5cafdae8f38f12b93fc6f43ff08ef74533d9159f4981375b55ef927 |
| src-adb1-2026 | Ministry of Housing, Communities and Local Government: Approved Document B (fire safety) volume 1: Dwellings, 2019 edition incorporating 2020, 2022, 2025 and 2026 amendments collated with 2029 amendments | AD B Vol 1 (online version) | 2026-09-16 (gov.uk change note) | government_guidance | https://assets.publishing.service.gov.uk/media/6aa3bb335f6e942efe37f150/AD_B1_2026.pdf | fabdc362fd7ceadb3adddb300e766aec5eec9eede412debd281d4f4df0514a69 |
| src-adb-2025-amend | Ministry of Housing, Communities and Local Government: Amendments to Approved Document B volume 1 and volume 2 (published September 2024, taking effect 2 March 2025) | AD B 2025 amendments booklet | 2024-09 (published); effective 2025-03-02 | government_guidance | https://assets.publishing.service.gov.uk/media/67c1ac3d16dc9038974dbcfe/2025_Amendments_to_Approved_Document_B_volume_1_and_volume_2.pdf | 95a0650a93b6d508346fea4785fd7756e83dfc187888f2ef0a54021ed108b6bb |
| src-adb2-2019ed | Ministry of Housing, Communities and Local Government: Approved Document B (fire safety) volume 2: Buildings other than dwellings, 2019 edition incorporating 2020 and 2022 amendments | AD B Vol 2 (2019 ed., 2022 amendments) | 2022-12 (gov.uk publication) | government_guidance | https://assets.publishing.service.gov.uk/media/639ae876e90e0721839ea637/Approved_Document_B__fire_safety__volume_2_-_Buildings_other_than_dwellings__2019_edition_incorporating_2020_and_2022_amendments.pdf | bb70d2c9775098b8b0f3e50b957cbaf53f89f7cce39855d8badbec7e14fc06a6 |
| src-adb2-2006ed | Department for Communities and Local Government: Approved Document B (fire safety) volume 2: Buildings other than dwellinghouses, 2006 edition incorporating 2007, 2010 and 2013 amendments | AD B Vol 2 (2006 ed., 2013 amendments) | 2013 | government_guidance | https://assets.publishing.service.gov.uk/media/5a80b3ed40f0b62302695056/BR_PDF_AD_B2_2013.pdf | f68c8e57a8d9506e9f39f9a7c8e7f2a30ffbfd8922e4ee22ecd430298aa18ecc |
| src-adb-circular-2024 | Department for Levelling Up, Housing and Communities: Circular: Amendments to Approved Document B (29 March 2024) | DLUHC circular 29 March 2024 | 2024-03-29 | government_guidance | https://assets.publishing.service.gov.uk/media/6605f132f9ab416792eea370/Circular_-_Amendments_to_Approved_Document_B_Fire_safety.pdf | 81c5b5a6a6c2406dd7065baecc906660b242ebd3221c64952f817c33cfc07e24 |

