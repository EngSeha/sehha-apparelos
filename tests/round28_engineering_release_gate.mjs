// ROUND28 engineering readiness gate, re-based in ROUND29 on the frozen Style Version contract:
// readiness is evaluated on the engineering records captured into the released version, never on live tables.
import {makeHarness,ok,seedEngineeringReady} from './test_helpers.mjs';
import {buildReleaseCandidate,clearEngineering,newVersion} from './release_fixture.mjs';
const {call,login,db,env}=makeHarness();await login();let x=await call('/api/me');const org=x.data.workspaces.find(w=>w.code==='MOHSEN');
const id=await buildReleaseCandidate(call,org,'ENG-GATE-028');
const releases=()=>db.prepare('SELECT COUNT(*) n FROM style_releases WHERE style_id=?').get(id).n,styleStatus=()=>db.prepare('SELECT status FROM styles WHERE id=?').get(id).status;
const release=(v,type='PRODUCTION')=>call(`/api/styles/${id}/releases`,{method:'POST',body:{releaseType:type,sourceVersionNo:v}});
// 1. Legacy release gate is satisfied, but V1 froze no engineering records -> refused atomically.
x=await call(`/api/styles/${id}/release-gate?type=PRODUCTION`);ok(x.data.ready===true,'legacy production gate is ready (precondition)');
const before=styleStatus();x=await release(1);
ok(x.r.status===409&&x.data.code==='ENGINEERING_READINESS_BLOCKED'&&x.data.engineering?.status==='BLOCKED','production release refused when frozen engineering readiness is BLOCKED');
ok(['FABRIC_UNAPPROVED','TRIMS_UNAPPROVED','PATTERN_UNAPPROVED','ROUTING_UNAPPROVED','MARKER_OR_CONSUMPTION_UNAPPROVED','QC_PLAN_MISSING'].every(c=>x.data.engineering.blockers.includes(c)),'refusal names the explicit engineering blockers');
ok(releases()===0&&styleStatus()===before,'refused release leaves no release row and does not change style status');
// 2. SAMPLE release is not subject to the production-only engineering gate.
x=await release(1,'SAMPLE');ok(x.r.status===201&&x.data.gate.engineering===undefined,'sample release is unaffected by engineering gate');
// 3. Each single missing domain blocks, evaluated on a NEW version that froze exactly that state.
for(const [skip,code] of [['fabric','FABRIC_UNAPPROVED'],['trim','TRIMS_UNAPPROVED'],['pattern','PATTERN_UNAPPROVED'],['marker','MARKER_OR_CONSUMPTION_UNAPPROVED'],['routing','ROUTING_UNAPPROVED']]){
  clearEngineering(db,id);seedEngineeringReady(db,id,{skip:[skip]});const v=await newVersion(call,id,`missing ${skip}`);x=await release(v);
  ok(x.r.status===409&&x.data.engineering.blockers.includes(code)&&x.data.engineering.sourceVersionNo===v,`missing ${skip} in frozen V${v} blocks production release (${code})`);
}
// 4. An unapproved (DRAFT) record frozen in the version blocks.
clearEngineering(db,id);seedEngineeringReady(db,id);db.prepare("UPDATE fabric_specifications SET state='DRAFT' WHERE style_id=?").run(id);const vDraft=await newVersion(call,id,'draft fabric');
x=await release(vDraft);ok(x.r.status===409&&x.data.engineering.blockers.includes('FABRIC_UNAPPROVED'),'DRAFT fabric frozen in version blocks production release');
// 4b. Approving the live record afterwards does NOT unblock the old frozen version (no TOCTOU via live tables).
db.prepare("UPDATE fabric_specifications SET state='APPROVED' WHERE style_id=?").run(id);x=await release(vDraft);ok(x.r.status===409&&x.data.engineering.blockers.includes('FABRIC_UNAPPROVED'),'live approval after versioning does not unblock the frozen candidate');
// 5. Fully ready version -> release succeeds and freezes the engineering evidence.
clearEngineering(db,id);seedEngineeringReady(db,id);const vReady=await newVersion(call,id,'ready');x=await release(vReady);
ok(x.r.status===201&&x.data.gate.engineering?.status==='ELIGIBLE_FOR_MANUAL_RELEASE_REVIEW'&&x.data.gate.engineering.basis==='FROZEN_STYLE_VERSION','production release succeeds when the frozen version is eligible');
const relNo=x.data.releaseNo,row=db.prepare('SELECT gate_json,snapshot_json,evidence_contract FROM style_releases WHERE style_id=? AND release_no=?').get(id,relNo);
ok(JSON.parse(row.gate_json).engineering?.sourceVersionNo===vReady&&JSON.parse(row.snapshot_json).engineeringReadiness?.percent===100&&row.evidence_contract==='FROZEN_READINESS/R29','engineering readiness evidence is frozen in gate_json and snapshot');
// 6. Later working-record changes do not alter the frozen evidence.
db.prepare("UPDATE fabric_specifications SET state='DRAFT' WHERE style_id=?").run(id);
ok(JSON.parse(db.prepare('SELECT snapshot_json FROM style_releases WHERE style_id=? AND release_no=?').get(id,relNo).snapshot_json).engineeringReadiness.status==='ELIGIBLE_FOR_MANUAL_RELEASE_REVIEW','frozen evidence unchanged by later working edits');
// 7. Tenant isolation: a user outside the style's tenant cannot trigger the release path.
x=await call('/api/auth/login',{method:'POST',body:{email:'mohsen@mohsen.local',password:env.MOHSEN_BOOTSTRAP_PASSWORD},cookieOverride:''});const mohsenCookie=(x.r.headers.get('set-cookie')||'').split(';')[0];
const ts=new Date().toISOString();db.prepare('INSERT INTO organizations(id,code,name,brand_json,created_at) VALUES(?,?,?,?,?)').run('org_other28','OTHER28','Other Org','{}',ts);db.prepare('INSERT INTO styles(id,org_id,code,name,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run('sty_other28','org_other28','OTHER-28','Other Style','u-none',ts,ts);
x=await call('/api/styles/sty_other28/releases',{method:'POST',body:{releaseType:'PRODUCTION'},cookieOverride:mohsenCookie});ok(x.r.status===403,'cross-tenant production release is refused');
ok(db.prepare("SELECT COUNT(*) n FROM style_releases WHERE style_id='sty_other28'").get().n===0,'cross-tenant attempt creates no release');
