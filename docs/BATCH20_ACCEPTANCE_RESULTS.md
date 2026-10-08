# SEHHA ApparelOS - BATCH 20 Acceptance Results

## Final target

- Application: `v0.20.0-cloudflare`
- Package: `0.20.0`
- D1 schema: `16`
- Baseline for relative merge: Preview 16 / schema 15

## Acceptance summary

| Gate | Result | Evidence |
|---|---|---|
| Worker + frontend syntax | PASS | `BATCH20_NPM_CHECK.txt` |
| Full compatibility regression Batch 04 -> 20 | PASS | 396 `PASS` assertions; `BATCH20_FINAL_REGRESSION_LOG.txt` |
| Preview 17 reconciliation | PASS | actual output, actual usage, yield, variance, release gate |
| Optimistic concurrency | PASS | stale `expectedVersion` rejected with 409 |
| Schema 15 -> 16 upgrade | PASS | legacy production lot retained with safe defaults |
| Preview 18 factory authorization | PASS | design cannot create lot; supervisor cannot self-author QC; QC cannot final release |
| Preview 19 material cost analytics | PASS | frozen unit cost; later Cost Sheet does not reprice historical lot |
| Preview 20 lot report | PASS | A4 report contains plan/actual/QC/cost/hash evidence |
| Released-lot immutability | PASS | reconciliation and factory mutations rejected after release |
| Secret scan | PASS | no real high-signal credentials found |
| PDF preflight / visual render | PASS | 1-page A4 Landscape report rendered and visually inspected |

## Regression count

`396 PASS assertions` across Batch 04 through Batch 20, plus historical/current batch PASS markers.

## Preview 17 key acceptance

- New lot starts with `row_version=1`.
- Old behavior remains releasable when reconciliation has not been started.
- Reconciliation start activates blockers for actual good output and planned materials.
- Frozen material plan remains 189m in the fixture.
- Stale write is rejected rather than overwriting current data.
- 185m actual against 189m frozen gross records -4m variance.
- Released lot rejects later reconciliation mutation.

## Preview 18 key acceptance

- `DESIGN_PATTERN_MASTER` cannot create Production Lot.
- `FACTORY_SUPERVISOR` can create/execute the Lot but cannot author QC evidence.
- `QC_MANAGER` can add QC, defect and CAPA evidence but cannot final-release the Lot.
- Final release succeeds only through the permitted production role after independent QC/CAPA evidence.

## Preview 19 key acceptance

- Planned material cost fixture: EGP 18,900.
- Actual material cost fixture: EGP 18,500.
- Material cost variance: EGP -400.
- Actual material cost per good unit uses actual good output.
- Later Cost Sheet edits do not alter historical Lot analytics.
- Analytics are labeled `MATERIAL_ONLY`.

## Preview 20 key acceptance

- Report route returns HTML successfully.
- Print CSS is A4 Landscape.
- Report includes lot identity, 96.0% yield, operation execution, QC evidence, material planned/actual cost and -400 variance.
- Report includes the frozen Planning Basis SHA256.
- The rendered PDF is exactly one A4 Landscape page and was visually inspected.

## Re-gate requirements

Before merge/deploy, independently verify:

1. Apply the chosen patch to the actual Codex/GitHub branch rather than overwriting it.
2. Run `npm run check` and full Batch 04 -> 20 regression in the merged tree.
3. Apply D1 migrations through `0014_reconciliation_concurrency.sql` on a disposable Cloudflare D1 copy first.
4. Exercise one real Cloudflare Worker/D1/R2 lot flow.
5. Re-check factory role assignments used by the deployment tenant.
6. Confirm no secrets enter Git history.

## Verdict

`READY FOR INDEPENDENT RE-GATE`
