// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root} from './support.mjs';
test('site is self-contained, valid UTF-8 and fingerprinted',()=> {
 execFileSync(process.execPath,['tools/build-site.mjs'],{cwd:root});
 const build=JSON.parse(readFileSync(path.join(root,'site/build.json'),'utf8'));
 for(const [name,hash] of Object.entries(build.sha256)) {
  const bytes=readFileSync(path.join(root,'site',name));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  assert.ok(!text.includes('\ufffd'),name+' contains a replacement character');
  assert.ok(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text),name+' contains a control character');
 }
 const html=readFileSync(path.join(root,'site/index.html'),'utf8');
 assert.ok(!html.includes('fonts.googleapis.com'));
 for(const [,url] of html.matchAll(/(?:src|href)="([^"#:]+)"/g))
  if(!url.startsWith('https:'))assert.ok(existsSync(path.join(root,'site',url)),url);
 assert.equal(readFileSync(path.join(root,'site/license.txt'),'utf8'),readFileSync(path.join(root,'LICENSE'),'utf8'));
});
