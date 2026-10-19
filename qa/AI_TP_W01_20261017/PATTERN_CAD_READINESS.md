# Pattern / CAD readiness (W01) — **no cut-ready CAD**

## Readiness of drafting inputs (`GET /api/styles/:id/pattern-status`)
`patternReadiness()` reports whether the inputs a pattern engineer needs are present. It never generates geometry for a real garment and always returns `cutReady:false`.

| Input | Missing code |
|---|---|
| Tech Pack approval data | the approval blockers |
| Pattern measurements (`requiredFor` PATTERN, e.g. jacket SHOULDER, ARMHOLE, NECK_WIDTH, BACK_LENGTH, BUTTON_START) | `PATTERN_POM_MISSING:<code>` / `POM_BASIS_MISSING:<code>` |
| Ease: implicit for finished-garment values; explicit per width POM for body values; unknown basis | `EASE_RULES_NOT_DEFINED` |
| Seam allowances MAIN and HEM (mm, 0–60) | `SEAM_ALLOWANCES_NOT_CONFIRMED` |
| Base block | `BASE_BLOCK_NOT_SELECTED` |
| Grainline confirmation | `GRAINLINE_NOT_CONFIRMED` |
| Back photo (`TECHNICAL_BACK`) or owner back description | `BACK_VIEW_UNOBSERVED` |
| Always (W02 gate) | `PARAMETRIC_DRAFTING_ENGINE_NOT_VALIDATED` |

- **JK-003:** `BLOCKED_PATTERN_INPUTS` (E-D01) — back unobserved, seam allowances, ease, BUTTON_START and others missing.
- **Synthetic shirt** with every input plus a back photo: `INPUTS_COMPLETE__DRAFTING_ENGINE_PENDING`, still `cutReady:false` (E-D04).
- **Piece manifest:** fronts/sleeves as mirrored pairs (structure), grain TBC, `geometry:null` (E-D02). It is a list for review, not a cutting pattern.

## Geometry export prototype (`src/pattern_geometry.js`)
- Accepts only specs with `source: SYNTHETIC_FULLY_SPECIFIED`, unit mm, explicit polygon, per-edge seam allowance, cut quantity and grainline. Owner-photo sources, cm units, self-intersecting outlines, missing allowances or grainlines are rejected (E-G01).
- Cut line = sew line offset outward edge by edge with mitred corners (E-G02, E-G03).
- **SVG** in millimetres (width/height `mm` = viewBox), layers CUT/SEW/GRAIN/NOTCH, `data-cut-ready="false"` (E-G04).
- **DXF R12**, `$INSUNITS 4` (mm), closed POLYLINEs on CUT and SEW (E-G05).

### Sample: synthetic apron `SYN-APRON-01` (`geometry/`)
| Piece | Cut W×H (mm) | Cut area (mm²) | Sew area (mm²) |
|---|---|---|---|
| BODY (trapezoid, 25 mm hem) | 527.346 × 735 | 310 424.3 | 280 000 |
| POCKET | 220 × 215 | 47 300 | 36 000 |
| TIE ×2 | 920 × 80 | 73 600 | 54 000 |

Independent verification: **ezdxf 1.4.2** (third-party) read the DXF; every piece's bbox and areas match the manifest; SVG checked with the Python XML parser (`geometry/verify_with_ezdxf.py`, `raw/geometry_ezdxf_check.json`: PASS). The DXF has not been opened in a commercial CAD package — that is a W02 gate item.

## Not done (by rule)
No pattern for JK-003 or any real garment; no grading; no marker; no consumption.
