// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// Remote runtime stays at its publisher: no unlicensed kernel source is vendored.
export const BONSAI=Object.freeze({
 runtimeUrl:'https://huggingface.co/spaces/webml-community/ternary-bonsai-2-webgpu-kernels/raw/94320c9da2b7aeac5b5807c9e61d696a3c09edb5/index.html',
 htmlSha256:'4422addfa476ebd81195a77cd259038c4c5d56c87fc053c2387de02e065f1918',
 coreSha256:'d94c1729d7a7f084d2a2887f39487f3d27e6e296dea93def54495a5d1b9c29f6',
 modelUrl:'https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf/resolve/b072e1d3b35a0a630cece372c2127528e0994386/Ternary-Bonsai-2-27B-PTQ1_0.gguf',
 modelRevision:'b072e1d3b35a0a630cece372c2127528e0994386',
 modelBytes:5946648928,cacheName:'synomizer-bonsai2-94320c9-v1',maxContext:8192,maxOutput:512,
});
export async function sha256Bytes(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function extractRuntime(html){
 const scripts=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const module=scripts.find(s=>s.includes('as TernaryBonsai2'));
 if(!module)throw new Error('Pinned Bonsai runtime export was not found.');
 const start=module.indexOf('export{'),end=module.indexOf(';',start);
 if(start<0||end<0)throw new Error('Pinned Bonsai runtime module is incomplete.');
 return module.slice(0,end+1);
}
export function allowedModelRequest(input,init={}){
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const method=(init.method||(typeof input==='object'&&input.method)||'GET').toUpperCase();
 if(url!==BONSAI.modelUrl||!['GET','HEAD'].includes(method)||init.body!=null)throw new Error('Bonsai may only download the pinned model. Document uploads are not permitted.');
 return {url,method};
}
