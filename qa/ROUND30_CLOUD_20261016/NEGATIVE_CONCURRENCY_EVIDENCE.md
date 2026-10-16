# Negative, concurrency and failure-injection evidence (ROUND30)

Engines: **node:sqlite** through the D1 adapter (`tests/round30_factory_handoff.mjs`) and **workerd local D1** with wrangler-applied migrations (`tests/round30_workerd_d1.mjs`). Counts are read from the database; `h/ev/rcp/aud` = handoffs / events / receipts / audit rows for the style.

## Concurrency (commit barrier: every request finishes all reads before any commits)

| Engine | Scenario | Arrivals at commit | Statuses | Loser codes | After |
|---|---|---|---|---|---|
| node:sqlite | T07-prepare | 25 | {"201": 1, "409": 24} | {"HANDOFF_ALREADY_EXISTS": 24} | h=1 ev=1 rcp=1 aud=1 state=PREPARED |
| node:sqlite | T07-dispatch | asserted | {"200": 1, "409": 24} | {"INVALID_STATE": 24} | h=1 ev=2 rcp=2 aud=2 state=HANDED_OFF |
| node:sqlite | T07-dispatch-vs-withdraw | asserted | {"200": 1, "409": 23} | — | h=1 ev=2 rcp=2 aud=2 state=WITHDRAWN |
| workerd D1 | W3-prepare | 20 (asserted) | {"201": 1, "409": 19} | {"HANDOFF_ALREADY_EXISTS": 19} | h=1 ev=1 rcp=1 aud=1 |
| workerd D1 | W3-dispatch | 20 (asserted) | {"200": 1, "409": 19} | {"INVALID_STATE": 19} | h=1 ev=2 rcp=2 aud=2 |

Same-key concurrency: 20 simultaneous acknowledgements with one key → 1 event and 19 replays of the winner's receipt (R30-T07). Lost-response replay of prepare/dispatch/acknowledge/withdraw → byte-identical body, no new rows (R30-T05, R30-W2).

## Failure injection (real `RAISE(ABORT)` triggers)

| Engine | Injected at | Before | After failure | After same-key retry |
|---|---|---|---|---|
| node:sqlite | factory_handoffs INSERT | h=0 ev=0 rcp=0 aud=0 | h=0 ev=0 rcp=0 aud=0 | h=1 ev=1 rcp=1 aud=1 |
| node:sqlite | factory_handoff_events INSERT | h=0 ev=0 rcp=0 aud=0 | h=0 ev=0 rcp=0 aud=0 | h=1 ev=1 rcp=1 aud=1 |
| node:sqlite | handoff_receipts INSERT | h=0 ev=0 rcp=0 aud=0 | h=0 ev=0 rcp=0 aud=0 | h=1 ev=1 rcp=1 aud=1 |
| node:sqlite | audit_log INSERT | h=0 ev=0 rcp=0 aud=0 | h=0 ev=0 rcp=0 aud=0 | h=1 ev=1 rcp=1 aud=1 |
| node:sqlite | factory_handoffs UPDATE (dispatch) | h=1 ev=1 rcp=1 aud=1 | h=1 ev=1 rcp=1 aud=1 | h=1 ev=2 rcp=2 aud=2 |
| node:sqlite | factory_handoff_events INSERT (dispatch) | h=1 ev=1 rcp=1 aud=1 | h=1 ev=1 rcp=1 aud=1 | h=1 ev=2 rcp=2 aud=2 |
| node:sqlite | handoff_receipts INSERT (acknowledge) | h=1 ev=2 rcp=2 aud=2 | h=1 ev=2 rcp=2 aud=2 | h=1 ev=3 rcp=3 aud=3 |
| workerd D1 | factory_handoffs INSERT (prepare) | h=0 ev=0 rcp=0 aud=0 | h=0 ev=0 rcp=0 aud=0 | — |
| workerd D1 | factory_handoff_events INSERT (prepare) | h=0 ev=0 rcp=0 aud=0 | h=0 ev=0 rcp=0 aud=0 | — |
| workerd D1 | handoff_receipts INSERT (dispatch) | h=1 ev=1 rcp=1 aud=1 | h=1 ev=1 rcp=1 aud=1 | — |
| workerd D1 | audit_log INSERT (dispatch) | h=1 ev=1 rcp=1 aud=1 | h=1 ev=1 rcp=1 aud=1 | — |
| workerd D1 | factory_handoffs UPDATE (dispatch) | h=1 ev=1 rcp=1 aud=1 | h=1 ev=1 rcp=1 aud=1 | — |

Every failure returned `500 HANDOFF_COMMIT_FAILED` with a `correlationId`; the tests assert that no `INJECTED`, `SQLITE`, `D1_ERROR`, `constraint`, `INSERT` or `UPDATE` text leaks.

## Drift inside the commit window

| Engine | Drift | Code | Before | After |
|---|---|---|---|---|
| node:sqlite | acknowledger membership removed | FORBIDDEN_ACTOR | h=1 ev=2 rcp=2 aud=2 | h=1 ev=2 rcp=2 aud=2 |
| node:sqlite | acknowledger downgraded to OPERATOR | ROLE_NOT_PERMITTED | h=1 ev=2 rcp=2 aud=2 | h=1 ev=2 rcp=2 aud=2 |
| workerd D1 | acknowledger membership removed | FORBIDDEN_ACTOR | h=1 ev=2 rcp=2 aud=2 | h=1 ev=2 rcp=2 aud=2 |

## Negative role / tenant matrix (R30-T10, R30-T11)

- **prepare** denied for: DESIGN_PATTERN_MASTER, FACTORY_SUPERVISOR (×2), QC_MANAGER, OPERATOR, STORE_CLERK.
- **dispatch / withdraw** denied for: DESIGN_PATTERN_MASTER, QC_MANAGER, FACTORY_SUPERVISOR, OPERATOR.
- **acknowledge** denied for: RELEASE_MANAGER, QC_MANAGER, DESIGN_PATTERN_MASTER, OPERATOR.
- Unexpected outcomes recorded: `[]`.
- Dispatcher (owner) acknowledging own dispatch → 403 `SELF_ACKNOWLEDGE_FORBIDDEN`. Deactivated user with a valid cookie → 401 `ACCOUNT_DISABLED`. Foreign tenant read/acknowledge by direct id → 403. Another style's handoff id on this style's path → 404.
- QC_MANAGER, FACTORY_SUPERVISOR and OPERATOR cannot create a PRODUCTION release. The acknowledging FACTORY_SUPERVISOR cannot author QC evidence or release the lot. QC cannot release the lot. Acknowledgement creates no signoff.

## Tamper (R30-T09)

- DB triggers refuse: package rewrite (even with an otherwise legal transition), illegal transition (ACKNOWLEDGED→PREPARED), event edit, receipt delete, forged ACKNOWLEDGED insert, signoff change under a live handoff.
- With triggers bypassed out of band: tampered package bytes → package serving 409 `HANDOFF_PACKAGE_DRIFT`; tampered upstream release snapshot → serving 409, dispatch 409 and new preparation 409 `RELEASE_EVIDENCE_TAMPERED`. No mutable-source fallback exists.

## Version creation race (R30-T13)

10 concurrent `POST /versions` held at the commit barrier → {"201": 1, "409": 9} (one 201, nine `VERSION_CONFLICT`, no 500). Every committed version has exactly one audit row.

Raw logs: `raw/round30_factory_handoff.log`, `raw/workerd_d1_final.log`.
