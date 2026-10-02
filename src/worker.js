const SCHEMA_VERSION = '4';
const PRODUCT = 'SEHHA ApparelOS';
const VERSION = '0.3.0-cloudflare';

const SCHEMA_SQL = `
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
function extForMime(m){return ({'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/avif':'.avif'})[m]||'.bin';}
const OPENAI_IMAGE_MIMES=new Set(['image/jpeg','image/png','image/webp','image/gif']);
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function sqlText(sql,source='sql'){
  if(typeof sql!=='string'){
    console.error('NON_STRING_SQL',{source,type:typeof sql,value:sql});
    throw Object.assign(new TypeError(`Internal SQL error at ${source}: expected string, got ${typeof sql}`),{status:500});
  }
  const q=sql.trim();
  if(!q)throw Object.assign(new TypeError(`Internal SQL error at ${source}: empty SQL`),{status:500});
  return q;
}
async function q1(env,sql,...bind){return env.DB.prepare(sqlText(sql,'q1')).bind(...bind).first();}
async function qall(env,sql,...bind){const r=await env.DB.prepare(sqlText(sql,'qall')).bind(...bind).all();return r.results||[];}
async function run(env,sql,...bind){return env.DB.prepare(sqlText(sql,'run')).bind(...bind).run();}

async function databaseState(env){
  try{
    const meta=await q1(env,"SELECT value FROM app_meta WHERE key='schema_version'");
    const count=await q1(env,'SELECT COUNT(*) AS n FROM organizations');
    return {ready:true,schemaVersion:meta?.value||null,seeded:Number(count?.n||0)>0};
  }catch(e){
    return {ready:false,schemaVersion:null,seeded:false,error:String(e?.message||e)};
  }
}
async function ensureDatabaseReady(env){
  const state=await databaseState(env);
  if(!state.ready){
    throw Object.assign(new Error('D1 schema is not initialized. Run: npm run db:migrate:local (local) or npm run db:migrate:remote (Cloudflare).'),{status:503});
  }
  if(state.schemaVersion!==SCHEMA_VERSION){
    throw Object.assign(new Error(`D1 schema version ${state.schemaVersion||'none'} does not match application ${SCHEMA_VERSION}. Apply migrations.`),{status:503});
  }
  if(!state.seeded && env.DEV_BOOTSTRAP_PASSWORD && env.MOHSEN_BOOTSTRAP_PASSWORD){
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
async function styleSnapshot(env,id){const style=await q1(env,'SELECT * FROM styles WHERE id=?',id);if(!style)return null;return {style,dna:await qall(env,'SELECT * FROM dna_items WHERE style_id=? ORDER BY field_label',id),measurements:await qall(env,'SELECT * FROM measurements WHERE style_id=? ORDER BY sort_order,code',id),bom:await qall(env,'SELECT * FROM bom_items WHERE style_id=? ORDER BY sort_order,code',id),operations:await qall(env,'SELECT * FROM operations WHERE style_id=? ORDER BY seq',id),patternPieces:await qall(env,'SELECT * FROM pattern_pieces WHERE style_id=? ORDER BY sort_order,code',id),assets:await qall(env,'SELECT * FROM assets WHERE style_id=? ORDER BY created_at',id),versions:await qall(env,'SELECT version_no,label,created_at,created_by FROM style_versions WHERE style_id=? ORDER BY version_no DESC LIMIT 20',id)};}
function assetUrl(a){return '/uploads/'+encodeURIComponent(a.stored_name);}

function analysisPrompt(context){return `You are the multimodal apparel-analysis stage of SEHHA ApparelOS. Return JSON only, with no markdown.\nYou are assisting professional fashion designers, pattern makers and factories. Analyze what is visually supported, but never invent production facts.\nEvery claim must be OBSERVED, INFERRED or UNKNOWN. Exact measurements, GSM, fiber composition, zipper length, seam allowance, shrinkage, grade rules and physical fabric performance must remain UNKNOWN unless visible text or supplied context explicitly proves them.\nDistinguish garment construction from artwork/print. Detect if the image contains one garment, a set, or multiple colorways.\nReturn exactly this JSON structure:\n{"garment":{"family":"","type":"","audience":"","constructionMode":"","fit":"","multiGarment":false,"colorwayCount":1},"features":[{"key":"","label":"","value":"","confidence":0.0,"provenance":"OBSERVED|INFERRED|UNKNOWN"}],"detectedDetails":[""],"materialAppearance":{"family":"","surface":"","nap":"YES|NO|UNKNOWN","stretch":"UNKNOWN","composition":"UNKNOWN","gsm":"UNKNOWN"},"trims":[{"name":"","count":null,"confidence":0.0,"provenance":"OBSERVED|INFERRED|UNKNOWN"}],"artwork":[{"zone":"","description":"","confidence":0.0}],"templateCandidates":[{"template":"","confidence":0.0,"reason":""}],"suggestedPOM":[{"code":"","name":"","reason":""}],"suggestedPatternArchitecture":[{"code":"","name":"","qty":null,"note":""}],"suggestedOperations":[{"seq":1,"name":"","machine":"","stitch":"","qc":""}],"warnings":[""]}\nApplication context: ${JSON.stringify(context)}`;}
function stripJsonFence(txt){const t=String(txt||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();const a=t.indexOf('{'),b=t.lastIndexOf('}');return a>=0&&b>a?t.slice(a,b+1):t;}
function parseDataUrlParts(imageDataUrl){const m=/^data:([^;]+);base64,(.+)$/s.exec(imageDataUrl||'');if(!m)throw Object.assign(new Error('Invalid image data URL'),{status:400});return {mime:m[1],base64:m[2]};}
async function openAIAnalyze(env,imageDataUrl,context){
  if(!env.OPENAI_API_KEY)throw Object.assign(new Error('OPENAI_API_KEY is not configured'),{status:503,provider:'openai'});
  const model=env.OPENAI_MODEL||'gpt-5.6-luna',prompt=analysisPrompt(context);
  const body={model,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:imageDataUrl,detail:'high'}]}]};
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const raw=await r.text();if(!r.ok){const e=Object.assign(new Error(`OpenAI ${r.status}: ${raw.slice(0,700)}`),{status:r.status,provider:'openai'});throw e;}
  const d=JSON.parse(raw),txt=(d.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||'').join('\n')||d.output_text||'';
  return JSON.parse(stripJsonFence(txt));
}
async function anthropicAnalyze(env,imageDataUrl,context){
  if(!env.ANTHROPIC_API_KEY)throw Object.assign(new Error('ANTHROPIC_API_KEY is not configured'),{status:503,provider:'anthropic'});
  const {mime,base64}=parseDataUrlParts(imageDataUrl);if(!AI_IMAGE_MIMES.has(mime))throw Object.assign(new Error(`Claude image MIME ${mime} is not supported by this pipeline`),{status:415,provider:'anthropic'});
  const model=env.ANTHROPIC_MODEL||'claude-sonnet-5',prompt=analysisPrompt(context);
  const body={model,max_tokens:6000,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:mime,data:base64}},{type:'text',text:prompt}]}]};
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify(body)});
  const raw=await r.text();if(!r.ok){const e=Object.assign(new Error(`Anthropic ${r.status}: ${raw.slice(0,700)}`),{status:r.status,provider:'anthropic'});throw e;}
  const d=JSON.parse(raw),txt=(d.content||[]).filter(x=>x.type==='text').map(x=>x.text||'').join('\n');
  return JSON.parse(stripJsonFence(txt));
}
function providers(env){return [
  {id:'auto',configured:Boolean(env.ANTHROPIC_API_KEY||env.OPENAI_API_KEY),model:'router',enabled:Boolean(env.ANTHROPIC_API_KEY||env.OPENAI_API_KEY),note:'Routes by AI_PROVIDER_ORDER and falls back on provider errors.'},
  {id:'anthropic',configured:Boolean(env.ANTHROPIC_API_KEY),model:env.ANTHROPIC_MODEL||'claude-sonnet-5',enabled:Boolean(env.ANTHROPIC_API_KEY),note:'Claude Vision via Anthropic Messages API.'},
  {id:'openai',configured:Boolean(env.OPENAI_API_KEY),model:env.OPENAI_MODEL||'gpt-5.6-luna',enabled:Boolean(env.OPENAI_API_KEY),note:'OpenAI multimodal via Responses API.'},
  {id:'gemini',configured:Boolean(env.GEMINI_API_KEY),model:env.GEMINI_MODEL||'',enabled:false,note:'Reserved provider slot.'}
];}
function providerOrder(env,requested='auto'){
  if(requested&&requested!=='auto')return [requested];
  const order=String(env.AI_PROVIDER_ORDER||'anthropic,openai').split(',').map(x=>x.trim()).filter(Boolean);
  return [...new Set(order)].filter(p=>(p==='anthropic'&&env.ANTHROPIC_API_KEY)||(p==='openai'&&env.OPENAI_API_KEY));
}
async function analyzeWithProvider(env,provider,imageDataUrl,context){if(provider==='anthropic')return anthropicAnalyze(env,imageDataUrl,context);if(provider==='openai')return openAIAnalyze(env,imageDataUrl,context);throw Object.assign(new Error(`Provider ${provider} is not enabled`),{status:503,provider});}
const OUTPUT_PROFILES=[
  {id:'mohsen_techpack',label:'MOHSEN Tech Pack — المتفق عليه',group:'TECHNICAL',feature:'OUTPUT_TECHNICAL'},
  {id:'technical_a4',label:'A4 Technical B/W — باترون/تنفيذ',group:'TECHNICAL',feature:'OUTPUT_TECHNICAL'},
  {id:'pattern_cutting',label:'Pattern & Cutting Sheet — المقص',group:'TECHNICAL',feature:'OUTPUT_TECHNICAL'},
  {id:'factory_supervisor',label:'Factory Supervisor Pack — تشغيل/QC',group:'TECHNICAL',feature:'OUTPUT_TECHNICAL'},
  {id:'management',label:'Management Product Book — إداري',group:'MANAGEMENT',feature:'OUTPUT_MANAGEMENT'},
  {id:'poster_pro_landscape',label:'Professional Poster — Landscape',group:'MARKETING',feature:'OUTPUT_MARKETING'},
  {id:'poster_pro_portrait',label:'Professional Poster — Portrait',group:'MARKETING',feature:'OUTPUT_MARKETING'},
  {id:'social_square',label:'Social Square — 1:1',group:'MARKETING',feature:'OUTPUT_MARKETING'},
  {id:'story_vertical',label:'Story — 9:16',group:'MARKETING',feature:'OUTPUT_MARKETING'}
];
function profileInfo(id){return OUTPUT_PROFILES.find(x=>x.id===id)||OUTPUT_PROFILES[0];}
function safeJson(v,fallback={}){try{return JSON.parse(v||'{}')}catch{return fallback}}
function imgTag(a,cls='hero'){return a?`<img class="${cls}" src="${assetUrl(a)}">`:''}
function tableRows(items,cells){return items.map(x=>`<tr>${cells.map(fn=>`<td>${fn(x)}</td>`).join('')}</tr>`).join('')}
async function outputPage(env,snap,profile){
  const p=profileInfo(profile),s=snap.style,org=await q1(env,'SELECT * FROM organizations WHERE id=?',s.org_id),creator=await q1(env,'SELECT display_name,email FROM users WHERE id=?',s.created_by),brand=safeJson(org?.brand_json,{});
  const primary=brand.primary||'#342116',accent=brand.accent||'#b7934c',paper=brand.paper||'#f7f1e8';
  const brandName=org?.name||'SEHHA ApparelOS',phones=brand.phones||((org?.code==='MOHSEN')?'01018151295 · 01112066657':''),address=brand.address||((org?.code==='MOHSEN')?'المطبعة - الهرم - آخر شارع المحولات':''),designer=creator?.display_name||'—';
  const hero=snap.assets.find(a=>a.id===s.hero_asset_id)||snap.assets.find(a=>a.role==='HERO')||snap.assets[0],technical=snap.assets.find(a=>a.role==='TECHNICAL'),details=snap.assets.filter(a=>['DETAIL','FRONT','BACK','SIDE','FABRIC','ARTWORK','REFERENCE'].includes(a.role)).slice(0,6);
  const dna=snap.dna.map(d=>`<div class="spec"><b>${esc(d.field_label)}</b><span>${esc(d.value_text||'—')}</span><small>${esc(d.provenance)}</small></div>`).join('');
  const mrows=tableRows(snap.measurements,[x=>esc(x.code),x=>esc(x.name),x=>`${x.value??'—'} ${esc(x.unit||'')}`,x=>esc(x.state)]),brows=tableRows(snap.bom,[x=>esc(x.code),x=>esc(x.name),x=>esc(x.specification||''),x=>esc(x.status)]),orows=tableRows(snap.operations,[x=>esc(x.seq),x=>esc(x.name),x=>esc(x.machine||''),x=>esc(x.stitch||''),x=>esc(x.qc_point||'')]),prows=tableRows(snap.patternPieces||[],[x=>esc(x.code),x=>esc(x.name),x=>esc(x.qty??'—'),x=>esc(x.note||''),x=>esc(x.state||'')]);
  const detailImgs=details.map(a=>`<figure>${imgTag(a,'detail')}<figcaption>${esc(a.role)}</figcaption></figure>`).join('');
  const topMeta=`<div class="meta"><div><span>MODEL CODE</span><b>${esc(s.code)}</b></div><div><span>PRODUCT</span><b>${esc(s.name)}</b></div><div><span>BASE</span><b>${esc(s.base_size||'—')}</b></div><div><span>STATUS</span><b>${esc(s.status)}</b></div></div>`;
  const measurementSection=`<section class="box"><h2>Measurements / POM</h2><table><tr><th>Code</th><th>القياس</th><th>القيمة</th><th>الحالة</th></tr>${mrows}</table></section>`;
  const bomSection=`<section class="box"><h2>BOM / الخامات والمستلزمات</h2><table><tr><th>Code</th><th>البند</th><th>المواصفة</th><th>الحالة</th></tr>${brows}</table></section>`;
  const tables=measurementSection+bomSection;
  const pattern=`<section class="box"><h2>Pattern Architecture / أجزاء الباترون</h2><table><tr><th>Code</th><th>القطعة</th><th>Qty</th><th>ملاحظة</th><th>الحالة</th></tr>${prows||'<tr><td colspan="5">لم تُعتمد قطع الباترون بعد.</td></tr>'}</table></section>`;
  const operations=`<section class="box"><h2>Operation Bulletin / مراحل التشغيل</h2><table><tr><th>#</th><th>العملية</th><th>الماكينة</th><th>الغرزة</th><th>QC</th></tr>${orows}</table></section>`;
  const head=`<header><div class="identity"><div class="brand">${esc(brandName)}</div><div>${esc(brand.subtitle||'Fashion Designer / Apparel Product Workspace')}</div></div><div class="contacts"><b>${esc(designer)}</b><br>${esc(phones)}<br>${esc(address)}</div><div class="codebox">${esc(s.code)}</div></header>`;
  let body='';
  if(profile==='technical_a4')body=`${head}${topMeta}<main class="twocol bw"><div><section class="box visual">${imgTag(technical||hero,'hero contain')}<h2>Technical View</h2></section>${pattern}</div><div>${tables}${operations}</div></main>`;
  else if(profile==='pattern_cutting')body=`${head}${topMeta}<main class="twocol bw"><div><section class="box visual">${imgTag(technical||hero,'hero contain')}<h2>Pattern / Cutting Reference</h2></section>${pattern}</div><div>${tables}<section class="box"><h2>Cutting Notes</h2><p>Grainline / Fold / Mirror / Nap direction / Matching points تُراجع من الباترون والعينة المعتمدة. لا تُحوّل استنتاجات AI إلى قص كمي قبل الاعتماد.</p></section></div></main>`;
  else if(profile==='factory_supervisor')body=`${head}${topMeta}<main class="twocol"><div>${imgTag(hero,'hero')}<section class="box"><h2>Garment DNA</h2><div class="specgrid">${dna}</div></section>${tables}</div><div>${operations}${pattern}<section class="box"><h2>QC Gate</h2><ul>${snap.operations.filter(x=>x.qc_point).map(x=>`<li>${esc(x.qc_point)}</li>`).join('')}</ul></section></div></main>`;
  else if(profile==='management')body=`${head}${topMeta}<main class="management"><section class="heroWrap">${imgTag(hero,'hero')}</section><section class="box"><h1>${esc(s.name)}</h1><div class="specgrid">${dna}</div><h2>Visual Assets</h2><div class="detailgrid">${detailImgs}</div><h2>Development History</h2><ol>${(snap.versions||[]).map(v=>`<li>V${v.version_no} — ${esc(v.label)} — ${esc(v.created_at)}</li>`).join('')||'<li>Working draft</li>'}</ol></section></main>`;
  else if(profile==='poster_pro_landscape'||profile==='poster_pro_portrait'||profile==='social_square'||profile==='story_vertical'){
    const measurementCards=snap.measurements.slice(0,6).map(m=>`<div class="mcard"><b>${esc(m.name)}</b><strong>${m.value??'—'} ${esc(m.unit||'')}</strong></div>`).join('');
    body=`${head}<main class="poster"><section class="posterHero">${imgTag(hero,'hero')}</section><section class="posterInfo"><div class="kicker">${esc(s.garment_type)} · ${esc(s.sizing_mode)} ${esc(s.base_size||'')}</div><h1>${esc(s.name)}</h1><div class="specgrid">${dna}</div><div class="measurecards">${measurementCards}</div><div class="detailgrid">${detailImgs}</div><div class="posterFooter"><b>SEHHA ApparelOS</b> · Product Intelligence Engine</div></section></main>`;
  } else {
    body=`${head}${topMeta}<section class="cover page"><div class="coverHero">${imgTag(hero,'hero')}</div><div class="coverText"><div class="eyebrow">TECH PACK / PRODUCT DEVELOPMENT FILE</div><h1>${esc(s.name)}</h1><h3>${esc(s.garment_type)} · ${esc(s.status)}</h3><div class="specgrid">${dna}</div></div></section><section class="page">${head}<h1 class="sectionTitle">01 — الرسم الفني وتحليل البناء</h1><div class="twocol"><section class="box visual">${imgTag(technical||hero,'hero contain')}</section><section class="box"><h2>Construction / Garment DNA</h2><div class="specgrid">${dna}</div><h2>تفاصيل مرئية</h2><div class="detailgrid">${detailImgs}</div></section></div></section><section class="page">${head}<h1 class="sectionTitle">02 — القياسات والباترون</h1><div class="twocol"><div>${tables}</div><div>${pattern}<section class="box"><h2>Production Lock Rule</h2><p>أي قيمة AI غير مؤكدة تظل AI_DRAFT ولا تدخل Production Locked Pack حتى تعتمد من المصمم/الباترون.</p></section></div></div></section><section class="page">${head}<h1 class="sectionTitle">03 — الخامات والتشغيل والجودة</h1><div class="twocol"><div>${bomSection}<section class="box"><h2>QC / نقاط المراجعة</h2><ul>${snap.operations.filter(x=>x.qc_point).map(x=>`<li>${esc(x.qc_point)}</li>`).join('')||'<li>Pending</li>'}</ul></section></div><div>${operations}</div></div></section>`;
  }
  const pageSize=profile==='poster_pro_landscape'?'A3 landscape':profile==='social_square'?'210mm 210mm':profile==='story_vertical'?'108mm 192mm':'A4';
  const portrait=profile==='poster_pro_portrait';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.code)} — ${esc(p.label)}</title><style>@page{size:${pageSize};margin:${profile.startsWith('poster_')||profile==='social_square'||profile==='story_vertical'?'0':'7mm'}}:root{--brand:${primary};--accent:${accent};--paper:${paper}}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#231c18;margin:0;background:#e9e5df}.sheet{background:#fff;min-height:100vh;padding:${profile.startsWith('poster_')||profile==='social_square'||profile==='story_vertical'?'0':'6mm'};max-width:${portrait?'210mm':'none'};margin:auto}header{height:22mm;background:var(--brand);color:#fff;display:grid;grid-template-columns:1.2fr 1fr 35mm;align-items:center;gap:10px;padding:4mm 6mm}.brand{font-family:Georgia,serif;font-size:24px;font-weight:800;letter-spacing:1px}.identity div:last-child{font-size:11px;opacity:.85}.contacts{font-size:10px;line-height:1.6;text-align:center}.codebox{background:var(--paper);color:var(--brand);border-radius:4px;padding:4mm;text-align:center;font-size:20px;font-weight:900}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin:3mm 0}.meta div{border:1px solid #bcae9f;background:#fbf8f3;padding:2.5mm;text-align:center}.meta span{display:block;font-size:8px;color:#75685d}.meta b{font-size:11px}.twocol{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.box{border:1px solid #b7aa9e;background:#fff;padding:3mm;margin-bottom:3mm;break-inside:avoid}.box h2,.sectionTitle{margin:0 0 2mm;background:#746150;color:#fff;padding:2mm 3mm;font-size:13px}.hero{width:100%;height:100%;object-fit:cover}.contain{object-fit:contain;background:#fff}.visual{min-height:90mm}.specgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:2mm}.spec{border-bottom:1px solid #ddd;padding:1.5mm}.spec b,.spec span,.spec small{display:block}.spec b{font-size:9px}.spec span{font-size:11px}.spec small{font-size:7px;color:#777}table{width:100%;border-collapse:collapse;font-size:8.5px}td,th{border:1px solid #bdb6af;padding:1.5mm;vertical-align:top}th{background:#f2eee8}.detailgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}.detailgrid figure{margin:0;border:1px solid #d3c8bd;background:#fff}.detail{width:100%;height:38mm;object-fit:cover}.detailgrid figcaption{font-size:7px;padding:1mm}.page{background:#fff;min-height:280mm;page-break-after:always;padding:0}.cover{display:grid;grid-template-columns:1.05fr .95fr;gap:6mm;align-items:stretch}.coverHero .hero{height:250mm}.coverText{padding:22mm 6mm 6mm}.coverText h1{font-size:30px}.eyebrow{color:var(--accent);font-weight:800;letter-spacing:1px}.management{display:grid;grid-template-columns:1.05fr .95fr;gap:4mm}.heroWrap{min-height:235mm}.bw{filter:grayscale(1)}.poster{display:grid;grid-template-columns:1.05fr .95fr;min-height:100vh;background:var(--paper)}.posterHero{min-height:100vh}.posterInfo{padding:11mm;background:linear-gradient(180deg,#fff,var(--paper));display:flex;flex-direction:column;gap:5mm}.posterInfo h1{font-size:32px;margin:0;color:var(--brand)}.kicker{font-size:12px;font-weight:800;color:var(--accent)}.measurecards{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}.mcard{background:#fff;border:1px solid #cfbca8;border-radius:3px;padding:3mm}.mcard b,.mcard strong{display:block}.mcard b{font-size:9px}.mcard strong{font-size:16px;color:#bd342a}.posterFooter{margin-top:auto;border-top:2px solid var(--brand);padding-top:3mm}.print{position:fixed;left:12px;top:12px;z-index:9;border:0;border-radius:8px;background:#111;color:white;padding:9px 14px;cursor:pointer}@media print{body{background:#fff}.sheet{padding:0}.print{display:none}}@media(max-width:800px){.twocol,.management,.poster,.cover{grid-template-columns:1fr}.posterHero{min-height:50vh}.detailgrid{grid-template-columns:repeat(2,1fr)}}</style></head><body><button class="print" onclick="print()">Print / Save PDF</button><div class="sheet">${body}</div></body></html>`;
}
async function apiRoute(request,env){
  const url=new URL(request.url),p=url.pathname;
  if(p==='/api/health'){const db=await databaseState(env);return json({ok:db.ready,product:PRODUCT,version:VERSION,platform:'Cloudflare Workers',storage:'D1 + R2',licenseMode:env.LICENSE_MODE||'development',ai:providers(env),bootstrapReady:Boolean(env.SESSION_SECRET&&env.DEV_BOOTSTRAP_PASSWORD&&env.MOHSEN_BOOTSTRAP_PASSWORD),dbReady:db.ready,schemaVersion:db.schemaVersion,expectedSchemaVersion:SCHEMA_VERSION,seeded:db.seeded,dbError:db.ready?null:db.error,missingSecrets:['SESSION_SECRET','DEV_BOOTSTRAP_PASSWORD','MOHSEN_BOOTSTRAP_PASSWORD'].filter(k=>!env[k])},db.ready?200:503);}
  if(p==='/api/auth/login'&&request.method==='POST'){const b=await requestBody(request),u=await q1(env,'SELECT * FROM users WHERE email=? AND active=1',String(b.email||'').toLowerCase());if(!u||!(await verifyPassword(String(b.password||''),u.password_salt,u.password_hash)))return errorJson('Invalid credentials',401);const token=await signSession({userId:u.id,platformAdmin:Boolean(u.is_platform_admin),exp:Date.now()+12*60*60*1000},sessionSecret(env));return json({ok:true},200,{'set-cookie':`sehha_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`});}
  if(p==='/api/auth/logout'&&request.method==='POST')return json({ok:true},200,{'set-cookie':'sehha_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'});
  if(p==='/api/me'){const s=await requireAuth(request,env),u=await q1(env,'SELECT id,email,display_name,is_platform_admin FROM users WHERE id=?',s.userId);return json({user:u,workspaces:await memberships(env,s.userId)});}
  if(p==='/api/ai/providers'){await requireAuth(request,env);return json({providers:providers(env)});}
  if(p==='/api/output-profiles'){await requireAuth(request,env);return json({profiles:OUTPUT_PROFILES});}
  if(p.startsWith('/api/workspaces/')&&p.endsWith('/entitlements')){const s=await requireAuth(request,env),orgId=p.split('/')[3];await requireOrg(env,s,orgId);return json({items:await entitlements(env,orgId)});}
  if(p==='/api/styles'&&request.method==='GET'){const s=await requireAuth(request,env),orgId=url.searchParams.get('orgId');if(!orgId)throw Object.assign(new Error('orgId required'),{status:400});await requireOrg(env,s,orgId);return json({items:await qall(env,`SELECT s.*, (SELECT stored_name FROM assets a WHERE a.id=s.hero_asset_id) hero_stored_name FROM styles s WHERE org_id=? ORDER BY updated_at DESC`,orgId)});}
  if(p==='/api/styles'&&request.method==='POST'){const s=await requireAuth(request,env),b=await requestBody(request);await requireOrg(env,s,b.orgId);await requireFeature(env,b.orgId,'STYLE_CORE');const id=randomId('sty_'),ts=now();await run(env,'INSERT INTO styles(id,org_id,code,name,garment_type,audience,sizing_mode,base_size,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',id,b.orgId,b.code,b.name,b.garmentType||'CUSTOM',b.audience||'UNSPECIFIED',b.sizingMode||'STANDARD',b.baseSize||null,'DRAFT',s.userId,ts,ts);await audit(env,b.orgId,s.userId,'STYLE',id,'CREATE',{code:b.code});return json({id},201);}
  const sm=p.match(/^\/api\/styles\/([^/]+)$/);if(sm&&request.method==='GET'){const s=await requireAuth(request,env),snap=await styleSnapshot(env,sm[1]);if(!snap)return errorJson('Style not found',404);await requireOrg(env,s,snap.style.org_id);return json(snap);}if(sm&&request.method==='PATCH'){const s=await requireAuth(request,env),b=await requestBody(request),st=await q1(env,'SELECT * FROM styles WHERE id=?',sm[1]);if(!st)return errorJson('Style not found',404);await requireOrg(env,s,st.org_id);const map={name:'name',garment_type:'garment_type',audience:'audience',sizing_mode:'sizing_mode',base_size:'base_size',status:'status'};const sets=[],vals=[];for(const k of Object.keys(map))if(k in b){sets.push(map[k]+'=?');vals.push(b[k]);}sets.push('updated_at=?');vals.push(now(),st.id);await env.DB.prepare(`UPDATE styles SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();await audit(env,st.org_id,s.userId,'STYLE',st.id,'UPDATE',b);return json({ok:true});}
  const am=p.match(/^\/api\/styles\/([^/]+)\/assets$/);if(am&&request.method==='POST'){const s=await requireAuth(request,env),b=await requestBody(request),st=await q1(env,'SELECT * FROM styles WHERE id=?',am[1]);if(!st)return errorJson('Style not found',404);await requireOrg(env,s,st.org_id);await requireFeature(env,st.org_id,'ASSET_UPLOAD');const d=decodeDataUrl(b.dataUrl);if(!d.mime.startsWith('image/'))throw Object.assign(new Error('Only images supported'),{status:400});const id=randomId('ast_'),stored=id+extForMime(d.mime);await env.UPLOADS.put(stored,d.bytes,{httpMetadata:{contentType:d.mime},customMetadata:{styleId:st.id,role:b.role||'REFERENCE'}});await run(env,'INSERT INTO assets(id,style_id,role,filename,stored_name,mime_type,source_kind,rights_status,created_at) VALUES(?,?,?,?,?,?,?,?,?)',id,st.id,b.role||'REFERENCE',b.filename||stored,stored,d.mime,b.sourceKind||'USER_UPLOAD',b.rightsStatus||'USER_ASSERTED',now());if(b.role==='HERO'||!st.hero_asset_id)await run(env,'UPDATE styles SET hero_asset_id=?,updated_at=? WHERE id=?',id,now(),st.id);await audit(env,st.org_id,s.userId,'ASSET',id,'UPLOAD',{role:b.role,filename:b.filename});return json({id,url:'/uploads/'+stored},201);}
  const aim=p.match(/^\/api\/styles\/([^/]+)\/ai-analyze$/);if(aim&&request.method==='POST'){
    const s=await requireAuth(request,env),b=await requestBody(request),st=await q1(env,'SELECT * FROM styles WHERE id=?',aim[1]);if(!st)return errorJson('Style not found',404);await requireOrg(env,s,st.org_id);await requireFeature(env,st.org_id,'AI_ANALYSIS');
    const a=await q1(env,'SELECT * FROM assets WHERE id=? AND style_id=?',b.assetId,st.id);if(!a)throw Object.assign(new Error('Asset not found'),{status:404});if(!AI_IMAGE_MIMES.has((a.mime_type||'').toLowerCase()))throw Object.assign(new Error(`الصورة المخزنة بصيغة ${a.mime_type||'غير معروفة'} غير مدعومة للتحليل. أعد رفعها كـ JPEG/PNG/WebP/GIF.`),{status:415});
    let bytes;if(a.source_kind==='STATIC_DEMO'){const r=await env.STATIC.fetch(new URL('/demo_jk001_reference.png',request.url));bytes=new Uint8Array(await r.arrayBuffer());}else{const o=await env.UPLOADS.get(a.stored_name);if(!o)throw new Error('Stored image missing');bytes=new Uint8Array(await o.arrayBuffer());}
    let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));const dataUrl=`data:${a.mime_type};base64,${btoa(bin)}`,requested=b.provider||'auto',order=providerOrder(env,requested);if(!order.length)throw Object.assign(new Error('لا يوجد AI Provider مهيأ. أضف ANTHROPIC_API_KEY أو OPENAI_API_KEY.'),{status:503});
    const attempts=[];for(const provider of order){const model=provider==='anthropic'?(env.ANTHROPIC_MODEL||'claude-sonnet-5'):(env.OPENAI_MODEL||'gpt-5.6-luna'),runId=randomId('air_');await run(env,'INSERT INTO ai_runs(id,org_id,style_id,asset_id,provider,model,status,request_kind,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',runId,st.org_id,st.id,a.id,provider,model,'RUNNING','GARMENT_ANALYSIS',s.userId,now());try{const result=await analyzeWithProvider(env,provider,dataUrl,{styleCode:st.code,styleName:st.name,garmentType:st.garment_type,audience:st.audience,sizingMode:st.sizing_mode});await run(env,'UPDATE ai_runs SET status=?,output_json=? WHERE id=?','COMPLETED',JSON.stringify(result),runId);await audit(env,st.org_id,s.userId,'AI_RUN',runId,'ANALYZE',{assetId:a.id,provider,requested});return json({runId,provider,model,attempts,result});}catch(e){attempts.push({provider,status:Number(e.status)||500,error:String(e.message||e).slice(0,500)});await run(env,'UPDATE ai_runs SET status=?,error_text=? WHERE id=?','FAILED',String(e.message||e),runId);if(requested!=='auto')throw e;}}
    throw Object.assign(new Error('فشل كل مزودي الذكاء المتاحين: '+attempts.map(x=>`${x.provider}(${x.status})`).join(', ')),{status:502});
  }
  const ap=p.match(/^\/api\/styles\/([^/]+)\/apply-ai$/);if(ap&&request.method==='POST'){
    const s=await requireAuth(request,env),b=await requestBody(request),st=await q1(env,'SELECT * FROM styles WHERE id=?',ap[1]);if(!st)return errorJson('Style not found',404);await requireOrg(env,s,st.org_id);const ts=now(),r=b.result||b;
    const features=[...(r.features||[])];if(r.garment){for(const [k,v] of Object.entries(r.garment))if(v!==''&&v!==null&&v!==false)features.push({key:`garment_${k}`,label:`Garment ${k}`,value:String(v),confidence:null,provenance:'INFERRED'});}if(r.materialAppearance){for(const [k,v] of Object.entries(r.materialAppearance))if(v&&v!=='UNKNOWN')features.push({key:`material_${k}`,label:`Material ${k}`,value:String(v),confidence:null,provenance:'INFERRED'});}
    let dnaCount=0;for(const f of features){if(!f.key||f.value===undefined||f.value===null||f.value===''||f.provenance==='UNKNOWN')continue;await run(env,`INSERT INTO dna_items(id,style_id,field_key,field_label,value_text,provenance,confidence,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(style_id,field_key) DO UPDATE SET field_label=excluded.field_label,value_text=excluded.value_text,provenance=excluded.provenance,confidence=excluded.confidence,state=CASE WHEN dna_items.state='LOCKED' OR dna_items.state='APPROVED' THEN dna_items.state ELSE 'AI_DRAFT' END,updated_at=excluded.updated_at`,randomId('dna_'),st.id,f.key,f.label||f.key,String(f.value),f.provenance||'INFERRED',Number.isFinite(Number(f.confidence))?Number(f.confidence):null,'AI_DRAFT',ts,ts);dnaCount++;}
    let pomCount=0;for(const x of (r.suggestedPOM||[])){if(!x.code||!x.name)continue;await run(env,`INSERT OR IGNORE INTO measurements(id,style_id,code,name,value,unit,method,provenance,state,sort_order) VALUES(?,?,?,?,NULL,'cm',?,'AI_INFERRED','AI_DRAFT',?)`,randomId('pom_'),st.id,String(x.code).slice(0,20),x.name,x.reason||'',100+pomCount);pomCount++;}
    let patternCount=0;for(const x of (r.suggestedPatternArchitecture||[])){if(!x.code||!x.name)continue;await run(env,`INSERT OR IGNORE INTO pattern_pieces(id,style_id,code,name,qty,note,provenance,state,sort_order) VALUES(?,?,?,?,?,?, 'AI_INFERRED','AI_DRAFT',?)`,randomId('pat_'),st.id,String(x.code).slice(0,20),x.name,x.qty==null?null:Number(x.qty),x.note||'',patternCount++);}
    let opCount=0;for(const x of (r.suggestedOperations||[])){if(!x.name)continue;const seq=Number(x.seq)||opCount+1;await run(env,`INSERT OR IGNORE INTO operations(id,style_id,seq,name,description,machine,stitch,qc_point,provenance,state) VALUES(?,?,?,?,?,?,?,?, 'AI_INFERRED','AI_DRAFT')`,randomId('op_'),st.id,seq,x.name,'AI suggested operation',x.machine||'',x.stitch||'',x.qc||'');opCount++;}
    let trimCount=0;for(const x of (r.trims||[])){if(!x.name||x.provenance==='UNKNOWN')continue;const code=`AI-T${String(++trimCount).padStart(2,'0')}`;await run(env,`INSERT OR IGNORE INTO bom_items(id,style_id,code,category,name,specification,qty,unit,status,provenance,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,randomId('bom_'),st.id,code,'TRIM',x.name,`AI ${x.provenance||'INFERRED'}; requires confirmation`,x.count==null?null:Number(x.count),'unit','AI_DRAFT','AI_INFERRED',100+trimCount);}
    await audit(env,st.org_id,s.userId,'STYLE',st.id,'APPLY_AI',{dnaCount,pomCount,patternCount,opCount,trimCount});return json({ok:true,dnaCount,pomCount,patternCount,opCount,trimCount});
  }
  const vm=p.match(/^\/api\/styles\/([^/]+)\/versions$/);if(vm&&request.method==='POST'){const s=await requireAuth(request,env),b=await requestBody(request),snap=await styleSnapshot(env,vm[1]);if(!snap)return errorJson('Style not found',404);await requireOrg(env,s,snap.style.org_id);await requireFeature(env,snap.style.org_id,'VERSIONS');const last=await q1(env,'SELECT MAX(version_no) n FROM style_versions WHERE style_id=?',snap.style.id),n=Number(last?.n||0)+1,id=randomId('ver_');await run(env,'INSERT INTO style_versions(id,style_id,version_no,label,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?)',id,snap.style.id,n,b.label||`V${n}`,JSON.stringify(snap),s.userId,now());await audit(env,snap.style.org_id,s.userId,'VERSION',id,'CREATE',{version:n});return json({id,versionNo:n},201);}
  if(p==='/api/audit'){const s=await requireAuth(request,env),orgId=url.searchParams.get('orgId');await requireOrg(env,s,orgId);return json({items:await qall(env,'SELECT * FROM audit_log WHERE org_id=? ORDER BY id DESC LIMIT 200',orgId)});}
  const om=p.match(/^\/api\/styles\/([^/]+)\/output$/);if(om&&request.method==='GET'){const s=await requireAuth(request,env),snap=await styleSnapshot(env,om[1]);if(!snap)return errorJson('Style not found',404);await requireOrg(env,s,snap.style.org_id);const profile=url.searchParams.get('profile')||'mohsen_techpack',info=profileInfo(profile);await requireFeature(env,snap.style.org_id,info.feature);return html(await outputPage(env,snap,profile));}
  return null;
}

async function uploadRoute(request,env){const url=new URL(request.url),key=decodeURIComponent(url.pathname.slice('/uploads/'.length));if(!key)return errorJson('Not found',404);const o=await env.UPLOADS.get(key);if(o){const h=new Headers();o.writeHttpMetadata(h);h.set('etag',o.httpEtag);h.set('cache-control','private, max-age=3600');return new Response(o.body,{headers:h});}if(key==='demo_jk001_reference.png')return env.STATIC.fetch(new URL('/demo_jk001_reference.png',request.url));return errorJson('Asset not found',404);}

export default {async fetch(request,env){try{const p=new URL(request.url).pathname;if(p==='/api/health'){const r=await apiRoute(request,env);return r||errorJson('API route not found',404);}if(p.startsWith('/api/')){await ensureDatabaseReady(env);const r=await apiRoute(request,env);return r||errorJson('API route not found',404);}if(p.startsWith('/uploads/'))return uploadRoute(request,env);return env.STATIC.fetch(request);}catch(e){console.error(e);return errorJson(String(e.message||e),Number(e.status)||500);}}};
