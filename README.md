# Synomizer

**Different words. Your meaning.** A C++23 command-line tool and a GitHub Pages editor for deterministic English rewriting, using a curated synonym lexicon and conservative grammatical rules rather than a language model.

[Open the browser editor](https://adybag14-cyber.github.io/Synomizer/) · [Download the CLI](https://github.com/adybag14-cyber/Synomizer/releases) · [Report a problem](https://github.com/adybag14-cyber/Synomizer/issues)

Synomizer offers alternative wording, not a proof of semantic equivalence. It leaves unsupported words and unsafe grammatical contexts unchanged. Review the change ledger: word sense, idioms, specialist terminology, register, and emphasis can still shift. A deterministic rule engine does not understand arbitrary text as a person does.

## Browser editor

Paste a passage or import a UTF-8 `.txt` or `.md` file. Choose the seed, intensity, and whether to apply synonyms, sentence moves, or both. **Next variation** increments the seed; **Sample** restores the supplied passage. Copy the rewrite, download plain text, or download the complete JSON change ledger with the original text and options.

Processing runs in a Web Worker, not on a server. There are no accounts, third-party fonts, analytics, API keys, or language-model calls. After the page and word lists load, rewriting also works without a network connection. A fresh offline page load is not supported. Your input is not persisted between visits.

The editor accepts up to **1 MiB of UTF-8 text** and displays the first 200 ledger entries for large documents; the JSON download retains every entry. Browser textareas normalise line endings to LF, and the operating-system clipboard may use its own newline convention. Use the native CLI for byte-preserving line endings or larger documents. Markdown is treated as text, not parsed as a document format; only backtick code and recognised addresses are protected as literal spans.

## Build the C++23 CLI

Use CMake 3.20 or newer and a compiler with the C++23 standard-library features used here. CI builds Linux/GCC, Windows/MSVC, and macOS/AppleClang. The engine has no third-party runtime dependency and embeds its word lists in the executable.

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --parallel 2
ctest --test-dir build -C Release --output-on-failure
```

The executable is `build/synomizer` with a single-configuration Unix generator, `build/synomizer.exe` with MinGW/Ninja, or `build/Release/synomizer.exe` with Visual Studio. Run it from that path or install it:

```sh
cmake --install build --config Release --prefix ./install
cpack --config build/CPackConfig.cmake -C Release -G ZIP -B artifacts
```

Packages include the executable, this documentation, an example, and the unchanged Apache-2.0 license. Windows packages use a static C/C++ runtime; the operating system's standard system libraries are still required. The package architecture is identified in its filename.

## Use

```sh
# The output goes to stdout; no extra newline is inserted.
./build/synomizer --seed 1 examples/sample.txt
./build/synomizer --show-changes --text "The happy child bought a car."
./build/synomizer --synonyms-only --intensity 0 --text "The careful teacher helped."
./build/synomizer --arrange-only --text "Because the road was icy, the bus arrived late."
./build/synomizer --json --output report.json examples/sample.txt
```

Without a filename or `--text`, input comes from stdin. UTF-8 input files, Windows command-line text, and Windows filenames are supported. The native engine preserves LF, CRLF, lone CR, tabs, and non-ASCII bytes outside actual rewrites. Both passes disabled give an exact input/output roundtrip. Input is held in memory; the CLI has no fixed document-size cap, but it is not a streaming engine.

| Option | Effect |
| --- | --- |
| `--seed N`, `-s N` | Unsigned decimal integer from 0 to 18446744073709551615; default 1. |
| `--intensity N`, `-i N` | 0: adjectives and manner adverbs; 1: standard lexicon; 2: also narrower vocabulary. |
| `--synonyms-only` | Disable sentence moves. |
| `--arrange-only` | Disable synonym substitutions. |
| `--no-synonyms`, `--no-arrange` | Disable either pass independently; both switches give a no-op. |
| `--vary-quotes` | Opt in to synonym substitutions inside quotations. Clause moves still avoid quotations. |
| `--show-changes` | Print each applied rule to stderr. |
| `--json` | Emit `{ "text": "...", "changes": [...] }` rather than plain text. |
| `--text TEXT` | Use literal text rather than a file or stdin. |
| `--output FILE`, `-o FILE` | Write to a file; `-` means stdout. |
| `--` | End options so a filename can begin with `-`. |
| `--help`, `--version` | Show usage or version. |

Malformed numbers, overflow, missing arguments, conflicting `--synonyms-only`/`--arrange-only`, and file errors return a nonzero status. This is stricter than version 1.0.0. In the JavaScript API, pass large seeds as strings or BigInts, never imprecise JavaScript numbers.

## What the rules do

The engine tokenises the input, freezes recognised literal spans and protected phrases, applies eligible sentence arrangements, chooses inflected synonyms deterministically, then repairs a/an when the following word changes. The seed selects among usable synonyms; it does not force a change in every sentence. Rules and data changes between versions can change a seeded output.

Eligible sentence moves include simple `because`, `although`, `though`, `after`, `before`, and `when` clauses, selected manner adverbs, and adjacent coordinated adjectives. The rules abstain around negation, modality, nested clauses, reporting clauses, degree modifiers, quotations, line wrapping, and complex punctuation when movement could change scope or damage structure.

Straight and smart quotations, guillemets, URLs, email addresses, backtick code, alphanumeric identifiers, acronyms, and mixed Unicode words are preserved by default. Name handling is heuristic: capitalised words and headings receive conservative protection, but name recognition is not comprehensive. The phrase list also protects selected idioms and technical collocations such as `honest mistake` and `statistically significant`.

Examples of guarded grammar: `started the car` does not become `began the car`; `remembered to help` keeps `remembered`; `found it difficult` keeps `found`; `likely to leave` keeps `likely`; and an attributive adjective does not become `an afraid child`.

## Sample

The supplied passage has 97 words. At seed 1 and intensity 1:

**Original**

> The careful teacher helped the happy children. Because the weather was cold, the class started the project late. She quietly explained the main idea, and the students were glad to assist. They purchased a small car for the school trip and quickly found the correct route. The calm physician said the tired boy was healthy. Although the journey was long, the group remained cheerful. The writer described the final result in an honest report. The crowd was silent when the meeting ended. The local students found a useful answer and remained calm. It was a small victory.

**Rewrite**

> The cautious instructor assisted the cheerful youngsters. The class commenced the project late because the weather was chilly. She silently clarified the primary concept, and the learners were joyful to help. They bought a little automobile for the school journey and swiftly located the correct route. The tranquil doctor said the weary lad was fit. The group stayed joyful although the trip was long. The author described the ultimate outcome in a truthful report. When the assembly ended, the throng was hushed. The local students located a helpful reply and stayed tranquil. It was a little triumph.

The change ledger records each substitution, article repair, and structural move. An unchanged phrase is often deliberate, not a failure to find a thesaurus entry.

## Develop and test

Node.js 22 or newer is used for differential and CLI tests. Build the native executable first, then:

```sh
npm test
npm run build:site
python -m http.server 8000 --directory site
```

Open `http://localhost:8000/`. Do not serve `docs/` alone: the assembled `site/` also contains the shared data and license. `site/build.json` records the source commit and asset SHA-256 hashes. Set `SYNOMIZER_BIN` when the binary is in a nonstandard location.

Real-browser tests require the separately pinned development dependency:

```sh
python -m pip install -r requirements-e2e.txt
python -m playwright install chromium firefox
# On Linux, use: python -m playwright install --with-deps chromium firefox
python tests/browser_test.py --browser chromium
python tests/browser_test.py --browser firefox
```

The harness owns and closes its server and browsers. It covers desktop/mobile layouts, both engines' output, 64-bit seeds, stale-result handling, quote protection, HTML-injection resistance, import/export, offline processing, large documents, and load-failure retry. Screenshots, traces, downloaded examples, and machine-readable reports go to ignored `artifacts/`. Use `--headed` for visual runs or `--url https://adybag14-cyber.github.io/Synomizer/` to test the live site.

CI runs native builds and the differential corpus on three operating systems, native AddressSanitizer/UndefinedBehaviorSanitizer tests on Linux, and Chromium/Firefox acceptance tests. GitHub Pages deploys the **same site artifact that passed browser tests**, only after all gates succeed. Deployment then verifies the live commit and all hashed assets.

## Extend the lexicon

`data/lexicon.tsv` contains lemma, part-of-speech, synonym groups, and eligibility flags. `data/phrases.txt` contains protected word sequences. CMake automatically refreshes embedded data when either file changes; the browser uses the same source lists.

Do not add words solely because a thesaurus groups them together. Check sense, countability, transitivity, required prepositions, adjective position, and inflection. Add an expected-output or protected-span fixture to `tests/regressions.json`, reproduce the issue, and change **both** native and browser rules. Run the full corpus. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0. Copyright 2026 adybag14-cyber. The repository's original [LICENSE](LICENSE) is retained unchanged. The browser includes it as `license.txt` and CLI packages include it with the documentation.
