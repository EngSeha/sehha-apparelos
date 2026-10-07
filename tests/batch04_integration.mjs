import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const realConsoleError=console.error;console.error=(...args)=>{if(process.env.VERBOSE_TEST==='1')realConsoleError(...args)};
const db=new DatabaseSync(':memory:');
for(const f of ['0001_init.sql','0002_ai_review_pattern.sql','0003_mohsen_master_bilingual.sql','0004_pattern_intelligence_grading.sql','0005_release_workflow.sql','0006_factory_collaboration.sql','0007_requirements_matrix.sql','0008_sample_fit_validation.sql','0009_costing_consumption.sql','0010_production_quality.sql','0011_production_planning.sql','0012_frozen_planning_basis.sql','0013_factory_operation_execution.sql','0014_reconciliation_concurrency.sql','0015_full_actual_cost.sql','0016_engineering_foundation.sql']) db.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
class D1Mock{constructor(db){this.db=db}prepare(sql){const st=this.db.prepare(sql);return{bind:(...args)=>{const vals=args.map(v=>v===undefined?null:v);return{first:()=>st.get(...vals)||null,all:()=>({results:st.all(...vals)}),run:()=>{const r=st.run(...vals);return{success:true,meta:{changes:Number(r.changes||0)}}}}}}}}
class R2Object{constructor(bytes,meta={}){this.bytes=bytes;this.meta=meta;this.httpEtag='test-etag';this.body=bytes}async arrayBuffer(){return this.bytes.buffer.slice(this.bytes.byteOffset,this.bytes.byteOffset+this.bytes.byteLength)}writeHttpMetadata(h){if(this.meta?.httpMetadata?.contentType)h.set('content-type',this.meta.httpMetadata.contentType)}}
class R2Mock{constructor(){this.map=new Map()}async put(k,bytes,meta){this.map.set(k,new R2Object(new Uint8Array(bytes),meta));return{}}async get(k){return this.map.get(k)||null}}
const demo=readFileSync(resolve(root,'public','demo_jk001_reference.png'));
const STATIC={fetch:async input=>{const raw=typeof input==='string'?input:(input instanceof URL?input.href:input.url);const u=new URL(raw);if(u.pathname==='/demo_jk001_reference.png')return new Response(demo,{headers:{'content-type':'image/png'}});return new Response('static',{status:200})}};
const env={DB:new D1Mock(db),UPLOADS:new R2Mock(),STATIC,SESSION_SECRET:'batch04-test-session-secret',DEV_BOOTSTRAP_PASSWORD:'DevOnly!234',MOHSEN_BOOTSTRAP_PASSWORD:'MohsenOnly!234',LICENSE_MODE:'development',ANTHROPIC_API_KEY:'test-anthropic',OPENAI_API_KEY:'test-openai',AI_PROVIDER_ORDER:'anthropic,openai'};
const fakeAnalysis={garment:{family:'JACKET',type:'WOMENS_JACKET',audience:'WOMEN',constructionMode:'WOVEN',fit:'BOXY',multiGarment:false,colorwayCount:1},features:[{key:'closure',label:'Closure',value:'AI tries to overwrite closure',confidence:.9,provenance:'INFERRED'}],detectedDetails:['Morfok'],materialAppearance:{family:'UNKNOWN',surface:'UNKNOWN',nap:'UNKNOWN',stretch:'UNKNOWN',composition:'UNKNOWN',gsm:'UNKNOWN'},trims:[{name:'Morfok',count:4,confidence:.9,provenance:'OBSERVED'}],artwork:[],templateCandidates:[],suggestedPOM:[{code:'Z','name':'AI suggestion only','reason':'visual'}],suggestedPatternArchitecture:[{code:'PX','name':'AI piece',qty:null,'note':'draft'}],suggestedOperations:[{seq:50,name:'AI operation',machine:'TBC',stitch:'TBC',qc:'review'}],conflicts:[{field:'collar',assetIds:['a','b'],reason:'views differ'}],sourceAssets:[],warnings:[]};
const nativeFetch=globalThis.fetch;
globalThis.fetch=async (url,opt)=>{const u=String(url);if(u.includes('api.anthropic.com'))return new Response('quota',{status:429});if(u.includes('api.openai.com'))return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify(fakeAnalysis)}]}]}),{status:200,headers:{'content-type':'application/json'}});return nativeFetch(url,opt)};
let cookie='';
async function call(path,{method='GET',body,cookieOverride}={}){const headers={};if(body!==undefined)headers['content-type']='application/json';const c=cookieOverride===undefined?cookie:cookieOverride;if(c)headers.cookie=c;const r=await worker.fetch(new Request('http://local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);let data;const ct=r.headers.get('content-type')||'';data=ct.includes('json')?await r.json():await r.text();return{r,data}}
function ok(cond,msg){if(!cond)throw new Error('ASSERT: '+msg);console.log('PASS',msg)}
// Trigger bootstrap through an API path (auth failure is expected after seed).
await call('/api/me',{cookieOverride:''});
let x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});ok(x.r.status===200,'developer login');cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call('/api/me');ok(x.r.status===200&&x.data.workspaces.some(w=>w.code==='MOHSEN'),'workspace access');const mohsen=x.data.workspaces.find(w=>w.code==='MOHSEN');
x=await call(`/api/styles?orgId=${mohsen.id}`);ok(x.r.status===200,'list styles');const seeded=x.data.items.find(s=>s.code==='MFD-WJ-001');ok(Boolean(seeded),'fresh seed MFD-WJ-001 exists');
x=await call(`/api/styles/${seeded.id}`);ok(x.r.status===200,'load style snapshot');let snap=x.data;ok(snap.measurements.length===6&&snap.measurements.every(m=>m.state==='LOCKED'),'A-F are six LOCKED measurements');ok(snap.measurements.map(m=>m.value).join(',')==='57,44,56,62,38,30','A-F confirmed values');ok(snap.bom.some(b=>b.code==='B01'&&b.provenance==='UNKNOWN'),'fabric is not falsely confirmed');ok(snap.operations.find(o=>o.seq===8).description.includes('المسافات والمقاس'),'Morfok exact spacing remains TBC');
// CRUD editors
x=await call(`/api/styles/${seeded.id}/measurements`,{method:'POST',body:{code:'G',name:'اختبار',nameEn:'Test POM',value:10,unit:'cm',provenance:'USER_CONFIRMED',state:'DRAFT'}});ok(x.r.status===200,'POM editor upsert');
x=await call(`/api/styles/${seeded.id}/bom`,{method:'POST',body:{code:'BT','category':'TEST',name:'بند اختبار',nameEn:'Test item',specification:'TBC',status:'TBC',provenance:'UNKNOWN'}});ok(x.r.status===200,'BOM editor upsert');
x=await call(`/api/styles/${seeded.id}/patterns`,{method:'POST',body:{code:'PT',name:'قطعة اختبار',nameEn:'Test piece',qty:2,mirror:true,onFold:false,grainline:'TBC',state:'DRAFT',provenance:'PROPOSED'}});ok(x.r.status===200,'Pattern editor upsert');
x=await call(`/api/styles/${seeded.id}/operations`,{method:'POST',body:{seq:40,name:'تشغيل اختبار',nameEn:'Test operation',description:'وصف',descriptionEn:'Description',machine:'Test',stitch:'301',qcPoint:'QC',qcPointEn:'QC',state:'DRAFT',provenance:'PROPOSED'}});ok(x.r.status===200,'Operations editor upsert');
x=await call(`/api/styles/${seeded.id}/colorways`,{method:'POST',body:{code:'CW02',name:'رمادي',nameEn:'Grey',mainColor:'#777777',state:'APPROVED',provenance:'USER_CONFIRMED'}});ok(x.r.status===200,'Colorway editor upsert');
x=await call(`/api/styles/${seeded.id}/measurements/A`,{method:'DELETE'});ok(x.r.status===409,'LOCKED POM cannot be deleted without explicit force');
x=await call(`/api/styles/${seeded.id}/measurements/G`,{method:'DELETE'});ok(x.r.status===200,'draft POM delete');
// Upload + asset role
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';
x=await call(`/api/styles/${seeded.id}/assets`,{method:'POST',body:{filename:'front.png',dataUrl:png,role:'TECHNICAL_FRONT',rightsStatus:'USER_ASSERTED'}});ok(x.r.status===201,'asset upload');const a2=x.data.id;
x=await call(`/api/assets/${a2}/role`,{method:'PATCH',body:{role:'MEASUREMENT_MAP'}});ok(x.r.status===200&&x.data.role==='MEASUREMENT_MAP','asset role update');
// AI fallback and lock protection
snap=(await call(`/api/styles/${seeded.id}`)).data;const hero=snap.assets.find(a=>a.role==='HERO'),closureBefore=snap.dna.find(d=>d.field_key==='closure').value_text;
x=await call(`/api/styles/${seeded.id}/ai-analyze`,{method:'POST',body:{assetId:hero.id,provider:'auto'}});ok(x.r.status===200&&x.data.provider==='openai'&&x.data.attempts.some(a=>a.provider==='anthropic'),'AI auto fallback anthropic -> openai');const ai=x.data.result;
x=await call(`/api/styles/${seeded.id}/apply-ai`,{method:'POST',body:{result:ai}});ok(x.r.status===200,'apply AI draft');
snap=(await call(`/api/styles/${seeded.id}`)).data;const closure=snap.dna.find(d=>d.field_key==='closure');ok(closure.value_text===closureBefore&&closure.state==='LOCKED','AI cannot overwrite LOCKED closure DNA');
// Multi-image consensus
x=await call(`/api/styles/${seeded.id}/ai-analyze-multi`,{method:'POST',body:{assetIds:[hero.id,a2],provider:'auto'}});ok(x.r.status===200&&x.data.provider==='openai','multi-image analysis with fallback');ok((x.data.result.conflicts||[]).length===1&&x.data.result.sourceAssets.length===2,'multi-image conflicts/sourceAssets surfaced');
// Output and versions
x=await call(`/api/styles/${seeded.id}/output?profile=mohsen_techpack`);ok(x.r.status===200,'MOHSEN output route');ok((x.data.match(/class="tp-page/g)||[]).length===20,'MOHSEN output has exactly 20 pages');ok(x.data.includes('@page{size:A4 landscape'),'MOHSEN output is A4 landscape');
x=await call(`/api/styles/${seeded.id}/versions`,{method:'POST',body:{label:'Batch04 Integration'}});ok(x.r.status===201,'version snapshot');
// Audit
x=await call(`/api/audit?orgId=${mohsen.id}`);ok(x.r.status===200&&x.data.items.some(i=>i.action==='EDITOR_UPSERT')&&x.data.items.some(i=>i.action==='ANALYZE_MULTI'),'audit captures editor + multi AI');
// Tenant isolation with non-platform MOHSEN user
const otherOrg='org_other',otherStyle='sty_other',ts=new Date().toISOString();db.prepare('INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES(?,?,?,?,?)').run(otherOrg,'OTHER','Other Org','{}',ts);db.prepare('INSERT INTO styles(id,org_id,code,name,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(otherStyle,otherOrg,'OTHER-1','Other Style','u-none',ts,ts);
x=await call('/api/auth/login',{method:'POST',body:{email:'mohsen@mohsen.local',password:env.MOHSEN_BOOTSTRAP_PASSWORD},cookieOverride:''});ok(x.r.status===200,'MOHSEN user login');const mohsenCookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call(`/api/styles/${otherStyle}`,{cookieOverride:mohsenCookie});ok(x.r.status===403,'tenant isolation denies other workspace');
console.log('BATCH04_INTEGRATION_PASS');
