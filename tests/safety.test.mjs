// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { loadResources, rewrite } from "../docs/engine.js";
const resources = loadResources(readFileSync(new URL("../data/lexicon.tsv", import.meta.url), "utf8"), readFileSync(new URL("../data/phrases.txt", import.meta.url), "utf8"), readFileSync(new URL("../data/rephrases.tsv", import.meta.url), "utf8"));
const bin = [process.env.SYNOMIZER_BIN, "build/synomizer", "build/synomizer.exe", "build/Release/synomizer.exe"].find((p) => p && existsSync(p));
assert.ok(bin, "Build the C++ executable before running these tests");
const exec = (args = [], text = "") => spawnSync(bin, args, { input: text, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
function native(text, options = {}) {
  const args = ["--json", "--seed", String(options.seed ?? 1), "--intensity", String(options.intensity ?? 1)];
  if (options.synonyms === false && options.arrange === false) args.push("--no-rewrite");
  else if (options.synonyms === false) args.push("--arrange-only");
  else if (options.arrange === false) args.push("--synonyms-only");
  if (options.protectQuotes === false) args.push("--vary-quotes");
  for (const term of options.protectedTerms || []) args.push("--protect", term);
  const result = exec(args, text);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}
const cases = [
  ["URLs and email", "Visit https://happy.com/car and email happy@car.com.", ["https://happy.com/car", "happy@car.com"]],
  ["dotted domains", "The site happy.example.com shows happy children.", ["happy.example.com"]],
  ["code identifiers", "Keep happy_child and car2. The child was happy.", ["happy_child", "car2"]],
  ["single quotes", "She said 'The happy child was ready.' The happy child left.", ["'The happy child was ready.'"]],
  ["double quotes", 'She said "The happy child was ready. The car was small." The child was happy.', ['"The happy child was ready. The car was small."']],
  ["curly quotes", "She said “The happy child was ready. The car was small.” The child was happy.", ["“The happy child was ready. The car was small.”"]],
  ["nested quotes", 'She said "The child said ‘happy’. The small car was ready." The child left.', ['"The child said ‘happy’. The small car was ready."']],
  ["multiline quotes", '"The happy child\nwas ready." The happy child left.', ['"The happy child\nwas ready."']],
  ["unclosed quote", 'The child said "The happy child was ready.', ['"The happy child was ready.']],
  ["unicode words", "The café was happy. A naïve child met O’Brien.", ["café", "naïve", "O’Brien"]],
  ["unicode punctuation", "“中文🙂” — The happy child was ready…", ["“中文🙂”", "—", "…"]],
  ["possessives", "The children's car and the students' happy children.", ["children's", "students'"]],
  ["curly possessives", "The children’s car was ready.", ["children’s"]],
  ["measurements", "The child weighs 10kg and takes 5mg. The value was 3.14.", ["10kg", "5mg", "3.14"]],
  ["initialisms", "US and NASA students were happy.", ["US", "NASA"]],
  ["name at sentence start", "Joy was happy. King left the happy child.", ["Joy", "King"]],
  ["inline code", "Use `happy child` with a happy child.", ["`happy child`"]],
  ["fenced code", "```cpp\nconst auto happy = car;\n```\nThe happy child left.", ["```cpp\nconst auto happy = car;\n```"]],
  ["tilde fences", "~~~txt\nhappy child\n~~~\nThe happy child left.", ["~~~txt\nhappy child\n~~~"]],
  ["markdown links", "Read [happy child](https://happy.com/car) with the happy child.", ["[happy child](https://happy.com/car)"]],
  ["nested URL parentheses", "Read [happy child](https://example.com/a(b)) today.", ["[happy child](https://example.com/a(b))"]],
  ["HTML attributes", '<span title="happy child">The happy child</span>', ['<span title="happy child">', '</span>']],
  ["honest mistake", "It was an honest mistake.", ["honest mistake"]],
  ["alone", "The child was alone.", ["alone"]],
  ["spoken explanation", "She quietly explained the correct route to the local students.", ["quietly"]],
  ["significance", "There was a statistically significant difference in the control group.", ["statistically significant difference", "control group"]],
  ["collocations", "An empty promise followed heavy rain and small talk.", ["empty promise", "heavy rain", "small talk"]],
  ["modal uncertainty", "The child might be happy, but may not be ready.", ["might", "may not"]],
  ["phrasal verbs", "They find out and carry out the task.", ["find out", "carry out"]],
  ["however degree", "However difficult the task was, the child was ready.", ["However"]],
  ["nearly no", "There were almost no students.", ["almost no"]],
  ["participle with adverb", "They have already selected a car.", []],
  ["CRLF", "The happy child arrived.\r\n\r\nThe car was small.", []],
  ["standalone CR", "The happy child\rThe car was small.", []],
  ["indentation", "  Because the road was icy, the bus arrived late.  \n", []],
  ["blank paragraphs", "Happy children\n\nBecause the road was icy, the bus arrived late.\n\n", []],
  ["all caps", "HAPPY CHILDREN were ready.", ["HAPPY CHILDREN"]],
  ["quoted article", 'She said "a" beside an honest guide.', ['"a"']],
  ["contraction", "The child’s ready but the children aren't happy.", ["child’s", "aren't"]],
];
const modes = [{}, { intensity: 0 }, { intensity: 2 }, { synonyms: false }, { arrange: false }, { synonyms: false, arrange: false }];
for (const [name, text, keep] of cases) {
  for (const seed of ["0", "1", "9007199254740993", "18446744073709551615"]) {
    for (const mode of modes) test(`parity / ${name} / ${seed} / ${JSON.stringify(mode)}`, () => {
      const options = { ...mode, seed };
      const js = rewrite(text, options, resources), cpp = native(text, options);
      assert.equal(js.text, cpp.text);
      assert.deepEqual(js.changes, cpp.changes);
      assert.equal(js.parts.map((p) => p.text).join(""), js.text);
      for (const span of keep) assert.ok(js.text.includes(span), `Lost protected span: ${span}\n${js.text}`);
      if (mode.synonyms === false && mode.arrange === false) assert.equal(js.text, text.replace(/\r\n?/g, "\n"));
    });
  }
}
for (const text of [
  "They did not leave because the road was icy.", "They only left because the road was icy.",
  "The bus never left because the road was icy.", "Because he was tired, John left.",
  "The bus left after the driver said that the road was clear.", "The bus left because the road was icy?",
  'She left because he said "The happy child was ready."', "The child asked why the bus left quickly.",
  "She said he left quickly.", "The teacher said the bus left because the road was icy.",
  "Sadly, the bus left the room.", "The road was safe and sound.",
]) test(`scope stays / ${text}`, () => {
  const js = rewrite(text, { synonyms: false }, resources);
  assert.equal(js.text, text);
  assert.equal(native(text, { synonyms: false }).text, text);
});
test("term locks are case-insensitive and do not match substrings", () => {
  const text = "The happy child bought a car. The happy children bought cars.";
  const options = { protectedTerms: ["HAPPY", "child", "bought", "car"] };
  const result = rewrite(text, options, resources);
  assert.equal(result.text.split(". ")[0], "The happy child bought a car");
  assert.ok(result.text.includes("youngsters") && result.text.includes("automobiles"));
  assert.equal(native(text, options).text, result.text);
});
test("locked phrase disables clause moves", () => {
  const text = "Because the road was icy, the bus arrived late.";
  const options = { protectedTerms: ["the road"] };
  assert.equal(native(text, options).text, text);
  assert.equal(rewrite(text, options, resources).text, text);
});
test("vary-quotes changes words but never quote structure", () => {
  const text = '"The happy child was ready."';
  const options = { protectQuotes: false };
  const result = rewrite(text, options, resources);
  assert.notEqual(result.text, text);
  assert.equal(result.text[0], '"'); assert.equal(result.text.at(-1), '"');
  assert.equal(result.changes.some((c) => c.kind === "arrangement"), false);
  assert.equal(native(text, options).text, result.text);
});
test("participle cue crosses an adverb", () => {
  assert.ok(native("They have already selected a car.").text.includes("have already chosen"));
});
test("long passage is deterministic and preserves paragraphs", () => {
  const text = ("The happy child bought a car.\n\n").repeat(1500);
  const js = rewrite(text, { seed: "18446744073709551615" }, resources);
  const cpp = native(text, { seed: "18446744073709551615" });
  assert.equal(js.text, cpp.text);
  assert.equal(js.text.split("\n\n").length, 1501);
  assert.equal(js.changes.length, cpp.changes.length);
});
for (const args of [["--seed", "-1"], ["--seed", "1junk"], ["--seed", "+1"], ["--seed", " 1"], ["--seed", "18446744073709551616"], ["--intensity", "1x"], ["--intensity", "1.0"], ["--intensity", "3"], ["--text"], ["--unknown"], ["--text", "x", "file.txt"], ["--text", "a", "--text", "b"], ["--arrange-only", "--synonyms-only"], ["--protect", ""], ["--output", ""]]) test(`CLI rejects ${JSON.stringify(args)}`, () => {
  const result = exec(args);
  assert.equal(result.status, 1); assert.match(result.stderr, /synomizer:/); assert.equal(result.stdout, "");
});
test("JSON escapes control characters and keeps full seed precision", () => {
  const text = '雪🙂\n\t"quotes" \\ \u0001';
  const result = native(text, { synonyms: false, arrange: false, seed: "18446744073709551615" });
  assert.equal(result.text, text); assert.equal(result.seed, "18446744073709551615");
});
test("explicit stdin dash", () => assert.equal(exec(["--no-rewrite", "-"], "a\r\nb").stdout, "a\nb"));
test("Unicode inline CLI arguments", () => {
  const text = "The café was happy. 中文🙂";
  const result = exec(["--json", "--text", text]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).text, rewrite(text, {}, resources).text);
});
test("Unicode filenames and output errors", () => {
  const dir = mkdtempSync(join(tmpdir(), "synomizer-test-"));
  try {
    const input = join(dir, "中文-café.txt"), output = join(dir, "résultat.txt");
    writeFileSync(input, "The happy child.\r\n");
    let result = exec([input, "--output", output]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, "utf8"), native("The happy child.\r\n").text);
    result = exec(["--text", "x", "--output", join(dir, "missing", "out.txt")]);
    assert.equal(result.status, 1);
    result = exec([join(dir, "absent.txt")]); assert.equal(result.status, 1);
    result = exec(["--no-rewrite", "--", input]); assert.equal(result.status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
for (const seed of [-1, 1.5, "1x", "18446744073709551616", 9007199254740992, NaN]) test(`browser rejects unsafe seed ${seed}`, () => assert.throws(() => rewrite("text", { seed }, resources), RangeError));
test("browser validates options", () => {
  assert.throws(() => rewrite(123, {}, resources), TypeError);
  assert.throws(() => rewrite("text", { intensity: NaN }, resources), RangeError);
  assert.throws(() => rewrite("text", { protectedTerms: "not an array" }, resources), TypeError);
});

test("standard mode does not confuse correctness, health or locality with narrower senses", () => {
  const text = "The healthy child showed the correct route to the local students.";
  const result = native(text);
  for (const word of ["healthy", "correct", "local"]) assert.ok(result.text.includes(word));
});
