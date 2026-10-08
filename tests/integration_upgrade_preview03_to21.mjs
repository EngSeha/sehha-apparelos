import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ok} from './test_helpers.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sql=name=>readFileSync(resolve(root,'migrations',name),'utf8');
const db=new DatabaseSync(':memory:');
db.exec(sql('0001_init.sql'));
db.exec(sql('0002_ai_review_pattern.sql'));
const ts='2026-10-02T00:00:00.000Z';
db.prepare('INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES(?,?,?,?,?)').run('org-existing','EXISTING','Existing tenant','{}',ts);
db.prepare('INSERT INTO styles(id,org_id,code,name,garment_type,audience,sizing_mode,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('style-existing','org-existing','LEGACY-03','Legacy style','JACKET','WOMEN','STANDARD','DEVELOPMENT','user-existing',ts,ts);
db.prepare('INSERT INTO measurements(id,style_id,code,name,value,unit,provenance,state,sort_order) VALUES(?,?,?,?,?,?,?,?,?)').run('pom-existing','style-existing','A','Length',57,'cm','USER_CONFIRMED','LOCKED',1);
db.prepare('INSERT INTO pattern_pieces(id,style_id,code,name,qty,note,provenance,state,sort_order) VALUES(?,?,?,?,?,?,?,?,?)').run('pattern-existing','style-existing','P01','Back',1,'legacy evidence','USER_CONFIRMED','APPROVED',1);
db.prepare('INSERT INTO style_versions(id,style_id,version_no,label,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run('version-existing','style-existing',1,'V1','{"frozen":true}','user-existing',ts);
ok(db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value==='4','existing main schema is 4');

// The published main branch contained 0002 but not 0001. Wrangler may apply
// the newly tracked 0001 to an already initialized database before 0003.
db.exec(sql('0001_init.sql'));
for(let i=3;i<=15;i++){
  const name={3:'0003_mohsen_master_bilingual.sql',4:'0004_pattern_intelligence_grading.sql',5:'0005_release_workflow.sql',6:'0006_factory_collaboration.sql',7:'0007_requirements_matrix.sql',8:'0008_sample_fit_validation.sql',9:'0009_costing_consumption.sql',10:'0010_production_quality.sql',11:'0011_production_planning.sql',12:'0012_frozen_planning_basis.sql',13:'0013_factory_operation_execution.sql',14:'0014_reconciliation_concurrency.sql',15:'0015_full_actual_cost.sql'}[i];
  db.exec(sql(name));
}
ok(db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get().value==='17','main schema upgrades to 17 after replaying 0001');
ok(db.prepare("SELECT name FROM organizations WHERE id='org-existing'").get()?.name==='Existing tenant','tenant survives upgrade');
ok(db.prepare("SELECT code FROM styles WHERE id='style-existing'").get()?.code==='LEGACY-03','style survives upgrade');
ok(db.prepare("SELECT value,state FROM measurements WHERE id='pom-existing'").get()?.state==='LOCKED','locked measurement survives upgrade');
ok(db.prepare("SELECT state,note FROM pattern_pieces WHERE id='pattern-existing'").get()?.note==='legacy evidence','pattern evidence survives upgrade');
ok(db.prepare("SELECT snapshot_json FROM style_versions WHERE id='version-existing'").get()?.snapshot_json==='{"frozen":true}','frozen version survives upgrade');
ok(Boolean(db.prepare("SELECT name FROM sqlite_master WHERE name='production_labor_usage'").get()),'Preview 21 labor table exists');
console.log('MAIN_TO_PREVIEW21_UPGRADE_PASS');
