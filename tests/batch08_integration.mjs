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
const env={DB:new D1Mock(db),UPLOADS:new R2Mock(),STATIC,SESSION_SECRET:'batch08-test-session-secret',DEV_BOOTSTRAP_PASSWORD:'DevOnly!234',MOHSEN_BOOTSTRAP_PASSWORD:'MohsenOnly!234',LICENSE_MODE:'development'};
let cookie='';
async function call(path,{method='GET',body,cookieOverride}={}){const headers={};if(body!==undefined)headers['content-type']='application/json';const c=cookieOverride===undefined?cookie:cookieOverride;if(c)headers.cookie=c;const r=await worker.fetch(new Request('http://local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);const ct=r.headers.get('content-type')||'';const data=ct.includes('json')?await r.json():await r.text();return{r,data}}
function ok(cond,msg){if(!cond)throw new Error('ASSERT: '+msg);console.log('PASS',msg)}
function pageCount(html){return (String(html).match(/class="tp-page/g)||[]).length}

await call('/api/me',{cookieOverride:''});
let x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''});ok(x.r.status===200,'developer login');cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call('/api/health');ok(x.r.status===200&&x.data.schemaVersion==='18'&&x.data.version==='0.21.0-cloudflare','Preview 21 health/schema');
x=await call('/api/garment-template-profiles');ok(x.r.status===200&&x.data.template.garmentAgnostic===true&&x.data.template.pageCount===20,'Dynamic master profile registry');ok(x.data.profiles.some(p=>p.id==='MEN_PANTS'&&p.family==='PANTS')&&x.data.profiles.some(p=>p.id==='ISLAMIC_WEAR'),'Multiple garment families registered');
x=await call('/api/output-templates');const master=x.data.templates.find(t=>t.id==='mohsen_nexz_20p');ok(master?.version===2&&master?.garmentAgnostic===true,'20P output template declares garment-agnostic v2');

x=await call('/api/me');const mohsen=x.data.workspaces.find(w=>w.code==='MOHSEN');ok(Boolean(mohsen),'MOHSEN workspace');
x=await call(`/api/styles?orgId=${mohsen.id}`);const jacket=x.data.items.find(s=>s.code==='MFD-WJ-001');ok(Boolean(jacket),'Gold jacket seed');
x=await call(`/api/styles/${jacket.id}/output?profile=mohsen_techpack`);ok(x.r.status===200&&pageCount(x.data)===20,'Gold jacket still renders 20 pages');ok(/Morfok/i.test(x.data)&&/Women&#39;s Jacket/.test(x.data),'Gold jacket remains data-driven Morfok/Jacket specific');

// Create a completely different garment family using real editor APIs.
x=await call('/api/styles',{method:'POST',body:{orgId:mohsen.id,code:'MFD-MP-001',name:'بنطلون رجالي واسع تجريبي',garmentType:'MEN_PANTS',audience:'MEN',sizingMode:'STANDARD',baseSize:'M'}});ok(x.r.status===201,'MEN_PANTS style created');const pantsId=x.data.id;
const pngData='data:image/png;base64,'+demo.toString('base64');
x=await call(`/api/styles/${pantsId}/assets`,{method:'POST',body:{filename:'pants-reference.png',dataUrl:pngData,role:'HERO',rightsStatus:'USER_ASSERTED'}});ok(x.r.status===201,'Pants reference attached');
for(const row of [
  {fieldKey:'fit',label:'القصة / Fit',value:'قصة واسعة بسقوط مستقيم / Relaxed wide straight fall',state:'APPROVED'},
  {fieldKey:'closure',label:'الغلق / Closure',value:'سوستة أمامية أسفل مرد + زر بالكمر / Front zipper under fly + waistband button',state:'APPROVED'},
  {fieldKey:'waistband',label:'الكمر / Waistband',value:'كمر أمامي ثابت / Fixed front waistband',state:'APPROVED'}
]){x=await call(`/api/styles/${pantsId}/dna`,{method:'POST',body:{...row,provenance:'USER_CONFIRMED'}});ok(x.r.status===200,`Pants DNA ${row.fieldKey}`)}
for(const [i,row] of [
  ['W','محيط الوسط','Waist Circumference',84],['H','محيط الأرداف','Hip Circumference',112],['R','ارتفاع الحجر الأمامي','Front Rise',32.5],['I','طول الرجل الداخلي','Inseam',78],['L','الطول الكلي','Outseam',108]
].entries()){x=await call(`/api/styles/${pantsId}/measurements`,{method:'POST',body:{code:row[0],name:row[1],nameEn:row[2],value:row[3],unit:'cm',provenance:'USER_CONFIRMED',state:'LOCKED',sortOrder:i}});ok(x.r.status===200,`Pants POM ${row[0]}`)}
for(const [i,row] of [
  ['F01','الأمام','Front Leg',2,true,false,'WARP'],['B01','الخلف','Back Leg',2,true,false,'WARP'],['WB01','الكمر','Waistband',2,false,false,'WARP'],['PK01','كيس الجيب','Pocket Bag',4,true,false,'WARP'],['FL01','المرد','Fly / Fly Shield',2,true,false,'WARP']
].entries()){x=await call(`/api/styles/${pantsId}/patterns`,{method:'POST',body:{code:row[0],name:row[1],nameEn:row[2],qty:row[3],mirror:row[4],onFold:row[5],grainline:row[6],provenance:'USER_CONFIRMED',state:'APPROVED',sortOrder:i}});ok(x.r.status===200,`Pants pattern ${row[0]}`)}
for(const [i,row] of [
  ['B01','FABRIC','القماش الرئيسي','Main fabric','خامة معتمدة للعينة / Approved sample fabric',1,'style'],
  ['B02','TRIM','سوستة أمامية','Front zipper','الطول حسب الباترون المعتمد / Length per approved pattern',1,'unit'],
  ['B03','TRIM','زر الكمر','Waistband button','زر أمامي معتمد / Approved front button',1,'unit']
].entries()){x=await call(`/api/styles/${pantsId}/bom`,{method:'POST',body:{code:row[0],category:row[1],name:row[2],nameEn:row[3],specification:row[4],specificationEn:row[4],qty:row[5],unit:row[6],status:'APPROVED',provenance:'USER_CONFIRMED',sortOrder:i}});ok(x.r.status===200,`Pants BOM ${row[0]}`)}
for(const row of [
  {seq:1,name:'تجهيز الجيوب',nameEn:'Prepare pockets',description:'تجهيز فتحات وأكياس الجيوب',descriptionEn:'Prepare pocket openings and bags',machine:'SNLS',stitch:'301',qcPoint:'تماثل الجيوب',qcPointEn:'Pocket symmetry'},
  {seq:2,name:'تركيب السوستة والمرد',nameEn:'Install zipper and fly',description:'تركيب السوستة داخل المرد الأمامي',descriptionEn:'Install front zipper inside fly',machine:'SNLS',stitch:'301',qcPoint:'غلق مستقيم',qcPointEn:'Straight closure'},
  {seq:3,name:'تجميع الرجل',nameEn:'Assemble legs',description:'تجميع الأمام والخلف',descriptionEn:'Join front and back legs',machine:'Overlock',stitch:'504',qcPoint:'عدم التواء الرجل',qcPointEn:'No leg twisting'},
  {seq:4,name:'تركيب الكمر',nameEn:'Attach waistband',description:'تركيب الكمر وضبط المرد',descriptionEn:'Attach waistband and align fly',machine:'SNLS',stitch:'301',qcPoint:'استقامة الكمر',qcPointEn:'Waistband level'},
  {seq:5,name:'تشطيب الذيل',nameEn:'Finish hem',description:'ثني وتشطيب الذيل',descriptionEn:'Turn and finish hem',machine:'Cover/SNLS',stitch:'406',qcPoint:'بدون تموج',qcPointEn:'No waviness'},
  {seq:6,name:'الفحص والكي',nameEn:'Final QC and pressing',description:'فحص القياسات والتماثل',descriptionEn:'Check measurements and symmetry',machine:'Press',stitch:'—',qcPoint:'مطابقة POM',qcPointEn:'POM conformity'}
]){x=await call(`/api/styles/${pantsId}/operations`,{method:'POST',body:{...row,provenance:'USER_CONFIRMED',state:'APPROVED'}});ok(x.r.status===200,`Pants operation ${row.seq}`)}
x=await call(`/api/styles/${pantsId}/colorways`,{method:'POST',body:{code:'BLK',name:'أسود',nameEn:'Black',mainColor:'#171717',provenance:'USER_CONFIRMED',state:'APPROVED',sortOrder:0}});ok(x.r.status===200,'Pants colorway');

x=await call(`/api/styles/${pantsId}/output?profile=mohsen_techpack`);ok(x.r.status===200&&pageCount(x.data)===20,'Pants dynamic tech pack is exactly 20 pages');
const pantsHtml=x.data;
ok(/Men&#39;s Pants \/ Trousers/.test(pantsHtml)&&/MEN_PANTS/.test(pantsHtml),'Pants profile rendered on cover');
ok(/F01 Front Leg — Cut Card/.test(pantsHtml)&&/B01 Back Leg — Cut Card/.test(pantsHtml)&&/WB01 Waistband — Cut Card/.test(pantsHtml),'Dynamic cut-card pages use actual pants pieces');
ok(/Zipper \/ Closure Detail|Waist & Closure Detail/.test(pantsHtml)&&/Front zipper/i.test(pantsHtml),'Page 14 adapts to pants waist/zipper construction');
ok(!/Morfok|Frog Decorative|Women's Short Boxy Morfok Jacket/i.test(pantsHtml),'Pants output has zero jacket/Morfok leakage');
ok(!/A–F Confirmed Finished Measurements|A–F are finished garment measurements/i.test(pantsHtml),'Measurement pages are code-agnostic');

x=await call(`/api/styles/${pantsId}/completeness?template=mohsen_nexz_20p`);ok(x.r.status===200&&x.data.checks.length===20,'Pants completeness stays 20-page');ok(!x.data.checks.some(c=>/P04|P05|Morfok/i.test(`${c.key} ${c.message}`)),'Completeness contains no jacket-specific cut-card rules');ok(x.data.checks.find(c=>c.page===10)?.key==='CUT_CARD_1'&&x.data.checks.find(c=>c.page===14)?.key==='SPECIAL_DETAIL','Generic cut-card and special-detail completeness keys');

console.log('BATCH08_INTEGRATION_PASS');
