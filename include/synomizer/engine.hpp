// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace synomizer {

enum class ChangeKind { Synonym, Arrangement, Article };

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
};

struct Result {
  std::string text;
  std::vector<Change> changes;
};

[[nodiscard]] Result rewrite(std::string_view input, const Options& options = {});

[[nodiscard]] std::string_view version() noexcept;

}  // namespace synomizer
