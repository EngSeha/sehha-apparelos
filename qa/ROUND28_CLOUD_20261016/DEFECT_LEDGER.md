# Defect ledger
| ID | Sev | Defect | Status |
|---|---|---|---|
| D1 | P0 | Engineering readiness (schema 18) was advisory; PRODUCTION release froze a Style without it (declared in PR#1 and docs/APPARELOS_PRODUCT_READINESS.md) | FIXED: POST /releases PRODUCTION now returns 409 unless readiness = ELIGIBLE_FOR_MANUAL_RELEASE_REVIEW; evidence frozen in gate_json + snapshot_json.engineeringReadiness |
| D2 | P1 | Release insert, styles status update and audit are 3 separate statements (no D1 batch) — partial failure can leave a release row without status/audit | OPEN |
| D3 | P1 | Concurrent releases compute MAX(release_no)+1; UNIQUE(style_id,release_no) protects data but the loser gets a 500, not a clean 409 / idempotent replay; no idempotency key | OPEN |
| D4 | P1 | Readiness is evaluated on LIVE engineering tables, not on the frozen Style Version; engineering edits after versioning are not versioned (evidence is frozen only at release time) | OPEN (design decision needed) |
| D5 | P2 | Gate does not check engineering-vs-legacy BOM/operations reconciliation (called out in readiness doc) | OPEN |
| D6 | P2 | Lot/handoff endpoints trust release_type=PRODUCTION; they do not re-verify engineeringReadiness presence for pre-existing releases (legacy rows have none) | OPEN — legacy releases need a policy |
