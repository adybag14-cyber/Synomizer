// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';
import {BonsaiClient} from '../docs/bonsai-client.js';
import {BONSAI,allowedModelRequest,extractRuntime} from '../docs/bonsai-config.js';
class FakeWorker{constructor(){this.sent=[];this.terminated=false;}postMessage(data){this.sent.push(data);}emit(data){this.onmessage?.({data});}terminate(){this.terminated=true;}}
function setup(extra={}){const workers=[],status=[];const client=new BonsaiClient({workerFactory:()=>{const w=new FakeWorker();workers.push(w);return w;},onStatus:s=>status.push(s),...extra});return{workers,status,client};}
test('model download requires explicit consent before even creating a worker',async()=>{
 const {client,workers}=setup();await assert.rejects(client.load(false));await assert.rejects(client.load());assert.equal(workers.length,0);assert.equal(client.state,'idle');
 const promise=client.load(true);assert.equal(workers.length,1);assert.deepEqual(workers[0].sent,[{type:'load',consent:true}]);workers[0].emit({type:'ready'});await promise;assert.equal(client.state,'ready');client.unload();
});
test('concurrent load is one operation and unload releases the worker',async()=>{
 const {client,workers}=setup();const a=client.load(true),b=client.load(true);assert.equal(a,b);workers[0].emit({type:'ready'});await a;
 client.unload();assert.equal(workers[0].terminated,true);assert.equal(client.state,'idle');
});
test('superseded queued analysis is rejected and only the newest pending request starts',async()=>{
 const {client,workers}=setup();const load=client.load(true);workers[0].emit({type:'ready'});await load;
 const first=client.analyze('first').catch(e=>e.message);const second=client.analyze('second').catch(e=>e.name);const third=client.analyze('third');
 assert.ok(workers[0].sent.some(x=>x.type==='cancel'));assert.equal(await second,'AbortError');
 workers[0].emit({type:'error',id:1,message:'Cancelled'});assert.equal(await first,'Cancelled');
 assert.equal(workers[0].sent.at(-1).text,'third');workers[0].emit({type:'result',id:3,proposal:{terms:[]}});assert.equal((await third).id,3);client.unload();
});
test('late messages from terminated workers never publish results',async()=>{
 const {client,workers,status}=setup();const loading=client.load(true).catch(e=>e.message);client.unload();await loading;
 workers[0].emit({type:'ready'});assert.equal(client.state,'idle');assert.ok(!status.some(s=>s.state==='ready'));
});
test('load timeout terminates optional worker and keeps the rules path independent',async()=>{
 const {client,workers}=setup({loadTimeout:5});await assert.rejects(client.load(true),/timed out/);assert.equal(client.state,'failed');assert.equal(workers[0].terminated,true);
});
test('analysis timeout terminates a hung inference instead of waiting indefinitely',async()=>{
 const {client,workers}=setup({analysisTimeout:5});const load=client.load(true);workers[0].emit({type:'ready'});await load;
 await assert.rejects(client.analyze('input'),/timed out/);assert.equal(client.state,'failed');assert.equal(workers[0].terminated,true);
});
test('device loss rejects pending work and removes the loaded model state',async()=>{
 const {client,workers}=setup();const load=client.load(true);workers[0].emit({type:'ready'});await load;
 const analysis=client.analyze('input');workers[0].emit({type:'lost',message:'Device lost'});await assert.rejects(analysis,/Device lost/);assert.equal(client.worker,null);
});
test('pinned model fetch policy rejects uploads and arbitrary URLs',()=>{
 assert.equal(allowedModelRequest(BONSAI.modelUrl).method,'GET');assert.equal(allowedModelRequest(BONSAI.modelUrl,{method:'HEAD'}).method,'HEAD');
 for(const [url,init] of [['https://example.com',{}],[BONSAI.modelUrl,{method:'POST'}],[BONSAI.modelUrl,{body:'document'}],[BONSAI.modelUrl+'?text=secret',{}],['file:///secret',{}]])assert.throws(()=>allowedModelRequest(url,init));
});
test('runtime extraction excludes unrelated page scripts and all UI side effects',()=>{
 const code='const a=1;export{a as TernaryBonsai2};';
 const html='<script type="module">doNotRun()</script><script type="module">'+code+'stealUI()</script>';
 assert.equal(extractRuntime(html),code);assert.throws(()=>extractRuntime('<script>alert(1)</script>'));
});

test('real model acceptance refuses downloads without its explicit opt-in flag',async()=>{
 const {spawnSync}=await import('node:child_process');
 const r=spawnSync(process.execPath,['scripts/test-bonsai-real.mjs'],{encoding:'utf8',timeout:10000});
 assert.equal(r.status,2,r.stderr);assert.match(r.stderr,/Refusing model download/);
});

test('real hardware test refuses without browser dependencies or network access',async()=>{
 const {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 const dir=mkdtempSync(path.join(tmpdir(),'synomizer-no-browser-deps-'));
 try{
  mkdirSync(path.join(dir,'scripts'));mkdirSync(path.join(dir,'docs'));
  writeFileSync(path.join(dir,'package.json'),JSON.stringify({type:'module'}));
  copyFileSync('scripts/test-bonsai-real.mjs',path.join(dir,'scripts/test-bonsai-real.mjs'));
  copyFileSync('docs/bonsai-config.js',path.join(dir,'docs/bonsai-config.js'));
  const r=spawnSync(process.execPath,['scripts/test-bonsai-real.mjs'],{cwd:dir,encoding:'utf8',timeout:10000});
  assert.equal(r.status,2,r.stderr);assert.match(r.stderr,/Refusing model download/);assert.doesNotMatch(r.stderr,/ERR_MODULE_NOT_FOUND/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
