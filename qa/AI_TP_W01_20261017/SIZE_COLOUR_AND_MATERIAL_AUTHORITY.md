# Size × colour quantities and material authority

| Rule | Implementation | Evidence |
|---|---|---|
| Quantities are planned demand, not production actuals | `answers.quantityMatrix` {sizes, colours, cells}; printed with "Planned demand, not production actuals" | PR #6 TP-T09; W01 E-B13 |
| Whole numbers ≥ 0 only; cells must lie inside the declared sizes/colours; no duplicates | `validateQuantityMatrix` → 400 | PR #6 tests |
| Weight-band garments use the owner's band labels, never S/M/L | khimar 0004 matrix `WB-TEST-1/2 × BLACK` = 100 | E-B13, M1 |
| Material requirement = approved per-unit consumption × total only | rows without an APPROVED BOM quantity → `CONSUMPTION_NOT_CONFIRMED` | E-B13, P5 |
| No assumed waste, marker efficiency, GSM, price or currency | none in code; PDF text check for GSM | P5 |
| Grading only from explicit grade rules; missing = Pending | unchanged from PR #6 (`gradeMatrix`) | PR #6 |
| Production lots / factory quantities | **not opened in W01** — factory release stays BLOCKED until the independent PR #5 re-gate | — |
