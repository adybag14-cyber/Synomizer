# Synomizer

**Thoughtful variations, not random replacements.** Synomizer is a C++23 command-line tool and library, with a static [GitHub Pages editor](https://adybag14-cyber.github.io/Synomizer/), for varying English prose using a curated lexicon, grammatical inflection and conservative sentence moves.

The same text, seed, options **and engine/word-list version** produce the same output. It is useful for passages of about 100 words, and processes longer text sentence by sentence. It does not call a language model or a rewriting service.

**Review the result.** These are mechanical rules, not a semantic parser. No intensity level guarantees perfect grammar, identical meaning or a suitable register for every context. Technical, legal, medical, quoted and publication-ready writing needs particular care. Leaving a sentence unchanged is preferable to forcing an unsuitable variation.

## Browser editor

[Open Synomizer](https://adybag14-cyber.github.io/Synomizer/).

Paste or import a UTF-8 `.txt` or `.md` file and choose **Create 3 variations**. Your original stays above up to three complete, distinct results. They appear side by side on desktop and stack on a phone. Each card has its own copy, text download, JSON change-log download, seed/profile and change counts. **Use this** selects the result used by the shared change ledger and selected-result export controls. Selection never overwrites the original.

**New set** advances the base seed and always rewrites the original, not a previous result. **Download all variations** exports the original plus all complete results, their reproduction options, change records and selected index. Different seeds can still find some of the same wording.

The controls include independent synonym and sentence-move switches, three intensity levels, quotation protection, and a **protected-terms** field. Enter one word or phrase per line to keep names and specialist terminology unchanged. Matching is case-insensitive and whole-word, with literal spacing inside a phrase; a sentence containing a matched term is not rearranged.

Processing happens in a cancellable Web Worker. The browser accepts up to **200,000 characters**, and up to 200 protected terms of at most 200 characters each. Longer files can use the native CLI. Invalid input clears every obsolete result and disables all selected/card exports. Editing during generation terminates the old search; retired workers cannot publish stale batches. `Ctrl/Cmd + Enter` runs a rewrite.

### Privacy

Text is processed locally in the browser. There are no accounts, analytics, external fonts or rewriting API calls. Text and settings are not saved by the app after a reload. The page and its word lists are initially fetched from GitHub Pages, and normal hosting access logs still apply. Importing a text file does not upload it. Selected-result JSON contains the result, profile, exact options and change records. All-variations JSON also includes the original; share it only when you intend to share that original.

The browser implementation is JavaScript, **not a native C++ executable or WebAssembly build**. It mirrors the C++ reference rules and reads the same versioned data files. Cross-engine tests compare both rewritten text and complete change records, including full-width 64-bit seeds.

## Standards-oriented conversion and review (1.5.0)

Version 1.5 adds supported terminal-enumeration formatting, positive descriptive-clause transformations, more directional clarity rules, grouped sentence-length screening, and a **strict release guard**. These expand conversion without turning an unverified draft into a conformity claim. Reported/uncertain scope remains protected; unsupported coordination receives `CLARITY-SCOPE` review findings.


Choose **ASD-STE100 authoring aid**, **ISO 24495-1 plain-language aid**, or **STE + plain-language aid** in the Writing mode control. These are separate from synonym variation: they return **one deterministic clarity draft** and a review report. **Check only** preserves the text (apart from the documented line-ending normalization) and reports findings without rewriting.

This is a **partial authoring aid, not a complete standards converter or conformance checker**. It does not claim full ASD-STE100 or ISO 24495-1 conformity, semantic equivalence, dictionary approval, or reader validation. No transformer, model weights, WebGPU inference or external rewriting API is required.

The profiles apply independently authored directional phrase simplifications, expand unambiguous contractions, rewrite supported simple-past passives only when an explicit actor is present, separate reviewed direct/descriptive clauses, and format supported terminal enumerations as vertical lists. List formatting retains the original item order, words, and `and`/`or` relationship; subsequent prose is kept outside the final bullet. They do not use the academic expansion or synonym-diversity engine. Conditions, negation, obligations, protected terms and uncertain constructions constrain edits. Unsupported sentences can remain unchanged even when they still need editing.

The STE length screen uses 20 words for procedures and 25 for descriptions/notes. It now groups supported number/unit combinations, quoted spans, and user-declared names/titles; parentheses are one outer count unit with their contents assessed separately. List lead-ins and individual items are separate count units, with numeric work-step markers excluded. **Counts are still estimates, not the complete section 8 method**: undeclared names/labels, unsupported units, ambiguous structure and actual document formatting require review. Report sentence indices refer to these screening units, which can include parenthetical material and list items. ISO 24495-1 does not impose this application's 25-word heuristic. Reports also flag possible passives, selected tense/-ing patterns and unresolved contractions; these are review cues, not categorical violations. All reports remain `review-required` and `semanticEquivalenceVerified: false`.

Audience and purpose are recorded for the plain-language process. Review prompts cover relevance, findability, understanding and usability. The software does not test the text with readers or verify the document's organization, layout or sufficiency.

An optional authorized vocabulary can be pasted or imported locally as UTF-8 TSV with four columns: `term`, `part of speech`, `intended meaning`, `category` (no header; `#` starts a comment). Categories are `general`, `technical-noun`, `technical-verb`, `name`, and `title`. A technical category must agree with its noun/verb part of speech. Non-general entries are protected. General entries support **spelling screening only**: their completeness, authority, meanings and grammatical use are not established. Limits: 5,000 entries, 1,000,000 total UTF-8 bytes, 200 bytes per term, 500 per meaning. The official STE dictionary and ISO document are not bundled or relicensed under Apache-2.0.

Browser JSON exports include the report and complete reproduction settings, including supplied vocabulary, audience and purpose. CLI JSON includes the report; retain the invocation and vocabulary file to reproduce it. Treat exports as potentially sensitive. Text-only exports contain the draft, not a conformity claim.

```sh
./build/synomizer --profile ste --text-type procedure --json instructions.txt
./build/synomizer --profile plain --audience "New technicians" --purpose "Inspect a valve" input.txt
./build/synomizer --profile combined --check-only input.txt
./build/synomizer --profile ste --vocabulary authorized-terms.tsv --json input.txt
```

`--check-only` implies JSON output and requires a standards profile. Even with `--variants 3`, standards profiles return one result rather than inventing inconsistent terminology. Existing operation switches and protected terms still apply. Plain-text CLI output warns that the draft is unverified; use `--json` for the report.

See the [coverage and source notes](docs/standards.html) for requirements that remain manual and links to ASD-STE100 Issue 9, ISO 24495-1:2023 and the standards organizations.

### Strict release and the requirements inventory

**Strict release is enabled by default in the browser standards modes.** The native CLI activates it with `--require-conformity`. A report and visible draft are still produced, but final-text copy/download is withheld when `releaseAllowed` is false. Diagnostic JSON explicitly contains an **unverified draft**; it is not a released or certified document. Turning strict release off allows ordinary draft export, not approval.

The CLI returns **exit code 3** when strict release is blocked. It writes no plain-text output and does not create or truncate the requested `--output` file, even with `--json`. To inspect the diagnostic draft, use `--json` without `--output`. Shell redirection is under the caller's control; check the process exit status before using the report or treating its text as final.

```sh
# Exit 3 is expected while conformity is unverified; report goes to stdout.
./build/synomizer --profile combined --require-conformity --json input.txt

# On a blocked assessment, final.txt is not created or overwritten.
./build/synomizer --profile ste --require-conformity --output final.txt input.txt

# Keep supported lists inline instead of formatting them vertically.
./build/synomizer --profile combined --no-structured-lists input.txt
```

**This release has no automatic approval path.** All assessments remain blocked for final-conformity release. That is deliberate: the engine cannot verify the full vocabulary/sense/grammar requirements, preserve arbitrary intended meanings by proof, or substitute for reader evaluation. This guard is a workflow safeguard, not a complete standards converter, a DRM mechanism, or a conformity guarantee. Tests establish implementation behaviour, not standards conformity.

The report inventories all **53 ASD-STE100 Issue 9 rule identifiers**, each labelled `partial-screen` or `human-review`, and `attention` or `not-verified`. Rule 2.3 from an older issue is not included. For ISO 24495-1 the report provides the **four principle-level review areas**, not an exhaustive list of every guideline. Inventory completeness is distinct from implementation coverage; absence of a finding does not mark a rule passed.

A narrow whole-draft rollback guard compares numeric tokens and selected negation/modality markers before and after conversion. A mismatch restores the source and adds a review finding. A matching marker set is not proof of equal meaning, scope, quantities in context, or correct grammar.

The report also contains SHA-256 fingerprints of the LF-normalized source and the generated draft. These bind the report to exact text and allow independent change detection. **Hashes are not approval signatures, authority verification, or semantic-equivalence proofs.** Reader context and a pasted glossary cannot switch `conformityVerified` or `releaseAllowed` to true.

### Optional Bonsai 2 / WebGPU investigation

Bonsai 2 remains a transformer model, not a transformer-free alternative. The publisher's PTQ1_0 language weights are approximately 5.95 GB; a 6 GB device is not thereby guaranteed sufficient runtime memory. A community WebGPU demonstration exists. This release **does not embed or download Bonsai**, nor send text to that demo. The coverage page links to the publisher and external demo. A future integration would need explicit download consent, compatible pinned runtime/weights, memory/context limits, cancellation, device-loss handling, cache deletion and independent output review.

## Build the C++23 tool

Use CMake 3.20 or newer and a C++23-capable compiler/toolchain. Node is only needed for parity tests and site development, not for the native executable.

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --parallel 2
ctest --test-dir build -C Release --output-on-failure
```

The executable is `build/synomizer` on a single-configuration Unix build, `build/synomizer.exe` with MinGW/Ninja on Windows, or `build/Release/synomizer.exe` with Visual Studio. The CI workflow builds on Linux, Windows and macOS, and uploads native executables with the licence and documentation as workflow artifacts. Windows MSVC and MinGW packages use a static C++ runtime. Versioned installable ZIP packages are also retained as `packages-*` workflow artifacts and can be published through GitHub Releases.

Optional installation:

```sh
cmake --install build --config Release --prefix ./install
cpack --config build/CPackConfig.cmake -C Release -G ZIP -B packages
```

The native executable embeds the lexicon, protected-expression list and adjunct-rewrite table and does not need a network connection or external dictionary files at runtime. Changing any of the three data files automatically triggers CMake to reconfigure on the next build.

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
| `--intensity 0`, `-i 0` | Light: eligible adjectives, manner adverbs and guarded manner-adjunct rewrites. |
| `--intensity 1` | Standard: also eligible nouns, verbs and other adverbs; default. |
| `--intensity 2` | Broader: also narrower/register-sensitive entries. Review carefully. |
| `--synonyms-only` | Do not rearrange sentences; eligible word/phrase edits remain enabled. |
| `--arrange-only` | Do not substitute words or phrases. |
| `--no-rewrite` | Disable both operations, retaining line-ending normalization. |
| `--protect TEXT` | Protect a whole word or phrase. Repeat as needed. |
| `--vary-quotes` | Allow substitutions inside quotations; their structure still does not move. |
| `--show-changes` | Write each change to stderr. |
| `--json` | Write version, string-valued seed, profile, text and structured changes as JSON. |
| `--variants N` | Generate up to 1, 2 or 3 distinct alternatives. |
| `--style NAME` | Reproduce a single `balanced`, `close` or `recast` candidate. |
| `--text TEXT` | Use an inline passage instead of a file or stdin. |
| `--output FILE`, `-o FILE` | Write to a file instead of stdout. |
| `--` | End options, for example before a filename beginning with `-`. |
| `--help`, `--version` | Show usage or version. |

No filename, or `-`, reads stdin. Files and text are UTF-8. CRLF and standalone CR line endings normalize to LF; paragraph breaks and other layout are retained. Invalid numbers, contradictory rewrite modes and conflicting input sources return a nonzero exit code. JSON seeds are strings so JavaScript consumers cannot lose precision. File read/write errors are reported on stderr.

## What the rules do

Substitutions are selected using a deterministic 64-bit hash. The engine checks local part-of-speech cues, grammatical frames, verb tense, participles, plural forms, supported comparative/superlative forms, capitalization, and adjacent `a`/`an` articles. Grammar decisions use the original sentence context, not already substituted words. A limited set of clause, manner-adverb and coordinated-adjective moves supplies structural variation.

Additional frame checks retain `likely to leave`, `remembered to help` and the verb in `found it difficult`. Degree modifiers are not detached from their adverbs, line-wrapped clauses are not treated as independent sentences, and adjective movement updates a/an when necessary.

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

The 97-word passage in `examples/sample.txt`, at seed 1 and standard intensity in version 1.3.0:

> The cautious instructor assisted the cheerful youngsters. The class commenced the project late because the weather was chilly. She quietly clarified the primary concept, and the learners were happy to help. They bought a little automobile for the school journey and swiftly located the correct route. The tranquil doctor said the weary lad was healthy. The group stayed joyful although the trip was long. The author described the ultimate outcome in a truthful report. When the assembly ended, the throng was hushed. The local learners located a helpful reply and stayed tranquil. It was a little triumph.

Inspect the change ledger or use `--show-changes` to review individual operations. The number of words is not forced to remain fixed.

## Three simultaneous choices

The editor generates a batch automatically and displays up to three distinct options together:

| Approach | What it explores |
| --- | --- |
| **Balanced** | The standard eligible substitutions and guarded sentence moves. |
| **Light touch** (`close`) | A deterministic selective edit, targeting roughly half the eligible substitutions and retaining sentence order. |
| **Restructured** (`recast`) | Eligible word substitutions, additional manner-adverb placement, and audited phrase alternatives. |

All cards now display **complete text**, not truncated previews. Use a card's controls to copy or download that result directly, or select its native radio control to update the shared ledger and selected-result exports. The selected card has a visible border; keyboard users can focus a radio and press Space. The original is never changed by selection.

Long results remain complete in a scrollable card. Above 50,000 characters, inline highlighting is omitted to avoid excessive rendering work; complete change records remain available. The on-screen ledger starts with 250 changes and can display more, while all exports contain the full ledger. Invalid/obsolete requests disable every export rather than leaving old alternatives available.

Every candidate is generated from the **original**, not by repeatedly rewriting a previous paraphrase. The first candidate uses the base seed with Balanced rules. For later profiles a bounded search chooses wording that differs from the already-selected options, using word/bigram overlap against both the original and the already-selected outputs. Including the original avoids rewarding a near-copy simply because it differs from another candidate. This is a diversity heuristic, **not** a meaning-preservation or quality score. Multi-result searches try at most 12 candidate rewrites and may return fewer than requested. Above 2,000 whitespace-separated spans, the search tries one candidate per profile first (at most six total with duplicate fallbacks), avoiding repeated full-document passes while keeping all three approaches. Duplicate rewrites are omitted; an unrewritable passage is shown unchanged. Intensity, disabled operations, quote protection and protected terms are never relaxed to fill a quota. The batch uses its three profiles even when a single-pass style was supplied.

```sh
# Three labelled alternatives, or structured results for an application
./build/synomizer --variants 3 --seed 1 examples/sample.txt
./build/synomizer --variants 3 --json --protect "control group" passage.txt

# Reproduce an individual candidate using its recorded seed and profile
./build/synomizer --style recast --seed 9 passage.txt
```

`--variants` accepts 1, 2 or 3 (default 1). Single-result CLI output remains a plain rewrite unless `--json` is requested. Batch JSON includes `requested`, `attempts` and a `variants` array; each entry carries `seed`, `style`, `text` and `changes`. Seed arithmetic wraps as an unsigned 64-bit integer. A fixed version, input, settings, profile and seed reproduce the same result.

### Context-aware vocabulary and phrase rules

The shared lexicon now supports positive noun-head/object contexts. For example, **clear explanation** can become **lucid explanation**, while **clear sky** and the verb in **clear the room** are not treated as the same sense. Other audited additions cover concise summaries, spacious rooms, document retention, verification and evaluation. Candidate-specific guards distinguish eating a meal from consuming electricity and avoid turning the passive **was shown the technique** into **was demonstrated the technique**.

Recast mode can vary sentence-initial transitions such as **In addition,** / **Furthermore,** and **Therefore,** / **As a result,**; use **despite** / **in spite of**; and shorten a guarded purpose phrase **in order to** to **to**. It never blindly expands infinitival `to`. These phrase rules are disabled in intensity 0, under negation, inside protected quotations, or in term-locked sentences. Risky readings of `put ... in order to ...` are left alone. Phrase edits are separately identified in the ledger.

The shared `data/rephrases.tsv` table adds **23 guarded manner/frequency adjunct rules**, separate from the existing Recast transition rules. They match exact, unprotected phrases at a supported introductory or final position. Examples include `She worked in a careful manner.` → `She worked carefully.` and `On a daily basis, she studied.` → `Daily, she studied.` Final `carefully` can become `with care`. Manner rules are available at intensity 0; frequency/time rules require intensity 1. These adjunct rules are enabled in Balanced and Recast, but not Light touch. Phrase output is not rewritten again in the same pass.

Negation, focus/degree modifiers, embedded clauses, uncertain attachment, incompatible punctuation, quotations and term locks block the corresponding phrase edits. The rules do not establish semantic equivalence in arbitrary contexts. Each phrase change has its own ledger entry, and word counts may change.

Recast also recognizes supported simple noun-subject clauses: with synonyms disabled, `The teacher carefully examined the report.` becomes `The teacher examined the report carefully.` at seed 1 or `Carefully, the teacher examined the report.` at seed 2. This extension retains the existing pronoun rule and is blocked by the normal scope/protection checks, auxiliary chains, additional predicates and unsupported complements.

Additional grammar guards preserve the frames in `helped the child learn`, `proposed to leave`, and `tried the soup`; distinguish product recalls and intransitive sales declines; prevent nominal `a cold` or quantity `little money` from being treated as ordinary adjective substitutions; and distinguish a logical argument from a quarrel. Noun/verb cues prevent `students question` becoming `students inquiry`. Ambiguous command verbs such as `Answer the question`, `Film the event` and `Ship the tool` are preserved rather than rewritten using noun senses. Event-object rules permit `finished the project` → `completed the project` while retaining `finished the soup`.

Audited comparative targets can use **more cheerful** / **most cheerful** rather than invalid suffix forms. Newly used irregular verbs retain **kept**, **shown** and their other forms; plural **aircraft** is not written as `aircrafts`. Contextual number cues distinguish `The aircraft were ready.` → `The airplanes were prepared.` from `An aircraft was ready.` → `An airplane was prepared.`; ambiguous or conflicting number cues preserve `aircraft`. A hash-indexed native lexicon avoids scanning every row for each lookup. These are local grammatical/context rules, not general language understanding; review every candidate.

## Academic prose: phrase and sentence coverage

Version 1.3.0 adds a dedicated academic-prose pass instead of attempting to solve sparse coverage by replacing more technical nouns. **Balanced** uses eligible word and academic-phrase edits; **Restructured** can additionally change supported sentence arrangements; **Light touch** deliberately retains its selective word-only behaviour.

The shared lexicon contains 27 `@academic` rows. Each row records a grammatical guard, a source followed by one or more targets, and its minimum intensity. These are directional phrase rules, not unrestricted synonym groups. For example, `This review examines whether` can become `This review assesses whether`; supported pending-work statements can use `has yet to be`; and `A research opportunity` can become `An opportunity for research`, including the article correction.

Supported Restructured templates include:

| Original | Structural alternative, with synonyms disabled |
| --- | --- |
| The results suggest that the model may fail. | The model may fail, as suggested by the results. |
| Recent methods broaden the comparison while preserving uncertainty. | While preserving uncertainty, recent methods broaden the comparison. |
| The algorithm is therefore a candidate for further testing. | Therefore, the algorithm is a candidate for further testing. |
| A verification strategy is proposed that includes boundary cases. | A verification strategy that includes boundary cases is proposed. |

These are guarded templates, not unrestricted active/passive conversion. New phrase rules skip negation/focus and protected spans; structural rules also skip nested/ambiguous clauses, multiline layouts and incompatible punctuation. Reference names and technical tokens move intact. `Significant` is retained rather than replaced with `important`; `remains to be established` cannot become `stays to be established`; `examines whether` cannot become `inspects whether`.

All rules operate on an immutable token context and their output is protected from further lexical editing in the same pass. Sentence templates preserve their reporting/proposal predicates and do not add evidence, new scientific conclusions, or stronger certainty markers. Nevertheless, changed phrasing and emphasis still require editorial review: these checks are not a proof of semantic equivalence.

Intensity is vocabulary breadth, **not** a minimum percentage of replaced words. Technical passages may retain many words even when several clauses are genuinely rearranged. Review the separate phrase and move counts in each card's ledger rather than judging variation only by the number of synonym substitutions. `tests/fixtures/academic-prose.txt` is a reusable synthetic fixture; it is not a published research claim.

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
const auto choices = synomizer::rewrite_variants("The happy child bought a car.", options, 3);
for (const auto& choice : choices.variants) {
  // choice.seed; choice.style; choice.result.text; choice.result.changes
}
// ChangeKind also includes Phrase; count outside 1..3 throws std::invalid_argument.
```

The public API clamps integer intensity values to the range 0–2. The browser exports `rewriteVariants(input, options, resources, count = 3)` alongside `rewrite`. Its variants contain `{seed, style, result}`. The browser API rejects unsafe numeric seeds; pass a decimal string or bigint for values above JavaScript's safe integer range. The existing C++ `Style`, `rewrite_variants` and CLI `--style` interfaces are retained.

Load `loadResources(lexiconTsv, protectedPhrasesText, rephrasesTsv)` with all three data files for full native/browser parity. The older two-argument loader remains supported but omits adjunct rewriting. Browser option names are `style`, `seed`, `intensity`, `synonyms`, `arrange`, `protectQuotes` and `protectedTerms`.

Each downloaded result includes a complete `options` object so it can be reproduced with `rewrite(original, options, resources)`. The all-variations download retains `requested`, `attempts`, `selected` and `variants`, and adds the exact per-result options. CLI JSON continues to use its existing single/batch envelopes and recorded seed/profile; preserve the original base settings when replaying a CLI result. Reproducibility is version-specific.

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

`npm test` includes deterministic cross-engine comparisons, independently asserted grammar-safety regression examples, CLI rejection/error cases, Unicode arguments and filenames, protected terms, JSON escaping and long-text checks. Set `SYNOMIZER_BIN` when your executable is outside `build/synomizer`, `build/synomizer.exe` or `build/Release/synomizer.exe`. The standard Visual Studio Release path is detected automatically.

Playwright starts and stops its own local server, tests the real `/Synomizer/` deployment subpath across Chromium, Firefox, WebKit and mobile Chromium, and records screenshots and failure traces. Tests cover every card's independent exports, selected ledgers, full batch downloads, duplicate suppression, profile protections, failed resource loading, rapid edits, 64-bit seed wrapping, markup escaping, narrow layouts and complete long-text logs. To test an already-deployed site instead, set `PLAYWRIGHT_BASE_URL` to its URL with a trailing slash. Do not run a separate development server on port 4178 during local Playwright tests.

GitHub Pages deployment is gated on the native matrix, sanitizer checks and browser tests. `scripts/build-site.mjs` packages the page, Web Worker and the same data files into `site/`; `version.json` and `build.json` record the release version, source commit and SHA-256 hashes of all ten deployed assets, including the license. Pages deploys the exact artifact tested by the browser suite, then checks the live commit and asset hashes. GitHub's Pages source must be configured as **GitHub Actions**, not branch publishing.

## Contributing and licence

See [CONTRIBUTING.md](CONTRIBUTING.md) for adding a narrowly scoped rule or dictionary entry, and [CHANGELOG.md](CHANGELOG.md) for changes. The original [Apache-2.0 licence](LICENSE) is retained. Copyright 2026 adybag14-cyber.
