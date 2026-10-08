// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// Reconciled count cases from the preserved PR9 prototype. Raw word totals are
// intentionally distinct from grouped sentence/unit lengths in this release.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {rewrite,parseVocabulary} from '../docs/engine.js';
import {resources,run} from './hardening-support.mjs';
function check(text,profile='ste',tsv='') {
 const dir=mkdtempSync(path.join(tmpdir(),'synomizer-count-'));
 try {
  const args=['--profile',profile,'--check-only','--json'];
  if(tsv){const file=path.join(dir,'terms.tsv');writeFileSync(file,tsv);args.push('--vocabulary',file);}
  const native=run(args,text);assert.equal(native.status,0,native.stderr||native.error?.message);
  const cpp=JSON.parse(native.stdout),js=rewrite(text,{profile,checkOnly:true,vocabulary:parseVocabulary(tsv)},resources);
  assert.equal(js.text,text);assert.equal(cpp.text,text);
  assert.deepEqual(cpp.standards,js.standards);assert.deepEqual(cpp.changes,[]);
  assert.equal(js.standards.conformity.conformityVerified,false);assert.equal(js.standards.estimatedCounts,true);
  return js.standards;
 } finally {rmSync(dir,{recursive:true,force:true});}
}
for(const [text,longest,units] of [
 ['The temperature is 25 degrees Celsius.',4,1],
 ['The device weighs 12 kg.',4,1],
 ['Read "DO NOT OPEN" before the test.',5,1],
 ['Read “DO NOT OPEN” before the test.',5,1],
 ["Read 'DO NOT OPEN' before the test.",5,1],
 ['Read ‘DO NOT OPEN’ before the test.',5,1],
 ['The cover is closed (the light is off).',5,2],
 ['Remove the pin (12).',4,1],
 ['Inspect:\n- The cover,\n- the valve\n- and the lever.',3,4],
 ['1. Inspect the panel.\n2) Remove the cover.',3,2],
 ['1.5 bar is sufficient.',3,1],
 ['Inspect:\n* The cover,\n+ the valve.',2,3],
])test(`grouped screening and step-marker parity / ${text}`,()=>{
 const r=check(text);assert.equal(r.after.longestSentence,longest);assert.equal(r.after.sentences,units);
 if(text==='1.5 bar is sufficient.')assert.equal(r.after.words,4); // Measurement is one grouped unit, not a numbered step.
});
test('supplied names and titles affect grouping; technical noun groups are not silently collapsed',()=>{
 const text='Consult the Delta Service Team.';
 for(const category of ['name','title','technical-noun']) {
  const r=check(text,'ste',`Delta Service Team\tnoun\tA local organization\t${category}\n`);
  assert.equal(r.after.longestSentence,category==='technical-noun'?5:3);
  assert.equal(r.after.words,5); // Raw words are still visible in this diagnostic field.
 }
 assert.equal(check(text).after.longestSentence,5);
});
test('parenthetical overflow cannot hide behind a short outer sentence',()=>{
 const text='The cover is closed ('+'word '.repeat(30).trim()+').';
 const r=check(text);assert.equal(r.after.longestSentence,30);assert.equal(r.after.longSentences,1);
 assert.ok(r.findings.some(f=>f.code==='STE-8.5'&&f.message.includes('exceeds')));
});
test('plain-language heuristics do not inherit STE quote grouping',()=>{
 const text='Read "DO NOT OPEN" before the test.';
 assert.equal(check(text,'ste').after.longestSentence,5);
 assert.equal(check(text,'plain').after.longestSentence,7);
});
test('deep nesting and unmatched quote/parenthesis inputs stay bounded and unapproved',()=>{
 for(const text of ['('.repeat(12000)+'Read the label.','“'.repeat(8000)+'Read the label.','('.repeat(32)+'the light is on'+')'.repeat(32)+'.']) {
  const r=check(text);assert.equal(r.conformity.releaseAllowed,false);
 }
});
test('a whole-duration requirement is not weakened to occurrence during the interval',()=>{
 const text='The operator must monitor the system for the duration of the test.';
 const native=run(['--profile','combined','--json'],text);assert.equal(native.status,0,native.stderr);
 const js=rewrite(text,{profile:'combined'},resources);
 assert.equal(js.text,text);assert.equal(JSON.parse(native.stdout).text,text);
});
