#!/usr/bin/env node
// AI-TP-W01 — OPERATOR-RUN, NON-PRODUCTION smoke test of Cloudflare Workers AI vision on a PRIVATE image.
// Run it on the owner's own machine (or a private session) — NOT in CI, NOT from a public repo checkout with images.
//
//   CLOUDFLARE_ACCOUNT_ID=…  CLOUDFLARE_API_TOKEN=…  node workers_ai_vision_smoke.mjs <image.png|jpg|webp> [label]
//
// Guarantees:
//  * The token and account id are read from the environment only and are NEVER printed, logged or written to disk.
//  * The request is BLIND: image bytes + the same neutral instruction the app uses. No filename, style code, owner notes,
//    expected category or measurements are sent.
//  * Hard budget: at most 3 inference requests per state directory (default ~/.sehha-w01-smoke). No automatic retries.
//    60 s timeout per request.
//  * The Meta Llama 3.2 licence is NOT accepted by this script. If Cloudflare answers that the licence must be accepted,
//    the script stops with BLOCKED_META_OWNER_CONSENT. Only the account owner may decide to accept it, separately and
//    explicitly; this script will not send the "agree" prompt.
//  * Output: a sanitized JSON report (status, timing, sanitized error codes, cf-ray, model, input SHA-256, validated
//    classification). No image bytes, no base64, no headers, no token. Default path is OUTSIDE the repository.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {BLIND_PROMPT,WORKERS_AI_VISION_MODEL,validateClassification,normalizeLive,mapVisionError} from '../../../src/garment_intake.js';
import {imageDimensions,checkDimensions,IMAGE_LIMITS} from '../../../src/image_guard.js';
const [,,imagePath,label='run']=process.argv;
const fail=(code,msg)=>{console.error(JSON.stringify({ok:false,code,message:msg}));process.exit(2);};
if(!imagePath)fail('USAGE','usage: node workers_ai_vision_smoke.mjs <image> [label]');
const ACC=process.env.CLOUDFLARE_ACCOUNT_ID,TOK=process.env.CLOUDFLARE_API_TOKEN;
if(!ACC||!TOK)fail('BLOCKED_SECRET_HANDOFF','Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the environment (never on the command line or in files).');
const stateDir=process.env.SEHHA_SMOKE_STATE||join(homedir(),'.sehha-w01-smoke');mkdirSync(stateDir,{recursive:true});
const counterFile=join(stateDir,'request_count.json'),count=existsSync(counterFile)?JSON.parse(readFileSync(counterFile,'utf8')).count:0;
const LIMIT=3;if(count>=LIMIT)fail('BLOCKED_BUDGET',`Request budget for W01 is exhausted (${count}/${LIMIT}). Delete ${counterFile} only with owner approval.`);
const bytes=readFileSync(resolve(imagePath)),ext=basename(imagePath).toLowerCase().split('.').pop(),mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'}[ext];
if(!mime)fail('IMAGE_MIME_UNSUPPORTED','Use PNG, JPEG or WebP');
const dims=imageDimensions(mime,bytes);checkDimensions(dims,IMAGE_LIMITS,{forVision:true});
const inputSha=createHash('sha256').update(bytes).digest('hex');
writeFileSync(counterFile,JSON.stringify({count:count+1,last:new Date().toISOString()}));   // count BEFORE sending: a crash still consumes budget
const url=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(ACC)}/ai/run/${WORKERS_AI_VISION_MODEL}`;
const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),60000),t0=Date.now();
let status=0,ray=null,body=null,netError=null;
try{const r=await fetch(url,{method:'POST',signal:ctrl.signal,headers:{authorization:`Bearer ${TOK}`,'content-type':'application/json'},body:JSON.stringify({prompt:BLIND_PROMPT,image:[...bytes],max_tokens:900,temperature:0})});
  status=r.status;ray=(r.headers.get('cf-ray')||'').replace(/[^A-Za-z0-9-]/g,'').slice(0,40)||null;body=await r.json().catch(()=>null);}
catch(e){netError=e.name==='AbortError'?'VISION_TIMEOUT':'NETWORK_ERROR';}finally{clearTimeout(timer);}
const errs=(body?.errors||[]).map(e=>({code:e.code,message:String(e.message||'').slice(0,160)}));
let verdict,classification=null,mapped=null;
if(netError)verdict=netError;
else if(!body?.success){mapped=mapVisionError({message:errs.map(e=>`${e.code} ${e.message}`).join(' ')||`${status}`});verdict=mapped.code;}
else{const text=typeof body.result?.response==='string'?body.result.response:JSON.stringify(body.result?.response??'');
  try{classification=normalizeLive(validateClassification(JSON.parse(text.slice(text.indexOf('{'),text.lastIndexOf('}')+1))));verdict='LIVE_MODEL_RESPONSE_VALID';}catch(e){verdict='VISION_SCHEMA_DRIFT';classification={rawResponseFirst300:text.slice(0,300)};}}
const report={label,model:WORKERS_AI_VISION_MODEL,blindPrompt:true,requestNumber:count+1,budget:LIMIT,httpStatus:status,cfRay:ray,elapsedMs:Date.now()-t0,verdict,errors:errs,
  input:{sha256:inputSha,bytes:bytes.length,mime,width:dims.width,height:dims.height},usage:body?.result?.usage||null,classification,
  note:'Sanitized: no token, account id, headers, image bytes or base64. Licence acceptance is an owner decision and is never sent by this script.'};
const outDir=process.env.SEHHA_SMOKE_OUT||join(stateDir,'reports');mkdirSync(outDir,{recursive:true});const out=join(outDir,`w01_${label}_${Date.now()}.json`);writeFileSync(out,JSON.stringify(report,null,1));
console.log(JSON.stringify({verdict,httpStatus:status,report:out}));process.exit(verdict==='LIVE_MODEL_RESPONSE_VALID'?0:1);
