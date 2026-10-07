# Synomizer

**Thoughtful variations, not random replacements.** Synomizer is a C++23 command-line tool and library, with a static [GitHub Pages editor](https://adybag14-cyber.github.io/Synomizer/), for varying English prose using a curated lexicon, grammatical inflection and conservative sentence moves.

The same text, seed, options **and engine/word-list version** produce the same output. It is useful for passages of about 100 words, and processes longer text sentence by sentence. It does not call a language model or a rewriting service.

**Review the result.** These are mechanical rules, not a semantic parser. No intensity level guarantees perfect grammar, identical meaning or a suitable register for every context. Technical, legal, medical, quoted and publication-ready writing needs particular care. Leaving a sentence unchanged is preferable to forcing an unsuitable variation.

## Browser editor

[Open Synomizer](https://adybag14-cyber.github.io/Synomizer/).

Paste or import a UTF-8 `.txt` or `.md` file. The original stays on the left; the rewrite, highlighted substitutions and change ledger appear alongside it. **Another variation** increments the seed and always rewrites the original, not the previous result. Copy the result, download a plain-text file, or export the structured JSON change log.

The controls include independent synonym and sentence-move switches, three intensity levels, quotation protection, and a **protected-terms** field. Enter one word or phrase per line to keep names and specialist terminology unchanged. Matching is case-insensitive and whole-word, with literal spacing inside a phrase; a sentence containing a matched term is not rearranged.

Processing happens in a cancellable Web Worker. The browser accepts up to **200,000 characters**, and up to 200 protected terms of at most 200 characters each. Longer files can use the native CLI. Invalid input clears the obsolete result and disables exports instead of silently copying an older rewrite. `Ctrl/Cmd + Enter` runs a rewrite.

### Privacy

Text is processed locally in the browser. There are no accounts, analytics, external fonts or rewriting API calls. Text and settings are not saved by the app after a reload. The page and its word lists are initially fetched from GitHub Pages, and normal hosting access logs still apply. Importing a text file does not upload it. Downloaded files contain the result and, for JSON, the selected options and change records.

The browser implementation is JavaScript, **not a native C++ executable or WebAssembly build**. It mirrors the C++ reference rules and reads the same versioned data files. Cross-engine tests compare both rewritten text and complete change records, including full-width 64-bit seeds.

## Build the C++23 tool

Use CMake 3.20 or newer and a C++23-capable compiler/toolchain. Node is only needed for parity tests and site development, not for the native executable.

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --parallel 2
ctest --test-dir build -C Release --output-on-failure
```

The executable is `build/synomizer` on a single-configuration Unix build, `build/synomizer.exe` with MinGW/Ninja on Windows, or `build/Release/synomizer.exe` with Visual Studio. The CI workflow builds on Linux, Windows and macOS, and uploads native executables with the licence and documentation as workflow artifacts. Windows MSVC builds use the static C++ runtime.

Optional installation:

```sh
cmake --install build --config Release --prefix ./install
```

The native executable embeds the lexicon and phrase list and does not need a network connection or external dictionary files at runtime. Changing either data file automatically triggers CMake to reconfigure on the next build.

## Command-line use

```sh
# File input; rewrite on stdout
./build/synomizer --seed 1 examples/sample.txt

# Protect an important term and save the result
./build/synomizer --protect "control group" --protect "Alice" \
  --output rewritten.txt passage.txt

# Explain the edits on stderr
./build/synomizer --show-changes --text "They purchased a car."

# Machine-readable result with exact seed precision
./build/synomizer --json --seed 18446744073709551615 passage.txt

# Explicit stdin
printf 'The happy child bought a car.\n' | ./build/synomizer -
```

On Windows, substitute the executable path appropriate to your CMake generator.

| Option | Behaviour |
| --- | --- |
| `--seed N`, `-s N` | Unsigned decimal integer from 0 to 18446744073709551615; default 1. |
| `--intensity 0`, `-i 0` | Light: eligible adjectives and manner adverbs only. |
| `--intensity 1` | Standard: also eligible nouns, verbs and other adverbs; default. |
| `--intensity 2` | Broader: also narrower/register-sensitive entries. Review carefully. |
| `--synonyms-only` | Do not rearrange sentences. |
| `--arrange-only` | Do not substitute words. |
| `--no-rewrite` | Disable both operations, retaining line-ending normalization. |
| `--protect TEXT` | Protect a whole word or phrase. Repeat as needed. |
| `--vary-quotes` | Allow substitutions inside quotations; their structure still does not move. |
| `--show-changes` | Write each change to stderr. |
| `--json` | Write version, string-valued seed, rewritten text and structured changes as JSON. |
| `--text TEXT` | Use an inline passage instead of a file or stdin. |
| `--output FILE`, `-o FILE` | Write to a file instead of stdout. |
| `--` | End options, for example before a filename beginning with `-`. |
| `--help`, `--version` | Show usage or version. |

No filename, or `-`, reads stdin. Files and text are UTF-8. CRLF and standalone CR line endings normalize to LF; paragraph breaks and other layout are retained. Invalid numbers, contradictory rewrite modes and conflicting input sources return a nonzero exit code. JSON seeds are strings so JavaScript consumers cannot lose precision. File read/write errors are reported on stderr.

## What the rules do

Substitutions are selected using a deterministic 64-bit hash. The engine checks local part-of-speech cues, grammatical frames, verb tense, participles, plural forms, supported comparative/superlative forms, capitalization, and adjacent `a`/`an` articles. Grammar decisions use the original sentence context, not already substituted words. A limited set of clause, manner-adverb and coordinated-adjective moves supplies structural variation.

Some examples:

| Input | Behaviour |
| --- | --- |
| `They purchased a car.` | `They bought an automobile.` at seed 1. |
| `They have already selected a car.` | Keeps the participle: `have already chosen`, not `have already chose`. |
| `Because the road was icy, the bus arrived late.` | The clause can move to the end. |
| `They did not leave because the road was icy.` | Does not move the ambiguous negated cause. |
| `It was an honest mistake.` | Keeps the idiom rather than producing `a truthful error`. |
| `The child was alone.` | Keeps `alone`, never substitutes the ungrammatical `solely`. |
| `https://happy.com/car` or `happy@car.com` | Keeps the address intact. |

### Protection and deliberate omissions

Straight and curly quotations, including nested and multiline quotations, are protected by default. URLs, email addresses, common paths/identifiers, alphanumeric units, inline and fenced code, Markdown links and HTML tags are treated as opaque spans. Mixed/non-ASCII words are kept intact rather than partially rewritten. This is a plain-text rewriter, not an HTML or Markdown parser; render structured documents with their own format-aware tooling.

The engine retains numbers, acronym-like all-caps words, title-case headings and many capitalized names. Name recognition is heuristic, especially at the start of a sentence: use protected terms when a name must not change. Possessives and contractions are conservatively retained. Curated fixed expressions, phrasal verbs and technical collocations are protected through `data/phrases.txt`.

Sentence moves are skipped for uncertain negation/focus scope, embedded clauses, reference-sensitive third-person clauses, questions, complex punctuation and protected spans. Recognizing all ambiguity is beyond these rules. Synonym senses, idioms not in the phrase list, register, emphasis and domain-specific meanings can still drift. Different seeds can also produce the same result when no alternatives fit.

## Sample

The 97-word passage in `examples/sample.txt`, at seed 1 and standard intensity in version 1.1.0:

> The cautious instructor assisted the cheerful youngsters. The class commenced the project late because the weather was chilly. She quietly clarified the primary concept, and the learners were happy to help. They bought a little automobile for the school journey and swiftly located the correct route. The tranquil doctor said the weary lad was healthy. The group stayed joyful although the trip was long. The author described the ultimate outcome in a truthful report. When the assembly ended, the throng was hushed. The local learners located a helpful reply and stayed tranquil. It was a little triumph.

Inspect the change ledger or use `--show-changes` to review individual operations. The number of words is not forced to remain fixed.

## Library API

Link the CMake target `synomizer-lib` and include `synomizer/engine.hpp`:

```cpp
#include <synomizer/engine.hpp>

synomizer::Options options;
options.seed = 42;
options.intensity = 1;
options.protected_terms = {"control group", "Alice"};
const auto result = synomizer::rewrite("The happy child bought a car.", options);
// result.text; result.changes (kind, before, after, detail)
```

The public API clamps integer intensity values to the range 0–2. The browser API rejects unsafe numeric seeds; pass a string or bigint for values above JavaScript's safe integer range.

## Develop and test the site

Node 22 or newer is required. The client has no third-party runtime packages; Playwright is a development-only dependency pinned by `package-lock.json`.

```sh
npm ci
# After building the C++ tool:
npm test

npm run build:site
npm run serve
# Open http://127.0.0.1:4178/Synomizer/

npx playwright install chromium firefox webkit
npm run test:web
```

`npm test` includes deterministic cross-engine comparisons, semantic-safety regression examples, CLI rejection/error cases, Unicode arguments and filenames, protected terms, JSON escaping and long-text checks. Set `SYNOMIZER_BIN` when your executable is outside `build/synomizer`, `build/synomizer.exe` or `build/Release/synomizer.exe`. The standard Visual Studio Release path is detected automatically.

Playwright starts and stops its own local server, tests the real `/Synomizer/` deployment subpath across Chromium, Firefox, WebKit and mobile Chromium, and records screenshots and failure traces. To test an already-deployed site instead, set `PLAYWRIGHT_BASE_URL` to its URL with a trailing slash. Do not run a separate development server on port 4178 during local Playwright tests.

GitHub Pages deployment is gated on the native matrix, sanitizer checks and browser tests. `scripts/build-site.mjs` packages the page, Web Worker and the same data files into `site/`; `version.json` records the deployed source commit. GitHub's Pages source must be configured as **GitHub Actions**, not branch publishing.

## Contributing and licence

See [CONTRIBUTING.md](CONTRIBUTING.md) for adding a narrowly scoped rule or dictionary entry, and [CHANGELOG.md](CHANGELOG.md) for changes. The original [Apache-2.0 licence](LICENSE) is retained. Copyright 2026 adybag14-cyber.
