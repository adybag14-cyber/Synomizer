// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#include "internal.hpp"

#include <cctype>
#include <unordered_set>

namespace synomizer {
namespace {

bool is_abbrev(std::string_view word) {
  static const std::unordered_set<std::string_view> words = {
      "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "eg", "ie", "am", "pm",
      "fig", "vol", "gen", "col", "capt", "rev", "hon", "dept", "approx"};
  return words.contains(word);
}

bool is_space_char(unsigned char c) {
  return c == ' ' || c == '\t' || c == '\n';
}

std::vector<Token> tokenize(std::string_view text) {
  std::vector<Token> tokens;
  std::size_t i = 0;
  while (i < text.size()) {
    const unsigned char c = static_cast<unsigned char>(text[i]);
    if (is_space_char(c)) {
      std::size_t j = i + 1;
      while (j < text.size() && is_space_char(static_cast<unsigned char>(text[j]))) {
        ++j;
      }
      tokens.push_back(Token{std::string(text.substr(i, j - i)), false, false, false});
      i = j;
      continue;
    }
    if (c >= 128) {
      std::size_t j = i + 1;
      while (j < text.size() && static_cast<unsigned char>(text[j]) >= 128) {
        ++j;
      }
      tokens.push_back(Token{std::string(text.substr(i, j - i)), true, true, false});
      i = j;
      continue;
    }
    if (is_letter(c)) {
      std::size_t j = i + 1;
      while (j < text.size()) {
        const unsigned char d = static_cast<unsigned char>(text[j]);
        if (is_letter(d)) {
          ++j;
          continue;
        }
        if ((d == '\'' || d == '-') && j + 1 < text.size() && is_letter(static_cast<unsigned char>(text[j + 1]))) {
          ++j;
          continue;
        }
        break;
      }
      tokens.push_back(Token{std::string(text.substr(i, j - i)), true, false, false});
      i = j;
      continue;
    }
    if (std::isdigit(c) != 0) {
      std::size_t j = i + 1;
      while (j < text.size() && std::isdigit(static_cast<unsigned char>(text[j])) != 0) {
        ++j;
      }
      tokens.push_back(Token{std::string(text.substr(i, j - i)), false, false, false});
      i = j;
      continue;
    }
    tokens.push_back(Token{std::string(text.substr(i, 1)), false, false, false});
    ++i;
  }
  return tokens;
}

}  // namespace

std::string concat_tokens(const std::vector<Token>& tokens) {
  std::string out;
  for (const Token& token : tokens) {
    out += token.text;
  }
  return out;
}

std::vector<Piece> split_pieces(std::string_view input) {
  const std::string text(input);
  std::vector<Piece> pieces;
  std::size_t start = 0;
  bool in_quotes = false;
  std::size_t i = 0;
  while (i < text.size()) {
    const char c = text[i];
    if (c == '"') {
      in_quotes = !in_quotes;
      ++i;
      continue;
    }
    if (!in_quotes && (c == '.' || c == '!' || c == '?')) {
      bool boundary = true;
      if (c == '.' && i + 1 < text.size() && text[i + 1] == '.') {
        boundary = false;
      }
      if (c == '.' && i > 0 && i + 1 < text.size() &&
          std::isdigit(static_cast<unsigned char>(text[i - 1])) != 0 &&
          std::isdigit(static_cast<unsigned char>(text[i + 1])) != 0) {
        boundary = false;
      }
      if (c == '.' && boundary) {
        std::size_t j = i;
        while (j > start && is_letter(static_cast<unsigned char>(text[j - 1]))) {
          --j;
        }
        const std::string word = lower_copy(std::string_view(text).substr(j, i - j));
        if (word.size() == 1 || is_abbrev(word)) {
          boundary = false;
        }
      }
      if (boundary) {
        std::size_t end = i + 1;
        while (end < text.size() && (text[end] == '"' || text[end] == '\'')) {
          ++end;
        }
        Piece sentence;
        sentence.sentence = true;
        sentence.text = text.substr(start, end - start);
        sentence.tokens = tokenize(sentence.text);
        pieces.push_back(std::move(sentence));
        std::size_t sep = end;
        while (sep < text.size() && is_space_char(static_cast<unsigned char>(text[sep]))) {
          ++sep;
        }
        if (sep > end) {
          Piece gap;
          gap.text = text.substr(end, sep - end);
          pieces.push_back(std::move(gap));
        }
        start = sep;
        i = sep;
        continue;
      }
    }
    ++i;
  }
  if (start < text.size()) {
    Piece sentence;
    sentence.sentence = true;
    sentence.text = text.substr(start);
    sentence.tokens = tokenize(sentence.text);
    pieces.push_back(std::move(sentence));
  }
  return pieces;
}

}  // namespace synomizer
