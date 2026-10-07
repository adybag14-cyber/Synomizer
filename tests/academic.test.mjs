// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resources, run } from './hardening-support.mjs';
import { rewrite, rewriteVariants, loadResources } from '../docs/engine.js';

function args(options) {
  const a=['--json','--seed',String(options.seed??1),'--intensity',String(options.intensity??1),'--style',options.style??'balanced'];
  if(options.synonyms===false && options.arrange===false) a.push('--no-rewrite');
  else if(options.synonyms===false) a.push('--arrange-only');
  else if(options.arrange===false) a.push('--synonyms-only');
  if(options.protectQuotes===false)a.push('--vary-quotes');
  for(const term of options.protectedTerms??[])a.push('--protect',term);
  return a;
}
function single(text,options={}) {
  const native=run(args(options),text);assert.equal(native.status,0,native.stderr||native.error?.message);
  const cpp=JSON.parse(native.stdout), js=rewrite(text,options,resources);
  assert.deepEqual({text:js.text,changes:js.changes},{text:cpp.text,changes:cpp.changes});
  assert.equal(js.parts.map(p=>p.text).join(''),js.text);
  return js;
}
function batch(text,options={}) {
  const native=run([...args(options),'--variants','3'],text);assert.equal(native.status,0,native.stderr||native.error?.message);
  const cpp=JSON.parse(native.stdout), js=rewriteVariants(text,options,resources);
  assert.equal(js.attempts,cpp.attempts);assert.ok(js.attempts<=12);
  assert.deepEqual(js.variants.map(v=>({seed:v.seed,style:v.style,text:v.result.text,changes:v.result.changes})),
    cpp.variants.map(({version,...v})=>v));
  assert.equal(new Set(js.variants.map(v=>v.result.text)).size,js.variants.length);
  for(const v of js.variants)assert.deepEqual(rewrite(text,{...options,seed:v.seed,style:v.style},resources),v.result);
  return js;
}
const structures=[
 ['The results suggest that the model may fail.','The model may fail, as suggested by the results.'],
 ['The evidence indicates that the response can vary.','The response can vary, as indicated by the evidence.'],
 ['Full-text comparison shows that transfer requires control of temperature and timing.','Transfer requires control of temperature and timing, as shown by full-text comparison.'],
 ['Recent methods broaden the comparison while preserving uncertainty.','While preserving uncertainty, recent methods broaden the comparison.'],
 ['The algorithm is therefore a candidate for further testing.','Therefore, the algorithm is a candidate for further testing.'],
 ['A verification strategy is proposed that includes boundary cases.','A verification strategy that includes boundary cases is proposed.'],
 ['A staged assessment is proposed that combines controls and measurements.','A staged assessment that combines controls and measurements is proposed.'],
];
for(const [input,expected] of structures) test(`academic structure with exact strength / ${input}`,()=>{
  const result=single(input,{style:'recast',synonyms:false});assert.equal(result.text,expected);
  assert.equal(result.changes.filter(c=>c.kind==='arrangement').length,1);
  assert.equal(result.changes.filter(c=>c.kind==='phrase').length,0);
  assert.equal(single(input,{style:'close',synonyms:false}).text,input);
  assert.equal(single(input,{style:'recast',synonyms:false,arrange:false}).text,input);
});

const phrases=[
 ['This review examines whether the models work.','examines whether'],
 ['This analysis examines how the models work.','examines how'],
 ['The study examined whether the devices worked.','examined whether'],
 ['The study examined how the devices worked.','examined how'],
 ['The mechanism remains to be established.','remains to be'],
 ['The mechanisms remain to be established.','remain to be'],
 ['The mechanism remained to be established.','remained to be'],
 ['Reliability depends on reproducibility.','depends on'],
 ['Reliable testing requires control of temperature.','requires control of'],
 ['The protocols require control of temperature.','require control of'],
 ['The protocols provide substantial alternatives.','provide substantial alternatives'],
 ['The procedure provides substantial alternatives.','provides substantial alternatives'],
 ['The results provide evidence for the model.','provide evidence for'],
 ['The analysis provides evidence for the model.','provides evidence for'],
 ['The findings support a stochastic interpretation.','support'],
 ['The evidence supports a stochastic interpretation.','supports'],
 ['Earlier research provides the closest identified benchmark.','provides'],
 ['The results provide a benchmark.','provide'],
 ['A research opportunity emerged.','research opportunity'],
 ['New research opportunities emerged.','research opportunities'],
 ['The process offers a practical route to reusable structures.','a practical route to'],
 ['The framework for the present project remains unspecified.','the present project'],
 ['The present study evaluates the proposal.','the present study'],
 ['The present review evaluates the proposal.','the present review'],
 ['The present analysis evaluates the proposal.','the present analysis'],
 ['The outcome as compared with the baseline was recorded.','as compared with'],
 ['The outcome with respect to the baseline was recorded.','with respect to'],
];
for(const [text,source] of phrases)for(const seed of ['1','42','18446744073709551615'])test(`academic phrase / ${source} / ${seed}`,()=>{
  const result=single(text,{seed,arrange:false});
  const change=result.changes.find(c=>c.kind==='phrase'&&c.before.toLowerCase()===source);
  assert.ok(change,result.text);
  const rule=resources.academicRules.find(r=>r.forms[0]===source);assert.ok(rule);
  assert.ok(rule.forms.slice(1).includes(change.after.toLowerCase()),change.after);
  assert.ok(!result.changes.some(c=>c.kind==='arrangement'));
});
test('compound expansion fixes its preceding article',()=>{
 assert.equal(single('A research opportunity emerged.',{arrange:false}).text,'An opportunity for research emerged.');
});

test('academic table is fully covered and schema rejects invalid rows',()=>{
 assert.deepEqual(new Set(phrases.map(p=>p[1])),new Set(resources.academicRules.map(r=>r.forms[0])));
 for(const line of ['@academic\tbogus\ta|b\t1','@academic\tlocal\ta\t1','@academic\tlocal\ta|b\t9'])
   assert.throws(()=>loadResources(line,''),TypeError);
});

const unchangedStructures=[
 'The results do not show that the model works.',
 'The results only suggest that the model may fail.',
 'The results suggest that the model fails because the input is incomplete.',
 'The results suggest that the author said that the model works.',
 'The results suggest that the model may fail; the evaluation continues.',
 'The results show that the model works?',
 'The results show that\nthe model works.',
 '"The results show that the model works."',
 'The results at https://example.test/ show that the model works.',
 'The results constructor that the model may fail.',
 'The method is therefore not valid.',
 'The method is only therefore a candidate.',
 'A strategy is proposed that includes a claim that lacks evidence.',
 'Recent methods broaden the comparison while preserving uncertainty while reducing cost.',
];
for(const input of unchangedStructures)test(`academic structure refuses ambiguity / ${input}`,()=>{
 const r=single(input,{synonyms:false,style:'recast'});assert.equal(r.text,input);
});
const noAcademic=[
 'The mechanism does not remain to be established.',
 'The mechanism has remained to be established.',
 'She stayed to be interviewed.',
 'The remains to be buried were identified.',
 'The employee offers a practical route to increasing revenue.',
 'The process offers a practical route to recovering materials.',
 'The findings offer a practical route to town.',
 'The beam supports the roof.',
 'The vendor provides a benchmark report.',
 'The vendor provides a benchmark.',
 'The commander requires control of the army.',
 'John remains to be interviewed.',
 'Research opportunity costs were calculated.',
 'The results only support the hypothesis.',
 'This review examines whether the models work?',
];
for(const input of noAcademic)test(`academic phrase rejects wrong frame / ${input}`,()=>{
 for(const style of ['balanced','close','recast']) {
   const r=single(input,{style});assert.ok(!r.changes.some(c=>c.kind==='phrase'&&c.detail.startsWith('Guarded academic')),r.text);
 }
});

for(const text of ['The framework remains to be established.','The framework remained to be established.','She stayed to be interviewed.','This review examines whether the model works.','A significant difference was reported.']) {
 for(const seed of ['1','9','42','18446744073709551615'])for(const intensity of [0,1,2])test(`complement and qualifier preserved across candidates / ${text} / ${seed} / ${intensity}`,()=>{
  for(const v of batch(text,{seed,intensity}).variants) {
   assert.doesNotMatch(v.result.text,/\bstays? to be\b|\bstayed to be established\b|\binspects? whether\b|important difference/);
   if(text.includes('stayed'))assert.ok(v.result.text.includes('stayed to be interviewed'));
   if(text.includes('significant'))assert.ok(v.result.text.includes('significant'));
  }
 });
}
const paragraph=readFileSync(new URL('./fixtures/academic-prose.txt',import.meta.url),'utf8');
for(const seed of ['1','2','42','18446744073709551615'])test(`academic passage has real phrase and structural coverage / ${seed}`,()=>{
 const b=batch(paragraph,{seed});assert.equal(b.variants.length,3);
 const recast=b.variants.find(v=>v.style==='recast');assert.ok(recast);
 assert.ok(recast.result.changes.filter(c=>c.kind==='arrangement').length>=4);
 assert.ok(recast.result.changes.filter(c=>c.kind==='phrase').length>=8);
 for(const v of b.variants) {
   for(const term of ['unfamiliar datasets','reproducibility','rather than a universal','preserving uncertainty']) assert.ok(v.result.text.includes(term),v.result.text);
   assert.doesNotMatch(v.result.text,/stays to be|inspects whether|proves/);
 }
 const close=b.variants.find(v=>v.style==='close');assert.ok(close);
 assert.ok(!close.result.changes.some(c=>c.kind==='phrase'||c.kind==='arrangement'));
});
test('term locks, quotes, low intensity and operation switches constrain the new phases',()=>{
 const text='The results suggest that ModelQ may fail. This review examines whether ModelQ can be transferred. The method remains to be established.';
 const options={protectedTerms:['ModelQ','remains to be']};
 for(const v of batch(text,options).variants){assert.ok(v.result.text.includes('ModelQ may fail'));assert.ok(v.result.text.includes('remains to be'));assert.ok(!v.result.changes.some(c=>c.kind==='arrangement'||c.kind==='phrase'));}
 for(const v of batch('"'+paragraph.trim()+'"',{}).variants)assert.equal(v.result.text,'"'+paragraph.trim()+'"');
 for(const v of batch(paragraph,{intensity:0}).variants)assert.ok(!v.result.changes.some(c=>c.detail.startsWith('Guarded academic')));
});
test('long academic input remains bounded and byte-equivalent across engines',()=>{
 const text='the present study evaluates the procedure, '.repeat(1500)+'therefore therefore that that.';
 const result=single(text,{style:'recast'});
 assert.ok(result.text.length>20000);assert.equal(result.text.split('This study').length+result.text.split('this study').length>1000,true);
});

test('source-aware ranking does not prefer a two-edit near-copy over available light-touch alternatives',()=>{
 const b=batch(paragraph,{seed:'1'}),close=b.variants.find(v=>v.style==='close');
 assert.ok(close);assert.ok(close.result.changes.length>=3,close.result.text);
 assert.ok(!close.result.changes.some(c=>c.kind==='phrase'||c.kind==='arrangement'));
});
