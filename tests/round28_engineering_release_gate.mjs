import {makeHarness,ok,seedEngineeringReady} from './test_helpers.mjs';
const {call,login,db,env}=makeHarness();await login();let x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN');
x=await call('/api/styles',{method:'POST',body:{orgId:org.id,code:'ENG-GATE-028',name:'Engineering Gate Test',garmentType:'JACKET',audience:'WOMEN',sizingMode:'STANDARD',baseSize:'M'}});const id=x.data.id;
await call(`/api/styles/${id}/measurements`,{method:'POST',body:{code:'A',name:'طول',nameEn:'Length',value:57,tolerancePlus:1,toleranceMinus:1,state:'LOCKED',provenance:'USER_CONFIRMED'}});
await call(`/api/styles/${id}/bom`,{method:'POST',body:{code:'B01',category:'SHELL',name:'قماش',nameEn:'Fabric',specification:'Approved shell',specificationEn:'Approved shell',qty:1.8,unit:'m',status:'APPROVED',provenance:'USER_CONFIRMED'}});
await call(`/api/styles/${id}/patterns`,{method:'POST',body:{code:'P01',name:'أمام',nameEn:'Front',qty:2,grainline:'STRAIGHT',state:'APPROVED',provenance:'USER_CONFIRMED'}});
await call(`/api/styles/${id}/patterns`,{method:'POST',body:{code:'P02',name:'خلف',nameEn:'Back',qty:1,grainline:'STRAIGHT',state:'APPROVED',provenance:'USER_CONFIRMED'}});
await call(`/api/styles/${id}/pattern-links`,{method:'POST',body:{fromCode:'P01',toCode:'P02',relation:'SEAM_JOIN',label:'Side seam',labelEn:'Side seam',state:'APPROVED',provenance:'USER_CONFIRMED'}});
await call(`/api/styles/${id}/operations`,{method:'POST',body:{seq:1,name:'تجميع',nameEn:'Assembly',description:'Approved',descriptionEn:'Approved',machine:'SN',stitch:'301',qcPoint:'مطابقة',qcPointEn:'Match',state:'APPROVED',provenance:'USER_CONFIRMED'}});
x=await call(`/api/styles/${id}/versions`,{method:'POST',body:{label:'Production Candidate'}});ok(x.r.status===201&&x.data.versionNo===1,'production candidate version created');
x=await call(`/api/styles/${id}/samples`,{method:'POST',body:{versionNo:1,sampleType:'PP'}});const sid=x.data.sample.id;await call(`/api/styles/${id}/samples/${sid}/measurements/A`,{method:'PATCH',body:{actualValue:57}});
x=await call(`/api/styles/${id}/cost-sheets`,{method:'POST',body:{versionNo:1,name:'V1 Cost',currency:'EGP',laborCost:100,overheadPct:10}});const cid=x.data.id;await call(`/api/styles/${id}/cost-sheets/${cid}/lines`,{method:'POST',body:{description:'Fabric',qty:1.8,unit:'m',unitCost:150}});
await call(`/api/styles/${id}/samples/${sid}/status`,{method:'PATCH',body:{status:'APPROVED'}});await call(`/api/styles/${id}/cost-sheets/${cid}/approve`,{method:'POST',body:{}});
const releases=()=>db.prepare('SELECT COUNT(*) n FROM style_releases WHERE style_id=?').get(id).n,styleStatus=()=>db.prepare('SELECT status FROM styles WHERE id=?').get(id).status;
// 1. Legacy release gate is satisfied, but engineering readiness is empty -> production release must be refused atomically.
x=await call(`/api/styles/${id}/release-gate?type=PRODUCTION`);ok(x.data.ready===true,'legacy production gate is ready (precondition)');
const before=styleStatus();
x=await call(`/api/styles/${id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:1}});
ok(x.r.status===409&&x.data.engineering?.status==='BLOCKED','production release refused when engineering readiness is BLOCKED');
ok(['FABRIC_UNAPPROVED','TRIMS_UNAPPROVED','PATTERN_UNAPPROVED','ROUTING_UNAPPROVED','MARKER_OR_CONSUMPTION_UNAPPROVED','QC_PLAN_MISSING'].every(c=>x.data.engineering.blockers.includes(c)),'refusal names the explicit engineering blockers');
ok(releases()===0&&styleStatus()===before,'refused release leaves no release row and does not change style status');
// 2. SAMPLE release is NOT subject to the production-only engineering gate.
x=await call(`/api/styles/${id}/releases`,{method:'POST',body:{releaseType:'SAMPLE',sourceVersionNo:1}});ok(x.r.status===201&&x.data.gate.engineering===undefined,'sample release is unaffected by engineering gate');
// 3. Each single missing domain still blocks (negative matrix).
for(const [skip,code] of [['fabric','FABRIC_UNAPPROVED'],['trim','TRIMS_UNAPPROVED'],['pattern','PATTERN_UNAPPROVED'],['marker','MARKER_OR_CONSUMPTION_UNAPPROVED'],['routing','ROUTING_UNAPPROVED']]){
  seedEngineeringReady(db,id,{skip:[skip]});x=await call(`/api/styles/${id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:1}});
  ok(x.r.status===409&&x.data.engineering.blockers.includes(code),`missing ${skip} blocks production release (${code})`);
  for(const t of ['fabric_specifications','trim_specifications','pattern_piece_specs','marker_plans','routing_steps'])db.prepare(`DELETE FROM ${t} WHERE style_id=?`).run(id);
}
// 4. An unapproved (DRAFT) record blocks even when all records exist.
seedEngineeringReady(db,id);db.prepare("UPDATE fabric_specifications SET state='DRAFT' WHERE style_id=?").run(id);
x=await call(`/api/styles/${id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:1}});ok(x.r.status===409&&x.data.engineering.blockers.includes('FABRIC_UNAPPROVED'),'DRAFT fabric blocks production release');
// 5. Fully ready -> release succeeds and freezes the engineering evidence.
db.prepare("UPDATE fabric_specifications SET state='APPROVED' WHERE style_id=?").run(id);
x=await call(`/api/styles/${id}/releases`,{method:'POST',body:{releaseType:'PRODUCTION',sourceVersionNo:1}});ok(x.r.status===201&&x.data.gate.engineering?.status==='ELIGIBLE_FOR_MANUAL_RELEASE_REVIEW','production release succeeds when engineering is eligible');
const relNo=x.data.releaseNo,row=db.prepare('SELECT gate_json,snapshot_json FROM style_releases WHERE style_id=? AND release_no=?').get(id,relNo);
ok(JSON.parse(row.gate_json).engineering?.basis==='LIVE_ENGINEERING_RECORDS'&&JSON.parse(row.snapshot_json).engineeringReadiness?.percent===100,'engineering readiness evidence is frozen in gate_json and snapshot');
// 6. Later working-record changes do not alter the frozen evidence.
db.prepare("UPDATE fabric_specifications SET state='DRAFT' WHERE style_id=?").run(id);
ok(JSON.parse(db.prepare('SELECT snapshot_json FROM style_releases WHERE style_id=? AND release_no=?').get(id,relNo).snapshot_json).engineeringReadiness.status==='ELIGIBLE_FOR_MANUAL_RELEASE_REVIEW','frozen evidence unchanged by later working edits');
// 7. Tenant isolation: a user outside the style's tenant cannot trigger the release path (no row, no status change).
x=await call('/api/auth/login',{method:'POST',body:{email:'mohsen@mohsen.local',password:env.MOHSEN_BOOTSTRAP_PASSWORD},cookieOverride:''});const mohsenCookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
const ts=new Date().toISOString();db.prepare('INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES(?,?,?,?,?)').run('org_other28','OTHER28','Other Org','{}',ts);db.prepare('INSERT INTO styles(id,org_id,code,name,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run('sty_other28','org_other28','OTHER-28','Other Style','u-none',ts,ts);
x=await call('/api/styles/sty_other28/releases',{method:'POST',body:{releaseType:'PRODUCTION'},cookieOverride:mohsenCookie});ok(x.r.status===403,'cross-tenant production release is refused');
ok(db.prepare("SELECT COUNT(*) n FROM style_releases WHERE style_id='sty_other28'").get().n===0,'cross-tenant attempt creates no release');
