// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#include "internal.hpp"

#include <unordered_set>

namespace synomizer {

bool is_determiner(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {
      "a",     "an",    "the",   "this",   "that",   "these", "those", "my",    "your",  "his",
      "her",   "its",   "our",   "their",  "some",   "any",   "no",    "every", "each",  "either",
      "neither", "much", "few",  "both",   "all",    "half",  "another", "such"};
  return words.contains(word);
}

bool is_pronoun(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {
      "i",        "you",      "he",       "she",      "it",       "we",        "they",     "me",
      "him",      "her",      "us",       "them",     "myself",   "yourself",  "himself",  "herself",
      "itself",   "ourselves","yourselves","themselves", "someone", "somebody", "something",
      "anyone",   "anybody",  "anything", "everyone", "everybody", "everything", "nobody", "nothing",
      "who",      "whom",     "whose",    "which",    "what",     "one"};
  return words.contains(word);
}

bool is_subject_pronoun(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {"i", "you", "he", "she", "it", "we", "they", "who"};
  return words.contains(word);
}

bool is_object_pronoun(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {
      "me", "you", "him", "her", "us", "them", "whom", "someone", "somebody", "anyone", "anybody", "everyone",
      "everybody"};
  return words.contains(word);
}

bool is_aux(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {
      "am", "is", "are", "was", "were", "be", "been", "being", "do", "does", "did", "doing", "have", "has", "had",
      "having", "can", "could", "may", "might", "must", "shall", "should", "will", "would", "to"};
  return words.contains(word);
}

bool is_preposition(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {
      "in", "on", "at", "by", "for", "with", "from", "of", "into", "onto", "upon", "about", "against", "between",
      "among", "through", "during", "before", "after", "over", "under", "above", "below", "near", "without",
      "within", "along", "across", "behind", "beyond", "up", "down", "off", "out", "around", "per", "via", "than",
      "until", "since", "toward", "towards", "upon", "inside", "outside", "beside", "besides"};
  return words.contains(word);
}

bool is_coordinator(std::string_view word) {
  return word == "and" || word == "or" || word == "but" || word == "nor";
}

bool is_subordinator_word(std::string_view word) {
  return word == "because" || word == "although" || word == "though" || word == "after" || word == "before" ||
         word == "when";
}

bool is_particle(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {
      "up", "out", "off", "down", "away", "along", "around", "aside", "apart", "back", "over"};
  return words.contains(word);
}

bool is_known_adverb_word(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {
      "early", "late", "soon", "today", "yesterday", "tomorrow", "tonight", "now", "then", "here", "there", "again",
      "together", "apart", "ahead", "overnight", "daily", "weekly", "later", "already", "still", "yet", "just",
      "even", "almost", "nearly", "very", "really", "quite", "rather", "too", "also", "instead", "aloud", "well",
      "fast", "hard", "alone", "upstairs", "downstairs", "inside", "outside", "away", "back", "forward", "onward",
      "often", "always", "never", "sometimes", "once", "twice"};
  if (words.contains(word)) {
    return true;
  }
  if (lexicon().has(word, Pos::Adv)) {
    return true;
  }
  static const std::unordered_set<std::string_view> not_adverbs = {
      "family", "apply", "supply", "rely", "july", "holy", "silly", "bully", "belly", "jelly", "fly", "multiply",
      "imply", "comply", "reply"};
  if (not_adverbs.contains(word)) {
    return false;
  }
  if (word.size() >= 4 && word.ends_with("ly") && !lexicon().has(word, Pos::Noun) && !lexicon().has(word, Pos::Verb) &&
      !lexicon().has(word, Pos::Adj)) {
    return true;
  }
  return false;
}

bool is_negation(std::string_view word) {
  return word == "not" || word == "n't" || word == "never";
}

bool needs_an(std::string_view word) {
  std::size_t letters = 0;
  char first = 0;
  for (unsigned char c : word) {
    if (!is_letter(c)) {
      continue;
    }
    if (letters == 0) {
      first = ascii_lower(c);
    }
    ++letters;
  }
  if (letters == 0) {
    return false;
  }
  const bool acronym = (letters == 1) || (is_all_caps_word(word) && letters >= 2 && letters <= 6);
  if (acronym) {
    constexpr std::string_view an_letters = "aefhilmnorsx";
    return an_letters.contains(first);
  }

  const std::string lower = lower_copy(word);
  constexpr std::string_view silent_h[] = {"hour", "honest", "honor", "honour", "heir", "herb", "homage"};
  for (std::string_view prefix : silent_h) {
    if (lower.starts_with(prefix)) {
      return true;
    }
  }
  if (lower.starts_with("uni") || lower.starts_with("use") || lower.starts_with("usu") || lower.starts_with("uti") ||
      lower.starts_with("eu") || lower.starts_with("one") || lower.starts_with("once") || lower.starts_with("uke")) {
    return false;
  }
  return first == 'a' || first == 'e' || first == 'i' || first == 'o' || first == 'u';
}

}  // namespace synomizer
