# Owner policy as implemented (ROUND30)

| Policy (brief, Phase B) | Implementation | Evidence |
|---|---|---|
| B1 Legacy PRODUCTION releases stay read-only; no new Factory Handoff or Production Lot from them | `prepare` → 409 `LEGACY_RELEASE_NOT_ELIGIBLE`; lot POST → 409 `LEGACY_RELEASE_NOT_ELIGIBLE`; both also guarded in SQL (`evidence_contract`) | R30-T02 |
| B1 No backfilled hashes, no fake approval, no rewriting | legacy rows are never written; lot list exposes `authorityReview:'LEGACY_RELEASE_REVIEW_REQUIRED'` on existing lots for separate review | R30-T02 byte-compare, R30-T12 upgrade |
| B1 Path forward | create a new Style Version and a new evidenced PRODUCTION release (existing ROUND29 flow). A human-controlled remediation path is **not** built (needs explicit owner design) | NEXT_BATCH.md |
| B2 Production Release is a server-side action permission | `PRODUCTION_RELEASE_CREATE` = owners, RELEASE_MANAGER, DESIGN_PATTERN_MASTER; checked before and inside the commit | R30-T10 |
| B2 Independent signoffs; requester cannot sign own approval | signoff POST: release creator → 403 `SELF_SIGNOFF_FORBIDDEN`; handoff prepare requires Engineering (DESIGN/PATTERN), PRODUCTION and QC signed by three different people, none the release requester, each still an active member allowed to sign | batch07 (new assertion), R30-T01, computed summary `independence` |
| B2 QC cannot exercise release authority; factory ACK is not release authority | QC → 403 on PRODUCTION release and on lot release; acknowledging factory supervisor → 403 on QC evidence and lot release | R30-T10, R30-T11 |
| B3 Four distinct authorities | see AUTHORITY_MATRIX.md; lot release action renamed `LOT_RELEASE` (no generic `RELEASE`) | R30-T10/T11 |
| B4 Frozen release snapshot is the only upstream contract | handoff package built only from `style_releases` (snapshot, manifest, gate, candidate hash) + frozen signoffs; integrity re-verified before prepare, dispatch and serving; drift fails closed with no mutable fallback | R30-T09 |
