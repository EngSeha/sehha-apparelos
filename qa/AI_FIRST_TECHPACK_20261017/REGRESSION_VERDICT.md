# Regression verdict

| Gate (directive §G) | Result | Evidence |
|---|---|---|
| 1. Baseline | PASS: `9bcd13d` 24 / 539; final 25 suites / **607** on Node 22.22 and 24.22; `npm audit --audit-level=high` 0; `git diff --check` clean | `raw/baseline_*`, `raw/test_node22.log`, `raw/test_node24.log`, `raw/audit.log` |
| 2. Image intake | **MOCK_VISION_PASS**; LIVE_VISION / LIVE_JK003: **BLOCKED_LIVE_VISION** | `AI_PROVIDER_STATUS.md` |
| 3. Adaptive questioning | PASS (jacket / trousers / shirt / abaya / other differ; prefilled values are not re-asked; basis ambiguity blocks approval; owner can change the category) | `GARMENT_CLASSIFICATION_AND_QUESTIONS.md` |
| 4. Real PDF (highest priority) | **LOCAL_PDF_PASS** 19/19; REMOTE_PDF: **BLOCKED_ENV** | `TECHPACK_PDF_ACCEPTANCE.md` |
| 5. Pattern | **PATTERN_PENDING** (explicit gaps; no geometry generated) | `PATTERN_SIZE_RUN_STATUS.md` |
| 6. Quantity matrix | PASS (size × colour totals; material only from approved consumption; invalid input → 400) | TP-T08..T10 |
| 7. Safety | PASS (tenant 403, roles, immutability, drift/injection, idempotent approval) | `TENANT_SECURITY_TESTS.md` |
| Browser E2E (Chromium, local `wrangler dev`) | 13/13, three consecutive runs | `raw/browser_intake.log`, `screens/` |
| GitHub CI | runs `npm ci`, `check`, `npm test`; result reported on PR #6 | — |

## Distinct counts
| Count | Value |
|---|---|
| Inherited assertions | 539 (unchanged in number) |
| New `tests/ai_first_techpack.mjs` | 68 |
| `npm test` total | 607 |
| PDF acceptance checks (separate script, local `wrangler dev`) | 19 |
| Browser checks | 13 |

The PDF and browser checks are not part of CI: they need a local Browser Rendering session, and CI would have to download Chrome.

## Inherited tests touched (no assertion weakened)
- migration lists gained `0023` (batch04–10, `test_helpers`);
- schema literal `'21'` → `'22'` in health/metadata checks;
- the D1 mock gained `batch()`.

## Implementer verdict
**`IMPLEMENTER_FOCUSED_PASS` for the PDF-first slice.** It is not an independent review, does not authorize production, and makes no remote claim. Live vision, the remote PDF and pattern remain BLOCKED / PENDING as stated.
