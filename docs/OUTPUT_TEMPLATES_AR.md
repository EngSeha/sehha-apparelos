# Output Studio — Profiles v06

المبدأ: Style Digital Twin واحد، مخرجات متعددة، ويمكن للمخرجات أن تقرأ إما Working Style أو Frozen Release Snapshot.

## Template Registry
Preview 06 يعرّف Registry مركزي يشمل على الأقل:
- `mohsen_nexz_20p`: A4 Landscape، 20 صفحة، bilingual.
- `visual_simulation_2d`: A4 Landscape، صفحة مراجعة تقنية.
- `factory_supervisor`: Factory-focused profile.

## MOHSEN Tech Pack
`mohsen_techpack` هو Master فني 20 صفحة A4 Landscape عربي/English مبني على منطق NEXZ وموسع للباترون والماركر والمرفوك والتشغيل والجودة. الصور توضع حسب Asset Role، وأي Role مفقود يظهر Placeholder مهني.

يمكن فتحه كـWorking Output أو كـFrozen Release Output. الـFrozen Release لا يعاد بناؤه من الـWorking Style.

## Technical A4 B/W
ورقة مختصرة للباترون والتنفيذ من نفس البيانات.

## Pattern & Cutting
POM + Pattern Architecture + cutting notes. Pattern Architecture ليست CAD Pattern.

## Factory Supervisor
BOM + Operations + QC + Pattern.

## Management
Hero + DNA + assets + version/release history.

## Marketing outputs
Poster landscape/portrait + social square + story؛ مستقلة بصريًا عن Tech Pack لكنها تقرأ نفس Style data.

## Marker semantics
- `MARKER_STUDY`: تخطيط/دراسة.
- `PRODUCTION_MARKER`: يتطلب بيانات هندسية معتمدة.
لا يُسمح للـrenderer بترقية Study إلى Production لفظيًا.
