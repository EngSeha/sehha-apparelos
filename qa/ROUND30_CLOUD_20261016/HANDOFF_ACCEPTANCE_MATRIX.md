# Factory Handoff acceptance matrix (ROUND30 closure)

Executed by `tests/round30_closure_matrix.mjs` (real worker HTTP handler + SQLite engine via the D1 adapter). **131 rows, 131 PASS, 0 FAIL.** Every row is an assertion; the full row list (expected vs actual) is `HANDOFF_ACCEPTANCE_MATRIX.csv`. The same failure-injection matrix, the invariant and the historical upgrade were repeated on **workerd local D1** (`tests/round30_closure_workerd.mjs`, 22/22).

## Coverage (rows PASS / rows) per transition × dimension

| Transition | permission | tenant isolation | idempotency | concurrency | failure injection | frozen data | legacy release | handoff gate |
|---|---|---|---|---|---|---|---|---|
| PREPARE | 9/9 | 1/1 | 3/3 | 2/2 | 8/8 | — | 2/2 | — |
| DISPATCH | 9/9 | 2/2 | 3/3 | 2/2 | 8/8 | — | — | — |
| ACKNOWLEDGE | 10/10 | 2/2 | 3/3 | 2/2 | 8/8 | — | — | — |
| WITHDRAW | 9/9 | 2/2 | 3/3 | 2/2 | 8/8 | 1/1 | — | — |
| INSPECT | 9/9 | 1/1 | — | — | — | — | — | — |
| LOT_CREATE | — | — | — | — | 4/4 | — | 2/2 | 4/4 |

Cross-transition rows: `LIST` tenant isolation: foreign-tenant owner by direct ids → PASS; `DETAIL` tenant isolation: foreign-tenant owner by direct ids → PASS; `DISPATCH|WITHDRAW` concurrency: 12 concurrent dispatch vs withdraw → PASS; `PREPARE→DISPATCH→ACKNOWLEDGE` frozen data: package bytes + hashes across every transition and after a newer release → PASS; `ALL` frozen data: upstream release row while its handoff moves → PASS; `ALL` atomicity invariant: DB-wide over 58 handoffs after races/replays/injections → PASS.

### What each dimension proves
- **permission**: every role (owner/admin, RELEASE_MANAGER, second owner, DESIGN_PATTERN_MASTER, FACTORY_SUPERVISOR ×2, QC_MANAGER, OPERATOR, STORE_CLERK) is tried on every transition from the correct state. Denied attempts leave the rows byte-identical. Allowed roles commit. The dispatcher can never acknowledge their own dispatch.
- **tenant isolation**: a foreign-tenant owner using direct ids on prepare, dispatch, withdraw, acknowledge, package, list and detail gets 403, with no change and no package bytes. A handoff id from another style on this style's path gets 404.
- **idempotency**: on every transition, a lost-response retry returns the original body with the replay header and no new rows. The same key with a different intent gets 409 `IDEMPOTENCY_KEY_REUSED` with no writes. The same key from a foreign tenant gets 403 with no disclosure.
- **concurrency**: on every transition, 12 requests are held at the commit barrier, once with different keys and once with the same key. Different keys: one winner and 11 conflicts. Same key: every caller receives the winner's single event. Plus dispatch-vs-withdraw. Never a 500.
- **frozen data**: package bytes and all hashes are identical across PREPARED → HANDED_OFF → ACKNOWLEDGED, after a newer release, and after a withdrawal. The upstream release row stays byte-identical.
- **legacy release / handoff gate**: pre-ROUND29 and ROUND28-live releases can neither be prepared nor open a lot. A frozen release opens a lot only once the factory acknowledgement is persisted.

## Atomicity proof — a failed mandatory write never leaves a successful handoff or an incomplete audit

Method: for each transition, a real SQLite trigger `RAISE(ABORT)` is placed on exactly one mandatory statement of that command. Every row of the style is snapshotted before and after: handoffs, events, receipts, audit rows and lots, all columns. The same request is then retried with the same key once the trigger is removed.

| Transition | Statement aborted | HTTP | Rows after failure | After retry (handoff:version · ev/rc/au/lots) |
|---|---|---|---|---|
| PREPARE | factory_handoffs INSERT | 500 sanitized | byte-identical to before | PREPARED:1 · 1/1/1/0 |
| PREPARE | event INSERT | 500 sanitized | byte-identical to before | PREPARED:1 · 1/1/1/0 |
| PREPARE | receipt INSERT | 500 sanitized | byte-identical to before | PREPARED:1 · 1/1/1/0 |
| PREPARE | audit INSERT | 500 sanitized | byte-identical to before | PREPARED:1 · 1/1/1/0 |
| DISPATCH | factory_handoffs UPDATE | 500 sanitized | byte-identical to before | HANDED_OFF:2 · 2/2/2/0 |
| DISPATCH | event INSERT | 500 sanitized | byte-identical to before | HANDED_OFF:2 · 2/2/2/0 |
| DISPATCH | receipt INSERT | 500 sanitized | byte-identical to before | HANDED_OFF:2 · 2/2/2/0 |
| DISPATCH | audit INSERT | 500 sanitized | byte-identical to before | HANDED_OFF:2 · 2/2/2/0 |
| ACKNOWLEDGE | factory_handoffs UPDATE | 500 sanitized | byte-identical to before | ACKNOWLEDGED:3 · 3/3/3/0 |
| ACKNOWLEDGE | event INSERT | 500 sanitized | byte-identical to before | ACKNOWLEDGED:3 · 3/3/3/0 |
| ACKNOWLEDGE | receipt INSERT | 500 sanitized | byte-identical to before | ACKNOWLEDGED:3 · 3/3/3/0 |
| ACKNOWLEDGE | audit INSERT | 500 sanitized | byte-identical to before | ACKNOWLEDGED:3 · 3/3/3/0 |
| WITHDRAW | factory_handoffs UPDATE | 500 sanitized | byte-identical to before | WITHDRAWN:2 · 2/2/2/0 |
| WITHDRAW | event INSERT | 500 sanitized | byte-identical to before | WITHDRAWN:2 · 2/2/2/0 |
| WITHDRAW | receipt INSERT | 500 sanitized | byte-identical to before | WITHDRAWN:2 · 2/2/2/0 |
| WITHDRAW | audit INSERT | 500 sanitized | byte-identical to before | WITHDRAWN:2 · 2/2/2/0 |
| LOT_CREATE | production_lots INSERT | 500 sanitized | byte-identical to before | ACKNOWLEDGED:3 · 3/3/4/1 |
| LOT_CREATE | audit INSERT | 500 sanitized | byte-identical to before | ACKNOWLEDGED:3 · 3/3/4/1 |

All 18 cases above passed on node:sqlite **and** on workerd D1 (R30C-W2 ×18). This covers 4 statements × 4 transitions, plus the 2 statements of the handoff-seeded lot.

**DB-wide invariant** after all races, replays, injections and retries (node:sqlite): **58 handoffs, 0 violations, 0 orphan events/receipts/audits, 0 lot issues.** For every handoff, events = version = receipts = audit rows, and the last event equals the current status. Every event has exactly one receipt. No handoff is self-acknowledged. Every handoff-seeded lot has exactly one CREATE audit and an ACKNOWLEDGED handoff. The same invariant holds on workerd D1 (R30C-W3).

Why this holds by construction:
- Each command is a single `D1.batch()`, which D1 documents as a transaction.
- The guarded state write is followed by event, receipt and audit inserts that reference the row through `last_command_id` = this command, in NOT NULL columns. If the guard matched nothing, or any insert fails, the whole batch rolls back.
- Lots use the same pattern: the audit `org_id` is looked up from the new lot row.
- Proven locally on two engines. Not proven on remote D1 (`BLOCKED_ENV`).
