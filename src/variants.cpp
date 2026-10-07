// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "internal.hpp"
#include <algorithm>
#include <stdexcept>
#include <unordered_set>

namespace synomizer {
std::string_view style_name(Style style) noexcept {
  switch (style) {
    case Style::Close: return "close";
    case Style::Recast: return "recast";
    default: return "balanced";
  }
}
namespace {
using Fingerprint = std::unordered_set<std::string>;
Fingerprint fingerprint(std::string_view text) {
  Fingerprint result;
  std::string previous;
  for (std::size_t i = 0; i < text.size();) {
    if (std::string_view(" \t\r\n").contains(text[i])) { ++i; continue; }
    auto end = text.find_first_of(" \t\r\n", i);
    if (end == std::string_view::npos) end = text.size();
    auto word = lower_copy(text.substr(i, end-i));
    result.insert("w:" + word);
    if (!previous.empty()) result.insert("b:" + previous + '\0' + word);
    previous = std::move(word);
    i = end;
  }
  return result;
}
// Wording diversity only. This is NOT a semantic-equivalence or quality score.
int distance(const Fingerprint& a, const Fingerprint& b) {
  std::size_t intersection = 0;
  for (const auto& key : a) if (b.contains(key)) ++intersection;
  const auto total = a.size() + b.size() - intersection;
  return total ? static_cast<int>(1000 * (total - intersection) / total) : 0;
}
}
Variants rewrite_variants(std::string_view input, const Options& options, std::size_t count) {
  if (count < 1 || count > 3) throw std::invalid_argument("variant count must be 1, 2, or 3");
  Variants batch;
  batch.requested = count;
  if (count == 1 || (!options.synonyms && !options.arrange) || input.empty()) {
    batch.attempts = 1;
    const auto style = count == 1 ? options.style : Style::Balanced;
    auto settings = options; settings.style = style;
    batch.variants.push_back({options.seed, style, rewrite(input, settings)});
    return batch;
  }
  auto normalized_options = options;
  normalized_options.synonyms = false; normalized_options.arrange = false;
  const auto original = rewrite(input, normalized_options).text;
  std::vector<Fingerprint> selected;
  auto generate = [&](Style style, std::uint64_t offset) {
    auto settings = options;
    settings.style = style;
    settings.seed += offset; // unsigned wrap is intentional and matches browser BigInt.
    ++batch.attempts;
    return Variant{settings.seed, style, rewrite(input, settings)};
  };
  auto unique = [&](const Variant& v) {
    return v.result.text != original && std::ranges::none_of(batch.variants, [&](const Variant& old) { return old.result.text == v.result.text; });
  };
  auto add = [&](Variant candidate) {
    selected.push_back(fingerprint(candidate.result.text));
    batch.variants.push_back(std::move(candidate));
  };
  auto first = generate(count == 1 ? options.style : Style::Balanced, 0);
  if (count == 1) { add(std::move(first)); return batch; }
  if (unique(first)) add(first);
  // Prefer each profile in turn. Select the most distinct of four bounded candidates.
  for (int profile = 1; profile <= 2 && batch.variants.size() < count; ++profile) {
    std::optional<Variant> best;
    int best_distance = -1;
    for (std::uint64_t attempt = 0; attempt < 4; ++attempt) {
      auto candidate = generate(profile == 1 ? Style::Close : Style::Recast, static_cast<std::uint64_t>(profile) + attempt * 3);
      if (!unique(candidate)) continue;
      const auto fp = fingerprint(candidate.result.text);
      int score = 1000;
      for (const auto& other : selected) score = std::min(score, distance(fp, other));
      if (score > best_distance) { best_distance = score; best = std::move(candidate); }
    }
    if (best) add(std::move(*best));
  }
  for (std::uint64_t offset : {3ull, 6ull, 9ull}) {
    if (batch.variants.size() >= count) break;
    auto candidate = generate(Style::Balanced, offset);
    if (unique(candidate)) add(std::move(candidate));
  }
  if (batch.variants.empty()) add(std::move(first));
  return batch;
}
} // namespace synomizer
