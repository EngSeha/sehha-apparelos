// ROUND29 local Cloudflare runtime proof: migrations applied by `wrangler d1 migrations apply --local` and the real
// worker code executed against a workerd-backed D1 binding (getPlatformProxy). This is local workerd/Miniflare D1,
// NOT remote Cloudflare D1. Not part of the aggregate runner because it needs the workerd binary and ~1 min.
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,copyFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {getPlatformProxy} from 'wrangler';
import {ok,root} from './test_helpers.mjs';
import worker from '../src/worker.js';
const evidence=(scenario,data)=>console.log('EVIDENCE '+JSON.stringify({scenario,...data}));
const work=mkdtempSync(join(tmpdir(),'r29-workerd-'));
function wranglerApply(configPath,persist){const r=spawnSync(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','DB','--local','--persist-to',persist,'-c',configPath],{cwd:root,encoding:'utf8',env:{...process.env,CI:'1'}});return {status:r.status,out:(r.stdout||'')+(r.stderr||'')};}
function configFor(dir,migrationsDir){const p=join(dir,'wrangler.jsonc');writeFileSync(p,JSON.stringify({name:'r29-workerd',main:resolve(root,'src/worker.js'),compatibility_date:'2026-10-02',d1_databases:[{binding:'DB',database_name:'r29',database_id:'00000000-0000-0000-0000-000000000029',migrations_dir:migrationsDir}]}));return p;}
const all=readdirSync(resolve(root,'migrations')).filter(f=>f.endsWith('.sql')).sort();

// W1 real upgrade path: 0001..0019 applied, historical duplicate PRODUCTION rows written, then 0020 applied by wrangler.
{const dir=join(work,'upgrade'),mig=join(dir,'migrations'),persist=join(dir,'state');mkdirSync(mig,{recursive:true});for(const f of all.filter(f=>f<'0020'))copyFileSync(resolve(root,'migrations',f),join(mig,f));
 const cfg=configFor(dir,mig);let r=wranglerApply(cfg,persist);if(r.status!==0)throw new Error('baseline apply failed\n'+r.out);
 let p=await getPlatformProxy({configPath:cfg,persist:{path:join(persist,'v3')}});const ts=new Date().toISOString();
 for(const n of [1,2])await p.env.DB.prepare("INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,?,'PRODUCTION','RELEASED',1,'t','{}','{}','{}','u',?)").bind('legacy'+n,'sty_old',n,ts).run();
 const before=(await p.env.DB.prepare('SELECT * FROM style_releases ORDER BY id').all()).results;await p.dispose();
 copyFileSync(resolve(root,'migrations','0020_release_atomicity.sql'),join(mig,'0020_release_atomicity.sql'));r=wranglerApply(cfg,persist);
 p=await getPlatformProxy({configPath:cfg,persist:{path:join(persist,'v3')}});const after=(await p.env.DB.prepare('SELECT id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,note,created_by,created_at FROM style_releases ORDER BY id').all()).results;
 const schema=(await p.env.DB.prepare("SELECT value FROM app_meta WHERE key='schema_version'").first()).value,objs=(await p.env.DB.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('release_receipts','uq_style_releases_production_candidate','trg_style_releases_contract_immutable','trg_style_releases_contract_no_delete','trg_release_receipts_immutable','trg_release_receipts_no_delete','trg_style_versions_snapshot_immutable')").first()).n;
 ok(r.status===0&&schema==='22'&&objs===7&&JSON.stringify(before)===JSON.stringify(after),'R29-W1 wrangler local upgrade 21→22 over historical duplicate PRODUCTION rows; rows unchanged; 7 objects present');
 const again=wranglerApply(cfg,persist);ok(again.status===0&&/No migrations to apply/i.test(again.out),'R29-W1 re-running wrangler migrations is a no-op (applied migrations are recorded)');await p.dispose();}

// W2.. full release flow on a fresh wrangler-migrated workerd D1.
const dir=join(work,'fresh'),persist=join(dir,'state');mkdirSync(dir,{recursive:true});const cfg=configFor(dir,resolve(root,'migrations'));
const ap=wranglerApply(cfg,persist);if(ap.status!==0)throw new Error('fresh apply failed\n'+ap.out);
const proxy=await getPlatformProxy({configPath:cfg,persist:{path:join(persist,'v3')}}),D1=proxy.env.DB;
let beforeCommit=null,barrier=null,lastArrivals=0,onPrecheck=null;const DB={prepare:(sql,...a)=>{const st=D1.prepare(sql,...a);if(onPrecheck&&/^SELECT 1 x FROM style_releases WHERE style_id=\? AND release_type='PRODUCTION'/.test(sql)){const f=onPrecheck;onPrecheck=null;return {bind:(...b)=>{const bound=st.bind(...b);return {first:async()=>{await f();return bound.first();},run:()=>bound.run(),all:()=>bound.all()}}}}return st;},batch:async list=>{if(barrier){barrier.arrived++;if(barrier.arrived===barrier.n)barrier.open();await barrier.gate;}const f=beforeCommit;beforeCommit=null;if(f)await f();return D1.batch(list);},exec:(...a)=>D1.exec(...a)};
const withBarrier=async(n,fn)=>{let open;barrier={n,arrived:0,gate:new Promise(r=>open=r)};barrier.open=open;try{return await fn()}finally{lastArrivals=barrier.arrived;barrier=null}};
const env={DB,UPLOADS:{put:async()=>({}),get:async()=>null},STATIC:{fetch:async()=>new Response('static')},SESSION_SECRET:'r29-workerd-secret',DEV_BOOTSTRAP_PASSWORD:'DevOnly!234',MOHSEN_BOOTSTRAP_PASSWORD:'MohsenOnly!234',LICENSE_MODE:'development'};
let cookie='';
async function call(path,{method='GET',body,headers={}}={}){const h={...headers};if(body!==undefined)h['content-type']='application/json';if(cookie)h.cookie=cookie;const r=await worker.fetch(new Request('http://local'+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}),env);const ct=r.headers.get('content-type')||'';return {r,data:ct.includes('json')?await r.json():await r.text()};}
const q1=(sql,...b)=>D1.prepare(sql).bind(...b).first(),run=(sql,...b)=>D1.prepare(sql).bind(...b).run();
let x=await call('/api/health');ok(x.r.status===200&&x.data.schemaVersion==='23','R29-W2 worker on workerd D1 reports the current schema (23)');
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

{const {id,v}=await ready();x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},'wrk-w3-key-0001');const c=await counts(id);
 ok(x.r.status===201&&x.data.gate.engineering.basis==='FROZEN_STYLE_VERSION'&&c.releases===1&&c.receipts===1&&c.status==='PRODUCTION_RELEASED','R29-W3 production release commits release+receipt+status+audit on workerd D1');
 const y=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},'wrk-w3-key-0001');ok(y.r.status===201&&y.r.headers.get('idempotency-replayed')==='true'&&y.data.id===x.data.id&&JSON.stringify(await counts(id))===JSON.stringify(c),'R29-W3 same-key replay on workerd D1 adds nothing');
 const z=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v,note:'changed'},'wrk-w3-key-0001');ok(z.r.status===409&&z.data.code==='IDEMPOTENCY_KEY_REUSED','R29-W3 same key + different payload is 409 on workerd D1');
 let blocked=0;for(const sql of ["UPDATE style_releases SET snapshot_json='{}' WHERE id=?","DELETE FROM style_releases WHERE id=?","UPDATE release_receipts SET response_json='{}' WHERE release_id=?"]){try{await run(sql,x.data.id)}catch(e){if(/IMMUTABLE/.test(e.message))blocked++}}
 ok(blocked===3,'R29-W3 immutability triggers fire on workerd D1');evidence('W3',c);}
{const {id,v}=await ready();const a0=(await counts(id)).audits;const rs=await Promise.all(Array.from({length:25},(_,i)=>rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},`wrk-w4-${String(i).padStart(3,'0')}`)));const st=rs.map(r=>r.r.status),c=await counts(id);
 ok(st.filter(s=>s===201).length===1&&!st.includes(500)&&c.releases===1&&c.receipts===1&&c.audits===a0+1,'R29-W4 25 concurrent different-key requests on workerd D1: one commit, no 500');evidence('W4',{statuses:tally(st),codes:tally(rs.filter(r=>r.r.status===409).map(r=>r.data.code)),...c});}
{const {id,v}=await ready();const rs=await Promise.all(Array.from({length:25},()=>rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},'wrk-w5-same-key')));const st=rs.map(r=>r.r.status),c=await counts(id);
 ok(c.releases===1&&c.receipts===1&&rs.every(r=>r.r.status===201&&r.data.id===rs[0].data.id),'R29-W5 25 concurrent same-key requests on workerd D1: one release, identical responses');evidence('W5',{statuses:tally(st),replayed:rs.filter(r=>r.r.headers.get('idempotency-replayed')).length,...c});}
{const {id,v}=await ready();const a0=(await counts(id)).audits;const rs=await withBarrier(25,()=>Promise.all(Array.from({length:25},(_,i)=>rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},`wrk-w8-${String(i).padStart(3,'0')}`))));const st=rs.map(r=>r.r.status),c=await counts(id);
 ok(lastArrivals===25&&st.filter(s=>s===201).length===1&&st.filter(s=>s===409).length===24&&!st.includes(500)&&c.releases===1&&c.receipts===1&&c.audits===a0+1,'R29-W8 barrier race on workerd D1 (25/25 at commit): in-transaction guard admits exactly one, 24×409, no 500');evidence('W8',{arrivals:lastArrivals,statuses:tally(st),codes:tally(rs.filter(r=>r.r.status===409).map(r=>r.data.code)),...c});}
{const {id,v}=await ready();const key='wrk-w9-interleave',body={releaseType:'PRODUCTION',sourceVersionNo:v};let a=null;onPrecheck=async()=>{a=await rel(id,body,key)};const b=await rel(id,body,key);onPrecheck=null;const c=await counts(id);
 evidence('W9',{a:a?.r.status,b:b.r.status,bCode:b.data.code||null,...c});
 ok(a?.r.status===201&&b.r.status===201&&b.data.id===a.data.id&&b.r.headers.get('idempotency-replayed')==='true'&&c.releases===1&&c.receipts===1,'R29-W9 same-key request overtaken by the original before its pre-check replays the original on workerd D1');}
for(const [label,ddl] of [['style_releases INSERT',"CREATE TRIGGER inj BEFORE INSERT ON style_releases BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END"],['release_receipts INSERT',"CREATE TRIGGER inj BEFORE INSERT ON release_receipts BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END"],['styles UPDATE',"CREATE TRIGGER inj BEFORE UPDATE OF status ON styles WHEN NEW.status='PRODUCTION_RELEASED' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END"],['audit_log INSERT',"CREATE TRIGGER inj BEFORE INSERT ON audit_log WHEN NEW.entity_type='RELEASE' BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END"]]){
 const {id,v}=await ready();const before=await counts(id);await run(ddl);x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},'wrk-w6-'+label.replace(/\W/g,''));await run('DROP TRIGGER inj');const after=await counts(id);
 ok(x.r.status===500&&x.data.code==='RELEASE_COMMIT_FAILED'&&!/INJECTED|SQLITE|D1_ERROR/.test(JSON.stringify(x.data))&&JSON.stringify(before)===JSON.stringify(after),`R29-W6 workerd D1 failure at ${label}: full rollback, sanitized 500`);evidence('W6',{injectedAt:label,before,after});}
for(let [label,mutate,code,status] of [['new Style Version created',id=>run("INSERT INTO style_versions(id,style_id,version_no,label,snapshot_json,created_by,created_at) VALUES(?,?,(SELECT MAX(version_no)+1 FROM style_versions WHERE style_id=?),'race','{}','race',?)",'ver_race_'+id,id,id,new Date().toISOString()),'STALE_CANDIDATE',409],
  ['membership of actor removed',async()=>{},'FORBIDDEN_ACTOR',403]]){
 const {id,v}=await ready();let actorCookie=null;
 if(label.startsWith('membership')){const dev=await q1("SELECT password_hash,password_salt FROM users WHERE email='dev@sehha.local'");await run("INSERT INTO users(id,email,display_name,password_hash,password_salt,is_platform_admin,active,created_at) VALUES('u_wrk','u_wrk@r29.local','u_wrk',?,?,0,1,?)",dev.password_hash,dev.password_salt,new Date().toISOString());await run("INSERT INTO memberships(user_id,org_id,role) VALUES('u_wrk',?,'DESIGN_PATTERN_MASTER')",org.id);const keep=cookie;cookie='';const l=await call('/api/auth/login',{method:'POST',body:{email:'u_wrk@r29.local',password:env.DEV_BOOTSTRAP_PASSWORD}});actorCookie=(l.r.headers.get('set-cookie')||'').split(';')[0];cookie=keep;mutate=()=>run("DELETE FROM memberships WHERE user_id='u_wrk'");}
 const before=await counts(id);beforeCommit=()=>mutate(id);const keep=cookie;if(actorCookie)cookie=actorCookie;x=await rel(id,{releaseType:'PRODUCTION',sourceVersionNo:v},'wrk-w7-'+label.replace(/\W/g,''));cookie=keep;const after=await counts(id);
 ok(x.r.status===status&&x.data.code===code&&after.releases===before.releases&&after.receipts===before.receipts,`R29-W7 workerd D1 commit-window drift (${label}): ${status} ${code}, nothing written`);evidence('W7',{drift:label,code:x.data.code,before,after});}
await proxy.dispose();rmSync(work,{recursive:true,force:true});
