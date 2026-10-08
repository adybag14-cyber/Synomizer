// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
test('shared lexical rules have valid, unambiguous schemas',()=>{
  const seen=new Set();
  const rows=readFileSync(new URL('../data/lexicon.tsv',import.meta.url),'utf8').split(/\r?\n/);
  for(const [index,line] of rows.entries()) {
    if(!line.trim() || line.startsWith('#'))continue;
    const cols=line.split('\t');assert.equal(cols.length,4,`row ${index+1}`);
    const [name,pos,members,flag]=cols;
    const words=members.split('|');assert.equal(new Set(words).size,words.length,`duplicate alternative row ${index+1}`);
    if(name==='@academic') {
      assert.ok(['review','pending','dependent','verbal','support','benchmark','nominal','route','local'].includes(pos));
      assert.ok(['1','2'].includes(flag));assert.ok(words.length>=2);
      for(const word of words)assert.match(word,/^[a-z]+(?: [a-z]+)*$/);
      const key=`academic/${words[0]}`;assert.ok(!seen.has(key));seen.add(key);continue;
    }
    if(name==='@clarity'){
      assert.match(pos,/^[a-z']+(?: [a-z']+)*$/); assert.match(members,/^[a-z]+(?: [a-z]+)*$/);
      assert.ok(['purpose','clause','noun','any','verb','contraction'].includes(flag));
      continue;
    }
    if(name==='@phrase'){
      assert.ok(['front','connector','purpose'].includes(pos));assert.ok(words.length>=2);
      for(const word of words)assert.match(word,/^[a-z]+(?: [a-z]+)*$/);
      continue;
    }
    assert.ok(['adj','adv','noun','verb'].includes(pos));
    assert.match(flag,/^(free|careful|manner|mass|quant|time|event|disagreement|(?:head|object):[a-z]+(?:\|[a-z]+)*)$/);
    for(const word of words)assert.match(word,/^[a-z]+(?:-[a-z]+)*$/);
    for(const lemma of name==='@group'?words:[name]){
      const key=`${lemma}/${pos}`;assert.ok(!seen.has(key),`duplicate ${key}`);seen.add(key);
    }
  }
});
