# BATCH 21 IMPLEMENTATION REPORT

## Release
- Product: SEHHA ApparelOS
- Version: 0.21.0-cloudflare
- Schema: 17
- Baseline: Developer Preview 20 / schema 16

## Scope closed
Preview 21 completes the Full Actual Cost Reconciliation slice for Production Lots.

### Added
- Additive migration `0015_full_actual_cost.sql`.
- `production_lots.full_cost_required` and `actual_overhead_cost`.
- `production_labor_usage` table keyed by lot + operation sequence.
- Explicit Full Cost start gate.
- Actual labor input per synced factory operation: minutes + hourly rate.
- Actual overhead input as an explicit money value.
- Planned total lot cost from frozen material prices + frozen planned labor/unit + frozen overhead percentage.
- Actual total production cost from actual material + entered labor + entered overhead.
- Actual production cost per good unit using actual good output.
- Total cost variance.
- Full-cost audit actions and optimistic lot-version protection.
- Production Lot report upgrades from `MATERIAL ONLY` to `FULL ACTUAL COST` only when the workflow is explicitly activated.
- UI controls for full-cost start, labor entry, overhead entry, blockers and analytics.

## Integrity rules
- No labor rate is inferred.
- No labor minutes are inferred.
- No actual overhead is inferred.
- No currency conversion is performed.
- Full Cost is opt-in so historical lots preserve Preview 20 behavior.
- Once enabled, lot release fails closed until material reconciliation is complete, labor exists for every synced operation, and actual overhead is entered.
- Released lots are immutable.
- Planned comparison remains bound to the lot's frozen approved Cost Sheet basis.

## Tests
- `npm run check`: PASS.
- `npm run test:batch21`: PASS.
- Full Batch 04 -> 21 regression: PASS, 416 PASS assertions.
- Upgrade schema 16 -> 17: PASS with existing reconciliation data preserved.

## Environment limitation
HTML report generation was verified by executable integration assertions. The local Playwright browser binary is not installed and the system Chromium headless process hangs in this container, so no new Preview 21 PDF visual proof is claimed. The HTML evidence is retained and the renderer must be visually re-gated in the real Cloudflare/browser environment before deployment.

## Verdict
READY FOR INDEPENDENT RE-GATE
