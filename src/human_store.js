const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const clerkRoles=new Set(['STORE_CLERK']);
const assignerRoles=new Set(['FACTORY_SUPERVISOR','WAREHOUSE_SUPERVISOR','PLATFORM_ADMIN','PLATFORM_OWNER','WORKSPACE_OWNER']);
const movements={RECEIVE:'استلام خامة',ISSUE:'صرف خامة',RETURN:'إرجاع خامة'};
const taskSql=`SELECT t.*,s.code AS style_code,s.name AS style_name,si.customer,l.lot_code,l.status AS lot_status,u.display_name AS assignee_name,b.on_hand_milli,b.issued_net_milli,b.version AS balance_version,(SELECT COUNT(*) FROM human_store_events e WHERE e.task_id=t.id) AS event_count FROM human_store_tasks t JOIN styles s ON s.id=t.style_id LEFT JOIN style_identity si ON si.style_id=s.id JOIN production_lots l ON l.id=t.lot_id JOIN users u ON u.id=t.assignee_user_id JOIN human_store_balances b ON b.lot_id=t.lot_id AND b.material_key=t.material_key`;
const view=(t,userId)=>({id:t.id,styleCode:t.style_code,styleName:t.style_name,customer:t.customer,lotCode:t.lot_code,lotStatus:t.lot_status,materialKey:t.material_key,materialName:t.description,sourceRef:t.source_ref,unit:t.unit,movement:t.movement,movementAr:movements[t.movement],status:t.status,assigneeName:t.assignee_name,onHand:Number(t.on_hand_milli)/1000,issuedNet:Number(t.issued_net_milli)/1000,balanceVersion:Number(t.balance_version),eventCount:Number(t.event_count),canRecord:t.assignee_user_id===userId,openUrl:`/?storeTask=${encodeURIComponent(t.id)}`});
const milli=value=>{const raw=String(value??'').trim();if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(raw))fail('اكتب كمية موجبة حتى 3 أرقام عشرية.');const result=Math.round(Number(raw)*1000);if(!Number.isSafeInteger(result)||result<1)fail('الكمية لازم تكون أكبر من صفر.');return result};

export async function humanStoreRoute(request,env,ctx){
  const {q1,qall,run,json,errorJson,requireAuth,membershipRole,requestBody,randomId,now,audit,lotPlanning,lotMaterialKey}=ctx;
  const url=new URL(request.url),p=url.pathname;if(!p.startsWith('/api/human/store/'))return null;
  const sess=await requireAuth(request,env),taskById=id=>q1(env,`${taskSql} WHERE t.id=?`,id),roleFor=orgId=>membershipRole(env,sess,orgId);
  if(p==='/api/human/store/queue'&&request.method==='GET'){
    const orgId=url.searchParams.get('orgId'),role=await roleFor(orgId),all=assignerRoles.has(role);if(!all&&!clerkRoles.has(role))fail('مهام المخزن غير متاحة لدورك.',403);
    const rows=await qall(env,`${taskSql} WHERE t.org_id=? AND (t.assignee_user_id=? OR ?=1) ORDER BY CASE t.status WHEN 'OPEN' THEN 0 ELSE 1 END,CASE t.movement WHEN 'RECEIVE' THEN 0 WHEN 'ISSUE' THEN 1 ELSE 2 END,t.created_at DESC LIMIT 100`,orgId,sess.userId,all?1:0);
    return json({items:rows.map(x=>view(x,sess.userId)),open:rows.filter(x=>x.status==='OPEN').length});
  }
  if(p==='/api/human/store/assignable'&&request.method==='GET'){
    const orgId=url.searchParams.get('orgId'),role=await roleFor(orgId);if(!assignerRoles.has(role))fail('إسناد المخزن يحتاج مشرفًا.',403);
    const lots=await qall(env,`SELECT l.*,s.code AS style_code FROM production_lots l JOIN styles s ON s.id=l.style_id WHERE s.org_id=? AND l.status!='RELEASED' ORDER BY l.created_at DESC LIMIT 60`,orgId),items=[];
    for(const lot of lots){const plan=await lotPlanning(env,lot);for(const material of plan.materialRequirements||[])items.push({lotId:lot.id,lotCode:lot.lot_code,styleCode:lot.style_code,materialKey:lotMaterialKey(material),sourceRef:material.sourceRef,description:material.description,unit:material.unit,plannedGross:material.grossRequired});}
    const people=await qall(env,`SELECT u.id,u.display_name,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.org_id=? AND u.active=1 ORDER BY u.display_name`,orgId);
    return json({items,clerks:people.filter(x=>clerkRoles.has(String(x.role).toUpperCase()))});
  }
  if(p==='/api/human/store/tasks'&&request.method==='POST'){
    const b=await requestBody(request),orgId=String(b.orgId||''),role=await roleFor(orgId);if(!assignerRoles.has(role))fail('إسناد المخزن يحتاج مشرفًا.',403);
    const movement=String(b.movement||'').toUpperCase();if(!movements[movement])fail('اختر استلام أو صرف أو إرجاع.');
    const lot=await q1(env,`SELECT l.*,s.org_id FROM production_lots l JOIN styles s ON s.id=l.style_id WHERE l.id=? AND s.org_id=?`,b.lotId,orgId);if(!lot)fail('أمر الإنتاج غير موجود.',404);if(lot.status==='RELEASED')fail('أمر الإنتاج مقفول.',409);
    const plan=await lotPlanning(env,lot),material=(plan.materialRequirements||[]).find(x=>lotMaterialKey(x)===b.materialKey);if(!material)fail('الخامة غير موجودة في الخطة المعتمدة لهذا الأمر. راجع المكتب الفني.',409);
    const person=await q1(env,`SELECT m.role,u.active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.user_id=?`,orgId,b.assigneeUserId);if(!person?.active||!clerkRoles.has(String(person.role).toUpperCase()))fail('اختر مسؤول مخزن نشط في مساحة العمل.',400);
    const key=lotMaterialKey(material),ts=now(),id=randomId('hstore_');
    await run(env,`INSERT OR IGNORE INTO human_store_balances(lot_id,org_id,style_id,material_key,unit) VALUES(?,?,?,?,?)`,lot.id,orgId,lot.style_id,key,material.unit);
    await run(env,`INSERT INTO human_store_tasks(id,org_id,style_id,lot_id,material_key,source_ref,description,unit,movement,assignee_user_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'OPEN',?,?,?) ON CONFLICT(lot_id,material_key,movement,assignee_user_id) DO UPDATE SET status='OPEN',updated_at=excluded.updated_at`,id,orgId,lot.style_id,lot.id,key,material.sourceRef||null,material.description,material.unit,movement,b.assigneeUserId,sess.userId,ts,ts);
    const row=await q1(env,'SELECT id FROM human_store_tasks WHERE lot_id=? AND material_key=? AND movement=? AND assignee_user_id=?',lot.id,key,movement,b.assigneeUserId);
    await audit(env,orgId,sess.userId,'HUMAN_STORE_TASK',row.id,'ASSIGN',{lotId:lot.id,materialKey:key,movement,assigneeUserId:b.assigneeUserId});return json({task:view(await taskById(row.id),sess.userId)},201);
  }
  const tm=p.match(/^\/api\/human\/store\/tasks\/([^/]+)$/);
  if(tm&&request.method==='GET'){const task=await taskById(tm[1]);if(!task)return errorJson('Store task not found',404);const role=await roleFor(task.org_id);if(task.assignee_user_id!==sess.userId&&!assignerRoles.has(role))fail('هذه مهمة مخزن غير مسندة إليك.',403);return json({task:view(task,sess.userId)});}
  const rm=p.match(/^\/api\/human\/store\/tasks\/([^/]+)\/record$/);
  if(rm&&request.method==='POST'){
    const task=await taskById(rm[1]);if(!task)return errorJson('Store task not found',404);const role=await roleFor(task.org_id);if(task.assignee_user_id!==sess.userId||!clerkRoles.has(role))fail('هذه مهمة مخزن غير مسندة إليك.',403);
    const b=await requestBody(request),key=String(b.requestKey||'');if(!/^[a-zA-Z0-9_-]{8,100}$/.test(key))fail('مفتاح الحفظ غير صالح.');const quantity=milli(b.quantity);
    const previous=await q1(env,'SELECT quantity_milli FROM human_store_events WHERE task_id=? AND request_key=?',task.id,key);
    if(previous){if(Number(previous.quantity_milli)!==quantity)fail('تم استخدام مفتاح الحفظ لكمية مختلفة. حدّث المهمة.',409);return json({saved:true,duplicate:true,task:view(await taskById(task.id),sess.userId)});}
    if(task.status!=='OPEN'||task.lot_status==='RELEASED')fail('هذه المهمة مقفولة. اطلب مساعدة المشرف.',409);
    const version=Number(b.expectedVersion);if(!Number.isInteger(version)||version!==task.balance_version)fail('رصيد الخامة اتغير. حدّث المهمة ثم راجع الكمية.',409);
    if(task.movement==='ISSUE'&&quantity>Number(task.on_hand_milli))fail('الكمية المطلوبة للصرف أكبر من الرصيد المتاح.',409);
    if(task.movement==='RETURN'&&quantity>Number(task.issued_net_milli))fail('الكمية المرتجعة أكبر من المصروف لهذا الأمر.',409);
    const ts=now(),eventId=randomId('hse_'),delta=task.movement==='ISSUE'?-quantity:quantity,issuedDelta=task.movement==='RECEIVE'?0:task.movement==='ISSUE'?quantity:-quantity;
    const result=await q1(env,`UPDATE human_store_balances SET on_hand_milli=on_hand_milli+?,issued_net_milli=issued_net_milli+?,version=version+1,last_event_id=?,last_task_id=?,last_request_key=?,last_actor_id=?,last_movement=?,last_delta_milli=?,last_at=? WHERE lot_id=? AND material_key=? AND version=? AND on_hand_milli+?>=0 AND issued_net_milli+?>=0 RETURNING version`,delta,issuedDelta,eventId,task.id,key,sess.userId,task.movement,quantity,ts,task.lot_id,task.material_key,version,delta,issuedDelta);
    if(!result)fail('رصيد الخامة اتغير. حدّث المهمة ثم راجع الكمية.',409);
    await audit(env,task.org_id,sess.userId,'HUMAN_STORE_EVENT',eventId,task.movement,{lotId:task.lot_id,materialKey:task.material_key,quantityMilli:quantity,unit:task.unit});
    return json({saved:true,duplicate:false,task:view(await taskById(task.id),sess.userId)});
  }
  const complete=p.match(/^\/api\/human\/store\/tasks\/([^/]+)\/complete$/);
  if(complete&&request.method==='POST'){const task=await taskById(complete[1]);if(!task)return errorJson('Store task not found',404);await roleFor(task.org_id);if(task.assignee_user_id!==sess.userId)fail('هذه مهمة مخزن غير مسندة إليك.',403);if(task.status==='DONE')return json({task:view(task,sess.userId)});const count=await q1(env,'SELECT COUNT(*) AS n FROM human_store_events WHERE task_id=?',task.id);if(!Number(count?.n))fail('سجّل حركة واحدة على الأقل قبل إنهاء المهمة.');await run(env,"UPDATE human_store_tasks SET status='DONE',updated_at=? WHERE id=?",now(),task.id);await audit(env,task.org_id,sess.userId,'HUMAN_STORE_TASK',task.id,'COMPLETE',{events:Number(count.n)});return json({task:view(await taskById(task.id),sess.userId)});}
  return errorJson('Store action not found',404);
}
