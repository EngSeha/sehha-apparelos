# PR #5 + PR #6/W01 scratch integration — `SCRATCH_INTEGRATION_VERIFIED__RELEASE_BLOCKED_PENDING_PR5_REGATE`

A disposable worktree in the session scratchpad, detached HEAD, **never pushed**. No product branch was merged. Factory / Production Lot release stays BLOCKED until the independent Codex re-gate of PR #5.

| Item | Value |
|---|---|
| Base | PR #5 head `8e381e8` (schema 24, migrations to 0022) |
| Merged | W01 `9fc395b` (contains PR #6 `12a07ba`; migration 0023) |
| Final scratch head | `ae6eee9` (first merge `dfa9f3d`, then W01 `9fc395b`) |
| Combined schema | **25** (0001…0023; `0023` writes `schema_version='25'`, Worker `SCHEMA_VERSION='25'`) |

## Conflict resolution
| File | Resolution |
|---|---|
| `src/worker.js` | union of imports and routes (handoffs + intake + Tech Pack); PR #5's global 500 sanitizer kept, W01's route-level `sanitized()` added; schema 25 |
| `tests/test_helpers.mjs`, `tests/batch*.mjs` | PR #5 side (`D1Mock.batch`, migrations 0020–0022) + `0023`; W01 R2 mock methods (`head`, `delete`, `list`, `customMetadata`) |
| `package.json`, `tests/run_all.mjs` | union of check list and suites |
| `public/app.js` | PR #5 side (`error.code` and `error.data` already carried) |
| Schema literals in tests | `'24'` → `'25'` only where the database includes 0023 or the Worker constant is checked; upgrade tests that stop at 0022 now also apply 0023 (R30C-131, R30C-W4, P1M-02/03/08, P1-W09); fail-closed messages now name 25 (R30-T12, P1M-07) |

The exact test/migration adaptations are in `integration/scratch_adaptations.patch`.

## Results on `ae6eee9`
| Run | Result |
|---|---|
| `npm run check` | PASS |
| `npm test` (31 suites incl. round28/29/30/30-closure/30-p1, ai-techpack, ai-tp-w01) | **ALL_TESTS_PASS, 1075 assertions** (`raw/scratch_integration_npm_test.log`) |
| `npm run test:workerd-d1` (workerd D1 via wrangler migrations) | **75 / 75 PASS** (`raw/scratch_integration_workerd_d1.log`) |

PR #5 security regression vectors (QC signer TOCTOU, lot idempotency, handoff authority, failure injection, legacy releases, upgrade vs fresh DDL parity) all still pass with the W01 code present.

## What a real integration still needs (not done here)
1. The independent PR #5 re-gate verdict.
2. On the real integration branch: renumber nothing (0023 already sorts after 0022), set 0023 to schema 25 and apply the adaptations above.
3. Re-run the full Batch 04→21 regression, the workerd suites and the PDF acceptance on the integrated head.
