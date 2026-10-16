# Blockers and next slice
Blockers (unchanged, external): BLOCKED_EXTERNAL_R2_ACCOUNT_ENABLEMENT (R2 10042); EXCEL_REFERENCE_NOT_PROVIDED; no real D1/browser proof this round.
Next slice (Prompt B): D2+D3 — make POST /releases atomic (db.batch for release+status+audit) with an idempotency key and clean 409 on release_no race; then negative role matrix and concurrent claims on Lot/Handoff, plus policy for legacy PRODUCTION releases lacking engineeringReadiness (D6).
