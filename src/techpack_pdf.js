// Professional Arabic-first / English-second A4 Tech Pack as a real PDF, rendered from a FROZEN revision snapshot.
// DRAFT revisions export with a visible DRAFT label; APPROVED revisions freeze the exact PDF bytes in R2 (SHA-256) and
// every re-export serves those bytes. Pattern/CAD is a separate later gate: until validated geometry exists the PDF says
// "Pattern Pending / غير معتمد" and never claims production readiness. Quantities are planned demand only.
import {categoryDef,questionPlan,isCritical,quantityTotals,publicCategory} from './garment_intake.js';
import {renderPdf,pdfEngineStatus} from './pdf_engine.js';

export const TECHPACK_CONTRACT='AI_FIRST_TECHPACK/1';
const APPROVER_ROLES=new Set(['PLATFORM_ADMIN','PLATFORM_OWNER','WORKSPACE_OWNER','DESIGN_PATTERN_MASTER']);
const AUTHOR_BLOCKED=new Set(['OPERATOR','STORE_CLERK']);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex=buf=>[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha256=async data=>hex(await crypto.subtle.digest('SHA-256',typeof data==='string'?new TextEncoder().encode(data):data));
const stable=v=>v===null||typeof v!=='object'?v:Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
const BLOCKER_AR={CATEGORY_NOT_CONFIRMED:'نوع القطعة غير مؤكد',MEASUREMENT_BASIS_MISSING:'أساس القياس (الوحدة/جسم أم قطعة/المقاس الأساسي) ناقص',CRITICAL_POM_MISSING:'قياسات أساسية ناقصة',POM_BASIS_MISSING:'أساس بعض القياسات (مسطح/محيط) غير محدد',CRITICAL_SPEC_MISSING:'مواصفات أساسية ناقصة',VALUES_NEED_CONFIRMATION:'أرقام تحتاج تأكيد',GARMENT_BASIS_MISSING:'لم يُحدد هل القياس للجسم أم للقطعة',BASE_SIZE_MISSING:'المقاس الأساسي غير محدد',BOM_EMPTY:'قائمة الخامات فارغة',OPERATIONS_EMPTY:'تسلسل العمليات فارغ'};
export function blockerAr(b){const [k,code]=String(b).split(':');const base=k==='POM_MISSING'?'قياس ناقص':k==='POM_BASIS_MISSING'&&code?'أساس قياس غير محدد':BLOCKER_AR[k]||k;return code?`${base}: ${code}`:base;}
const SRC_AR={OWNER_SUPPLIED:'من المالك',MEASURED:'مقاس فعلي',RULE_DERIVED:'محسوب بقاعدة',AI_HYPOTHESIS:'اقتراح AI',IMAGE_OBSERVED:'ملاحظ من الصورة',APPROVED:'معتمد',TEMPLATE:'قالب الفئة',PENDING:'مطلوب'};

// ---------- Frozen snapshot ----------
export async function buildSnapshot(env,ctx,style,intakeRow,userId){
  const snap=await ctx.styleSnapshot(env,style.id),org=await env.DB.prepare('SELECT id,code,name,brand_json FROM organizations WHERE id=?').bind(style.org_id).first();
  const author=await env.DB.prepare('SELECT display_name FROM users WHERE id=?').bind(userId).first();
  const intake=intakeRow?{category:intakeRow.category,category_source:intakeRow.category_source,classification:JSON.parse(intakeRow.classification_json||'{}'),answers:JSON.parse(intakeRow.answers_json||'{}'),visionMode:intakeRow.vision_mode,visionRunId:intakeRow.vision_run_id}:{category:null,category_source:null,classification:{},answers:{}};
  const cat=categoryDef(intake.category),a=intake.answers||{},plan=questionPlan(intake),unit=a.unit||'cm';
  const dbM=new Map((snap.measurements||[]).map(m=>[m.code,m]));const gm=ctx.gradeMatrix(snap),gradedByCode=new Map((gm.rows||[]).map(r=>[r.code,r]));
  const pom=[];const seen=new Set();
  for(const p of cat?.pom||[]){seen.add(p.code);const v=a.measurements?.[p.code],m=dbM.get(p.code),crit=isCritical(p,a);
    const value=v?.value??m?.value??null,src=v?.value!=null?(v.source||'OWNER_SUPPLIED'):m?.value!=null?(m.provenance||'OWNER_SUPPLIED'):'PENDING';
    pom.push({code:p.code,nameAr:p.nameAr,nameEn:p.nameEn,basis:v?.basis||(p.basisOptions.length===1?p.basisOptions[0]:null),landmark:v?.landmark||null,value,unit:m?.unit||unit,tolPlus:m?.tolerance_plus??null,tolMinus:m?.tolerance_minus??null,source:src,critical:crit,state:m?.state||null,graded:gradedByCode.get(p.code)?.values||{}});}
  for(const m of snap.measurements||[])if(!seen.has(m.code))pom.push({code:m.code,nameAr:m.name,nameEn:m.name_en,basis:null,landmark:m.method||null,value:m.value,unit:m.unit||unit,tolPlus:m.tolerance_plus,tolMinus:m.tolerance_minus,source:m.provenance||'OWNER_SUPPLIED',critical:false,state:m.state,graded:gradedByCode.get(m.code)?.values||{}});
  const specs=a.specs||{};
  // BOM: confirmed rows from the style; otherwise the category skeleton, explicitly PROPOSED with qty/supplier pending.
  let bom=(snap.bom||[]).map(x=>({code:x.code,category:x.category,nameAr:x.name,nameEn:x.name_en,spec:x.specification,specEn:x.specification_en,qty:x.qty,unit:x.unit,status:x.status||'DRAFT',source:x.provenance||'OWNER_SUPPLIED',supplier:null}));
  if(!bom.length&&cat){bom=cat.bom.map(([c,ar,en],i)=>({code:`P-${String(i+1).padStart(2,'0')}`,category:c,nameAr:ar,nameEn:en,spec:null,specEn:null,qty:null,unit:null,status:'PROPOSED',source:'TEMPLATE',supplier:null}));
    if(['FULL','HALF'].includes(specs.lining))bom.push({code:'P-LN',category:'LINING',nameAr:'قماش بطانة',nameEn:'Lining fabric',spec:specs.lining==='HALF'?'بطانة نصفية':'بطانة كاملة',specEn:`${specs.lining} lining`,qty:null,unit:null,status:'PROPOSED',source:'OWNER_SUPPLIED',supplier:null});
    if(specs.closure==='BUTTONS'||specs.button_count)bom.push({code:'P-BT',category:'TRIM',nameAr:'أزرار',nameEn:'Buttons',spec:specs.closure_detail||null,specEn:null,qty:specs.button_count?Number(specs.button_count):null,unit:specs.button_count?'pcs':null,status:'PROPOSED',source:'OWNER_SUPPLIED',supplier:null});
    if(['ZIP','ZIP_FLY','CONCEALED_ZIP','BACK_ZIP','SIDE_ZIP'].includes(specs.closure))bom.push({code:'P-ZP',category:'TRIM',nameAr:specs.closure==='CONCEALED_ZIP'?'سوستة مخفية':'سوستة',nameEn:specs.closure==='CONCEALED_ZIP'?'Concealed zipper':'Zipper',spec:'الطول يُحدد من قياس الفتحة',specEn:'Length from the opening measurement',qty:1,unit:'pcs',status:'PROPOSED',source:'OWNER_SUPPLIED',supplier:null});}
  let ops=(snap.operations||[]).map(o=>({seq:o.seq,nameAr:o.name,nameEn:o.name_en,machine:o.machine,stitch:o.stitch,qcAr:o.qc_point,qcEn:o.qc_point_en,state:o.state,source:o.provenance||'OWNER_SUPPLIED'}));
  if(!ops.length&&cat)ops=cat.ops.map(([ar,en],i)=>({seq:(i+1)*10,nameAr:ar,nameEn:en,machine:null,stitch:null,qcAr:null,qcEn:null,state:'PROPOSED',source:'TEMPLATE'}));
  const assets=[];for(const x of (snap.assets||[]).filter(x=>/^image\//.test(x.mime_type||'')).slice(0,4)){let sha=null;try{const o=x.source_kind==='STATIC_DEMO'?null:await env.UPLOADS.get(x.stored_name);if(o)sha=await sha256(await o.arrayBuffer());}catch{}assets.push({id:x.id,role:x.role,filename:x.filename,mime:x.mime_type,rights:x.rights_status,sourceKind:x.source_kind,storedName:x.stored_name,sha256:sha});}
  const qm=a.quantityMatrix||null,totals=quantityTotals(qm);
  const material=bom.map(r=>{const confirmed=r.status==='APPROVED'&&r.qty!=null&&r.unit;return {code:r.code,nameAr:r.nameAr,nameEn:r.nameEn,perUnit:confirmed?Number(r.qty):null,unit:confirmed?r.unit:null,total:confirmed&&totals?Math.round(Number(r.qty)*totals.total*1000)/1000:null,status:confirmed?(totals?'CALCULATED_FROM_CONFIRMED_QTY':'NO_QUANTITY_MATRIX'):'CONSUMPTION_NOT_CONFIRMED'};});
  const prior=(await env.DB.prepare('SELECT revision_no,status,snapshot_sha256,pdf_sha256,created_at,approved_at FROM techpack_documents WHERE style_id=? ORDER BY revision_no').bind(style.id).all()).results||[];
  const brand=(()=>{try{return JSON.parse(org?.brand_json||'{}')}catch{return {}}})();
  return {contract:TECHPACK_CONTRACT,product:'SEHHA ApparelOS',tenant:{id:org?.id,code:org?.code,name:org?.name,heading:brand.companyHeading||brand.displayName||org?.name||null},
    style:{id:style.id,code:style.code,name:style.name,audience:style.audience,baseSize:a.baseSize||style.base_size||null,sizingMode:cat?.sizing==='WEIGHT_BANDS'?'WEIGHT_BANDS':(style.sizing_mode||'STANDARD')},
    category:cat?{key:cat.key,labelAr:cat.labelAr,labelEn:cat.labelEn,source:intake.category_source,sizing:cat.sizing,sizingNoteAr:cat.sizingNoteAr||null,sizingNoteEn:cat.sizingNoteEn||null}:null,
    vision:{mode:intake.visionMode||null,runId:intake.visionRunId||null,confidence:intake.classification?.confidence||null,model:intake.classification?.meta?.model||null,descriptionAr:intake.classification?.descriptionAr||null,descriptionEn:intake.classification?.descriptionEn||null,details:intake.classification?.details||[],unseen:intake.classification?.unseen||[],fabricAppearance:intake.classification?.fabricAppearance||null},
    owner:{notes:a.notes||null,unit,garmentBasis:a.garmentBasis||null,specs,specLabels:cat?Object.fromEntries(cat.specs.map(s=>[s.key,{ar:s.labelAr,en:s.labelEn,options:s.options}])):{}},
    components:(snap.patternPieces||[]).length?(snap.patternPieces||[]).map(x=>({ar:x.name,en:x.name_en,qty:x.qty,source:x.provenance,state:x.state})):(cat?.components||[]).map(([ar,en])=>({ar,en,qty:null,source:'TEMPLATE',state:'PROPOSED'})),
    pom,grading:{baseSize:a.baseSize||style.base_size||null,sizes:Object.keys((gm.rows||[]).find(r=>Object.keys(r.values||{}).length)?.values||{}),warnings:gm.warnings||[]},
    bom,ops,quantity:qm?{...qm,totals}:null,material,assets,
    pattern:{status:'PATTERN_PENDING',gaps:patternGaps(cat,a,plan)},
    plan:{blockers:plan.blockers,flags:plan.flags},priorRevisions:prior,createdBy:{id:userId,name:author?.display_name||null}};
}
export function patternGaps(cat,a,plan){const g=[];if(!cat)g.push('CATEGORY_NOT_CONFIRMED');if(plan.blockers.length)g.push(...plan.blockers);
  g.push('BASE_BLOCK_NOT_SELECTED','EASE_RULES_NOT_DEFINED','SEAM_ALLOWANCES_NOT_CONFIRMED','PARAMETRIC_DRAFTING_ENGINE_NOT_VALIDATED');return [...new Set(g)];}
// Approval gate on the frozen snapshot: structure/evidence presence only — never a fit or quality judgement.
export function approvalGate(s){const blockers=[...(s.plan?.blockers||[])];
  if(!s.category)blockers.push('CATEGORY_NOT_CONFIRMED');
  for(const p of s.pom.filter(x=>x.critical)){if(p.value==null)blockers.push(`POM_MISSING:${p.code}`);else if(!p.basis)blockers.push(`POM_BASIS_MISSING:${p.code}`);}
  if(!s.owner.garmentBasis)blockers.push('GARMENT_BASIS_MISSING');if(!s.style.baseSize)blockers.push('BASE_SIZE_MISSING');
  if(!s.bom.length)blockers.push('BOM_EMPTY');if(!s.ops.length)blockers.push('OPERATIONS_EMPTY');
  const warnings=[];if(!s.assets.length)warnings.push('NO_REFERENCE_IMAGE');if(s.vision.mode==='MOCK')warnings.push('VISION_MOCK_NOT_LIVE');if(s.bom.some(b=>b.status==='PROPOSED'))warnings.push('BOM_HAS_PROPOSED_ROWS');if(s.ops.some(o=>o.state==='PROPOSED'))warnings.push('OPERATIONS_HAVE_PROPOSED_ROWS');
  warnings.push('PATTERN_PENDING');return {ready:blockers.length===0,blockers:[...new Set(blockers)],warnings,note:'Presence/structure check only; not a fit, quality or manufacturability approval.'};}

// ---------- HTML ----------
async function fontCss(env,request){const files=[['Naskh','noto-naskh-arabic-arabic-400-normal.woff2',400],['Naskh','noto-naskh-arabic-arabic-700-normal.woff2',700],['NotoSans','noto-sans-latin-400-normal.woff2',400],['NotoSans','noto-sans-latin-700-normal.woff2',700]];let css='';
  for(const [fam,f,w] of files){try{const r=await env.STATIC.fetch(new URL(`/fonts/${f}`,request?.url||'https://local/'));if(!r.ok)continue;const b=new Uint8Array(await r.arrayBuffer());let bin='';for(let i=0;i<b.length;i+=0x8000)bin+=String.fromCharCode(...b.subarray(i,i+0x8000));css+=`@font-face{font-family:'${fam}';src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');font-weight:${w};font-style:normal}`;}catch{}}return css;}
async function imageDataUrls(env,s){const out={};for(const a of s.assets){try{const o=a.sourceKind==='STATIC_DEMO'?null:await env.UPLOADS.get(a.storedName);if(!o)continue;const buf=await o.arrayBuffer();if(a.sha256&&await sha256(buf)!==a.sha256)continue;const b=new Uint8Array(buf);let bin='';for(let i=0;i<b.length;i+=0x8000)bin+=String.fromCharCode(...b.subarray(i,i+0x8000));out[a.id]=`data:${a.mime};base64,${btoa(bin)}`;}catch{}}return out;}
const fmt=(v,unit)=>v==null||v===''?'<span class="pending">مطلوب · Pending</span>':`<span dir="ltr">${esc(Number(v).toLocaleString('en-US',{maximumFractionDigits:2}))}${unit?' '+esc(unit):''}</span>`;
const srcTag=s=>`<span class="tag t-${esc(String(s||'PENDING').toLowerCase())}">${esc(SRC_AR[s]||s||'')}<br><span dir="ltr">${esc(s||'')}</span></span>`;
export function renderHtml(s,{status,revisionNo,fonts='',images={},approvedBy=null,approvedAt=null,createdAt}){
  const isDraft=status!=='APPROVED',sp=s.owner.specs||{},labels=s.owner.specLabels||{};
  const specRows=Object.entries(sp).filter(([,v])=>v!=null&&v!=='').map(([k,v])=>{const l=labels[k]||{ar:k,en:k},o=(l.options||[]).find(x=>x.value===v);return `<tr><td>${esc(l.ar)}<div class="en">${esc(l.en)}</div></td><td>${o?`${esc(o.ar)}<div class="en">${esc(o.en)}</div>`:esc(v)}</td><td>${srcTag('OWNER_SUPPLIED')}</td></tr>`;}).join('');
  const detailRows=(s.vision.details||[]).map(d=>`<tr><td dir="ltr">${esc(d.key)}</td><td>${esc(d.valueAr||'')}<div class="en">${esc(d.valueEn||'')}</div></td><td>${srcTag(d.evidence==='OBSERVED'?'IMAGE_OBSERVED':'AI_HYPOTHESIS')}</td></tr>`).join('');
  const gradedSizes=s.grading.sizes||[];
  const pomRows=s.pom.map(p=>`<tr><td dir="ltr" class="code">${esc(p.code)}</td><td>${esc(p.nameAr)}<div class="en">${esc(p.nameEn||'')}</div>${p.landmark?`<div class="small">${esc(p.landmark)}</div>`:''}</td><td dir="ltr">${p.basis?esc(p.basis):p.critical?'<span class="pending">مطلوب</span>':'—'}</td><td>${fmt(p.value,p.unit)}</td>${gradedSizes.map(z=>`<td>${fmt(p.graded?.[z],null)}</td>`).join('')}<td dir="ltr">${p.tolPlus==null&&p.tolMinus==null?'<span class="pending">NO_TOLERANCE</span>':`+${esc(p.tolPlus??0)} / -${esc(p.tolMinus??0)}`}</td><td>${srcTag(p.source)}${p.critical?'<div class="small crit">أساسي · critical</div>':''}</td></tr>`).join('');
  const bomRows=s.bom.map(b=>`<tr><td dir="ltr" class="code">${esc(b.code)}</td><td dir="ltr">${esc(b.category||'')}</td><td>${esc(b.nameAr||'')}<div class="en">${esc(b.nameEn||'')}</div></td><td>${esc(b.spec||'—')}<div class="en">${esc(b.specEn||'')}</div></td><td>${fmt(b.qty,b.unit)}</td><td>${b.supplier?esc(b.supplier):'<span class="pending">غير مؤكد · TBC</span>'}</td><td>${srcTag(b.status==='APPROVED'?'APPROVED':b.source==='TEMPLATE'?'TEMPLATE':b.source)}<div class="small" dir="ltr">${esc(b.status)}</div></td></tr>`).join('');
  const opRows=s.ops.map(o=>`<tr><td dir="ltr">${esc(o.seq)}</td><td>${esc(o.nameAr||'')}<div class="en">${esc(o.nameEn||'')}</div></td><td dir="ltr">${o.machine?esc(o.machine):'<span class="pending">TBC</span>'}</td><td dir="ltr">${o.stitch?esc(o.stitch):'<span class="pending">TBC</span>'}</td><td>${o.qcAr?esc(o.qcAr):'<span class="pending">نقطة فحص مطلوبة</span>'}<div class="en">${esc(o.qcEn||'')}</div></td><td>${srcTag(o.source==='TEMPLATE'?'TEMPLATE':o.source)}</td></tr>`).join('');
  const comp=s.components.map(c=>`<tr><td>${esc(c.ar||'')}<div class="en">${esc(c.en||'')}</div></td><td>${fmt(c.qty,null)}</td><td>${srcTag(c.source==='TEMPLATE'?'TEMPLATE':c.source)}</td></tr>`).join('');
  const q=s.quantity;const qTable=q&&q.sizes.length&&q.colors.length?`<table><thead><tr><th>اللون \\ المقاس<div class="en">Colour \\ Size</div></th>${q.sizes.map(z=>`<th dir="ltr">${esc(z)}</th>`).join('')}<th>الإجمالي<div class="en">Total</div></th></tr></thead><tbody>${q.colors.map(c=>`<tr><td>${esc(c)}</td>${q.sizes.map(z=>`<td dir="ltr">${q.cells[`${z}|${c}`]??'—'}</td>`).join('')}<td dir="ltr"><b>${q.totals.byColor[c]||0}</b></td></tr>`).join('')}<tr class="sum"><td>الإجمالي · Total</td>${q.sizes.map(z=>`<td dir="ltr"><b>${q.totals.bySize[z]||0}</b></td>`).join('')}<td dir="ltr"><b>${q.totals.total}</b></td></tr></tbody></table><p class="note">كميات مخططة (طلب) وليست كميات إنتاج فعلية.<span class="en">Planned demand, not production actuals.</span></p>`:'<p class="note">لم تُدخل مصفوفة مقاسات × ألوان بعد.<span class="en">No size × colour matrix entered.</span></p>';
  const matRows=s.material.map(m=>`<tr><td>${esc(m.nameAr||'')}<div class="en">${esc(m.nameEn||'')}</div></td><td>${fmt(m.perUnit,m.unit)}</td><td>${fmt(m.total,m.unit)}</td><td dir="ltr" class="small">${esc(m.status)}</td></tr>`).join('');
  const img=s.assets.map(a=>images[a.id]?`<figure><img src="${images[a.id]}" alt=""><figcaption>${esc(a.role)} · <span dir="ltr">${esc(a.filename)}</span><br><span class="small">حقوق الاستخدام: ${esc(a.rights||'—')} · sha256 <span dir="ltr">${esc((a.sha256||'').slice(0,12))}</span></span></figcaption></figure>`:'').join('');
  const ledger=[...s.priorRevisions.map(r=>`<tr><td dir="ltr">R${esc(r.revision_no)}</td><td dir="ltr">${esc(r.status)}</td><td dir="ltr">${esc(r.created_at)}</td><td dir="ltr" class="small">${esc((r.snapshot_sha256||'').slice(0,16))}</td></tr>`),`<tr class="cur"><td dir="ltr">R${esc(revisionNo)}</td><td dir="ltr">${esc(status)}</td><td dir="ltr">${esc(approvedAt||createdAt)}</td><td dir="ltr" class="small">this document</td></tr>`].join('');
  const gate=approvalGate(s);
  const css=`${fonts}@page{size:A4;margin:16mm 13mm 18mm 13mm}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:'Naskh','NotoSans',serif;color:#1f2328;font-size:10.5pt;line-height:1.55;background:#fff}
  .en{display:block;font-family:'NotoSans','Naskh',sans-serif;direction:ltr;text-align:left;color:#57606a;font-size:8.5pt;line-height:1.35}[dir=ltr]{font-family:'NotoSans','Naskh',sans-serif}
  h1{font-size:22pt;margin:0 0 2mm}h2{font-size:14pt;margin:0 0 3mm;padding-bottom:1.5mm;border-bottom:1.5px solid #1f2328;break-after:avoid}h2 .en{display:inline-block;font-size:10pt;margin-inline-start:4mm;color:#57606a}h3{font-size:11.5pt;margin:4mm 0 2mm;break-after:avoid}h3 .en{display:inline-block;font-size:9pt;margin-inline-start:3mm}
  section{break-before:page}section.first{break-before:auto}table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:9pt}thead{display:table-header-group}tr{break-inside:avoid}th,td{border:1px solid #c9ced4;padding:1.6mm 2mm;text-align:start;vertical-align:top}th{background:#f2f4f6;font-weight:700}tr.sum td,tr.cur td{background:#f7f8fa}
  .code{font-family:'NotoSans',monospace;font-size:8.5pt}.small{font-size:7.5pt;color:#57606a}.pending{color:#9a3412;font-weight:700;font-size:8.5pt}.crit{color:#1f2328}.note{font-size:8.5pt;color:#57606a;margin:1mm 0 3mm}
  .tag{display:inline-block;font-size:7.5pt;line-height:1.25;padding:.5mm 1.5mm;border:1px solid #c9ced4;border-radius:1mm}.t-pending{border-color:#9a3412;color:#9a3412}.t-ai_hypothesis{border-color:#7c3aed;color:#5b21b6}.t-template{border-style:dashed}.t-approved{border-color:#166534;color:#166534}
  .badge{float:left;font-weight:700;border:1.5px solid;padding:1mm 3mm;font-size:10pt}.b-draft{border-color:#9a3412;color:#9a3412}.b-ok{border-color:#166534;color:#166534}.badge .en{color:inherit}.status-unused{position:fixed;top:-10mm;left:0;font-family:'NotoSans','Naskh',sans-serif;font-size:8.5pt;font-weight:700;padding:1mm 3mm;border:1.5px solid ${isDraft?'#9a3412':'#166534'};color:${isDraft?'#9a3412':'#166534'};background:#fff}
  .cover{display:grid;grid-template-columns:1fr 1fr;gap:6mm;align-items:start}.meta td:first-child{width:38%;background:#f7f8fa}figure{margin:0 0 3mm;border:1px solid #c9ced4;padding:2mm;break-inside:avoid}figure img{width:100%;max-height:105mm;object-fit:contain;display:block}figcaption{font-size:8pt;margin-top:1mm}
  .box{border:1px solid #c9ced4;padding:3mm;margin:0 0 3mm;break-inside:avoid}.warn{border-color:#9a3412;background:#fff7ed}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.kicker{font-size:9pt;color:#57606a;margin-bottom:6mm}ul.open{margin:1.5mm 0 0;padding-inline-start:5mm;font-size:9pt}`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(s.style.code)} Tech Pack R${esc(revisionNo)}</title><style>${css}</style></head><body>
<section class="first"><div class="badge ${isDraft?'b-draft':'b-ok'}">${isDraft?'مسودة غير معتمدة':'معتمد'}<span class="en">${isDraft?'DRAFT — not for production':'APPROVED'} · R${esc(revisionNo)}</span></div><div class="kicker">${esc(s.tenant.heading||'')} · <span dir="ltr">${esc(s.product)}</span></div>
<h1>ملف المواصفات الفنية<div class="en" style="font-size:12pt">Technical Specification — Tech Pack</div></h1>
<div class="cover"><div><table class="meta"><tbody>
<tr><td>الموديل · Style</td><td dir="ltr"><b>${esc(s.style.code)}</b> — ${esc(s.style.name)}</td></tr>
<tr><td>الفئة · Category</td><td>${s.category?`${esc(s.category.labelAr)}<div class="en">${esc(s.category.labelEn)} · ${esc(s.category.source||'')}</div>`:'<span class="pending">غير مؤكدة</span>'}</td></tr>
<tr><td>المقاس الأساسي · Base</td><td>${s.style.baseSize?`<span dir="ltr">${esc(s.style.baseSize)}</span>`:'<span class="pending">مطلوب</span>'}<div class="en">${esc(s.style.sizingMode)}</div></td></tr>
<tr><td>أساس القياس · Basis</td><td>${s.owner.garmentBasis?esc(s.owner.garmentBasis==='BODY'?'جسم الإنسان':'القطعة الجاهزة'):'<span class="pending">مطلوب</span>'}<div class="en">${esc(s.owner.garmentBasis||'')} · ${esc(s.owner.unit)}</div></td></tr>
<tr><td>الإصدار · Revision</td><td dir="ltr">R${esc(revisionNo)} · ${esc(status)}</td></tr>
<tr><td>أعدّه · Prepared by</td><td>${esc(s.createdBy.name||'')}<div class="en">${esc(createdAt)}</div></td></tr>
<tr><td>اعتمده · Approved by</td><td>${approvedBy?`${esc(approvedBy)}<div class="en">${esc(approvedAt)}</div>`:'<span class="pending">غير معتمد بعد · Not approved</span>'}</td></tr>
<tr><td>مصدر التعرّف · Recognition</td><td dir="ltr">${s.vision.mode?`${esc(s.vision.mode)}${s.vision.model?` · ${esc(s.vision.model)}`:''} · ${esc(s.vision.confidence||'')}`:'—'}</td></tr>
</tbody></table>
${isDraft?`<div class="box warn"><b>مسودة للمراجعة فقط</b> — لا تُستخدم للإنتاج.<div class="en">Draft for review only — not for production.</div>${gate.blockers.length?`<ul class="open">${gate.blockers.map(b=>`<li>${esc(blockerAr(b))}</li>`).join('')}</ul>`:''}</div>`:`<div class="box"><b>معتمد كمواصفة تصميم</b> — الاعتماد لا يعني تفويض إنتاج؛ الإنتاج يمر بالإصدار الفني والتسليم للمصنع.<div class="en">Approved as a design specification. Not a production authorization; production goes through the technical release and factory handoff.</div></div>`}
${s.category?.sizing==='WEIGHT_BANDS'?`<div class="box">${esc(s.category.sizingNoteAr)}<div class="en">${esc(s.category.sizingNoteEn)}</div></div>`:''}</div>
<div>${img||'<div class="box">لا توجد صورة مرجعية مرفقة.<div class="en">No reference image attached.</div></div>'}</div></div></section>
<section><h2>الوصف الفني<span class="en">Technical description</span></h2>
${s.owner.notes?`<h3>ملاحظات المالك<span class="en">Owner notes</span></h3><div class="box">${esc(s.owner.notes)}</div>`:''}
<h3>وصف مقترح من التعرّف على الصورة<span class="en">Recognition-based description</span></h3><div class="box">${s.vision.descriptionAr?esc(s.vision.descriptionAr):'—'}<div class="en">${esc(s.vision.descriptionEn||'')}</div><div class="small">${s.vision.mode==='MOCK'?'وضع محاكاة — لم تُحلَّل الصور فعليًا.<span class="en">MOCK — images were not analysed.</span>':'اقتراح AI يحتاج تأكيدًا بشريًا.<span class="en">AI hypothesis pending human confirmation.</span>'}</div></div>
${s.vision.unseen?.length?`<div class="box warn"><b>غير ظاهر في الصور</b> — لا يُفترض:<div class="en" dir="ltr">${esc(s.vision.unseen.join(' · '))}</div></div>`:''}
<h3>الخامة الظاهرة<span class="en">Fabric appearance</span></h3><div class="box">${s.vision.fabricAppearance?`${esc(s.vision.fabricAppearance.descriptionAr||'')}<div class="en">${esc(s.vision.fabricAppearance.descriptionEn||'')}</div>`:'—'}<div class="small">مظهر بصري فقط؛ التركيب والوزن (GSM) يحتاجان تحليلًا معمليًا.<span class="en">Visual appearance only; composition/GSM require lab verification.</span></div></div>
${specRows?`<h3>مواصفات من المالك<span class="en">Owner specifications</span></h3><table><thead><tr><th>البند<div class="en">Item</div></th><th>القيمة<div class="en">Value</div></th><th>المصدر<div class="en">Source</div></th></tr></thead><tbody>${specRows}</tbody></table>`:''}
${detailRows?`<h3>تفاصيل مرصودة من الصورة<span class="en">Image details</span></h3><table><thead><tr><th>المفتاح<div class="en">Key</div></th><th>الوصف<div class="en">Description</div></th><th>الدليل<div class="en">Evidence</div></th></tr></thead><tbody>${detailRows}</tbody></table>`:''}
<h3>مكوّنات القطعة<span class="en">Components</span></h3><table><thead><tr><th>القطعة<div class="en">Piece</div></th><th>العدد<div class="en">Qty</div></th><th>المصدر<div class="en">Source</div></th></tr></thead><tbody>${comp||'<tr><td colspan="3">—</td></tr>'}</tbody></table></section>
<section><h2>جدول القياسات<span class="en">Points of measure (POM)</span></h2>
<p class="note">الوحدة: <bdi>${esc(s.owner.unit)}</bdi> — المقاس الأساسي: <bdi>${esc(s.style.baseSize||'—')}</bdi>. القياسات المتدرجة تظهر فقط من قواعد تدريج معتمدة؛ لا يوجد تدريج آلي، والقيم الناقصة تبقى «مطلوب».<span class="en">Unit ${esc(s.owner.unit)} · base size ${esc(s.style.baseSize||'—')}. Graded values appear only from approved grade rules; no auto-grading. Missing values stay Pending.</span></p>
<table><thead><tr><th>الكود<div class="en">Code</div></th><th>نقطة القياس<div class="en">Point of measure</div></th><th>الأساس<div class="en">Basis</div></th><th>الأساسي<div class="en">Base</div></th>${gradedSizes.map(z=>`<th dir="ltr">${esc(z)}</th>`).join('')}<th>التفاوت<div class="en">Tolerance</div></th><th>المصدر<div class="en">Source</div></th></tr></thead><tbody>${pomRows||'<tr><td colspan="6">—</td></tr>'}</tbody></table>
${(s.grading.warnings||[]).length?`<div class="small" dir="ltr">${esc(s.grading.warnings.join(' · '))}</div>`:''}</section>
<section><h2>قائمة الخامات والإكسسوارات<span class="en">Bill of materials (BOM)</span></h2>
<table><thead><tr><th>الكود<div class="en">Code</div></th><th>الفئة<div class="en">Type</div></th><th>البند<div class="en">Item</div></th><th>المواصفة<div class="en">Specification</div></th><th>الكمية/قطعة<div class="en">Qty/unit</div></th><th>المورد<div class="en">Supplier</div></th><th>الحالة<div class="en">Status</div></th></tr></thead><tbody>${bomRows||'<tr><td colspan="7">—</td></tr>'}</tbody></table>
<p class="note">البنود «قالب الفئة» مقترحة ولم تُعتمد؛ لا توجد كميات استهلاك مفترضة.<span class="en">Template rows are proposals; no consumption is assumed.</span></p></section>
<section><h2>تسلسل العمليات ونقاط الجودة<span class="en">Construction sequence and QC</span></h2>
<table><thead><tr><th>#</th><th>العملية<div class="en">Operation</div></th><th>الماكينة<div class="en">Machine</div></th><th>الغرزة<div class="en">Stitch</div></th><th>نقطة الفحص<div class="en">QC checkpoint</div></th><th>المصدر<div class="en">Source</div></th></tr></thead><tbody>${opRows||'<tr><td colspan="6">—</td></tr>'}</tbody></table>
<p class="note">أنواع الخياطات وسماحات الخياطة غير المؤكدة معلّمة «TBC».<span class="en">Unconfirmed seam types and allowances are marked TBC.</span></p></section>
<section><h2>الباترون والمقاسات والكميات<span class="en">Pattern, size run and quantities</span></h2>
<div class="box warn"><b>الباترون: غير معتمد · Pattern Pending</b><div class="small">لا يوجد باترون مُتحقق هندسيًا بعد؛ لن تُرفق ملفات DXF/SVG قبل اعتماد القياسات وقواعد الراحة والسماحات.</div><div class="en">No validated pattern geometry yet; DXF/SVG will be attached in a later revision once measurements, ease and allowances are approved.</div><div class="small" dir="ltr">Open: ${esc(s.pattern.gaps.join(', '))}</div></div>
<h3>مصفوفة الكميات المخططة<span class="en">Planned quantity matrix</span></h3>${qTable}
<h3>احتياج الخامات<span class="en">Material requirement</span></h3><table><thead><tr><th>الخامة<div class="en">Material</div></th><th>لكل قطعة<div class="en">Per unit</div></th><th>الإجمالي<div class="en">Total</div></th><th>الحالة<div class="en">Status</div></th></tr></thead><tbody>${matRows||'<tr><td colspan="4">—</td></tr>'}</tbody></table>
<p class="note">يُحسب الاحتياج فقط من استهلاك معتمد لكل قطعة؛ لا توجد نسب هدر أو كفاءة ماركر مفترضة.<span class="en">Calculated only from approved per-unit consumption; no assumed waste or marker efficiency.</span></p></section>
<section><h2>سجل الإصدارات والاعتماد<span class="en">Revision and approval ledger</span></h2>
<table><thead><tr><th>الإصدار<div class="en">Rev</div></th><th>الحالة<div class="en">Status</div></th><th>التاريخ<div class="en">Date</div></th><th>البصمة<div class="en">Snapshot hash</div></th></tr></thead><tbody>${ledger}</tbody></table>
<h3>فحص الاكتمال<span class="en">Completeness check</span></h3><div class="box">${gate.ready?'جاهز للاعتماد من حيث اكتمال البيانات.':'بنود مفتوحة:'}${gate.blockers.length?`<ul class="open">${gate.blockers.map(b=>`<li>${esc(blockerAr(b))} <span class="small" dir="ltr">${esc(b)}</span></li>`).join('')}</ul>`:''}<div class="small" dir="ltr">Warnings: ${esc(gate.warnings.join(', '))}</div><div class="en">${esc(gate.note)}</div></div>
<p class="note">البصمات أدلة اتساق وليست توقيعًا رقميًا.<span class="en">Hashes are consistency evidence, not digital signatures.</span></p></section>
</body></html>`;}
export const headerTemplate=(s,revisionNo,status)=>`<div style="font-family:Arial,sans-serif;font-size:8px;width:100%;padding:0 13mm;display:flex;justify-content:space-between;align-items:center"><span style="color:#57606a">${esc(s.tenant.heading||'')} · ${esc(s.style.code)}</span><span style="font-weight:700;border:1px solid ${status==='APPROVED'?'#166534':'#9a3412'};color:${status==='APPROVED'?'#166534':'#9a3412'};padding:1px 6px">${status==='APPROVED'?'APPROVED':'DRAFT — NOT FOR PRODUCTION'} · R${esc(revisionNo)}</span></div>`;
export const footerTemplate=(s,revisionNo,status)=>`<div style="font-family:Arial,sans-serif;font-size:7.5px;color:#57606a;width:100%;padding:0 13mm;display:flex;justify-content:space-between"><span>SEHHA ApparelOS · ${esc(s.style.code)} · R${esc(revisionNo)} · ${esc(status)}</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
export function countPdfPages(bytes){const t=new TextDecoder('latin1').decode(bytes);return (t.match(/\/Type\s*\/Page(?!s)/g)||[]).length;}

// ---------- Routes ----------
const send=(status,body,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
async function render(env,request,doc,snapshot,opts){const [fonts,images]=await Promise.all([fontCss(env,request),imageDataUrls(env,snapshot)]);return renderHtml(snapshot,{...opts,fonts,images});}
async function docView(d){return {revisionNo:Number(d.revision_no),status:d.status,snapshotSha256:d.snapshot_sha256,htmlSha256:d.html_sha256,pdfSha256:d.pdf_sha256,pdfBytes:d.pdf_bytes,pageCount:d.page_count,gate:JSON.parse(d.gate_json||'{}'),createdBy:d.created_by,createdAt:d.created_at,approvedBy:d.approved_by,approvedAt:d.approved_at};}
export async function techpackRoute(request,env,ctx){
  const url=new URL(request.url),m=url.pathname.match(/^\/api\/styles\/([^/]+)\/techpack(?:\/revisions(?:\/(\d+)(?:\/(preview|pdf|approve))?)?)?$/),pm=url.pathname.match(/^\/api\/styles\/([^/]+)\/pattern-status$/);
  if(!m&&!pm)return null;
  const sess=await ctx.requireAuth(request,env),style=await env.DB.prepare('SELECT * FROM styles WHERE id=?').bind((m||pm)[1]).first();if(!style)return send(404,{error:'Style not found'});
  await ctx.requireOrg(env,sess,style.org_id);const role=await ctx.membershipRole(env,sess,style.org_id);
  const intakeRow=await env.DB.prepare('SELECT * FROM garment_intakes WHERE style_id=?').bind(style.id).first();
  if(pm&&request.method==='GET'){const intake=intakeRow?{category:intakeRow.category,category_source:intakeRow.category_source,answers:JSON.parse(intakeRow.answers_json||'{}'),classification:JSON.parse(intakeRow.classification_json||'{}')}:{answers:{}};const cat=categoryDef(intake.category);
    return send(200,{status:'PATTERN_PENDING',gaps:patternGaps(cat,intake.answers,questionPlan(intake)),dxf:null,svg:null,note:'Parametric drafting is a later gate; no geometry is generated from photographs.'});}
  const [,,rev,action]=m;
  if(!rev&&request.method==='GET'){const docs=(await env.DB.prepare('SELECT * FROM techpack_documents WHERE style_id=? ORDER BY revision_no DESC').bind(style.id).all()).results||[];
    return send(200,{documents:await Promise.all(docs.map(docView)),pdfEngine:pdfEngineStatus(env),canApprove:APPROVER_ROLES.has(role),category:categoryDef(intakeRow?.category)?publicCategory(categoryDef(intakeRow.category)):null});}
  if(url.pathname.endsWith('/revisions')&&request.method==='POST'){
    if(AUTHOR_BLOCKED.has(role))return send(403,{error:'دورك لا يسمح بإنشاء Tech Pack / Your role cannot create a Tech Pack',code:'ROLE_NOT_PERMITTED'});
    await ctx.requireFeature(env,style.org_id,'OUTPUT_TECHNICAL');
    const snapshot=await buildSnapshot(env,ctx,style,intakeRow,sess.userId),snapJson=JSON.stringify(stable(snapshot)),snapSha=await sha256(snapJson),gate=approvalGate(snapshot);
    for(let attempt=0;attempt<4;attempt++){const n=Number((await env.DB.prepare('SELECT COALESCE(MAX(revision_no),0)+1 n FROM techpack_documents WHERE style_id=?').bind(style.id).first()).n),id=ctx.randomId('tpd_'),ts=ctx.now();
      const html=await render(env,request,null,snapshot,{status:'DRAFT',revisionNo:n,createdAt:ts});const htmlSha=await sha256(html);
      try{await env.DB.batch([env.DB.prepare('INSERT INTO techpack_documents(id,org_id,style_id,revision_no,status,snapshot_json,snapshot_sha256,html_sha256,gate_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,style.org_id,style.id,n,'DRAFT',snapJson,snapSha,htmlSha,JSON.stringify(gate),sess.userId,ts),
        env.DB.prepare('INSERT INTO audit_log(org_id,user_id,entity_type,entity_id,action,detail_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(style.org_id,sess.userId,'TECHPACK_DOCUMENT',id,'DRAFT_CREATE',JSON.stringify({revisionNo:n,snapshotSha256:snapSha,gateReady:gate.ready}),ts)]);
        return send(201,{revisionNo:n,status:'DRAFT',snapshotSha256:snapSha,htmlSha256:htmlSha,gate});}
      catch(e){if(!/UNIQUE constraint failed/.test(String(e?.message||e)))throw e;}}
    return send(409,{error:'Concurrent revision creation; retry',code:'REVISION_CONFLICT'});}
  const doc=rev?await env.DB.prepare('SELECT * FROM techpack_documents WHERE style_id=? AND revision_no=?').bind(style.id,Number(rev)).first():null;if(rev&&!doc)return send(404,{error:'Revision not found'});
  if(rev&&!action&&request.method==='GET')return send(200,{document:await docView(doc)});
  const snapshot=doc?JSON.parse(doc.snapshot_json):null;
  if(action==='preview'&&request.method==='GET'){const approver=doc.approved_by?(await env.DB.prepare('SELECT display_name FROM users WHERE id=?').bind(doc.approved_by).first())?.display_name:null;
    const html=await render(env,request,doc,snapshot,{status:doc.status,revisionNo:doc.revision_no,createdAt:doc.created_at,approvedBy:approver,approvedAt:doc.approved_at});
    return new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-techpack-status':doc.status,'content-security-policy':"default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"}});}
  if(action==='pdf'&&request.method==='GET'){const name=`${style.code}-R${doc.revision_no}-${doc.status}.pdf`.replace(/[^A-Za-z0-9._-]/g,'_');
    if(doc.status==='APPROVED'){const o=await env.UPLOADS.get(doc.pdf_r2_key);if(!o)return send(410,{error:'Frozen PDF missing from storage',code:'FROZEN_PDF_MISSING'});const buf=await o.arrayBuffer();
      if(await sha256(buf)!==doc.pdf_sha256)return send(409,{error:'Frozen PDF failed its integrity check',code:'FROZEN_PDF_DRIFT'});
      return new Response(buf,{status:200,headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${name}"`,'cache-control':'no-store','x-techpack-status':'APPROVED','x-pdf-sha256':doc.pdf_sha256,etag:`"${doc.pdf_sha256}"`}});}
    if(!pdfEngineStatus(env).available)return send(503,{error:'محرك PDF غير متصل؛ المعاينة HTML متاحة / PDF engine not bound; HTML preview is available',code:'PDF_ENGINE_UNAVAILABLE',pdfEngine:pdfEngineStatus(env)});
    const html=await render(env,request,doc,snapshot,{status:'DRAFT',revisionNo:doc.revision_no,createdAt:doc.created_at});const bytes=await renderPdf(env,{html,headerTemplate:headerTemplate(snapshot,doc.revision_no,'DRAFT'),footerTemplate:footerTemplate(snapshot,doc.revision_no,'DRAFT')});
    return new Response(bytes,{status:200,headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${name}"`,'cache-control':'no-store','x-techpack-status':'DRAFT','x-pdf-sha256':await sha256(bytes),'x-page-count':String(countPdfPages(bytes))}});}
  if(action==='approve'&&request.method==='POST'){
    if(!APPROVER_ROLES.has(role))return send(403,{error:'دورك لا يسمح باعتماد Tech Pack / Your role cannot approve a Tech Pack',code:'ROLE_NOT_PERMITTED'});
    if(doc.status==='APPROVED')return send(200,{document:await docView(doc),replayed:true});
    const gate=approvalGate(snapshot);if(!gate.ready)return send(409,{error:'لا يمكن الاعتماد قبل استكمال البيانات الأساسية / Required data is incomplete',code:'TECHPACK_GATE_BLOCKED',gate});
    if(!pdfEngineStatus(env).available)return send(503,{error:'محرك PDF غير متصل؛ لا يمكن تجميد ملف معتمد / PDF engine not bound; cannot freeze an approved PDF',code:'PDF_ENGINE_UNAVAILABLE',pdfEngine:pdfEngineStatus(env)});
    const me=await env.DB.prepare('SELECT display_name FROM users WHERE id=?').bind(sess.userId).first(),ts=ctx.now();
    const html=await render(env,request,doc,snapshot,{status:'APPROVED',revisionNo:doc.revision_no,createdAt:doc.created_at,approvedBy:me?.display_name||sess.userId,approvedAt:ts});
    const bytes=await renderPdf(env,{html,headerTemplate:headerTemplate(snapshot,doc.revision_no,'APPROVED'),footerTemplate:footerTemplate(snapshot,doc.revision_no,'APPROVED')}),pdfSha=await sha256(bytes),key=`techpack/${style.id}/R${doc.revision_no}-${pdfSha}.pdf`,pages=countPdfPages(bytes);
    await env.UPLOADS.put(key,bytes,{httpMetadata:{contentType:'application/pdf'},customMetadata:{styleId:style.id,revisionNo:String(doc.revision_no),sha256:pdfSha}});
    const res=await env.DB.batch([env.DB.prepare("UPDATE techpack_documents SET status='APPROVED',approved_by=?,approved_at=?,pdf_r2_key=?,pdf_sha256=?,pdf_bytes=?,page_count=?,html_sha256=? WHERE id=? AND status='DRAFT'").bind(sess.userId,ts,key,pdfSha,bytes.length,pages,await sha256(html),doc.id),
      env.DB.prepare("INSERT INTO audit_log(org_id,user_id,entity_type,entity_id,action,detail_json,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM techpack_documents WHERE id=? AND status='APPROVED' AND pdf_sha256=?)").bind(style.org_id,sess.userId,'TECHPACK_DOCUMENT',doc.id,'APPROVE',JSON.stringify({revisionNo:doc.revision_no,pdfSha256:pdfSha,pages,snapshotSha256:doc.snapshot_sha256}),ts,doc.id,pdfSha)]);
    if(!(res[0]?.meta?.changes>0)){const cur=await env.DB.prepare('SELECT * FROM techpack_documents WHERE id=?').bind(doc.id).first();return send(200,{document:await docView(cur),replayed:true});}
    return send(200,{document:await docView(await env.DB.prepare('SELECT * FROM techpack_documents WHERE id=?').bind(doc.id).first())});}
  return send(405,{error:'Method not allowed'});
}
