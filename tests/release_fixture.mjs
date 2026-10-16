// Shared deterministic fixture: a Style whose legacy production gate is READY (POM/BOM/pattern/operations approved,
// V1 with an approved PP sample and an approved cost sheet). Engineering records are intentionally NOT seeded here.
export async function buildReleaseCandidate(call,org,code){let x;
  x=await call('/api/styles',{method:'POST',body:{orgId:org.id,code,name:`Release candidate ${code}`,garmentType:'JACKET',audience:'WOMEN',sizingMode:'STANDARD',baseSize:'M'}});const id=x.data.id;
  await call(`/api/styles/${id}/measurements`,{method:'POST',body:{code:'A',name:'طول',nameEn:'Length',value:57,tolerancePlus:1,toleranceMinus:1,state:'LOCKED',provenance:'USER_CONFIRMED'}});
  await call(`/api/styles/${id}/bom`,{method:'POST',body:{code:'B01',category:'SHELL',name:'قماش',nameEn:'Fabric',specification:'Approved shell',specificationEn:'Approved shell',qty:1.8,unit:'m',status:'APPROVED',provenance:'USER_CONFIRMED'}});
  await call(`/api/styles/${id}/patterns`,{method:'POST',body:{code:'P01',name:'أمام',nameEn:'Front',qty:2,grainline:'STRAIGHT',state:'APPROVED',provenance:'USER_CONFIRMED'}});
  await call(`/api/styles/${id}/patterns`,{method:'POST',body:{code:'P02',name:'خلف',nameEn:'Back',qty:1,grainline:'STRAIGHT',state:'APPROVED',provenance:'USER_CONFIRMED'}});
  await call(`/api/styles/${id}/pattern-links`,{method:'POST',body:{fromCode:'P01',toCode:'P02',relation:'SEAM_JOIN',label:'Side seam',labelEn:'Side seam',state:'APPROVED',provenance:'USER_CONFIRMED'}});
  await call(`/api/styles/${id}/operations`,{method:'POST',body:{seq:1,name:'تجميع',nameEn:'Assembly',description:'Approved',descriptionEn:'Approved',machine:'SN',stitch:'301',qcPoint:'مطابقة',qcPointEn:'Match',state:'APPROVED',provenance:'USER_CONFIRMED'}});
  x=await call(`/api/styles/${id}/versions`,{method:'POST',body:{label:'Production Candidate'}});if(x.r.status!==201)throw new Error('fixture: version V1 not created');
  x=await call(`/api/styles/${id}/samples`,{method:'POST',body:{versionNo:1,sampleType:'PP'}});const sid=x.data.sample.id;await call(`/api/styles/${id}/samples/${sid}/measurements/A`,{method:'PATCH',body:{actualValue:57}});
  x=await call(`/api/styles/${id}/cost-sheets`,{method:'POST',body:{versionNo:1,name:'V1 Cost',currency:'EGP',laborCost:100,overheadPct:10}});const cid=x.data.id;await call(`/api/styles/${id}/cost-sheets/${cid}/lines`,{method:'POST',body:{description:'Fabric',qty:1.8,unit:'m',unitCost:150}});
  await call(`/api/styles/${id}/samples/${sid}/status`,{method:'PATCH',body:{status:'APPROVED'}});await call(`/api/styles/${id}/cost-sheets/${cid}/approve`,{method:'POST',body:{}});
  return id;}
export const ENG_TABLES=['fabric_specifications','trim_specifications','pattern_piece_specs','marker_plans','routing_steps'];
export function clearEngineering(db,id){for(const t of ENG_TABLES)db.prepare(`DELETE FROM ${t} WHERE style_id=?`).run(id);}
export async function newVersion(call,id,label){const x=await call(`/api/styles/${id}/versions`,{method:'POST',body:{label}});if(x.r.status!==201)throw new Error('fixture: version not created');return x.data.versionNo;}
