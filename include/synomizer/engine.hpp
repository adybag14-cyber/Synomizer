// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
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

// User-authorized vocabulary metadata, not an embedded copy of the ASD dictionary.
struct VocabularyEntry {
  std::string term;
  std::string pos;
  std::string meaning;
  std::string category = "general"; // general, technical-noun, technical-verb, name, title
};
struct StandardFinding {
  std::string code, severity, message, evidence;
  std::size_t sentence = 0; // 1-based; zero means document-wide.
};
struct StandardMetrics {
  std::size_t sentences = 0, words = 0, longest_sentence = 0, long_sentences = 0;
  std::size_t possible_passives = 0, unlisted_words = 0;
};
struct RuleAssessment {
  std::string standard, rule, method, result, note;
};
struct ConformityAssessment {
  std::string decision = "blocked";
  bool release_allowed = false, conformity_verified = false, strict_requested = false;
  std::string source_sha256, draft_sha256;
  std::string invariant_check = "not-run"; // Selected markers only, not semantic verification.
  std::vector<std::string> blockers;
  // A rule identifier inventory is not evidence that a rule was verified.
  std::vector<RuleAssessment> requirements;
};
// Separate review perspectives on the same draft, not sequential rewrites.
struct StandardScreen {
  std::string standard, profile, counting_basis, draft_sha256;
  std::size_t sentence_target = 25;
  StandardMetrics before, after;
  std::vector<StandardFinding> findings;
};
struct ContextField { std::string value, origin, evidence; };
struct ContextHint { std::string standard, note, evidence; };
struct ContextProposal {
  std::optional<ContextField> audience, purpose, text_type;
  std::vector<std::string> terms;
  std::vector<ContextHint> review_hints;
  bool sampled = false;
};
struct AutomaticContext {
  std::string method = "rules-v1", status = "inferred-not-verified", source_sha256, genre;
  ContextField audience, purpose, text_type;
  std::vector<std::string> terms, warnings;
  std::vector<ContextHint> review_hints;
  bool sampled = false;
};
[[nodiscard]] AutomaticContext infer_context(std::string_view text);
struct StandardsReport {
  std::string profile, text_type, status = "review-required", audience, purpose;
  std::size_t sentence_target = 25, vocabulary_entries = 0;
  // Screening counts and local grammar cues are NOT a complete conformance assessment.
  bool estimated_counts = true, semantic_equivalence_verified = false;
  StandardMetrics before, after;
  std::vector<StandardFinding> findings;
  ConformityAssessment conformity;
  std::vector<StandardScreen> screens;
  std::optional<AutomaticContext> automatic_context;
};
[[nodiscard]] std::vector<VocabularyEntry> parse_vocabulary(std::string_view tsv);

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
  // Standards mode is separate from variation; it returns one deterministic draft.
  std::string profile = "variation"; // variation, ste, plain, combined
  std::string text_type = "description"; // description, procedure
  bool check_only = false;
  std::string audience = {}, purpose = {};
  std::vector<VocabularyEntry> vocabulary = {};
  bool require_conformity = false; // Withhold release when complete assessment is unavailable.
  bool structured_lists = true; // Preserve conjunctions while formatting supported enumerations.
  bool auto_context = false;
  std::optional<ContextProposal> auto_proposal = {};
};

struct Result {
  std::string text;
  std::vector<Change> changes;
  std::optional<StandardsReport> standards;
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
