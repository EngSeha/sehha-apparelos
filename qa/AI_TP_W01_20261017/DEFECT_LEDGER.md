# Defect ledger (W01)

| ID | Severity | Defect | Status | Fix / evidence |
|---|---|---|---|---|
| D-01 | HIGH (integrity) | Live providers received the owner's notes in the prompt, so a "recognition" could echo typed text | FIXED | blind prompt for every live provider; owner text compared after the result (W-V03, W-V07) |
| D-02 | MEDIUM (privacy) | Upload metadata stripping covered JPEG only; PNG `eXIf`/text and WebP `EXIF`/`XMP` (GPS, device ids) were stored | FIXED | `9fc395b`, W-U10, W-U11 |
| D-03 | MEDIUM (data safety) | Approval wrote R2 then D1 with no cleanup: a D1 failure or a lost race left an orphan PDF that looks approved | FIXED | `commitApproval`, E-C06…E-C08; reconciliation E-C10…E-C12 |
| D-04 | MEDIUM (info leak) | Unexpected errors in intake / Tech Pack routes returned raw `e.message` (SQL, paths) | FIXED | route-level `sanitized()`, E-C13 (PR #5 already sanitizes globally) |
| D-05 | LOW | A browser that fails to start produced a generic 500 instead of `PDF_ENGINE_UNAVAILABLE` | FIXED | `pdf_engine.js`, E-C14, D11 |
| D-06 | LOW (UX, from PR #6) | `api()` dropped the server error `code`; the STALE_VERSION message never appeared | FIXED | `public/app.js` |
| D-07 | LOW (ops) | A top-level `ai` binding breaks offline `wrangler dev` / CI | AVOIDED | opt-in `env.vision` |
| D-08 | LOW (cosmetic) | Bilingual section titles: English and Arabic touch without a gap in the PDF | OPEN | renders p1/p8; CSS spacing in `h2/h3 .en` |
| D-09 | INFO (env) | Miniflare local Chrome cannot start as root in this container | OPEN — BLOCKED_ENV | needs a non-root runner or the owner's machine; not worked around |
| D-10 | INFO (integration) | Schema 22 (PR #6/W01) vs 24 (PR #5) conflict | RESOLVED IN SCRATCH | schema 25; see `PR5_PR6_W01_SCRATCH_INTEGRATION.md` |
