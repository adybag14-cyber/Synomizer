// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// Synchronous SHA-256 for deterministic browser/native report binding.
// A digest detects changes; it is not a signature, approval or semantic proof.
export function sha256Text(text) {
  const data=new TextEncoder().encode(text);
  const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const blocks=Math.floor(data.length/64)+(data.length%64<56?1:2),bits=BigInt(data.length)*8n;
  const rot=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let block=0;block<blocks;block++) {
    const w=new Uint32Array(64);
    for(let i=0;i<64;i++) {
      const pos=block*64+i;
      const byte=pos<data.length?data[pos]:pos===data.length?128:(block+1===blocks&&i>=56)?Number((bits>>BigInt((63-i)*8))&255n):0;
      w[Math.floor(i/4)]|=byte<<(24-(i%4)*8);
    }
    for(let i=16;i<64;i++) {const x=w[i-15],y=w[i-2];w[i]=w[i-16]+(rot(x,7)^rot(x,18)^(x>>>3))+w[i-7]+(rot(y,17)^rot(y,19)^(y>>>10));}
    let [a,b,c,d,e,f,g,z]=h;
    for(let i=0;i<64;i++) {
      const t1=(z+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0;
      const t2=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    const next=[a,b,c,d,e,f,g,z]; for(let i=0;i<8;i++) h[i]=(h[i]+next[i])>>>0;
  }
  return h.map(x=>x.toString(16).padStart(8,'0')).join('');
}
// Sorted sentinels are a narrow regression guard, not logical-equivalence proof.
export function sourceAnchors(text) {
  const out=[],logical=new Set('not no never can could may might must shall should will would only or either neither'.split(' '));
  const tokens=text.match(/[0-9]+(?:[.,][0-9]+)*|[A-Za-z]+(?:'[A-Za-z]+)*/g)||[];
  for(const token of tokens) {
    if(/^[0-9]/.test(token)){out.push('n:'+token);continue;}
    let w=token.toLowerCase();
    if(w==='cannot'||w==="can't"){out.push('w:can','w:not');}
    else if(w==="won't"){out.push('w:will','w:not');}
    else if(w.endsWith("n't")){out.push('w:not');w=w.slice(0,-3);if(logical.has(w))out.push('w:'+w);}
    else if(logical.has(w))out.push('w:'+w);
  }
  return out.sort();
}
export function assessConformity(source,options,result) {
  const report=result.standards;
  const c={decision:'blocked',releaseAllowed:false,conformityVerified:false,strictRequested:options.requireConformity??false,
    sourceSha256:sha256Text(source),draftSha256:sha256Text(result.text),normalization:'LF',markerCheck:report.findings.some(f=>f.code==='CONVERSION-ROLLBACK')?'mismatch-rolled-back':'matched',blockers:[],requirements:[]};
  c.blockers.push('Meaning, facts, actors and obligations have not received a complete source-to-draft assessment.');
  if(['ste','combined'].includes(options.profile)) {
    c.blockers.push(!options.vocabulary.length?'An authorized STE vocabulary and reviewed technical terminology have not been supplied.':'Supplied vocabulary authority, completeness, word senses, grammatical roles and forms have not been verified.');
    c.blockers.push('The complete ASD-STE100 Issue 9 requirements are not automatically verified. Rule inventory coverage is not compliance.');
    const limits=[14,2,7,5,5,6,3,7,4];
    for(let section=1;section<=9;section++) for(let n=1;n<=limits[section-1];n++) {
      const id=section+'.'+n,screened=['3.2','3.5','3.6','5.1','6.3','8.1','8.4','8.5','8.6'].includes(id);
      const attention=report.findings.some(f=>f.code==='STE-'+id);
      c.requirements.push({standard:'ASD-STE100 Issue 9',rule:id,method:screened?'partial-screen':'human-review',result:attention?'attention':'not-verified',
        note:screened?'A bounded screen assists review; absence of findings does not verify the full rule.':'Review this rule against the authorized standard and the actual document. No automated approval.'});
    }
  }
  if(['plain','combined'].includes(options.profile)) {
    c.blockers.push('Reader relevance, document organization, understanding and usability need evidence from the intended audience and author review.');
    for(const rule of ['relevant','findable','understandable','usable'])
      c.requirements.push({standard:'ISO 24495-1:2023',rule,method:'human-review',result:'not-verified',note:"Principle-level review item, not a complete inventory of the standard's guidelines or a certification."});
  }
  if(!report.after.sentences)c.blockers.push('No assessable prose was found; empty or opaque input cannot establish conformity.');
  if(report.after.longSentences)c.blockers.push('Some count units exceed the selected screening target; review their structure and grouping.');
  if(report.after.unlistedWords)c.blockers.push('Some words were not found in the supplied vocabulary.');
  report.conformity=c;
}
