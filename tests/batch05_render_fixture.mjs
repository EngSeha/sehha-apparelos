import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..'),db=new DatabaseSync(':memory:');
for(const f of ['0001_init.sql','0002_ai_review_pattern.sql','0003_mohsen_master_bilingual.sql','0004_pattern_intelligence_grading.sql','0005_release_workflow.sql','0006_factory_collaboration.sql','0007_requirements_matrix.sql'])db.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
class D1Mock{constructor(db){this.db=db}prepare(sql){const st=this.db.prepare(sql);return{bind:(...args)=>{const vals=args.map(v=>v===undefined?null:v);return{first:()=>st.get(...vals)||null,all:()=>({results:st.all(...vals)}),run:()=>{const r=st.run(...vals);return{success:true,meta:{changes:Number(r.changes||0)}}}}}}}}
class R2Object{constructor(bytes,meta={}){this.bytes=bytes;this.meta=meta;this.httpEtag='test-etag';this.body=bytes}async arrayBuffer(){return this.bytes.buffer.slice(this.bytes.byteOffset,this.bytes.byteOffset+this.bytes.byteLength)}writeHttpMetadata(h){if(this.meta?.httpMetadata?.contentType)h.set('content-type',this.meta.httpMetadata.contentType)}}
class R2Mock{constructor(){this.map=new Map()}async put(k,bytes,meta){this.map.set(k,new R2Object(new Uint8Array(bytes),meta));return{}}async get(k){return this.map.get(k)||null}}
const demo=readFileSync(resolve(root,'public','demo_jk001_reference.png'));
const STATIC={fetch:async input=>{const raw=typeof input==='string'?input:(input instanceof URL?input.href:input.url);const u=new URL(raw);if(u.pathname==='/demo_jk001_reference.png')return new Response(demo,{headers:{'content-type':'image/png'}});return new Response('static',{status:200})}};
const env={DB:new D1Mock(db),UPLOADS:new R2Mock(),STATIC,SESSION_SECRET:'render-secret',DEV_BOOTSTRAP_PASSWORD:'DevOnly!234',MOHSEN_BOOTSTRAP_PASSWORD:'MohsenOnly!234',LICENSE_MODE:'development'};
let cookie='';
async function call(path,{method='GET',body}={}){const headers={};if(body!==undefined)headers['content-type']='application/json';if(cookie)headers.cookie=cookie;const r=await worker.fetch(new Request('http://local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);const ct=r.headers.get('content-type')||'';const data=ct.includes('json')?await r.json():await r.text();if(!r.ok)throw new Error(`${r.status}: ${typeof data==='string'?data:JSON.stringify(data)}`);return{r,data}}
await worker.fetch(new Request('http://local/api/me'),env);
let x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:env.DEV_BOOTSTRAP_PASSWORD}});cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN');x=await call(`/api/styles?orgId=${org.id}`);const st=x.data.items.find(s=>s.code==='MFD-WJ-001');
await call(`/api/styles/${st.id}`,{method:'PATCH',body:{base_size:'M',sizing_mode:'STANDARD'}});
for(const b of [{code:'S',name:'صغير',nameEn:'Small',state:'APPROVED'},{code:'M',name:'متوسط',nameEn:'Medium',state:'APPROVED'},{code:'L',name:'كبير',nameEn:'Large',state:'APPROVED'}])await call(`/api/styles/${st.id}/size-bands`,{method:'POST',body:b});
for(const r of [{measurementCode:'A',targetSizeCode:'S',deltaValue:-2,state:'APPROVED'},{measurementCode:'A',targetSizeCode:'M',deltaValue:0,state:'APPROVED'},{measurementCode:'A',targetSizeCode:'L',deltaValue:2,state:'APPROVED'}])await call(`/api/styles/${st.id}/grading-rules`,{method:'POST',body:r});
await call(`/api/styles/${st.id}/pattern-links`,{method:'POST',body:{fromCode:'P01',toCode:'P02',relation:'SEAM_JOIN',label:'كتف/جنب',labelEn:'Shoulder/side',state:'APPROVED'}});
let snap=(await call(`/api/styles/${st.id}`)).data,hero=snap.assets.find(a=>a.role==='HERO');
await call(`/api/styles/${st.id}/annotations`,{method:'POST',body:{assetId:hero.id,label:'منطقة الغلق',labelEn:'Closure region',x:.40,y:.20,w:.20,h:.50,provenance:'USER_CONFIRMED',state:'APPROVED'}});
const tech=(await call(`/api/styles/${st.id}/output?profile=mohsen_techpack`)).data;
const sim=(await call(`/api/styles/${st.id}/output?profile=visual_simulation`)).data;
writeFileSync('/mnt/data/BATCH05_TECHPACK_RENDER.html',tech);writeFileSync('/mnt/data/BATCH05_SIMULATION_RENDER.html',sim);
console.log('BATCH05_RENDER_FIXTURE_PASS', (tech.match(/class="tp-page/g)||[]).length, sim.includes('annotation-box'));
