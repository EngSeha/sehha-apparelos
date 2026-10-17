// Browser E2E of the owner journey on a LOCAL `wrangler dev` (workerd + local D1 + local Browser Rendering binding):
// upload a picture + what you know -> AI (mock) suggests the category -> confirm -> answer category questions ->
// draft Tech Pack -> download a real PDF. Chromium via Playwright. Not remote, not CI.
// Usage: BASE=http://127.0.0.1:8800 OUT=<dir> PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node qa/AI_FIRST_TECHPACK_20261017/browser_intake_check.mjs
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {syntheticGarmentPng,JK003} from '../../tests/techpack_fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const BASE=process.env.BASE||'http://127.0.0.1:8800',OUT=process.env.OUT||'.',PW='DevOnly!234';mkdirSync(OUT,{recursive:true});
const results=[];const ok=(c,m)=>{results.push({check:m,result:c?'PASS':'FAIL'});console.log(c?'PASS':'FAIL',m);if(!c)process.exitCode=1;};
let cookie='';async function api(path,{method='GET',body}={}){const r=await fetch(BASE+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});if(path==='/api/auth/login')cookie=(r.headers.get('set-cookie')||'').split(';')[0];return r.json();}
await api('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:PW}});const org=(await api('/api/me')).workspaces.find(w=>w.code==='MOHSEN');
const code='UI-JK003-'+Date.now().toString(36).toUpperCase(),style=await api('/api/styles',{method:'POST',body:{orgId:org.id,code,name:JK003.name,garmentType:'CUSTOM',audience:'WOMEN',sizingMode:'STANDARD'}});const id=style.id;
const imgPath=join(OUT,'synthetic_front.png');writeFileSync(imgPath,syntheticGarmentPng(320,400));
const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:1366,height:1000},acceptDownloads:true});const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(BASE+'/');await page.fill('input[name=email]','dev@sehha.local');await page.fill('input[name=password]',PW);await page.click('#login button, #login [type=submit]');
await page.waitForSelector(`[data-style="${id}"]`,{timeout:20000});await page.click(`[data-style="${id}"]`);
await page.waitForSelector('[data-style-tab="aitechpack"]');await page.click('[data-style-tab="aitechpack"]');await page.waitForSelector('#tpAnalyze',{timeout:20000});
ok(await page.locator('text=BLOCKED_LIVE_VISION').count()>0,'Step 1 tells the owner live vision is not connected (BLOCKED_LIVE_VISION) instead of pretending');
await page.setInputFiles('#tpFiles',imgPath);await page.click('#tpUpload');await page.waitForSelector('[data-tp-asset]',{timeout:20000});
ok(await page.locator('[data-tp-asset]').count()===1,'Upload: the picture appears in the intake list');
await page.fill('#tpNotes',JK003.ownerNotes);await page.click('#tpAnalyze');await page.waitForSelector('[data-tp-cat="JACKET"].primary',{timeout:20000});
ok(await page.locator('text=محاكاة — لم تُحلّل الصور').count()>0&&await page.locator('text=منخفضة').count()>0,'Suggestion shown as JACKET with LOW confidence and an explicit MOCK label');
ok(await page.locator('#tpSave').count()===0,'No measurement questions before the owner confirms the type');
await page.screenshot({path:join(OUT,'ui_step2_suggestion.png'),fullPage:true});
await page.click('[data-tp-cat="JACKET"]');await page.waitForSelector('#tpSave',{timeout:20000});
const qText=await page.locator('.tp-group').allInnerTexts();
ok(qText.join(' ').includes('عرض الظهر')&&!qText.join(' ').includes('الأرداف'),'Jacket questions shown (back width) and no trouser questions (hip)');
await page.screenshot({path:join(OUT,'ui_step3_questions.png'),fullPage:true});
// Answer: unit, base size, M values, specs. Leave body/garment basis and flat/circumference unanswered on purpose (pending).
await page.selectOption('[data-tp-field="unit"]','cm');await page.selectOption('[data-tp-field="baseSize"]','M');
for(const [c,v] of Object.entries(JK003.measurementsM))await page.locator(`.tp-group [data-tp-pom="${c}"]`).first().fill(String(v));
await page.selectOption('[data-tp-spec="fit"]','FITTED');await page.selectOption('[data-tp-spec="closure"]','BUTTONS');await page.selectOption('[data-tp-spec="lining"]','FULL');
await page.click('#tpSave');await page.waitForSelector('text=تم الحفظ',{timeout:20000});
// Wait for the re-rendered question set (the toast precedes the reload), not for a fixed delay.
await page.waitForFunction(()=>[...document.querySelectorAll('.tp-group legend')].some(l=>l.textContent.includes('مسطح أم محيط')),null,{timeout:20000});
const after=(await page.locator('.tp-group').allInnerTexts()).join(' ');
ok(after.includes('مسطح أم محيط')&&after.includes('عرض الخصر')&&!after.includes('عرض الظهر عرض'),'After saving: values are not re-asked; flat/circumference and the fitted-waist measurement are asked next');
const intake=await api(`/api/styles/${id}/intake`);ok(intake.intake.answers.measurements.CHEST.value===56&&intake.intake.answers.unit==='cm','Save-and-resume: answers persisted on the server');
await page.click('#tpDraft');await page.waitForSelector('text=R1',{timeout:30000});await page.waitForSelector('[data-tp-pdf="1"]');
ok(await page.locator('.tp-open li',{hasText:'حدّد الوحدة وأساس القياس والمقاس الأساسي'}).count()>0&&await page.locator('.tp-open li',{hasText:'أساس قياس غير محدد'}).count()>0,'Draft R1 lists open items in Arabic');
ok(await page.locator('.tp-flow .panel:last-child .tp-open li',{hasText:'سماحات الخياطة غير مؤكدة'}).count()===1,'Pattern step lists its gaps in Arabic inside the panel');
ok(await page.locator('[data-tp-approve="1"][disabled]').count()===1,'Approve button is disabled while required data is missing');
await page.screenshot({path:join(OUT,'ui_step4_draft.png'),fullPage:true});
const [dl]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click('[data-tp-pdf="1"]')]);const pdfPath=join(OUT,'ui_downloaded_R1.pdf');await dl.saveAs(pdfPath);const head=readFileSync(pdfPath).subarray(0,5).toString();
ok(head==='%PDF-'&&dl.suggestedFilename().endsWith('-R1-DRAFT.pdf'),'Download button delivers a real PDF file (bytes start with %PDF-)');
const [pv]=await Promise.all([page.waitForEvent('popup'),page.click('a[href$="/techpack/revisions/1/preview"]')]);await pv.waitForLoadState();const pvHtml=await pv.content();
ok(/dir="rtl"/.test(pvHtml)&&pvHtml.includes('مسودة غير معتمدة'),'Preview opens the frozen Arabic RTL draft');await pv.screenshot({path:join(OUT,'ui_preview_page1.png')});await pv.close();
ok(await page.evaluate(()=>document.documentElement.dir)==='rtl'&&errors.length===0,'Page is RTL and had no JavaScript errors');
await browser.close();writeFileSync(join(OUT,'browser_intake_results.json'),JSON.stringify({base:BASE,styleId:id,results,errors},null,1));
console.log(`BROWSER_INTAKE ${results.filter(r=>r.result==='PASS').length}/${results.length}`);
