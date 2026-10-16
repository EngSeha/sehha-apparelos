// ROUND30 — action-level authority map. Four distinct authorities are kept separate:
//   (i)   PRODUCTION_RELEASE_CREATE   technical/production specification release
//   (ii)  HANDOFF_PREPARE / HANDOFF_DISPATCH / HANDOFF_WITHDRAW (release side) and HANDOFF_ACKNOWLEDGE (factory side)
//   (iii) LOT_RELEASE                 final production lot release after QC/reconciliation (existing factory action)
//   (iv)  application deployment      has no in-app route; it is CI/wrangler credentials outside this Worker
// Roles are the ones already present in the modern product (memberships.role). No historical role names are invented.
export const OWNER_ROLES=['PLATFORM_ADMIN','PLATFORM_OWNER','WORKSPACE_OWNER'];
export const CAPABILITIES={
  PRODUCTION_RELEASE_CREATE:[...OWNER_ROLES,'RELEASE_MANAGER','DESIGN_PATTERN_MASTER'],
  HANDOFF_PREPARE:[...OWNER_ROLES,'RELEASE_MANAGER'],
  HANDOFF_DISPATCH:[...OWNER_ROLES,'RELEASE_MANAGER'],
  HANDOFF_WITHDRAW:[...OWNER_ROLES,'RELEASE_MANAGER'],
  HANDOFF_ACKNOWLEDGE:[...OWNER_ROLES,'FACTORY_SUPERVISOR','PRODUCTION'],
  HANDOFF_INSPECT:null // any active member of the tenant
};
// SQL fragment: actor (?A) is active and holds one of the capability roles in org (?O). Platform admin comes from the DB.
export function actorSql(capability,a='?A',o='?O'){const roles=CAPABILITIES[capability];
  const roleCond=roles?` AND UPPER(m.role) IN (${roles.map(r=>`'${r}'`).join(',')})`:'';
  return `EXISTS(SELECT 1 FROM users u WHERE u.id=${a} AND u.active=1 AND (u.is_platform_admin=1 OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.org_id=${o}${roleCond})))`;}
// Re-read the actor from the database; session claims are never authority.
export async function actorCapability(env,userId,orgId,capability){
  const u=await env.DB.prepare('SELECT active,is_platform_admin FROM users WHERE id=?').bind(userId).first();
  if(!u||Number(u.active)!==1)return {ok:false,code:'FORBIDDEN_ACTOR'};
  if(Number(u.is_platform_admin)===1)return {ok:true,role:'PLATFORM_ADMIN'};
  const m=await env.DB.prepare('SELECT role FROM memberships WHERE user_id=? AND org_id=?').bind(userId,orgId).first();
  if(!m)return {ok:false,code:'FORBIDDEN_ACTOR'};
  const role=String(m.role||'').toUpperCase(),roles=CAPABILITIES[capability];
  if(roles&&!roles.includes(role))return {ok:false,code:'ROLE_NOT_PERMITTED',role};
  return {ok:true,role};
}
