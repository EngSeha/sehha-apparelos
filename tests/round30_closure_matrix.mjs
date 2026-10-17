// ROUND30 closure: executed acceptance matrix for every Factory Handoff transition, full-row failure injection on every
// mandatory write of every transition (and of the lot it seeds), a DB-wide evidence invariant, and the 21 -> 22 -> 23
// upgrade over historical data. Each matrix row is an assertion and is also printed as a `MATRIX {...}` line.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {makeHarness,ok,seedEngineeringReady,root} from './test_helpers.mjs';
import {buildReleaseCandidate,newVersion,addHandoffEvidence} from './release_fixture.mjs';
import worker from '../src/worker.js';
const h=makeHarness(),{call,db,env}=h;await h.login();
let x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),ts0=new Date().toISOString();let seq=0,mid=0;
const row=(transition,dimension,scenario,expected,actual,pass)=>{const id=`R30C-${String(++mid).padStart(3,'0')}`;console.log('MATRIX '+JSON.stringify({id,transition,dimension,scenario,expected,actual,verdict:pass?'PASS':'FAIL'}));ok(pass,`${id} ${transition} · ${dimension} · ${scenario}`);};
const realBatch=env.DB.batch.bind(env.DB);let barrier=null,lastArrivals=0;
env.DB.batch=async list=>{if(barrier){barrier.arrived++;if(barrier.arrived===barrier.n)barrier.open();await barrier.gate;}return realBatch(list);};
const withBarrier=async(n,fn)=>{let open;barrier={n,arrived:0,gate:new Promise(r=>open=r)};barrier.open=open;try{return await fn()}finally{lastArrivals=barrier.arrived;barrier=null}};
const devHash=db.prepare("SELECT password_hash,password_salt FROM users WHERE email='dev@sehha.local'").get();
async function user(idv,role,orgId=org.id){db.prepare('INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)').run(idv,`${idv}@r30c.local`,idv,devHash.password_hash,devHash.password_salt,ts0);if(role)db.prepare('INSERT INTO memberships(user_id,org_id,role) VALUES(?,?,?)').run(idv,orgId,role);
  const r=await call('/api/auth/login',{method:'POST',body:{email:`${idv}@r30c.local`,password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});return (r.r.headers.get('set-cookie')||'').split(';')[0];}
const other=db.prepare("INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES('org_r30c','R30C','Other','{}',?) RETURNING id").get(ts0).id;
const U={dev:h.cookie,rm:await user('c_rm','RELEASE_MANAGER'),own2:await user('c_own2','WORKSPACE_OWNER'),eng:await user('c_eng','DESIGN_PATTERN_MASTER'),prod:await user('c_prod','FACTORY_SUPERVISOR'),qc:await user('c_qc','QC_MANAGER'),fs:await user('c_fs','FACTORY_SUPERVISOR'),op:await user('c_op','OPERATOR'),store:await user('c_store','STORE_CLERK'),outsider:await user('c_out','WORKSPACE_OWNER',other)};
const req=(path,{body={},cookie,key,method='POST'}={})=>call(path,{method,body:method==='POST'?body:undefined,cookieOverride:cookie,headers:key?{'idempotency-key':key}:{}});
const P=(s,c=U.rm,k)=>req(`/api/styles/${s.id}/releases/${s.n}/handoffs`,{cookie:c,key:k});
const A=(s,hid,a,body,c,k)=>req(`/api/styles/${s.id}/handoffs/${hid}/${a}`,{body:body||{},cookie:c,key:k});
async function released(){const id=await buildReleaseCandidate(call,org,`C-${++seq}`);addHandoffEvidence(db,id);seedEngineeringReady(db,id);const v=await newVersion(call,id,'closure');
  const r=await req(`/api/styles/${id}/releases`,{body:{releaseType:'PRODUCTION',sourceVersionNo:v},cookie:U.rm});if(r.r.status!==201)throw new Error('release '+JSON.stringify(r.data));
  for(const [roleKey,c] of [['DESIGN',U.eng],['PATTERN',U.eng],['PRODUCTION',U.prod],['QC',U.qc]]){const z=await req(`/api/styles/${id}/releases/${r.data.releaseNo}/signoffs`,{body:{roleKey,decision:'APPROVED'},cookie:c});if(z.r.status!==200)throw new Error('signoff');}
  return {id,n:r.data.releaseNo};}
async function inState(state){const s=await released();if(state==='RELEASED')return {s};const hid=(await P(s)).data.id;if(state==='PREPARED')return {s,hid};
  await A(s,hid,'dispatch',{},U.rm);if(state==='HANDED_OFF')return {s,hid};await A(s,hid,'acknowledge',{note:'ok'},U.fs);return {s,hid};}
const facts=sid=>{const hs=db.prepare('SELECT * FROM factory_handoffs WHERE style_id=? ORDER BY id').all(sid),ids=hs.map(r=>r.id),lots=db.prepare('SELECT * FROM production_lots WHERE style_id=? ORDER BY id').all(sid);const inn=a=>a.length?a.map(()=>'?').join(','):"''";
  return {handoffs:hs,events:db.prepare(`SELECT * FROM factory_handoff_events WHERE handoff_id IN (${inn(ids)}) ORDER BY id`).all(...ids),receipts:db.prepare(`SELECT * FROM handoff_receipts WHERE handoff_id IN (${inn(ids)}) ORDER BY id`).all(...ids),
    audits:db.prepare(`SELECT * FROM audit_log WHERE entity_id IN (${inn([...ids,...lots.map(l=>l.id)])}) ORDER BY id`).all(...ids,...lots.map(l=>l.id)),lots};};
const sanitized=d=>!/INJECTED|SQLITE|constraint|INSERT|UPDATE|audit_log|factory_handoff/i.test(JSON.stringify(d));
const ROLES=['dev','rm','own2','eng','prod','qc','fs','op','store'];

// ===== 1. Permissions per transition (every role, from the correct state) =====
const PERM={prepare:{from:'RELEASED',allow:['dev','rm','own2']},dispatch:{from:'PREPARED',allow:['dev','rm','own2']},withdraw:{from:'PREPARED',allow:['dev','rm','own2']},acknowledge:{from:'HANDED_OFF',allow:['dev','own2','prod','fs']}};
for(const [t,spec] of Object.entries(PERM)){const target=await inState(spec.from);
  for(const r of ROLES.filter(r=>!spec.allow.includes(r))){const before=facts(target.s.id),res=t==='prepare'?await P(target.s,U[r]):await A(target.s,target.hid,t,{reason:'Permission matrix probe',note:'n'},U[r]);
    const exp=['op','store'].includes(r)?'403 (simple-role surface)':r==='rm'&&t==='acknowledge'?'403 ROLE_NOT_PERMITTED (also the dispatcher)':'403 ROLE_NOT_PERMITTED';
    row(t.toUpperCase(),'permission',`role ${r} denied`,exp,`${res.r.status} ${res.data.code||''}`.trim(),res.r.status===403&&(['op','store'].includes(r)||res.data.code==='ROLE_NOT_PERMITTED')&&same(facts(target.s.id),before));}
  for(const r of spec.allow){const tg=await inState(spec.from),res=t==='prepare'?await P(tg.s,U[r]):await A(tg.s,tg.hid,t,{reason:'Permission matrix allowed',note:'n'},U[r]);
    row(t.toUpperCase(),'permission',`role ${r} allowed`,t==='prepare'?'201':'200',`${res.r.status} ${res.data.status||''}`.trim(),res.r.status===(t==='prepare'?201:200));}}
{const {s,hid}=await inState('PREPARED');await A(s,hid,'dispatch',{},U.own2);const res=await A(s,hid,'acknowledge',{},U.own2);row('ACKNOWLEDGE','permission','dispatcher acknowledging own dispatch (owner)','403 SELF_ACKNOWLEDGE_FORBIDDEN',`${res.r.status} ${res.data.code}`,res.r.status===403&&res.data.code==='SELF_ACKNOWLEDGE_FORBIDDEN');}
{const {s,hid}=await inState('ACKNOWLEDGED');for(const r of ROLES){const res=await call(`/api/styles/${s.id}/handoffs/${hid}/package`,{cookieOverride:U[r]});const allow=!['op','store'].includes(r);row('INSPECT','permission',`role ${r} reads frozen package`,allow?'200':'403 (simple-role surface)',String(res.r.status),res.r.status===(allow?200:403));}}

// ===== 2. Tenant isolation and id cross-binding per transition =====
{const pr=await inState('PREPARED'),ho=await inState('HANDED_OFF'),rel=await inState('RELEASED'),ack=await inState('ACKNOWLEDGED');
 const probes=[['PREPARE',()=>P(rel.s,U.outsider),rel.s.id],['DISPATCH',()=>A(pr.s,pr.hid,'dispatch',{},U.outsider),pr.s.id],['WITHDRAW',()=>A(pr.s,pr.hid,'withdraw',{reason:'Foreign tenant probe'},U.outsider),pr.s.id],['ACKNOWLEDGE',()=>A(ho.s,ho.hid,'acknowledge',{},U.outsider),ho.s.id],
  ['INSPECT',()=>call(`/api/styles/${ack.s.id}/handoffs/${ack.hid}/package`,{cookieOverride:U.outsider}),ack.s.id],['LIST',()=>call(`/api/styles/${ack.s.id}/handoffs`,{cookieOverride:U.outsider}),ack.s.id],['DETAIL',()=>call(`/api/styles/${ack.s.id}/handoffs/${ack.hid}`,{cookieOverride:U.outsider}),ack.s.id]];
 for(const [t,fn,sid] of probes){const before=facts(sid),res=await fn();row(t,'tenant isolation','foreign-tenant owner by direct ids','403, nothing changed, no package bytes',`${res.r.status}`,res.r.status===403&&same(facts(sid),before)&&!res.data?.packageSha256&&!res.data?.signoffs);}
 for(const [t,act] of [['DISPATCH','dispatch'],['WITHDRAW','withdraw'],['ACKNOWLEDGE','acknowledge']]){const src=t==='ACKNOWLEDGE'?ho:pr,before=facts(src.s.id),res=await A(rel.s,src.hid,act,{reason:'Cross binding probe'},t==='ACKNOWLEDGE'?U.fs:U.rm);row(t,'tenant isolation','handoff id of another style on this style path','404, nothing changed',String(res.r.status),res.r.status===404&&same(facts(src.s.id),before));}}

// ===== 3. Idempotency per transition =====
for(const t of ['prepare','dispatch','acknowledge','withdraw']){const from={prepare:'RELEASED',dispatch:'PREPARED',acknowledge:'HANDED_OFF',withdraw:'PREPARED'}[t],tg=await inState(from),actor=t==='acknowledge'?U.fs:U.rm,key=`r30c-idem-${t}`,body={reason:'Idempotency reason one',note:'note one'};
  const go=(b=body,c=actor,k=key)=>t==='prepare'?P(tg.s,c,k):A(tg.s,tg.hid,t,b,c,k);const r1=await go(),f1=facts(tg.s.id),r2=await go();
  row(t.toUpperCase(),'idempotency','same key, same request (lost response)','original status/body, replay header, no new rows',`${r2.r.status} replayed=${r2.r.headers.get('idempotency-replayed')}`,r2.r.status===r1.r.status&&same(r1.data,r2.data)&&r2.r.headers.get('idempotency-replayed')==='true'&&same(facts(tg.s.id),f1));
  let r3;if(t==='prepare'){const other=await inState('RELEASED');r3=await P(other.s,actor,key);}else r3=await go({reason:'A different reason',note:'a different note'});
  if(t==='dispatch'){const o=await inState('PREPARED');r3=await A(o.s,o.hid,'dispatch',{},actor,key);}
  row(t.toUpperCase(),'idempotency','same key, different intent','409 IDEMPOTENCY_KEY_REUSED, no writes',`${r3.r.status} ${r3.data.code}`,r3.r.status===409&&r3.data.code==='IDEMPOTENCY_KEY_REUSED'&&same(facts(tg.s.id),f1));
  const r4=t==='prepare'?await P(tg.s,U.outsider,key):await A(tg.s,tg.hid,t,body,U.outsider,key);row(t.toUpperCase(),'idempotency','same key from a foreign tenant','403, original response not disclosed',String(r4.r.status),r4.r.status===403&&!r4.data.receiptId&&same(facts(tg.s.id),f1));}

// ===== 4. Concurrency per transition (barrier: all requests pass every read before any commits) =====
for(const t of ['prepare','dispatch','acknowledge','withdraw']){const from={prepare:'RELEASED',dispatch:'PREPARED',acknowledge:'HANDED_OFF',withdraw:'PREPARED'}[t];
  for(const mode of ['different keys','same key']){const tg=await inState(from),actor=t==='acknowledge'?U.fs:U.rm,n=12;
    const rs=await withBarrier(n,()=>Promise.all(Array.from({length:n},(_,i)=>{const k=mode==='same key'?`r30c-cc-${t}`:`r30c-cc-${t}-${i}`;return t==='prepare'?P(tg.s,actor,k):A(tg.s,tg.hid,t,{reason:'Concurrent withdrawal',note:'c'},actor,k);})));
    const st=rs.map(r=>r.r.status),f=facts(tg.s.id),win=t==='prepare'?201:200,winners=st.filter(v=>v===win).length;
    const okk=lastArrivals===n&&!st.includes(500)&&(mode==='same key'?(rs.every(r=>r.r.status===win&&r.data.eventId===rs[0].data.eventId)):(winners===1&&st.filter(v=>v===409).length===n-1));
    const evExpected={prepare:1,dispatch:2,acknowledge:3,withdraw:2}[t];
    row(t.toUpperCase(),'concurrency',`${n} concurrent requests, ${mode}`,mode==='same key'?`all ${win} with one event; ${n-1} replays`:`1×${win}, ${n-1}×409, no 500`,JSON.stringify(st.reduce((o,v)=>(o[v]=(o[v]||0)+1,o),{})),okk&&f.handoffs.length===1&&f.events.length===evExpected&&f.receipts.length===evExpected&&f.audits.length===evExpected);}}
{const tg=await inState('PREPARED'),rs=await withBarrier(12,()=>Promise.all(Array.from({length:12},(_,i)=>i%2?A(tg.s,tg.hid,'dispatch',{},U.rm,`r30c-dw-d${i}`):A(tg.s,tg.hid,'withdraw',{reason:'Race withdrawal'},U.rm,`r30c-dw-w${i}`)))),st=rs.map(r=>r.r.status),f=facts(tg.s.id);
 row('DISPATCH|WITHDRAW','concurrency','12 concurrent dispatch vs withdraw','exactly one winner, consistent state',`${JSON.stringify(st.reduce((o,v)=>(o[v]=(o[v]||0)+1,o),{}))} → ${f.handoffs[0].status}`,st.filter(v=>v===200).length===1&&!st.includes(500)&&f.events.length===2&&['HANDED_OFF','WITHDRAWN'].includes(f.handoffs[0].status));}

// ===== 5. Failure injection on EVERY mandatory write of EVERY transition (+ the lot it seeds) =====
const INJ=[
 ['PREPARE','factory_handoffs INSERT',"BEFORE INSERT ON factory_handoffs"],['PREPARE','event INSERT',"BEFORE INSERT ON factory_handoff_events WHEN NEW.action='PREPARE'"],['PREPARE','receipt INSERT',"BEFORE INSERT ON handoff_receipts WHEN NEW.operation='HANDOFF_PREPARE'"],['PREPARE','audit INSERT',"BEFORE INSERT ON audit_log WHEN NEW.entity_type='FACTORY_HANDOFF' AND NEW.action='PREPARE'"],
 ['DISPATCH','factory_handoffs UPDATE',"BEFORE UPDATE ON factory_handoffs WHEN NEW.status='HANDED_OFF'"],['DISPATCH','event INSERT',"BEFORE INSERT ON factory_handoff_events WHEN NEW.action='DISPATCH'"],['DISPATCH','receipt INSERT',"BEFORE INSERT ON handoff_receipts WHEN NEW.operation='HANDOFF_DISPATCH'"],['DISPATCH','audit INSERT',"BEFORE INSERT ON audit_log WHEN NEW.entity_type='FACTORY_HANDOFF' AND NEW.action='DISPATCH'"],
 ['ACKNOWLEDGE','factory_handoffs UPDATE',"BEFORE UPDATE ON factory_handoffs WHEN NEW.status='ACKNOWLEDGED'"],['ACKNOWLEDGE','event INSERT',"BEFORE INSERT ON factory_handoff_events WHEN NEW.action='ACKNOWLEDGE'"],['ACKNOWLEDGE','receipt INSERT',"BEFORE INSERT ON handoff_receipts WHEN NEW.operation='HANDOFF_ACKNOWLEDGE'"],['ACKNOWLEDGE','audit INSERT',"BEFORE INSERT ON audit_log WHEN NEW.entity_type='FACTORY_HANDOFF' AND NEW.action='ACKNOWLEDGE'"],
 ['WITHDRAW','factory_handoffs UPDATE',"BEFORE UPDATE ON factory_handoffs WHEN NEW.status='WITHDRAWN'"],['WITHDRAW','event INSERT',"BEFORE INSERT ON factory_handoff_events WHEN NEW.action='WITHDRAW'"],['WITHDRAW','receipt INSERT',"BEFORE INSERT ON handoff_receipts WHEN NEW.operation='HANDOFF_WITHDRAW'"],['WITHDRAW','audit INSERT',"BEFORE INSERT ON audit_log WHEN NEW.entity_type='FACTORY_HANDOFF' AND NEW.action='WITHDRAW'"],
 ['LOT_CREATE','production_lots INSERT',"BEFORE INSERT ON production_lots"],['LOT_CREATE','audit INSERT',"BEFORE INSERT ON audit_log WHEN NEW.entity_type='PRODUCTION_LOT'"]];
for(const [t,stmt,when] of INJ){const from={PREPARE:'RELEASED',DISPATCH:'PREPARED',ACKNOWLEDGE:'HANDED_OFF',WITHDRAW:'PREPARED',LOT_CREATE:'ACKNOWLEDGED'}[t],tg=await inState(from),key=`r30c-inj-${t}-${stmt.replace(/\W/g,'')}`;
  const go=()=>t==='PREPARE'?P(tg.s,U.rm,key):t==='LOT_CREATE'?req(`/api/styles/${tg.s.id}/production-lots`,{body:{releaseNo:tg.s.n,lotCode:'INJ',plannedQty:5},cookie:U.fs}):A(tg.s,tg.hid,t.toLowerCase(),{reason:'Injected withdrawal',note:'n'},t==='ACKNOWLEDGE'?U.fs:U.rm,key);
  const before=facts(tg.s.id);db.exec(`CREATE TRIGGER inj ${when} BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END`);let res;try{res=await go()}finally{db.exec('DROP TRIGGER inj')}const after=facts(tg.s.id);
  const code=t==='LOT_CREATE'?'LOT_COMMIT_FAILED':'HANDOFF_COMMIT_FAILED';
  row(t,'failure injection',`abort at ${stmt}`,`500 ${code}; handoff/event/receipt/audit/lot rows byte-identical`,`${res.r.status} ${res.data.code} · rowsUnchanged=${same(before,after)}`,res.r.status===500&&res.data.code===code&&/^err_/.test(res.data.correlationId)&&sanitized(res.data)&&same(before,after));
  const retry=await go(),after2=facts(tg.s.id),okRetry=retry.r.status<300&&(t==='LOT_CREATE'?after2.lots.length===before.lots.length+1:after2.events.length===before.events.length+1&&after2.receipts.length===before.receipts.length+1);
  row(t,'failure injection',`retry after abort at ${stmt}`,'commits exactly once with complete evidence',`${retry.r.status}`,okRetry);
  console.log('EVIDENCE '+JSON.stringify({scenario:'closure-injection',transition:t,statement:stmt,before:{h:before.handoffs.map(r=>r.status+':'+r.version),ev:before.events.length,rc:before.receipts.length,au:before.audits.length,lots:before.lots.length},after:{h:after.handoffs.map(r=>r.status+':'+r.version),ev:after.events.length,rc:after.receipts.length,au:after.audits.length,lots:after.lots.length},afterRetry:{h:after2.handoffs.map(r=>r.status+':'+r.version),ev:after2.events.length,rc:after2.receipts.length,au:after2.audits.length,lots:after2.lots.length}}));}

// ===== 6. Frozen-data stability across every transition =====
{const s=await released(),hid=(await P(s)).data.id,rel0=db.prepare('SELECT * FROM style_releases WHERE style_id=? AND release_no=?').get(s.id,s.n);const pk=()=>db.prepare('SELECT package_json,package_sha256,release_snapshot_sha256,signoffs_sha256 FROM factory_handoffs WHERE id=?').get(hid),p0=pk();
 const served0=(await call(`/api/styles/${s.id}/handoffs/${hid}/package`,{cookieOverride:U.rm})).data;await A(s,hid,'dispatch',{},U.rm);const p1=pk();await A(s,hid,'acknowledge',{},U.fs);const p2=pk();
 seedEngineeringReady(db,s.id);const v=await newVersion(call,s.id,'newer');await req(`/api/styles/${s.id}/releases`,{body:{releaseType:'PRODUCTION',sourceVersionNo:v},cookie:U.rm});const p3=pk(),served3=(await call(`/api/styles/${s.id}/handoffs/${hid}/package`,{cookieOverride:U.rm})).data;
 row('PREPARE→DISPATCH→ACKNOWLEDGE','frozen data','package bytes + hashes across every transition and after a newer release','identical',same([p0,p1,p2,p3].map(JSON.stringify),Array(4).fill(JSON.stringify(p0)))?'identical':'changed',same([p1,p2,p3],[p0,p0,p0])&&same(served0,served3));
 row('ALL','frozen data','upstream release row while its handoff moves','byte-identical',same(db.prepare('SELECT * FROM style_releases WHERE style_id=? AND release_no=?').get(s.id,s.n),rel0)?'identical':'changed',same(db.prepare('SELECT * FROM style_releases WHERE style_id=? AND release_no=?').get(s.id,s.n),rel0));
 const w=await released(),wh=(await P(w)).data.id,wp=db.prepare('SELECT package_json,package_sha256 FROM factory_handoffs WHERE id=?').get(wh);await A(w,wh,'withdraw',{reason:'Freeze check withdrawal'},U.rm);
 row('WITHDRAW','frozen data','package after withdrawal','identical and still readable',same(db.prepare('SELECT package_json,package_sha256 FROM factory_handoffs WHERE id=?').get(wh),wp)?'identical':'changed',same(db.prepare('SELECT package_json,package_sha256 FROM factory_handoffs WHERE id=?').get(wh),wp)&&(await call(`/api/styles/${w.id}/handoffs/${wh}/package`,{cookieOverride:U.rm})).r.status===200);}

// ===== 7. No use of legacy / unverified releases =====
{const mk=async(snap)=>{const id=await buildReleaseCandidate(call,org,`CL-${++seq}`);db.prepare("INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,1,'PRODUCTION','RELEASED',1,'mohsen_nexz_20p','{\"ready\":true}','{}',?,'legacy',?)").run('rel_cl_'+id,id,snap,ts0);return {id,n:1};};
 for(const [label,snap] of [['LEGACY_UNVERIFIED (pre-R29)','{"style":{}}'],['LIVE_UNVERSIONED_R28',JSON.stringify({engineeringReadiness:{basis:'LIVE_ENGINEERING_RECORDS'}})]]){const s=await mk(snap),rows0=db.prepare('SELECT * FROM style_releases WHERE style_id=?').all(s.id);
   const p=await P(s,U.rm),l=await req(`/api/styles/${s.id}/production-lots`,{body:{releaseNo:1,lotCode:'X',plannedQty:1},cookie:U.fs});
   row('PREPARE','legacy release',label,'409 LEGACY_RELEASE_NOT_ELIGIBLE',`${p.r.status} ${p.data.code}`,p.r.status===409&&p.data.code==='LEGACY_RELEASE_NOT_ELIGIBLE');
   row('LOT_CREATE','legacy release',label,'409 LEGACY_RELEASE_NOT_ELIGIBLE, release row untouched',`${l.r.status} ${l.data.code}`,l.r.status===409&&l.data.code==='LEGACY_RELEASE_NOT_ELIGIBLE'&&same(db.prepare('SELECT * FROM style_releases WHERE style_id=?').all(s.id),rows0));}
 for(const st of ['RELEASED','PREPARED','HANDED_OFF']){const tg=await inState(st),l=await req(`/api/styles/${tg.s.id}/production-lots`,{body:{releaseNo:tg.s.n,lotCode:'EARLY',plannedQty:1},cookie:U.fs});row('LOT_CREATE','handoff gate',`frozen release with handoff state ${st==='RELEASED'?'none':st}`,'409 HANDOFF_NOT_ACKNOWLEDGED',`${l.r.status} ${l.data.code}`,l.r.status===409&&l.data.code==='HANDOFF_NOT_ACKNOWLEDGED');}
 const ok2=await inState('ACKNOWLEDGED'),l=await req(`/api/styles/${ok2.s.id}/production-lots`,{body:{releaseNo:ok2.s.n,lotCode:'OK',plannedQty:1},cookie:U.fs});row('LOT_CREATE','handoff gate','frozen release with ACKNOWLEDGED handoff','201 with handoff_id provenance',`${l.r.status}`,l.r.status===201&&db.prepare('SELECT handoff_id FROM production_lots WHERE id=?').get(l.data.lot.id).handoff_id===ok2.hid);}

// ===== 8. DB-wide evidence invariant after everything above (races, replays, injections, retries) =====
{const hs=db.prepare('SELECT * FROM factory_handoffs').all(),bad=[];
 for(const hh of hs){const ev=db.prepare('SELECT * FROM factory_handoff_events WHERE handoff_id=? ORDER BY created_at,rowid').all(hh.id),rc=db.prepare('SELECT * FROM handoff_receipts WHERE handoff_id=?').all(hh.id),au=db.prepare("SELECT * FROM audit_log WHERE entity_type='FACTORY_HANDOFF' AND entity_id=?").all(hh.id);
  if(hh.package_sha256==='fixture')continue;
  if(ev.length!==Number(hh.version))bad.push(`${hh.id}: events ${ev.length} != version ${hh.version}`);
  if(rc.length!==ev.length)bad.push(`${hh.id}: receipts ${rc.length} != events ${ev.length}`);
  if(au.length!==ev.length)bad.push(`${hh.id}: audits ${au.length} != events ${ev.length}`);
  if(ev.length&&ev[ev.length-1].to_status!==hh.status)bad.push(`${hh.id}: last event ${ev[ev.length-1].to_status} != status ${hh.status}`);
  if(ev.some(e=>e.package_sha256!==hh.package_sha256))bad.push(`${hh.id}: event package hash differs`);
  for(const e of ev)if(rc.filter(r=>r.event_id===e.id).length!==1)bad.push(`${hh.id}: event ${e.id} has ${rc.filter(r=>r.event_id===e.id).length} receipts`);
  if(hh.status==='ACKNOWLEDGED'&&hh.acknowledged_by===hh.dispatched_by)bad.push(`${hh.id}: self-acknowledged`);}
 const orphanEv=db.prepare('SELECT COUNT(*) n FROM factory_handoff_events WHERE handoff_id NOT IN (SELECT id FROM factory_handoffs)').get().n,orphanRc=db.prepare('SELECT COUNT(*) n FROM handoff_receipts WHERE handoff_id NOT IN (SELECT id FROM factory_handoffs) OR event_id NOT IN (SELECT id FROM factory_handoff_events)').get().n;
 const orphanAu=db.prepare("SELECT COUNT(*) n FROM audit_log WHERE entity_type='FACTORY_HANDOFF' AND entity_id NOT IN (SELECT id FROM factory_handoffs)").get().n;
 const lotsBad=db.prepare("SELECT COUNT(*) n FROM production_lots l WHERE l.handoff_id IS NOT NULL AND (SELECT COUNT(*) FROM audit_log a WHERE a.entity_type='PRODUCTION_LOT' AND a.action='CREATE' AND a.entity_id=l.id)<>1").get().n;
 const lotsNoAck=db.prepare("SELECT COUNT(*) n FROM production_lots l WHERE l.handoff_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM factory_handoffs h WHERE h.id=l.handoff_id AND h.status='ACKNOWLEDGED')").get().n;
 console.log('EVIDENCE '+JSON.stringify({scenario:'invariant',handoffs:hs.filter(x=>x.package_sha256!=='fixture').length,violations:bad,orphanEv,orphanRc,orphanAu,lotsBad,lotsNoAck}));
 row('ALL','atomicity invariant',`DB-wide over ${hs.length} handoffs after races/replays/injections`,'events = version = receipts = audits per handoff; last event = status; no orphans; every handoff-seeded lot has 1 audit and an ACKNOWLEDGED handoff',`violations=${bad.length} orphans=${orphanEv+orphanRc+orphanAu} lotIssues=${lotsBad+lotsNoAck}`,bad.length===0&&orphanEv===0&&orphanRc===0&&orphanAu===0&&lotsBad===0&&lotsNoAck===0);}

// ===== 9. Migrations 0020 + 0021 over historical data (schema 21 -> 22 -> 23) =====
{const files=readdirSync(resolve(root,'migrations')).filter(f=>f.endsWith('.sql')).sort(),sql=f=>readFileSync(resolve(root,'migrations',f),'utf8');
 const old=new DatabaseSync(':memory:');for(const f of files.filter(f=>f<'0020'))old.exec(sql(f));
 const t='2026-01-01T00:00:00.000Z';old.exec(`INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES('o1','HIST','Hist','{}','${t}');
  INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES('u1','u1@h','U1','h','s','${t}');INSERT INTO memberships(user_id,org_id,role) VALUES('u1','o1','WORKSPACE_OWNER');
  INSERT INTO styles(id,org_id,code,name,created_by,created_at,updated_at,status) VALUES('s1','o1','H-1','Hist style','u1','${t}','${t}','PRODUCTION_RELEASED');
  INSERT INTO style_versions(id,style_id,version_no,label,snapshot_json,created_by,created_at) VALUES('v1','s1',1,'V1','{"style":{"id":"s1"}}','u1','${t}');
  INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES('r1','s1',1,'SAMPLE','RELEASED',1,'t','{}','{}','{"a":1}','u1','${t}'),('r2','s1',2,'PRODUCTION','RELEASED',1,'t','{"ready":true}','{}','{"a":2}','u1','${t}'),('r3','s1',3,'PRODUCTION','RELEASED',1,'t','{}','{}','{"a":3}','u1','${t}');
  INSERT INTO release_signoffs(id,style_id,release_no,role_key,decision,user_id,created_at) VALUES('g1','s1',2,'QC','APPROVED','u1','${t}'),('g2','s1',2,'DESIGN','APPROVED','u1','${t}');
  INSERT INTO production_lots(id,style_id,release_no,lot_code,planned_qty,status,planning_basis_json,planning_basis_sha256,created_by,created_at,updated_at) VALUES('l1','s1',2,'L-OPEN',100,'OPEN','{}','x','u1','${t}','${t}'),('l2','s1',3,'L-REL',50,'RELEASED','{}','y','u1','${t}','${t}');
  INSERT INTO audit_log(org_id,user_id,entity_type,entity_id,action,detail_json,created_at) VALUES('o1','u1','RELEASE','r2','CREATE','{}','${t}');`);
 const tables=['styles','style_versions','style_releases','release_signoffs','production_lots','audit_log','memberships','users','organizations'];
 const dump=d=>Object.fromEntries(tables.map(tb=>[tb,d.prepare(`SELECT * FROM ${tb} ORDER BY rowid`).all()]));const before=dump(old);
 old.exec(sql('0020_release_atomicity.sql'));const mid22=old.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value;old.exec(sql('0021_factory_handoff.sql'));
 const after=dump(old),strip=o=>Object.fromEntries(Object.entries(o).map(([tb,rows])=>[tb,rows.map(r=>{const c={...r};if(tb==='style_releases'){delete c.evidence_contract;delete c.candidate_sha256;}if(tb==='production_lots')delete c.handoff_id;return c;})]));
 const newColsNull=after.style_releases.every(r=>r.evidence_contract===null&&r.candidate_sha256===null)&&after.production_lots.every(r=>r.handoff_id===null);
 row('MIGRATION','upgrade 21→22→23','historical rows (styles, versions, 3 releases incl. duplicate PRODUCTION version, signoffs, OPEN+RELEASED lots, audit)','identical in all pre-existing columns; new columns NULL',`schema 21→${mid22}→${old.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value} · identical=${same(strip(after),before)} · newColsNull=${newColsNull}`,mid22==='22'&&same(strip(after),before)&&newColsNull);
 const integ=old.prepare('PRAGMA integrity_check').get(),fk=old.prepare('PRAGMA foreign_key_check').all();row('MIGRATION','upgrade 21→22→23','PRAGMA integrity_check / foreign_key_check','ok / none',`${Object.values(integ)[0]} / ${fk.length}`,Object.values(integ)[0]==='ok'&&fk.length===0);
 // P1 corrective: this block proves the 0020+0021 contract, so the fresh comparison installs through 0021; the
 // 21→22→23→24 path is proven in tests/round30_p1_corrective.mjs.
 const fresh=new DatabaseSync(':memory:');for(const f of files.filter(f=>f<'0022'))fresh.exec(sql(f));const ddl=d=>d.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
 const norm=r=>({...r,sql:String(r.sql||'').replace(/\s+/g,' ')});const dU=ddl(old).map(norm),dF=ddl(fresh).map(norm);
 row('MIGRATION','upgrade vs fresh','schema objects after upgrade vs fresh install','identical set of tables, indexes and triggers with identical DDL',`upgraded=${dU.length} fresh=${dF.length} identical=${same(dU,dF)}`,same(dU,dF));
 const trig=old.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all().map(r=>r.name),r29=trig.filter(n=>/style_releases_contract|release_receipts|style_versions_snapshot/.test(n)),r30=trig.filter(n=>/factory_handoff|handoff_receipts|release_signoffs_frozen/.test(n));
 row('MIGRATION','0020 + 0021 coexistence','trigger sets','ROUND29: 5, ROUND30: 11, no name collision',`${r29.length} + ${r30.length} (total ${trig.length})`,r29.length===5&&r30.length===11&&new Set(trig).size===trig.length);
 let legacyEdits='';try{old.prepare("UPDATE style_releases SET note='historical note' WHERE id='r2'").run();old.prepare("UPDATE release_signoffs SET decision='REJECTED' WHERE id='g1'").run();old.prepare("UPDATE production_lots SET note='kept' WHERE id='l1'").run();legacyEdits='allowed'}catch(e){legacyEdits=e.message}
 row('MIGRATION','legacy behaviour','legacy release/signoff/lot rows remain maintainable (no contract, no live handoff)','allowed',legacyEdits,legacyEdits==='allowed');
 class D1{constructor(d){this.db=d}batch(l){this.db.exec('BEGIN');try{const o=l.map(x=>x.run());this.db.exec('COMMIT');return o}catch(e){this.db.exec('ROLLBACK');throw e}}prepare(q){const st=this.db.prepare(q);return{bind:(...a)=>{const v=a.map(z=>z===undefined?null:z);return{first:()=>st.get(...v)||null,all:()=>({results:st.all(...v)}),run:()=>{const r=st.run(...v);return{success:true,meta:{changes:Number(r.changes||0)}}}}}}}}
 old.exec(sql('0022_handoff_authority_lot_receipts.sql'));
 const e2={...env,DB:new D1(old)},hist=await worker.fetch(new Request('http://local/api/health'),e2),hb=await hist.json();
 row('MIGRATION','runtime after upgrade','schema-24 Worker on the upgraded historical DB (then +0022)','health ok, schema 24',`${hist.status} ${hb.schemaVersion}`,hist.status===200&&hb.schemaVersion==='24');}
