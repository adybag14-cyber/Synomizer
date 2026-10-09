// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {rewrite,parseVocabulary} from '../docs/engine.js';
import {sha256Text,sourceAnchors} from '../docs/conformity.js';
import {resources,run} from './hardening-support.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
function check(source,options={},expected) {
  const o={profile:'combined',...options},args=['--json','--profile',o.profile];
  if(o.checkOnly)args.push('--check-only');
  if(o.requireConformity)args.push('--require-conformity');
  if(o.structuredLists===false)args.push('--no-structured-lists');
  if(o.arrange===false)args.push('--synonyms-only');
  for(const term of o.protectedTerms||[])args.push('--protect',term);
  const native=run(args,source);assert.equal(native.status,o.requireConformity?3:0,native.stderr||native.error?.message);
  const cpp=JSON.parse(native.stdout),js=rewrite(source,o,resources);
  assert.deepEqual({text:js.text,changes:js.changes,standards:js.standards},{text:cpp.text,changes:cpp.changes,standards:cpp.standards});
  assert.equal(js.parts.map(p=>p.text).join(''),js.text);
  if(expected!==undefined)assert.equal(js.text,expected);
  assert.deepEqual(sourceAnchors(source),sourceAnchors(js.text));
  const c=js.standards.conformity;
  assert.equal(c.decision,'blocked');assert.equal(c.conformityVerified,false);assert.equal(c.releaseAllowed,false);
  assert.equal(c.sourceSha256,hash(source.replace(/\r\n?/g,'\n')));assert.equal(c.draftSha256,hash(js.text));
  return js;
}
const positives=[
 ['The assessment includes precision, stability and repeatability.','The assessment includes the following:\n- precision,\n- stability,\n- and repeatability.\n\n'],
 ['The process requires control of temperature, pressure or flow.','The process requires control of the following:\n- temperature,\n- pressure,\n- or flow.\n\n'],
 ['The study combines appropriate positive controls, progress measurements and structural assignment.','The study combines the following:\n- appropriate positive controls,\n- progress measurements,\n- and structural assignment.\n\n'],
 ['The report says the assessment includes precision, stability and repeatability.','The report says the assessment includes the following:\n- precision,\n- stability,\n- and repeatability.\n\n'],
 ['The system contains red, blue, and green.','The system contains the following:\n- red,\n- blue,\n- and green.\n\n'],
 ['The method provides useful alternatives, but its sustainability depends on the process.','The method provides useful alternatives. But its sustainability depends on the process.'],
 ['The methods provide useful alternatives, but retain significant limitations.','The methods provide useful alternatives. But the methods retain significant limitations.'],
 ['The study provides the closest benchmark: it already demonstrates the method.','The study provides the closest benchmark. It already demonstrates the method.'],
];
for(const profile of ['ste','plain','combined'])for(const [source,expected] of positives)
 test(`converter independently expected draft / ${profile} / ${source}`,()=>check(source,{profile},expected));
const negatives=[
 'The system contains red, blue and green lights.',
 'The material contains sodium, potassium and calcium chloride.',
 'The method includes precision, stability and repeatability under pressure.',
 'The report may provide results, but its meaning depends on the context.',
 'The analyst claims the method provides results, but the system contains errors.',
 'The methods do not provide results, but retain limitations.',
 'The study provides no results: it requires more work.',
 'All methods provide useful alternatives, but retain significant limitations.',
 'If the method provides results, but the system contains errors, stop the test.',
 'The system contains red and blue, green and yellow.',
 'The system contains red, blue or green and yellow.',
 'The method includes "precision, stability and repeatability".',
 '`The method contains red, blue and green.`',
 'The method includes 5 mm, 10 mm and 15 mm.',
 'The method includes precision, stability or repeatability?',
 'The engineer has said the method provides results, but the system contains errors.',
];
for(const profile of ['ste','plain','combined'])for(const source of negatives)
 test(`converter retains unresolved semantics / ${profile} / ${source}`,()=>check(source,{profile},source));

test('formatting does not absorb the next sentence into a list item',()=>{
 const r=check('The assessment includes precision, stability and repeatability. The system is ready.');
 assert.match(r.text,/and repeatability\.\n\nThe system is ready\.$/);
 assert.equal(r.standards.after.sentences,5);
});
test('list settings, check-only and protected terms retain their meaning',()=>{
 const source=positives[0][0];
 check(source,{structuredLists:false},source);
 check(source,{checkOnly:true},source);
 check(source,{arrange:false},source);
 check(source,{protectedTerms:['precision']},source);
});

for(const [source,expected] of [
 ['The unit weighs 20 kg.',4],
 ['The temperature is 10 degrees Celsius.',4],
 ['The temperature is 10 °C.',4],
 ['Use the high-pressure valve.',4],
 ['The label is "Do not open the cover".',4],
 ['Use the lever (the red one).',4],
])test(`grouped count is bounded and paired / ${source}`,()=>{
 const r=check(source,{profile:'ste',checkOnly:true});
 assert.equal(r.standards.after.longestSentence,expected);
 assert.equal(r.standards.estimatedCounts,true);
});
test('unresolved semicolons and parenthetical inner counts remain review tasks',()=>{
 const r=check('The system may fail; the technician must stop (before the test starts).',{profile:'ste',checkOnly:true});
 assert.ok(r.standards.findings.some(f=>f.code==='STE-8.1'));
 assert.ok(r.standards.findings.some(f=>f.code==='STE-8.5'));
});
test('requirements are an inventory, never an implied pass or certificate',()=>{
 for(const profile of ['ste','plain','combined'])for(const source of ['', 'Use the lever.', 'Unknownphrase xyzzy.', 'The valve was opened.']) {
  const r=check(source,{profile,requireConformity:true});
  const c=r.standards.conformity,ste=c.requirements.filter(x=>x.standard.startsWith('ASD'));
  assert.equal(ste.length,profile==='plain'?0:53);
  assert.equal(c.requirements.length,profile==='ste'?53:profile==='plain'?4:57);
  assert.ok(!ste.some(x=>x.rule==='2.3'));
  assert.equal(new Set(c.requirements.map(x=>x.standard+'/'+x.rule)).size,c.requirements.length);
  assert.ok(c.requirements.every(x=>['not-verified','attention'].includes(x.result)));
  assert.ok(c.blockers.length>0);
 }
});
test('filling reader metadata and a glossary cannot manufacture conformity',()=>{
 const vocabulary=parseVocabulary('use\tverb\tEmploy an item\tgeneral\nthe\tarticle\tSpecify an item\tgeneral\nlever\tnoun\tLocal component\ttechnical-noun\n');
 const r=rewrite('Use the lever.',{profile:'combined',audience:'Technicians',purpose:'Operate a lever',vocabulary,requireConformity:true},resources);
 assert.equal(r.standards.conformity.releaseAllowed,false);
 assert.equal(r.standards.conformity.conformityVerified,false);
});
for(const text of ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(63), 'x'.repeat(64), 'x'.repeat(65), 'café 中文 °C', '∑'.repeat(1000)])
 test(`SHA256 agrees with independent implementation / ${text.length}`,()=>{
  assert.equal(sha256Text(text),hash(text));
  const r=check(text,{profile:'plain',checkOnly:true});
  assert.equal(r.standards.conformity.draftSha256,hash(text));
 });
test('changing a logical marker in a rule triggers complete draft rollback',()=>{
 const injected={...resources,clarityRules:[{source:['must'],target:'may',guard:'any'},...resources.clarityRules]};
 const source='The technician must open the valve. Utilize the lever.';
 const r=rewrite(source,{profile:'combined'},injected);
 assert.equal(r.text,source);assert.deepEqual(r.changes,[]);
 assert.equal(r.parts.map(p=>p.text).join(''),source);
 assert.equal(r.standards.conformity.invariantCheck,'failed-rolled-back');
 assert.ok(r.standards.findings.some(f=>f.code==='CONVERSION-ROLLBACK'));
});
test('strict CLI never creates or truncates an output file on a blocked decision',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'synomizer-release-'));
 try {
  for(const profile of ['ste','plain','combined'])for(const json of [false,true])for(const count of ['1','3']) {
   const existing=path.join(dir,'existing.txt'),missing=path.join(dir,'missing.txt');
   writeFileSync(existing,'keep the original bytes\n');
   for(const file of [existing,missing]) {
    const r=run(['--profile',profile,'--require-conformity','--variants',count,...(json?['--json']:[]),'--output',file], 'The valve was opened by the technician.');
    assert.equal(r.status,3,r.stderr);assert.equal(r.stdout,'');
    assert.equal(readFileSync(existing,'utf8'),'keep the original bytes\n');assert.equal(existsSync(missing),false);
   }
  }
  const r=run(['--profile','combined','--require-conformity'],'Use the lever.');
  assert.equal(r.status,3);assert.equal(r.stdout,'');assert.match(r.stderr,/release blocked/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test('strict options validate; absence of content never produces a pass',()=>{
 assert.notEqual(run(['--require-conformity'],'Use the lever.').status,0);
 assert.throws(()=>rewrite('Use the lever.',{requireConformity:true},resources));
 for(const o of [{profile:'ste',requireConformity:'yes'},{profile:'ste',structuredLists:'false'}])assert.throws(()=>rewrite('Text.',o,resources));
 const r=check('',{profile:'ste',requireConformity:true});assert.ok(r.standards.conformity.blockers.some(x=>x.includes('No assessable')));
});


test('unmatched delimiters in long arbitrary input have bounded native/browser counting',()=>{
 const source='(word '.repeat(16000)+'.';
 const r=check(source,{profile:'combined',checkOnly:true});
 assert.equal(r.text,source);assert.equal(r.standards.after.longestSentence,16000);
 assert.equal(r.standards.conformity.releaseAllowed,false);
});

test('authorized multiword terminology is not split internally by a structure rewrite',()=>{
 const source='The process requires control of pressure, temperature and flow.';
 const tsv='control of pressure\tnoun\tA technical term\ttechnical-noun\n';
 const vocabulary=parseVocabulary(tsv);
 const js=rewrite(source,{profile:'combined',vocabulary},resources);
 assert.equal(js.text,source);assert.deepEqual(js.changes,[]);
 const dir=mkdtempSync(path.join(tmpdir(),'synomizer-term-lock-'));
 try {
  const file=path.join(dir,'terms.tsv');writeFileSync(file,tsv);
  const native=run(['--profile','combined','--json','--vocabulary',file],source);
  assert.equal(native.status,0,native.stderr);const cpp=JSON.parse(native.stdout);
  assert.equal(cpp.text,source);assert.deepEqual(cpp.standards,js.standards);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
