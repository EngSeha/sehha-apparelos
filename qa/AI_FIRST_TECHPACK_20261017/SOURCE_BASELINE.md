# Source baseline

| Item | Value |
|---|---|
| Repository | `EngSeha/sehha-apparelos` |
| Baseline (modern) | `codex/apparelos-preview21-integration` @ `9bcd13d610f3e209e343e37f185bf3b866c960cc`, re-verified live on 2026-10-17 |
| `main` | `b166acc…` — historical Preview03, **not** used |
| Feature branch | `claude/ai-first-techpack` → Draft PR #6 (base = the baseline above) |
| Code commit | `eb4aee5` (an evidence commit follows; its id is in PR #6) |
| Security stack | PRs #2–#5 (`c779d48`, `4e15623`, `5f928e2`, `8e381e8`) **untouched**; PR #5 awaits the independent Codex re-gate |
| Baseline gate at `9bcd13d` | `npm ci` OK · `npm run check` OK · `npm test` **24 suites / 539 PASS** (`raw/baseline_*_9bcd13d.log`) |

## Source inventory used
| Area | Existing file / function | How this slice uses it |
|---|---|---|
| Image upload | `src/worker.js` `POST /api/styles/:id/assets` (mime/size/magic-byte checks, R2, tenant + `ASSET_UPLOAD`) | reused unchanged for intake photos |
| Vision | `analysisPrompt`, `anthropicAnalyze*`, `openAIAnalyze*`, `ai_runs` | new classification prompt + strict validator in `src/garment_intake.js`; runs recorded in the same `ai_runs` table (`request_kind=GARMENT_CLASSIFICATION`) |
| Blueprints | `GARMENT_BLUEPRINTS` (POM codes per family) | category POM codes reuse the same codes (e.g. JACKET: BODY_LENGTH, CHEST, BACK_WIDTH, SLEEVE_*) |
| POM / BOM / ops | `measurements`, `bom_items`, `operations` tables + upsert routes | owner answers written to `measurements` as OWNER_SUPPLIED; confirmed BOM/ops rows flow into the Tech Pack |
| Grading | `gradeMatrix`, `grading_rules`, `size_bands` | graded columns only from approved rules (no auto-grading) |
| Outputs | `outputPage` (HTML, `window.print()` only) | **no PDF existed**; new `src/techpack_pdf.js` + `src/pdf_engine.js` |
| Factory | releases / handoff / lots | **not touched** (factory gate comes last; PR #5 pending) |

## Divergence / integration requirements
- This branch adds `migrations/0023_ai_intake_techpack_documents.sql` (schema **21 → 22** here). The security stack adds 0020–0022 (schema 24). The file is numbered 0023 so it sorts after them; on integration only its `schema_version` row and `SCHEMA_VERSION` change (→ 25), plus the inherited-test schema literals.
- `wrangler.jsonc` gains `"browser": {"binding": "BROWSER"}` (Cloudflare Browser Rendering). Not deployed.
- The baseline test harness's D1 mock gains `batch()` (BEGIN/COMMIT/ROLLBACK), identical to the one the security stack added.
