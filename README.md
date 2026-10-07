# Synomizer

Synomizer rewrites English text by using a synonym, or a different sentence arrangement, where that change stays grammatical and means the same thing. The same passage and the same seed always produce the same wording. A passage of about a hundred words is the size it is built for. Longer text is scanned the same way, one sentence at a time.

The tool is C++23. The [GitHub Pages demo](https://adybag14-cyber.github.io/Synomizer/) runs the same rules in the browser. `tests/demo_engine.test.mjs` checks that browser engine against the command-line tool.

## Build

You need CMake 3.20 or newer, a C++23 compiler, and Node for the browser comparison.

```sh
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
ctest --test-dir build --output-on-failure
node --test tests/demo_engine.test.mjs
```

On Windows the program is `build/synomizer.exe`. The comparison looks for `build/synomizer`, then `build/synomizer.exe`. Set `SYNOMIZER_BIN` if the binary lives somewhere else.

## Use

```sh
synomizer --seed 1 examples/sample.txt
synomizer --show-changes --intensity 0 --text "The happy child bought a car."
```

With no file and no `--text`, Synomizer reads stdin. The rewrite goes to stdout. `--show-changes` lists each substitution and move on stderr.

| Option | Effect |
| --- | --- |
| `--seed N` | Chooses which synonym to use when several fit. The default is 1. |
| `--intensity 0` | Adjectives and manner adverbs only. |
| `--intensity 1` | Safe synonyms. This is the default. |
| `--intensity 2` | Also a shorter list of narrower words. |
| `--synonyms-only` | Do not move clauses, adverbs, or adjectives. |
| `--arrange-only` | Move structure only. |
| `--vary-quotes` | Also rewrite words inside quotation marks. |
| `--output FILE` | Write the rewrite to a file. |

Carriage returns are removed, so CRLF input is written back with LF.

## Sample

This is `examples/sample.txt` at seed 1 and intensity 1. The input is 97 words.

> The careful teacher helped the happy children. Because the weather was cold, the class started the project late. She quietly explained the main idea, and the students were glad to assist. They purchased a small car for the school trip and quickly found the correct route. The calm physician said the tired boy was healthy. Although the journey was long, the group remained cheerful. The writer described the final result in an honest report. The crowd was silent when the meeting ended. The local students found a useful answer and remained calm. It was a small victory.

The rewrite is 97 words as well:

> The cautious instructor assisted the cheerful youngsters. The class commenced the project late because the weather was chilly. She silently clarified the primary concept, and the learners were joyful to help. They bought a little automobile for the school journey and swiftly located the accurate route. The tranquil doctor said the weary lad was fit. The group stayed joyful although the trip was long. The author described the ultimate outcome in a truthful report. When the assembly ended, the throng was hushed. The nearby learners located a helpful reply and stayed tranquil. It was a little triumph.

A fronted `because` clause and a fronted `although` clause move to the end. A trailing `when` clause moves to the front. `an honest report` becomes `a truthful report`. Seed 2 chooses other synonyms from the same groups.

## What it leaves alone

Ambiguous words such as `bank` have no entry. Names, acronyms, numbers, and quoted speech stay as they are. Phrases such as `used to` and `find out` stay as they are.

A verb is not swapped when the replacement would take different objects. `She started the car` keeps `started`. `They bought her a car` keeps `bought`. `Many of` keeps `many`. `A short man` stays `short`, while `a short visit` can become `a brief visit`. `They ran fast` keeps the adverbial `fast`. `They remained calm` can still change `calm`.

## Limits

The list in `data/lexicon.tsv` is curated, and the moves are rules, not a language model. A few shifts can remain:

- A listed adjective inside a metaphor or an idiom can drift, as with a bright student or an empty promise.
- Register can change. `Boy` may become `lad`.
- Moving a `because`, `although`, `though`, `after`, `before`, or `when` clause keeps that clause's meaning and can change which part of the sentence feels primary.
- Words that are not in the lexicon are left alone.

Adding a synonym means adding a line to `data/lexicon.tsv` and rebuilding. The Pages site reads `data/lexicon.tsv` and `data/phrases.txt` from the site, so the demo picks up the same lists without a compiler.

## License

Apache-2.0. Copyright 2026 adybag14-cyber.
