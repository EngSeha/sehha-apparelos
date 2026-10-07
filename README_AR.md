# SEHHA ApparelOS — Cloudflare Developer Preview 21

## Product completion integration branch

فرع `codex/apparelos-preview21-integration` يحافظ على Preview 21 ويضيف طبقة هندسية additive في schema 18 عبر `0016_engineering_foundation.sql`: Digital Twin identity، Fabric/Trims/Pattern/Marker/Routing/31 Factory Stages، حساب استهلاك معلّم كـ`CALCULATED`، Tech Pack A4 ديناميكي، ومراجعات محفوظة. راجع [المعمارية](docs/PRODUCT_ENGINEERING_ARCHITECTURE.md) و[تقرير الجاهزية](docs/APPARELOS_PRODUCT_READINESS.md) قبل أي استخدام تجريبي. بوابة إصدار الإنتاج القديمة لم تُوصل بعد بفحص الجاهزية الجديد؛ Remote Preview ينتظر تفعيل R2.


Preview 21 يضيف **Full Actual Cost Reconciliation** داخل Production Lot: عمالة فعلية مرتبطة بعمليات التشغيل + مصاريف فعلية صريحة + مقارنة Planned vs Actual Total Production Cost بدون أي افتراضات.

## الجديد في Preview 21 — Full Actual Cost
- Schema 17 عبر `0015_full_actual_cost.sql` additive فقط.
- Full Cost لا يبدأ تلقائيًا؛ المستخدم يفعله صراحة بعد تشغيل Material Reconciliation وSync للعمليات.
- لكل Operation: Actual Minutes + Hourly Rate يدويان؛ Labor Cost = minutes/60 × rate.
- Actual Overhead مبلغ صريح بنفس عملة الـFrozen Cost Basis؛ لا تحويل عملة ولا overhead افتراضي.
- Planned Labor يستخدم `labor_cost` المجمد في Approved Cost Sheet × planned quantity.
- Planned Overhead يستخدم النسبة المجمدة على planned material + planned labor.
- Actual Total = actual material + actual labor + actual overhead.
- Actual Cost / Good Unit يستخدم Actual Good Output فقط.
- عند تفعيل Full Cost يصبح Lot Release fail-closed حتى اكتمال labor لكل عملية وactual overhead.
- Released Lot يظل immutable، وكل Full Cost writes تدخل Audit Trail.
- Lot Report يترقى من `MATERIAL ONLY` إلى `FULL ACTUAL COST` فقط بعد تفعيل المسار وإدخال الحقائق الصريحة.





Preview 20 يضيف **Production Lot Reconciliation Report** كإخراج A4 Landscape قابل للطباعة يجمع الخطة والتنفيذ وQC/CAPA والتسوية الفعلية في مستند واحد.

## الجديد في Preview 20 — Lot Reconciliation Report
- Schema يظل 16.
- تقرير A4 من بيانات الـLot الحالية والفعلية، وليس من Working Style mutable.
- يشمل Size×Color Plan، Material Planned/Actual/Variance، Yield، Material Cost Analytics، Operation Execution، QC وCAPA.
- يطبع Planning Basis SHA256 لتسهيل المراجعة.
- التقرير يصرح أن التكلفة Material-only ولا يختلق actual labor/overhead.

Preview 19 يضيف **Material Cost Variance & Yield Analytics** بدون schema جديد، باستخدام Unit Cost المجمد داخل Cost Basis مع Actual Material Usage.

## الجديد في Preview 19 — Material Cost Analytics
- Schema يظل 16.
- Planning Basis الجديد يحتفظ بـUnit Cost/Labor/Overhead metadata من Cost Sheet المعتمد، مع بقاء الحساب الحالي هنا Material-only.
- Planned Material Cost = frozen gross requirement × frozen unit cost.
- Actual Material Cost = actual usage × frozen unit cost.
- Material Cost Variance وActual Material Cost per Good Unit تُحسب فقط عند اكتمال actual usage/output.
- لا يتم وصف النتيجة كـTotal Production Cost لأن actual labor/overhead غير مدخلين بعد.
- Cost Sheet أحدث لا يعيد تسعير Lot قديم؛ التحليل يقرأ basis المجمد فقط.

Preview 18 يضيف **Factory Role Enforcement** بدون schema جديد: صلاحيات المصنع تصبح action-based بدل مجرد عضوية Workspace.

## الجديد في Preview 18 — Factory Role Enforcement
- Schema يظل 16؛ لا migration جديدة.
- `DESIGN_PATTERN_MASTER` لا يستطيع إنشاء/تعديل Production Lots أو QC.
- `FACTORY_SUPERVISOR/PRODUCTION`: إنشاء Lot، التخطيط، التنفيذ، الاستهلاك الفعلي، defects/CAPA، والإفراج النهائي.
- `QC_MANAGER/QC`: QC evidence + defects + CAPA، ولا يستطيع الإفراج النهائي عن الـLot.
- Workspace/Platform owners يحتفظون بالصلاحيات الكاملة.
- الفصل يمنع أن ينشئ مشرف الإنتاج دليل QC لنفسه قبل الإفراج، مع بقاء Audit Trail.

Preview 17 يضيف **Actual Material Usage + Production Reconciliation + Optimistic Concurrency** على Production Lot، بحيث يتم مقارنة الاستهلاك الفعلي بالخطة المجمدة وحماية التعديلات المتزامنة من الكتابة فوق بعضها.

## الجديد في Preview 17 — Reconciliation & Concurrency
- Schema 16 عبر `0014_reconciliation_concurrency.sql` additive فقط.
- `row_version` لكل Production Lot مع `expectedVersion` لحماية الكتابة المتزامنة؛ stale write = HTTP 409.
- Reconciliation اختيارية حتى يبدأها المستخدم صراحة، لذلك لا تكسر الـLots القديمة.
- عند البدء: Actual Output يصبح مطلوبًا، وكل Material Requirement مخطط يحتاج Actual Usage صريح.
- حساب Yield % وMaterial Variance Qty/% من planned gross المجمد مقابل actual usage.
- Scrap يسجل صراحة ولا يُستنتج آليًا.
- Lot Release يتوقف إذا كانت Reconciliation مفعلة وغير مكتملة.
- Released Lot يظل immutable.

Preview 16 يضيف **Factory Operation Execution** داخل Production Lot: نسخة تشغيل من الـOperation Bulletin المجمد، مع تقدم Planned/Completed/Rejected وحالات تشغيل قابلة للتدقيق.

## الجديد في Preview 16 — Factory Operation Execution
- Schema 15 عبر `0013_factory_operation_execution.sql`.
- Sync صريح لعمليات التشغيل من Frozen Production Release إلى الـLot.
- لكل عملية: planned qty / completed qty / rejected qty / machine / stitch / status.
- الحالات مشتقة تلقائيًا `NOT_STARTED / IN_PROGRESS / DONE`، و`HOLD` فقط قرار يدوي.
- عند تفعيل Operation Tracking، Lot Release يتوقف حتى تصبح كل العمليات DONE.
- Released Lot يرفض أي تحديث تشغيل لاحق.
- جميع Progress Updates تدخل Audit Trail.

Preview 15 يثبت **Frozen Production Planning Basis**: الاستهلاك المستخدم للـLot يُجمّد مع SHA256 عند الإنشاء، وأي تحديث لاحق في Costing لا يغير احتياجات اللوط تاريخيًا إلا عبر Rebase صريح قبل الإفراج.

## الجديد في Preview 15 — Frozen Planning Basis
- Schema 14 عبر `0012_frozen_planning_basis.sql`.
- Approved Cost Sheet + consumption lines تُلتقط كـPlanning Basis عند إنشاء Production Lot.
- SHA256 مستقل للـPlanning Basis داخل اللوط.
- Material Requirements تقرأ الـbasis المجمد، وليس أحدث Cost Sheet ديناميكيًا.
- `POST .../plan/rebase` يسمح بتحديث basis بشكل صريح قبل Release فقط، مع Audit.
- Released Lot يرفض Rebase مثل باقي mutations.

Preview 14 يضيف **Production Planning / Size-Color Allocation + Material Requirements** ويغلق فجوة مهمة بين Production Release والـQC: الكمية الإجمالية لا تكفي عندما يكون الإصدار المجمد يحتوي مقاسات أو Colorways.

## الجديد في Preview 14 — Production Planning
- Schema 13 عبر `0011_production_planning.sql` additive فقط.
- Breakdown للـProduction Lot حسب `Colorway × Size` مع تحقق against frozen release.
- مجموع الـbreakdown يجب أن يساوي `planned_qty` عندما يوجد sizing/color dimensions.
- Lot Release يتوقف إذا كانت خطة التوزيع المطلوبة غير مكتملة.
- Material Requirement Plan يحسب `net/gross required` فقط من Approved Cost Sheet quantities + waste% المدخلين صراحة.
- عدم وجود Cost basis معتمد = Material Plan غير متاح، بدون أي استهلاك افتراضي.
- Breakdown يصبح immutable بعد `LOT RELEASED`.
- Health / package / README consistency test لمنع drift بين version/schema/documentation.

Preview 10 يبني فوق Blueprint / Intake Engine ويضيف **Technical Requirements Matrix** لفصل اقتراحات التمبلت عن قرارات الإنتاج البشرية، بدون تحويل الجيوب/البطانة/الغلق المقترحة إلى شروط إلزامية تلقائيًا.


Preview 13 يوسّع دورة حياة الـStyle من Tech Pack/Release إلى **Sample & Fit Validation + Costing & Consumption + Production Lot Quality/CAPA** مع الحفاظ على قاعدة أن البيانات غير المدخلة صراحة لا تُخترع.

## الجديد في Preview 13 — Production Lot / QA / CAPA
- Schema 12 عبر `0010_production_quality.sql` additive فقط.
- Production Lot لا يُنشأ إلا من Production Release موجود.
- QC Checks بحالات OPEN/PASS/FAIL.
- Major/Critical defects تمنع Lot Release حتى الإغلاق.
- إغلاق defect يحتاج Corrective Action صريح؛ CAPA لا يُخترع.
- Lot Release يحتاج QC evidence + عدم وجود Major/Critical مفتوح.
- واجهة Production QA داخل Style Workspace.

## الجديد في Preview 12 — Costing & Consumption
- Schema 11 عبر `0009_costing_consumption.sql`.
- Cost Sheets مرتبطة اختياريًا بـStyle Version.
- Cost lines تحفظ Qty / Unit / Unit Cost / Waste% صراحة فقط.
- لا توجد أسعار أو استهلاك افتراضي.
- Cost Sheet لا يعتمد قبل وجود Line واحد على الأقل + Labor + Overhead + كل Qty/Unit Cost المطلوبة.
- تعديل Cost Sheet معتمد يعيده DRAFT لإعادة المراجعة.
- Production Release يقرأ Costing approval evidence المرتبط بالـsource version عند وجود costing.

## الجديد في Preview 11 — Sample & Fit Validation
- Schema 10 عبر `0008_sample_fit_validation.sql`.
- Sample Round مرتبط بـFrozen Style Version.
- يتم نسخ POM spec/tolerance من الـVersion لحظة إنشاء العينة.
- Actual measurement يقارن بالسماحيات الصريحة فقط؛ عدم وجود tolerance = `NO_TOLERANCE`.
- Sample APPROVED يتطلب القياسات المدخلة كلها PASS.
- أي تعديل Actual بعد APPROVED يسحب الاعتماد تلقائيًا ويرجع العينة `IN_REVIEW`.
- Production Release يلتقط Sample approval evidence لحظة الإصدار ويجمّده داخل Release Snapshot/Manifest.

## الجديد في Preview 10

- Schema 9 عبر migration إضافية فقط: `0007_requirements_matrix.sql`.
- **Technical Requirements Matrix** لكل Style: `REQUIRED / OPTIONAL / NOT_APPLICABLE`.
- حالات الإغلاق: `OPEN / SATISFIED / WAIVED`.
- Sync صريح من Blueprint: المتطلبات البنيوية الأساسية Required، والتفاصيل المقترحة Optional افتراضيًا.
- `REQUIRED + OPEN` فقط هو الذي يضيف blocker جديد للـProduction Gate.
- `OPTIONAL + OPEN` لا يمنع Production، و`NOT_APPLICABLE` / `WAIVED` قرارات بشرية موثقة تحتاج Note.
- Core requirements يمكن أن تصبح `AUTO SATISFIED` من البيانات الموجودة فعليًا، بينما اعتماد القيم نفسها يظل مسؤولية بوابات POM/BOM/Pattern/Operations الحالية.
- المتطلبات تدخل Style Version وFrozen Release Snapshot وRevision Compare وManifest hash.
- Development Variants ترث المصفوفة لكن تعيد فتح القرارات القابلة للتطبيق للمراجعة.
- واجهة Requirements داخل Blueprint / Intake، مع Audit كامل لكل Sync وDecision.

## الجديد في Preview 09

- Blueprint profile-aware للـDNA/POM/Pattern/BOM/Operations/Evidence.
- Apply Missing Skeleton صريح، idempotent، ولا يكتب قيمًا رقمية.
- كل اقتراح يدخل `TEMPLATE_SUGGESTION + TBC`.
- Intake Readiness يقيس اكتمال المدخلات فقط ولا يفتح Production Gate.
- Blueprint / Intake tab داخل Style Workspace.
- Schema يظل 8.

## الجديد في Preview 08

- Garment Template Profile Registry لأنواع Jacket/Pants/Shirt/Dress/Islamic Wear/Knitwear/Custom.
- الـ20P Master لم يعد يفترض A–F أو P01–P05 أو Morfok.
- Cut Cards تُبنى من قطع الباترون الفعلية.
- صفحة Special Construction Detail تتكيف مع بيانات الغلق/الكمر/السوستة/المرفوك الفعلية.
- اختبار MEN_PANTS يمنع تسريب أي محتوى خاص بالجاكت.
- Schema يظل 8؛ لا توجد migration مدمرة أو إضافية في هذه الدفعة.

## الجديد في Preview 07


- Schema 8 عبر migration إضافية فقط: `0006_factory_collaboration.sql`.
- **Technical Review / Change Requests** مرتبطة بالـWorking Style أو Release محدد، مع Severity وField/Page reference وResolution.
- **Role Sign-off** لكل Release: DESIGN / PATTERN / PRODUCTION / QC مع صلاحيات role-aware.
- **Factory Handoff Gate** منفصل عن Production Release؛ لا يصبح READY مع Major/Critical مفتوح أو sign-offs ناقصة.
- **20-page Template Completeness Validator** يميز Required blockers عن optional visual warnings.
- **Release-to-Release Semantic Diff** وتصنيف `REVIEW_REQUIRED` عند تغيير POM/BOM/Pattern/Operations/DNA.
- **Handoff SHA256** لملخص التسليم كدليل consistency، وليس PKI signature.
- Schema 7 عبر migration إضافية فقط: `0005_release_workflow.sql`.
- **Factory Release Center** داخل كل Style.
- Release Gate منفصل لـ`SAMPLE` و`PRODUCTION`.
- Production Release يرفض TBC/UNKNOWN، POM غير معتمد، Pattern warnings/errors، وOperations غير المعتمدة.
- **Frozen Release Snapshot**: أي Release يحفظ Snapshot مستقل لا يتغير بعد تعديل الـWorking Style.
- **Frozen 20P MOHSEN/NEXZ Tech Pack** يمكن إعادة فتحه من نفس Release.
- **Release Manifest** يحتوي SHA256 للـsnapshot والـmanifest ومعلومات القالب والمخرجات.
- **Revision Compare** بين أي Style Version والـWorking Style أو Version آخر.
- **Style Variants**:
  - `COLOR_ONLY`: يحتفظ بالـPOM/technical locks ويعيد BOM إلى DRAFT لإعادة اعتماد المواد/الألوان.
  - `DEVELOPMENT`: ينسخ البيانات كـINHERITED/DRAFT حتى يعاد اعتمادها.
- **Output Template Registry** مركزي للقوالب الرئيسية.
- **Garment DNA Editor** حتى يستطيع المستخدم إغلاق TBC يدويًا؛ LOCKED/APPROVED لا يستبدل بدون `force` صريح.
- Preview 04 وPreview 05 regression suites ما زالت PASS.

## تشغيل التطوير

```bash
npm install
npm run db:migrate:local
npm run check
npm run test:batch04
npm run test:batch05
npm run test:batch06
npm run test:batch07
npm run test:batch08
npm run test:batch09
npm run test:batch10
npm run test:batch11
npm run test:batch12
npm run test:batch13
npm run test:batch14
npm run test:batch15
npm run test:batch16
npm run test:batch17
npm run test:batch18
npm run test:batch19
npm run test:batch20
npm run test:batch21
npm run dev
```

بعد migrations:

```text
schemaVersion: "17"
expectedSchemaVersion: "17"
version: "0.21.0-cloudflare"
```

## مسارات مهمة

- Tech Pack Working: `/api/styles/:id/output?profile=mohsen_techpack`
- 2D Simulation: `/api/styles/:id/output?profile=visual_simulation`
- Output Templates: `/api/output-templates`
- Release Gate: `/api/styles/:id/release-gate?type=PRODUCTION`
- Tech Pack Completeness: `/api/styles/:id/completeness?template=mohsen_nexz_20p`
- Technical Reviews: `/api/styles/:id/reviews`
- Release Semantic Diff: `/api/styles/:id/releases/compare?from=1&to=2`
- Release Sign-offs: `/api/styles/:id/releases/:releaseNo/signoffs`
- Factory Handoff: `/api/styles/:id/releases/:releaseNo/handoff`
- Releases: `/api/styles/:id/releases`
- Requirements: `/api/styles/:id/requirements`
- Sync Blueprint Requirements: `POST /api/styles/:id/requirements/sync-blueprint`
- Frozen Release Manifest: `/api/styles/:id/releases/:releaseNo/manifest`
- Frozen Release Tech Pack: `/api/styles/:id/releases/:releaseNo/output?profile=mohsen_techpack`
- Revision Compare: `/api/styles/:id/version-compare?from=1&to=current`
- Export Manifest: `/api/styles/:id/export-manifest`
- Variants: `/api/styles/:id/variants`
- Grading Matrix: `/api/styles/:id/grading-matrix`
- Pattern Validation: `/api/styles/:id/pattern-validation`
- Production Lot Plan: `/api/styles/:id/production-lots/:lotId/plan`
- Production Lot Breakdown: `POST /api/styles/:id/production-lots/:lotId/breakdown`
- Start Reconciliation: `POST /api/styles/:id/production-lots/:lotId/reconciliation/start`
- Actual Output: `PATCH /api/styles/:id/production-lots/:lotId/reconciliation/output`
- Actual Material Usage: `POST /api/styles/:id/production-lots/:lotId/material-usage`
- Production Lot Report: `/api/styles/:id/production-lots/:lotId/report`
- Start Full Cost: `POST /api/styles/:id/production-lots/:lotId/full-cost/start`
- Actual Labor: `POST /api/styles/:id/production-lots/:lotId/labor-usage`
- Actual Overhead: `PATCH /api/styles/:id/production-lots/:lotId/full-cost/overhead`

## Release integrity

### Sample Release
يسمح بتحذيرات تطويرية إذا لم توجد أخطاء بنيوية مانعة، ويجمّد الحالة الحالية أو Version محددة.

### Production Release
لا يصبح READY إلا بعد إغلاق الحقائق المطلوبة يدويًا:

- POM = APPROVED/LOCKED.
- Garment DNA بلا TBC/UNKNOWN.
- BOM بلا TBC/UNKNOWN.
- Pattern Validation بلا errors/warnings.
- Operations = APPROVED/LOCKED.
- Frozen Style Version متاحة كمصدر الإصدار.

غياب `PRODUCTION_MARKER` يبقى Warning صريح؛ لا يتم ترقية `MARKER_STUDY` لفظيًا إلى Production Marker.

## قاعدة النزاهة

- الصورة لا تنشئ مقاسًا إنتاجيًا.
- الـgrading لا يعمل إلا على Base POM + Rule صريح.
- Pattern Intelligence لا يعني CAD geometry.
- Visual Region لا يعني Pattern Piece.
- 2D Simulation لا يعني drape/fit simulation.
- Marker Study لا يعني Production Marker.
- AI لا يغيّر LOCKED/APPROVED facts.
- Release المجمد لا يتغير بعد تعديل Working Style.
- Color Variant لا يرث اعتماد المواد بلا مراجعة؛ BOM يعاد فتحها DRAFT.

## Reference Style

`MFD-WJ-001` هو Gold Reference. A–F فقط مقاسات صافية مؤكدة ومقفولة: `57 / 44 / 56 / 62 / 38 / 30 cm`. الخامة، GSM، السماحات، grading، marker consumption، وأبعاد/مسافات Morfok الدقيقة تظل TBC حتى إدخال/اعتماد المستخدم أو العينة الفعلية.

## Deployment boundary

اختبارات Preview 07 المحلية تستخدم D1/R2/Static mocks قريبة من عقود Cloudflare وتغطي الـrelease + collaboration + handoff workflow. قبل نشر حقيقي يلزم re-gate عبر `wrangler dev`/Cloudflare Preview + D1/R2 حقيقيين، وتجربة AI provider حقيقية باستخدام secrets خارج Git.
