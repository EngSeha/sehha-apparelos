import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';
const _consoleError=console.error;console.error=(...args)=>{if(process.env.VERBOSE_TEST==='1')_consoleError(...args)};
export const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
export function makeHarness(){
 const migrations=['0001_init.sql','0002_ai_review_pattern.sql','0003_mohsen_master_bilingual.sql','0004_pattern_intelligence_grading.sql','0005_release_workflow.sql','0006_factory_collaboration.sql','0007_requirements_matrix.sql','0008_sample_fit_validation.sql','0009_costing_consumption.sql','0010_production_quality.sql','0011_production_planning.sql','0012_frozen_planning_basis.sql','0013_factory_operation_execution.sql','0014_reconciliation_concurrency.sql','0015_full_actual_cost.sql'];
 const db=new DatabaseSync(':memory:'); for(const f of migrations) db.exec(readFileSync(resolve(root,'migrations',f),'utf8'));
 class D1Mock{constructor(db){this.db=db}prepare(sql){const st=this.db.prepare(sql);return{bind:(...args)=>{const vals=args.map(v=>v===undefined?null:v);return{first:()=>st.get(...vals)||null,all:()=>({results:st.all(...vals)}),run:()=>{const r=st.run(...vals);return{success:true,meta:{changes:Number(r.changes||0)}}}}}}}}
 class R2Object{constructor(bytes,meta={}){this.bytes=bytes;this.meta=meta;this.httpEtag='test';this.body=bytes}async arrayBuffer(){return this.bytes.buffer.slice(this.bytes.byteOffset,this.bytes.byteOffset+this.bytes.byteLength)}writeHttpMetadata(h){if(this.meta?.httpMetadata?.contentType)h.set('content-type',this.meta.httpMetadata.contentType)}}
 class R2Mock{constructor(){this.map=new Map()}async put(k,bytes,meta){this.map.set(k,new R2Object(new Uint8Array(bytes),meta));return{}}async get(k){return this.map.get(k)||null}}
 const STATIC={fetch:async()=>new Response('static')};
 const env={DB:new D1Mock(db),UPLOADS:new R2Mock(),STATIC,SESSION_SECRET:'b13-secret',DEV_BOOTSTRAP_PASSWORD:'DevOnly!234',MOHSEN_BOOTSTRAP_PASSWORD:'MohsenOnly!234',LICENSE_MODE:'development'};let cookie='';
 async function call(path,{method='GET',body,cookieOverride}={}){const headers={};if(body!==undefined)headers['content-type']='application/json';const c=cookieOverride===undefined?cookie:cookieOverride;if(c)headers.cookie=c;const r=await worker.fetch(new Request('http://local'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);const ct=r.headers.get('content-type')||'';const data=ct.includes('json')?await r.json():await r.text();return{r,data}}
 async function login(){const x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''}); if(x.r.status!==200)throw new Error('login failed');cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];return x;}
 return {db,env,call,login,get cookie(){return cookie}};
}
export function ok(c,m){if(!c)throw new Error('ASSERT: '+m);console.log('PASS',m)}
