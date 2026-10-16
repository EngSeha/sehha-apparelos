# Authority matrix (ROUND30, server-enforced)

Owners = PLATFORM_ADMIN (DB flag), PLATFORM_OWNER, WORKSPACE_OWNER. Roles are existing modern `memberships.role` values.

| Authority | Action / capability | Allowed | Explicitly denied (tested) | Extra rule |
|---|---|---|---|---|
| (i) Technical Production Release | `PRODUCTION_RELEASE_CREATE` | owners, RELEASE_MANAGER, DESIGN_PATTERN_MASTER | QC_MANAGER, FACTORY_SUPERVISOR, OPERATOR | in-transaction role guard (ROUND29 batch) |
| Release signoff | existing `canSignRole` | per role key | requester of the release | `SELF_SIGNOFF_FORBIDDEN`; frozen once a live handoff exists |
| (ii) Factory package prepare | `HANDOFF_PREPARE` | owners, RELEASE_MANAGER | DESIGN_PATTERN_MASTER, FACTORY_SUPERVISOR ×2, QC_MANAGER, OPERATOR, STORE_CLERK | latest frozen release only; independent signoffs |
| (ii) Dispatch | `HANDOFF_DISPATCH` | owners, RELEASE_MANAGER | DESIGN_PATTERN_MASTER, QC_MANAGER, FACTORY_SUPERVISOR, OPERATOR | release must still be latest |
| (ii) Withdraw (pre-dispatch only) | `HANDOFF_WITHDRAW` | owners, RELEASE_MANAGER | same as dispatch | reason ≥ 5 chars |
| (ii) Factory acknowledgement | `HANDOFF_ACKNOWLEDGE` | owners, FACTORY_SUPERVISOR, PRODUCTION | RELEASE_MANAGER, QC_MANAGER, DESIGN_PATTERN_MASTER, OPERATOR | acknowledger ≠ dispatcher (`SELF_ACKNOWLEDGE_FORBIDDEN`, also a DB CHECK) |
| Inspect package | `HANDOFF_INSPECT` | any active member except simple roles (existing guided-surface rule blocks OPERATOR) | foreign tenant | integrity verified before serving |
| Production Lot creation | existing `LOT_CREATE` | owners, FACTORY_SUPERVISOR, PRODUCTION | — | requires ACKNOWLEDGED handoff on a FROZEN_VERIFIED release; guarded inside the batch |
| (iii) Production Lot release | `LOT_RELEASE` (renamed from generic `RELEASE`) | owners, RELEASE_MANAGER | FACTORY_SUPERVISOR (the acknowledger), QC_MANAGER | existing QC/reconciliation gates unchanged |
| (iv) Application deployment | none in the app | CI / wrangler credentials outside the Worker | every app role (no route exists) | not an in-app authority |

All checks re-read `users.active`, `users.is_platform_admin` and `memberships.role` from D1; session cookie claims are never authority (`requireAuth` now refuses deactivated/removed users with 401 `ACCOUNT_DISABLED`).
