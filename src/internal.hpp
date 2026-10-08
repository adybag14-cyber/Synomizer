// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#pragma once

#include "synomizer/engine.hpp"

#include <cctype>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>
#include <unordered_map>

namespace synomizer {

enum class Pos { Noun, Verb, Adj, Adv, Other };

struct Features {
  bool plural = false;
  bool third = false;
  bool past = false;
  bool participle = false;
  bool gerund = false;
  bool comparative = false;
  bool superlative = false;
  bool possessive = false;
};

struct Analysis {
  std::string lemma;
  Pos pos = Pos::Other;
  Features features;
  std::string flag;
};

struct Token {
  std::string text;
  bool word = false;
  bool frozen = false;
  bool replaced = false;
};

struct Piece {
  bool sentence = false;
  std::string text;
  std::vector<Token> tokens;
};

[[nodiscard]] inline char ascii_lower(unsigned char c) {
  if (c >= 'A' && c <= 'Z') {
    return static_cast<char>(c - 'A' + 'a');
  }
  return static_cast<char>(c);
}

[[nodiscard]] inline char ascii_upper(unsigned char c) {
  if (c >= 'a' && c <= 'z') {
    return static_cast<char>(c - 'a' + 'A');
  }
  return static_cast<char>(c);
}

[[nodiscard]] inline bool is_letter(unsigned char c) {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

[[nodiscard]] inline std::string lower_copy(std::string_view text) {
  std::string out;
  out.reserve(text.size());
  for (unsigned char c : text) {
    out.push_back(ascii_lower(c));
  }
  return out;
}

[[nodiscard]] inline bool is_all_caps_word(std::string_view text) {
  bool any = false;
  for (unsigned char c : text) {
    if (!is_letter(c)) {
      continue;
    }
    any = true;
    if (c >= 'a' && c <= 'z') {
      return false;
    }
  }
  return any;
}

[[nodiscard]] inline bool is_capitalized_word(std::string_view text) {
  bool first = true;
  bool head = false;
  for (unsigned char c : text) {
    if (!is_letter(c)) {
      if (c == '\'' || c == '-') {
        continue;
      }
      continue;
    }
    if (first) {
      head = c >= 'A' && c <= 'Z';
      first = false;
    }
  }
  return head;
}

[[nodiscard]] inline std::string apply_caps(std::string word, std::string_view original) {
  if (is_all_caps_word(original) && original.size() >= 2) {
    for (char& c : word) {
      c = ascii_upper(static_cast<unsigned char>(c));
    }
    return word;
  }
  if (is_capitalized_word(original) && !word.empty()) {
    for (char& c : word) {
      if (is_letter(static_cast<unsigned char>(c))) {
        c = ascii_upper(static_cast<unsigned char>(c));
        break;
      }
    }
  }
  return word;
}

[[nodiscard]] inline std::string_view pos_name(Pos pos) {
  switch (pos) {
    case Pos::Noun:
      return "noun";
    case Pos::Verb:
      return "verb";
    case Pos::Adj:
      return "adjective";
    case Pos::Adv:
      return "adverb";
    case Pos::Other:
      return "other";
  }
  return "other";
}

class Lexicon {
 public:
  [[nodiscard]] bool has_lemma(std::string_view lemma) const;
  [[nodiscard]] bool has(std::string_view lemma, Pos pos) const;
  [[nodiscard]] std::optional<Analysis> find(std::string_view lemma, Pos pos) const;
  [[nodiscard]] std::vector<Analysis> entries_for(std::string_view lemma) const;
  [[nodiscard]] const std::vector<std::vector<std::string>>& phrases() const;
  [[nodiscard]] const std::vector<std::vector<std::string>>& phrases_starting(std::string_view first, bool allow_variation) const;
  struct PhraseRule { std::string mode; std::vector<std::string> forms; };
  std::vector<PhraseRule> phrase_rules;
  struct ClarityRule { std::vector<std::string> source; std::string target, guard; };
  std::vector<ClarityRule> clarity_rules;
  struct AcademicRule { std::string mode; std::vector<std::string> forms; int minimum_intensity = 1; };
  std::vector<AcademicRule> academic_rules;

  void add(Analysis entry, std::vector<std::string> synonyms);
  void add_phrase(std::vector<std::string> phrase);
  [[nodiscard]] const std::vector<std::string>* synonyms(std::string_view lemma, Pos pos) const;

 private:
  struct Row {
    Analysis analysis;
    std::vector<std::string> synonyms;
  };
  std::vector<Row> rows_;
  std::unordered_map<std::string, std::vector<std::size_t>> by_lemma_;
  std::vector<std::vector<std::string>> phrases_;
  std::unordered_map<std::string, std::vector<std::vector<std::string>>> phrases_by_first_, fixed_phrases_by_first_;
};

[[nodiscard]] const Lexicon& lexicon();

[[nodiscard]] std::vector<Analysis> analyze_word(std::string_view surface, std::string_view previous,
                                                  bool participle_context);

[[nodiscard]] std::optional<std::string> inflect(std::string_view lemma, Pos pos, const Features& features);

[[nodiscard]] bool is_determiner(std::string_view word);
[[nodiscard]] bool is_pronoun(std::string_view word);
[[nodiscard]] bool is_subject_pronoun(std::string_view word);
[[nodiscard]] bool is_object_pronoun(std::string_view word);
[[nodiscard]] bool is_aux(std::string_view word);
[[nodiscard]] bool is_preposition(std::string_view word);
[[nodiscard]] bool is_coordinator(std::string_view word);
[[nodiscard]] bool is_subordinator_word(std::string_view word);
[[nodiscard]] bool is_particle(std::string_view word);
[[nodiscard]] bool is_known_adverb_word(std::string_view word);
[[nodiscard]] bool is_negation(std::string_view word);
[[nodiscard]] bool looks_like_verb_token(std::string_view word);
[[nodiscard]] bool needs_an(std::string_view word);

[[nodiscard]] std::vector<Piece> split_pieces(std::string_view input);

struct ArrangeOutcome {
  std::vector<Token> tokens;
  Change change;
};

[[nodiscard]] std::optional<ArrangeOutcome> arrange_sentence(const std::vector<Token>& tokens, bool enabled, bool extended = false, std::uint64_t seed = 1);
[[nodiscard]] std::optional<ArrangeOutcome> standard_structure(const std::vector<Token>& tokens);
void vary_phrases(std::vector<Token>& tokens, const Options& options, std::vector<Change>& changes);
void protect_remaining_phrases(std::vector<Token>& tokens);
void academic_phrases(std::vector<Token>& tokens, const Options& options, std::vector<Change>& changes);
[[nodiscard]] std::optional<ArrangeOutcome> academic_arrangement(const std::vector<Token>& tokens, const Options& options);

[[nodiscard]] bool freeze_terms(std::vector<Token>& tokens, const std::vector<std::string>& terms);

void freeze_tokens(std::vector<Token>& tokens, bool protect_quotes, bool phrase_variation = false, bool clarity = false);

struct SubstituteOutcome {
  std::vector<Token> tokens;
  std::vector<Change> changes;
  std::uint64_t next_ordinal = 0;
};

[[nodiscard]] SubstituteOutcome substitute(std::vector<Token> tokens, const Options& options,
                                           std::uint64_t ordinal);

[[nodiscard]] std::vector<Change> rephrase(std::vector<Token>& tokens,
    const Options& options, std::uint64_t ordinal);
[[nodiscard]] Result rewrite_standard(std::string_view input, const Options& options);
[[nodiscard]] std::string sha256_text(std::string_view text);
[[nodiscard]] std::vector<std::string> source_anchors(std::string_view text);
void assess_conformity(std::string_view source, const Options& options, Result& result);
void fix_articles(std::vector<Token>& tokens, std::vector<Change>& changes);

[[nodiscard]] std::string concat_tokens(const std::vector<Token>& tokens);

}  // namespace synomizer
