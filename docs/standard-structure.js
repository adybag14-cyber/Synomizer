// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// Mirrors src/standard_structure.cpp. Limited drafting rules, not semantic proofs.
const FINITE = new Set('offer offers offered provide provides provided require requires required depend depends depended support supports supported retain retains retained contain contains contained include includes included combine combines combined demonstrate demonstrates demonstrated broaden broadens broadened'.split(' '));
const SCOPE = new Set('not no never only either neither nor if unless when whenever before after because until that whether who which whose why how can could may might must shall should will would say says said think thinks thought believe believes believed claim claims claimed suggest suggests suggested expect expects expected assume assumes assumed suppose supposes supposed seem seems seemed certain sure evidence'.split(' '));
const HEADS = new Set('method methods catalyst catalysts amination reaction reactions system systems process processes procedure procedures sustainability chemistry assessment assessments study studies comparison comparisons analysis analyses report reports test tests results technique techniques device devices model models it they we he she'.split(' '));
export function standardStructure(tokens, resources, h, lists=true) {
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
        if(SCOPE.has(w)||(!subordinate&&((w!=='to'&&h.AUX.has(w))||FINITE.has(w))))return null;
      }
      return p[slot];
    }
    return null;
  };
  const nominalList=t=>{
    for(let i=0;i<t.length;i++) {
      const w=lower(t[i].text);let end=i+1;
      let match=['includes','include','combines','combine','contains','contain'].includes(w);
      if(['control','consists','consist'].includes(w)&&i+2<t.length&&blank(t[i+1])&&lower(t[i+2].text)==='of'){match=true;end=i+3;}
      if(!match||end>=t.length||!blank(t[end]))continue;
      const body=slice(t,end,t.length-1),parts=[];let begin=0;
      for(let j=0;j<body.length;j++)if(body[j].text===','){parts.push(slice(body,begin,j));begin=j+1;}
      parts.push(slice(body,begin,body.length));
      if(parts.length<2||parts.length>10)continue;
      let connector='';const tail=parts.at(-1);
      for(let j=0;j<tail.length;j++) {
        const v=lower(tail[j].text);if(v!=='and'&&v!=='or')continue;
        if(connector){connector='invalid';break;}connector=v;
        if(j===0)parts[parts.length-1]=slice(tail,1,tail.length);
        else {parts[parts.length-1]=slice(tail,0,j);parts.push(slice(tail,j+1,tail.length));}
      }
      if(!connector||connector==='invalid'||parts.length<3||parts.length>10)continue;
      let valid=true;
      if(words(parts.at(-1)).length>1&&parts.some(p=>words(p).length===1))continue; // Do not infer a shared final noun.
      for(const part of parts) {
        const ws=words(part);if(!ws.length||ws.length>7){valid=false;break;}
        for(const x of part) {
          const v=lower(x.text);
          if((!x.word&&!blank(x))||(x.word&&(!letters(x.text)||h.AUX.has(v)||FINITE.has(v)||h.subordinatorWord(v)||h.PREPS.has(v)||['and','or','not','no','without','except','excluding','including'].includes(v)))){valid=false;break;}
        }
      }
      if(!valid)continue;
      return concat(slice(t,0,end))+' the following:\n'+parts.map((p,j)=>'- '+(j+1===parts.length?connector+' ':'')+concat(p)+(j+1===parts.length?'.':',')).join('\n')+'\n\n';
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
  const list=lists?nominalList(tokens):null;
  if(list!==null)return make(list,'Clarity: preserved a nominal enumeration as a vertical list');
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
    if(['aqueous','recent','published','the','this','these','those','its','their','our'].includes(sw[0]))subject=h.lowerChar(subject[0])+subject.slice(1);
    after=subject+' '+after;
    if(direct(scanned(after))===null)return null;
  }
  if(after&&!link)after=h.upperChar(after[0])+after.slice(1);
  return make(concat(left)+'. '+link+after+'.','Clarity: separated supported descriptive clauses without dropping their connection');
}
