const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const simpleRoles=new Set(['OPERATOR','DATA_ENTRY','HELPER','STORE_CLERK','CUTTING_WORKER','CUTTING_ASSISTANT','SEWING_OPERATOR','PACKING','QC_INSPECTOR','BASIC_QC_INSPECTOR']);
const workerRoles=new Set(['OPERATOR','CUTTING_WORKER','CUTTING_ASSISTANT','SEWING_OPERATOR','PACKING']);
const assignerRoles=new Set(['FACTORY_SUPERVISOR','PRODUCTION','PLATFORM_ADMIN','PLATFORM_OWNER','WORKSPACE_OWNER']);
const expertRoles=new Set(['PLATFORM_ADMIN','PLATFORM_OWNER','WORKSPACE_OWNER','TECHNICAL_ADMIN']);
const supervisors=new Set(['FACTORY_SUPERVISOR','LINE_SUPERVISOR','CUTTING_SUPERVISOR','QC_SUPERVISOR','WAREHOUSE_SUPERVISOR']);
const professionals=new Set(['DESIGNER','DESIGN_PATTERN_MASTER','PATTERN_MASTER','TECHNICAL_OFFICE','PRODUCTION_PLANNER','COSTING','MERCHANDISER','SENIOR_QC','PRODUCTION','QC','QC_MANAGER','RELEASE_MANAGER','DESIGN','PATTERN']);
export function experienceForRole(value){const role=String(value||'').toUpperCase();return {mode:expertRoles.has(role)?'EXPERT':supervisors.has(role)?'SUPERVISOR':professionals.has(role)?'PROFESSIONAL':'SIMPLE',canWorkOperation:workerRoles.has(role),canAssignTasks:assignerRoles.has(role)};}
export const isSimpleRole=value=>experienceForRole(value).mode==='SIMPLE';

const taskSql=`SELECT t.*,s.code AS style_code,s.name AS style_name,si.customer,l.lot_code,l.status AS lot_status,l.row_version AS lot_version,p.operation_name,p.planned_qty,p.completed_qty,p.rejected_qty,p.status AS operation_status,u.display_name AS assignee_name FROM human_tasks t JOIN styles s ON s.id=t.style_id LEFT JOIN style_identity si ON si.style_id=s.id JOIN production_lots l ON l.id=t.lot_id JOIN production_operation_progress p ON p.lot_id=t.lot_id AND p.operation_seq=t.operation_seq JOIN users u ON u.id=t.assignee_user_id`;
const view=(t,userId)=>({id:t.id,styleCode:t.style_code,styleName:t.style_name,customer:t.customer,lotCode:t.lot_code,operationSeq:Number(t.operation_seq),operationName:t.operation_name,plannedQty:t.planned_qty==null?null:Number(t.planned_qty),completedQty:Number(t.completed_qty),rejectedQty:Number(t.rejected_qty),operationStatus:t.operation_status,status:t.status,lotStatus:t.lot_status,lotVersion:Number(t.lot_version),assigneeName:t.assignee_name,canSubmit:t.assignee_user_id===userId,openUrl:`/?task=${encodeURIComponent(t.id)}`});

export async function humanRoute(request,env,ctx){
  const {q1,qall,run,json,errorJson,requireAuth,requireOrg,membershipRole,requestBody,randomId,now,audit,applyOperationProgress}=ctx;
  const url=new URL(request.url),p=url.pathname;if(!p.startsWith('/api/human/'))return null;
  const sess=await requireAuth(request,env),taskById=id=>q1(env,`${taskSql} WHERE t.id=?`,id);
  if(p==='/api/human/preferences'){
    if(request.method==='GET'){const row=await q1(env,'SELECT language,density,last_workspace_id,preferred_view FROM human_preferences WHERE user_id=?',sess.userId);return json(row||{language:'ar',density:'comfortable',last_workspace_id:null,preferred_view:'auto'});}
    if(request.method==='PATCH'){
      const b=await requestBody(request),language=String(b.language||'ar'),density=String(b.density||'comfortable'),preferredView=String(b.preferredView||'auto'),workspace=b.lastWorkspaceId||null;
      if(!['ar','en'].includes(language)||!['comfortable','compact'].includes(density)||!['auto','simple','professional'].includes(preferredView))fail('Invalid user preference');
      if(preferredView==='professional'&&!workspace)fail('Workspace is required for professional view',400);
      if(workspace){await requireOrg(env,sess,workspace);if(preferredView==='professional'&&isSimpleRole(await membershipRole(env,sess,workspace)))fail('Professional view is not available for this role',403);}
      await run(env,`INSERT INTO human_preferences(user_id,language,density,last_workspace_id,preferred_view,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET language=excluded.language,density=excluded.density,last_workspace_id=excluded.last_workspace_id,preferred_view=excluded.preferred_view,updated_at=excluded.updated_at`,sess.userId,language,density,workspace,preferredView,now());
      return json({language,density,last_workspace_id:workspace,preferred_view:preferredView});
    }
  }
  if(p==='/api/human/home'&&request.method==='GET'){
    const orgId=url.searchParams.get('orgId');if(!orgId)fail('Workspace is required');const role=await membershipRole(env,sess,orgId),experience=experienceForRole(role);
    const rows=await qall(env,`${taskSql} WHERE t.org_id=? AND (t.assignee_user_id=? OR ?=1) ORDER BY CASE t.status WHEN 'OPEN' THEN 0 ELSE 1 END,t.created_at DESC LIMIT 100`,orgId,sess.userId,experience.canAssignTasks?1:0);
    let exceptions=[];
    if(['SUPERVISOR','EXPERT'].includes(experience.mode)){
      const held=await qall(env,`SELECT s.id AS style_id,s.code AS style_code,l.id AS lot_id,l.lot_code,p.operation_name FROM production_operation_progress p JOIN production_lots l ON l.id=p.lot_id JOIN styles s ON s.id=l.style_id WHERE s.org_id=? AND p.status='HOLD' AND l.status!='RELEASED' LIMIT 20`,orgId);
      const critical=await qall(env,`SELECT s.id AS style_id,s.code AS style_code,l.id AS lot_id,l.lot_code,d.title FROM production_defects d JOIN production_lots l ON l.id=d.lot_id JOIN styles s ON s.id=l.style_id WHERE s.org_id=? AND d.severity='CRITICAL' AND d.status!='RESOLVED' LIMIT 20`,orgId);
      const corrections=await qall(env,`SELECT s.id AS style_id,s.code AS style_code,l.id AS lot_id,l.lot_code,r.reason FROM human_correction_requests r JOIN human_tasks t ON t.id=r.task_id JOIN production_lots l ON l.id=t.lot_id JOIN styles s ON s.id=t.style_id WHERE t.org_id=? AND r.status='OPEN' ORDER BY r.created_at DESC LIMIT 20`,orgId);
      exceptions=[...held.map(x=>({kind:'HOLD',...x})),...critical.map(x=>({kind:'CRITICAL_DEFECT',...x})),...corrections.map(x=>({kind:'CORRECTION_REQUEST',...x}))];
    }
    return json({role,experience,tasks:rows.map(x=>view(x,sess.userId)),open:rows.filter(x=>x.status==='OPEN').length,done:rows.filter(x=>x.status==='DONE').length,exceptions});
  }
  if(p==='/api/human/assignees'&&request.method==='GET'){
    const orgId=url.searchParams.get('orgId'),role=await membershipRole(env,sess,orgId);if(!experienceForRole(role).canAssignTasks)fail('Task assignment requires a supervisor',403);
    const rows=await qall(env,`SELECT u.id,u.display_name,m.role FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.org_id=? AND u.active=1 ORDER BY u.display_name`,orgId);
    return json({items:rows.filter(x=>experienceForRole(x.role).canWorkOperation)});
  }
  if(p==='/api/human/assignable'&&request.method==='GET'){
    const orgId=url.searchParams.get('orgId'),role=await membershipRole(env,sess,orgId);if(!experienceForRole(role).canAssignTasks)fail('Task assignment requires a supervisor',403);
    const rows=await qall(env,`SELECT l.id AS lot_id,l.lot_code,s.code AS style_code,p.operation_seq,p.operation_name,p.planned_qty,p.completed_qty FROM production_operation_progress p JOIN production_lots l ON l.id=p.lot_id JOIN styles s ON s.id=l.style_id WHERE s.org_id=? AND l.status!='RELEASED' AND p.status!='DONE' ORDER BY l.created_at DESC,p.operation_seq LIMIT 100`,orgId);
    return json({items:rows});
  }
  if(p==='/api/human/tasks'&&request.method==='POST'){
    const b=await requestBody(request),orgId=String(b.orgId||''),role=await membershipRole(env,sess,orgId);if(!experienceForRole(role).canAssignTasks)fail('Task assignment requires a supervisor',403);
    const lot=await q1(env,`SELECT l.*,s.org_id FROM production_lots l JOIN styles s ON s.id=l.style_id WHERE l.id=? AND s.org_id=?`,b.lotId,orgId);if(!lot)fail('Production order not found',404);if(lot.status==='RELEASED')fail('Production order is closed',409);
    const seq=Number(b.operationSeq),op=await q1(env,'SELECT id FROM production_operation_progress WHERE lot_id=? AND operation_seq=?',lot.id,seq);if(!op)fail('Operation must be prepared before assignment',409);
    const assignee=await q1(env,`SELECT m.role,u.active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.user_id=?`,orgId,b.assigneeUserId);
    if(!assignee||!assignee.active||!experienceForRole(assignee.role).canWorkOperation)fail('Select an active production worker in this workspace',400);
    const id=randomId('htask_'),ts=now();
    await run(env,`INSERT INTO human_tasks(id,org_id,style_id,lot_id,operation_seq,assignee_user_id,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,'OPEN',?,?,?) ON CONFLICT(lot_id,operation_seq,assignee_user_id) DO UPDATE SET status='OPEN',updated_at=excluded.updated_at`,id,orgId,lot.style_id,lot.id,seq,b.assigneeUserId,sess.userId,ts,ts);
    const task=await q1(env,'SELECT id FROM human_tasks WHERE lot_id=? AND operation_seq=? AND assignee_user_id=?',lot.id,seq,b.assigneeUserId);
    await audit(env,orgId,sess.userId,'HUMAN_TASK',task.id,'ASSIGN',{lotId:lot.id,operationSeq:seq,assigneeUserId:b.assigneeUserId});
    return json({task:view(await taskById(task.id),sess.userId)},201);
  }
  const tm=p.match(/^\/api\/human\/tasks\/([^/]+)$/);
  if(tm&&request.method==='GET'){const task=await taskById(tm[1]);if(!task)return errorJson('Task not found',404);const role=await membershipRole(env,sess,task.org_id);if(task.assignee_user_id!==sess.userId&&!experienceForRole(role).canAssignTasks)fail('هذه المهمة غير مسندة إليك.',403);return json({task:view(task,sess.userId)});}
  const sm=p.match(/^\/api\/human\/tasks\/([^/]+)\/submissions$/);
  if(sm&&request.method==='POST'){
    const b=await requestBody(request),task=await taskById(sm[1]);if(!task)return errorJson('Task not found',404);
    const role=await membershipRole(env,sess,task.org_id);if(task.assignee_user_id!==sess.userId||!experienceForRole(role).canWorkOperation)fail('هذه المهمة غير مسندة إليك. اطلب من المشرف إسنادها لك.',403);
    const key=String(b.requestKey||'');if(!/^[a-zA-Z0-9_-]{8,100}$/.test(key))fail('Request key is required');
    const good=Number(b.completedDelta),bad=Number(b.rejectedDelta||0);if(!Number.isInteger(good)||good<0||!Number.isInteger(bad)||bad<0||good+bad===0)fail('أدخل كمية صحيحة أكبر من صفر.');
    const previous=await q1(env,'SELECT completed_delta,rejected_delta FROM human_task_submissions WHERE task_id=? AND request_key=?',task.id,key);
    if(previous){if(Number(previous.completed_delta)!==good||Number(previous.rejected_delta)!==bad)fail('تم استخدام مفتاح الطلب لبيانات مختلفة. حدّث المهمة وأعد المحاولة.',409);return json({saved:true,duplicate:true,task:view(await taskById(task.id),sess.userId)});}
    if(task.status!=='OPEN'||task.lot_status==='RELEASED')fail('هذه المهمة مقفولة. اطلب مساعدة المشرف.',409);
    if(!Number.isInteger(Number(b.expectedVersion)))fail('حدّث المهمة قبل الحفظ.',409);
    const lot=await q1(env,'SELECT * FROM production_lots WHERE id=?',task.lot_id);
    const result=await applyOperationProgress(env,sess,lot,Number(task.operation_seq),{completedQty:Number(task.completed_qty)+good,rejectedQty:Number(task.rejected_qty)+bad,expectedVersion:Number(b.expectedVersion)},task.org_id);
    const ts=now();await run(env,`INSERT INTO human_task_submissions(id,task_id,user_id,request_key,completed_delta,rejected_delta,before_completed,after_completed,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,randomId('hsub_'),task.id,sess.userId,key,good,bad,Number(task.completed_qty),result.completed,ts);
    if(result.status==='DONE')await run(env,`UPDATE human_tasks SET status='DONE',updated_at=? WHERE id=?`,ts,task.id);
    return json({saved:true,duplicate:false,task:view(await taskById(task.id),sess.userId)});
  }
  const cm=p.match(/^\/api\/human\/tasks\/([^/]+)\/corrections$/);
  if(cm&&request.method==='POST'){const task=await taskById(cm[1]);if(!task)return errorJson('Task not found',404);await membershipRole(env,sess,task.org_id);if(task.assignee_user_id!==sess.userId)fail('هذه المهمة غير مسندة إليك.',403);const b=await requestBody(request),reason=String(b.reason||'').trim();if(reason.length<5||reason.length>500)fail('اكتب سبب التصحيح في 5 إلى 500 حرف.');const id=randomId('hcor_'),ts=now();await run(env,`INSERT INTO human_correction_requests(id,task_id,user_id,reason,status,created_at) VALUES(?,?,?,?,'OPEN',?)`,id,task.id,sess.userId,reason,ts);await audit(env,task.org_id,sess.userId,'HUMAN_CORRECTION',id,'REQUEST',{taskId:task.id});return json({requested:true},201);}
  return errorJson('Human action not found',404);
}
