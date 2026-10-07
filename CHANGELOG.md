# Changelog

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
