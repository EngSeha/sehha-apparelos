// ROUND30 P1 corrective — local Cloudflare runtime proof: wrangler-applied migrations 0001..0022 (schema 24) and the real
// worker code against a workerd-backed D1 binding (getPlatformProxy). Local workerd D1 only — NOT remote Cloudflare D1.
// Mirrors the decisive rows of tests/round30_p1_corrective.mjs on the workerd engine (the same harness as
// tests/round30_workerd_d1.mjs: commit-window hook + barrier around env.DB.batch).
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,copyFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {getPlatformProxy} from 'wrangler';
import {ok,root} from './test_helpers.mjs';
import worker from '../src/worker.js';
const evidence=(scenario,data)=>console.log('EVIDENCE '+JSON.stringify({scenario,...data}));
const work=mkdtempSync(join(tmpdir(),'p1-workerd-'));
function wranglerApply(configPath,persist){const r=spawnSync(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','DB','--local','--persist-to',persist,'-c',configPath],{cwd:root,encoding:'utf8',env:{...process.env,CI:'1'}});return {status:r.status,out:(r.stdout||'')+(r.stderr||'')};}
function configFor(dir,migrationsDir){const p=join(dir,'wrangler.jsonc');writeFileSync(p,JSON.stringify({name:'r30-workerd',main:resolve(root,'src/worker.js'),compatibility_date:'2026-10-02',d1_databases:[{binding:'DB',database_name:'r30',database_id:'00000000-0000-0000-0000-000000000030',migrations_dir:migrationsDir}]}));return p;}
const all=readdirSync(resolve(root,'migrations')).filter(f=>f.endsWith('.sql')).sort();

const dir=join(work,'fresh'),persist=join(dir,'state');mkdirSync(dir,{recursive:true});const cfg=configFor(dir,resolve(root,'migrations'));
const ap=wranglerApply(cfg,persist);if(ap.status!==0)throw new Error('fresh apply failed\n'+ap.out);
const proxy=await getPlatformProxy({configPath:cfg,persist:{path:join(persist,'v3')}}),D1=proxy.env.DB;
let beforeCommit=null,barrier=null,lastArrivals=0,onPrecheck=null;const DB={prepare:(sql,...a)=>{const st=D1.prepare(sql,...a);if(onPrecheck&&/^SELECT 1 x FROM style_releases WHERE style_id=\? AND release_type='PRODUCTION'/.test(sql)){const f=onPrecheck;onPrecheck=null;return {bind:(...b)=>{const bound=st.bind(...b);return {first:async()=>{await f();return bound.first();},run:()=>bound.run(),all:()=>bound.all()}}}}return st;},batch:async list=>{if(barrier){barrier.arrived++;if(barrier.arrived===barrier.n)barrier.open();await barrier.gate;}const f=beforeCommit;beforeCommit=null;if(f)await f();return D1.batch(list);},exec:(...a)=>D1.exec(...a)};
const withBarrier=async(n,fn)=>{let open;barrier={n,arrived:0,gate:new Promise(r=>open=r)};barrier.open=open;try{return await fn()}finally{lastArrivals=barrier.arrived;barrier=null}};
const env={DB,UPLOADS:{put:async()=>({}),get:async()=>null},STATIC:{fetch:async()=>new Response('static')},SESSION_SECRET:'r29-workerd-secret',DEV_BOOTSTRAP_PASSWORD:'DevOnly!234',MOHSEN_BOOTSTRAP_PASSWORD:'MohsenOnly!234',LICENSE_MODE:'development'};
let cookie='';
async function call(path,{method='GET',body,headers={}}={}){const h={...headers};if(body!==undefined)h['content-type']='application/json';if(cookie)h.cookie=cookie;const r=await worker.fetch(new Request('http://local'+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}),env);const ct=r.headers.get('content-type')||'';return {r,data:ct.includes('json')?await r.json():await r.text()};}
const q1=(sql,...b)=>D1.prepare(sql).bind(...b).first(),run=(sql,...b)=>D1.prepare(sql).bind(...b).run();
let x=await call('/api/health');ok(x.r.status===200&&x.data.schemaVersion==='24','P1-W01 worker on wrangler-migrated workerd D1 (0001..0022) reports schema 24');
x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:env.DEV_BOOTSTRAP_PASSWORD}});cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN');
const {buildReleaseCandidate}=await import('./release_fixture.mjs');
async function seedReady(id){const ts=new Date().toISOString(),next=Number((await q1('SELECT COALESCE(MAX(version_no),0)+1 n FROM style_versions WHERE style_id=?',id)).n);
 await D1.batch([D1.prepare("UPDATE measurements SET tolerance_plus=COALESCE(tolerance_plus,1),tolerance_minus=COALESCE(tolerance_minus,1) WHERE style_id=?").bind(id),
  D1.prepare("INSERT OR REPLACE INTO fabric_specifications(id,style_id,code,name_en,composition,construction,width_cm,usable_width_cm,purchase_unit,cutting_unit,shrinkage_warp_pct,defect_allowance_pct,direction_rule,state,created_at,updated_at) VALUES(?,?,'F1','Shell','100% Cotton','Twill',150,140,'m','m',2,1,'TWO_WAY','APPROVED',?,?)").bind('fab_'+id,id,ts,ts),
  D1.prepare("INSERT OR REPLACE INTO trim_specifications(id,style_id,code,trim_type,name_en,placement,quantity,unit,state,created_at,updated_at) VALUES(?,?,'T1','BUTTON','Button','Front',5,'pcs','APPROVED',?,?)").bind('trm_'+id,id,ts,ts),
  D1.prepare("INSERT OR REPLACE INTO pattern_piece_specs(id,style_id,code,name_en,size_code,cut_qty,material_code,grain_direction,seam_allowance_cm,state,created_at,updated_at) VALUES(?,?,'PC1','Front','M',2,'F1','STRAIGHT',1,'APPROVED',?,?)").bind('ppc_'+id,id,ts,ts),
  D1.prepare("INSERT OR REPLACE INTO marker_plans(id,style_id,code,fabric_code,size_ratio_json,marker_length_m,usable_width_cm,plies,wastage_pct,layout_json,state,created_at,updated_at) VALUES(?,?,'MK1','F1','{\"M\":1}',2.5,140,10,3,'{\"direction\":\"TWO_WAY\"}','APPROVED',?,?)").bind('mrk_'+id,id,ts,ts),
  D1.prepare("INSERT OR REPLACE INTO routing_steps(id,style_id,code,sequence_no,department,name_en,machine,qc_checkpoint,state,created_at,updated_at) VALUES(?,?,'R1',1,'SEWING','Assembly','SN','Seam check','APPROVED',?,?)").bind('rte_'+id,id,ts,ts),
  D1.prepare("INSERT OR REPLACE INTO sample_rounds(id,style_id,version_no,round_no,sample_type,status,spec_snapshot_json,created_by,created_at,updated_at) VALUES(?,?,?,?,'PP','APPROVED','{}','fixture',?,?)").bind('smp_pp_'+id+'_'+next,id,next,900+next,ts,ts)]);
 x=await call(`/api/styles/${id}/versions`,{method:'POST',body:{label:'workerd candidate'}});return x.data.versionNo;}
let n=0;const ready=async()=>{const id=await buildReleaseCandidate(call,org,`WRK-${++n}`);return {id,v:await seedReady(id)};};
const counts=async id=>({releases:(await q1('SELECT COUNT(*) n FROM style_releases WHERE style_id=?',id)).n,receipts:(await q1('SELECT COUNT(*) n FROM release_receipts WHERE style_id=?',id)).n,audits:(await q1("SELECT COUNT(*) n FROM audit_log WHERE entity_type='RELEASE' AND action='CREATE'")).n,status:(await q1('SELECT status FROM styles WHERE id=?',id)).status});
const rel=(id,body,key)=>call(`/api/styles/${id}/releases`,{method:'POST',body,headers:key?{'idempotency-key':key}:{}});
const tally=a=>a.reduce((o,s)=>(o[s]=(o[s]||0)+1,o),{});
const devH=await q1("SELECT id,password_hash,password_salt FROM users WHERE email='dev@sehha.local'");
async function user(idv,role,orgId){await run('INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)',idv,idv+'@p1w.local',idv,devH.password_hash,devH.password_salt,new Date().toISOString());if(role)await run('INSERT INTO memberships(user_id,org_id,role) VALUES(?,?,?)',idv,orgId,role);
  const keep=cookie;cookie='';const l=await call('/api/auth/login',{method:'POST',body:{email:idv+'@p1w.local',password:env.DEV_BOOTSTRAP_PASSWORD}});cookie=keep;return (l.r.headers.get('set-cookie')||'').split(';')[0];}
const U={rm:await user('w_rm','RELEASE_MANAGER',org.id),eng:await user('w_eng','DESIGN_PATTERN_MASTER',org.id),prod:await user('w_prod','FACTORY_SUPERVISOR',org.id),qc:await user('w_qc','QC_MANAGER',org.id),fs:await user('w_fs','FACTORY_SUPERVISOR',org.id)};
const ROLES={w_rm:'RELEASE_MANAGER',w_eng:'DESIGN_PATTERN_MASTER',w_prod:'FACTORY_SUPERVISOR',w_qc:'QC_MANAGER',w_fs:'FACTORY_SUPERVISOR'};
const restore=async()=>{for(const [u,r] of Object.entries(ROLES)){await run('UPDATE memberships SET role=? WHERE user_id=? AND org_id=?',r,u,org.id);await run('UPDATE users SET active=1 WHERE id=?',u);}};
const as=async(c,path,{body={},key}={})=>{const keep=cookie;cookie=c;try{return await call(path,{method:'POST',body,headers:key?{'idempotency-key':key}:{}})}finally{cookie=keep}};
const getAs=async(c,path)=>{const keep=cookie;cookie=c;try{return await call(path)}finally{cookie=keep}};
const hcounts=async id=>({handoffs:(await q1('SELECT COUNT(*) n FROM factory_handoffs WHERE style_id=?',id)).n,events:(await q1('SELECT COUNT(*) n FROM factory_handoff_events e JOIN factory_handoffs h ON h.id=e.handoff_id WHERE h.style_id=?',id)).n,receipts:(await q1('SELECT COUNT(*) n FROM handoff_receipts r JOIN factory_handoffs h ON h.id=r.handoff_id WHERE h.style_id=?',id)).n,audits:(await q1("SELECT COUNT(*) n FROM audit_log WHERE entity_type='FACTORY_HANDOFF' AND entity_id IN (SELECT id FROM factory_handoffs WHERE style_id=?)",id)).n,state:(await q1('SELECT group_concat(status) s FROM factory_handoffs WHERE style_id=?',id)).s});
async function released(){const {id}=await ready().then(async r=>{const ts=new Date().toISOString();await run("INSERT INTO assets(id,style_id,role,filename,stored_name,mime_type,created_at) VALUES(?,?,'HERO','hero.png','hero.png','image/png',?)",'ast_'+r.id,r.id,ts);
   for(const [k,v] of [['fit','Regular fit — fixture approved'],['fabric','Cotton twill — fixture approved']])await run("INSERT INTO dna_items(id,style_id,field_key,field_label,value_text,provenance,state,created_at,updated_at) VALUES(?,?,?,?,?,'USER_CONFIRMED','APPROVED',?,?)",`dna_${k}_${r.id}`,r.id,k,k,v,ts,ts);return r;});
  const v=await seedReady(id);const r=await as(U.rm,`/api/styles/${id}/releases`,{body:{releaseType:'PRODUCTION',sourceVersionNo:v}});if(r.r.status!==201)throw new Error('release '+JSON.stringify(r.data));
  for(const [roleKey,c] of [['DESIGN',U.eng],['PATTERN',U.eng],['PRODUCTION',U.prod],['QC',U.qc]]){const s=await as(c,`/api/styles/${id}/releases/${r.data.releaseNo}/signoffs`,{body:{roleKey,decision:'APPROVED'}});if(s.r.status!==200)throw new Error('signoff '+roleKey);}
  return {id,n:r.data.releaseNo};}


const facts=async id=>{const all=async(q)=>(await D1.prepare(q).bind(id).all()).results;return {handoffs:await all('SELECT * FROM factory_handoffs WHERE style_id=? ORDER BY id'),events:await all('SELECT e.* FROM factory_handoff_events e JOIN factory_handoffs h ON h.id=e.handoff_id WHERE h.style_id=? ORDER BY e.id'),
  receipts:await all('SELECT r.* FROM handoff_receipts r JOIN factory_handoffs h ON h.id=r.handoff_id WHERE h.style_id=? ORDER BY r.id'),hAudits:await all("SELECT a.* FROM audit_log a JOIN factory_handoffs h ON h.id=a.entity_id WHERE a.entity_type='FACTORY_HANDOFF' AND h.style_id=? ORDER BY a.id"),
  lots:await all('SELECT * FROM production_lots WHERE style_id=? ORDER BY id'),lotReceipts:await all('SELECT * FROM lot_receipts WHERE style_id=? ORDER BY id'),lotAudits:await all("SELECT a.* FROM audit_log a JOIN production_lots l ON l.id=a.entity_id WHERE a.entity_type='PRODUCTION_LOT' AND a.action='CREATE' AND l.style_id=? ORDER BY a.id")};};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),SQL_LEAK=/SQLITE|D1_ERROR|constraint|INSERT|audit_log|lot_receipts|INJECTED/i;
const prep=(s,key)=>as(U.rm,`/api/styles/${s.id}/releases/${s.n}/handoffs`,{key});
async function acked(){const s=await released(),p=await prep(s);await as(U.rm,`/api/styles/${s.id}/handoffs/${p.data.id}/dispatch`);const a=await as(U.fs,`/api/styles/${s.id}/handoffs/${p.data.id}/acknowledge`,{body:{note:'received'}});if(a.r.status!==200)throw new Error('ack');return {...s,hid:p.data.id};}
const lot=(s,body,key,c=U.fs)=>as(c,`/api/styles/${s.id}/production-lots`,{body:{releaseNo:s.n,...body},key});

// P1-W02 the independent P1-A reproduction on workerd D1.
{const s=await released(),before=await facts(s.id);beforeCommit=async()=>{await run("UPDATE memberships SET role='OPERATOR' WHERE user_id='w_qc' AND org_id=?",org.id);};const p=await prep(s,'p1w-02-prepare');const after=await facts(s.id);await restore();
 evidence('p1w-toctou-qc',{status:p.r.status,code:p.data.code,roleKey:p.data.roleKey,rowsUnchanged:same(before,after)});
 ok(p.r.status===409&&p.data.code==='SIGNOFF_SIGNER_INVALID'&&p.data.roleKey==='QC'&&same(before,after),'P1-W02 workerd D1: QC signer active but role QC_MANAGER→OPERATOR in the PREPARE commit window → 409, zero package/event/receipt/audit');}
// P1-W03 each required domain signer revoked in the window (engineering signer covers DESIGN+PATTERN here).
for(const [u,k] of [['w_eng','DESIGN'],['w_prod','PRODUCTION'],['w_qc','QC']]){const s=await released(),before=await facts(s.id);beforeCommit=async()=>{await run("UPDATE memberships SET role='STORE_CLERK' WHERE user_id=? AND org_id=?",u,org.id);};const p=await prep(s);const after=await facts(s.id);await restore();
 ok(p.r.status===409&&p.data.code==='SIGNOFF_SIGNER_INVALID'&&p.data.roleKey===k&&same(before,after),`P1-W03 workerd D1: ${k} signer role revoked in the window → 409 for ${k}, zero writes`);}
// P1-W04 actor capability revoked / changed in the window.
{const s=await released(),before=await facts(s.id);beforeCommit=async()=>{await run("UPDATE memberships SET role='OPERATOR' WHERE user_id='w_rm' AND org_id=?",org.id);};const p=await prep(s);const after=await facts(s.id);await restore();
 ok(p.r.status===403&&same(before,after),'P1-W04 workerd D1: preparer RELEASE_MANAGER→OPERATOR in the window → 403, zero writes');
 beforeCommit=async()=>{await run("UPDATE memberships SET role='WORKSPACE_OWNER' WHERE user_id='w_rm' AND org_id=?",org.id);};const p2=await prep(s);const after2=await facts(s.id);await restore();
 ok(p2.r.status===409&&p2.data.code==='AUTHORITY_CHANGED'&&same(before,after2),'P1-W04 workerd D1: preparer authority changed to another permitted role in the window → 409 AUTHORITY_CHANGED, zero writes');}
// P1-W05 valid control and DB-level guard.
{const s=await released(),p=await prep(s,'p1w-05-prepare'),f=await facts(s.id),hr=f.handoffs[0],pk=JSON.parse(hr.package_json);
 ok(p.r.status===201&&f.handoffs.length===1&&f.events.length===1&&f.receipts.length===1&&f.hAudits.length===1&&pk.signerAuthority.signers.length===4&&hr.signer_authority_sha256===pk.signerAuthority.sha256,'P1-W05 workerd D1: valid control → 201, one package/event/receipt/audit, signer authority frozen (column = package hash)');
 const relRow=await q1('SELECT id FROM style_releases WHERE style_id=? AND release_no=?',s.id,s.n);await as(U.rm,`/api/styles/${s.id}/handoffs/${p.data.id}/withdraw`,{body:{reason:'free the release for raw test'}});
 await run("UPDATE memberships SET role='STORE_CLERK' WHERE user_id='w_qc' AND org_id=?",org.id);let raw='';try{await run("INSERT INTO factory_handoffs(id,org_id,style_id,release_id,release_no,status,version,package_json,package_sha256,release_snapshot_sha256,signoffs_sha256,signer_authority_sha256,prepared_by,prepared_at,last_command_id,created_at,updated_at) VALUES('hof_w_raw',?,?,?,?,'PREPARED',1,'{}','x','x','x',?,'raw','t','c','t','t')",org.id,s.id,relRow.id,s.n,'a'.repeat(64));raw='inserted'}catch(e){raw=String(e.message)}await restore();
 ok(/HANDOFF_SIGNER_INELIGIBLE/.test(raw),'P1-W05 workerd D1: raw INSERT bypassing the Worker while QC signer is STORE_CLERK → RAISE HANDOFF_SIGNER_INELIGIBLE');}
// P1-W06 the independent P1-B reproduction: lost response + identical retry.
{const s=await acked(),body={lotCode:'W-LOT-1',plannedQty:20};const a=await lot(s,body,'p1w-06-open'),b=await lot(s,body,'p1w-06-open'),f=await facts(s.id);
 evidence('p1w-lot-replay',{first:a.r.status,retry:b.r.status,replayed:b.r.headers.get('idempotency-replayed'),lots:f.lots.length,receipts:f.lotReceipts.length,audits:f.lotAudits.length});
 ok(a.r.status===201&&b.r.status===201&&b.r.headers.get('idempotency-replayed')==='true'&&b.data.lot.id===a.data.lot.id&&f.lots.length===1&&f.lotReceipts.length===1&&f.lotAudits.length===1,'P1-W06 workerd D1: lot 201, identical retry with the same key → 201 replay of the same lot; 1 lot/receipt/audit (no 500)');
 const c=await lot(s,{...body,plannedQty:21},'p1w-06-open');ok(c.r.status===409&&c.data.code==='IDEMPOTENCY_KEY_REUSED'&&(await facts(s.id)).lots.length===1,'P1-W06 workerd D1: same key with a different plannedQty → 409 IDEMPOTENCY_KEY_REUSED, no write');}
// P1-W07 concurrency at the commit barrier: same key x12, different keys x12.
{const s=await acked();const rs=await withBarrier(12,()=>Promise.all(Array.from({length:12},()=>lot(s,{lotCode:'W-LOT-SAME',plannedQty:3},'p1w-07-same'))));const f=await facts(s.id);
 ok(rs.every(r=>r.r.status===201)&&new Set(rs.map(r=>r.data.lot.id)).size===1&&f.lots.length===1&&f.lotReceipts.length===1&&f.lotAudits.length===1,'P1-W07 workerd D1: 12 concurrent identical requests with one key → all 201, one lot id, 1 lot/receipt/audit');
 const s2=await acked();const rs2=await withBarrier(12,()=>Promise.all(Array.from({length:12},(_,i)=>lot(s2,{lotCode:'W-LOT-DIFF',plannedQty:3},`p1w-07-k${i}`))));const f2=await facts(s2.id),st=tally(rs2.map(r=>r.r.status+':'+(r.data.code||'')));
 evidence('p1w-lot-concurrency',{sameKey:tally(rs.map(r=>r.r.status)),differentKeys:st});
 ok(rs2.filter(r=>r.r.status===201).length===1&&rs2.filter(r=>r.r.status===409&&r.data.code==='LOT_CODE_EXISTS').length===11&&f2.lots.length===1&&f2.lotReceipts.length===1&&f2.lotAudits.length===1,'P1-W07 workerd D1: 12 concurrent same-body requests with 12 keys → one 201, eleven 409 LOT_CODE_EXISTS, no 500');}
// P1-W08 failure injection on each mandatory lot write.
for(const [stmt,when] of [['production_lots INSERT','BEFORE INSERT ON production_lots'],['lot_receipts INSERT','BEFORE INSERT ON lot_receipts'],['audit_log INSERT',"BEFORE INSERT ON audit_log WHEN NEW.entity_type='PRODUCTION_LOT'"]]){
 const s=await acked(),key=`p1w-08-${stmt.split(' ')[0]}`,body={lotCode:'W-INJ',plannedQty:4},before=await facts(s.id);await run(`CREATE TRIGGER inj_p1w ${when} BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END`);let r;try{r=await lot(s,body,key)}finally{await run('DROP TRIGGER inj_p1w')}
 const after=await facts(s.id),retry=await lot(s,body,key),f=await facts(s.id);evidence('p1w-lot-injection',{statement:stmt,status:r.r.status,code:r.data.code,rowsUnchanged:same(before,after),retry:retry.r.status,lots:f.lots.length,receipts:f.lotReceipts.length,audits:f.lotAudits.length});
 ok(r.r.status===500&&r.data.code==='LOT_COMMIT_FAILED'&&!SQL_LEAK.test(JSON.stringify(r.data))&&same(before,after)&&retry.r.status===201&&f.lots.length===1&&f.lotReceipts.length===1&&f.lotAudits.length===1,`P1-W08 workerd D1: abort at ${stmt} → sanitized 500, lot/receipt/audit rows byte-identical; retry commits once`);}
// P1-W09 upgrade with a schema-23 handoff: wrangler applies 0001..0021, a PREPARED handoff is written, then 0022 is applied.
{const d2=join(work,'upgrade'),mig=join(d2,'migrations'),pst=join(d2,'state');mkdirSync(mig,{recursive:true});for(const f of all.filter(f=>f<'0022'))copyFileSync(resolve(root,'migrations',f),join(mig,f));const c=configFor(d2,mig);let r=wranglerApply(c,pst);if(r.status!==0)throw new Error(r.out);
 let p=await getPlatformProxy({configPath:c,persist:{path:join(pst,'v3')}});const P=p.env.DB,t='2026-01-01T00:00:00.000Z';
 for(const q of ["INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES('o1','H','H','{}',?1)","INSERT INTO styles(id,org_id,code,name,created_by,created_at,updated_at) VALUES('s1','o1','H-1','H','u1',?1,?1)","INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES('r1','s1',1,'PRODUCTION','RELEASED',1,'t','{}','{}','{}','u1',?1)",
   "INSERT INTO factory_handoffs(id,org_id,style_id,release_id,release_no,status,version,package_json,package_sha256,release_snapshot_sha256,signoffs_sha256,prepared_by,prepared_at,last_command_id,created_at,updated_at) VALUES('hof_r30','o1','s1','r1',1,'PREPARED',1,'{}','p','q','g','u1',?1,'c1',?1,?1)"])await P.prepare(q).bind(t).run();
 const before=(await P.prepare('SELECT * FROM factory_handoffs').all()).results;await p.dispose();copyFileSync(resolve(root,'migrations','0022_handoff_authority_lot_receipts.sql'),join(mig,'0022_handoff_authority_lot_receipts.sql'));r=wranglerApply(c,pst);
 p=await getPlatformProxy({configPath:c,persist:{path:join(pst,'v3')}});const Q=p.env.DB,after=(await Q.prepare('SELECT * FROM factory_handoffs').all()).results,schema=(await Q.prepare("SELECT value FROM app_meta WHERE key='schema_version'").first()).value;
 let up='';try{await Q.prepare("UPDATE factory_handoffs SET status='HANDED_OFF',version=2,dispatched_by='u1',last_command_id='c2' WHERE id='hof_r30'").run()}catch(e){up=String(e.message)}
 let wd='';try{await Q.prepare("UPDATE factory_handoffs SET status='WITHDRAWN',version=2,withdrawn_by='u1',withdraw_reason='authority not proved',last_command_id='c3' WHERE id='hof_r30'").run();wd='allowed'}catch(e){wd=String(e.message)}
 const freshDdl=(await D1.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' ORDER BY type,name").all()).results,upDdl=(await Q.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'d1_migrations' ORDER BY type,name").all()).results;
 evidence('p1w-upgrade',{apply:r.status,schema,rowsIdentical:same(after.map(({signer_authority_sha256,...x})=>x),before),nullAuthority:after[0].signer_authority_sha256===null,dispatch:up.slice(0,80),withdraw:wd,ddlIdentical:same(freshDdl,upDdl)});
 ok(r.status===0&&schema==='24'&&same(after.map(({signer_authority_sha256,...x})=>x),before)&&after[0].signer_authority_sha256===null,'P1-W09 workerd D1: wrangler upgrade 23→24 keeps the schema-23 handoff byte-identical with NULL signer authority');
 ok(/HANDOFF_AUTHORITY_UNVERIFIED/.test(up)&&wd==='allowed','P1-W09 workerd D1: that unproven handoff cannot be dispatched (RAISE HANDOFF_AUTHORITY_UNVERIFIED) but can be withdrawn');
 ok(same(freshDdl,upDdl),'P1-W09 workerd D1: DDL after 21..23→24 upgrade is identical to a fresh 0001..0022 install');
 const again=wranglerApply(c,pst);ok(again.status===0&&/No migrations to apply/i.test(again.out),'P1-W09 workerd D1: re-running wrangler migrations is a no-op');await p.dispose();}
await proxy.dispose();rmSync(work,{recursive:true,force:true});
