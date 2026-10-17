# Handoff to the independent re-gate (Codex)

The implementer does not certify this work. The verdict `ACCEPTED_FOR_ROUND31_BASE` belongs to the independent reviewer alone.

## Source
- Repository: `EngSeha/sehha-apparelos`
- Audited original: PR #4, `claude/round30-factory-handoff` @ `5f928e2418729986ae38f1ae3b06c29cde22cbc6`
- Corrective: PR #5, `claude/round30-p1-corrective`, base = PR #4 head
  - code commit `2740a9d`
  - final HEAD = the evidence commit reported on PR #5

## Reproduce the original defects (read-only; on `5f928e2`)
```
git checkout --detach 5f928e2 && npm ci
mkdir -p qa/ROUND30_P1_CORRECTIVE_20261017
git show <PR5_HEAD>:qa/ROUND30_P1_CORRECTIVE_20261017/repro_p1.mjs > qa/ROUND30_P1_CORRECTIVE_20261017/repro_p1.mjs   # it imports ../../tests/*
node qa/ROUND30_P1_CORRECTIVE_20261017/repro_p1.mjs
```
Expected on `5f928e2`: `P1-A defectReproduced:true` (prepare 201, dispatch 200, ack 200, lot 201) and `P1-B defectReproduced:true` (201 then 500).
The same script on the PR #5 HEAD should print `defectReproduced:false` for both.

## Rerun on the corrective HEAD
```
npm ci && npm run check && npm test            # expect 29 suites / 925
npm run test:workerd-d1                        # expect 75 (55 inherited + 20 new); local workerd, not remote D1
node tests/round30_p1_corrective.mjs           # 89 rows; MATRIX lines = AUTHORITY_TOCTOU_MATRIX / LOT_IDEMPOTENCY_MATRIX
npm audit --audit-level=high && git diff --check 5f928e2 HEAD
cd qa/ROUND30_P1_CORRECTIVE_20261017 && sha256sum -c SHA256SUMS.txt
```
Browser (optional; local `wrangler dev` with migrations applied to a `--persist-to` directory):
`BASE=… PERSIST=… OUT=… PLAYWRIGHT_MODULE=… node qa/ROUND30_P1_CORRECTIVE_20261017/browser_lot_retry_check.mjs`

## Suggested adversarial angles (independent of the implementer's tests)
1. Change any required signer's role, membership, tenant or `active` flag between the last read and `env.DB.batch` (on prepare). The guard is in `src/factory_handoff.js` (`signerGuard`) plus the trigger `trg_factory_handoffs_signer_authority`.
2. Change the actor's role during dispatch, acknowledge, withdraw and lot opening (`actorRoleSql`).
3. Insert rows straight into `factory_handoffs` and `production_lots`, bypassing the Worker.
4. Lot opening:
   - lost response, then replay after later lot changes;
   - same key with a different body;
   - same key from another actor or tenant;
   - concurrent requests with the same key and with different keys;
   - injected failure on each of the three writes.
5. Confirm that the multi-lot-per-handoff contract is unchanged (several lot codes from one handoff).
6. Upgrade a schema-23 DB that already holds handoffs; check withdraw-only behaviour and lot refusal.

## Known limits (do not treat as passed)
BLOCKED_ENV (remote D1, deployed preview), BLOCKED_NO_TENANT_ARCHIVE_MODEL, BLOCKED_NO_HOLD_MODEL, BLOCKED_NO_SESSION_STORE, BLOCKED_NO_PDF_ENGINE. Production Pilot stays BLOCKED.
