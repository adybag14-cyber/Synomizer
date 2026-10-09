// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import {BONSAI} from './bonsai-config.js';
export class BonsaiClient{
 constructor({workerFactory=()=>new Worker(new URL('./bonsai-worker.js',import.meta.url),{type:'module'}),onStatus=()=>{},loadTimeout=900000,analysisTimeout=120000}={}){
  this.workerFactory=workerFactory;this.onStatus=onStatus;this.loadTimeout=loadTimeout;this.analysisTimeout=analysisTimeout;this.state='idle';this.worker=null;this.active=null;this.queued=null;this.counter=0;this.timer=null;this.loading=null;
 }
 status(state,message){this.state=state;this.onStatus({state,message});}
 load(consent){
  if(consent!==true)return Promise.reject(new Error('Explicit permission is required before the model download.'));
  if(this.state==='ready'||this.state==='analyzing')return Promise.resolve();
  if(this.loading)return this.loading.promise;
  let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});this.loading={promise,resolve,reject};
  try{const worker=this.workerFactory();this.worker=worker;worker.onmessage=e=>{if(this.worker===worker)this.message(e.data);};worker.onerror=e=>{if(this.worker===worker)this.fail(e.message||'Bonsai worker failed.');};
   this.status('loading','Downloading the optional runtime and model...');this.timer=setTimeout(()=>this.fail('Bonsai loading timed out. Automatic rules remain available.'),this.loadTimeout);worker.postMessage({type:'load',consent:true});
  }catch(error){this.fail(error.message);}return promise;
 }
 message(data){
  if(data.type==='progress'){this.onStatus({state:this.state,...data});return;}
  if(data.type==='ready'){clearTimeout(this.timer);this.timer=null;const loading=this.loading;this.loading=null;this.status('ready','Bonsai 2 is ready on this device.');loading?.resolve();this.pump();return;}
  if(data.type==='lost'){this.fail(data.message);return;}
  if(data.type==='error'&&data.id===undefined){this.fail(data.message);return;}
  if(!this.active||data.id!==this.active.id||!['result','error'].includes(data.type))return;
  clearTimeout(this.timer);this.timer=null;const request=this.active;this.active=null;
  this.status('ready',data.type==='result'?'Bonsai context is ready; deterministic review follows.':'Bonsai did not supply usable context; automatic rules remain available.');
  if(data.type==='result')request.resolve(data);else request.reject(new Error(data.message));this.pump();
 }
 analyze(text){
  if(!this.worker||!['ready','analyzing'].includes(this.state))return Promise.reject(new Error('Bonsai is not ready.'));
  if(typeof text!=='string'||text.length>200000)return Promise.reject(new Error('Text exceeds the browser limit.'));
  return new Promise((resolve,reject)=>{
   if(this.queued)this.queued.reject(new DOMException('Superseded','AbortError'));
   this.queued={text,id:++this.counter,resolve,reject};
   if(this.active){this.worker.postMessage({type:'cancel'});}else this.pump();
  });
 }
 pump(){
  if(this.active||!this.queued||this.state!=='ready')return;
  this.active=this.queued;this.queued=null;this.status('analyzing','Bonsai is inferring reader, purpose and terminology...');
  this.timer=setTimeout(()=>this.fail('Bonsai analysis timed out; the rule-based draft is still available.'),this.analysisTimeout);
  this.worker.postMessage({type:'analyze',id:this.active.id,text:this.active.text});
 }
 cancelAnalysis(){
  if(this.queued){this.queued.reject(new DOMException('Cancelled','AbortError'));this.queued=null;}
  if(this.active)this.worker?.postMessage({type:'cancel'});
 }
 fail(message){const error=new Error(message);clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.worker=null;this.loading?.reject(error);this.loading=null;this.active?.reject(error);this.active=null;this.queued?.reject(error);this.queued=null;this.status('failed',message);}
 unload(){this.fail('Bonsai unloaded. Automatic rules remain available.');this.status('idle','Bonsai is not loaded.');}
 async deleteCache(){
  this.unload();
  if(globalThis.caches)for(const name of await caches.keys())if(name.startsWith(BONSAI.cacheName))await caches.delete(name);
  if(globalThis.indexedDB)await new Promise((resolve,reject)=>{
   const request=indexedDB.deleteDatabase(BONSAI.cacheName),timer=setTimeout(()=>reject(new Error('Cache deletion timed out. Close other Synomizer model tabs and retry.')),10000);
   request.onsuccess=()=>{clearTimeout(timer);resolve();};request.onerror=()=>{clearTimeout(timer);reject(request.error);};request.onblocked=()=>{clearTimeout(timer);reject(new Error('Model cache is in use in another tab. Close that tab and retry.'));};
  });
  this.status('idle','Cached Bonsai weights were deleted for this site.');
 }
}
