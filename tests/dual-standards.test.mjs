// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {rewrite,rewriteVariants} from '../docs/engine.js';
import {resources,run} from './hardening-support.mjs';
const digest=text=>createHash('sha256').update(text).digest('hex');
function check(text,options={}) {
 const o={profile:'combined',...options};
 const args=['--json','--profile',o.profile];
 if(o.checkOnly)args.push('--check-only');
 if(o.requireConformity)args.push('--require-conformity');
 if(o.textType)args.push('--text-type',o.textType);
 if(o.structuredLists===false)args.push('--no-structured-lists');
 if(o.arrange===false)args.push('--synonyms-only');
 if(o.audience)args.push('--audience',o.audience);
 if(o.purpose)args.push('--purpose',o.purpose);
 for(const term of o.protectedTerms||[])args.push('--protect',term);
 const native=run(args,text);assert.equal(native.status,o.requireConformity?3:0,native.stderr||native.error?.message);
 const cpp=JSON.parse(native.stdout),js=rewrite(text,o,resources);
 assert.deepEqual({text:js.text,changes:js.changes,standards:js.standards},{text:cpp.text,changes:cpp.changes,standards:cpp.standards});
 assert.equal(js.parts.map(p=>p.text).join(''),js.text);
 return js;
}
const cases=[
 'The valve was opened by the technician. Utilize the lever. Do not exceed 5 bar.',
 'The assessment includes precision, stability and repeatability.',
 'The process requires control of temperature, pressure or flow.',
 'The analyst has said the valve is open, and the light is on.',
 'The valve may be opened by the technician.',
 'The method provides alternatives, but its sustainability depends on the process.',
 'The operator must monitor the system for the duration of the test.',
 'The cover was removed. The result is not universal.',
 'Read "DO NOT OPEN" before the test. The temperature is 10 degrees Celsius.',
 '中文 café.\r\nThe label is intact.',
 '',
];
for(const text of cases)for(const extra of [{},{checkOnly:true},{textType:'procedure'},{structuredLists:false},{arrange:false},{requireConformity:true}])
 test(`dual screens bind one draft / ${text} / ${JSON.stringify(extra)}`,()=>{
  const o={...extra,audience:'New technicians',purpose:'Inspect the equipment'};
  const combined=check(text,o),screens=combined.standards.screens;
  assert.deepEqual(screens.map(s=>s.profile),['ste','plain']);
  assert.equal(combined.standards.audience,o.audience);assert.equal(combined.standards.purpose,o.purpose);
  for(const screen of screens) {
   assert.equal(screen.draftSha256,digest(combined.text));
   assert.equal(screen.draftSha256,combined.standards.conformity.draftSha256);
   assert.equal(screen.status,'review-required');assert.equal(screen.estimatedCounts,true);
   const solo=rewrite(text,{...o,profile:screen.profile},resources);
   assert.equal(solo.text,combined.text);assert.deepEqual(solo.changes,combined.changes);
   assert.deepEqual(screen,solo.standards.screens[0]);
   const finalOnly=rewrite(combined.text,{...o,profile:screen.profile,checkOnly:true},resources);
   assert.deepEqual(screen.after,finalOnly.standards.after);
  }
  assert.equal(combined.standards.semanticEquivalenceVerified,false);
  assert.equal(combined.standards.conformity.releaseAllowed,false);
  assert.equal(combined.standards.conformity.requirements.length,57);
 });
test('combined review does not hide plain-language length concerns behind STE quote grouping',()=>{
 const text='The label says "'+Array(30).fill('word').join(' ')+'".';
 const r=check(text,{checkOnly:true});const [ste,plain]=r.standards.screens;
 assert.equal(ste.after.longestSentence,4);assert.equal(ste.after.longSentences,0);
 assert.equal(plain.after.longestSentence,33);assert.equal(plain.after.longSentences,1);
 assert.ok(plain.findings.some(f=>f.code==='PL-SENTENCE'));
 assert.match(plain.countingBasis,/advisory, not an ISO requirement/);
 assert.ok(!ste.findings.some(f=>f.code.startsWith('ISO-')));
 assert.ok(!plain.findings.some(f=>f.code.startsWith('STE-')));
});
test('procedural STE target and plain-language advisory target remain independent',()=>{
 const text=Array(21).fill('word').join(' ')+'.';
 const r=check(text,{textType:'procedure',checkOnly:true});const [ste,plain]=r.standards.screens;
 assert.equal(ste.sentenceTarget,20);assert.equal(plain.sentenceTarget,25);
 assert.equal(ste.after.longSentences,1);assert.equal(plain.after.longSentences,0);
 assert.ok(ste.findings.some(f=>f.code==='STE-5.1'));
});
test('combined structural pass respects terminology, conditions, negation and disjunction',()=>{
 const original='The process requires control of pressure, temperature or flow. Do not exceed 5 bar.';
 const protectedResult=check(original,{protectedTerms:['control of pressure']});assert.equal(protectedResult.text,original);
 const r=check(original);assert.match(r.text,/- or flow\./);assert.match(r.text,/Do not exceed 5 bar\.$/);
 const batch=rewriteVariants(original,{profile:'combined',seed:'18446744073709551615',style:'recast',intensity:2},resources,3);
 assert.equal(batch.variants.length,1);assert.equal(batch.variants[0].result.text,r.text);
 assert.equal(batch.variants[0].result.standards.screens.length,2);
});
test('single standards expose only their own review perspective and variation exposes neither',()=>{
 for(const profile of ['ste','plain'])assert.deepEqual(check('Use the lever.',{profile}).standards.screens.map(s=>s.profile),[profile]);
 assert.equal(rewrite('The happy child bought a car.',{},resources).standards,undefined);
});
test('dual reporting is bounded for a long passage without dropping complete metrics',()=>{
 const source='The cover was removed. '.repeat(700);
 const r=check(source,{checkOnly:true});assert.equal(r.text,source);
 for(const screen of r.standards.screens){assert.equal(screen.after.sentences,700);assert.ok(screen.findings.length<=251);}
});
