# Changelog

## 1.2.0 - 2026-10-07

### Three simultaneous variations

- Generate up to three distinct results from an unchanged original in both C++ and JavaScript. Search at most twelve seeded candidates without escalating intensity or relaxing protections.
- Remove exact duplicate and unchanged padding. Keep the changed base result first and select alternatives for lexical bigram diversity, without asserting a semantic-quality score.
- Add three responsive result cards, independent copy/text/JSON exports, selection with a matching ledger, and a complete batch export including the original and exact reproduction options.
- Add `rewrite_variations`, `--variants`, `--density` and `--mixed-moves`. Preserve the existing single-result format when `--variants` is absent.
- Terminate obsolete searches on edits, ignore retired worker messages and disable every stale export. Long results retain full text with bounded highlight and ledger rendering.

### Stronger engine

- Add 23 shared phrase rules for guarded manner/frequency adjuncts, with explicit intensity, phrase boundaries, scope checks and independent change records.
- Add a seed-selectable pre-verbal manner-adverb move for simple clauses.
- Retain comparative and superlative degree with curated analytic forms, and handle invariant aircraft plurals with explicit number cues.
- Expand curated vocabulary and event-object verb substitutions. Strengthen help-complement, propose-to, try/attempt, decline, recall, predicative-adjective, logical-argument, nominal-adjective, quantity-little and noun/verb context checks.
- Expand protected technical and fixed expressions. Index lexicon lookups and stop copying/sorting protected phrases on each sentence.

### Validation

- Add direct native API invariants and bounded stress tests, full batch parity and replay tests, positive/negative grammar and phrase cases, and all three-result browser workflows.
- Retain cross-platform native, sanitizer and four-browser deployment gates. Fingerprint the phrase-rewrite table in the exact browser-tested Pages artifact.
- Preserve the original Apache-2.0 licence and local-only browser text processing.

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
