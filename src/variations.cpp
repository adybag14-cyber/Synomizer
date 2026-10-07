// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "internal.hpp"
#include <algorithm>
#include <limits>
#include <stdexcept>
#include <unordered_set>

namespace synomizer {
namespace {
using Signature = std::unordered_set<std::string>;
// Whitespace-delimited bigrams, using ASCII-only case folding in both ports.
Signature signature(std::string_view text) {
  Signature result;
  std::string previous;
  std::size_t i = 0;
  while (i < text.size()) {
    const auto begin = text.find_first_not_of(" \t\r\n", i);
    if (begin == std::string_view::npos) break;
    auto end = text.find_first_of(" \t\r\n", begin);
    if (end == std::string_view::npos) end = text.size();
    auto word = lower_copy(text.substr(begin, end - begin));
    result.insert(previous + '\0' + word);
    previous = std::move(word); i = end;
  }
  return result;
}
int distance(const Signature& a, const Signature& b) {
  std::size_t overlap = 0;
  const auto& small = a.size() <= b.size() ? a : b;
  const auto& large = a.size() <= b.size() ? b : a;
  for (const auto& item : small) if (large.contains(item)) ++overlap;
  const auto total = a.size() + b.size() - overlap;
  if (!total) return 0;
  return static_cast<int>(100000ULL * (total - overlap) / total);
}
std::string normalized(std::string_view input) {
  std::string text;
  for (std::size_t i = 0; i < input.size(); ++i) {
    if (input[i] == '\r') { if (i + 1 == input.size() || input[i+1] != '\n') text += '\n'; }
    else text += input[i];
  }
  return text;
}
}

VariationSet rewrite_variations(std::string_view input, const Options& options, int count) {
  if (count < 1 || count > 3) throw std::invalid_argument("variation count must be 1, 2, or 3");
  VariationSet out;
  out.requested = count;
  std::vector<Variation> pool;
  std::vector<Signature> signatures;
  const auto original = normalized(input);
  Variation fallback;
  constexpr int rates[] = {100, 65, 85, 45};
  const int budget = count == 1 ? 1 : 12;
  for (int attempt = 0; attempt < budget; ++attempt) {
    Options candidate = options;
    candidate.intensity = std::clamp(options.intensity, 0, 2);
    candidate.density = std::clamp(options.density, 0, 100) * rates[attempt % 4] / 100;
    candidate.seed += static_cast<std::uint64_t>(attempt); // defined uint64 wrap
    if (attempt % 3 == 1) candidate.arrange = false;
    if (attempt % 3 == 2) candidate.mixed_moves = true;
    auto result = rewrite(input, candidate);
    ++out.candidates_considered;
    if (count == 1) { out.variations.push_back({std::move(result), candidate}); return out; }
    if (!attempt) fallback = {result, candidate};
    if (result.text != original && std::ranges::none_of(pool, [&](const auto& item) { return item.result.text == result.text; })) {
      signatures.push_back(signature(result.text));
      pool.push_back({std::move(result), candidate});
    }
    if (!attempt && fallback.result.changes.empty() && candidate.density == 100 && !candidate.mixed_moves) break;
    if (!options.synonyms && !options.arrange) break;
  }
  if (pool.empty()) { out.variations.push_back(std::move(fallback)); return out; }
  std::vector<std::size_t> chosen{0};
  while (chosen.size() < static_cast<std::size_t>(count) && chosen.size() < pool.size()) {
    int best = -1;
    std::size_t next = 0;
    for (std::size_t i = 1; i < pool.size(); ++i) {
      if (std::ranges::find(chosen, i) != chosen.end()) continue;
      int score = std::numeric_limits<int>::max();
      for (auto j : chosen) score = std::min(score, distance(signatures[i], signatures[j]));
      if (score > best) { best = score; next = i; }
    }
    chosen.push_back(next);
  }
  for (auto i : chosen) out.variations.push_back(std::move(pool[i]));
  return out;
}
} // namespace synomizer
