export const glossary=Object.freeze({style:'الموديل',pattern:'الباترون',marker:'الماركر',fabric:'الخامة',trim:'الإكسسوار',operation:'العملية',sample:'العينة',lot:'أمر الإنتاج',qc:'فحص الجودة',tolerance:'السماحية'});
export function unitAr(value){return ({m:'متر',meter:'متر',metre:'متر',kg:'كجم',g:'جرام',pcs:'قطعة',pc:'قطعة',piece:'قطعة',pieces:'قطعة'})[String(value||'').toLowerCase()]||String(value||'');}

const blockers={
  FABRIC_UNAPPROVED:{title:'الخامة غير معتمدة',why:'لازم مسؤول المكتب الفني يعتمد الخامة قبل بدء الإنتاج.',action:'راجع الخامة',owner:'المكتب الفني'},
  PATTERN_VALIDATION_ERROR:{title:'الباترون محتاج مراجعة',why:'في بيانات بالباترون تمنع بدء الخطوة التالية.',action:'راجع الباترون',owner:'الباترون'},
  REQUIRED_OPEN:{title:'في خطوة مطلوبة لسه ما اتقفلتش',why:'المتطلب الأساسي لم يكتمل بعد.',action:'راجع المتطلبات',owner:'المكتب الفني'},
  TBC:{title:'لسه محتاج يتحدد',why:'القيمة لم يؤكدها الشخص المسؤول بعد.',action:'اطلب تحديد القيمة',owner:'المسؤول عن البيانات'},
  HOLD:{title:'عملية متوقفة',why:'العملية تحتاج مراجعة قبل أن تكمل.',action:'افتح أمر الإنتاج وراجع سبب التوقف',owner:'مشرف المصنع'},
  CRITICAL_DEFECT:{title:'مشكلة جودة حرجة',why:'تم تسجيل عيب حرج ويحتاج قرار متابعة.',action:'افتح أمر الإنتاج وراجع العيب',owner:'مشرف الجودة'},
  CORRECTION_REQUEST:{title:'عامل طلب تصحيح كمية',why:'العامل لا يقدر يغيّر الكمية المسجلة بنفسه. راجع الطلب والسجل قبل أي تعديل.',action:'افتح أمر الإنتاج للمراجعة',owner:'مشرف المصنع'}
};
export function presentBlocker(code,detail=''){
  const item=blockers[String(code||'').toUpperCase()];
  return item?{...item,code,detail}:{title:'في خطوة محتاجة مراجعة',why:'المهمة لا يمكن إكمالها في حالتها الحالية.',action:'اطلب مساعدة المشرف',owner:'المشرف',code,detail};
}
export function presentError(error){
  const message=String(error?.message||'');
  if(error?.status===403)return {title:'مش مسموح لك تعمل الخطوة دي',why:message.includes('مسندة')?message:'الخطوة تحتاج صلاحية أو إسناد من المشرف.',action:'اطلب من المشرف إسناد المهمة لك.'};
  if(error?.status===409)return {title:'المهمة اتغيرت قبل الحفظ',why:'قد يكون شخص آخر حدّث أمر الإنتاج أو أغلقه.',action:'حدّث المهمة، راجع الكمية، ثم حاول مرة أخرى.'};
  if(/exceed plannedQty|exceed planned/i.test(message))return {title:'الكمية أكبر من المطلوب',why:'الإجمالي بعد الإضافة يتجاوز كمية أمر الإنتاج.',action:'راجع الرقم أو اطلب من المشرف تعديل الخطة.'};
  if(error?.status===400)return {title:'في رقم محتاج تصحيح',why:message||'القيمة المدخلة غير صحيحة.',action:'راجع الحقل المظلل ثم حاول مرة أخرى.'};
  return {title:'الحفظ لم يكتمل',why:navigator.onLine?'حصلت مشكلة في الاتصال أو الخادم.':'الاتصال مقطوع حاليًا.',action:'احتفظ بالرقم على الشاشة وحاول مرة أخرى عند عودة الاتصال.'};
}
