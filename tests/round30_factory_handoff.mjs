// ROUND30 adversarial suite: frozen Factory Handoff + four-authority boundary + P1 hardening.
// Real worker HTTP handler + real SQLite engine through the D1 adapter (batch() = BEGIN/COMMIT/ROLLBACK, as D1 documents).
// Failure injection uses real SQLite triggers. Assertion names carry matrix ids (R30-Txx).
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {makeHarness,ok,seedEngineeringReady,root} from './test_helpers.mjs';
import {buildReleaseCandidate,newVersion,addHandoffEvidence} from './release_fixture.mjs';
import worker from '../src/worker.js';
const h=makeHarness(),{call,db,env}=h;await h.login();
let x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN');
const evidence=(scenario,data)=>console.log('EVIDENCE '+JSON.stringify({scenario,...data}));
const sha=t=>createHash('sha256').update(String(t)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const tally=a=>a.reduce((o,s)=>(o[s]=(o[s]||0)+1,o),{});
let seq=0;const ts0=new Date().toISOString();
// Commit-window hook + barrier around the D1 batch (runs after every evaluation read of the request).
const realBatch=env.DB.batch.bind(env.DB);let beforeCommit=null,barrier=null,lastArrivals=0;
env.DB.batch=async list=>{if(barrier){barrier.arrived++;if(barrier.arrived===barrier.n)barrier.open();await barrier.gate;}const f=beforeCommit;beforeCommit=null;if(f)f();return realBatch(list);};
const withBarrier=async(n,fn)=>{let open;barrier={n,arrived:0,gate:new Promise(r=>open=r)};barrier.open=open;try{return await fn()}finally{lastArrivals=barrier.arrived;barrier=null}};
// Users: real logins with real memberships (roles that exist in the modern product).
const devHash=db.prepare("SELECT password_hash,password_salt FROM users WHERE email='dev@sehha.local'").get(),devId=db.prepare("SELECT id FROM users WHERE email='dev@sehha.local'").get().id;
async function user(idv,role,orgId=org.id){db.prepare('INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)').run(idv,`${idv}@r30.local`,idv,devHash.password_hash,devHash.password_salt,ts0);if(role)db.prepare('INSERT INTO memberships(user_id,org_id,role) VALUES(?,?,?)').run(idv,orgId,role);
  const r=await call('/api/auth/login',{method:'POST',body:{email:`${idv}@r30.local`,password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});if(r.r.status!==200)throw new Error('login '+idv);return (r.r.headers.get('set-cookie')||'').split(';')[0];}
const otherOrg=db.prepare("INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES('org_r30_other','R30X','Other R30','{}',?) RETURNING id").get(ts0).id;
const U={rm:await user('u_rm','RELEASE_MANAGER'),eng:await user('u_eng','DESIGN_PATTERN_MASTER'),prod:await user('u_prod','FACTORY_SUPERVISOR'),qc:await user('u_qc','QC_MANAGER'),fs:await user('u_fs','FACTORY_SUPERVISOR'),op:await user('u_op','OPERATOR'),store:await user('u_store','STORE_CLERK'),outsider:await user('u_out','WORKSPACE_OWNER',otherOrg),dev:h.cookie};
const req=(path,{method='POST',body,cookie,key}={})=>call(path,{method,body:body===undefined&&method==='POST'?{}:body,cookieOverride:cookie,headers:key?{'idempotency-key':key}:{}});
const relApi=(id,body,cookie,key)=>req(`/api/styles/${id}/releases`,{body,cookie,key});
const prepare=(id,n,cookie=U.rm,key)=>req(`/api/styles/${id}/releases/${n}/handoffs`,{cookie,key});
const act=(id,hid,action,body={},cookie,key)=>req(`/api/styles/${id}/handoffs/${hid}/${action}`,{body,cookie,key});
const pkg=(id,hid,cookie=U.rm,q='')=>call(`/api/styles/${id}/handoffs/${hid}/package${q}`,{cookieOverride:cookie});
const counts=id=>({handoffs:db.prepare('SELECT COUNT(*) n FROM factory_handoffs WHERE style_id=?').get(id).n,events:db.prepare('SELECT COUNT(*) n FROM factory_handoff_events e JOIN factory_handoffs h ON h.id=e.handoff_id WHERE h.style_id=?').get(id).n,receipts:db.prepare('SELECT COUNT(*) n FROM handoff_receipts r JOIN factory_handoffs h ON h.id=r.handoff_id WHERE h.style_id=?').get(id).n,audits:db.prepare("SELECT COUNT(*) n FROM audit_log WHERE entity_type='FACTORY_HANDOFF' AND entity_id IN (SELECT id FROM factory_handoffs WHERE style_id=?)").get(id).n,states:db.prepare('SELECT status FROM factory_handoffs WHERE style_id=? ORDER BY created_at,rowid').all(id).map(r=>r.status).join(',')});
async function signAll(id,n){for(const [roleKey,cookie] of [['DESIGN',U.eng],['PATTERN',U.eng],['PRODUCTION',U.prod],['QC',U.qc]]){const r=await req(`/api/styles/${id}/releases/${n}/signoffs`,{body:{roleKey,decision:'APPROVED'},cookie});if(r.r.status!==200)throw new Error(`fixture signoff ${roleKey} ${r.r.status} ${JSON.stringify(r.data)}`);}}
async function releasedStyle(prefix,{sign=true}={}){const id=await buildReleaseCandidate(call,org,`${prefix}-${++seq}`);addHandoffEvidence(db,id);seedEngineeringReady(db,id);const v=await newVersion(call,id,'R30 candidate');
  const r=await relApi(id,{releaseType:'PRODUCTION',sourceVersionNo:v},U.rm);if(r.r.status!==201)throw new Error('fixture release '+JSON.stringify(r.data));if(sign)await signAll(id,r.data.releaseNo);return {id,n:r.data.releaseNo,v};}
async function newerRelease(id){seedEngineeringReady(db,id);const v=await newVersion(call,id,'R30 newer');const r=await relApi(id,{releaseType:'PRODUCTION',sourceVersionNo:v},U.rm);if(r.r.status!==201)throw new Error('fixture newer release');return r.data.releaseNo;}
async function acked(prefix){const s=await releasedStyle(prefix);const p=await prepare(s.id,s.n);await act(s.id,p.data.id,'dispatch',{},U.rm);await act(s.id,p.data.id,'acknowledge',{note:'received complete'},U.fs);return {...s,hid:p.data.id};}

// T01 latest approved frozen release -> prepare -> dispatch -> acknowledge -> lot.
{const s=await releasedStyle('T01');x=await call(`/api/styles/${s.id}/releases/${s.n}/handoff`);ok(x.data.ready===true&&x.data.independence.ok===true&&x.data.evidenceStatus==='FROZEN_VERIFIED','R30-T01 computed handoff summary is READY with independent signoffs and frozen evidence');
 const p=await prepare(s.id,s.n);ok(p.r.status===201&&p.data.status==='PREPARED'&&p.data.version===1&&/^[0-9a-f]{64}$/.test(p.data.packageSha256),'R30-T01 RELEASE_MANAGER prepares a frozen package from the latest frozen release');
 const d=await act(s.id,p.data.id,'dispatch',{expectedVersion:1},U.rm);ok(d.r.status===200&&d.data.status==='HANDED_OFF'&&d.data.version===2,'R30-T01 dispatch PREPARED -> HANDED_OFF');
 const a=await act(s.id,p.data.id,'acknowledge',{note:'Received complete package'},U.fs);ok(a.r.status===200&&a.data.status==='ACKNOWLEDGED'&&a.data.version===3,'R30-T01 factory supervisor acknowledges HANDED_OFF -> ACKNOWLEDGED');
 const c=counts(s.id);ok(c.handoffs===1&&c.events===3&&c.receipts===3&&c.audits===3,'R30-T01 three commands -> exactly three events, receipts and audit rows');
 const g=await pkg(s.id,p.data.id),raw=JSON.stringify(g.data),row=db.prepare('SELECT package_json,package_sha256 FROM factory_handoffs WHERE id=?').get(p.data.id);
 ok(g.r.status===200&&g.r.headers.get('etag')===`"${row.package_sha256}"`&&sha(row.package_json)===row.package_sha256&&g.data.signoffs.length===4&&g.data.release.snapshotSha256&&g.data.operationalHoldCheck==='BLOCKED_NO_HOLD_MODEL','R30-T01 package served with ETag = SHA-256 of the frozen bytes, 4 frozen signoffs, release hashes, HOLD gap explicit');
 const nm=await call(`/api/styles/${s.id}/handoffs/${p.data.id}/package`,{cookieOverride:U.rm,headers:{'if-none-match':`"${row.package_sha256}"`}});ok(nm.r.status===304,'R30-T01 If-None-Match with the package hash returns 304');
 const html=await pkg(s.id,p.data.id,U.rm,'?format=html');ok(html.r.status===200&&/dir="rtl"/.test(html.data)&&html.data.includes(row.package_sha256)&&html.data.includes('ليس توقيع جودة'),'R30-T01 Arabic RTL HTML rendering of the frozen package carries its hash and the ACK-is-not-QC notice');
 const lot=await req(`/api/styles/${s.id}/production-lots`,{body:{releaseNo:s.n,lotCode:'LOT-R30-T01',plannedQty:10},cookie:U.fs});ok(lot.r.status===201&&db.prepare('SELECT handoff_id FROM production_lots WHERE id=?').get(lot.data.lot.id).handoff_id===p.data.id,'R30-T01 acknowledged handoff seeds a Production Lot with handoff provenance');
 evidence('T01',{...c,packageSha256:row.package_sha256});}

// T02 legacy release (no frozen evidence): no new handoff, no new lot; historical facts preserved and flagged.
{const id=await buildReleaseCandidate(call,org,`T02-${++seq}`);db.prepare("INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,1,'PRODUCTION','RELEASED',1,'mohsen_nexz_20p','{\"ready\":true}','{}','{\"style\":{}}','legacy',?)").run('rel_legacy30_'+id,id,ts0);
 db.prepare("INSERT INTO production_lots(id,style_id,release_no,lot_code,planned_qty,status,planning_basis_json,planning_basis_sha256,created_by,created_at,updated_at) VALUES(?,?,1,'LEGACY-LOT',50,'OPEN','{}','x','legacy',?,?)").run('lot_legacy30_'+id,id,ts0,ts0);
 const before=db.prepare('SELECT * FROM style_releases WHERE style_id=?').all(id),lotBefore=db.prepare('SELECT * FROM production_lots WHERE style_id=?').all(id);
 x=await prepare(id,1);ok(x.r.status===409&&x.data.code==='LEGACY_RELEASE_NOT_ELIGIBLE'&&counts(id).handoffs===0,'R30-T02 legacy PRODUCTION release cannot be prepared for handoff');
 x=await req(`/api/styles/${id}/production-lots`,{body:{releaseNo:1,lotCode:'NEW-FROM-LEGACY',plannedQty:5},cookie:U.fs});ok(x.r.status===409&&x.data.code==='LEGACY_RELEASE_NOT_ELIGIBLE','R30-T02 legacy release cannot open a new Production Lot');
 x=await call(`/api/styles/${id}/production-lots`);const lg=x.data.items.find(l=>l.id==='lot_legacy30_'+id);
 ok(lg&&lg.authorityReview==='LEGACY_RELEASE_REVIEW_REQUIRED'&&lg.releaseEvidenceStatus==='LEGACY_UNVERIFIED','R30-T02 existing legacy lot stays readable and is flagged for separate review');
 ok(same(db.prepare('SELECT * FROM style_releases WHERE style_id=?').all(id),before)&&same(db.prepare('SELECT * FROM production_lots WHERE style_id=?').all(id),lotBefore),'R30-T02 legacy release and lot rows are byte-identical (no backfill, no deletion)');}

// T03 pre-dispatch withdrawal only, with reason; frozen package unchanged; history kept.
{const s=await releasedStyle('T03');const p=await prepare(s.id,s.n),row0=db.prepare('SELECT package_json,package_sha256 FROM factory_handoffs WHERE id=?').get(p.data.id);
 x=await act(s.id,p.data.id,'withdraw',{reason:'no'},U.rm);ok(x.r.status===422&&x.data.code==='REASON_REQUIRED','R30-T03 withdrawal without a real reason is 422');
 x=await act(s.id,p.data.id,'withdraw',{reason:'Wrong size range in package'},U.rm);ok(x.r.status===200&&x.data.status==='WITHDRAWN','R30-T03 PREPARED -> WITHDRAWN with reason');
 const row1=db.prepare('SELECT package_json,package_sha256,withdraw_reason FROM factory_handoffs WHERE id=?').get(p.data.id);ok(row1.package_sha256===row0.package_sha256&&row1.package_json===row0.package_json&&row1.withdraw_reason==='Wrong size range in package','R30-T03 withdrawn package bytes and hash unchanged, reason recorded');
 x=await act(s.id,p.data.id,'dispatch',{},U.rm);ok(x.r.status===409&&x.data.code==='INVALID_STATE','R30-T03 a withdrawn package cannot be dispatched');
 const p2=await prepare(s.id,s.n);ok(p2.r.status===201&&p2.data.id!==p.data.id,'R30-T03 a new package can be prepared after withdrawal (old one kept)');
 await act(s.id,p2.data.id,'dispatch',{},U.rm);x=await act(s.id,p2.data.id,'withdraw',{reason:'Too late to withdraw'},U.rm);ok(x.r.status===409&&x.data.code==='INVALID_STATE','R30-T03 withdrawal after dispatch is refused');
 let delErr='';try{db.prepare('DELETE FROM factory_handoffs WHERE id=?').run(p.data.id)}catch(e){delErr=e.message}ok(/HANDOFF_HISTORY_IMMUTABLE/.test(delErr)&&counts(s.id).handoffs===2,'R30-T03 no hard delete of handoff history');}

// T04 supersession: undelivered package on an old release cannot be dispatched/prepared; acknowledged old package stays hash-stable.
{const s=await releasedStyle('T04');const p=await prepare(s.id,s.n);const n2=await newerRelease(s.id);
 x=await act(s.id,p.data.id,'dispatch',{},U.rm);ok(x.r.status===409&&x.data.code==='RELEASE_SUPERSEDED'&&x.data.latestReleaseNo===n2,'R30-T04 dispatch of a PREPARED package on a superseded release is refused');
 x=await act(s.id,p.data.id,'withdraw',{reason:'Superseded by newer release'},U.rm);x=await prepare(s.id,s.n);ok(x.r.status===409&&x.data.code==='RELEASE_SUPERSEDED','R30-T04 preparing a package for a superseded release is refused');
 x=await call(`/api/styles/${s.id}/handoffs`,{cookieOverride:U.rm});ok(x.data.items.every(i=>i.superseded===true)&&x.data.items.every(i=>i.package_json===undefined),'R30-T04 handoff list marks superseded packages and never returns package bytes');}
{const s=await acked('T04b');const before=db.prepare('SELECT * FROM factory_handoffs WHERE id=?').get(s.hid),g0=await pkg(s.id,s.hid);await newerRelease(s.id);const g1=await pkg(s.id,s.hid);
 ok(g1.r.status===200&&JSON.stringify(g1.data)===JSON.stringify(g0.data)&&g1.r.headers.get('etag')===g0.r.headers.get('etag')&&same(db.prepare('SELECT * FROM factory_handoffs WHERE id=?').get(s.hid),before),'R30-T04 acknowledged package of an older release stays readable and hash-stable after a newer release');}

// T05 lost-response replay for each command: original body, no duplicate evidence.
{const s=await releasedStyle('T05');const kP='r30-t05-prepare',kD='r30-t05-dispatch',kA='r30-t05-ack';
 const p1=await prepare(s.id,s.n,U.rm,kP),c1=counts(s.id),p2=await prepare(s.id,s.n,U.rm,kP);ok(p2.r.status===201&&p2.r.headers.get('idempotency-replayed')==='true'&&same(p1.data,p2.data)&&same(counts(s.id),c1),'R30-T05 prepare replay returns the original 201 body with no new rows');
 const d1=await act(s.id,p1.data.id,'dispatch',{},U.rm,kD),c2=counts(s.id),d2=await act(s.id,p1.data.id,'dispatch',{},U.rm,kD);ok(d2.r.status===200&&d2.r.headers.get('idempotency-replayed')==='true'&&same(d1.data,d2.data)&&same(counts(s.id),c2),'R30-T05 dispatch replay after the state advanced returns the original body');
 const a1=await act(s.id,p1.data.id,'acknowledge',{note:'ok'},U.fs,kA),c3=counts(s.id),a2=await act(s.id,p1.data.id,'acknowledge',{note:'ok'},U.fs,kA);ok(a2.r.status===200&&same(a1.data,a2.data)&&same(counts(s.id),c3)&&c3.events===3&&c3.receipts===3,'R30-T05 acknowledge replay: 3 events / 3 receipts total');
 const s2=await releasedStyle('T05w');const pw=await prepare(s2.id,s2.n),kW='r30-t05-withdraw',w1=await act(s2.id,pw.data.id,'withdraw',{reason:'Package needs correction'},U.rm,kW),c4=counts(s2.id),w2=await act(s2.id,pw.data.id,'withdraw',{reason:'Package needs correction'},U.rm,kW);
 ok(w2.r.status===200&&same(w1.data,w2.data)&&same(counts(s2.id),c4),'R30-T05 withdraw replay returns the original body with no new rows');evidence('T05',{prepareDispatchAck:c3,withdraw:c4});}

// T06 same key / different intent; key cross-talk across actors and tenants.
{const s=await releasedStyle('T06');const p=await prepare(s.id,s.n,U.rm,'r30-t06-key-0001');
 x=await act(s.id,p.data.id,'withdraw',{reason:'Reason number one'},U.rm,'r30-t06-key-w');const c=counts(s.id);
 x=await act(s.id,p.data.id,'withdraw',{reason:'A different reason'},U.rm,'r30-t06-key-w');ok(x.r.status===409&&x.data.code==='IDEMPOTENCY_KEY_REUSED'&&same(counts(s.id),c),'R30-T06 same key with a different withdrawal reason is 409 with no writes');
 x=await prepare(s.id,s.n,U.dev,'r30-t06-key-0001');ok(x.r.status===201&&x.data.id!==p.data.id&&x.r.headers.get('idempotency-replayed')===null,'R30-T06 another actor reusing a key gets their own command, never the original response');
 x=await prepare(s.id,s.n,U.outsider,'r30-t06-key-0001');ok(x.r.status===403&&!x.data.packageSha256,'R30-T06 a foreign-tenant actor reusing the key is refused with no disclosure');
 x=await act(s.id,p.data.id,'withdraw',{reason:'x'},U.rm,'bad key');ok(x.r.status===400&&x.data.code==='IDEMPOTENCY_KEY_INVALID','R30-T06 malformed key is 400');}

// T07 concurrency with a commit barrier: every request passes all reads before any commits.
{const s=await releasedStyle('T07p');const rs=await withBarrier(25,()=>Promise.all(Array.from({length:25},(_,i)=>prepare(s.id,s.n,U.rm,`r30-t07p-${String(i).padStart(3,'0')}`))));const st=rs.map(r=>r.r.status),c=counts(s.id);
 ok(lastArrivals===25&&st.filter(v=>v===201).length===1&&st.filter(v=>v===409).length===24&&!st.includes(500)&&c.handoffs===1&&c.events===1&&c.receipts===1&&c.audits===1,'R30-T07 25 concurrent prepares (25/25 at commit): one package, 24×409, no 500, single evidence set');evidence('T07-prepare',{arrivals:lastArrivals,statuses:tally(st),codes:tally(rs.filter(r=>r.r.status===409).map(r=>r.data.code)),...c});}
{const s=await releasedStyle('T07d');const p=await prepare(s.id,s.n);const rs=await withBarrier(25,()=>Promise.all(Array.from({length:25},(_,i)=>act(s.id,p.data.id,'dispatch',{},U.rm,`r30-t07d-${String(i).padStart(3,'0')}`))));const st=rs.map(r=>r.r.status),c=counts(s.id);
 ok(lastArrivals===25&&st.filter(v=>v===200).length===1&&st.filter(v=>v===409).length===24&&!st.includes(500)&&c.events===2&&c.receipts===2&&c.states==='HANDED_OFF','R30-T07 25 concurrent dispatches: one transition, 24×409, events=2');evidence('T07-dispatch',{statuses:tally(st),codes:tally(rs.filter(r=>r.r.status===409).map(r=>r.data.code)),...c});
 const ra=await withBarrier(20,()=>Promise.all(Array.from({length:20},()=>act(s.id,p.data.id,'acknowledge',{note:'got it'},U.fs,'r30-t07-same-ack')))),c2=counts(s.id);
 ok(lastArrivals===20&&ra.every(r=>r.r.status===200&&r.data.eventId===ra[0].data.eventId)&&ra.filter(r=>r.r.headers.get('idempotency-replayed')==='true').length===19&&c2.events===3&&c2.receipts===3,'R30-T07 20 concurrent same-key acknowledgements: one event, 19 replays of the winner');}
{const s=await releasedStyle('T07x');const p=await prepare(s.id,s.n);const rs=await withBarrier(24,()=>Promise.all(Array.from({length:24},(_,i)=>i%2?act(s.id,p.data.id,'dispatch',{},U.rm,`r30-t07x-d-${i}`):act(s.id,p.data.id,'withdraw',{reason:'Race withdrawal test'},U.rm,`r30-t07x-w-${i}`))));const st=rs.map(r=>r.r.status),c=counts(s.id);
 ok(st.filter(v=>v===200).length===1&&!st.includes(500)&&c.events===2&&['HANDED_OFF','WITHDRAWN'].includes(c.states),'R30-T07 dispatch vs withdraw race: exactly one winner, consistent final state');evidence('T07-dispatch-vs-withdraw',{statuses:tally(st),final:c.states,...c});}

// T08 failure injection at every mandatory statement: no partial transition; same-key retry commits once.
for(const [label,ddl,stage] of [['factory_handoffs INSERT',"CREATE TRIGGER inj BEFORE INSERT ON factory_handoffs BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'prepare'],['factory_handoff_events INSERT',"CREATE TRIGGER inj BEFORE INSERT ON factory_handoff_events BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'prepare'],['handoff_receipts INSERT',"CREATE TRIGGER inj BEFORE INSERT ON handoff_receipts BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'prepare'],['audit_log INSERT',"CREATE TRIGGER inj BEFORE INSERT ON audit_log WHEN NEW.entity_type='FACTORY_HANDOFF' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'prepare'],
  ['factory_handoffs UPDATE (dispatch)',"CREATE TRIGGER inj BEFORE UPDATE ON factory_handoffs WHEN NEW.status='HANDED_OFF' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'dispatch'],['factory_handoff_events INSERT (dispatch)',"CREATE TRIGGER inj BEFORE INSERT ON factory_handoff_events WHEN NEW.action='DISPATCH' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'dispatch'],['handoff_receipts INSERT (acknowledge)',"CREATE TRIGGER inj BEFORE INSERT ON handoff_receipts WHEN NEW.operation='HANDOFF_ACKNOWLEDGE' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'acknowledge']]){
 const s=await releasedStyle('T08');let hid=null;if(stage!=='prepare'){hid=(await prepare(s.id,s.n)).data.id;if(stage==='acknowledge')await act(s.id,hid,'dispatch',{},U.rm);}
 const key=`r30-t08-${label.replace(/\W/g,'')}`,doIt=()=>stage==='prepare'?prepare(s.id,s.n,U.rm,key):stage==='dispatch'?act(s.id,hid,'dispatch',{},U.rm,key):act(s.id,hid,'acknowledge',{note:'n'},U.fs,key);
 const before=counts(s.id),rowBefore=hid&&db.prepare('SELECT * FROM factory_handoffs WHERE id=?').get(hid);db.exec(ddl);x=await doIt();db.exec('DROP TRIGGER inj');const after=counts(s.id);
 ok(x.r.status===500&&x.data.code==='HANDOFF_COMMIT_FAILED'&&/^err_/.test(x.data.correlationId)&&!/INJECTED|SQLITE|constraint|INSERT|UPDATE/i.test(JSON.stringify(x.data)),`R30-T08 failure at ${label}: sanitized 500 with correlation id`);
 ok(same(before,after)&&(!hid||same(db.prepare('SELECT * FROM factory_handoffs WHERE id=?').get(hid),rowBefore)),`R30-T08 failure at ${label}: no partial state, event, receipt or audit`);
 x=await doIt();ok(x.r.status<300&&counts(s.id).receipts===before.receipts+1,`R30-T08 failure at ${label}: same-key retry commits exactly once`);evidence('T08',{injectedAt:label,before,after,afterRetry:counts(s.id)});}

// T09 tamper resistance and tamper detection: no mutable-source fallback.
{const s=await acked('T09');const errs=[];const tryRun=(sql,...a)=>{try{db.prepare(sql).run(...a);return 'ok'}catch(e){return e.message}};
 const sp=await releasedStyle('T09p'),pp=await prepare(sp.id,sp.n);
 errs.push(tryRun("UPDATE factory_handoffs SET status='HANDED_OFF',version=version+1,dispatched_by='x',dispatched_at='t',package_json='{}' WHERE id=?",pp.data.id),tryRun("UPDATE factory_handoffs SET status='PREPARED',version=version+1 WHERE id=?",s.hid),tryRun("UPDATE factory_handoff_events SET reason='x' WHERE handoff_id=?",s.hid),tryRun("DELETE FROM handoff_receipts WHERE handoff_id=?",s.hid),
  tryRun("INSERT INTO factory_handoffs(id,org_id,style_id,release_id,release_no,status,version,package_json,package_sha256,release_snapshot_sha256,signoffs_sha256,prepared_by,prepared_at,last_command_id,created_at,updated_at) VALUES('hof_forged',?,?,'r',1,'ACKNOWLEDGED',1,'{}','x','x','x','x',?,'c',?,?)",org.id,s.id,ts0,ts0,ts0),
  tryRun("UPDATE release_signoffs SET decision='REJECTED' WHERE style_id=? AND release_no=?",s.id,s.n));
 ok(/HANDOFF_PACKAGE_IMMUTABLE/.test(errs[0])&&/HANDOFF_TRANSITION_INVALID/.test(errs[1])&&/HANDOFF_HISTORY_IMMUTABLE/.test(errs[2])&&/HANDOFF_RECEIPT_IMMUTABLE/.test(errs[3])&&/HANDOFF_INSERT_MUST_BE_PREPARED/.test(errs[4])&&/SIGNOFFS_FROZEN_BY_HANDOFF/.test(errs[5]),'R30-T09 database triggers block package rewrite, illegal transition, history edit, receipt delete, forged ACK insert and signoff change');
 x=await req(`/api/styles/${s.id}/releases/${s.n}/signoffs`,{body:{roleKey:'QC',decision:'REJECTED'},cookie:U.qc});ok(x.r.status===409&&x.data.code==='SIGNOFFS_FROZEN_BY_HANDOFF','R30-T09 signoff API refuses changes frozen into a live handoff');
 const trig=t=>{const m=[...readFileSync(resolve(root,'migrations',t),'utf8').matchAll(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?END;/g)].map(x=>x[0]);return m;};
 db.exec('DROP TRIGGER trg_factory_handoffs_package_immutable');db.exec('DROP TRIGGER trg_factory_handoffs_transition');db.prepare("UPDATE factory_handoffs SET package_json=replace(package_json,'\"releaseNo\"','\"releaseNO\"') WHERE id=?").run(s.hid);
 x=await pkg(s.id,s.hid);ok(x.r.status===409&&x.data.code==='HANDOFF_PACKAGE_DRIFT','R30-T09 package bytes tampered behind the triggers: serving fails closed (409), no fallback');
 for(const t of trig('0021_factory_handoff.sql'))db.exec(t);
 const s2=await releasedStyle('T09b');const p2=await prepare(s2.id,s2.n);db.exec('DROP TRIGGER trg_style_releases_contract_immutable');db.prepare("UPDATE style_releases SET snapshot_json=replace(snapshot_json,'\"value\":57','\"value\":58') WHERE style_id=? AND release_no=?").run(s2.id,s2.n);
 x=await pkg(s2.id,p2.data.id);const y=await act(s2.id,p2.data.id,'dispatch',{},U.rm);
 const s3=await releasedStyle('T09c');db.prepare("UPDATE style_releases SET snapshot_json=replace(snapshot_json,'\"value\":57','\"value\":58') WHERE style_id=? AND release_no=?").run(s3.id,s3.n);const z=await prepare(s3.id,s3.n);
 for(const t of trig('0020_release_atomicity.sql'))db.exec(t);
 ok(x.r.status===409&&x.data.code==='HANDOFF_PACKAGE_DRIFT'&&y.r.status===409&&y.data.code==='HANDOFF_PACKAGE_DRIFT'&&z.r.status===409&&z.data.code==='RELEASE_EVIDENCE_TAMPERED','R30-T09 upstream frozen release tampered: package serving, dispatch and new preparation all fail closed');}

// T10 negative role matrix, deactivated/removed actors, foreign-tenant direct ids, drift inside the commit window.
{const s=await releasedStyle('T10');const deny=[];
 for(const [who,c] of Object.entries({eng:U.eng,prod:U.prod,qc:U.qc,fs:U.fs,op:U.op,store:U.store})){const r=await prepare(s.id,s.n,c);if(r.r.status!==403)deny.push(`prepare:${who}:${r.r.status}`);}
 const p=await prepare(s.id,s.n,U.rm);
 for(const [who,c] of Object.entries({eng:U.eng,qc:U.qc,fs:U.fs,op:U.op})){const r=await act(s.id,p.data.id,'dispatch',{},c);if(r.r.status!==403)deny.push(`dispatch:${who}:${r.r.status}`);const w=await act(s.id,p.data.id,'withdraw',{reason:'Not my call to make'},c);if(w.r.status!==403)deny.push(`withdraw:${who}:${w.r.status}`);}
 ok(deny.length===0&&p.r.status===201,'R30-T10 only RELEASE_MANAGER/owners may prepare, dispatch or withdraw (6 roles × prepare, 4 roles × dispatch/withdraw denied)');evidence('T10-matrix',{unexpected:deny});
 await act(s.id,p.data.id,'dispatch',{},U.rm);
 for(const [who,c] of Object.entries({rm:U.rm,qc:U.qc,eng:U.eng,op:U.op})){const r=await act(s.id,p.data.id,'acknowledge',{},c);if(r.r.status!==403)deny.push(`ack:${who}:${r.r.status}`);}
 ok(deny.length===0&&counts(s.id).states==='HANDED_OFF','R30-T10 RELEASE_MANAGER, QC, engineering and operators cannot acknowledge factory receipt');
 const s2=await releasedStyle('T10b');const p2=await prepare(s2.id,s2.n,U.dev);await act(s2.id,p2.data.id,'dispatch',{},U.dev);x=await act(s2.id,p2.data.id,'acknowledge',{},U.dev);ok(x.r.status===403&&x.data.code==='SELF_ACKNOWLEDGE_FORBIDDEN','R30-T10 the dispatcher (even an owner) cannot acknowledge their own dispatch');
 x=await pkg(s.id,p.data.id,U.qc);const xo=await pkg(s.id,p.data.id,U.op);ok(x.r.status===200&&xo.r.status===403,'R30-T10 non-authority members (QC) may inspect the frozen package; OPERATOR stays on the guided surface (existing simple-role rule, 403)');
 x=await pkg(s.id,p.data.id,U.outsider);const y=await act(s.id,p.data.id,'acknowledge',{},U.outsider);ok(x.r.status===403&&y.r.status===403&&counts(s.id).states==='HANDED_OFF','R30-T10 foreign tenant cannot read or acknowledge by direct ids');
 const other=await releasedStyle('T10c');const po=await prepare(other.id,other.n);x=await act(s.id,po.data.id,'dispatch',{},U.rm);ok(x.r.status===404,'R30-T10 a handoff id from another style is 404 on this style path (no cross-binding)');
 for(const [who,role] of [['qc','QC_MANAGER'],['fs','FACTORY_SUPERVISOR'],['op','OPERATOR']]){const r=await relApi(s2.id,{releaseType:'PRODUCTION',sourceVersionNo:s2.v},U[who]);if(!(r.r.status===403&&(who==='op'||r.data.code==='ROLE_NOT_PERMITTED')))deny.push(`release:${who}:${r.r.status}:${r.data.code}`);}
 ok(deny.length===0,'R30-T10 QC, factory supervisor and operator cannot create a technical Production Release');
 await user('u_dis','FACTORY_SUPERVISOR').then(async c=>{db.prepare("UPDATE users SET active=0 WHERE id='u_dis'").run();const r=await act(s.id,p.data.id,'acknowledge',{},c);ok(r.r.status===401&&r.data.code==='ACCOUNT_DISABLED','R30-T10 deactivated user with a valid cookie is refused before any handoff logic');});
 for(const [label,mutate,code,status] of [['acknowledger membership removed',()=>db.prepare("DELETE FROM memberships WHERE user_id='u_fs'").run(),'FORBIDDEN_ACTOR',403],['acknowledger downgraded to OPERATOR',()=>db.prepare("UPDATE memberships SET role='OPERATOR' WHERE user_id='u_fs'").run(),'ROLE_NOT_PERMITTED',403]]){
  const t=await releasedStyle('T10d');const ph=await prepare(t.id,t.n);await act(t.id,ph.data.id,'dispatch',{},U.rm);const before=counts(t.id);beforeCommit=mutate;x=await act(t.id,ph.data.id,'acknowledge',{},U.fs);const after=counts(t.id);
  db.prepare("INSERT OR REPLACE INTO memberships(user_id,org_id,role) VALUES('u_fs',?,'FACTORY_SUPERVISOR')").run(org.id);
  ok(x.r.status===status&&x.data.code===code&&same(before,after),`R30-T10 ${label} inside the commit window: ${status} ${code}, nothing written`);evidence('T10-drift',{drift:label,code:x.data.code,before,after});}}

// T11 factory acknowledgement is not QC signoff, not Lot Release, not deployment.
{const s=await acked('T11');const sign0=db.prepare('SELECT COUNT(*) n FROM release_signoffs WHERE style_id=?').get(s.id).n;
 const lot=await req(`/api/styles/${s.id}/production-lots`,{body:{releaseNo:s.n,lotCode:'LOT-R30-T11',plannedQty:5},cookie:U.fs});const lid=lot.data.lot.id;
 x=await req(`/api/styles/${s.id}/production-lots/${lid}/checks`,{body:{checkType:'FINAL',status:'PASS'},cookie:U.fs});const qcTry=x.r.status;
 x=await req(`/api/styles/${s.id}/production-lots/${lid}/release`,{body:{},cookie:U.fs});const relTry=x.r.status;
 x=await req(`/api/styles/${s.id}/production-lots/${lid}/release`,{body:{},cookie:U.qc});const qcRel=x.r.status;
 ok(lot.r.status===201&&qcTry===403&&relTry===403&&qcRel===403&&db.prepare("SELECT status FROM production_lots WHERE id=?").get(lid).status==='OPEN','R30-T11 the acknowledging factory supervisor cannot author QC evidence or release the lot; QC cannot release the lot');
 ok(db.prepare('SELECT COUNT(*) n FROM release_signoffs WHERE style_id=?').get(s.id).n===sign0&&db.prepare("SELECT COUNT(*) n FROM factory_handoff_events WHERE handoff_id=? AND action='ACKNOWLEDGE'").get(s.hid).n===1,'R30-T11 acknowledgement created no signoff and exactly one ACKNOWLEDGE event');
 const s2=await releasedStyle('T11b');const p=await prepare(s2.id,s2.n);x=await req(`/api/styles/${s2.id}/production-lots`,{body:{releaseNo:s2.n,lotCode:'EARLY',plannedQty:5},cookie:U.fs});const early=x;await act(s2.id,p.data.id,'dispatch',{},U.rm);x=await req(`/api/styles/${s2.id}/production-lots`,{body:{releaseNo:s2.n,lotCode:'EARLY2',plannedQty:5},cookie:U.fs});
 ok(early.r.status===409&&early.data.code==='HANDOFF_NOT_ACKNOWLEDGED'&&x.r.status===409&&x.data.code==='HANDOFF_NOT_ACKNOWLEDGED','R30-T11 no lot before the factory acknowledgement is persisted (PREPARED and HANDED_OFF both refused)');}

// T12 migrations: fresh install, upgrade 22 -> 23 preserving legacy frozen facts, failed raw repeat, old-schema Worker fails closed.
{const files=readdirSync(resolve(root,'migrations')).filter(f=>f.endsWith('.sql')).sort(),m21=readFileSync(resolve(root,'migrations','0021_factory_handoff.sql'),'utf8');
 // P1 corrective: this block proves migration 0021's own contract, so it installs through 0021 (0022 is proven in
 // tests/round30_p1_corrective.mjs).
 const fresh=new DatabaseSync(':memory:');for(const f of files.filter(f=>f<'0022'))fresh.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
 const objs=fresh.prepare("SELECT type,name FROM sqlite_master WHERE name IN ('factory_handoffs','factory_handoff_events','handoff_receipts','uq_factory_handoffs_live_release') OR (type='trigger' AND (name LIKE 'trg_factory_handoff%' OR name LIKE 'trg_handoff_receipts%' OR name LIKE 'trg_release_signoffs_frozen%'))").all();
 ok(fresh.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value==='23'&&objs.filter(o=>o.type==='table').length===3&&objs.filter(o=>o.type==='trigger').length===11&&objs.some(o=>o.name==='uq_factory_handoffs_live_release'),'R30-T12 fresh install reaches schema 23 with 3 tables, live-release unique index and 11 triggers');
 const old=new DatabaseSync(':memory:');for(const f of files.filter(f=>f<'0021'))old.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
 for(const n of [1,2])old.prepare("INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,?,'PRODUCTION','RELEASED',1,'t','{}','{}','{}','u',?)").run('legacy'+n,'sty_old',n,ts0);
 old.prepare("INSERT INTO production_lots(id,style_id,release_no,lot_code,planned_qty,status,planning_basis_json,planning_basis_sha256,created_by,created_at,updated_at) VALUES('lot_old','sty_old',1,'L1',10,'RELEASED','{}','x','u',?,?)").run(ts0,ts0);
 old.prepare("INSERT INTO release_signoffs(id,style_id,release_no,role_key,decision,user_id,created_at) VALUES('sig_old','sty_old',1,'QC','APPROVED','u',?)").run(ts0);
 const rb=old.prepare('SELECT * FROM style_releases ORDER BY id').all(),lb=old.prepare('SELECT * FROM production_lots').all(),sb=old.prepare('SELECT * FROM release_signoffs').all();old.exec(m21);
 const la=old.prepare('SELECT * FROM production_lots').all();
 ok(old.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value==='23'&&same(old.prepare('SELECT * FROM style_releases ORDER BY id').all(),rb)&&same(la.map(({handoff_id,...r})=>r),lb)&&la[0].handoff_id===null&&same(old.prepare('SELECT * FROM release_signoffs').all(),sb),'R30-T12 upgrade 22→23 keeps legacy releases, a RELEASED lot and signoffs byte-identical (lot handoff_id NULL)');
 old.prepare("UPDATE release_signoffs SET decision='REJECTED' WHERE id='sig_old'").run();
 let rep='';try{old.exec(m21)}catch(e){rep=e.message}ok(/duplicate column/i.test(rep)&&old.prepare('SELECT COUNT(*) n FROM style_releases').get().n===2&&old.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value==='23','R30-T12 raw repeat of 0021 fails at its ALTER without damaging data; legacy signoffs (no handoff) stay editable');
 class D1Mock{constructor(d){this.db=d}batch(list){this.db.exec('BEGIN');try{const o=list.map(x=>x.run());this.db.exec('COMMIT');return o}catch(e){this.db.exec('ROLLBACK');throw e}}prepare(sql){const st=this.db.prepare(sql);return{bind:(...a)=>{const v=a.map(z=>z===undefined?null:z);return{first:()=>st.get(...v)||null,all:()=>({results:st.all(...v)}),run:()=>{const r=st.run(...v);return{success:true,meta:{changes:Number(r.changes||0)}}}}}}}}
 const s22=new DatabaseSync(':memory:');for(const f of files.filter(f=>f<'0021'))s22.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
 const r22=await worker.fetch(new Request('http://local/api/styles'),{...env,DB:new D1Mock(s22)}),b22=await r22.json();ok(r22.status===503&&/22/.test(b22.error)&&/24/.test(b22.error),'R30-T12 a schema-24 Worker against a schema-22 database fails closed with 503 (migration-first deploy)');}

// T13 adjacent P1s: concurrent version creation is 409 not 500; generic 500s never expose internals.
{const id=await buildReleaseCandidate(call,org,`T13-${++seq}`);const rs=await withBarrier(10,()=>Promise.all(Array.from({length:10},(_,i)=>call(`/api/styles/${id}/versions`,{method:'POST',body:{label:`race ${i}`}}))));const st=rs.map(r=>r.r.status);
 ok(lastArrivals===10&&st.filter(v=>v===201).length===1&&st.filter(v=>v===409).length===9&&rs.filter(r=>r.r.status===409).every(r=>r.data.code==='VERSION_CONFLICT')&&!st.includes(500),'R30-T13 10 concurrent version creations: one 201, 9×409 VERSION_CONFLICT, no 500');
 ok(db.prepare("SELECT COUNT(*) n FROM audit_log WHERE entity_type='VERSION' AND entity_id IN (SELECT id FROM style_versions WHERE style_id=?)").get(id).n===db.prepare('SELECT COUNT(*) n FROM style_versions WHERE style_id=?').get(id).n,'R30-T13 every committed version has exactly one audit row (version + audit are atomic)');evidence('T13-versions',{statuses:tally(st)});
 db.exec("CREATE TRIGGER inj BEFORE INSERT ON audit_log WHEN NEW.entity_type='VERSION' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END");const n0=db.prepare('SELECT COUNT(*) n FROM style_versions WHERE style_id=?').get(id).n;x=await call(`/api/styles/${id}/versions`,{method:'POST',body:{label:'inj'}});db.exec('DROP TRIGGER inj');
 ok(x.r.status===500&&x.data.code==='INTERNAL_ERROR'&&/^err_/.test(x.data.correlationId)&&!/INJECTED|SQLITE|constraint|INSERT|audit_log/i.test(JSON.stringify(x.data))&&db.prepare('SELECT COUNT(*) n FROM style_versions WHERE style_id=?').get(id).n===n0,'R30-T13 unexpected DB failure on a generic route: sanitized 500 + correlation id, and no orphan version row');}
