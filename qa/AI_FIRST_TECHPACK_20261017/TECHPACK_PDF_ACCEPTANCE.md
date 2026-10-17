# Tech Pack PDF acceptance — **LOCAL_PDF_PASS** (remote: BLOCKED_ENV)

## How the PDF is produced
1. A frozen revision snapshot (`techpack_documents.snapshot_json`, SHA-256) is rendered to Arabic-first A4 HTML. Fonts are embedded as data URIs: Noto Naskh Arabic and Noto Sans, OFL licensed, with license files in `public/fonts/`.
2. `src/pdf_engine.js` sends that HTML over CDP to **Cloudflare Browser Rendering** through the `BROWSER` binding (`Page.printToPDF`, A4 from CSS `@page`, header with status, footer with page X / N). It has no npm dependency: `@cloudflare/puppeteer` was rejected because it pulls in 7 high-severity advisories through `@puppeteer/browsers`.
3. **DRAFT** PDFs are rendered on demand and labelled «مسودة غير معتمدة / DRAFT — NOT FOR PRODUCTION» on every page. **APPROVED** writes the exact bytes to R2 under `techpack/<style>/R<n>-<sha256>.pdf` and records their SHA-256, page count and size. Every download re-checks the hash and serves those bytes.
4. Without the binding, the API returns `503 PDF_ENGINE_UNAVAILABLE` naming the binding to add. HTML is never served as a PDF.

## Run used for this evidence
- **Server:** local `wrangler dev` (workerd, local D1 migrated 0001→0023, local Browser Rendering launched by Miniflare with Chrome for Testing).
- **Script:** `pdf_acceptance.mjs`.
- **Independent inspection:** poppler (`pdfinfo`, `pdffonts`, `pdftotext`, `pdftoppm`) and PIL ink coverage.
- **Log:** `raw/pdf_acceptance.log`, `raw/pdf_acceptance_results.json`.
- **Result: 19 / 19 PASS.**

| Document | Dataset | Pages | Status |
|---|---|---|---|
| `pdf/JK003_R1_DRAFT.pdf` | owner facts (bilingual), quantity matrix | 8 | DRAFT |
| `pdf/LONG_R1_DRAFT.pdf` | synthetic: 60 POM + 60 BOM + 60 operations | 22 | DRAFT |
| `pdf/SYNTH_R1_APPROVED.pdf` | synthetic complete shirt | 8 | APPROVED, sha256 `84f5c0081e2f28206f4cea9332603560177d7fa2a2fd29b482f05a7bd20a657e` |
| `pdf/ABAYA_R1_DRAFT.pdf` | weight-band abaya, concealed zip | 7 | DRAFT |

| Requirement | Check | Result |
|---|---|---|
| Real PDF bytes and type | file starts with `%PDF-`; `content-type: application/pdf` | PASS |
| A4, multiple pages | `pdfinfo`: 595×842 pt; 7–22 pages | PASS |
| Arabic shaping, fonts embedded | `pdffonts`: NotoNaskhArabic Regular/Bold and NotoSans Regular/Bold embedded as subsets; visual check of renders | PASS |
| Legible English | `pdftotext` extracts English section titles and values | PASS |
| No blank pages | PIL ink coverage above 0.4% on every page of every document | PASS |
| Long tables paginate; headers repeat | LONG: POM header ×6, BOM ×5, operations ×4; last rows X60/B60/op 60 present | PASS |
| Page numbers and footer | "Page k / N" on every page; status header on every page | PASS |
| No invented data | JK-003 BOM has no zipper; NO_TOLERANCE shown; material says CONSUMPTION_NOT_CONFIRMED | PASS |
| Frozen approved export | approval stores SHA-256; two later downloads are byte-identical; app page count = `pdfinfo` | PASS |
| Idempotent approval | a second approve returns the same hash | PASS |
| Category-specific content | abaya: WEIGHT_BANDS, WB-02, concealed zipper, S/M/L note | PASS |
| Other tenant's data | the preview HTML for one tenant contains no other tenant's name (TP-T04); every cross-tenant read is 403 (TP-S01) | PASS |

## Visual review (by the implementer, from `renders/`)
- **Cover** (`render_jk003_p1-1.png`): tenant heading, Arabic title with English subtitle, metadata table, reference image with rights and sha, DRAFT box listing open items in Arabic.
- **Draft vs approved:** `render_synth_p1-1.png` shows the APPROVED variant, which says approval is not a production authorization.
- **Other pages** (POM, BOM, operations, pattern/quantities, ledger): RTL tables, English as a secondary line, "مطلوب / Pending" in orange, repeated headers on long tables (`render_long_p3/p4`).
- **Fixed during review:**
  1. The status label was mis-positioned → moved into the PDF header.
  2. Arabic and English were mixed on one line in notes → English now on its own line.
  3. Open items were raw codes → Arabic labels.
  4. A free-text spec was duplicated → now printed once.

## Remote
- **REMOTE_PDF:** **BLOCKED_ENV**. No Cloudflare account or binding was used.
- **Owner action:** enable Browser Rendering on the account (plan/pricing per Cloudflare), keep `"browser":{"binding":"BROWSER"}` in `wrangler.jsonc`, apply migration 0023, deploy, then download one draft and one approved PDF to confirm on the real platform.
