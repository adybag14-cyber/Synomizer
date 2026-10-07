// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
const SAMPLE = 'The careful teacher helped the happy children. Because the weather was cold, the class started the project late. She quietly explained the main idea, and the students were glad to assist. They purchased a small car for the school trip and quickly found the correct route. The calm physician said the tired boy was healthy. Although the journey was long, the group remained cheerful. The writer described the final result in an honest report. The crowd was silent when the meeting ended. The local students found a useful answer and remained calm. It was a small victory.';
const $ = id => document.getElementById(id);
const source=$('source'), output=$('output'), status=$('status'), banner=$('banner');
const exports=[$('copy'),$('download'),$('download-ledger')];
const MAX_BYTES=1048576, MAX_SEED=18446744073709551615n;
let worker, ready=false, loadFailed=false, busy=false, revision=0, pending=null, timer=0, latest=null;
const words = text => (text.match(/\S+/gu) || []).length;
const setStatus = message => {status.textContent=message;};
function exportable(yes) {for(const button of exports) button.disabled=!yes;}
function clearError() {banner.hidden=true;banner.textContent='';$('retry').hidden=true;}
function showError(message,retry=false) {
  banner.textContent=message;banner.hidden=false;$('retry').hidden=!retry;
  exportable(false);latest=null;setStatus('No current rewrite.');
  output.removeAttribute('aria-busy');output.replaceChildren();$('output-count').textContent='0 words';$('changes').replaceChildren();
}
function options() {
  const seed=$('seed').value.trim();
  if(!/^[0-9]+$/.test(seed) || seed.length>20 || BigInt(seed)>MAX_SEED)
    throw new Error('Seed must be a whole number from 0 to 18446744073709551615.');
  return {seed,intensity:Number($('intensity').value),synonyms:$('synonyms').checked,
    arrange:$('arrange').checked,protectQuotes:$('quotes').checked};
}
function invalidate() {
  revision++;pending=null;latest=null;exportable(false);
  $('source-count').textContent=`${words(source.value)} words`;
  output.setAttribute('aria-busy','true');
  setStatus(ready?'Waiting for the current text.':'Loading the word lists.');
}
function render(result,settings) {
  const fragment=document.createDocumentFragment();
  for(const part of result.parts) {
    if(part.changed) {const mark=document.createElement('mark');mark.textContent=part.text;fragment.append(mark);}
    else fragment.append(document.createTextNode(part.text));
  }
  output.replaceChildren(fragment);
  output.removeAttribute('aria-busy');
  $('output-count').textContent=`${words(result.text)} words`;
  const ledger=document.createDocumentFragment();
  for(const change of result.changes.slice(0,200)) {
    const li=document.createElement('li');
    for(const [name,text] of [['kind',change.detail?`${change.kind} \u00b7 ${change.detail}`:change.kind],['before',change.before],['arrow','\u2192'],['after',change.after]]) {
      const span=document.createElement('span');span.className=name;span.textContent=text;li.append(span);
    }
    ledger.append(li);
  }
  if(!result.changes.length) {const li=document.createElement('li');li.className='empty';li.textContent='No eligible change on this pass. Your wording has been kept.';ledger.append(li);}
  $('changes').replaceChildren(ledger);
  $('ledger-note').textContent=result.changes.length>200?`Showing the first 200 of ${result.changes.length} changes. Download the complete ledger for every change.`:'Every applied rule is listed below. Highlighting includes whole moved sentences.';
  const n=result.changes.filter(c=>c.kind==='synonym').length, m=result.changes.filter(c=>c.kind==='arrangement').length;
  setStatus(`${n} synonym${n===1?'':'s'} \u00b7 ${m} move${m===1?'':'s'} \u00b7 seed ${settings.seed}`);
  exportable(result.text.length>0);
}
function dispatch() {
  if(!ready || busy || !pending) return;
  const next=pending;pending=null;busy=true;
  worker.postMessage(next);
}
function rewriteNow() {
  clearTimeout(timer);
  if (loadFailed && !ready) return;
  try {
    const settings=options();
    if(new TextEncoder().encode(source.value).byteLength>MAX_BYTES)
      throw new Error('The browser limit is 1 MiB of UTF-8 text. Use the C++ CLI for larger documents.');
    clearError();
    pending={type:'rewrite',id:revision,text:source.value,options:settings};
    if(ready) setStatus('Rewriting locally\u2026');
    dispatch();
  } catch(error) {showError(error.message);pending=null;}
}
function schedule() {invalidate();clearTimeout(timer);timer=setTimeout(rewriteNow,180);}
function startWorker() {
  worker?.terminate();ready=false;loadFailed=false;busy=false;clearError();invalidate();
  try {
    worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=> {
      if(data.type==='ready') {ready=true;rewriteNow();return;}
      if(data.type==='load-error') {loadFailed=true;showError(`${data.message} Check the connection, then retry.`,true);return;}
      busy=false;
      if(data.id===revision) {
        if(data.type==='error') showError(data.message);
        else if(data.type==='result') {
          try {latest={...data.result,source:source.value,options:options()};clearError();render(data.result,latest.options);}
          catch(error) {showError(error.message);}
        }
      }
      dispatch();
    };
    worker.onerror=()=>{ready=false;loadFailed=true;busy=false;showError('The local rewrite worker stopped. Retry, or use the C++ CLI.',true);};
  } catch {loadFailed=true;showError('This browser could not start a Web Worker. Use a current browser or the C++ CLI.',true);}
}
function save(name,contents,type) {
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
source.value=SAMPLE;
source.addEventListener('input',schedule);
for(const id of ['seed','intensity','synonyms','arrange','quotes']) $(id).addEventListener('input',schedule);
$('tools').addEventListener('submit',event=>{event.preventDefault();invalidate();rewriteNow();});
$('reset').addEventListener('click',()=> {
  source.value=SAMPLE;$('seed').value='1';$('intensity').value='1';
  for(const id of ['synonyms','arrange','quotes']) $(id).checked=true;
  invalidate();rewriteNow();
});
$('clear').addEventListener('click',()=>{source.value='';invalidate();rewriteNow();source.focus();});
$('next').addEventListener('click',()=> {
  try {const old=BigInt(options().seed);$('seed').value=String(old===MAX_SEED?0n:old+1n);invalidate();rewriteNow();}
  catch(error) {showError(error.message);}
});
$('copy').addEventListener('click',async()=> {
  if(!latest) return;
  try {await navigator.clipboard.writeText(latest.text);setStatus('Copied the rewrite.');}
  catch {banner.textContent='Clipboard access was refused. Select the rewritten text and copy it, or use Download text.';banner.hidden=false;}
});
$('download').addEventListener('click',()=>{if(latest) save('synomizer-rewrite.txt',latest.text,'text/plain;charset=utf-8');});
$('download-ledger').addEventListener('click',()=> {
  if(!latest) return;
  const {parts,...report}=latest;
  save('synomizer-changes.json',JSON.stringify(report,null,2),'application/json;charset=utf-8');
});
$('import').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async()=> {
  const file=$('file').files[0];if(!file)return;
  const id=++revision;pending=null;exportable(false);latest=null;
  try {
    if(file.size>MAX_BYTES) throw new Error('That file exceeds the browser limit of 1 MiB. Use the C++ CLI for larger files.');
    const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await file.arrayBuffer());
    if(id!==revision)return;
    source.value=text;invalidate();rewriteNow();
  } catch(error) {if(id===revision) showError(error instanceof TypeError?'The file is not valid UTF-8 text. Save it as UTF-8 and import it again.':error.message);}
  finally {$('file').value='';}
});
$('retry').addEventListener('click',startWorker);
startWorker();
