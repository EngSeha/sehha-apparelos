# Dynamic Garment Template Engine — Preview 08

## الهدف

تحويل قالب `mohsen_nexz_20p` من Renderer مرتبط ضمنيًا بالجاكت إلى **Master Template ديناميكي من 20 صفحة** يحتفظ ببنية NEXZ/MOHSEN نفسها، لكن يستمد محتوى القياسات، قطع الباترون، والغلق/التفاصيل الخاصة من بيانات الـStyle الفعلية.

## القاعدة الحاكمة

- الـStyle Digital Twin هو المصدر الحقيقي.
- نوع الملابس يحدد **لغة العرض والتصنيف فقط**؛ لا يولد أرقام إنتاجية.
- لا توجد قياسات افتراضية أو سماحات أو Grading أو خامات يتم اختراعها من الـTemplate Profile.
- صفحات Cut Cards تعرض أول قطع الباترون المسجلة حسب `sort_order, code` بدل افتراض P01/P02/P03/P04/P05.
- صفحة 14 أصبحت `Special Construction Detail` ديناميكية؛ تعرض Morfok فقط إذا كانت بيانات الموديل نفسها تدعم ذلك.
- Measurement Map / POM لم يعد يفترض أكواد A–F.

## Garment Profiles الحالية

- WOMENS_JACKET
- MENS_JACKET
- MEN_PANTS
- WOMENS_PANTS
- MEN_SHIRT
- WOMENS_SHIRT
- DRESS
- ISLAMIC_WEAR
- KNITWEAR
- KIDS_SHIRT
- CUSTOM

أي `garment_type` غير معروف يُعامل كـCUSTOM مع محاولات تصنيف آمنة لعائلات Jacket/Pants/Dress من الاسم، بدون تغيير بيانات الإنتاج.

## API

`GET /api/garment-template-profiles`

يرجع Registry العائلات المدعومة ووصف الـ20P Dynamic Master.

## تحقق عدم التسريب

Batch 08 ينشئ موديل اختبار `MEN_PANTS` ببيانات مختلفة كليًا:

- POM: W/H/R/I/L.
- Pattern: F01/B01/WB01/PK01/FL01.
- Closure: Front zipper + waistband button.

ويثبت أن:

- الناتج 20 صفحة بالضبط.
- لا يظهر `Morfok` أو وصف الجاكت النسائي.
- Cut Cards تستخدم قطع البنطلون الفعلية.
- صفحة التفاصيل تتكيف إلى Zipper/Closure.
- Completeness validator لا يطلب P04/P05.

وفي الوقت نفسه يبقى `MFD-WJ-001` يعرض Morfok لأن بياناته الفعلية تحتويه.
