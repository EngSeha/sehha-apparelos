# JK-003 — construction record and questions for the owner

Source of every fact below: the owner's written notes and values (`JK003` fixture). Nothing is taken from a model or inferred from the photograph's pixels.

## Owner-asserted facts
- Women's jacket, charcoal, mohair-look surface; fitted waist; simple raised collar.
- Closure: 4 gold buttons on an angled, asymmetric front; upper front overlaps, lower front edge-to-edge; **no zipper**.
- Full lining, 2 cm shorter than the shell; shell turns back 2 cm onto the lining.
- First button 5 cm from the defined edge, then every 10 cm — **pending confirmation of the reference points**.
- M values (cm): back width 44, body length 57, chest 56, sleeve length 62, sleeve width 38, sleeve opening 30.

## What the system now does with them
| Area | Result |
|---|---|
| Tech Pack gate | DRAFT; blocked by measurement basis (body vs finished), flat-vs-circumference for chest / sleeve width / sleeve opening, waist (required because fit = FITTED) |
| BOM | shell, interfacing, thread, label, full lining, buttons ×4 — all PROPOSED; no zipper; no consumption, supplier or price |
| Components | Fronts / Back / Sleeves = GEOMETRIC_RULE (no tagged front or back photo); Back carries `BACK_UNOBSERVED_SHAPE_REQUIRES_REVIEW`; collar and lining = OWNER_ASSERTION |
| Tolerances | only where typed (test: CHEST ±1); everything else NO_TOLERANCE |
| Pattern readiness | `BLOCKED_PATTERN_INPUTS` (see below); cut-ready: NO |

## Questions only the owner (or the pattern engineer) can answer
1. Are the six values **finished-garment** or **body** measurements?
2. Chest, sleeve width, sleeve opening: **flat width** or **full circumference**?
3. Waist value and where it is measured (distance from HPS).
4. Button positions: the reference point for "5 cm", and for an angled closure the position of **each** button (HPS → centre).
5. Back: a back photo, or a written description (vents, seams, darts, length at centre back).
6. Shoulder width, armhole (curve or depth), neck width, back length.
7. Seam allowances (main and hem, mm), base block to use, grainline confirmation.
8. Fabric: composition, weight and shrinkage come from a lab or supplier sheet — they are not read from the photo.
9. Lining: fabric, and whether "2 cm shorter / 2 cm turn-back" applies at hem only or also at sleeves.
10. Size run and grade rules (explicit deltas per size); without them no graded values are shown.
