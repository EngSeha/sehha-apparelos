// ROUND30 local Cloudflare runtime proof for the Factory Handoff: wrangler-applied migrations (schema 23) and the real
// worker code against a workerd-backed D1 binding (getPlatformProxy). Local workerd D1 only — NOT remote Cloudflare D1.
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,copyFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {getPlatformProxy} from 'wrangler';
import {ok,root} from './test_helpers.mjs';
import worker from '../src/worker.js';
const evidence=(scenario,data)=>console.log('EVIDENCE '+JSON.stringify({scenario,...data}));
const work=mkdtempSync(join(tmpdir(),'r30-workerd-'));
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
let x=await call('/api/health');ok(x.r.status===200&&x.data.schemaVersion==='23','R30-W1 worker on wrangler-migrated workerd D1 reports schema 23');
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
async function user(idv,role,orgId){await run('INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)',idv,idv+'@w30.local',idv,devH.password_hash,devH.password_salt,new Date().toISOString());if(role)await run('INSERT INTO memberships(user_id,org_id,role) VALUES(?,?,?)',idv,orgId,role);
  const keep=cookie;cookie='';const l=await call('/api/auth/login',{method:'POST',body:{email:idv+'@w30.local',password:env.DEV_BOOTSTRAP_PASSWORD}});cookie=keep;return (l.r.headers.get('set-cookie')||'').split(';')[0];}
const U={rm:await user('w_rm','RELEASE_MANAGER',org.id),eng:await user('w_eng','DESIGN_PATTERN_MASTER',org.id),prod:await user('w_prod','FACTORY_SUPERVISOR',org.id),qc:await user('w_qc','QC_MANAGER',org.id),fs:await user('w_fs','FACTORY_SUPERVISOR',org.id)};
const as=async(c,path,{body={},key}={})=>{const keep=cookie;cookie=c;try{return await call(path,{method:'POST',body,headers:key?{'idempotency-key':key}:{}})}finally{cookie=keep}};
const getAs=async(c,path)=>{const keep=cookie;cookie=c;try{return await call(path)}finally{cookie=keep}};
const hcounts=async id=>({handoffs:(await q1('SELECT COUNT(*) n FROM factory_handoffs WHERE style_id=?',id)).n,events:(await q1('SELECT COUNT(*) n FROM factory_handoff_events e JOIN factory_handoffs h ON h.id=e.handoff_id WHERE h.style_id=?',id)).n,receipts:(await q1('SELECT COUNT(*) n FROM handoff_receipts r JOIN factory_handoffs h ON h.id=r.handoff_id WHERE h.style_id=?',id)).n,audits:(await q1("SELECT COUNT(*) n FROM audit_log WHERE entity_type='FACTORY_HANDOFF' AND entity_id IN (SELECT id FROM factory_handoffs WHERE style_id=?)",id)).n,state:(await q1('SELECT group_concat(status) s FROM factory_handoffs WHERE style_id=?',id)).s});
async function released(){const {id}=await ready().then(async r=>{const ts=new Date().toISOString();await run("INSERT INTO assets(id,style_id,role,filename,stored_name,mime_type,created_at) VALUES(?,?,'HERO','hero.png','hero.png','image/png',?)",'ast_'+r.id,r.id,ts);
   for(const [k,v] of [['fit','Regular fit — fixture approved'],['fabric','Cotton twill — fixture approved']])await run("INSERT INTO dna_items(id,style_id,field_key,field_label,value_text,provenance,state,created_at,updated_at) VALUES(?,?,?,?,?,'USER_CONFIRMED','APPROVED',?,?)",`dna_${k}_${r.id}`,r.id,k,k,v,ts,ts);return r;});
  const v=await seedReady(id);const r=await as(U.rm,`/api/styles/${id}/releases`,{body:{releaseType:'PRODUCTION',sourceVersionNo:v}});if(r.r.status!==201)throw new Error('release '+JSON.stringify(r.data));
  for(const [roleKey,c] of [['DESIGN',U.eng],['PATTERN',U.eng],['PRODUCTION',U.prod],['QC',U.qc]]){const s=await as(c,`/api/styles/${id}/releases/${r.data.releaseNo}/signoffs`,{body:{roleKey,decision:'APPROVED'}});if(s.r.status!==200)throw new Error('signoff '+roleKey);}
  return {id,n:r.data.releaseNo};}

// W2 full lifecycle + replay on workerd D1.
{const s=await released();const p=await as(U.rm,`/api/styles/${s.id}/releases/${s.n}/handoffs`,{key:'w30-w2-prepare'});const p2=await as(U.rm,`/api/styles/${s.id}/releases/${s.n}/handoffs`,{key:'w30-w2-prepare'});
 const d=await as(U.rm,`/api/styles/${s.id}/handoffs/${p.data.id}/dispatch`,{key:'w30-w2-dispatch'});const a=await as(U.fs,`/api/styles/${s.id}/handoffs/${p.data.id}/acknowledge`,{body:{note:'received'},key:'w30-w2-ack'});const a2=await as(U.fs,`/api/styles/${s.id}/handoffs/${p.data.id}/acknowledge`,{body:{note:'received'},key:'w30-w2-ack'});
 const c=await hcounts(s.id),g=await getAs(U.rm,`/api/styles/${s.id}/handoffs/${p.data.id}/package`);
 ok(p.r.status===201&&p2.r.headers.get('idempotency-replayed')==='true'&&d.data.status==='HANDED_OFF'&&a.data.status==='ACKNOWLEDGED'&&a2.data.eventId===a.data.eventId&&c.events===3&&c.receipts===3&&c.audits===3,'R30-W2 prepare/dispatch/acknowledge with replays on workerd D1: 3 events, 3 receipts, 3 audits');
 ok(g.r.status===200&&g.r.headers.get('etag')===`"${p.data.packageSha256}"`,'R30-W2 frozen package served with ETag = stored SHA-256 on workerd D1');
 const lot=await as(U.fs,`/api/styles/${s.id}/production-lots`,{body:{releaseNo:s.n,lotCode:'W30-LOT',plannedQty:10}});ok(lot.r.status===201&&(await q1('SELECT handoff_id FROM production_lots WHERE id=?',lot.data.lot.id)).handoff_id===p.data.id,'R30-W2 lot opened only after ACK, carrying handoff provenance');
 let blocked=0;for(const sql of ["UPDATE factory_handoffs SET package_json='{}' WHERE id=?","DELETE FROM factory_handoffs WHERE id=?","UPDATE factory_handoff_events SET reason='x' WHERE handoff_id=?"]){try{await run(sql,p.data.id)}catch(e){if(/HANDOFF_/.test(e.message))blocked++}}
 ok(blocked===3,'R30-W2 handoff immutability triggers fire on workerd D1');evidence('W2',c);}
// W3 barrier races on workerd D1.
{const s=await released();const rs=await withBarrier(20,()=>Promise.all(Array.from({length:20},(_,i)=>as(U.rm,`/api/styles/${s.id}/releases/${s.n}/handoffs`,{key:`w30-w3-p-${String(i).padStart(3,'0')}`}))));const st=rs.map(r=>r.r.status),c=await hcounts(s.id);
 ok(lastArrivals===20&&st.filter(v=>v===201).length===1&&st.filter(v=>v===409).length===19&&!st.includes(500)&&c.handoffs===1&&c.events===1&&c.receipts===1,'R30-W3 20 concurrent prepares on workerd D1 (20/20 at commit): one package, 19×409, no 500');evidence('W3-prepare',{statuses:tally(st),codes:tally(rs.filter(r=>r.r.status===409).map(r=>r.data.code)),...c});
 const hid=(await q1('SELECT id FROM factory_handoffs WHERE style_id=?',s.id)).id;const rd=await withBarrier(20,()=>Promise.all(Array.from({length:20},(_,i)=>as(U.rm,`/api/styles/${s.id}/handoffs/${hid}/dispatch`,{key:`w30-w3-d-${String(i).padStart(3,'0')}`}))));const sd=rd.map(r=>r.r.status),c2=await hcounts(s.id);
 ok(lastArrivals===20&&sd.filter(v=>v===200).length===1&&sd.filter(v=>v===409).length===19&&!sd.includes(500)&&c2.events===2&&c2.receipts===2,'R30-W3 20 concurrent dispatches on workerd D1: one transition, 19×409, no 500');evidence('W3-dispatch',{statuses:tally(sd),codes:tally(rd.filter(r=>r.r.status===409).map(r=>r.data.code)),...c2});}
// W4 failure injection on workerd D1.
for(const [label,ddl,stage] of [['factory_handoffs INSERT',"CREATE TRIGGER inj BEFORE INSERT ON factory_handoffs BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'prepare'],['factory_handoff_events INSERT',"CREATE TRIGGER inj BEFORE INSERT ON factory_handoff_events BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'prepare'],['handoff_receipts INSERT',"CREATE TRIGGER inj BEFORE INSERT ON handoff_receipts BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'dispatch'],['audit_log INSERT',"CREATE TRIGGER inj BEFORE INSERT ON audit_log WHEN NEW.entity_type='FACTORY_HANDOFF' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'dispatch'],['factory_handoffs UPDATE',"CREATE TRIGGER inj BEFORE UPDATE ON factory_handoffs BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",'dispatch']]){
 const s=await released();let hid=null;if(stage==='dispatch')hid=(await as(U.rm,`/api/styles/${s.id}/releases/${s.n}/handoffs`)).data.id;const before=await hcounts(s.id);await run(ddl);
 const r=stage==='prepare'?await as(U.rm,`/api/styles/${s.id}/releases/${s.n}/handoffs`,{key:'w30-w4-'+label.replace(/\W/g,'')}):await as(U.rm,`/api/styles/${s.id}/handoffs/${hid}/dispatch`,{key:'w30-w4-'+label.replace(/\W/g,'')});await run('DROP TRIGGER inj');const after=await hcounts(s.id);
 ok(r.r.status===500&&r.data.code==='HANDOFF_COMMIT_FAILED'&&!/INJECTED|SQLITE|D1_ERROR/.test(JSON.stringify(r.data))&&JSON.stringify(before)===JSON.stringify(after),`R30-W4 workerd D1 failure at ${label} (${stage}): full rollback, sanitized 500`);evidence('W4',{injectedAt:label,stage,before,after});}
// W5 commit-window drift on workerd D1: acknowledger membership removed between evaluation and commit.
{const s=await released();const hid=(await as(U.rm,`/api/styles/${s.id}/releases/${s.n}/handoffs`)).data.id;await as(U.rm,`/api/styles/${s.id}/handoffs/${hid}/dispatch`);const before=await hcounts(s.id);
 beforeCommit=()=>run("DELETE FROM memberships WHERE user_id='w_fs'");const r=await as(U.fs,`/api/styles/${s.id}/handoffs/${hid}/acknowledge`);const after=await hcounts(s.id);await run("INSERT INTO memberships(user_id,org_id,role) VALUES('w_fs',?,'FACTORY_SUPERVISOR')",org.id);
 ok(r.r.status===403&&r.data.code==='FORBIDDEN_ACTOR'&&JSON.stringify(before)===JSON.stringify(after),'R30-W5 membership removed inside the commit window on workerd D1: 403, nothing written');evidence('W5',{code:r.data.code,before,after});}
// W6 real upgrade 22 -> 23 via wrangler over legacy facts, and a schema-23 Worker on a schema-22 D1 fails closed.
{const d=join(work,'upgrade30'),mig=join(d,'migrations'),pst=join(d,'state');mkdirSync(mig,{recursive:true});for(const f of all.filter(f=>f<'0021'))copyFileSync(resolve(root,'migrations',f),join(mig,f));
 const c=configFor(d,mig);let r=wranglerApply(c,pst);if(r.status!==0)throw new Error('baseline apply failed\n'+r.out);
 let p=await getPlatformProxy({configPath:c,persist:{path:join(pst,'v3')}});const ts=new Date().toISOString();
 for(const k of [1,2])await p.env.DB.prepare("INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,?,'PRODUCTION','RELEASED',1,'t','{}','{}','{}','u',?)").bind('legacy'+k,'sty_old',k,ts).run();
 await p.env.DB.prepare("INSERT INTO production_lots(id,style_id,release_no,lot_code,planned_qty,status,planning_basis_json,planning_basis_sha256,created_by,created_at,updated_at) VALUES('lot_old','sty_old',1,'L1',10,'RELEASED','{}','x','u',?,?)").bind(ts,ts).run();
 const old=await worker.fetch(new Request('http://local/api/styles'),{...env,DB:p.env.DB});const ob=await old.json();
 const rb=(await p.env.DB.prepare('SELECT * FROM style_releases ORDER BY id').all()).results,lb=(await p.env.DB.prepare('SELECT * FROM production_lots').all()).results;await p.dispose();
 copyFileSync(resolve(root,'migrations','0021_factory_handoff.sql'),join(mig,'0021_factory_handoff.sql'));r=wranglerApply(c,pst);
 p=await getPlatformProxy({configPath:c,persist:{path:join(pst,'v3')}});const ra=(await p.env.DB.prepare('SELECT * FROM style_releases ORDER BY id').all()).results,la=(await p.env.DB.prepare('SELECT * FROM production_lots').all()).results;
 const schema=(await p.env.DB.prepare("SELECT value FROM app_meta WHERE key='schema_version'").first()).value,trg=(await p.env.DB.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger' AND (name LIKE 'trg_factory_handoff%' OR name LIKE 'trg_handoff_receipts%' OR name LIKE 'trg_release_signoffs_frozen%')").first()).n;
 ok(old.status===503&&/22/.test(ob.error),'R30-W6 schema-23 Worker against a wrangler-migrated schema-22 D1 fails closed (503)');
 ok(r.status===0&&schema==='23'&&trg===11&&JSON.stringify(ra)===JSON.stringify(rb)&&JSON.stringify(la.map(({handoff_id,...x})=>x))===JSON.stringify(lb)&&la[0].handoff_id===null,'R30-W6 wrangler upgrade 22→23 on workerd D1 keeps legacy releases and lots intact; 11 triggers present');
 const again=wranglerApply(c,pst);ok(again.status===0&&/No migrations to apply/i.test(again.out),'R30-W6 re-running wrangler migrations is a no-op');await p.dispose();}
await proxy.dispose();rmSync(work,{recursive:true,force:true});
