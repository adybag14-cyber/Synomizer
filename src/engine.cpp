// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#include "internal.hpp"

#include <utility>

namespace synomizer {

// GCC 13 reports 202100L for -std=c++23. GCC 14 and later report 202302L.
static_assert(__cplusplus >= 202100L, "Synomizer is built as C++23");

std::string_view version() noexcept {
  return SYNOMIZER_VERSION;
}

Result rewrite(std::string_view input, const Options& options) {
  Options settings = options;
  if (settings.intensity < 0) {
    settings.intensity = 0;
  }
  if (settings.intensity > 2) {
    settings.intensity = 2;
  }

  std::string text;
  text.reserve(input.size());
  for (char c : input) {
    if (c != '\r') {
      text.push_back(c);
    }
  }

  Result result;
  std::uint64_t ordinal = 0;
  for (Piece& piece : split_pieces(text)) {
    if (!piece.sentence) {
      result.text += piece.text;
      continue;
    }
    std::vector<Token> tokens = std::move(piece.tokens);
    freeze_tokens(tokens, settings.protect_quotes);
    if (std::optional<ArrangeOutcome> arranged = arrange_sentence(tokens, settings.arrange)) {
      tokens = std::move(arranged->tokens);
      result.changes.push_back(std::move(arranged->change));
    }
    SubstituteOutcome substituted = substitute(std::move(tokens), settings, ordinal);
    ordinal = substituted.next_ordinal;
    fix_articles(substituted.tokens, substituted.changes);
    result.changes.insert(result.changes.end(), substituted.changes.begin(), substituted.changes.end());
    result.text += concat_tokens(substituted.tokens);
  }
  return result;
}

}  // namespace synomizer
