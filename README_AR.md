# SEHHA ApparelOS — Cloudflare Developer Preview 03

هذه الدفعة تنقل المنصة من Preview تشغيل أساسي إلى **AI + Output Studio** فعلي.

## ما تم تنفيذه في 03

- **Claude / Anthropic provider** فعلي داخل الـWorker عبر `ANTHROPIC_API_KEY`.
- **OpenAI provider** ما زال موجودًا.
- **Auto AI Router**: الافتراضي `anthropic,openai`، فإذا فشل Claude ينتقل إلى OpenAI أو العكس حسب `AI_PROVIDER_ORDER`.
- **Structured AI Review** بدل عرض JSON خام فقط: Garment DNA / Material / Trims / POM / Pattern / Operations / Warnings.
- زر **اعتماد النتائج كـ AI Draft** يضيف المقترحات إلى:
  - Garment DNA
  - Measurements/POM بدون اختراع أرقام
  - Pattern Architecture
  - Operation Bulletin
  - Trims في BOM
- إضافة Pattern Architecture إلى الـStyle Snapshot.
- **Output Studio** بتمبلتات مختلفة من نفس Style Digital Twin.
- تحديث Service Worker إلى network-first للملفات الأساسية لتقليل مشاكل cache أثناء التطوير.

## تمبلتات الإخراج الحالية

1. `mohsen_techpack` — **MOHSEN Tech Pack المتفق عليه**: هوية بني/عاجي، Cover + Design/Construction + POM/Pattern + BOM/Operations/QC.
2. `technical_a4` — ورقة A4 عملية أبيض وأسود للباترون والتنفيذ.
3. `pattern_cutting` — ورقة المقص والباترون: POM + Pattern Architecture + Cutting notes.
4. `factory_supervisor` — تشغيل + BOM + QC + Pattern.
5. `management` — Product/Management Book مبسط للإدارة والعميل الداخلي.
6. `poster_pro_landscape` — **بوستر احترافي Landscape** قريب من لغة بوسترات MOHSEN المعتمدة.
7. `poster_pro_portrait` — Poster Portrait.
8. `social_square` — Social 1:1.
9. `story_vertical` — Story 9:16.

كلها تخرج من نفس البيانات، وتستخدم اسم الـWorkspace والمصمم الذي أنشأ الـStyle.

## تحديث مشروعك الحالي داخل Codespaces

لا تستبدل `.dev.vars`.

استبدل/أضف الملفات التالية من هذه الدفعة:

```text
src/worker.js
public/app.js
public/styles.css
public/sw.js
package.json
wrangler.jsonc
migrations/0002_ai_review_pattern.sql
CLAUDE.md
docs/CLAUDE_INTEGRATION_AR.md
docs/OUTPUT_TEMPLATES_AR.md
docs/UPDATE_03_AR.md
```

ثم:

```bash
npm install
npm run db:migrate:local
npm run check
npm run dev
```

`0002_ai_review_pattern.sql` يرفع `schema_version` إلى **4** ويضيف جدول `pattern_pieces`.

## إعداد Claude داخل التطبيق

في `.dev.vars` محليًا:

```text
ANTHROPIC_API_KEY=ضع_مفتاح_Anthropic_هنا
ANTHROPIC_MODEL=claude-sonnet-5
AI_PROVIDER_ORDER=anthropic,openai
```

وفي Cloudflare Production استخدم **Variables and Secrets** ولا تضع المفاتيح في GitHub.

> ملاحظة: اتصال GitHub الموجود في تطبيق Claude ممتاز لتطوير الكود وClaude Code، لكنه لا يعطي Cloudflare Worker مفتاح Anthropic API تلقائيًا. Runtime داخل الموقع يستخدم `ANTHROPIC_API_KEY` حتى نبني Agent Bridge مستقل لاحقًا.

## اختبار سريع

بعد التشغيل:

```text
/api/health
```

يجب أن ترى:

```text
dbReady: true
schemaVersion: "4"
expectedSchemaVersion: "4"
```

ثم داخل Style:

- اختر Provider = `auto` أو `anthropic`.
- حلّل صورة.
- راجع AI Technical Review.
- اضغط `اعتماد النتائج كـ AI Draft`.
- افتح `Tech Pack المتفق عليه` و `Poster احترافي` من أعلى الشاشة.

## قبل Git Push

```bash
git status
```

تأكد أن `.dev.vars` غير موجود ضمن التغييرات.

ثم:

```bash
git add src public package.json wrangler.jsonc migrations CLAUDE.md docs
git commit -m "Add Claude AI router and multi-template output studio"
git push
```

## المرحلة التالية

- Editors حقيقية لـ POM / BOM / Operations / Pattern Pieces.
- Dynamic garment templates حسب النوع: Shirt / Pants / Jacket / Kids / Islamic Wear / Knitwear.
- Standard grading + Weight bands.
- Multi-image consensus analysis.
- Detail segmentation/crops.
- Visual simulation / colorways.
- SEHHA Admin + users/roles + licensing adapter الفعلي.
