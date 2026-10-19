# Full test runs (W01)

| Run | Head | Result | Log |
|---|---|---|---|
| `npm run check` | `9fc395b` | PASS | — |
| `npm test` (26 suites, PR #6 baseline + W01) | `9fc395b` | **ALL_TESTS_PASS, 689 assertions** (PR #6 was 607) | `raw/branch_npm_test.log` |
| `test:ai-tp-w01` vision | `9fc395b` | 43 PASS | `raw/ai_tp_w01_vision.log` |
| `test:ai-tp-w01` engine | `9fc395b` | 39 PASS | `raw/ai_tp_w01_engine.log` |
| Browser + independent PDF (local wrangler dev) | `eb8c666` code | 25 / 25 PASS | `raw/w01_browser_pdf_results.json` |
| PR #6 `pdf_acceptance.mjs` on W01 (app BROWSER path) | `eb8c666` code | **BLOCKED_ENV** (Chrome as root) — not counted as pass or fail of the product | `TECHPACK_PDF_ACCEPTANCE.md` |
| Geometry third-party check (ezdxf 1.4.2) | `dd148d0` geometry | PASS | `raw/geometry_ezdxf_check.json` |
| Scratch PR #5 + W01 `npm test` (31 suites) | scratch `ae6eee9` | **1075 assertions PASS** | `raw/scratch_integration_npm_test.log` |
| Scratch PR #5 + W01 `test:workerd-d1` | scratch `ae6eee9` | **75 / 75 PASS** | `raw/scratch_integration_workerd_d1.log` |
| GitHub CI | final W01 head | see the Draft PR checks | — |

The `matrix` CSV `SECURITY_AND_FAILURE_INJECTION_MATRIX.csv` is generated from the vision/engine logs and the browser results (107 rows, 0 FAIL).
