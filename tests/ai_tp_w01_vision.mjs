// AI-TP-W01 — Workers AI vision adapter + upload guard. The Workers AI binding is STUBBED here (no Cloudflare account or
// network is reachable from CI). These rows prove the WIRING and the safety policy: exact model id, blind prompt, the exact
// stored pixels are what is sent, failure classes map to owner-actionable codes, no silent mock, idempotency, quota,
// throttle, upload guards. They are NOT live inference evidence and never count as LIVE_VISION_PASS.
import {createHash} from 'node:crypto';
import {makeHarness,ok} from './test_helpers.mjs';
import {syntheticGarmentPng} from './techpack_fixtures.mjs';
import {BLIND_PROMPT,WORKERS_AI_VISION_MODEL,mapVisionError} from '../src/garment_intake.js';
import {imageDimensions,stripJpegMetadata} from '../src/image_guard.js';
const h=makeHarness(),{call,db,env}=h;await h.login();
const org=(await call('/api/me')).data.workspaces.find(w=>w.code==='MOHSEN'),ts0=new Date().toISOString();
const row=(area,id,scenario,expected,actual,pass)=>{console.log('MATRIX '+JSON.stringify({area,id,scenario,expected,actual,verdict:pass?'PASS':'FAIL'}));ok(pass,`${id} ${scenario}`);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const devHash=db.prepare("SELECT password_hash,password_salt FROM users WHERE email='dev@sehha.local'").get();
const other=db.prepare("INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES('org_w01_x','W1X','W01 other','{}',?) RETURNING id").get(ts0).id;
db.prepare('INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at) VALUES(?,?,?,?,?,?)').run('w01_out','w01_out@x.local','w01_out',devHash.password_hash,devHash.password_salt,ts0);db.prepare("INSERT INTO memberships(user_id,org_id,role) VALUES('w01_out',?,'WORKSPACE_OWNER')").run(other);
const outC=(await call('/api/auth/login',{method:'POST',body:{email:'w01_out@x.local',password:env.DEV_BOOTSTRAP_PASSWORD},cookieOverride:''})).r.headers.get('set-cookie').split(';')[0];
let seq=0;const newStyle=async(code='W01')=>(await call('/api/styles',{method:'POST',body:{orgId:org.id,code:`${code}-${++seq}`,name:'W01 vision',garmentType:'CUSTOM',audience:'WOMEN',sizingMode:'STANDARD'}})).data.id;
const upload=async(id,bytes,mime='image/png',filename='img.png')=>call(`/api/styles/${id}/assets`,{method:'POST',body:{dataUrl:`data:${mime};base64,${Buffer.from(bytes).toString('base64')}`,role:'REFERENCE',filename}});
const analyze=(id,body,headers={})=>call(`/api/styles/${id}/intake/analyze`,{method:'POST',body,headers});
const intakeRow=id=>db.prepare('SELECT category,category_source,vision_mode,row_version FROM garment_intakes WHERE style_id=?').get(id)||null;
const lastRun=id=>db.prepare("SELECT * FROM ai_runs WHERE style_id=? ORDER BY rowid DESC LIMIT 1").get(id);
const json=o=>JSON.stringify(o);
const RESP={jacket:{category:'jacket',subtype:'fitted jacket',confidence:'high',probability:0.97,alternatives:[{category:'other',confidence:'low'}],views:[{view:'front'}],details:[{key:'closure',valueEn:'buttons on a diagonal front edge',valueAr:'أزرار على حافة أمامية مائلة',evidence:'observed'},{key:'button_count_visible',valueEn:'4',valueAr:'4',evidence:'observed'}],colors:[{nameEn:'charcoal grey',nameAr:'رمادي فحمي',evidence:'observed'}],fabricAppearance:{descriptionEn:'brushed, fuzzy surface',descriptionAr:'سطح وبري',evidence:'observed'},panelHints:['front left','front right','sleeves'],evidenceCues:[{field:'category',cue:'set-in sleeves, front opening, hip length'}],uncertainty:{category:'low',fabric:'high'},unseen:['back view','lining','fibre composition'],descriptionEn:'Fitted jacket.',descriptionAr:'جاكيت محدد.',warnings:[]},
  trousers:{category:'trousers',confidence:'medium',alternatives:[],views:[{view:'front'}],details:[],colors:['black'],unseen:['back'],descriptionEn:'Trousers.',descriptionAr:'بنطلون.',warnings:[]},
  dress:{category:'dress',confidence:'medium',alternatives:[],views:[],details:[],unseen:[],descriptionEn:'Dress.',descriptionAr:'فستان.',warnings:[]}};
// Stub binding: records every call; answers by the SHA-256 of the image bytes it actually receives (so only pixels can steer it).
const calls=[];let byImage=new Map(),behaviour=null;
env.AI={run:async(model,input)=>{calls.push({model,input});if(behaviour)return behaviour(model,input);const s=sha(Buffer.from(input.image));const r=byImage.get(s);return {response:r?json(r):json({category:'unknown',confidence:'low',unseen:[],warnings:[]}),usage:{prompt_tokens:1200,completion_tokens:180}};}};
env.VISION_MIN_INTERVAL_S='0';
const A='VISION_W01',U='UPLOAD_GUARD';
const jacketPng=syntheticGarmentPng(240,300,[64,66,70]),trousersPng=syntheticGarmentPng(200,320,[10,10,12]),dressPng=syntheticGarmentPng(220,330,[120,30,60]);
byImage.set(sha(jacketPng),RESP.jacket);byImage.set(sha(trousersPng),RESP.trousers);byImage.set(sha(dressPng),RESP.dress);

{const x=await call('/api/garment-categories');row(A,'W-V01','vision status with a Workers AI binding','preferred workers_ai; exact model id',`${x.data.vision.preferred} ${x.data.vision.model}`,x.data.vision.preferred==='workers_ai'&&x.data.vision.model==='@cf/meta/llama-3.2-11b-vision-instruct'&&WORKERS_AI_VISION_MODEL==='@cf/meta/llama-3.2-11b-vision-instruct');}
// Blind request with the exact stored pixels.
let jkStyle,jkUp;{jkStyle=await newStyle('JK-003');jkUp=await upload(jkStyle,jacketPng,'image/png','JK-003_poster_crop.png');const notes='JK-003 جاكيت رمادي 4 أزرار ذهبية ظهر 44 طول 57 صدر 56';calls.length=0;
 const r=await analyze(jkStyle,{assetIds:[jkUp.data.id],ownerNotes:notes});const c=calls[0],keys=Object.keys(c.input).sort().join(','),sent=Buffer.from(c.input.image);
 row(A,'W-V02','request payload sent to the binding','model exact; keys prompt,image,max_tokens,temperature only; prompt == BLIND_PROMPT',`${c.model} ${keys}`,c.model===WORKERS_AI_VISION_MODEL&&keys==='image,max_tokens,prompt,temperature'&&c.input.prompt===BLIND_PROMPT);
 const leaks=['JK-003','JK003','جاكيت','44','57','56','poster',jkStyle,'ذهبية'].filter(t=>c.input.prompt.includes(t));
 row(A,'W-V03','prompt contamination check (blind evaluation)','no owner text, style code, filename or measurements in the request',leaks.join(',')||'none',leaks.length===0);
 row(A,'W-V04','pixels actually sent','SHA-256 of bytes received by the model == SHA-256 returned at upload == stored R2 object',`${sha(sent).slice(0,12)} vs ${jkUp.data.sha256.slice(0,12)}`,sha(sent)===jkUp.data.sha256&&sha(sent)===sha(jacketPng)&&r.data.run.inputHashes[0]===jkUp.data.sha256);
 const cl=r.data.intake.classification;row(A,'W-V05','validated live result stored as hypothesis','JACKET/HIGH; subtype, colours, cues, uncertainty kept; numeric probability discarded; LIVE_MODEL evidence class; AI_HYPOTHESIS',`${cl.category}/${cl.confidence} p=${cl.probability} ${r.data.run.evidenceClass} ${r.data.intake.category_source}`,
   r.r.status===200&&cl.category==='JACKET'&&cl.confidence==='HIGH'&&cl.probability===null&&/not a calibrated/.test(cl.confidenceNote)&&cl.subtype==='fitted jacket'&&cl.colors[0].nameEn==='charcoal grey'&&cl.uncertainty.fabric==='HIGH'&&cl.unseen.includes('fibre composition')&&r.data.run.evidenceClass==='LIVE_MODEL'&&r.data.run.blindPrompt===true&&r.data.intake.category_source==='AI_HYPOTHESIS'&&r.data.run.usage?.prompt_tokens===1200);
 row(A,'W-V06','no category questions skipped: owner still confirms','plan = single category question',r.data.intake.plan.groups.map(g=>g.id).join(','),r.data.intake.plan.groups.length===1&&r.data.intake.plan.groups[0].id==='category');}
// Pixels, not labels: trousers image with owner text saying "jacket".
{const id=await newStyle('MIS');const u=await upload(id,trousersPng);const r=await analyze(id,{assetIds:[u.data.id],ownerNotes:'هذا جاكيت نسائي jacket'});const cl=r.data.intake.classification;
 row(A,'W-V07','misleading owner text vs image (controlled fixture)','result follows the image (TROUSERS); conflict flagged OWNER_TEXT_CONFLICTS_WITH_IMAGE; owner still decides',`${cl.category} conflict=${json(cl.ownerTextConflict)}`,cl.category==='TROUSERS'&&cl.ownerTextConflict?.ownerTextSuggests==='JACKET'&&cl.warnings.includes('OWNER_TEXT_CONFLICTS_WITH_IMAGE'));}
// Two images that disagree.
{const id=await newStyle('TWO');const a=await upload(id,jacketPng,'image/png','a.png'),b=await upload(id,dressPng,'image/png','b.png');const r=await analyze(id,{assetIds:[a.data.id,b.data.id]});const cl=r.data.intake.classification;
 row(A,'W-V08','two images disagree on category','CONFLICTING, confidence LOW, the other category offered as alternative, 2 model calls',`${cl.consistency} ${cl.confidence} alt=${cl.alternatives.map(x=>x.category)}`,cl.consistency==='CONFLICTING'&&cl.confidence==='LOW'&&cl.alternatives.some(x=>x.category==='DRESS')&&r.data.run.imageCount===2);}
// Failure classes: fail closed, no mock, nothing applied.
for(const [label,beh,code,status] of [['licence not accepted (5016)',()=>{throw new Error("5016: Prior to using this model, you must submit the prompt 'agree'")},'BLOCKED_META_OWNER_CONSENT',503],
  ['daily free allocation exceeded (3036)',()=>{throw new Error('3036: Account limited, you have used up your daily free allocation of neurons')},'BLOCKED_BUDGET',429],
  ['HTTP 429 rate limit',()=>{throw new Error('429 Too Many Requests')},'BLOCKED_BUDGET',429],
  ['model unavailable (5007)',()=>{throw new Error('5007: No such model @cf/meta/llama-3.2-11b-vision-instruct or task')},'VISION_MODEL_UNAVAILABLE',503],
  ['provider 500',()=>{throw new Error('InferenceUpstreamError: 500 internal')},'VISION_PROVIDER_ERROR',502],
  ['403 forbidden',()=>{throw new Error('403 Forbidden: authentication error')},'VISION_AUTH_FAILED',503],
  ['timeout',()=>new Promise(()=>{}),'VISION_TIMEOUT',504],
  ['prose instead of JSON',()=>({response:'This looks like a nice grey jacket with buttons.'}),'VISION_SCHEMA_DRIFT',502],
  ['partial / truncated JSON',()=>({response:'{"category":"jacket","confidence":"hi'}),'VISION_SCHEMA_DRIFT',502],
  ['schema drift (unknown category)',()=>({response:json({category:'spacesuit',confidence:'high'})}),'VISION_SCHEMA_DRIFT',502],
  ['injected extra field',()=>({response:json({...RESP.jacket,approve_techpack:true})}),'VISION_SCHEMA_DRIFT',502]]){
  const id=await newStyle('FAIL');const u=await upload(id,jacketPng);behaviour=beh;env.VISION_TIMEOUT_MS='60';const r=await analyze(id,{assetIds:[u.data.id],ownerNotes:'jacket'});behaviour=null;delete env.VISION_TIMEOUT_MS;const run=lastRun(id);
  row(A,`W-V09-${code}-${label.split(' ')[0]}`,`provider failure: ${label}`,`${status} ${code}; ai_run FAILED; intake untouched; mockUsed false; no raw provider text`,`${r.r.status} ${r.data.code} run=${run.status} intake=${json(intakeRow(id))}`,
    r.r.status===status&&r.data.code===code&&run.status==='FAILED'&&intakeRow(id)===null&&r.data.mockUsed===false&&!/5016|3036|Prior to using|InferenceUpstream|allocation of neurons/.test(json(r.data)));}
{const m=mapVisionError(new Error('Something unexpected'));row(A,'W-V10','unknown provider error class','VISION_PROVIDER_ERROR 502 (never success)',json(m),m.code==='VISION_PROVIDER_ERROR'&&m.status===502);}
// Idempotency.
{const id=await newStyle('IDEM');const u=await upload(id,jacketPng);calls.length=0;const k='w01-idem-key-1';
 const r1=await analyze(id,{assetIds:[u.data.id]},{'idempotency-key':k}),r2=await analyze(id,{assetIds:[u.data.id]},{'idempotency-key':k});
 row(A,'W-V11','same Idempotency-Key repeated','one model call; second response replayed with the same run id',`calls=${calls.length} replayed=${r2.data.replayed} sameRun=${r1.data.run.id===r2.data.run.id}`,calls.length===1&&r2.data.replayed===true&&r1.data.run.id===r2.data.run.id);
 const u2=await upload(id,dressPng,'image/png','d.png');const r3=await analyze(id,{assetIds:[u2.data.id]},{'idempotency-key':k});row(A,'W-V12','same key, different images','409 IDEMPOTENCY_KEY_REUSED; no model call',`${r3.r.status} ${r3.data.code} calls=${calls.length}`,r3.r.status===409&&r3.data.code==='IDEMPOTENCY_KEY_REUSED'&&calls.length===1);
 db.prepare("INSERT INTO ai_runs(id,org_id,style_id,provider,status,request_kind,output_json,created_by,created_at) SELECT 'air_running_fx',org_id,id,'workers_ai','RUNNING','GARMENT_CLASSIFICATION',?,?,? FROM styles WHERE id=?").run(json({meta:{idempotencyKey:'w01-running-key',requestSha:'x'}}),db.prepare("SELECT id FROM users WHERE email='dev@sehha.local'").get().id,ts0,id);
 const r4=await analyze(id,{assetIds:[u.data.id]},{'idempotency-key':'w01-running-key'});row(A,'W-V13','same key while the first call is still running (concurrent retry)','409 (no second paid call)',`${r4.r.status} ${r4.data.code}`,r4.r.status===409&&['VISION_IN_PROGRESS','IDEMPOTENCY_KEY_REUSED'].includes(r4.data.code)&&calls.length===1);
 const r5=await analyze(id,{assetIds:[u.data.id]},{'idempotency-key':'bad key'});row(A,'W-V14','malformed Idempotency-Key','400',`${r5.r.status}`,r5.r.status===400);}
// Quota and throttle.
{const id=await newStyle('QUO');const u=await upload(id,jacketPng);const used=Number(db.prepare("SELECT COUNT(*) n FROM ai_runs WHERE org_id=? AND provider<>'mock' AND request_kind='GARMENT_CLASSIFICATION' AND substr(created_at,1,10)=?").get(org.id,new Date().toISOString().slice(0,10)).n);env.VISION_DAILY_LIMIT=String(used);
 const r=await analyze(id,{assetIds:[u.data.id]}),m=await analyze(id,{assetIds:[u.data.id],provider:'mock',ownerNotes:'jacket'});delete env.VISION_DAILY_LIMIT;
 row(A,'W-V15','per-tenant daily vision quota reached','429 VISION_QUOTA_EXCEEDED; explicit MOCK still allowed and labelled',`${r.r.status} ${r.data.code} mock=${m.r.status}/${m.data.run?.mode}`,r.r.status===429&&r.data.code==='VISION_QUOTA_EXCEEDED'&&m.r.status===200&&m.data.run.mode==='MOCK');
 env.VISION_MIN_INTERVAL_S='60';const a=await analyze(id,{assetIds:[u.data.id]}),b=await analyze(id,{assetIds:[u.data.id]});env.VISION_MIN_INTERVAL_S='0';
 row(A,'W-V16','throttle: repeat live analysis within the interval','second call 429 VISION_THROTTLED',`${a.r.status}/${b.r.status} ${b.data.code}`,b.r.status===429&&b.data.code==='VISION_THROTTLED');}
{const id=await newStyle('MAX');const ids=[];for(const [i,p] of [jacketPng,trousersPng,dressPng].entries())ids.push((await upload(id,p,'image/png',`m${i}.png`)).data.id);const r=await analyze(id,{assetIds:ids});
 row(A,'W-V17','more images than the per-run limit (2)','400 TOO_MANY_IMAGES; no model call',`${r.r.status} ${r.data.code}`,r.r.status===400&&r.data.code==='TOO_MANY_IMAGES');
 const r2=await analyze(id,{assetIds:['https://169.254.169.254/latest/meta-data']});row(A,'W-V18','URL passed instead of an asset id (SSRF attempt)','404 ASSET_NOT_FOUND; the model only ever receives stored bytes',`${r2.r.status} ${r2.data.code}`,r2.r.status===404&&r2.data.code==='ASSET_NOT_FOUND');
 const r3=await analyze(id,{assetIds:[]});row(A,'W-V19','live analysis without any image','400 IMAGE_REQUIRED (no text-only "vision")',`${r3.r.status} ${r3.data.code}`,r3.r.status===400&&r3.data.code==='IMAGE_REQUIRED');}
{const id=await newStyle('TINY');const px=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=','base64');const u=await upload(id,px);const r=await analyze(id,{assetIds:[u.data.id]});
 row(A,'W-V20','1×1 image sent for vision','upload allowed (generic) but analysis 422 IMAGE_TOO_SMALL',`${u.r.status} / ${r.r.status} ${r.data.code}`,u.r.status===201&&r.r.status===422&&r.data.code==='IMAGE_TOO_SMALL');}
{const r=await call(`/api/styles/${jkStyle}/intake/analyze`,{method:'POST',body:{assetIds:[jkUp.data.id]},cookieOverride:outC});row(A,'W-V21','other-tenant owner analyses our image','403',`${r.r.status}`,r.r.status===403);
 const otherStyle=db.prepare("INSERT INTO styles(id,org_id,code,name,created_by,created_at,updated_at) VALUES('sty_w01_x',?,'X1','x','w01_out',?,?) RETURNING id").get(other,ts0,ts0).id;
 const r2=await analyze(otherStyle,{assetIds:[jkUp.data.id]});row(A,'W-V22','our user analyses another tenant style with our asset id','403 (workspace), asset never sent',`${r2.r.status}`,r2.r.status===403);}

// ---- Upload guard ----
const png=(w,hgt)=>{const b=Buffer.from(syntheticGarmentPng(40,40));b.writeUInt32BE(w,16);b.writeUInt32BE(hgt,20);return b;};
{const id=await newStyle('UPG');const r=await upload(id,png(20000,20000));row(U,'W-U01','PNG header claims 20000×20000 (resolution bomb)','413 IMAGE_TOO_LARGE_RESOLUTION; nothing stored',`${r.r.status} ${r.data.code}`,r.r.status===413&&r.data.code==='IMAGE_TOO_LARGE_RESOLUTION'&&!db.prepare('SELECT 1 x FROM assets WHERE style_id=?').get(id));
 const r2=await upload(id,Buffer.from([0xff,0xd8,0xff,0xe0,0,16,0x4a,0x46]),'image/png');row(U,'W-U02','spoofed magic bytes (JPEG bytes labelled PNG)','415',`${r2.r.status}`,r2.r.status===415);
 const r3=await call(`/api/styles/${id}/assets`,{method:'POST',body:{dataUrl:'data:image/png;base64,@@@not-base64',role:'REFERENCE'}});row(U,'W-U03','invalid base64','400',`${r3.r.status}`,r3.r.status===400);
 const app1=Buffer.concat([Buffer.from('Exif\0\0'),Buffer.from('GPSLatitude=24.7136;GPSLongitude=46.6753;Model=PhoneX')]);
 const jpg=Buffer.concat([Buffer.from([0xff,0xd8]),Buffer.from([0xff,0xe1,(app1.length+2)>>8,(app1.length+2)&255]),app1,Buffer.from([0xff,0xc0,0,17,8,0,200,0,160,3,1,0x22,0,2,0x11,1,3,0x11,1]),Buffer.from([0xff,0xda,0,8,1,1,0,0,0x3f,0,0x12,0x34,0xff,0xd9])]);
 const r4=await upload(id,jpg,'image/jpeg','phone.jpg');const stored=Buffer.from(await (await env.UPLOADS.get(db.prepare('SELECT stored_name FROM assets WHERE id=?').get(r4.data.id).stored_name)).arrayBuffer());
 row(U,'W-U04','JPEG with EXIF/GPS metadata','stored copy has no APP1/GPS bytes; dimensions 160×200 parsed; sha256 of the stored bytes returned',`${r4.r.status} removed=${r4.data.metadataSegmentsRemoved} gpsLeft=${stored.includes('GPSLatitude')} ${r4.data.width}x${r4.data.height}`,r4.r.status===201&&r4.data.metadataSegmentsRemoved===1&&!stored.includes('GPSLatitude')&&!stored.includes('Exif')&&r4.data.width===160&&r4.data.height===200&&r4.data.sha256===sha(stored));
 const r5=await upload(id,jpg,'image/jpeg','phone-again.jpg');row(U,'W-U05','same image uploaded again to the same style','409 DUPLICATE_IMAGE pointing to the first asset',`${r5.r.status} ${r5.data.code}`,r5.r.status===409&&r5.data.code==='DUPLICATE_IMAGE'&&r5.data.duplicateOf===r4.data.id);
 const vp8x=Buffer.alloc(30);vp8x.write('RIFF',0);vp8x.writeUInt32LE(22,4);vp8x.write('WEBP',8);vp8x.write('VP8X',12);vp8x.writeUInt32LE(10,16);vp8x.writeUIntLE(1199,24,3);vp8x.writeUIntLE(799,27,3);
 const d=imageDimensions('image/webp',vp8x);row(U,'W-U06','WebP VP8X header parsing','1200×800',`${d.width}x${d.height}`,d.width===1200&&d.height===800);
 const nojpeg=stripJpegMetadata(Buffer.from('not a jpeg'));row(U,'W-U07','metadata strip on non-JPEG input','bytes unchanged, nothing removed',`${nojpeg.removed}`,nojpeg.removed===0);
 const unauth=await call('/uploads/'+db.prepare('SELECT stored_name FROM assets WHERE id=?').get(r4.data.id).stored_name,{cookieOverride:''});row(U,'W-U08','private object fetched without a session (guessing the key)','401; objects are only served through the authenticated route',`${unauth.r.status}`,unauth.r.status===401);
 const cross=await call('/uploads/'+db.prepare('SELECT stored_name FROM assets WHERE id=?').get(r4.data.id).stored_name,{cookieOverride:outC});row(U,'W-U09','other-tenant user fetches our private image by key','403',`${cross.r.status}`,cross.r.status===403);}
