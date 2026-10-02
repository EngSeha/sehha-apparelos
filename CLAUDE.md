# SEHHA ApparelOS — Claude Project Instructions

## Ownership
- Product owner: SEHHA IT.
- MOHSEN Fashion Designer is the first professional tenant/workspace, not the software owner.
- Architecture must remain multi-tenant and ready for licensing/entitlements.

## Product principle
SEHHA ApparelOS is an Apparel Product Intelligence Platform. A Style is a Digital Twin, not a PDF.
Structured data is the source of truth; PDF/poster/factory sheets are renderers.

## AI safety/data rules
- Never invent exact measurements, GSM, fiber composition, shrinkage, zipper length, seam allowance or grading from a photograph.
- Mark AI facts as OBSERVED / INFERRED / UNKNOWN.
- AI output is AI_DRAFT until a human approves it.
- Never overwrite LOCKED or APPROVED production values with AI output.
- API keys stay server-side.

## Main stack
- Cloudflare Worker
- D1
- R2
- Static Assets/PWA
- AI Gateway with provider adapters
- Shared future SEHHA Licensing Core (same strategic core as ATLAS, not a new license system)

## Current provider routing
- Claude/Anthropic is supported through ANTHROPIC_API_KEY.
- OpenAI is supported through OPENAI_API_KEY.
- Auto route is controlled by AI_PROVIDER_ORDER.
- Do not couple business logic to one AI provider.

## Outputs
Keep these separate but generated from the same Style data:
- Technical A4 B/W
- Pattern/Cutting
- Factory Supervisor
- Management Product Book
- MOHSEN agreed Tech Pack
- Professional Poster landscape/portrait
- Social square/story

## Development discipline
- Preserve migrations; never drop D1 tables as a shortcut.
- Do not commit `.dev.vars`, secrets or provider keys.
- Run `npm run check` after JavaScript changes.
- Treat user and tenant data as private.
- Prefer additive migrations and backward-compatible changes.
