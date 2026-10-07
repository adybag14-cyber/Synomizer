// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resources, run, root } from "./hardening-support.mjs";
import { rewrite, rewriteVariations } from "../docs/engine.js";
function argsFor(options = {}) {
  const args = ["--json", "--seed", String(options.seed ?? 1), "--intensity", String(options.intensity ?? 1), "--density", String(options.density ?? 100)];
  if (options.synonyms === false && options.arrange === false) args.push("--no-rewrite");
  else if (options.synonyms === false) args.push("--arrange-only");
  else if (options.arrange === false) args.push("--synonyms-only");
  if (options.mixedMoves) args.push("--mixed-moves");
  if (options.protectQuotes === false) args.push("--vary-quotes");
  for (const term of options.protectedTerms || []) args.push("--protect", term);
  return args;
}
function native(text, options = {}, count) {
  const args = argsFor(options);
  if (count !== undefined) args.push("--variants", String(count));
  const result = run(args, text);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}
function compare(text, options = {}, count = 3) {
  const cpp = native(text, options, count), js = rewriteVariations(text, options, resources, count);
  assert.equal(js.requested, cpp.requested);
  assert.equal(js.candidatesConsidered, cpp.candidatesConsidered);
  const project = (v) => ({ options: v.options, text: v.result.text, changes: v.result.changes });
  assert.deepEqual(js.variations.map(project), cpp.variations.map((v) => ({ options: v.options, text: v.text, changes: v.changes })));
  assert.ok(js.candidatesConsidered <= 12 && js.candidatesConsidered >= 1);
  assert.ok(js.variations.length >= 1 && js.variations.length <= count);
  assert.equal(new Set(js.variations.map((v) => v.result.text)).size, js.variations.length);
  for (const v of js.variations) {
    assert.equal(v.result.parts.map((p) => p.text).join(""), v.result.text);
    assert.deepEqual(rewrite(text, v.options, resources), v.result, "Every result must replay from the ORIGINAL using its own options");
    assert.ok(v.options.intensity <= (options.intensity ?? 1));
    assert.equal(v.options.protectQuotes, options.protectQuotes !== false);
    assert.deepEqual(v.options.protectedTerms, options.protectedTerms || []);
    if (options.synonyms === false) assert.equal(v.options.synonyms, false);
    if (options.arrange === false) assert.equal(v.options.arrange, false);
    if (js.variations.length > 1) assert.notEqual(v.result.text, text.replace(/\r\n?/g, "\n"), "Do not pad a batch with the original");
  }
  return js;
}
const sample = readFileSync(new URL("../examples/sample.txt", import.meta.url), "utf8");
for (const seed of ["0", "1", "7", "9007199254740993", "18446744073709551615"]) {
  for (const count of [1, 2, 3]) for (const options of [{}, { intensity: 0 }, { intensity: 2 }, { arrange: false }, { synonyms: false }, { density: 65, mixedMoves: true }])
    test(`batch parity / seed ${seed} / count ${count} / ${JSON.stringify(options)}`, () => {
      const set = compare(sample, { ...options, seed }, count);
      if (options.synonyms !== false) assert.equal(set.variations.length, count);
    });
}
const guardCases = [
  ["She helped the child learn English.", ["helped"], /\b(assisted|aided)\b/],
  ["She helped the child to learn English.", ["helped"], /\b(assisted|aided)\b/],
  ["She proposed to leave.", ["proposed to"], /suggested to/],
  ["They tried the soup.", ["tried"], /attempted/],
  ["The sales declined sharply.", ["declined"], /refused/],
  ["They recalled the cars.", ["recalled"], /remembered/],
  ["She caught a cold.", ["a cold"], /a chilly/],
  ["It was a fake.", ["a fake"], /an artificial/],
  ["She had little money.", ["little"], /small/],
  ["She felt a little sad.", ["a little"], /a small/],
  ["The students question the result.", ["question"], /inquiry/],
  ["The children film the event.", ["film"], /movie/],
  ["It was a strong argument.", ["argument"], /dispute|quarrel/],
  ["Two frightened elephants arrived.", [], /afraid elephants/],
  ["They finished the soup.", ["finished"], /completed/],
  ["The aircraft arrived.", ["aircraft"], /airplanes?/],
  ["Because he was late, John carefully examined the report.", ["Because he was late, John"], /report because/],
  ["She very carefully examined the report.", ["very"], /report very/],
  ["She only carefully examined the report.", ["only"], /report only/],
  ["She carefully inspected the equipment that he repaired.", ["that he"], /repaired with care/],
  ["The scientist measured the confidence interval and standard error.", ["confidence interval", "standard error"], /standard mistake/],
  ["She said \"in a careful manner\" and visited https://happy.example/car.", ['"in a careful manner"', "https://happy.example/car"], null],
  ["She worked in a\ncareful manner.", ["\n"], null],
  ["The daily was printed.", ["The daily"], /The on a daily basis/],
];
for (const [text, keep, absent] of guardCases) for (const seed of ["1", "3", "42", "18446744073709551615"]) {
  for (const intensity of [1, 2]) test(`all-candidate safety / ${text} / ${seed} / ${intensity}`, () => {
    const set = compare(text, { seed, intensity });
    for (const v of set.variations) {
      for (const word of keep) assert.ok(v.result.text.includes(word), `${word} missing from ${v.result.text}`);
      if (absent) assert.doesNotMatch(v.result.text, absent);
    }
  });
}
for (const [text, expected, options] of [
  ["She worked in a careful manner.", "She worked carefully.", {}],
  ["She worked in an efficient manner.", "She worked efficiently.", {}],
  ["On a daily basis, she studied.", "Daily, she studied.", {}],
  ["She visited daily.", "She visited on a daily basis.", {}],
  ["She visited daily.", "She visited daily.", { intensity: 0 }],
  ["She is happier today.", "She is more cheerful today.", {}],
  ["The aircraft were ready.", "The airplanes were prepared.", {}],
  ["An aircraft was ready.", "An airplane was prepared.", {}],
  ["The airplanes were ready.", "The aircraft were prepared.", {}],
  ["They finished the project.", "They completed the project.", {}],
  ["The teacher carefully examined the report.", "The teacher examined the report carefully.", { synonyms: false, seed: "1" }],
  ["The teacher carefully examined the report.", "Carefully, the teacher examined the report.", { synonyms: false, seed: "2" }],
]) test(`new capability / ${text} / ${JSON.stringify(options)}`, () => {
  const actual = rewrite(text, options, resources);
  assert.equal(actual.text, expected);
  const cpp = native(text, options);
  assert.equal(actual.text, cpp.text); assert.deepEqual(actual.changes, cpp.changes);
});
test("three materially different sample results without a quality-score fiction", () => {
  const batch = compare(sample);
  assert.equal(batch.variations.length, 3);
  assert.deepEqual(rewriteVariations(sample, {}, resources), batch);
  for (const v of batch.variations) assert.ok(!("qualityScore" in v));
});
test("short and protected inputs are not padded with duplicate or invented results", () => {
  for (const text of ["", "xyzzy", "car", '"The happy child bought a car."']) {
    const batch = compare(text);
    assert.equal(batch.variations.length, 1);
  }
  const text = "The happy child bought a car.";
  const batch = compare(text, { protectedTerms: ["happy", "child", "bought", "car"] });
  assert.equal(batch.variations[0].result.text, text);
});
test("term locks apply to every phrase rule and every generated version", () => {
  const text = "She worked in a careful manner. The happy child bought a car.";
  const batch = compare(text, { protectedTerms: ["careful manner", "happy child"] });
  for (const v of batch.variations) {
    assert.ok(v.result.text.includes("in a careful manner")); assert.ok(v.result.text.includes("happy child"));
  }
});
test("disabled edits round-trip and density zero only suppresses lexical edits", () => {
  const text = "  The happy child.\r\n\r\nBecause the road was icy, the bus arrived.\r";
  const off = compare(text, { synonyms: false, arrange: false });
  assert.equal(off.variations.length, 1); assert.equal(off.variations[0].result.text, text.replace(/\r\n?/g, "\n"));
  assert.equal(compare(text, { density: 0, arrange: false }).variations[0].result.text, text.replace(/\r\n?/g, "\n"));
});
test("public options are not mutated", () => {
  const options = Object.freeze({ seed: "1", protectedTerms: Object.freeze(["teacher"]) });
  const batch = rewriteVariations(sample, options, resources);
  assert.equal(options.seed, "1"); assert.deepEqual(options.protectedTerms, ["teacher"]);
  batch.variations[0].options.protectedTerms.push("local only");
  assert.deepEqual(options.protectedTerms, ["teacher"]);
  for (const variant of batch.variations.slice(1)) assert.deepEqual(variant.options.protectedTerms, ["teacher"]);
});
test("long batches preserve all text, paragraphs and deterministic metadata", () => {
  const text = ("The careful teacher examined the report.\n\n").repeat(2000);
  const set = compare(text, { seed: "18446744073709551615" });
  assert.equal(set.variations.length, 3);
  for (const v of set.variations) assert.equal(v.result.text.split("\n\n").length, 2001);
});
for (const count of [0, 4, -1, 1.5, NaN, "3", null]) test(`API rejects count ${count}`, () => assert.throws(() => rewriteVariations(sample, {}, resources, count), RangeError));
for (const args of [["--variants", "0"], ["--variants", "4"], ["--variants", "-1"], ["--variants", "3junk"], ["--variants"], ["--density", "101"], ["--density", "-1"], ["--density", "1.5"]])
  test(`CLI validates new option ${args.join(" ")}`, () => { const out = run(args); assert.equal(out.status, 1); assert.equal(out.stdout, ""); });
test("browser seed input has explicit bounded types", () => {
  for (const seed of [[], [1], {}, "0".repeat(100000)]) assert.throws(() => rewriteVariations(sample, { seed }, resources), RangeError);
  assert.throws(() => rewrite(sample, { density: NaN }, resources), RangeError);
});
test("phrase resource schema is explicit and duplicate-free", () => {
  const lines = readFileSync(new URL("../data/rephrases.tsv", import.meta.url), "utf8").split(/\r?\n/).filter((s) => s && !s.startsWith("#"));
  const seen = new Set();
  for (const line of lines) {
    const [source, target, position, minimum, ...extra] = line.split("\t");
    assert.equal(extra.length, 0); assert.match(source, /^[a-z]+(?: [a-z]+)*$/); assert.match(target, /^[a-z]+(?: [a-z]+)*$/);
    assert.ok(["edge", "tail"].includes(position)); assert.ok(["0", "1"].includes(minimum));
    assert.ok(!seen.has(source)); seen.add(source);
  }
  assert.equal(resources.rephrases.length, lines.length);
});
