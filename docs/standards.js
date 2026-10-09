import { standardStructure } from "./standard-structure.js";
import { assessConformity, sourceAnchors, sha256Text } from "./conformity.js";
// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// Mirrors src/standards.cpp. A partial authoring aid, never a conformance certificate.
const bytes = s => new TextEncoder().encode(s).length;
const trim = s => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
const contains = (s, words) => words.includes(s);
const space = t => !t.word && !!t.text && /^[ \t\r\n]+$/.test(t.text);
const concat = t => t.map(x => x.text).join("");
const positions = t => t.flatMap((x, i) => x.word ? [i] : []);
const count = t => t.filter(x => x.word || (x.frozen && !space(x))).length;
const evidence = t => bytes(concat(t)) <= 300 ? concat(t) : "[Long sentence: review in the original text]";
const STE = o => o.profile === "ste" || o.profile === "combined";
const PLAIN = o => o.profile === "plain" || o.profile === "combined";
const PARTS = ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "article", "other"];
const CATEGORIES = ["general", "technical-noun", "technical-verb", "name", "title"];
function validate(o) {
  if (!["ste", "plain", "combined"].includes(o.profile)) throw new RangeError("profile must be variation, ste, plain, or combined");
  if (!["procedure", "description"].includes(o.textType)) throw new RangeError("text type must be procedure or description");
  if (typeof o.audience !== "string" || typeof o.purpose !== "string" || bytes(o.audience) > 1000 || bytes(o.purpose) > 1000) throw new RangeError("audience and purpose must each fit in 1000 UTF-8 bytes");
  if (typeof o.checkOnly !== "boolean") throw new TypeError("checkOnly must be a boolean");
  if (o.requireConformity !== undefined && typeof o.requireConformity !== "boolean") throw new TypeError("requireConformity must be a boolean");
  if (o.structuredLists !== undefined && typeof o.structuredLists !== "boolean") throw new TypeError("structuredLists must be a boolean");
  if (!Array.isArray(o.vocabulary) || o.vocabulary.length > 5000) throw new RangeError("vocabulary limit is 5000 entries");
  for (const e of o.vocabulary) {
    if (!e || typeof e.term !== "string" || !trim(e.term) || bytes(e.term) > 200 || /[\t\r\n]/.test(e.term) ||
        typeof e.meaning !== "string" || !trim(e.meaning) || bytes(e.meaning) > 500 || /[\t\r\n]/.test(e.meaning) ||
        !PARTS.includes(e.pos) || !CATEGORIES.includes(e.category)) throw new TypeError("invalid vocabulary entry: require term, part of speech, meaning and category");
    if ((e.category === "technical-noun" && e.pos !== "noun") || (e.category === "technical-verb" && e.pos !== "verb")) throw new TypeError("technical vocabulary category and part of speech disagree");
  }
}
export function parseVocabulary(tsv) {
  if (typeof tsv !== "string" || bytes(tsv) > 1000000) throw new RangeError("vocabulary input limit is 1000000 UTF-8 bytes");
  if (tsv.startsWith("\ufeff")) tsv = tsv.slice(1);
  const vocabulary = [], seen = new Set();
  for (let line of tsv.split("\n")) {
    line = line.replace(/\r$/, "");
    if (!trim(line) || trim(line).startsWith("#")) continue;
    const cols = line.split("\t").map(trim);
    if (cols.length !== 4) throw new TypeError("vocabulary TSV needs four columns: term, pos, meaning, category");
    const key = cols[0].replace(/[A-Z]/g, x => x.toLowerCase()) + "\t" + cols[1] + "\t" + cols[3];
    if (seen.has(key)) throw new TypeError("duplicate vocabulary entry");
    seen.add(key);
    vocabulary.push({ term: cols[0], pos: cols[1], meaning: cols[2], category: cols[3] });
    if (vocabulary.length > 5000) throw new RangeError("vocabulary limit is 5000 entries");
  }
  validate({ profile: "ste", textType: "description", checkOnly: false, audience: "", purpose: "", vocabulary });
  return vocabulary;
}
const PAST = new Map(Object.entries({ opened: "open", closed: "close", removed: "remove", installed: "install", cleaned: "clean", measured: "measure", recorded: "record", repaired: "repair", inspected: "inspect", replaced: "replace", selected: "select", tested: "test", used: "use", written: "write", made: "make", built: "build" }));
export function rewriteStandard(input, options, resources, h) {
  const o = { ...options, profile: options.profile, textType: options.textType ?? "description", checkOnly: options.checkOnly ?? false,
    audience: options.audience ?? "", purpose: options.purpose ?? "", vocabulary: options.vocabulary ?? [],
    requireConformity: options.requireConformity ?? false, structuredLists: options.structuredLists ?? true,
    synonyms: options.synonyms !== false, arrange: options.arrange !== false, protectQuotes: options.protectQuotes !== false };
  validate(o);
  const { lower } = h;
  const tokenize = text => h.splitPieces(text).flatMap(p => p.sentence ? p.tokens : [{ text: p.text, word: false, frozen: false, replaced: false }]);
  const vocabularyIndex = new Map(), countingNames = new Map(), spellings = new Set();
  for (const e of o.vocabulary) {
    const t = tokenize(trim(e.term)); spellings.add(lower(trim(e.term)));
    if(["name","title"].includes(e.category)&&t.length){const key=lower(t[0].text);if(!countingNames.has(key))countingNames.set(key,[]);countingNames.get(key).push(t);}
    if (e.category !== "general" && t.length) {
      const key = lower(t[0].text);
      if (!vocabularyIndex.has(key)) vocabularyIndex.set(key, []);
      vocabularyIndex.get(key).push(t);
    }
  }
  for(const patterns of countingNames.values())patterns.sort((a,b)=>b.length-a.length);
  for (const patterns of vocabularyIndex.values()) patterns.sort((a, b) => b.length - a.length);
  const prepare = t => {
    let vocabularyLocked=false;
    for (const token of t) for (const rule of resources.clarityRules || [])
      if (rule.guard === "contraction" && rule.source.length === 1 && lower(token.text) === rule.source[0]) token.frozen = false;
    if (o.protectQuotes) h.freezeQuotes(t);
    h.freezePhrases(resources, t, true, true); h.freezeNames(resources, t);
    for (let i = 0; i < t.length; i++) {
      for (const pattern of vocabularyIndex.get(lower(t[i].text)) || []) {
        if (pattern.length > t.length - i) continue;
        if (pattern.every((p, k) => (space(p) && space(t[i+k])) || lower(p.text) === lower(t[i+k].text))) {
          vocabularyLocked=true;
          for (let k = 0; k < pattern.length; k++) t[i+k].frozen = true;
          i += pattern.length - 1; break;
        }
      }
    }
    h.freezeTerms(t, o.protectedTerms || []);
    return vocabularyLocked;
  };
  const passive = t => {
    const p = positions(t);
    for (let i = 0; i+1 < p.length; i++) {
      if (!["am", "is", "are", "was", "were", "be", "been", "being"].includes(lower(t[p[i]].text))) continue;
      for (let j = i+1; j < p.length && j <= i+3; j++) {
        const w = lower(t[p[j]].text);
        if (PAST.has(w) || (w.length > 3 && w.endsWith("ed"))) return true;
        if (!h.knownAdverb(resources, w)) break;
      }
    }
    return false;
  };
  const nounPhrase = (t, a, b) => {
    const words = [];
    for (const x of t.slice(a, b)) {
      if (space(x)) continue;
      if (!x.word || x.frozen) return false;
      words.push(lower(x.text));
      if (words.length > 4) return false;
    }
    if (words.length < 2 || words.length > 4 || !["the", "a", "an"].includes(words[0])) return false;
    return words.slice(1).every(w => !h.AUX.has(w) && !h.PRONOUNS.has(w) && !h.PREPS.has(w) && !h.coordinator(w) && !h.subordinatorWord(w) && !["not", "only", "that", "which", "who", "whose"].includes(w));
  };
  const activePast = t => {
    if (t.length > 64) return null; // Only two short noun phrases are supported.
    const p = positions(t); if (p.length < 6 || t.at(-1)?.text !== ".") return null;
    for (let i = 1; i+3 < p.length; i++) {
      if (!["was", "were"].includes(lower(t[p[i]].text))) continue;
      const part = lower(t[p[i+1]].text);
      if (!PAST.has(part) || lower(t[p[i+2]].text) !== "by") continue;
      if (p[i+1] !== p[i]+2 || p[i+2] !== p[i+1]+2 || p[i+3] !== p[i+2]+2) continue;
      if (!nounPhrase(t, 0, p[i]) || !nounPhrase(t, p[i+3], t.length-1)) continue;
      if (!["technician", "operator", "mechanic", "engineer", "inspector", "worker", "manufacturer", "controller", "computer", "processor", "relay"].includes(lower(t[p.at(-1)].text))) continue;
      const object = trim(concat(t.slice(0, p[i]))), agent = trim(concat(t.slice(p[i+3], -1)));
      const past = part === "written" ? "wrote" : part;
      const text = h.upperChar(agent[0]) + agent.slice(1) + " " + past + " " + h.lowerChar(object[0]) + object.slice(1) + ".";
      return { tokens: tokenize(text), change: { kind: "arrangement", before: concat(t), after: text, detail: "Clarity: explicit-agent passive to simple-past active" } };
    }
    return null;
  };
  const independent = (t, a, b) => {
    const sub = t.slice(a, b), p = positions(sub); if (p.length < 3) return false;
    const word = i => i < p.length ? lower(sub[p[i]].text) : "";
    const first = word(0);
    const predicate = ["we","you","they","he","she","it"].includes(first) ? 1 : ["the","this","these","those","a","an"].includes(first) ? 2 : p.length;
    if (predicate + 1 >= p.length) return false;
    const finite = word(predicate); let end = predicate + 1;
    const state = w => ["open","closed","on","off","active","inactive","clean","dry","wet","ready","empty","full","available","unavailable","present","absent","damaged","broken","intact","stable","unstable","hot","cold","complete","incomplete"].includes(w);
    const base = w => [...PAST.values()].includes(w);
    // Only reviewed direct states/actions, not auxiliary-led reported claims.
    if (["is","are","was","were","am"].includes(finite)) {
      if (word(end) === "being") { end++; if (!PAST.has(word(end))) return false; }
      else if (!state(word(end)) && !PAST.has(word(end))) return false;
    } else if (["has","have","had"].includes(finite)) {
      if (word(end) === "been") end++;
      if (word(end) === "being") end++;
      if (!PAST.has(word(end))) return false;
    } else if (["can","could","may","might","must","shall","should","will","would","does","do","did"].includes(finite)) {
      if (word(end) === "be") { end++; if (!state(word(end)) && !PAST.has(word(end))) return false; }
      else if (!base(word(end))) return false;
    } else return false;
    for (end++; end < p.length; end++) {
      const w = word(end);
      if (h.AUX.has(w) || h.coordinator(w) || h.subordinatorWord(w) || h.looksLikeVerb(resources, w)) return false;
    }
    return true;
  };
  const splitIndependent = t => {
    if (t.length > 600 || t.at(-1)?.text !== ".") return null;
    for (const token of t) {
      const w = lower(token.text);
      if (token.frozen || w.includes("\n") || ["if", "unless", "when", "whenever", "before", "after", "because", "although", "while", "until", "not", "never", "only", "either", "neither", "nor", "who", "which", "that", "whose"].includes(w) || w.includes("n't")) return null;
      if (!token.word && !space(token) && ![".", ",", ";"].includes(w)) return null;
    }
    let boundary = t.length, right = t.length, connector = "";
    for (let i = 1; i+2 < t.length; i++) {
      if (t[i].text === ";") { if (boundary !== t.length) return null; boundary = i; right = i+1; }
      else if (t[i].text === "," && i+3 < t.length && space(t[i+1]) && ["and", "but"].includes(lower(t[i+2].text)) && space(t[i+3])) {
        if (boundary !== t.length) return null;
        boundary = i; right = i+4; connector = lower(t[i+2].text);
      }
    }
    if (boundary === t.length || !independent(t, 0, boundary) || !independent(t, right, t.length)) return null;
    const left = trim(concat(t.slice(0, boundary))); let tail = trim(concat(t.slice(right)));
    if (!connector) tail = h.upperChar(tail[0]) + tail.slice(1);
    else tail = h.upperChar(connector[0]) + connector.slice(1) + " " + tail;
    const text = left + ". " + tail;
    return { tokens: tokenize(text), change: { kind: "arrangement", before: concat(t), after: text, detail: "Clarity: separated two explicit independent clauses" } };
  };
  const simplify = (original, changes) => {
    const out = [];
    const purposeBlocked = original.some(x => ["put", "set", "get", "got", "keep", "kept", "bring", "brought", "arrange", "arranged"].includes(lower(x.text)));
    for (let i = 0; i < original.length;) {
      let changed = false;
      if (!original[i].frozen && original[i].word) for (const rule of resources.clarityRules || []) {
        const n = rule.source.length*2-1;
        if (!rule.source.length || n > original.length-i || (rule.guard === "purpose" && purposeBlocked)) continue;
        let match = true;
        for (let k = 0; k < n; k++) {
          const token = original[i+k];
          if (token.frozen || (k%2 ? token.text !== " " : !token.word || lower(token.text) !== rule.source[k/2])) { match = false; break; }
        }
        if (!match) continue;
        const end = i+n;
        const next = end+1 < original.length && space(original[end]) && original[end+1].word ? lower(original[end+1].text) : "";
        const prev = i >= 2 && space(original[i-1]) && original[i-2].word ? lower(original[i-2].text) : "";
        if (rule.guard === "noun" && !h.DETERMINERS.has(next)) continue;
        if (rule.guard === "clause" && !h.PRONOUNS.has(next) && !h.DETERMINERS.has(next)) continue;
        if (rule.guard === "purpose" && (!next || h.DETERMINERS.has(next))) continue;
        if (rule.guard === "verb" && (h.DETERMINERS.has(prev) || (prev && !h.PRONOUNS.has(prev) && !h.AUX.has(prev) && !h.knownAdverb(resources, prev)))) continue;
        const before = concat(original.slice(i, end)), after = h.applyCaps(rule.target, original[i].text);
        for (const token of tokenize(after)) out.push({ ...token, replaced: !space(token), frozen: true });
        changes.push({ kind: "phrase", before, after, detail: "Clarity: directional simplification" });
        i = end; changed = true; break;
      }
      if (!changed) out.push(original[i++]);
    }
    return out;
  };
  const countPieces = text => {
    const out=[];let pending='';
    const flush=()=>{out.push(...h.splitPieces(pending));pending='';};
    for(const raw of text.split('\n')) {
      const line=trim(raw),marker=line.match(/^(?:[-*+] |[0-9]+[.)] )/);
      if(!line)flush();
      else if(marker){flush();out.push(...h.splitPieces(line.slice(marker[0].length)));}
      else {if(pending)pending+='\n';pending+=line;}
    }
    flush();return out;
  };
  const countGrouped = (t,depth=0) => {
    if(depth>16)return {words:count(t),nested:[]};
    const ends=new Map(),paren=[];let quote=-1,quoteEnd='';
    for(let i=0;i<t.length;i++) {
      const w=t[i].text;
      if(quote!==-1){if(w===quoteEnd){ends.set(quote,i);quote=-1;}continue;}
      if(['"',"'",'\u201c','\u2018'].includes(w)){quote=i;quoteEnd=w==='\u201c'?'\u201d':w==='\u2018'?'\u2019':w;continue;}
      if(w==='(')paren.push(i);
      else if(w===')'&&paren.length)ends.set(paren.pop(),i);
    }
    let n=0;const nested=[];
    for(let i=0;i<t.length;i++) {
      const token=t[i];
      if(ends.has(i)){
        n++;
        if(token.text==='('){const inner=countGrouped(t.slice(i+1,ends.get(i)),depth+1);if(inner.words>1)nested.push(inner.words);nested.push(...inner.nested);}
        i=ends.get(i);continue;
      }
      let named=false;
      for(const pattern of countingNames.get(lower(token.text))||[]) {
        if(pattern.length>t.length-i)continue;
        if(pattern.every((p,k)=>(space(p)&&space(t[i+k]))||lower(p.text)===lower(t[i+k].text))){n++;i+=pattern.length-1;named=true;break;}
      }
      if(named)continue;
      if(!token.word&&!(token.frozen&&!space(token)))continue;
      n++;
      const number=/[0-9]/.test(token.text)&&/^[0-9.+-]+$/.test(token.text);
      if(number&&i+2<t.length&&space(t[i+1])) {
        const unit=lower(t[i+2].text);
        if(['bar','kg','mg','g','ml','mm','cm','km','m','s','ms','kpa','mpa','psi','volts','amps','ohms','kilograms','grams','liters','litres','meters','metres','seconds','minutes','hours','\u00b0c','\u00b0f'].includes(unit)||['A','V','W','L','mA','kV'].includes(t[i+2].text))i+=2;
        else if(unit==='degrees'&&i+4<t.length&&space(t[i+3])&&['celsius','fahrenheit'].includes(lower(t[i+4].text)))i+=4;
      }
    }
    return {words:n,nested};
  };
  const audit = (text, findings = null, review = o) => {
    const metrics = { sentences: 0, words: 0, longestSentence: 0, longSentences: 0, possiblePassives: 0, unlistedWords: 0 };
    const unknown = new Set();
    const add = (code, severity, message, excerpt, sentence) => { if (findings && findings.length < 250) findings.push({ code, severity, message, evidence: excerpt, sentence }); };
    for (const piece of countPieces(text)) {
      if (!piece.sentence) continue;
      const t = piece.tokens.map(x => ({ ...x })), grouping=countGrouped(t), n = STE(review)?grouping.words:count(t); if (!n) continue;
      metrics.sentences++; metrics.words += count(t); metrics.longestSentence = Math.max(metrics.longestSentence, n);
      const p = positions(t), note = p.length && lower(t[p[0]].text) === "note";
      const limit = STE(review) && review.textType === "procedure" && !note ? 20 : 25;
      if (n > limit) {
        metrics.longSentences++;
        add(STE(review) ? (limit === 20 ? "STE-5.1" : "STE-6.3") : "PL-SENTENCE", "review", `${n} screening words exceed the ${limit}-word target. Review grouping and sentence structure.`, evidence(t), metrics.sentences);
      }
      if(STE(review))for(const inner of grouping.nested){
        metrics.sentences++;metrics.longestSentence=Math.max(metrics.longestSentence,inner);
        if(inner>limit){metrics.longSentences++;add('STE-8.5','review','A parenthetical inner count unit exceeds the selected target. Review both the inner content and its containing sentence.',evidence(t),metrics.sentences);}
      }
      if (passive(t)) {
        metrics.possiblePassives++;
        const message = !STE(review) ? "Possible passive construction. Review whether the reader needs the actor or the result in focus; do not invent an actor." : review.textType === "procedure" ? "Possible passive construction. Confirm the action and responsible actor; do not invent an agent." : "Possible passive construction. For STE descriptions, an unknown agent can justify the passive.";
        add(STE(review) ? "STE-3.6" : "PL-ACTIVE", "review", message, evidence(t), metrics.sentences);
      }
      prepare(t);
      if(STE(review)&&t.some(x=>!x.frozen&&x.text===';'))add('STE-8.1','review','A semicolon remains. Separate the statements only after their scope and relationship are clear.',evidence(t),metrics.sentences);
      if(STE(review)&&t.some(x=>x.text==='('))add('STE-8.5','review','Parenthetical content is grouped in the outer count; supported inner units are screened separately. Review nested, multi-sentence or complex cases and the permitted use of parentheses.',evidence(t),metrics.sentences);
      const coordinated = t.some(x => x.text === "," || x.text === ";") && t.some(x => x.text === ";" || ["and","but"].includes(lower(x.text)));
      if (coordinated && !splitIndependent(t)) add("CLARITY-SCOPE", "review", "Coordinated, reported or protected material was not automatically split. Review attribution, conditions and the scope of each clause before separating it.", evidence(t), metrics.sentences);
      let ing = false, contraction = false, complex = false;
      for (let k = 0; k < t.length; k++) {
        const token = t[k], w = lower(token.text); if (!token.word) continue;
        if (w.includes("n't") || ["'re", "'ve", "'ll", "'d"].some(x => w.endsWith(x))) contraction = true;
        if (token.frozen) continue;
        if (w.length > 4 && w.endsWith("ing") && !["during", "something", "anything", "nothing", "everything"].includes(w)) ing = true;
        if (["has", "have", "had"].includes(w)) {
          let j = k+1;
          for (let seen = 0; seen < 4 && j < t.length; seen++) {
            while (j < t.length && space(t[j])) j++;
            if (j === t.length || !t[j].word) break;
            const next = lower(t[j].text);
            if (next === "been" || PAST.has(next) || (next.length > 3 && next.endsWith("ed")) || ["done","gone","seen","taken","given","known"].includes(next)) { complex = true; break; }
            if (next !== "not" && !h.knownAdverb(resources, next)) break;
            j++;
          }
        }
        if (STE(review) && review.vocabulary.length && !spellings.has(w)) unknown.add(w);
      }
      if (STE(review) && ing) add("STE-3.5", "review", "Review -ing forms: technical nouns/modifiers and some dictionary entries can be permitted; a suffix alone cannot decide.", evidence(t), metrics.sentences);
      if (STE(review) && complex) add("STE-3.2", "review", "Review the auxiliary/tense construction without losing timing, modality or completed-action meaning.", evidence(t), metrics.sentences);
      if (contraction) add("CLARITY-CONTRACTION", "review", "Unresolved contraction: expand only after its meaning is clear.", evidence(t), metrics.sentences);
    }
    metrics.unlistedWords = unknown.size;
    for (const word of [...unknown].sort()) add("STE-VOCABULARY", "review", "Spelling not found in the supplied vocabulary. Review its approved sense, form or technical-term status.", word, 0);
    return metrics;
  };
  const source = input.replace(/\r\n?/g, "\n"), result = { text: "", changes: [], parts: [] };
  for (const piece of h.splitPieces(source)) {
    if (!piece.sentence) { if (!result.text.endsWith("\n\n") || /[^ \t]/.test(piece.text)) { result.text += piece.text; if (piece.text) result.parts.push({ text: piece.text, changed: false }); } continue; }
    let tokens = piece.tokens.map(t => ({ ...t }));
    const vocabularyLocked=prepare(tokens);
    const locked = h.freezeTerms(tokens, o.protectedTerms || []) || vocabularyLocked;
    if (!o.checkOnly) {
      if (o.arrange && !locked) {
        const arranged = activePast(tokens) || splitIndependent(tokens) || standardStructure(tokens, resources, h, o.structuredLists);
        if (arranged) { tokens = arranged.tokens; result.changes.push(arranged.change); prepare(tokens); }
      }
      if (o.synonyms) tokens = simplify(tokens, result.changes);
    }
    result.text += concat(tokens);
    for (const token of tokens) result.parts.push({ text: token.text, changed: token.replaced });
  }
  const rolledBack=JSON.stringify(sourceAnchors(source))!==JSON.stringify(sourceAnchors(result.text));
  if(rolledBack){result.text=source;result.changes=[];result.parts=source?[{text:source,changed:false}]:[];}
  const report = { profile: o.profile, textType: o.textType, status: "review-required", audience: o.audience, purpose: o.purpose,
    sentenceTarget: STE(o) && o.textType === "procedure" ? 20 : 25, vocabularyEntries: o.vocabulary.length,
    estimatedCounts: true, semanticEquivalenceVerified: false, findings: [] };
  const add = (code, message) => report.findings.push({ code, severity: "review", message, evidence: "", sentence: 0 });
  if(rolledBack) add("CONVERSION-ROLLBACK","A numeric or logical marker changed. All draft edits were rolled back; review the original. Marker matching alone never proves equivalent meaning.");
  add("AUTHOR-REVIEW", "No complete conformance or semantic-equivalence assessment was performed. Check facts, actors, quantities, conditions, negation and obligations against the source.");
  add("COUNT-SCOPE", "Word counts are screening estimates, not the full ASD-STE100 section 8 counting method. Review names, labels, quotations, measurements, parentheses and lists. ISO 24495-1 does not impose this application's 25-word heuristic.");
  if (STE(o)) {
    add("STE-DICTIONARY", !o.vocabulary.length ? "The authorized STE general dictionary and reviewed technical terminology are not loaded. Vocabulary conformance is not assessed." : "The supplied vocabulary supports spelling checks only. Its authority, completeness, meanings, word forms and parts of speech still require review.");
    add("STE-COVERAGE", "Review the remaining STE requirements, including technical-term consistency, noun groups, procedural actions/conditions, notes, safety text, paragraphs, spelling directives and presentation. This is not an ASD-approved tool.");
  }
  if (PLAIN(o)) {
    add("ISO-RELEVANT", !o.audience || !o.purpose ? "Specify the intended readers and their task. Then verify that the document includes the information they need." : "Reader and purpose context are recorded, not validated. Confirm relevance and necessary background with the intended readers.");
    add("ISO-FINDABLE", "Review the order, headings, navigation and layout so readers can locate the information they need.");
    add("ISO-UNDERSTANDABLE", "Review terminology, explanations, sentence relationships and examples for the intended readers. Short words alone do not establish understanding.");
    add("ISO-USABLE", "Evaluate the document with representative readers and revise it using their results. No reader evaluation was performed by this tool.");
  }
  const contextFindings=report.findings.slice();
  report.before = audit(source); report.after = audit(result.text, report.findings);
  if (report.findings.length === 250) report.findings.push({ code: "REPORT-LIMIT", severity: "review", message: "The on-screen/exported finding list is capped at 250 entries. Metrics cover the complete input; review the full document.", evidence: "", sentence: 0 });
  const draftDigest=sha256Text(result.text);
  report.screens=[];
  for(const target of ['ste','plain']) {
    if(o.profile!=='combined'&&o.profile!==target)continue;
    const controlled=target==='ste';
    const screen={standard:controlled?'ASD-STE100 Issue 9':'ISO 24495-1:2023',profile:target,
      countingBasis:controlled?'STE grouped count screen; estimates, not full section 8 verification':'Ordinary-word clarity screen; the 25-word target is advisory, not an ISO requirement',
      sentenceTarget:controlled&&o.textType==='procedure'?20:25,draftSha256:draftDigest,
      status:'review-required',estimatedCounts:true};
    const relevant=f=>controlled?!f.code.startsWith('ISO-'):!f.code.startsWith('STE-');
    if(o.profile!=='combined'||controlled){screen.before=report.before;screen.after=report.after;screen.findings=report.findings.filter(relevant);}
    else {
      const review={...o,profile:target};screen.findings=contextFindings.filter(relevant);
      screen.before=audit(source,undefined,review);screen.after=audit(result.text,screen.findings,review);
      if(screen.findings.length===250)screen.findings.push({code:'REPORT-LIMIT',severity:'review',message:'The on-screen/exported finding list is capped at 250 entries. Metrics cover the complete input; review the full document.',evidence:'',sentence:0});
    }
    report.screens.push(screen);
  }
  result.standards = report;
  assessConformity(source, o, result);
  return result;
}
