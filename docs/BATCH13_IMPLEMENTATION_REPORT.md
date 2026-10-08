# BATCH 11–13 MEGA IMPLEMENTATION REPORT

## Baseline
- Starting full-code baseline: Developer Preview 10 / schema 9.
- Result: Developer Preview 13 / version 0.13.0-cloudflare / schema 12.
- All schema changes are additive migrations.

## Preview 11 — Sample & Fit Validation
- Added sample rounds tied to frozen Style Versions.
- POM spec/tolerance copied from the source version into sample evidence.
- Actual measurement result states: PENDING / NO_TOLERANCE / PASS / FAIL.
- No implicit tolerance is created.
- APPROVED sample requires all entered measurements to PASS explicit tolerance.
- Editing an approved actual measurement automatically revokes approval and returns sample to IN_REVIEW.
- Added Samples & Fit UI tab.

## Preview 12 — Costing & Consumption
- Added cost sheets and cost lines.
- No default consumption, price, labor, overhead, waste or FX conversion.
- Line total derives only from explicit Qty × Unit Cost × Waste%.
- Approval requires at least one cost line plus explicit labor/overhead and complete line inputs.
- Editing approved costing reopens it to DRAFT.
- Production Release captures approved costing evidence associated with its source version.
- Added Costing UI tab.

## Preview 13 — Production QA / CAPA
- Production lot must reference an existing Production Release.
- Added QC checks and production defects.
- Lot release is fail-closed until QC evidence exists, all QC checks PASS, and all MAJOR/CRITICAL defects are resolved.
- Defect resolution requires explicit corrective action.
- QC/defect/CAPA actions are audited.
- Released lots are immutable: no new QC, defects, or second release.
- Added Production QA UI tab.

## Release evidence correction
A production release sourced from a frozen Style Version now freezes two evidence layers together:
1. Immutable product specification from the source Version.
2. Current approved Sample/Cost evidence linked to that Version at release time.
This fixes the lifecycle gap where sample/cost approval naturally happens after the Style Version is created.

## Data integrity
- No automatic measurements, tolerance, material price, consumption or CAPA facts are generated.
- Historical Preview 04–10 functions remain regression-covered.
- Tenant isolation/auth architecture remains unchanged.
