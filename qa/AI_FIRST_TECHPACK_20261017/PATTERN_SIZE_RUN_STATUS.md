# Pattern, size run and quantities

## Pattern / CAD — **PATTERN_PENDING** (deliberately not built in this run)
The directive puts the PDF first and asks for no bogus patterns, so no geometry, SVG or DXF is generated. `GET /api/styles/:id/pattern-status` and the PDF's pattern page list the exact gaps:

| Gap | Meaning |
|---|---|
| intake blockers (e.g. `POM_BASIS_MISSING`, `CRITICAL_POM_MISSING`) | measurements and their basis are not complete |
| `BASE_BLOCK_NOT_SELECTED` | no base block for this category is chosen or approved |
| `EASE_RULES_NOT_DEFINED` | body vs garment ease is not defined |
| `SEAM_ALLOWANCES_NOT_CONFIRMED` | seam and turn allowances are TBC |
| `PARAMETRIC_DRAFTING_ENGINE_NOT_VALIDATED` | no drafting engine exists yet, and so no independent DXF/SVG parse |

**Owner decisions needed before the pattern gate:**
- choose a base block per category;
- set ease rules;
- set seam allowances;
- set landmark definitions;
- choose the size standard to grade from.

## Grading — explicit rules only
The PDF shows graded columns only from existing approved `grading_rules` (`gradeMatrix`). Missing rules leave only the base size, with a warning. There is no interpolation and no auto-grade. Abaya/khimar stays weight-banded: the base is a weight band (e.g. `WB-02`) and S/M/L is never imposed.

## Size × colour quantity matrix — implemented (planned demand)
- **Entry:** sizes, colours and whole-number quantities per cell. Rejected with 400: duplicates, cells outside the matrix, negative or non-integer values.
- **Totals:** exact totals per size, per colour and overall (e.g. M 50 + L 70 = 120; TP-T08, JK-003 PDF).
- **Material requirement** = approved per-unit quantity × total. Only APPROVED BOM rows with a quantity count (TP-T09: 1.8 m × 120 = 216 m). Every other row shows `CONSUMPTION_NOT_CONFIRMED`.
- **Not assumed:** waste %, marker efficiency, roll width, nap/direction. There is no marker or nesting preview yet.
- **Labelled as demand:** quantities are planned demand (`planned`), never production actuals.

## Factory — not touched
Factory phase comes after an approved technical release, an accepted handoff and PR #5's independent security acceptance. An approved Tech Pack is a design specification, not a production authorization (stated on the approved cover). No route here writes to releases, handoffs or lots.
