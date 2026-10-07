// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#include "internal.hpp"
#include <unordered_set>

namespace synomizer {
namespace {

bool is_space_token(const Token& token) {
  return !token.word && !token.text.empty() && token.text.find_first_not_of(" \t\n") == std::string::npos;
}

bool is_digit_token(const Token& token) {
  return !token.word && !token.text.empty() &&
         token.text.find_first_not_of("0123456789") == std::string::npos;
}

std::vector<int> word_positions(const std::vector<Token>& tokens) {
  std::vector<int> indexes;
  for (int i = 0; i < static_cast<int>(tokens.size()); ++i) {
    if (tokens[static_cast<std::size_t>(i)].word) {
      indexes.push_back(i);
    }
  }
  return indexes;
}

std::string word_at(const std::vector<Token>& tokens, int index) {
  return lower_copy(tokens[static_cast<std::size_t>(index)].text);
}

int punct_index(const std::vector<Token>& tokens) {
  for (int i = static_cast<int>(tokens.size()) - 1; i >= 0; --i) {
    const Token& token = tokens[static_cast<std::size_t>(i)];
    if (is_space_token(token)) {
      continue;
    }
    if (token.text == "." || token.text == "!" || token.text == "?") {
      return i;
    }
    return -1;
  }
  return -1;
}

bool clause_comma(const std::vector<Token>& tokens, int index) {
  const Token& token = tokens[static_cast<std::size_t>(index)];
  if (token.text != ",") {
    return false;
  }
  int prev = index - 1;
  while (prev >= 0 && is_space_token(tokens[static_cast<std::size_t>(prev)])) {
    --prev;
  }
  int next = index + 1;
  while (next < static_cast<int>(tokens.size()) && is_space_token(tokens[static_cast<std::size_t>(next)])) {
    ++next;
  }
  if (prev >= 0 && next < static_cast<int>(tokens.size()) && is_digit_token(tokens[static_cast<std::size_t>(prev)]) &&
      is_digit_token(tokens[static_cast<std::size_t>(next)])) {
    return false;
  }
  return true;
}

bool range_has_verb(const std::vector<Token>& tokens, int begin, int end) {
  bool any = false;
  int lexical = 0;
  for (int i = begin; i < end; ++i) {
    const auto& token = tokens[static_cast<std::size_t>(i)];
    if (!token.word || !looks_like_verb_token(token.text)) continue;
    any = true;
    if (!is_aux(lower_copy(token.text))) ++lexical;
  }
  // More than one lexical verb may mean an embedded clause with different scope.
  return any && lexical <= 1;
}

bool range_has_coord(const std::vector<Token>& tokens, int begin, int end) {
  for (int i = begin; i < end; ++i) {
    const Token& token = tokens[static_cast<std::size_t>(i)];
    if (token.word && is_coordinator(lower_copy(token.text))) {
      return true;
    }
  }
  return false;
}

int word_count(const std::vector<Token>& tokens, int begin, int end) {
  int count = 0;
  for (int i = begin; i < end; ++i) {
    if (tokens[static_cast<std::size_t>(i)].word) {
      ++count;
    }
  }
  return count;
}

std::vector<Token> slice_tokens(const std::vector<Token>& tokens, int begin, int end) {
  while (begin < end && is_space_token(tokens[static_cast<std::size_t>(begin)])) {
    ++begin;
  }
  while (end > begin && is_space_token(tokens[static_cast<std::size_t>(end - 1)])) {
    --end;
  }
  if (begin >= end) {
    return {};
  }
  return {tokens.begin() + begin, tokens.begin() + end};
}

void push_space(std::vector<Token>& out) {
  if (out.empty() || is_space_token(out.back())) {
    return;
  }
  out.push_back(Token{" ", false, false, false});
}

void append_slice(std::vector<Token>& out, const std::vector<Token>& slice) {
  if (slice.empty()) {
    return;
  }
  push_space(out);
  out.insert(out.end(), slice.begin(), slice.end());
}

void cap_first(std::vector<Token>& slice) {
  for (Token& token : slice) {
    if (!token.word || token.text.empty()) {
      continue;
    }
    const std::string low = lower_copy(token.text);
    if (low == "i") {
      token.text = is_all_caps_word(token.text) ? "I" : "I";
      return;
    }
    if (is_all_caps_word(token.text)) {
      return;
    }
    if (is_letter(static_cast<unsigned char>(token.text.front()))) {
      token.text.front() = ascii_upper(static_cast<unsigned char>(token.text.front()));
    }
    return;
  }
}

void decap_first(std::vector<Token>& slice) {
  for (Token& token : slice) {
    if (!token.word || token.text.empty()) {
      continue;
    }
    const std::string low = lower_copy(token.text);
    if (token.frozen || low == "i" || is_all_caps_word(token.text) || !is_capitalized_word(token.text)) {
      return;
    }
    const bool ordinary = is_determiner(low) || is_pronoun(low) || is_aux(low) || is_preposition(low) ||
                          is_coordinator(low) || is_subordinator_word(low) || lexicon().has_lemma(low);
    if (!ordinary) {
      return;
    }
    if (is_letter(static_cast<unsigned char>(token.text.front()))) {
      token.text.front() = ascii_lower(static_cast<unsigned char>(token.text.front()));
    }
    return;
  }
}

bool is_manner_adverb(const Token& token) {
  if (token.frozen) return false;
  const std::vector<Analysis> analyses = analyze_word(token.text, "", false);
  for (const Analysis& analysis : analyses) {
    if (analysis.pos == Pos::Adv && analysis.flag == "manner" &&
        (analysis.lemma == "quickly" || analysis.lemma == "rapidly" || analysis.lemma == "swiftly" ||
         analysis.lemma == "carefully" || analysis.lemma == "cautiously" || analysis.lemma == "quietly" ||
         analysis.lemma == "silently" || analysis.lemma == "loudly" || analysis.lemma == "noisily")) {
      return true;
    }
  }
  return false;
}

bool has_adjective(const Token& token) {
  if (token.frozen) {
    return false;
  }
  const std::vector<Analysis> analyses = analyze_word(token.text, "", false);
  for (const Analysis& analysis : analyses) {
    if (analysis.pos == Pos::Adj) {
      return true;
    }
  }
  return false;
}

bool blocked_sentence(const std::vector<Token>& tokens) {
  static const std::unordered_set<std::string_view> scope = {
    "not", "never", "no", "neither", "nor", "only", "just", "hardly", "scarcely", "barely",
    "without", "can", "could", "may", "might", "must", "shall", "should", "will", "would", "cannot",
    "say", "says", "said", "tell", "tells", "told", "know", "knows", "knew", "think", "thinks", "thought",
    "believe", "believes", "believed", "wonder", "wonders", "wondered",
    "very", "too", "so", "quite", "rather", "almost", "nearly", "less", "more", "least", "most", "enough", "especially", "particularly",
    "if", "unless", "whether", "that", "which", "who", "whom", "whose", "where", "why", "how", "while", "to"};
  int subordinators = 0, commas = 0;
  for (const auto& token : tokens) {
    const auto low = lower_copy(token.text);
    if (scope.contains(low) || low.find("n't") != std::string::npos) return true;
    if (low == "because" || low == "although" || low == "though" || low == "when" || low == "before" || low == "after") ++subordinators;
    if (token.text == ",") ++commas;
    const bool numeric = !token.text.empty() && token.text.find_first_not_of("0123456789.") == std::string::npos && token.text.find_first_of("0123456789") != std::string::npos;
    if ((!token.word && token.frozen && !numeric) || token.text.find('\n') != std::string::npos) return true;
    if (!token.word && token.text != "." && token.text != "," && !numeric && !is_space_token(token)) return true;
  }
  // One simple main clause plus, at most, one subordinate clause.
  return subordinators > 1 || commas > 1;
}

struct Subordinator {
  int word_slot = 0;
  int word_count = 1;
  std::string name;
};

std::optional<Subordinator> subordinator_at(const std::vector<Token>& tokens, const std::vector<int>& words, int slot) {
  if (slot < 0 || slot >= static_cast<int>(words.size())) {
    return std::nullopt;
  }
  const std::string first = word_at(tokens, words[static_cast<std::size_t>(slot)]);
  if (first == "even" && slot + 1 < static_cast<int>(words.size()) &&
      word_at(tokens, words[static_cast<std::size_t>(slot + 1)]) == "though") {
    return Subordinator{slot, 2, "even though"};
  }
  if (is_subordinator_word(first)) {
    return Subordinator{slot, 1, first};
  }
  return std::nullopt;
}

std::optional<ArrangeOutcome> finish(std::vector<Token> tokens, std::string before, std::string detail) {
  ArrangeOutcome outcome;
  outcome.change.kind = ChangeKind::Arrangement;
  outcome.change.before = std::move(before);
  outcome.change.after = concat_tokens(tokens);
  outcome.change.detail = std::move(detail);
  outcome.tokens = std::move(tokens);
  if (outcome.change.before == outcome.change.after) {
    return std::nullopt;
  }
  return outcome;
}

std::optional<ArrangeOutcome> try_clause(const std::vector<Token>& tokens, const std::vector<int>& words) {
  if (words.empty()) {
    return std::nullopt;
  }
  const int punct = punct_index(tokens);
  const int limit = punct < 0 ? static_cast<int>(tokens.size()) : punct;
  const std::string before = concat_tokens(tokens);

  if (const auto front = subordinator_at(tokens, words, 0)) {
    int commas = 0;
    int comma_at = -1;
    for (int i = 0; i < limit; ++i) {
      if (clause_comma(tokens, i)) {
        ++commas;
        comma_at = i;
      }
    }
    if (commas != 1) {
      return std::nullopt;
    }
    const int intro_begin = words[static_cast<std::size_t>(front->word_count - 1)] + 1;
    const int main_begin = comma_at + 1;
    if (word_count(tokens, intro_begin, comma_at) < 2 || word_count(tokens, main_begin, limit) < 2) {
      return std::nullopt;
    }
    if (!range_has_verb(tokens, intro_begin, comma_at) || !range_has_verb(tokens, main_begin, limit)) {
      return std::nullopt;
    }
    if (range_has_coord(tokens, intro_begin, comma_at) || range_has_coord(tokens, main_begin, limit)) {
      return std::nullopt;
    }
    std::vector<Token> main = slice_tokens(tokens, main_begin, limit);
    std::vector<Token> intro = slice_tokens(tokens, intro_begin, comma_at);
    cap_first(main);
    decap_first(intro);
    std::vector<Token> sub;
    if (front->word_count == 2) {
      Token even = tokens[static_cast<std::size_t>(words[0])];
      even.text = "even";
      Token though = tokens[static_cast<std::size_t>(words[1])];
      though.text = "though";
      sub.push_back(std::move(even));
      sub.push_back(Token{" ", false, false, false});
      sub.push_back(std::move(though));
    } else {
      Token word = tokens[static_cast<std::size_t>(words[0])];
      word.text = front->name;
      sub.push_back(std::move(word));
    }
    std::vector<Token> rebuilt = std::move(main);
    append_slice(rebuilt, sub);
    append_slice(rebuilt, intro);
    if (punct >= 0) {
      rebuilt.push_back(tokens[static_cast<std::size_t>(punct)]);
    }
    return finish(std::move(rebuilt), before, "Moved a fronted " + front->name + "-clause to the end");
  }

  std::optional<Subordinator> sub;
  int seen = 0;
  for (int slot = 1; slot < static_cast<int>(words.size());) {
    if (const auto found = subordinator_at(tokens, words, slot)) {
      ++seen;
      sub = found;
      slot += found->word_count;
    } else {
      ++slot;
    }
  }
  if (seen != 1 || !sub) {
    return std::nullopt;
  }
  if (sub->name == "though" && sub->word_slot + 1 == static_cast<int>(words.size())) {
    return std::nullopt;
  }
  if (sub->word_slot > 0) {
    const std::string prev = word_at(tokens, words[static_cast<std::size_t>(sub->word_slot - 1)]);
    if (prev == "just" || prev == "only" || (prev == "even" && sub->name == "though")) {
      return std::nullopt;
    }
  }
  const int left_end = words[static_cast<std::size_t>(sub->word_slot)];
  const int right_begin = words[static_cast<std::size_t>(sub->word_slot + sub->word_count - 1)] + 1;
  if (word_count(tokens, 0, left_end) < 2 || word_count(tokens, right_begin, limit) < 2) {
    return std::nullopt;
  }
  if (!range_has_verb(tokens, 0, left_end) || !range_has_verb(tokens, right_begin, limit)) {
    return std::nullopt;
  }
  if (range_has_coord(tokens, 0, left_end) || range_has_coord(tokens, right_begin, limit)) {
    return std::nullopt;
  }
  std::vector<Token> left = slice_tokens(tokens, 0, left_end);
  std::vector<Token> right = slice_tokens(tokens, right_begin, limit);
  while (!left.empty() && (is_space_token(left.back()) || left.back().text == ",")) {
    left.pop_back();
  }
  decap_first(left);
  decap_first(right);
  std::vector<Token> rebuilt;
  if (sub->word_count == 2) {
    rebuilt.push_back(Token{"Even", true, false, false});
    rebuilt.push_back(Token{" ", false, false, false});
    rebuilt.push_back(Token{"though", true, false, false});
  } else {
    std::string name = sub->name;
    if (!name.empty()) {
      name.front() = ascii_upper(static_cast<unsigned char>(name.front()));
    }
    rebuilt.push_back(Token{name, true, false, false});
  }
  append_slice(rebuilt, right);
  rebuilt.push_back(Token{",", false, false, false});
  append_slice(rebuilt, left);
  if (punct >= 0) {
    rebuilt.push_back(tokens[static_cast<std::size_t>(punct)]);
  }
  return finish(std::move(rebuilt), before, "Moved a " + sub->name + "-clause to the front");
}

std::optional<ArrangeOutcome> try_adverb(const std::vector<Token>& tokens, const std::vector<int>& words) {
  int predicates=0;
  for (const auto& token : tokens) if (token.word && looks_like_verb_token(token.text) && !is_aux(lower_copy(token.text))) ++predicates;
  if (predicates>1) return std::nullopt;
  if (words.size() < 3) {
    return std::nullopt;
  }
  const int punct = punct_index(tokens);
  const int limit = punct < 0 ? static_cast<int>(tokens.size()) : punct;
  const std::string before = concat_tokens(tokens);
  const Token& first = tokens[static_cast<std::size_t>(words[0])];
  int after_first = words[0] + 1;
  while (after_first < limit && is_space_token(tokens[static_cast<std::size_t>(after_first)])) {
    ++after_first;
  }
  if (is_manner_adverb(first) && after_first < limit && tokens[static_cast<std::size_t>(after_first)].text == ",") {
    const int rest_begin = after_first + 1;
    if (word_count(tokens, rest_begin, limit) >= 2 && range_has_verb(tokens, rest_begin, limit) &&
        !range_has_coord(tokens, rest_begin, limit)) {
      std::vector<Token> rest = slice_tokens(tokens, rest_begin, limit);
      cap_first(rest);
      Token adverb = first;
      if (!is_all_caps_word(adverb.text)) {
        adverb.text = lower_copy(adverb.text);
      }
      append_slice(rest, std::vector<Token>{adverb});
      if (punct >= 0) {
        rest.push_back(tokens[static_cast<std::size_t>(punct)]);
      }
      return finish(std::move(rest), before, "Moved a fronted manner adverb to the end");
    }
  }

  const int last_slot = static_cast<int>(words.size()) - 1;
  const Token& last = tokens[static_cast<std::size_t>(words[static_cast<std::size_t>(last_slot)])];
  if (!is_manner_adverb(last) || words[static_cast<std::size_t>(last_slot)] >= limit) {
    return std::nullopt;
  }
  const std::string prev = word_at(tokens, words[static_cast<std::size_t>(last_slot - 1)]);
  if (is_coordinator(prev)) {
    return std::nullopt;
  }
  int before_last = words[static_cast<std::size_t>(last_slot)] - 1;
  while (before_last >= 0 && is_space_token(tokens[static_cast<std::size_t>(before_last)])) {
    --before_last;
  }
  if (before_last >= 0 && tokens[static_cast<std::size_t>(before_last)].text == ",") {
    return std::nullopt;
  }
  if (!range_has_verb(tokens, 0, words[static_cast<std::size_t>(last_slot)]) ||
      range_has_coord(tokens, 0, words[static_cast<std::size_t>(last_slot)])) {
    return std::nullopt;
  }
  std::vector<Token> front = slice_tokens(tokens, 0, words[static_cast<std::size_t>(last_slot)]);
  decap_first(front);
  Token adverb = last;
  if (is_all_caps_word(adverb.text)) {
    // Keep the shout.
  } else {
    adverb.text = lower_copy(adverb.text);
    if (!adverb.text.empty()) {
      adverb.text.front() = ascii_upper(static_cast<unsigned char>(adverb.text.front()));
    }
  }
  std::vector<Token> rebuilt;
  rebuilt.push_back(std::move(adverb));
  rebuilt.push_back(Token{",", false, false, false});
  append_slice(rebuilt, front);
  if (punct >= 0) {
    rebuilt.push_back(tokens[static_cast<std::size_t>(punct)]);
  }
  return finish(std::move(rebuilt), before, "Moved a final manner adverb to the front");
}

std::optional<ArrangeOutcome> try_adjectives(const std::vector<Token>& tokens, const std::vector<int>& words) {
  if (words.size() < 3) {
    return std::nullopt;
  }
  for (int slot = 0; slot + 2 < static_cast<int>(words.size()); ++slot) {
    const int left = words[static_cast<std::size_t>(slot)];
    const int mid = words[static_cast<std::size_t>(slot + 1)];
    const int right = words[static_cast<std::size_t>(slot + 2)];
    if (word_at(tokens, mid) != "and") {
      continue;
    }
    if (slot + 3 < static_cast<int>(words.size()) && word_at(tokens, words[static_cast<std::size_t>(slot + 3)]) == "and") {
      continue;
    }
    if (!has_adjective(tokens[static_cast<std::size_t>(left)]) || !has_adjective(tokens[static_cast<std::size_t>(right)])) {
      continue;
    }
    if (slot > 0 && is_known_adverb_word(word_at(tokens, words[static_cast<std::size_t>(slot - 1)]))) continue;
    bool tight = true;
    for (int i = left + 1; i < right; ++i) {
      if (i != mid && !is_space_token(tokens[static_cast<std::size_t>(i)])) tight = false;
    }
    if (!tight) continue;
    std::vector<Token> copy = tokens;
    copy[static_cast<std::size_t>(left)].text = apply_caps(lower_copy(tokens[static_cast<std::size_t>(right)].text), tokens[static_cast<std::size_t>(left)].text);
    copy[static_cast<std::size_t>(right)].text = apply_caps(lower_copy(tokens[static_cast<std::size_t>(left)].text), tokens[static_cast<std::size_t>(right)].text);
    copy[static_cast<std::size_t>(left)].replaced = true;
    copy[static_cast<std::size_t>(right)].replaced = true;
    return finish(std::move(copy), concat_tokens(tokens), "Swapped coordinated adjectives");
  }
  return std::nullopt;
}

}  // namespace

std::optional<ArrangeOutcome> arrange_sentence(const std::vector<Token>& tokens, bool enabled) {
  if (!enabled || blocked_sentence(tokens)) {
    return std::nullopt;
  }
  const std::vector<int> words = word_positions(tokens);
  // Cataphora/anaphora may change when third-person references move across clauses.
  bool subordinate = false, third_person = false;
  for (const auto& token : tokens) {
    const auto w = lower_copy(token.text);
    subordinate = subordinate || is_subordinator_word(w);
    third_person = third_person || w == "he" || w == "she" || w == "it" || w == "they" ||
      w == "him" || w == "her" || w == "his" || w == "them" || w == "their" || w == "its";
  }
  if (subordinate && third_person) return std::nullopt;
  if (auto clause = try_clause(tokens, words)) {
    return clause;
  }
  if (auto adverb = try_adverb(tokens, words)) {
    return adverb;
  }
  return try_adjectives(tokens, words);
}

}  // namespace synomizer
