import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..'),db=new DatabaseSync(':memory:');
const realConsoleError=console.error;console.error=(...args)=>{if(process.env.VERBOSE_TEST==='1')realConsoleError(...args)};
for(const f of ['0001_init.sql','0002_ai_review_pattern.sql','0003_mohsen_master_bilingual.sql','0004_pattern_intelligence_grading.sql','0005_release_workflow.sql','0006_factory_collaboration.sql','0007_requirements_matrix.sql'])db.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
class D1Mock{constructor(db){this.db=db}prepare(sql){const st=this.db.prepare(sql);return{bind:(...args)=>{const vals=args.map(v=>v===undefined?null:v);return{first:()=>st.get(...vals)||null,all:()=>({results:st.all(...vals)}),run:()=>{const r=st.run(...vals);return{success:true,meta:{changes:Number(r.changes||0)}}}}}}}}
class R2Object{constructor(bytes,meta={}){this.bytes=bytes;this.meta=meta;this.httpEtag='test-etag';this.body=bytes}async arrayBuffer(){return this.bytes.buffer.slice(this.bytes.byteOffset,this.bytes.byteOffset+this.bytes.byteLength)}writeHttpMetadata(h){if(this.meta?.httpMetadata?.contentType)h.set('content-type',this.meta.httpMetadata.contentType)}}
class R2Mock{constructor(){this.map=new Map()}async put(k,bytes,meta){this.map.set(k,new R2Object(new Uint8Array(bytes),meta));return{}}async get(k){return this.map.get(k)||null}}
const demo=readFileSync(resolve(root,'public','demo_jk001_reference.png'));
const STATIC={fetch:async input=>{const raw=typeof input==='string'?input:(input instanceof URL?input.href:input.url);const u=new URL(raw);if(u.pathname==='/demo_jk001_reference.png')return new Response(demo,{headers:{'content-type':'image/png'}});return new Response('static',{status:200})}};
const env={DB:new D1Mock(db),UPLOADS:new R2Mock(),STATIC,SESSION_SECRET:'render06-secret',DEV_BOOTSTRAP_PASSWORD:'DevOnly!234',MOHSEN_BOOTSTRAP_PASSWORD:'MohsenOnly!234',LICENSE_MODE:'development'};
let cookie='';
async function call(path,{method='GET',body}={}){const headers={};if(body!==undefined)headers['content-type']='application/json';if(cookie)headers.cookie=cookie;const r=await worker.fetch(new Request('http://local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);const ct=r.headers.get('content-type')||'';const data=ct.includes('json')?await r.json():await r.text();if(!r.ok)throw new Error(`${r.status}: ${typeof data==='string'?data:JSON.stringify(data)}`);return{r,data}}
await worker.fetch(new Request('http://local/api/me'),env);
let x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:env.DEV_BOOTSTRAP_PASSWORD}});cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN');x=await call(`/api/styles?orgId=${org.id}`);const st=x.data.items.find(s=>s.code==='MFD-WJ-001');
// Build a fully human-approved production fixture. These values are test-only evidence, not default product facts.
for(const d of [
  {fieldKey:'fabric',label:'الخامة / Fabric',value:'Approved woven sample — render fixture',state:'APPROVED',provenance:'USER_CONFIRMED',force:true},
  {fieldKey:'collar',label:'الياقة / Collar',value:'Approved stand collar construction — render fixture',state:'APPROVED',provenance:'USER_CONFIRMED',force:true}
])await call(`/api/styles/${st.id}/dna`,{method:'POST',body:d});
for(const b of [
  {code:'B01',category:'SHELL',name:'القماش الخارجي',nameEn:'Main fabric',specification:'Approved woven shell sample for visual proof',specificationEn:'Approved woven shell sample for visual proof',qty:1,unit:'style',status:'APPROVED',provenance:'USER_CONFIRMED'},
  {code:'B02',category:'THREAD',name:'خيط الخياطة',nameEn:'Sewing thread',specification:'Approved matching polyester thread',specificationEn:'Approved matching polyester thread',qty:1,unit:'set',status:'APPROVED',provenance:'USER_CONFIRMED'},
  {code:'B03',category:'TRIM',name:'وحدة Morfok',nameEn:'Morfok/Frog closure',specification:'4 approved physical-sample closure units; placement per approved sample',specificationEn:'4 approved physical-sample closure units; placement per approved sample',qty:4,unit:'unit',status:'APPROVED',provenance:'USER_CONFIRMED'}
])await call(`/api/styles/${st.id}/bom`,{method:'POST',body:b});
const patterns=[
  ['P01','ظهر','Back Body',1,false,true,'WARP'],['P02','أمام','Front Body',2,true,false,'WARP'],['P03','كم','Sleeve',2,true,false,'WARP'],['P04','ياقة','Collar',2,false,false,'WARP'],['P05','فيسنج أمامي','Front Facing',2,true,false,'WARP'],['T01','Morfok','Morfok Closure',4,false,false,'N/A']
];
for(let i=0;i<patterns.length;i++){const [code,name,nameEn,qty,mirror,onFold,grainline]=patterns[i];await call(`/api/styles/${st.id}/patterns`,{method:'POST',body:{code,name,nameEn,qty,mirror,onFold,grainline,note:'Approved production render fixture',noteEn:'Approved production render fixture',provenance:'USER_CONFIRMED',state:'APPROVED',sortOrder:i}});}
await call(`/api/styles/${st.id}/pattern-links`,{method:'POST',body:{fromCode:'P01',toCode:'P02',relation:'SEAM_JOIN',label:'Approved assembly relationship',labelEn:'Approved assembly relationship',provenance:'USER_CONFIRMED',state:'APPROVED'}});
x=await call(`/api/styles/${st.id}/versions`,{method:'POST',body:{label:'Production Visual Proof'}});const versionNo=x.data.versionNo;
x=await call(`/api/styles/${st.id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:versionNo,note:'Production visual proof'}});const rel=x.data.releaseNo;
const frozen=(await call(`/api/styles/${st.id}/releases/${rel}/output?profile=mohsen_techpack`)).data;
const manifest=(await call(`/api/styles/${st.id}/releases/${rel}/manifest`)).data;
writeFileSync('/mnt/data/BATCH06_FROZEN_RELEASE_TECHPACK.html',frozen);writeFileSync('/mnt/data/BATCH06_RELEASE_MANIFEST.json',JSON.stringify(manifest,null,2));
console.log('BATCH06_RELEASE_RENDER_FIXTURE_PASS',rel,(frozen.match(/class="tp-page/g)||[]).length,manifest.manifestSha256);
