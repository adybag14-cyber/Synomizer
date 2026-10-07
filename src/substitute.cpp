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
  return !token.word && !token.text.empty() && token.text.find_first_not_of(" \t\n") == std::string::npos;
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
    if (pos == Pos::Adj && (flag == "free" || flag == "time" || flag == "quant" || flag.starts_with("head:"))) {
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
  if ((lemma == "suggest" || lemma == "propose") && next == "to") return false;
  if ((lemma == "try" || lemma == "attempt") && next != "to" &&
      !(next.ends_with("ing") && looks_like_verb_token(next))) return false;
  if (lemma == "decline" && (next.empty() || is_preposition(next) || is_known_adverb_word(next)) && next != "to") return false;
  if (lemma == "recall" && (next == "that" || next == "the" || next == "a")) {
    static const std::unordered_set<std::string_view> recalled_objects = {"car", "cars", "vehicle", "vehicles", "product", "products", "drug", "drugs", "medicine", "medicines"};
    const int end = np_end_slot(tokens, words, slot + 1);
    if (recalled_objects.contains(at_slot(tokens, words, end - 1))) return false;
  }
  if (lemma == "help" || lemma == "assist" || lemma == "aid") {
    if (next == "to") return false;
    if (!next.empty() && !is_preposition(next)) {
      const int end = is_object_pronoun(next) || next == "it" ? slot + 2 : np_end_slot(tokens, words, slot + 1);
      const auto following = at_slot(tokens, words, end);
      if (!following.empty() && following != "with" && following != "in" && !is_coordinator(following)) return false;
    }
  }
  if (analysis.flag == "event") {
    if (next.empty()) return analysis.features.participle && be_form(prev);
    if (is_preposition(next) || is_aux(next) || next == "that") return false;
    return event_frame(tokens, words, slot);
  }
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


bool context_allows(const Analysis& chosen, const std::vector<Token>& tokens, const std::vector<int>& words, int slot) {
  const auto prev = at_slot(tokens, words, slot-1);
  const auto next = at_slot(tokens, words, slot+1);
  auto head_after = [&]() {
    for (int k=slot+1; k < static_cast<int>(words.size()) && k <= slot+5; ++k) {
      // Do not infer grammatical context across punctuation or opaque spans.
      if (words[static_cast<std::size_t>(k)] != words[static_cast<std::size_t>(k-1)]+2 ||
          !is_space_token(tokens[static_cast<std::size_t>(words[static_cast<std::size_t>(k)]-1)])) return std::string{};
      const auto w=at_slot(tokens,words,k);
      if (k == slot+1 && chosen.pos == Pos::Verb && is_determiner(w)) continue;
      if (known_adjective(w) || is_known_adverb_word(w)) continue;
      return w;
    }
    return std::string{};
  };
  const auto head = head_after();
  if (chosen.flag.starts_with("head:") || chosen.flag.starts_with("object:")) {
    const auto allowed = std::string("|") + chosen.flag.substr(chosen.flag.find(':')+1) + '|';
    if (head.empty() || allowed.find("|"+head+"|") == std::string::npos) return false;
  }
  const auto& lemma = chosen.lemma;
  if (chosen.pos == Pos::Adj) {
    if (is_determiner(next)) return false; // 'Please complete the task' is not adjectival.
    if (lemma == "chief" && !known_noun(next)) return false;
    if (lemma == "cold" && (prev == "a" || prev == "the") && !known_noun(next)) return false;
    if (lemma == "little" && (next.empty() || next == "of" || next == "more" || next == "less")) return false;
  }
  if (chosen.pos == Pos::Noun) {
    if ((lemma == "objective" || lemma == "individual") && known_noun(next)) return false;
    if (lemma == "doctor" && (next == "of" || head == "philosophy")) return false;
    if (lemma == "pupil") for (int k=std::max(0,slot-3); k<std::min(static_cast<int>(words.size()),slot+4); ++k) {
      const auto w=at_slot(tokens,words,k);
      if (w == "eye" || w == "eyes" || w == "dilated" || w == "dilation" || w == "iris" || w == "retina") return false;
    }
  }
  if (chosen.pos == Pos::Verb) {
    std::string cue=prev;
    for (int k=slot-2; k>=0 && k>=slot-5 && (is_known_adverb_word(cue) || is_negation(cue)); --k) cue=at_slot(tokens,words,k);
    if (lemma=="show" && chosen.features.participle && be_form(cue)) return false;
    if ((lemma == "help" || lemma == "assist" || lemma == "aid") && next == "to") return false;
    if ((lemma == "find" || lemma == "locate") && (next == "that" || next == "whether" || next == "why" || next == "how")) return false;
    if ((lemma == "decline" || lemma == "refuse") && head.empty() && next != "to") return false;
    if (lemma == "eat" || lemma == "consume") {
      static const std::unordered_set<std::string_view> food = {"food","meal","meals","breakfast","lunch","dinner","cake","sandwich","bread","pizza","apple","apples","rice","snack","snacks","fish","beef","fruit","vegetables","soup"};
      if (!food.contains(head)) return false;
    }
    if (lemma == "recall" && (head == "product" || head == "products" || head == "vehicles" || head == "drug" || head == "drugs")) return false;
  }
  return true;
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
  for (auto& token : tokens) {
    const auto& t = token.text;
    if (t == "\"" || t == "'" || t == "\xE2\x80\x98" || t == "\xE2\x80\x99" || t == "\xE2\x80\x9C" || t == "\xE2\x80\x9D") {
      if (!stack.empty() && stack.back() == t) stack.pop_back();
      else if (t != "\xE2\x80\x99" && t != "\xE2\x80\x9D") {
        stack.push_back(t == "\xE2\x80\x98" ? "\xE2\x80\x99" : t == "\xE2\x80\x9C" ? "\xE2\x80\x9D" : t);
      }
      token.frozen = true;
    } else if (!stack.empty()) token.frozen = true;
  }
}

void freeze_phrases(std::vector<Token>& tokens, bool variation) {
  const std::vector<int> words = word_positions(tokens);
  std::vector<bool> used(words.size(), false);
  for (int slot = 0; slot < static_cast<int>(words.size()); ++slot) {
    if (used[static_cast<std::size_t>(slot)]) {
      continue;
    }
    for (const auto& phrase : lexicon().phrases_starting(at_slot(tokens, words, slot), variation)) {
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
    static const std::unordered_set<std::string_view> names = {"joy", "king", "swift", "hope", "bill", "will", "may", "rose", "grace", "faith", "summer", "chase", "grant"};
    if (heading || (is_capitalized_word(token.text) && names.contains(low))) { token.frozen = true; continue; }
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

bool freeze_terms(std::vector<Token>& tokens, const std::vector<std::string>& terms) {
  const auto text = lower_copy(concat_tokens(tokens));
  auto word_byte = [](unsigned char c) { return is_letter(c) || (c >= '0' && c <= '9') || c >= 128 || c == '_' || c == '-' || c == '\''; };
  bool matched = false;
  for (const auto& raw : terms) {
    auto term = lower_copy(raw);
    const auto begin = term.find_first_not_of(" \t\n\r");
    if (begin == std::string::npos) continue;
    term = term.substr(begin, term.find_last_not_of(" \t\n\r") - begin + 1);
    for (std::size_t pos = text.find(term); pos != std::string::npos; pos = text.find(term, pos + term.size())) {
      const auto end = pos + term.size();
      if ((pos && word_byte(static_cast<unsigned char>(text[pos-1]))) ||
          (end < text.size() && word_byte(static_cast<unsigned char>(text[end])))) continue;
      matched = true;
      std::size_t offset = 0;
      for (auto& token : tokens) {
        if (offset < end && offset + token.text.size() > pos) token.frozen = true;
        offset += token.text.size();
      }
    }
  }
  return matched;
}

void protect_remaining_phrases(std::vector<Token>& tokens) { freeze_phrases(tokens, false); }

void freeze_tokens(std::vector<Token>& tokens, bool protect_quotes, bool phrase_variation) {
  if (protect_quotes) {
    freeze_quotes(tokens);
  }
  freeze_phrases(tokens, phrase_variation);
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

  const std::vector<Token> context = outcome.tokens;
  const std::vector<int> words = word_positions(outcome.tokens);
  for (int slot = 0; slot < static_cast<int>(words.size()); ++slot) {
    const std::uint64_t word_ordinal = ordinal + static_cast<std::uint64_t>(slot);
    Token& token = outcome.tokens[static_cast<std::size_t>(words[static_cast<std::size_t>(slot)])];
    if (token.frozen) {
      continue;
    }
    const std::string prev = at_slot(context, words, slot - 1);
    const std::string next = at_slot(context, words, slot + 1);
    std::string cue = prev;
    for (int k = slot - 2; k >= 0 && k >= slot - 5 && (is_known_adverb_word(cue) || cue == "not" || cue == "never"); --k) cue = at_slot(context, words, k);
    const bool participle = participle_cue(cue);
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
    Analysis chosen = kept.front();
    if (chosen.pos == Pos::Noun && chosen.lemma == "aircraft") {
      static const std::unordered_set<std::string_view> plurals = {"many", "several", "multiple", "these", "those", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "both", "all", "numerous"};
      static const std::unordered_set<std::string_view> singulars = {"a", "an", "one", "this", "that", "each", "every"};
      auto number_cue = prev;
      for (int k = slot-2; k >= 0 && k >= slot-5 && !plurals.contains(number_cue) &&
          (known_adjective(number_cue) || is_known_adverb_word(number_cue)); --k) number_cue = at_slot(context, words, k);
      const bool digits = !number_cue.empty() && number_cue.find_first_not_of("0123456789") == std::string::npos;
      const bool singular_number = digits && number_cue.find_first_not_of('0') != std::string::npos &&
        number_cue.substr(number_cue.find_first_not_of('0')) == "1";
      const bool plural = plurals.contains(number_cue) || (digits && !singular_number) || next == "are" || next == "were" || next == "have";
      const bool singular = singulars.contains(number_cue) || singular_number || next == "is" || next == "was" || next == "has";
      if (plural == singular) continue; // Ambiguous or conflicting number: keep aircraft.
      chosen.features.plural = plural;
    }
    // A lexicon noun may be functioning as a verb ("students question the result").
    static const std::unordered_set<std::string_view> noun_verbs = {
      "question", "answer", "picture", "film", "shop", "store", "ship", "cause", "lie", "part", "tool", "border"};
    if (chosen.pos == Pos::Noun && noun_verbs.contains(chosen.lemma)) {
      // Sentence-initial position alone does not establish a noun: "Answer
      // the question" is a command. Nor does the preposition in "Lie to ...".
      const bool noun_cue = is_determiner(prev) || is_preposition(prev) || known_adjective(prev) ||
        prev.ends_with("'s") || prev.ends_with("s'") || (next != "to" && looks_like_verb_token(next));
      if (!noun_cue) continue;
    }
    // Nominal "a cold" / "a fake" is not an attributive adjective.
    if (chosen.pos == Pos::Adj && is_determiner(prev) &&
        (next.empty() || is_preposition(next) || looks_like_verb_token(next))) continue;
    if (chosen.pos == Pos::Adj && chosen.lemma == "little") {
      static const std::unordered_set<std::string_view> mass = {
        "money", "cash", "time", "water", "food", "milk", "evidence", "information", "patience", "help", "assistance", "attention", "hope"};
      if (mass.contains(next) || known_adjective(next) || is_known_adverb_word(next)) continue;
    }
    if (chosen.flag == "disagreement" && chosen.lemma != "quarrel" &&
        prev != "heated" && prev != "bitter" && prev != "verbal" && prev != "petty" && prev != "protracted") continue;
    if (!context_allows(chosen, context, words, slot)) continue;
    if (chosen.lemma == "however" && (static_cast<std::size_t>(words[static_cast<std::size_t>(slot)] + 1) >= outcome.tokens.size() || outcome.tokens[static_cast<std::size_t>(words[static_cast<std::size_t>(slot)] + 1)].text != ",")) continue;
    if (chosen.pos == Pos::Adv && (chosen.lemma == "nearly" || chosen.lemma == "almost") && (next == "no" || next == "not" || next == "never")) continue;
    if (chosen.flag == "quant") {
      static const std::unordered_set<std::string_view> blocked = {"how", "too", "so", "as", "this", "that", "very"};
      if (next == "of" || next == "more" || blocked.contains(prev)) {
        continue;
      }
    }
    if (chosen.flag == "time" && !time_context(context, words, slot)) {
      continue;
    }
    if (chosen.flag == "mass" && chosen.features.plural) {
      continue;
    }
    if (chosen.pos == Pos::Verb && !verb_frame(chosen, context, words, slot, prev)) {
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
      if (chosen.pos == Pos::Adj && (synonym == "afraid" || synonym == "aware" || synonym == "unwell") &&
          !be_form(cue) && cue != "seem" && cue != "seems" && cue != "seemed" && cue != "feel" && cue != "feels" &&
          cue != "felt" && cue != "remain" && cue != "remained" && cue != "stay" && cue != "stayed") continue;

      if (chosen.pos == Pos::Adj && next == "to" &&
          (chosen.lemma == "likely" || chosen.lemma == "unlikely" || chosen.lemma == "probable" ||
           chosen.lemma == "improbable" || chosen.lemma == "eager" || chosen.lemma == "enthusiastic")) continue;
      if (chosen.pos == Pos::Adj && (is_determiner(prev) || known_noun(next)) &&
          (synonym == "afraid" || synonym == "aware" || synonym == "unwell")) continue;
      if (chosen.pos == Pos::Adj && next == "to" &&
          (chosen.lemma == "happy" || chosen.lemma == "glad" || chosen.lemma == "pleased" || chosen.lemma == "joyful" || chosen.lemma == "cheerful") &&
          synonym != "happy" && synonym != "glad" && synonym != "pleased") continue;
      if (chosen.pos == Pos::Adj && next == "to" &&
          (chosen.lemma == "likely" || chosen.lemma == "unlikely" || chosen.lemma == "probable" ||
           chosen.lemma == "improbable" || chosen.lemma == "eager" || chosen.lemma == "enthusiastic")) continue;
      if (chosen.pos == Pos::Adj && (is_determiner(prev) || known_noun(next)) &&
          (synonym == "afraid" || synonym == "aware" || synonym == "unwell")) continue;
      if (chosen.pos == Pos::Adj && next == "to" &&
          (chosen.lemma == "happy" || chosen.lemma == "glad" || chosen.lemma == "pleased" || chosen.lemma == "joyful" || chosen.lemma == "cheerful") &&
          synonym != "happy" && synonym != "glad" && synonym != "pleased") continue;
      if (const std::optional<std::string> inflected = inflect(synonym, chosen.pos, chosen.features)) {
        usable.push_back(*inflected);
      }
    }
    if (usable.empty()) {
      continue;
    }
    const std::uint64_t mixed =
        mix64(options.seed ^ ((word_ordinal + 1) * 0xD1B54A32D192ED03ull) ^ fnv1a(chosen.lemma));
    // A separate, stable hash controls edit density; synonym choice keeps its seed.
    if (options.style == Style::Close && mix64(mixed ^ 0xA0761D6478BD642Full) % 100 >= 50) continue;
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
    if (words[static_cast<std::size_t>(slot + 1)] != words[static_cast<std::size_t>(slot)] + 2 ||
        !is_space_token(tokens[static_cast<std::size_t>(words[static_cast<std::size_t>(slot)] + 1)])) continue;
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
