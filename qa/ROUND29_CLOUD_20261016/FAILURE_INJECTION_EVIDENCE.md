# Failure injection evidence (ROUND29)

Method: a real SQLite trigger `RAISE(ABORT,'INJECTED_FAILURE')` is created on the target table, one release is attempted with an Idempotency-Key, the trigger is dropped, and the same key is retried. Counts are taken from the database before/after (`releases`/`receipts` for the style, `audits` = all `RELEASE/CREATE` audit rows, `status` = style status).

There is no separate security-event table in this product; `audit_log` is the mandatory audit/security evidence and `release_receipts` is the success representation. Both are inside the batch.

## node:sqlite engine (tests/round29_atomic_release.mjs, T07)

| Injected at | HTTP | Before | After failure | After same-key retry |
|---|---|---|---|---|
| style_releases INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=10 status=DRAFT | rel=0 rcp=0 audit=10 status=DRAFT | rel=1 rcp=1 audit=11 status=PRODUCTION_RELEASED |
| release_receipts INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=11 status=DRAFT | rel=0 rcp=0 audit=11 status=DRAFT | rel=1 rcp=1 audit=12 status=PRODUCTION_RELEASED |
| styles UPDATE | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=12 status=DRAFT | rel=0 rcp=0 audit=12 status=DRAFT | rel=1 rcp=1 audit=13 status=PRODUCTION_RELEASED |
| audit_log INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=13 status=DRAFT | rel=0 rcp=0 audit=13 status=DRAFT | rel=1 rcp=1 audit=14 status=PRODUCTION_RELEASED |

## workerd local D1 (tests/round29_workerd_d1.mjs, W6)

| Injected at | HTTP | Before | After |
|---|---|---|---|
| style_releases INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=4 status=DRAFT | rel=0 rcp=0 audit=4 status=DRAFT |
| release_receipts INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=4 status=DRAFT | rel=0 rcp=0 audit=4 status=DRAFT |
| styles UPDATE | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=4 status=DRAFT | rel=0 rcp=0 audit=4 status=DRAFT |
| audit_log INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=4 status=DRAFT | rel=0 rcp=0 audit=4 status=DRAFT |

## Commit-window drift (guard aborts, not injected errors)

| Engine | Drift | Code | Before | After |
|---|---|---|---|---|
| node:sqlite | new Style Version created | STALE_CANDIDATE | rel=0 rcp=0 audit=14 | rel=0 rcp=0 audit=14 |
| node:sqlite | PP sample approval revoked | STALE_CANDIDATE | rel=0 rcp=0 audit=14 | rel=0 rcp=0 audit=14 |
| node:sqlite | cost line added | STALE_CANDIDATE | rel=0 rcp=0 audit=14 | rel=0 rcp=0 audit=14 |
| node:sqlite | competing release committed | RELEASE_CONFLICT | rel=0 rcp=0 audit=14 | rel=1 rcp=0 audit=14 |
| node:sqlite | membership removed | FORBIDDEN_ACTOR | rel=0 rcp=0 audit=17 | rel=0 rcp=0 audit=17 |
| node:sqlite | user deactivated | FORBIDDEN_ACTOR | rel=0 rcp=0 audit=17 | rel=0 rcp=0 audit=17 |
| node:sqlite | platform admin flag revoked (no membership) | FORBIDDEN_ACTOR | rel=0 rcp=0 audit=17 | rel=0 rcp=0 audit=17 |
| node:sqlite | RELEASES entitlement disabled | FEATURE_NOT_LICENSED | rel=0 rcp=0 audit=17 | rel=0 rcp=0 audit=17 |
| workerd D1 | new Style Version created | STALE_CANDIDATE | rel=0 rcp=0 audit=4 | rel=0 rcp=0 audit=4 |
| workerd D1 | membership of actor removed | FORBIDDEN_ACTOR | rel=0 rcp=0 audit=4 | rel=0 rcp=0 audit=4 |

Response bodies on 500 contain only `{error, code:'RELEASE_COMMIT_FAILED', correlationId}`; the tests assert no `INJECTED`, `SQLITE`, `D1_ERROR`, `constraint`, `INSERT` or `UPDATE` text leaks.

Raw logs: `raw/round29_atomic_release.log`, `raw/round29_workerd_d1.log`.
