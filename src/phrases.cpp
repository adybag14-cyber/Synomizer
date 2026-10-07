// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
#include "internal.hpp"
#include <algorithm>

namespace synomizer {
void vary_phrases(std::vector<Token>& tokens, const Options& options, std::vector<Change>& changes) {
  if (!options.synonyms || options.style != Style::Recast || options.intensity < 1) return;
  for (const auto& token : tokens) {
    const auto word = lower_copy(token.text);
    if (word == "not" || word == "never" || word == "no" || word.find("n't") != std::string::npos) return;
  }
  // Compute a sentence-wide guard once, not once per token. The table never
  // introduces or removes these verb tokens; generated spans are opaque.
  const bool purpose_blocked = std::ranges::any_of(tokens, [](const Token& t) {
    const auto w=lower_copy(t.text);
    return w=="put" || w=="set" || w=="get" || w=="got" || w=="keep" || w=="kept" || w=="bring" || w=="brought" || w=="arrange" || w=="arranged";
  });
  for (std::size_t start = 0; start < tokens.size(); ++start) {
    if (!tokens[start].word || tokens[start].frozen) continue;
    bool replaced = false;
    for (const auto& rule : lexicon().phrase_rules) {
      if (rule.mode == "purpose" && purpose_blocked) continue;
      for (std::size_t form = 0; form < rule.forms.size(); ++form) {
        if (rule.mode == "purpose" && form != 0) continue; // Never expand complement 'to'.
        std::string match;
        std::size_t end = start;
        for (; end < tokens.size(); ++end) {
          const auto& token = tokens[end];
          if (token.frozen || (!token.word && token.text.find_first_not_of(" \t") != std::string::npos)) break;
          if (token.word) { if (!match.empty()) match += ' '; match += lower_copy(token.text); }
          if (match == rule.forms[form]) break;
          if (match.size() > rule.forms[form].size()) break;
        }
        if (end == tokens.size() || match != rule.forms[form] || tokens[end].frozen || !tokens[end].word) continue;
        if (rule.mode == "front" && (start != 0 || end+1 >= tokens.size() || tokens[end+1].text != ",")) continue;
        if (rule.mode != "front" && (end+2 >= tokens.size() || !tokens[end+2].word || tokens[end+2].frozen)) continue;
        std::vector<std::string> alternatives;
        for (const auto& word : rule.forms) if (word != rule.forms[form]) alternatives.push_back(word);
        if (alternatives.empty()) continue;
        const auto pick = static_cast<std::size_t>(options.seed % alternatives.size());
        const auto replacement = apply_caps(alternatives[pick], tokens[start].text);
        std::string before;
        for (auto i = start; i <= end; ++i) before += tokens[i].text;
        changes.push_back({ChangeKind::Phrase, before, replacement, "Equivalent " + rule.mode + " phrase"});
        tokens.erase(tokens.begin()+static_cast<std::ptrdiff_t>(start), tokens.begin()+static_cast<std::ptrdiff_t>(end+1));
        // An opaque replacement cannot be rewritten again within this pass.
        tokens.insert(tokens.begin()+static_cast<std::ptrdiff_t>(start), {replacement, false, true, true});
        replaced = true;
        break;
      }
      if (replaced) break;
    }
  }
}
} // namespace synomizer
