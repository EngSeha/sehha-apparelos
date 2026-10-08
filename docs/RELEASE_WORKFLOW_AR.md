# Release Workflow — SEHHA ApparelOS Preview 06

## 1) Working Style
المصمم يعمل على الـDigital Twin: DNA، القياسات، BOM، Pattern، Operations، Assets، Colorways، Grading.

## 2) Style Version
عند نقطة مراجعة مهمة يتم إنشاء Version. الـVersion Snapshot يحتفظ بحالة فنية ثابتة يمكن مقارنتها لاحقًا.

## 3) Release Gate

### Sample Gate
- يسمح ببعض TBC/Warnings للتطوير والعينة.
- لا يسمح بأخطاء بنيوية أساسية.

### Production Gate
يفشل إذا وجد:
- POM غير APPROVED/LOCKED.
- Garment DNA = TBC/UNKNOWN/DRAFT/AI_DRAFT.
- BOM = TBC/UNKNOWN/DRAFT/AI_DRAFT.
- Pattern Validation warning/error.
- Operations غير APPROVED/LOCKED.
- عدم وجود Version مجمدة كمصدر إنتاج.

`PRODUCTION_MARKER` غير الموجود يظهر Warning مستقل. وجود `MARKER_STUDY` لا يساوي Production Marker.

## 4) Frozen Release
عند نجاح Gate، ينشئ النظام Release رقمية `R1/R2/...` ويخزن:
- release type.
- source version number.
- gate evidence.
- export manifest.
- frozen snapshot JSON.
- author/time/note.

أي تعديل لاحق على Working Style لا يغيّر Release القديمة.

## 5) Release Manifest
Manifest يعرض بيانات القالب، العدادات، الـassets، روابط المخرجات، SHA256 للـsnapshot والـmanifest. الـhash يستخدم لكشف اختلاف المحتوى وليس توقيعًا تشفيريًا بهوية قانونية.

## 6) Frozen Output
يمكن فتح Tech Pack 20P من نفس Release. الـrenderer يقرأ frozen snapshot فقط.

## 7) Revision Compare
يمكن مقارنة Version بـVersion أو Version بـWorking Current، مع domains منفصلة: Style, DNA, POM, BOM, Pattern, Colorways, Operations, Assets وغيرها.

## 8) Variants
- `COLOR_ONLY`: يحافظ على POM/technical approvals، يعيد BOM إلى DRAFT لإعادة اعتماد اللون/الخامة.
- `DEVELOPMENT`: البيانات الموروثة تصبح DRAFT/INHERITED.

## 9) Human closure
أي TBC مطلوب للإنتاج يجب إغلاقه بقرار بشري/عينة/مرجع موثوق. Garment DNA Editor يدعم هذا، ولا يستبدل LOCKED/APPROVED إلا بـ`force` صريح.
