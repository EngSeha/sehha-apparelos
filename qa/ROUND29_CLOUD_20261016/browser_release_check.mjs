// ROUND29 browser check of the Release tab against a local `wrangler dev` (workerd + local D1). Not remote, not CI.
// Usage: BASE=http://127.0.0.1:8799 OUT=<dir> PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node qa/ROUND29_CLOUD_20261016/browser_release_check.mjs
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {buildReleaseCandidate} from '../../tests/release_fixture.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const BASE=process.env.BASE||'http://127.0.0.1:8799',OUT=process.env.OUT||'.';const results=[];
const ok=(c,m)=>{results.push({check:m,result:c?'PASS':'FAIL'});console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
let cookie='';
async function call(path,{method='GET',body}={}){const r=await fetch(BASE+path,{method,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});const ct=r.headers.get('content-type')||'';return {r,data:ct.includes('json')?await r.json():await r.text()};}
let x=await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:'DevOnly!234'}});cookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN');
const id=await buildReleaseCandidate(call,org,'UI-R29-'+Date.now().toString(36).toUpperCase());
const browser=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});const page=await browser.newPage({viewport:{width:1366,height:900}});
const posts=[];page.on('request',r=>{if(r.method()==='POST'&&/\/releases$/.test(new URL(r.url()).pathname))posts.push({key:r.headers()['idempotency-key']||null});});
await page.goto(BASE+'/');await page.fill('input[name=email]','dev@sehha.local');await page.fill('input[name=password]','DevOnly!234');await page.click('#login button, #login [type=submit]');
await page.waitForSelector(`[data-style="${id}"]`,{timeout:20000});await page.click(`[data-style="${id}"]`);
await page.waitForSelector('[data-style-tab="release"]',{timeout:20000});await page.click('[data-style-tab="release"]');await page.waitForSelector('[data-release-type="PRODUCTION"]',{timeout:20000});
ok(await page.locator('th',{hasText:'الأدلة / Evidence'}).count()===1,'Release table shows the Arabic evidence column');
await page.click('[data-release-type="PRODUCTION"]');
const toast=await page.waitForSelector('text=لا يمكن إصدار نسخة إنتاج قبل استكمال متطلبات الجاهزية',{timeout:15000}).then(()=>true).catch(()=>false);
ok(toast,'Blocked production release shows the Arabic readiness message');await page.screenshot({path:`${OUT}/ui_production_blocked.png`,fullPage:false});
const blockedPosts=posts.length;
await page.selectOption('#releaseVersion','1').catch(()=>{});
await page.locator('[data-release-type="SAMPLE"]').dblclick();await page.waitForTimeout(2500);
const rels=(await call(`/api/styles/${id}/releases`)).data.items;
ok(posts.length-blockedPosts===1,'Double-click on Create Sample Release sends exactly one request');
ok(rels.length===1&&rels[0].release_type==='SAMPLE','Exactly one SAMPLE release exists after the double-click');
ok(posts.every(p=>p.key&&p.key.length>=8),'Every release request carries an Idempotency-Key');
const cell=await page.locator('table tr',{hasText:'R1'}).first().innerText().catch(()=>'');ok(/SAMPLE/.test(cell),'Released row is rendered in the table');
await page.screenshot({path:`${OUT}/ui_sample_released.png`,fullPage:false});
const dir=await page.evaluate(()=>document.documentElement.dir);ok(dir==='rtl','Page is RTL');
await browser.close();writeFileSync(`${OUT}/browser_results.json`,JSON.stringify({base:BASE,styleId:id,posts,results},null,1));
