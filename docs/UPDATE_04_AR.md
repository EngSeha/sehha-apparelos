# تحديث مشروع Codespaces الحالي إلى Preview 04

## الملفات الرئيسية

- `src/worker.js`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`
- `migrations/0003_mohsen_master_bilingual.sql`
- `README_AR.md`
- `CLAUDE.md`
- `docs/MOHSEN_TECHPACK_20P_STANDARD_AR_EN.md`
- `docs/OUTPUT_TEMPLATES_AR.md`

## التحديث

```bash
npm install
npm run db:migrate:local
npm run check
npm run dev
```

## فحص الصحة

`/api/health` يجب أن يعرض schema 5.

## ملاحظة مهمة

لا تستبدل `.dev.vars` ولا تضع أي API key في GitHub.
