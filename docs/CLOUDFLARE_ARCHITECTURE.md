# SEHHA ApparelOS — Cloudflare Architecture Preview 02

## Runtime
- Cloudflare Worker: API + auth + orchestration.
- Workers Static Assets: responsive PWA.
- D1: tenants/users/styles/DNA/POM/BOM/operations/versions/audit/entitlements.
- R2: uploaded garment/reference/detail images.

## Tenant model
SEHHA IT = platform owner.
MOHSEN = first production/design workspace.
Users are members of workspaces. License entitlements remain separate from RBAC.

## AI
Provider routing is server-side. The browser never receives provider keys.
OpenAI path uses the Responses API and image input. AI results remain Draft/Observed/Inferred/Unknown and do not become production truth automatically.

## Licensing
Development entitlements live in D1 only as a temporary adapter.
Production target: `LICENSE_MODE=remote` + `SEHHA_LICENSE_ENDPOINT`, reusing the shared signed/fail-closed SEHHA Licensing Core derived from ATLAS.

## Next engineering slices
1. Admin user management + password reset.
2. Editable POM/BOM/Operations instead of read-only tables.
3. Dynamic garment template/rules engine.
4. Weight-band engine for Islamic wear.
5. Asset segmentation/detail crops.
6. Poster/output template engine.
7. Version compare + production-lock workflow.
