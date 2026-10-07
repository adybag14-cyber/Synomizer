// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace synomizer {

enum class ChangeKind { Synonym, Arrangement, Article, Phrase };

enum class Style { Balanced, Close, Recast };
[[nodiscard]] std::string_view style_name(Style style) noexcept;

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
  // Appended for aggregate-initialization source compatibility.
  // Close selectively edits words without rearranging; Recast also varies phrases.
  Style style = Style::Balanced;
};

struct Result {
  std::string text;
  std::vector<Change> changes;
};

[[nodiscard]] Result rewrite(std::string_view input, const Options& options = {});

struct Variant {
  std::uint64_t seed = 1;
  Style style = Style::Balanced;
  Result result;
};
struct Variants {
  std::vector<Variant> variants;
  std::size_t requested = 3;
  std::size_t attempts = 0;
};
// Generate from the ORIGINAL every time. Return fewer results rather than duplicates.
// Count is 1..3. Multi-result batches use Balanced, Close and Recast profiles;
// the caller's intensity, operation switches and protection settings are never relaxed.
[[nodiscard]] Variants rewrite_variants(std::string_view input, const Options& options = {}, std::size_t count = 3);
[[nodiscard]] std::string_view version() noexcept;

}  // namespace synomizer
