const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const inspectorRoles=new Set(['QC_INSPECTOR','BASIC_QC_INSPECTOR','QC','SENIOR_QC']);
const assignerRoles=new Set(['QC_MANAGER','QC_SUPERVISOR','FACTORY_SUPERVISOR','PLATFORM_ADMIN','PLATFORM_OWNER','WORKSPACE_OWNER']);
const defectTypes={CUT:'قطع',SEWING:'خياطة',STAIN:'بقعة',SIZE:'مقاس',TRIM:'إكسسوار',OTHER:'عيب آخر'};
const taskSql=`SELECT t.*,s.code AS style_code,s.name AS style_name,si.customer,l.lot_code,l.status AS lot_status,l.row_version AS lot_version,u.display_name AS assignee_name FROM human_qc_tasks t JOIN styles s ON s.id=t.style_id LEFT JOIN style_identity si ON si.style_id=s.id JOIN production_lots l ON l.id=t.lot_id JOIN users u ON u.id=t.assignee_user_id`;
const view=(t,userId)=>({id:t.id,styleCode:t.style_code,styleName:t.style_name,customer:t.customer,lotCode:t.lot_code,lotVersion:Number(t.lot_version),lotStatus:t.lot_status,status:t.status,assigneeName:t.assignee_name,canInspect:t.assignee_user_id===userId,openUrl:`/?qcTask=${encodeURIComponent(t.id)}`});

export async function humanQcRoute(request,env,ctx){
  const {q1,qall,run,json,errorJson,requireAuth,membershipRole,requestBody,randomId,now,audit,decodeDataUrl,validateImageUpload,extForMime,createQualityCheck,createProductionDefect}=ctx;
  const url=new URL(request.url),p=url.pathname;if(!p.startsWith('/api/human/qc/'))return null;
  const sess=await requireAuth(request,env),taskById=id=>q1(env,`${taskSql} WHERE t.id=?`,id);
  const roleFor=orgId=>membershipRole(env,sess,orgId);
  if(p==='/api/human/qc/queue'&&request.method==='GET'){
    const orgId=url.searchParams.get('orgId'),role=await roleFor(orgId),all=assignerRoles.has(role);if(!all&&!inspectorRoles.has(role))fail('فحص الجودة غير متاح لدورك.',403);
    const rows=await qall(env,`${taskSql} WHERE t.org_id=? AND (t.assignee_user_id=? OR ?=1) ORDER BY CASE t.status WHEN 'OPEN' THEN 0 ELSE 1 END,t.created_at DESC LIMIT 100`,orgId,sess.userId,all?1:0);
    return json({items:rows.map(x=>view(x,sess.userId)),open:rows.filter(x=>x.status==='OPEN').length});
  }
  if(p==='/api/human/qc/assignable'&&request.method==='GET'){
    const orgId=url.searchParams.get('orgId'),role=await roleFor(orgId);if(!assignerRoles.has(role))fail('إسناد فحص الجودة يحتاج مشرف جودة.',403);
    const [lots,people]=await Promise.all([
      qall(env,`SELECT l.id AS lot_id,l.lot_code,s.code AS style_code FROM production_lots l JOIN styles s ON s.id=l.style_id WHERE s.org_id=? AND l.status!='RELEASED' ORDER BY l.created_at DESC LIMIT 100`,orgId),
      qall(env,`SELECT u.id,u.display_name,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.org_id=? AND u.active=1 ORDER BY u.display_name`,orgId)
    ]);
    return json({lots,inspectors:people.filter(x=>inspectorRoles.has(String(x.role).toUpperCase()))});
  }
  if(p==='/api/human/qc/tasks'&&request.method==='POST'){
    const b=await requestBody(request),orgId=String(b.orgId||''),role=await roleFor(orgId);if(!assignerRoles.has(role))fail('إسناد فحص الجودة يحتاج مشرف جودة.',403);
    const lot=await q1(env,`SELECT l.*,s.org_id FROM production_lots l JOIN styles s ON s.id=l.style_id WHERE l.id=? AND s.org_id=?`,b.lotId,orgId);if(!lot)fail('أمر الإنتاج غير موجود.',404);if(lot.status==='RELEASED')fail('أمر الإنتاج مقفول.',409);
    const person=await q1(env,`SELECT m.role,u.active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.user_id=?`,orgId,b.assigneeUserId);if(!person?.active||!inspectorRoles.has(String(person.role).toUpperCase()))fail('اختر فاحص جودة نشط في مساحة العمل.',400);
    const id=randomId('hqc_'),ts=now();await run(env,`INSERT INTO human_qc_tasks(id,org_id,style_id,lot_id,assignee_user_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,'OPEN',?,?,?) ON CONFLICT(lot_id,assignee_user_id) DO UPDATE SET status='OPEN',updated_at=excluded.updated_at`,id,orgId,lot.style_id,lot.id,b.assigneeUserId,sess.userId,ts,ts);
    const row=await q1(env,'SELECT id FROM human_qc_tasks WHERE lot_id=? AND assignee_user_id=?',lot.id,b.assigneeUserId);
    await audit(env,orgId,sess.userId,'HUMAN_QC_TASK',row.id,'ASSIGN',{lotId:lot.id,assigneeUserId:b.assigneeUserId});return json({task:view(await taskById(row.id),sess.userId)},201);
  }
  const tm=p.match(/^\/api\/human\/qc\/tasks\/([^/]+)$/);
  if(tm&&request.method==='GET'){const task=await taskById(tm[1]);if(!task)return errorJson('QC task not found',404);const role=await roleFor(task.org_id);if(task.assignee_user_id!==sess.userId&&!assignerRoles.has(role))fail('هذه مهمة جودة غير مسندة إليك.',403);const count=await q1(env,'SELECT COUNT(*) AS n FROM human_qc_submissions WHERE task_id=?',task.id);return json({task:view(task,sess.userId),inspected:Number(count?.n||0)});}
  const photo=p.match(/^\/api\/human\/qc\/tasks\/([^/]+)\/photo$/);
  if(photo&&request.method==='POST'){
    const task=await taskById(photo[1]);if(!task)return errorJson('QC task not found',404);await roleFor(task.org_id);if(task.assignee_user_id!==sess.userId||task.status!=='OPEN'||task.lot_status==='RELEASED')fail('هذه مهمة جودة غير متاحة لك الآن.',403);
    const b=await requestBody(request),image=decodeDataUrl(b.dataUrl);validateImageUpload(image);
    const id=randomId('ast_'),stored=id+extForMime(image.mime),filename=String(b.filename||'qc-photo').split(/[\\/]/).pop().slice(0,120),ts=now();
    await env.UPLOADS.put(stored,image.bytes,{httpMetadata:{contentType:image.mime},customMetadata:{styleId:task.style_id,role:'QC_EVIDENCE'}});
    await run(env,`INSERT INTO assets(id,style_id,role,filename,stored_name,mime_type,source_kind,rights_status,created_at) VALUES(?,?,?,?,?,?,?,'USER_ASSERTED',?)`,id,task.style_id,'QC_EVIDENCE',filename,stored,image.mime,'USER_UPLOAD',ts);
    await run(env,'INSERT INTO human_qc_photos(asset_id,task_id,user_id,created_at) VALUES(?,?,?,?)',id,task.id,sess.userId,ts);
    await audit(env,task.org_id,sess.userId,'ASSET',id,'QC_EVIDENCE_UPLOAD',{taskId:task.id});return json({assetId:id,url:`/uploads/${stored}`},201);
  }
  const inspect=p.match(/^\/api\/human\/qc\/tasks\/([^/]+)\/inspections$/);
  if(inspect&&request.method==='POST'){
    const task=await taskById(inspect[1]);if(!task)return errorJson('QC task not found',404);const role=await roleFor(task.org_id);if(task.assignee_user_id!==sess.userId||!inspectorRoles.has(role))fail('هذه مهمة جودة غير مسندة إليك.',403);
    const b=await requestBody(request),key=String(b.requestKey||'');if(!/^[a-zA-Z0-9_-]{8,100}$/.test(key))fail('مفتاح الحفظ غير صالح.');
    const answers={measurementOk:b.measurementOk,sewingOk:b.sewingOk,visibleDefect:b.visibleDefect};
    if(Object.values(answers).some(x=>typeof x!=='boolean'))fail('أجب عن أسئلة الفحص الثلاثة.');
    const bad=!answers.measurementOk||!answers.sewingOk||answers.visibleDefect,type=String(b.defectType||'').toUpperCase(),severity=String(b.severity||'').toUpperCase(),evidence=b.photoAssetId||null;
    if(bad&&(!defectTypes[type]||!['MINOR','MAJOR','CRITICAL'].includes(severity)))fail('حدد نوع العيب ودرجته قبل الحفظ.');
    if(!bad&&(type||severity||evidence))fail('نتيجة سليمة لا تحتاج نوع عيب أو صورة.');
    if(bad&&severity==='CRITICAL'&&!evidence)fail('صوّر العيب الحرج قبل حفظ الفحص.');
    const normalized=JSON.stringify({answers,type:bad?type:null,severity:bad?severity:null,evidence});
    const previous=await q1(env,'SELECT answers_json FROM human_qc_submissions WHERE task_id=? AND request_key=?',task.id,key);
    if(previous){if(previous.answers_json!==normalized)fail('تم استخدام مفتاح الحفظ لنتيجة مختلفة. حدّث المهمة.',409);return json({saved:true,duplicate:true,task:view(await taskById(task.id),sess.userId)});}
    if(task.status!=='OPEN'||task.lot_status==='RELEASED')fail('مهمة الجودة مقفولة. اطلب مساعدة المشرف.',409);
    if(!Number.isInteger(Number(b.expectedVersion))||Number(b.expectedVersion)!==task.lot_version)fail('أمر الإنتاج اتغير. حدّث المهمة ثم راجع البيانات.',409);
    if(evidence){const photoRow=await q1(env,'SELECT asset_id FROM human_qc_photos WHERE asset_id=? AND task_id=? AND user_id=?',evidence,task.id,sess.userId);if(!photoRow)fail('الصورة ليست مرتبطة بهذه المهمة.',403);}
    const claim=await run(env,'UPDATE production_lots SET row_version=row_version+1,updated_at=? WHERE id=? AND row_version=?',now(),task.lot_id,Number(b.expectedVersion));
    if(Number(claim?.meta?.changes||0)!==1)fail('أمر الإنتاج اتغير. حدّث المهمة ثم راجع البيانات.',409);
    const lot=await q1(env,'SELECT * FROM production_lots WHERE id=?',task.lot_id),ts=now();
    const checkId=await createQualityCheck(env,sess,lot,{checkType:'GUIDED_PIECE',status:bad?'FAIL':'PASS',sampleSize:1,defectCount:bad?1:0,note:JSON.stringify(answers)},task.org_id,{bump:false});
    const defectId=bad?await createProductionDefect(env,sess,lot,{code:type,title:defectTypes[type],severity,qty:1,note:'Guided QC inspection'},task.org_id,{bump:false}):null;
    if(defectId&&evidence)await run(env,'INSERT INTO human_defect_evidence(defect_id,asset_id,created_at) VALUES(?,?,?)',defectId,evidence,ts);
    await run(env,'INSERT INTO human_qc_submissions(id,task_id,user_id,request_key,check_id,defect_id,evidence_asset_id,answers_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)',randomId('hqcs_'),task.id,sess.userId,key,checkId,defectId,evidence,normalized,ts);
    return json({saved:true,duplicate:false,checkId,defectId,task:view(await taskById(task.id),sess.userId)},201);
  }
  const complete=p.match(/^\/api\/human\/qc\/tasks\/([^/]+)\/complete$/);
  if(complete&&request.method==='POST'){const task=await taskById(complete[1]);if(!task)return errorJson('QC task not found',404);await roleFor(task.org_id);if(task.assignee_user_id!==sess.userId)fail('هذه مهمة جودة غير مسندة إليك.',403);if(task.status==='DONE')return json({task:view(task,sess.userId)});const count=await q1(env,'SELECT COUNT(*) AS n FROM human_qc_submissions WHERE task_id=?',task.id);if(!Number(count?.n))fail('افحص قطعة واحدة على الأقل قبل إنهاء المهمة.');await run(env,"UPDATE human_qc_tasks SET status='DONE',updated_at=? WHERE id=?",now(),task.id);await audit(env,task.org_id,sess.userId,'HUMAN_QC_TASK',task.id,'COMPLETE',{inspected:Number(count.n)});return json({task:view(await taskById(task.id),sess.userId)});}
  return errorJson('QC action not found',404);
}
