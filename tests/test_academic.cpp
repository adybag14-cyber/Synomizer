// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "synomizer/engine.hpp"
#include <cstdlib>
#include <iostream>
#include <string>
#include <string_view>
#include <vector>

int main() {
  int failed = 0;
  auto expect = [&](bool ok, std::string_view message) {
    if (!ok) { ++failed; std::cerr << "FAIL " << message << '\n'; }
  };
  synomizer::Options structure;
  structure.style = synomizer::Style::Recast;
  structure.synonyms = false;
  const std::vector<std::pair<std::string,std::string>> golden = {
    {"The results suggest that the model may fail.", "The model may fail, as suggested by the results."},
    {"Recent methods broaden the comparison while preserving uncertainty.", "While preserving uncertainty, recent methods broaden the comparison."},
    {"The algorithm is therefore a candidate for further testing.", "Therefore, the algorithm is a candidate for further testing."},
    {"A verification strategy is proposed that includes boundary cases.", "A verification strategy that includes boundary cases is proposed."},
  };
  for (const auto& [text, expected] : golden) {
    const auto result = synomizer::rewrite(text,structure);
    expect(result.text == expected, result.text);
    expect(result.changes.size() == 1 && result.changes.front().kind == synomizer::ChangeKind::Arrangement, "exactly one structural operation");
    auto locked = structure; locked.protected_terms = {text};
    expect(synomizer::rewrite(text,locked).text == text,"protected clause stays unchanged");
  }
  for (const auto& text : {"The results do not show that the model works.",
      "The results suggest that the author said that the model works.",
      "The results show that\nthe model works.",
      "The results constructor that the model may fail."})
    expect(synomizer::rewrite(text,structure).text == text,text);
  for (std::uint64_t seed = 0; seed < 24; ++seed) {
    synomizer::Options options; options.seed=seed;
    const auto batch=synomizer::rewrite_variants("This review examines whether the model works. The method remains to be established. A significant difference was reported.",options);
    for (const auto& v : batch.variants) {
      expect(v.result.text.find("inspects whether")==std::string::npos,"whether complement");
      expect(v.result.text.find("stays to be")==std::string::npos,"remaining work complement");
      expect(v.result.text.find("significant")!=std::string::npos,"significant qualifier");
      options.seed=v.seed; options.style=v.style;
      expect(synomizer::rewrite("This review examines whether the model works. The method remains to be established. A significant difference was reported.",options).text==v.result.text,"candidate replay");
    }
  }
  // Truncated templates, arbitrary bytes, nested clauses and punctuation exercise
  // bounds checks in the new scanner under the sanitizer job as well as Release.
  for (const auto& [text, unused] : golden) {
    (void)unused;
    for (std::size_t n=0;n<=text.size();++n) {
      const auto prefix=text.substr(0,n);
      const auto one=synomizer::rewrite(prefix,structure);
      expect(one.text==synomizer::rewrite(prefix,structure).text,"truncated template deterministic");
      for (const auto suffix : {"\"", "\n", ";", " that that", " while while", " constructor"})
        (void)synomizer::rewrite(prefix+suffix,structure);
    }
  }
  std::cout << (failed ? "failed\n" : "academic ok\n");
  return failed ? EXIT_FAILURE : EXIT_SUCCESS;
}
