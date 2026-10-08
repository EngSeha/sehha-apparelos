# Frozen Production Planning Basis — Preview 15

عند إنشاء Production Lot يلتقط النظام آخر Approved Cost Sheet المطابق لإصدار الإنتاج (أو global approved sheet) ويجمّد منه بيانات الاستهلاك فقط.

- لا يُقرأ Costing ديناميكيًا بعد ذلك.
- SHA256 يثبت basis المستخدم للحساب.
- Rebase متاح فقط قبل Lot Release وبفعل صريح Audit-able.
- Material Requirements = per-unit qty × planned qty × waste% من basis المجمد.
- لا توجد افتراضات استهلاك عند غياب Approved Cost Sheet.
