# ApparelOS product readiness — 2026-10-07

Verdict: **BLOCKED** for a production pilot. Local engineering work is reviewable; the remote preview and full production gate remain open.

| Domain | Implemented | Tested | Runtime Verified | Blocker |
| --- | --- | --- | --- | --- |
| Style / Digital Twin | Partial: identity, revisions, command center | Yes | Local Workerd + browser | New readiness is not enforced by the existing production release |
| Design / image pipeline | Partial: asset roles, AI draft/review, annotations | Yes | Local asset upload/read | Provider quality and full vision pipeline unverified |
| Measurement | Partial: POM, tolerances, sample measurement comparison | Yes | Local Preview 21 | Full definitions/rules/snapshots need domain consolidation |
| Grading | Partial: size bands and rule matrix | Yes | Local Preview 21 | Customer charts and approval of calculated size sets |
| Pattern | Partial: piece/size geometry contract, links, validation | Yes | Local API | CAD geometry/renderer/export absent |
| Fabric | Partial: specification and direction/shrinkage fields | Yes | Local API | Supplier/roll operations and approvals in factory flow |
| Trims | Partial: specification, quantity, placement, revisions | Yes | Local API | Supplier and approved alternate workflow |
| BOM | Partial: Preview 21 BOM editor and costing source | Yes | Local Preview 21 | Automatic reconciliation with new fabric/trim records |
| Marker | Partial: plan, size ratio, width/direction validation | Yes | Local API | Layout optimizer and visual renderer |
| Consumption | Partial: quantity/plies/waste/defect/shrinkage calculation | Yes | Local API | Approved booking and production planning integration |
| Operations | Partial: existing bulletin plus detailed routing steps | Yes | Local API | Merge legacy and new operation records |
| Routing | Partial: predecessor and sequence validation | Yes | Local API | Parallel graph and capacity balancing |
| Samples / workflow | Partial: sample rounds and 31-stage progress foundation | Yes | Local Preview 21 + API | Cross-stage approval and correction links |
| QC | Partial: lot checks, defects, CAPA, QC stage role split | Yes | Local Preview 21 + API | Full measurement/fabric/cutting/inline/endline taxonomy |
| Costing | Partial: cost sheets, frozen basis, actual labor/material/overhead | Yes | Local Preview 21 | Link fabric consumption and operation SMV to approved cost |
| Tech Pack | Partial: existing NEXZ 20-page output + dynamic A4 engineering composer | Yes | Browser HTML viewed | Direct PDF, full image/geometry integration, pagination QA on large data |
| Import / export | Partial: configurable CSV/JSON staging preview and CSV/JSON export | Yes | Local API | `EXCEL_REFERENCE_NOT_PROVIDED`; XLSX parser, commit, reconciliation pending |
| Security | Partial: tenant check, protected assets, revisions, approval role separation | Yes | Local API and Workerd | Full end-to-end permission audit remains |
| Cloudflare | Local D1/R2/Workerd and deploy dry run | Yes | Local only | `BLOCKED_EXTERNAL_R2_ACCOUNT_ENABLEMENT`; no remote preview |

## Verified evidence

- Schema 17 → 18 additive migration preserved an existing Style in an upgrade test. Wrangler applied `0016_engineering_foundation.sql` to local D1; `/api/health` returned `ok=true`, schema and expected schema 18.
- `npm test`: 21 suites, 473 assertions. Existing Preview 04–21 and main-upgrade regressions remain in the aggregate runner. The engineering suite covers jacket, pants, and abaya isolation, pattern sizes, marker math, revisions, CSV/JSON staging and export, role boundaries, tenant access, dynamic Tech Pack, and upgrade preservation. `npm run check` passed.
- The Engineering Center was inspected at desktop, tablet, and 390 px width. The narrow Style view has no document-wide horizontal overflow after the responsive fix. The bilingual A4 Tech Pack was viewed in the browser with actual MFD-WJ-001 data; unknown tolerances, fabric, and identity remained TBC.
- `npm audit` after the `sharp 0.35.5` patch override reported zero vulnerabilities. Wrangler `deploy --dry-run` passed. The real remote D1/R2 deployment was not performed because the account reports R2 error 10042.

## Required before pilot

1. Enforce the new engineering readiness and approval checklist in the frozen production release path; reconcile it with Preview 21's release snapshot and role signoffs.
2. Complete and verify canonical joins among fabric, trims, BOM, marker, routing, QC, and costing; add capacity and pattern geometry where required for actual factory use.
3. Provide the Shahd `.xlsx` reference to finish sheet mapping and implement/verify the XLSX import commit/export flow.
4. Enable R2 on the Cloudflare account, provision remote D1/R2 resources and secrets, deploy a preview, and run remote acceptance including authenticated assets and tenant isolation.

Unknown production values remain `TBC`; local calculations are not approvals or production facts.

## Human Experience update — 2026-10-08

Schema 21 adds a role-derived Arabic guided surface for assigned production quantity entry, one-piece QC with defect photos, and lot-specific material receipt/issue/return. Supervisor home puts held operations and unresolved critical defects first, with a named owner and a route to the production lot. Preferences, task deep links, partial task search, and local-only demo users are included. The full acceptance matrix and remaining gaps are in [HUMAN_EXPERIENCE_ACCEPTANCE.md](HUMAN_EXPERIENCE_ACCEPTANCE.md).

This improves the local guided demo but does **not** change the blocked production-pilot verdict above. The latest local aggregate test count is 24 suites and 539 assertions; remote migration/deployment and full factory pilot validation remain outstanding.
