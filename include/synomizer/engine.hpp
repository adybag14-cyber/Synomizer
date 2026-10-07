// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace synomizer {

enum class ChangeKind { Synonym, Arrangement, Article, Phrase };

struct Change {
  ChangeKind kind = ChangeKind::Synonym;
  std::string before;
  std::string after;
  std::string detail;
};

struct Options {
  // Same text and seed always produce the same wording.
  std::uint64_t seed = 1;
  // 0: adjectives and manner adverbs. 1: safe substitutions. 2: also narrower ones.
  int intensity = 1;
  bool synonyms = true;
  bool arrange = true;
  bool protect_quotes = true;
  // Case-insensitive whole words/phrases; matching sentences are not rearranged.
  std::vector<std::string> protected_terms;
  // Percentage of eligible word/phrase edits to apply; never increases risk.
  int density = 100;
  // Apply a deterministic subset of eligible sentence moves instead of all.
  bool mixed_moves = false;

};

struct Result {
  std::string text;
  std::vector<Change> changes;
};

[[nodiscard]] Result rewrite(std::string_view input, const Options& options = {});

struct Variation {
  Result result;
  Options options;  // Reproduce this exact result with rewrite(input, options).
};

struct VariationSet {
  std::vector<Variation> variations;
  int requested = 3;
  int candidates_considered = 0;
};

// Search at most twelve candidates, all from the ORIGINAL input. Return only
// distinct changed texts, or a single unchanged result when nothing fits.
// The changed base result is kept first. Remaining results are chosen
// for lexical diversity, not assigned an unsupported semantic-quality score.
[[nodiscard]] VariationSet rewrite_variations(std::string_view input,
    const Options& options = {}, int count = 3);

[[nodiscard]] std::string_view version() noexcept;

}  // namespace synomizer
