// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "synomizer/engine.hpp"
#include <iostream>
#include <stdexcept>
#include <unordered_set>

int main() {
  int failures = 0;
  auto expect = [&](bool value, const char* label) { if (!value) { std::cerr << label << '\n'; ++failures; } };
  const std::string text = "The careful teacher examined the happy child's report. Because the road was icy, the bus arrived late.";
  for (std::uint64_t seed : {0ULL, 1ULL, 42ULL, 18446744073709551615ULL}) {
    for (int count = 1; count <= 3; ++count) {
      synomizer::Options options; options.seed = seed; options.protected_terms = {"report"};
      const auto set = synomizer::rewrite_variations(text, options, count);
      expect(set.variations.size() == static_cast<std::size_t>(count), "three variants should be available for this passage");
      expect(set.candidates_considered >= 1 && set.candidates_considered <= 12, "bounded candidate count");
      std::unordered_set<std::string> unique;
      for (const auto& v : set.variations) {
        expect(unique.insert(v.result.text).second, "duplicate result");
        expect(v.result.text.find("report") != std::string::npos, "lost protected word");
        expect(synomizer::rewrite(text, v.options).text == v.result.text, "variant replay mismatch");
      }
    }
  }
  for (const int count : {-1, 0, 4}) {
    bool rejected = false;
    try { (void)synomizer::rewrite_variations(text, {}, count); } catch (const std::invalid_argument&) { rejected = true; }
    expect(rejected, "invalid count accepted");
  }
  const auto plain = synomizer::rewrite_variations("xyzzy");
  expect(plain.variations.size() == 1 && plain.variations.front().result.text == "xyzzy", "unchanged fallback");
  synomizer::Options off; off.synonyms = false; off.arrange = false;
  const auto unchanged = synomizer::rewrite_variations("a\r\nb\rc", off);
  expect(unchanged.variations.size() == 1 && unchanged.variations.front().result.text == "a\nb\nc", "newline preservation");
  synomizer::Options out_of_range; out_of_range.intensity = 999; out_of_range.density = -1;
  const auto clamped = synomizer::rewrite_variations(text, out_of_range);
  for (const auto& v : clamped.variations) expect(v.options.intensity == 2 && v.options.density == 0, "canonical clamped metadata");
  // Deterministic malformed/punctuation input stress: safety properties, not a grammar score.
  std::uint64_t state = 42;
  constexpr std::string_view alphabet = "abcXYZ '.,?![]()\n\t123";
  for (int trial = 0; trial < 100; ++trial) {
    std::string input;
    for (int j = 0; j < 100; ++j) { state = state * 6364136223846793005ULL + 1; input += alphabet[state % alphabet.size()]; }
    const auto set = synomizer::rewrite_variations(input);
    expect(!set.variations.empty() && set.variations.size() <= 3, "invalid stress result size");
    for (const auto& v : set.variations) expect(synomizer::rewrite(input, v.options).text == v.result.text, "stress replay mismatch");
  }
  if (failures) return 1;
  std::cout << "Variation API invariants passed\n";
}
