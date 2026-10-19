// AI-TP-W01 browser + PDF acceptance on a LOCAL `wrangler dev` (workerd + local D1/R2). Chromium via the pre-installed
// Playwright. Desktop (1366×1000) and mobile (390×844) journeys. Synthetic test images only — no owner photo is used.
// PDF: in this container Miniflare's local Browser Rendering cannot start Chrome (runs as root; the sandbox is required),
// so the app's BROWSER-binding path is recorded as BLOCKED_ENV and the API must answer 503 PDF_ENGINE_UNAVAILABLE.
// The frozen preview HTML (exactly what the engine prints) is rendered INDEPENDENTLY by Playwright Chromium to A4 PDF
// and inspected with poppler + PIL. That is labelled INDEPENDENT_RENDER, never the app's own frozen PDF.
// Usage: BASE=http://127.0.0.1:8800 OUT=<dir> PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node qa/AI_TP_W01_20261017/w01_browser_and_pdf.mjs
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {syntheticGarmentPng,JK003,KHIMAR_0004} from '../../tests/techpack_fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const BASE=process.env.BASE||'http://127.0.0.1:8800',OUT=process.env.OUT||'.',PW='DevOnly!234';mkdirSync(OUT,{recursive:true});
const results=[];const ok=(c,m,extra)=>{results.push({check:m,result:c?'PASS':'FAIL',...(extra?{detail:extra}:{})});console.log(c?'PASS':'FAIL',m,extra?JSON.stringify(extra):'');if(!c)process.exitCode=1;};
let cookie='';async function api(path,{method='GET',body}={}){const r=await fetch(BASE+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});if(path==='/api/auth/login')cookie=(r.headers.get('set-cookie')||'').split(';')[0];const ct=r.headers.get('content-type')||'';return {status:r.status,data:ct.includes('json')?await r.json():await r.text()};}
await api('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:PW}});const org=(await api('/api/me')).data.workspaces.find(w=>w.code==='MOHSEN');
const mk=async(code,name)=>(await api('/api/styles',{method:'POST',body:{orgId:org.id,code:code+'-'+Date.now().toString(36).toUpperCase(),name,garmentType:'CUSTOM',audience:'WOMEN',sizingMode:'STANDARD'}})).data.id;
const browser=await chromium.launch();
async function login(page){await page.goto(BASE+'/');await page.fill('input[name=email]','dev@sehha.local');await page.fill('input[name=password]',PW);await page.click('#login button, #login [type=submit]');}
async function openTab(page,id){await page.waitForSelector(`[data-style="${id}"]`,{timeout:30000});await page.click(`[data-style="${id}"]`);await page.waitForSelector('[data-style-tab="aitechpack"]');await page.click('[data-style-tab="aitechpack"]');await page.waitForSelector('#tpAnalyze',{timeout:30000});}
const toastText=async page=>(await page.locator('.toast, #toast, [role=status]').allInnerTexts().catch(()=>[])).join(' ');

// ---------- Desktop journey: JK-003 (owner facts) ----------
const jk=await mk('UI-W01-JK003',JK003.name);
{const ctx=await browser.newContext({viewport:{width:1366,height:1000},acceptDownloads:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await login(page);await openTab(page,jk);
 ok(await page.locator('[data-tp-vision="BLOCKED"]').count()===1,'D1 vision state shown as BLOCKED_LIVE_VISION (no provider bound), never presented as live');
 const img=join(OUT,'synthetic_front.png');writeFileSync(img,syntheticGarmentPng(320,400,[60,62,66]));
 await page.setInputFiles('#tpFiles',img);await page.selectOption('#tpRole','REFERENCE');await page.click('#tpUpload');await page.waitForSelector('[data-tp-asset]',{timeout:30000});
 ok((await page.locator('.tp-img small').first().innerText()).includes('REFERENCE'),'D2 uploaded picture is listed with its role');
 await page.setInputFiles('#tpFiles',img);await page.click('#tpUpload');await page.waitForTimeout(1500);
 ok(await page.locator('[data-tp-asset]').count()===1,'D3 re-uploading the same picture is refused (duplicate guard) — still one asset',{toast:await toastText(page)});
 await page.fill('#tpNotes',JK003.ownerNotes);await page.click('#tpAnalyze');await page.waitForSelector('[data-tp-cat="JACKET"].primary',{timeout:30000});
 ok(await page.locator('text=محاكاة — لم تُحلّل الصور').count()>0,'D4 suggestion labelled MOCK (text only), not live vision');
 await page.click('[data-tp-cat="JACKET"]');await page.waitForSelector('#tpSave',{timeout:30000});
 ok((await page.locator('.tp-group .tp-why',{hasText:'من/إلى'}).count())>0,'D5 measurement questions show the start→end landmark definition');
 await page.selectOption('[data-tp-field="unit"]','cm');await page.selectOption('[data-tp-field="baseSize"]','M');
 for(const [c,v] of Object.entries(JK003.measurementsM))await page.locator(`.tp-group [data-tp-pom="${c}"]`).first().fill(String(v));
 await page.selectOption('[data-tp-spec="fit"]','FITTED');await page.selectOption('[data-tp-spec="closure"]','BUTTONS');await page.selectOption('[data-tp-spec="lining"]','FULL');
 await page.click('#tpSave');await page.waitForFunction(()=>[...document.querySelectorAll('.tp-group legend')].some(l=>l.textContent.includes('مسطح أم محيط')),null,{timeout:30000});
 // explicit tolerance in the full table
 await page.click('summary:has-text("كل قياسات")');await page.fill('[data-tp-tolp="CHEST"]','1');await page.fill('[data-tp-tolm="CHEST"]','1');await page.click('#tpSave');await page.waitForTimeout(1500);
 const it1=(await api(`/api/styles/${jk}/intake`)).data.intake;ok(it1.answers.measurements.CHEST.tolPlus===1&&it1.answers.measurements.BACK_WIDTH.tolPlus==null,'D6 tolerance saved only where the owner typed it (CHEST ±1; others stay NO_TOLERANCE)');
 // description editor
 await page.fill('#tpDescAr','جاكيت نسائي رمادي فحمي بغلق مائل غير متماثل وأربعة أزرار؛ الخلف غير مصوَّر.');await page.fill('#tpDescEn','Charcoal women\'s jacket, asymmetric angled closure, four buttons; back not photographed.');
 await page.click('#tpDescSave');await page.waitForTimeout(1500);const it2=(await api(`/api/styles/${jk}/intake`)).data.intake;
 ok(it2.answers.description?.source==='OWNER_ASSERTION'&&it2.answers.description.en.includes('asymmetric'),'D7 owner description editor saves AR+EN as OWNER_ASSERTION');
 // pattern panel
 const ready=await page.locator('[data-tp-readiness]').getAttribute('data-tp-readiness');
 ok(ready==='BLOCKED_PATTERN_INPUTS'&&await page.locator('#tpPattern .tp-open li',{hasText:'الخلف غير ظاهر'}).count()===1&&await page.locator('#tpPattern .tp-open li',{hasText:'سماحات الخياطة غير مؤكدة'}).count()===1,'D8 pattern panel: BLOCKED_PATTERN_INPUTS with back-view and seam-allowance gaps in Arabic',{ready});
 await page.click('#tpPattern summary:has-text("مدخلات مهندس الباترون")');await page.fill('#tpPattern [data-tp-sa="MAIN"]','100');await page.click('#tpPatternSave');await page.waitForTimeout(1500);
 ok(((await api(`/api/styles/${jk}/intake`)).data.intake.answers.patternInputs?.seamAllowanceMm?.MAIN)==null,'D9 an implausible seam allowance (100 mm) is rejected by the server and not stored',{toast:await toastText(page)});
 await page.screenshot({path:join(OUT,'w01_desktop_questions.png'),fullPage:true});
 await page.click('#tpDraft');await page.waitForSelector('[data-tp-pdf="1"]',{timeout:30000});
 const [pv]=await Promise.all([page.waitForEvent('popup'),page.click('a[href$="/techpack/revisions/1/preview"]')]);await pv.waitForLoadState();const html=await pv.content();
 ok(/BACK: UNOBSERVABLE \/ REQUIRES_REVIEW/.test(html)&&/Owner technical description/.test(html)&&/<div class="en">QC<\/div>/.test(html),'D10 preview: back marked UNOBSERVABLE / REQUIRES_REVIEW, owner description, sign-off table');
 await pv.screenshot({path:join(OUT,'w01_preview_cover.png')});await pv.close();
 await page.click('[data-tp-pdf="1"]');await page.waitForTimeout(4000);const pdfResp=await api(`/api/styles/${jk}/techpack/revisions/1/pdf`);
 ok(pdfResp.status===503&&pdfResp.data.code==='PDF_ENGINE_UNAVAILABLE','D11 PDF download in this container answers 503 PDF_ENGINE_UNAVAILABLE (local Chrome cannot start as root) — no HTML passed off as PDF',{status:pdfResp.status,code:pdfResp.data.code});
 ok(errors.length===0,'D12 no JavaScript errors on the desktop journey',{errors});
 await ctx.close();}

// ---------- Mobile journey: 0004 khimar ----------
const kh=await mk('UI-W01-0004',KHIMAR_0004.name);
{const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await login(page);await openTab(page,kh);
 const img=join(OUT,'synthetic_khimar.png');writeFileSync(img,syntheticGarmentPng(300,420,[12,12,14]));await page.setInputFiles('#tpFiles',img);await page.click('#tpUpload');await page.waitForSelector('[data-tp-asset]',{timeout:30000});
 await page.fill('#tpNotes',KHIMAR_0004.ownerNotes);await page.click('#tpAnalyze');await page.waitForSelector('[data-tp-cat="ABAYA_KHIMAR"].primary',{timeout:30000});
 await page.click('[data-tp-cat="ABAYA_KHIMAR"]');await page.waitForSelector('#tpSave',{timeout:30000});
 const qtext=(await page.locator('.tp-group').allInnerTexts()).join(' ');
 ok(qtext.includes('فئة الوزن')&&qtext.includes('طول الفتحة الأمامية')&&!/\bXS\b/.test(qtext),'M1 khimar asks a weight band and the opening length (zip driver); no S/M/L list');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 ok(overflow<=1,'M2 no horizontal page overflow at 390 px',{overflowPx:overflow});
 await page.screenshot({path:join(OUT,'w01_mobile_khimar.png'),fullPage:true});
 ok(errors.length===0,'M3 no JavaScript errors on the mobile journey',{errors});await ctx.close();
 await api(`/api/styles/${kh}/intake/answers`,{method:'PUT',body:{unit:'cm',specs:KHIMAR_0004.specs,quantityMatrix:{sizes:KHIMAR_0004.testWeightBands,colors:['BLACK'],cells:{'WB-TEST-1|BLACK':40,'WB-TEST-2|BLACK':60}},description:{ar:'خمار أسود مغطى بتطريز بنفسجي وذهبي وسوستة أمامية مخفية.',en:'Black khimar, violet and gold embroidery, concealed front zip.'}}});
 await api(`/api/styles/${kh}/techpack/revisions`,{method:'POST',body:{}});}

// ---------- Independent A4 PDF render of the frozen preview HTML ----------
const pdfs=[];
{const ctx=await browser.newContext();await ctx.addCookies([{name:cookie.split('=')[0],value:cookie.split('=').slice(1).join('='),url:BASE}]);const page=await ctx.newPage();
 for(const [label,id] of [['JK003_R1_DRAFT',jk],['KHIMAR0004_R1_DRAFT',kh]]){await page.goto(`${BASE}/api/styles/${id}/techpack/revisions/1/preview`);await page.waitForLoadState('networkidle');
  const file=join(OUT,`${label}.independent.pdf`);
  await page.pdf({path:file,printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<div style="font-size:7px;width:100%;padding:0 13mm;font-family:Arial">INDEPENDENT RENDER (Playwright Chromium) of the frozen preview — DRAFT — not the app engine output</div>',footerTemplate:'<div style="font-size:7px;width:100%;padding:0 13mm;font-family:Arial;text-align:right">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
  pdfs.push({label,file});}
 await ctx.close();}
await browser.close();
for(const {label,file} of pdfs){const info=execFileSync('pdfinfo',[file]).toString(),pages=Number(/Pages:\s+(\d+)/.exec(info)[1]),size=/Page size:\s+([\d.]+) x ([\d.]+)/.exec(info);
  const fonts=execFileSync('pdffonts',[file]).toString(),text=execFileSync('pdftotext',['-layout',file,'-']).toString();
  execFileSync('pdftoppm',['-r','50','-png',file,join(OUT,`render_${label}`)]);
  const ink=JSON.parse(execFileSync('python3',['-I','-c',`import sys,glob,json\nfrom PIL import Image\nout=[]\nfor f in sorted(glob.glob(sys.argv[1]+'-*.png')):\n  im=Image.open(f).convert('L');px=im.getdata();out.append(round(sum(1 for p in px if p<200)/len(px)*100,2))\nprint(json.dumps(out))`,join(OUT,`render_${label}`)]).toString());
  ok(Math.round(Number(size[1]))===595&&Math.round(Number(size[2]))===842&&pages>=5,`P1 ${label}: A4 (595×842 pt), multi-page`,{pages});
  ok(/NotoNaskhArabic/.test(fonts)&&/NotoSans/.test(fonts)&&/yes/.test(fonts),`P2 ${label}: Arabic + Latin fonts embedded`);
  ok(ink.every(x=>x>0.3),`P3 ${label}: no blank page (ink coverage per page)`,{ink});
  ok(/BACK: UNOBSERVABLE/.test(text)&&/PRODUCTION/.test(text)&&/Not for production|not for production|DRAFT/.test(text),`P4 ${label}: back-review box, sign-off roles and DRAFT marking present in the PDF text`);
  if(label.startsWith('KHIMAR'))ok(/WEIGHT_BANDS/.test(text)&&/Concealed zipper/.test(text)&&/CONSUMPTION_NOT_CONFIRMED/.test(text)&&!/\b\d+(\.\d+)?\s?gsm\b/i.test(text),`P5 ${label}: weight bands, concealed zipper, no invented consumption or GSM`);
  if(label.startsWith('JK003'))ok(!/Zipper|سوستة مخفية/.test(text.split('Bill of materials')[1]?.split('Construction')[0]||'')&&/NO_TOLERANCE/.test(text)&&/BLOCKED_PATTERN_INPUTS/.test(text),`P5 ${label}: no zipper invented in the BOM, NO_TOLERANCE where unknown, pattern BLOCKED_PATTERN_INPUTS`);}
writeFileSync(join(OUT,'w01_browser_pdf_results.json'),JSON.stringify({base:BASE,styles:{jk,kh},results},null,1));
console.log(`W01_BROWSER_PDF ${results.filter(r=>r.result==='PASS').length}/${results.length}`);
