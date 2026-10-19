# Tech Pack PDF acceptance (W01)

## Result classes
| Path | Result in W01 | Note |
|---|---|---|
| App engine (`src/pdf_engine.js` over the `BROWSER` binding) under local `wrangler dev` | **BLOCKED_ENV in this container** | Miniflare's local Chrome refuses to start as root without `--no-sandbox`; disabling the sandbox was refused by the session's permission policy and was not worked around. The API answers `503 PDF_ENGINE_UNAVAILABLE` (row D11; before W01 this case was a generic 500). PR #6 proved this path as `LOCAL_PDF_PASS` (19/19) in an earlier container. |
| Approval commit logic (R2 put → D1 compare-and-set, failure cleanup) | **PASS (Node, injected failures)** | `commitApproval` rows E-C06…E-C09 |
| Frozen preview HTML → A4 PDF, independent Chromium (Playwright) | **INDEPENDENT_RENDER PASS** | `pdf_independent/*.independent.pdf`; header says it is not the app engine output |
| Remote Cloudflare Browser Rendering | **not exercised** (BLOCKED_ENV, no deploy) | — |

## Independent render checks (poppler + PIL, `raw/w01_browser_pdf_results.json`)
| Document | Pages | A4 | Fonts embedded | Blank pages | Content checks |
|---|---|---|---|---|---|
| `JK003_R1_DRAFT.independent.pdf` | 9 | 595×842 pt | Noto Naskh Arabic + Noto Sans | none (ink ≥ 1.57%) | back box, sign-off roles, DRAFT; no zipper in BOM; NO_TOLERANCE; `BLOCKED_PATTERN_INPUTS` |
| `KHIMAR0004_R1_DRAFT.independent.pdf` | 8 | 595×842 pt | same | none (ink ≥ 1.34%) | WEIGHT_BANDS, concealed zipper, `CONSUMPTION_NOT_CONFIRMED`, no GSM |

## W01 changes to the document
- In-document CSP (`default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'`) in addition to the response header; no script (E-C01).
- Cover: **front** reference and **back** reference boxes. Without a back photo the back is printed as `BACK: UNOBSERVABLE / REQUIRES_REVIEW` and never drawn (E-C02); a `TECHNICAL_BACK` photo replaces the box and marks Back VISIBLE (E-C05).
- Owner technical description (OWNER_ASSERTION) printed before and apart from the recognition hypothesis (E-C04).
- POM rows: landmark definition (AR/EN), pattern-only marker, explicit tolerance or NO_TOLERANCE.
- Components table: cut quantity (mirrored pairs from structure), fabric, grain TBC, evidence class; "not an approved cutting pattern".
- Pattern box: readiness + `cut-ready: NO`.
- Manual DESIGN / PATTERN / PRODUCTION / QC sign-off table stating it is not a digital signature or production authorization (E-C03).

## Approval safety (W01)
| Failure | Behaviour | Row |
|---|---|---|
| R2 put fails | 503 `PDF_STORAGE_FAILED`, revision stays DRAFT, no object | E-C06 |
| D1 write fails after the PDF was stored | 503 `APPROVAL_WRITE_FAILED`, object deleted, DRAFT | E-C07 |
| Concurrent approval loses the compare-and-set | replayed winner; loser's object deleted; one APPROVE audit | E-C08 |
| Download of an approved revision | frozen R2 bytes, hash checked | E-C09 |
| Storage reconciliation | orphan / missing / drift report; approver-only audited orphan cleanup | E-C10…E-C12 |
| Unexpected internal error | 500 `INTERNAL_ERROR` + ref, no SQL/path text | E-C13 |
| Browser binding cannot start a browser | 503 `PDF_ENGINE_UNAVAILABLE`, no launch text | E-C14 |
| Self-approval with `TECHPACK_SEPARATION_OF_DUTIES=1` | 409 `SELF_APPROVAL_FORBIDDEN` | E-B14 |

## Visual review (implementer, `renders/`)
Cover (front image, back UNOBSERVABLE box, DRAFT box with open items in Arabic) and the ledger page (completeness list, sign-off table) were inspected. Cosmetic open item: English/Arabic section titles touch without a gap (DEFECT_LEDGER D-08).

**Quick Actions:** the UI exposes preview, PDF download and approve per revision; approve stays disabled while the gate is open. No new quick action was added in W01.
