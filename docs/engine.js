// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// Browser port of the C++23 rewriter. The command-line tool is the reference.

const MASK = (1n << 64n) - 1n;

const VERBS = [
  ["keep", "keeps", "kept", "kept", "keeping"],
  ["show", "shows", "showed", "shown", "showing"],
  ["buy", "buys", "bought", "bought", "buying"],
  ["find", "finds", "found", "found", "finding"],
  ["eat", "eats", "ate", "eaten", "eating"],
  ["build", "builds", "built", "built", "building"],
  ["choose", "chooses", "chose", "chosen", "choosing"],
  ["understand", "understands", "understood", "understood", "understanding"],
  ["hide", "hides", "hid", "hidden", "hiding"],
  ["sleep", "sleeps", "slept", "slept", "sleeping"],
  ["begin", "begins", "began", "begun", "beginning"],
];

const NOUNS = [
  ["child", "children"], ["person", "people"], ["man", "men"], ["woman", "women"],
  ["mouse", "mice"], ["goose", "geese"], ["tooth", "teeth"], ["foot", "feet"], ["ox", "oxen"],
];

const DETECT = new Set(`said went gone came made took taken got gotten saw seen gave given told thought knew known felt kept meant heard held brought caught taught spoke spoken wrote written sat stood grew grown fell fallen won lost sent paid met led cut put let set hit read cost quit became left ran drove driven broke broken wore worn threw thrown swam swum sang sung rang hung stuck struck sold found built bought chose chosen ate eaten slept hid hidden understood began begun did done`.split(/\s+/));

function setOf(words) {
  return new Set(words.split(/\s+/).filter(Boolean));
}

const DETERMINERS = setOf("a an the this that these those my your his her its our their some any no every each either neither much few both all half another such");
const PRONOUNS = setOf("i you he she it we they me him her us them myself yourself himself herself itself ourselves yourselves themselves someone somebody something anyone anybody anything everyone everybody everything nobody nothing who whom whose which what one");
const SUBJECTS = setOf("i you he she it we they who");
const OBJECTS = setOf("me you him her us them whom someone somebody anyone anybody everyone everybody");
const AUX = setOf("am is are was were be been being do does did doing have has had having can could may might must shall should will would to");
const PREPS = setOf("in on at by for with from of into onto upon about against between among through during before after over under above below near without within along across behind beyond up down off out around per via than until since toward towards inside outside beside besides");
const PARTICLES = setOf("up out off down away along around aside apart back over");
const ADV_WORDS = setOf("early late soon today yesterday tomorrow tonight now then here there again together apart ahead overnight daily weekly later already still yet just even almost nearly very really quite rather too also instead aloud well fast hard alone upstairs downstairs inside outside away back forward onward often always never sometimes once twice");
const NOT_ADVERBS = setOf("family apply supply rely july holy silly bully belly jelly fly multiply imply comply reply");
const PART_CUE = setOf("have has had having been being am is are was were get gets got gotten");
const BE = setOf("am is are was were be been being");
const TIME_NOUNS = setOf("visit meeting pause delay period stay trip journey summary statement reply answer introduction look break rest moment instant while description account talk speech lecture conversation call tour flight walk discussion explanation version overview review report message letter film movie story chapter interval chat spell note");
const EVENT_NOUNS = setOf("meeting show process work journey trip discussion class game story day war project session event operation trial experiment lecture movie film match season ceremony party interview negotiation debate search investigation construction production course lesson practice training attack battle conflict task assignment activity exercise report letter chapter song piece job plan question problem answer account article essay message book review summary introduction conclusion agreement argument fight accident injury method procedure conversation program tour flight visit walk talk speech sale service");
const ABBREV = setOf("mr mrs ms dr prof sr jr st vs etc eg ie am pm fig vol gen col capt rev hon dept approx");
const F_VES = new Set(["leaf", "loaf", "wife", "life", "knife", "wolf", "half", "calf", "shelf", "self", "thief"]);
const ANALYTIC_GRADE = new Set("careful cautious cheerful joyful pleased sorrowful unhappy irate angry clever intelligent powerful beautiful lovely attractive difficult challenging important significant useful helpful polite courteous brave courageous expensive costly reliable dependable concise succinct enormous immense obvious evident apparent complicated intricate peaceful tranquil eager enthusiastic tired weary frightened scared generous charitable considerate thoughtful serious solemn funny amusing humorous boring tedious interesting engaging common ordinary rare uncommon distant remote pleasant awful terrible wonderful marvelous grateful thankful busy occupied prepared wide broad similar comparable different distinct short brief strong weak frail easy simple small big large safe secure".split(" "));
const DOUBLE_GRADE = new Set(["big", "hot", "sad", "thin", "fat", "red", "dim", "wet", "fit"]);

function lower(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out += c >= 65 && c <= 90 ? String.fromCharCode(c + 32) : text[i];
  }
  return out;
}

function upperChar(ch) {
  const c = ch.charCodeAt(0);
  return c >= 97 && c <= 122 ? String.fromCharCode(c - 32) : ch;
}

function lowerChar(ch) {
  const c = ch.charCodeAt(0);
  return c >= 65 && c <= 90 ? String.fromCharCode(c + 32) : ch;
}

function isLetter(ch) {
  const c = ch.charCodeAt(0);
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}

function isVowelChar(ch) {
  return "aeiouy".includes(lowerChar(ch));
}

function allCaps(text) {
  let any = false;
  for (const ch of text) {
    if (!isLetter(ch)) continue;
    any = true;
    if (ch >= "a" && ch <= "z") return false;
  }
  return any;
}

function capitalized(text) {
  for (const ch of text) {
    if (!isLetter(ch)) continue;
    return ch >= "A" && ch <= "Z";
  }
  return false;
}

function applyCaps(word, original) {
  if (allCaps(original) && original.length >= 2) return word.toUpperCase();
  if (capitalized(original) && word.length > 0) {
    const chars = [...word];
    for (let i = 0; i < chars.length; i++) {
      if (isLetter(chars[i])) {
        chars[i] = upperChar(chars[i]);
        break;
      }
    }
    return chars.join("");
  }
  return word;
}

function vowelGroups(word) {
  let count = 0;
  let inn = false;
  for (const ch of word) {
    if (isVowelChar(ch)) {
      if (!inn) count++;
      inn = true;
    } else inn = false;
  }
  return count;
}

function cvcLast(word) {
  if (word.length < 3 || vowelGroups(word) !== 1) return false;
  const a = word[word.length - 3];
  const b = word[word.length - 2];
  const c = word[word.length - 1];
  if (isVowelChar(a) || !isVowelChar(b) || isVowelChar(c)) return false;
  return c !== "w" && c !== "x" && c !== "y";
}

function shouldDouble(lemma) {
  return lemma === "permit" || lemma === "occur" || cvcLast(lemma);
}

function sibilant(word) {
  return word.endsWith("ch") || word.endsWith("sh") || word.endsWith("s") || word.endsWith("x") || word.endsWith("z");
}

function consonantY(word) {
  return word.length >= 2 && word.endsWith("y") && !isVowelChar(word[word.length - 2]);
}

function emptyFeatures() {
  return { plural: false, third: false, past: false, participle: false, gerund: false, comparative: false, superlative: false, possessive: false };
}

function sameFeatures(a, b) {
  return a.plural === b.plural && a.third === b.third && a.past === b.past && a.participle === b.participle &&
    a.gerund === b.gerund && a.comparative === b.comparative && a.superlative === b.superlative && a.possessive === b.possessive;
}

function keyOf(lemma, pos) {
  return `${lemma}\0${pos}`;
}

export function loadResources(lexiconTsv, phrasesText, rephrasesTsv = "") {
  const rows = new Map();
  const phraseRules = [];
  const academicRules = [];
  const byLemma = new Map();
  const add = (lemma, pos, synonyms, flag) => {
    const clean = synonyms.filter((syn) => syn && syn !== lemma);
    if (!lemma || clean.length === 0 || rows.has(keyOf(lemma, pos))) return;
    const row = { lemma, pos, flag: flag || "free", synonyms: clean };
    rows.set(keyOf(lemma, pos), row);
    if (!byLemma.has(lemma)) byLemma.set(lemma, []);
    byLemma.get(lemma).push(row);
  };
  for (const rawLine of lexiconTsv.split(/\n/)) {
    const line = rawLine.replace(/\r$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t").map((part) => part.trim());
    if (cols.length < 3) continue;
    const flag = cols[3] || "free";
    if (cols[0] === "@academic") {
      const modes = ["review", "pending", "dependent", "verbal", "support", "benchmark", "nominal", "route", "local"];
      const forms = cols[2].split("|");
      if (cols.length !== 4 || !modes.includes(cols[1]) || !["1", "2"].includes(cols[3]) || forms.length < 2 ||
          forms.some((form) => !/^[a-z]+(?: [a-z]+)*$/.test(form))) throw new TypeError("Invalid academic phrase rule.");
      academicRules.push({ mode: cols[1], forms, minimumIntensity: Number(cols[3]) }); continue;
    }
    if (cols[0] === "@phrase") { phraseRules.push({ mode: cols[1], forms: cols[2].split("|") }); continue; }
    if (cols[0] === "@group") {
      const members = cols[2].split("|").map((part) => part.trim()).filter(Boolean);
      for (const member of members) add(member, cols[1], members, flag);
    } else {
      add(cols[0], cols[1], cols[2].split("|").map((part) => part.trim()), flag);
    }
  }
  const phrases = [];
  for (const rawLine of phrasesText.split(/\n/)) {
    const line = rawLine.replace(/\r$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 2) phrases.push(words);
  }
  phrases.sort((a, b) => b.length - a.length);
  const phraseIndex = new Map(), fixedPhraseIndex = new Map();
  const variableForms = new Set(phraseRules.flatMap((rule) => rule.forms));
  const addPhrase = (index, phrase) => {
    if (!index.has(phrase[0])) index.set(phrase[0], []);
    index.get(phrase[0]).push(phrase);
  };
  // Already longest-first: indexing does not change matching precedence.
  for (const phrase of phrases) {
    addPhrase(phraseIndex, phrase);
    if (!variableForms.has(phrase.join(" "))) addPhrase(fixedPhraseIndex, phrase);
  }
  const rephrases = rephrasesTsv.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const [source, target, position, minimum] = line.split("\t");
    if (!source || !target || (!["tail", "edge"].includes(position) || !["0", "1"].includes(minimum))) throw new TypeError("Invalid phrase rule.");
    return { source: source.split(" "), target, tailOnly: position === "tail", minimumIntensity: Number(minimum) };
  }).sort((a, b) => b.source.length - a.source.length);
  const academicIndex = new Map();
  for (const rule of academicRules) {
    rule.source = rule.forms[0].split(" ");
    if (!academicIndex.has(rule.source[0])) academicIndex.set(rule.source[0], []);
    academicIndex.get(rule.source[0]).push(rule);
  }
  for (const rules of academicIndex.values()) rules.sort((a, b) => b.source.length - a.source.length);
  return { rows, byLemma, phrases, phraseRules, phraseIndex, fixedPhraseIndex, rephrases, academicRules, academicIndex };
}

function findRow(resources, lemma, pos) {
  return resources.rows.get(keyOf(lemma, pos)) || null;
}

function hasLemma(resources, lemma) {
  return resources.byLemma.has(lemma);
}

function verbByBase(lemma) {
  return VERBS.find((row) => row[0] === lemma) || null;
}

function verbBySurface(surface) {
  return VERBS.find((row) => row.includes(surface)) || null;
}

function singularOf(surface) {
  const row = NOUNS.find((item) => item[1] === surface);
  return row ? row[0] : null;
}

function pluralOf(lemma) {
  const row = NOUNS.find((item) => item[0] === lemma);
  return row ? row[1] : null;
}

function grade(lemma, superlative) {
  if (lemma === "huge" || lemma === "little" || lemma === "glad") return null;
  const suffix = superlative ? "est" : "er";
  const ySuffix = superlative ? "iest" : "ier";
  const blocked = (word) => ["littler", "littlest", "gladder", "gladdest", "huger", "hugest"].includes(word);
  if (consonantY(lemma) && vowelGroups(lemma) <= 2) {
    const word = lemma.slice(0, -1) + ySuffix;
    return blocked(word) ? null : word;
  }
  if (lemma.endsWith("e") && !lemma.endsWith("ee")) {
    const stem = lemma.slice(0, -1);
    if (!(vowelGroups(stem) <= 1 || lemma.endsWith("le"))) return null;
    const word = stem + suffix;
    return blocked(word) ? null : word;
  }
  if (vowelGroups(lemma) !== 1) return null;
  let word = lemma;
  if (cvcLast(lemma)) {
    if (!DOUBLE_GRADE.has(lemma)) return null;
    word += lemma[lemma.length - 1];
  }
  word += suffix;
  return blocked(word) ? null : word;
}

function regularPast(lemma) {
  if (consonantY(lemma)) return `${lemma.slice(0, -1)}ied`;
  if (lemma.endsWith("e")) return `${lemma}d`;
  if (shouldDouble(lemma)) return `${lemma}${lemma[lemma.length - 1]}ed`;
  return `${lemma}ed`;
}

function regularGerund(lemma) {
  if (lemma.length > 2 && lemma.endsWith("ie")) return `${lemma.slice(0, -2)}ying`;
  if (lemma.endsWith("e") && !lemma.endsWith("ee") && !lemma.endsWith("oe") && !lemma.endsWith("ye")) {
    return `${lemma.slice(0, -1)}ing`;
  }
  if (shouldDouble(lemma)) return `${lemma}${lemma[lemma.length - 1]}ing`;
  return `${lemma}ing`;
}

function regularThird(lemma) {
  if (consonantY(lemma)) return `${lemma.slice(0, -1)}ies`;
  if (sibilant(lemma)) return `${lemma}es`;
  return `${lemma}s`;
}

function regularPlural(lemma) {
  if (lemma === "aircraft") return "aircraft";
  if (F_VES.has(lemma)) {
    if (lemma.endsWith("fe")) return `${lemma.slice(0, -2)}ves`;
    return `${lemma.slice(0, -1)}ves`;
  }
  if (consonantY(lemma)) return `${lemma.slice(0, -1)}ies`;
  if (sibilant(lemma)) return `${lemma}es`;
  return `${lemma}s`;
}

function inflect(lemma, pos, features) {
  if (pos === "adv") {
    if (features.plural || features.past || features.gerund || features.comparative || features.superlative || features.third || features.participle) return null;
    return lemma;
  }
  if (pos === "adj") {
    if (features.comparative || features.superlative) {
      const form = grade(lemma, features.superlative);
      if (form) return form;
      return ANALYTIC_GRADE.has(lemma) ? `${features.superlative ? "most" : "more"} ${lemma}` : null;
    }
    if (features.plural || features.past || features.gerund || features.third) return null;
    return lemma;
  }
  if (pos === "noun") {
    if (features.past || features.gerund || features.third || features.comparative) return null;
    if (!features.plural) return lemma;
    return pluralOf(lemma) || regularPlural(lemma);
  }
  if (pos === "verb") {
    const forms = verbByBase(lemma);
    if (forms) {
      if (features.gerund) return forms[4];
      if (features.third) return forms[1];
      if (features.participle) return forms[3];
      if (features.past) return forms[2];
      return forms[0];
    }
    if (features.gerund) return regularGerund(lemma);
    if (features.third) return regularThird(lemma);
    if (features.past || features.participle) return regularPast(lemma);
    if (features.comparative || features.superlative || features.plural) return null;
    return lemma;
  }
  return null;
}

function contraction(word) {
  return word.endsWith("n't") || word.endsWith("'re") || word.endsWith("'ve") || word.endsWith("'ll") || word.endsWith("'d") || word.endsWith("'m") || word.endsWith("'t");
}

function analyze(resources, surface, participleContext) {
  let raw = lower(surface);
  for (let i = 0; i < raw.length; i++) if (raw.charCodeAt(i) >= 128) return [];
  if (!raw || contraction(raw)) return [];
  let possessive = false;
  if (raw.endsWith("'s") && raw.length > 2) {
    raw = raw.slice(0, -2);
    possessive = true;
  } else if (raw.endsWith("s'") && raw.length > 2) {
    raw = raw.slice(0, -1);
    possessive = true;
  } else if (raw.includes("'")) return [];

  const found = [];
  const add = (lemma, pos, features) => {
    const row = findRow(resources, lemma, pos);
    if (!row) return;
    const next = { ...features, possessive };
    if (found.some((item) => item.lemma === lemma && item.pos === pos && sameFeatures(item.features, next))) return;
    found.push({ lemma, pos, flag: row.flag, features: next });
  };
  for (const row of resources.byLemma.get(raw) || []) add(row.lemma, row.pos, emptyFeatures());
  const singular = singularOf(raw);
  if (singular) add(singular, "noun", { ...emptyFeatures(), plural: true });
  const forms = verbBySurface(raw);
  if (forms) {
    const features = emptyFeatures();
    if (raw === forms[4] && raw !== forms[0]) features.gerund = true;
    else if (raw === forms[1] && raw !== forms[0]) features.third = true;
    else if (raw === forms[2] && raw === forms[3] && raw !== forms[0]) {
      if (participleContext) features.participle = true;
      else features.past = true;
    } else if (raw === forms[2] && raw !== forms[0]) features.past = true;
    else if (raw === forms[3] && raw !== forms[0]) features.participle = true;
    if (features.gerund || features.third || features.past || features.participle) add(forms[0], "verb", features);
  }
  const tense = emptyFeatures();
  if (participleContext) tense.participle = true;
  else tense.past = true;
  const addTense = (lemma) => add(lemma, "verb", { ...tense });
  const addIng = (lemma) => add(lemma, "verb", { ...emptyFeatures(), gerund: true });
  if (raw.endsWith("ied") && raw.length > 3) addTense(`${raw.slice(0, -3)}y`);
  if (raw.endsWith("ed") && raw.length > 3) {
    const stem = raw.slice(0, -2);
    addTense(stem);
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2] && !isVowelChar(stem[stem.length - 1])) {
      addTense(stem.slice(0, -1));
    }
  }
  if (raw.length > 2 && raw.endsWith("d") && raw[raw.length - 2] === "e") addTense(raw.slice(0, -1));
  if (raw.endsWith("ying") && raw.length > 4) addIng(`${raw.slice(0, -4)}ie`);
  if (raw.endsWith("ing") && raw.length > 4) {
    const stem = raw.slice(0, -3);
    addIng(stem);
    addIng(`${stem}e`);
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2] && !isVowelChar(stem[stem.length - 1])) {
      addIng(stem.slice(0, -1));
    }
  }
  const addS = (lemma) => {
    add(lemma, "noun", { ...emptyFeatures(), plural: true });
    add(lemma, "verb", { ...emptyFeatures(), third: true });
  };
  if (raw.endsWith("ies") && raw.length > 3) addS(`${raw.slice(0, -3)}y`);
  if (raw.endsWith("es") && raw.length > 3) {
    const stem = raw.slice(0, -2);
    if (sibilant(stem)) addS(stem);
  }
  if (raw.endsWith("s") && !raw.endsWith("ss") && raw.length > 2) addS(raw.slice(0, -1));
  const addGrade = (lemma, superlative) => add(lemma, "adj", { ...emptyFeatures(), comparative: !superlative, superlative });
  if (raw.endsWith("ier") && raw.length > 3) addGrade(`${raw.slice(0, -3)}y`, false);
  if (raw.endsWith("iest") && raw.length > 4) addGrade(`${raw.slice(0, -4)}y`, true);
  if (raw.endsWith("er") && raw.length > 3 && !raw.endsWith("eer")) {
    const stem = raw.slice(0, -2);
    addGrade(stem, false);
    addGrade(`${stem}e`, false);
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2] && !isVowelChar(stem[stem.length - 1])) addGrade(stem.slice(0, -1), false);
  }
  if (raw.endsWith("est") && raw.length > 4 && !raw.endsWith("eest")) {
    const stem = raw.slice(0, -3);
    addGrade(stem, true);
    addGrade(`${stem}e`, true);
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2] && !isVowelChar(stem[stem.length - 1])) addGrade(stem.slice(0, -1), true);
  }
  return found;
}

function knownAdverb(resources, word) {
  if (ADV_WORDS.has(word) || findRow(resources, word, "adv")) return true;
  if (NOT_ADVERBS.has(word)) return false;
  return word.length >= 4 && word.endsWith("ly") && !findRow(resources, word, "noun") && !findRow(resources, word, "verb") && !findRow(resources, word, "adj");
}

function looksLikeVerb(resources, word) {
  const low = lower(word);
  if (!low) return false;
  if (AUX.has(low) || DETECT.has(low)) return true;
  if (analyze(resources, low, false).some((item) => item.pos === "verb")) return true;
  return low.length >= 5 && low.endsWith("ed") && !low.endsWith("eed") && !hasLemma(resources, low);
}

function needsAn(word) {
  let letters = 0;
  let first = "";
  for (const ch of word) {
    if (!isLetter(ch)) continue;
    if (letters === 0) first = lowerChar(ch);
    letters++;
  }
  if (!letters) return false;
  const acronym = letters === 1 || (allCaps(word) && letters >= 2 && letters <= 6);
  if (acronym) return "aefhilmnorsx".includes(first);
  const low = lower(word);
  for (const prefix of ["hour", "honest", "honor", "honour", "heir", "herb", "homage"]) {
    if (low.startsWith(prefix)) return true;
  }
  if (/^(uni|use|usu|uti|eu|one|once|uke)/.test(low)) return false;
  return "aeiou".includes(first);
}

function coordinator(word) {
  return word === "and" || word === "or" || word === "but" || word === "nor";
}

function subordinatorWord(word) {
  return ["because", "although", "though", "after", "before", "when"].includes(word);
}

function knownNoun(resources, word) {
  return analyze(resources, word, false).some((item) => item.pos === "noun");
}

function knownAdjective(resources, word) {
  return analyze(resources, word, false).some((item) => item.pos === "adj");
}

const UNICODE_PUNCT = new Set(["\u2018", "\u2019", "\u201c", "\u201d", "\u2013", "\u2014", "\u2026", "\u00a0", "\ufeff"]);
const QUOTES = new Set(['"', "'", "\u2018", "\u2019", "\u201c", "\u201d"]);
const spaceChar = (ch) => ch === " " || ch === "\t" || ch === "\n";
const digitChar = (ch) => ch >= "0" && ch <= "9";
const terminal = (s) => /^[.!?]+$/.test(s);

function opaqueEnd(t, i) {
  if (t[i] === "`" || t.startsWith("~~~", i)) {
    let n = 1;
    while (t[i + n] === t[i]) n++;
    const delimiter = t[i].repeat(n);
    const end = t.indexOf(delimiter, i + n);
    return end < 0 ? t.length : end + n;
  }
  if (t[i] === "<") {
    const end = t.indexOf(">", i + 1);
    if (end >= 0) return end + 1;
  }
  if (t[i] === "[" || (t[i] === "!" && t[i + 1] === "[")) {
    const mid = t.indexOf("](", i + 1);
    const newline = t.indexOf("\n", i + 1);
    if (mid >= 0 && (newline < 0 || mid < newline)) {
      let depth = 1;
      for (let k = mid + 2; k < t.length && t[k] !== "\n"; k++) {
        if (t[k] === "(") depth++;
        if (t[k] === ")" && --depth === 0) return k + 1;
      }
    }
  }
  if (!isLetter(t[i]) && !digitChar(t[i])) return i;
  let end = i;
  if (/^(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|www\.)/i.test(t.slice(i))) {
    while (end<t.length && !spaceChar(t[end]) && !"<>\"'`".includes(t[end]) && !UNICODE_PUNCT.has(t[end])) end++;
    while (end>i && ".,!?;:".includes(t[end-1])) end--;
    return end;
  }
  while (end < t.length && !spaceChar(t[end]) && !"<>\"'`()[]{}".includes(t[end]) && !UNICODE_PUNCT.has(t[end])) end++;
  const part = t.slice(i, end);
  const opaque = /[@/\\_]/.test(part) || /\.[A-Za-z0-9]/.test(part);
  if (!opaque) return i;
  while (end > i && ".,!?;:".includes(t[end - 1])) end--;
  return end;
}

function tokenize(text) {
  const tokens = [];
  for (let i = 0; i < text.length;) {
    let j = i + 1;
    let word = false, frozen = false;
    const ch = text[i], code = ch.charCodeAt(0);
    if (spaceChar(ch)) {
      while (j < text.length && spaceChar(text[j])) j++;
    } else {
      const opaque = opaqueEnd(text, i);
      if (opaque > i) { j = opaque; frozen = true; }
      else if (UNICODE_PUNCT.has(ch)) { /* punctuation is a separate token */ }
      else if (isLetter(ch) || digitChar(ch) || code >= 128) {
        word = true; frozen = digitChar(ch) || code >= 128;
        while (j < text.length) {
          const d = text[j];
          if ((isLetter(d) || digitChar(d) || d.charCodeAt(0) >= 128) && !UNICODE_PUNCT.has(d)) {
            frozen ||= digitChar(d) || d.charCodeAt(0) >= 128; j++; continue;
          }
          if ((d === "'" || d === "-" || d === "\u2019") && j + 1 < text.length && isLetter(text[j + 1])) {
            frozen = true; j++; continue;
          }
          break;
        }
        if (j < text.length && text[j] === "'" && j > i && text[j - 1] === "s") { j++; frozen = true; }
      } else if (terminal(ch)) {
        while (j < text.length && terminal(text[j])) j++;
      }
    }
    tokens.push({ text: text.slice(i, j), word, frozen, replaced: false });
    i = j;
  }
  return tokens;
}

function concat(tokens) { return tokens.map((token) => token.text).join(""); }

function splitPieces(text) {
  const tokens = tokenize(text), pieces = [], quotes = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    pieces.push({ sentence: true, text: concat(current), tokens: current });
    current = [];
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const whitespace = !token.word && !token.frozen && /^[ \t\n]+$/.test(token.text);
    if (whitespace && !quotes.length && !current.length) {
      flush(); pieces.push({ sentence: false, text: token.text, tokens: [] }); continue;
    }
    current.push(token);
    let closed = false;
    if (QUOTES.has(token.text)) {
      const closing = ({ "\u201c": "\u201d", "\u2018": "\u2019" })[token.text] || token.text;
      if (quotes.length && quotes.at(-1) === token.text) { quotes.pop(); closed = true; }
      else if (!["\u201d", "\u2019"].includes(token.text)) quotes.push(closing);
    }
    let boundary = !quotes.length && (terminal(token.text) || (closed && i > 0 && terminal(tokens[i - 1].text)));
    if (boundary && token.text === "." && i > 0 && tokens[i - 1].word) {
      const w = lower(tokens[i - 1].text);
      if ((w.length === 1 && isLetter(w)) || ABBREV.has(w)) boundary = false;
    }
    if (boundary && i + 1 < tokens.length) {
      const next = tokens[i + 1];
      boundary = !next.word && !!next.text && spaceChar(next.text[0]);
    }
    if (boundary) flush();
  }
  let suffix = "";
  if (current.length && !current.at(-1).word && !current.at(-1).frozen && /^[ \t\n]+$/.test(current.at(-1).text)) suffix = current.pop().text;
  flush();
  if (suffix) pieces.push({ sentence: false, text: suffix, tokens: [] });
  return pieces;
}

function wordPositions(tokens) {
  const indexes = [];
  tokens.forEach((token, index) => {
    if (token.word) indexes.push(index);
  });
  return indexes;
}

function wordAt(tokens, words, slot) {
  if (slot < 0 || slot >= words.length) return "";
  return lower(tokens[words[slot]].text);
}

function isSpace(token) {
  return !token.word && token.text.length > 0 && /^[ \t\n]+$/.test(token.text);
}

function isDigitToken(token) {
  return !token.word && token.text.length > 0 && /^[0-9]+$/.test(token.text);
}

function punctIndex(tokens) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (isSpace(tokens[i])) continue;
    if (tokens[i].text === "." || tokens[i].text === "!" || tokens[i].text === "?") return i;
    return -1;
  }
  return -1;
}

function clauseComma(tokens, index) {
  if (tokens[index].text !== ",") return false;
  let prev = index - 1;
  while (prev >= 0 && isSpace(tokens[prev])) prev--;
  let next = index + 1;
  while (next < tokens.length && isSpace(tokens[next])) next++;
  if (prev >= 0 && next < tokens.length && isDigitToken(tokens[prev]) && isDigitToken(tokens[next])) return false;
  return true;
}

function simpleVerbRange(resources, tokens, begin, end) {
  let any = false, lexical = 0;
  for (let i = begin; i < end; i++) {
    if (!tokens[i].word || !looksLikeVerb(resources, tokens[i].text)) continue;
    any = true;
    if (!AUX.has(lower(tokens[i].text))) lexical++;
  }
  return any && lexical <= 1;
}

function rangeHas(tokens, begin, end, pred) {
  for (let i = begin; i < end; i++) if (pred(tokens[i])) return true;
  return false;
}

function wordCount(tokens, begin, end) {
  let count = 0;
  for (let i = begin; i < end; i++) if (tokens[i].word) count++;
  return count;
}

function sliceTokens(tokens, begin, end) {
  while (begin < end && isSpace(tokens[begin])) begin++;
  while (end > begin && isSpace(tokens[end - 1])) end--;
  return begin >= end ? [] : tokens.slice(begin, end).map((token) => ({ ...token }));
}

function pushSpace(out) {
  if (out.length === 0 || isSpace(out[out.length - 1])) return;
  out.push({ text: " ", word: false, frozen: false, replaced: false });
}

function appendSlice(out, slice) {
  if (slice.length === 0) return;
  pushSpace(out);
  for (const token of slice) out.push(token);
}

function capFirst(slice) {
  for (const token of slice) {
    if (!token.word || !token.text) continue;
    const low = lower(token.text);
    if (low === "i") {
      token.text = "I";
      return;
    }
    if (allCaps(token.text)) return;
    if (isLetter(token.text[0])) token.text = upperChar(token.text[0]) + token.text.slice(1);
    return;
  }
}

function decapFirst(resources, slice) {
  for (const token of slice) {
    if (!token.word || !token.text) continue;
    const low = lower(token.text);
    if (token.frozen || low === "i" || allCaps(token.text) || !capitalized(token.text)) return;
    const ordinary = DETERMINERS.has(low) || PRONOUNS.has(low) || AUX.has(low) || PREPS.has(low) || coordinator(low) || subordinatorWord(low) || hasLemma(resources, low);
    if (!ordinary) return;
    if (isLetter(token.text[0])) token.text = lowerChar(token.text[0]) + token.text.slice(1);
    return;
  }
}

function manner(resources, token) {
  if (token.frozen) return false;
  return analyze(resources, token.text, false).some((item) => item.pos === "adv" && item.flag === "manner" && ["quickly", "rapidly", "swiftly", "carefully", "cautiously", "quietly", "silently", "loudly", "noisily"].includes(item.lemma));
}

function hasAdjective(resources, token) {
  return !token.frozen && analyze(resources, token.text, false).some((item) => item.pos === "adj");
}

function subAt(tokens, words, slot) {
  if (slot < 0 || slot >= words.length) return null;
  const first = wordAt(tokens, words, slot);
  if (first === "even" && slot + 1 < words.length && wordAt(tokens, words, slot + 1) === "though") {
    return { slot, count: 2, name: "even though" };
  }
  if (subordinatorWord(first)) return { slot, count: 1, name: first };
  return null;
}

function finish(tokens, before, detail) {
  const after = concat(tokens);
  if (before === after) return null;
  return { tokens, change: { kind: "arrangement", before, after, detail } };
}

function tryClause(resources, tokens, words) {
  if (words.length === 0) return null;
  const punct = punctIndex(tokens);
  const limit = punct < 0 ? tokens.length : punct;
  const before = concat(tokens);
  const front = subAt(tokens, words, 0);
  if (front) {
    let commas = 0;
    let commaAt = -1;
    for (let i = 0; i < limit; i++) {
      if (clauseComma(tokens, i)) {
        commas++;
        commaAt = i;
      }
    }
    if (commas !== 1) return null;
    const introBegin = words[front.count - 1] + 1;
    const mainBegin = commaAt + 1;
    if (wordCount(tokens, introBegin, commaAt) < 2 || wordCount(tokens, mainBegin, limit) < 2) return null;
      const coord = (token) => token.word && coordinator(lower(token.text));
    if (!simpleVerbRange(resources, tokens, introBegin, commaAt) || !simpleVerbRange(resources, tokens, mainBegin, limit)) return null;
    if (rangeHas(tokens, introBegin, commaAt, coord) || rangeHas(tokens, mainBegin, limit, coord)) return null;
    const main = sliceTokens(tokens, mainBegin, limit);
    const intro = sliceTokens(tokens, introBegin, commaAt);
    capFirst(main);
    decapFirst(resources, intro);
    let sub;
    if (front.count === 2) {
      const even = { ...tokens[words[0]], text: "even" };
      const though = { ...tokens[words[1]], text: "though" };
      sub = [even, { text: " ", word: false, frozen: false, replaced: false }, though];
    } else sub = [{ ...tokens[words[0]], text: front.name }];
    const rebuilt = [...main];
    appendSlice(rebuilt, sub);
    appendSlice(rebuilt, intro);
    if (punct >= 0) rebuilt.push({ ...tokens[punct] });
    return finish(rebuilt, before, `Moved a fronted ${front.name}-clause to the end`);
  }
  let seen = 0;
  let sub = null;
  for (let slot = 1; slot < words.length;) {
    const found = subAt(tokens, words, slot);
    if (found) {
      seen++;
      sub = found;
      slot += found.count;
    } else slot++;
  }
  if (seen !== 1 || !sub) return null;
  if (sub.name === "though" && sub.slot + 1 === words.length) return null;
  if (sub.slot > 0) {
    const prev = wordAt(tokens, words, sub.slot - 1);
    if (prev === "just" || prev === "only" || (prev === "even" && sub.name === "though")) return null;
  }
  const leftEnd = words[sub.slot];
  const rightBegin = words[sub.slot + sub.count - 1] + 1;
  const coord = (token) => token.word && coordinator(lower(token.text));
  if (wordCount(tokens, 0, leftEnd) < 2 || wordCount(tokens, rightBegin, limit) < 2) return null;
  if (!simpleVerbRange(resources, tokens, 0, leftEnd) || !simpleVerbRange(resources, tokens, rightBegin, limit)) return null;
  if (rangeHas(tokens, 0, leftEnd, coord) || rangeHas(tokens, rightBegin, limit, coord)) return null;
  const left = sliceTokens(tokens, 0, leftEnd);
  const right = sliceTokens(tokens, rightBegin, limit);
  while (left.length && (isSpace(left[left.length - 1]) || left[left.length - 1].text === ",")) left.pop();
  decapFirst(resources, left);
  decapFirst(resources, right);
  const rebuilt = [];
  if (sub.count === 2) {
    rebuilt.push({ text: "Even", word: true, frozen: false, replaced: false }, { text: " ", word: false, frozen: false, replaced: false }, { text: "though", word: true, frozen: false, replaced: false });
  } else {
    const name = sub.name ? upperChar(sub.name[0]) + sub.name.slice(1) : "";
    rebuilt.push({ text: name, word: true, frozen: false, replaced: false });
  }
  appendSlice(rebuilt, right);
  rebuilt.push({ text: ",", word: false, frozen: false, replaced: false });
  appendSlice(rebuilt, left);
  if (punct >= 0) rebuilt.push({ ...tokens[punct] });
  return finish(rebuilt, before, `Moved a ${sub.name}-clause to the front`);
}

function tryAdverb(resources, tokens, words) {
  if (tokens.filter(t => t.word && looksLikeVerb(resources,t.text) && !AUX.has(lower(t.text))).length>1) return null;
  if (words.length < 3) return null;
  const punct = punctIndex(tokens);
  const limit = punct < 0 ? tokens.length : punct;
  const before = concat(tokens);
  const first = tokens[words[0]];
  let afterFirst = words[0] + 1;
  while (afterFirst < limit && isSpace(tokens[afterFirst])) afterFirst++;
  const coord = (token) => token.word && coordinator(lower(token.text));
  if (manner(resources, first) && afterFirst < limit && tokens[afterFirst].text === ",") {
    const restBegin = afterFirst + 1;
    if (wordCount(tokens, restBegin, limit) >= 2 && simpleVerbRange(resources, tokens, restBegin, limit) && !rangeHas(tokens, restBegin, limit, coord)) {
      const rest = sliceTokens(tokens, restBegin, limit);
      capFirst(rest);
      const adverb = { ...first };
      if (!allCaps(adverb.text)) adverb.text = lower(adverb.text);
      appendSlice(rest, [adverb]);
      if (punct >= 0) rest.push({ ...tokens[punct] });
      return finish(rest, before, "Moved a fronted manner adverb to the end");
    }
  }
  const lastSlot = words.length - 1;
  const last = tokens[words[lastSlot]];
  if (!manner(resources, last) || words[lastSlot] >= limit) return null;
  if (coordinator(wordAt(tokens, words, lastSlot - 1))) return null;
  let beforeLast = words[lastSlot] - 1;
  while (beforeLast >= 0 && isSpace(tokens[beforeLast])) beforeLast--;
  if (beforeLast >= 0 && tokens[beforeLast].text === ",") return null;
  if (!simpleVerbRange(resources, tokens, 0, words[lastSlot]) || rangeHas(tokens, 0, words[lastSlot], coord)) return null;
  const front = sliceTokens(tokens, 0, words[lastSlot]);
  decapFirst(resources, front);
  const adverb = { ...last };
  if (!allCaps(adverb.text)) adverb.text = upperChar(lower(adverb.text)[0]) + lower(adverb.text).slice(1);
  const rebuilt = [adverb, { text: ",", word: false, frozen: false, replaced: false }];
  appendSlice(rebuilt, front);
  if (punct >= 0) rebuilt.push({ ...tokens[punct] });
  return finish(rebuilt, before, "Moved a final manner adverb to the front");
}

function tryAdjectives(resources, tokens, words) {
  if (words.length < 3) return null;
  for (let slot = 0; slot + 2 < words.length; slot++) {
    if (wordAt(tokens, words, slot + 1) !== "and") continue;
    if (slot + 3 < words.length && wordAt(tokens, words, slot + 3) === "and") continue;
    if (!hasAdjective(resources, tokens[words[slot]]) || !hasAdjective(resources, tokens[words[slot + 2]])) continue;
    if (slot > 0 && knownAdverb(resources, wordAt(tokens, words, slot - 1))) continue;
    let tight = true;
    for (let i = words[slot] + 1; i < words[slot + 2]; i++) {
      if (i !== words[slot + 1] && !isSpace(tokens[i])) tight = false;
    }
    if (!tight) continue;
    const copy = tokens.map((token) => ({ ...token }));
    const left = copy[words[slot]];
    const right = copy[words[slot + 2]];
    const swap = left.text;
    left.text = applyCaps(lower(right.text), left.text);
    right.text = applyCaps(lower(swap), right.text);
    left.replaced = right.replaced = true;
    return finish(copy, concat(tokens), "Swapped coordinated adjectives");
  }
  return null;
}


function tryMedialAdverb(resources, tokens, words) {
  const verb = (t) => t.word && looksLikeVerb(resources, t.text);
  const coord = (t) => t.word && coordinator(lower(t.text));
  if (words.length < 3 || !rangeHas(tokens, 0, tokens.length, verb) || rangeHas(tokens, 0, tokens.length, coord)) return null;
  if (tokens.filter((t)=>verb(t) && !AUX.has(lower(t.text))).length > 1) return null;
  const punct = punctIndex(tokens), limit = punct < 0 ? tokens.length : punct;
  const slot = 1, index = words[slot], adv = tokens[index];
  const prev = wordAt(tokens, words, 0);
  if (adv.frozen || !manner(resources, adv) || knownAdverb(resources, prev) || AUX.has(prev) || !SUBJECTS.has(prev)) return null;
  const next = wordAt(tokens, words, 2);
  if (!analyze(resources, next, false).some((a) => a.pos === "verb" && (a.features.past || a.features.third))) return null;
  if (words[2] !== index+2 || !isSpace(tokens[index+1])) return null;
  for (let k = 3; k < words.length; k++) {
    const w = wordAt(tokens, words, k);
    if (knownAdverb(resources, w) || subordinatorWord(w)) return null;
  }
  const result = sliceTokens(tokens, 0, index);
  appendSlice(result, sliceTokens(tokens, index+2, limit));
  appendSlice(result, [{ ...adv }]);
  if (punct >= 0) result.push({ ...tokens[punct] });
  return finish(result, concat(tokens), "Moved an unmodified medial manner adverb to the end");
}

function arrange(resources, tokens, enabled, extended = false, seed = 1) {
  const scope = new Set("not never no neither nor only just hardly scarcely barely if unless whether that which who whom whose where why how while to without can could may might must shall should will would cannot say says said tell tells told know knows knew think thinks thought believe believes believed wonder wonders wondered very too so quite rather almost nearly less more least most enough especially particularly".split(" "));
  let subordinators = 0, commas = 0, thirdPerson = false;
  for (const token of tokens) {
    const w = lower(token.text);
    if (!enabled || scope.has(w) || w.includes("n't")) return null;
    if (subordinatorWord(w)) subordinators++;
    if (["he", "she", "it", "they", "him", "her", "his", "them", "their", "its"].includes(w)) thirdPerson = true;
    if (token.text === ",") commas++;
    const numeric = /^[0-9.]+$/.test(token.text) && /[0-9]/.test(token.text);
    if ((!token.word && token.frozen && !numeric) || token.text.includes("\n")) return null;
    if (!token.word && token.text !== "." && token.text !== "," && !numeric && !isSpace(token)) return null;
  }
  if (!enabled || subordinators > 1 || commas > 1 || (subordinators && thirdPerson)) return null;
  const words = wordPositions(tokens);
  return tryClause(resources, tokens, words) || (extended && tryMedialAdverb(resources, tokens, words)) || tryAdverb(resources, tokens, words) || (extended && tryNounSubjectAdverb(resources, tokens, words, seed)) || tryAdjectives(resources, tokens, words);
}

function fnv1a(text) {
  let hash = 14695981039346656037n;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * 1099511628211n) & MASK;
  }
  return hash;
}

function mix64(value) {
  let x = (value + 0x9e3779b97f4a7c15n) & MASK;
  x = ((x ^ (x >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
  x = ((x ^ (x >> 27n)) * 0x94d049bb133111ebn) & MASK;
  return (x ^ (x >> 31n)) & MASK;
}

function intensityAllows(intensity, pos, flag) {
  if (flag === "careful") return intensity >= 2;
  if (intensity <= 0) {
    if (pos === "adj" && (flag === "free" || flag === "time" || flag === "quant" || flag.startsWith("head:"))) return true;
    return pos === "adv" && flag === "manner";
  }
  return true;
}

function hardKeep(analysis, prev) {
  const afterDet = DETERMINERS.has(prev);
  const afterAux = AUX.has(prev);
  const afterBe = BE.has(prev);
  const afterSubject = SUBJECTS.has(prev);
  if (afterDet && analysis.pos === "verb") return false;
  if (afterAux && !afterBe && analysis.pos !== "verb") return false;
  if (afterSubject && !afterBe && (analysis.pos === "adj" || analysis.pos === "noun")) return false;
  return true;
}

function scoreAnalysis(resources, analysis, prev, next) {
  let score = 0;
  if (analysis.pos === "noun") {
    if (DETERMINERS.has(prev)) score += 4;
    if (PREPS.has(prev)) score += 2;
    if (SUBJECTS.has(prev)) score -= 3;
  } else if (analysis.pos === "verb") {
    if (AUX.has(prev) || prev === "not" || prev === "n't" || prev === "never") score += 5;
    if (SUBJECTS.has(prev) || PRONOUNS.has(prev)) score += 3;
    if (analysis.features.past || analysis.features.participle || analysis.features.third || analysis.features.gerund) score += 2;
    if (DETERMINERS.has(prev)) score -= 6;
  } else if (analysis.pos === "adj") {
    if (DETERMINERS.has(prev)) score += 3;
    if (BE.has(prev)) score += 4;
    if (knownAdverb(resources, prev)) score += 2;
    if (analysis.features.comparative || analysis.features.superlative) score += 2;
    if (knownNoun(resources, next) || DETERMINERS.has(next)) score += 1;
    if (SUBJECTS.has(prev)) score -= 3;
  } else if (analysis.pos === "adv") {
    if (analysis.lemma.endsWith("ly")) score += 3;
    if (DETERMINERS.has(prev)) score -= 2;
  }
  return score;
}

function atSlot(tokens, words, slot) {
  return wordAt(tokens, words, slot);
}

function npEnd(resources, tokens, words, slot) {
  if (slot < 0 || slot >= words.length) return slot;
  let cursor = slot;
  const first = atSlot(tokens, words, cursor);
  if (DETERMINERS.has(first) || OBJECTS.has(first)) cursor++;
  while (cursor < words.length && (knownAdjective(resources, atSlot(tokens, words, cursor)) || knownAdverb(resources, atSlot(tokens, words, cursor)))) cursor++;
  if (cursor < words.length) cursor++;
  return cursor;
}

function secondNp(resources, tokens, words, slot) {
  const next = atSlot(tokens, words, slot + 1);
  if (!next) return false;
  if (OBJECTS.has(next)) {
    const after = atSlot(tokens, words, slot + 2);
    return DETERMINERS.has(after) || knownNoun(resources, after) || knownAdjective(resources, after);
  }
  if (!DETERMINERS.has(next) && !knownNoun(resources, next)) return false;
  const following = atSlot(tokens, words, npEnd(resources, tokens, words, slot + 1));
  if (!following || PREPS.has(following) || knownAdverb(resources, following)) return false;
  return DETERMINERS.has(following) || OBJECTS.has(following) || knownNoun(resources, following);
}

function bareVerbAfterNp(resources, tokens, words, slot) {
  const next = atSlot(tokens, words, slot + 1);
  if (!(DETERMINERS.has(next) || OBJECTS.has(next) || knownNoun(resources, next))) return false;
  const after = npEnd(resources, tokens, words, slot + 1);
  if (after < 0 || after >= words.length) return false;
  return looksLikeVerb(resources, tokens[words[after]].text);
}

function eventFrame(resources, tokens, words, slot) {
  const next = atSlot(tokens, words, slot + 1);
  if (!next || PREPS.has(next) || next === "to" || knownAdverb(resources, next)) return true;
  if (next.endsWith("ing") && looksLikeVerb(resources, next)) return true;
  let cursor = slot + 1;
  if (DETERMINERS.has(atSlot(tokens, words, cursor))) cursor++;
  while (cursor < words.length && (knownAdjective(resources, atSlot(tokens, words, cursor)) || knownAdverb(resources, atSlot(tokens, words, cursor)))) cursor++;
  const head = atSlot(tokens, words, cursor);
  if (!head) return true;
  return EVENT_NOUNS.has(head);
}

function verbFrame(resources, analysis, tokens, words, slot, prev) {
  const lemma = analysis.lemma;
  const inflected = analysis.features.past || analysis.features.participle || analysis.features.gerund || analysis.features.third;
  if (!inflected) {
    const clear = AUX.has(prev) || PRONOUNS.has(prev) || prev === "not" || prev === "n't" || prev === "never" || knownAdverb(resources, prev);
    const nounSubject = knownNoun(resources, prev) && !knownNoun(resources, atSlot(tokens, words, slot + 1));
    if (!clear && !nounSubject) return false;
  }
  const next = atSlot(tokens, words, slot + 1);
  if (PARTICLES.has(next)) return false;
  if (["remain", "stay"].includes(lemma) && next === "to") return false;
  if (["examine", "inspect"].includes(lemma) && ["whether", "how", "that"].includes(next)) return false;
  if (["suggest", "propose"].includes(lemma) && next === "to") return false;
  if (["try", "attempt"].includes(lemma) && next !== "to" && !(next.endsWith("ing") && looksLikeVerb(resources, next))) return false;
  if (lemma === "decline" && (!next || PREPS.has(next) || knownAdverb(resources, next)) && next !== "to") return false;
  if (lemma === "recall" && ["that", "the", "a"].includes(next)) {
    const end = npEnd(resources, tokens, words, slot + 1);
    if (["car", "cars", "vehicle", "vehicles", "product", "products", "drug", "drugs", "medicine", "medicines"].includes(atSlot(tokens, words, end - 1))) return false;
  }
  if (["help", "assist", "aid"].includes(lemma)) {
    if (next === "to") return false;
    if (next && !PREPS.has(next)) {
      const end = OBJECTS.has(next) || next === "it" ? slot + 2 : npEnd(resources, tokens, words, slot + 1);
      const following = atSlot(tokens, words, end);
      if (following && following !== "with" && following !== "in" && !coordinator(following)) return false;
    }
  }
  if (analysis.flag === "event") {
    if (!next) return analysis.features.participle && BE.has(prev);
    if (PREPS.has(next) || AUX.has(next) || next === "that") return false;
    return eventFrame(resources, tokens, words, slot);
  }

  if (['remember','recall'].includes(lemma) && next==='to') return false;
  if (['find','locate'].includes(lemma)) {
    const after=(next==='it' || OBJECTS.has(next)) ? slot+2 : npEnd(resources,tokens,words,slot+1);
    const complement=atSlot(tokens,words,after);
    if (knownAdjective(resources,complement) || AUX.has(complement) || looksLikeVerb(resources,complement)) return false;
  }
  if (secondNp(resources, tokens, words, slot)) return false;
  if ((lemma === "help" || lemma === "assist" || lemma === "aid") && bareVerbAfterNp(resources, tokens, words, slot)) return false;
  if ((lemma === "happen" || lemma === "occur") && next === "to") return false;
  if ((lemma === "remain" || lemma === "stay") && (DETERMINERS.has(next) || knownNoun(resources, next))) return false;
  if (["start", "begin", "commence", "end", "conclude"].includes(lemma)) return eventFrame(resources, tokens, words, slot);
  return true;
}

function timeContext(resources, tokens, words, slot) {
  for (let step = 1; step <= 4; step++) {
    const word = atSlot(tokens, words, slot + step);
    if (!word || DETERMINERS.has(word) || knownAdverb(resources, word) || knownAdjective(resources, word)) {
      if (TIME_NOUNS.has(word)) return true;
      continue;
    }
    return TIME_NOUNS.has(word);
  }
  for (let step = 1; step <= 4; step++) if (TIME_NOUNS.has(atSlot(tokens, words, slot - step))) return true;
  return false;
}


function contextAllows(resources, chosen, tokens, words, slot) {
  const prev = atSlot(tokens, words, slot-1), next = atSlot(tokens, words, slot+1);
  let head = "";
  for (let k=slot+1; k<words.length && k<=slot+5; k++) {
    if (words[k] !== words[k-1]+2 || !isSpace(tokens[words[k]-1])) break;
    const w=atSlot(tokens,words,k);
    if (k===slot+1 && chosen.pos==="verb" && DETERMINERS.has(w)) continue;
    if (knownAdjective(resources,w) || knownAdverb(resources,w)) continue;
    head=w; break;
  }
  if (chosen.flag.startsWith("head:") || chosen.flag.startsWith("object:")) {
    const allowed=chosen.flag.slice(chosen.flag.indexOf(":")+1).split("|");
    if (!head || !allowed.includes(head)) return false;
  }
  const lemma=chosen.lemma;
  if (chosen.pos==="adj") {
    if (DETERMINERS.has(next)) return false;
    if (lemma==="chief" && !knownNoun(resources,next)) return false;
    if (lemma==="cold" && ["a","the"].includes(prev) && !knownNoun(resources,next)) return false;
    if (lemma==="little" && ["","of","more","less"].includes(next)) return false;
  }
  if (chosen.pos==="noun") {
    if (["objective","individual"].includes(lemma) && knownNoun(resources,next)) return false;
    if (lemma==="doctor" && (next==="of" || head==="philosophy")) return false;
    if (lemma==="pupil") for(let k=Math.max(0,slot-3);k<Math.min(words.length,slot+4);k++) {
      if (["eye","eyes","dilated","dilation","iris","retina"].includes(atSlot(tokens,words,k))) return false;
    }
  }
  if (chosen.pos==="verb") {
    let cue=prev;
    for(let k=slot-2;k>=0 && k>=slot-5 && (knownAdverb(resources,cue) || ["not","never","n't"].includes(cue));k--) cue=atSlot(tokens,words,k);
    if (lemma==="show" && chosen.features.participle && BE.has(cue)) return false;
    if (["help","assist","aid"].includes(lemma) && next==="to") return false;
    if (["find","locate"].includes(lemma) && ["that","whether","why","how"].includes(next)) return false;
    if (["decline","refuse"].includes(lemma) && !head && next!=="to") return false;
    if (["eat","consume"].includes(lemma) && !["food","meal","meals","breakfast","lunch","dinner","cake","sandwich","bread","pizza","apple","apples","rice","snack","snacks","fish","beef","fruit","vegetables","soup"].includes(head)) return false;
    if (lemma==="recall" && ["product","products","vehicles","drug","drugs"].includes(head)) return false;
  }
  return true;
}

function withPossessive(word, possessive) {
  if (!possessive || !word) return word;
  return word.endsWith("s") ? `${word}'` : `${word}'s`;
}

function freezeQuotes(tokens) {
  const stack = [];
  for (const token of tokens) {
    if (QUOTES.has(token.text)) {
      if (stack.length && stack.at(-1) === token.text) stack.pop();
      else if (!["\u201d", "\u2019"].includes(token.text)) stack.push(({ "\u201c": "\u201d", "\u2018": "\u2019" })[token.text] || token.text);
      token.frozen = true;
    } else if (stack.length) token.frozen = true;
  }
}

function freezePhrases(resources, tokens, variation = false) {
  const index = variation ? resources.fixedPhraseIndex : resources.phraseIndex;
  const words = wordPositions(tokens);
  const used = new Array(words.length).fill(false);
  for (let slot = 0; slot < words.length; slot++) {
    if (used[slot]) continue;
    for (const phrase of index.get(atSlot(tokens, words, slot)) || []) {
      if (slot + phrase.length > words.length) continue;
      if (!phrase.every((part, index) => atSlot(tokens, words, slot + index) === part)) continue;
      const first = words[slot];
      const last = words[slot + phrase.length - 1];
      let tight = true;
      for (let i = first; i <= last; i++) {
        if (!tokens[i].word && !isSpace(tokens[i])) tight = false;
      }
      if (!tight) continue;
      for (let k = 0; k < phrase.length; k++) {
        used[slot + k] = true;
        tokens[words[slot + k]].frozen = true;
      }
      break;
    }
  }
}

function freezeNames(resources, tokens) {
  let words = 0;
  let capitals = 0;
  for (const token of tokens) {
    if (!token.word) continue;
    words++;
    if (capitalized(token.text)) capitals++;
  }
  const heading = words >= 2 && capitals === words;
  let first = true;
  for (const token of tokens) {
    if (!token.word) continue;
    const sentenceStart = first;
    first = false;
    if (token.frozen) continue;
    const low = lower(token.text);
    if (heading || (capitalized(token.text) && ["joy", "king", "swift", "hope", "bill", "will", "may", "rose", "grace", "faith", "summer", "chase", "grant"].includes(low))) { token.frozen = true; continue; }
    let letters = 0;
    let digit = false;
    let high = false;
    for (const ch of token.text) {
      const code = ch.charCodeAt(0);
      if (isLetter(ch)) letters++;
      else if (code >= 48 && code <= 57) digit = true;
      else if (code >= 128) high = true;
    }
    if (high || digit) {
      token.frozen = true;
      continue;
    }
    if (letters === 1 && low !== "a" && low !== "i") {
      token.frozen = true;
      continue;
    }
    if (allCaps(token.text) && letters >= 2) {
      token.frozen = true;
      continue;
    }
    if (!heading && !sentenceStart && capitalized(token.text) && !allCaps(token.text)) token.frozen = true;
  }
}

function substitute(resources, tokens, options, ordinal) {
  const changes = [];
  if (!options.synonyms) return { tokens, changes, next: ordinal + BigInt(wordPositions(tokens).length) };
  const context = tokens.map((token) => ({ ...token }));
  const words = wordPositions(tokens);
  for (let slot = 0; slot < words.length; slot++) {
    const token = tokens[words[slot]];
    if (token.frozen) continue;
    const prev = atSlot(context, words, slot - 1);
    const next = atSlot(context, words, slot + 1);
    let cue = prev;
    for (let k = slot - 2; k >= 0 && k >= slot - 5 && (knownAdverb(resources, cue) || cue === "not" || cue === "never"); k--) cue = atSlot(context, words, k);
    const analyses = analyze(resources, token.text, PART_CUE.has(cue));
    const hasNoun = analyses.some((item) => item.pos === "noun");
    const hasVerb = analyses.some((item) => item.pos === "verb");
    if (hasNoun && hasVerb && OBJECTS.has(prev)) continue;
    if (hasNoun && analyses.length === 1 && analyses[0].lemma === "person" && analyses[0].features.plural &&
      ["a", "an", "this", "one", "each", "every"].includes(prev)) continue;
    let best = null;
    let bestScore = 0;
    let tied = false;
    const kept = [];
    for (const analysis of analyses) {
      if (!intensityAllows(options.intensity, analysis.pos, analysis.flag) || !hardKeep(analysis, prev)) continue;
      const score = scoreAnalysis(resources, analysis, prev, next);
      if (!best || score > bestScore) {
        best = analysis;
        bestScore = score;
        tied = false;
        kept.length = 0;
        kept.push(analysis);
      } else if (score === bestScore) {
        tied = true;
        kept.push(analysis);
      }
    }
    if (!best || tied) continue;
    const chosen = { ...kept[0], features: { ...kept[0].features } };
    if (chosen.pos === "noun" && chosen.lemma === "aircraft") {
      const plurals = new Set("many several multiple these those two three four five six seven eight nine ten both all numerous".split(" "));
      const singulars = new Set("a an one this that each every".split(" "));
      let numberCue = prev;
      for (let k = slot-2; k >= 0 && k >= slot-5 && !plurals.has(numberCue) &&
        (knownAdjective(resources, numberCue) || knownAdverb(resources, numberCue)); k--) numberCue = atSlot(context, words, k);
      const digits = /^[0-9]+$/.test(numberCue), singularNumber = digits && numberCue.replace(/^0+/, "") === "1";
      const plural = plurals.has(numberCue) || (digits && !singularNumber) || ["are", "were", "have"].includes(next);
      const singular = singulars.has(numberCue) || singularNumber || ["is", "was", "has"].includes(next);
      if (plural === singular) continue;
      chosen.features.plural = plural;
    }
    if (chosen.pos === "noun" && ["question", "answer", "picture", "film", "shop", "store", "ship", "cause", "lie", "part", "tool", "border"].includes(chosen.lemma)) {
      // Commands such as "Answer the question" and "Lie to ..." have no noun cue.
      const nounCue = DETERMINERS.has(prev) || PREPS.has(prev) || knownAdjective(resources, prev) ||
        prev.endsWith("'s") || prev.endsWith("s'") || (next !== "to" && looksLikeVerb(resources, next));
      if (!nounCue) continue;
    }
    if (chosen.pos === "adj" && DETERMINERS.has(prev) && (!next || PREPS.has(next) || looksLikeVerb(resources, next))) continue;
    if (chosen.pos === "adj" && chosen.lemma === "little" &&
      (["money", "cash", "time", "water", "food", "milk", "evidence", "information", "patience", "help", "assistance", "attention", "hope"].includes(next) || knownAdjective(resources, next) || knownAdverb(resources, next))) continue;
    if (chosen.flag === "disagreement" && chosen.lemma !== "quarrel" && !["heated", "bitter", "verbal", "petty", "protracted"].includes(prev)) continue;
    if (chosen.pos === "adj" && chosen.lemma === "significant") continue;
    if (!contextAllows(resources, chosen, context, words, slot)) continue;
    if (chosen.lemma === "however" && tokens[words[slot] + 1]?.text !== ",") continue;
    if (chosen.pos === "adv" && ["nearly", "almost"].includes(chosen.lemma) && ["no", "not", "never"].includes(next)) continue;
    if (chosen.flag === "quant") {
      if (next === "of" || next === "more" || ["how", "too", "so", "as", "this", "that", "very"].includes(prev)) continue;
    }
    if (chosen.flag === "time" && !timeContext(resources, context, words, slot)) continue;
    if (chosen.flag === "mass" && chosen.features.plural) continue;
    if (chosen.pos === "verb" && !verbFrame(resources, chosen, context, words, slot, prev)) continue;
    if (chosen.pos === "adj" && !chosen.features.comparative && !chosen.features.superlative && !AUX.has(prev) &&
      ["fast", "quick", "rapid", "swift", "slow", "unhurried"].includes(chosen.lemma) &&
      looksLikeVerb(resources, prev) && (!next || coordinator(next) || PREPS.has(next))) continue;
    const row = findRow(resources, chosen.lemma, chosen.pos);
    if (!row) continue;
    const usable = [];
    for (const synonym of row.synonyms) {
      if (chosen.pos === "adj" && synonym === "significant") continue;
      if (chosen.pos === "adj" && ["afraid", "aware", "unwell"].includes(synonym) &&
        !BE.has(cue) && !["seem", "seems", "seemed", "feel", "feels", "felt", "remain", "remained", "stay", "stayed"].includes(cue)) continue;

      if (chosen.pos==='adj' && next==='to' && ['likely','unlikely','probable','improbable','eager','enthusiastic'].includes(chosen.lemma)) continue;
      if (chosen.pos==='adj' && (DETERMINERS.has(prev) || knownNoun(resources,next)) && ['afraid','aware','unwell'].includes(synonym)) continue;
      if (chosen.pos === "adj" && next === "to" && ["happy", "glad", "pleased", "joyful", "cheerful"].includes(chosen.lemma) && !["happy", "glad", "pleased"].includes(synonym)) continue;
      if (chosen.pos==='adj' && next==='to' && ['likely','unlikely','probable','improbable','eager','enthusiastic'].includes(chosen.lemma)) continue;
      if (chosen.pos==='adj' && (DETERMINERS.has(prev) || knownNoun(resources,next)) && ['afraid','aware','unwell'].includes(synonym)) continue;
      if (chosen.pos === "adj" && next === "to" && ["happy", "glad", "pleased", "joyful", "cheerful"].includes(chosen.lemma) && !["happy", "glad", "pleased"].includes(synonym)) continue;
      const inflected = inflect(synonym, chosen.pos, chosen.features);
      if (inflected) usable.push(inflected);
    }
    if (usable.length === 0) continue;
    const wordOrdinal = ordinal + BigInt(slot);
    const mixed = mix64((BigInt(options.seed) ^ (((wordOrdinal + 1n) * 0xD1B54A32D192ED03n) & MASK) ^ fnv1a(chosen.lemma)) & MASK);
    if (options.style === "close" && mix64(mixed ^ 0xA0761D6478BD642Fn) % 100n >= 50n) continue;
    const picked = usable[Number(mixed % BigInt(usable.length))];
    const surface = applyCaps(withPossessive(picked, chosen.features.possessive), token.text);
    if (lower(surface) === lower(token.text)) continue;
    changes.push({ kind: "synonym", before: token.text, after: surface, detail: { noun: "noun", verb: "verb", adj: "adjective", adv: "adverb" }[chosen.pos] });
    token.text = surface;
    token.replaced = true;
  }
  return { tokens, changes, next: ordinal + BigInt(words.length) };
}

function fixArticles(tokens, changes) {
  const words = wordPositions(tokens);
  for (let slot = 0; slot < words.length; slot++) {
    const article = tokens[words[slot]];
    const low = lower(article.text);
    if (article.frozen || (low !== "a" && low !== "an")) continue;
    if (slot + 1 >= words.length) continue;
    const next = tokens[words[slot + 1]];
    if (words[slot + 1] !== words[slot] + 2 || !isSpace(tokens[words[slot] + 1])) continue;
    if (!next.replaced && !article.replaced) continue;
    const want = needsAn(next.text) ? "an" : "a";
    if (low === want) continue;
    const updated = applyCaps(want, article.text);
    changes.push({ kind: "article", before: article.text, after: updated, detail: "article" });
    article.text = updated;
    article.replaced = true;
  }
}

function freezeTerms(tokens, terms) {
  const text = lower(concat(tokens));
  const wordChar = (ch) => !!ch && (/[A-Za-z0-9_'\-]/.test(ch) || ch.charCodeAt(0) >= 128);
  let matched = false;
  for (const raw of terms) {
    const term = lower(raw).replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, "");
    if (!term) continue;
    for (let pos = text.indexOf(term); pos >= 0; pos = text.indexOf(term, pos + term.length)) {
      const end = pos + term.length;
      if (wordChar(text[pos - 1]) || wordChar(text[end])) continue;
      matched = true;
      let offset = 0;
      for (const token of tokens) {
        if (offset < end && offset + token.text.length > pos) token.frozen = true;
        offset += token.text.length;
      }
    }
  }
  return matched;
}

export function rewrite(input, options = {}, resources) {
  if (typeof input !== "string") throw new TypeError("Input must be text.");
  if (!resources?.rows || !resources?.byLemma) throw new TypeError("Load the word lists before rewriting.");
  const rawSeed = options.seed ?? 1;
  if (!["string", "number", "bigint"].includes(typeof rawSeed) || String(rawSeed).length > 20 || (typeof rawSeed === "number" && !Number.isSafeInteger(rawSeed)) || !/^[0-9]+$/.test(String(rawSeed)) || BigInt(rawSeed) > MASK) throw new RangeError("Seed must be an unsigned 64-bit integer (pass large values as text).");
  if (options.intensity !== undefined && !Number.isInteger(options.intensity)) throw new RangeError("Intensity must be an integer.");
  if (options.protectedTerms !== undefined && (!Array.isArray(options.protectedTerms) || options.protectedTerms.some((term) => typeof term !== "string"))) throw new TypeError("Protected terms must be a list of strings.");
  if (options.style !== undefined && !["balanced", "close", "recast"].includes(options.style)) throw new RangeError("Style must be balanced, close, or recast.");
  const settings = {
    style: options.style ?? "balanced",
    seed: options.seed ?? 1,
    intensity: Math.min(2, Math.max(0, options.intensity ?? 1)),
    synonyms: options.synonyms !== false,
    arrange: options.arrange !== false,
    protectQuotes: options.protectQuotes !== false,
  };
  const text = input.replace(/\r\n?/g, "\n");
  const result = { text: "", changes: [], parts: [] };
  let ordinal = 0n;
  for (const piece of splitPieces(text)) {
    if (!piece.sentence) {
      result.text += piece.text;
      if (piece.text) result.parts.push({ text: piece.text, changed: false });
      continue;
    }
    let tokens = piece.tokens.map((token) => ({ ...token }));
    if (settings.protectQuotes) freezeQuotes(tokens);
    freezePhrases(resources, tokens, settings.style === "recast" && settings.synonyms && settings.intensity > 0);
    freezeNames(resources, tokens);
    const locked = freezeTerms(tokens, options.protectedTerms || []);
    let academicMoved = false;
    if (!locked) {
      const moved = academicArrangement(resources, tokens, settings);
      if (moved) { tokens = moved.tokens; result.changes.push(moved.change); academicMoved = true; }
      academicPhrases(resources, tokens, settings, result.changes);
      for (const change of rephrase(resources, tokens, settings, ordinal)) result.changes.push(change);
      varyPhrases(resources, tokens, settings, result.changes);
    }
    if (settings.style === "recast") freezePhrases(resources, tokens);
    const arranged = arrange(resources, tokens, settings.arrange && !locked && !academicMoved && settings.style !== "close", settings.style === "recast", settings.seed);
    if (arranged) {
      tokens = arranged.tokens;
      result.changes.push(arranged.change);
    }
    const substituted = substitute(resources, tokens, settings, ordinal);
    ordinal = substituted.next;
    fixArticles(substituted.tokens, substituted.changes);
    for (const change of substituted.changes) result.changes.push(change);
    for (const token of substituted.tokens) {
      result.parts.push({ text: token.text, changed: token.replaced });
    }
    result.text += concat(substituted.tokens);
  }
  return result;
}


function varyPhrases(resources, tokens, options, changes) {
  if (!options.synonyms || options.style !== "recast" || options.intensity < 1) return;
  if (tokens.some((t) => ["not", "never", "no"].includes(lower(t.text)) || lower(t.text).includes("n't"))) return;
  for (let start = 0; start < tokens.length; start++) {
    if (!tokens[start].word || tokens[start].frozen) continue;
    let replaced = false;
    for (const rule of resources.phraseRules || []) {
      if (rule.mode === "purpose" && tokens.some((t) => ["put","set","get","got","keep","kept","bring","brought","arrange","arranged"].includes(lower(t.text)))) continue;
      for (let form = 0; form < rule.forms.length; form++) {
        if (rule.mode === "purpose" && form !== 0) continue;
        let match = "", end = start;
        for (; end < tokens.length; end++) {
          const token = tokens[end];
          if (token.frozen || (!token.word && /[^ \t]/.test(token.text))) break;
          if (token.word) match += (match ? " " : "") + lower(token.text);
          if (match === rule.forms[form] || match.length > rule.forms[form].length) break;
        }
        if (end === tokens.length || match !== rule.forms[form] || tokens[end].frozen || !tokens[end].word) continue;
        if (rule.mode === "front" && (start !== 0 || tokens[end+1]?.text !== ",")) continue;
        if (rule.mode !== "front" && (!tokens[end+2]?.word || tokens[end+2].frozen)) continue;
        const alternatives = rule.forms.filter((word) => word !== rule.forms[form]);
        if (!alternatives.length) continue;
        const replacement = applyCaps(alternatives[Number(BigInt(options.seed) % BigInt(alternatives.length))], tokens[start].text);
        const before = concat(tokens.slice(start, end+1));
        changes.push({ kind: "phrase", before, after: replacement, detail: `Equivalent ${rule.mode} phrase` });
        tokens.splice(start, end-start+1, { text: replacement, word: false, frozen: true, replaced: true });
        replaced = true;
        break;
      }
      if (replaced) break;
    }
  }
}
function fingerprint(text) {
  const result = new Set();
  let previous = "";
  for (const word of lower(text).split(/[ \t\r\n]+/).filter(Boolean)) {
    result.add("w:" + word);
    if (previous) result.add("b:" + previous + "\0" + word);
    previous = word;
  }
  return result;
}
function wordingDistance(a, b) {
  let intersection = 0;
  for (const key of a) if (b.has(key)) intersection++;
  const total = a.size + b.size - intersection;
  return total ? Math.floor(1000 * (total-intersection) / total) : 0;
}
// A bounded diversity search, not a semantic-quality scoring model.
export function rewriteVariants(input, options = {}, resources, count = 3) {
  if (!Number.isInteger(count) || count < 1 || count > 3) throw new RangeError("Variant count must be 1, 2, or 3.");
  if (count === 1 || (options.synonyms === false && options.arrange === false) || input === "") {
    const style = count === 1 ? (options.style ?? "balanced") : "balanced";
    const result = rewrite(input, { ...options, style }, resources);
    return { requested: count, attempts: 1, variants: [{ seed: String(BigInt(options.seed ?? 1)), style, result }] };
  }
  // Validate before any BigInt conversion and normalize using the public single-pass API.
  const original = rewrite(input, { ...options, synonyms: false, arrange: false }, resources).text;
  const batch = { variants: [], requested: count, attempts: 0 };
  const profileBudget = original.split(/[ \t\r\n]+/).filter(Boolean).length > 2000 ? 1 : 4;
  const originalFingerprint = fingerprint(original);
  const selected = [];
  const generate = (style, offset) => {
    const seed = String((BigInt(options.seed ?? 1) + BigInt(offset)) & MASK);
    batch.attempts++;
    return { seed, style, result: rewrite(input, { ...options, seed, style }, resources) };
  };
  const unique = (v) => v.result.text !== original && !batch.variants.some((old) => old.result.text === v.result.text);
  const add = (v) => { selected.push(fingerprint(v.result.text)); batch.variants.push(v); };
  const first = generate(count === 1 ? (options.style ?? "balanced") : "balanced", 0);
  if (count === 1) { add(first); return batch; }
  if (unique(first)) add(first);
  for (let profile = 1; profile <= 2 && batch.variants.length < count; profile++) {
    let best = null, bestDistance = -1;
    for (let attempt = 0; attempt < profileBudget; attempt++) {
      const candidate = generate(profile === 1 ? "close" : "recast", profile + attempt * 3);
      if (!unique(candidate)) continue;
      const fp = fingerprint(candidate.result.text);
      let score = wordingDistance(fp, originalFingerprint);
      for (const other of selected) score = Math.min(score, wordingDistance(fp, other));
      if (score > bestDistance) { bestDistance = score; best = candidate; }
    }
    if (best) add(best);
  }
  for (const offset of [3, 6, 9]) {
    if (batch.variants.length >= count) break;
    const candidate = generate("balanced", offset);
    if (unique(candidate)) add(candidate);
  }
  if (!batch.variants.length) add(first);
  return batch;
}

const PHRASE_SCOPE = new Set("not never no only just almost nearly hardly scarcely barely very too rather quite more most less least enough if whether that who which whose why how by".split(" "));
const PHRASE_VERBS = new Set("works worked reads studies studied exercises exercised visits visited meets writes travels travelled traveled spoke speaks smiled smiles walked walks".split(" "));
function phraseFits(resources, tokens, begin, end, tailOnly) {
  const front = begin === 0 && tokens[end]?.text === ",";
  const tail = tokens.slice(end).every((t) => t.text === "." || /^[ \t]*$/.test(t.text));
  if ((!front && !tail) || (tailOnly && !tail)) return false;
  if (tailOnly && begin >= 2 && DETERMINERS.has(lower(tokens[begin-2].text))) return false;
  let predicate = false, lexical = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (i >= begin && i < end) continue;
    const token = tokens[i], w = lower(token.text);
    if (w.includes("\n") || PHRASE_SCOPE.has(w) || w.includes("n't") || subordinatorWord(w) || coordinator(w)) return false;
    if (!token.word) {
      if (w === "." || (front && i === end) || /^[ \t]*$/.test(w)) continue;
      return false;
    }
    if (token.frozen) continue;
    if (AUX.has(w)) { predicate = true; continue; }
    const prev = i >= 2 ? lower(tokens[i-2].text) : "";
    if (!DETERMINERS.has(prev) && (looksLikeVerb(resources, w) || PHRASE_VERBS.has(w))) { predicate = true; lexical++; }
  }
  return predicate && lexical <= 1;
}
function rephrase(resources, tokens, options, ordinal) {
  const changes = [];
  if (!options.synonyms || options.style === "close") return changes;
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].word || tokens[i].frozen) continue;
    for (const rule of resources.rephrases || []) {
      if (options.intensity < rule.minimumIntensity) continue;
      const size = rule.source.length * 2 - 1;
      if (i + size > tokens.length) continue;
      let match = true;
      for (let k = 0; k < size; k++) {
        const token = tokens[i+k];
        if (token.frozen || (k % 2 ? token.text !== " " : !token.word || lower(token.text) !== rule.source[k/2])) { match = false; break; }
      }
      if (!match || !phraseFits(resources, tokens, i, i+size, rule.tailOnly)) continue;
      const before = concat(tokens.slice(i, i+size));
      const after = applyCaps(rule.target, tokens[i].text), replacement = [];
      for (const word of after.split(" ")) {
        if (replacement.length) replacement.push({ text: " ", word: false, frozen: true, replaced: false });
        replacement.push({ text: word, word: true, frozen: true, replaced: true });
      }
      changes.push({ kind: "phrase", before, after, detail: "Matched adjunct phrase" });
      tokens.splice(i, size, ...replacement); i += replacement.length-1; break;
    }
  }
  return changes;
}

function tryNounSubjectAdverb(resources, tokens, words, seed) {
  const verbs = new Set("examine inspect purchase buy select choose construct build repair mend finish complete".split(" "));
  if (words.length < 4) return null;
  const punct = punctIndex(tokens), limit = punct < 0 ? tokens.length : punct;
  let predicates = 0;
  for (const i of words) {
    if (AUX.has(lower(tokens[i].text))) return null;
    if (looksLikeVerb(resources, tokens[i].text)) predicates++;
  }
  if (predicates !== 1 || words.some((i) => coordinator(lower(tokens[i].text)))) return null;
  for (let slot = 1; slot + 2 < words.length; slot++) {
    const at = words[slot], verbAt = words[slot+1];
    if (!manner(resources, tokens[at]) || verbAt !== at+2 || tokens[at+1].text !== " ") continue;
    if (!analyze(resources, tokens[verbAt].text, false).some((a) => a.pos === "verb" && verbs.has(a.lemma))) continue;
    let simple = true;
    for (let k = 0; k < words.length; k++) {
      if (k === slot || k === slot+1) continue;
      const w = lower(tokens[words[k]].text);
      if (PREPS.has(w) || subordinatorWord(w) || knownAdverb(resources, w) ||
        (w.endsWith("ing") && !findRow(resources, w, "noun"))) simple = false;
    }
    if (!simple) continue;
    const body = sliceTokens(tokens, 0, at);
    appendSlice(body, sliceTokens(tokens, verbAt, limit));
    const adverb = { ...tokens[at] };
    let rebuilt;
    if (BigInt(seed) % 2n === 0n) {
      decapFirst(resources, body); adverb.text = applyCaps(lower(adverb.text), "A");
      rebuilt = [adverb, { text: ",", word: false, frozen: false, replaced: false }];
      appendSlice(rebuilt, body);
    } else { rebuilt = body; appendSlice(rebuilt, [adverb]); }
    if (punct >= 0) rebuilt.push({ ...tokens[punct] });
    return finish(rebuilt, concat(tokens), "Moved a pre-verbal manner adverb");
  }
  return null;
}

// Guarded academic phrases and syntax. Keep the four transforms aligned with
// src/academic.cpp; these are local templates, not a general semantic parser.
function academicSpace(t) { return !t.word && t.text.length > 0 && !/[^ \t]/.test(t.text); }
function academicWord(t, i) { return i >= 0 && i < t.length && t[i].word ? lower(t[i].text) : ""; }
function academicSlice(t, a, b) {
  while (a < b && academicSpace(t[a])) a++;
  while (b > a && academicSpace(t[b-1])) b--;
  return t.slice(a, b).map(t => ({ ...t }));
}
function academicLiteral(text) {
  const out = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (out.length) out.push({ text: " ", word: false, frozen: false, replaced: false });
    out.push({ text: word, word: true, frozen: true, replaced: true });
  }
  return out;
}
function academicAppend(out, tail) {
  if (!tail.length) return;
  if (out.length) out.push({ text: " ", word: false, frozen: false, replaced: false });
  for (const token of tail) out.push({ ...token });
}
function academicCap(t) { if (t.length && t[0].text.length) t[0].text = upperChar(t[0].text[0])+t[0].text.slice(1); }
function academicDecap(t, knownCommon = false) {
  if (!t.length || !t[0].text.length) return;
  const w = lower(t[0].text);
  if (w === "i" || allCaps(t[0].text)) return;
  if (knownCommon || DETERMINERS.has(w) || ["recent","published","experimental","mechanistic","comparative","current","further","additional"].includes(w))
    t[0].text = lowerChar(t[0].text[0])+t[0].text.slice(1);
}
function academicUnsafe(t) {
  return t.some(token => {
    const w = lower(token.text);
    return ["not","never","no","neither","nor","only","just","hardly","scarcely","barely"].includes(w) || w.includes("n't") || w.includes("\n") ||
      (!token.word && token.frozen && !token.replaced) || ['"',"'","?","!","\u2018","\u2019","\u201c","\u201d"].includes(w);
  });
}
function academicGuard(resources, r, t, begin, end) {
  const prev = begin >= 2 && academicSpace(t[begin-1]) ? academicWord(t, begin-2) : "";
  const next = end+1 < t.length && academicSpace(t[end]) ? academicWord(t, end+1) : "";
  if (r.mode === "local") return true;
  if (r.mode === "review") return ["review","study","analysis","report","paper","investigation","survey","evaluation","assessment"].includes(prev) && !!next;
  if (r.mode === "pending") return !!prev && !AUX.has(prev) && !PRONOUNS.has(prev) && !PREPS.has(prev) && !DETERMINERS.has(prev) &&
    ["established","determined","resolved","verified","confirmed","evaluated","assessed","identified","clarified","explained","demonstrated","shown","seen","known","done","understood","measured","quantified","characterised","characterized","validated","defined","tested"].includes(next);
  if (r.mode === "dependent") return !!prev && !AUX.has(prev) && !PREPS.has(prev) && !DETERMINERS.has(prev) && !!next;
  if (r.mode === "verbal") {
    if (r.source[1] === "control" && !["transfer","test","testing","measurement","evaluation","assessment","experiment","experiments","protocol","protocols","analysis","reaction","reactions","procedure","procedures","method","methods","synthesis","process","processes","operation"].includes(prev)) return false;
    return !!prev && !DETERMINERS.has(prev) && (!["of","for"].includes(r.source.at(-1)) || !!next);
  }
  if (r.mode === "support") {
    if (!next || PREPS.has(next) || AUX.has(next)) return false;
    for (let k = begin, n = 0; k >= 2 && n < 5; k -= 2, n++) {
      if (!academicSpace(t[k-1])) return false;
      const w = academicWord(t, k-2);
      if (["studies","results","findings","evidence","data","analyses","analysis","research","review","study","experiments","simulations"].includes(w)) return true;
      if (!AUX.has(w) && !knownAdverb(resources, w)) break;
    }
    return false;
  }
  if (r.mode === "benchmark") {
    if (!["research","chemistry","study","studies","results","evidence","analysis","analyses","comparison","comparisons","work","experiment","experiments","simulation","simulations"].includes(prev) || !["a","the"].includes(next)) return false;
    for (let k = end+1, n = 0; k < t.length && n < 6; k += 2, n++) {
      const w = academicWord(t, k);
      if (w === "benchmark") {
        const after = k+1 < t.length && academicSpace(t[k+1]) ? academicWord(t,k+2) : "";
        return !after || PREPS.has(after) || AUX.has(after) || coordinator(after);
      }
      if (!w || PREPS.has(w) || AUX.has(w) || k+1 >= t.length || !academicSpace(t[k+1])) break;
    }
    return false;
  }
  if (r.mode === "nominal") return !next || PREPS.has(next) || AUX.has(next) || coordinator(next) || ["that","which"].includes(next) || looksLikeVerb(resources, next);
  if (r.mode === "route") {
    if (!["offers","offer","provides","provide"].includes(prev)) return false;
    for (let k = end+1, n = 0; k < t.length && n < 8; k += 2, n++) {
      const w = academicWord(t, k);
      if (["structure","structures","compound","compounds","molecule","molecules","product","products","material","materials"].includes(w)) return true;
      if (!w || (w.endsWith("ing") && !w.includes("-")) || PREPS.has(w) || AUX.has(w) || k+1 >= t.length || !academicSpace(t[k+1])) break;
    }
  }
  return false;
}
function academicPhrases(resources, tokens, options, changes) {
  if (!options.synonyms || options.style === "close" || options.intensity < 1 || academicUnsafe(tokens)) return;
  const output = [];
  for (let i = 0; i < tokens.length;) {
    let replaced = false;
    if (tokens[i].word && !tokens[i].frozen) {
      for (const r of resources.academicIndex?.get(lower(tokens[i].text)) || []) {
        const length = r.source.length*2-1;
        if (options.intensity < r.minimumIntensity || length > tokens.length-i) continue;
        let matches = true;
        for (let k=0;k<length;k++) {
          const t=tokens[i+k];
          if (t.frozen || (k%2 ? t.text!==" " : !t.word || lower(t.text)!==r.source[k/2])) { matches=false;break; }
        }
        if (!matches || !academicGuard(resources,r,tokens,i,i+length)) continue;
        const before=concat(academicSlice(tokens,i,i+length)),targets=r.forms.slice(1);
        const pick=Number(((BigInt(options.seed)+BigInt(i)) & MASK) % BigInt(targets.length));
        const after=applyCaps(targets[pick],tokens[i].text);
        changes.push({kind:"phrase",before,after,detail:`Guarded academic ${r.mode} phrase`});
        for (const t of academicLiteral(after)) output.push(t);
        i+=length;replaced=true;break;
      }
    }
    if (!replaced) output.push(tokens[i++]);
  }
  tokens.length=0;for (const t of output) tokens.push(t);
}
function academicHas(t, a, b, words) { return t.slice(a,b).some(t => t.word && words.includes(lower(t.text))); }
function academicPredicate(resources, t, a, b) {
  return t.slice(a,b).some(t => t.word && (looksLikeVerb(resources, t.text) || ["requires","require","depends","depend","exists","exist","works","contains","contain","increases","increase","decreases","decrease","occurs","occur"].includes(lower(t.text))));
}
function academicDone(tokens, before, detail) { return finish(tokens, concat(before), detail); }
function academicArrangement(resources, tokens, options) {
  if (!options.arrange || options.style !== "recast" || options.intensity < 1 || tokens.length < 7 || academicUnsafe(tokens)) return null;
  if (tokens[tokens.length-1].text !== ".") return null;
  const end = tokens.length-1;
  let thats=0,whiles=0,linksCount=0;
  for (const t of tokens) {
    const w=lower(t.text);thats+=Number(w==="that");whiles+=Number(w==="while");
    linksCount+=Number(["therefore","consequently","however","nevertheless","nonetheless"].includes(w));
  }
  if (thats>1 || whiles>1 || linksCount>1) return null;
  if (tokens.slice(0,end).some(t => !t.word && t.text !== " " && t.text !== ",")) return null;
  if (academicHas(tokens,0,end,["if","unless","whether","because","although","though","when","where","who","which","whose","but"])) return null;
  const punctuation = text => ({ text, word: false, frozen: false, replaced: false });
  const sources = ["full-text comparison","the comparison","this comparison","the analysis","this analysis","the results","these results","the findings","these findings","the evidence","this evidence","the data","these data","experimental results","experimental evidence","the simulations","this review"];
  const reporting = { shows:"shown", show:"shown", demonstrates:"demonstrated", demonstrate:"demonstrated", indicates:"indicated", indicate:"indicated", suggests:"suggested", suggest:"suggested" };
  for (let i = 2; i+4 < end && i <= 12; i++) {
    const key = academicWord(tokens,i), part = Object.hasOwn(reporting,key) ? reporting[key] : null;
    if (!part || academicWord(tokens,i+2) !== "that" || tokens[i-1].text !== " " || tokens[i+1].text !== " " || tokens[i+3].text !== " ") continue;
    const source = academicSlice(tokens,0,i);
    if (!sources.includes(lower(concat(source))) || academicHas(tokens,i+4,end,["that","while"]) || !academicPredicate(resources,tokens,i+4,end)) continue;
    const body = academicSlice(tokens,i+4,end); academicCap(body); academicDecap(source,true);
    body.push(punctuation(",")); academicAppend(body,academicLiteral(`as ${part} by`)); academicAppend(body,source); body.push({ ...tokens[end] });
    return academicDone(body,tokens,"Moved evidence attribution after its complete claim");
  }
  const participles = ["illustrating","highlighting","demonstrating","showing","retaining","preserving","maintaining","avoiding","reducing","increasing","broadening","expanding"];
  const matrix = ["broaden","broadens","expand","expands","extend","extends","improve","improves","provide","provides","offer","offers"];
  for (let i = 4; i+4 < end; i++) {
    if (academicWord(tokens,i) !== "while" || !participles.includes(academicWord(tokens,i+2)) || academicHas(tokens,0,end,["that"])) continue;
    let verbs = 0, simple = true;
    for (let k=0;k<i;k++) { if (matrix.includes(academicWord(tokens,k))) verbs++; if (tokens[k].text === "," || AUX.has(academicWord(tokens,k))) simple=false; }
    if (!simple || verbs !== 1 || academicHas(tokens,i+2,end,["while"])) continue;
    const intro=academicSlice(tokens,i,end), body=academicSlice(tokens,0,i); academicCap(intro); academicDecap(body);
    intro.push(punctuation(",")); academicAppend(intro,body); intro.push({ ...tokens[end] });
    return academicDone(intro,tokens,"Fronted a same-subject while-participle adjunct");
  }
  for (let i=4;i+2<end;i++) {
    const w=academicWord(tokens,i), prev=academicWord(tokens,i-2);
    if (!["therefore","consequently","however","nevertheless","nonetheless"].includes(w) || !["is","are","was","were"].includes(prev) || academicHas(tokens,0,end,["that","while"])) continue;
    if (tokens.slice(0,i).some(t=>t.text===",")) continue;
    const body=academicSlice(tokens,0,i); academicAppend(body,academicSlice(tokens,i+1,end)); academicDecap(body);
    const out=academicLiteral(w); academicCap(out); out.push(punctuation(",")); academicAppend(out,body); out.push({ ...tokens[end] });
    return academicDone(out,tokens,"Fronted a discourse connective without changing the proposition");
  }
  const heads=["assessment","approach","framework","procedure","strategy","plan","protocol","method","workflow","system","model","design","scheme"];
  if (["a","an"].includes(academicWord(tokens,0))) {
    for (let i=4;i+6<end && i<=12;i++) {
      if (academicWord(tokens,i)!=="is" || !heads.includes(academicWord(tokens,i-2)) || !["proposed","suggested","recommended"].includes(academicWord(tokens,i+2)) ||
          academicWord(tokens,i+4)!=="that" || !["combines","integrates","includes","uses","incorporates","addresses"].includes(academicWord(tokens,i+6)) || academicHas(tokens,i+6,end,["that","while"])) continue;
      if (tokens.slice(0,i).some(t=>t.text===",")) continue;
      const out=academicSlice(tokens,0,i); academicAppend(out,academicSlice(tokens,i+4,end));
      const proposal=academicSlice(tokens,i,i+3); for (const t of proposal) if (t.word) t.frozen=true;
      academicAppend(out,proposal); out.push({ ...tokens[end] });
      return academicDone(out,tokens,"Placed a proposed method's relative clause beside its noun");
    }
  }
  return null;
}
