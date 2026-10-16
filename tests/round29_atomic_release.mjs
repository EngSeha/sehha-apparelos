// ROUND29 adversarial suite for the single authoritative release command.
// Exercises the real worker HTTP handler against a real SQLite engine (node:sqlite) through the D1 adapter whose batch()
// mirrors D1's documented transaction semantics. Failure injection uses real SQLite triggers (RAISE(ABORT)).
// Each assertion is prefixed with its matrix id (R29-Txx) so qa/ROUND29_* CSV rows map 1:1 to PASS lines.
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {makeHarness,ok,seedEngineeringReady,root} from './test_helpers.mjs';
import {buildReleaseCandidate,newVersion} from './release_fixture.mjs';
const h=makeHarness(),{call,db,env}=h;await h.login();
let x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN');
const evidence=(scenario,data)=>console.log('EVIDENCE '+JSON.stringify({scenario,...data}));
const counts=id=>({releases:db.prepare('SELECT COUNT(*) n FROM style_releases WHERE style_id=?').get(id).n,receipts:db.prepare('SELECT COUNT(*) n FROM release_receipts WHERE style_id=?').get(id).n,audits:db.prepare("SELECT COUNT(*) n FROM audit_log WHERE entity_type='RELEASE' AND action='CREATE'").get().n,signoffs:db.prepare('SELECT COUNT(*) n FROM release_signoffs WHERE style_id=?').get(id).n,status:db.prepare('SELECT status FROM styles WHERE id=?').get(id).status});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
let seq=0;
async function readyStyle(prefix){const id=await buildReleaseCandidate(call,org,`${prefix}-${++seq}`);seedEngineeringReady(db,id);const v=await newVersion(call,id,'R29 candidate');return {id,v};}
const rel=(id,body,{key,cookie}={})=>call(`/api/styles/${id}/releases`,{method:'POST',body,cookieOverride:cookie,headers:key?{'idempotency-key':key}:{}});
const devHash=db.prepare("SELECT password_hash,password_salt FROM users WHERE email='dev@sehha.local'").get();
async function userWith(idv,{role=null,orgId=org.id,admin=0}={}){const ts=new Date().toISOString();db.prepare('INSERT INTO users(id,email,display_name,password_hash,password_salt,is_platform_admin,active,created_at) VALUES(?,?,?,?,?,?,1,?)').run(idv,`${idv}@r29.local`,idv,devHash.password_hash,devHash.password_salt,admin,ts);if(role)db.prepare('INSERT INTO memberships(user_id,org_id,role) VALUES(?,?,?)').run(idv,orgId,role);const r=await call('/api/auth/login',{method:'POST',body:{email:`${idv}@r29.local`,password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});if(r.r.status!==200)throw new Error('fixture login failed '+idv);return (r.r.headers.get('set-cookie')||'').split(';')[0];}
// Commit-window hook: runs immediately before the release batch, i.e. after every evaluation read (simulates a concurrent writer).
const realBatch=env.DB.batch.bind(env.DB);let beforeCommit=null,barrier=null;
env.DB.batch=async list=>{if(barrier){barrier.arrived++;if(barrier.arrived===barrier.n)barrier.open();await barrier.gate;}const f=beforeCommit;beforeCommit=null;if(f)f();return realBatch(list);};
// Barrier: hold N requests at the commit point until all N have finished every evaluation read, then let them commit.
let lastArrivals=0;const withBarrier=async(n,fn)=>{let open;barrier={n,arrived:0,gate:new Promise(r=>open=r)};barrier.open=open;try{return await fn()}finally{lastArrivals=barrier.arrived;barrier=null}};
const IGN=new Set(['id','created_at','updated_at','created_by','versions','releases','variants','variantOf']);
const stable=v=>{if(v===undefined)return null;if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(stable);const o={};for(const k of Object.keys(v).sort())if(!IGN.has(k))o[k]=stable(v[k]);return o;};
const sha=t=>createHash('sha256').update(String(t)).digest('hex');

// T01 valid candidate, released by an authorized member; authority recorded, nothing auto-signed.
{const {id,v}=await readyStyle('T01');x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v});const c=counts(id);
 ok(x.r.status===201&&x.data.evidenceStatus==='FROZEN_VERIFIED'&&x.data.gate.authority?.releasedBy&&x.data.gate.authority.autoSignoffs===0,'R29-T01 valid frozen candidate released with recorded authority');
 ok(c.releases===1&&c.receipts===1&&c.audits>=1&&c.status==='PRODUCTION_RELEASED','R29-T01 release, receipt, audit and style status committed together');evidence('T01',c);}

// T02 version captured before ROUND29 (no engineering) fails closed; it is never evaluated against live tables.
{const id=await buildReleaseCandidate(call,org,`T02-${++seq}`);seedEngineeringReady(db,id);const v1=JSON.parse(db.prepare('SELECT snapshot_json FROM style_versions WHERE style_id=? AND version_no=1').get(id).snapshot_json);delete v1.engineering;
 db.prepare('INSERT INTO style_versions(id,style_id,version_no,label,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run('ver_legacy_'+id,id,2,'pre-R29 version',JSON.stringify(v1),'fixture',new Date().toISOString());
 db.prepare("UPDATE sample_rounds SET version_no=2 WHERE style_id=? AND id LIKE 'smp_pp_%'").run(id);
 x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:2});ok(x.r.status===409&&x.data.code==='ENGINEERING_NOT_CAPTURED_IN_VERSION'&&counts(id).releases===0,'R29-T02 pre-ROUND29 version without frozen engineering fails closed (live tables are not consulted)');}

// T03 eligibility is not approval: no signoffs are created, handoff stays blocked, JSON identity fields are ignored.
{const {id,v}=await readyStyle('T03');x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v,signoffs:[{roleKey:'QC',decision:'APPROVED'}],approvedBy:'u-qc',actorRole:'WORKSPACE_OWNER',userId:'someone-else'});
 const releaseNo=x.data.releaseNo,row=db.prepare('SELECT created_by,gate_json FROM style_releases WHERE style_id=? AND release_no=?').get(id,releaseNo);
 ok(x.r.status===201&&counts(id).signoffs===0&&x.data.gate.engineering.humanApproval.state==='NOT_GRANTED_BY_THIS_GATE','R29-T03 ELIGIBLE_FOR_MANUAL_RELEASE_REVIEW creates zero signoffs');
 const devId=db.prepare("SELECT id FROM users WHERE email='dev@sehha.local'").get().id,auth=JSON.parse(row.gate_json).authority;
 ok(row.created_by===devId&&auth.releasedBy===devId&&auth.actorRole==='PLATFORM_ADMIN'&&!JSON.stringify(row).includes('someone-else')&&!JSON.stringify(row).includes('u-qc'),'R29-T03 body-supplied identity/role fields are ignored (actor comes from session + DB)');
 x=await call(`/api/styles/${id}/releases/${releaseNo}/handoff`);ok(x.r.status===200&&x.data.ready===false&&x.data.missingSignoffs.length===4,'R29-T03 factory handoff still requires all four human signoffs');
 const sup=await userWith('u_sup_t03',{role:'FACTORY_SUPERVISOR'});x=await call(`/api/styles/${id}/releases/${releaseNo}/signoffs`,{method:'POST',body:{roleKey:'QC',decision:'APPROVED',userId:'u-qc'},cookieOverride:sup});
 ok(x.r.status===403&&counts(id).signoffs===0,'R29-T03 FACTORY_SUPERVISOR cannot self-assert a QC signoff by JSON');}

// T04 same key + same request: original response replayed byte-for-byte, even after business state advanced.
{const {id,v}=await readyStyle('T04');const key='r29-t04-key-0001';const first=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v,note:'n'},{key});const firstText=JSON.stringify(first.data);
 const c1=counts(id);const again=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v,note:'n'},{key});
 ok(first.r.status===201&&again.r.status===201&&again.r.headers.get('idempotency-replayed')==='true'&&JSON.stringify(again.data)===firstText,'R29-T04 lost-response retry returns the original 201 body');
 ok(same(counts(id),c1)&&c1.releases===1&&c1.receipts===1,'R29-T04 retry creates no second release/receipt/audit');
 seedEngineeringReady(db,id);const v2=await newVersion(call,id,'advanced');await rel(id,{releaseType:'SAMPLE',sourceVersionNo:v2});
 const late=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v,note:'n'},{key});ok(late.r.status===201&&JSON.stringify(late.data)===firstText,'R29-T04 replay after the Style advanced still returns the original result');evidence('T04',{before:c1,after:counts(id)});}

// T05 same key + different meaning: deterministic 409 and no writes.
{const {id,v}=await readyStyle('T05');const key='r29-t05-key-0001';await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v,note:'a'},{key});const c1=counts(id);
 x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v,note:'b'},{key});ok(x.r.status===409&&x.data.code==='IDEMPOTENCY_KEY_REUSED'&&!x.data.manifest&&same(counts(id),c1),'R29-T05 same key with altered payload is 409 IDEMPOTENCY_KEY_REUSED without writes');
 const other=await readyStyle('T05b');x=await rel(other.id,{releaseType:'PRODUCTION',sourceVersionNo:other.v},{key});ok(x.r.status===409&&x.data.code==='IDEMPOTENCY_KEY_REUSED'&&counts(other.id).releases===0,'R29-T05 same key against another Style is a conflict, not a disclosure');
 x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key:'bad key!'});ok(x.r.status===400&&x.data.code==='IDEMPOTENCY_KEY_INVALID','R29-T05 malformed Idempotency-Key is 400');}

// T06 concurrency (25 parallel requests each).
{const {id,v}=await readyStyle('T06a');const key='r29-t06-same-key';const rs=await Promise.all(Array.from({length:25},()=>rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key})));const st=rs.map(r=>r.r.status),c=counts(id);
 ok(c.releases===1&&c.receipts===1&&rs.every(r=>r.r.status===201&&r.data.id===rs[0].data.id),'R29-T06 25 concurrent same-key requests: 1 durable release, every caller gets the same result');
 ok(!st.includes(500),'R29-T06 same-key race produces no 500');evidence('T06-same-key',{statuses:st.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{}),replayed:rs.filter(r=>r.r.headers.get('idempotency-replayed')).length,...c});}
{const {id,v}=await readyStyle('T06b');const a0=counts(id).audits;const rs=await Promise.all(Array.from({length:25},(_,i)=>rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key:`r29-t06-diff-${String(i).padStart(3,'0')}`})));const st=rs.map(r=>r.r.status),codes=rs.filter(r=>r.r.status===409).map(r=>r.data.code),c=counts(id);
 ok(st.filter(s=>s===201).length===1&&st.filter(s=>s===409).length===24&&!st.includes(500),'R29-T06 25 concurrent different-key requests: exactly one 201, 24×409, no 500');
 ok(c.releases===1&&c.receipts===1&&c.audits===a0+1&&codes.every(k=>['PRODUCTION_ALREADY_RELEASED','RELEASE_CONFLICT'].includes(k)),'R29-T06 losers leave no release/receipt/audit and get a stable conflict code');evidence('T06-diff-keys',{statuses:st.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{}),codes:codes.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{}),...c});}
{const {id,v}=await readyStyle('T06c');const rs=await Promise.all(Array.from({length:20},(_,i)=>rel(id,{releaseType:'SAMPLE',sourceVersionNo:v,note:`s${i}`},{key:`r29-t06-smp-${String(i).padStart(3,'0')}`})));const st=rs.map(r=>r.r.status),c=counts(id);
 const nos=db.prepare('SELECT release_no FROM style_releases WHERE style_id=? ORDER BY release_no').all(id).map(r=>r.release_no);
 ok(!st.includes(500)&&st.every(s=>s===201||s===409)&&nos.every((n,i)=>n===i+1)&&c.releases===st.filter(s=>s===201).length&&c.receipts===c.releases,'R29-T06 20 concurrent SAMPLE releases: release_no contiguous, no gaps, no 500, receipts = releases');evidence('T06-sample-release-no',{statuses:st.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{}),codes:rs.filter(r=>r.r.status===409).map(r=>r.data.code).reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{}),releaseNos:nos,...c});}

// T06 deterministic race: all 25 requests pass every read/pre-check before any commits, so only the in-transaction guard decides.
{const {id,v}=await readyStyle('T06d');const a0=counts(id).audits;const rs=await withBarrier(25,()=>Promise.all(Array.from({length:25},(_,i)=>rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key:`r29-t06d-${String(i).padStart(3,'0')}`}))));const st=rs.map(r=>r.r.status),codes=rs.filter(r=>r.r.status===409).map(r=>r.data.code),c=counts(id);
 ok(lastArrivals===25&&st.filter(s=>s===201).length===1&&st.filter(s=>s===409).length===24&&!st.includes(500)&&c.releases===1&&c.receipts===1&&c.audits===a0+1,'R29-T06 barrier race (different keys, 25/25 reached the commit batch): guard admits exactly one commit, 24×409, no 500, no extra evidence');
 ok(codes.every(k=>['PRODUCTION_ALREADY_RELEASED','RELEASE_CONFLICT'].includes(k)),'R29-T06 barrier race losers are classified as stable conflicts');evidence('T06-barrier-diff-keys',{statuses:st.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{}),codes:codes.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{}),...c});}
{const {id,v}=await readyStyle('T06e');const key='r29-t06e-same-key';const rs=await withBarrier(25,()=>Promise.all(Array.from({length:25},()=>rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key}))));const st=rs.map(r=>r.r.status),c=counts(id);
 ok(lastArrivals===25&&c.releases===1&&c.receipts===1&&rs.every(r=>r.r.status===201&&r.data.id===rs[0].data.id)&&rs.filter(r=>r.r.headers.get('idempotency-replayed')==='true').length===24,'R29-T06 barrier race (same key, 25/25 reached the commit batch): 1 commit, the 24 guard losers answer with the winner\'s receipt');evidence('T06-barrier-same-key',{statuses:st.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{}),...c});}

// T06 deterministic same-key interleaving (found by CI on workerd D1): B looks up the receipt (none), then the original
// request A commits, then B reaches its pre-checks. B must replay A's result, not report a conflict.
{const {id,v}=await readyStyle('T06f');const key='r29-t06f-interleave';const body={releaseType:'PRODUCTION',sourceVersionNo:v};let a=null;
 const realPrepare=env.DB.prepare.bind(env.DB);let armed=true;
 env.DB.prepare=sql=>{const st=realPrepare(sql);if(armed&&/^SELECT 1 x FROM style_releases WHERE style_id=\? AND release_type='PRODUCTION'/.test(sql)){armed=false;return {bind:(...args)=>{const bound=st.bind(...args);return {...bound,first:async()=>{a=await rel(id,body,{key});return bound.first();}}}}}return st;};
 let b;try{b=await rel(id,body,{key})}finally{env.DB.prepare=realPrepare}
 evidence('T06-interleave',{a:a?.r.status,b:b.r.status,bCode:b.data.code||null,...counts(id)});
 ok(a?.r.status===201&&b.r.status===201&&b.data.id===a.data.id&&b.r.headers.get('idempotency-replayed')==='true'&&counts(id).releases===1,'R29-T06 same-key request overtaken by the original between receipt lookup and pre-check replays the original (no 409)');}

// T07 failure injection at every mandatory statement: zero partial writes, zero receipt, no SQL leakage, clean retry.
for(const [label,ddl] of [['style_releases INSERT',"CREATE TRIGGER inj BEFORE INSERT ON style_releases BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END"],['release_receipts INSERT',"CREATE TRIGGER inj BEFORE INSERT ON release_receipts BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END"],['styles UPDATE',"CREATE TRIGGER inj BEFORE UPDATE OF status ON styles WHEN NEW.status='PRODUCTION_RELEASED' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END"],['audit_log INSERT',"CREATE TRIGGER inj BEFORE INSERT ON audit_log WHEN NEW.entity_type='RELEASE' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END"]]){
 const {id,v}=await readyStyle('T07');const key=`r29-t07-${label.replace(/\W/g,'')}`;const before=counts(id);db.exec(ddl);
 x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key});db.exec('DROP TRIGGER inj');const after=counts(id),text=JSON.stringify(x.data);
 ok(x.r.status===500&&x.data.code==='RELEASE_COMMIT_FAILED'&&/^err_/.test(x.data.correlationId)&&!/INJECTED|SQLITE|constraint|INSERT|UPDATE/i.test(text),`R29-T07 failure at ${label}: 500 with correlation id, no SQL internals`);
 ok(same(before,after),`R29-T07 failure at ${label}: zero partial business changes and zero receipt`);
 x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key});ok(x.r.status===201&&counts(id).receipts===1,`R29-T07 failure at ${label}: same-key retry commits once afterwards`);evidence('T07',{injectedAt:label,before,after,afterRetry:counts(id)});}

// T08 drift between evaluation and commit fails closed with 409 and no writes.
for(const [label,mutate,code] of [
  ['new Style Version created',id=>db.prepare("INSERT INTO style_versions(id,style_id,version_no,label,snapshot_json,created_by,created_at) VALUES(?,?,(SELECT MAX(version_no)+1 FROM style_versions WHERE style_id=?),'race','{}','race',?)").run('ver_race_'+id,id,id,new Date().toISOString()),'STALE_CANDIDATE'],
  ['PP sample approval revoked',id=>db.prepare("UPDATE sample_rounds SET status='DRAFT',updated_at=? WHERE style_id=? AND sample_type='PP'").run(new Date(Date.now()+1000).toISOString(),id),'STALE_CANDIDATE'],
  ['cost line added',id=>db.prepare("INSERT INTO cost_lines(id,cost_sheet_id,description,qty,unit,unit_cost,line_total,created_by,updated_by,created_at,updated_at) SELECT 'cl_race_'||id,id,'race',1,'m',1,1,'race','race',?,? FROM cost_sheets WHERE style_id=? LIMIT 1").run(new Date().toISOString(),new Date().toISOString(),id),'STALE_CANDIDATE'],
  ['competing release committed',id=>db.prepare("INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,(SELECT COALESCE(MAX(release_no),0)+1 FROM style_releases WHERE style_id=?),'SAMPLE','RELEASED',1,'mohsen_nexz_20p','{}','{}','{}','race',?)").run('rel_race_'+id,id,id,new Date().toISOString()),'RELEASE_CONFLICT']]){
 const {id,v}=await readyStyle('T08');const before=counts(id);beforeCommit=()=>mutate(id);x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key:`r29-t08-${label.replace(/\W/g,'')}`});const after=counts(id);
 const extra=label==='competing release committed'?1:0;
 ok(x.r.status===409&&x.data.code===code&&after.receipts===before.receipts&&after.releases===before.releases+extra&&after.status===before.status,`R29-T08 ${label} during commit window: 409 ${code}, no release/receipt/status change`);evidence('T08',{drift:label,code:x.data.code,before,after});}
{const {id}=await readyStyle('T08b');seedEngineeringReady(db,id);const v2=await newVersion(call,id,'newer');x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v2});ok(x.r.status===201&&x.data.gate.engineering.sourceVersionNo===v2&&x.data.gate.engineering.candidateSha256,'R29-T08 the newer version is evaluated afresh and frozen with its own candidate hash');}

// T09 authorization and tenancy, including drift inside the commit window.
{const {id,v}=await readyStyle('T09');const key='r29-t09-victim-key';
 const outsider=await userWith('u_out_t09',{role:'WORKSPACE_OWNER',orgId:(db.prepare("INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES('org_t09','T09','T09 Org','{}',?) RETURNING id").get(new Date().toISOString())).id});
 x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key,cookie:outsider});ok(x.r.status===403&&counts(id).releases===0,'R29-T09 direct style-id attack from another tenant is 403');
 const member=await userWith('u_mem_t09',{role:'DESIGN_PATTERN_MASTER'});const r1=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key});
 x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{key,cookie:member});ok(r1.r.status===201&&x.r.status===409&&x.data.code==='PRODUCTION_ALREADY_RELEASED'&&!x.data.receiptId&&!x.data.manifest,'R29-T09 another actor reusing the same key never receives the original response');
 db.prepare("UPDATE users SET active=0 WHERE id='u_mem_t09'").run();const s2=await readyStyle('T09c');x=await rel(s2.id,{releaseType:'PRODUCTION',sourceVersionNo:s2.v},{cookie:member});ok(x.r.status===403&&x.data.code==='FORBIDDEN_ACTOR'&&counts(s2.id).releases===0,'R29-T09 deactivated user with a still-valid session cookie is refused');}
{const actor=await userWith('u_act_t09',{role:'DESIGN_PATTERN_MASTER'});const key='r29-t09-replay-revoked';const s=await readyStyle('T09d');x=await rel(s.id,{releaseType:'PRODUCTION',sourceVersionNo:s.v},{key,cookie:actor});
 db.prepare("DELETE FROM memberships WHERE user_id='u_act_t09'").run();const y=await rel(s.id,{releaseType:'PRODUCTION',sourceVersionNo:s.v},{key,cookie:actor});ok(x.r.status===201&&y.r.status===403&&!y.data.manifest,'R29-T09 replay after membership revocation discloses nothing (403)');}
for(const [label,setup,mutate,code,status] of [
  ['membership removed',async()=>{const u='u_rm_'+(++seq);return {cookie:await userWith(u,{role:'DESIGN_PATTERN_MASTER'}),uid:u}},uid=>db.prepare('DELETE FROM memberships WHERE user_id=?').run(uid),'FORBIDDEN_ACTOR',403],
  ['user deactivated',async()=>{const u='u_da_'+(++seq);return {cookie:await userWith(u,{role:'DESIGN_PATTERN_MASTER'}),uid:u}},uid=>db.prepare('UPDATE users SET active=0 WHERE id=?').run(uid),'FORBIDDEN_ACTOR',403],
  ['platform admin flag revoked (no membership)',async()=>{const u='u_pa_'+(++seq);return {cookie:await userWith(u,{admin:1}),uid:u}},uid=>db.prepare('UPDATE users SET is_platform_admin=0 WHERE id=?').run(uid),'FORBIDDEN_ACTOR',403],
  ['RELEASES entitlement disabled',async()=>({cookie:undefined,uid:null}),()=>db.prepare("UPDATE entitlements SET enabled=0 WHERE org_id=? AND feature_key='RELEASES'").run(org.id),'FEATURE_NOT_LICENSED',403]]){
 const {cookie,uid}=await setup();const {id,v}=await readyStyle('T09e');const before=counts(id);
 beforeCommit=()=>mutate(uid);x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},{cookie});const after=counts(id);
 if(label.startsWith('RELEASES'))db.prepare("UPDATE entitlements SET enabled=1 WHERE org_id=? AND feature_key='RELEASES'").run(org.id);
 ok(x.r.status===status&&x.data.code===code&&same(before,after),`R29-T09 ${label} inside the commit window: ${status} ${code}, zero writes`);evidence('T09-drift',{drift:label,code:x.data.code,before,after});}

// T11 frozen snapshot integrity: re-hash, backup/restore, tamper resistance and tamper detection.
{const {id,v}=await readyStyle('T11');x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v});const releaseNo=x.data.releaseNo,man=x.data.manifest;
 const row=()=>db.prepare('SELECT * FROM style_releases WHERE style_id=? AND release_no=?').get(id,releaseNo);const r0=row();
 ok(sha(JSON.stringify(stable(JSON.parse(r0.snapshot_json))))===man.snapshotSha256,'R29-T11 stored snapshot re-hashes to manifest.snapshotSha256');
 ok(sha(db.prepare('SELECT snapshot_json FROM style_versions WHERE style_id=? AND version_no=?').get(id,v).snapshot_json)===r0.candidate_sha256&&JSON.parse(r0.gate_json).engineering.candidateSha256===r0.candidate_sha256,'R29-T11 candidate_sha256 reproduces from the frozen Style Version');
 const out0=(await call(`/api/styles/${id}/releases/${releaseNo}/output?profile=mohsen_techpack`)).data;
 await call(`/api/styles/${id}`,{method:'PATCH',body:{name:'Renamed after release'}});db.prepare("UPDATE measurements SET value=99 WHERE style_id=?").run(id);
 const out1=(await call(`/api/styles/${id}/releases/${releaseNo}/output?profile=mohsen_techpack`)).data;
 ok(typeof out0==='string'&&out0.replace(/Generated<\/th><td>[^<]*/g,'')===out1.replace(/Generated<\/th><td>[^<]*/g,'')&&!out1.includes('Renamed after release'),'R29-T11 frozen output unchanged after Working Style edits');
 let blocked=0;for(const sql of ["UPDATE style_releases SET snapshot_json='{}' WHERE id=?","UPDATE style_releases SET gate_json='{}' WHERE id=?","DELETE FROM style_releases WHERE id=?","UPDATE release_receipts SET response_json='{}' WHERE release_id=?","DELETE FROM release_receipts WHERE release_id=?"]){try{db.prepare(sql).run(r0.id)}catch(e){if(/IMMUTABLE/.test(e.message))blocked++}}
 try{db.prepare("UPDATE style_versions SET snapshot_json='{}' WHERE style_id=? AND version_no=?").run(id,v)}catch(e){if(/STYLE_VERSION_IMMUTABLE/.test(e.message))blocked++}
 ok(blocked===6&&same(row(),r0),'R29-T11 database triggers block UPDATE/DELETE of contract releases, receipts and frozen versions');
 const backup=JSON.parse(JSON.stringify({rel:r0,rcp:db.prepare('SELECT * FROM release_receipts WHERE release_id=?').get(r0.id)}));
 const fresh=new DatabaseSync(':memory:');for(const f of readdirSync(resolve(root,'migrations')).filter(f=>f.endsWith('.sql')).sort())fresh.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
 const ins=(t,o)=>fresh.prepare(`INSERT INTO ${t}(${Object.keys(o).join(',')}) VALUES(${Object.keys(o).map(()=>'?').join(',')})`).run(...Object.values(o));ins('style_releases',backup.rel);ins('release_receipts',backup.rcp);
 const restored=fresh.prepare('SELECT * FROM style_releases WHERE id=?').get(r0.id);
 ok(same(restored,r0)&&sha(JSON.stringify(stable(JSON.parse(restored.snapshot_json))))===man.snapshotSha256,'R29-T11 backup/restore into a fresh schema-22 database preserves bytes and hash');
 fresh.exec('DROP TRIGGER trg_style_releases_contract_immutable');fresh.prepare("UPDATE style_releases SET snapshot_json=replace(snapshot_json,'\"value\":57','\"value\":58') WHERE id=?").run(r0.id);
 ok(sha(JSON.stringify(stable(JSON.parse(fresh.prepare('SELECT snapshot_json FROM style_releases WHERE id=?').get(r0.id).snapshot_json))))!==man.snapshotSha256,'R29-T11 a tamper that bypasses triggers is detected by hash mismatch');}

// T12 legacy PRODUCTION releases stay readable as unverified; nothing is synthesized; they still block a second release.
{const id=await buildReleaseCandidate(call,org,`T12-${++seq}`);const ts=new Date().toISOString();
 db.prepare("INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,1,'PRODUCTION','RELEASED',1,'mohsen_nexz_20p','{\"ready\":true}','{}','{\"style\":{}}','legacy',?)").run('rel_legacy_'+id,id,ts);
 db.prepare("INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,2,'PRODUCTION','RELEASED',1,'mohsen_nexz_20p','{}','{}',?,'r28',?)").run('rel_r28_'+id,id,JSON.stringify({engineeringReadiness:{basis:'LIVE_ENGINEERING_RECORDS'}}),ts);
 const raw0=db.prepare('SELECT * FROM style_releases WHERE style_id=? ORDER BY release_no').all(id);
 x=await call(`/api/styles/${id}/releases`);const byNo=Object.fromEntries(x.data.items.map(i=>[i.release_no,i.evidenceStatus]));
 ok(byNo[1]==='LEGACY_UNVERIFIED'&&byNo[2]==='LIVE_UNVERSIONED_R28','R29-T12 legacy and ROUND28 releases are labelled LEGACY_UNVERIFIED / LIVE_UNVERSIONED_R28');
 const m=await call(`/api/styles/${id}/releases/1/manifest`),hd=await call(`/api/styles/${id}/releases/1/handoff`);
 ok(m.data.evidenceStatus==='LEGACY_UNVERIFIED'&&hd.data.evidenceStatus==='LEGACY_UNVERIFIED'&&hd.data.ready===false,'R29-T12 manifest and handoff expose the unverified state; handoff is not ready');
 ok(same(db.prepare('SELECT * FROM style_releases WHERE style_id=? ORDER BY release_no').all(id),raw0)&&counts(id).signoffs===0,'R29-T12 reads never mutate legacy rows or synthesize signoffs');
 seedEngineeringReady(db,id,{skip:['pp']});x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:1});ok(x.r.status===409&&x.data.code==='PRODUCTION_ALREADY_RELEASED','R29-T12 a legacy PRODUCTION release still blocks a duplicate release of the same version');}

// T13 SAMPLE releases and unrelated routes remain backward compatible.
{const {id,v}=await readyStyle('T13');const a=await rel(id,{releaseType:'SAMPLE',sourceVersionNo:v}),b=await rel(id,{releaseType:'SAMPLE'});
 ok(a.r.status===201&&b.r.status===201&&b.data.releaseNo===a.data.releaseNo+1&&a.data.evidenceStatus==='NOT_APPLICABLE'&&a.data.gate&&a.data.manifest?.manifestSha256,'R29-T13 SAMPLE releases (with and without source version) keep the existing contract');
 ok(counts(id).receipts===2&&db.prepare('SELECT COUNT(*) n FROM release_receipts WHERE style_id=? AND idempotency_key IS NULL').get(id).n===2,'R29-T13 key-less releases still get an immutable receipt');
 x=await call(`/api/styles/${id}/release-gate?type=PRODUCTION`);ok(x.r.status===200&&typeof x.data.ready==='boolean','R29-T13 release-gate read route unchanged');}

// T14 downstream transitions cannot borrow Production authority by number/name.
{const {id,v}=await readyStyle('T14');const s=await rel(id,{releaseType:'SAMPLE',sourceVersionNo:v});
 x=await call(`/api/styles/${id}/production-lots`,{method:'POST',body:{releaseNo:s.data.releaseNo,lotCode:'LOT-T14',plannedQty:10}});ok(x.r.status===409&&db.prepare('SELECT COUNT(*) n FROM production_lots WHERE style_id=?').get(id).n===0,'R29-T14 a SAMPLE release number cannot open a Production Lot');
 const other=await readyStyle('T14b');const p=await rel(other.id,{releaseType:'PRODUCTION',sourceVersionNo:other.v});
 x=await call(`/api/styles/${id}/production-lots`,{method:'POST',body:{releaseNo:p.data.releaseNo,releaseId:p.data.id,lotCode:'LOT-T14B',plannedQty:10}});ok(x.r.status===409,'R29-T14 another Style\'s PRODUCTION release id/number cannot open a lot here');
 x=await call(`/api/styles/${id}/releases/${s.data.releaseNo}/handoff`);ok(x.r.status===200&&x.data.ready===false&&x.data.releaseType==='SAMPLE','R29-T14 a SAMPLE release can never be factory-handoff ready');
 x=await call(`/api/styles/${id}/releases/999/signoffs`,{method:'POST',body:{roleKey:'DESIGN'}});ok(x.r.status===404,'R29-T14 signoff on a non-existent release is 404');}

// T15 migrations: fresh install, upgrade from baseline with historical duplicates, failed repeat leaves data intact.
{const files=readdirSync(resolve(root,'migrations')).filter(f=>f.endsWith('.sql')).sort(),base=files.filter(f=>f<'0020'),m20=readFileSync(resolve(root,'migrations','0020_release_atomicity.sql'),'utf8');
 const fresh=new DatabaseSync(':memory:');for(const f of files)fresh.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
 const names=fresh.prepare("SELECT type,name FROM sqlite_master WHERE name IN ('release_receipts','uq_style_releases_production_candidate','trg_style_releases_contract_immutable','trg_style_releases_contract_no_delete','trg_release_receipts_immutable','trg_release_receipts_no_delete','trg_style_versions_snapshot_immutable')").all();
 ok(fresh.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value==='22'&&names.length===7,'R29-T15 fresh install reaches schema 22 with table, partial unique index and 5 triggers');
 const old=new DatabaseSync(':memory:');for(const f of base)old.exec(readFileSync(resolve(root,'migrations',f),'utf8'));const ts=new Date().toISOString();
 for(const n of [1,2])old.prepare("INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,?,'PRODUCTION','RELEASED',1,'t','{}','{}','{}','u',?)").run('legacy'+n,'sty_old',n,ts);
 const before=old.prepare('SELECT * FROM style_releases ORDER BY id').all();old.exec(m20);const after=old.prepare('SELECT id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,note,created_by,created_at FROM style_releases ORDER BY id').all();
 ok(old.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value==='22'&&same(before,after)&&old.prepare('SELECT COUNT(*) n FROM style_releases WHERE evidence_contract IS NULL').get().n===2,'R29-T15 upgrade 21→22 succeeds over historical duplicate PRODUCTION releases without touching them');
 old.prepare("UPDATE style_releases SET note='legacy rows remain maintainable' WHERE id='legacy1'").run();
 let repeatErr='';try{old.exec(m20)}catch(e){repeatErr=e.message}
 ok(/duplicate column/i.test(repeatErr)&&old.prepare('SELECT COUNT(*) n FROM style_releases').get().n===2&&old.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value==='22','R29-T15 a raw repeat of 0020 fails at its first ALTER without damaging data (wrangler records applied migrations)');}
