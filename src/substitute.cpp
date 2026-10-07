// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#include "internal.hpp"

#include <algorithm>
#include <ranges>
#include <unordered_set>

namespace synomizer {
namespace {

std::uint64_t fnv1a(std::string_view text) {
  std::uint64_t hash = 14695981039346656037ull;
  for (unsigned char c : text) {
    hash ^= c;
    hash *= 1099511628211ull;
  }
  return hash;
}

std::uint64_t mix64(std::uint64_t value) {
  value += 0x9e3779b97f4a7c15ull;
  value = (value ^ (value >> 30)) * 0xbf58476d1ce4e5b9ull;
  value = (value ^ (value >> 27)) * 0x94d049bb133111ebull;
  return value ^ (value >> 31);
}

bool is_space_token(const Token& token) {
  return !token.word && !token.text.empty() && token.text.find_first_not_of(" \t\r\n") == std::string::npos;
}

std::vector<int> word_positions(const std::vector<Token>& tokens) {
  std::vector<int> indexes;
  indexes.reserve(tokens.size());
  for (int i = 0; i < static_cast<int>(tokens.size()); ++i) {
    if (tokens[static_cast<std::size_t>(i)].word) {
      indexes.push_back(i);
    }
  }
  return indexes;
}

std::string at_slot(const std::vector<Token>& tokens, const std::vector<int>& words, int slot) {
  if (slot < 0 || slot >= static_cast<int>(words.size())) {
    return {};
  }
  return lower_copy(tokens[static_cast<std::size_t>(words[static_cast<std::size_t>(slot)])].text);
}

bool participle_cue(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {
      "have", "has", "had", "having", "been", "being", "am", "is", "are", "was", "were", "get", "gets", "got", "gotten"};
  return words.contains(word);
}

bool be_form(std::string_view word) {
  return word == "am" || word == "is" || word == "are" || word == "was" || word == "were" || word == "be" ||
         word == "been" || word == "being";
}

bool known_noun(std::string_view word) {
  const std::vector<Analysis> analyses = analyze_word(word, "", false);
  for (const Analysis& analysis : analyses) {
    if (analysis.pos == Pos::Noun) {
      return true;
    }
  }
  return false;
}

bool known_adjective(std::string_view word) {
  const std::vector<Analysis> analyses = analyze_word(word, "", false);
  for (const Analysis& analysis : analyses) {
    if (analysis.pos == Pos::Adj) {
      return true;
    }
  }
  return false;
}

bool intensity_allows(int intensity, Pos pos, std::string_view flag) {
  if (flag == "careful") {
    return intensity >= 2;
  }
  if (intensity <= 0) {
    if (pos == Pos::Adj && (flag == "free" || flag == "time" || flag == "quant")) {
      return true;
    }
    return pos == Pos::Adv && flag == "manner";
  }
  return true;
}

const std::unordered_set<std::string_view>& time_nouns() {
  static const std::unordered_set<std::string_view> words = {
      "visit", "meeting", "pause", "delay", "period", "stay", "trip", "journey", "summary", "statement", "reply",
      "answer", "introduction", "look", "break", "rest", "moment", "instant", "while", "description", "account",
      "talk", "speech", "lecture", "conversation", "call", "tour", "flight", "walk", "discussion", "explanation",
      "version", "overview", "review", "report", "message", "letter", "film", "movie", "story", "chapter",
      "interval", "chat", "spell", "note"};
  return words;
}

const std::unordered_set<std::string_view>& event_nouns() {
  static const std::unordered_set<std::string_view> words = {
      "meeting", "show", "process", "work", "journey", "trip", "discussion", "class", "game", "story", "day", "war",
      "project", "session", "event", "operation", "trial", "experiment", "lecture", "movie", "film", "match",
      "season", "ceremony", "party", "interview", "negotiation", "debate", "search", "investigation", "construction",
      "production", "course", "lesson", "practice", "training", "attack", "battle", "conflict", "task", "assignment",
      "activity", "exercise", "report", "letter", "chapter", "song", "piece", "job", "plan", "question", "problem",
      "answer", "account", "article", "essay", "message", "book", "review", "summary", "introduction", "conclusion",
      "agreement", "argument", "fight", "accident", "injury", "method", "procedure", "conversation", "program",
      "tour", "flight", "visit", "walk", "talk", "speech", "sale", "service"};
  return words;
}

bool time_context(const std::vector<Token>& tokens, const std::vector<int>& words, int slot) {
  for (int step = 1; step <= 4; ++step) {
    const std::string word = at_slot(tokens, words, slot + step);
    if (word.empty() || is_determiner(word) || is_known_adverb_word(word) || known_adjective(word)) {
      if (time_nouns().contains(word)) {
        return true;
      }
      continue;
    }
    return time_nouns().contains(word);
  }
  for (int step = 1; step <= 4; ++step) {
    const std::string word = at_slot(tokens, words, slot - step);
    if (time_nouns().contains(word)) {
      return true;
    }
  }
  return false;
}

int np_end_slot(const std::vector<Token>& tokens, const std::vector<int>& words, int slot) {
  if (slot < 0 || slot >= static_cast<int>(words.size())) {
    return slot;
  }
  int cursor = slot;
  if (is_determiner(at_slot(tokens, words, cursor)) || is_object_pronoun(at_slot(tokens, words, cursor))) {
    ++cursor;
  }
  while (cursor < static_cast<int>(words.size()) &&
         (known_adjective(at_slot(tokens, words, cursor)) || is_known_adverb_word(at_slot(tokens, words, cursor)))) {
    ++cursor;
  }
  if (cursor < static_cast<int>(words.size())) {
    ++cursor;
  }
  return cursor;
}

bool second_np_follows(const std::vector<Token>& tokens, const std::vector<int>& words, int slot) {
  const std::string next = at_slot(tokens, words, slot + 1);
  if (next.empty()) {
    return false;
  }
  if (is_object_pronoun(next)) {
    const std::string after = at_slot(tokens, words, slot + 2);
    return is_determiner(after) || known_noun(after) || known_adjective(after);
  }
  if (!is_determiner(next) && !known_noun(next)) {
    return false;
  }
  const int after_np = np_end_slot(tokens, words, slot + 1);
  const std::string following = at_slot(tokens, words, after_np);
  if (following.empty() || is_preposition(following) || is_known_adverb_word(following)) {
    return false;
  }
  return is_determiner(following) || is_object_pronoun(following) || known_noun(following);
}

bool bare_verb_after_np(const std::vector<Token>& tokens, const std::vector<int>& words, int slot) {
  const std::string next = at_slot(tokens, words, slot + 1);
  if (!(is_determiner(next) || is_object_pronoun(next) || known_noun(next))) {
    return false;
  }
  const int after_np = np_end_slot(tokens, words, slot + 1);
  const int token_index = after_np >= 0 && after_np < static_cast<int>(words.size())
                              ? words[static_cast<std::size_t>(after_np)]
                              : -1;
  if (token_index < 0) {
    return false;
  }
  return looks_like_verb_token(tokens[static_cast<std::size_t>(token_index)].text);
}

bool event_frame(const std::vector<Token>& tokens, const std::vector<int>& words, int slot) {
  const std::string next = at_slot(tokens, words, slot + 1);
  if (next.empty() || is_preposition(next) || next == "to" || is_known_adverb_word(next)) {
    return true;
  }
  if (next.ends_with("ing") && looks_like_verb_token(next)) {
    return true;
  }
  int cursor = slot + 1;
  if (is_determiner(at_slot(tokens, words, cursor))) {
    ++cursor;
  }
  while (cursor < static_cast<int>(words.size()) &&
         (known_adjective(at_slot(tokens, words, cursor)) || is_known_adverb_word(at_slot(tokens, words, cursor)))) {
    ++cursor;
  }
  const std::string head = at_slot(tokens, words, cursor);
  if (head.empty()) {
    return true;
  }
  return event_nouns().contains(head);
}

bool verb_frame(const Analysis& analysis, const std::vector<Token>& tokens, const std::vector<int>& words, int slot,
                const std::string& prev) {
  const std::string& lemma = analysis.lemma;
  const bool inflected = analysis.features.past || analysis.features.participle || analysis.features.gerund ||
                         analysis.features.third;
  if (!inflected) {
    const bool clear_subject = is_aux(prev) || is_pronoun(prev) || is_negation(prev) || is_known_adverb_word(prev);
    const bool noun_subject = known_noun(prev) && !known_noun(at_slot(tokens, words, slot + 1));
    if (!clear_subject && !noun_subject) {
      return false;
    }
  }
  const std::string next = at_slot(tokens, words, slot + 1);
  if (is_particle(next)) {
    return false;
  }
  // Complement-taking verbs cannot always share a frame with their synonyms.
  if ((lemma == "remember" || lemma == "recall") && next == "to") return false;
  if (lemma == "find" || lemma == "locate") {
    const int after = (next == "it" || is_object_pronoun(next)) ? slot+2 : np_end_slot(tokens, words, slot+1);
    const auto complement=at_slot(tokens,words,after);
    if (known_adjective(complement) || is_aux(complement) || looks_like_verb_token(complement)) return false;
  }
  if (second_np_follows(tokens, words, slot)) {
    return false;
  }
  if ((lemma == "help" || lemma == "assist" || lemma == "aid") && bare_verb_after_np(tokens, words, slot)) {
    return false;
  }
  if ((lemma == "happen" || lemma == "occur") && next == "to") {
    return false;
  }
  if ((lemma == "remain" || lemma == "stay") && (is_determiner(next) || known_noun(next))) {
    return false;
  }
  if (lemma == "start" || lemma == "begin" || lemma == "commence" || lemma == "end" || lemma == "conclude") {
    return event_frame(tokens, words, slot);
  }
  return true;
}

bool hard_keep(const Analysis& analysis, const std::string& prev) {
  const bool after_det = is_determiner(prev);
  const bool after_aux = is_aux(prev);
  const bool after_be = be_form(prev);
  const bool after_subject = is_subject_pronoun(prev);
  if (after_det && analysis.pos == Pos::Verb) {
    return false;
  }
  if (after_aux && !after_be && analysis.pos != Pos::Verb) {
    return false;
  }
  if (after_subject && !after_be && (analysis.pos == Pos::Adj || analysis.pos == Pos::Noun)) {
    return false;
  }
  return true;
}

int score_analysis(const Analysis& analysis, const std::string& prev, const std::string& next) {
  int score = 0;
  const bool after_det = is_determiner(prev);
  const bool after_be = be_form(prev);
  const bool after_subject = is_subject_pronoun(prev);
  const bool after_prep = is_preposition(prev);
  switch (analysis.pos) {
    case Pos::Noun:
      if (after_det) {
        score += 4;
      }
      if (after_prep) {
        score += 2;
      }
      if (after_subject) {
        score -= 3;
      }
      break;
    case Pos::Verb:
      if (is_aux(prev) || is_negation(prev)) {
        score += 5;
      }
      if (after_subject || is_pronoun(prev)) {
        score += 3;
      }
      if (analysis.features.past || analysis.features.participle || analysis.features.third ||
          analysis.features.gerund) {
        score += 2;
      }
      if (after_det) {
        score -= 6;
      }
      break;
    case Pos::Adj:
      if (after_det) {
        score += 3;
      }
      if (after_be) {
        score += 4;
      }
      if (is_known_adverb_word(prev)) {
        score += 2;
      }
      if (analysis.features.comparative || analysis.features.superlative) {
        score += 2;
      }
      if (known_noun(next) || is_determiner(next)) {
        score += 1;
      }
      if (after_subject) {
        score -= 3;
      }
      break;
    case Pos::Adv:
      if (analysis.lemma.ends_with("ly")) {
        score += 3;
      }
      if (after_det) {
        score -= 2;
      }
      break;
    case Pos::Other:
      break;
  }
  return score;
}

std::string with_possessive(std::string word, bool possessive) {
  if (!possessive || word.empty()) {
    return word;
  }
  if (word.ends_with('s')) {
    word.push_back('\'');
  } else {
    word += "'s";
  }
  return word;
}

void freeze_quotes(std::vector<Token>& tokens) {
  std::vector<std::string> stack;
  for (std::size_t i=0;i<tokens.size();++i) {
    const bool inside=!stack.empty();
    update_quotes(stack,tokens[i].text,i ? std::string_view(tokens[i-1].text) : std::string_view{});
    if (inside || !stack.empty()) tokens[i].frozen=true;
  }
}

void freeze_phrases(std::vector<Token>& tokens) {
  const std::vector<int> words = word_positions(tokens);
  static const auto phrases = [] {
    auto list = lexicon().phrases();
    std::ranges::sort(list, [](const auto& a, const auto& b) { return a.size() > b.size(); });
    return list;
  }();
  std::vector<bool> used(words.size(), false);
  for (int slot = 0; slot < static_cast<int>(words.size()); ++slot) {
    if (used[static_cast<std::size_t>(slot)]) {
      continue;
    }
    for (const std::vector<std::string>& phrase : phrases) {
      if (slot + static_cast<int>(phrase.size()) > static_cast<int>(words.size())) {
        continue;
      }
      bool match = true;
      for (int k = 0; k < static_cast<int>(phrase.size()); ++k) {
        if (at_slot(tokens, words, slot + k) != phrase[static_cast<std::size_t>(k)]) {
          match = false;
          break;
        }
      }
      if (!match) {
        continue;
      }
      const int first = words[static_cast<std::size_t>(slot)];
      const int last = words[static_cast<std::size_t>(slot + static_cast<int>(phrase.size()) - 1)];
      bool tight = true;
      for (int i = first; i <= last; ++i) {
        const Token& token = tokens[static_cast<std::size_t>(i)];
        if (!token.word && !is_space_token(token)) {
          tight = false;
          break;
        }
      }
      if (!tight) {
        continue;
      }
      for (int k = 0; k < static_cast<int>(phrase.size()); ++k) {
        used[static_cast<std::size_t>(slot + k)] = true;
        tokens[static_cast<std::size_t>(words[static_cast<std::size_t>(slot + k)])].frozen = true;
      }
      break;
    }
  }
}

void freeze_names(std::vector<Token>& tokens) {
  int words = 0;
  int capitals = 0;
  for (const Token& token : tokens) {
    if (!token.word) {
      continue;
    }
    ++words;
    if (is_capitalized_word(token.text)) {
      ++capitals;
    }
  }
  const bool heading = words >= 2 && capitals == words;
  bool first_word = true;
  for (Token& token : tokens) {
    if (!token.word) {
      continue;
    }
    const bool sentence_start = first_word;
    first_word = false;
    if (token.frozen) {
      continue;
    }
    const std::string low = lower_copy(token.text);
    if (heading || (sentence_start && is_capitalized_word(token.text) && known_noun(low))) {
      token.frozen=true; continue;
    }
    int letters = 0;
    bool digit = false;
    bool high = false;
    for (unsigned char c : token.text) {
      if (is_letter(c)) {
        ++letters;
      } else if (c >= '0' && c <= '9') {
        digit = true;
      } else if (c >= 128) {
        high = true;
      }
    }
    if (high || digit) {
      token.frozen = true;
      continue;
    }
    if (letters == 1 && low != "a" && low != "i") {
      token.frozen = true;
      continue;
    }
    if (is_all_caps_word(token.text) && letters >= 2) {
      token.frozen = true;
      continue;
    }
    if (!heading && !sentence_start && is_capitalized_word(token.text) && !is_all_caps_word(token.text)) {
      token.frozen = true;
    }
  }
}

}  // namespace

void freeze_tokens(std::vector<Token>& tokens, bool protect_quotes) {
  if (protect_quotes) {
    freeze_quotes(tokens);
  }
  freeze_phrases(tokens);
  freeze_names(tokens);
}

SubstituteOutcome substitute(std::vector<Token> tokens, const Options& options, std::uint64_t ordinal) {
  SubstituteOutcome outcome;
  outcome.tokens = std::move(tokens);
  outcome.next_ordinal = ordinal;
  if (!options.synonyms) {
    const std::vector<int> words = word_positions(outcome.tokens);
    outcome.next_ordinal = ordinal + static_cast<std::uint64_t>(words.size());
    return outcome;
  }

  const std::vector<int> words = word_positions(outcome.tokens);
  for (int slot = 0; slot < static_cast<int>(words.size()); ++slot) {
    const std::uint64_t word_ordinal = ordinal + static_cast<std::uint64_t>(slot);
    Token& token = outcome.tokens[static_cast<std::size_t>(words[static_cast<std::size_t>(slot)])];
    if (token.frozen) {
      continue;
    }
    const std::string prev = at_slot(outcome.tokens, words, slot - 1);
    const std::string next = at_slot(outcome.tokens, words, slot + 1);
    const bool participle = participle_cue(prev);
    std::vector<Analysis> analyses = analyze_word(token.text, prev, participle);
    bool has_noun = false;
    bool has_verb = false;
    for (const Analysis& analysis : analyses) {
      has_noun = has_noun || analysis.pos == Pos::Noun;
      has_verb = has_verb || analysis.pos == Pos::Verb;
    }
    if (has_noun && has_verb && is_object_pronoun(prev)) {
      continue;
    }
    if (has_noun && analyses.size() == 1 && analyses.front().lemma == "person" && analyses.front().features.plural &&
        (prev == "a" || prev == "an" || prev == "this" || prev == "one" || prev == "each" || prev == "every")) {
      continue;
    }

    std::vector<Analysis> kept;
    int best = 0;
    bool tied = false;
    const Analysis* winner = nullptr;
    for (const Analysis& analysis : analyses) {
      if (!intensity_allows(options.intensity, analysis.pos, analysis.flag) || !hard_keep(analysis, prev)) {
        continue;
      }
      const int score = score_analysis(analysis, prev, next);
      if (winner == nullptr || score > best) {
        winner = &analysis;
        best = score;
        tied = false;
        kept.clear();
        kept.push_back(analysis);
      } else if (score == best) {
        tied = true;
        kept.push_back(analysis);
      }
    }
    if (winner == nullptr || tied) {
      continue;
    }
    const Analysis chosen = kept.front();
    if (chosen.pos == Pos::Adj && next == "to" &&
        (chosen.lemma == "likely" || chosen.lemma == "unlikely" || chosen.lemma == "probable" ||
         chosen.lemma == "improbable" || chosen.lemma == "eager" || chosen.lemma == "enthusiastic")) continue;
    if (chosen.flag == "quant") {
      static const std::unordered_set<std::string_view> blocked = {"how", "too", "so", "as", "this", "that", "very"};
      if (next == "of" || next == "more" || blocked.contains(prev)) {
        continue;
      }
    }
    if (chosen.flag == "time" && !time_context(outcome.tokens, words, slot)) {
      continue;
    }
    if (chosen.flag == "mass" && chosen.features.plural) {
      continue;
    }
    if (chosen.pos == Pos::Verb && !verb_frame(chosen, outcome.tokens, words, slot, prev)) {
      continue;
    }
    // "ran fast" is adverbial. "remained calm" is a real adjective and can change.
    if (chosen.pos == Pos::Adj && !chosen.features.comparative && !chosen.features.superlative && !is_aux(prev) &&
        (chosen.lemma == "fast" || chosen.lemma == "quick" || chosen.lemma == "rapid" || chosen.lemma == "swift" ||
         chosen.lemma == "slow" || chosen.lemma == "unhurried") &&
        looks_like_verb_token(prev) && (next.empty() || is_coordinator(next) || is_preposition(next))) {
      continue;
    }
    const std::vector<std::string>* synonyms = lexicon().synonyms(chosen.lemma, chosen.pos);
    if (synonyms == nullptr || synonyms->empty()) {
      continue;
    }
    std::vector<std::string> usable;
    for (const std::string& synonym : *synonyms) {
      // Predicative-only adjectives do not belong before a noun ("an afraid child").
      if (chosen.pos == Pos::Adj && (is_determiner(prev) || known_noun(next)) &&
          (synonym == "afraid" || synonym == "aware" || synonym == "unwell")) continue;
      if (const std::optional<std::string> inflected = inflect(synonym, chosen.pos, chosen.features)) {
        usable.push_back(*inflected);
      }
    }
    if (usable.empty()) {
      continue;
    }
    const std::uint64_t mixed =
        mix64(options.seed ^ ((word_ordinal + 1) * 0xD1B54A32D192ED03ull) ^ fnv1a(chosen.lemma));
    const std::string& picked = usable[static_cast<std::size_t>(mixed % usable.size())];
    std::string surface = apply_caps(with_possessive(picked, chosen.features.possessive), token.text);
    if (lower_copy(surface) == lower_copy(token.text)) {
      continue;
    }
    Change change;
    change.kind = ChangeKind::Synonym;
    change.before = token.text;
    change.after = surface;
    change.detail = std::string(pos_name(chosen.pos));
    outcome.changes.push_back(std::move(change));
    token.text = std::move(surface);
    token.replaced = true;
  }
  outcome.next_ordinal = ordinal + static_cast<std::uint64_t>(words.size());
  return outcome;
}

void fix_articles(std::vector<Token>& tokens, std::vector<Change>& changes) {
  const std::vector<int> words = word_positions(tokens);
  for (int slot = 0; slot < static_cast<int>(words.size()); ++slot) {
    Token& article = tokens[static_cast<std::size_t>(words[static_cast<std::size_t>(slot)])];
    const std::string low = lower_copy(article.text);
    if (article.frozen || (low != "a" && low != "an")) {
      continue;
    }
    if (slot + 1 >= static_cast<int>(words.size())) {
      continue;
    }
    Token& next = tokens[static_cast<std::size_t>(words[static_cast<std::size_t>(slot + 1)])];
    bool adjacent = true;
    for (int j=words[static_cast<std::size_t>(slot)]+1; j<words[static_cast<std::size_t>(slot+1)]; ++j)
      if (!is_space_token(tokens[static_cast<std::size_t>(j)])) adjacent=false;
    if (!adjacent || next.frozen) continue;
    if (!next.replaced && !article.replaced) {
      continue;
    }
    const bool an = needs_an(next.text);
    const std::string want = an ? "an" : "a";
    if (low == want) {
      continue;
    }
    const std::string updated = apply_caps(want, article.text);
    Change change;
    change.kind = ChangeKind::Article;
    change.before = article.text;
    change.after = updated;
    change.detail = "article";
    changes.push_back(std::move(change));
    article.text = updated;
    article.replaced = true;
  }
}

}  // namespace synomizer
