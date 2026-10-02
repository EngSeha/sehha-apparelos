# تحديث مشروع Codespaces الحالي إلى Preview 03

## 1. أوقف السيرفر

```bash
Ctrl+C
```

## 2. لا تلمس `.dev.vars`

استبدل الملفات من نسخة 03، وأضف migration `0002_ai_review_pattern.sql`.

## 3. Claude Secret

داخل `.dev.vars`:

```text
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-5
AI_PROVIDER_ORDER=anthropic,openai
```

إذا لم يكن لديك Anthropic API key اتركه فارغًا؛ Auto Router سيستخدم OpenAI فقط إذا كان لديه رصيد.

## 4. Migration

```bash
npm install
npm run db:migrate:local
npm run check
```

## 5. تشغيل

```bash
npm run dev
```

ثم `/api/health` يجب أن يعرض schema 4.

## 6. اختبار Outputs

داخل أي Style ستجد:
- قائمة Output Profile.
- زر Tech Pack المتفق عليه.
- زر Poster احترافي.

## 7. Git

```bash
git status
git add src public package.json wrangler.jsonc migrations CLAUDE.md docs
git commit -m "Add Claude AI router and multi-template output studio"
git push
```
