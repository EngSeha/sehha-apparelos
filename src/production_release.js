// ROUND29 — single authoritative release command (SAMPLE + PRODUCTION).
// Evaluation reads happen first; every precondition that can drift between evaluation and commit is re-asserted
// inside one D1 batch (a transaction: any failed statement rolls back every statement in the batch).
// A guarded INSERT ... SELECT that matches no row does not raise, so the receipt INSERT that follows references the new
// release id through a scalar sub-select into a NOT NULL column: a failed guard therefore aborts the whole batch.
import {frozenEngineeringReadiness,ENGINEERING_CAPTURE_CONTRACT} from './engineering.js';

export const RELEASE_EVIDENCE_CONTRACT='FROZEN_READINESS/R29';
const OPERATION='STYLE_RELEASE_CREATE';
const KEY_PATTERN=/^[A-Za-z0-9._:-]{8,128}$/;

// Drift fingerprints. The same SQL text is used at evaluation time and inside the commit guard.
const REL_MAX="(SELECT COALESCE(MAX(release_no),0) FROM style_releases WHERE style_id=?1)";
const VER_MAX="(SELECT COALESCE(MAX(version_no),0) FROM style_versions WHERE style_id=?1)";
const SAMPLE_STAMP="(SELECT COUNT(*)||'|'||COALESCE(MAX(updated_at),'')||'|'||COALESCE(SUM(CASE WHEN status='APPROVED' THEN 1 ELSE 0 END),0) FROM sample_rounds WHERE style_id=?1)";
const COST_STAMP="(SELECT COUNT(*)||'|'||COALESCE(MAX(updated_at),'')||'|'||COALESCE(SUM(CASE WHEN status='APPROVED' THEN 1 ELSE 0 END),0)||'|'||(SELECT COUNT(*)||'|'||COALESCE(MAX(updated_at),'') FROM cost_lines WHERE cost_sheet_id IN (SELECT id FROM cost_sheets WHERE style_id=?1)) FROM cost_sheets WHERE style_id=?1)";

const MESSAGES={
  ENGINEERING_READINESS_BLOCKED:'لا يمكن إصدار نسخة إنتاج قبل استكمال متطلبات الجاهزية الهندسية / Engineering readiness blocked production release',
  ENGINEERING_NOT_CAPTURED_IN_VERSION:'نسخة الموديل المختارة لا تحتوي بيانات هندسية مجمّدة؛ أنشئ نسخة جديدة ثم أعد المحاولة / Source version has no frozen engineering data; create a new Style Version',
  PRODUCTION_ALREADY_RELEASED:'تم اعتماد إصدار إنتاج لهذه النسخة مسبقًا؛ حدّث الصفحة / A production release already exists for this Style Version',
  RELEASE_CONFLICT:'هناك إصدار آخر تم اعتماده؛ حدّث الصفحة / Another release was committed first; refresh and retry',
  STALE_CANDIDATE:'تغيّرت بيانات النسخة أو أدلة العينة/التكلفة أثناء الإصدار؛ حدّث الصفحة وأعد المراجعة / Candidate evidence changed during release; refresh and re-review',
  IDEMPOTENCY_KEY_REUSED:'مفتاح العملية مستخدم لطلب مختلف / Idempotency-Key was already used for a different request',
  IDEMPOTENCY_KEY_INVALID:'مفتاح العملية غير صالح / Idempotency-Key must be 8–128 characters [A-Za-z0-9._:-]',
  FORBIDDEN_ACTOR:'لا تملك صلاحية تنفيذ هذا الإصدار / Actor is not authorized for this workspace',
  FEATURE_NOT_LICENSED:'ميزة الإصدارات غير مفعّلة لهذه المساحة / Releases feature is not licensed',
  RELEASE_COMMIT_FAILED:'تعذّر حفظ الإصدار؛ لم يتم حفظ أي تغيير / Release could not be committed; nothing was saved'
};
const fail=(status,code,extra={})=>({status,body:{error:MESSAGES[code]||code,code,...extra}});

// Read-only classification of a stored release for display and downstream checks. Never synthesizes approval.
export function releaseEvidenceStatus(row){
  if(!row||row.release_type!=='PRODUCTION')return 'NOT_APPLICABLE';
  if(row.evidence_contract===RELEASE_EVIDENCE_CONTRACT)return 'FROZEN_VERIFIED';
  let snap=null;try{snap=JSON.parse(row.snapshot_json||'null')}catch{}
  if(snap?.engineeringReadiness?.basis==='LIVE_ENGINEERING_RECORDS')return 'LIVE_UNVERSIONED_R28';
  return 'LEGACY_UNVERIFIED';
}

async function actorAccess(env,userId,orgId){
  const u=await env.DB.prepare('SELECT active,is_platform_admin FROM users WHERE id=?').bind(userId).first();
  if(!u||Number(u.active)!==1)return {ok:false,code:'FORBIDDEN_ACTOR'};
  if(Number(u.is_platform_admin)===1)return {ok:true,role:'PLATFORM_ADMIN'};
  const m=await env.DB.prepare('SELECT role FROM memberships WHERE user_id=? AND org_id=?').bind(userId,orgId).first();
  return m?{ok:true,role:m.role}:{ok:false,code:'FORBIDDEN_ACTOR'};
}
async function licensed(env,orgId){if(env.LICENSE_MODE==='remote')return true;const x=await env.DB.prepare("SELECT enabled FROM entitlements WHERE org_id=? AND feature_key='RELEASES'").bind(orgId).first();return Number(x?.enabled)===1;}
async function fingerprints(env,styleId){return env.DB.prepare(`SELECT ${REL_MAX} rel_max, ${VER_MAX} ver_max, ${SAMPLE_STAMP} sample_stamp, ${COST_STAMP} cost_stamp`).bind(styleId).first();}
async function receiptFor(env,orgId,userId,key){return key?env.DB.prepare('SELECT * FROM release_receipts WHERE org_id=? AND actor_user_id=? AND operation=? AND idempotency_key=?').bind(orgId,userId,OPERATION,key).first():null;}
function replay(row,requestSha){
  if(row.request_sha256!==requestSha)return {response:fail(409,'IDEMPOTENCY_KEY_REUSED',{receiptId:row.id})};
  return {replayed:new Response(row.response_json,{status:Number(row.response_status),headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','idempotency-replayed':'true'}})};
}

export async function createRelease(request,env,styleId,ctx){
  const {requireAuth,requireOrg,requireFeature,styleSnapshot,loadVersionSnapshot,releaseGate,buildExportManifest,sha256Text,stableComparable,requestBody,randomId,now}=ctx;
  const send=r=>new Response(JSON.stringify(r.body),{status:r.status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  const sess=await requireAuth(request,env),b=await requestBody(request);
  const style=await env.DB.prepare('SELECT * FROM styles WHERE id=?').bind(styleId).first();if(!style)return send({status:404,body:{error:'Style not found'}});
  const orgId=style.org_id;await requireOrg(env,sess,orgId);await requireFeature(env,orgId,'RELEASES');
  // Session claims are not authority: re-read the actor from the database (deactivation, membership removal, admin drift).
  const access=await actorAccess(env,sess.userId,orgId);if(!access.ok)return send(fail(403,access.code));
  const type=String(b.releaseType||'SAMPLE').toUpperCase();if(!['SAMPLE','PRODUCTION'].includes(type))throw Object.assign(new Error('releaseType must be SAMPLE or PRODUCTION'),{status:400});
  const key=request.headers.get('idempotency-key');if(key!=null&&!KEY_PATTERN.test(key))return send(fail(400,'IDEMPOTENCY_KEY_INVALID'));
  const requestedVersion=b.sourceVersionNo==null||b.sourceVersionNo===''?null:Number(b.sourceVersionNo);
  if(requestedVersion!=null&&!(Number.isInteger(requestedVersion)&&requestedVersion>0))throw Object.assign(new Error('sourceVersionNo must be a positive integer'),{status:400});
  const templateKey=b.templateKey||'mohsen_nexz_20p',note=b.note?String(b.note):null;
  const requestSha=await sha256Text(JSON.stringify(stableComparable({operation:OPERATION,styleId,releaseType:type,sourceVersionNo:requestedVersion,templateKey,note})));
  // Idempotent replay: same actor + tenant + operation + key. Access was re-verified above, so a revoked actor never sees it.
  const prior=await receiptFor(env,orgId,sess.userId,key);if(prior){const r=replay(prior,requestSha);return r.replayed||send(r.response);}
  // A concurrent request with the same key may commit at any point after this lookup. Every non-success answer below is
  // therefore routed through settle(), which prefers that winner's receipt over a conflict computed from stale reads.
  const settle=async r=>{const won=await receiptFor(env,orgId,sess.userId,key);if(won){const rp=replay(won,requestSha);return rp.replayed||send(rp.response);}return send(r);};

  // Fingerprints are read BEFORE the evidence they protect, so any later change is visible at commit.
  const fp=await fingerprints(env,styleId);
  const current=await styleSnapshot(env,styleId);
  let sourceVersionNo=requestedVersion,frozen=current,candidateRaw=null;
  if(sourceVersionNo==null&&type==='PRODUCTION'){const latest=current.versions?.[0];if(!latest)return settle({status:409,body:{error:'Production release requires a frozen Style Version',code:'VERSION_REQUIRED',gate:releaseGate(current,type)}});sourceVersionNo=Number(latest.version_no);}
  if(sourceVersionNo!=null){candidateRaw=await env.DB.prepare('SELECT snapshot_json,length(snapshot_json) len FROM style_versions WHERE style_id=? AND version_no=?').bind(styleId,sourceVersionNo).first();if(!candidateRaw)return settle({status:404,body:{error:'Source version not found'}});frozen=await loadVersionSnapshot(env,styleId,sourceVersionNo);}
  const releaseSnapshot={...frozen,samples:(current.samples||[]).filter(x=>sourceVersionNo==null||Number(x.version_no)===Number(sourceVersionNo)),costSheets:(current.costSheets||[]).filter(x=>x.version_no==null||sourceVersionNo==null||Number(x.version_no)===Number(sourceVersionNo))};
  const gate=releaseGate(releaseSnapshot,type,{sourceVersionNo});if(!gate.ready)return settle({status:409,body:{error:'Release gate blocked',code:'RELEASE_GATE_BLOCKED',gate}});
  const candidateSha=await sha256Text(candidateRaw?candidateRaw.snapshot_json:JSON.stringify(stableComparable(frozen)));
  if(type==='PRODUCTION'){
    if(await env.DB.prepare("SELECT 1 x FROM style_releases WHERE style_id=? AND release_type='PRODUCTION' AND source_version_no=?").bind(styleId,sourceVersionNo).first())return settle(fail(409,'PRODUCTION_ALREADY_RELEASED',{sourceVersionNo}));
    const r=frozenEngineeringReadiness(frozen,releaseSnapshot.samples);
    const evidenceSha=await sha256Text(JSON.stringify(stableComparable({samples:releaseSnapshot.samples,costSheets:releaseSnapshot.costSheets})));
    const engineering={...r,basis:'FROZEN_STYLE_VERSION',captureContract:ENGINEERING_CAPTURE_CONTRACT,sourceVersionNo,candidateSha256:candidateSha,evidenceSha256:evidenceSha,evaluatedAt:now(),
      decision:r.status,humanApproval:{state:'NOT_GRANTED_BY_THIS_GATE',requiredSignoffsForHandoff:['DESIGN','PATTERN','PRODUCTION','QC']}};
    if(r.status!=='ELIGIBLE_FOR_MANUAL_RELEASE_REVIEW'){const code=r.blockers.includes('ENGINEERING_NOT_CAPTURED_IN_VERSION')?'ENGINEERING_NOT_CAPTURED_IN_VERSION':'ENGINEERING_READINESS_BLOCKED';return settle(fail(409,code,{engineering,gate}));}
    engineering.decisionSha256=await sha256Text(JSON.stringify(stableComparable({rulesVersion:r.rulesVersion,blockers:r.blockers,status:r.status,candidateSha256:candidateSha,evidenceSha256:evidenceSha})));
    gate.engineering=engineering;releaseSnapshot.engineeringReadiness=engineering;
  }
  gate.authority={releasedBy:sess.userId,actorRole:access.role,contract:RELEASE_EVIDENCE_CONTRACT,autoSignoffs:0};
  const releaseNo=Number(fp.rel_max)+1,id=randomId('rel_'),receiptId=randomId('rcp_'),ts=now();
  // Hash exactly what is stored: JSON round-trip drops undefined members so the stored snapshot re-hashes to snapshotSha256.
  const storedSnapshot=JSON.stringify(releaseSnapshot),canonicalSnapshot=JSON.parse(storedSnapshot);
  const manifest=await buildExportManifest(canonicalSnapshot,{releaseType:type,releaseNo,sourceVersionNo,templateKey});
  const responseBody={id,releaseNo,releaseType:type,gate,manifest,receiptId,evidenceStatus:type==='PRODUCTION'?'FROZEN_VERIFIED':'NOT_APPLICABLE'};
  const responseJson=JSON.stringify(responseBody);
  const auditDetail=JSON.stringify({releaseNo,releaseType:type,sourceVersionNo,manifestSha256:manifest.manifestSha256,candidateSha256:candidateSha,decisionSha256:gate.engineering?.decisionSha256||null,receiptId,idempotent:key!=null,contract:RELEASE_EVIDENCE_CONTRACT});
  const db=env.DB;
  const statements=[
    db.prepare(`INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,note,created_by,created_at,evidence_contract,candidate_sha256)
      SELECT ?2,?1,?3,?4,'RELEASED',?5,?6,?7,?8,?9,?10,?11,?12,?13,?14
      WHERE EXISTS(SELECT 1 FROM styles WHERE id=?1 AND org_id=?15)
        AND EXISTS(SELECT 1 FROM users u WHERE u.id=?11 AND u.active=1 AND (u.is_platform_admin=1 OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.org_id=?15)))
        AND (?16=1 OR EXISTS(SELECT 1 FROM entitlements WHERE org_id=?15 AND feature_key='RELEASES' AND enabled=1))
        AND ${REL_MAX}=?3-1 AND ${VER_MAX}=?17 AND ${SAMPLE_STAMP}=?18 AND ${COST_STAMP}=?19
        AND (?4<>'PRODUCTION' OR NOT EXISTS(SELECT 1 FROM style_releases WHERE style_id=?1 AND release_type='PRODUCTION' AND source_version_no=?5))
        AND (?5 IS NULL OR EXISTS(SELECT 1 FROM style_versions WHERE style_id=?1 AND version_no=?5 AND length(snapshot_json)=?20))`)
      .bind(styleId,id,releaseNo,type,sourceVersionNo,templateKey,JSON.stringify(gate),JSON.stringify(manifest),storedSnapshot,note,sess.userId,ts,RELEASE_EVIDENCE_CONTRACT,candidateSha,orgId,env.LICENSE_MODE==='remote'?1:0,Number(fp.ver_max),String(fp.sample_stamp),String(fp.cost_stamp),candidateRaw?Number(candidateRaw.len):null),
    db.prepare(`INSERT INTO release_receipts(id,org_id,actor_user_id,operation,style_id,idempotency_key,request_sha256,release_id,release_no,response_status,response_json,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,(SELECT id FROM style_releases WHERE id=?8),?9,201,?10,?11)`)
      .bind(receiptId,orgId,sess.userId,OPERATION,styleId,key,requestSha,id,releaseNo,responseJson,ts),
    db.prepare('UPDATE styles SET status=?1,updated_at=?2 WHERE id=?3').bind(type==='PRODUCTION'?'PRODUCTION_RELEASED':'SAMPLE_RELEASED',ts,styleId),
    db.prepare(`INSERT INTO audit_log(org_id,user_id,entity_type,entity_id,action,detail_json,created_at) VALUES(?1,?2,'RELEASE',(SELECT id FROM style_releases WHERE id=?3),'CREATE',?4,?5)`)
      .bind(orgId,sess.userId,id,auditDetail,ts)
  ];
  try{await db.batch(statements);}
  catch(e){
    const msg=String(e?.message||e);
    // A concurrent request with the same key may have won: answer with its receipt, never with a second release.
    const won=await receiptFor(env,orgId,sess.userId,key);if(won){const rp=replay(won,requestSha);return rp.replayed||send(rp.response);}
    if(/NOT NULL constraint failed: release_receipts\.release_id/.test(msg)){
      const now2=await actorAccess(env,sess.userId,orgId);if(!now2.ok)return send(fail(403,now2.code));
      if(!(await licensed(env,orgId)))return send(fail(403,'FEATURE_NOT_LICENSED'));
      if(type==='PRODUCTION'&&await env.DB.prepare("SELECT 1 x FROM style_releases WHERE style_id=? AND release_type='PRODUCTION' AND source_version_no=?").bind(styleId,sourceVersionNo).first())return send(fail(409,'PRODUCTION_ALREADY_RELEASED',{sourceVersionNo}));
      const fp2=await fingerprints(env,styleId);
      if(Number(fp2.rel_max)!==Number(fp.rel_max))return send(fail(409,'RELEASE_CONFLICT'));
      return send(fail(409,'STALE_CANDIDATE'));
    }
    if(/UNIQUE constraint failed: (style_releases|release_receipts)/.test(msg))return send(fail(409,'RELEASE_CONFLICT'));
    const correlationId=randomId('err_');console.error('RELEASE_COMMIT_FAILED',correlationId,msg);
    return send(fail(500,'RELEASE_COMMIT_FAILED',{correlationId}));
  }
  return new Response(responseJson,{status:201,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
