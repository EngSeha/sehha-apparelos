# SEHHA ApparelOS - BATCH 20 Implementation Report

## Scope

Baseline: Developer Preview 16 / v0.16.0 / D1 schema 15.
Target: Developer Preview 20 / v0.20.0 / D1 schema 16.

This cycle extends the frozen Production Release -> Production Lot flow with actual production reconciliation, action-level factory authorization, material-cost variance analytics, and an A4 Production Lot Reconciliation Report. Existing Style Digital Twin, frozen Release, Sample/Fit, Costing, Planning, Operation Execution, QC, Defect/CAPA, and 20-page Tech Pack behavior is retained.

## Preview 17 - Actual Usage, Reconciliation, Concurrency

- Added additive migration `0014_reconciliation_concurrency.sql`; schema 15 -> 16.
- Added `row_version`, `reconciliation_required`, and `actual_output_qty` to Production Lot.
- Added `production_material_usage` table.
- Added optimistic concurrency using `expectedVersion`; stale writes fail HTTP 409 instead of silently overwriting newer lot state.
- Added explicit reconciliation start, actual good output, actual material usage, scrap, yield and quantity variance.
- Reconciliation remains opt-in for backward compatibility; once started it becomes fail-closed for Lot Release.
- Released lots reject reconciliation mutations.

## Preview 18 - Factory Role Enforcement

- Added server-side action-level authorization on Production Lot mutations.
- `DESIGN_PATTERN_MASTER`: no factory execution/QC mutations.
- `FACTORY_SUPERVISOR` / `PRODUCTION`: lot creation/planning/execution/material usage/defect-CAPA/final release.
- `QC_MANAGER` / `QC`: QC evidence + defects + CAPA; no final lot release.
- Owner/platform administrative roles retain full access.
- This separates production execution evidence from independent QC evidence.

## Preview 19 - Material Cost Variance & Yield Analytics

- Approved Cost basis now freezes explicit unit costs with the Lot planning basis.
- Planned Material Cost = frozen gross required quantity x frozen unit cost.
- Actual Material Cost = actual material usage x frozen unit cost.
- Added Material Cost Variance and Actual Material Cost per Good Unit.
- Historical lots are never repriced from a later Cost Sheet.
- Scope is explicitly `MATERIAL_ONLY`; actual labor/overhead are not inferred and are not called total production cost.

## Preview 20 - Production Lot Reconciliation Report

- Added read-only Production Lot report route:
  `/api/styles/:styleId/production-lots/:lotId/report`
- Report is A4 Landscape and renders stored lot/release/planning/execution/QC/reconciliation evidence.
- Includes lot identity/status, row version, planned and actual good output, yield, size-color allocation, material planned/actual/scrap/variance, material-cost variance, operation execution, QC, defect/CAPA and frozen Planning Basis SHA256.
- Report explicitly states that cost analytics are material-only.
- UI exposes a Report action from Production Lot view.

## Compatibility / Test-Harness Maintenance

- Current-compatibility tests were updated to apply migration `0014` and expect v0.20/schema16.
- Historical upgrade tests continue to validate their historical target schemas independently.
- Corrected one stale Batch 17 metadata assertion that still compared the package to v0.18 while the current compatibility target is v0.20.
- Metadata labels were cleaned so evidence text reflects the asserted v0.20 target.

## Security / Integrity

- No `.dev.vars` or private-key files are present.
- High-signal scans found no real OpenAI, Anthropic, GitHub or Google tokens.
- `.dev.vars.example` contains only blank/change-me placeholders; one historical documentation line contains `ANTHROPIC_API_KEY=...` as a placeholder.
- Production Lot optimistic locking prevents silent stale overwrites.
- Released Production Lots remain immutable across planning, execution, QC, defect and reconciliation mutations.

## Visual Evidence

A production-lot fixture was rendered through the actual report route, converted to PDF and rendered back to PNG for inspection.

- PDF: 1 page.
- Page size: A4 Landscape (841.89 x 595.276 pt).
- No visible clipping/overlap in the inspected render.
- Fixture evidence shows 100 planned, 96 good output, 96% yield, 189m planned material, 185m actual, 4m scrap, EGP 18,900 planned material cost, EGP 18,500 actual, and EGP -400 variance.

## Known Deployment Gates / Limitations

- This environment did not push to GitHub; no authenticated GitHub write connector is available here.
- Real Cloudflare `wrangler dev/deploy`, remote D1/R2 and live provider credentials remain deployment-environment gates.
- Material cost analytics intentionally exclude actual labor and actual overhead.
- Reconciliation is opt-in for old lots; once started it is enforced fail-closed.
- The report is evidence rendering, not a mutation path.

## Verdict

`READY FOR INDEPENDENT RE-GATE`
