// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {compare,resources} from './hardening-support.mjs';
import {rewrite} from '../docs/engine.js';
const fixtures=JSON.parse(readFileSync(new URL('./hardening-cases.json',import.meta.url),'utf8'));
for(const fixture of fixtures) test(fixture.name,()=> {
  for(const seed of ['0','1','18446744073709551615']) {
    const r=compare(fixture.input,{seed,...fixture.options});
    if(fixture.expected!==undefined)assert.equal(r.text,fixture.expected);
    if(fixture.different)assert.notEqual(r.text,fixture.input);
    for(const kept of fixture.keep??[])assert.ok(r.text.includes(kept),JSON.stringify(r.text));
    for(const absent of fixture.absent??[])assert.ok(!r.text.includes(absent),JSON.stringify(r.text));
  }
});
test('option matrix preserves native/browser parity',()=> {
  const t='The careful teacher helped the happy children. Because the road was icy, the bus arrived late. She said "happy".';
  for(const seed of ['1','2','9007199254740993','18446744073709551615'])
    for(const intensity of [0,1,2])for(const synonyms of [false,true])for(const arrange of [false,true])for(const protectQuotes of [false,true])
      compare(t,{seed,intensity,synonyms,arrange,protectQuotes});
});
test('deterministic corpus with punctuation and Unicode',()=> {
  const tokens=['happy','car','because','arrived','was','3.14','\r\n','"','\u201c','\u201d','\u2019','Jos\u00e9','NASA','`car`','happy@example.com','and','not','quickly','teacher',',','.','?',"isn't",''];
  let state=4271;
  for(let n=0;n<80;n++) {
    let text='';
    for(let i=0;i<30;i++) {state=(Math.imul(state,1664525)+1013904223)>>>0;text+=tokens[state%tokens.length]+' ';}
    compare(text,{seed:String(state),intensity:n%3});
    assert.equal(compare(text,{synonyms:false,arrange:false}).text,text.replace(/\r\n?/g,"\n"));
  }
});
test('long document and long single sentence',()=> {
  compare('The happy child purchased a car.\r\n'.repeat(1500));
  compare('a happy child '.repeat(6000),{arrange:false});
});
