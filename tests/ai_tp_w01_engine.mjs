// AI-TP-W01 — adaptive engine extensions, Tech Pack hardening, pattern readiness and the synthetic geometry prototype.
// No Browser Rendering in Node: the approval commit (storage + compare-and-set) is exercised through commitApproval with
// injected R2/D1 failures; the end-to-end PDF path is covered by the local wrangler dev acceptance scripts.
import {makeHarness,ok} from './test_helpers.mjs';
import {syntheticGarmentPng,pngDataUrl,JK003,SYNTH_SHIRT,KHIMAR_0004,SYNTH_APRON} from './techpack_fixtures.mjs';
import {GARMENT_CATEGORIES,CATEGORY_KEYS,questionPlan,componentProvenance,patternReadiness,categoryDef} from '../src/garment_intake.js';
import {commitApproval} from '../src/techpack_pdf.js';
import {buildPieces,toSvg,toDxf,geometryManifest,validateGeometrySpec,offsetPolygon,bbox} from '../src/pattern_geometry.js';
const h=makeHarness(),{call,db,env}=h;await h.login();
const org=(await call('/api/me')).data.workspaces.find(w=>w.code==='MOHSEN'),ts0=new Date().toISOString();
const row=(area,id,scenario,expected,actual,pass)=>{console.log('MATRIX '+JSON.stringify({area,id,scenario,expected,actual,verdict:pass?'PASS':'FAIL'}));ok(pass,`${id} ${scenario}`);};
const devHash=db.prepare("SELECT password_hash,password_salt FROM users WHERE email='dev@sehha.local'").get();
async function user(id,role){db.prepare('INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)').run(id,`${id}@w1.local`,id,devHash.password_hash,devHash.password_salt,ts0);db.prepare('INSERT INTO memberships(user_id,org_id,role) VALUES(?,?,?)').run(id,org.id,role);
  const r=await call('/api/auth/login',{method:'POST',body:{email:`${id}@w1.local`,password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});return (r.r.headers.get('set-cookie')||'').split(';')[0];}
const dpm=await user('w1_dpm','DESIGN_PATTERN_MASTER'),fsup=await user('w1_fs','FACTORY_SUPERVISOR');
let seq=0,shade=10;
const newStyle=async(code,name='W01')=>(await call('/api/styles',{method:'POST',body:{orgId:org.id,code:`${code}-${++seq}`,name,garmentType:'CUSTOM',audience:'WOMEN',sizingMode:'STANDARD'}})).data.id;
const upload=async(id,role='REFERENCE')=>{const x=await call(`/api/styles/${id}/assets`,{method:'POST',body:{dataUrl:'data:image/png;base64,'+syntheticGarmentPng(220,280,[shade++,40,50]).toString('base64'),role,filename:`${role.toLowerCase()}.png`}});if(x.r.status!==201)throw new Error(JSON.stringify(x.data));return x.data.id;};
const analyze=(id,body)=>call(`/api/styles/${id}/intake/analyze`,{method:'POST',body});
const setCat=(id,category)=>call(`/api/styles/${id}/intake/category`,{method:'POST',body:{category}});
const answer=(id,body)=>call(`/api/styles/${id}/intake/answers`,{method:'PUT',body});
const draft=id=>call(`/api/styles/${id}/techpack/revisions`,{method:'POST',body:{}});
const B='ENGINE',C='TECHPACK',D='PATTERN',G='GEOMETRY';

// ---------- W01-B adaptive engine ----------
{const all=CATEGORY_KEYS.flatMap(k=>GARMENT_CATEGORIES[k].pom.map(p=>({k,p}))),noDef=all.filter(x=>!x.p.landmark);
 row(B,'E-B01','every point of measure carries a start→end landmark definition (AR+EN)','0 POM without a definition',`${all.length} POM, ${noDef.length} without: ${noDef.map(x=>x.k+':'+x.p.code).join(',')}`,noDef.length===0&&all.every(x=>x.p.landmark.ar&&x.p.landmark.en));
 const jk=GARMENT_CATEGORIES.JACKET,po=jk.pom.filter(p=>p.requiredFor.join()==='PATTERN').map(p=>p.code);
 row(B,'E-B02','pattern-only POM are not approval-critical','JACKET pattern-only = SHOULDER,ARMHOLE,NECK_WIDTH,BACK_LENGTH,BUTTON_START; none critical',po.join(','),po.join(',')==='SHOULDER,ARMHOLE,NECK_WIDTH,BACK_LENGTH,BUTTON_START'&&jk.pom.filter(p=>po.includes(p.code)).every(p=>!p.critical));
 const crit=Object.fromEntries(jk.pom.filter(p=>p.critical).map(p=>[p.code,{value:40,basis:p.basisOptions[0]}]));
 const plan=questionPlan({category:'JACKET',category_source:'OWNER_CONFIRMED',answers:{unit:'cm',garmentBasis:'FINISHED_GARMENT',baseSize:'M',measurements:crit,specs:{fit:'REGULAR',closure:'BUTTONS',lining:'NONE'}},classification:{}});
 row(B,'E-B03','complete approval data: pattern measurements are offered separately and never block','0 approval groups; patternQuestions = WAIST (fit not FITTED, still needed to draft) + the 5 pattern-only POM',`${plan.groups.length} groups · ${plan.patternQuestions.map(q=>q.code).join(',')}`,plan.groups.length===0&&plan.readyForApproval&&plan.patternQuestions.map(q=>q.code).join()==='WAIST,SHOULDER,ARMHOLE,NECK_WIDTH,BACK_LENGTH,BUTTON_START'&&plan.patternQuestions.every(q=>q.optional&&q.landmark));}

let jkId,jkRev;{jkId=await newStyle(JK003.code,JK003.name);await upload(jkId);await analyze(jkId,{ownerNotes:JK003.ownerNotes});await setCat(jkId,'JACKET');
 const ms=Object.fromEntries(Object.entries(JK003.measurementsM).map(([c,v])=>[c,{value:v}]));ms.CHEST.tolPlus=1;ms.CHEST.tolMinus=1;
 const a=await answer(jkId,{unit:'cm',baseSize:'M',measurements:ms,specs:JK003.specs});
 const dbm=db.prepare("SELECT tolerance_plus tp,tolerance_minus tm FROM measurements WHERE style_id=? AND code=?"),c=dbm.get(jkId,'CHEST'),bw=dbm.get(jkId,'BACK_WIDTH');
 row(B,'E-B04','explicit tolerance is stored; missing tolerance stays empty (NO_TOLERANCE)','CHEST ±1; BACK_WIDTH null/null',`${a.r.status} CHEST ${c.tp}/${c.tm} BACK_WIDTH ${bw.tp}/${bw.tm}`,a.r.status===200&&c.tp===1&&c.tm===1&&bw.tp===null&&bw.tm===null);
 const bad=await answer(jkId,{measurements:{CHEST:{value:56,tolPlus:50}}});row(B,'E-B05','implausible tolerance rejected','400',`${bad.r.status} ${bad.data.error}`,bad.r.status===400);
 const d=await answer(jkId,{description:{ar:'جاكيت نسائي بغلق مائل غير متماثل وأربعة أزرار.',en:'Women\'s jacket with an asymmetric angled closure and four buttons.'}});
 const dd=d.data.intake.answers.description;row(B,'E-B06','owner edits the bilingual technical description','stored as OWNER_ASSERTION with AR and EN',`${d.r.status} ${dd?.source} ${!!dd?.ar} ${!!dd?.en}`,d.r.status===200&&dd.source==='OWNER_ASSERTION'&&dd.ar.includes('مائل')&&dd.en.includes('asymmetric'));
 const badD=await answer(jkId,{description:{ar:42}});row(B,'E-B07','non-text description rejected','400',String(badD.r.status),badD.r.status===400);
 const t=await draft(jkId);jkRev=t.data.revisionNo;const snap=JSON.parse(db.prepare('SELECT snapshot_json FROM techpack_documents WHERE style_id=? AND revision_no=?').get(jkId,jkRev).snapshot_json);
 const comp=Object.fromEntries(snap.components.map(c=>[c.en,c]));
 row(B,'E-B08','JK-003 component provenance from a single REFERENCE photo + owner facts','Fronts GEOMETRIC_RULE (no tagged front view), Back GEOMETRIC_RULE + BACK_UNOBSERVED note, Lining OWNER_ASSERTION, Collar OWNER_ASSERTION, sleeves pair',
   Object.values(comp).map(c=>`${c.en}:${c.source}${c.note?'('+c.note+')':''}`).join(' | '),comp['Fronts (L/R)'].source==='GEOMETRIC_RULE'&&comp['Back'].source==='GEOMETRIC_RULE'&&comp['Back'].note==='BACK_UNOBSERVED_SHAPE_REQUIRES_REVIEW'&&comp['Lining (if any)'].source==='OWNER_ASSERTION'&&comp['Collar'].source==='OWNER_ASSERTION'&&comp['Sleeves'].qty===2);
 const live=componentProvenance(categoryDef('JACKET'),{category:'JACKET',views:[{view:'FRONT'}],details:[{key:'collar',evidence:'OBSERVED'},{key:'pockets',evidence:'INFERRED'}]},{},['REFERENCE']);const lv=Object.fromEntries(live.map(c=>[c.en,c.source]));
 row(B,'E-B09','live classification evidence maps to VISIBLE / ENGINEERING_PROPOSAL; unseen lining stays UNVERIFIED','Fronts VISIBLE, Collar VISIBLE, Lining UNVERIFIED, Back GEOMETRIC_RULE',JSON.stringify(lv),lv['Fronts (L/R)']==='VISIBLE'&&lv['Collar']==='VISIBLE'&&lv['Lining (if any)']==='UNVERIFIED'&&lv['Back']==='GEOMETRIC_RULE');
 const pomC=snap.pom.find(p=>p.code==='CHEST'),pomB=snap.pom.find(p=>p.code==='BUTTON_START');
 row(B,'E-B10','snapshot POM rows carry definition, requiredFor and explicit tolerance','CHEST definition + ±1; BUTTON_START is a pattern input with no value',`${!!pomC.definition} ${pomC.tolPlus}/${pomC.tolMinus} ${pomB.requiredFor} ${pomB.value}`,!!pomC.definition?.en&&pomC.tolPlus===1&&pomB.requiredFor.join()==='PATTERN'&&pomB.value===null&&pomB.critical===false);}

// Garment 0004 khimar (weight bands, concealed zip, embroidery)
{const id=await newStyle(KHIMAR_0004.code,KHIMAR_0004.name);await upload(id);const an=await analyze(id,{ownerNotes:KHIMAR_0004.ownerNotes});
 row(B,'E-B11','0004 owner text suggests abaya/khimar (mock, LOW)','ABAYA_KHIMAR LOW MOCK',`${an.data.intake?.category} ${an.data.intake?.classification?.confidence} ${an.data.run?.mode}`,an.data.intake.category==='ABAYA_KHIMAR'&&an.data.intake.classification.confidence==='LOW'&&an.data.run.mode==='MOCK');
 await setCat(id,'ABAYA_KHIMAR');const a=await answer(id,{unit:'cm',specs:KHIMAR_0004.specs});const p=a.data.intake.plan,qs=p.groups.flatMap(g=>g.questions);
 const size=qs.find(q=>q.id==='baseSize');
 row(B,'E-B12','0004 asks a weight band (not S/M/L) and the opening length that drives the concealed zip','baseSize without S/M/L options; pom:OPENING asked; FACE_OPENING offered for the pattern',`${size?.labelEn} options=${size?.options?.length||0} · ${qs.filter(q=>q.kind==='pom').map(q=>q.code)} · pattern ${p.patternQuestions.map(q=>q.code)}`,
   !!size&&!size.options&&qs.some(q=>q.code==='OPENING')&&p.patternQuestions.some(q=>q.code==='FACE_OPENING'));
 const qm=await answer(id,{quantityMatrix:{sizes:KHIMAR_0004.testWeightBands,colors:['BLACK'],cells:{'WB-TEST-1|BLACK':40,'WB-TEST-2|BLACK':60}}});
 const t=await draft(id),s=JSON.parse(db.prepare('SELECT snapshot_json FROM techpack_documents WHERE style_id=? AND revision_no=?').get(id,t.data.revisionNo).snapshot_json);
 const zip=s.bom.find(b=>b.code==='P-ZP'),head=s.components.find(c=>/Head piece/.test(c.en));
 row(B,'E-B13','0004 Tech Pack: concealed zip length tied to the opening, embroidery kept as owner text, head piece OWNER_ASSERTION, no consumption invented','P-ZP concealed; material CONSUMPTION_NOT_CONFIRMED; quantity total 100; sizing WEIGHT_BANDS',
   `${zip?.nameEn} · ${zip?.specEn} · head ${head?.source} · ${s.material.map(m=>m.status)} · total ${s.quantity?.totals?.total} · ${s.style.sizingMode}`,
   qm.r.status===200&&zip?.nameEn==='Concealed zipper'&&/opening/.test(zip.specEn)&&head?.source==='OWNER_ASSERTION'&&s.material.every(m=>m.status==='CONSUMPTION_NOT_CONFIRMED')&&s.quantity.totals.total===100&&s.style.sizingMode==='WEIGHT_BANDS'&&/بنفسجي/.test(s.owner.specs.embroidery));}

// Separation of duties (opt-in)
let synId,synRev;{synId=await newStyle(SYNTH_SHIRT.code,SYNTH_SHIRT.name);await upload(synId);await analyze(synId,{ownerNotes:SYNTH_SHIRT.ownerNotes});await setCat(synId,'SHIRT');
 await answer(synId,{unit:'cm',garmentBasis:'FINISHED_GARMENT',baseSize:'M',measurements:SYNTH_SHIRT.measurements,specs:SYNTH_SHIRT.specs});synRev=(await draft(synId)).data.revisionNo;
 const off=await call(`/api/styles/${synId}/techpack/revisions/${synRev}/approve`,{method:'POST',body:{}});
 env.TECHPACK_SEPARATION_OF_DUTIES='1';
 try{const self=await call(`/api/styles/${synId}/techpack/revisions/${synRev}/approve`,{method:'POST',body:{}}),other=await call(`/api/styles/${synId}/techpack/revisions/${synRev}/approve`,{method:'POST',body:{},cookieOverride:dpm});
  row(B,'E-B14','separation of duties: author cannot approve their own revision when enabled; another approver can','default 503 (engine step); enabled: author 409 SELF_APPROVAL_FORBIDDEN, other approver reaches the PDF step (503)',`${off.r.status} · ${self.r.status} ${self.data.code} · ${other.r.status} ${other.data.code}`,
    off.r.status===503&&self.r.status===409&&self.data.code==='SELF_APPROVAL_FORBIDDEN'&&other.r.status===503&&other.data.code==='PDF_ENGINE_UNAVAILABLE');}
 finally{delete env.TECHPACK_SEPARATION_OF_DUTIES;}}

// ---------- W01-C Tech Pack hardening ----------
{const r=await call(`/api/styles/${jkId}/techpack/revisions/${jkRev}/preview`);const html=r.data||'';
 row(C,'E-C01','rendered HTML carries its own CSP (no network, no script) in addition to the response header','meta CSP default-src none; header present',`${/http-equiv="Content-Security-Policy" content="default-src 'none'/.test(html)} ${!!r.r.headers.get('content-security-policy')}`,/http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:/.test(html)&&!/<script/i.test(html)&&!!r.r.headers.get('content-security-policy'));
 row(C,'E-C02','no back photo: the back is shown as UNOBSERVABLE / REQUIRES_REVIEW, never drawn','back box present',String(/BACK: UNOBSERVABLE \/ REQUIRES_REVIEW/.test(html)),/BACK: UNOBSERVABLE \/ REQUIRES_REVIEW/.test(html)&&/الخلف غير ظاهر/.test(html));
 row(C,'E-C03','manual sign-off table for DESIGN / PATTERN / PRODUCTION / QC, stated as not a digital signature','4 roles + disclaimer',['DESIGN','PATTERN','PRODUCTION','QC'].filter(k=>html.includes(`<div class="en">${k}</div>`)).join(','),['DESIGN','PATTERN','PRODUCTION','QC'].every(k=>html.includes(`<div class="en">${k}</div>`))&&/not a digital signature or production authorization/.test(html));
 const iOwner=html.indexOf('Owner technical description'),iAi=html.indexOf('Recognition-based description');
 row(C,'E-C04','owner description is printed before (and separate from) the recognition hypothesis','owner block first',`${iOwner} < ${iAi}`,iOwner>0&&iAi>iOwner&&/component list for review — not an approved cutting pattern/.test(html));}
{const id=await newStyle('BACKVIEW');await upload(id);await upload(id,'TECHNICAL_BACK');await analyze(id,{ownerNotes:'jacket'});await setCat(id,'JACKET');const n=(await draft(id)).data.revisionNo;
 const html=(await call(`/api/styles/${id}/techpack/revisions/${n}/preview`)).data||'',s=JSON.parse(db.prepare('SELECT snapshot_json FROM techpack_documents WHERE style_id=? AND revision_no=?').get(id,n).snapshot_json);
 row(C,'E-C05','with a TECHNICAL_BACK photo the back reference shows the image and Back becomes VISIBLE','no UNOBSERVABLE box; Back VISIBLE; views.back true',`${/UNOBSERVABLE/.test(html)} ${s.components.find(c=>c.en==='Back').source} ${s.views.back}`,!/BACK: UNOBSERVABLE/.test(html)&&s.components.find(c=>c.en==='Back').source==='VISIBLE'&&s.views.back===true&&(html.match(/<figure>/g)||[]).length===2);}

const fakePdf=tag=>new TextEncoder().encode(`%PDF-1.4\n1 0 obj <</Type /Page>> endobj\n2 0 obj <</Type /Page>> endobj\n%${tag}\n%%EOF`);
const docRow=(id,n)=>db.prepare('SELECT * FROM techpack_documents WHERE style_id=? AND revision_no=?').get(id,n);
const styleRow=id=>db.prepare('SELECT * FROM styles WHERE id=?').get(id);
const prefix=id=>[...env.UPLOADS.map.keys()].filter(k=>k.startsWith(`techpack/${id}/`));
{const doc=docRow(synId,synRev),st=styleRow(synId),put=env.UPLOADS.put;
 env.UPLOADS.put=async()=>{throw new Error('R2 unavailable (simulated)');};
 let r;try{r=await commitApproval(env,{doc,style:st,userId:'w1_dpm',ts:new Date().toISOString(),bytes:fakePdf('a'),htmlSha:'h'});}finally{env.UPLOADS.put=put;}
 row(C,'E-C06','R2 put fails during approval','503 PDF_STORAGE_FAILED; revision stays DRAFT; no object',`${r.status} ${r.body.code} ${docRow(synId,synRev).status} objects=${prefix(synId).length}`,r.status===503&&r.body.code==='PDF_STORAGE_FAILED'&&docRow(synId,synRev).status==='DRAFT'&&prefix(synId).length===0);
 const batch=env.DB.batch.bind(env.DB);env.DB.batch=()=>{throw new Error('D1_ERROR: database is locked (simulated)');};
 try{r=await commitApproval(env,{doc,style:st,userId:'w1_dpm',ts:new Date().toISOString(),bytes:fakePdf('b'),htmlSha:'h'});}finally{env.DB.batch=batch;}
 row(C,'E-C07','D1 write fails after the PDF was stored','503 APPROVAL_WRITE_FAILED; stored object removed; still DRAFT',`${r.status} ${r.body.code} ${docRow(synId,synRev).status} objects=${prefix(synId).length}`,r.status===503&&r.body.code==='APPROVAL_WRITE_FAILED'&&docRow(synId,synRev).status==='DRAFT'&&prefix(synId).length===0);
 const won=await commitApproval(env,{doc,style:st,userId:'w1_dpm',ts:new Date().toISOString(),bytes:fakePdf('winner'),htmlSha:'h'}),after=docRow(synId,synRev);
 const lost=await commitApproval(env,{doc,style:st,userId:'w1_dpm',ts:new Date().toISOString(),bytes:fakePdf('loser'),htmlSha:'h'});
 row(C,'E-C08','approval succeeds once; a concurrent loser (stale DRAFT read) loses the compare-and-set and its object is deleted','winner APPROVED with 2 pages; loser replayed; exactly one object = winner key; one APPROVE audit',
   `${won.status} ${after.status} pages=${after.page_count} · loser ${lost.status} replayed=${lost.body.replayed} · objects ${prefix(synId).length}`,
   won.status===200&&after.status==='APPROVED'&&after.page_count===2&&lost.body.replayed===true&&prefix(synId).length===1&&prefix(synId)[0]===after.pdf_r2_key&&db.prepare("SELECT COUNT(*) n FROM audit_log WHERE entity_id=? AND action='APPROVE'").get(doc.id).n===1);
 const pdf=await call(`/api/styles/${synId}/techpack/revisions/${synRev}/pdf`);
 row(C,'E-C09','approved PDF is served from the frozen R2 bytes (no re-render)','200 APPROVED, x-pdf-sha256 = stored hash',`${pdf.r.status} ${pdf.r.headers.get('x-techpack-status')}`,pdf.r.status===200&&pdf.r.headers.get('x-pdf-sha256')===after.pdf_sha256);
 const chk=await call(`/api/styles/${synId}/techpack/storage-check`);row(C,'E-C10','storage reconciliation on a consistent style','consistent, 1 approved, 0 orphans',JSON.stringify({c:chk.data.consistent,a:chk.data.approved,o:chk.data.orphans}),chk.r.status===200&&chk.data.consistent===true&&chk.data.approved===1);
 await env.UPLOADS.put(`techpack/${synId}/R${synRev}-orphan.pdf`,fakePdf('orphan'),{});const orig=env.UPLOADS.map.get(after.pdf_r2_key);await env.UPLOADS.put(after.pdf_r2_key,fakePdf('tampered'),{});
 const bad=await call(`/api/styles/${synId}/techpack/storage-check`);
 row(C,'E-C11','reconciliation reports an orphan object and hash drift','1 orphan, 1 drift, consistent=false',`${bad.data.orphans.length} orphan ${bad.data.drift.length} drift`,bad.data.orphans.length===1&&bad.data.drift.length===1&&bad.data.consistent===false);
 const denied=await call(`/api/styles/${synId}/techpack/storage-check`,{method:'POST',body:{deleteOrphans:true},cookieOverride:fsup});
 const fix=await call(`/api/styles/${synId}/techpack/storage-check`,{method:'POST',body:{deleteOrphans:true}});env.UPLOADS.map.set(after.pdf_r2_key,orig);
 const again=await call(`/api/styles/${synId}/techpack/storage-check`);
 row(C,'E-C12','orphan cleanup is approver-only, audited, and never touches the approved object','FACTORY_SUPERVISOR 403; cleanup deletes 1; then consistent',`${denied.r.status} · deleted ${fix.data.deleted.length} · ${again.data.consistent}`,denied.r.status===403&&fix.data.deleted.length===1&&again.data.consistent===true&&db.prepare("SELECT COUNT(*) n FROM audit_log WHERE entity_type='TECHPACK_STORAGE' AND action='ORPHAN_CLEANUP'").get().n===1);
 db.prepare("DELETE FROM techpack_documents WHERE 0").run();
 const list=env.UPLOADS.list;env.UPLOADS.list=async()=>{throw new Error('D1_ERROR: no such table secret_internal_table at /srv/worker/x.js');};
 let leak;try{leak=await call(`/api/styles/${synId}/techpack/storage-check`);}finally{env.UPLOADS.list=list;}
 row(C,'E-C13','unexpected internal error in a Tech Pack route is sanitized','500 INTERNAL_ERROR with a ref; no SQL/path text in the body',`${leak.r.status} ${leak.data.code} ${leak.data.ref?'ref':''}`,leak.r.status===500&&leak.data.code==='INTERNAL_ERROR'&&!!leak.data.ref&&!JSON.stringify(leak.data).includes('secret_internal'));}

{env.BROWSER={fetch:async()=>{throw new Error('BrowserStartupError: Failed to launch the browser process (simulated)');}};let r;
 try{r=await call(`/api/styles/${jkId}/techpack/revisions/${jkRev}/pdf`);}finally{delete env.BROWSER;}
 row(C,'E-C14','browser binding present but the browser cannot start','503 PDF_ENGINE_UNAVAILABLE (not a generic 500); no launch text leaked',`${r.r.status} ${r.data.code}`,r.r.status===503&&r.data.code==='PDF_ENGINE_UNAVAILABLE'&&!JSON.stringify(r.data).includes('BrowserStartupError'));}

// ---------- W01-D pattern readiness ----------
{const ps=await call(`/api/styles/${jkId}/pattern-status`),miss=ps.data.missingInputs||[];
 row(D,'E-D01','JK-003 pattern readiness is BLOCKED_PATTERN_INPUTS with the exact missing inputs','BLOCKED; includes BACK_VIEW_UNOBSERVED, SEAM_ALLOWANCES_NOT_CONFIRMED, EASE_RULES_NOT_DEFINED, PATTERN_POM_MISSING:BUTTON_START, GRAINLINE_NOT_CONFIRMED; cutReady false; no DXF/SVG',
   `${ps.data.readiness} · ${miss.join(',')} · cutReady=${ps.data.cutReady} dxf=${ps.data.dxf}`,ps.r.status===200&&ps.data.readiness==='BLOCKED_PATTERN_INPUTS'&&['BACK_VIEW_UNOBSERVED','SEAM_ALLOWANCES_NOT_CONFIRMED','EASE_RULES_NOT_DEFINED','PATTERN_POM_MISSING:BUTTON_START','GRAINLINE_NOT_CONFIRMED','BASE_BLOCK_NOT_SELECTED'].every(x=>miss.includes(x))&&ps.data.cutReady===false&&ps.data.dxf===null&&ps.data.gaps.includes('PARAMETRIC_DRAFTING_ENGINE_NOT_VALIDATED'));
 const man=ps.data.manifest;row(D,'E-D02','piece manifest: mirrored pairs from structure, grain TBC, no geometry','Fronts/Sleeves cutQty 2 GEOMETRIC_RULE; every grain TBC; geometry null',man.map(m=>`${m.en}:${m.cutQty??'-'}`).join(','),man.find(m=>m.en==='Fronts (L/R)').cutQty===2&&man.every(m=>m.grain==='TBC'&&m.geometry===null));
 const bad1=await answer(jkId,{patternInputs:{seamAllowanceMm:{MAIN:100}}}),bad2=await answer(jkId,{patternInputs:{ease:{HIP:2}}}),bad3=await answer(jkId,{patternInputs:{seamAllowanceMm:{SLEEVE:10}}});
 row(D,'E-D03','invalid pattern inputs rejected','seam 100 mm 400; ease for a non-jacket POM 400; unknown seam class 400',`${bad1.r.status} ${bad2.r.status} ${bad3.r.status}`,bad1.r.status===400&&bad2.r.status===400&&bad3.r.status===400);}
{const id=synId;await answer(id,{measurements:{ARMHOLE:{value:48,basis:'CIRCUMFERENCE'},NECK_WIDTH:{value:17},CUFF:{value:24,basis:'CIRCUMFERENCE'}},patternInputs:{seamAllowanceMm:{MAIN:10,HEM:25},baseBlock:'SYNTHETIC test shirt block',grainConfirmed:true}});
 const p1=await call(`/api/styles/${id}/pattern-status`);
 await upload(id,'TECHNICAL_BACK');const p2=await call(`/api/styles/${id}/pattern-status`);
 row(D,'E-D04','complete synthetic inputs: only the back view blocks until a back photo exists; then inputs complete but still not cut-ready','before: [BACK_VIEW_UNOBSERVED]; after: INPUTS_COMPLETE__DRAFTING_ENGINE_PENDING, cutReady false',
   `${p1.data.missingInputs.join(',')} → ${p2.data.readiness} cutReady=${p2.data.cutReady}`,p1.data.missingInputs.join()==='BACK_VIEW_UNOBSERVED'&&p2.data.readiness==='INPUTS_COMPLETE__DRAFTING_ENGINE_PENDING'&&p2.data.cutReady===false&&p2.data.gaps.join()==='PARAMETRIC_DRAFTING_ENGINE_NOT_VALIDATED');
 const pure=patternReadiness(categoryDef('JACKET'),{garmentBasis:'BODY',measurements:{}},{blockers:[]},{});
 row(D,'E-D05','body-basis measurements require explicit ease (never defaulted)','EASE_RULES_NOT_DEFINED present',pure.missingInputs.filter(x=>/EASE/.test(x)).join(),pure.missingInputs.includes('EASE_RULES_NOT_DEFINED'));}

// ---------- W01-D synthetic geometry prototype ----------
{const rej=[['OWNER_PHOTO source',{...SYNTH_APRON,source:'OWNER_PHOTO'}],['cm unit',{...SYNTH_APRON,unit:'cm'}],['self-intersecting outline',{...SYNTH_APRON,pieces:[{...SYNTH_APRON.pieces[1],polygon:[[0,0],[200,180],[200,0],[0,180]]}]}],['missing allowance',{...SYNTH_APRON,pieces:[{...SYNTH_APRON.pieces[1],seamAllowanceMm:[10,10]}]}],['no grainline',{...SYNTH_APRON,pieces:[{...SYNTH_APRON.pieces[1],grainline:null}]}]]
   .map(([l,s])=>{try{validateGeometrySpec(s);return `${l}:ACCEPTED`}catch(e){return `${l}:${e.code}`}});
 row(G,'E-G01','geometry writer refuses anything but explicit synthetic geometry','5 rejections; OWNER_PHOTO → GEOMETRY_SOURCE_NOT_ALLOWED',rej.join(' | '),rej.every(x=>!x.endsWith('ACCEPTED'))&&rej[0].endsWith('GEOMETRY_SOURCE_NOT_ALLOWED'));
 const sq=offsetPolygon([[0,0],[100,0],[100,50],[0,50]],[10,10,10,10]),b=bbox(sq);
 row(G,'E-G02','outward offset of a 100×50 mm rectangle by 10 mm','120×70 mm, corners at (-10,-10)',`${b.width}×${b.height} ${JSON.stringify(sq[0])}`,b.width===120&&b.height===70&&sq[0][0]===-10&&sq[0][1]===-10);
 const pieces=buildPieces(SYNTH_APRON),pk=pieces.find(p=>p.code==='POCKET'),bd=pieces.find(p=>p.code==='BODY');
 row(G,'E-G03','per-edge allowance (25 mm hem) on the synthetic pocket and body','pocket cut 220×215; body cut height 735',`${pk.metrics.cutWidthMm}×${pk.metrics.cutHeightMm} · body ${bd.metrics.cutHeightMm}`,pk.metrics.cutWidthMm===220&&pk.metrics.cutHeightMm===215&&bd.metrics.cutHeightMm===735);
 const svg=toSvg(SYNTH_APRON,pieces),[,w,hh,vw,vh]=/width="([\d.]+)mm" height="([\d.]+)mm" viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)||[];
 row(G,'E-G04','SVG is 1:1 millimetres','width/height in mm equal the viewBox; 3 CUT + 3 SEW paths; cut-ready false',`${w}mm×${hh}mm vb ${vw}×${vh}`,w===vw&&hh===vh&&(svg.match(/data-layer="CUT"/g)||[]).length===3&&(svg.match(/data-layer="SEW"/g)||[]).length===3&&/data-cut-ready="false"/.test(svg));
 // Independent minimal DXF reader (group-code pairs) — does not reuse the writer.
 const dxf=toDxf(SYNTH_APRON,pieces),lines=dxf.trim().split('\n'),pairs=[];for(let i=0;i+1<lines.length;i+=2)pairs.push([Number(lines[i]),lines[i+1]]);
 const ents=[];let cur=null;for(const [c,v] of pairs){if(c===0){cur={type:v,g:[]};ents.push(cur);}else if(cur)cur.g.push([c,v]);}
 const polys=[];for(let i=0;i<ents.length;i++){if(ents[i].type!=='POLYLINE')continue;const layer=ents[i].g.find(x=>x[0]===8)[1],closed=Number(ents[i].g.find(x=>x[0]===70)[1])&1,v=[];let j=i+1;for(;ents[j].type==='VERTEX';j++)v.push([Number(ents[j].g.find(x=>x[0]===10)[1]),Number(ents[j].g.find(x=>x[0]===20)[1])]);polys.push({layer,closed,v});}
 const units=pairs.findIndex(([c,v])=>c===9&&v==='$INSUNITS'),cut=polys.filter(p=>p.layer==='CUT');
 row(G,'E-G05','DXF (R12) parsed independently: mm units, closed outlines, exact vertices','$INSUNITS 4; 3 closed CUT + 3 closed SEW; pocket CUT bbox 220×215',`units=${pairs[units+1]?.[1]} CUT=${cut.length} SEW=${polys.filter(p=>p.layer==='SEW').length} pocket ${bbox(cut[1].v).width}×${bbox(cut[1].v).height}`,
   pairs[units+1][1]==='4'&&cut.length===3&&polys.filter(p=>p.layer==='SEW').length===3&&polys.every(p=>p.closed)&&bbox(cut[1].v).width===220&&bbox(cut[1].v).height===215&&JSON.stringify(cut[0].v)===JSON.stringify(pieces[0].cut));
 const man=geometryManifest(SYNTH_APRON,pieces);row(G,'E-G06','geometry manifest never claims cut-ready','cutReady false; source SYNTHETIC_FULLY_SPECIFIED',`${man.cutReady} ${man.source}`,man.cutReady===false&&man.source==='SYNTHETIC_FULLY_SPECIFIED'&&man.pieces.length===3);}
console.log('AI_TP_W01_ENGINE_DONE');
