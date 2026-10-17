# Tenant and safety tests (`TEST_MATRIX.csv`, area SECURITY / VISION)

| ID | Scenario | Result |
|---|---|---|
| TP-S01 ×9 | Owner of another tenant calls each route on our style: read intake, analyze, answers, list, create revision, preview, pdf, approve, pattern status | 403 each, no data |
| TP-S02 | Revision number not belonging to the style | 404 |
| TP-S03 | FACTORY_SUPERVISOR / QC_MANAGER approve a Tech Pack | 403 `ROLE_NOT_PERMITTED` |
| TP-S04 | DESIGN_PATTERN_MASTER approves | role accepted; stops at the PDF-engine check in the node harness |
| TP-S05 | OPERATOR (guided surface) reads intake | 403 (existing simple-role rule) |
| TP-S06 | Rewrite a DRAFT snapshot by SQL | `RAISE TECHPACK_SNAPSHOT_IMMUTABLE` |
| TP-S07 | Mark APPROVED by SQL without approver / PDF hash | CHECK constraint failure |
| TP-S08 | Modify or delete an APPROVED revision by SQL | `RAISE TECHPACK_APPROVED_IMMUTABLE` |
| TP-S09 | Intake and Tech Pack actions | audited (`audit_log`) |
| TP-Q06 | Stale `expectedVersion` | 409 `STALE_VERSION` |
| TP-T05 / TP-T12 | Approve with an incomplete gate / without a PDF engine | 409 / 503; stays DRAFT |
| TP-V03 ×7 | Drifted or injected provider JSON (extra `approve`, smuggled `measurements`, bad enums) | rejected |
| TP-V05 | Prompt injection via owner notes / image text | treated as quoted data |
| TP-V07–V09 | Live provider without a key / drift / plumbing | 503 / 502 / recorded |

## Other protections
- **Preview:** served with `Content-Security-Policy: default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'`. No scripts and no network fetches from the document. All text is HTML-escaped.
- **Images:**
  - inherit the existing upload checks (jpeg/png/webp/gif, 10 MB, magic bytes, tenant + `ASSET_UPLOAD`);
  - each image's SHA-256 is frozen in the snapshot and re-verified before it is embedded;
  - image payloads are never logged;
  - generated fixtures only; no client photos are committed.
- **Approval:**
  - is idempotent; a concurrent second approval returns the winner's frozen hash;
  - the audit row for an approval is only written when the CAS actually committed.
- **Approved files:** an approved PDF missing from storage returns `410 FROZEN_PDF_MISSING`; one whose hash fails returns `409 FROZEN_PDF_DRIFT`. It is never re-rendered.
- **Factory protections:** factory P1 protections live in PRs #3–#5 and are not on this baseline. This slice does not touch releases, handoffs or lots.
- **Deployment:** none performed.

## Known limits
- **Draft rendering cost:** each draft PDF download renders a new browser session. Add rate-limiting before broad use.
- **Session revocation:** depends on the baseline's session model. Disabled accounts on this baseline follow the existing `requireAuth`; the account re-check hardening is in PR #4.
