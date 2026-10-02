# Claude Integration — SEHHA ApparelOS

لدينا مساران مختلفان ويجب عدم خلطهما.

## A. Claude لتطوير المشروع

GitHub Integration / Claude Code مناسب جدًا للمستودع `EngSeha/sehha-apparelos`.

تم إضافة `CLAUDE.md` في Root حتى يقرأ Claude قواعد المشروع والـarchitecture قبل تعديل الكود.

Claude Code on the web يمكنه العمل على GitHub repo في بيئة مستقلة وإنشاء Branch/PR للمراجعة.

## B. Claude داخل SEHHA ApparelOS Runtime

Cloudflare Worker لا يحصل تلقائيًا على صلاحية Claude من Connector الموجود في تطبيق Claude.

لذلك Runtime الحالي يستخدم:

```text
ANTHROPIC_API_KEY
ANTHROPIC_MODEL=claude-sonnet-5
```

ويرسل الصورة إلى Anthropic Messages API من السيرفر فقط.

## Auto Router

```text
AI_PROVIDER_ORDER=anthropic,openai
```

يعني:
1. جرّب Claude.
2. لو provider فشل، جرّب OpenAI إذا كان مهيأ.
3. سجل كل محاولة في `ai_runs`.

يمكن عكس الترتيب:

```text
AI_PROVIDER_ORDER=openai,anthropic
```

## الخصوصية

- API keys لا ترسل للمتصفح.
- الصور تمر Server-side من R2 إلى provider المطلوب.
- النتيجة تسجل كـ AI Draft فقط.
- Measurements/GSM/Composition تبقى UNKNOWN إذا لم تكن موثقة.

## Agent Bridge لاحقًا

يمكن مستقبلًا بناء Service منفصل بـ Claude Agent SDK، ثم يتصل به Worker عبر Signed Internal API. هذا مناسب إذا أردنا الاستفادة من capabilities agentic بشكل أعمق أو workflows طويلة، لكن لا نضعه داخل Cloudflare Worker مباشرة في الـMVP.
