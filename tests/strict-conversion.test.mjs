// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resources, run } from './hardening-support.mjs';
import { rewrite, rewriteVariants } from '../docs/engine.js';
import { sha256Text, sourceAnchors } from '../docs/conformity.js';
const digest=text=>createHash('sha256').update(text).digest('hex');
function compare(source,options={}) {
  const o={profile:'combined',...options};
  const args=['--json','--profile',o.profile];
  if(o.checkOnly)args.push('--check-only');
  if(o.requireConformity)args.push('--require-conformity');
  if(o.structuredLists===false)args.push('--no-structured-lists');
  if(o.arrange===false)args.push('--synonyms-only');
  if(o.textType)args.push('--text-type',o.textType);
  for(const term of o.protectedTerms||[])args.push('--protect',term);
  const native=run(args,source);
  assert.equal(native.status,o.requireConformity?3:0,native.stderr||native.error?.message);
  const cpp=JSON.parse(native.stdout),js=rewrite(source,o,resources);
  assert.deepEqual({text:js.text,changes:js.changes,standards:js.standards},
    {text:cpp.text,changes:cpp.changes,standards:cpp.standards});
  assert.equal(js.parts.map(p=>p.text).join(''),js.text);
  assert.equal(js.standards.conformity.sourceSha256,digest(source.replace(/\r\n?/g,'\n')));
  assert.equal(js.standards.conformity.draftSha256,digest(js.text));
  return js;
}
for(const size of [0,1,3,55,56,57,63,64,65,119,120,127,128,255,1024,8192]) {
  test(`SHA-256 padding and native/JS binding / ${size}`,()=>{
    const source='a'.repeat(size);
    assert.equal(sha256Text(source),digest(source));
    compare(source,{profile:'plain',checkOnly:true});
  });
}
for(const source of ['中文 é 😀','𝄞 and Ω.','abc\r\ndef\rg','"DO NOT OPEN" (the warning is active).'])
  test(`UTF-8 and normalized line ending fingerprints / ${source}`,()=>{
    assert.equal(sha256Text(source),digest(source));compare(source,{checkOnly:true});
  });
for(const profile of ['ste','plain','combined']) for(const source of [
  '', 'Use the lever.', 'xyzzy quux.', '<script>fake</script>',
  'The device may fail. No significant difference was found.',
]) test(`strict release cannot approve arbitrary input / ${profile} / ${source}`,()=>{
  const result=compare(source,{profile,requireConformity:true});
  const c=result.standards.conformity;
  assert.equal(c.decision,'blocked');assert.equal(c.releaseAllowed,false);
  assert.equal(c.conformityVerified,false);assert.equal(c.strictRequested,true);
  assert.ok(c.blockers.length>0);assert.equal(result.standards.semanticEquivalenceVerified,false);
  assert.equal(c.requirements.length,profile==='ste'?53:profile==='plain'?4:57);
  assert.ok(c.requirements.every(r=>['not-verified','attention'].includes(r.result)));
  const ste=c.requirements.filter(r=>r.standard==='ASD-STE100 Issue 9');
  assert.equal(new Set(ste.map(r=>r.rule)).size,ste.length);
  assert.ok(!ste.some(r=>r.rule==='2.3'));
  const batch=rewriteVariants(source,{profile,requireConformity:true},resources,3);
  assert.equal(batch.variants.length,1);assert.deepEqual(batch.variants[0].result,result);
});
test('metadata, fake approval flags and supplied spellings cannot promote unverified output',()=>{
  const result=rewrite('Use the lever.',{profile:'combined',requireConformity:true,
    audience:'Experienced technicians',purpose:'Open the valve',conformityVerified:true,releaseAllowed:true,
    vocabulary:[{term:'use',pos:'verb',meaning:'Employ an item',category:'general'}]},resources);
  assert.equal(result.standards.conformity.releaseAllowed,false);
  assert.match(result.standards.conformity.blockers.join(' '),/authority, completeness/);
});
test('strict CLI emits no final text and does not create or truncate output files',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'synomizer-release-'));
  try {
    const existing=path.join(dir,'existing.txt'),missing=path.join(dir,'missing.txt');
    writeFileSync(existing,'UNTOUCHED\n');
    for(const json of [false,true]) for(const filename of [existing,missing]) {
      const r=run(['--profile','combined','--require-conformity',...(json?['--json']:[]),'--output',filename],'Utilize the lever.');
      assert.equal(r.status,3,r.stderr);assert.equal(r.stdout,'');
      assert.equal(readFileSync(existing,'utf8'),'UNTOUCHED\n');assert.equal(existsSync(missing),false);
    }
    const plain=run(['--profile','plain','--require-conformity'],'Utilize the lever.');
    assert.equal(plain.status,3);assert.equal(plain.stdout,'');
    const report=run(['--profile','plain','--require-conformity','--json'],'Utilize the lever.');
    assert.equal(report.status,3);assert.equal(JSON.parse(report.stdout).text,'Use the lever.');
    const batch=run(['--profile','ste','--require-conformity','--variants','3','--json'],'Utilize the lever.');
    assert.equal(batch.status,3);assert.equal(JSON.parse(batch.stdout).variants[0].standards.conformity.releaseAllowed,false);
    const ordinary=run(['--profile','plain','--output',missing],'Utilize the lever.');
    assert.equal(ordinary.status,0,ordinary.stderr);assert.equal(readFileSync(missing,'utf8'),'Use the lever.');
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('strict mode is standards-only and invalid booleans are rejected',()=>{
  assert.notEqual(run(['--require-conformity'],'Use the lever.').status,0);
  assert.throws(()=>rewrite('Use the lever.',{requireConformity:true},resources));
  for(const options of [{requireConformity:'true'},{structuredLists:'yes'},{structuredLists:0}])
    assert.throws(()=>rewrite('Use the lever.',{profile:'combined',...options},resources));
});
for(const [source,expected] of [
  ['The protocol includes pressure, temperature and flow.','The protocol includes:\n- pressure,\n- temperature\n- and flow.'],
  ['The selection includes copper, zinc or nickel.','The selection includes:\n- copper,\n- zinc\n- or nickel.'],
  ['The protocol includes reading, writing and testing.','The protocol includes:\n- reading,\n- writing\n- and testing.'],
  ['The protocol includes 1 bar, 2 bar and 3 bar.','The protocol includes:\n- 1 bar,\n- 2 bar\n- and 3 bar.'],
  ['The assessment combines controls, measurements, and records.','The assessment combines:\n- controls,\n- measurements,\n- and records.'],
  ['The comparison shows that transfer requires control of pressure, temperature and flow.','The comparison shows that transfer requires control of:\n- pressure,\n- temperature\n- and flow.'],
]) test(`list retains all words and exact conjunction / ${source}`,()=>{
  const result=compare(source);assert.equal(result.text,expected);
  const originalWords=source.match(/[A-Za-z]+/g);assert.deepEqual(result.text.match(/[A-Za-z]+/g),originalWords);
  assert.equal(result.standards.after.sentences,4);
  assert.equal(compare(source,{structuredLists:false}).text,source);
  assert.equal(compare(source,{checkOnly:true}).text,source);
  assert.equal(compare(source,{arrange:false}).text,source);
});
for(const source of [
  'The protocol only includes pressure, temperature and flow.',
  'The protocol does not include pressure, temperature and flow.',
  'If the system starts, the protocol includes pressure, temperature and flow.',
  'The protocol includes copper, zinc or nickel and iron.',
  'The display includes red, blue and green lamps.',
  'The sensor includes upper, lower and side panels.',
  'The protocol includes pressure, temperature and flow unless the valve fails.',
  'The protocol includes "pressure, temperature and flow".',
]) test(`unsupported list scope is preserved / ${source}`,()=>{
  assert.equal(compare(source).text,source);
});
test('following prose cannot become part of the final list item',()=>{
  const source='The protocol includes pressure, temperature and flow. The sample is intact.';
  const result=compare(source);
  assert.equal(result.text,'The protocol includes:\n- pressure,\n- temperature\n- and flow.\n\nThe sample is intact.');
  assert.equal(result.standards.after.sentences,5);
  assert.equal(compare(source,{protectedTerms:['pressure']}).text,source);
});
for(const [source,expected] of [
  ['The study provides a benchmark: it demonstrates the result.','The study provides a benchmark. It demonstrates the result.'],
  ['The methods provide alternatives, but retain limitations.','The methods provide alternatives. But the methods retain limitations.'],
]) test(`reviewed descriptive structure / ${source}`,()=>assert.equal(compare(source).text,expected));
for(const source of [
  'Some methods provide alternatives, but retain limitations.',
  'The study may provide a benchmark: it demonstrates the result.',
  'The operator believes the study provides a benchmark: it demonstrates the result.',
  'The study provides no benchmark: it demonstrates no result.',
  'The study suggests the method works, but the test is incomplete.',
]) test(`descriptive rewrite does not drop scope / ${source}`,()=>assert.equal(compare(source).text,source));
for(const [source,words,longest,sentences] of [
  ['The temperature is 25 degrees Celsius.',4,4,1],
  ['The device weighs 12 kg.',4,4,1],
  ['Read "DO NOT OPEN" before the test.',5,5,1],
  ['Read “DO NOT OPEN” before the test.',5,5,1],
  ['The cover is closed (the light is off).',9,5,2],
  ['Remove the pin (12).',4,4,1],
  ['Inspect:\n- The cover,\n- the valve\n- and the lever.',8,3,4],
  ['1. Inspect the panel.\n2) Remove the cover.',6,3,2],
]) test(`grouped STE screening / ${source}`,()=>{
  const r=compare(source,{profile:'ste',checkOnly:true});
  assert.equal(r.standards.after.words,words);assert.equal(r.standards.after.longestSentence,longest);
  assert.equal(r.standards.after.sentences,sentences);assert.equal(r.standards.estimatedCounts,true);
});
test('declared names and titles count as one; technical noun groups are not automatically one',()=>{
  const source='Consult the Delta Service Team.';
  const plain=rewrite(source,{profile:'ste',checkOnly:true},resources);
  const name=rewrite(source,{profile:'ste',checkOnly:true,vocabulary:[{term:'Delta Service Team',pos:'noun',meaning:'A local organization',category:'name'}]},resources);
  const term=rewrite(source,{profile:'ste',checkOnly:true,vocabulary:[{term:'Delta Service Team',pos:'noun',meaning:'A local technical term',category:'technical-noun'}]},resources);
  assert.equal(name.standards.after.words,3);assert.equal(plain.standards.after.words,5);assert.equal(term.standards.after.words,5);
});
test('unmatched delimiters and nested parentheses are bounded and not approved',()=>{
  for(const text of ['('.repeat(12000)+'Read the label.','“'.repeat(8000)+'Read the label.','('.repeat(32)+'the light is on'+')'.repeat(32)+'.']) {
    const result=compare(text,{checkOnly:true});assert.equal(result.text,text);
    assert.equal(result.standards.conformity.releaseAllowed,false);
  }
});
test('parenthetical overflow and unresolved semicolon remain author-review findings',()=>{
  const text='The cover is closed ('+'word '.repeat(30).trim()+').';
  const r=compare(text,{profile:'ste',checkOnly:true});
  assert.ok(r.standards.findings.some(f=>f.code==='STE-8.5'));assert.equal(r.standards.after.longSentences,1);
  const semi=compare('The report suggests a link; the evidence is incomplete.',{profile:'ste',checkOnly:true});
  assert.ok(semi.standards.findings.some(f=>f.code==='STE-8.1'));
  assert.equal(semi.standards.conformity.requirements.find(r=>r.rule==='8.1').result,'attention');
});


test('numeric and modal sentinels survive permitted contraction expansion',()=>{
  assert.deepEqual(sourceAnchors("The operator can't exceed 3.5 bar or 4,000 rpm."),sourceAnchors('The operator cannot exceed 3.5 bar or 4,000 rpm.'));
  assert.deepEqual(sourceAnchors("She won't stop."),sourceAnchors('She will not stop.'));
  for(const text of ["Don't remove the pin.","The operator shouldn't exceed 5 bar.","The tool can't open the valve."]){
    const r=compare(text);assert.equal(r.standards.conformity.markerCheck,'matched');
  }
});
test('a proposed modality change restores the whole draft, not a partial edit',()=>{
  const unsafe={...resources,clarityRules:[{source:['must'],target:'may',guard:'any'}]};
  const source='The operator must stop.';
  const r=rewrite(source,{profile:'combined'},unsafe);
  assert.equal(r.text,source);assert.deepEqual(r.changes,[]);
  assert.equal(r.standards.conformity.markerCheck,'mismatch-rolled-back');
  assert.ok(r.standards.findings.some(f=>f.code==='CONVERSION-ROLLBACK'));
  assert.equal(r.parts.map(p=>p.text).join(''),source);
  assert.equal(r.standards.conformity.conformityVerified,false);
});
