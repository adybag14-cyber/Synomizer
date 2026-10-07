// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {run} from './support.mjs';
for(const args of [
 ['--seed'],['--seed','-1'],['--seed','12x'],['--seed','1.5'],['--seed','+1'],['--seed',' 1'],['--seed','18446744073709551616'],
 ['--intensity','1x'],['--intensity','-1'],['--intensity','3'],['--unknown'],['--text'],['--output'],
 ['--text','a','file.txt'],['file1','file2'],['--text','a','--text','b'],['--synonyms-only','--arrange-only']
]) test(`CLI rejects ${JSON.stringify(args)}`,()=> {const r=run(args);assert.notEqual(r.status,0);assert.match(r.stderr,/synomizer:/);assert.equal(r.stdout,'');});
test('CLI reads stdin, inline text and JSON',()=> {
 const input='The happy child.\r\n\u4f60\u597d.\t"car"';
 const r=run(['--json'],input);assert.equal(r.status,0,r.stderr);assert.ok(JSON.parse(r.stdout).text.includes('\r\n'));
 assert.equal(run(['--text',input]).stdout,JSON.parse(r.stdout).text);
 assert.equal(run(['-','--no-synonyms','--no-arrange','-o','-'],input).stdout,input);
});
test('JSON escapes control characters',()=> {
 const input='a\u0000b\t"happy"\r\n\\';
 const r=run(['--json','--no-synonyms','--no-arrange'],input);assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).text,input);
});
test('Unicode paths, option-looking filenames, output and errors',()=> {
 const dir=mkdtempSync(path.join(tmpdir(),'synomizer-'));
 try {
  const input='The happy child.\r\n';const file=path.join(dir,'\u4f60\u597d.txt'),out=path.join(dir,'r\u00e9sultat.txt');writeFileSync(file,input);
  assert.equal(run(['--no-synonyms','--no-arrange',file,'-o',out]).status,0);assert.equal(readFileSync(out,'utf8'),input);
  writeFileSync(path.join(dir,'-input.txt'),input);
  assert.equal(run(['--no-synonyms','--no-arrange','--','-input.txt'],'',{cwd:dir}).stdout,input);
  assert.notEqual(run([path.join(dir,'absent')]).status,0);
  assert.notEqual(run(['--text','hello','-o',dir]).status,0);
  assert.notEqual(run(['--text','hello','-o',path.join(dir,'missing','out')]).status,0);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test('help and version',()=> {assert.match(run(['--help']).stdout,/--json/);assert.match(run(['--version']).stdout,/1\.1\.0/);});
