// SPDX-License-Identifier: Apache-2.0
import {mkdir,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'site');
await rm(out,{recursive:true,force:true});
await mkdir(path.join(out,'data'),{recursive:true});
const files=['index.html','styles.css','app.js','engine.js','worker.js','favicon.svg'];
const hashes={};
for(const name of files) {
  const from=path.join(root,'docs',name);await copyFile(from,path.join(out,name));
  hashes[name]=createHash('sha256').update(await readFile(from)).digest('hex');
}
for(const name of ['lexicon.tsv','phrases.txt']) {
  const from=path.join(root,'data',name);await copyFile(from,path.join(out,'data',name));
  hashes[`data/${name}`]=createHash('sha256').update(await readFile(from)).digest('hex');
}
await copyFile(path.join(root,'LICENSE'),path.join(out,'license.txt'));
await writeFile(path.join(out,'.nojekyll'),'');
let commit=process.env.GITHUB_SHA;
if(!commit) {try {commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();} catch {commit='local';}}
await writeFile(path.join(out,'build.json'),JSON.stringify({version:'1.1.0',commit,sha256:hashes},null,2)+'\n');
console.log(`Built site/ (${files.length+4} assets, commit ${commit})`);
