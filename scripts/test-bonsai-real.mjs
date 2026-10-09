// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// Opt-in hardware acceptance, never part of ordinary CI. Downloads ~5.95 GB.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {BONSAI} from '../docs/bonsai-config.js';
const args=process.argv.slice(2);
if(!args.includes('--allow-model-download')){console.error('Refusing model download. Pass --allow-model-download explicitly to run the real ~5.95 GB hardware test.');process.exit(2);}
// Native CI deliberately has no browser dependencies. Refuse before importing them.
const {chromium}=await import('playwright');
const {expect}=await import('@playwright/test');
const value=key=>{const i=args.indexOf(key);return i>=0?args[i+1]:undefined;};
const channel=value('--channel')||'msedge';
if(!['msedge','chrome','chromium'].includes(channel))throw new Error('Supported test channels: msedge, chrome, chromium.');
const out=resolve('artifacts/bonsai-real');await mkdir(out,{recursive:true});
let base=value('--url'),server,browser,context,page,gpuInfo;
const network=[],errors=[],checks=[];const startedAt=new Date().toISOString();
const samples=[
 {name:'research',text:'This review compares copper catalysts for amide arylation in isobutyl acetate. The study examines ligand identity, nucleophile coordination and product isolation. Results remain substrate-dependent and further research is required.',type:'description'},
 {name:'procedure',text:'Inspect the valve. Remove the cover. Do not exceed 5 bar. Record the pressure before you reconnect the supply.',type:'procedure'}
];
try{
 if(!base){
  const root=resolve('site');await readFile(resolve(root,'index.html'));
  server=createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');name=name||'index.html';const file=resolve(root,name);if(relative(root,file).startsWith('..'))throw Error('Outside site');const data=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[extname(file)]||'text/plain');res.end(data);}catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/';
 }
 // Some unattended Windows GPU sessions fail before any model action occurs.
 // Bound those startup-only retries and report failure, never a skipped pass.
 for(let attempt=1;attempt<=3;attempt++){
  browser=await chromium.launch({channel,headless:args.includes('--headless')});context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
  gpuInfo=(await(await browser.newBrowserCDPSession()).send('SystemInfo.getInfo')).gpu;
  page=await context.newPage();await page.goto(base);
  const adapter=await page.evaluate(async()=>{window.__acceptanceAdapter=await navigator.gpu?.requestAdapter();return !!window.__acceptanceAdapter;});
  console.log('WebGPU startup',attempt,adapter);
  if(adapter)break;
  await browser.close();browser=null;
 }
 assert.ok(browser,'No real WebGPU adapter after three isolated startups. This is a failed hardware check, not a pass.');
 context.on('request',r=>network.push({url:r.url(),method:r.method(),hasBody:r.postData()!=null}));page.on('pageerror',e=>errors.push(e.message));
 await expect(page.locator('#profile')).toHaveValue('auto');await expect(page.locator('#status')).toContainText('Automatic setup');
 await page.locator('#source').fill(samples[0].text);
 await expect(page.locator('#automatic-context')).toContainText('Automatic rules');
 assert.ok(!network.some(r=>r.url.includes('huggingface.co')),'No model request before consent');
 await page.locator('#bonsai-options').evaluate(e=>e.open=true);
 await page.locator('#bonsai-consent').check();await page.locator('#bonsai-load').click();
 for(let i=0;i<samples.length;i++){
  const sample=samples[i],begin=performance.now();if(i)await page.locator('#source').fill(sample.text);
  await expect(page.locator('#automatic-context')).toContainText('Bonsai 2 + rules',{timeout:i?180000:900000});
  const waiting=page.waitForEvent('download');await page.locator('#export-changes').click();const file=await waiting;
  const report=JSON.parse(await readFile(await file.path(),'utf8'));const automatic=report.standards.automaticContext;
  assert.equal(automatic.method,'bonsai2+rules-v1');assert.equal(automatic.status,'inferred-not-verified');
  assert.equal(report.standards.textType,sample.type);assert.equal(report.standards.vocabularyEntries,0);assert.equal(report.standards.conformity.releaseAllowed,false);
  assert.equal(await page.locator('#source').inputValue(),sample.text);assert.equal(report.standards.screens.length,2);
  assert.ok(Object.values(automatic.fields).some(f=>f.origin==='inferred-bonsai2'));
  for(const f of Object.values(automatic.fields))if(f.evidence)assert.ok(sample.text.includes(f.evidence));
  if(i)assert.ok(report.text.includes('Do not exceed 5 bar.'));
  checks.push({name:sample.name,elapsedMs:Math.round(performance.now()-begin),sourceSha256:createHash('sha256').update(sample.text).digest('hex'),context:automatic,conformity:report.standards.conformity.decision});
  await page.screenshot({path:resolve(out,sample.name+'.png'),fullPage:true});
  console.log('REAL_UI_INFERENCE',JSON.stringify(checks.at(-1)));
 }
 assert.equal(checks.length,2);assert.deepEqual(errors,[]);assert.ok(network.every(r=>['GET','HEAD'].includes(r.method)&&!r.hasBody));
 const storageBefore=await page.evaluate(()=>navigator.storage.estimate());
 await page.locator('#bonsai-unload').click();await expect(page.locator('#automatic-context')).toContainText('Automatic rules');
 await page.locator('#bonsai-delete').click();await expect(page.locator('#bonsai-status')).toContainText('deleted',{timeout:15000});
 const databases=await page.evaluate(()=>indexedDB.databases());assert.ok(!databases.some(d=>d.name===BONSAI.cacheName));
 await writeFile(resolve(out,'acceptance.json'),JSON.stringify({startedAt,completedAt:new Date().toISOString(),base,channel,gpuDevices:gpuInfo.devices,checks,network,errors,storageBefore,modelCacheDeleted:true,pins:BONSAI},null,2)+'\n');
 console.log('REAL_BONSAI_UI_ACCEPTANCE_PASSED');
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));}
