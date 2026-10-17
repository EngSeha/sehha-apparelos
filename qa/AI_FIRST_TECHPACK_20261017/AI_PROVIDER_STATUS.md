# AI provider status

| Status | Meaning here |
|---|---|
| **MOCK_VISION_PASS** | The intake runs end-to-end with the mock provider. It reads only the owner's typed text and the filenames, never claims to have seen pixels, is capped at LOW confidence and is labelled MOCK everywhere (API, UI, PDF). Tests TP-A01, TP-V06; browser check step 3. |
| **LIVE_VISION_PASS** | **BLOCKED_LIVE_VISION** — no `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` exists in this environment, and Git access does not imply inference credits. |
| **LIVE_JK003_PASS** | **BLOCKED** — the owner's JK-003 photo is not available in Claude Cloud, and no live provider is bound. The JK-003 review uses the owner's written facts only (`JK003_REVIEW.md`). |

## Adapter design (`src/garment_intake.js`)
- `GarmentVisionProvider` equivalents: `mockClassify` (deterministic) and `liveClassify(env, 'anthropic'|'openai', images, prompt)`.
- **Prompt** (`classificationPrompt`):
  - Image text and owner notes are treated strictly as data; the owner notes are JSON-quoted.
  - The model must not invent an unseen back, the interior, composition, GSM or measurements.
  - Allowed categories are listed explicitly; UNKNOWN or LOW is preferred over a guess.
- **Validation** (`validateClassification`):
  - Unknown top-level keys are rejected, including injected fields such as `approve` or a smuggled `measurements` key.
  - Categories and alternatives must come from the list.
  - Confidence, evidence and view must be valid enum values; probability must be in 0..1.
  - Text is length-capped and control characters are stripped.
  - Drift → `502 VISION_SCHEMA_DRIFT`, the `ai_runs` row is FAILED, and nothing is applied.
- **Recorded per run** (`ai_runs.output_json.meta`): `mode` (MOCK/LIVE), provider, model, SHA-256 of every input image, elapsed ms, provider usage when returned, attempts.
- **Never automatic:** results are an `AI_HYPOTHESIS`. The category needs an owner click (OWNER_CONFIRMED / OWNER_SELECTED), and no measurement is ever taken from pixels.

## What was tested without a key
| Test | What it shows |
|---|---|
| TP-V07 | An explicit live provider without a key → `503 BLOCKED_LIVE_VISION`; the intake is untouched. |
| TP-V08 | A stubbed transport returning drifted JSON → rejected; the run is FAILED. |
| TP-V09 | A stubbed transport returning valid JSON → the image is sent as an Anthropic base64 block, and the run is recorded as LIVE with model and input hash. **This verifies adapter plumbing only. It is not a live inference result.** |

## Owner action to enable live vision
`wrangler secret put ANTHROPIC_API_KEY` (optionally `ANTHROPIC_MODEL`), or `OPENAI_API_KEY` / `OPENAI_MODEL`. Then run one real JK-003 photo through «تعرّف على القطعة» and record the result as LIVE_JK003 evidence. The provider's model must accept images; verify it with that first real run.
