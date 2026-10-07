# تحديث المشروع إلى Developer Preview 06

## الهدف
إضافة Release Workflow مهني فوق Preview 05 بدون كسر Pattern Intelligence أو Grading أو Tech Pack 20P.

## Migration
طبّق `0005_release_workflow.sql` بعد migrations السابقة. Schema تصبح 7.

## اختبارات الإغلاق
```bash
npm run check
npm run test:batch04
npm run test:batch05
npm run test:batch06
```

## الجديد
- Factory Release Center.
- Sample/Production gates.
- Frozen release snapshot/output.
- SHA256 export manifest.
- Revision Compare.
- Color/Development variants.
- Garment DNA editor with LOCKED/APPROVED protection.
- Output template registry.

## ملاحظة دمج
لا تستبدل `.dev.vars` ولا secrets. لو يوجد تطوير متوازي على `main`، طبّق patch Preview 06 على branch منفصل ثم شغّل suites كاملة قبل merge.
