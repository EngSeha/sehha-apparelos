# Blueprint / Intake Engine — Preview 09

الهدف هو تسريع تجهيز الـStyle بدون اختراع مواصفات. الـBlueprint يقترح **هيكل البيانات المطلوب جمعه** حسب عائلة المنتج، وليس قيمًا إنتاجية.

- POM المقترح يدخل بقيمة `NULL`.
- Pattern المقترح يدخل بدون Qty/Grainline/Geometry.
- BOM المقترح يدخل بدون Specification/Qty.
- Operations تدخل كـstages غير معتمدة.
- كل السجلات المقترحة `TEMPLATE_SUGGESTION` + `TBC`.
- أي USER_CONFIRMED/APPROVED/LOCKED موجود لا يُستبدل.
- Intake score يقيس وجود هيكل/أدلة فقط ولا يساوي Production Approval.
