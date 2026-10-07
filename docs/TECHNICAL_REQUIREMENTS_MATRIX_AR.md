# Technical Requirements Matrix — Preview 10

## الهدف

فصل **اقتراح هيكل الموديل** عن **قرار ما هو مطلوب فعلاً للإنتاج**. الـBlueprint يستطيع أن يقترح Pocket/Lining/Closure/Evidence، لكن لا يجوز أن تتحول هذه الاقتراحات تلقائيًا إلى شروط Production.

## Applicability

- `REQUIRED`: مطلوب لهذا الموديل. إذا ظل `OPEN` يمنع Production Release.
- `OPTIONAL`: مفيد أو محتمل لهذا الموديل، ولا يمنع Production إذا ظل OPEN.
- `NOT_APPLICABLE`: غير منطبق على الموديل بقرار بشري موثق.

## Status

- `OPEN`: لم يغلق القرار بعد.
- `SATISFIED`: تم توفير/تحقيق المتطلب.
- `WAIVED`: تم إسقاط المتطلب المطلوب بقرار موثق.

`NOT_APPLICABLE` و`WAIVED` يحتاجان Note صريحة، وتُسجل العملية في Audit Trail.

## Sync from Blueprint

عند الضغط على Sync Requirements Matrix:

- تُنشأ المتطلبات البنيوية: Reference / POM / Pattern / BOM / Operations كـ`REQUIRED`.
- DNA/Evidence/Pattern/BOM التفصيلية المقترحة من Blueprint تبدأ `OPTIONAL`.
- Sync لاحق لا يكتب فوق قرارات Applicability/Status البشرية الموجودة.

## Auto-satisfaction

Core requirements يمكن أن تعرض `AUTO SATISFIED` إذا كان الهيكل موجودًا فعليًا. هذا يعني **وجود الهيكل فقط**؛ لا يعني أن القياسات أو BOM أو Pattern معتمدة. بوابات الاعتماد القديمة تظل مستقلة وFail-closed.

## Snapshot / Release

المصفوفة جزء من `styleSnapshot`، وبالتالي تدخل Style Versions وFrozen Releases وSemantic Diff وSHA256 Manifest. تغيير Working Style بعد حفظ Version لا يغير قرارات المتطلبات داخل النسخة المجمدة.
