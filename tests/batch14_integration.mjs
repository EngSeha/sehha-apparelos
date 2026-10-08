import {makeHarness,ok} from './test_helpers.mjs';
const {db,call,login}=makeHarness();await login();let x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN');
// create style with one size band + one colorway so planning matrix is required
x=await call('/api/styles',{method:'POST',body:{orgId:org.id,code:'PLAN-014',name:'Production Planning Test',garmentType:'JACKET',audience:'WOMEN',sizingMode:'STANDARD'}});const id=x.data.id;
const uid=db.prepare("SELECT id FROM users WHERE email='dev@sehha.local'").get().id,ts=new Date().toISOString();
db.prepare("INSERT INTO size_bands(id,style_id,code,name,band_mode,provenance,state,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run('sb_m',id,'M','Medium','STANDARD','USER_CONFIRMED','APPROVED',1,ts,ts);
db.prepare("INSERT INTO colorways(id,style_id,code,name,main_color,provenance,state,sort_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run('cw_blk',id,'BLACK','Black','#111111','USER_CONFIRMED','APPROVED',1,ts,ts);
// approved cost sheet with explicit per-unit fabric consumption
db.prepare("INSERT INTO cost_sheets(id,style_id,version_no,name,currency,status,labor_cost,overhead_pct,created_by,approved_by,created_at,updated_at,approved_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run('cs14',id,1,'Approved Consumption','EGP','APPROVED',25,10,uid,uid,ts,ts,ts);
db.prepare("INSERT INTO cost_lines(id,cost_sheet_id,source_type,source_ref,description,qty,unit,unit_cost,waste_pct,line_total,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('cl14','cs14','BOM','B01','Main fabric',1.8,'m',100,5,189,uid,uid,ts,ts);
// freeze a production release containing dimensions; version/source no 1 is enough for planning test
const frozen={style:{id,org_id:org.id,code:'PLAN-014',name:'Production Planning Test'},sizeBands:[{code:'M'}],colorways:[{code:'BLACK'}],measurements:[],bom:[],operations:[],patternPieces:[],patternLinks:[],requirements:[],assets:[],dna:[],gradingRules:[],annotations:[],samples:[],costSheets:[]};
db.prepare("INSERT INTO style_releases(id,style_id,release_no,release_type,status,source_version_no,template_key,gate_json,manifest_json,snapshot_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run('rel14',id,1,'PRODUCTION','RELEASED',1,'mohsen_nexz_20p','{}','{}',JSON.stringify(frozen),uid,ts);
x=await call(`/api/styles/${id}/production-lots`,{method:'POST',body:{releaseNo:1,lotCode:'LOT-PLAN',plannedQty:100}});ok(x.r.status===201,'production lot created with planned quantity');const lid=x.data.lot.id;
ok(x.data.planning.planningGate.ready===false&&x.data.planning.planningGate.blockers.some(b=>b.includes('breakdown')),'dimensioned release requires size/color breakdown');
x=await call(`/api/styles/${id}/production-lots/${lid}/release`,{method:'POST',body:{}});ok(x.r.status===409,'lot release blocked while production plan incomplete');
x=await call(`/api/styles/${id}/production-lots/${lid}/breakdown`,{method:'POST',body:{colorwayCode:'BAD',sizeCode:'M',qty:100}});ok(x.r.status===400,'unknown frozen colorway rejected');
x=await call(`/api/styles/${id}/production-lots/${lid}/breakdown`,{method:'POST',body:{colorwayCode:'BLACK',sizeCode:'M',qty:90}});ok(x.r.status===201&&x.data.planning.allocatedQty===90&&!x.data.planning.planningGate.ready,'partial allocation remains blocked');
x=await call(`/api/styles/${id}/production-lots/${lid}/breakdown`,{method:'POST',body:{colorwayCode:'BLACK',sizeCode:'M',qty:100}});ok(x.r.status===201&&x.data.planning.planningGate.ready,'allocation equal to planned qty is ready');
x=await call(`/api/styles/${id}/production-lots/${lid}/plan`);ok(x.r.status===200&&x.data.planning.materialBasis?.costSheetId==='cs14','material plan uses approved cost sheet basis');const mr=x.data.planning.materialRequirements.find(r=>r.sourceRef==='B01');ok(mr&&Math.abs(mr.netRequired-180)<1e-9&&Math.abs(mr.grossRequired-189)<1e-9,'material requirement uses explicit per-unit qty and waste only');
// Add QC, release, then ensure breakdown immutable
x=await call(`/api/styles/${id}/production-lots/${lid}/checks`,{method:'POST',body:{checkType:'FINAL',sampleSize:10,defectCount:0,status:'PASS'}});ok(x.r.status===201&&x.data.gate.ready,'QC + completed plan makes lot releasable');
x=await call(`/api/styles/${id}/production-lots/${lid}/release`,{method:'POST',body:{}});ok(x.r.status===200&&x.data.lot.status==='RELEASED','planned lot released');
x=await call(`/api/styles/${id}/production-lots/${lid}/breakdown`,{method:'POST',body:{colorwayCode:'BLACK',sizeCode:'M',qty:99}});ok(x.r.status===409,'released lot rejects planning mutation');
x=await call(`/api/audit?orgId=${org.id}`);ok(x.data.items.some(a=>a.entity_type==='PRODUCTION_LOT'&&a.action==='BREAKDOWN_UPSERT'),'production allocation changes are audited');
console.log('BATCH14_INTEGRATION_PASS');
