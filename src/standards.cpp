// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// An authoring aid: never a full conformance or semantic-equivalence certificate.
#include "internal.hpp"
#include <algorithm>
#include <array>
#include <set>
#include <sstream>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>

namespace synomizer {
namespace {
using Tokens = std::vector<Token>;
bool space(const Token& t) { return !t.word && !t.text.empty() && t.text.find_first_not_of(" \t\r\n") == std::string::npos; }
std::string trim(std::string s) {
  const auto a=s.find_first_not_of(" \t\r\n");
  if(a==std::string::npos) return {};
  return s.substr(a,s.find_last_not_of(" \t\r\n")-a+1);
}
std::string normalized(std::string_view input) {
  std::string out; out.reserve(input.size());
  for(std::size_t i=0;i<input.size();++i) {
    if(input[i]=='\r') { if(i+1==input.size() || input[i+1]!='\n') out+='\n'; }
    else out+=input[i];
  }
  return out;
}
Tokens tokenize(std::string_view text) {
  Tokens out;
  for(auto& piece:split_pieces(text)) {
    if(piece.sentence) out.insert(out.end(),piece.tokens.begin(),piece.tokens.end());
    else out.push_back({piece.text,false,false,false});
  }
  return out;
}
std::vector<std::size_t> positions(const Tokens& t) {
  std::vector<std::size_t> out;
  for(std::size_t i=0;i<t.size();++i) if(t[i].word) out.push_back(i);
  return out;
}
std::size_t count(const Tokens& tokens) {
  std::size_t n=0;
  for(const auto& t:tokens) if(t.word || (t.frozen && !space(t))) ++n;
  return n;
}
std::string evidence(const Tokens& t) {
  auto text=concat_tokens(t);
  return text.size()<=300 ? text : "[Long sentence: review in the original text]";
}
bool in(std::string_view value, std::initializer_list<std::string_view> values) {
  return std::find(values.begin(),values.end(),value)!=values.end();
}
bool ste(const Options& o) { return o.profile=="ste" || o.profile=="combined"; }
bool plain(const Options& o) { return o.profile=="plain" || o.profile=="combined"; }
void validate(const Options& o) {
  if(!in(o.profile,{"ste","plain","combined"})) throw std::invalid_argument("profile must be variation, ste, plain, or combined");
  if(!in(o.text_type,{"procedure","description"})) throw std::invalid_argument("text type must be procedure or description");
  if(o.audience.size()>1000 || o.purpose.size()>1000) throw std::invalid_argument("audience and purpose must each fit in 1000 UTF-8 bytes");
  if(o.vocabulary.size()>5000) throw std::invalid_argument("vocabulary limit is 5000 entries");
  for(const auto& e:o.vocabulary) {
    if(trim(e.term).empty() || e.term.size()>200 || e.term.find_first_of("\t\r\n")!=std::string::npos ||
       trim(e.meaning).empty() || e.meaning.size()>500 || e.meaning.find_first_of("\t\r\n")!=std::string::npos ||
       !in(e.pos,{"noun","verb","adjective","adverb","preposition","conjunction","pronoun","article","other"}) ||
       !in(e.category,{"general","technical-noun","technical-verb","name","title"}))
      throw std::invalid_argument("invalid vocabulary entry: require term, part of speech, meaning and category");
    if((e.category=="technical-noun" && e.pos!="noun") || (e.category=="technical-verb" && e.pos!="verb"))
      throw std::invalid_argument("technical vocabulary category and part of speech disagree");
  }
}
struct Vocabulary {
  std::unordered_map<std::string,std::vector<Tokens>> protected_index;
  std::unordered_set<std::string> spellings;
  explicit Vocabulary(const Options& options) {
    for(const auto& e:options.vocabulary) {
      auto t=tokenize(trim(e.term));
      spellings.insert(lower_copy(trim(e.term)));
      if(e.category!="general" && !t.empty()) protected_index[lower_copy(t.front().text)].push_back(std::move(t));
    }
    for(auto& [key,patterns]:protected_index) {
      (void)key;
      std::stable_sort(patterns.begin(),patterns.end(),[](const auto& a,const auto& b){return a.size()>b.size();});
    }
  }
  void freeze(Tokens& t) const {
    for(std::size_t i=0;i<t.size();++i) {
      const auto found=protected_index.find(lower_copy(t[i].text));
      if(found==protected_index.end()) continue;
      for(const auto& pattern:found->second) {
        if(pattern.size()>t.size()-i) continue;
        bool match=true;
        for(std::size_t k=0;k<pattern.size();++k)
          if(!(space(pattern[k]) && space(t[i+k])) && lower_copy(t[i+k].text)!=lower_copy(pattern[k].text)) {match=false;break;}
        if(match) { for(std::size_t k=0;k<pattern.size();++k) t[i+k].frozen=true; i+=pattern.size()-1; break; }
      }
    }
  }
};
void prepare(Tokens& t,const Options& o,const Vocabulary& vocabulary) {
  // Scanner freezes apostrophes. Unfreeze only explicit unambiguous contractions,
  // then restore quotation, name, fixed-expression and user protection.
  for(auto& token:t) for(const auto& rule:lexicon().clarity_rules)
    if(rule.guard=="contraction" && rule.source.size()==1 && lower_copy(token.text)==rule.source[0]) token.frozen=false;
  freeze_tokens(t,o.protect_quotes,true,true);
  vocabulary.freeze(t);
  (void)freeze_terms(t,o.protected_terms);
}
const std::unordered_map<std::string,std::string>& past_verbs() {
  static const std::unordered_map<std::string,std::string> forms={
    {"opened","open"},{"closed","close"},{"removed","remove"},{"installed","install"},
    {"cleaned","clean"},{"measured","measure"},{"recorded","record"},{"repaired","repair"},
    {"inspected","inspect"},{"replaced","replace"},{"selected","select"},{"tested","test"},
    {"used","use"},{"written","write"},{"made","make"},{"built","build"}};
  return forms;
}
bool possible_passive(const Tokens& t) {
  auto p=positions(t);
  for(std::size_t i=0;i+1<p.size();++i) {
    if(!in(lower_copy(t[p[i]].text),{"am","is","are","was","were","be","been","being"})) continue;
    for(std::size_t j=i+1;j<p.size() && j<=i+3;++j) {
      const auto w=lower_copy(t[p[j]].text);
      if(past_verbs().contains(w) || (w.size()>3 && w.ends_with("ed"))) return true;
      if(!is_known_adverb_word(w)) break;
    }
  }
  return false;
}
bool noun_phrase(const Tokens& t,std::size_t a,std::size_t b) {
  // Explicit articles plus simple lexical modifiers; no pronouns, coordination,
  // prepositions, clauses or guessed agents. Limited coverage is deliberate.
  std::vector<std::string> words;
  for(auto i=a;i<b;++i) {
    if(space(t[i])) continue;
    if(!t[i].word || t[i].frozen) return false;
    words.push_back(lower_copy(t[i].text));
    if(words.size()>4) return false;
  }
  if(words.size()<2 || words.size()>4 || !in(words[0],{"the","a","an"})) return false;
  for(std::size_t i=1;i<words.size();++i)
    if(is_aux(words[i]) || is_pronoun(words[i]) || is_preposition(words[i]) || is_coordinator(words[i]) ||
       is_subordinator_word(words[i]) || in(words[i],{"not","only","that","which","who","whose"})) return false;
  return true;
}
std::optional<ArrangeOutcome> active_past(const Tokens& t) {
  if(t.size()>64) return std::nullopt; // This template only supports two short noun phrases.
  auto p=positions(t); if(p.size()<6 || t.empty() || t.back().text!=".") return std::nullopt;
  for(std::size_t i=1;i+3<p.size();++i) {
    if(!in(lower_copy(t[p[i]].text),{"was","were"})) continue;
    auto part=lower_copy(t[p[i+1]].text);
    if(!past_verbs().contains(part) || lower_copy(t[p[i+2]].text)!="by") continue;
    if(p[i+1]!=p[i]+2 || p[i+2]!=p[i+1]+2 || p[i+3]!=p[i+2]+2) continue;
    if(!noun_phrase(t,0,p[i]) || !noun_phrase(t,p[i+3],t.size()-1)) continue;
    // "By the river/entrance" can be a location, not an actor. Only the
    // narrow reviewed role vocabulary can be promoted to grammatical subject.
    if(!in(lower_copy(t[p.back()].text),{"technician","operator","mechanic","engineer","inspector","worker","manufacturer","controller","computer","processor","relay"})) continue;

    auto object=trim(concat_tokens(Tokens(t.begin(),t.begin()+static_cast<std::ptrdiff_t>(p[i]))));
    auto agent=trim(concat_tokens(Tokens(t.begin()+static_cast<std::ptrdiff_t>(p[i+3]),t.end()-1)));
    object[0]=ascii_lower(static_cast<unsigned char>(object[0]));
    agent[0]=ascii_upper(static_cast<unsigned char>(agent[0]));
    // The limited irregular map retains the original simple-past tense.
    auto past=part=="written" ? "wrote" : part;
    auto text=agent+" "+past+" "+object+".";
    return ArrangeOutcome{tokenize(text),{ChangeKind::Arrangement,concat_tokens(t),text,"Clarity: explicit-agent passive to simple-past active"}};
  }
  return std::nullopt;
}
bool independent_clause(const Tokens& t,std::size_t a,std::size_t b) {
  auto sub=Tokens(t.begin()+static_cast<std::ptrdiff_t>(a),t.begin()+static_cast<std::ptrdiff_t>(b));
  auto p=positions(sub); if(p.size()<3) return false;
  const auto first=lower_copy(sub[p[0]].text);
  std::size_t predicate;
  if(in(first,{"we","you","they","he","she","it"})) predicate=1;
  else if(in(first,{"the","this","these","those","a","an"})) predicate=2;
  else return false;
  // Require the finite predicate directly after the supported short subject,
  // not inside an unmarked reported clause ("the operator believes ... is").
  if(predicate>=p.size()) return false;
  return in(lower_copy(sub[p[predicate]].text),{"is","are","was","were","am","has","have","had","can","could","may","might","must","shall","should","will","would","does","do","did"});
}

std::optional<ArrangeOutcome> split_independent(const Tokens& t) {
  if(t.size()>600 || t.empty() || t.back().text!=".") return std::nullopt;
  for(const auto& token:t) {
    const auto w=lower_copy(token.text);
    if(token.frozen || w.find('\n')!=std::string::npos ||
       in(w,{"if","unless","when","whenever","before","after","because","although","while","until","not","never","only","either","neither","nor","who","which","that","whose"}) || w.find("n't")!=std::string::npos)
      return std::nullopt;
    if(!token.word && !space(token) && !in(w,{".",",",";"})) return std::nullopt;
  }
  std::size_t boundary=t.size(), right=t.size(); std::string connector;
  for(std::size_t i=1;i+2<t.size();++i) {
    if(t[i].text==";") { if(boundary!=t.size()) return std::nullopt; boundary=i;right=i+1; }
    else if(t[i].text=="," && i+3<t.size() && space(t[i+1]) && in(lower_copy(t[i+2].text),{"and","but"}) && space(t[i+3])) {
      if(boundary!=t.size()) return std::nullopt;
      boundary=i;right=i+4;connector=lower_copy(t[i+2].text);
    }
  }
  if(boundary==t.size() || !independent_clause(t,0,boundary) || !independent_clause(t,right,t.size())) return std::nullopt;
  auto left=trim(concat_tokens(Tokens(t.begin(),t.begin()+static_cast<std::ptrdiff_t>(boundary))));
  auto tail=trim(concat_tokens(Tokens(t.begin()+static_cast<std::ptrdiff_t>(right),t.end())));
  if(connector.empty()) tail[0]=ascii_upper(static_cast<unsigned char>(tail[0]));
  else { connector[0]=ascii_upper(static_cast<unsigned char>(connector[0])); tail=connector+" "+tail; }
  auto text=left+". "+tail;
  return ArrangeOutcome{tokenize(text),{ChangeKind::Arrangement,concat_tokens(t),text,"Clarity: separated two explicit independent clauses"}};
}
void simplify(Tokens& t,std::vector<Change>& changes) {
  const auto original=t; Tokens out; out.reserve(t.size());
  const bool purpose_blocked=std::ranges::any_of(original,[](const auto& x){return in(lower_copy(x.text),{"put","set","get","got","keep","kept","bring","brought","arrange","arranged"});});
  for(std::size_t i=0;i<original.size();) {
    bool changed=false;
    if(!original[i].frozen && original[i].word) for(const auto& rule:lexicon().clarity_rules) {
      const auto n=rule.source.size()*2-1;
      if(rule.source.empty() || n>original.size()-i || (rule.guard=="purpose" && purpose_blocked)) continue;
      bool match=true;
      for(std::size_t k=0;k<n;++k) {
        const auto& token=original[i+k];
        if(token.frozen || (k%2 ? token.text!=" " : !token.word || lower_copy(token.text)!=rule.source[k/2])) {match=false;break;}
      }
      if(!match) continue;
      const auto end=i+n;
      const auto next=end+1<original.size() && space(original[end]) && original[end+1].word ? lower_copy(original[end+1].text) : "";
      const auto prev=i>=2 && space(original[i-1]) && original[i-2].word ? lower_copy(original[i-2].text) : "";
      if(rule.guard=="noun" && !is_determiner(next)) continue;
      if(rule.guard=="clause" && !is_pronoun(next) && !is_determiner(next)) continue;
      if(rule.guard=="purpose" && (next.empty() || is_determiner(next))) continue;
      if(rule.guard=="verb" && (is_determiner(prev) || (!prev.empty() && !is_pronoun(prev) && !is_aux(prev) && !is_known_adverb_word(prev)))) continue;
      const auto before=concat_tokens(Tokens(original.begin()+static_cast<std::ptrdiff_t>(i),original.begin()+static_cast<std::ptrdiff_t>(end)));
      const auto after=apply_caps(rule.target,original[i].text);
      auto replacement=tokenize(after);
      for(auto& token:replacement) {token.replaced=!space(token);token.frozen=true;out.push_back(std::move(token));}
      changes.push_back({ChangeKind::Phrase,before,after,"Clarity: directional simplification"});
      i=end;changed=true;break;
    }
    if(!changed) out.push_back(original[i++]);
  }
  t=std::move(out);
}
StandardMetrics audit(std::string_view text,const Options& o,const Vocabulary& vocabulary,std::vector<StandardFinding>* findings) {
  StandardMetrics metrics;
  std::set<std::string> unknown;
  const auto add=[&](std::string code,std::string severity,std::string message,std::string excerpt,std::size_t sentence) {
    if(findings && findings->size()<250) findings->push_back({std::move(code),std::move(severity),std::move(message),std::move(excerpt),sentence});
  };
  for(auto& piece:split_pieces(text)) {
    if(!piece.sentence) continue;
    auto tokens=piece.tokens; const auto n=count(tokens); if(!n) continue;
    ++metrics.sentences; metrics.words+=n;metrics.longest_sentence=std::max(metrics.longest_sentence,n);
    const auto p=positions(tokens);
    const bool note=!p.empty() && lower_copy(tokens[p[0]].text)=="note";
    const auto limit=ste(o) && o.text_type=="procedure" && !note ? 20u : 25u;
    if(n>limit) {
      ++metrics.long_sentences;
      add(ste(o)?(limit==20?"STE-5.1":"STE-6.3"):"PL-SENTENCE","review",std::to_string(n)+" screening words exceed the "+std::to_string(limit)+"-word target. Review grouping and sentence structure.",evidence(tokens),metrics.sentences);
    }
    if(possible_passive(tokens)) {
      ++metrics.possible_passives;
      add(ste(o)?"STE-3.6":"PL-ACTIVE","review",o.text_type=="procedure"?"Possible passive construction. Confirm the action and responsible actor; do not invent an agent.":"Possible passive construction. For STE descriptions, an unknown agent can justify the passive.",evidence(tokens),metrics.sentences);
    }
    prepare(tokens,o,vocabulary);
    bool ing=false, contraction=false, complex=false;
    for(std::size_t k=0;k<tokens.size();++k) {
      const auto& token=tokens[k];const auto w=lower_copy(token.text);
      if(!token.word) continue;
      if(w.find("n't")!=std::string::npos || w.ends_with("'re") || w.ends_with("'ve") || w.ends_with("'ll") || w.ends_with("'d")) contraction=true;
      if(token.frozen) continue;
      if(w.size()>4 && w.ends_with("ing") && !in(w,{"during","something","anything","nothing","everything"})) ing=true;
      if(in(w,{"has","have","had"})) {
        auto j=k+1; while(j<tokens.size() && space(tokens[j])) ++j;
        if(j<tokens.size() && (lower_copy(tokens[j].text)=="been" || lower_copy(tokens[j].text).ends_with("ed"))) complex=true;
      }
      if(ste(o) && !o.vocabulary.empty() && !vocabulary.spellings.contains(w)) unknown.insert(w);
    }
    if(ste(o) && ing) add("STE-3.5","review","Review -ing forms: technical nouns/modifiers and some dictionary entries can be permitted; a suffix alone cannot decide.",evidence(tokens),metrics.sentences);
    if(ste(o) && complex) add("STE-3.2","review","Review the auxiliary/tense construction without losing timing, modality or completed-action meaning.",evidence(tokens),metrics.sentences);
    if(contraction) add("CLARITY-CONTRACTION","review","Unresolved contraction: expand only after its meaning is clear.",evidence(tokens),metrics.sentences);
  }
  metrics.unlisted_words=unknown.size();
  for(const auto& word:unknown) add("STE-VOCABULARY","review","Spelling not found in the supplied vocabulary. Review its approved sense, form or technical-term status.",word,0);
  return metrics;
}
} // namespace

std::vector<VocabularyEntry> parse_vocabulary(std::string_view tsv) {
  if(tsv.size()>1000000) throw std::invalid_argument("vocabulary input limit is 1000000 UTF-8 bytes");
  std::istringstream input{std::string(tsv)}; Options options; options.profile="ste";
  std::set<std::string> seen;
  for(std::string line;std::getline(input,line);) {
    if(!line.empty() && line.back()=='\r') line.pop_back();
    if(trim(line).empty() || trim(line).starts_with('#')) continue;
    std::vector<std::string> cols; std::size_t start=0;
    for(std::size_t i=0;i<=line.size();++i) if(i==line.size() || line[i]=='\t') {cols.push_back(trim(line.substr(start,i-start)));start=i+1;}
    if(cols.size()!=4) throw std::invalid_argument("vocabulary TSV needs four columns: term, pos, meaning, category");
    const auto key=lower_copy(cols[0])+"\t"+cols[1]+"\t"+cols[3];
    if(!seen.insert(key).second) throw std::invalid_argument("duplicate vocabulary entry");
    options.vocabulary.push_back({cols[0],cols[1],cols[2],cols[3]});
    if(options.vocabulary.size()>5000) throw std::invalid_argument("vocabulary limit is 5000 entries");
  }
  validate(options);return options.vocabulary;
}

Result rewrite_standard(std::string_view input,const Options& options) {
  validate(options);
  const Vocabulary vocabulary(options);
  const auto source=normalized(input);
  Result result;
  for(auto& piece:split_pieces(source)) {
    if(!piece.sentence) {result.text+=piece.text;continue;}
    auto tokens=piece.tokens;
    prepare(tokens,options,vocabulary);
    const bool locked=freeze_terms(tokens,options.protected_terms);
    if(!options.check_only) {
      if(options.arrange && !locked) {
        auto arranged=active_past(tokens);
        if(!arranged) arranged=split_independent(tokens);
        if(arranged) {
          tokens=std::move(arranged->tokens);result.changes.push_back(std::move(arranged->change));
          prepare(tokens,options,vocabulary);
        }
      }
      if(options.synonyms) simplify(tokens,result.changes);
    }
    result.text+=concat_tokens(tokens);
  }
  StandardsReport report;
  report.profile=options.profile;report.text_type=options.text_type;
  report.audience=options.audience;report.purpose=options.purpose;
  report.sentence_target=ste(options) && options.text_type=="procedure" ? 20 : 25;
  report.vocabulary_entries=options.vocabulary.size();
  const auto add=[&](std::string code,std::string message) {report.findings.push_back({std::move(code),"review",std::move(message),"",0});};
  add("AUTHOR-REVIEW","No complete conformance or semantic-equivalence assessment was performed. Check facts, actors, quantities, conditions, negation and obligations against the source.");
  add("COUNT-SCOPE","Word counts are screening estimates, not the full ASD-STE100 section 8 counting method. Review names, labels, quotations, measurements, parentheses and lists. ISO 24495-1 does not impose this application's 25-word heuristic.");
  if(ste(options)) {
    add("STE-DICTIONARY",options.vocabulary.empty()?"The authorized STE general dictionary and reviewed technical terminology are not loaded. Vocabulary conformance is not assessed.":"The supplied vocabulary supports spelling checks only. Its authority, completeness, meanings, word forms and parts of speech still require review.");
    add("STE-COVERAGE","Review the remaining STE requirements, including technical-term consistency, noun groups, procedural actions/conditions, notes, safety text, paragraphs, spelling directives and presentation. This is not an ASD-approved tool.");
  }
  if(plain(options)) {
    add("ISO-RELEVANT",options.audience.empty() || options.purpose.empty()?"Specify the intended readers and their task. Then verify that the document includes the information they need.":"Reader and purpose context are recorded, not validated. Confirm relevance and necessary background with the intended readers.");
    add("ISO-FINDABLE","Review the order, headings, navigation and layout so readers can locate the information they need.");
    add("ISO-UNDERSTANDABLE","Review terminology, explanations, sentence relationships and examples for the intended readers. Short words alone do not establish understanding.");
    add("ISO-USABLE","Evaluate the document with representative readers and revise it using their results. No reader evaluation was performed by this tool.");
  }
  report.before=audit(source,options,vocabulary,nullptr);
  report.after=audit(result.text,options,vocabulary,&report.findings);
  if(report.findings.size()==250) report.findings.push_back({"REPORT-LIMIT","review","The on-screen/exported finding list is capped at 250 entries. Metrics cover the complete input; review the full document.","",0});
  result.standards=std::move(report);
  return result;
}
} // namespace synomizer
