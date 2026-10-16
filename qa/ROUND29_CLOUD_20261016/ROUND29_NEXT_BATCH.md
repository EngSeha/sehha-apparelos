# ROUND29 → next batch (residual, highest value first)

1. **Factory Handoff as an atomic, idempotent transition (P0 for pilot).** Today handoff readiness is computed on read and signoffs are individual upserts. Introduce an explicit `HANDOFF` commit (same pattern: guarded INSERT + receipt + audit in one batch) that freezes the 4 signoffs, open-review state and completeness hash; decide and enforce the policy for `LEGACY_UNVERIFIED` releases (recommended: fail closed and require a new frozen version).
2. **Global actor re-validation (R29-F4).** Make `requireAuth` reject `users.active=0` and make `requireOrg` read `is_platform_admin` from the DB; add a session version (`users.session_epoch`) to allow revocation without a session table (R29-F6).
3. **Release-creation role policy (R29-F7).** Owner decision: which membership roles may create a PRODUCTION release; enforce in the guard predicate.
4. **Production Lot creation from a handoff, not from a release number.** Bind lots to the handoff receipt; re-verify `evidenceStatus=FROZEN_VERIFIED`.
5. **HOLD/maintenance model (R29-F5)** at tenant and style level, added as one more guard predicate in every factory transition.
6. **Version creation race (R29-F9)** and the global 500 sanitizer (R29-F8).
7. **Remote proof:** apply 0020 on an approved non-production D1 (Time Travel bookmark first), run `tests/round29_workerd_d1.mjs`-equivalent against it, and a browser pass on a preview deployment (requires R2 enablement, `BLOCKED_EXTERNAL_R2_ACCOUNT_ENABLEMENT`).
