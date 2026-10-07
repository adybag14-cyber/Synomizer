# Contributing to Synomizer

Keep the C++ reference engine and JavaScript browser port behaviourally identical. Prefer a small, demonstrably appropriate change over increasing substitution counts.

## Rules and word lists

`data/lexicon.tsv` contains four tab-separated columns: lemma (or `@group`), part of speech (`noun`, `verb`, `adj`, `adv`), pipe-separated synonyms/members, and a flag (`free`, `careful`, `manner`, `mass`, `quant`, `time`, `event`, `disagreement`). A group expands in both directions; this is only appropriate when **every** member fits the supported context. A thesaurus relationship alone is not enough. Use directed rows, narrower context rules, or no substitution when senses or grammatical frames differ.

`free` means eligible at standard intensity, not universally safe. `careful` is eligible only at intensity 2. `manner` entries may be candidates for the separately guarded adverb moves. `mass`, `quant` and `time` have additional grammatical restrictions. `event` verbs need a supported event-object frame. `disagreement` restricts polysemous argument/dispute senses. Add matching C++ and JavaScript handling for new flags.

`data/phrases.txt` contains one protected fixed expression per line. Blank lines and `#` comments are ignored. Use lowercase English phrases. User-provided protected terms are separate from this curated list.

`data/rephrases.tsv` has four tab-separated columns: exact lowercase source phrase, target phrase, position (`edge` or `tail`), and minimum intensity (`0` or `1`). Edge rules require an introductory adjunct followed by a comma or a final adjunct. Tail rules match only at the end. Each match must pass the same token, scope, protection and predicate checks in `src/phrases.cpp` and `docs/engine.js`; emitted phrase tokens are not rewritten again in that pass. Test negative cases for attachment, protected fragments, nominal uses and quoted text.

Only contribute original or appropriately licensed data. Do not scrape and copy proprietary dictionaries. Preserve the Apache-2.0 licence and SPDX notices.

## Regression requirements

Add a positive example and a near-miss/negative example for each rule. Test unchanged quotations, names, numbers, punctuation and whitespace as applicable. An output matching in both engines is not proof of correctness: include an independent expected result or protected-span assertion. Test multiple seeds and all relevant modes. Every variation candidate must start from the original, preserve restrictions, fit the twelve-candidate budget, and replay exactly from its exported options. Never invent duplicate results to fill three slots. Lexical diversity is not semantic validation.

`tests/variations.test.mjs` checks complete native/browser batches, options and change logs. `tests/test_variations.cpp` exercises the public API under normal and sanitizer builds. `tests/web/variations.spec.mjs` covers selection, every card's exports, batch exports, stale requests, protections, mobile layout and full long-text ledgers.

Build the native tool, run CTest and `npm test`, then `npm ci` and `npm run test:web` for UI changes (install Playwright browsers first). CI also checks native platforms and sanitizers. Do not loosen an assertion merely to accept an ungrammatical or meaning-changing rewrite.

Changing the lexicon or algorithm can change seeded output between versions. Update the changelog and regenerate any documented sample output. Never claim universal semantic equivalence from this rule-based implementation.

## Site development

Edit `docs/` and `data/`, not generated `site/`. Run `npm run build:site` before serving the site. The Web Worker must be deployed beside the page and engine. Keep user text local, use text nodes or escaping for untrusted content, and avoid storing text or loading third-party resources without an explicit product decision.

Text files use UTF-8 and LF line endings. Keep generated build directories, test reports and screenshots out of source control; CI artifacts preserve test evidence.
