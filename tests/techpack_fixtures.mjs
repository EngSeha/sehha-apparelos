// Fixtures for the AI-first Tech Pack slice. Everything here is either the owner's own JK-003 design facts (as supplied
// in the directive, still pending measurement-basis confirmation) or clearly SYNTHETIC test data. No customer photo is
// used: images are generated PNGs (a flat garment-like silhouette), so no rights or privacy issue exists.
import {deflateSync} from 'node:zlib';
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
// Synthetic charcoal "jacket-like" silhouette on white, w x h RGB PNG.
export function syntheticGarmentPng(w=240,h=300,rgb=[64,66,70]){const raw=Buffer.alloc((w*3+1)*h);
  for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++){const cx=Math.abs(x-w/2),body=y>40&&y<h-20&&cx<w*0.28+(y<90?(90-y)*0.2:0),sleeve=y>50&&y<h*0.75&&cx>=w*0.28&&cx<w*0.45;const on=body||sleeve;const o=y*(w*3+1)+1+x*3;raw[o]=on?rgb[0]:255;raw[o+1]=on?rgb[1]:255;raw[o+2]=on?rgb[2]:255;}}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
export const pngDataUrl=(...a)=>'data:image/png;base64,'+syntheticGarmentPng(...a).toString('base64');

// JK-003 — owner-supplied design facts (directive §F). M values are prior customer specifications; their landmarks and
// flat/circumference basis are NOT confirmed, so no basis is sent and the Tech Pack must stay DRAFT.
export const JK003={code:'JK-003',name:'Charcoal mohair-look women\'s jacket',ownerNotes:'جاكيت نسائي رمادي فحمي بمظهر موهير، خصر محدد، ياقة بسيطة مرفوعة، 4 أزرار ذهبية على غلق مائل غير متماثل، بدون سوستة. الجزء العلوي من الأمام متراكب مائلًا والجزء السفلي حافة لحافة. البطانة أقصر 2 سم، والجسم يرتد على البطانة 2 سم. أول زر 5 سم من الحافة المحددة ثم كل 10 سم (بانتظار تأكيد نقاط القياس).',
  measurementsM:{BACK_WIDTH:44,BODY_LENGTH:57,CHEST:56,SLEEVE_LENGTH:62,SLEEVE_WIDTH:38,SLEEVE_OPENING:30},
  specs:{fit:'FITTED',closure:'BUTTONS',button_count:4,closure_detail:'غلق مائل غير متماثل؛ 4 أزرار ذهبية؛ أعلى الأمام متراكب وأسفله حافة لحافة؛ أول زر 5 سم ثم كل 10 سم (معلّق التأكيد) / Asymmetric diagonal closure, 4 gold buttons; upper front overlaps, lower front edge-to-edge; first button 5 cm then 10 cm spacing (pending)',lining:'FULL',collar:'ياقة بسيطة مرفوعة / simple raised collar'}};
// SYNTHETIC complete shirt used only to exercise the approval + frozen-PDF path (all values invented for the test).
export const SYNTH_SHIRT={code:'SYN-SHIRT-01',name:'Synthetic test shirt',ownerNotes:'قميص اختبار تركيبي (بيانات اختبار فقط) synthetic shirt',
  measurements:{BODY_LENGTH:{value:74,basis:'LENGTH'},CHEST:{value:54,basis:'FLAT'},SHOULDER:{value:46,basis:'FLAT'},SLEEVE_LENGTH:{value:63,basis:'LENGTH'},COLLAR:{value:40,basis:'CIRCUMFERENCE'}},
  specs:{collar:'CLASSIC',button_count:7}};
// SYNTHETIC long dataset: many POM/BOM/operation rows to exercise pagination and repeated table headers.
export function longRows(n){return {pom:Array.from({length:n},(_,i)=>({code:`X${String(i+1).padStart(2,'0')}`,name:`قياس إضافي رقم ${i+1} من الكتف حتى نقطة مرجعية`,nameEn:`Additional point of measure ${i+1} from shoulder to reference`,value:20+i,tolerancePlus:0.5,toleranceMinus:0.5,provenance:'OWNER_SUPPLIED',state:'DRAFT'})),
  bom:Array.from({length:n},(_,i)=>({code:`B${String(i+1).padStart(2,'0')}`,category:i%3?'TRIM':'FABRIC',name:`خامة اختبار ${i+1}`,nameEn:`Test material ${i+1}`,specification:'مواصفة تركيبية للاختبار',specificationEn:'Synthetic test specification',qty:1+i/10,unit:i%3?'pcs':'m',status:'DRAFT',provenance:'OWNER_SUPPLIED'})),
  ops:Array.from({length:n},(_,i)=>({seq:(i+1)*10,name:`عملية اختبار ${i+1}`,nameEn:`Test operation ${i+1}`,machine:'SNLS',stitch:'301',qcPoint:`فحص ${i+1}`,qcPointEn:`Check ${i+1}`,state:'DRAFT',provenance:'OWNER_SUPPLIED'}))};}
