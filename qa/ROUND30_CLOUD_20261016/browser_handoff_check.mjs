// ROUND30 browser smoke of the Arabic Factory Handoff panel against a local `wrangler dev` (workerd + local D1).
// Not remote, not CI. Extra users/engineering facts are seeded with `wrangler d1 execute --local` (fixture only).
// Usage: BASE=http://127.0.0.1:8797 PERSIST=<dir> OUT=<dir> PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node qa/ROUND30_CLOUD_20261016/browser_handoff_check.mjs
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {buildReleaseCandidate} from '../../tests/release_fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const BASE=process.env.BASE||'http://127.0.0.1:8797',OUT=process.env.OUT||'.',PERSIST=process.env.PERSIST,PW='DevOnly!234',ROOT=resolve(new URL('../..',import.meta.url).pathname);
const results=[];const ok=(c,m)=>{results.push({check:m,result:c?'PASS':'FAIL'});console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
function client(){let cookie='';return async function call(path,{method='GET',body,headers={}}={}){const r=await fetch(BASE+path,{method,headers:{...headers,...(body!==undefined?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});const sc=r.headers.get('set-cookie');if(sc&&path==='/api/auth/login')cookie=sc.split(';')[0];const ct=r.headers.get('content-type')||'';return {r,data:ct.includes('json')?await r.json():await r.text()};};}
const sqlq=v=>v==null?'NULL':`'${String(v).replace(/'/g,"''")}'`;
function d1(sql){const r=spawnSync(process.execPath,[resolve(ROOT,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','DB','--local','--persist-to',PERSIST,'--command',sql],{cwd:ROOT,encoding:'utf8',env:{...process.env,CI:'1'}});if(r.status!==0)throw new Error('d1 execute failed\n'+r.stdout+r.stderr);}
const dev=client();await dev('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:PW}});
const org=(await dev('/api/me')).data.workspaces.find(w=>w.code==='MOHSEN');
const code='UI-R30-'+Date.now().toString(36).toUpperCase(),id=await buildReleaseCandidate(dev,org,code),ts=new Date().toISOString();
const tag=code.slice(7).toLowerCase(),U=k=>`b30_${k}_${tag}`,users={[U('eng')]:'DESIGN_PATTERN_MASTER',[U('prod')]:'FACTORY_SUPERVISOR',[U('qc')]:'QC_MANAGER',[U('own2')]:'WORKSPACE_OWNER'};const stmts=[];
for(const [u,role] of Object.entries(users)){const salt=randomBytes(16).toString('hex'),hash=pbkdf2Sync(PW,Buffer.from(salt,'hex'),210000,32,'sha256').toString('hex');stmts.push(`INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES(${sqlq(u)},${sqlq(u+'@b30.local')},${sqlq(u)},${sqlq(hash)},${sqlq(salt)},${sqlq(ts)})`,`INSERT INTO memberships(user_id,org_id,role) VALUES(${sqlq(u)},${sqlq(org.id)},${sqlq(role)})`);}
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
const v=(await dev(`/api/styles/${id}/versions`,{method:'POST',body:{label:'Browser R30 candidate'}})).data.versionNo;
const rel=await dev(`/api/styles/${id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:v}});if(rel.r.status!==201)throw new Error('release '+JSON.stringify(rel.data));const n=rel.data.releaseNo;
for(const [u,roles] of [[U('eng'),['DESIGN','PATTERN']],[U('prod'),['PRODUCTION']],[U('qc'),['QC']]]){const c=client();await c('/api/auth/login',{method:'POST',body:{email:u+'@b30.local',password:PW}});for(const roleKey of roles){const s=await c(`/api/styles/${id}/releases/${n}/signoffs`,{method:'POST',body:{roleKey,decision:'APPROVED'}});if(s.r.status!==200)throw new Error('signoff '+roleKey+' '+JSON.stringify(s.data));}}
const browser=await chromium.launch();
async function openPanel(email){const page=await browser.newPage({viewport:{width:1366,height:900}});const posts=[];page.on('request',r=>{if(r.method()==='POST'&&/handoffs/.test(r.url()))posts.push({url:new URL(r.url()).pathname,key:r.headers()['idempotency-key']||null});});
  await page.goto(BASE+'/');await page.fill('input[name=email]',email);await page.fill('input[name=password]',PW);await page.click('#login button, #login [type=submit]');
  await page.waitForSelector(`[data-style="${id}"]`,{timeout:20000});await page.click(`[data-style="${id}"]`);await page.waitForSelector('[data-style-tab="release"]');await page.click('[data-style-tab="release"]');
  await page.waitForSelector(`[data-handoff-release="${n}"]`);await page.click(`[data-handoff-release="${n}"]`);await page.waitForSelector('text=حزمة التسليم للمصنع');return {page,posts};}
const hcount=async()=>(await dev(`/api/styles/${id}/handoffs`)).data.items;
{const {page,posts}=await openPanel('dev@sehha.local');
 ok(await page.locator('text=لا توجد حزم تسليم لهذا الإصدار بعد').count()===1,'Empty state shown before any package is prepared');
 await page.locator('[data-handoff-cmd="prepare"]').dblclick();await page.waitForSelector('text=مُجهّزة',{timeout:15000});await page.waitForTimeout(800);
 const items=await hcount();ok(items.length===1&&posts.filter(p=>/releases\/\d+\/handoffs$/.test(p.url)).length===1,'Double-click on “تجهيز حزمة تسليم” sends exactly one request and creates one package');
 ok(posts.every(p=>p.key&&p.key.length>=8),'Every handoff command carries an Idempotency-Key');
 await page.screenshot({path:`${OUT}/ui_handoff_prepared.png`});
 const hid=items[0].id;const api=await dev(`/api/styles/${id}/handoffs/${hid}/dispatch`,{method:'POST',body:{}});
 await page.fill(`#withdrawReason-${hid}`,'Stale screen withdrawal');await page.click(`[data-handoff-cmd="withdraw"][data-hid="${hid}"]`);
 const conflict=await page.waitForSelector('text=حالة الحزمة لا تسمح بهذا الإجراء',{timeout:15000}).then(()=>true).catch(()=>false);
 ok(api.r.status===200&&conflict,'Stale screen: withdrawing a package already dispatched elsewhere shows the Arabic 409 message');
 await page.waitForSelector('text=أُرسلت للمصنع',{timeout:15000});ok((await hcount())[0].status==='HANDED_OFF','After the 409 the panel reloads the persisted state (HANDED_OFF), nothing was withdrawn');
 await page.screenshot({path:`${OUT}/ui_handoff_conflict.png`});
 ok(await page.locator('[data-handoff-cmd="acknowledge"]').count()===1,'Dispatcher sees the acknowledge control (server will still refuse self-acknowledgement)');
 await page.click('[data-handoff-cmd="acknowledge"]');const self=await page.waitForSelector('text=لا يمكن لمن أرسل الحزمة أن يؤكد استلامها',{timeout:15000}).then(()=>true).catch(()=>false);
 ok(self&&(await hcount())[0].status==='HANDED_OFF','Self-acknowledgement is refused with an Arabic 403 message and no receipt is implied');
 const [popup]=await Promise.all([page.waitForEvent('popup'),page.click(`a[href$="/handoffs/${hid}/package?format=html"]`)]);await popup.waitForLoadState();const body=await popup.content();
 ok(/dir="rtl"/.test(body)&&body.includes(items[0].package_sha256)&&body.includes('حزمة التسليم للمصنع'),'Clicking “عرض” opens the frozen Arabic RTL package carrying its SHA-256');await popup.screenshot({path:`${OUT}/ui_handoff_package.png`});await popup.close();
 ok(await page.evaluate(()=>document.documentElement.dir)==='rtl','Page is RTL');await page.close();}
{const {page}=await openPanel(U('own2')+'@b30.local');await page.fill(`[id^="ackNote-"]`,'استلام كامل');await page.click('[data-handoff-cmd="acknowledge"]');
 const toast=await page.waitForSelector('text=تم تسجيل استلام المصنع',{timeout:15000}).then(()=>true).catch(()=>false);const it=(await hcount())[0];
 ok(toast&&it.status==='ACKNOWLEDGED'&&it.acknowledged_by===U('own2'),'A different authorized user acknowledges; success message appears only with the persisted ACK');
 await page.waitForSelector('text=استلمها المصنع',{timeout:15000});await page.screenshot({path:`${OUT}/ui_handoff_acknowledged.png`});
 ok(await page.locator('text=لا يعني توقيع الجودة').count()===1,'Panel states that receipt is not a QC signoff or lot approval');await page.close();}
await browser.close();writeFileSync(`${OUT}/browser_results.json`,JSON.stringify({base:BASE,styleId:id,releaseNo:n,results},null,1));
