# Next batch (residual, highest value first)

1. **Factory supervisor acknowledge task (R30-D12):** a task card on the SUPERVISOR guided surface, listing HANDED_OFF packages for the supervisor's tenant, with the frozen package view and an acknowledge button. It reuses `POST /handoffs/:id/acknowledge`; no new authority.
2. **Production Lot execution atomicity (R30-D14):** move lot planning, execution, material, QC and release writes to the same batch + guard + receipt pattern. Bind lot release to the lot's handoff provenance.
3. **Legacy remediation path (owner design):** an explicit, human-approved remediation for LEGACY_UNVERIFIED releases that already have open lots. It needs owner approval and provenance. Today: a new evidenced release is required, and existing lots are flagged.
4. **Session revocation (R30-D10):** add `users.session_epoch` checked in `requireAuth` and an owner action to revoke all of a user's sessions. Per-cookie revocation needs a session table.
5. **HOLD model (R30-D11):** a tenant/style HOLD state added as one more guard predicate in release, handoff and lot commits.
6. **Worker/schema compatibility window (R30-D16):** let a Worker accept a declared compatible schema range, so a Worker rollback doesn't require a D1 restore.
7. **Remote proof:** apply 0020/0021 on an approved non-production D1 (Time Travel bookmark first), run the workerd suites against it, and do a browser pass on a deployed preview. Blocked by R2 enablement (`BLOCKED_EXTERNAL_R2_ACCOUNT_ENABLEMENT`) and by access.
8. PDF rendering of the frozen package with pagination tests (`BLOCKED_NO_PDF_ENGINE` today).
