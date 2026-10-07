# Changelog

## 1.1.0 — 2026-10-07

### Completed
- Worker-backed private editor with UTF-8 import, TXT export, full JSON change ledger, next variation, clear, loading retry, and accessible responsive controls.
- Strict CLI parsing, JSON output, explicit disabled passes, stdin/stdout markers, Unicode Windows arguments and paths, checked file I/O, and installable packaged executables.
- Shared native/browser safety corpus, generated differential cases, long-document tests, and real-browser acceptance with screenshots and traces.
- Linux, Windows, and macOS CI; Linux sanitizer tests; gated deployment of the exact tested Pages artifact and live asset-hash verification.

### Corrected
- Quotation and URL corruption, mixed Unicode word splitting, numeric identifier replacement, negation/adverb scope changes, unsafe complement substitutions, and article agreement after adjective movement.
- Stale embedded lexicon data after incremental builds, unsafe JavaScript seed rounding, stale UI exports, mojibake UI labels, and main-thread long-text processing.
- Removed non-equivalent synonym groups and expanded protected idioms and technical collocations.

### Compatibility
- Native line endings are now preserved rather than stripping carriage returns.
- CLI numeric arguments must parse completely. Conflicting *-only flags now return an error; use --no-synonyms --no-arrange for a no-op.
- Safer rules and data change some seeded outputs from 1.0.0. Semantic equivalence still requires human review.
