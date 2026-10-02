# SEHHA ApparelOS — Cloudflare Architecture Preview 03

```text
Browser / PWA
   │
   ├── Static Assets (Cloudflare Worker Assets)
   │
   └── /api/*
        │
        ▼
Cloudflare Worker
   ├── Auth / Session HMAC
   ├── Tenant / RBAC / Entitlements
   ├── Style Digital Twin API
   ├── AI Gateway / Auto Router
   │    ├── Anthropic / Claude Vision
   │    ├── OpenAI multimodal
   │    └── Gemini slot (future)
   ├── Output Studio
   │    ├── Technical A4
   │    ├── Pattern/Cutting
   │    ├── Factory Supervisor
   │    ├── Management Book
   │    ├── MOHSEN Tech Pack
   │    └── Poster/Social profiles
   ├── D1
   │    ├── users / memberships / organizations
   │    ├── styles / dna / measurements
   │    ├── bom / operations / pattern_pieces
   │    ├── versions / ai_runs / audit
   │    └── entitlements
   └── R2
        └── style assets / uploaded images
```

## Source of truth

Structured Style data is the source of truth. PDFs/posters are rendered views, never the primary data store.

## AI provider boundary

Provider adapters are isolated behind the AI Gateway. Business logic does not depend on one provider.

Default router:

```text
AI_PROVIDER_ORDER=anthropic,openai
```

AI results are never production-locked automatically.

## Licensing boundary

`entitlements()` is the seam for the shared SEHHA Licensing Core strategy reused from ATLAS. `LICENSE_MODE=development` uses local D1 entitlements; `remote` is reserved for the central licensing service.
