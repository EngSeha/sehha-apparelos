# Regression verdict — ROUND30 P1 corrective

**Implementer verdict: `IMPLEMENTER_FOCUSED_PASS_PENDING_INDEPENDENT_REGATE`.**
This is not an independent PASS and not `ACCEPTED_FOR_ROUND31_BASE`. ROUND31 has not started.

## Baseline at `5f928e2` (reported baseline, re-run here before any change)
| Gate | Result | Raw |
|---|---|---|
| `npm run check` | PASS | raw/baseline_check_5f928e2.log |
| `npm test` | PASS, 28 suites / 836 | raw/baseline_npm_test_5f928e2.log |
| workerd local D1 | PASS, 55 | raw/baseline_workerd_5f928e2.log |
| P1-A reproduction | **REPRODUCED**: 201 PREPARED → 200 → 200 → lot 201 | raw/repro_baseline_5f928e2.log |
| P1-B reproduction | **REPRODUCED**: 201 then 500 INTERNAL_ERROR | raw/repro_baseline_5f928e2.log |

## Corrective (code commit `2740a9d`)
| Gate | Node 22.22.0 | Node 24.22.0 | Raw |
|---|---|---|---|
| fresh `npm ci` | PASS | — | — |
| `npm run check` | PASS | — | raw/final_check.log |
| `npm test` | **29 suites / 925** | **29 / 925** | raw/final_test_node22.log, raw/final_test_node24.log |
| workerd local D1 (`npm run test:workerd-d1`) | **75** | — | raw/final_workerd_all.log |
| Browser, Chromium on local `wrangler dev` | new 7/7 + ROUND30 11/11 | — | raw/browser_lot_retry_check.log, raw/browser_r30_regression.log |
| `npm audit --audit-level=high` | 0 vulnerabilities | — | raw/final_audit.log |
| `git diff --check` (including new files) | clean | — | — |
| Repro script on the corrective code | both `defectReproduced:false` | — | raw/repro_fixed_2740a9d.log |
| Mutation checks (3) | each caught | — | raw/mutation_*.log |
| GitHub CI on `2740a9d` (run 38993902960, PR merge ref `5034e1d` = 2740a9d into 5f928e2, Node 24.21.0) | **success**: npm ci, check, `npm test` 29 suites / 925, `test:workerd-d1` all PASS incl. P1-W01..W09 | | raw/ci_run_38993902960_summary.log |

## Distinct counts (no double counting across runners)
| Source | Count |
|---|---|
| Inherited `npm test` assertions | 836 (unchanged in number) |
| New `tests/round30_p1_corrective.mjs` | 89 |
| `npm test` total | 925 |
| Inherited workerd | 55 |
| New `tests/round30_p1_workerd.mjs` | 20 |
| workerd total | 75 |
| New browser check | 7 |
| Re-run ROUND30 browser check | 11 |

The 20 workerd rows deliberately repeat decisive node rows on a second engine. They are separate executions, not the same lines counted twice, but they prove the same invariants. Read them as engine coverage, not as additional behaviours.

## How inherited tests were changed (no negative assertion was weakened)
| Change | Files |
|---|---|
| Migration lists gained `0022` | batch04–10, `test_helpers` |
| Schema literal `'23'`→`'24'` in health/metadata checks and their labels | batch05–11, batch14–21 metadata, round29/30 workerd |
| Blocks that prove the 0021 contract now install through 0021 only | `round30_factory_handoff` T12, `round30_closure_matrix` §9. Their original assertions (3 tables, 11 triggers, DDL equality) are unchanged. |
| §9 runtime row now applies 0022 before the health check | `round30_closure_matrix` §9 |
| Lot write-failure code `INTERNAL_ERROR`→`LOT_COMMIT_FAILED` | `round30_closure_matrix`, `round30_closure_workerd`. Still asserted: status 500, correlationId, sanitized body, rows byte-identical. |
| Shared lot fixture `admitReleasesForLotFixtures` now creates four eligible, independent fixture signers and seals real release/package hashes | — |

The shared fixture change was needed because the new database guards reject the old placeholder handoffs. That rejection is itself the fix working.

## Not proven here
| Item | Status |
|---|---|
| Remote Cloudflare D1, deployed preview | BLOCKED_ENV |
| Tenant archive / HOLD | BLOCKED_NO_TENANT_ARCHIVE_MODEL / BLOCKED_NO_HOLD_MODEL |
| Session revocation per cookie | BLOCKED_NO_SESSION_STORE; disabled accounts are rejected per request (P1B-06) |
| PDF | BLOCKED_NO_PDF_ENGINE |
| Production Pilot | BLOCKED |
