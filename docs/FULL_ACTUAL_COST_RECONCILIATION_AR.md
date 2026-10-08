# Full Actual Cost Reconciliation — Preview 21

الغرض هو الانتقال من Material-only analytics إلى تكلفة إنتاج فعلية قابلة للتدقيق بدون اختراع أرقام.

## الحقائق المطلوبة
- Material actual usage من Reconciliation.
- Actual good output.
- Actual minutes + hourly rate لكل عملية تشغيل synced داخل اللوط.
- Actual overhead amount صريح.

## المعادلات
- Actual Labor Cost = Σ(minutes / 60 × hourly rate).
- Planned Labor Cost = frozen planned labor per unit × planned qty.
- Planned Overhead = (planned material + planned labor) × frozen overhead %.
- Actual Total Production Cost = actual material + actual labor + actual overhead.
- Actual Cost / Good Unit = actual total / actual good output.

## حدود النزاهة
لا يتم استنتاج أي rate أو minutes أو overhead أو currency conversion. إذا لم تدخل القيم يدويًا تبقى TBC ويظل Full Cost Gate غير جاهز.
