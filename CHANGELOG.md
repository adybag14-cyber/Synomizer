# Changelog

## 1.2.1 - 2026-10-07

- Reconcile the parallel three-result implementation with merged 1.2.0, preserving `Style`, `rewrite_variants`, `--variants`, `--style`, audited head/object contexts, phrase indexes, transition rules and existing regression coverage.
- Show complete text in all three simultaneous cards; provide independent copy/text/JSON downloads and selection-specific full ledgers. Add complete reproduction options to downloaded results while retaining the batch export keys.
- Strengthen obsolete-worker cancellation and all-card stale-export protection. Bound long-text highlight/ledger rendering without truncating result text or exported changes.
- Add 23 shared, position- and intensity-guarded manner/frequency adjunct rules; preserve Light touch's no-phrase/no-rearrangement behaviour.
- Extend Recast medial-adverb movement to supported simple noun-subject clauses, with seeded front/end placement and independent positive/negative regressions.
- Expand analytic comparative forms, fix singular/plural aircraft selection using explicit number cues, and add guards for help complements, propose-to, try senses, recalls, intransitive decline, noun/verb ambiguity, nominal adjectives, quantity-little and logical arguments.
- Add event-object vocabulary and technical/fixed-expression protections without weakening the merged head/object restrictions.
- Retain and port both three-result UI test suites; add independent all-candidate grammar/phrase assertions and native bounded stress checks. Include the new dictionary in all ten fingerprinted deployment assets.
- Preserve the original Apache-2.0 licence and local-only text processing.

## 1.2.0 - 2026-10-07

- Offer three simultaneous Balanced, Light touch and Restructured candidates with selection-specific text, ledger, copy/download and complete batch JSON export.
- Generate candidates from the original using bounded, deterministic profile/diversity search, exact deduplication and honest fewer-result handling. Never relax protection or intensity to fill a quota.
- Add the C++ `rewrite_variants` API and CLI `--variants` / `--style`, recording reproducible unsigned 64-bit seeds and profiles.
- Add audited head/object-context vocabulary, phrase alternatives, guarded medial manner-adverb moves, comparative phrases and irregular verb/invariant plural support.
- Guard food/non-food consumption, passive beneficiary frames, infinitival help, academic doctor and anatomical pupil senses; protect additional idioms and technical collocations. Remove the unsound recently/lately interchange.
- Index native lexical and native/browser phrase lookups, fast-path disabled/single-result batches, and use a smaller deterministic candidate budget for long passages. Cancel obsolete workers and explicitly cap only card previews rather than exported text.
- Add batch parity, independent grammar/preservation assertions, native API compatibility, lexicon schema and cross-browser selection/export regressions. Preserve the 1.1.1 CI/deployment verification and Apache-2.0 licence.

## 1.1.1 — 2026-10-07

- Reconciled supplemental hardening with the concurrently merged 1.1.0 implementation; retained protected terms, cancellable workers, the documented newline contract, and the complete existing validation suite.
- Guarded degree-adverb scope, line-wrapped clauses, infinitive and object-complement frames, predicative-only adjectives, and protected-name capitalization during rearrangement.
- Fixed a/an after coordinated-adjective movement and preserved parentheses in plain URLs.
- Added supplementary deterministic, native/browser, native sanitizer, long-document and real-browser regression coverage.
- Added installable versioned CLI ZIP packages and static MinGW linking.
- Fingerprinted all deployed assets; Pages now publishes the exact browser-tested artifact and verifies the live commit and hashes after deployment.

## 1.1.0 — 2026-10-07

### Rewriting safety

- Protect quotations before sentence splitting, including nested, multiline and curly quotations.
- Preserve opaque URLs, email addresses, code, common identifiers, Markdown links and HTML tags.
- Preserve mixed Unicode words, number/unit tokens, possessives, capitalization and paragraph layout.
- Block risky negation/focus, reference-sensitive and embedded-clause rearrangements.
- Use immutable grammar context and recognize participles across intervening adverbs.
- Remove unsound synonym groups and extend the protected idiom/technical-collocation list.
- Add whole-word/phrase term protection in the C++ API, CLI and browser.

### Command line

- Strict unsigned 64-bit seed and intensity validation; reject conflicting modes and input sources.
- Add `--json`, `--no-rewrite`, `--protect`, explicit stdin `-`, and option termination `--`.
- Handle UTF-8 Windows command-line arguments and filenames; report output failures.
- Normalize both CRLF and standalone CR to LF.

### Editor

- Move rewriting to a cancellable Web Worker with stale-result suppression and resource-load recovery.
- Add another variation, UTF-8 file import, plain-text download and JSON change-log export.
- Add protected terms, limits, counters, keyboard shortcuts, error states and responsive controls.
- Keep the paper-and-ink design; remove external fonts and retain in-memory-only text handling.

### Engineering

- Expand cross-engine, safety, CLI, Unicode, long-input and browser regression coverage.
- Test native Linux, Windows and macOS builds, sanitizers and four browser projects in CI.
- Gate Pages deployment on all checks; publish executable and browser-report artifacts.
- Automatically rebuild embedded dictionaries when source data changes.
- Add reproducible site assembly and commit-identifying `version.json`.

## 1.0.0 — 2026-10-07

- Initial C++23 engine, curated word lists and GitHub Pages editor.
- Browser/native comparison tests and Apache-2.0 licensing.
