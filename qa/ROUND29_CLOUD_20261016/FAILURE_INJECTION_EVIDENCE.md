# Failure injection evidence (ROUND29, final code)

Method: a real SQLite trigger `RAISE(ABORT,'INJECTED_FAILURE')` is created on the target table, one release is attempted with an Idempotency-Key, the trigger is dropped, and the same key is retried. Counts come from the database (`releases`/`receipts` for the style, `audits` = all `RELEASE/CREATE` audit rows, `status` = style status).

This product has no separate security-event table: `audit_log` is the mandatory audit/security evidence and `release_receipts` is the success representation. Both are inside the batch.

## node:sqlite engine (tests/round29_atomic_release.mjs, T07)

| Injected at | HTTP | Before | After failure | After same-key retry |
|---|---|---|---|---|
| style_releases INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=11 status=DRAFT | rel=0 rcp=0 audit=11 status=DRAFT | rel=1 rcp=1 audit=12 status=PRODUCTION_RELEASED |
| release_receipts INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=12 status=DRAFT | rel=0 rcp=0 audit=12 status=DRAFT | rel=1 rcp=1 audit=13 status=PRODUCTION_RELEASED |
| styles UPDATE | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=13 status=DRAFT | rel=0 rcp=0 audit=13 status=DRAFT | rel=1 rcp=1 audit=14 status=PRODUCTION_RELEASED |
| audit_log INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=14 status=DRAFT | rel=0 rcp=0 audit=14 status=DRAFT | rel=1 rcp=1 audit=15 status=PRODUCTION_RELEASED |

## workerd local D1 (tests/round29_workerd_d1.mjs, W6)

| Injected at | HTTP | Before | After |
|---|---|---|---|
| style_releases INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=5 status=DRAFT | rel=0 rcp=0 audit=5 status=DRAFT |
| release_receipts INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=5 status=DRAFT | rel=0 rcp=0 audit=5 status=DRAFT |
| styles UPDATE | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=5 status=DRAFT | rel=0 rcp=0 audit=5 status=DRAFT |
| audit_log INSERT | 500 RELEASE_COMMIT_FAILED | rel=0 rcp=0 audit=5 status=DRAFT | rel=0 rcp=0 audit=5 status=DRAFT |

## Commit-window drift (guard aborts, not injected errors)

| Engine | Drift | Code | Before | After |
|---|---|---|---|---|
| node:sqlite | new Style Version created | STALE_CANDIDATE | rel=0 rcp=0 audit=15 | rel=0 rcp=0 audit=15 |
| node:sqlite | PP sample approval revoked | STALE_CANDIDATE | rel=0 rcp=0 audit=15 | rel=0 rcp=0 audit=15 |
| node:sqlite | cost line added | STALE_CANDIDATE | rel=0 rcp=0 audit=15 | rel=0 rcp=0 audit=15 |
| node:sqlite | competing release committed | RELEASE_CONFLICT | rel=0 rcp=0 audit=15 | rel=1 rcp=0 audit=15 |
| node:sqlite | membership removed | FORBIDDEN_ACTOR | rel=0 rcp=0 audit=18 | rel=0 rcp=0 audit=18 |
| node:sqlite | user deactivated | FORBIDDEN_ACTOR | rel=0 rcp=0 audit=18 | rel=0 rcp=0 audit=18 |
| node:sqlite | platform admin flag revoked (no membership) | FORBIDDEN_ACTOR | rel=0 rcp=0 audit=18 | rel=0 rcp=0 audit=18 |
| node:sqlite | RELEASES entitlement disabled | FEATURE_NOT_LICENSED | rel=0 rcp=0 audit=18 | rel=0 rcp=0 audit=18 |
| workerd D1 | new Style Version created | STALE_CANDIDATE | rel=0 rcp=0 audit=5 | rel=0 rcp=0 audit=5 |
| workerd D1 | membership of actor removed | FORBIDDEN_ACTOR | rel=0 rcp=0 audit=5 | rel=0 rcp=0 audit=5 |

500 bodies contain only `{error, code:'RELEASE_COMMIT_FAILED', correlationId}`; the tests assert that no `INJECTED`, `SQLITE`, `D1_ERROR`, `constraint`, `INSERT` or `UPDATE` text leaks.

Raw logs: `raw/round29_atomic_release.log`, `raw/round29_workerd_d1.log`.
