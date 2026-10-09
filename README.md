# Synomizer

**Thoughtful variations, not random replacements.** Synomizer is a C++23 command-line tool and library, with a static [GitHub Pages editor](https://adybag14-cyber.github.io/Synomizer/), for varying English prose using a curated lexicon, grammatical inflection and conservative sentence moves.

The same text, seed, options **and engine/word-list version** produce the same output. This describes the deterministic engine. Optional model proposals can vary; exports retain the accepted proposal and its inferred provenance for replay. It is useful for passages of about 100 words, and processes longer text sentence by sentence. The deterministic rewrite does not call a language model or a rewriting service; the optional browser context stage can use Bonsai 2 locally.

**Review the result.** These are mechanical rules, not a semantic parser. No intensity level guarantees perfect grammar, identical meaning or a suitable register for every context. Technical, legal, medical, quoted and publication-ready writing needs particular care. Leaving a sentence unchanged is preferable to forcing an unsuitable variation.

## Browser editor

[Open Synomizer](https://adybag14-cyber.github.io/Synomizer/).

The page starts in **Automatic: paste and rewrite**. Paste or import text to get one standards-oriented draft with inferred setup. No reader, purpose or vocabulary form is required. Select **Three variations** to use the original comparison workflow, then choose **Create 3 variations**. Your original stays above up to three complete, distinct results. They appear side by side on desktop and stack on a phone. Each card has its own copy, text download, JSON change-log download, seed/profile and change counts. **Use this** selects the result used by the shared change ledger and selected-result export controls. Selection never overwrites the original.

**New set** advances the base seed and always rewrites the original, not a previous result. **Download all variations** exports the original plus all complete results, their reproduction options, change records and selected index. Different seeds can still find some of the same wording.

The controls include independent synonym and sentence-move switches, three intensity levels, quotation protection, and a **protected-terms** field. Enter one word or phrase per line to keep names and specialist terminology unchanged. Matching is case-insensitive and whole-word, with literal spacing inside a phrase; a sentence containing a matched term is not rearranged.

Processing happens in a cancellable Web Worker. The browser accepts up to **200,000 characters**, and up to 200 protected terms of at most 200 characters each. Longer files can use the native CLI. Invalid input clears every obsolete result and disables all selected/card exports. Editing during generation terminates the old search; retired workers cannot publish stale batches. `Ctrl/Cmd + Enter` runs a rewrite.

### Privacy

Text is processed locally in the browser. There are no accounts, analytics, external fonts or server-side rewriting API calls. Optional model/runtime downloads occur only after the user grants permission. Text and settings are not saved by the app after a reload. Optional Bonsai model weights may be cached separately after explicit download permission; no prompt snapshots are persisted. The page and its word lists are initially fetched from GitHub Pages, and normal hosting access logs still apply. Importing a text file does not upload it. Selected-result JSON contains the result, profile, exact options and change records. All-variations JSON also includes the original; share it only when you intend to share that original.

The browser implementation is JavaScript, **not a native C++ executable or WebAssembly build**. It mirrors the C++ reference rules and reads the same versioned data files. Cross-engine tests compare both rewritten text and complete change records, including full-width 64-bit seeds.

## Automatic setup and optional Bonsai 2 (1.6.0)

Paste English text into the original field. The automatic mode infers a provisional reader group, purpose and procedure/description type, identifies source-literal technical terms to protect, and produces a deterministic draft for the combined standards mode. Settings are shown as **inferred**, not silently presented as confirmed facts. The C++ equivalent is `synomizer --auto-context --json input.txt`; explicit `--audience`, `--purpose`, `--text-type` and `--profile` override inferred/default choices.

**No official vocabulary is invented.** Extracted terms are lexical protections, not approved STE dictionary entries. The model-free fallback distinguishes supported research, instructional and correspondence cues; unfamiliar material gets explicitly provisional generic context. Manual settings remain available under **Adjust optional settings** and take precedence over inference. The original text is never replaced by a generated variation.

Automatic mode permits copying/downloading an **unverified draft** by default. Enable **Require verified export** to use the fail-closed release gate. The dedicated manual standards profiles retain their strict export default. Neither automatically filled fields nor model suggestions constitute reader evaluation, factual checking or conformity approval.

### Optional on-device Bonsai 2

Open **Optional on-device intelligence: Bonsai 2 / WebGPU**, grant the stated download permission, then select **Enable Bonsai 2 (~5.95 GB)**. The initial load retrieves a pinned community WebGPU runtime and the pinned `PTQ1_0` weight file (5,946,648,928 bytes) from Hugging Face. It requires a compatible GPU/browser and additional runtime memory; a 6 GB device is not guaranteed sufficient. The application downloads nothing from the model host before opt-in, and no account/token is needed for these public files.

After loading, later text changes are analyzed automatically. Bonsai proposes readers, purpose, text type, source terms and review suggestions. The deterministic engine then processes the original using that proposed context. It does not blindly insert a model paraphrase or an approval into the result. A rejected model response gets at most one bounded repair attempt under the same overall deadline; invalid data still falls back to rules. Each proposed field needs literal source evidence; unfamiliar keys, fabricated terms, unsupported text types and approval flags are rejected. Manual overrides still win. Pasted instructions are treated as untrusted document content, not tool commands.

Model input is bounded to a 6,000-UTF-8-byte excerpt. Each generation is limited to 512 output tokens within an 8,192-token runtime window; at most one validation-repair generation is allowed, under the same overall analysis deadline. Long documents explicitly report model sampling; the rule engine still processes the complete text up to the browser's 200,000-character limit. Sampling and literal evidence do not prove that an inference is correct. Model errors, invalid JSON, missing GPU support and timeouts leave the immediate rule-based draft available.

The model runs in a dedicated worker with cancellation, newest-request guards, device-loss handling, a load deadline and an inference deadline. **Stop / unload** releases the worker and returns to rules. **Delete cached model** removes only Synomizer's namespaced model cache; another tab using the cache may need to be closed. Text/context are not written into the model cache, and runtime prompt-prefix persistence is disabled. Model weights can remain cached after a reload; model activation is opt-in for each page session.

The remote runtime is consumed from an immutable upstream revision after SHA-256 verification of the complete source and extracted model module. No upstream kernel source or model weights are redistributed in this repository. The extracted module excludes the demo UI and its optional Markdown/KaTeX imports. Model fetches are limited to GET/HEAD requests to the pinned weight URL; document uploads are not permitted. Standard hosting/CDN download logs still apply. Runtime/model provenance is recorded in `docs/bonsai-config.js`.

The pinned runtime's system-prefix optimization is disabled because its template requires a user turn even when rendering a cached prefix. System and user messages remain separate, and the model resets between documents. This local adapter does not modify the downloaded module or bypass checksum validation.

## Standards conversion and guarded release (1.6.0)

Choose **ASD-STE100 authoring aid**, **ISO 24495-1 plain-language aid**, or **Both: ASD-STE100 + ISO 24495-1**. The standards path returns one deterministic draft and a structured report, not three synonymous alternatives. The deterministic rewrite itself uses no transformer or server-side rewriting service. The optional Bonsai context stage is described above.

**This release does not guarantee conformity for arbitrary text.** It distinguishes generating a draft from releasing text as conformant. Rule coverage, short sentences, a matching glossary and a matching hash do not establish correct meaning, approved word senses or reader usability.

### One draft, both standards

The **Restructure for both standards** button is visible directly below the main toolbar, even while **Three variations** is selected. The Restructured comparison card also has **Use both standards**. Both routes use the original source, not a previously generated variation. The preset selects `combined`, turns on sentence/list restructuring and strict export, and turns off check-only. It preserves reader/task fields, text type, vocabulary, quotation settings, word-edit choice and protected terms.

The two standards can be applied together: ISO's official scope expressly includes technical writing and controlled languages. Their compatibility is not an implication of conformity. STE's controlled vocabulary and construction requirements and ISO's reader-centred principles still need their own assessment. See [ISO's scope](https://www.iso.org/standard/78907.html), [ASD's explanation](https://www.asd-ste100.org/about_STE.html), and [ASD's tool guidance](https://www.asd-ste100.org/STEsoftware.html).

The same final draft now has **two separately labelled review views**, included in browser and native JSON as `standards.screens`. Both include the same draft SHA-256. They expose their own metrics, length-screen basis, target and findings. STE grouping cannot hide an ISO-oriented ordinary-word concern, and ISO's advisory 25-word screen is not presented as an ISO requirement. The ordinary single-standard modes each return just their own review view. Neither view marks unverified requirements as passed; the existing strict release gate remains in force.

This is not a pipeline that applies a second paraphrase after the first, nor a claim that ordinary **Three variations / Restructured** is automatically standards-conforming. The combined mode uses the controlled drafting path without synonym-diversity search. `--profile combined` in the C++ CLI exposes the same two-view report.

### Expanded model-free conversion

Alongside directional clarity edits and supported explicit-actor passives, the converter can separate reviewed descriptive clause patterns and format supported nominal enumerations as vertical lists. It preserves the original list order, conjunction (`and` versus `or`), reporting prefix and conditional context. Lists can be disabled with **Format supported enumerations as lists** or `--no-structured-lists`. Unsupported shared-head lists, reported assertions, modal clauses, quotations, numbers in lists and protected structures remain unchanged rather than being guessed. The text may still require editorial work.

The count screen recognizes supported vertical-list leads/items, balanced double-quoted or parenthetical groups, common number/unit combinations and hyphenated words. Counts are still **estimates, not complete ASD-STE100 section 8 verification**. Supported parenthetical inner units, user-supplied names/titles and numeric step markers are screened as well. Complex multi-sentence groups, unreviewed names, layouts and the remaining counting cases still require review. ISO 24495-1 does not mandate the app's 25-word screening target.

A selected numeric/logical-marker check compares source and draft. A change to those markers causes all draft edits to roll back. This is a conservative safeguard, **not a semantic-equivalence test**: matching markers cannot prove correct relationships, word senses or the truth of a claim.

### Strict text-release gate

In browser standards modes, **Block text export until conformity is verified** is checked by default. The draft and diagnostics remain visible, but text copy and text-download actions are disabled while the report has unresolved requirements. Uncheck this control only to export an **unverified draft**. This does not turn any requirement into a pass. Existing three-variation mode retains its ordinary copy/download behaviour.

The CLI enables the equivalent opt-in gate with `--require-conformity`. A blocked decision exits with code **3**, writes no final text to stdout, and never creates or truncates the path supplied to `--output`. Explicit `--json` without `--output` can return a diagnostic draft report on stdout while still exiting 3. A report containing draft text is not a released conformant document.

```sh
# Draft workflow: output is not claimed conformant.
./build/synomizer --profile combined --audience "Maintenance staff" --purpose "Inspect a valve" input.txt

# Strict workflow: blocks, exits 3 and leaves any existing final.txt untouched.
./build/synomizer --profile ste --require-conformity --output final.txt input.txt

# Diagnostic workflow: draft/report JSON on stdout, exit 3 if release is blocked.
./build/synomizer --profile combined --require-conformity --json input.txt

# Check-only: no editing, apart from documented LF line-ending normalization.
./build/synomizer --profile plain --check-only input.txt
```

**There is deliberately no automatic approval path in 1.6.0.** The report always identifies conformity as unverified. It includes all 53 ASD-STE100 Issue 9 rule identifiers where STE is selected, plus four ISO principle-level review entries where plain language is selected. The ISO entries are not a complete enumeration of the standard's detailed guidelines. Every entry states `not-verified` or requests attention; an unimplemented check cannot silently pass. Hashes bind the normalized source and draft bytes, not a signature, identity, approval or semantic proof.

### Authoring context and terminology

Reader/task fields, procedure/description selection, quotation protection and protected terms remain available. Custom protected terms prevent the matching sentence from being rearranged. Authorized vocabulary TSV contains four columns: `term`, `part of speech`, `intended meaning`, `category`. The categories are `general`, `technical-noun`, `technical-verb`, `name`, and `title`. Technical category and grammatical role must agree; a UTF-8 BOM is accepted. Limits remain 5,000 entries, 1,000,000 total bytes, 200 bytes per term and 500 per meaning.

No official dictionary or ISO standard text is bundled. Imported data supports spelling screening and term protection, not proof of dictionary completeness or approved senses/forms. Full standards review requires the authorized reference and contextual evaluation. Reader relevance, findability, understanding and usability require evidence beyond text substitution.

Diagnostic JSON includes source/draft digests, exact browser settings, supplied terminology, changes, review findings and the blocked release decision. Treat reports as sensitive: they can contain the original and draft. **Check only** and strict release are separate controls. An unchanged input, empty document or zero length findings never proves conformity.

See [coverage and source notes](docs/standards.html). Native and browser implementations are tested for exact text, change and report parity, including write-protection on failed CLI release.

### Real model acceptance test (optional)

The normal test suite uses controlled worker fixtures for cancellation, consent and malicious/invalid model replies; it does not download a 6 GB model during CI. Real hardware acceptance is separate and explicitly opt-in:

```sh
npm run build:site
npm run test:bonsai:real -- --allow-model-download --channel msedge
```

This opens its own test browser, uses the real page controls, runs research and procedural examples on the GPU, verifies inferred provenance and unverified release status, checks that requests do not upload document bodies, and exercises unload/cache deletion. It requires installed Playwright/browser support, enough memory and the stated model download. Startup failures are reported as failures, not skipped passes. Use `--url` with the deployed editor URL to verify a published build. Evidence is written under ignored `artifacts/bonsai-real/`.

### Model and runtime provenance

Bonsai 2 is a transformer-based model. The automatic fallback and C++ executable require no transformer; the browser's optional Bonsai path is explicitly model-assisted. Sources: [Prism ML model](https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf) and [WebML community WebGPU runtime](https://huggingface.co/spaces/webml-community/ternary-bonsai-2-webgpu-kernels). The runtime revision and both verified code hashes, weight revision/file and separate cache namespace are pinned in source. This is not an endorsement or standards certificate.

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
