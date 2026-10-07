// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {loadResources,rewrite} from '../docs/engine.js';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const binary=[process.env.SYNOMIZER_BIN,'build/synomizer','build/synomizer.exe','build/Release/synomizer.exe'].filter(Boolean).map(p=>path.resolve(root,p)).find(existsSync);
assert.ok(binary,'Build the C++23 CLI before running tests.');
export const resources=loadResources(readFileSync(path.join(root,'data/lexicon.tsv'),'utf8'),readFileSync(path.join(root,'data/phrases.txt'),'utf8'));
export const run=(args=[],input='',extra={})=>spawnSync(binary,args,{input,encoding:'utf8',maxBuffer:32*1024*1024,timeout:60000,...extra});
export function compare(text,options={}) {
  const args=['--json','--seed',String(options.seed??1),'--intensity',String(options.intensity??1)];
  if(options.synonyms===false)args.push('--no-synonyms');
  if(options.arrange===false)args.push('--no-arrange');
  if(options.protectQuotes===false)args.push('--vary-quotes');
  const native=run(args,text);assert.equal(native.status,0,native.stderr || native.error?.message);
  const expected=JSON.parse(native.stdout), actual=rewrite(text,options,resources);
  assert.deepEqual({text:actual.text,changes:actual.changes},expected);
  assert.equal(actual.parts.map(p=>p.text).join(''),actual.text);
  return actual;
}
