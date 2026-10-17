# Garment classification and adaptive questions

## Categories (data-driven: `GARMENT_CATEGORIES` in `src/garment_intake.js`)
Adding a new class means adding one registry entry; there is no per-garment `if`.

| Key | Sizing | Critical POM asked | Key specs | Notes |
|---|---|---|---|---|
| JACKET | XS–XXL | BODY_LENGTH, CHEST, BACK_WIDTH, SLEEVE_LENGTH, SLEEVE_WIDTH, SLEEVE_OPENING (+WAIST when fit = FITTED) | fit, closure, lining | check: sleeve opening ≤ sleeve width |
| TROUSERS | 28–40 | WAIST, HIP, FRONT_RISE, BACK_RISE, THIGH, INSEAM, LEG_OPENING | closure | check: leg opening ≤ thigh |
| SHIRT | XS–XXL | BODY_LENGTH, CHEST, SHOULDER, SLEEVE_LENGTH, COLLAR | collar style | |
| DRESS | XS–XXL | BODY_LENGTH, CHEST, WAIST, HIP | closure, lining | |
| ABAYA_KHIMAR | **weight bands** (no S/M/L) | LENGTH, WIDTH, SLEEVE_LENGTH, OPENING | closure (concealed zip…), base weight band | check: opening ≤ length |
| OTHER | manual | LENGTH, WIDTH | garment name | manual fallback |

Each POM carries Arabic/English names, the allowed basis (FLAT / CIRCUMFERENCE / LENGTH), a "why it matters" line and a typical range in cm (used only to flag likely unit slips, never to fill values).

## Plan rules (`questionPlan`)
1. **Category not confirmed** (AI hypothesis or UNKNOWN) → exactly one question, which offers the AI suggestion, its alternatives and every category. Answers are refused until confirmed (TP-Q01, TP-Q02, browser check).
2. **Basis:**
   - unit (cm/mm);
   - body vs finished garment;
   - base size, or the base weight band for weight-banded categories.
3. **Missing critical POM:** asked in groups of four. Values already present are never asked again (TP-Q04, TP-Q15).
4. **Flat vs circumference:** asked for each width measurement that has a value but no basis.
5. **Missing critical specs.**
6. **Flags:**
   - non-positive value;
   - outside the typical range (e.g. CHEST 560 cm → likely a unit slip);
   - contradiction (sleeve opening > sleeve width on the same basis).
   The owner corrects the value or explicitly confirms it. Changing a value clears its confirmation.

Pixel-derived dimensions are not implemented: there is no scale reference, and pixels are not dimensions.

## Evidence (`TEST_MATRIX.csv`, area QUESTIONS / VISION)
| Test | Check |
|---|---|
| TP-Q03 | jacket questions |
| TP-Q09 | trousers |
| TP-Q10 | shirt |
| TP-Q11 | abaya (weight band, no S/M/L options) |
| TP-Q12 | the owner overrides the AI (JACKET → DRESS) |
| TP-Q13 | UNKNOWN → manual fallback |
| TP-Q05–Q07 | flags and confirmations |
| TP-Q06 | stale version → 409 |
| TP-Q08 ×5 | invalid answers → 400 |

The browser check shows the same flow in Chromium (`screens/ui_step2_suggestion.png`, `screens/ui_step3_questions.png`).

All 20 QUESTIONS rows and 15 VISION rows pass.
