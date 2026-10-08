// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// Mirrors src/standard_structure.cpp. Limited drafting rules, not semantic proofs.
const FINITE = new Set('offer offers offered provide provides provided require requires required depend depends depended support supports supported retain retains retained contain contains contained include includes included combine combines combined demonstrate demonstrates demonstrated broaden broadens broadened'.split(' '));
const SCOPE = new Set('not no never only either neither nor if unless when whenever before after because until that whether who which whose why how can could may might must shall should will would say says said think thinks thought believe believes believed claim claims claimed suggest suggests suggested expect expects expected assume assumes assumed suppose supposes supposed seem seems seemed certain sure evidence'.split(' '));
const HEADS = new Set('method methods catalyst catalysts amination reaction reactions system systems process processes procedure procedures sustainability chemistry assessment assessments study studies comparison comparisons analysis analyses report reports test tests results technique techniques device devices model models it they we he she'.split(' '));
export function standardStructure(tokens, resources, h) {
  const lower=h.lower;
  const blank=t=>!t.word && !!t.text && /^[ \t]+$/.test(t.text);
  const letters=s=>!!s && /^[A-Za-z-]+$/.test(s);
  const concat=t=>t.map(x=>x.text).join('');
  const slice=(t,a,b)=>{while(a<b&&blank(t[a]))a++;while(b>a&&blank(t[b-1]))b--;return t.slice(a,b);};
  const words=t=>t.filter(x=>x.word).map(x=>lower(x.text));
  const scanned=text=>h.splitPieces(text).flatMap(p=>p.sentence?p.tokens:[{text:p.text,word:false,frozen:false,replaced:false}]);
  const direct=(t,allowSubordinate=false)=>{
    const p=t.flatMap((x,i)=>x.word?[i]:[]);
    for(let slot=1;slot<p.length&&slot<=14;slot++) {
      if(!FINITE.has(lower(t[p[slot]].text)))continue;
      let last=slot-1;
      if(['already','also','often','usually','currently'].includes(lower(t[p[last]].text))&&last>0)last--;
      const head=lower(t[p[last]].text);
      if(!HEADS.has(head)&&!resources.byLemma.get(head)?.some(e=>e.pos==='noun'))return null;
      for(let j=0;j<slot;j++) {
        const w=lower(t[p[j]].text);
        if(h.AUX.has(w)||h.PREPS.has(w)||SCOPE.has(w)||FINITE.has(w))return null;
      }
      let subordinate=false;
      for(let j=slot+1;j<p.length;j++) {
        const w=lower(t[p[j]].text);
        if(allowSubordinate&&w==='although'){subordinate=true;continue;}
        if(SCOPE.has(w)||(!subordinate&&(h.AUX.has(w)||FINITE.has(w))))return null;
      }
      return p[slot];
    }
    return null;
  };
  if(!tokens.length||tokens.length>600||tokens.at(-1).text!=='.')return null;
  for(const t of tokens) {
    if(/[\r\n]/.test(t.text))return null;
    if(t.word){if(!letters(t.text))return null;}
    else if(!blank(t)&&!['.',',',':'].includes(t.text))return null;
  }
  const make=(text,detail)=>({tokens:scanned(text),change:{kind:'arrangement',before:concat(tokens),after:text,detail}});
  if(tokens.some(t=>SCOPE.has(lower(t.text))))return null;
  let boundary=tokens.length,right=tokens.length,link='';
  for(let i=1;i+1<tokens.length;i++) {
    if(tokens[i].text===':') {
      if(boundary!==tokens.length)return null;
      boundary=i;right=i+1;
    } else if(tokens[i].text===','&&i+3<tokens.length&&blank(tokens[i+1])&&lower(tokens[i+2].text)==='but'&&blank(tokens[i+3])) {
      if(boundary!==tokens.length)return null;
      boundary=i;right=i+4;link='But ';
    }
  }
  if(boundary===tokens.length)return null;
  const left=slice(tokens,0,boundary),tail=slice(tokens,right,tokens.length-1),predicate=direct(left);
  if(predicate===null||!tail.length)return null;
  let after=concat(tail);
  if(direct(tail,true)===null) {
    if(!link||!FINITE.has(lower(tail[0].text)))return null;
    let subject=concat(slice(left,0,predicate));const sw=words(slice(left,0,predicate));
    if(!sw.length||['all','each','every','any','some','a','an'].includes(sw[0]))return null;
    if(left.length&&!left[0].frozen&&subject)subject=h.lowerChar(subject[0])+subject.slice(1);
    after=subject+' '+after;
    if(direct(scanned(after))===null)return null;
  }
  if(after&&!link)after=h.upperChar(after[0])+after.slice(1);
  return make(concat(left)+'. '+link+after+'.','Clarity: separated supported descriptive clauses without dropping their connection');
}
