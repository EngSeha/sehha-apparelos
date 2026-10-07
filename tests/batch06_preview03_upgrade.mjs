import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const db=new DatabaseSync(':memory:');
const sql=f=>readFileSync(resolve(root,'migrations',f),'utf8');
for(const f of ['0001_init.sql','0002_ai_review_pattern.sql'])db.exec(sql(f));
const before=db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get()?.value;
if(before!=='4')throw new Error(`Expected Preview03 schema 4, got ${before}`);
const ts='2026-10-04T00:00:00.000Z';
db.prepare('INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES(?,?,?,?,?)').run('org_p03','MOHSEN03','MOHSEN Preview03','{}',ts);
db.prepare('INSERT INTO styles(id,org_id,code,name,garment_type,audience,sizing_mode,base_size,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('sty_p03','org_p03','LEGACY-WJ-03','Legacy Preview03 Jacket','WOMENS_JACKET','WOMEN','STANDARD','M','DEVELOPMENT','u_legacy',ts,ts);
db.prepare('INSERT INTO measurements(id,style_id,code,name,value,unit,method,provenance,state,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)').run('pom_p03','sty_p03','A','طول الجاكيت',57,'cm','legacy method','USER_CONFIRMED','LOCKED',0);
db.prepare('INSERT INTO pattern_pieces(id,style_id,code,name,qty,note,provenance,state,sort_order) VALUES(?,?,?,?,?,?,?,?,?)').run('pat_p03','sty_p03','P01','ظهر',1,'legacy pattern row','USER_CONFIRMED','APPROVED',0);
db.prepare('INSERT INTO style_versions(id,style_id,version_no,label,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run('ver_p03','sty_p03',1,'Legacy V1','{"legacy":true}','u_legacy',ts);
for(const f of ['0003_mohsen_master_bilingual.sql','0004_pattern_intelligence_grading.sql','0005_release_workflow.sql'])db.exec(sql(f));
const after=db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get()?.value;
if(after!=='7')throw new Error(`Expected schema 7 after cumulative upgrade, got ${after}`);
const style=db.prepare('SELECT code,name,base_size FROM styles WHERE id=?').get('sty_p03');
if(style?.code!=='LEGACY-WJ-03'||style?.name!=='Legacy Preview03 Jacket'||style?.base_size!=='M')throw new Error('Legacy style changed during schema 4 -> 7 upgrade');
const pom=db.prepare('SELECT code,value,state,name,name_en FROM measurements WHERE id=?').get('pom_p03');
if(pom?.code!=='A'||Number(pom?.value)!==57||pom?.state!=='LOCKED'||pom?.name!=='طول الجاكيت'||pom?.name_en!==null)throw new Error('Legacy LOCKED POM not preserved/additive');
const pat=db.prepare('SELECT code,name,state,note,name_en,mirror,on_fold,grainline FROM pattern_pieces WHERE id=?').get('pat_p03');
if(pat?.code!=='P01'||pat?.state!=='APPROVED'||pat?.note!=='legacy pattern row'||pat?.name_en!==null||Number(pat?.mirror)!==0||Number(pat?.on_fold)!==0||pat?.grainline!==null)throw new Error('Legacy pattern row not preserved/additive');
const ver=db.prepare('SELECT version_no,label,snapshot_json FROM style_versions WHERE id=?').get('ver_p03');
if(Number(ver?.version_no)!==1||ver?.label!=='Legacy V1'||ver?.snapshot_json!=='{"legacy":true}')throw new Error('Legacy version not preserved');
for(const table of ['colorways','size_bands','grading_rules','pattern_links','asset_annotations','style_variants','style_releases']){
  const row=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if(!row)throw new Error(`Missing cumulative table ${table}`);
}
console.log('BATCH06_PREVIEW03_UPGRADE_PASS schema=7 stylePreserved=1 lockedPomPreserved=1 patternPreserved=1 versionPreserved=1 newTables=7');
