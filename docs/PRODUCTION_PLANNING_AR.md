# Production Planning — Preview 14

- Production Release هو مصدر المواصفات المجمدة.
- Production Lot يحتفظ بكمية إجمالية مخططة.
- عندما يحتوي الإصدار المجمد على Size Bands أو Colorways يجب توزيع الكمية على مصفوفة Colorway × Size.
- مجموع التوزيع يجب أن يساوي planned_qty قبل Lot Release.
- Material Requirements تحسب فقط من Approved Cost Sheet: per-unit qty × planned qty × waste%.
- إذا لم توجد Cost Sheet معتمدة لا يقوم النظام بافتراض استهلاك.
- بعد Release يصبح Breakdown غير قابل للتعديل.
