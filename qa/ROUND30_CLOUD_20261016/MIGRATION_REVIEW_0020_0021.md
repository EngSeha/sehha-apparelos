# Migration review — `0020_release_atomicity.sql` (ROUND29) + `0021_factory_handoff.sql` (ROUND30)

## Static review
| Item | 0020 (schema 22) | 0021 (schema 23) | Risk to historical data |
|---|---|---|---|
| Column changes | `style_releases` + `evidence_contract`, `candidate_sha256` (nullable) | `production_lots` + `handoff_id` (nullable) | none: additive and nullable; historical rows get NULL |
| Unique indexes | PRODUCTION per (style, version) **only where `evidence_contract IS NOT NULL`** | one live handoff per release (`status<>'WITHDRAWN'`) on a new table | none: historical duplicate PRODUCTION releases are excluded by the partial predicate, so the upgrade cannot fail on them |
| New tables | `release_receipts` | `factory_handoffs`, `factory_handoff_events`, `handoff_receipts` | none |
| Triggers bound to existing tables | `style_releases` update/delete only when `OLD.evidence_contract IS NOT NULL`; `style_versions` `UPDATE OF snapshot_json` blocked for **all** versions | `release_signoffs` insert/update/delete only when a live handoff exists for that release | legacy releases and signoffs stay editable because they have no contract and no handoff. Historical version snapshots become immutable — intentional, since they are release candidates and no code path updates them |
| Cross-dependency | — | handoff guards read `style_releases.evidence_contract` (0020) | ordering is enforced by file number; the Worker requires schema 23 |
| Data rewrites / drops | none | none | none |
| Name collisions | 5 triggers | 11 triggers | none (17 triggers in total including 0019's, all unique) |

## Executed checks
| Check | Engine | Result | Evidence |
|---|---|---|---|
| Upgrade 21 → 22 → 23 over historical styles, versions, 3 releases (incl. two PRODUCTION releases of the same version), signoffs, OPEN + RELEASED lots and audit | node:sqlite | all pre-existing columns byte-identical; new columns NULL; schema 21→22→23 | R30C matrix "upgrade 21→22→23" |
| `PRAGMA integrity_check` / `foreign_key_check` after upgrade | node:sqlite | `ok` / none | R30C matrix |
| Upgraded schema vs fresh install | node:sqlite | identical tables, indexes and triggers with identical DDL | R30C matrix "upgrade vs fresh" |
| Upgraded schema vs fresh install | workerd D1 | identical (117 objects incl. 17 triggers) | R30C-W4 |
| `wrangler d1 migrations apply --local` applying 0020 + 0021 in one run over schema-21 historical data | workerd D1 | schema 23, historical rows identical | R30C-W4 |
| Upgrade 22 → 23 alone (legacy releases + RELEASED lot) | node:sqlite + workerd D1 | identical rows | R30-T12, R30-W6 |
| Re-running wrangler migrations | workerd D1 | "No migrations to apply" | R29-W1, R30-W6 |
| Raw re-execution of 0020 or 0021 SQL | node:sqlite | fails at the first `ALTER` (duplicate column), no data damage | R29-T15, R30-T12 |
| Legacy rows after upgrade remain maintainable | node:sqlite | release note, signoff and lot updates allowed | R30C matrix "legacy behaviour" |
| New Worker on the upgraded historical DB | node:sqlite | `/api/health` 200, schema 23 | R30C matrix |
| New Worker on a schema-22 DB | node:sqlite + workerd D1 | 503 fail-closed | R30-T12, R30-W6 |
| `PRAGMA integrity_check` on workerd D1 | workerd D1 | **not available**: D1 refuses the pragma (`SQLITE_AUTH`) | documented limitation; integrity proven on node:sqlite |

## Residual risks (not fixed in ROUND30)
- **Retrying a migration that failed partway:** the files are not idempotent at SQL level. Each starts with `IF NOT EXISTS` objects, but the `ALTER TABLE` statements are not idempotent, so safety relies on wrangler's `d1_migrations` tracking. If a remote apply ever fails part-way, inspect it before re-running. Whether D1 applies a whole migration file atomically was **not verified** here.
- **Rollback:** a Worker rollback needs a D1 Time Travel restore, because the schema check requires an exact version. Data written after the upgrade would be lost by that restore.
- **Remote D1:** not touched (`BLOCKED_ENV`).
