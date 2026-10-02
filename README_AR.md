# SEHHA ApparelOS — Cloudflare Developer Preview 02

هذه الدفعة صُممت خصيصًا لكي تعمل **على Cloudflare Workers مباشرة** بدل الاعتماد على وجود Node.js على جهاز التطوير.

## ما تغيّر عن Preview 01
- Backend أصبح Cloudflare Worker.
- Database أصبحت Cloudflare D1 بدل SQLite file محلي.
- الصور أصبحت R2 بدل مجلد `uploads` محلي.
- الواجهة/PWA تُنشر كـ Workers Static Assets.
- AI Gateway يعمل Server-side ويقرأ `OPENAI_API_KEY` من Cloudflare Secret.
- License Adapter ما زال مهيأً للاتصال لاحقًا بـ SEHHA Licensing Core المشترك مع ATLAS.
- أول تشغيل يقوم بإنشاء الـSchema وSeed لـ SEHHA + MOHSEN + JK-001 تلقائيًا.

## أهم نقطة لك الآن
إذا جهازك يقول `node is not recognized` **لا تحتاج تثبيت Node لتجربة النسخة على الويب**. ارفع هذا المشروع إلى GitHub واربطه من Cloudflare Workers > Builds/Deployments. Cloudflare سيقوم بعملية build/deploy على خوادمه.

### إعداد Cloudflare Git deployment
1. أنشئ Repo مثل: `sehha-apparelos` في حساب `EngSeha`.
2. ارفع محتويات هذا المجلد إلى جذر الـRepo.
3. في Cloudflare افتح Worker الحالي `frosty-dust-0b06` أو أنشئ Worker جديدًا.
4. Connect to Git > GitHub > اختر الـRepo.
5. Build command: `npm run deploy`
6. Deploy command إذا طلب منفصلًا: `npx wrangler deploy`
7. Root directory: `/`

ملف `wrangler.jsonc` يحتوي Draft bindings لـ D1 وR2. Wrangler الحديث يستطيع provision الموارد عند النشر إذا لم تكن مربوطة بعد.

## أسرار يجب وضعها من Cloudflare Dashboard
Worker > Settings > Variables and Secrets:

- `SESSION_SECRET` — Secret طويل عشوائي.
- `DEV_BOOTSTRAP_PASSWORD` — كلمة مرور حساب SEHHA developer في أول تهيئة.
- `MOHSEN_BOOTSTRAP_PASSWORD` — كلمة مرور MOHSEN في أول تهيئة.
- `OPENAI_API_KEY` — اختياري حاليًا؛ مطلوب للتحليل المرئي الحقيقي.
- `OPENAI_MODEL` — الافتراضي في الكود `gpt-6-luna` ويمكن تغييره.

> **Preview 02 لا ينشئ المستخدمين إطلاقًا قبل ضبط الأسرار الثلاثة الأساسية.** هذا مقصود حتى لا ننشر Worker عام بكلمات مرور افتراضية. بعد وضع الأسرار، أول Request يزرع الحسابات تلقائيًا بالقيم التي اخترتها.

## حسابات الدخول بعد الـBootstrap
- `dev@sehha.local` / قيمة `DEV_BOOTSTRAP_PASSWORD` التي وضعتها أنت.
- `mohsen@mohsen.local` / قيمة `MOHSEN_BOOTSTRAP_PASSWORD` التي وضعتها أنت.

## الرابط المستهدف
تم ضبط اسم الـWorker في `wrangler.jsonc` على:
`frosty-dust-0b06`

ليكون متوافقًا مع رابطك الحالي قدر الإمكان.

## ملاحظة مهمة عن تغيير كلمات Seed
الـSeed ينشئ المستخدم أول مرة فقط. بعد إنشاء المستخدمين لأول مرة، تغيير Secrets لا يغيّر Password Hash الموجود تلقائيًا. في دفعة Admin التالية سنضيف Reset Password/User Management من داخل SEHHA Admin Console.
