// Minimal Chrome DevTools Protocol client over the Cloudflare Browser Rendering binding (env.BROWSER).
// No third-party dependency: the binding exposes POST /v1/devtools/browser (acquire a session) and a WebSocket at
// /v1/devtools/browser/<sessionId> that speaks plain CDP. The same code runs on Cloudflare (remote Browser Rendering)
// and under `wrangler dev` (local Chrome launched by Miniflare). Without the binding the caller gets PDF_ENGINE_UNAVAILABLE.
const FAKE_HOST='https://fake.host';
export class PdfEngineUnavailable extends Error{constructor(msg){super(msg);this.code='PDF_ENGINE_UNAVAILABLE';this.status=503;}}
export function pdfEngineStatus(env){return env&&env.BROWSER&&typeof env.BROWSER.fetch==='function'?{available:true,engine:'CLOUDFLARE_BROWSER_RENDERING_BINDING'}:{available:false,engine:null,code:'PDF_ENGINE_UNAVAILABLE',action:'Bind Cloudflare Browser Rendering as BROWSER in wrangler.jsonc ("browser":{"binding":"BROWSER"}) and enable Browser Rendering on the account.'};}
// Renders the given HTML to PDF bytes (Uint8Array). Page size comes from the document's CSS @page rule.
export async function renderPdf(env,{html,headerTemplate='<span></span>',footerTemplate='<span></span>',timeoutMs=60000}){
  if(!pdfEngineStatus(env).available)throw new PdfEngineUnavailable('Browser Rendering binding BROWSER is not configured');
  // A binding that throws while starting a browser (quota, local Chrome launch failure) is an unavailable engine, not a 500.
  let acq,acqText;try{acq=await env.BROWSER.fetch(`${FAKE_HOST}/v1/devtools/browser`,{method:'POST'});acqText=await acq.text();}catch(e){console.error('pdf_engine_acquire_failed',e?.message);throw new PdfEngineUnavailable('Browser session could not be acquired');}
  if(acq.status!==200)throw new PdfEngineUnavailable(`Browser session could not be acquired (${acq.status})`);
  const {sessionId}=JSON.parse(acqText);
  const up=await env.BROWSER.fetch(`${FAKE_HOST}/v1/devtools/browser/${sessionId}`,{headers:{Upgrade:'websocket'}});
  const ws=up.webSocket;if(!ws)throw new PdfEngineUnavailable('Browser session did not upgrade to WebSocket');ws.accept();
  let seq=0;const pending=new Map();let closed=false;
  ws.addEventListener('message',ev=>{let m;try{m=JSON.parse(typeof ev.data==='string'?ev.data:new TextDecoder().decode(ev.data));}catch{return;}
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(new Error(`CDP ${p.method}: ${m.error.message}`));else p.resolve(m.result||{});}});
  ws.addEventListener('close',()=>{closed=true;for(const p of pending.values())p.reject(new Error('Browser session closed'));pending.clear();});
  const send=(method,params={},session)=>new Promise((resolve,reject)=>{if(closed)return reject(new Error('Browser session closed'));const id=++seq;pending.set(id,{resolve,reject,method});ws.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}));});
  let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('PDF rendering timed out')),timeoutMs);});
  const work=(async()=>{
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId:s}=await send('Target.attachToTarget',{targetId,flatten:true});
    await send('Page.enable',{},s);
    const {frameTree}=await send('Page.getFrameTree',{},s);
    await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html},s);
    // Wait until embedded fonts and images are decoded so the PDF never falls back to a substitute font.
    await send('Runtime.evaluate',{expression:"Promise.all([document.fonts.ready,...[...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))]).then(()=>[...document.fonts].filter(f=>f.status==='loaded').length)",awaitPromise:true,returnByValue:true},s);
    const r=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate,footerTemplate,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,transferMode:'ReturnAsStream'},s);
    const parts=[];let total=0;
    for(;;){const c=await send('IO.read',{handle:r.stream,size:256*1024},s);const bin=c.base64Encoded?Uint8Array.from(atob(c.data),ch=>ch.charCodeAt(0)):new TextEncoder().encode(c.data);parts.push(bin);total+=bin.length;if(c.eof)break;}
    await send('IO.close',{handle:r.stream},s);
    await send('Target.closeTarget',{targetId}).catch(()=>{});
    const out=new Uint8Array(total);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;})();
  try{return await Promise.race([work,timeout]);}
  finally{clearTimeout(timer);try{await Promise.race([send('Browser.close'),new Promise(r=>setTimeout(r,1500))]);}catch{}try{ws.close();}catch{}}
}
