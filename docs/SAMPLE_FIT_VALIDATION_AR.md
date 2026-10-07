# Sample & Fit Validation

- كل Sample Round مربوط بـStyle Version مجمد.
- يتم التقاط POM + tolerance من الـVersion عند إنشاء العينة.
- Actual vs Spec يحسب Delta فقط.
- لا يوجد tolerance افتراضي؛ غيابه ينتج `NO_TOLERANCE`.
- APPROVED مسموح فقط عندما تكون القياسات المدخلة PASS.
- تغيير أي Actual بعد الاعتماد يسحب الاعتماد تلقائيًا.
