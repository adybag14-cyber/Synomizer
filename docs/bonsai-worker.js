// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import {BONSAI,sha256Bytes,extractRuntime,allowedModelRequest} from './bonsai-config.js';
import {contextPrompt,parseModelContext} from './auto-context.js';
let model=null,controller=null,loading=false,generating=false;
const send=data=>postMessage(data);
async function fetchRuntime(signal){
 const response=await fetch(BONSAI.runtimeUrl,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw new Error('Bonsai runtime download failed: HTTP '+response.status);
 const reader=response.body.getReader(),chunks=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000){await reader.cancel();throw new Error('Bonsai runtime exceeded its expected size.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 if(await sha256Bytes(bytes)!==BONSAI.htmlSha256)throw new Error('Bonsai runtime integrity mismatch. No code was executed.');
 const code=extractRuntime(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(await sha256Bytes(new TextEncoder().encode(code))!==BONSAI.coreSha256)throw new Error('Bonsai module integrity mismatch.');
 const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
 try{return await import(url);}finally{URL.revokeObjectURL(url);}
}
async function initialize(){
 if(model){send({type:'ready'});return;}if(loading||generating)throw new Error('Bonsai is busy.');
 if(!navigator.gpu)throw new Error('WebGPU is unavailable. Automatic rule-based setup remains available.');
 loading=true;controller=new AbortController();let last=0;
 try{
  send({type:'progress',message:'Checking the pinned WebGPU runtime...',loaded:0,total:BONSAI.modelBytes});
  const sdk=await fetchRuntime(controller.signal);
  const download=async(input,init={})=>{const {url,method}=allowedModelRequest(input,init);return fetch(url,{...init,method,credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});};
  model=await sdk.TernaryBonsai2.load(BONSAI.modelUrl,{
   maxLength:BONSAI.maxContext,cacheName:BONSAI.cacheName,cache:true,prefixSnapshotStore:null,
   chatTemplateArgs:{enable_thinking:false,preserve_thinking:false},decodePipelineDepth:1,
   fetch:download,signal:controller.signal,
   onProgress:p=>{const now=Date.now();if(now-last>150||p.status==='ready'){last=now;send({type:'progress',message:p.message||p.status,loaded:Number.isFinite(p.loaded)?p.loaded:0,total:Number.isFinite(p.total)?p.total:BONSAI.modelBytes,kind:p.kind||''});}}
  });
  // This pinned runtime tries to render a system-only prefix for cache reuse,
  // but the Bonsai template requires a user turn. Disable that optimization,
  // not the system role or its instructions; every request is reset anyway.
  if(model.generationState?.cache)model.generationState.cache.captureRewindPoint=undefined;
  model.runtime?.device?.lost?.then(info=>{model=null;send({type:'lost',message:'GPU device was lost: '+(info.message||info.reason||'unknown')});});
  send({type:'ready',device:model.deviceInfo?.()||null});
 }finally{loading=false;controller=null;}
}
async function analyze(id,text){
 if(!model)throw new Error('Bonsai is not loaded.');if(generating||loading)throw new Error('Bonsai is busy.');
 if(typeof text!=='string'||text.length>200000)throw new Error('Input exceeds the browser context limit.');
 generating=true;controller=new AbortController();const source=text.replace(/\r\n?/g,'\n'),prompt=contextPrompt(source);let response='';
 try{
  const generate=async messages=>{
   model.reset();let reply='';
   for await(const token of model.generate(messages,{maxNewTokens:BONSAI.maxOutput,signal:controller.signal})){
    if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
    reply=token.text;if(reply.length>16000)throw new Error('Bonsai context response was too long.');
   }
   if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');return reply;
  };
  response=await generate(prompt.messages);let proposal,attempts=1;
  try{proposal=parseModelContext(response,source);}catch(error){
   if(controller.signal.aborted)throw error;
   // One bounded repair can omit uncertain suggestions, never relax validation.
   attempts=2;send({type:'progress',message:'Checking source evidence and repairing the model context...'});
   response=await generate([...prompt.messages,{role:'assistant',content:response},{role:'user',content:'The previous JSON did not pass the data validator: '+error.message+' Return only a valid JSON object. Use audience, purpose, textType and terms; omit reviewHints for this repair. Every evidence string and every term must be a verbatim contiguous substring from the document, with identical case and punctuation. Do not paraphrase evidence. Omit any uncertain field rather than inventing a quote. Do not add approval flags or other fields. No markdown or explanation.'}]);
   proposal=parseModelContext(response,source);
  }
  send({type:'result',id,proposal,sampled:prompt.sampled,attempts,modelRevision:BONSAI.modelRevision});
 }finally{model?.reset();generating=false;controller=null;}
}
self.onmessage=async({data})=>{
 try{
  if(data?.type==='load'){if(data.consent!==true)throw new Error('Model loading requires explicit download consent.');await initialize();}
  else if(data?.type==='analyze')await analyze(data.id,data.text);
  else if(data?.type==='cancel')controller?.abort();
  else if(data?.type==='unload'){controller?.abort();model?.dispose();model=null;send({type:'unloaded'});}
 }catch(error){send({type:'error',id:data?.id,message:error?.message||'Bonsai failed; automatic rules remain available.'});}
};
