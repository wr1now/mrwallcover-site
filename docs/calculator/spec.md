# Wallpaper calculator: the maths

Status: **signed off by the owner**, 14 October 2026. Revised after a review of eleven other calculators, operated on 14 October 2026 (kept in the owner's private research archive).
Rules marked *(owner)* were confirmed by the owner on diagrams on 14 October 2026. Figures marked *(data sheet)* are copied from the maker's sheet, with the source in `src/data/wallpapering.json`.

The calculator gives an **order quantity**. It is not a set-out: half-drop papers and murals are still set out on site. It never shows an installation price.

---

## 1. What it counts, and what it sends to us

It counts:

- one wall, several walls, or a whole room
- free match, reverse hang, straight match, half-drop, ⅓ drop and ¼ drop
- doors, windows and other openings, with or without reveals
- chimney breasts and alcoves (returns)
- niches
- rolls, US double rolls, bolts, paper sold by the metre or yard, and made-to-measure murals sold by the m²

It gives **no count**, and sends the visitor to "Send us your measurements", for:

- stairs and stairwells
- sloping ceilings and walls
- curved walls
- papered ceilings *(owner)*
- scenic and panel sets (ordered by panel from the elevations)
- any drop that will not fit on one roll after the pattern-start loss

A made-to-measure mural gets its order size (section 7.5) **and** the request button *(owner)*.

---

## 2. Inputs and defaults

| Input | Default | Notes |
| --- | --- | --- |
| Units | centimetres | Metres, inches and feet are converted on entry. The engine works in whole millimetres. |
| Height to paper | — | From the top of the skirting to where the paper stops: the ceiling, the cornice or the picture rail *(owner)*. |
| Usable roll width `w` | 53 cm | Nominal width less any overlap or selvedge the maker prints. Any width is accepted, typed in cm or inches *(owner, 17 Oct 2026: 45, 55, 68, 80, 90 cm, 1 m and more)*. For paper sold by the metre or yard, the overlap at each joint is its own field (Muraspec prints 5 cm), and `w` = width − overlap. |
| Roll length `L` | 1005 cm | Typed in metres, feet or yards. |
| Roll size presets | Standard roll, 53 × 1005 cm | `src/data/roll-formats.json`: grouped by how the paper is sold (rolls, US double rolls, sets, bolts, by the metre, by the yard, murals, panel sets). Each preset is a size a maker prints, with the maker's page as its source. Every group also has "Another size", and typing over a preset moves the list to it. |
| Pattern repeat `R` | 0 (none) | |
| Match | free | free, reverse hang, straight, half-drop, ⅓ drop, ¼ drop |
| Trim | 5 cm top + 5 cm bottom, so `t` = 10 cm *(owner)* | Added to every piece, short pieces included. |
| Pattern-start loss | one full repeat `R` at the start of every roll *(owner)* | 0 for free match and reverse hang. |
| Spare | 1 roll (or 1 bolt, 1 double roll), on its own line *(owner)* | For paper sold by length, see 7.4. |

If the visitor doesn't know the wallpaper, the defaults above are used and the result says so.

---

## 3. Running width

**One wall:** `run = wall width + every return depth on that wall`.

**Several walls entered one by one:** each wall is its own run and is rounded up on its own.

**Whole room** (floor length × floor width, plus ceiling height): one run round the room *(owner)*:

```
run = 2 × (length + width) + every return depth
```

**Returns** (each side of a chimney breast, each side of an alcove): the depth is added to the run *(owner)*. The wall width is measured straight across, corner to corner.

```
Example: alcove 90 + breast 150 + alcove 90 = 330 cm across, two returns of 35 cm
run = 330 + 35 + 35 = 400 cm
```

---

## 4. Drops and cut length

```
drops N = ceil(run ÷ w)
height of one drop h = wall height + t
```

Each drop has a **phase**: the point in the pattern where its cut starts.

| Match | Phase of drop i (i = 0, 1, 2 …) | Distance between drops cut from one roll |
| --- | --- | --- |
| free, reverse hang | none | `h` |
| straight | 0 | `ceil(h ÷ R) × R` |
| half-drop | 0, R/2, 0, R/2 … | depends on the order of cutting (section 6) |
| ⅓ drop | 0, R/3, 2R/3, 0 … | depends on the order of cutting |
| ¼ drop | 0, R/4, R/2, 3R/4, 0 … | depends on the order of cutting |

For straight match this is the familiar "cut length rounded up to whole repeats". The **last** drop on a roll only needs `h`, not the rounded length.

---

## 5. Openings, reveals and niches

### 5.1 Drops over an opening (best case) *(owner)*

```
k = floor(opening width ÷ w)
```

`k` drops sit wholly over the opening. They become short drops instead of full drops. The drops either side still run full height and are cut round the opening.

- **Door or opening** (from the floor): one short drop above each of the `k` drops, `A + t` long, where `A` = ceiling to the top of the opening.
- **Window:** a short drop above (`A + t`) and one below (`B + t`, where `B` = sill to floor) for each of the `k` drops.

A short drop keeps the pattern of the drop it replaces. The piece below a window starts lower down the wall, so its phase is the drop's phase plus `(height − B)`, measured in the pattern.

### 5.2 Reveals *(owner)*

The owner's "reveal length" is the whole reveal down one side: its depth `d` and its height.

- **Each reveal side** adds one part-drop:
  ```
  P = ceil(1.3 × (A + d) ÷ R) × R     (free match: rounded up to the next whole cm)
  ```
  The window's height does not change it.
- **Head reveal:** the short drops above turn under into the head, so they are `A + d + t` long.
- **Sides only** (no head reveal): the same `P` per side; the short drops above stay `A + t`.

```
Worked: A = 40, d = 20, repeat 65.  1.3 × 60 = 78 → 2 repeats = 130 cm per side, 260 cm per window.
Short drop above, with head reveal: 40 + 20 + 10 = 70 cm.
```

### 5.3 Niches *(owner)*

A niche is a window with reveals on all four sides, plus its back:

- `k = floor(niche width ÷ w)` drops over it, each with a short drop above (`A + d + t`) and below (`B + d + t`)
- one part-drop `P` per side, as in 5.2
- the back is a small wall of its own: `ceil(niche width ÷ w)` pieces, each `niche height + t`

### 5.4 Alcoves and chimney breasts

Floor-to-ceiling alcoves and chimney breasts only add their return depths to the run (section 3).

---

## 6. The cutting plan

The engine cuts every piece from rolls, in this order, and records where each cut falls.

1. **Start of a roll.** The first cut on a new roll starts one full repeat in (`R`), the worst case for finding the pattern start *(owner)*. Free match starts at 0.
2. **Next cut on the same roll.** It starts at the next point on the roll where the pattern matches the phase that piece needs. It needs only its own length, so the last drop on a roll is never rounded up.
3. **Full drops** are cut in order along the current roll. When the next one doesn't fit, it is cut from an earlier offcut if one is long enough and the pattern lines up *(owner)*; otherwise a new roll is opened, and what is left of the old roll becomes an offcut.
4. **Short drops, part-drops and niche backs** are cut from offcuts when the pattern lines up *(owner)*. Longest piece first; each goes to the offcut it fits with the least left over. If no offcut fits, it is cut from the current roll, or a new one.
5. **Offset matches** (half-drop, ⅓, ¼): the engine works the plan both ways and keeps the one with fewer rolls *(owner)*:
   - **in drop order:** drops 1, 2, 3 … cut in turn along the roll
   - **phase by phase:** all drops of one phase, then the next, carrying on along the same roll (the same waste as cutting odd and even drops from two rolls)

   If both need the same number of rolls, it keeps drop order.
6. **Maker override, no offcut infill.** Some makers say pieces must be cut and hung in the sequence they come off the roll (Muraspec: "do not in-fill with off cuts or out of sequence drops"; Phillip Jeffries vinyl: apply material above doors and windows as it comes off the roll). For those products, every piece is cut in drop order and offcuts are not reused.

`rolls used` = the number of rolls the plan opens. `drops per roll` (shown on the result) = the full drops that fit on a new roll. The plan says what was allowed at the start of each roll, for example "65 cm allowed at the start of each roll to find the pattern" *(owner)*.

### The owner's example, cut

```
Roll 1: [65 lost][drop 1: 275][50][drop 2: 275][50][drop 3: 275][10]   65 + 325 + 325 + 275 = 990
Roll 2: [65 lost][drop 4: 275][50][drop 5: 275][ offcut 335 ]
```

---

## 7. What to order

Every result says: **order every roll, the spare included, from one batch**, and check the batch number on every roll before anything is cut.

The result opens with three lines *(owner)*, so the spare is never missed:

```
Working rolls: 2      (the cutting plan)
Spare roll:    1      (same batch, for a damaged length or a later repair)
Order:         3 rolls
```

### 7.1 Rolls

```
working rolls = rolls used
spare         = 1 roll
order         = working rolls + spare
```

### 7.1a Sets

Where the maker sells only in sets (for example a pair of rolls), working rolls are rounded up to whole sets and the spare is one set *(owner)*.

### 7.2 US double rolls

The product's double-roll width and length are used in the cutting plan. US papers are priced by the single roll and packed in double rolls (Thibaut FAQ; Wallcoverings Association), so the result reads "N double rolls (2N single rolls as priced)". The spare is 1 double roll.

### 7.3 Bolts

A bolt is cut like a roll, with the bolt length as `L` (for example Phillip Jeffries Manila Hemp: 36 in pre-trimmed, 8-yard bolt). The spare is 1 bolt. Where the maker prints a minimum order, the order is raised to it.

### 7.4 Sold by the metre or yard (wide-width contract)

Where the maker publishes its own ordering rule for paper sold by length, that rule is used (maker first). Otherwise the plan is cut from one continuous length (one pattern-start loss), split into pieces no longer than the maker's roll (for example Muraspec: 130 cm × 30 m, "Per linear metre").

```
length = where the last cut ends
order  = ceil(length ÷ unit) metres or yards, raised to the maker's minimum
spare  = one more drop, rounded up to whole units, on its own line   (owner)
```

### 7.5 Made-to-measure murals (per m²) *(owner)*

```
order width  = wall width + the margin the maker asks for
order height = wall height + the margin the maker asks for
order area   = width × height, in m²
```

The margin comes from the maker's page (for example Rebel Walls: 10 cm; Photowall: 6–10 cm). The visitor types it in; the calculator does not guess it. The result then offers "Send us your measurements".

### 7.6 Scenic and panel sets

No figure. Straight to "Send us your measurements".

---

## 8. Materials

All quantities use **only** coverage printed on the product's own data sheet. Where the sheet says "approx." or gives a range, the result keeps that word or range.

### 8.1 Area

```
area = Σ (run × height)
       − Σ (opening width × opening height)
       + reveal faces (2 × d × opening height for sides, d × opening width for a head)
       + niche reveals
```

### 8.2 Primer

- **Default:** Zinsser Gardz *(owner)*. Coverage "Approximately 9 - 11m2/ litre" *(data sheet)*; one coat, and the sheet says skim-coated or textured surfaces "may require a second coat".
  ```
  litres = area × coats ÷ 11  to  area × coats ÷ 9
  ```
- **The maker names a primer:** that primer replaces Gardz *(owner)*.
- **Wall condition** adds treatments *(owner)*: stain block when there are stains (the Gardz sheet itself says to seal stains with a Zinsser stain-killing primer-sealer first); alkali-resisting primer on cement render and blockwork. Damp marks go to "Have Mr Wallcover check this", because the cause has to be found first.

### 8.3 Lining paper

- **Brand:** Erfurt *(owner)*. Grade by wall condition, from Erfurt MAV's own grade pages (800 new plaster … 2000 severely damaged). If the wallpaper maker names a grade, the maker's grade wins (for example de Gournay: 1000 or 1200; Cole & Son: 800 or 1000).
- **Hung across** (cross-lined) by default, because the owner says lining is usually cross-lined and most makers who mention it ask for that. Hung vertically when the maker asks for it; the engine counts both ways. Across is the default *(owner)*.
- **Rolls:** counted like the wallpaper, as horizontal courses, so no waste percentage is invented:
  ```
  courses per wall = ceil(height ÷ lining width)
  each course      = wall width + t
  rolls            = cutting plan of all courses (free match)
  ```
  Hung vertically, it is counted like a free-match wallpaper: `ceil(run ÷ lining width)` strips of `height + t`.
  No spare roll is added for lining. The batch does not matter, but **every lining roll must be the same product and grade, so the same thickness and the same shade of white** *(owner)*. The result says so.

### 8.4 Pastes, and the one-grade-stronger rule

The owner's ladder *(owner)*:

| Step | Grade |
| --- | --- |
| 1 | Light |
| 2 | Medium |
| 3 | Heavy |
| 4 | Extra-heavy (the owner also says "special heavyweight") |

- **Lining paste:** Wallrock Power Adhesive *(owner)*, step 4. "1Kg per 5m2" *(maker's page)*, so `kg = area ÷ 5`, in 5 kg and 10 kg tubs. Not for thermal or insulating liners, which take Wallrock Thermal Liner Adhesive (out of scope for the calculator: routed to a check).
- **Wallpaper paste:** the one the wallpaper maker names, with its step. Where the maker gives none, the hub says woven goods (grasscloth, fabric, hessian, linen) go up with a Medium-grade paste *(owner)*; the calculator does not ask for the wallcovering type.
- **Rule:** the lining paste must be at least one step above the wallpaper paste. If the wallpaper paste is already step 4, there is no step above, and the result says so and shows "Have Mr Wallcover check this".
- **Maker override** *(owner)*: when the maker says the lining goes up with the same paste as the wallpaper (de Gournay), the maker wins, and the result says that the maker's instruction replaces the house rule.
- **Vinyl-over-vinyl adhesive (VOV)** *(owner, the label used on the site)*: on a sealed, non-porous surface (gloss paint, an existing vinyl) the paper goes up with a VOV adhesive, chosen for the surface and not stepped on the ladder. The calculator's wall question has an answer for it ("Gloss paint or old vinyl"); the result names the maker's own VOV adhesive where there is one (Muraspec: Murabond Sealed Surface; Tektura: Tekfix VOV; Vescom: Vescom 3000), otherwise a VOV adhesive chosen with the maker's instruction, and always offers "Have Mr Wallcover check this".
- **Wallpaper paste quantity:** from the maker's printed coverage (for example Cole & Son: "1 kilo of paste per standard roll"). Where nothing is printed, the result names the paste and gives no quantity.

---

## 9. Lines on every result

- working rolls, spare roll and order at the top, then "How we worked it out" with the cutting plan, then materials
- a **close-call warning** *(owner)* when 1–5 cm more height, or 1–5 cm more width, would add a working roll: "4 cm more height would make this 3 working rolls. Measure twice." The engine re-runs the plan at each extra centimetre and reports the smallest change.
- "Order every roll, including the spare, from one batch"
- "Hang the first three drops, then stop and check the shade and the match in daylight" (Phillip Jeffries accepts no claims once more than 3 strips are cut and hung)
- "This is an order quantity, not a set-out"
- **Have Mr Wallcover check this** and **Send us your measurements** (pre-fills `/contact/?intent=install`, or `intent=source` when the visitor hasn't chosen a paper yet)
- no price

---

## 10. Test table

Every row is a test in `tests/quantity.test.ts`. Sizes in cm. "Spare" is always 1 unit on its own line unless the row says otherwise.

| # | Case | Inputs | Expected |
| --- | --- | --- | --- |
| 1 | **Owner's example** | wall 230 × 265; roll 55 × 1000; repeat 65 straight | 5 drops; cut 325; 3 drops per roll; **2 rolls + 1 spare** |
| 2 | Free match | wall 400 × 240; roll 52 × 1000 | 8 drops; cut 250; 4 per roll; 2 rolls |
| 3 | Page worked example | wall 500 × 270; roll 53 × 1005; free | 10 drops; cut 280; 3 per roll; 4 rolls |
| 4 | Straight, 64 repeat | wall 400 × 240; roll 52 × 1000; repeat 64 | 8 drops; cut 256; 3 per roll (64 + 256 + 256 + 250 = 826, a 4th starts at 832 and ends at 1082); 3 rolls |
| 5 | Half-drop, owner's wall | as row 1, half-drop | 5 drops; drop order: roll 1 cuts at 65, 357.5, 650; 2 rolls |
| 6 | Half-drop, phase by phase wins | wall 300 × 280; roll 52 × 1000; repeat 52 half-drop | 6 drops of 290. Drop order: 2 per roll, 3 rolls. Phase by phase: 3 per roll (52, 364, 676), **2 rolls** |
| 7 | Half-drop, both ways tie | wall 300 × 280; roll 52 × 1000; repeat 65 half-drop | 6 drops of 290. Drop order: cuts at 65, 357.5, 650 on each roll, **2 rolls**. Phase by phase: also 2, because roll 1's offcut takes a drop at 682.5. A tie keeps drop order |
| 8 | ⅓ drop | wall 300 × 250; roll 52 × 1005; repeat 63, ⅓ drop | 6 drops of 260; roll 1 cuts at 63, 336, 609; 2 rolls |
| 9 | Whole room, one run | room 400 × 350, height 270; roll 53 × 1005; free | run 1500; 29 drops; 3 per roll; 10 rolls |
| 10 | Two walls entered separately | walls 110 × 240 and 110 × 240; roll 52 × 1000; free | 3 + 3 = 6 drops (one run would be 5); 2 rolls |
| 11 | Chimney breast | 330 across + returns 35 + 35, height 265; roll 55 × 1000; repeat 65 | run 400; 8 drops; 3 rolls |
| 12 | Door saves a roll | wall 350 × 270; roll 53 × 1005; free; door 80 × 198 | 7 strips: 6 full + 1 short of 82 cut from roll 1's offcut (at 840); **2 rolls** (3 without the door) |
| 13 | Window with reveals | wall 400 × 265; roll 55 × 1000; repeat 65; window 120 wide × 135, sill 90, depth 20, sides + head | 8 strips: 6 full + 2 over the window. Pieces: 2 part-drops of 130, 2 above of 70, 2 below of 100. Rolls 1–2: 3 full each, 10 cm offcuts. Roll 3: 130 at 65, 130 at 195, 100 at 370, 100 at 500, 70 at 650, 70 at 780. **3 rolls** |
| 14 | Niche | wall 300 × 250; roll 53 × 1005; free; niche 60 × 80, 100 below the ceiling, 70 above the floor, depth 15 | 5 full + 1 over the niche. Pieces: part-drops 150 + 150, above 125, below 95, back 90 + 90. **3 rolls** (2 without the niche) |
| 15 | No offcut infill (Muraspec type) | wall 600 × 270; usable width 125; per linear metre; door 130 × 200 | 4 full + 1 short of 80, cut in drop order; length 1200 cm; **12 m** + spare 3 m (one drop) |
| 16 | US double roll | wall 400 × 240; double roll 20.5 in × 33 ft (52.07 × 1005.84); free | 8 drops; 4 per roll; **2 double rolls (4 single rolls as priced)** + 1 spare double roll |
| 17 | Bolt | wall 300 × 260; 36 in × 8 yd bolt (91.44 × 731.52); free | 4 drops of 270; 2 per bolt; **2 bolts** + 1 spare bolt |
| 18 | Mural per m² | wall 350 × 260; maker margin 10 | order 360 × 270 = **9.72 m²**, then the request button |
| 19 | Refusals | stairs, sloping ceiling, curved wall, ceiling, panel set | no count; request button |
| 20 | Drop too long | wall 400 × 990; roll 53 × 1005; repeat 64 | 64 + 1000 > 1005: no count; "Have Mr Wallcover check this" |
| 21 | Bad input | width 0, negative width, roll length 0, negative trim, straight match without a repeat | an error message, no count |
| 22 | Primer | row 1 wall: 230 × 265 = 6.10 m² | Gardz 0.55–0.68 litres, 1 coat |
| 23 | Lining | row 1 wall, Erfurt 53 × 1000 | 5 courses of 240; 4 per roll; **2 rolls**; Wallrock Power 6.10 ÷ 5 = 1.22 kg → one 5 kg tub |
| 24 | Paste rule | wallpaper paste step 2, lining Wallrock Power (4) | passes |
| 25 | Paste rule, no step above | wallpaper paste step 4 | "no stronger lining paste": Have Mr Wallcover check this |
| 26 | Paste rule, maker override | de Gournay | lining paste = the wallpaper paste, with the note that the maker's instruction replaces the house rule |
| 27 | No price | any result | contains no "£" |
| 28 | Walls of two heights share rolls | wall 230 × 265 and wall 110 × 120; roll 55 × 1000; repeat 65 | 5 drops of 275 and 2 of 130. Roll 2 carries drops 4–5, then both 130 cm drops at 715 and 845. **2 rolls** |
| 29 | Close call | as row 1, height 272 | 2 working rolls, and "4 cm more height would make this 3 working rolls". At height 275 it says 1 cm. At 276 the plan needs 3 |

Rows 6, 7, 13, 28 and 29 were worked by hand and checked against a scratch model of the cutting rules on 14 October 2026.

---

## 11. Still to confirm

1. **Calibration:** the original launch condition was 5–10 real past jobs with the rolls actually used. On 17 October 2026 the owner explicitly waived this condition and authorised publication after CI passes. That comparison has not been completed; no real-job calibration is claimed.
2. **Wallpaper pastes:** the owner's tested makers are Vescom, Tektura, Muraspec, Beeline, Albany and Roman. Each product goes on the ladder once its data sheet is checked and the owner confirms its step.

## Implementation review — 17 October 2026

See [the calculator review](review-2026-10-17.md). The implementation rejects nonrepresentable dimensions and plans beyond 2,000 pieces with a measurement/check request. Shared links preserve unit conversion precision. Paste strength is a house scale; unknown combinations and product/backing exclusions require confirmation, and per-roll coverage is applied only to compatible sourced roll formats. These validation changes are software verification. The separate owner waiver above records the release decision without asserting real-job calibration.
