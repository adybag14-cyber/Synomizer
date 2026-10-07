// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#include "internal.hpp"

#include <utility>
#include <algorithm>
#include <stdexcept>
#include <unordered_set>

namespace synomizer {

// GCC 13 reports 202100L for -std=c++23. GCC 14 and later report 202302L.
static_assert(__cplusplus >= 202100L, "Synomizer is built as C++23");

std::string_view version() noexcept {
  return SYNOMIZER_VERSION;
}

Result rewrite(std::string_view input, const Options& options) {
  Options settings = options;
  settings.density = std::clamp(settings.density, 0, 100);
  if (settings.intensity < 0) {
    settings.intensity = 0;
  }
  if (settings.intensity > 2) {
    settings.intensity = 2;
  }

  std::string text;
  text.reserve(input.size());
  for (std::size_t i = 0; i < input.size(); ++i) {
    if (input[i] == '\r') {
      if (i + 1 == input.size() || input[i + 1] != '\n') text.push_back('\n');
    } else text.push_back(input[i]);
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
    const bool locked = freeze_terms(tokens, settings.protected_terms);
    if (std::optional<ArrangeOutcome> arranged = arrange_sentence(tokens, settings.arrange && !locked && (!settings.mixed_moves || ((settings.seed ^ ordinal) % 3 != 0)), settings.seed)) {
      tokens = std::move(arranged->tokens);
      result.changes.push_back(std::move(arranged->change));
    }
    auto phrases = rephrase(tokens, settings, ordinal);
    result.changes.insert(result.changes.end(), phrases.begin(), phrases.end());
    SubstituteOutcome substituted = substitute(std::move(tokens), settings, ordinal);
    ordinal = substituted.next_ordinal;
    fix_articles(substituted.tokens, substituted.changes);
    result.changes.insert(result.changes.end(), substituted.changes.begin(), substituted.changes.end());
    result.text += concat_tokens(substituted.tokens);
  }
  return result;
}

}  // namespace synomizer
