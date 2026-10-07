// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#include "internal.hpp"

#include "embedded_data.hpp"

#include <algorithm>
#include <ranges>
#include <utility>

namespace synomizer {
namespace {

std::string trim_copy(std::string_view text) {
  while (!text.empty() && (text.front() == ' ' || text.front() == '\r' || text.front() == '\t')) {
    text.remove_prefix(1);
  }
  while (!text.empty() && (text.back() == ' ' || text.back() == '\r' || text.back() == '\t')) {
    text.remove_suffix(1);
  }
  return std::string(text);
}

std::vector<std::string> split_char(std::string_view text, char sep) {
  std::vector<std::string> parts;
  std::string cur;
  for (char c : text) {
    if (c == sep) {
      parts.push_back(trim_copy(cur));
      cur.clear();
    } else {
      cur.push_back(c);
    }
  }
  parts.push_back(trim_copy(cur));
  return parts;
}

std::optional<Pos> parse_pos(std::string_view text) {
  if (text == "noun") {
    return Pos::Noun;
  }
  if (text == "verb") {
    return Pos::Verb;
  }
  if (text == "adj") {
    return Pos::Adj;
  }
  if (text == "adv") {
    return Pos::Adv;
  }
  return std::nullopt;
}

void add_member(Lexicon& lex, std::string lemma, Pos pos, std::vector<std::string> synonyms, std::string flag) {
  if (lemma.empty()) {
    return;
  }
  std::erase_if(synonyms, [&](const std::string& syn) { return syn.empty() || syn == lemma; });
  if (synonyms.empty()) {
    return;
  }
  Analysis entry;
  entry.lemma = std::move(lemma);
  entry.pos = pos;
  entry.flag = std::move(flag);
  lex.add(std::move(entry), std::move(synonyms));
}

void load_line(Lexicon& lex, std::string_view line) {
  if (line.empty() || line.starts_with('#')) {
    return;
  }
  if (std::ranges::all_of(line, [](unsigned char c) { return c == ' ' || c == '\t' || c == '\r'; })) {
    return;
  }
  const std::vector<std::string> cols = split_char(line, '\t');
  if (cols.size() < 3) {
    return;
  }
  const std::string flag = cols.size() >= 4 && !cols[3].empty() ? cols[3] : "free";
  if (cols[0] == "@phrase") {
    lex.phrase_rules.push_back({cols[1], split_char(cols[2], '|')});
    return;
  }
  if (cols[0] == "@group") {
    const auto pos = parse_pos(cols[1]);
    if (!pos) {
      return;
    }
    const std::vector<std::string> members = split_char(cols[2], '|');
    for (const std::string& member : members) {
      add_member(lex, member, *pos, members, flag);
    }
    return;
  }
  const auto pos = parse_pos(cols[1]);
  if (!pos) {
    return;
  }
  add_member(lex, cols[0], *pos, split_char(cols[2], '|'), flag);
}

Lexicon build_lexicon() {
  Lexicon lex;
  std::string line;
  for (char c : embedded::lexicon_tsv) {
    if (c == '\n') {
      load_line(lex, line);
      line.clear();
    } else {
      line.push_back(c);
    }
  }
  if (!line.empty()) {
    load_line(lex, line);
  }

  line.clear();
  for (char c : embedded::phrases) {
    if (c == '\n') {
      if (!line.empty() && !line.starts_with('#')) {
        auto words = split_char(line, ' ');
        std::erase_if(words, [](const std::string& word) { return word.empty(); });
        if (words.size() >= 2) {
          lex.add_phrase(std::move(words));
        }
      }
      line.clear();
    } else if (c != '\r') {
      line.push_back(c);
    }
  }
  if (!line.empty() && !line.starts_with('#')) {
    auto words = split_char(line, ' ');
    std::erase_if(words, [](const std::string& word) { return word.empty(); });
    if (words.size() >= 2) {
      lex.add_phrase(std::move(words));
    }
  }
  return lex;
}

}  // namespace

bool Lexicon::has_lemma(std::string_view lemma) const {
  return by_lemma_.contains(std::string(lemma));
}

bool Lexicon::has(std::string_view lemma, Pos pos) const {
  return find(lemma, pos).has_value();
}

std::optional<Analysis> Lexicon::find(std::string_view lemma, Pos pos) const {
  const auto it = by_lemma_.find(std::string(lemma));
  if (it == by_lemma_.end()) return {};
  for (const auto index : it->second) {
    const auto& row = rows_[index];
    if (row.analysis.pos == pos) {
      return row.analysis;
    }
  }
  return std::nullopt;
}

std::vector<Analysis> Lexicon::entries_for(std::string_view lemma) const {
  std::vector<Analysis> found;
  const auto it = by_lemma_.find(std::string(lemma));
  if (it != by_lemma_.end()) for (const auto index : it->second) found.push_back(rows_[index].analysis);
  return found;
}

const std::vector<std::string>* Lexicon::synonyms(std::string_view lemma, Pos pos) const {
  const auto it = by_lemma_.find(std::string(lemma));
  if (it == by_lemma_.end()) return {};
  for (const auto index : it->second) {
    const auto& row = rows_[index];
    if (row.analysis.pos == pos) {
      return &row.synonyms;
    }
  }
  return nullptr;
}

const std::vector<std::vector<std::string>>& Lexicon::phrases() const {
  return phrases_;
}

void Lexicon::add(Analysis entry, std::vector<std::string> synonyms) {
  if (find(entry.lemma, entry.pos)) {
    return;
  }
  by_lemma_[entry.lemma].push_back(rows_.size());
  rows_.push_back(Row{std::move(entry), std::move(synonyms)});
}

void Lexicon::add_phrase(std::vector<std::string> phrase) {
  phrases_.push_back(std::move(phrase));
}

const Lexicon& lexicon() {
  static const Lexicon stored = build_lexicon();
  return stored;
}

}  // namespace synomizer
