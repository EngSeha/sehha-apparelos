// ROUND30 — persisted, frozen Factory Handoff on top of the existing computed handoff summary (releaseHandoff).
// Lifecycle: PREPARED -> HANDED_OFF -> ACKNOWLEDGED, or PREPARED -> WITHDRAWN (reason required). No hard delete.
// Every command commits business state + event + receipt + audit in one D1 batch (a transaction). Guards that can drift
// are re-asserted by the database; a guarded write that matches no row is turned into an abort through NOT NULL
// references to the row written by THIS command (last_command_id), never by a sibling request.
import {actorCapability,actorSql} from './authority.js';
import {RELEASE_EVIDENCE_CONTRACT,releaseEvidenceStatus} from './production_release.js';

export const HANDOFF_CONTRACT='FACTORY_HANDOFF/R30';
const KEY_PATTERN=/^[A-Za-z0-9._:-]{8,128}$/;
const SIGNOFF_STAMP="(SELECT COUNT(*)||'|'||COALESCE(MAX(created_at),'')||'|'||COALESCE(SUM(CASE WHEN decision='APPROVED' THEN 1 ELSE 0 END),0) FROM release_signoffs WHERE style_id=?S AND release_no=?N)";
const MESSAGES={
  ROLE_NOT_PERMITTED:'دورك لا يسمح بهذا الإجراء على حزمة التسليم / Your role may not perform this handoff action',
  FORBIDDEN_ACTOR:'لا تملك صلاحية في هذه المساحة / Actor is not authorized for this workspace',
  NOT_PRODUCTION_RELEASE:'التسليم للمصنع يتم من إصدار إنتاج فقط / Factory handoff requires a PRODUCTION release',
  LEGACY_RELEASE_NOT_ELIGIBLE:'هذا إصدار قديم بلا أدلة جاهزية مجمّدة؛ أنشئ نسخة وإصدار إنتاج جديدين / Legacy release without frozen readiness evidence cannot be handed off',
  RELEASE_EVIDENCE_TAMPERED:'بيانات الإصدار المجمّدة لا تطابق بصمتها؛ تم الإيقاف / Frozen release evidence does not match its hashes',
  RELEASE_SUPERSEDED:'يوجد إصدار إنتاج أحدث؛ لا يمكن تجهيز أو إرسال حزمة لإصدار قديم / A newer production release exists',
  HANDOFF_ALREADY_EXISTS:'توجد حزمة تسليم قائمة لهذا الإصدار / A live handoff already exists for this release',
  HANDOFF_NOT_READY:'الحزمة غير جاهزة: توقيعات ناقصة أو ملاحظات حرجة مفتوحة أو قالب ناقص / Handoff prerequisites are not met',
  SIGNOFF_INDEPENDENCE_REQUIRED:'التوقيعات يجب أن تكون من أشخاص مستقلين وليست من طالب الإصدار / Signoffs must be independent and not by the release requester',
  SIGNOFF_SIGNER_INVALID:'أحد الموقّعين لم يعد عضوًا نشطًا بدور يسمح بالتوقيع / A signer is no longer an active member allowed to sign',
  INVALID_STATE:'حالة الحزمة لا تسمح بهذا الإجراء / Handoff state does not allow this action',
  STALE_VERSION:'تم تعديل الحزمة من شخص آخر؛ حدّث الصفحة / The handoff changed; refresh',
  REASON_REQUIRED:'سبب السحب مطلوب (٥ أحرف على الأقل) / A withdrawal reason of at least 5 characters is required',
  SELF_ACKNOWLEDGE_FORBIDDEN:'لا يمكن لمن أرسل الحزمة أن يؤكد استلامها / The dispatcher cannot acknowledge their own dispatch',
  HANDOFF_PACKAGE_DRIFT:'حزمة التسليم لا تطابق بصمتها المجمّدة؛ تم الإيقاف / Frozen handoff package failed integrity check',
  HANDOFF_CONFLICT:'تم تنفيذ إجراء آخر على الحزمة؛ حدّث الصفحة / Another handoff action was committed first',
  IDEMPOTENCY_KEY_REUSED:'مفتاح العملية مستخدم لطلب مختلف / Idempotency-Key was already used for a different request',
  IDEMPOTENCY_KEY_INVALID:'مفتاح العملية غير صالح / Idempotency-Key must be 8–128 characters [A-Za-z0-9._:-]',
  HANDOFF_COMMIT_FAILED:'تعذّر حفظ العملية؛ لم يتم حفظ أي تغيير / Handoff action could not be committed; nothing was saved'
};
const send=(status,body,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const fail=(status,code,extra={})=>send(status,{error:MESSAGES[code]||code,code,...extra});
const ACTIONS={
  dispatch:{op:'HANDOFF_DISPATCH',capability:'HANDOFF_DISPATCH',from:'PREPARED',to:'HANDED_OFF',event:'DISPATCH'},
  acknowledge:{op:'HANDOFF_ACKNOWLEDGE',capability:'HANDOFF_ACKNOWLEDGE',from:'HANDED_OFF',to:'ACKNOWLEDGED',event:'ACKNOWLEDGE'},
  withdraw:{op:'HANDOFF_WITHDRAW',capability:'HANDOFF_WITHDRAW',from:'PREPARED',to:'WITHDRAWN',event:'WITHDRAW'}
};

async function receiptFor(env,orgId,userId,op,key){return key?env.DB.prepare('SELECT * FROM handoff_receipts WHERE org_id=? AND actor_user_id=? AND operation=? AND idempotency_key=?').bind(orgId,userId,op,key).first():null;}
function replay(row,requestSha){if(row.request_sha256!==requestSha)return fail(409,'IDEMPOTENCY_KEY_REUSED',{receiptId:row.id});return new Response(row.response_json,{status:Number(row.response_status),headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','idempotency-replayed':'true'}});}
const bind=(sql,map)=>{const names=[...new Set(sql.match(/\?[A-Z]\b/g)||[])];let out=sql;const vals=[];names.forEach((n,i)=>{out=out.split(n).join(`?${i+1}`);vals.push(map[n.slice(1)]);});return {sql:out,vals};};
const stmt=(db,sql,map)=>{const b=bind(sql,map);return db.prepare(b.sql).bind(...b.vals);};

// Integrity of the frozen release a package refers to: stored snapshot re-hashes to the manifest; candidate hash agrees.
async function releaseIntegrity(rel,ctx){const snap=JSON.parse(rel.snapshot_json||'null'),manifest=JSON.parse(rel.manifest_json||'{}'),gate=JSON.parse(rel.gate_json||'{}');
  const snapshotSha=await ctx.sha256Text(JSON.stringify(ctx.stableComparable(snap)));
  const ok=!!snap&&snapshotSha===manifest.snapshotSha256&&!!rel.candidate_sha256&&gate?.engineering?.candidateSha256===rel.candidate_sha256;
  return {ok,snapshotSha,manifestSha:manifest.manifestSha256||null,decisionSha:gate?.engineering?.decisionSha256||null};}
async function packageIntegrity(env,h,ctx){if(await ctx.sha256Text(h.package_json)!==h.package_sha256)return {ok:false};
  const rel=await env.DB.prepare('SELECT * FROM style_releases WHERE id=?').bind(h.release_id).first();if(!rel)return {ok:false};
  const r=await releaseIntegrity(rel,ctx);return {ok:r.ok&&r.snapshotSha===h.release_snapshot_sha256,rel};}

async function commit(env,ctx,{orgId,userId,op,key,requestSha,statements,diagnose}){
  try{await env.DB.batch(statements);return null;}
  catch(e){const msg=String(e?.message||e);
    const won=await receiptFor(env,orgId,userId,op,key);if(won)return replay(won,requestSha);
    if(/NOT NULL constraint failed/.test(msg))return (await diagnose())||fail(409,'HANDOFF_CONFLICT');
    if(/UNIQUE constraint failed: factory_handoffs|uq_factory_handoffs_live_release/.test(msg))return fail(409,'HANDOFF_ALREADY_EXISTS');
    if(/HANDOFF_TRANSITION_INVALID|UNIQUE constraint failed/.test(msg))return fail(409,'HANDOFF_CONFLICT');
    const correlationId=ctx.randomId('err_');console.error('HANDOFF_COMMIT_FAILED',correlationId,msg);return fail(500,'HANDOFF_COMMIT_FAILED',{correlationId});}
}

async function prepare(request,env,ctx,style,releaseNo,sess){
  const orgId=style.org_id,access=await actorCapability(env,sess.userId,orgId,'HANDOFF_PREPARE');if(!access.ok)return fail(403,access.code);
  const key=request.headers.get('idempotency-key');if(key!=null&&!KEY_PATTERN.test(key))return fail(400,'IDEMPOTENCY_KEY_INVALID');
  const op='HANDOFF_PREPARE',requestSha=await ctx.sha256Text(JSON.stringify({op,styleId:style.id,releaseNo}));
  const prior=await receiptFor(env,orgId,sess.userId,op,key);if(prior)return replay(prior,requestSha);
  const settle=async r=>{const won=await receiptFor(env,orgId,sess.userId,op,key);return won?replay(won,requestSha):r;};
  const sStamp=await stmt(env.DB,`SELECT ${SIGNOFF_STAMP} st`,{S:style.id,N:releaseNo}).first();
  const rel=await env.DB.prepare('SELECT * FROM style_releases WHERE style_id=? AND release_no=?').bind(style.id,releaseNo).first();
  if(!rel)return settle(send(404,{error:'Release not found'}));
  if(rel.release_type!=='PRODUCTION')return settle(fail(409,'NOT_PRODUCTION_RELEASE'));
  if(releaseEvidenceStatus(rel)!=='FROZEN_VERIFIED')return settle(fail(409,'LEGACY_RELEASE_NOT_ELIGIBLE',{evidenceStatus:releaseEvidenceStatus(rel)}));
  const integ=await releaseIntegrity(rel,ctx);if(!integ.ok)return settle(fail(409,'RELEASE_EVIDENCE_TAMPERED'));
  const latest=await env.DB.prepare("SELECT MAX(release_no) n FROM style_releases WHERE style_id=? AND release_type='PRODUCTION'").bind(style.id).first();
  if(Number(latest.n)!==Number(releaseNo))return settle(fail(409,'RELEASE_SUPERSEDED',{latestReleaseNo:Number(latest.n)}));
  if(await env.DB.prepare("SELECT 1 x FROM factory_handoffs WHERE release_id=? AND status<>'WITHDRAWN'").bind(rel.id).first())return settle(fail(409,'HANDOFF_ALREADY_EXISTS'));
  const summary=await ctx.releaseHandoff(env,style,rel);
  if(summary.missingSignoffs.length||summary.openMajorCritical.length||!summary.completeness.ready)return settle(fail(409,'HANDOFF_NOT_READY',{missingSignoffs:summary.missingSignoffs,openMajorCritical:summary.openMajorCritical.length,completenessReady:summary.completeness.ready}));
  // Independence: requester never signs; Engineering (DESIGN/PATTERN), PRODUCTION and QC are three different people.
  const by=Object.fromEntries(summary.signoffs.filter(x=>x.decision==='APPROVED').map(x=>[x.role_key,x.user_id]));
  const eng=new Set([by.DESIGN,by.PATTERN]);
  if(Object.values(by).includes(rel.created_by)||by.PRODUCTION===by.QC||eng.has(by.PRODUCTION)||eng.has(by.QC))return settle(fail(409,'SIGNOFF_INDEPENDENCE_REQUIRED'));
  for(const [roleKey,userId] of Object.entries(by)){const u=await env.DB.prepare('SELECT u.active,u.is_platform_admin,m.role FROM users u LEFT JOIN memberships m ON m.user_id=u.id AND m.org_id=? WHERE u.id=?').bind(orgId,userId).first();
    const role=u&&Number(u.is_platform_admin)===1?'PLATFORM_ADMIN':String(u?.role||'').toUpperCase();
    if(!u||Number(u.active)!==1||!role||!ctx.canSignRole(role,roleKey))return settle(fail(409,'SIGNOFF_SIGNER_INVALID',{roleKey}));}
  const signoffs=[...summary.signoffs].sort((a,b)=>a.role_key.localeCompare(b.role_key)).map(x=>({roleKey:x.role_key,decision:x.decision,userId:x.user_id,signedAt:x.created_at}));
  const signoffsSha=await ctx.sha256Text(JSON.stringify(signoffs));
  const id=ctx.randomId('hof_'),cmd=ctx.randomId('cmd_'),eventId=ctx.randomId('hev_'),receiptId=ctx.randomId('hrc_'),ts=ctx.now(),gate=JSON.parse(rel.gate_json||'{}');
  const pkg={contract:HANDOFF_CONTRACT,handoffId:id,orgId,style:{id:style.id,code:style.code,name:style.name},
    release:{id:rel.id,releaseNo:Number(rel.release_no),releaseType:rel.release_type,sourceVersionNo:rel.source_version_no,evidenceContract:rel.evidence_contract,candidateSha256:rel.candidate_sha256,snapshotSha256:integ.snapshotSha,manifestSha256:integ.manifestSha,decisionSha256:integ.decisionSha,releasedBy:rel.created_by,releasedAt:rel.created_at,rulesVersion:gate?.engineering?.rulesVersion||null},
    signoffs,signoffsSha256:signoffsSha,completeness:{templateKey:summary.completeness.templateKey,score:summary.completeness.score,ready:summary.completeness.ready},
    outputs:{techPack:summary.outputs.techPack,manifest:summary.outputs.manifest},
    operationalHoldCheck:'BLOCKED_NO_HOLD_MODEL',
    authority:{preparedBy:sess.userId,preparedRole:access.role,note:'Factory acknowledgement records receipt only. It is not a QC signoff, a Production Lot release or an application deployment.'},
    preparedAt:ts};
  const packageJson=JSON.stringify(pkg),packageSha=await ctx.sha256Text(packageJson);
  const response={id,status:'PREPARED',version:1,releaseNo:Number(releaseNo),packageSha256:packageSha,receiptId,eventId};
  const m={I:id,O:orgId,S:style.id,R:rel.id,N:Number(releaseNo),P:packageJson,H:packageSha,Q:integ.snapshotSha,M:integ.manifestSha,G:signoffsSha,A:sess.userId,T:ts,C:cmd,X:sStamp.st,E:eventId,L:access.role,K:key,W:requestSha,Z:JSON.stringify(response),Y:receiptId,V:RELEASE_EVIDENCE_CONTRACT,U:JSON.stringify({releaseNo:Number(releaseNo),packageSha256:packageSha,contract:HANDOFF_CONTRACT})};
  const statements=[
    stmt(env.DB,`INSERT INTO factory_handoffs(id,org_id,style_id,release_id,release_no,status,version,package_json,package_sha256,release_snapshot_sha256,release_manifest_sha256,signoffs_sha256,prepared_by,prepared_at,last_command_id,created_at,updated_at)
      SELECT ?I,?O,?S,?R,?N,'PREPARED',1,?P,?H,?Q,?M,?G,?A,?T,?C,?T,?T
      WHERE EXISTS(SELECT 1 FROM styles WHERE id=?S AND org_id=?O)
        AND ${actorSql('HANDOFF_PREPARE','?A','?O')}
        AND EXISTS(SELECT 1 FROM style_releases WHERE id=?R AND style_id=?S AND release_no=?N AND release_type='PRODUCTION' AND evidence_contract=?V)
        AND (SELECT MAX(release_no) FROM style_releases WHERE style_id=?S AND release_type='PRODUCTION')=?N
        AND NOT EXISTS(SELECT 1 FROM factory_handoffs WHERE release_id=?R AND status<>'WITHDRAWN')
        AND ${SIGNOFF_STAMP}=?X
        AND NOT EXISTS(SELECT 1 FROM review_items WHERE style_id=?S AND (release_no=?N OR release_no IS NULL) AND status='OPEN' AND severity IN ('MAJOR','CRITICAL'))
        AND (SELECT COUNT(*) FROM release_signoffs s JOIN users u ON u.id=s.user_id WHERE s.style_id=?S AND s.release_no=?N AND s.decision='APPROVED' AND u.active=1 AND (u.is_platform_admin=1 OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.org_id=?O)))=4`,m),
    stmt(env.DB,`INSERT INTO factory_handoff_events(id,handoff_id,org_id,command_id,action,from_status,to_status,actor_user_id,actor_role,reason,package_sha256,created_at) VALUES(?E,(SELECT id FROM factory_handoffs WHERE id=?I AND last_command_id=?C),?O,?C,'PREPARE',NULL,'PREPARED',?A,?L,NULL,?H,?T)`,m),
    stmt(env.DB,`INSERT INTO handoff_receipts(id,org_id,actor_user_id,operation,handoff_id,event_id,idempotency_key,request_sha256,response_status,response_json,created_at) VALUES(?Y,?O,?A,'HANDOFF_PREPARE',?I,(SELECT id FROM factory_handoff_events WHERE id=?E),?K,?W,201,?Z,?T)`,m),
    stmt(env.DB,`INSERT INTO audit_log(org_id,user_id,entity_type,entity_id,action,detail_json,created_at) VALUES((SELECT org_id FROM factory_handoffs WHERE id=?I AND last_command_id=?C),?A,'FACTORY_HANDOFF',?I,'PREPARE',?U,?T)`,m)];
  const diagnose=async()=>{const a=await actorCapability(env,sess.userId,orgId,'HANDOFF_PREPARE');if(!a.ok)return fail(403,a.code);
    const l=await env.DB.prepare("SELECT MAX(release_no) n FROM style_releases WHERE style_id=? AND release_type='PRODUCTION'").bind(style.id).first();if(Number(l.n)!==Number(releaseNo))return fail(409,'RELEASE_SUPERSEDED',{latestReleaseNo:Number(l.n)});
    if(await env.DB.prepare("SELECT 1 x FROM factory_handoffs WHERE release_id=? AND status<>'WITHDRAWN'").bind(rel.id).first())return fail(409,'HANDOFF_ALREADY_EXISTS');
    return fail(409,'HANDOFF_NOT_READY');};
  const r=await commit(env,ctx,{orgId,userId:sess.userId,op,key,requestSha,statements,diagnose});if(r)return r;
  return new Response(m.Z,{status:201,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}

async function transition(request,env,ctx,style,h,action,sess){
  const spec=ACTIONS[action],orgId=style.org_id,b=await ctx.requestBody(request);
  const access=await actorCapability(env,sess.userId,orgId,spec.capability);if(!access.ok)return fail(403,access.code);
  const key=request.headers.get('idempotency-key');if(key!=null&&!KEY_PATTERN.test(key))return fail(400,'IDEMPOTENCY_KEY_INVALID');
  const reason=action==='withdraw'?String(b.reason||'').trim():action==='acknowledge'?(b.note?String(b.note).trim():null):null;
  const requestSha=await ctx.sha256Text(JSON.stringify({op:spec.op,handoffId:h.id,reason}));
  const prior=await receiptFor(env,orgId,sess.userId,spec.op,key);if(prior)return replay(prior,requestSha);
  const settle=async r=>{const won=await receiptFor(env,orgId,sess.userId,spec.op,key);return won?replay(won,requestSha):r;};
  if(action==='withdraw'&&reason.length<5)return settle(fail(422,'REASON_REQUIRED'));
  if(h.status!==spec.from)return settle(fail(409,'INVALID_STATE',{status:h.status}));
  if(b.expectedVersion!=null&&Number(b.expectedVersion)!==Number(h.version))return settle(fail(409,'STALE_VERSION',{version:h.version}));
  if(action==='acknowledge'&&h.dispatched_by===sess.userId)return settle(fail(403,'SELF_ACKNOWLEDGE_FORBIDDEN'));
  if(action!=='withdraw'){const pi=await packageIntegrity(env,h,ctx);if(!pi.ok)return settle(fail(409,'HANDOFF_PACKAGE_DRIFT'));}
  if(action==='dispatch'){const l=await env.DB.prepare("SELECT MAX(release_no) n FROM style_releases WHERE style_id=? AND release_type='PRODUCTION'").bind(style.id).first();if(Number(l.n)!==Number(h.release_no))return settle(fail(409,'RELEASE_SUPERSEDED',{latestReleaseNo:Number(l.n)}));}
  const cmd=ctx.randomId('cmd_'),eventId=ctx.randomId('hev_'),receiptId=ctx.randomId('hrc_'),ts=ctx.now(),version=Number(h.version)+1;
  const response={id:h.id,status:spec.to,version,releaseNo:Number(h.release_no),packageSha256:h.package_sha256,receiptId,eventId};
  const set=action==='dispatch'?'dispatched_by=?A,dispatched_at=?T':action==='acknowledge'?'acknowledged_by=?A,acknowledged_at=?T,ack_note=?D':'withdrawn_by=?A,withdrawn_at=?T,withdraw_reason=?D';
  const extra=action==='dispatch'?" AND (SELECT MAX(release_no) FROM style_releases WHERE style_id=?S AND release_type='PRODUCTION')=release_no":action==='acknowledge'?' AND dispatched_by<>?A':'';
  const m={I:h.id,O:orgId,S:style.id,F:spec.from,J:spec.to,V:Number(h.version),A:sess.userId,T:ts,C:cmd,D:reason,H:h.package_sha256,E:eventId,L:access.role,K:key,W:requestSha,Z:JSON.stringify(response),Y:receiptId,B:spec.event,P:spec.op,U:JSON.stringify({from:spec.from,to:spec.to,version,packageSha256:h.package_sha256,reason})};
  const statements=[
    stmt(env.DB,`UPDATE factory_handoffs SET status=?J,version=version+1,last_command_id=?C,${set},updated_at=?T
      WHERE id=?I AND org_id=?O AND style_id=?S AND status=?F AND version=?V AND package_sha256=?H AND ${actorSql(spec.capability,'?A','?O')}${extra}`,m),
    stmt(env.DB,`INSERT INTO factory_handoff_events(id,handoff_id,org_id,command_id,action,from_status,to_status,actor_user_id,actor_role,reason,package_sha256,created_at) VALUES(?E,(SELECT id FROM factory_handoffs WHERE id=?I AND last_command_id=?C),?O,?C,?B,?F,?J,?A,?L,?D,?H,?T)`,m),
    stmt(env.DB,`INSERT INTO handoff_receipts(id,org_id,actor_user_id,operation,handoff_id,event_id,idempotency_key,request_sha256,response_status,response_json,created_at) VALUES(?Y,?O,?A,?P,?I,(SELECT id FROM factory_handoff_events WHERE id=?E),?K,?W,200,?Z,?T)`,m),
    stmt(env.DB,`INSERT INTO audit_log(org_id,user_id,entity_type,entity_id,action,detail_json,created_at) VALUES((SELECT org_id FROM factory_handoffs WHERE id=?I AND last_command_id=?C),?A,'FACTORY_HANDOFF',?I,?B,?U,?T)`,m)];
  const diagnose=async()=>{const a=await actorCapability(env,sess.userId,orgId,spec.capability);if(!a.ok)return fail(403,a.code);
    const cur=await env.DB.prepare('SELECT status,version,dispatched_by,release_no FROM factory_handoffs WHERE id=?').bind(h.id).first();
    if(cur.status!==spec.from)return fail(409,'INVALID_STATE',{status:cur.status});if(Number(cur.version)!==Number(h.version))return fail(409,'STALE_VERSION',{version:cur.version});
    if(action==='dispatch'){const l=await env.DB.prepare("SELECT MAX(release_no) n FROM style_releases WHERE style_id=? AND release_type='PRODUCTION'").bind(style.id).first();if(Number(l.n)!==Number(cur.release_no))return fail(409,'RELEASE_SUPERSEDED',{latestReleaseNo:Number(l.n)});}
    return fail(409,'HANDOFF_CONFLICT');};
  const r=await commit(env,ctx,{orgId,userId:sess.userId,op:spec.op,key,requestSha,statements,diagnose});if(r)return r;
  return new Response(m.Z,{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function packageHtml(pkg,sha){const rows=pkg.signoffs.map(s=>`<tr><td>${esc(s.roleKey)}</td><td>${esc(s.decision)}</td><td dir="ltr">${esc(s.userId)}</td><td dir="ltr">${esc(s.signedAt)}</td></tr>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>حزمة تسليم ${esc(pkg.style.code)} R${esc(pkg.release.releaseNo)}</title><style>body{font-family:Arial,'Noto Sans Arabic',sans-serif;color:#1d1d1d;background:#fff;margin:24px;font-size:14px}h1{font-size:20px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin:8px 0 16px}th,td{border:1px solid #c9c9c9;padding:6px;text-align:right}th{background:#f2f2f2}code{font-size:12px;word-break:break-all}.note{border:1px solid #c9c9c9;background:#fafafa;padding:8px}</style></head><body>
<h1>حزمة التسليم للمصنع / Factory Handoff Package</h1><div>${esc(pkg.style.code)} — ${esc(pkg.style.name)} · إصدار الإنتاج R${esc(pkg.release.releaseNo)} من النسخة V${esc(pkg.release.sourceVersionNo)}</div>
<table><tr><th>البند</th><th>القيمة</th></tr><tr><td>بصمة الحزمة / Package SHA-256</td><td><code>${esc(sha)}</code></td></tr><tr><td>بصمة لقطة الإصدار</td><td><code>${esc(pkg.release.snapshotSha256)}</code></td></tr><tr><td>بصمة المرشّح</td><td><code>${esc(pkg.release.candidateSha256)}</code></td></tr><tr><td>بصمة قرار الجاهزية</td><td><code>${esc(pkg.release.decisionSha256)}</code></td></tr><tr><td>اكتمال القالب</td><td>${esc(pkg.completeness.score)}% (${pkg.completeness.ready?'مكتمل':'غير مكتمل'})</td></tr><tr><td>فحص الإيقاف التشغيلي</td><td>${esc(pkg.operationalHoldCheck)}</td></tr><tr><td>أعدّها</td><td dir="ltr">${esc(pkg.authority.preparedBy)} · ${esc(pkg.preparedAt)}</td></tr></table>
<h2>التوقيعات المجمّدة / Frozen signoffs</h2><table><tr><th>الدور</th><th>القرار</th><th>الموقّع</th><th>التاريخ</th></tr>${rows}</table>
<div class="note">استلام المصنع لهذه الحزمة إثبات استلام فقط، وليس توقيع جودة ولا اعتماد أمر إنتاج ولا نشر للتطبيق.<br>${esc(pkg.authority.note)}</div></body></html>`;}

async function servePackage(request,env,ctx,style,h,sess){
  const access=await actorCapability(env,sess.userId,style.org_id,'HANDOFF_INSPECT');if(!access.ok)return fail(403,access.code);
  const pi=await packageIntegrity(env,h,ctx);if(!pi.ok)return fail(409,'HANDOFF_PACKAGE_DRIFT');
  const etag=`"${h.package_sha256}"`;if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers:{etag}});
  const url=new URL(request.url),fmt=url.searchParams.get('format');
  const disp=url.searchParams.get('download')==='1'?{'content-disposition':`attachment; filename="handoff-${h.id}.${fmt==='html'?'html':'json'}"`}:{};
  if(fmt==='html')return new Response(packageHtml(JSON.parse(h.package_json),h.package_sha256),{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store',etag,'x-package-sha256':h.package_sha256,...disp}});
  return new Response(h.package_json,{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',etag,'x-package-sha256':h.package_sha256,...disp}});
}
const publicRow=({package_json,last_command_id,...x})=>x;

export async function handoffRoute(request,env,ctx){
  const url=new URL(request.url),p=url.pathname;
  const prep=p.match(/^\/api\/styles\/([^/]+)\/releases\/(\d+)\/handoffs$/),list=p.match(/^\/api\/styles\/([^/]+)\/handoffs$/),one=p.match(/^\/api\/styles\/([^/]+)\/handoffs\/([^/]+)(?:\/(package|dispatch|acknowledge|withdraw))?$/);
  if(!prep&&!list&&!one)return null;
  const sess=await ctx.requireAuth(request,env),sid=(prep||list||one)[1];
  const style=await env.DB.prepare('SELECT * FROM styles WHERE id=?').bind(sid).first();if(!style)return send(404,{error:'Style not found'});
  await ctx.requireOrg(env,sess,style.org_id);
  if(prep&&request.method==='POST')return prepare(request,env,ctx,style,Number(prep[2]),sess);
  if(list&&request.method==='GET'){const a=await actorCapability(env,sess.userId,style.org_id,'HANDOFF_INSPECT');if(!a.ok)return fail(403,a.code);
    const rows=(await env.DB.prepare('SELECT h.*,up.display_name prepared_by_name,ud.display_name dispatched_by_name,ua.display_name acknowledged_by_name,uw.display_name withdrawn_by_name FROM factory_handoffs h LEFT JOIN users up ON up.id=h.prepared_by LEFT JOIN users ud ON ud.id=h.dispatched_by LEFT JOIN users ua ON ua.id=h.acknowledged_by LEFT JOIN users uw ON uw.id=h.withdrawn_by WHERE h.style_id=? ORDER BY h.release_no DESC,h.created_at DESC').bind(style.id).all()).results||[];
    const latest=await env.DB.prepare("SELECT MAX(release_no) n FROM style_releases WHERE style_id=? AND release_type='PRODUCTION'").bind(style.id).first();
    return send(200,{items:rows.map(r=>({...publicRow(r),superseded:Number(r.release_no)!==Number(latest?.n)}))});}
  if(one){const h=await env.DB.prepare('SELECT * FROM factory_handoffs WHERE id=? AND style_id=?').bind(one[2],style.id).first();if(!h)return send(404,{error:'Handoff not found'});
    if(!one[3]&&request.method==='GET'){const a=await actorCapability(env,sess.userId,style.org_id,'HANDOFF_INSPECT');if(!a.ok)return fail(403,a.code);
      const events=(await env.DB.prepare('SELECT * FROM factory_handoff_events WHERE handoff_id=? ORDER BY created_at,rowid').bind(h.id).all()).results||[];return send(200,{handoff:publicRow(h),events});}
    if(one[3]==='package'&&request.method==='GET')return servePackage(request,env,ctx,style,h,sess);
    if(ACTIONS[one[3]]&&request.method==='POST')return transition(request,env,ctx,style,h,one[3],sess);}
  return send(405,{error:'Method not allowed'});
}
