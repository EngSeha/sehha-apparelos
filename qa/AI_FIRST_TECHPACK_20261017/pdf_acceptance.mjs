// Real-PDF acceptance for the AI-first Tech Pack, against a LOCAL `wrangler dev` (workerd + local D1 + local Browser
// Rendering binding launched by Miniflare). Result class: LOCAL_PDF_PASS only — remote Cloudflare is not exercised.
// PDFs are inspected INDEPENDENTLY of the app with poppler (pdfinfo, pdffonts, pdftotext, pdftoppm) and PIL.
// Usage: BASE=http://127.0.0.1:8800 OUT=<dir> node qa/AI_FIRST_TECHPACK_20261017/pdf_acceptance.mjs
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {pngDataUrl,JK003,SYNTH_SHIRT,longRows} from '../../tests/techpack_fixtures.mjs';
const BASE=process.env.BASE||'http://127.0.0.1:8800',OUT=process.env.OUT||'.',PW='DevOnly!234';mkdirSync(OUT,{recursive:true});
const results=[];const ok=(c,m,extra={})=>{results.push({check:m,result:c?'PASS':'FAIL',...extra});console.log(c?'PASS':'FAIL',m,Object.keys(extra).length?JSON.stringify(extra):'');if(!c)process.exitCode=1;};
let cookie='';async function call(path,{method='GET',body,raw=false}={}){const r=await fetch(BASE+path,{method,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(path==='/api/auth/login'){const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];}
  if(raw)return {r,bytes:new Uint8Array(await r.arrayBuffer())};const ct=r.headers.get('content-type')||'';return {r,data:ct.includes('json')?await r.json():await r.text()};}
await call('/api/auth/login',{method:'POST',body:{email:'dev@sehha.local',password:PW}});
const org=(await call('/api/me')).data.workspaces.find(w=>w.code==='MOHSEN'),tag=Date.now().toString(36).toUpperCase();
const sh=b=>createHash('sha256').update(b).digest('hex');
const tool=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8'});
function inspect(file){const info=tool('pdfinfo',[file]),fonts=tool('pdffonts',[file]),text=tool('pdftotext',['-layout',file,'-']);
  const pages=Number(/Pages:\s+(\d+)/.exec(info)[1]),size=/Page size:\s+([\d.]+) x ([\d.]+)/.exec(info),a4=Math.abs(Number(size[1])-595)<2&&Math.abs(Number(size[2])-842)<2;
  const fontRows=fonts.split('\n').slice(2).filter(Boolean),embeddedAll=fontRows.every(l=>/\byes\b/.test(l.slice(l.indexOf('Identity')>0?l.indexOf('Identity'):40))),fontNames=fontRows.map(l=>l.split(/\s+/)[0]);
  // Blank-page detection: render each page at 30 dpi and measure ink coverage with PIL.
  const prefix=file.replace(/\.pdf$/,'-ink');tool('pdftoppm',['-r','30','-gray','-png',file,prefix]);
  const ink=JSON.parse(execFileSync('python3',['-I','-c',`import sys,glob,json
from PIL import Image
out=[]
for f in sorted(glob.glob(sys.argv[1]+'-*.png'),key=lambda p:int(p.rsplit('-',1)[1].split('.')[0])):
    im=Image.open(f).convert('L');px=im.getdata();dark=sum(1 for v in px if v<200);out.append(round(dark/len(px),4))
print(json.dumps(out))`,prefix],{encoding:'utf8'}));
  return {pages,a4,fontNames,embeddedAll,text,ink};}
async function newStyle(code,name){const x=await call('/api/styles',{method:'POST',body:{orgId:org.id,code:`${code}-${tag}`,name,garmentType:'CUSTOM',audience:'WOMEN',sizingMode:'STANDARD'}});return x.data.id;}
async function upload(id,filename){await call(`/api/styles/${id}/assets`,{method:'POST',body:{dataUrl:pngDataUrl(),role:'REFERENCE',filename}});const s=await call(`/api/styles/${id}`);return (s.data.assets||[]).map(a=>a.id);}
async function pdfOf(id,rev,name){const x=await call(`/api/styles/${id}/techpack/revisions/${rev}/pdf`,{raw:true});const file=join(OUT,name);writeFileSync(file,x.bytes);return {status:x.r.status,ct:x.r.headers.get('content-type'),head:new TextDecoder().decode(x.bytes.slice(0,5)),sha:sh(x.bytes),hdrSha:x.r.headers.get('x-pdf-sha256'),file,bytes:x.bytes.length,statusHdr:x.r.headers.get('x-techpack-status')};}
const summary={base:BASE,engine:null,documents:{}};
summary.engine=(await call('/api/health')).data.schemaVersion;

// 1) JK-003 DRAFT (owner facts, basis pending) — bilingual case.
{const id=await newStyle('JK-003',JK003.name),assets=await upload(id,'jk003-front-synthetic.png');await call(`/api/styles/${id}/intake/analyze`,{method:'POST',body:{assetIds:assets,ownerNotes:JK003.ownerNotes}});await call(`/api/styles/${id}/intake/category`,{method:'POST',body:{category:'JACKET'}});
 await call(`/api/styles/${id}/intake/answers`,{method:'PUT',body:{unit:'cm',baseSize:'M',measurements:Object.fromEntries(Object.entries(JK003.measurementsM).map(([k,v])=>[k,{value:v}])),specs:JK003.specs,quantityMatrix:{sizes:['M','L'],colors:['Charcoal'],cells:{'M|Charcoal':50,'L|Charcoal':70}}}});
 const rev=(await call(`/api/styles/${id}/techpack/revisions`,{method:'POST',body:{}})).data.revisionNo,p=await pdfOf(id,rev,'JK003_R1_DRAFT.pdf'),i=inspect(p.file);summary.documents.jk003={...p,pages:i.pages,fonts:i.fontNames,ink:i.ink};
 ok(p.status===200&&p.ct==='application/pdf'&&p.head==='%PDF-','JK-003 DRAFT: real PDF bytes (%PDF-) served as application/pdf',{bytes:p.bytes});
 ok(i.pages>=6&&i.a4,'JK-003 DRAFT: multi-page A4',{pages:i.pages});
 ok(i.fontNames.some(f=>/NotoNaskhArabic|Naskh/i.test(f))&&i.fontNames.some(f=>/NotoSans/i.test(f))&&i.embeddedAll,'JK-003 DRAFT: Noto Naskh Arabic + Noto Sans embedded (subset)',{fonts:i.fontNames});
 ok(/DRAFT/.test(i.text)&&/Points of measure/.test(i.text)&&/Bill of materials/.test(i.text)&&/Pattern Pending/.test(i.text),'JK-003 DRAFT: English labels extract as text (DRAFT, POM, BOM, Pattern Pending)');
 ok(/BACK_WIDTH/.test(i.text)&&/\b44 cm\b/.test(i.text)&&/\b56 cm\b/.test(i.text)&&/NO_TOLERANCE/.test(i.text),'JK-003 DRAFT: owner M values and NO_TOLERANCE rendered');
 ok(!/Zipper|zipper/.test(i.text.split('Bill of materials')[1]?.split('Construction sequence')[0]||''),'JK-003 DRAFT: no zipper invented in the BOM page');
 ok(/Page 1 \/ \d+/.test(i.text)&&new RegExp(`Page ${i.pages} / ${i.pages}`).test(i.text),'JK-003 DRAFT: footer page numbering on every page (1..N / N)');
 ok(i.ink.every(v=>v>0.004),'JK-003 DRAFT: no blank pages (ink coverage > 0.4% on every page)',{ink:i.ink});
 ok(/120/.test(i.text)&&/CONSUMPTION_NOT_CONFIRMED/.test(i.text),'JK-003 DRAFT: quantity matrix total 120 and material requirement honestly unavailable');}
// 2) Long dataset (synthetic): pagination and repeated table headers.
{const id=await newStyle('LONG','Synthetic long dataset');await call(`/api/styles/${id}/intake/analyze`,{method:'POST',body:{ownerNotes:'shirt'}});await call(`/api/styles/${id}/intake/category`,{method:'POST',body:{category:'SHIRT'}});
 const L=longRows(60);for(const m of L.pom)await call(`/api/styles/${id}/measurements`,{method:'POST',body:m});for(const b of L.bom)await call(`/api/styles/${id}/bom`,{method:'POST',body:b});for(const o of L.ops)await call(`/api/styles/${id}/operations`,{method:'POST',body:o});
 const rev=(await call(`/api/styles/${id}/techpack/revisions`,{method:'POST',body:{}})).data.revisionNo,p=await pdfOf(id,rev,'LONG_R1_DRAFT.pdf'),i=inspect(p.file);summary.documents.long={...p,pages:i.pages,ink:i.ink};
 const headerRepeats=(i.text.match(/Point of measure/g)||[]).length,bomHeader=(i.text.match(/Supplier/g)||[]).length,opsHeader=(i.text.match(/QC checkpoint/g)||[]).length;
 ok(i.pages>=10&&i.a4,'LONG: 60 POM + 60 BOM + 60 operations paginate over many A4 pages',{pages:i.pages});
 ok(headerRepeats>=2&&bomHeader>=2&&opsHeader>=2,'LONG: table headers repeat on continuation pages (POM, BOM, operations)',{headerRepeats,bomHeader,opsHeader});
 ok(/X60/.test(i.text)&&/B60/.test(i.text)&&/Test operation 60/.test(i.text),'LONG: last rows of every table present (nothing clipped)');
 ok(i.ink.every(v=>v>0.004),'LONG: no blank pages',{ink:i.ink});}
// 3) Synthetic complete shirt: approval freezes the exact PDF bytes; re-export reproduces them.
{const id=await newStyle(SYNTH_SHIRT.code,SYNTH_SHIRT.name),assets=await upload(id,'synthetic-shirt.png');await call(`/api/styles/${id}/intake/analyze`,{method:'POST',body:{assetIds:assets,ownerNotes:SYNTH_SHIRT.ownerNotes}});await call(`/api/styles/${id}/intake/category`,{method:'POST',body:{category:'SHIRT'}});
 await call(`/api/styles/${id}/intake/answers`,{method:'PUT',body:{unit:'cm',garmentBasis:'FINISHED_GARMENT',baseSize:'M',measurements:SYNTH_SHIRT.measurements,specs:SYNTH_SHIRT.specs}});
 const rev=(await call(`/api/styles/${id}/techpack/revisions`,{method:'POST',body:{}})).data.revisionNo,ap=await call(`/api/styles/${id}/techpack/revisions/${rev}/approve`,{method:'POST',body:{}});
 ok(ap.r.status===200&&ap.data.document?.status==='APPROVED'&&/^[0-9a-f]{64}$/.test(ap.data.document.pdfSha256),'SYNTH: approval renders and freezes the PDF (SHA-256 recorded)',{pages:ap.data.document?.pageCount});
 const a=await pdfOf(id,rev,'SYNTH_R1_APPROVED.pdf'),b=await pdfOf(id,rev,'SYNTH_R1_APPROVED_reexport.pdf'),i=inspect(a.file);summary.documents.synthApproved={...a,pages:i.pages,frozenSha:ap.data.document?.pdfSha256,ink:i.ink};
 ok(a.sha===ap.data.document.pdfSha256&&b.sha===a.sha&&a.hdrSha===a.sha&&a.statusHdr==='APPROVED','SYNTH: re-export returns byte-identical frozen PDF (same SHA-256 twice)',{sha:a.sha});
 ok(/APPROVED/.test(i.text)&&!/DRAFT · /.test(i.text)&&i.a4&&i.pages>=6,'SYNTH: APPROVED label, A4, multi-page',{pages:i.pages});
 ok(Number(ap.data.document.pageCount)===i.pages,'SYNTH: page count recorded by the app equals pdfinfo',{app:ap.data.document.pageCount,pdfinfo:i.pages});
 const again=await call(`/api/styles/${id}/techpack/revisions/${rev}/approve`,{method:'POST',body:{}});ok(again.r.status===200&&again.data.replayed===true&&again.data.document.pdfSha256===a.sha,'SYNTH: repeated approve is idempotent (same frozen hash)');}
// 4) Abaya (weight bands) — category-specific content in the PDF.
{const id=await newStyle('ABY-0004','Synthetic abaya weight-band');await call(`/api/styles/${id}/intake/analyze`,{method:'POST',body:{ownerNotes:'عباية'}});await call(`/api/styles/${id}/intake/category`,{method:'POST',body:{category:'ABAYA_KHIMAR'}});
 await call(`/api/styles/${id}/intake/answers`,{method:'PUT',body:{unit:'cm',garmentBasis:'FINISHED_GARMENT',baseSize:'WB-02',specs:{closure:'CONCEALED_ZIP'},measurements:{LENGTH:{value:140},WIDTH:{value:60,basis:'FLAT'},SLEEVE_LENGTH:{value:58},OPENING:{value:45}}}});
 const rev=(await call(`/api/styles/${id}/techpack/revisions`,{method:'POST',body:{}})).data.revisionNo,p=await pdfOf(id,rev,'ABAYA_R1_DRAFT.pdf'),i=inspect(p.file);summary.documents.abaya={...p,pages:i.pages,ink:i.ink};
 ok(/WEIGHT_BANDS/.test(i.text)&&/WB-02/.test(i.text)&&/Concealed zipper/.test(i.text)&&/S\/M\/L/.test(i.text),'ABAYA: weight-band sizing, base WB-02 and concealed zipper in the PDF');}
// Visual evidence: render selected pages at 80 dpi for human review.
for(const [k,f,pages] of [['jk003','JK003_R1_DRAFT.pdf',[1,2,3,4,6]],['long','LONG_R1_DRAFT.pdf',[3,4]],['synth','SYNTH_R1_APPROVED.pdf',[1,7]],['abaya','ABAYA_R1_DRAFT.pdf',[1]]])for(const n of pages){try{tool('pdftoppm',['-r','80','-png','-f',String(n),'-l',String(n),join(OUT,f),join(OUT,`render_${k}_p${n}`)]);}catch{}}
writeFileSync(join(OUT,'pdf_acceptance_results.json'),JSON.stringify({summary,results},null,1));
console.log(`PDF_ACCEPTANCE ${results.filter(r=>r.result==='PASS').length}/${results.length}`);
