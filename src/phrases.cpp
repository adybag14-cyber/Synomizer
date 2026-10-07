// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "internal.hpp"
#include "embedded_data.hpp"
#include <algorithm>
#include <sstream>
#include <unordered_set>

namespace synomizer {
namespace {
struct Rule { std::vector<std::string> source; std::string target; bool tail_only; int minimum_intensity; };
std::vector<std::string> words(std::string_view text) {
  std::istringstream in{std::string(text)};
  std::vector<std::string> out;
  for (std::string word; in >> word;) out.push_back(std::move(word));
  return out;
}
const std::vector<Rule>& rules() {
  static const auto stored = [] {
    std::vector<Rule> out;
    std::istringstream in{std::string(embedded::rephrases_tsv)};
    for (std::string line; std::getline(in, line);) {
      if (line.empty() || line.front() == '#') continue;
      if (line.back() == '\r') line.pop_back();
      const auto a = line.find('\t'), b = line.find('\t', a + 1);
      if (a == std::string::npos || b == std::string::npos) continue;
      const auto c = line.find('\t', b+1);
      if (c == std::string::npos) continue;
      out.push_back({words(line.substr(0, a)), line.substr(a+1, b-a-1), line.substr(b+1, c-b-1) == "tail", line.substr(c+1) == "0" ? 0 : 1});
    }
    std::ranges::stable_sort(out, [](const auto& a, const auto& b) { return a.source.size() > b.source.size(); });
    return out;
  }();
  return stored;
}
std::uint64_t choice(std::string_view text, std::uint64_t seed, std::uint64_t position) {
  std::uint64_t hash = 14695981039346656037ULL;
  for (unsigned char c : text) { hash ^= static_cast<unsigned char>(ascii_lower(c)); hash *= 1099511628211ULL; }
  hash ^= seed ^ ((position + 1) * 0xD1B54A32D192ED03ULL);
  hash += 0x9e3779b97f4a7c15ULL;
  hash = (hash ^ (hash >> 30)) * 0xbf58476d1ce4e5b9ULL;
  hash = (hash ^ (hash >> 27)) * 0x94d049bb133111ebULL;
  return hash ^ (hash >> 31);
}
bool fits(const std::vector<Token>& tokens, std::size_t begin, std::size_t end, bool tail_only) {
  const bool front = begin == 0 && end < tokens.size() && tokens[end].text == ",";
  bool tail = true;
  for (std::size_t i = end; i < tokens.size(); ++i)
    if (tokens[i].text != "." && tokens[i].text.find_first_not_of(" \t") != std::string::npos) tail = false;
  if ((!front && !tail) || (tail_only && !tail)) return false;
  if (tail_only && begin >= 2 && is_determiner(lower_copy(tokens[begin-2].text))) return false;
  static const std::unordered_set<std::string_view> scope = {
    "not", "never", "no", "only", "just", "almost", "nearly", "hardly", "scarcely", "barely", "very", "too", "rather", "quite",
    "more", "most", "less", "least", "enough", "if", "whether", "that", "who", "which", "whose", "why", "how"};
  static const std::unordered_set<std::string_view> verbs = {
    "works", "worked", "reads", "studies", "studied", "exercises", "exercised", "visits", "visited", "meets", "writes",
    "travels", "travelled", "traveled", "spoke", "speaks", "smiled", "smiles", "walked", "walks"};
  bool predicate = false;
  int lexical = 0;
  for (std::size_t i = 0; i < tokens.size(); ++i) {
    if (i >= begin && i < end) continue;
    const auto& token = tokens[i];
    const auto w = lower_copy(token.text);
    if (w.find('\n') != std::string::npos || scope.contains(w) || w.find("n't") != std::string::npos ||
        is_subordinator_word(w) || is_coordinator(w)) return false;
    if (!token.word) {
      if (w == "." || (front && i == end) || w.find_first_not_of(" \t") == std::string::npos) continue;
      return false;
    }
    if (token.frozen) continue;
    if (is_aux(w)) { predicate = true; continue; }
    const auto prev = i >= 2 ? lower_copy(tokens[i-2].text) : std::string{};
    if (!is_determiner(prev) && (looks_like_verb_token(w) || verbs.contains(w))) { predicate = true; ++lexical; }
  }
  return predicate && lexical <= 1;
}
}

std::vector<Change> rephrase(std::vector<Token>& tokens, const Options& options, std::uint64_t ordinal) {
  std::vector<Change> changes;
  if (!options.synonyms || options.density <= 0) return changes;
  for (std::size_t i = 0; i < tokens.size(); ++i) {
    if (!tokens[i].word || tokens[i].frozen) continue;
    for (const auto& rule : rules()) {
      if (options.intensity < rule.minimum_intensity) continue;
      const auto size = rule.source.size() * 2 - 1;
      if (i + size > tokens.size()) continue;
      bool match = true;
      for (std::size_t k = 0; k < size; ++k) {
        const auto& token = tokens[i+k];
        if (token.frozen || (k % 2 ? token.text != " " : !token.word || lower_copy(token.text) != rule.source[k/2])) { match = false; break; }
      }
      if (!match || !fits(tokens, i, i+size, rule.tail_only)) continue;
      std::string before;
      for (std::size_t k = 0; k < size; ++k) before += tokens[i+k].text;
      if (options.density < 100 && choice(before, options.seed, ordinal+i) % 100 >= static_cast<std::uint64_t>(options.density)) continue;
      const auto after = apply_caps(rule.target, tokens[i].text);
      std::vector<Token> replacement;
      for (auto& word : words(after)) {
        if (!replacement.empty()) replacement.push_back(Token{" ", false, true, false});
        replacement.push_back(Token{std::move(word), true, true, true});
      }
      changes.push_back({ChangeKind::Phrase, before, after, "Matched adjunct phrase"});
      tokens.erase(tokens.begin()+static_cast<std::ptrdiff_t>(i), tokens.begin()+static_cast<std::ptrdiff_t>(i+size));
      tokens.insert(tokens.begin()+static_cast<std::ptrdiff_t>(i), replacement.begin(), replacement.end());
      i += replacement.size()-1;
      break;
    }
  }
  return changes;
}
} // namespace synomizer
