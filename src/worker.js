const SCHEMA_VERSION = '2';
const PRODUCT = 'SEHHA ApparelOS';
const VERSION = '0.2.0-cloudflare';

const SCHEMA_SQL = `
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  brand_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
  is_platform_admin INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL, org_id TEXT NOT NULL, role TEXT NOT NULL,
  PRIMARY KEY(user_id,org_id)
);
CREATE TABLE IF NOT EXISTS styles (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
  garment_type TEXT NOT NULL DEFAULT 'CUSTOM', audience TEXT NOT NULL DEFAULT 'UNSPECIFIED',
  sizing_mode TEXT NOT NULL DEFAULT 'STANDARD', base_size TEXT, status TEXT NOT NULL DEFAULT 'DRAFT',
  hero_asset_id TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(org_id,code)
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, role TEXT NOT NULL, filename TEXT NOT NULL,
  stored_name TEXT NOT NULL, mime_type TEXT NOT NULL, source_kind TEXT NOT NULL DEFAULT 'USER_UPLOAD',
  rights_status TEXT NOT NULL DEFAULT 'USER_ASSERTED', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dna_items (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, field_key TEXT NOT NULL, field_label TEXT NOT NULL,
  value_text TEXT, provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED', confidence REAL,
  state TEXT NOT NULL DEFAULT 'DRAFT', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(style_id,field_key)
);
CREATE TABLE IF NOT EXISTS measurements (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
  value REAL, unit TEXT NOT NULL DEFAULT 'cm', method TEXT,
  tolerance_plus REAL, tolerance_minus REAL, provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED',
  state TEXT NOT NULL DEFAULT 'DRAFT', sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(style_id,code)
);
CREATE TABLE IF NOT EXISTS bom_items (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, code TEXT NOT NULL, category TEXT NOT NULL,
  name TEXT NOT NULL, specification TEXT, qty REAL, unit TEXT, status TEXT NOT NULL DEFAULT 'DRAFT',
  provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED', sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(style_id,code)
);
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, seq INTEGER NOT NULL, name TEXT NOT NULL,
  description TEXT, machine TEXT, stitch TEXT, qc_point TEXT,
  provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED', state TEXT NOT NULL DEFAULT 'DRAFT',
  UNIQUE(style_id,seq)
);
CREATE TABLE IF NOT EXISTS style_versions (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, version_no INTEGER NOT NULL, label TEXT NOT NULL,
  snapshot_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(style_id,version_no)
);
CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, style_id TEXT, asset_id TEXT,
  provider TEXT NOT NULL, model TEXT, status TEXT NOT NULL, request_kind TEXT NOT NULL,
  output_json TEXT, error_text TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, user_id TEXT,
  entity_type TEXT NOT NULL, entity_id TEXT, action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entitlements (
  org_id TEXT NOT NULL, feature_key TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  limit_value INTEGER, source TEXT NOT NULL DEFAULT 'SEHHA-DEV', PRIMARY KEY(org_id,feature_key)
);
CREATE INDEX IF NOT EXISTS idx_styles_org ON styles(org_id,updated_at);
CREATE INDEX IF NOT EXISTS idx_assets_style ON assets(style_id,created_at);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id,id DESC);
`;

const now = () => new Date().toISOString();
const json = (data,status=200,headers={}) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const html = (body,status=200) => new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
const errorJson = (message,status=500) => json({error:message},status);
function randomId(prefix=''){const b=new Uint8Array(12);crypto.getRandomValues(b);return prefix+[...b].map(x=>x.toString(16).padStart(2,'0')).join('');}
function bytesToHex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function hexToBytes(hex){const a=new Uint8Array(hex.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(hex.slice(i*2,i*2+2),16);return a;}
function b64urlEncode(bytes){let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function b64urlDecode(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const raw=atob(s),a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return a;}
async function pbkdf2(password,saltHex){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return crypto.subtle.deriveBits({name:'PBKDF2',salt:hexToBytes(saltHex),iterations:210000,hash:'SHA-256'},key,256);}
async function hashPassword(password,saltHex=null){if(!saltHex){const s=new Uint8Array(16);crypto.getRandomValues(s);saltHex=bytesToHex(s);}return {salt:saltHex,hash:bytesToHex(await pbkdf2(password,saltHex))};}
async function verifyPassword(password,salt,expected){const actual=new Uint8Array(await pbkdf2(password,salt)), exp=hexToBytes(expected);if(actual.length!==exp.length)return false;let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^exp[i];return diff===0;}
async function hmac(data,secret){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data));}
async function signSession(payload,secret){const body=b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));return body+'.'+b64urlEncode(await hmac(body,secret));}
async function readSession(token,secret){try{if(!token||!token.includes('.'))return null;const [body,sig]=token.split('.');const expected=new Uint8Array(await hmac(body,secret)), actual=b64urlDecode(sig);if(expected.length!==actual.length)return null;let d=0;for(let i=0;i<expected.length;i++)d|=expected[i]^actual[i];if(d)return null;const p=JSON.parse(new TextDecoder().decode(b64urlDecode(body)));return p.exp&&p.exp>Date.now()?p:null;}catch{return null;}}
function parseCookies(header=''){const out={};for(const part of header.split(';')){const i=part.indexOf('=');if(i>0)out[decodeURIComponent(part.slice(0,i).trim())]=decodeURIComponent(part.slice(i+1).trim());}return out;}
function sessionSecret(env){if(!env.SESSION_SECRET)throw Object.assign(new Error('SESSION_SECRET is not configured in Cloudflare secrets'),{status:503});return env.SESSION_SECRET;}
async function requestBody(request){const len=Number(request.headers.get('content-length')||0);if(len>30*1024*1024)throw Object.assign(new Error('Payload too large'),{status:413});return request.json().catch(()=>({}));}
function decodeDataUrl(s){const m=/^data:([^;]+);base64,(.+)$/.exec(s||'');if(!m)throw Object.assign(new Error('Invalid data URL'),{status:400});const raw=atob(m[2]);const a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return {mime:m[1],bytes:a};}
function extForMime(m){return ({'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'})[m]||'.bin';}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function q1(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).first();}
async function qall(env,sql,...bind){const r=await env.DB.prepare(sql).bind(...bind).all();return r.results||[];}
async function run(env,sql,...bind){return env.DB.prepare(sql).bind(...bind).run();}

async function ensureSchema(env){
  let current=null;
  try{current=await q1(env,"SELECT value FROM app_meta WHERE key='schema_version'");}catch{}
  if(current?.value!==SCHEMA_VERSION){
    await env.DB.exec(SCHEMA_SQL);
    await run(env,"INSERT OR REPLACE INTO app_meta(key,value) VALUES('schema_version',?)",SCHEMA_VERSION);
  }
  const count=await q1(env,'SELECT COUNT(*) AS n FROM organizations');
  if(Number(count?.n||0)===0 && env.DEV_BOOTSTRAP_PASSWORD && env.MOHSEN_BOOTSTRAP_PASSWORD){
    await seedDevData(env);
  }
}
async function upsertUser(env,{email,displayName,password,platformAdmin=false}){
  let u=await q1(env,'SELECT * FROM users WHERE email=?',email.toLowerCase());if(u)return u;
  const id=randomId('usr_'),h=await hashPassword(password);
  await run(env,'INSERT INTO users(id,email,display_name,password_hash,password_salt,is_platform_admin,created_at) VALUES(?,?,?,?,?,?,?)',id,email.toLowerCase(),displayName,h.hash,h.salt,platformAdmin?1:0,now());
  return q1(env,'SELECT * FROM users WHERE id=?',id);
}
async function seedDevData(env){
  const ts=now();
  let sehha=await q1(env,"SELECT * FROM organizations WHERE code='SEHHA'");if(!sehha){const id=randomId('org_');await run(env,'INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES(?,?,?,?,?)',id,'SEHHA','SEHHA IT',JSON.stringify({primary:'#12202a',accent:'#19a974'}),ts);sehha=await q1(env,'SELECT * FROM organizations WHERE id=?',id);}
  let mohsen=await q1(env,"SELECT * FROM organizations WHERE code='MOHSEN'");if(!mohsen){const id=randomId('org_');await run(env,'INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES(?,?,?,?,?)',id,'MOHSEN','MOHSEN Fashion Designer',JSON.stringify({primary:'#342116',accent:'#b7934c',paper:'#f7f1e8'}),ts);mohsen=await q1(env,'SELECT * FROM organizations WHERE id=?',id);}
  const dev=await upsertUser(env,{email:'dev@sehha.local',displayName:'SEHHA Developer',password:env.DEV_BOOTSTRAP_PASSWORD,platformAdmin:true});
  const mu=await upsertUser(env,{email:'mohsen@mohsen.local',displayName:'Mohsen - Designer & Pattern',password:env.MOHSEN_BOOTSTRAP_PASSWORD});
  await run(env,'INSERT OR IGNORE INTO memberships(user_id,org_id,role) VALUES(?,?,?)',dev.id,sehha.id,'PLATFORM_OWNER');
  await run(env,'INSERT OR IGNORE INTO memberships(user_id,org_id,role) VALUES(?,?,?)',dev.id,mohsen.id,'WORKSPACE_OWNER');
  await run(env,'INSERT OR IGNORE INTO memberships(user_id,org_id,role) VALUES(?,?,?)',mu.id,mohsen.id,'DESIGN_PATTERN_MASTER');
  for(const f of ['STYLE_CORE','ASSET_UPLOAD','MEASUREMENTS','BOM','OPERATIONS','OUTPUT_TECHNICAL','OUTPUT_MANAGEMENT','OUTPUT_MARKETING','AI_ANALYSIS','VERSIONS','AUDIT'])await run(env,'INSERT OR IGNORE INTO entitlements(org_id,feature_key,enabled,source) VALUES(?,?,1,?)',mohsen.id,f,'SEHHA-DEV');
  await run(env,'INSERT OR IGNORE INTO entitlements(org_id,feature_key,enabled,source) VALUES(?,?,1,?)',sehha.id,'PLATFORM_ADMIN','SEHHA-DEV');
  let style=await q1(env,"SELECT * FROM styles WHERE org_id=? AND code='JK-001'",mohsen.id);
  if(!style){
    const id=randomId('sty_');await run(env,'INSERT INTO styles(id,org_id,code,name,garment_type,audience,sizing_mode,base_size,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',id,mohsen.id,'JK-001','جاكيت نسائي قصير بعراوي Morfok','WOMENS_JACKET','WOMEN','STANDARD','M','BASE_APPROVED',mu.id,ts,ts);style=await q1(env,'SELECT * FROM styles WHERE id=?',id);
    const ast=randomId('ast_');await run(env,'INSERT INTO assets(id,style_id,role,filename,stored_name,mime_type,source_kind,rights_status,created_at) VALUES(?,?,?,?,?,?,?,?,?)',ast,id,'HERO','demo_jk001_reference.png','demo_jk001_reference.png','image/png','STATIC_DEMO','INTERNAL_REFERENCE',ts);await run(env,'UPDATE styles SET hero_asset_id=? WHERE id=?',ast,id);
    for(const [k,l,v,p,c] of [['fit','القصة','قصيرة مستقيمة - راحة واضحة','USER_CONFIRMED',1],['fabric','الخامة','موهير','USER_CONFIRMED',1],['closure','الغلق','4 عراوي Morfok أمامية','USER_CONFIRMED',1],['collar','الياقة','Stand Collar','INFERRED',0.92]]) await run(env,'INSERT INTO dna_items(id,style_id,field_key,field_label,value_text,provenance,confidence,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',randomId('dna_'),id,k,l,v,p,c,'APPROVED',ts,ts);
    const ms=[['A','طول الجسم',57,'من أعلى نقطة كتف إلى الذيل'],['B','عرض الظهر',44,'عرض مستقيم على الظهر'],['C','عرض الصدر',56,'قياس مسطح أسفل الإبطين'],['D','طول الكم',62,'من نقطة تركيب الكم حتى النهاية'],['E','وسع الكم من الإبط',38,'عرض مسطح عند بداية الكم'],['F','وسع الكم من أسفل',30,'عرض مسطح عند فتحة الكم']];let i=0;for(const m of ms)await run(env,'INSERT INTO measurements(id,style_id,code,name,value,unit,method,provenance,state,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)',randomId('pom_'),id,m[0],m[1],m[2],'cm',m[3],'USER_CONFIRMED','LOCKED',i++);
    const bom=[['B01','SHELL','القماش الخارجي','موهير؛ الوزن والتركيب يثبتان من سواتش المورد',1,'style','APPROVED'],['B02','THREAD','خيط الخياطة','بوليستر مطابق للون',1,'style','PROPOSED'],['B03','TRIM','وحدة Morfok','4 وحدات / 8 حلقات',4,'unit','APPROVED']];i=0;for(const b of bom)await run(env,'INSERT INTO bom_items(id,style_id,code,category,name,specification,qty,unit,status,provenance,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?)',randomId('bom_'),id,b[0],b[1],b[2],b[3],b[4],b[5],b[6],'USER_CONFIRMED',i++);
    const ops=[[1,'فحص وفرد وقص القماش','فحص اتجاه النسيج والوبرة ووضع العلامات','قص / يدوي أو آلي','—','اتجاه النسيج والوبرة'],[2,'تثبيت التدعيم المعتمد','الياقة وحافتا الأمام حسب اختبار الخامة','مكبس حراري','—','عدم لمعان القماش'],[3,'تجميع الكتفين','مطابقة وتماثل الميل','سنجل نيدل','301','تماثل الميل'],[4,'تجهيز وتركيب الياقة','ضبط الطرفين','سنجل نيدل','301','تساوي الطرفين'],[5,'تجهيز وتركيب الأكمام','ضبط Sleeve Pitch','سنجل نيدل','301','Sleeve Pitch'],[6,'غلق الجوانب واستكمال الكم','مطابقة علامات الإبط','سنجل + أوفر','301/504','مطابقة الإبط'],[7,'تشطيب أسفل الكم والذيل','تشطيب حسب سماح العينة','سنجل نيدل','301','ثبات الحافة'],[8,'تصنيع وتثبيت Morfok','5 سم من خط الصدر ثم Pitch 10 سم','يدوي/ماكينة','—','قوة الشد والتماثل'],[9,'كي مرحلي ونهائي','حسب تحمل الخامة','مكواة بخار','—','بدون لمعان'],[10,'قياس نهائي وفحص بصري','POM + تماثل الغلق','QC','—','قبول/رفض']];for(const o of ops)await run(env,'INSERT INTO operations(id,style_id,seq,name,description,machine,stitch,qc_point,provenance,state) VALUES(?,?,?,?,?,?,?,?,?,?)',randomId('op_'),id,...o,'USER_CONFIRMED','APPROVED');
  }
}
async function auth(request,env){const t=parseCookies(request.headers.get('cookie')||'').sehha_session;return readSession(t,sessionSecret(env));}
async function requireAuth(request,env){const s=await auth(request,env);if(!s)throw Object.assign(new Error('Authentication required'),{status:401});return s;}
async function requireOrg(env,s,orgId){if(s.platformAdmin)return;const m=await q1(env,'SELECT role FROM memberships WHERE user_id=? AND org_id=?',s.userId,orgId);if(!m)throw Object.assign(new Error('Forbidden workspace'),{status:403});}
async function audit(env,orgId,userId,entityType,entityId,action,detail={}){await run(env,'INSERT INTO audit_log(org_id,user_id,entity_type,entity_id,action,detail_json,created_at) VALUES(?,?,?,?,?,?,?)',orgId,userId,entityType,entityId,action,JSON.stringify(detail),now());}
async function memberships(env,userId){return qall(env,'SELECT m.role,o.id,o.code,o.name,o.brand_json FROM memberships m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=? ORDER BY o.name',userId);}
async function entitlements(env,orgId){if(env.LICENSE_MODE==='remote'){if(!env.SEHHA_LICENSE_ENDPOINT)throw new Error('SEHHA_LICENSE_ENDPOINT missing');const r=await fetch(`${env.SEHHA_LICENSE_ENDPOINT.replace(/\/$/,'')}/api/entitlements/${encodeURIComponent(orgId)}?product=${encodeURIComponent(env.SEHHA_PRODUCT_ID||'SEHHA_APPAREL')}`);if(!r.ok)throw new Error('License service '+r.status);return r.json();}return qall(env,'SELECT feature_key,enabled,limit_value,source FROM entitlements WHERE org_id=?',orgId);}
async function requireFeature(env,orgId,key){const list=await entitlements(env,orgId),x=list.find(v=>v.feature_key===key||v.key===key);if(!x||!(x.enabled===1||x.enabled===true))throw Object.assign(new Error('Feature not licensed'),{status:403});return x;}
async function styleSnapshot(env,id){const style=await q1(env,'SELECT * FROM styles WHERE id=?',id);if(!style)return null;return {style,dna:await qall(env,'SELECT * FROM dna_items WHERE style_id=? ORDER BY field_label',id),measurements:await qall(env,'SELECT * FROM measurements WHERE style_id=? ORDER BY sort_order,code',id),bom:await qall(env,'SELECT * FROM bom_items WHERE style_id=? ORDER BY sort_order,code',id),operations:await qall(env,'SELECT * FROM operations WHERE style_id=? ORDER BY seq',id),assets:await qall(env,'SELECT * FROM assets WHERE style_id=? ORDER BY created_at',id)};}
function assetUrl(a){return '/uploads/'+encodeURIComponent(a.stored_name);}

async function openAIAnalyze(env,imageDataUrl,context){if(!env.OPENAI_API_KEY)throw Object.assign(new Error('OPENAI_API_KEY is not configured in Cloudflare Worker secrets'),{status:503});const model=env.OPENAI_MODEL||'gpt-6-luna';const prompt=`You are the vision-analysis stage of SEHHA ApparelOS, an apparel product intelligence system. Return JSON only.\nDo not invent production facts that cannot be seen. Mark every claim OBSERVED, INFERRED, or UNKNOWN. Measurements, GSM, fiber composition, zipper length, seam allowance, shrinkage and grade rules must be UNKNOWN unless visible text or user context explicitly supplies them.\nReturn exactly this structure:\n{"garment":{"family":"","type":"","audience":"","constructionMode":"","fit":""},"features":[{"key":"","label":"","value":"","confidence":0.0,"provenance":"OBSERVED|INFERRED|UNKNOWN"}],"detectedDetails":[""],"materialAppearance":{"family":"","surface":"","nap":"YES|NO|UNKNOWN","stretch":"UNKNOWN","composition":"UNKNOWN","gsm":"UNKNOWN"},"trims":[{"name":"","count":null,"confidence":0.0,"provenance":"OBSERVED|INFERRED|UNKNOWN"}],"templateCandidates":[{"template":"","confidence":0.0,"reason":""}],"suggestedPOM":[{"code":"","name":"","reason":""}],"suggestedPatternArchitecture":[{"code":"","name":"","qty":null,"note":""}],"suggestedOperations":[{"seq":1,"name":"","machine":"","stitch":"","qc":""}],"warnings":[""]}\nApp context: ${JSON.stringify(context)}`;const body={model,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:imageDataUrl,detail:'high'}]}]};const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(body)});const raw=await r.text();if(!r.ok)throw new Error(`OpenAI ${r.status}: ${raw.slice(0,400)}`);const d=JSON.parse(raw);const txt=(d.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||'').join('\n')||d.output_text||'';return JSON.parse(txt.replace(/^```json\s*/i,'').replace(/```\s*$/,'').trim());}
function providers(env){return [{id:'openai',configured:Boolean(env.OPENAI_API_KEY),model:env.OPENAI_MODEL||'gpt-6-luna',enabled:Boolean(env.OPENAI_API_KEY)},{id:'anthropic',configured:Boolean(env.ANTHROPIC_API_KEY),model:env.ANTHROPIC_MODEL||'',enabled:false},{id:'gemini',configured:Boolean(env.GEMINI_API_KEY),model:env.GEMINI_MODEL||'',enabled:false}];}
async function outputPage(env,snap,profile){const s=snap.style;const org=await q1(env,'SELECT * FROM organizations WHERE id=?',s.org_id);const hero=snap.assets.find(a=>a.id===s.hero_asset_id)||snap.assets.find(a=>a.role==='HERO');const image=hero?`<img class="hero" src="${assetUrl(hero)}">`:'';const tech=profile==='technical';const title=tech?'ورقة فنية للإنتاج / Technical Production Sheet':'Product Management Overview';const measurements=snap.measurements.map(m=>`<tr><td>${esc(m.code)}</td><td>${esc(m.name)}</td><td>${m.value??'—'} ${esc(m.unit)}</td><td>${esc(m.state)}</td></tr>`).join('');const bom=snap.bom.map(b=>`<tr><td>${esc(b.code)}</td><td>${esc(b.name)}</td><td>${esc(b.specification)}</td><td>${esc(b.status)}</td></tr>`).join('');const ops=snap.operations.map(o=>`<tr><td>${o.seq}</td><td>${esc(o.name)}</td><td>${esc(o.machine||'')}</td><td>${esc(o.stitch||'')}</td><td>${esc(o.qc_point||'')}</td></tr>`).join('');return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>${esc(s.code)} ${title}</title><style>@page{size:A4;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#111;margin:0;background:white}header{border-bottom:4px solid #342116;padding:8px 0;margin-bottom:10px;display:flex;justify-content:space-between;align-items:end}.brand{font-size:24px;font-weight:800}.muted{color:#666}.grid{display:grid;grid-template-columns:${tech?'1fr 1fr':'0.85fr 1.15fr'};gap:10px}.box{border:1px solid #888;padding:8px;margin-bottom:8px;break-inside:avoid}h1{font-size:19px;margin:0}h2{font-size:14px;background:#6f5a48;color:white;margin:0 0 6px;padding:5px}table{width:100%;border-collapse:collapse;font-size:10.5px}td,th{border:1px solid #aaa;padding:4px}.hero{width:100%;max-height:245mm;object-fit:contain}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;font-size:10px}.meta div{border:1px solid #bbb;padding:5px}.print{position:fixed;left:10px;top:10px}@media print{.print{display:none}}</style><button class="print" onclick="print()">Print / PDF</button><header><div><div class="brand">${esc(org?.name||'SEHHA ApparelOS')}</div><div class="muted">${title}</div></div><div><h1>${esc(s.code)} — ${esc(s.name)}</h1></div></header><div class="meta"><div>Type<br><b>${esc(s.garment_type)}</b></div><div>Base<br><b>${esc(s.base_size||'—')}</b></div><div>Sizing<br><b>${esc(s.sizing_mode)}</b></div><div>Status<br><b>${esc(s.status)}</b></div></div><div class="grid" style="margin-top:8px"><div>${image}<div class="box"><h2>Garment DNA</h2>${snap.dna.map(d=>`<p><b>${esc(d.field_label)}</b>: ${esc(d.value_text)} <small>${esc(d.provenance)}</small></p>`).join('')}</div></div><div><div class="box"><h2>Measurements / POM</h2><table><tr><th>Code</th><th>Measurement</th><th>Value</th><th>State</th></tr>${measurements}</table></div><div class="box"><h2>BOM</h2><table><tr><th>Code</th><th>Item</th><th>Specification</th><th>Status</th></tr>${bom}</table></div>${tech?`<div class="box"><h2>Operation Bulletin</h2><table><tr><th>#</th><th>Operation</th><th>Machine</th><th>Stitch</th><th>QC</th></tr>${ops}</table></div>`:`<div class="box"><h2>History / Output Intent</h2><p>هذا الإصدار الإداري يلخص شكل المنتج وبياناته المؤكدة. الملف الفني التفصيلي يُصدر من نفس Style Digital Twin.</p></div>`}</div></div></html>`;}

async function apiRoute(request,env){
  const url=new URL(request.url),p=url.pathname;
  if(p==='/api/health'){const c=await q1(env,'SELECT COUNT(*) AS n FROM organizations');return json({ok:true,product:PRODUCT,version:VERSION,platform:'Cloudflare Workers',storage:'D1 + R2',licenseMode:env.LICENSE_MODE||'development',ai:providers(env),bootstrapReady:Boolean(env.SESSION_SECRET&&env.DEV_BOOTSTRAP_PASSWORD&&env.MOHSEN_BOOTSTRAP_PASSWORD),seeded:Number(c?.n||0)>0,missingSecrets:['SESSION_SECRET','DEV_BOOTSTRAP_PASSWORD','MOHSEN_BOOTSTRAP_PASSWORD'].filter(k=>!env[k])});}
  if(p==='/api/auth/login'&&request.method==='POST'){const b=await requestBody(request),u=await q1(env,'SELECT * FROM users WHERE email=? AND active=1',String(b.email||'').toLowerCase());if(!u||!(await verifyPassword(String(b.password||''),u.password_salt,u.password_hash)))return errorJson('Invalid credentials',401);const token=await signSession({userId:u.id,platformAdmin:Boolean(u.is_platform_admin),exp:Date.now()+12*60*60*1000},sessionSecret(env));return json({ok:true},200,{'set-cookie':`sehha_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`});}
  if(p==='/api/auth/logout'&&request.method==='POST')return json({ok:true},200,{'set-cookie':'sehha_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'});
  if(p==='/api/me'){const s=await requireAuth(request,env),u=await q1(env,'SELECT id,email,display_name,is_platform_admin FROM users WHERE id=?',s.userId);return json({user:u,workspaces:await memberships(env,s.userId)});}
  if(p==='/api/ai/providers'){await requireAuth(request,env);return json({providers:providers(env)});}
  if(p.startsWith('/api/workspaces/')&&p.endsWith('/entitlements')){const s=await requireAuth(request,env),orgId=p.split('/')[3];await requireOrg(env,s,orgId);return json({items:await entitlements(env,orgId)});}
  if(p==='/api/styles'&&request.method==='GET'){const s=await requireAuth(request,env),orgId=url.searchParams.get('orgId');if(!orgId)throw Object.assign(new Error('orgId required'),{status:400});await requireOrg(env,s,orgId);return json({items:await qall(env,`SELECT s.*, (SELECT stored_name FROM assets a WHERE a.id=s.hero_asset_id) hero_stored_name FROM styles s WHERE org_id=? ORDER BY updated_at DESC`,orgId)});}
  if(p==='/api/styles'&&request.method==='POST'){const s=await requireAuth(request,env),b=await requestBody(request);await requireOrg(env,s,b.orgId);await requireFeature(env,b.orgId,'STYLE_CORE');const id=randomId('sty_'),ts=now();await run(env,'INSERT INTO styles(id,org_id,code,name,garment_type,audience,sizing_mode,base_size,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',id,b.orgId,b.code,b.name,b.garmentType||'CUSTOM',b.audience||'UNSPECIFIED',b.sizingMode||'STANDARD',b.baseSize||null,'DRAFT',s.userId,ts,ts);await audit(env,b.orgId,s.userId,'STYLE',id,'CREATE',{code:b.code});return json({id},201);}
  const sm=p.match(/^\/api\/styles\/([^/]+)$/);if(sm&&request.method==='GET'){const s=await requireAuth(request,env),snap=await styleSnapshot(env,sm[1]);if(!snap)return errorJson('Style not found',404);await requireOrg(env,s,snap.style.org_id);return json(snap);}if(sm&&request.method==='PATCH'){const s=await requireAuth(request,env),b=await requestBody(request),st=await q1(env,'SELECT * FROM styles WHERE id=?',sm[1]);if(!st)return errorJson('Style not found',404);await requireOrg(env,s,st.org_id);const map={name:'name',garment_type:'garment_type',audience:'audience',sizing_mode:'sizing_mode',base_size:'base_size',status:'status'};const sets=[],vals=[];for(const k of Object.keys(map))if(k in b){sets.push(map[k]+'=?');vals.push(b[k]);}sets.push('updated_at=?');vals.push(now(),st.id);await env.DB.prepare(`UPDATE styles SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();await audit(env,st.org_id,s.userId,'STYLE',st.id,'UPDATE',b);return json({ok:true});}
  const am=p.match(/^\/api\/styles\/([^/]+)\/assets$/);if(am&&request.method==='POST'){const s=await requireAuth(request,env),b=await requestBody(request),st=await q1(env,'SELECT * FROM styles WHERE id=?',am[1]);if(!st)return errorJson('Style not found',404);await requireOrg(env,s,st.org_id);await requireFeature(env,st.org_id,'ASSET_UPLOAD');const d=decodeDataUrl(b.dataUrl);if(!d.mime.startsWith('image/'))throw Object.assign(new Error('Only images supported'),{status:400});const id=randomId('ast_'),stored=id+extForMime(d.mime);await env.UPLOADS.put(stored,d.bytes,{httpMetadata:{contentType:d.mime},customMetadata:{styleId:st.id,role:b.role||'REFERENCE'}});await run(env,'INSERT INTO assets(id,style_id,role,filename,stored_name,mime_type,source_kind,rights_status,created_at) VALUES(?,?,?,?,?,?,?,?,?)',id,st.id,b.role||'REFERENCE',b.filename||stored,stored,d.mime,b.sourceKind||'USER_UPLOAD',b.rightsStatus||'USER_ASSERTED',now());if(b.role==='HERO'||!st.hero_asset_id)await run(env,'UPDATE styles SET hero_asset_id=?,updated_at=? WHERE id=?',id,now(),st.id);await audit(env,st.org_id,s.userId,'ASSET',id,'UPLOAD',{role:b.role,filename:b.filename});return json({id,url:'/uploads/'+stored},201);}
  const aim=p.match(/^\/api\/styles\/([^/]+)\/ai-analyze$/);if(aim&&request.method==='POST'){const s=await requireAuth(request,env),b=await requestBody(request),st=await q1(env,'SELECT * FROM styles WHERE id=?',aim[1]);if(!st)return errorJson('Style not found',404);await requireOrg(env,s,st.org_id);await requireFeature(env,st.org_id,'AI_ANALYSIS');const a=await q1(env,'SELECT * FROM assets WHERE id=? AND style_id=?',b.assetId,st.id);if(!a)throw Object.assign(new Error('Asset not found'),{status:404});let bytes;if(a.source_kind==='STATIC_DEMO'){const r=await env.STATIC.fetch(new URL('/demo_jk001_reference.png',request.url));bytes=new Uint8Array(await r.arrayBuffer());}else{const o=await env.UPLOADS.get(a.stored_name);if(!o)throw new Error('Stored image missing');bytes=new Uint8Array(await o.arrayBuffer());}let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));const dataUrl=`data:${a.mime_type};base64,${btoa(bin)}`,runId=randomId('air_'),provider=b.provider||'openai';await run(env,'INSERT INTO ai_runs(id,org_id,style_id,asset_id,provider,model,status,request_kind,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',runId,st.org_id,st.id,a.id,provider,env.OPENAI_MODEL||'gpt-6-luna','RUNNING','GARMENT_ANALYSIS',s.userId,now());try{if(provider!=='openai')throw new Error('Provider slot exists but is not enabled in Preview 02');const result=await openAIAnalyze(env,dataUrl,{styleCode:st.code,styleName:st.name,garmentType:st.garment_type});await run(env,'UPDATE ai_runs SET status=?,output_json=? WHERE id=?','COMPLETED',JSON.stringify(result),runId);await audit(env,st.org_id,s.userId,'AI_RUN',runId,'ANALYZE',{assetId:a.id,provider});return json({runId,result});}catch(e){await run(env,'UPDATE ai_runs SET status=?,error_text=? WHERE id=?','FAILED',String(e.message||e),runId);throw e;}}
  const ap=p.match(/^\/api\/styles\/([^/]+)\/apply-ai$/);if(ap&&request.method==='POST'){const s=await requireAuth(request,env),b=await requestBody(request),st=await q1(env,'SELECT * FROM styles WHERE id=?',ap[1]);if(!st)return errorJson('Style not found',404);await requireOrg(env,s,st.org_id);const ts=now();for(const f of (b.features||[])){if(!f.key||!f.value||f.provenance==='UNKNOWN')continue;await run(env,`INSERT INTO dna_items(id,style_id,field_key,field_label,value_text,provenance,confidence,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(style_id,field_key) DO UPDATE SET field_label=excluded.field_label,value_text=excluded.value_text,provenance=excluded.provenance,confidence=excluded.confidence,state='AI_DRAFT',updated_at=excluded.updated_at`,randomId('dna_'),st.id,f.key,f.label||f.key,String(f.value),f.provenance||'INFERRED',Number(f.confidence)||null,'AI_DRAFT',ts,ts);}await audit(env,st.org_id,s.userId,'STYLE',st.id,'APPLY_AI',{count:(b.features||[]).length});return json({ok:true});}
  const vm=p.match(/^\/api\/styles\/([^/]+)\/versions$/);if(vm&&request.method==='POST'){const s=await requireAuth(request,env),b=await requestBody(request),snap=await styleSnapshot(env,vm[1]);if(!snap)return errorJson('Style not found',404);await requireOrg(env,s,snap.style.org_id);await requireFeature(env,snap.style.org_id,'VERSIONS');const last=await q1(env,'SELECT MAX(version_no) n FROM style_versions WHERE style_id=?',snap.style.id),n=Number(last?.n||0)+1,id=randomId('ver_');await run(env,'INSERT INTO style_versions(id,style_id,version_no,label,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?)',id,snap.style.id,n,b.label||`V${n}`,JSON.stringify(snap),s.userId,now());await audit(env,snap.style.org_id,s.userId,'VERSION',id,'CREATE',{version:n});return json({id,versionNo:n},201);}
  if(p==='/api/audit'){const s=await requireAuth(request,env),orgId=url.searchParams.get('orgId');await requireOrg(env,s,orgId);return json({items:await qall(env,'SELECT * FROM audit_log WHERE org_id=? ORDER BY id DESC LIMIT 200',orgId)});}
  const om=p.match(/^\/api\/styles\/([^/]+)\/output$/);if(om&&request.method==='GET'){const s=await requireAuth(request,env),snap=await styleSnapshot(env,om[1]);if(!snap)return errorJson('Style not found',404);await requireOrg(env,s,snap.style.org_id);const profile=url.searchParams.get('profile')||'technical';await requireFeature(env,snap.style.org_id,profile==='management'?'OUTPUT_MANAGEMENT':'OUTPUT_TECHNICAL');return html(await outputPage(env,snap,profile));}
  return null;
}

async function uploadRoute(request,env){const url=new URL(request.url),key=decodeURIComponent(url.pathname.slice('/uploads/'.length));if(!key)return errorJson('Not found',404);const o=await env.UPLOADS.get(key);if(o){const h=new Headers();o.writeHttpMetadata(h);h.set('etag',o.httpEtag);h.set('cache-control','private, max-age=3600');return new Response(o.body,{headers:h});}if(key==='demo_jk001_reference.png')return env.STATIC.fetch(new URL('/demo_jk001_reference.png',request.url));return errorJson('Asset not found',404);}

export default {async fetch(request,env){try{await ensureSchema(env);const p=new URL(request.url).pathname;if(p.startsWith('/api/')){const r=await apiRoute(request,env);return r||errorJson('API route not found',404);}if(p.startsWith('/uploads/'))return uploadRoute(request,env);return env.STATIC.fetch(request);}catch(e){console.error(e);return errorJson(String(e.message||e),Number(e.status)||500);}}};
