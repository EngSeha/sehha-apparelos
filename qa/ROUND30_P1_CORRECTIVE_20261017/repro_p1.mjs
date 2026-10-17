// ROUND30 P1 corrective — standalone reproduction of the two independently reported P1 defects.
// Runs unchanged against any HEAD of this repo (original PR #4 5f928e2 and the corrective HEAD). It only OBSERVES and
// prints what the real Worker + real SQLite engine return; it never asserts a pass, so it can show the defect on the
// baseline and the corrected behaviour on the fix.  Usage: node qa/ROUND30_P1_CORRECTIVE_20261017/repro_p1.mjs
import {makeHarness,seedEngineeringReady} from '../../tests/test_helpers.mjs';
import {buildReleaseCandidate,newVersion,addHandoffEvidence} from '../../tests/release_fixture.mjs';
const h=makeHarness(),{call,db,env}=h;await h.login();
const org=(await call('/api/me')).data.workspaces.find(w=>w.code==='MOHSEN'),ts0=new Date().toISOString();
const devHash=db.prepare("SELECT password_hash,password_salt FROM users WHERE email='dev@sehha.local'").get();
async function user(id,role){db.prepare('INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)').run(id,`${id}@repro.local`,id,devHash.password_hash,devHash.password_salt,ts0);db.prepare('INSERT INTO memberships(user_id,org_id,role) VALUES(?,?,?)').run(id,org.id,role);
  const r=await call('/api/auth/login',{method:'POST',body:{email:`${id}@repro.local`,password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});return (r.r.headers.get('set-cookie')||'').split(';')[0];}
const U={rm:await user('rp_rm','RELEASE_MANAGER'),eng:await user('rp_eng','DESIGN_PATTERN_MASTER'),prod:await user('rp_prod','FACTORY_SUPERVISOR'),qc:await user('rp_qc','QC_MANAGER'),fs:await user('rp_fs','FACTORY_SUPERVISOR')};
const req=(path,{body={},cookie,key}={})=>call(path,{method:'POST',body,cookieOverride:cookie,headers:key?{'idempotency-key':key}:{}});
const realBatch=env.DB.batch.bind(env.DB);let beforeCommit=null;
env.DB.batch=async list=>{const f=beforeCommit;beforeCommit=null;if(f)f();return realBatch(list);};
const out=[];const record=(id,data)=>{out.push({id,...data});console.log('REPRO '+JSON.stringify({id,...data}));};
async function signedRelease(code){const id=await buildReleaseCandidate(call,org,code);addHandoffEvidence(db,id);seedEngineeringReady(db,id);const v=await newVersion(call,id,'repro');
  const r=await req(`/api/styles/${id}/releases`,{body:{releaseType:'PRODUCTION',sourceVersionNo:v},cookie:U.rm});
  for(const [roleKey,cookie] of [['DESIGN',U.eng],['PATTERN',U.eng],['PRODUCTION',U.prod],['QC',U.qc]])await req(`/api/styles/${id}/releases/${r.data.releaseNo}/signoffs`,{body:{roleKey,decision:'APPROVED'},cookie});
  return {id,n:r.data.releaseNo};}
const counts=id=>({handoffs:db.prepare('SELECT COUNT(*) n FROM factory_handoffs WHERE style_id=?').get(id).n,lots:db.prepare('SELECT COUNT(*) n FROM production_lots WHERE style_id=?').get(id).n,lotAudits:db.prepare("SELECT COUNT(*) n FROM audit_log a JOIN production_lots l ON l.id=a.entity_id WHERE a.entity_type='PRODUCTION_LOT' AND a.action='CREATE' AND l.style_id=?").get(id).n});

// P1-A: QC signer keeps an ACTIVE membership but loses the QC-signing role between the pre-transaction checks and the
// prepare batch. Expected (invariant): no PREPARED package. Defect: 201 PREPARED, then dispatch/ack/lot succeed.
{const s=await signedRelease('REPRO-P1A');
 beforeCommit=()=>db.prepare("UPDATE memberships SET role='OPERATOR' WHERE user_id='rp_qc' AND org_id=?").run(org.id);
 const p=await req(`/api/styles/${s.id}/releases/${s.n}/handoffs`,{cookie:U.rm,key:'repro-p1a-prepare'});
 const member=db.prepare("SELECT role FROM memberships WHERE user_id='rp_qc'").get(),active=db.prepare("SELECT active FROM users WHERE id='rp_qc'").get().active;
 let d=null,a=null,l=null;if(p.r.status===201){d=await req(`/api/styles/${s.id}/handoffs/${p.data.id}/dispatch`,{cookie:U.rm});a=await req(`/api/styles/${s.id}/handoffs/${p.data.id}/acknowledge`,{body:{note:'received'},cookie:U.fs});l=await req(`/api/styles/${s.id}/production-lots`,{body:{releaseNo:s.n,lotCode:'REPRO-A-LOT',plannedQty:5},cookie:U.fs});}
 record('P1-A',{qcSignerRoleAtCommit:member.role,qcSignerActive:active,prepare:p.r.status,prepareCode:p.data?.code||p.data?.status,dispatch:d?.r.status??null,acknowledge:a?.r.status??null,openLot:l?.r.status??null,...counts(s.id),defectReproduced:p.r.status===201});
 db.prepare("UPDATE memberships SET role='QC_MANAGER' WHERE user_id='rp_qc' AND org_id=?").run(org.id);}

// P1-B: open a lot with Idempotency-Key K, lose the response, retry the identical request with K.
// Expected: replay of the original success, one lot/audit. Defect: retry -> 500 INTERNAL_ERROR.
{const s=await signedRelease('REPRO-P1B');const p=await req(`/api/styles/${s.id}/releases/${s.n}/handoffs`,{cookie:U.rm});
 await req(`/api/styles/${s.id}/handoffs/${p.data.id}/dispatch`,{cookie:U.rm});await req(`/api/styles/${s.id}/handoffs/${p.data.id}/acknowledge`,{body:{note:'received'},cookie:U.fs});
 const body={releaseNo:s.n,lotCode:'REPRO-B-LOT',plannedQty:25};
 const first=await req(`/api/styles/${s.id}/production-lots`,{body,cookie:U.fs,key:'repro-p1b-open-lot'});
 const retry=await req(`/api/styles/${s.id}/production-lots`,{body,cookie:U.fs,key:'repro-p1b-open-lot'});
 record('P1-B',{first:first.r.status,firstLotId:first.data?.lot?.id||null,retry:retry.r.status,retryCode:retry.data?.code||null,retryReplayed:retry.r.headers.get('idempotency-replayed'),retryLotId:retry.data?.lot?.id||null,...counts(s.id),defectReproduced:retry.r.status>=500});}
console.log('REPRO_SUMMARY '+JSON.stringify(out.map(o=>({id:o.id,defectReproduced:o.defectReproduced}))));
