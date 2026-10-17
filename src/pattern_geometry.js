// AI-TP-W01 pattern geometry PROTOTYPE: 1:1 millimetre SVG and DXF (R12 ASCII) writers for pattern pieces whose outline
// is GIVEN as explicit coordinates. It drafts nothing: no outline is derived from a photograph, a category template or
// a measurement chart. W01 accepts only specs marked SYNTHETIC_FULLY_SPECIFIED (test garments); real garments need the
// validated drafting engine of AI-TP-W02, verified measurements and a physical sample. Output is never cut-ready.
export const GEOMETRY_CONTRACT='SEHHA_PATTERN_GEOMETRY_PROTOTYPE/1';
export const ALLOWED_SOURCES=new Set(['SYNTHETIC_FULLY_SPECIFIED']);
export class GeometryRejected extends Error{constructor(code,msg){super(msg);this.code=code;this.status=422;}}
const r3=n=>Math.round(n*1000)/1000;
export function signedArea(poly){let a=0;for(let i=0;i<poly.length;i++){const [x1,y1]=poly[i],[x2,y2]=poly[(i+1)%poly.length];a+=x1*y2-x2*y1;}return a/2;}
export function perimeter(poly){let p=0;for(let i=0;i<poly.length;i++){const [x1,y1]=poly[i],[x2,y2]=poly[(i+1)%poly.length];p+=Math.hypot(x2-x1,y2-y1);}return p;}
export function bbox(poly){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);return {minX:Math.min(...xs),minY:Math.min(...ys),maxX:Math.max(...xs),maxY:Math.max(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}
function segmentsCross(a,b,c,d){const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;}
export function isSimple(poly){const n=poly.length;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){if(Math.abs(i-j)<=1||(i===0&&j===n-1))continue;if(segmentsCross(poly[i],poly[(i+1)%n],poly[j],poly[(j+1)%n]))return false;}return true;}
// Cut line = sew line offset outward edge by edge (per-edge allowance in mm), joined with mitred corners.
export function offsetPolygon(poly,allowances){const n=poly.length,ccw=signedArea(poly)>0,lines=[];
  for(let i=0;i<n;i++){const [x1,y1]=poly[i],[x2,y2]=poly[(i+1)%n],dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),d=allowances[i];
    const nx=(ccw?dy:-dy)/len,ny=(ccw?-dx:dx)/len;lines.push({p:[x1+nx*d,y1+ny*d],v:[dx,dy]});}
  return lines.map((L,i)=>{const P=lines[(i-1+n)%n],den=P.v[0]*L.v[1]-P.v[1]*L.v[0];if(Math.abs(den)<1e-9)return L.p.map(r3);
    const t=((L.p[0]-P.p[0])*L.v[1]-(L.p[1]-P.p[1])*L.v[0])/den;return [r3(P.p[0]+P.v[0]*t),r3(P.p[1]+P.v[1]*t)];});}
export function validateGeometrySpec(spec){
  if(!spec||typeof spec!=='object')throw new GeometryRejected('GEOMETRY_SPEC_INVALID','spec must be an object');
  if(!ALLOWED_SOURCES.has(spec.source))throw new GeometryRejected('GEOMETRY_SOURCE_NOT_ALLOWED','W01 exports geometry only for SYNTHETIC_FULLY_SPECIFIED test garments; real garments need verified measurements and the W02 drafting engine');
  if(spec.unit!=='mm')throw new GeometryRejected('GEOMETRY_UNIT_INVALID','unit must be mm (1:1)');
  if(!Array.isArray(spec.pieces)||!spec.pieces.length)throw new GeometryRejected('GEOMETRY_SPEC_INVALID','pieces required');
  const codes=new Set();
  for(const p of spec.pieces){if(!/^[A-Z0-9_-]{1,24}$/.test(p.code||''))throw new GeometryRejected('GEOMETRY_SPEC_INVALID','piece code');if(codes.has(p.code))throw new GeometryRejected('GEOMETRY_SPEC_INVALID',`duplicate piece ${p.code}`);codes.add(p.code);
    if(!Array.isArray(p.polygon)||p.polygon.length<3||!p.polygon.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)))throw new GeometryRejected('GEOMETRY_SPEC_INVALID',`${p.code}: polygon needs ≥3 numeric vertices`);
    if(Math.abs(signedArea(p.polygon))<1)throw new GeometryRejected('GEOMETRY_SPEC_INVALID',`${p.code}: zero-area polygon`);
    if(!isSimple(p.polygon))throw new GeometryRejected('GEOMETRY_SPEC_INVALID',`${p.code}: self-intersecting outline`);
    const sa=Array.isArray(p.seamAllowanceMm)?p.seamAllowanceMm:p.polygon.map(()=>p.seamAllowanceMm);
    if(sa.length!==p.polygon.length||!sa.every(x=>Number.isFinite(x)&&x>=0&&x<=60))throw new GeometryRejected('GEOMETRY_SPEC_INVALID',`${p.code}: explicit seam allowance 0–60 mm for every edge`);
    if(!Number.isInteger(p.cutQty)||p.cutQty<1)throw new GeometryRejected('GEOMETRY_SPEC_INVALID',`${p.code}: explicit cut quantity`);
    if(!Array.isArray(p.grainline)||p.grainline.length!==2)throw new GeometryRejected('GEOMETRY_SPEC_INVALID',`${p.code}: explicit grainline`);}
  return true;}
// Builds the piece set: sew line, cut line, metrics and a side-by-side layout (offsets only; geometry is unchanged).
export function buildPieces(spec,{gapMm=20}={}){validateGeometrySpec(spec);let cursor=0;
  return spec.pieces.map(p=>{const sa=Array.isArray(p.seamAllowanceMm)?p.seamAllowanceMm:p.polygon.map(()=>p.seamAllowanceMm),sew=p.polygon.map(v=>v.map(r3)),cut=offsetPolygon(sew,sa),cb=bbox(cut),dx=cursor-cb.minX,dy=-cb.minY;cursor+=cb.width+gapMm;
    const mv=pts=>pts.map(([x,y])=>[r3(x+dx),r3(y+dy)]);
    const notches=(p.notches||[]).map(({edge,t})=>{const a=sew[edge],b=sew[(edge+1)%sew.length],x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,len=Math.hypot(b[0]-a[0],b[1]-a[1]),ccw=signedArea(sew)>0,nx=(ccw?(b[1]-a[1]):-(b[1]-a[1]))/len,ny=(ccw?-(b[0]-a[0]):(b[0]-a[0]))/len,d=sa[edge];return mv([[x,y],[x+nx*d,y+ny*d]]);});
    return {code:p.code,name:p.name||p.code,cutQty:p.cutQty,mirrored:!!p.mirrored,fabric:p.fabric||'SHELL',seamAllowanceMm:sa,sew:mv(sew),cut:mv(cut),grainline:mv(p.grainline),notches,
      metrics:{sewAreaMm2:r3(Math.abs(signedArea(sew))),cutAreaMm2:r3(Math.abs(signedArea(cut))),sewPerimeterMm:r3(perimeter(sew)),cutPerimeterMm:r3(perimeter(cut)),cutWidthMm:r3(cb.width),cutHeightMm:r3(cb.height)}};});}
const xmlEsc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// SVG in millimetres: width/height carry the "mm" unit and the viewBox uses the same numbers, so 1 user unit = 1 mm.
export function toSvg(spec,pieces=buildPieces(spec)){const all=pieces.flatMap(p=>p.cut),b=bbox(all),W=r3(b.maxX+10),H=r3(b.maxY+30),flip=y=>r3(H-20-y);
  const path=pts=>pts.map(([x,y],i)=>`${i?'L':'M'}${x} ${flip(y)}`).join(' ')+' Z';
  const body=pieces.map(p=>`<g id="${xmlEsc(p.code)}"><path d="${path(p.cut)}" fill="none" stroke="#000" stroke-width="0.5" data-layer="CUT"/><path d="${path(p.sew)}" fill="none" stroke="#555" stroke-width="0.3" stroke-dasharray="4 2" data-layer="SEW"/>`+
    `<line x1="${p.grainline[0][0]}" y1="${flip(p.grainline[0][1])}" x2="${p.grainline[1][0]}" y2="${flip(p.grainline[1][1])}" stroke="#000" stroke-width="0.4" marker-start="url(#a)" marker-end="url(#a)" data-layer="GRAIN"/>`+
    p.notches.map(n=>`<line x1="${n[0][0]}" y1="${flip(n[0][1])}" x2="${n[1][0]}" y2="${flip(n[1][1])}" stroke="#000" stroke-width="0.5" data-layer="NOTCH"/>`).join('')+
    `<text x="${r3((p.grainline[0][0]+p.grainline[1][0])/2+4)}" y="${flip((p.grainline[0][1]+p.grainline[1][1])/2)}" font-size="6" font-family="sans-serif">${xmlEsc(p.code)} ×${p.cutQty}${p.mirrored?' (mirror)':''} · ${xmlEsc(p.fabric)}</text></g>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" data-contract="${GEOMETRY_CONTRACT}" data-source="${xmlEsc(spec.source)}" data-cut-ready="false">`+
    `<defs><marker id="a" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L6 3 L0 6 z"/></marker></defs>`+
    `<text x="5" y="${r3(H-6)}" font-size="5" font-family="sans-serif">${xmlEsc(spec.id||'')} · ${xmlEsc(spec.source)} · 1:1 mm · NOT CUT-READY · 100 mm check: </text><line x1="120" y1="${r3(H-7.5)}" x2="220" y2="${r3(H-7.5)}" stroke="#000" stroke-width="0.6" data-layer="SCALE"/>${body}</svg>\n`;}
// DXF R12 ASCII, units mm ($INSUNITS 4). Layers: CUT, SEW, GRAIN, NOTCH, TEXT. Closed POLYLINE entities for outlines.
export function toDxf(spec,pieces=buildPieces(spec)){const o=[],g=(c,v)=>o.push(String(c),String(v));
  g(0,'SECTION');g(2,'HEADER');g(9,'$ACADVER');g(1,'AC1009');g(9,'$INSUNITS');g(70,4);g(9,'$MEASUREMENT');g(70,1);g(0,'ENDSEC');
  g(0,'SECTION');g(2,'TABLES');g(0,'TABLE');g(2,'LAYER');g(70,5);for(const [n,c] of [['CUT',7],['SEW',8],['GRAIN',5],['NOTCH',1],['TEXT',3]]){g(0,'LAYER');g(2,n);g(70,0);g(62,c);g(6,'CONTINUOUS');}g(0,'ENDTAB');g(0,'ENDSEC');
  g(0,'SECTION');g(2,'ENTITIES');
  const poly=(layer,pts)=>{g(0,'POLYLINE');g(8,layer);g(66,1);g(10,0);g(20,0);g(30,0);g(70,1);for(const [x,y] of pts){g(0,'VERTEX');g(8,layer);g(10,x);g(20,y);g(30,0);}g(0,'SEQEND');g(8,layer);};
  const line=(layer,[a,b])=>{g(0,'LINE');g(8,layer);g(10,a[0]);g(20,a[1]);g(30,0);g(11,b[0]);g(21,b[1]);g(31,0);};
  for(const p of pieces){poly('CUT',p.cut);poly('SEW',p.sew);line('GRAIN',p.grainline);for(const n of p.notches)line('NOTCH',n);
    g(0,'TEXT');g(8,'TEXT');g(10,r3((p.grainline[0][0]+p.grainline[1][0])/2+4));g(20,r3((p.grainline[0][1]+p.grainline[1][1])/2));g(30,0);g(40,6);g(1,`${p.code} x${p.cutQty}${p.mirrored?' MIRROR':''} ${p.fabric} NOT-CUT-READY`);}
  g(0,'ENDSEC');g(0,'EOF');return o.join('\n')+'\n';}
export function geometryManifest(spec,pieces=buildPieces(spec)){return {contract:GEOMETRY_CONTRACT,id:spec.id,source:spec.source,unit:'mm',scale:'1:1',cutReady:false,
  note:'Prototype export of explicitly specified synthetic geometry. Not derived from images; not a validated drafting result; never cut-ready.',
  pieces:pieces.map(p=>({code:p.code,name:p.name,cutQty:p.cutQty,mirrored:p.mirrored,fabric:p.fabric,seamAllowanceMm:p.seamAllowanceMm,...p.metrics}))};}
