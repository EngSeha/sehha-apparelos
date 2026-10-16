# Production authority matrix (as verified this round)
| Authority | Mechanism | Verified |
|---|---|---|
| Technical Release (PRODUCTION) | releaseGate (frozen snapshot) AND engineeringReleaseGate (live) | YES, tests/round28_engineering_release_gate.mjs |
| Release signoffs (DESIGN/PATTERN/PRODUCTION/QC) | /releases/:n/signoffs | existing batch07 only |
| Factory Handoff / Lot Release / Deployment | separate endpoints (/production-lots/.../release, wrangler deploy) | NOT re-audited this round |
| Engineering approvals | assertApprovalRole per domain | existing engineering_foundation suite |
| Tenant isolation on release POST | requireOrg | YES (negative test, no row created) |
| Role matrix for non-owner release | not tested | BLOCKED/NEXT |
