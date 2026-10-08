# Preview 21 integration and acceptance — 2026-10-07

## Baseline and merge ledger

- Starting remote `main`: `b166acc98e12da1e8f562b6e0417de304a4c90fb`, Preview 03, schema 4. Starting status was clean.
- `codex/cloud-ai-github-hardening` at `43ea10e81e356fc15e6d991cd429858d85feebfe` is an ancestor of `main`; no unique branch-only work remained to merge.
- Applied the owner-supplied Preview 03→21 source patch on `codex/apparelos-preview21-integration` after `git apply --check` passed. Of 114 shared files in the Preview 21 ZIP, 113 matched the patch result after normalizing CRLF/LF. The exception is `.dev.vars.example`, intentionally preserved from current GitHub `main`; it contains placeholders, not credentials.
- The source patch omitted `0001_init.sql`, which is required by fresh installs and all Preview 21 integration tests. Added the exact file from the ZIP. Historical generated evidence PDFs/images and relative patch files were not copied into source control.
- Preserved GitHub's `package-lock.json` dependency graph and synchronized its root package metadata with Preview 21. A clean `npm ci` passed.
- Local product changes after reconciliation: independent final-lot release role; factory supervisor cannot sign QC; authenticated, tenant-scoped asset reads; image MIME/signature validation; server-owned asset provenance; visible Style tabs and non-overflowing editor form; current version label on login.

## Migration map

| File | Resulting schema | Purpose |
|---|---:|---|
| `0001_init.sql` | 3 | Base D1 model |
| `0002_ai_review_pattern.sql` | 4 | Pattern registry |
| `0003_mohsen_master_bilingual.sql` | 5 | Bilingual fields and colorways |
| `0004_pattern_intelligence_grading.sql` | 6 | Pattern links and explicit grading |
| `0005_release_workflow.sql` | 7 | Frozen releases |
| `0006_factory_collaboration.sql` | 8 | Factory reviews and signoffs |
| `0007_requirements_matrix.sql` | 9 | Applicability and requirements |
| `0008_sample_fit_validation.sql` | 10 | Samples and fit |
| `0009_costing_consumption.sql` | 11 | Costing and consumption |
| `0010_production_quality.sql` | 12 | Lots, QC, defects |
| `0011_production_planning.sql` | 13 | Size/color planning |
| `0012_frozen_planning_basis.sql` | 14 | Planning basis |
| `0013_factory_operation_execution.sql` | 15 | Operation progress |
| `0014_reconciliation_concurrency.sql` | 16 | Material reconciliation and lot version |
| `0015_full_actual_cost.sql` | 17 | Explicit labor and overhead actuals |

All are additive relative to the preceding Preview migration. The initial schema file uses `CREATE TABLE IF NOT EXISTS`; the main-to-21 regression specifically tests its replay against an existing schema 4 database before applying `0003`–`0015`.

## Executed gates

| Gate | Result |
|---|---|
| `npm ci` | PASS; package-lock accepted |
| `npm run check` | PASS |
| `npm test` | PASS: 20 suites, 438 assertions |
| Fresh Wrangler local D1 migration | PASS: 15 migrations, schema 17 |
| Schema 4 → 17 data retention | PASS: tenant, Style, locked POM, pattern, frozen version |
| Schema 16 → 17 data retention | PASS: historical lot data and opt-in defaults |
| Local Workerd login + D1 CRUD | PASS |
| Local R2 upload/read | PASS; authorized read 200, anonymous read 401 |
| Cross-tenant asset read | PASS: 403 in integration test |
| MIME spoofing / SVG / malformed base64 | PASS: rejected |
| Role separation | PASS: supervisor cannot author QC or release; QC cannot release; release manager can release |
| Preview 21 full actual cost | PASS via integration suite |
| Jacket, pants and dress applicability | PASS via Preview 08/09 suites; no Morfok leakage in pants/dress |
| Browser visual inspection | Login, RTL Style overview, narrow layout, and 20-page HTML Tech Pack cover inspected in local browser. New PDF print artifact not verified. |
| Wrangler bundle dry run | PASS |
| Cloudflare remote R2 | BLOCKED: account API returned code 10042, requiring R2 enablement in Dashboard |
| Cloudflare Preview deployment | NOT RUN: no remote D1 resource listed; R2 is disabled; deployment would not exercise required storage |
| Shahd Excel round trip | `BLOCKED_REFERENCE_SHAHD_EXCEL`: only the two NEXZ PDF references were provided |

## Product gaps remaining before pilot

The Preview 21 foundation is integrated and locally tested. The following requested capabilities are still absent or insufficiently verified and must not be described as production ready:

1. Canonical XLSX import, mapping dry run, provenance, idempotency, and round-trip export. The Shahd-specific adapter also requires the actual `.xlsx` file.
2. Controlled fabric/material and other master libraries with frozen Style snapshots.
3. Complete cutting/bundling execution and CAD-backed production marker. Current output correctly labels unsupported geometry as Pattern Architecture / Marker Study.
4. Full capability-based RBAC across all Style write routes and role administration UI. The new independent lot release role is enforced server-side but provisioning is not yet exposed in the product.
5. Real browser PDF/print, mobile, accessibility, and Cloudflare D1/R2/AI staging gates. HTML visual review and local Workerd checks do not substitute for those gates.
6. Dependency audit reported three high severity findings in development tooling (`wrangler`, `miniflare`, `sharp`). The audit's automatic fix proposed a major Wrangler downgrade; no unreviewed forced change was applied.

**Verdict: `NOT READY — missing XLSX system and Shahd workbook; master libraries/cutting/RBAC scope incomplete; remote R2 disabled; staging and print gates unverified; development dependency audit findings`.**
