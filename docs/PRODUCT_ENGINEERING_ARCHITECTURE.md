# Product engineering foundation (schema 18)

This additive layer extends Preview 21 without rewriting its style, POM, BOM, sample, costing, lot, or release records. `0016_engineering_foundation.sql` adds style identity, fabric specifications, trim specifications, pattern piece specifications, marker plans, routing steps, factory stages, and an append-only engineering revision log. Existing style rows remain intact on a schema 17 → 18 upgrade. `src/worker.js` refuses API requests until D1 reports schema 18.

## Domain ownership and provenance

Every engineering record is scoped by `style_id`. Routes resolve the Style first and require membership in its organization. Codes are validated, and style references such as marker → fabric and pattern material → fabric must resolve within the same Style. New records begin in `DRAFT`; values marked `TBC`, `UNKNOWN`, or `NOT PROVIDED` cannot pass the field completeness check for approval. An approved record requires a reason to reopen; the next revision returns to `DRAFT`. `engineering_revisions` records the old and new values, user, time, and reason. Existing Preview 21 style versions and frozen releases continue to use their original snapshot model.

`GET /api/styles/:id/engineering` assembles the Digital Twin. It includes a readiness checklist and explicit blockers. Its `ELIGIBLE_FOR_MANUAL_RELEASE_REVIEW` result is advisory. The Preview 21 production release gate is **not yet wired to this checklist**; this is a product blocker before a pilot. Direct PATCH of a Style to `PRODUCTION_READY` or `PRODUCTION_RELEASED` is rejected.

## API

| Route | Behavior |
| --- | --- |
| `GET /api/styles/:id/engineering` | Style-scoped engineering record, revisions, routing validation, readiness |
| `PUT /api/styles/:id/engineering/identity` | Brand/customer/season/collection/category and approval state |
| `PUT /api/styles/:id/engineering/{fabrics,trims,patterns,markers,routing,stages}/:code` | Validated create or revision of an engineering record |
| `POST /api/styles/:id/engineering/stages/initialize` | Idempotently creates the 31 canonical workflow stages as `NOT_STARTED` |
| `GET /api/styles/:id/engineering/consumption/:markerCode?quantity=N` | Calculates marker count and fabric requirement, labeled `CALCULATED` and `REQUIRES_REVIEW` |
| `GET /api/styles/:id/engineering/techpack?lang=ar\|en\|bilingual` | Dynamic print-ready A4 HTML Tech Pack |
| `GET /api/styles/:id/engineering/export?domain=fabrics&format=CSV` | Style-scoped CSV or JSON export for a supported domain |
| `POST /api/styles/:id/engineering/import-preview` | Configurable column mapping and CSV/JSON staging validation; no database mutation |

`import-preview` accepts `{domain,format,mapping,csv}` for CSV or `{domain,format,mapping,rows}` for JSON. `mapping` maps canonical fields to source column names, for example `{"code":"Fabric code","nameEn":"English name"}`. It checks missing and duplicate codes and returns a reconciliation preview. `FactorySpreadsheetImporter` operates on parsed rows, so an XLSX parser can feed the same staging contract after the actual workbook arrives. XLSX parsing, import commit, and XLSX export are not implemented. CSV export escapes quotes and neutralizes spreadsheet formulas.

## Calculations and pattern model

`pattern_piece_specs` holds piece/size, cut quantity, material, grain, nap, seam allowance, notches, annotations, points, edges, mirror/pair rules, and fold line. The geometry is a versioned JSON contract for a future pattern geometry engine and renderer. It is not CAD, DXF, AAMA, ASTM, or a graded pattern generator. Existing POM grading remains in `grading_rules`; calculated values are not promoted to approved measurements automatically.

Marker consumption reads its fabric specification. It validates the size ratio, marker length, plies, usable width, and one-way direction constraint. For an entered production quantity it computes garment capacity per marker, marker count, net length, and purchase length after waste, defects, and warp shrinkage. The result remains a calculation pending human review. Marker layout optimization, plaid/stripe matching geometry, and booking integration are still open.

## Roles and factory workflow

Owners and platform admins may approve engineering records. Design/pattern masters may approve technical identity, fabric, trims, pattern, and marker records. Factory supervisors may approve routing steps but cannot complete final QC or RELEASE stages; those require QC Manager and Release Manager respectively. A rejection requires a reason. The stage initializer never marks work complete and preserves existing rows. The 31 stages run from `STYLE_RECEIVED` through `RELEASE`, with explicit `NOT_APPLICABLE` available where a stage does not apply.

## Tech Pack and UI

The Engineering Center in Style Details shows the readiness blockers, data editors, revision history, consumption calculation, and output links. The new composer builds only sections for records that exist, splitting long tables into additional A4 pages. It prints Style Code, revision, and page numbers; it HTML-escapes entered text and displays missing values as `TBC`. Its Arabic, English, and bilingual modes use RTL/LTR. Browser Print / Save PDF is available; server-side PDF export and vector CAD drawings remain open. The existing NEXZ 20-page output is retained separately.

## Reference and release constraints

NEXZ jacket and pants PDFs remain visual and technical references; no Shahd Excel workbook was supplied (`EXCEL_REFERENCE_NOT_PROVIDED`). The JK-003 regression fixture uses only stated attributes and keeps composition and unknown production measurements as TBC. Remote Cloudflare preview cannot be verified until R2 is enabled (`BLOCKED_EXTERNAL_R2_ACCOUNT_ENABLEMENT`).
