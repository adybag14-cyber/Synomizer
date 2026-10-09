// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import {test,expect} from '@playwright/test';import {readFile} from 'node:fs/promises';import {readFileSync} from 'node:fs';
import {rewrite,loadResources} from '../../docs/engine.js';import {BONSAI} from '../../docs/bonsai-config.js';
const resources=loadResources(...['lexicon.tsv','phrases.txt','rephrases.tsv'].map(n=>readFileSync(new URL(`../../data/${n}`,import.meta.url),'utf8')));
const research='This review compares catalysts for amide arylation in isobutyl acetate. The study examines solvents and product recovery.';
const instructions='Inspect the valve. Remove the cover. Do not exceed 5 bar.';
async function loaded(page){await page.goto('./');await expect(page.locator('#status')).toContainText('Automatic setup');}
async function settled(page){await expect(page.locator('#status')).toContainText('Automatic setup');await expect(page.locator('#output')).toHaveAttribute('aria-busy','false');}
async function report(page){const waiting=page.waitForEvent('download');await page.locator('#export-changes').click();const file=await waiting;return JSON.parse(await readFile(await file.path(),'utf8'));}
async function modelFixture(page,{invalid=false,delay=10,loadError=false}={}){
 await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:{},configurable:true}));
 await page.route('**/bonsai-worker.js',route=>route.fulfill({contentType:'text/javascript',body:`
 let active=null;
 self.onmessage=({data})=>{
  if(data.type==='load')postMessage(${loadError?"{type:'error',message:'Model fixture could not load'}":"{type:'ready'}"});
  if(data.type==='analyze'){
   active=data.id;const evidence=data.text.slice(0,40);
   setTimeout(()=>postMessage({type:'result',id:data.id,sampled:false,proposal:${invalid?"{releaseAllowed:true}":"{audience:{value:'Model-proposed readers',evidence},purpose:{value:'Understand this document',evidence},textType:{value:'description',evidence},terms:[]}"}}),${delay});
  }
  if(data.type==='cancel'&&active)postMessage({type:'error',id:active,message:'Cancelled'});
 }` }));
}
async function enable(page){await page.locator('#bonsai-options').evaluate(e=>e.open=true);await page.locator('#bonsai-consent').check();await page.locator('#bonsai-load').click();}

test('paste only produces an automatic dual-standard draft without filling any form or using an external service',async({page,baseURL})=>{
 const external=[],writes=[],errors=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());if(r.url().startsWith('http')&&new URL(r.url()).origin!==new URL(baseURL).origin)external.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await loaded(page);await expect(page.locator('#profile')).toHaveValue('auto');await expect(page.locator('#standard-options')).toBeHidden();
 await page.locator('#source').fill(research);await expect(page.locator('#automatic-context')).toContainText('technical background');await settled(page);
 const r=await report(page),expected=rewrite(research,{profile:'combined',autoContext:true,textType:'auto'},resources);
 expect(r.text).toBe(expected.text);expect(r.standards).toEqual(expected.standards);expect(r.standards.screens).toHaveLength(2);
 expect(r.standards.automaticContext.fields.audience.origin).toBe('inferred-rules');expect(r.standards.vocabularyEntries).toBe(0);
 expect(r.standards.conformity.releaseAllowed).toBe(false);await expect(page.locator('#download')).toBeEnabled();
 await expect(page.locator('#source')).toHaveValue(research);await expect(page.locator('#audience')).toHaveValue('');await expect(page.locator('#purpose')).toHaveValue('');
 expect(external).toEqual([]);expect(writes).toEqual([]);expect(errors).toEqual([]);
});
test('paste a procedure and settings change automatically while quantities and negation remain',async({page})=>{
 await loaded(page);await page.locator('#source').fill(instructions);await expect(page.locator('#automatic-context')).toContainText('procedure');await settled(page);
 const r=await report(page);expect(r.standards.textType).toBe('procedure');expect(r.text).toContain('Do not exceed 5 bar.');
 await page.locator('#auto-strict').check();await page.locator('#rewrite').click();await settled(page);await expect(page.locator('#copy')).toBeDisabled();await expect(page.locator('#download')).toBeDisabled();
 expect((await report(page)).standards.conformity.strictRequested).toBe(true);
});
test('optional manual reader and type overrides are retained and clearly attributed',async({page})=>{
 await loaded(page);await page.locator('#auto-overrides').click();await expect(page.locator('#standard-options')).toBeVisible();
 await page.locator('#audience').fill('My specified readers');await page.locator('#purpose').fill('My specified task');await page.locator('#text-type').selectOption('description');
 await page.locator('#source').fill(instructions);await page.locator('#rewrite').click();await settled(page);
 const r=await report(page);expect(r.standards.audience).toBe('My specified readers');expect(r.standards.purpose).toBe('My specified task');expect(r.standards.textType).toBe('description');
 for(const f of Object.values(r.standards.automaticContext.fields))expect(f.origin).toBe('user');
});
test('Bonsai stays unloaded without consent and missing WebGPU falls back to automatic rules',async({page})=>{
 const modelRequests=[];page.on('request',r=>{if(r.url().includes('huggingface.co'))modelRequests.push(r.url());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
 await loaded(page);await page.locator('#bonsai-options').evaluate(e=>e.open=true);await expect(page.locator('#bonsai-load')).toBeDisabled();
 await enable(page);await expect(page.locator('#bonsai-status')).toContainText('no WebGPU');await page.locator('#source').fill(instructions);await settled(page);
 expect((await report(page)).standards.automaticContext.method).toBe('rules-v1');expect(modelRequests).toEqual([]);
});
test('consented model context can refine settings but never approve either standard',async({page})=>{
 await modelFixture(page);await loaded(page);await page.locator('#source').fill(research);await enable(page);
 await expect(page.locator('#automatic-context')).toContainText('Model-proposed readers');await settled(page);
 const r=await report(page);expect(r.standards.automaticContext.method).toBe('bonsai2+rules-v1');expect(r.standards.automaticContext.fields.audience.origin).toBe('inferred-bonsai2');
 expect(r.standards.conformity.conformityVerified).toBe(false);expect(r.standards.vocabularyEntries).toBe(0);await expect(page.locator('#source')).toHaveValue(research);
 await page.locator('#bonsai-unload').click();await expect(page.locator('#automatic-context')).toContainText('Automatic rules');expect((await report(page)).standards.automaticContext.method).toBe('rules-v1');
});
test('an approval-shaped or ungrounded model reply is rejected without losing the rules draft',async({page})=>{
 await modelFixture(page,{invalid:true});await loaded(page);await page.locator('#source').fill(research);await enable(page);
 await expect(page.locator('#bonsai-status')).toContainText('Unsupported model context field');await settled(page);
 const r=await report(page);expect(r.standards.automaticContext.method).toBe('rules-v1');expect(r.standards.conformity.releaseAllowed).toBe(false);expect(r.text).toBe(rewrite(research,{profile:'combined',autoContext:true,textType:'auto'},resources).text);
});
test('model loading errors leave paste-only rewriting and draft export usable',async({page})=>{
 await modelFixture(page,{loadError:true});await loaded(page);await enable(page);await expect(page.locator('#bonsai-status')).toContainText('could not load');
 await page.locator('#source').fill(instructions);await settled(page);await expect(page.locator('#download')).toBeEnabled();expect((await report(page)).standards.automaticContext.method).toBe('rules-v1');
});
test('stale model response cannot replace a newer original or publish its context',async({page})=>{
 await modelFixture(page,{delay:1500});await loaded(page);await page.locator('#source').fill(research);await enable(page);
 await expect(page.locator('#bonsai-status')).toContainText('inferring');await page.locator('#source').fill(instructions);await expect(page.locator('#automatic-context')).toContainText('procedure');
 await expect(page.locator('#automatic-context')).toContainText('Model-proposed readers',{timeout:10000});await settled(page);
 const r=await report(page);expect(r.standards.automaticContext.fields.audience.evidence).toBe(instructions.slice(0,40));await expect(page.locator('#source')).toHaveValue(instructions);expect(r.text).toContain('Do not exceed 5 bar.');
});
test('delete cache removes only the Synomizer model database and preserves other origin storage',async({page})=>{
 await loaded(page);await page.evaluate(async name=>{
  await caches.open('unrelated-proof');await caches.open(name+'-test');
  await new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);});
 },BONSAI.cacheName);
 await page.locator('#bonsai-options').evaluate(e=>e.open=true);await page.locator('#bonsai-delete').click();await expect(page.locator('#bonsai-status')).toContainText('deleted');
 const names=await page.evaluate(()=>caches.keys());expect(names).toContain('unrelated-proof');expect(names.some(n=>n.startsWith(BONSAI.cacheName))).toBe(false);
});
test('automatic controls and inferred fields fit mobile and remain keyboard accessible',async({page},info)=>{
 await loaded(page);await page.setViewportSize({width:320,height:812});await page.locator('#source').fill(research);await settled(page);
 await page.locator('#auto-overrides').focus();await page.keyboard.press('Enter');await expect(page.locator('#standard-options')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('automatic-mobile.png'),fullPage:true});
});


test('imported text also receives ready-model context without editing another field',async({page})=>{
 await modelFixture(page);await loaded(page);await enable(page);await expect(page.locator('#automatic-context')).toContainText('Model-proposed readers');
 await page.locator('#file').setInputFiles({name:'new.txt',mimeType:'text/plain',buffer:Buffer.from(instructions)});
 await expect(page.locator('#source')).toHaveValue(instructions);
 await expect(page.locator('#automatic-context')).toContainText('Model-proposed readers');
 await expect.poll(async()=> (await report(page)).standards.automaticContext.fields.audience.evidence).toBe(instructions.slice(0,40));
});

test('revoking model download consent unloads the optional worker and keeps automatic rules',async({page})=>{
 await modelFixture(page);await loaded(page);await enable(page);await expect(page.locator('#automatic-context')).toContainText('Model-proposed readers');
 await page.locator('#bonsai-consent').uncheck();await expect(page.locator('#automatic-context')).toContainText('Automatic rules');await expect(page.locator('#bonsai-load')).toBeDisabled();
 await page.locator('#auto-overrides').click();await expect(page.locator('#require-conformity')).toBeHidden();await expect(page.locator('#auto-strict')).toBeVisible();
});


test('the real model worker refuses changed remote code before any weights are requested',async({page})=>{
 const requests=[];
 await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:{},configurable:true}));
 // Only mock adapter presence; execute the production worker and hash checker.
 await page.route('**/bonsai-worker.js',async route=>{
  const response=await route.fetch(),body=await response.text();
  await route.fulfill({response,body:"Object.defineProperty(navigator,'gpu',{value:{},configurable:true});\n"+body});
 });
 await page.route(BONSAI.runtimeUrl,route=>route.fulfill({contentType:'text/html',body:'<script type="module">throw new Error("untrusted code executed");export{fake as TernaryBonsai2};</script>',headers:{'access-control-allow-origin':'*'}}));
 page.on('request',r=>{if(r.url().includes('huggingface.co'))requests.push(r.url());});
 await loaded(page);await enable(page);
 await expect(page.locator('#bonsai-status')).toContainText('runtime integrity mismatch');
 expect(requests).toEqual([BONSAI.runtimeUrl]);
 await page.locator('#source').fill(instructions);await settled(page);
 const r=await report(page);expect(r.standards.automaticContext.method).toBe('rules-v1');
 expect(r.text).toContain('Do not exceed 5 bar.');await expect(page.locator('#download')).toBeEnabled();
});
