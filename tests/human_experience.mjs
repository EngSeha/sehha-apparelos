import {makeHarness,ok} from './test_helpers.mjs';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root} from './test_helpers.mjs';

const {db,env,call,login}=makeHarness();await login();
let x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN'),admin=db.prepare("SELECT * FROM users WHERE email='dev@sehha.local'").get(),ts=new Date().toISOString();
const users=[['cut','CUTTING_WORKER'],['sew','SEWING_OPERATOR'],['qc','QC_INSPECTOR'],['store','STORE_CLERK'],['super','FACTORY_SUPERVISOR'],['pattern','PATTERN_MASTER']];
for(const [name,role] of users){db.prepare('INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)').run(`u_${name}`,`${name}@local.test`,name,admin.password_hash,admin.password_salt,ts);db.prepare('INSERT INTO memberships(user_id,org_id,role) VALUES(?,?,?)').run(`u_${name}`,org.id,role)}
async function cookie(name){const y=await call('/api/auth/login',{method:'POST',body:{email:`${name}@local.test`,password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});ok(y.r.status===200,`${name} demo login`);return(y.r.headers.get('set-cookie')||'').split(';')[0]}
const cookies={};for(const [name] of users)cookies[name]=await cookie(name);
for(const [name,expected] of [['cut','SIMPLE'],['sew','SIMPLE'],['qc','SIMPLE'],['store','SIMPLE'],['super','SUPERVISOR'],['pattern','PROFESSIONAL']]){const y=await call('/api/me',{cookieOverride:cookies[name]});ok(y.data.workspaces.find(w=>w.id===org.id).experience.mode===expected,`${name} server-derived experience`)}

x=await call('/api/styles',{method:'POST',body:{orgId:org.id,code:'HUMAN-01',name:'Human test style',garmentType:'JACKET',audience:'WOMEN',sizingMode:'STANDARD'}});const styleId=x.data.id;
const frozen={style:{id:styleId,org_id:org.id,code:'HUMAN-01',name:'Human test style'},sizeBands:[],colorways:[],measurements:[],bom:[],operations:[{seq:1,name:'خياطة الجنب',name_en:'Side seam'}],patternPieces:[],patternLinks:[],requirements:[],assets:[],dna:[],gradingRules:[],annotations:[],samples:[],costSheets:[]};
db.prepare('INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('hrel',styleId,1,'PRODUCTION','RELEASED',1,'mohsen_nexz_20p','{}','{}',JSON.stringify(frozen),admin.id,ts);
x=await call(`/api/styles/${styleId}/production-lots`,{method:'POST',body:{releaseNo:1,lotCode:'HUMAN-LOT',plannedQty:100}});const lotId=x.data.lot.id;
x=await call(`/api/styles/${styleId}/production-lots/${lotId}/operations/sync`,{method:'POST',body:{expectedVersion:x.data.lot.row_version}});ok(x.r.status===200,'existing production contract prepares operation');
let y=await call(`/api/styles/${styleId}/production-lots/${lotId}/operations/1`,{method:'PATCH',body:{completedQty:50,expectedVersion:x.data.lot.row_version},cookieOverride:cookies.sew});ok(y.r.status===403,'worker cannot use professional operation mutation');
y=await call(`/api/styles/${styleId}/engineering`,{cookieOverride:cookies.sew});ok(y.r.status===403,'worker cannot open engineering data route');
y=await call('/api/human/tasks',{method:'POST',body:{orgId:org.id,lotId,operationSeq:1,assigneeUserId:'u_sew'},cookieOverride:cookies.qc});ok(y.r.status===403,'basic QC cannot assign production tasks');
y=await call('/api/human/tasks',{method:'POST',body:{orgId:org.id,lotId,operationSeq:1,assigneeUserId:'u_sew'},cookieOverride:cookies.super});ok(y.r.status===201,'supervisor assigns existing operation');const task=y.data.task;
y=await call(`/api/human/home?orgId=${org.id}`,{cookieOverride:cookies.sew});ok(y.data.open===1&&y.data.tasks[0].id===task.id,'worker sees only assigned task');
y=await call(`/api/human/tasks/${task.id}`,{cookieOverride:cookies.store});ok(y.r.status===403,'store clerk cannot inspect worker task');
const key='human-test-50';y=await call(`/api/human/tasks/${task.id}/submissions`,{method:'POST',body:{completedDelta:50,rejectedDelta:0,expectedVersion:task.lotVersion,requestKey:key},cookieOverride:cookies.sew});ok(y.r.status===200&&y.data.task.completedQty===50,'worker records 50 pieces on assigned operation');
let repeat=await call(`/api/human/tasks/${task.id}/submissions`,{method:'POST',body:{completedDelta:50,rejectedDelta:0,expectedVersion:task.lotVersion,requestKey:key},cookieOverride:cookies.sew});ok(repeat.r.status===200&&repeat.data.duplicate&&repeat.data.task.completedQty===50,'duplicate request key does not add quantity twice');
repeat=await call(`/api/human/tasks/${task.id}/submissions`,{method:'POST',body:{completedDelta:10,expectedVersion:task.lotVersion,requestKey:'human-test-stale'},cookieOverride:cookies.sew});ok(repeat.r.status===409,'stale lot version rejects second write');
y=await call(`/api/human/tasks/${task.id}/corrections`,{method:'POST',body:{reason:'كتبت كمية تحتاج مراجعة'},cookieOverride:cookies.sew});ok(y.r.status===201&&db.prepare('SELECT COUNT(*) AS n FROM human_correction_requests').get().n===1,'worker requests audited correction');
y=await call(`/api/human/home?orgId=${org.id}`,{cookieOverride:cookies.super});ok(y.data.exceptions.some(e=>e.kind==='CORRECTION_REQUEST'&&e.lot_id===lotId&&e.reason.includes('مراجعة')),'supervisor sees correction request with its production lot');
y=await call('/api/human/preferences',{method:'PATCH',body:{language:'ar',density:'comfortable',lastWorkspaceId:org.id,preferredView:'professional'},cookieOverride:cookies.sew});ok(y.r.status===403,'simple role cannot select professional view');
y=await call('/api/human/preferences',{method:'PATCH',body:{language:'ar',density:'comfortable',preferredView:'professional'},cookieOverride:cookies.sew});ok(y.r.status===400,'professional preference requires an authorized workspace');
y=await call('/api/human/preferences',{method:'PATCH',body:{language:'ar',density:'comfortable',lastWorkspaceId:org.id,preferredView:'auto'},cookieOverride:cookies.sew});ok(y.r.status===200,'user preferences persist within workspace');
y=await call(`/api/human/home?orgId=${org.id}`,{cookieOverride:cookies.qc});ok(y.data.tasks.length===0,'QC home does not invent production tasks');
y=await call(`/api/human/home?orgId=${org.id}`,{cookieOverride:cookies.store});ok(y.data.tasks.length===0,'store home does not invent inventory facts');
const old=new DatabaseSync(':memory:');for(const file of ['0001_init.sql','0002_ai_review_pattern.sql','0003_mohsen_master_bilingual.sql','0004_pattern_intelligence_grading.sql','0005_release_workflow.sql','0006_factory_collaboration.sql','0007_requirements_matrix.sql','0008_sample_fit_validation.sql','0009_costing_consumption.sql','0010_production_quality.sql','0011_production_planning.sql','0012_frozen_planning_basis.sql','0013_factory_operation_execution.sql','0014_reconciliation_concurrency.sql','0015_full_actual_cost.sql','0016_engineering_foundation.sql'])old.exec(readFileSync(resolve(root,'migrations',file),'utf8'));old.exec(readFileSync(resolve(root,'migrations/0017_human_experience.sql'),'utf8'));ok(old.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value==='19','schema 18 upgrades to 19');old.close();
console.log('HUMAN_EXPERIENCE_PASS');
