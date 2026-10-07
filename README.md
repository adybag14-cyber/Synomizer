# Synomizer

**Three ways to say it, from one unchanged original.** Synomizer is an Apache-2.0 C++23 English rewriter with a local-processing [GitHub Pages editor](https://adybag14-cyber.github.io/Synomizer/). It uses curated synonyms, grammatical context checks, phrase rewrites and conservative sentence moves, not a language model or rewriting service.

**Review the meaning before using a result.** These are mechanical heuristics, not a semantic parser. No intensity guarantees perfect grammar, identical meaning or an appropriate register in every context. Technical, legal, medical and publication-ready text needs particular care. Leaving text unchanged is preferable to forcing an unsuitable variation.

## Three-result browser editor

Paste or import UTF-8 text and choose **Create 3 variations**. Your original stays above the results. Up to three distinct, complete rewrites appear simultaneously: side by side on desktop and stacked on a phone. Each card has its own copy, plain-text download, JSON change log, exact seed, edit rate and change counts.

**Use this** selects a version for the shared change ledger and selected-result export controls. It never overwrites your original. **New set** advances the base seed and generates another batch from that same original, never from a previous rewrite. **Download all variations** saves the original and every result, with complete settings and change records, in one JSON file.

The generator considers at most twelve candidates. It preserves the chosen intensity, quotation protection and protected terms, while varying synonym choices, the fraction of eligible edits applied and which eligible sentence moves are used. Exact duplicate results are removed. The changed base result stays first, and alternatives are chosen using differences in word-pair patterns. This is a **lexical-diversity heuristic, not a semantic-quality ranking**; no unsupported quality score is assigned.

A short or heavily protected passage may allow only one or two distinct rewrites. Those are shown without duplicate padding. When no rule fits, a single unchanged result is shown rather than inventing a paraphrase. This bounded search is not an exhaustive enumeration of all possible wording, and different base seeds can still find some of the same results.

### Controls and limits

The editor has independent synonym/phrase and sentence-move switches, three intensity levels, quotation protection and a protected-terms field. Enter one term per line to retain names and specialist wording. Matching uses ASCII case folding and whole-word boundaries, with literal spacing inside a phrase. A sentence containing a matched term is not rearranged.

Generation runs in a cancellable Web Worker. The browser accepts up to **200,000 characters**, and up to 200 protected terms of at most 200 characters each. Editing during generation terminates the obsolete search; invalid input disables every stale export. `Ctrl/Cmd + Enter` requests a new batch.

Text is never truncated. For results longer than 50,000 characters, inline highlighting is omitted to keep rendering responsive; the full change log is still exportable. The visible ledger is paginated in groups of 250 changes. Use the C++ CLI for longer files.

### Privacy and implementation

Text is processed locally. The app has no accounts, analytics, external fonts or rewriting API calls and does not save text or settings after a reload. The page and three dictionary files are initially fetched from GitHub Pages; normal hosting access logs still apply. Importing a file does not upload it. The all-variations JSON includes the original text, so share it only when you intend to share the original.

The browser engine is JavaScript, **not a native C++ executable or WebAssembly build**. It mirrors the C++ reference rules and reads the same versioned dictionaries. Tests compare complete result batches, settings and change logs between both implementations.

## Build the C++23 tool

Use CMake 3.20 or newer and a C++23-capable toolchain. Node is needed only for parity tests and site development, not the native executable.

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --parallel 2
ctest --test-dir build -C Release --output-on-failure
```

Executables are normally `build/synomizer` on Unix, `build/synomizer.exe` with MinGW/Ninja, or `build/Release/synomizer.exe` with Visual Studio. CI builds Linux x64, Windows x64 and macOS ARM64 executables and versioned ZIP packages with the licence and documentation. Windows packages use a static C++ runtime.

```sh
cmake --install build --config Release --prefix ./install
cpack --config build/CPackConfig.cmake -C Release -G ZIP -B packages
```

The native executable embeds the lexicon, protected-expression list and phrase-rewrite table. It needs neither a network connection nor external dictionary files at runtime. Editing any of the three data files triggers CMake reconfiguration on the next build.

## Command-line use

```sh
# Three distinct alternatives with exact reproduction settings
./build/synomizer --variants 3 --json examples/sample.txt

# Existing single-result output
./build/synomizer --seed 1 examples/sample.txt

# Preserve specialist wording and save three results
./build/synomizer --variants 3 --protect "control group" \
  --protect "Alice" --output variations.txt passage.txt

# Explain each operation on stderr
./build/synomizer --show-changes --text "They purchased a car."

# Exact 64-bit seed; explicit stdin
printf 'The happy child bought a car.\n' | \
  ./build/synomizer --variants 3 --json --seed 18446744073709551615 -
```

On Windows, substitute the executable path for your generator.

| Option | Behaviour |
| --- | --- |
| `--variants N` | Request 1, 2 or 3 distinct results; omit for the existing single-result format. |
| `--seed N`, `-s N` | Unsigned decimal integer from 0 to 18446744073709551615; default 1. |
| `--intensity 0`, `-i 0` | Light: eligible adjectives, manner adverbs and manner-phrase rewrites. |
| `--intensity 1` | Standard: also eligible nouns, verbs, other adverbs and frequency phrases; default. |
| `--intensity 2` | Broader: also narrower or register-sensitive entries; review carefully. |
| `--density N` | Apply approximately N percent of eligible word/phrase edits, from 0 to 100; default 100. Does not make riskier synonyms eligible. |
| `--mixed-moves` | Apply a seeded subset of eligible sentence moves. |
| `--synonyms-only` | Keep sentence order; word and phrase rewrites remain enabled. |
| `--arrange-only` | Do not substitute words or phrases. |
| `--no-rewrite` | Disable both operations, retaining line-ending normalization. |
| `--protect TEXT` | Protect a whole word or phrase; repeat as needed. |
| `--vary-quotes` | Permit word substitutions inside quotations; their structure does not move. |
| `--show-changes` | Explain changes on stderr, grouped by variation for batches. |
| `--json` | Export exact options, rewritten text and structured changes. |
| `--text TEXT` | Use inline text instead of a file or stdin. |
| `--output FILE`, `-o FILE` | Write to a file instead of stdout. |
| `--` | End option parsing, allowing filenames beginning with `-`. |
| `--help`, `--version` | Display usage or version. |

No filename, or `-`, reads stdin. Input and output are UTF-8. CRLF and standalone CR normalize to LF; paragraph breaks and other layout are retained. Invalid numbers, contradictory modes, conflicting input sources and I/O errors return a nonzero exit code.

Without `--variants`, JSON contains `version`, string-valued `seed`, `options`, `text` and `changes`. With `--variants`, it contains `version`, `requested`, `candidatesConsidered` and a `variations` array of those individual objects. Explicit `--variants 1` still uses the batch envelope. Seeds are strings to avoid precision loss in JSON consumers.

To reproduce a chosen result, use the **original text and all of that result's options**, including its seed, density, movement settings, intensity and protected terms. The base seed identifies a batch, not every individual result. Seed arithmetic wraps at the unsigned 64-bit limit. Reproducibility applies within a particular engine/data version; upgrading the rules can change seeded output.

## What makes the engine context-aware

The engine checks local part-of-speech cues, supported grammatical frames, verb tense and participles, number, comparative/superlative degree, capitalization and adjacent `a`/`an`. Word-level grammatical decisions use a snapshot of the sentence before synonym substitution, rather than already replaced neighbouring words.

Conservative clause, manner-adverb and coordinated-adjective moves supply structural variation. A guarded pre-verbal adverb rule can turn `The teacher carefully examined the report.` into `The teacher examined the report carefully.` at seed 1 or `Carefully, the teacher examined the report.` at seed 2 with synonyms disabled.

Phrase rewrites use `data/rephrases.tsv`. They match exact unprotected wording in supported introductory or final adjunct positions, with checks for negation, focus, embedded clauses, punctuation and predicate context. For example, `She worked in a careful manner.` becomes `She worked carefully.`, and `On a daily basis, she studied.` becomes `Daily, she studied.` A final `carefully` can also become `with care`. Each phrase edit is independently logged. Word counts may change.

Supported analytic comparatives and superlatives retain degree instead of inventing invalid suffixes: `happier` can become `more cheerful`. The invariant noun `aircraft` is rewritten only when supported cues establish singular or plural number. Context checks retain unsupported senses and frames of try/attempt, propose/suggest, help/assist, product recalls, logical arguments and event-object verbs. Lexicon lookups are indexed, and protected phrases are ordered once rather than copied and sorted for each sentence.

| Input | Example behaviour |
| --- | --- |
| `They purchased a car.` | `They bought an automobile.` at seed 1. |
| `They have already selected a car.` | Keeps the participle `have already chosen`, not `have already chose`. |
| `She is happier today.` | `She is more cheerful today.` at seed 1. |
| `She helped the child learn English.` | Keeps `helped`; never applies the unsupported `assisted the child learn` frame. |
| `They finished the project.` | Can become `They completed the project.`; `finished the soup` stays unchanged. |
| `The aircraft were ready.` | `The airplanes were prepared.` at seed 1, preserving plural agreement. |
| `The students question the result.` | Keeps the verb `question`, rather than substituting the noun `inquiry`. |
| `It was an honest mistake.` | Keeps the idiom, instead of `a truthful error`. |
| `They did not leave because the road was icy.` | Does not move the ambiguous negated cause. |
| `https://happy.com/car` or `happy@car.com` | Keeps the address intact. |

### Protection and limitations

Straight and curly quotations, including nested and multiline quotations, are protected by default. URLs, email addresses, common paths/identifiers, alphanumeric units, inline and fenced code, Markdown links and HTML tags are opaque spans. Mixed/non-ASCII words are retained rather than partially rewritten. This is a plain-text rewriter, not a full HTML/Markdown parser.

Numbers, acronym-like all-caps words, title-case headings and many capitalized names are retained. Name recognition remains heuristic, especially at the beginning of a sentence; use protected terms for names that must not change. Possessives and contractions are conservatively preserved. Fixed expressions and technical collocations are protected through `data/phrases.txt`.

Sentence moves are skipped for uncertain negation/focus scope, embedded clauses, reference-sensitive third-person clauses, questions, complex punctuation and protected terms. The rules cannot recognize every ambiguity. Unlisted idioms, synonym senses, register, emphasis and domain-specific meanings can still drift. More alternatives do not establish semantic equivalence.

## Library APIs

Link `synomizer-lib` and include `synomizer/engine.hpp`:

```cpp
#include <synomizer/engine.hpp>

synomizer::Options options;
options.seed = 42;
options.intensity = 1;
options.protected_terms = {"control group", "Alice"};
const std::string original = "The careful teacher helped the happy children.";
const auto batch = synomizer::rewrite_variations(original, options, 3);
for (const auto& variant : batch.variations) {
  // variant.result.text and variant.result.changes
  const auto replay = synomizer::rewrite(original, variant.options);
}
```

C++ integer intensity and density are clamped to 0-2 and 0-100. `Options::mixed_moves` enables a subset of eligible moves. Variation counts outside 1-3 throw `std::invalid_argument`. Change kinds are `Synonym`, `Arrangement`, `Article` and `Phrase`.

The JavaScript module exports `loadResources(lexiconTsv, protectedPhrasesText, rephrasesTsv)`, `rewrite(input, options, resources)` and `rewriteVariations(input, options, resources, count = 3)`. Load all three data files to match the full native engine; the legacy two-argument loader omits phrase rewriting. Browser options use `protectedTerms`, `protectQuotes` and `mixedMoves`.

A browser batch is `{requested, candidatesConsidered, variations: [{result, options}, ...]}`, where `result` includes `text`, `changes` and renderable `parts`. The CLI and downloaded JSON flatten each result's text and changes into its item. Input options are not mutated, and each result has an independent options copy. Unsafe numeric seeds and non-integer densities are rejected; use a decimal string or bigint for seeds above JavaScript's safe integer range.

## Development and testing

Node 22 or newer is required for development. Playwright is pinned as a development-only dependency; the client has no third-party runtime packages.

```sh
npm ci
# Build the C++ reference first, then:
npm test
npx playwright install chromium firefox webkit
npm run test:web

# Independent local preview, not during Playwright's managed server:
npm run build:site
npm run serve
# http://127.0.0.1:4178/Synomizer/
```

`npm test` covers cross-engine text/change/option parity, deterministic batch selection and replay, unique results, bounded searches, positive and negative grammar/phrase cases, Unicode, protected spans, CLI errors, site integrity and long passages. Set `SYNOMIZER_BIN` when the executable is outside the usual build locations.

Playwright manages its own server under the real `/Synomizer/` subpath and runs Chromium, Firefox, WebKit and mobile Chromium. Tests cover all card exports, selected ledgers, batch downloads, duplicate suppression, protection settings, missing dictionaries, stale requests, markup injection, 64-bit seed wrapping, narrow layouts and full long-text logs. Screenshots and failure traces are retained as workflow artifacts. Set `PLAYWRIGHT_BASE_URL` to a deployed URL with a trailing slash to test production instead.

Pages deployment is gated by native builds on three platforms, AddressSanitizer/UndefinedBehaviorSanitizer and all browser projects. `scripts/build-site.mjs` creates `site/`, `version.json` and `build.json`, including SHA-256 hashes of all ten deployed assets. Pages deploys the exact browser-tested artifact and checks its live source commit and hashes. The repository's Pages source must be **GitHub Actions**.

## Contributing and licence

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md). The original [Apache-2.0 licence](LICENSE) is retained. Copyright 2026 adybag14-cyber.
