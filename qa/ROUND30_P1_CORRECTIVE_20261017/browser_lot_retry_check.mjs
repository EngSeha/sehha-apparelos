// ROUND30 P1-B browser check: opening a Production Lot from the Arabic production tab when the first response is LOST.
// Runs against a local `wrangler dev` (workerd + local D1, migrations 0001..0022). Not remote, not CI. Extra users and
// engineering facts are seeded with `wrangler d1 execute --local` (fixture only), exactly like the ROUND30 browser check.
// Playwright lets the first POST reach the Worker (route.fetch -> the server COMMITS) and then aborts the response to the
// page: the UI sees a network failure. The user clicks again; the same Idempotency-Key must replay the original lot.
// Usage: BASE=http://127.0.0.1:8798 PERSIST=<dir> OUT=<dir> PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node qa/ROUND30_P1_CORRECTIVE_20261017/browser_lot_retry_check.mjs
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {buildReleaseCandidate} from '../../tests/release_fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const BASE=process.env.BASE||'http://127.0.0.1:8798',OUT=process.env.OUT||'.',PERSIST=process.env.PERSIST,PW='DevOnly!234',ROOT=resolve(new URL('../..',import.meta.url).pathname);
const results=[];const ok=(c,m)=>{results.push({check:m,result:c?'PASS':'FAIL'});console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
function client(){let cookie='';return async function call(path,{method='GET',body,headers={}}={}){const r=await fetch(BASE+path,{method,headers:{...headers,...(body!==undefined?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});const sc=r.headers.get('set-cookie');if(sc&&path==='/api/auth/login')cookie=sc.split(';')[0];const ct=r.headers.get('content-type')||'';return {r,data:ct.includes('json')?await r.json():await r.text()};};}
const sqlq=v=>v==null?'NULL':`'${String(v).replace(/'/g,"''")}'`;
function d1(sql){const r=spawnSync(process.execPath,[resolve(ROOT,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','DB','--local','--persist-to',PERSIST,'--json','--command',sql],{cwd:ROOT,encoding:'utf8',env:{...process.env,CI:'1'}});if(r.status!==0)throw new Error('d1 execute failed\n'+r.stdout+r.stderr);try{return JSON.parse(r.stdout)}catch{return null}}
const dev=client();await dev('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:PW}});
const org=(await dev('/api/me')).data.workspaces.find(w=>w.code==='MOHSEN');
const code='UI-P1-'+Date.now().toString(36).toUpperCase(),id=await buildReleaseCandidate(dev,org,code),ts=new Date().toISOString();
const tag=code.slice(6).toLowerCase(),U=k=>`bp1_${k}_${tag}`,users={[U('eng')]:'DESIGN_PATTERN_MASTER',[U('prod')]:'FACTORY_SUPERVISOR',[U('qc')]:'QC_MANAGER',[U('fs')]:'FACTORY_SUPERVISOR'};const stmts=[];
for(const [u,role] of Object.entries(users)){const salt=randomBytes(16).toString('hex'),hash=pbkdf2Sync(PW,Buffer.from(salt,'hex'),210000,32,'sha256').toString('hex');stmts.push(`INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES(${sqlq(u)},${sqlq(u+'@bp1.local')},${sqlq(u)},${sqlq(hash)},${sqlq(salt)},${sqlq(ts)})`,`INSERT INTO memberships(user_id,org_id,role) VALUES(${sqlq(u)},${sqlq(org.id)},${sqlq(role)})`);}
stmts.push(`INSERT INTO assets(id,style_id,role,filename,stored_name,mime_type,created_at) VALUES(${sqlq('ast_'+id)},${sqlq(id)},'HERO','hero.png','hero.png','image/png',${sqlq(ts)})`);
for(const [k,v] of [['fit','Regular fit — fixture approved'],['fabric','Cotton twill — fixture approved']])stmts.push(`INSERT INTO dna_items(id,style_id,field_key,field_label,value_text,provenance,state,created_at,updated_at) VALUES(${sqlq('dna_'+k+'_'+id)},${sqlq(id)},${sqlq(k)},${sqlq(k)},${sqlq(v)},'USER_CONFIRMED','APPROVED',${sqlq(ts)},${sqlq(ts)})`);
stmts.push(`UPDATE measurements SET tolerance_plus=COALESCE(tolerance_plus,1),tolerance_minus=COALESCE(tolerance_minus,1) WHERE style_id=${sqlq(id)}`,
 `INSERT INTO fabric_specifications(id,style_id,code,name_en,composition,construction,width_cm,usable_width_cm,purchase_unit,cutting_unit,shrinkage_warp_pct,defect_allowance_pct,direction_rule,state,created_at,updated_at) VALUES(${sqlq('fab_'+id)},${sqlq(id)},'F1','Shell','100% Cotton','Twill',150,140,'m','m',2,1,'TWO_WAY','APPROVED',${sqlq(ts)},${sqlq(ts)})`,
 `INSERT INTO trim_specifications(id,style_id,code,trim_type,name_en,placement,quantity,unit,state,created_at,updated_at) VALUES(${sqlq('trm_'+id)},${sqlq(id)},'T1','BUTTON','Button','Front',5,'pcs','APPROVED',${sqlq(ts)},${sqlq(ts)})`,
 `INSERT INTO pattern_piece_specs(id,style_id,code,name_en,size_code,cut_qty,material_code,grain_direction,seam_allowance_cm,state,created_at,updated_at) VALUES(${sqlq('ppc_'+id)},${sqlq(id)},'PC1','Front','M',2,'F1','STRAIGHT',1,'APPROVED',${sqlq(ts)},${sqlq(ts)})`,
 `INSERT INTO marker_plans(id,style_id,code,fabric_code,size_ratio_json,marker_length_m,usable_width_cm,plies,wastage_pct,layout_json,state,created_at,updated_at) VALUES(${sqlq('mrk_'+id)},${sqlq(id)},'MK1','F1','{"M":1}',2.5,140,10,3,'{"direction":"TWO_WAY"}','APPROVED',${sqlq(ts)},${sqlq(ts)})`,
 `INSERT INTO routing_steps(id,style_id,code,sequence_no,department,name_en,machine,qc_checkpoint,state,created_at,updated_at) VALUES(${sqlq('rte_'+id)},${sqlq(id)},'R1',1,'SEWING','Assembly','SN','Seam check','APPROVED',${sqlq(ts)},${sqlq(ts)})`,
 `INSERT INTO sample_rounds(id,style_id,version_no,round_no,sample_type,status,spec_snapshot_json,created_by,created_at,updated_at) VALUES(${sqlq('smp_'+id)},${sqlq(id)},2,902,'PP','APPROVED','{}','fixture',${sqlq(ts)},${sqlq(ts)})`);
d1(stmts.join(';\n')+';');
const v=(await dev(`/api/styles/${id}/versions`,{method:'POST',body:{label:'Browser P1 candidate'}})).data.versionNo;
const rel=await dev(`/api/styles/${id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:v}});if(rel.r.status!==201)throw new Error('release '+JSON.stringify(rel.data));const n=rel.data.releaseNo;
for(const [u,roles] of [[U('eng'),['DESIGN','PATTERN']],[U('prod'),['PRODUCTION']],[U('qc'),['QC']]]){const c=client();await c('/api/auth/login',{method:'POST',body:{email:u+'@bp1.local',password:PW}});for(const roleKey of roles){const s=await c(`/api/styles/${id}/releases/${n}/signoffs`,{method:'POST',body:{roleKey,decision:'APPROVED'}});if(s.r.status!==200)throw new Error('signoff '+roleKey+' '+JSON.stringify(s.data));}}
const p=await dev(`/api/styles/${id}/releases/${n}/handoffs`,{method:'POST',body:{}});if(p.r.status!==201)throw new Error('prepare '+JSON.stringify(p.data));
await dev(`/api/styles/${id}/handoffs/${p.data.id}/dispatch`,{method:'POST',body:{}});
const fs=client();await fs('/api/auth/login',{method:'POST',body:{email:U('fs')+'@bp1.local',password:PW}});const a=await fs(`/api/styles/${id}/handoffs/${p.data.id}/acknowledge`,{method:'POST',body:{note:'received'}});if(a.r.status!==200)throw new Error('ack '+JSON.stringify(a.data));
const lotsNow=async()=>(await dev(`/api/styles/${id}/production-lots`)).data.items||[];
const receipts=()=>{const j=d1(`SELECT COUNT(*) n FROM lot_receipts WHERE style_id=${sqlq(id)}`);return j?.[0]?.results?.[0]?.n;};
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1366,height:900}});
const posts=[];page.on('request',r=>{if(r.method()==='POST'&&/production-lots$/.test(r.url()))posts.push({key:r.headers()['idempotency-key']||null,body:r.postData()});});
const responses=[];page.on('response',r=>{if(r.request().method()==='POST'&&/production-lots$/.test(r.url()))responses.push({status:r.status(),replayed:r.headers()['idempotency-replayed']||null});});
await page.goto(BASE+'/');// The FACTORY_SUPERVISOR guided surface has no lot-creation form yet (R30-D12 family); the professional production tab is
// used by the workspace owner, who holds LOT_CREATE. The supervisor's lot API path is proven in the node/workerd suites.
await page.fill('input[name=email]','dev@sehha.local');await page.fill('input[name=password]',PW);await page.click('#login button, #login [type=submit]');
await page.waitForSelector(`[data-style="${id}"]`,{timeout:20000}).catch(async()=>{await page.screenshot({path:`${OUT}/ui_lot_login_state.png`});});
let lostOnce=false;let serverStatusOfLost=null;
await page.route(/\/production-lots$/,async route=>{if(route.request().method()!=='POST'||lostOnce)return route.continue();lostOnce=true;const resp=await route.fetch();serverStatusOfLost=resp.status();await route.abort('connectionreset');});
const toProduction=async()=>{if(await page.locator(`[data-style="${id}"]`).count()){await page.click(`[data-style="${id}"]`);}await page.waitForSelector('[data-style-tab="production"]',{timeout:20000});await page.click('[data-style-tab="production"]');await page.waitForSelector('#lotCreateForm',{timeout:20000});};
await toProduction();
await page.selectOption('#lotCreateForm select[name=releaseNo]',String(n));await page.fill('#lotCreateForm input[name=lotCode]','LOT-UI-P1');await page.fill('#lotCreateForm input[name=plannedQty]','40');
await page.click('#lotCreateForm button');
const lostToast=await page.waitForSelector('text=تعذّر التأكد من نتيجة الطلب',{timeout:15000}).then(()=>true).catch(()=>false);
const afterLost=await lotsNow();
ok(serverStatusOfLost===201&&afterLost.length===1&&lostToast,'First click: the server committed the lot (201) but the response was lost; the UI says the outcome is unconfirmed and that retrying will not duplicate');
await page.screenshot({path:`${OUT}/ui_lot_response_lost.png`});
await page.click('#lotCreateForm button');
const created=await page.waitForSelector('text=تم فتح أمر الإنتاج LOT-UI-P1',{timeout:15000}).then(()=>true).catch(()=>false);await page.waitForTimeout(500);
const afterRetry=await lotsNow();
ok(created&&afterRetry.length===1&&afterRetry[0].lot_code==='LOT-UI-P1','Second click (same intent): success message, still exactly one lot');
ok(posts.length===2&&posts[0].key&&posts[0].key.length>=8&&posts[0].key===posts[1].key,'Both clicks carried the same Idempotency-Key (one intent)');
ok(responses.some(r=>r.status===201&&r.replayed==='true'),'The retry was answered by the server replay (idempotency-replayed: true), not by a second insert');
ok(Number(receipts())===1,'Exactly one durable lot receipt exists for the style');
await page.screenshot({path:`${OUT}/ui_lot_replayed.png`});
await toProduction();await page.selectOption('#lotCreateForm select[name=releaseNo]',String(n));await page.fill('#lotCreateForm input[name=lotCode]','LOT-UI-P1');await page.fill('#lotCreateForm input[name=plannedQty]','41');await page.click('#lotCreateForm button');
const dup=await page.waitForSelector('text=رقم أمر الإنتاج مستخدم من قبل لهذا الموديل',{timeout:15000}).then(()=>true).catch(()=>false);
ok(dup&&(await lotsNow()).length===1&&posts.length===3&&posts[2].key!==posts[0].key,'A new intent with an existing lot code gets a new key and the Arabic 409 message; nothing is written');
await page.screenshot({path:`${OUT}/ui_lot_code_exists.png`});
ok(await page.evaluate(()=>document.documentElement.dir)==='rtl','Page is RTL');
await browser.close();writeFileSync(`${OUT}/browser_lot_results.json`,JSON.stringify({base:BASE,styleId:id,releaseNo:n,handoffId:p.data.id,posts:posts.map(x=>({key:x.key})),responses,results},null,1));
