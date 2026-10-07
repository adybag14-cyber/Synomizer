// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import {loadResources, rewrite} from './engine.js';
let resources;
try {
  const fetchText = async name => {
    const response = await fetch(new URL(`data/${name}`, import.meta.url), {signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`Could not load ${name} (${response.status}).`);
    return response.text();
  };
  const [lexicon,phrases] = await Promise.all([fetchText('lexicon.tsv'),fetchText('phrases.txt')]);
  resources = loadResources(lexicon,phrases);
  if (!resources.byLemma.size) throw new Error('The word list is empty.');
  postMessage({type:'ready', words:resources.byLemma.size});
} catch (error) {
  postMessage({type:'load-error', message:error.message || 'Word lists could not be loaded.'});
}
self.onmessage = ({data}) => {
  if (!resources || data.type !== 'rewrite') return;
  try {
    const start = performance.now();
    const result = rewrite(data.text,data.options,resources);
    // Coalesce runs so long documents do not need a DOM node for every token.
    const parts=[];
    for (const part of result.parts) {
      const last=parts.at(-1);
      if (last && last.changed===part.changed) last.text+=part.text;
      else parts.push({...part});
    }
    result.parts=parts;
    postMessage({type:'result',id:data.id,result,milliseconds:performance.now()-start});
  } catch (error) {
    postMessage({type:'error',id:data.id,message:error.message || 'The rewrite failed.'});
  }
};
