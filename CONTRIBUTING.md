# Contributing

Keep Synomizer a dependency-light C++23 tool and a local browser editor. Preserve Apache-2.0 licensing and document any new third-party data's provenance and compatible license before importing it.

## A rule change needs an example

1. Add a case to `tests/regressions.json` with `input`, optional `options`, and one or more of `expected`, `keep`, `absent`, or `different`. Use meaningful grammar, not only implementation parity. A bug reproduced identically by both engines is still a bug.
2. Implement the same rule in `src/` and `docs/engine.js`. Preserve names, numbers, literals, inflection, and meaning wherever the rule is known to apply. Abstain when the context is ambiguous. Do not add lexical substitutions merely to maximise change count.
3. Build the native reference, run CTest and `npm test`, assemble the site, and run both browser suites. For scanner, inflection, or memory-safety changes, add native assertions to `tests/test_engine.cpp` so sanitizer runs cover the case directly.
4. Document changes to the CLI contract, privacy behaviour, seeded output, or limits. Never claim that lexical overlap or native/browser parity proves semantic equivalence.

## Lexicon review

Check the source and target words in attributive and predicative positions, singular/plural and tense forms, transitive/intransitive and object-complement frames, and required prepositions. Test literal and idiomatic senses. Keep uncertain mappings out of the default mode or omit them entirely. Protected phrases match words separated by whitespace; punctuation is not silently crossed.

## UI and deployment

`docs/` contains authored assets; `tools/build-site.mjs` assembles `site/`. Do not commit generated build directories, browser profiles, test artifacts, or user-provided text. Do not add remote text-processing services or persistence without an explicit product decision. The Pages workflow must publish the exact artifact that passed tests and keep deployment gated on every required job.
