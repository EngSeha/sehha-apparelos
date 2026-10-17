# JK-003 review (owner-supplied design facts, not model vision)

**Source:** the directive §F text. The owner photo is not in Claude Cloud and live vision is not bound, so **LIVE_JK003 = BLOCKED**. The test image is a generated silhouette PNG.

| Fact | How the system holds it |
|---|---|
| Women's charcoal mohair-appearance jacket | Category JACKET: mock suggestion from the owner's text (LOW), then OWNER_CONFIRMED. Mohair is stated as *appearance* only; composition is not verified. |
| Fitted waist | spec `fit=FITTED`, which makes **WAIST a required POM**. It was not supplied, so it shows as «مطلوب / Pending». |
| Simple raised/turned collar | spec `collar` (free text) |
| 4 gold buttons, asymmetric diagonal closure, NO zipper | `closure=BUTTONS`, `button_count=4`, `closure_detail` text. BOM: buttons qty 4 (PROPOSED). **No zipper row** (TP-T02, PDF check "no zipper invented"). |
| Upper front overlaps diagonally, lower front edge-to-edge | kept in `closure_detail`. No geometry is generated (pattern pending). |
| M: back 44, length 57, chest 56, sleeve 62, sleeve width 38, opening 30 cm | stored as OWNER_SUPPLIED, state DRAFT. Basis is **not** confirmed: flat vs circumference is asked for CHEST, SLEEVE_WIDTH and SLEEVE_OPENING, and body vs finished garment is asked. |
| Lining 2 cm shorter; body turns 2 cm onto lining | `lining=FULL` plus the owner notes. Seam/turn allowances stay TBC in operations. |
| First button 5 cm, then 10 cm spacing | recorded as pending, with landmarks unconfirmed |

## Result
- **Draft R1:** a real 8-page A4 PDF (`pdf/JK003_R1_DRAFT.pdf`, rendered pages in `renders/render_jk003_*.png`).
- **Status:** **DRAFT, approval blocked** (`TECHPACK_GATE_BLOCKED`). Open items:
  - body vs garment basis;
  - flat/circumference for 3 widths;
  - WAIST.
- **Pattern:** PATTERN_PENDING. No production-fit pattern is promised from one photo.

To approve JK-003, the owner must supply the waist, confirm the basis and landmarks, and confirm or adjust the button spacing. The system then allows approval and freezes the PDF.
