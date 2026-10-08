import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const realConsoleError=console.error;console.error=(...args)=>{if(process.env.VERBOSE_TEST==='1')realConsoleError(...args)};
const db=new DatabaseSync(':memory:');
for(const f of ['0001_init.sql','0002_ai_review_pattern.sql','0003_mohsen_master_bilingual.sql','0004_pattern_intelligence_grading.sql','0005_release_workflow.sql','0006_factory_collaboration.sql','0007_requirements_matrix.sql','0008_sample_fit_validation.sql','0009_costing_consumption.sql','0010_production_quality.sql','0011_production_planning.sql','0012_frozen_planning_basis.sql','0013_factory_operation_execution.sql','0014_reconciliation_concurrency.sql','0015_full_actual_cost.sql','0016_engineering_foundation.sql','0017_human_experience.sql','0018_human_qc.sql','0019_human_store.sql']) db.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
class D1Mock{constructor(db){this.db=db}prepare(sql){const st=this.db.prepare(sql);return{bind:(...args)=>{const vals=args.map(v=>v===undefined?null:v);return{first:()=>st.get(...vals)||null,all:()=>({results:st.all(...vals)}),run:()=>{const r=st.run(...vals);return{success:true,meta:{changes:Number(r.changes||0)}}}}}}}}
class R2Object{constructor(bytes,meta={}){this.bytes=bytes;this.meta=meta;this.httpEtag='test-etag';this.body=bytes}async arrayBuffer(){return this.bytes.buffer.slice(this.bytes.byteOffset,this.bytes.byteOffset+this.bytes.byteLength)}writeHttpMetadata(h){if(this.meta?.httpMetadata?.contentType)h.set('content-type',this.meta.httpMetadata.contentType)}}
class R2Mock{constructor(){this.map=new Map()}async put(k,bytes,meta){this.map.set(k,new R2Object(new Uint8Array(bytes),meta));return{}}async get(k){return this.map.get(k)||null}}
const demo=readFileSync(resolve(root,'public','demo_jk001_reference.png'));
const STATIC={fetch:async input=>{const raw=typeof input==='string'?input:(input instanceof URL?input.href:input.url);const u=new URL(raw);if(u.pathname==='/demo_jk001_reference.png')return new Response(demo,{headers:{'content-type':'image/png'}});return new Response('static',{status:200})}};
const env={DB:new D1Mock(db),UPLOADS:new R2Mock(),STATIC,SESSION_SECRET:'batch06-test-session-secret',DEV_BOOTSTRAP_PASSWORD:'DevOnly!234',MOHSEN_BOOTSTRAP_PASSWORD:'MohsenOnly!234',LICENSE_MODE:'development'};
let cookie='';
async function call(path,{method='GET',body,cookieOverride}={}){const headers={};if(body!==undefined)headers['content-type']='application/json';const c=cookieOverride===undefined?cookie:cookieOverride;if(c)headers.cookie=c;const r=await worker.fetch(new Request('http://local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);const ct=r.headers.get('content-type')||'';const data=ct.includes('json')?await r.json():await r.text();return{r,data}}
function ok(cond,msg){if(!cond)throw new Error('ASSERT: '+msg);console.log('PASS',msg)}

// Bootstrap + login
await call('/api/me',{cookieOverride:''});
let x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});ok(x.r.status===200,'developer login');cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call('/api/health');ok(x.r.status===200&&x.data.schemaVersion==='21'&&x.data.version==='0.21.0-cloudflare','Preview 21 regression health/schema');
x=await call('/api/me');const mohsen=x.data.workspaces.find(w=>w.code==='MOHSEN');ok(Boolean(mohsen),'MOHSEN workspace');
x=await call(`/api/styles?orgId=${mohsen.id}`);const style=x.data.items.find(s=>s.code==='MFD-WJ-001');ok(Boolean(style),'MFD-WJ-001 seed');
let snap=(await call(`/api/styles/${style.id}`)).data;const originalName=snap.style.name;

// Template registry
x=await call('/api/output-templates');ok(x.r.status===200&&x.data.templates.some(t=>t.id==='mohsen_nexz_20p'&&t.pages===20&&t.pageSize==='A4 landscape'),'20P NEXZ template registry');

// Release gates: sample can proceed with warnings; production blocks TBC/UNKNOWN.
x=await call(`/api/styles/${style.id}/release-gate?type=SAMPLE`);ok(x.r.status===200&&x.data.ready===true&&x.data.warningCount>0,'Sample gate allows controlled warnings');
x=await call(`/api/styles/${style.id}/release-gate?type=PRODUCTION`);ok(x.r.status===200&&x.data.ready===false&&x.data.blockerCount>0,'Production gate blocks unresolved production facts');ok(x.data.blockers.some(b=>['DNA_TBC','BOM_TBC','PATTERN_WARNING','VERSION_REQUIRED'].includes(b.code)),'Production blockers are explicit');

// Sample release freezes current snapshot.
x=await call(`/api/styles/${style.id}/releases`,{method:'POST',body:{releaseType:'SAMPLE',note:'Batch06 sample freeze'}});ok(x.r.status===201&&x.data.releaseNo===1&&x.data.manifest.manifestSha256?.length===64,'Sample release + signed manifest hash');
const releaseNo=x.data.releaseNo;
x=await call(`/api/styles/${style.id}/releases/${releaseNo}/manifest`);ok(x.r.status===200&&x.data.template.id==='mohsen_nexz_20p'&&x.data.snapshotSha256.length===64,'Frozen release manifest');
x=await call(`/api/styles/${style.id}/releases/${releaseNo}/output?profile=mohsen_techpack`);ok(x.r.status===200&&(x.data.match(/class="tp-page/g)||[]).length===20,'Frozen release renders 20P Tech Pack');ok(x.data.includes(originalName),'Frozen output contains original style name');

// Working style changes after release must not mutate release output.
x=await call(`/api/styles/${style.id}`,{method:'PATCH',body:{name:'Working Name Changed After Release'}});ok(x.r.status===200,'Working style edited after release');
x=await call(`/api/styles/${style.id}/releases/${releaseNo}/output?profile=mohsen_techpack`);ok(x.r.status===200&&x.data.includes(originalName)&&!x.data.includes('Working Name Changed After Release'),'Frozen release is immutable after working edits');

// Version compare: create baseline, edit, compare to current.
x=await call(`/api/styles/${style.id}/versions`,{method:'POST',body:{label:'Batch06 Compare Baseline'}});ok(x.r.status===201&&x.data.versionNo===1,'Version V1 created');
x=await call(`/api/styles/${style.id}`,{method:'PATCH',body:{name:'Working Name Changed Again'}});ok(x.r.status===200,'Working style changed for compare');
x=await call(`/api/styles/${style.id}/bom`,{method:'POST',body:{code:'B99',category:'TEST',name:'بند مقارنة',nameEn:'Compare item',specification:'TBC',status:'TBC',provenance:'UNKNOWN'}});ok(x.r.status===200,'Working BOM changed for compare');
x=await call(`/api/styles/${style.id}/version-compare?from=1&to=current`);ok(x.r.status===200&&x.data.compare.counts.total>=2,'Revision compare finds changes');ok(x.data.compare.domains.style.some(d=>d.kind==='CHANGED'),'Revision compare reports style change');ok(x.data.compare.domains.bom.some(d=>d.key==='B99'&&d.kind==='ADDED'),'Revision compare reports BOM addition');

// Production remains blocked even with version because frozen source contains unresolved TBC.
x=await call(`/api/styles/${style.id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:1}});ok(x.r.status===409&&x.data.gate?.ready===false,'Production release rejected by gate');

// Export manifest for working data.
x=await call(`/api/styles/${style.id}/export-manifest`);ok(x.r.status===200&&x.data.manifestSha256.length===64&&x.data.snapshotSha256.length===64,'Working export manifest hashes');ok(x.data.outputs.techPack.includes('mohsen_techpack'),'Manifest points to technical output');

// Color-only variant preserves construction/POM locks, reopens BOM for approval, and copies reference assets.
x=await call(`/api/styles/${style.id}/variants`,{method:'POST',body:{code:'MFD-WJ-001-CW99',name:'جاكيت نسائي Variant لون',variantKind:'COLOR_ONLY',label:'Color development test',copyAssets:true,copyColorways:false}});ok(x.r.status===201&&x.data.variantKind==='COLOR_ONLY','Color-only variant created');const colorVariantId=x.data.id;
x=await call(`/api/styles/${colorVariantId}`);ok(x.r.status===200,'Color variant loads');ok(x.data.measurements.length===6&&x.data.measurements.every(m=>m.state==='LOCKED'),'Color variant preserves locked POM');ok(x.data.bom.every(b=>b.status==='DRAFT'),'Color variant reopens BOM approval');ok(x.data.assets.length>0&&x.data.style.hero_asset_id,'Color variant inherits reference assets without copying bytes');ok(x.data.variantOf?.parent_code==='MFD-WJ-001','Variant relation links to parent');

// Development variant downgrades inherited technical states to DRAFT/INHERITED.
x=await call(`/api/styles/${style.id}/variants`,{method:'POST',body:{code:'MFD-WJ-002-DEV',name:'Development Variant',variantKind:'DEVELOPMENT',copyAssets:false}});ok(x.r.status===201,'Development variant created');const devVariantId=x.data.id;
x=await call(`/api/styles/${devVariantId}`);ok(x.data.measurements.every(m=>m.state==='DRAFT'&&m.provenance==='INHERITED'),'Development variant requires re-approval of inherited POM');

// Parent exposes variant list; release list exposes R1.
snap=(await call(`/api/styles/${style.id}`)).data;ok(snap.variants.some(v=>v.child_code==='MFD-WJ-001-CW99')&&snap.variants.some(v=>v.child_code==='MFD-WJ-002-DEV'),'Parent snapshot lists variants');
x=await call(`/api/styles/${style.id}/releases`);ok(x.r.status===200&&x.data.items.length===1&&x.data.items[0].release_no===1,'Release history listed');

// Human closure path: explicitly resolve TBC facts, validate pattern architecture, freeze V2, and prove a Production Release can succeed.
x=await call(`/api/styles/${style.id}/dna`,{method:'POST',body:{fieldKey:'fit',label:'القصة / Fit',value:'should not replace locked fit',state:'APPROVED',provenance:'USER_CONFIRMED'}});ok(x.r.status===409,'DNA editor protects LOCKED fact without explicit force');
for(const d of [
  {fieldKey:'fabric',label:'الخامة / Fabric',value:'Approved woven sample — production test fixture',state:'APPROVED',provenance:'USER_CONFIRMED',force:true},
  {fieldKey:'collar',label:'الياقة / Collar',value:'Approved stand collar construction — production test fixture',state:'APPROVED',provenance:'USER_CONFIRMED',force:true}
]){x=await call(`/api/styles/${style.id}/dna`,{method:'POST',body:d});ok(x.r.status===200,`DNA ${d.fieldKey} manually approved`);}
for(const b of [
  {code:'B01',category:'SHELL',name:'القماش الخارجي',nameEn:'Main fabric',specification:'Approved woven shell sample LOT-T06',specificationEn:'Approved woven shell sample LOT-T06',qty:1,unit:'style',status:'APPROVED',provenance:'USER_CONFIRMED',sortOrder:0},
  {code:'B02',category:'THREAD',name:'خيط الخياطة',nameEn:'Sewing thread',specification:'Approved matching polyester sewing thread',specificationEn:'Approved matching polyester sewing thread',qty:1,unit:'set',status:'APPROVED',provenance:'USER_CONFIRMED',sortOrder:1},
  {code:'B03',category:'TRIM',name:'وحدة Morfok',nameEn:'Morfok/Frog closure',specification:'4 approved physical-sample closure units; placement per approved production sample',specificationEn:'4 approved physical-sample closure units; placement per approved production sample',qty:4,unit:'unit',status:'APPROVED',provenance:'USER_CONFIRMED',sortOrder:2}
]){x=await call(`/api/styles/${style.id}/bom`,{method:'POST',body:b});ok(x.r.status===200,`BOM ${b.code} manually approved`);}
x=await call(`/api/styles/${style.id}/bom/B99`,{method:'DELETE'});ok(x.r.status===200,'Temporary compare BOM item removed before production release');
const approvedPatterns=[
  {code:'P01',name:'ظهر',nameEn:'Back Body',qty:1,note:'Approved production pattern test fixture',noteEn:'Approved production pattern test fixture',mirror:false,onFold:true,grainline:'WARP',provenance:'USER_CONFIRMED',state:'APPROVED',sortOrder:0},
  {code:'P02',name:'أمام',nameEn:'Front Body',qty:2,note:'Approved mirrored pair',noteEn:'Approved mirrored pair',mirror:true,onFold:false,grainline:'WARP',provenance:'USER_CONFIRMED',state:'APPROVED',sortOrder:1},
  {code:'P03',name:'كم',nameEn:'Sleeve',qty:2,note:'Approved mirrored pair',noteEn:'Approved mirrored pair',mirror:true,onFold:false,grainline:'WARP',provenance:'USER_CONFIRMED',state:'APPROVED',sortOrder:2},
  {code:'P04',name:'ياقة',nameEn:'Collar',qty:2,note:'Approved production collar pattern',noteEn:'Approved production collar pattern',mirror:false,onFold:false,grainline:'WARP',provenance:'USER_CONFIRMED',state:'APPROVED',sortOrder:3},
  {code:'P05',name:'فيسنج أمامي',nameEn:'Front Facing',qty:2,note:'Approved mirrored pair',noteEn:'Approved mirrored pair',mirror:true,onFold:false,grainline:'WARP',provenance:'USER_CONFIRMED',state:'APPROVED',sortOrder:4},
  {code:'T01',name:'Morfok',nameEn:'Morfok Closure',qty:4,note:'Approved physical closure reference',noteEn:'Approved physical closure reference',mirror:false,onFold:false,grainline:'N/A',provenance:'USER_CONFIRMED',state:'APPROVED',sortOrder:5}
];
for(const ptn of approvedPatterns){x=await call(`/api/styles/${style.id}/patterns`,{method:'POST',body:ptn});ok(x.r.status===200,`Pattern ${ptn.code} approved`);}
x=await call(`/api/styles/${style.id}/pattern-links`,{method:'POST',body:{fromCode:'P01',toCode:'P02',relation:'SEAM_JOIN',label:'Side/shoulder assembly relationship',labelEn:'Side/shoulder assembly relationship',provenance:'USER_CONFIRMED',state:'APPROVED'}});ok(x.r.status===200,'Approved pattern relationship registered');
x=await call(`/api/styles/${style.id}/pattern-validation`);ok(x.r.status===200&&x.data.ready===true&&x.data.errors.length===0&&x.data.warnings.length===0,'Pattern validation closes all production blockers');
x=await call(`/api/styles/${style.id}/versions`,{method:'POST',body:{label:'Batch06 Production Candidate'}});ok(x.r.status===201&&x.data.versionNo===2,'Production candidate Version V2 created');
x=await call(`/api/styles/${style.id}/release-gate?type=PRODUCTION`);ok(x.r.status===200&&x.data.ready===true&&x.data.blockerCount===0,'Production gate becomes READY after explicit human approvals');
x=await call(`/api/styles/${style.id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:2,note:'Batch06 production closure proof'}});ok(x.r.status===201&&x.data.releaseType==='PRODUCTION'&&x.data.releaseNo===2&&x.data.gate.ready===true,'Production Release succeeds from frozen V2');
x=await call(`/api/styles/${style.id}/releases/2/output?profile=mohsen_techpack`);ok(x.r.status===200&&(x.data.match(/class="tp-page/g)||[]).length===20,'Frozen Production Release renders exactly 20 pages');

// Audit captures workflow actions.
x=await call(`/api/audit?orgId=${mohsen.id}`);ok(x.r.status===200&&x.data.items.some(i=>i.action==='VARIANT_CREATE')&&x.data.items.some(i=>i.entity_type==='RELEASE'&&i.action==='CREATE'),'Audit captures release + variant workflow');

// Tenant isolation covers release center.
const otherOrg='org_other06',otherStyle='sty_other06',ts=new Date().toISOString();db.prepare('INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES(?,?,?,?,?)').run(otherOrg,'OTHER06','Other Org','{}',ts);db.prepare('INSERT INTO styles(id,org_id,code,name,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(otherStyle,otherOrg,'OTHER-06','Other Style','u-none',ts,ts);
x=await call('/api/auth/login',{method:'POST',body:{email:'mohsen@mohsen.local',password:env.MOHSEN_BOOTSTRAP_PASSWORD},cookieOverride:''});ok(x.r.status===200,'MOHSEN user login');const mohsenCookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call(`/api/styles/${otherStyle}/release-gate?type=PRODUCTION`,{cookieOverride:mohsenCookie});ok(x.r.status===403,'Tenant isolation protects release gate');

console.log('BATCH06_INTEGRATION_PASS');
