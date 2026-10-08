# Factory Operation Execution — Preview 16

- يتم نسخ Operation Bulletin من Production Release المجمد إلى Production Lot بفعل Sync صريح.
- planned_qty يأتي من كمية اللوط ولا يخترع النظام كمية أخرى.
- completed/rejected يدخلان يدويًا.
- NOT_STARTED / IN_PROGRESS / DONE مشتقة من التقدم؛ HOLD قرار بشري.
- إذا تم تفعيل Operation Tracking تصبح كل العمليات مطالبة بالإغلاق قبل Lot Release.
- بعد Release لا يمكن تعديل تقدم التشغيل.
