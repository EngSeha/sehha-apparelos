import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';
const _consoleError=console.error;console.error=(...args)=>{if(process.env.VERBOSE_TEST==='1')_consoleError(...args)};
export const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
export function makeHarness(){
 const migrations=['0001_init.sql','0002_ai_review_pattern.sql','0003_mohsen_master_bilingual.sql','0004_pattern_intelligence_grading.sql','0005_release_workflow.sql','0006_factory_collaboration.sql','0007_requirements_matrix.sql','0008_sample_fit_validation.sql','0009_costing_consumption.sql','0010_production_quality.sql','0011_production_planning.sql','0012_frozen_planning_basis.sql','0013_factory_operation_execution.sql','0014_reconciliation_concurrency.sql','0015_full_actual_cost.sql','0016_engineering_foundation.sql','0017_human_experience.sql','0018_human_qc.sql','0019_human_store.sql','0020_release_atomicity.sql','0021_factory_handoff.sql'];
 const db=new DatabaseSync(':memory:'); for(const f of migrations) db.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
 class D1Mock{constructor(db){this.db=db}batch(list){this.db.exec('BEGIN');try{const out=list.map(x=>x.run());this.db.exec('COMMIT');return out}catch(e){this.db.exec('ROLLBACK');throw e}}prepare(sql){const st=this.db.prepare(sql);return{bind:(...args)=>{const vals=args.map(v=>v===undefined?null:v);return{first:()=>st.get(...vals)||null,all:()=>({results:st.all(...vals)}),run:()=>{const r=st.run(...vals);return{success:true,meta:{changes:Number(r.changes||0)}}}}}}}}
 class R2Object{constructor(bytes,meta={}){this.bytes=bytes;this.meta=meta;this.httpEtag='test';this.body=bytes}async arrayBuffer(){return this.bytes.buffer.slice(this.bytes.byteOffset,this.bytes.byteOffset+this.bytes.byteLength)}writeHttpMetadata(h){if(this.meta?.httpMetadata?.contentType)h.set('content-type',this.meta.httpMetadata.contentType)}}
 class R2Mock{constructor(){this.map=new Map()}async put(k,bytes,meta){this.map.set(k,new R2Object(new Uint8Array(bytes),meta));return{}}async get(k){return this.map.get(k)||null}}
 const STATIC={fetch:async()=>new Response('static')};
 const env={DB:new D1Mock(db),UPLOADS:new R2Mock(),STATIC,SESSION_SECRET:'b13-secret',DEV_BOOTSTRAP_PASSWORD:'DevOnly!234',MOHSEN_BOOTSTRAP_PASSWORD:'MohsenOnly!234',LICENSE_MODE:'development'};let cookie='';
 async function call(path,{method='GET',body,cookieOverride,headers:extraHeaders={}}={}){const headers={...extraHeaders};if(body!==undefined)headers['content-type']='application/json';const c=cookieOverride===undefined?cookie:cookieOverride;if(c)headers.cookie=c;const r=await worker.fetch(new Request('http://local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);const ct=r.headers.get('content-type')||'';const data=ct.includes('json')?await r.json():await r.text();return{r,data}}
 async function login(){const x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''}); if(x.r.status!==200)throw new Error('login failed');cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];return x;}
 return {db,env,call,login,get cookie(){return cookie}};
}
export function ok(c,m){if(!c)throw new Error('ASSERT: '+m);console.log('PASS',m)}
// Fixture: a fully approved engineering bundle so legacy production-release scenarios satisfy the engineering readiness gate.
// Direct DB seeding is a fixture shortcut only; production code paths go through the approval API.
export function seedEngineeringReady(db,styleId,{skip=[]}={}){
 const ts=new Date().toISOString(),has=k=>!skip.includes(k);
 db.prepare("UPDATE styles SET base_size=COALESCE(base_size,'M') WHERE id=?").run(styleId);
 db.prepare("UPDATE measurements SET tolerance_plus=COALESCE(tolerance_plus,1),tolerance_minus=COALESCE(tolerance_minus,1) WHERE style_id=?").run(styleId);
 db.prepare("UPDATE bom_items SET qty=COALESCE(qty,1) WHERE style_id=?").run(styleId);
 if(has('fabric'))db.prepare("INSERT OR REPLACE INTO fabric_specifications(id,style_id,code,name_en,composition,construction,width_cm,usable_width_cm,purchase_unit,cutting_unit,shrinkage_warp_pct,defect_allowance_pct,direction_rule,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('fab_'+styleId,styleId,'F1','Shell','100% Cotton','Twill',150,140,'m','m',2,1,'TWO_WAY','APPROVED',ts,ts);
 if(has('trim'))db.prepare("INSERT OR REPLACE INTO trim_specifications(id,style_id,code,trim_type,name_en,placement,quantity,unit,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run('trm_'+styleId,styleId,'T1','BUTTON','Button','Front',5,'pcs','APPROVED',ts,ts);
 if(has('pattern'))db.prepare("INSERT OR REPLACE INTO pattern_piece_specs(id,style_id,code,name_en,size_code,cut_qty,material_code,grain_direction,seam_allowance_cm,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run('ppc_'+styleId,styleId,'PC1','Front','M',2,'F1','STRAIGHT',1,'APPROVED',ts,ts);
 if(has('marker'))db.prepare("INSERT OR REPLACE INTO marker_plans(id,style_id,code,fabric_code,size_ratio_json,marker_length_m,usable_width_cm,plies,wastage_pct,layout_json,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run('mrk_'+styleId,styleId,'MK1','F1','{"M":1}',2.5,140,10,3,'{"direction":"TWO_WAY"}','APPROVED',ts,ts);
 if(has('routing'))db.prepare("INSERT OR REPLACE INTO routing_steps(id,style_id,code,sequence_no,department,name_en,machine,qc_checkpoint,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run('rte_'+styleId,styleId,'R1',1,'SEWING','Assembly','SN','Seam check','APPROVED',ts,ts);
 // Engineering readiness is evaluated on the frozen Style Version, so seed BEFORE creating the version that will be released.
 // The approved PP sample is attached to that upcoming version (MAX(version_no)+1).
 const next=Number(db.prepare('SELECT COALESCE(MAX(version_no),0)+1 n FROM style_versions WHERE style_id=?').get(styleId).n);
 if(has('pp'))db.prepare("INSERT OR REPLACE INTO sample_rounds(id,style_id,version_no,round_no,sample_type,status,spec_snapshot_json,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run('smp_pp_'+styleId+'_'+next,styleId,next,900+next,'PP','APPROVED','{}','fixture',ts,ts);
}
// ROUND30 fixture for legacy lot suites that insert PRODUCTION release rows directly (no release API). Owner policy now
// requires frozen evidence + an ACKNOWLEDGED factory handoff before a lot can be opened, so this helper walks each such
// release through the real database state machine (PREPARED -> HANDED_OFF -> ACKNOWLEDGED, distinct fixture actors).
// It is a fixture shortcut only; the API path is proven end to end in tests/round30_factory_handoff.mjs.
export function admitReleasesForLotFixtures(db){
 const ts=new Date().toISOString();
 for(const r of db.prepare("SELECT r.id,r.style_id,r.release_no,s.org_id FROM style_releases r JOIN styles s ON s.id=r.style_id WHERE r.release_type='PRODUCTION' AND NOT EXISTS(SELECT 1 FROM factory_handoffs h WHERE h.release_id=r.id AND h.status<>'WITHDRAWN')").all()){
  db.prepare("UPDATE style_releases SET evidence_contract='FROZEN_READINESS/R29' WHERE id=? AND evidence_contract IS NULL").run(r.id);
  const id='hof_fixture_'+r.id;
  db.prepare("INSERT INTO factory_handoffs(id,org_id,style_id,release_id,release_no,status,version,package_json,package_sha256,release_snapshot_sha256,signoffs_sha256,prepared_by,prepared_at,last_command_id,created_at,updated_at) VALUES(?,?,?,?,?,'PREPARED',1,'{}','fixture','fixture','fixture','fixture_release_manager',?,'cmd_fixture_1',?,?)").run(id,r.org_id,r.style_id,r.id,r.release_no,ts,ts,ts);
  db.prepare("UPDATE factory_handoffs SET status='HANDED_OFF',version=2,dispatched_by='fixture_release_manager',dispatched_at=?,last_command_id='cmd_fixture_2' WHERE id=?").run(ts,id);
  db.prepare("UPDATE factory_handoffs SET status='ACKNOWLEDGED',version=3,acknowledged_by='fixture_factory_supervisor',acknowledged_at=?,last_command_id='cmd_fixture_3' WHERE id=?").run(ts,id);
 }
}
