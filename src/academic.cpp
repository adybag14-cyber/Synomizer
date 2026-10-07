// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "internal.hpp"
#include <algorithm>
#include <sstream>
#include <unordered_map>
#include <unordered_set>

namespace synomizer {
namespace {
using Tokens = std::vector<Token>;
using Words = std::unordered_set<std::string>;
bool space(const Token& t) { return !t.word && !t.text.empty() && t.text.find_first_not_of(" \t") == std::string::npos; }
std::string word(const Tokens& t, std::size_t i) { return i < t.size() && t[i].word ? lower_copy(t[i].text) : std::string{}; }
std::vector<std::string> split(std::string_view text) {
  std::istringstream in{std::string(text)}; std::vector<std::string> out;
  for (std::string s; in >> s;) out.push_back(std::move(s));
  return out;
}
Tokens slice(const Tokens& t, std::size_t a, std::size_t b) {
  while (a < b && space(t[a])) ++a;
  while (b > a && space(t[b-1])) --b;
  return {t.begin()+static_cast<std::ptrdiff_t>(a), t.begin()+static_cast<std::ptrdiff_t>(b)};
}
Tokens literal(std::string_view text) {
  Tokens out;
  for (auto& s : split(text)) {
    if (!out.empty()) out.push_back({" ", false, false, false});
    out.push_back({std::move(s), true, true, true});
  }
  return out;
}
void append(Tokens& out, const Tokens& tail) {
  if (tail.empty()) return;
  if (!out.empty()) out.push_back({" ", false, false, false});
  out.insert(out.end(), tail.begin(), tail.end());
}
void capitalize(Tokens& tokens) {
  if (!tokens.empty() && !tokens.front().text.empty()) tokens.front().text.front() = ascii_upper(static_cast<unsigned char>(tokens.front().text.front()));
}
void lower_initial(Tokens& tokens, bool known_common = false) {
  if (tokens.empty() || tokens.front().text.empty()) return;
  const auto w = lower_copy(tokens.front().text);
  static const Words common = {"recent", "published", "experimental", "mechanistic", "comparative", "current", "further", "additional"};
  if (w == "i" || is_all_caps_word(tokens.front().text)) return;
  if (known_common || is_determiner(w) || common.contains(w)) tokens.front().text.front() = ascii_lower(static_cast<unsigned char>(tokens.front().text.front()));
}
bool unsafe_scope(const Tokens& tokens) {
  static const Words scope = {"not", "never", "no", "neither", "nor", "only", "just", "hardly", "scarcely", "barely"};
  for (const auto& t : tokens) {
    const auto w = lower_copy(t.text);
    if (scope.contains(w) || w.find("n't") != std::string::npos || w.find('\n') != std::string::npos) return true;
    if ((!t.word && t.frozen && !t.replaced) || w == "\"" || w == "'" || w == "?" || w == "!" ||
        w == "\xE2\x80\x98" || w == "\xE2\x80\x99" || w == "\xE2\x80\x9C" || w == "\xE2\x80\x9D") return true;
  }
  return false;
}
struct Rule { std::string mode; std::vector<std::string> source, targets; int minimum; };
const std::unordered_map<std::string, std::vector<Rule>>& rule_index() {
  static const auto index = [] {
    std::unordered_map<std::string, std::vector<Rule>> out;
    for (const auto& r : lexicon().academic_rules) {
      if (r.forms.size() < 2) continue;
      auto source = split(r.forms.front()); if (source.empty()) continue;
      const auto first = source.front();
      out[first].push_back({r.mode, std::move(source), {r.forms.begin()+1, r.forms.end()}, r.minimum_intensity});
    }
    for (auto& [key, rules] : out) {
      (void)key;
      std::stable_sort(rules.begin(), rules.end(), [](const Rule& a, const Rule& b) { return a.source.size() > b.source.size(); });
    }
    return out;
  }();
  return index;
}
bool guard(const Rule& r, const Tokens& t, std::size_t begin, std::size_t end) {
  const auto prev = begin >= 2 && space(t[begin-1]) ? word(t, begin-2) : std::string{};
  const auto next = end+1 < t.size() && space(t[end]) ? word(t, end+1) : std::string{};
  static const Words research = {"review", "study", "analysis", "report", "paper", "investigation", "survey", "evaluation", "assessment"};
  static const Words evidence = {"studies", "results", "findings", "evidence", "data", "analyses", "analysis", "research", "review", "study", "experiments", "simulations"};
  if (r.mode == "local") return true;
  if (r.mode == "review") return research.contains(prev) && !next.empty();
  if (r.mode == "pending") {
    static const Words outcomes = {"established","determined","resolved","verified","confirmed","evaluated","assessed","identified","clarified","explained","demonstrated","shown","seen","known","done","understood","measured","quantified","characterised","characterized","validated","defined","tested"};
    return !prev.empty() && !is_aux(prev) && !is_pronoun(prev) && !is_preposition(prev) && !is_determiner(prev) && outcomes.contains(next);
  }
  if (r.mode == "dependent") return !prev.empty() && !is_aux(prev) && !is_preposition(prev) && !is_determiner(prev) && !next.empty();
  if (r.mode == "verbal") {
    if (r.source.size() > 1 && r.source[1] == "control") {
      static const Words processes = {"transfer","test","testing","measurement","evaluation","assessment","experiment","experiments","protocol","protocols","analysis","reaction","reactions","procedure","procedures","method","methods","synthesis","process","processes","operation"};
      if (!processes.contains(prev)) return false;
    }
    return !prev.empty() && !is_determiner(prev) && ((r.source.back() != "of" && r.source.back() != "for") || !next.empty());
  }
  if (r.mode == "support") {
    if (next.empty() || is_preposition(next) || is_aux(next)) return false;
    // Walk only over auxiliaries/adverbs, never across punctuation or a noun phrase.
    for (std::size_t k = begin, n = 0; k >= 2 && n < 5; k -= 2, ++n) {
      if (!space(t[k-1])) return false;
      const auto w = word(t, k-2);
      if (evidence.contains(w)) return true;
      if (!is_aux(w) && !is_known_adverb_word(w)) break;
    }
    return false;
  }
  if (r.mode == "benchmark") {
    static const Words benchmark_sources = {"research","chemistry","study","studies","results","evidence","analysis","analyses","comparison","comparisons","work","experiment","experiments","simulation","simulations"};
    if (!benchmark_sources.contains(prev) || (next != "a" && next != "the")) return false;
    for (std::size_t k = end+1, n = 0; k < t.size() && n < 6; k += 2, ++n) {
      const auto w = word(t, k);
      if (w == "benchmark") {
        const auto after = k+1 < t.size() && space(t[k+1]) ? word(t,k+2) : std::string{};
        return after.empty() || is_preposition(after) || is_aux(after) || is_coordinator(after);
      }
      if (w.empty() || is_preposition(w) || is_aux(w) || k+1 >= t.size() || !space(t[k+1])) break;
    }
    return false;
  }
  if (r.mode == "nominal") return next.empty() || is_preposition(next) || is_aux(next) ||
    is_coordinator(next) || next == "that" || next == "which" || looks_like_verb_token(next);
  if (r.mode == "route") {
    if (prev != "offers" && prev != "offer" && prev != "provides" && prev != "provide") return false;
    static const Words heads = {"structure", "structures", "compound", "compounds", "molecule", "molecules", "product", "products", "material", "materials"};
    for (std::size_t k = end+1, n = 0; k < t.size() && n < 8; k += 2, ++n) {
      const auto w = word(t, k);
      if (heads.contains(w)) return true;
      if (w.empty() || (w.ends_with("ing") && w.find('-') == std::string::npos) || is_preposition(w) || is_aux(w) || k+1 >= t.size() || !space(t[k+1])) break;
    }
  }
  return false;
}
std::optional<ArrangeOutcome> finish(Tokens t, const Tokens& before, std::string detail) {
  const auto original = concat_tokens(before), revised = concat_tokens(t);
  if (original == revised) return std::nullopt;
  return ArrangeOutcome{std::move(t), {ChangeKind::Arrangement, original, revised, std::move(detail)}};
}
bool has_word(const Tokens& t, std::size_t a, std::size_t b, const Words& words) {
  for (auto i = a; i < b; ++i) if (t[i].word && words.contains(lower_copy(t[i].text))) return true;
  return false;
}
bool predicate(const Tokens& t, std::size_t a, std::size_t b) {
  static const Words extra = {"requires", "require", "depends", "depend", "exists", "exist", "works", "contains", "contain", "increases", "increase", "decreases", "decrease", "occurs", "occur"};
  for (auto i = a; i < b; ++i) if (t[i].word && (looks_like_verb_token(t[i].text) || extra.contains(lower_copy(t[i].text)))) return true;
  return false;
}
} // namespace

void academic_phrases(Tokens& tokens, const Options& options, std::vector<Change>& changes) {
  if (!options.synonyms || options.style == Style::Close || options.intensity < 1 || unsafe_scope(tokens)) return;
  // Decisions always use the original token context. Stream the output so a
  // long unpunctuated document does not require quadratic vector insertion.
  const Tokens context = std::move(tokens);
  Tokens output; output.reserve(context.size());
  for (std::size_t i = 0; i < context.size();) {
    bool replaced = false;
    const auto entry = rule_index().find(word(context, i));
    if (context[i].word && !context[i].frozen && entry != rule_index().end()) {
      for (const auto& r : entry->second) {
        const auto length = r.source.size()*2-1;
        if (options.intensity < r.minimum || length > context.size()-i) continue;
        bool matches = true;
        for (std::size_t k = 0; k < length; ++k) {
          const auto& t = context[i+k];
          if (t.frozen || (k%2 ? t.text != " " : !t.word || lower_copy(t.text) != r.source[k/2])) { matches = false; break; }
        }
        if (!matches || !guard(r, context, i, i+length)) continue;
        const auto before = concat_tokens(slice(context, i, i+length));
        const auto after = apply_caps(r.targets[static_cast<std::size_t>((options.seed + i) % r.targets.size())], context[i].text);
        auto replacement = literal(after);
        changes.push_back({ChangeKind::Phrase, before, after, "Guarded academic " + r.mode + " phrase"});
        output.insert(output.end(), replacement.begin(), replacement.end());
        i += length; replaced = true; break;
      }
    }
    if (!replaced) output.push_back(context[i++]);
  }
  tokens = std::move(output);
}

std::optional<ArrangeOutcome> academic_arrangement(const Tokens& tokens, const Options& options) {
  if (!options.arrange || options.style != Style::Recast || options.intensity < 1 || tokens.size() < 7 || unsafe_scope(tokens)) return std::nullopt;
  // These four templates are deliberately not a general English parser. Opaque
  // spans, multiline layouts, nested clauses and complex punctuation stay put.
  if (tokens.back().text != ".") return std::nullopt;
  const auto end = tokens.size()-1;
  std::size_t thats = 0, whiles = 0, links_count = 0;
  for (const auto& t : tokens) {
    const auto w = lower_copy(t.text);
    thats += w == "that"; whiles += w == "while";
    links_count += w == "therefore" || w == "consequently" || w == "however" || w == "nevertheless" || w == "nonetheless";
  }
  if (thats > 1 || whiles > 1 || links_count > 1) return std::nullopt;
  for (std::size_t i = 0; i < end; ++i)
    if (!tokens[i].word && tokens[i].text != " " && tokens[i].text != ",") return std::nullopt;
  static const Words embedded = {"if", "unless", "whether", "because", "although", "though", "when", "where", "who", "which", "whose", "but"};
  if (has_word(tokens, 0, end, embedded)) return std::nullopt;

  // Keep the exact evidential strength: suggests -> as suggested, never proves.
  static const Words sources = {"full-text comparison", "the comparison", "this comparison", "the analysis", "this analysis", "the results", "these results", "the findings", "these findings", "the evidence", "this evidence", "the data", "these data", "experimental results", "experimental evidence", "the simulations", "this review"};
  static const std::unordered_map<std::string, std::string> reporting = {
    {"shows","shown"},{"show","shown"},{"demonstrates","demonstrated"},{"demonstrate","demonstrated"},
    {"indicates","indicated"},{"indicate","indicated"},{"suggests","suggested"},{"suggest","suggested"}};
  for (std::size_t i = 2; i+4 < end && i <= 12; ++i) {
    const auto it = reporting.find(word(tokens, i));
    if (it == reporting.end() || word(tokens, i+2) != "that" || tokens[i-1].text != " " || tokens[i+1].text != " " || tokens[i+3].text != " ") continue;
    auto source = slice(tokens, 0, i);
    if (!sources.contains(lower_copy(concat_tokens(source))) || has_word(tokens,i+4,end,{"that","while"}) || !predicate(tokens,i+4,end)) continue;
    auto body = slice(tokens, i+4, end); capitalize(body); lower_initial(source, true);
    body.push_back({",", false, false, false}); append(body, literal("as " + it->second + " by")); append(body, source); body.push_back(tokens.back());
    return finish(std::move(body), tokens, "Moved evidence attribution after its complete claim");
  }

  // Move a same-subject present-participle adjunct, preserving the word 'while'.
  static const Words participles = {"illustrating","highlighting","demonstrating","showing","retaining","preserving","maintaining","avoiding","reducing","increasing","broadening","expanding"};
  static const Words matrix_verbs = {"broaden","broadens","expand","expands","extend","extends","improve","improves","provide","provides","offer","offers"};
  for (std::size_t i = 4; i+4 < end; ++i) {
    if (word(tokens,i) != "while" || !participles.contains(word(tokens,i+2)) || has_word(tokens,0,end,{"that"})) continue;
    int verbs = 0; bool simple = true;
    for (std::size_t k = 0; k < i; ++k) { if (matrix_verbs.contains(word(tokens,k))) ++verbs; if (tokens[k].text == "," || is_aux(word(tokens,k))) simple = false; }
    if (!simple || verbs != 1 || has_word(tokens,i+2,end,{"while"})) continue;
    auto intro = slice(tokens,i,end), body = slice(tokens,0,i); capitalize(intro); lower_initial(body);
    intro.push_back({",", false, false, false}); append(intro,body); intro.push_back(tokens.back());
    return finish(std::move(intro),tokens,"Fronted a same-subject while-participle adjunct");
  }

  // 'The opportunity is therefore X' -> 'Therefore, the opportunity is X'.
  static const Words links = {"therefore","consequently","however","nevertheless","nonetheless"};
  for (std::size_t i = 4; i+2 < end; ++i) {
    const auto w = word(tokens,i), prev = word(tokens,i-2);
    if (!links.contains(w) || (prev != "is" && prev != "are" && prev != "was" && prev != "were") || has_word(tokens,0,end,{"that","while"})) continue;
    bool simple = true;
    for (std::size_t k=0;k<i;++k) if (tokens[k].text == ",") simple=false;
    if (!simple) continue;
    auto body=slice(tokens,0,i); append(body,slice(tokens,i+1,end)); lower_initial(body);
    auto out=literal(w); capitalize(out); out.push_back({",",false,false,false}); append(out,body); out.push_back(tokens.back());
    return finish(std::move(out),tokens,"Fronted a discourse connective without changing the proposition");
  }

  // Restore the relative clause next to its noun, retaining 'is proposed'.
  static const Words heads = {"assessment","approach","framework","procedure","strategy","plan","protocol","method","workflow","system","model","design","scheme"};
  static const Words proposals = {"proposed","suggested","recommended"};
  static const Words relative_verbs = {"combines","integrates","includes","uses","incorporates","addresses"};
  if (word(tokens,0) == "a" || word(tokens,0) == "an") {
    for (std::size_t i=4;i+6<end && i<=12;++i) {
      if (word(tokens,i)!="is" || !heads.contains(word(tokens,i-2)) || !proposals.contains(word(tokens,i+2)) ||
          word(tokens,i+4)!="that" || !relative_verbs.contains(word(tokens,i+6)) || has_word(tokens,i+6,end,{"that","while"})) continue;
      bool simple=true;
      for (std::size_t k=0;k<i;++k) if (tokens[k].text==",") simple=false;
      if (!simple) continue;
      auto out=slice(tokens,0,i); append(out,slice(tokens,i+4,end));
      auto proposal=slice(tokens,i,i+3);
      for (auto& t:proposal) if (t.word) t.frozen=true;
      append(out,proposal); out.push_back(tokens.back());
      return finish(std::move(out),tokens,"Placed a proposed method's relative clause beside its noun");
    }
  }
  return std::nullopt;
}
} // namespace synomizer
