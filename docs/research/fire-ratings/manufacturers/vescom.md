# Vescom: fire documentation for wallcoverings (research notes, checked 15 Oct 2026)

Agent E. Scope: Vescom's own published fire documents for wallcoverings, read page by page where possible.
Every statement below comes from a Vescom page or document, or from a test body or notified body document that Vescom hosts.
Dates are kept apart: the issue date printed on a document, any validity period the document itself states, and our access date (2026-10-15).
Machine-readable records: `E-vescom.json` (18 product records, 40 source records).

## 1. Summary

- **What Vescom publishes.** Its Certificates & Reports library (https://vescom.com/en/resources/certificates-reports) holds one PDF per design per test, with a title that carries a class, for example "Colour Choice 1056 - EN 13501, B s2 d0". The title is Vescom's label. The PDF behind it is often a report on a different product or a generic construction, and the same report is filed under several designs.
- **Colour Choice+Protect.** The product page and specsheet show "EN 13501, B s2 d0" with no standard year, test body, report number, substrate or adhesive. The library file behind that line is CREPIM report DO-18-0159\A-R1 (21 Aug 2018) on "VESCOM - RAINY", a vinyl on cotton described without a Protect laminate. The report prints a 5-year validity from 21/08/2018. The only evidence that includes the Protect laminate is the family declaration DoP-CPR-01002 (B-s2,d0, 7 Jul 2017), its Centexbel certificate 0493-CPR-W015 (stated to be valid "latest on July 31st 2023") and an MPA Dresden classification of Pleso + Protect at 356 +/- 2 g/m2 (B-s2,d0, 20 Jul 2018).
- **Protect "B s1 d0".** Seven design pages (Albert, Kilby, Lismore, Melvin, Millwood, Nero, Pleso, all +Protect) link to one CREPIM report, DO-20-1944\A-R1, on Pleso + Protect at 0.37 kg/m2, "no variation allowed", validity printed as 5 years from 26/06/2020.
- **Every EN 13501-1 result is tied to a build-up.** Most Vescom results were obtained on 11 to 12 mm calcium silicate board with Vescom 2000, 2500 or 3000 (or Perfax for textiles), vertical joints. The CREPIM and MPA fields extend to A1 or A2-s1,d0 substrates over 652.5 kg/m3 but exclude plasterboard. The 2012 Efectis report is the one exception and was run on paper-faced plasterboard. The four Tapetex textile reports allow no air gap, and three of the four allow no joints.
- **Separate systems.** EU Euroclass results, IMO marine approval (MED certificate MED_2023_0059_B) and US ASTM E84 values are separate documents on separate specimens. None of them converts into another. No BS 476 document for any wallcovering was found: a search of the library for "BS 476" returned no results.
- **Installation documents carry no fire information.** The 2025 general specification and the Protect instruction sheet give substrate, primer and adhesive rules but do not say they are conditions of any fire result.

## 2. Method and limits

- Library searched through its own search box on 2026-10-15 (terms: Protect, DoP, CE, IMO, BS 476, Installation, Technical information, Brochure, Wallcovering+print, digital, EN 13501, ASTM E84, Xorel, olefin, textile, polyester, silk, Colour Choice). 534 unique documents were listed; the library holds about 1,000, so it is not enumerated in full.
- About 75 PDFs were downloaded to a temporary folder. Pages were rendered with a PDF renderer and looked at; text was also extracted to check numbers. Some early page views failed to return the image, so those documents were re-read later; where a document was read only as extracted text, the table says so.
- Not read: the Efectis, ICL and MPA sub-reports behind the classification reports; most Vescom DoPs for other material families (class taken from extracted text only, listed in section 4).
- Nothing was downloaded from behind a login. No PDFs are copied into the repository.

## 3. Documents found

SHA-256 values are for the files downloaded on 2026-10-15. "Rendered checked" says whether the rendered pages were looked at.

| Doc | Type | Reference | Issue date | URL | SHA-256 | Rendered checked |
|---|---|---|---|---|---|---|
| Certificates & Reports (documents library) | webpage | n/a | not printed | https://vescom.com/en/resources/certificates-reports | `(not recorded)` | n/a (web page) |
| Colour Choice+Protect product page | webpage | n/a | not printed | https://vescom.com/en/products/colour-choiceprotect | `(not recorded)` | n/a (web page) |
| Vescom Protect solution page | webpage | n/a | not printed | https://vescom.com/en/solutions/vescom-protect | `(not recorded)` | n/a (web page) |
| Specsheet Colour Choice+Protect 1126.01 PRO - 1126.75 PRO (en-GB) | technical_sheet | Vescom-Colour Choice+Protect-1126.01PRO-1126.75PRO.pdf | not printed | https://api-services.vescom.com/product/specsheet/colour-choiceprotect/en-GB | `0a70f82d021583ce198c950a43b4c348f2815daa25a0fa1919ba5514d5d2e1e2` | yes |
| Specsheet Colour Choice+Protect (en-US) | technical_sheet | same as en-GB | not printed | https://api-services.vescom.com/product/specsheet/colour-choiceprotect/en-US | `9370673fa875af3a0a2fb7738c2ae3d4ca9f61d5dd295b4bbd9bfaec83fcdc8d` | text read; not page-viewed |
| Brochure Vescom Protect | brochure | Brochure Vescom Protect - EN | not printed | https://documents.vescom-cdn.com/f18379/Brochure%20Vescom%20Protect%20-%20EN.pdf | `fb311928c7a9cb52c478602b3a3e32666f3d9c061813b6ad142fda39f4e5205b` | text read (PDF p.24); not page-viewed |
| Classification report of reaction to fire performance, VESCOM - RAINY (T1817617 and T1817618) | classification_report | DO-18-0159\A-R1 | 2018-08-21 | https://documents.vescom-cdn.com/f18987/Colour%20Choice%2Bprotect%201126PRO%20-%20EN%2013501%2C%20B%20s2%20d0.pdf | `6d30dbbb8882bb296affce56202dffd90ffa4572d4845f0ea6d91fdd66dad6e7` | yes: p.1-2 (via identical Delta+Protect copy) and p.5 viewed; p.1-8 read as text |
| Classification of reaction to fire performance in accordance with EN 13501-1:2007+A1:2009, Vescom vinyl wallcovering approx. 460 g/m2 glued on paper faced plasterboard | classification_report | 2012-Efectis-R9438d, issue 1 | 2012-11 | https://documents.vescom-cdn.com/f567/Colour%20Choice%201056%20-%20EN%2013501%2C%20B%20s2%20d0.pdf | `6648e201cac9bb5a2b36d7e448ab97501bcfdf5c6a3917d84a09c2c821a01089` | yes |
| Test report ASTM E84-16, specimen VA-WC-20-LC-17 | test_report | 102951522SAT-004A | 2017-04-13 | https://documents.vescom-cdn.com/f689/Colour%20Choice%201056%20-%20ASTM%20E84%2C%20A.pdf | `f2a15717eab49014ba4fa048cdc4c7448cd8ff7670d4ec89a9828ba2959c288a` | yes: p.5 viewed; p.1-6 read as text; data sheets p.7-9 are images, not read |
| Classification of reaction to fire performance in accordance with EN 13501-1:2018, Vinyl Wallcovering 350 g/m2 | classification_report | 2023-Efectis-R000709 | 2023-08 | https://documents.vescom-cdn.com/f1546/Colour%20Choice%2Bprint%201036%20-%20EN%2013501%2C%20B%20s1%20d0.pdf | `19f28de8a2ca0943bcf1511bf4f13354da3c6b78643505225b34e2ece197334d` | yes |
| Classification of reaction to fire performance in accordance with EN 13501-1:2018, Vinyl Wallcovering 850 g/m2 | classification_report | 2023-Efectis-R001392 | 2023-12 | https://documents.vescom-cdn.com/f16849/EN%2013501%2C%20B%20s2%20d0%20-%20440-850%20grm2.pdf | `42a38b475168cf965074b87f79c8af728239a0d9c8c2a0bb6c91653f6bb20fa7` | yes: p.4-5 viewed; p.1-3 read as text |
| Fire test report ASTM E84-18a, specimen BV-WC-15-LC-18 | test_report | 103662200SAT-001 (document control RT-R-AMER-Test-2780) | 2018-09-18 | https://documents.vescom-cdn.com/f818/Colour%20Choice%2Bprint%201036%20-%20ASTM%20E84%2C%20A.pdf | `417b9a4a8d83bc8d3a71553cf833aec3218072ba2401471a8b498f0d65601e4a` | yes |
| EU Declaration of Conformity (MED) with EC type-examination certificate MED_2023_0059_B and EC quality-system certificate MED_VescomBV_2022_0001_D | certificate | MED_2023_0059_B; MED_VescomBV_2022_0001_D | 2024-05-07 | https://documents.vescom-cdn.com/f204/Colour%20Choice%2Bprint%201036%20-%20full%20IMO%20MED.pdf | `c929563a96bfe50438e7530b303deb2bf3ae20d7c493254b8250cc375aa6b99d` | yes |
| Test report, IMO 2010 FTP Code Part 2 smoke and toxicity | test_report | ICL/H18/9038 Rev 1 | 2018-04-06 (rev 1: 2018-04-10) | https://documents.vescom-cdn.com/f739/Colour%20Choice%2Bprint%201036%20-%20IMO%202010%20FTP%20part%202.pdf | `dde2d13a448191774a9a340b2d61e92258b0f5a33db69fe96df7721deed51df9` | text read; not page-viewed |
| Test report, IMO 2010 FTP Code Part 5 Appendix 1 surface flammability | test_report | ICL/H18/9039 Rev 1 | 2018-04-05 (rev 1: 2018-04-10) | https://documents.vescom-cdn.com/f740/Colour%20Choice%2Bprint%201036%20-%20IMO%202010%20FTP%20part%205.pdf | `76e840f3b9dc06516a7e5a0608a6d14a057110d7fa5ac8a2501c19e709386ecd` | text read; not page-viewed |
| DoP-CPR-01002, Certificate of constancy of performance 0493-CPR-W015, annex, and MPA Dresden classification and test reports (Pleso + Protect) | certificate | DOP-CPR-01002; 0493-CPR-W015; MPA Dresden 20180730/01 | 2021-07-29 (certificate); 2018-07-20 (MPA report); 2017-07-07 (DoP) | https://documents.vescom-cdn.com/f278/CE%20-%20Vescom%20-%20vinyl%20wallcovering%2Bprotect.pdf | `86a8059a801a46d509211eb638aaf343440220334bd50091615f3c3b1ccb0be3` | yes: p.2, 4-9 and 28 viewed; p.1 and 3 read as text; p.10-27 not individually read |
| Declaration of Performance DOP-CPR-01002, cotton backed vinyl wallcovering with Vescom Protect, FR treated, 370-480 g/m2 | dop | DOP-CPR-01002 | 2017-07-07 | https://documents.vescom-cdn.com/f2512/DoP-CPR-01002%20-%20370-480%20grs%20vinyl%2Bprotect.pdf | `855f27ee7c10b2da715622874bf5072ea0ea356feb3f6e44490826c8a7572b65` | yes |
| DoP-CPR-01001, Certificate of constancy of performance 0493-CPR-W014, annex, and CREPIM classification reports DO-18-0159 and DO-18-0260 | certificate | DOP-CPR-01001; 0493-CPR-W014 | 2021-03-05 (certificate); 2017-07-07 (DoP) | https://documents.vescom-cdn.com/f103/CE%20-%20Vescom%20-%20vinyl%20wallcovering.pdf | `d4ef7f676954efe01fbd45f6a11fc546c71a0f41784804b8f07a106ed017617a` | yes: p.1-3 viewed; CREPIM reports read as text |
| Declaration of Performance DOP-CPR-01001, cotton backed vinyl wallcovering, FR treated, 360-850 g/m2 | dop | DOP-CPR-01001 | 2024-08-27 | https://documents.vescom-cdn.com/f16184/DoP-CPR-01001%20-%20360-850%20grs%20vinyl.pdf | `a8097515f2707bd84dde93ae0ee3b7e8c4c132632c1f8d7432c6124af22ea1c1` | yes |
| Declaration of Performance DOP-CPR-01006, cotton backed vinyl wallcovering, FR treated, 350 g/m2 | dop | DOP-CPR-01006 | 2023-08-25 | https://documents.vescom-cdn.com/f16185/DoP-CPR-01006%20-%20350%20grs%20vinyl.pdf | `238d954e758e8101ec4657c842ee34abd21756f36ada9492167fa8446a72a643` | yes |
| Classification report of reaction to fire performance, Vescom Pleso + Protect (T2012062), NF EN 13501-1:2018 | classification_report | DO-20-1944\A-R1 | 2020-06-26 (printed as the start of the validity period) | https://documents.vescom-cdn.com/f1215/Pleso%2Bprotect%201026PRO%20-%20EN%2013501%2C%20B%20s1%20d0.pdf | `e9438381033dbfcdc9eb2dc70c2135a590efc29ebaf8aea3529c1f81312e7af1` | yes: p.1 viewed, and p.1-5 via the identical Albert+Protect copy |
| Classification of reaction to fire performance in accordance with EN 13501-1:2018, Porak+print | classification_report | 2024-Efectis-R001444 | 2025-01 | https://documents.vescom-cdn.com/f16802/Porak%2Bprint%201041%20-%20EN%2013501%2C%20B%20s2%20d0.pdf | `b288c1cf9874433c83acdc9d753d46714c550890e6009dca52d787e74cf7cdeb` | yes |
| Declaration of Performance DOP-CPR-13008, digitally printed one layer non-woven of cellulose and polyester fibres | dop | DOP-CPR-13008 | 2023-01-01 | https://documents.vescom-cdn.com/f2534/DoP-CPR-13008%20-%20nonwoven%20onelayer%2C%20digitally%20printed.pdf | `7c4697d0521ecff29928ff2efe17cdcbc97bd9ecfe1fb1ecf15d11fb3deacf0e` | yes |
| Reaction to fire classification report, Tapetex woven textile on paper backing, tested quality 70-2549 | classification_report | 24185C version 1 | 2025-06-26/30 (e-signatures p.2) | https://documents.vescom-cdn.com/f18445/Textile%20wallcovering%20-%20EN%2013501%20-%2070-2549.pdf | `05e3d74121bb818084bf68f18df50ca0c4bead0f5448d2300082ef189a291c12` | yes: p.1-3, 5-11 viewed |
| Reaction to fire classification report, Tapetex woven textile on paper backing, tested quality 69-2341 | classification_report | 22965F version 1 | 2023-10-25/26 (e-signatures p.2) | https://documents.vescom-cdn.com/f18446/Textile%20wallcovering%20-%20EN%2013501%20-%2069-2341.pdf | `84d0c51dade1366f1fa863f84d8b8c66ed5a5a6f36a0776c622ea243c1144bc6` | yes: p.1, 2, 5, 7, 8 viewed |
| Reaction to fire classification report, Tapetex woven textile on paper backing, tested quality 70-2561 | classification_report | 24185F version 1 | 2025 (test dates April-May 2025; signature date not read) | https://documents.vescom-cdn.com/f18444/Textile%20wallcovering%20-%20EN%2013501%20-%2070-2561.pdf | `a234e364800db51c6e712784d26304df67439e0d173d7060340b72ff684cb83d` | yes: p.6-8 viewed; p.1 and 5 read as text |
| Reaction to fire classification report, Tapetex woven textile on paper backing, tested quality 70-2600 | classification_report | 24185J version 1 | 2025 (test dates April-May 2025; signature date not read) | https://documents.vescom-cdn.com/f18443/Textile%20wallcovering%20-%20EN%2013501%20-%2070-2600.pdf | `d31cafdde28fda68763a6cdcfbe034458bfb94031aebd55652b21d3c12e2505b` | yes: p.1, 6, 7, 8 viewed |
| Certificate of testing, ASTM E84-21 adhered to gypsum board, Tapetex woven textile quality 70-2600 | test_report | 25-001013 rev 1 | 2025-05-14 | https://documents.vescom-cdn.com/f18447/Textile%20wallcovering%20-%20ASTM%20E84%20-%2070-2600.pdf | `6f8e6b30b71b9c4edceec0df6d6d3205a15770b08526e117b1c6a4a860eceb69` | yes |
| Declaration of Performance DOP-CPR-10001, Xorel IFR (fire retardant) wallcovering, 280-380 g/m2 | dop | DOP-CPR-10001 | 2018-01-01 | https://documents.vescom-cdn.com/f2515/DoP-CPR-10001%20-%20280-380%20grs%20xorel%20ifr.pdf | `9cecd2cc5acb9af2a20271e103a21a848214fb6d3c97b2df68b6eb0f534e5894` | yes |
| DoP-CPR-13001 woven cellulosic textiles on paper backing | dop | DOP-CPR-13001 | 2020-05-15 | https://documents.vescom-cdn.com/f2521/DoP-CPR-13001%20-%20woven%20cellulosic.pdf | `4146fc032e493f6feb963cc7c7a8b5ffc3ed153fd1473a53be1d9709d6102b04` | text only |
| DOP-CPR-13002 woven cellulosic-synthetic textiles on paper backing | dop | DOP-CPR-13002 | 2026-03-10 | https://documents.vescom-cdn.com/f18454/DOP-CPR-13002%20Linnen-synthetic%20mix%20-%20system%203.pdf | `(not recorded)` | text only |
| DOP-CPR-13004 woven animal-synthetic textiles on paper backing | dop | DOP-CPR-13004 | 2024-01-01 | https://documents.vescom-cdn.com/f18455/DOP-CPR-13004%20Animal-Synthetic%20fibre%20mix%20-%20system%203.pdf | `(not recorded)` | text only |
| DOP-CPR-13010 woven animal-cellulosic-synthetic textiles on paper backing | dop | DOP-CPR-13010 | 2026-03-10 | https://documents.vescom-cdn.com/f18456/DOP-CPR-13010%20Animal-Cellulosic-Synthetic%20fibre%20mix%20-%20system%203.pdf | `(not recorded)` | text only |
| Other Vescom DoPs read as text only (see markdown note for table) | dop | DOP-CPR-01003, 01005, 01020, 05001, 10002, 11002, 12002, 13003, 13006, 13007, 13009, 15001 | not printed | https://vescom.com/en/resources/certificates-reports?documents%5Bquery%5D=DoP | `(not recorded)` | text only |
| General specifications for use - Vescom vinyl, olefin and textile wallcovering (2025) | technical_sheet | EN - Algemeen verwerkingsvoorschrift 2025 | 2025 | https://documents.vescom-cdn.com/f1873/EN%20-%20Algemeen%20verwerkingsvoorschrift%20-%20Vescom%20vinyl%2C%20olefin%20en%20textiel%20wandbekleding%202025.pdf | `dda381fcfab2a40dd30448f08fc84570976523166c63d82f471c3043bc1b3832` | yes |
| Installation instructions Vescom vinyl wallcovering + Vescom Protect (2020) | technical_sheet | Verwerkingsvoorschrift vinyl wandbekleding + Vescom Protect - ENG | 2020 | https://documents.vescom-cdn.com/f1857/Verwerkingsvoorschrfit%20vinyl%20wandbekleding%20%2B%20Vescom%20Protect%20-%20ENG.pdf | `50aaa951d13666e1d954dbf2e6e88629abc7e0f9eb8d7b0293e4c976352821c2` | yes |
| Technical information vinyl wallcovering (2020) | technical_sheet | Technische informatie vinyl wandbekleding - ENG | 2020 | https://documents.vescom-cdn.com/f1907/Technische%20informatie%20vinyl%20wandbekleding%20-%20ENG.pdf | `7483ff0ba35b1e01e8b53917828e3f4d66e996a6ee52eb954366f78c4732ce48` | yes |
| Installation instructions wallcovering+print (2025) | technical_sheet | Verwerkingsvoorschrift wallcovering+print - EN | 2025 | https://documents.vescom-cdn.com/f1833/Verwerkingsvoorschrift%20wallcovering%2Bprint%20-%20EN.pdf | `cfe9fd0e9c7a57edfb17b44497eb4f1d9d92c09705e39fd6b99788d1a8e0bee9` | yes |
| Technical information sheets for Vescom 1000 (2020), 2000 (2020), 2500 (2021) and 3000 (2020) | technical_sheet | n/a | 2020-2021 | https://documents.vescom-cdn.com/f2003/Technische%20informatie%20lijm%20Vescom%203000%20-%20ENG.pdf | `9eb0f985662962eeddfa3d79736f43394f9095c88cab438c168adb9728d8b5d7` | yes: 1000, 2000, 3000 viewed; 2500 read as text |
| Installation instructions Xorel textile wallcovering (2023) and technical information Xorel textile wallcovering | technical_sheet | n/a | 2023 | https://documents.vescom-cdn.com/f1865/Verwerkingsvoorschrift%20Xorel%20textile%20wallcovering%20-%20ENG.pdf | `b8a8b7e255f430499a2f99de41f5d0aa38b74a46ce4c5399e61bf3d1472bf4b3` | text only (Xorel technical sheet has no readable text) |

### Library files that are the same document as one above

| Library title | SHA-256 of file | Relation |
|---|---|---|
| Rainy 1058 - EN 13501, B s2 d0 | `2412a53662ad4874f6f296591b841c01b7736b27218d97c43836d87f5de9fd51` | text identical to f567 (Colour Choice 1056) |
| Onari+protect 1076PRO - EN 13501, B s2 d0 | `6d30dbbb8882bb296affce56202dffd90ffa4572d4845f0ea6d91fdd66dad6e7` | same SHA-256 as f18987 (Colour Choice+protect 1126PRO) |
| Delta+protect 1111PRO - EN 13501, B s2 d0 | `92e8da0da082a7640ffa55fb3c6f1f015fcc670855b96b6020d9fa4c21eccdbc` | text identical to f18987 |
| Albert+protect 1103PRO - EN 13501, B s1 d0 | `a704fc9f32dab17b06d52a4e3315435837b6481160d441a882ab566bbbb08766` | text identical to f1215 (Pleso+Protect, DO-20-1944) |
| Kilby+Protect 1113PRO - EN 13501, B s1 d0 | `7f4403dadd91fc693bd9fc9c5e1c5797b7f1d2fa3a0c291eef15182d78866fec` | text identical to f1215 |
| Lismore+protect 1097PRO - EN 13501, B s1 d0 | `8d3bacfb3dede4fbe97576e97dcbffafd47435a9d5bb66233fc2fa9cac0a2b49` | text identical to f1215 |
| Melvin+protect 1024PRO - EN 13501, B s1 d0 | `ff1bce1f27ba09c50e8e88a1f65aa7cce03e1e21423a2877f1e5376bd81e4953` | text identical to f1215 |
| Millwood+protect 1077PRO - EN 13501, B s1 d0 | `d9832c6bc8afce37f00719f226abbbc144870c8c06dd73ee95caf6a41a9eade1` | text identical to f1215 |
| Nero+protect 1024PRO - EN 13501, B s1 d0 | `f5c68f0280e5df13bcafe798bc6aeb1d52c9c83b500bce29c8dbe7b7f3c5d2d3` | text identical to f1215 |
| Delta+print 1035 - EN 13501, B s1 d0 | `6158dd51d1dfb467600c6e5ba17436c2947e484894ddcd900c3bc6274612413f` | text identical to f1546 (Efectis 2023-R000709) |
| Tica+print 1033 - EN 13501, B s1 d0 | `05e17f9cd40bf45f6974a44e3219d1f385c525f9496c00e26e5e09468379bef2` | text identical to f1546 |
| Bely+print 1040 - EN 13501, B s1 d0 | `c3097b139cb772a37113061a162fdd85c23959cc7182d23913e016fe63b5c6c6` | text identical to f1546 |
| Delta+print 1035 - ASTM E84, A | `4a4f1af29b5975ec0514894116e200ef9270f7f0668231dcb242c4fd4de0ffcd` | same report number and specimen ID as f818 (p.1-2 read) |
| Bely+print 1040 - ASTM E84, A | `f6d9640aafd03a5ed45cc6da5c66e1ea3ad8c30be4362af58bd1739b4325a793` | same report number and specimen ID as f818 (p.1-2 read) |

### Downloaded but only skimmed or not used for a record

| Document | SHA-256 |
|---|---|
| Earth+print 1121 - EN 13501, B s1 d0 (f1147) | `0aea6c3b46c5b9cea6e2c01aca971812afe73177d3d9f724c5a75e7cc404c867` |
| Earth+print 1121 - ASTM E84, A (f585) | `f61976cc20e0da24f459af00f9f1b7daf019cdeab467533d4938da9a5e75616e` |
| Toro+print 3003 - EN 13501, B s1 d0 (f16059) | `eef9a0efbc6357b44fccb908308408b18a31c144296dad6648b0b7d7afc7e816` |
| Archilin 262084 - EN 13501, B s1 d0 (f1279) | `e51417cf732812ded211da54e82b4c68054730fd00a27714094cb68da51c31c4` |
| Dale 2108 - EN 13501, C s1 d0 (f1527): Efectis 2022-Efectis-R000978, wool-polyester-polyamide woven textile, class C | `3c4b89cf7703840972ee59a881e3bd0c1651f16239eab7dd152ebb8063efd0db` |
| Dash 2551 - EN 13501, B s1 d2 (f16808): Efectis 2014-Efectis-R000920, Xorel bio-based, d2 | `a3dc8b901964406ead95dbcd1b23654a567b3234f833d557d3a788bb12b3af09` |
| Technical information olefin wallcovering (f1939) | `f356699947a10eae68ab5e0404b9c0389907b3544d7c6005cd70b7cdeae2dd02` |
| Technical information wallcovering+print (f1956) | `982a2ed048f049c8b1a173bea75acf422053757797fdb2c625258d5245109186` |
| Installation instructions porak+print (f1882) | `f4531f0880d700b4ebcf1a8be699b2b489bdf8e622c27e9c41557cead97559d8` |
| Installation instructions tape yarn acrylic backed (f18432) | `e68f740b71ee61910a7910cc21ebd2c1c25e33fe38267778ef38c3d10e98ed7d` |

## 4. Product records

Classes are printed as in the document. Smoke and droplet subclasses are only given where printed. Page references are PDF page numbers of the file named in section 3. "Library label" is Vescom's title for the file, shown because it differs from the content in several cases.

### 4.1 Vinyl wallcoverings, EN 13501-1

| Record | Product and scope | Printed class (standard cited) | Evidence, test body, dates | Tested build-up | Field of application and limits | Status |
|---|---|---|---|---|---|---|
| vescom-vinyl-460-efectis-2012 | Vinyl approx. 460 g/m2 (420 vinyl + 40 cotton). Library label: Colour Choice 1056 and Rainy 1058. The report names neither. | B - s2, d0 (EN 13501-1:2007+A1:2009) | Classification report 2012-Efectis-R9438d, Efectis Nederland (NB 1234), Nov 2012. p.5: no limit in time. CPD system 3. | Paper-faced plasterboard (EN 13238), Vescom 2000, vertical joints | Substrate minimum A2; 460 g/m2; no colour, pattern or thickness stated | unclear |
| vescom-vinyl-dop-01001-360-850 | Cotton-backed vinyl, FR treated; DoP range 360-850 g/m2 (2024) or 350-800 g/m2 (2017, certificate) | B-s2, d0 (EN 13501-1, no year) | DoP-CPR-01001 (27 Aug 2024; earlier DoP 7 Jul 2017); certificate 0493-CPR-W014 issued 5 Mar 2021, first issued 7 Jul 2017, states "latest on July 31st 2023"; annex cites CREPIM DO-18-0159 (21/08/2018) and DO-18-0260 (28/09/2018) | Calcium silicate 11 mm 870 kg/m3, Vescom 2000 at 170 g/m2, vertical joint | Also A1 and A2-s1,d0 substrates over 652.5 kg/m3, "except plasterboards" | unclear |
| vescom-vinyl-350-efectis-2023 | Plain white, non-embossed 350 g/m2 vinyl. Library label: Colour Choice+print 1036, Delta+print 1035, Tica+print 1033, Bely+print 1040. | B - s1, d0 (EN 13501-1:2018) | Report 2023-Efectis-R000709, Efectis Nederland, Aug 2023, system 1; DoP-CPR-01006 (25 Aug 2023, B-s1,d0, certificate 0493-CPR-W023) | Promatect-H 12 mm calcium silicate, Vescom 3000 at 300 g/m2 wet, vertical joints, no air gap | 0.45 mm, 0.350 kg/m2, white, not embossed; substrate and glue as tested | current |
| vescom-vinyl-850-efectis-2023 | Grey embossed 850 g/m2 vinyl, 1.1 mm. Library label: "440-850 grm2". | B - s2, d0 (EN 13501-1:2018) | Report 2023-Efectis-R001392, Efectis Nederland, Dec 2023, system 1 | Promatect-H 12 mm, Vescom 2000 at 200 g/m2 wet, vertical joints | Single specimen only | current |

### 4.2 Protect (vinyl with Vescom Protect film)

| Record | Product and scope | Printed class (standard cited) | Evidence, test body, dates | Tested build-up | Field of application and limits | Status |
|---|---|---|---|---|---|---|
| vescom-protect-dop-01002-370-480 | Cotton-backed vinyl with Protect, FR treated, 370-480 g/m2 (DoP). Certificate: 370 g/m2 (310 vinyl, 40 cotton, 20 Protect). | B-s2, d0 (EN 13501-1; MPA used DIN EN 13501-1:2010-01) | DoP-CPR-01002 (7 Jul 2017); certificate 0493-CPR-W015 (29 Jul 2021; "latest on July 31st 2023"); MPA Dresden classification, Pleso + Protect, first issue 20 Jul 2018 | Calcium silicate boards, Vescom 2000 at 170 +/- 5 g/m2, vertical, joints closed up | MPA p.7: only the 0.31 +/- 0.01 mm, 356 +/- 2 g/m2 material; calcium silicate of at least 652.5 kg/m3 and A1/A2-s1,d0 substrates, no gypsum boards. p.5: re-test if coated later. | unclear |
| vescom-pleso-protect-crepim-2020 | Pleso + Protect (T2012062); the same report is linked for six other Protect designs | B-s1,d0 (NF EN 13501-1:2018) | CREPIM DO-20-1944\A-R1; validity printed as 5 years from 26/06/2020 | Calcium silicate 11 mm, Vescom 2000 at 170 g/m2, vertical joint | p.4: composition "no variation allowed", 0.3 mm, 0.37 kg/m2, any colour and pattern; p.5: A1 and A2-s1,d0 substrates over 652.5 kg/m3 except plasterboard | unclear |
| vescom-colour-choice-protect-1126pro | Colour Choice+Protect 1126.01 PRO to 1126.75 PRO; +/-460 g/m2 | EN 13501 , B, s2 - d0 (specsheet; no standard year) | Web page and specsheet (no report); library file CREPIM DO-18-0159\A-R1 of 21/08/2018 on VESCOM - RAINY, printed validity 5 years from that date | The linked file: calcium silicate 11 mm, Vescom 2000 at 170 g/m2, vertical joints, vinyl 420-760 g/m2 plus cotton 40 g/m2 (no Protect laminate described) | Composition "no variation allowed", 0.46-0.8 kg/m2; A1/A2-s1,d0 substrates over 652.5 kg/m3 except plasterboard | unclear |

### 4.3 Printed and digital

| Record | Product and scope | Printed class (standard cited) | Evidence, test body, dates | Tested build-up | Field of application and limits | Status |
|---|---|---|---|---|---|---|
| vescom-porak-print-1041 | Porak+print: 40% recycled polyester weave, acrylate-coated both sides, FR treated, 0.35 mm, 330 g/m2 | B - s2, d0 (EN 13501-1:2018) | Report 2024-Efectis-R001444, Efectis Nederland, Jan 2025, system 1. Family DoP-CPR-01005 (polyester-acrylate, B-s2,d0, certificate 0493-CPR-W019, 29 Apr 2020, text only) | Non-combustible A1/A2 870 kg/m3 board, Vescom 2500 at 200 g/m2 wet, vertical joints, no air gap | Any colour with or without print; as tested | current |
| vescom-digital-nonwoven-dop-13008 | Digitally printed one-layer non-woven of cellulose and polyester | EN 13501-1 B-s1, d0 | DoP only, 1 Jan 2023, system 3; cites Efectis 2022-Efectis-R001208 (not seen) | Unknown | Unknown; DoP intended use is A2-s1,d0 or better walls, by adhesive | unclear |
| vescom-vinyl-350-efectis-2023 (above) | Printed designs are filed against the plain-vinyl report; no printed specimen is described | B - s1, d0 | See 4.1 | See 4.1 | Whether printing is covered is not stated | current |

### 4.4 Textile and woven

| Record | Product and scope | Printed class (standard cited) | Evidence, test body, dates | Tested build-up | Field of application and limits | Status |
|---|---|---|---|---|---|---|
| tapetex-70-2549-en13501 | Cellulosic fibres on paper backing, 0.79 mm, 565 g/m2, blue, dobby | B - s2, d0 (EN 13501-1:2018) | Warringtonfire (WFRGENT NV) 24185C, e-signed 26 and 30 Jun 2025; sponsor Tapetex BV | PROMATECT-100 12 mm, Perfax glue 200 g/m2 wet | p.8: A2-s1,d0 or better substrates of at least 652.5 kg/m3 and 9 mm, not paper-faced plasterboard; no air gap; NO JOINTS | current |
| tapetex-69-2341-en13501 | Animal and synthetic fibres on paper backing, 0.4 mm, 305 g/m2, white | B - s1, d0 | 22965F, e-signed 25 and 26 Oct 2023; DOP-CPR-13004 (1 Jan 2024) cites it | As above | As above, but vertical joints permitted | current |
| tapetex-70-2561-en13501 | Cellulosic and synthetic, 0.91 mm, 540 g/m2, white, jacquard | B - s2, d0 | 24185F (tests Apr-May 2025); DOP-CPR-13002 (10 Mar 2026, B-s2,d0) cites it | As above | No joints | current |
| tapetex-70-2600-en13501 | Animal, cellulosic and synthetic, 0.49 mm, 290 g/m2, red, jacquard | B - s1, d0 | 24185J (tests Apr-May 2025); DOP-CPR-13010 (10 Mar 2026, B-s1,d0) cites it | As above | No joints | current |
| vescom-xorel-ifr-dop-10001 | Xorel IFR, 280-380 g/m2 | EN 13501-1 B-s1, d0 | DoP only, 1 Jan 2018, system 3; cites Efectis 2015 Efectis R000445 (not seen) | Unknown | Unknown | unclear |

Other Vescom DoPs read as extracted text only, with the class they declare (all EN 15102; none carries a substrate or adhesive in the DoP itself): 01003 silk B-s1,d0; 01020 polyolefin 370 g/m2 B-s1,d0; 05001 polyester FR woven B-s1,d0; 10002 Xorel bio-based B-s1,d2; 11002 PE and PE-polyester woven B-s1,d0; 12002 polyester B-s1,d0; 13001 woven cellulosic B-s1,d0; 13003 animal B-s1,d0; 13006 non-woven one layer B-s2,d0; 13007 non-woven multilayer B-s1,d0; 13009 animal-cellulosic B-s1,d0; 15001 wool-polyester-polyamide C-s1,d0. Class C and "d2" results exist in the range, so no class can be assumed for Vescom textiles as a group.

## 5. Installation conditions relevant to fire

None of Vescom's installation documents refers to a fire classification. The conditions below are the ones that line up with, or could depart from, the tested build-ups.

| Condition | Source and page | Relation to the fire results |
|---|---|---|
| Existing wallcoverings and backing papers to be removed completely | General specifications for use 2025, p.1 | Tested build-ups are on bare boards; no result covers a wallcovering over an existing wallcovering |
| Renovation over different types of wallcovering including PVC, on permanently sealed surfaces, with Vescom 3000 | Vescom 3000 technical sheet (2020), p.1 | Conflicts with the instruction above. Only one fire report (Efectis 2023-R000709) names Vescom 3000, and on bare Promatect-H |
| Absorbent surfaces primed with Vescom primer/sealer (1:3 with water, or undiluted for highly absorbent); painted walls washed and keyed; sealed bases take Vescom 3000; surface at least 10 C; moisture not over 6% | General specifications 2025, p.1 | No fire report includes a primer, paint or sealer layer. MPA p.5 says a later coating needs new proof |
| Adhesive: 1000 for vinyl up to 370 g/m2; 2000 for textile, heavier vinyl and olefin; 2500 for digital printed; 3000 for non-porous substrates | General specifications 2025, p.1; technical sheets | Tested adhesives are 2000 (Rainy, Kilby, Pleso+Protect, MPA, 460 g/m2, 850 g/m2), 3000 (350 g/m2), 2500 (Porak+print), Perfax (Tapetex) |
| Protect: adhesive Vescom 2000 at about 300 g/m2; prime suctioning walls; moisture up to 4% | Installation instructions vinyl + Protect (2020), p.1 | The Protect fire evidence (MPA, CREPIM) used Vescom 2000 at 170 g/m2, lower than the 300 g/m2 on this sheet |
| Adhesive coverage by type: Vescom 2000 at 5 m2/kg (about 200 g/m2) for vinyl 460-800 g/m2 and 3 m2/kg (about 330 g/m2) above 800 g/m2 | General specifications 2025, p.2 | Reports used 170 g/m2 (CREPIM, MPA), 200 g/m2 (Efectis 850 g/m2 with Vescom 2000; Efectis Porak+print with Vescom 2500; Tapetex with Perfax) and 300 g/m2 (Efectis 350 g/m2 with Vescom 3000). Site rates can differ from the tested rate; only MPA states a tolerance (+/- 5 g/m2) |
| Substrate to be flat, solid and dry; plasterboard named as a suitable substrate for Vescom 1000 and 2000 | General specifications p.1; Vescom 1000 and 2000 sheets | CREPIM, MPA and Tapetex fields exclude plasterboard or paper-faced plasterboard; only the 2012 Efectis report was run on it |
| Vinyl technical sheet "fire-resistant" heading refers only to an Efectis report being available | Technical information vinyl wallcovering (2020), p.2 | Wording describes reaction to fire; it is not fire resistance (building-element minutes) |

## 6. Multi-system results, kept separate

| System | Documents | What they show | Not equivalent to |
|---|---|---|---|
| EN 13501-1 (EU Euroclass) | Sections 4.1 to 4.4 | B-s1,d0, B-s2,d0 on named build-ups; one class C-s1,d0 (Dale, title only) | ASTM or IMO results |
| IMO 2010 FTP Code, Parts 2 and 5 (marine) | MED certificate MED_2023_0059_B (Centexbel NB 0493, issued 7 May 2024, expiry 25/07/2028); Interscience ICL/H18/9038 Rev 1 and ICL/H18/9039 Rev 1 (April 2018) | Digitally printed 350 g/m2 vinyl on non-woven backing on 12 mm calcium silicate with Vescom 2000 at 170 g/m2 met the wall-lining criteria: CFE 43.73 kW/m2, Qsb 2.94 MJ/m2, Qt 0.01 MJ, qp 0.14 kW, no flaming droplets. Certificate annex lists restrictions as none; 22 designs named; no Protect variant named | A Euroclass; a UK Building Regulations classification |
| ASTM E84 (US) | Intertek 102951522SAT-004A (13 Apr 2017): index 5 and 10. Intertek 103662200SAT-001 (18 Sep 2018): 0 and 15. Applied Lab 25-001013 rev 1 (14 May 2025, Tapetex 70-2600): 25 and 25 | Flame spread and smoke indices on cement board (US adhesive) or Type X gypsum board; Vescom's labels say "A" | Euroclass B. A Class A label here is an index band, not a Euroclass |
| BS 476 / UK national | Search of the library for "BS 476" found none | No Class 0 or Class 1 document for any Vescom wallcovering | n/a |
| Other national | Library titles only: DIN 4102 B1 and BS 5852 appear for upholstery items; NFPA 286 for Sila 1109 (not opened) | Not wallcovering evidence for this note | n/a |

## 7. Contradictions and outdated claims

1. **Product page versus linked document (Colour Choice+Protect).** The page says B s2 d0. The linked file tests VESCOM - RAINY, with no Protect laminate described, and carries a printed 5-year validity from 21/08/2018. The same file (identical SHA-256) is linked for Onari+Protect 1076PRO and, in text, Delta+Protect 1111PRO.
2. **Protect pages versus DoP.** The Protect solution page and brochure (PDF p.24) say B s1 d0 for Protect. DoP-CPR-01002 and certificate W015 declare B-s2,d0 for the Protect family. The B s1 d0 comes from CREPIM DO-20-1944 on Pleso + Protect, while MPA Dresden classed the same product name B-s2,d0 in 2018 at a lower mass (356 +/- 2 g/m2 against 0.37 kg/m2). Each result belongs to its own specimen.
3. **Mass ranges.** DoP-CPR-01001 gives 360-850 g/m2 (2024) but the 2017 DoP and the 2021 certificate give 350-800 g/m2. DoP-CPR-01002 spans 370-480 g/m2 while the certificate describes 370 g/m2 and the MPA specimen was 356 +/- 2 g/m2.
4. **Plasterboard.** The 2012 Efectis report (460 g/m2) was run on paper-faced plasterboard with a minimum A2 substrate. The Centexbel certificates and CREPIM and MPA fields exclude plasterboard. The Tapetex fields exclude paper-faced gypsum plasterboard.
5. **FR treatment and attestation system.** The vinyl DoPs say "FR treated" under system 1. The 2012 Efectis report says no flame retardant was needed and uses system 3.
6. **Generic reports filed under designs.** Colour Choice 1056 and Rainy 1058 carry the same 2012 Efectis report. The +print designs carry a plain white 350 g/m2 vinyl report. The +print ASTM E84 files carry a specimen called Kilby 171213, tested on fibre cement board with a US adhesive. The Colour Choice 1056 ASTM E84 file carries a client-described 20 oz Type II PVC specimen; the report does not name Colour Choice.
7. **Validity periods.** Certificates W014 and W015 state "latest on July 31st 2023"; CREPIM DO-18-0159 states 5 years from 21/08/2018; DO-20-1944 states 5 years from 26/06/2020. All of these dates have passed on their face by 15 Oct 2026. No successor document was found. This note does not treat a passed date as proof that the result is invalid, nor an undated Efectis report as proof that it is current.
8. **Cellulosic textile.** DoP-CPR-13001 (15 May 2020) declares B-s1,d0 for woven cellulosic textile from report 20209/A/B/C; the 2025 report on quality 70-2549 (cellulosic) gives B-s2,d0.
9. **Adhesive 2500.** The 2021 Vescom 2500 sheet says vinyl up to 370 g/m2; the 2025 general specification says digital printed wallcovering.
10. **Wording.** The vinyl technical sheet's heading "fire-resistant" refers to reaction to fire. It does not describe fire resistance.
11. **Outdated standards.** The 2012 Efectis report uses EN 13501-1:2007+A1:2009 and CPD; current Vescom reports use EN 13501-1:2018. BS 476 Class 0 or 1 claims: none found.

## 8. Gaps and questions to ask Vescom technical

1. Which classification report applies to Colour Choice+Protect 1126PRO? Does Vescom hold a report that includes the Protect laminate at about 460 g/m2?
2. Have certificates 0493-CPR-W014 and W015 (stated latest 31 July 2023) been replaced? Please send the current certificates and W023.
3. Are Albert, Kilby, Lismore, Melvin, Millwood and Nero +Protect covered by the Pleso + Protect report DO-20-1944? Has that report's 5-year period been renewed?
4. Which designs does Efectis 2023-R000709 (plain white 350 g/m2, Vescom 3000) cover, in particular the printed designs? Do embossed, coloured or heavier qualities need separate evidence?
5. Which products does Intertek 103662200SAT-001 (specimen Kilby 171213) cover?
6. Can Vescom state whether any fire report covers a wallcovering hung over an existing wallcovering (Vescom 3000 renovation use), over primer or paint, or over plasterboard?
7. Please supply the sub-reports not in the library: Efectis 2022-Efectis-R001208 and 2015 Efectis R000445, MPA 20180730/01 in full, ICL/H14/3410 and 3411, and the Efectis 2010-Efectis-R0933 and R0934.
8. Is there any UK national (BS 476) result for any Vescom wallcovering, or does Vescom rely on EN 13501-1 for UK use?
9. Is Tapetex BV a Vescom group company, and are the four Tapetex classifications intended to cover the Vescom textile range?
