# نشر SEHHA ApparelOS من GitHub إلى Cloudflare بدون Node محلي

## السبب
الخطأ:
`'node' is not recognized as an internal or external command`
يعني أن Node.js غير مثبت أو غير مضاف إلى PATH على جهاز Windows. لكن مسارنا المفضل الآن هو GitHub -> Cloudflare، لذلك لا نجعل جهاز المطور شرطًا لتشغيل المنصة.

## البنية
Browser / Mobile
→ Cloudflare Worker API
→ D1 (structured data)
→ R2 (uploaded images)
→ Static Assets (PWA)
→ OpenAI Responses API عند تفعيل المفتاح

## خطوات GitHub
- Create repository: `sehha-apparelos`
- Upload files الموجودة في ZIP إلى Root.
- لا ترفع `.dev.vars` أو أي API keys.

## خطوات Cloudflare
- Workers & Pages.
- اختر `frosty-dust-0b06`.
- Settings / Builds / Connect Git repository (المسمى قد يختلف قليلًا حسب واجهة Cloudflare).
- اختر `EngSeha/sehha-apparelos`.
- Deploy command: `npm run deploy`.
- تأكد أن `wrangler.jsonc` موجود في Root.

## Secrets
أضف من Settings > Variables and Secrets:
`SESSION_SECRET`, `DEV_BOOTSTRAP_PASSWORD`, `MOHSEN_BOOTSTRAP_PASSWORD`, `OPENAI_API_KEY`.

## بعد النشر
- افتح `/api/health` أولًا.
- يجب أن ترى `platform: Cloudflare Workers` و`storage: D1 + R2`.
- افتح `/` ثم Login.
- جرّب JK-001.
- ارفع صورة جديدة.
- إذا تم وضع OpenAI key جرّب Analyze.

## لو ربطت Worker قديمًا بموارد سابقة
يمكن من Cloudflare Dashboard التأكد من Bindings:
- `DB` = D1 database
- `UPLOADS` = R2 bucket
- `STATIC` = Static Assets binding يتم من Wrangler config

إذا لم تُنشأ D1/R2 تلقائيًا، أنشئهما من Dashboard وأضف binding بنفس الأسماء أعلاه ثم Redeploy.
