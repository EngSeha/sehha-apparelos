# Cloudflare account and Meta licence gate — `BLOCKED_META_OWNER_CONSENT` / `BLOCKED_ENV`

## Status at the end of W01
| Gate | Status | Evidence |
|---|---|---|
| Cloudflare credentials reachable by this session | **Not present** (`BLOCKED_SECRET_HANDOFF`) | operator script `ops/workers_ai_vision_smoke.mjs` exits with that code when `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` are absent |
| Network to Cloudflare from this container | **Denied by the environment proxy** (`BLOCKED_ENV`) | `api.cloudflare.com`, `developers.cloudflare.com`, `workers.cloudflare.com`, `sparrow.cloudflare.com` → 403 / connect_rejected |
| Meta Llama 3.2 Community licence for the account | **Not accepted; not accepted on the owner's behalf** | code never sends `agree`; error class `5016`/licence text maps to `BLOCKED_META_OWNER_CONSENT` (503) |
| Paid plan, payment method, broader token | none requested, none used | — |
| Image inference requests used | **0 of 3** (`BLOCKED_BUDGET` guard in place) | smoke-script counter is written before each request |

The model catalogue screenshot and token-creation screen the owner described are **not** inference evidence and are not counted as such.

## How the binding is wired (safe default)
- Top-level `wrangler.jsonc` has **no** `ai` binding: a top-level binding makes plain `wrangler dev` open a remote proxy session (login + network) and breaks offline development and CI. This was tested in this session (crash on `workers.cloudflare.com` proxy).
- An opt-in environment `env.vision` (name `sehha-apparelos-vision-preview`, `workers_dev:false`) carries `"ai":{"binding":"AI"}`, `AI_PROVIDER_ORDER=workers_ai`, `VISION_DAILY_LIMIT=3`, `VISION_MAX_IMAGES_PER_RUN=2`. `wrangler deploy --dry-run --env vision` resolves `env.AI` locally.
- At runtime the binding needs **no token**. The REST smoke script is only for an operator on a private machine.

## Owner steps to unblock (owner-only decisions)
1. Read the Meta Llama 3.2 Community License / Acceptable Use Policy and decide. Acceptance is an owner act on the Cloudflare account; this code will not do it.
2. Either (a) run `npx wrangler dev --env vision` on the owner's own machine after `wrangler login`, or (b) on a private machine export `CLOUDFLARE_ACCOUNT_ID` and a token scoped to *Workers AI Read* for one account in the shell environment (never in chat, files, Git, CI or command-line arguments) and run `node qa/AI_TP_W01_20261017/ops/workers_ai_vision_smoke.mjs <private-image>`.
3. For a cloud session to test it: add `api.cloudflare.com` to the environment's allowed network domains and provide the token as an environment secret — separate owner authorization.
4. No deploy of `env.vision` without a separate explicit authorization.
