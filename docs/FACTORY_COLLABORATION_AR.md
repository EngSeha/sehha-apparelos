# Factory Collaboration & Handoff — Preview 07

Preview 07 يضيف طبقة تغيير/مراجعة وتسليم فوق Release Workflow الموجود، بدون تغيير مصدر الحقيقة: الـStyle Digital Twin والـFrozen Release Snapshot.

## Technical Review Items
كل ملاحظة فنية تحفظ داخل D1 وتستطيع الارتباط بالـWorking Style أو Release محدد. الحقول الأساسية:
- Severity: `INFO / MINOR / MAJOR / CRITICAL`
- Category: Technical / Pattern / Measurement / BOM / Quality / Factory
- Field reference اختياري مثل `POM:A` أو `PATTERN:P02`
- Page number اختياري من صفحات الـTech Pack
- Status: `OPEN / RESOLVED / WAIVED`
- Resolution + resolved_by كأثر مراجعة

الملاحظة لا تعدّل القياس أو الباترون تلقائيًا، ولا تعتبر موافقة فنية بحد ذاتها.

## Role Sign-off
Sign-off مربوط بالـRelease وليس بالـWorking Style. الأدوار القياسية:
- DESIGN
- PATTERN
- PRODUCTION
- QC

`WORKSPACE_OWNER` و`PLATFORM_ADMIN` يمكنهما التوقيع للأدوار المطلوبة. `DESIGN_PATTERN_MASTER` يستطيع DESIGN/PATTERN فقط. الهدف منع اعتماد QC أو Production ضمنيًا من دور التصميم.

## Factory Handoff Gate
Factory Handoff مستقل عن Production Release Gate. وجود Production Release لا يعني أن التسليم للمصنع أصبح READY.

Handoff READY يتطلب:
1. Release نوعه `PRODUCTION`.
2. Sign-offs الأربعة مكتملة APPROVED.
3. لا توجد ملاحظات OPEN بدرجة MAJOR أو CRITICAL مرتبطة بالموديل/الإصدار.
4. Template completeness لا يحتوي Required blockers.

المخرج يعيد SHA256 خاصًا بملخص الـhandoff كدليل اتساق، وليس توقيع PKI.

## Template Completeness
قالب `mohsen_nexz_20p` يملك 20 check مرتبطة بالصفحات. المتطلبات الهيكلية مثل POM/BOM/Pattern/Operations تعتبر Required، بينما بعض الصور المتخصصة مثل Technical Front/Back أو Marker يمكن أن تظهر كWarnings بدل اختراع Asset غير موجود.

الـCompleteness Score لا يعني جودة التصميم أو صلاحية المقاس؛ هو فقط اكتمال عناصر القالب.

## Release-to-Release Diff
يمكن مقارنة أي Release مجمد بRelease آخر. التغييرات في POM/BOM/Pattern/Operations/DNA تصنف `REVIEW_REQUIRED`. التغيير البصري/الإداري فقط يمكن أن يبقى LOW. المقارنة تعمل على frozen snapshots، فلا تتأثر بتعديلات Working Style اللاحقة.

## Endpoints
- `GET /api/styles/:id/completeness?template=mohsen_nexz_20p`
- `GET|POST /api/styles/:id/reviews`
- `PATCH /api/styles/:id/reviews/:reviewId`
- `GET /api/styles/:id/releases/compare?from=1&to=2`
- `GET|POST /api/styles/:id/releases/:releaseNo/signoffs`
- `GET /api/styles/:id/releases/:releaseNo/handoff`
