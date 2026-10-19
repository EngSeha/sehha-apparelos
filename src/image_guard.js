// Image intake guard (AI-TP-W01): real header-parsed dimensions (resolution-bomb defence), metadata stripping for JPEG,
// PNG and WebP (EXIF/XMP/IPTC/text chunks can carry GPS and device identity), SHA-256 of the exact stored bytes, and duplicate detection per style.
// Pure functions + one R2 helper; no third-party dependency.
export const IMAGE_LIMITS={maxBytes:10*1024*1024,maxPixels:40_000_000,maxSide:12_000,minSide:32};
const be16=(b,o)=>(b[o]<<8)|b[o+1],be32=(b,o)=>((b[o]<<24)>>>0)+(b[o+1]<<16)+(b[o+2]<<8)+b[o+3],le16=(b,o)=>b[o]|(b[o+1]<<8),le24=(b,o)=>b[o]|(b[o+1]<<8)|(b[o+2]<<16);
export class ImageRejected extends Error{constructor(code,msg,status=422){super(msg);this.code=code;this.status=status;}}
// Returns {width,height} from the container header, or throws IMAGE_HEADER_INVALID.
export function imageDimensions(mime,b){
  if(mime==='image/png'){if(b.length<24||String.fromCharCode(...b.subarray(12,16))!=='IHDR')throw new ImageRejected('IMAGE_HEADER_INVALID','PNG header is invalid');return {width:be32(b,16),height:be32(b,20)};}
  if(mime==='image/gif'){if(b.length<10)throw new ImageRejected('IMAGE_HEADER_INVALID','GIF header is invalid');return {width:le16(b,6),height:le16(b,8)};}
  if(mime==='image/webp'){if(b.length<30)throw new ImageRejected('IMAGE_HEADER_INVALID','WebP header is invalid');const fourcc=String.fromCharCode(...b.subarray(12,16));
    if(fourcc==='VP8X')return {width:le24(b,24)+1,height:le24(b,27)+1};
    if(fourcc==='VP8L'){const v=b[21]|(b[22]<<8)|(b[23]<<16)|(b[24]<<24);return {width:(v&0x3fff)+1,height:((v>>>14)&0x3fff)+1};}
    if(fourcc==='VP8 '){if(b[23]!==0x9d||b[24]!==0x01||b[25]!==0x2a)throw new ImageRejected('IMAGE_HEADER_INVALID','WebP VP8 frame tag is invalid');return {width:le16(b,26)&0x3fff,height:le16(b,28)&0x3fff};}
    throw new ImageRejected('IMAGE_HEADER_INVALID','Unknown WebP chunk');}
  if(mime==='image/jpeg'){let o=2;while(o+9<b.length){if(b[o]!==0xff){o++;continue;}const m=b[o+1];if(m===0xd8||m===0x01||(m>=0xd0&&m<=0xd7)){o+=2;continue;}const len=be16(b,o+2);
      if((m>=0xc0&&m<=0xcf)&&m!==0xc4&&m!==0xc8&&m!==0xcc)return {width:be16(b,o+7),height:be16(b,o+5)};if(len<2)break;o+=2+len;}
    throw new ImageRejected('IMAGE_HEADER_INVALID','JPEG has no frame header');}
  throw new ImageRejected('IMAGE_MIME_UNSUPPORTED','Unsupported image type',415);}
export function checkDimensions({width,height},limits=IMAGE_LIMITS,{forVision=false}={}){
  if(!(width>0&&height>0))throw new ImageRejected('IMAGE_HEADER_INVALID','Image dimensions are invalid');
  if(width>limits.maxSide||height>limits.maxSide||width*height>limits.maxPixels)throw new ImageRejected('IMAGE_TOO_LARGE_RESOLUTION',`Image resolution ${width}×${height} exceeds the limit (${limits.maxSide}px side, ${limits.maxPixels/1e6} MP)`,413);
  if(forVision&&(width<limits.minSide||height<limits.minSide))throw new ImageRejected('IMAGE_TOO_SMALL',`Image ${width}×${height} is too small to analyse`);}
// Remove APP1 (Exif/XMP), APP13 (IPTC/Photoshop) and COM segments from a JPEG; pixels are untouched.
export function stripJpegMetadata(b){if(!(b[0]===0xff&&b[1]===0xd8))return {bytes:b,removed:0};const out=[b.subarray(0,2)];let o=2,removed=0;
  while(o+4<=b.length){if(b[o]!==0xff)return {bytes:b,removed:0};const m=b[o+1];if(m===0xda){out.push(b.subarray(o));break;}const len=be16(b,o+2);if(len<2||o+2+len>b.length)return {bytes:b,removed:0};
    if(m===0xe1||m===0xed||m===0xfe){removed++;}else out.push(b.subarray(o,o+2+len));o+=2+len;}
  const total=out.reduce((n,x)=>n+x.length,0),res=new Uint8Array(total);let p=0;for(const x of out){res.set(x,p);p+=x.length;}return {bytes:res,removed};}
// PNG: drop eXIf and textual chunks (tEXt/iTXt/zTXt can hold XMP/GPS/device data); image chunks are copied byte-for-byte.
const PNG_DROP=new Set(['eXIf','tEXt','iTXt','zTXt','tIME']);
export function stripPngMetadata(b){if(b.length<8||b[0]!==0x89||b[1]!==0x50)return {bytes:b,removed:0};const out=[b.subarray(0,8)];let o=8,removed=0;
  while(o+12<=b.length){const len=be32(b,o),type=String.fromCharCode(...b.subarray(o+4,o+8)),end=o+12+len;if(end>b.length)return {bytes:b,removed:0};
    if(PNG_DROP.has(type))removed++;else out.push(b.subarray(o,end));o=end;if(type==='IEND')break;}
  return {bytes:concat(out),removed};}
// WebP (RIFF): drop EXIF and XMP chunks and clear their flags in VP8X; RIFF size is rewritten.
export function stripWebpMetadata(b){if(b.length<20||String.fromCharCode(...b.subarray(0,4))!=='RIFF'||String.fromCharCode(...b.subarray(8,12))!=='WEBP')return {bytes:b,removed:0};
  const out=[],le32=(x,o)=>(x[o]|(x[o+1]<<8)|(x[o+2]<<16)|(x[o+3]<<24))>>>0;let o=12,removed=0;
  while(o+8<=b.length){const id=String.fromCharCode(...b.subarray(o,o+4)),len=le32(b,o+4),end=o+8+len+(len&1);if(o+8+len>b.length)return {bytes:b,removed:0};
    if(id==='EXIF'||id==='XMP ')removed++;else{const c=b.slice(o,Math.min(end,b.length));if(id==='VP8X')c[8]&=~0x0c;out.push(c);}o=end;}
  if(!removed)return {bytes:b,removed:0};const body=concat(out),res=new Uint8Array(12+body.length);res.set(b.subarray(0,12));const size=4+body.length;res[4]=size&255;res[5]=(size>>8)&255;res[6]=(size>>16)&255;res[7]=(size>>>24)&255;res.set(body,12);return {bytes:res,removed};}
function concat(parts){const total=parts.reduce((n,x)=>n+x.length,0),res=new Uint8Array(total);let p=0;for(const x of parts){res.set(x,p);p+=x.length;}return res;}
export async function sha256Hex(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
// Full guard for one upload: dimensions, metadata strip, hash, duplicate check against the style's stored assets.
export async function guardImage(env,{mime,bytes},existingAssets=[]){
  const dims=imageDimensions(mime,bytes);checkDimensions(dims);
  const stripped=mime==='image/jpeg'?stripJpegMetadata(bytes):mime==='image/png'?stripPngMetadata(bytes):mime==='image/webp'?stripWebpMetadata(bytes):{bytes,removed:0};const sha=await sha256Hex(stripped.bytes);
  for(const a of existingAssets){try{const h=typeof env.UPLOADS.head==='function'?await env.UPLOADS.head(a.stored_name):await env.UPLOADS.get(a.stored_name);if(h?.customMetadata?.sha256===sha)return {dims,bytes:stripped.bytes,sha,metadataSegmentsRemoved:stripped.removed,duplicateOf:a.id};}catch{}}
  return {dims,bytes:stripped.bytes,sha,metadataSegmentsRemoved:stripped.removed,duplicateOf:null};}
