import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const realConsoleError=console.error;console.error=(...args)=>{if(process.env.VERBOSE_TEST==='1')realConsoleError(...args)};
const db=new DatabaseSync(':memory:');
for(const f of ['0001_init.sql','0002_ai_review_pattern.sql','0003_mohsen_master_bilingual.sql','0004_pattern_intelligence_grading.sql','0005_release_workflow.sql','0006_factory_collaboration.sql','0007_requirements_matrix.sql','0008_sample_fit_validation.sql','0009_costing_consumption.sql','0010_production_quality.sql','0011_production_planning.sql','0012_frozen_planning_basis.sql','0013_factory_operation_execution.sql','0014_reconciliation_concurrency.sql','0015_full_actual_cost.sql','0016_engineering_foundation.sql'])db.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
class D1Mock{constructor(db){this.db=db}prepare(sql){const st=this.db.prepare(sql);return{bind:(...args)=>{const vals=args.map(v=>v===undefined?null:v);return{first:()=>st.get(...vals)||null,all:()=>({results:st.all(...vals)}),run:()=>{const r=st.run(...vals);return{success:true,meta:{changes:Number(r.changes||0)}}}}}}}}
class R2Object{constructor(bytes,meta={}){this.bytes=bytes;this.meta=meta;this.httpEtag='test-etag';this.body=bytes}async arrayBuffer(){return this.bytes.buffer.slice(this.bytes.byteOffset,this.bytes.byteOffset+this.bytes.byteLength)}writeHttpMetadata(h){if(this.meta?.httpMetadata?.contentType)h.set('content-type',this.meta.httpMetadata.contentType)}}
class R2Mock{constructor(){this.map=new Map()}async put(k,bytes,meta){this.map.set(k,new R2Object(new Uint8Array(bytes),meta));return{}}async get(k){return this.map.get(k)||null}}
const demo=readFileSync(resolve(root,'public','demo_jk001_reference.png'));
const STATIC={fetch:async input=>{const raw=typeof input==='string'?input:(input instanceof URL?input.href:input.url);const u=new URL(raw);if(u.pathname==='/demo_jk001_reference.png')return new Response(demo,{headers:{'content-type':'image/png'}});return new Response('static',{status:200})}};
const env={DB:new D1Mock(db),UPLOADS:new R2Mock(),STATIC,SESSION_SECRET:'batch07-test-session-secret',DEV_BOOTSTRAP_PASSWORD:'DevOnly!234',MOHSEN_BOOTSTRAP_PASSWORD:'MohsenOnly!234',LICENSE_MODE:'development'};
let cookie='';
async function call(path,{method='GET',body,cookieOverride}={}){const headers={};if(body!==undefined)headers['content-type']='application/json';const c=cookieOverride===undefined?cookie:cookieOverride;if(c)headers.cookie=c;const r=await worker.fetch(new Request('http://local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);const ct=r.headers.get('content-type')||'';const data=ct.includes('json')?await r.json():await r.text();return{r,data}}
function ok(cond,msg){if(!cond)throw new Error('ASSERT: '+msg);console.log('PASS',msg)}

// Bootstrap and Preview 07 health.
await call('/api/me',{cookieOverride:''});
let x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});ok(x.r.status===200,'developer login');cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call('/api/health');ok(x.r.status===200&&x.data.schemaVersion==='18'&&x.data.version==='0.21.0-cloudflare','Preview 21 health/schema');
x=await call('/api/me');const mohsen=x.data.workspaces.find(w=>w.code==='MOHSEN');ok(Boolean(mohsen),'MOHSEN workspace');
x=await call(`/api/styles?orgId=${mohsen.id}`);const style=x.data.items.find(s=>s.code==='MFD-WJ-001');ok(Boolean(style),'MFD-WJ-001 seed');

// Template completeness is explicit page-by-page and does not fabricate optional visual assets.
x=await call(`/api/styles/${style.id}/completeness?template=mohsen_nexz_20p`);ok(x.r.status===200&&x.data.pageCount===20&&x.data.checks.length===20,'20-page completeness validator');ok(x.data.warningCount>0&&x.data.warnings.some(w=>['TECHNICAL','MARKER'].includes(w.key)),'Optional visual gaps remain explicit warnings');

// Working-style review workflow.
x=await call(`/api/styles/${style.id}/reviews`,{method:'POST',body:{severity:'MAJOR',category:'TECHNICAL',title:'Check front technical flat',description:'Need approved front/back technical drawings',fieldRef:'ASSET:TECHNICAL_FRONT',pageNo:2}});ok(x.r.status===201&&x.data.status==='OPEN','Working review item created');const workingReviewId=x.data.id;
x=await call(`/api/styles/${style.id}/reviews?status=OPEN`);ok(x.r.status===200&&x.data.items.some(r=>r.id===workingReviewId),'Open review list');
x=await call(`/api/styles/${style.id}/reviews/${workingReviewId}`,{method:'PATCH',body:{status:'RESOLVED',resolution:'Technical drawing request acknowledged for next asset pass'}});ok(x.r.status===200&&x.data.status==='RESOLVED','Working review item resolved with evidence');

// Close production facts explicitly for a factory-release fixture. No inferred values are introduced.
db.prepare("UPDATE dna_items SET value_text='Approved woven shell sample LOT-B07',provenance='USER_CONFIRMED',state='APPROVED' WHERE style_id=? AND field_key='fabric'").run(style.id);
db.prepare("UPDATE dna_items SET value_text='Approved stand collar construction',provenance='USER_CONFIRMED',state='APPROVED' WHERE style_id=? AND field_key='collar'").run(style.id);
db.prepare("UPDATE bom_items SET specification='Approved production material fixture',specification_en='Approved production material fixture',status='APPROVED',provenance='USER_CONFIRMED' WHERE style_id=?").run(style.id);
db.prepare("UPDATE pattern_pieces SET grainline=CASE WHEN code='T01' THEN 'N/A' ELSE 'WARP' END,state='APPROVED',provenance='USER_CONFIRMED' WHERE style_id=?").run(style.id);
const ts=new Date().toISOString();db.prepare("INSERT INTO pattern_links(id,style_id,from_code,to_code,relation,label,label_en,provenance,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run('pl_b07',style.id,'P01','P02','SEAM_JOIN','Assembly relation','Assembly relation','USER_CONFIRMED','APPROVED',ts,ts);

// Freeze and release R1 through real APIs.
x=await call(`/api/styles/${style.id}/versions`,{method:'POST',body:{label:'Batch07 Production Candidate R1'}});ok(x.r.status===201&&x.data.versionNo===1,'Production candidate V1 created');
x=await call(`/api/styles/${style.id}/release-gate?type=PRODUCTION`);ok(x.r.status===200&&x.data.ready===true,'Production gate ready after explicit approvals');
x=await call(`/api/styles/${style.id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:1,note:'Batch07 factory handoff R1'}});ok(x.r.status===201&&x.data.releaseNo===1,'Production R1 created');

// Release-scoped critical review blocks handoff even when the technical release exists.
x=await call(`/api/styles/${style.id}/reviews`,{method:'POST',body:{releaseNo:1,severity:'CRITICAL',category:'QUALITY',title:'Factory sample seam check',description:'Hold handoff until sample seam is signed off',fieldRef:'QC:SEAM',pageNo:19}});ok(x.r.status===201,'Critical release review created');const criticalReviewId=x.data.id;
x=await call(`/api/styles/${style.id}/releases/1/handoff`);ok(x.r.status===200&&x.data.ready===false&&x.data.openMajorCritical.length===1&&x.data.missingSignoffs.length===4,'Handoff blocks on critical review + missing signoffs');ok(x.data.handoffSha256?.length===64,'Handoff manifest hash generated');

// Platform admin can provide all required role sign-offs; critical review still blocks.
for(const roleKey of ['DESIGN','PATTERN','PRODUCTION','QC']){x=await call(`/api/styles/${style.id}/releases/1/signoffs`,{method:'POST',body:{roleKey,decision:'APPROVED',note:`${roleKey} approved in Batch07 fixture`}});ok(x.r.status===200&&x.data.roleKey===roleKey,`${roleKey} sign-off recorded`);}
x=await call(`/api/styles/${style.id}/releases/1/handoff`);ok(x.r.status===200&&x.data.ready===false&&x.data.missingSignoffs.length===0&&x.data.openMajorCritical.length===1,'Critical review remains fail-closed after signoffs');
x=await call(`/api/styles/${style.id}/reviews/${criticalReviewId}`,{method:'PATCH',body:{status:'RESOLVED',resolution:'Factory seam sample checked and approved'}});ok(x.r.status===200,'Critical review resolved');
x=await call(`/api/styles/${style.id}/releases/1/handoff`);ok(x.r.status===200&&x.data.ready===true&&x.data.missingSignoffs.length===0&&x.data.openMajorCritical.length===0,'Factory handoff becomes READY only after review closure + signoffs');

// Build R2 with a BOM change and prove semantic release comparison flags technical review risk.
x=await call(`/api/styles/${style.id}/bom`,{method:'POST',body:{code:'B01',category:'SHELL',name:'القماش الخارجي',nameEn:'Main fabric',specification:'Approved production material fixture REV-B',specificationEn:'Approved production material fixture REV-B',qty:1,unit:'style',status:'APPROVED',provenance:'USER_CONFIRMED',sortOrder:0}});ok(x.r.status===200,'Approved BOM revision applied');
x=await call(`/api/styles/${style.id}/versions`,{method:'POST',body:{label:'Batch07 Production Candidate R2'}});ok(x.r.status===201&&x.data.versionNo===2,'Production candidate V2 created');
x=await call(`/api/styles/${style.id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:2,note:'Batch07 release compare R2'}});ok(x.r.status===201&&x.data.releaseNo===2,'Production R2 created');
x=await call(`/api/styles/${style.id}/releases/compare?from=1&to=2`);ok(x.r.status===200&&x.data.diff.domains.bom.some(d=>d.key==='B01'&&d.kind==='CHANGED'),'Release-to-release semantic diff detects BOM change');ok(x.data.risk.level==='REVIEW_REQUIRED'&&x.data.risk.technicalDomains.some(d=>d.domain==='bom'),'Technical release change requires review');
x=await call(`/api/styles/${style.id}/releases/2/handoff`);ok(x.r.status===200&&x.data.change?.fromRelease===1&&x.data.change.risk.level==='REVIEW_REQUIRED','Handoff carries previous-release change risk');

// Specialized workspace role may sign DESIGN/PATTERN but not QC.
x=await call('/api/auth/login',{method:'POST',body:{email:'mohsen@mohsen.local',password:env.MOHSEN_BOOTSTRAP_PASSWORD},cookieOverride:''});ok(x.r.status===200,'MOHSEN specialist login');const mohsenCookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call(`/api/styles/${style.id}/releases/2/signoffs`,{method:'POST',body:{roleKey:'QC',decision:'APPROVED'} ,cookieOverride:mohsenCookie});ok(x.r.status===403,'DESIGN_PATTERN_MASTER cannot sign QC');
x=await call(`/api/styles/${style.id}/releases/2/signoffs`,{method:'POST',body:{roleKey:'DESIGN',decision:'APPROVED',note:'Designer approval'} ,cookieOverride:mohsenCookie});ok(x.r.status===200,'DESIGN_PATTERN_MASTER can sign DESIGN');
const specialistId=db.prepare("SELECT id FROM users WHERE email='mohsen@mohsen.local'").get().id;
db.prepare("UPDATE memberships SET role='FACTORY_SUPERVISOR' WHERE user_id=? AND org_id=?").run(specialistId,mohsen.id);
x=await call(`/api/styles/${style.id}/releases/2/signoffs`,{method:'POST',body:{roleKey:'QC',decision:'APPROVED'},cookieOverride:mohsenCookie});ok(x.r.status===403,'FACTORY_SUPERVISOR cannot sign QC');
x=await call(`/api/styles/${style.id}/releases/2/signoffs`,{method:'POST',body:{roleKey:'PRODUCTION',decision:'APPROVED'},cookieOverride:mohsenCookie});ok(x.r.status===200,'FACTORY_SUPERVISOR can sign production');
db.prepare("UPDATE memberships SET role='QC_MANAGER' WHERE user_id=? AND org_id=?").run(specialistId,mohsen.id);
x=await call(`/api/styles/${style.id}/releases/2/signoffs`,{method:'POST',body:{roleKey:'QC',decision:'APPROVED'},cookieOverride:mohsenCookie});ok(x.r.status===200,'QC_MANAGER can sign QC');

// Audit captures collaboration workflow.
x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call(`/api/audit?orgId=${mohsen.id}`);ok(x.r.status===200&&x.data.items.some(i=>i.entity_type==='REVIEW'&&i.action==='CREATE')&&x.data.items.some(i=>i.entity_type==='RELEASE'&&i.action==='SIGNOFF'),'Audit captures reviews + signoffs');

console.log('BATCH07_INTEGRATION_PASS');
