# Schema / migration evidence — `0021_factory_handoff.sql` (schema 22 → 23)

Additive only:
- 3 tables: `factory_handoffs`, `factory_handoff_events`, `handoff_receipts`
- 1 partial unique index: one live handoff per release
- 1 lookup index
- 1 nullable column: `production_lots.handoff_id`
- 11 triggers:
  - insert-must-be-PREPARED
  - package immutable
  - legal transitions with CAS version
  - no delete (×3 tables)
  - immutable events and receipts
  - signoffs frozen by a live handoff (insert, update and delete)
- `schema_version=23`

Nothing was dropped, and no applied migration was edited. The number was chosen after verifying that the modern chain ends at `0020_release_atomicity.sql`.

| Check | Engine | Result | Test |
|---|---|---|---|
| Fresh install 0001→0021 | node:sqlite | schema 23; 3 tables, live-release index, 11 triggers | R30-T12 #1 |
| Fresh install via `wrangler d1 migrations apply --local` | workerd D1 | 21 ✅, worker reports schema 23 | R30-W1 |
| Upgrade 22→23 with 2 legacy PRODUCTION rows for the same version, a RELEASED lot and a legacy signoff | node:sqlite | rows byte-identical; lot `handoff_id` NULL; legacy signoffs still editable (no handoff) | R30-T12 #2/#3 |
| Same upgrade through wrangler (0001–0020 applied, rows inserted, then 0021) | workerd D1 | rows identical, 11 triggers present | R30-W6 #2 |
| Re-running wrangler migrations | workerd D1 | "No migrations to apply" | R30-W6 #3 |
| Raw re-execution of 0021 | node:sqlite | fails at the `ALTER TABLE` (duplicate column), data and schema intact | R30-T12 #3 |
| Old database, new Worker | node:sqlite + workerd D1 | schema-23 Worker on a schema-22 DB → **503** (fail closed) | R30-T12 #4, R30-W6 #1 |
| ROUND29 objects still enforced | both | ROUND29 suites green (67 + 17) | regression |

**Deployment order** (none was executed remotely):
1. Take a D1 Time Travel bookmark.
2. Run `npm run db:migrate:remote` (applies 0020 and 0021 if absent).
3. Deploy the Worker.

**Rollback:** redeploying the previous Worker on schema 23 also returns 503 (strict schema check), so a Worker rollback has to be paired with a D1 restore to the bookmark. Additive tables mean data written by ROUND30 would be lost by such a restore, so that has to be decided before the restore. **Remote D1 was not touched (`BLOCKED_ENV`).**

Test fixtures: 19 test files gained only `0021_…` in their migration arrays and schema literal `23`. Lot suites that insert PRODUCTION releases directly now call `admitReleasesForLotFixtures(db)`, which walks those releases through the real DB state machine (documented fixture shortcut). batch07 now signs with independent users and asserts that self-signing is refused.
