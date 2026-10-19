# Live vision evidence — `BLOCKED_LIVE_VISION` (no live inference was performed)

**No live model call happened in W01.** Nothing in this folder is `LIVE_VISION_PASS`. The reasons are in `CLOUDFLARE_ACCOUNT_AND_LICENSE_GATE.md` (no credentials, Cloudflare hosts denied, Meta licence not accepted).

## What is implemented and proved with a stubbed binding (`tests/ai_tp_w01_vision.mjs`, 43 assertions)
The stub answers by the SHA-256 of the image bytes it receives, so only pixels can steer it. These rows prove wiring and policy, not model quality.

| Property | Row(s) |
|---|---|
| Exact model id `@cf/meta/llama-3.2-11b-vision-instruct`; payload keys only `prompt,image,max_tokens,temperature` | W-V01, W-V02 |
| **Blind request**: no owner notes, style code, filename, expected category, measurements or button count in the prompt | W-V03 |
| Bytes sent = bytes stored (same SHA-256 as the upload) | W-V04 |
| Result stored as a hypothesis; model "probability" discarded; owner still confirms the category | W-V05, W-V06 |
| Misleading owner text vs image: disagreement surfaced *after* the blind result (`OWNER_TEXT_CONFLICTS_WITH_IMAGE`) | W-V07 |
| Two images disagreeing → `CONFLICTING`, confidence LOW, alternatives listed | W-V08 |
| 11 provider failure classes (licence 5016, budget 3036 / HTTP 429, model 5007, 500, 403, timeout, prose, truncated JSON, unknown category, injected field) → owner-actionable codes, no silent mock, intake untouched; unknown errors → `VISION_PROVIDER_ERROR` | W-V09-*, W-V10 |
| Idempotency-Key replay / reuse with different images / concurrent / malformed | W-V11…W-V14 |
| Per-tenant daily quota, per-style throttle, ≤2 images per run, URL instead of asset id (SSRF) rejected, image required, 1×1 rejected, both cross-tenant directions refused | W-V15…W-V22 |
| Upload guard: resolution bomb, spoofed magic, invalid base64, JPEG EXIF/GPS strip, duplicate, WebP dimensions, non-JPEG input untouched by the JPEG stripper, PNG and WebP metadata strip, unauthenticated / cross-tenant `/uploads` | W-U01…W-U11 |

## Operator smoke script (ready, not run)
`ops/workers_ai_vision_smoke.mjs`: environment-only credentials (never printed), blind prompt, 3-request budget counted before sending, 60 s timeout, no retries, never sends `agree`, sanitized report written outside the repository. In this session it returned `BLOCKED_SECRET_HANDOFF`.

## JK-003 photograph
The owner attached a photo of the charcoal jacket in chat. It was **not** sent to any provider and is not stored in Git. Any description of it in this pack comes from the owner's own written facts (`tests/techpack_fixtures.mjs` → `JK003`), not from a model.
