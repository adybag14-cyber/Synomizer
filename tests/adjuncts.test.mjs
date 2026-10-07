// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resources, run } from "./hardening-support.mjs";
import { loadResources, rewrite, rewriteVariants } from "../docs/engine.js";
function argsFor(options = {}) {
  const args = ["--json", "--seed", String(options.seed ?? 1), "--intensity", String(options.intensity ?? 1)];
  if (options.style) args.push("--style", options.style);
  if (options.synonyms === false && options.arrange === false) args.push("--no-rewrite");
  else if (options.synonyms === false) args.push("--arrange-only");
  else if (options.arrange === false) args.push("--synonyms-only");
  if (options.protectQuotes === false) args.push("--vary-quotes");
  for (const term of options.protectedTerms || []) args.push("--protect", term);
  return args;
}
function single(text, options = {}) {
  const cpp = run(argsFor(options), text);
  assert.equal(cpp.status, 0, cpp.stderr || cpp.error?.message);
  const native = JSON.parse(cpp.stdout), js = rewrite(text, options, resources);
  assert.deepEqual({ text: js.text, changes: js.changes }, { text: native.text, changes: native.changes });
  assert.equal(js.parts.map((part) => part.text).join(""), js.text);
  return js;
}
function batch(text, options = {}) {
  const runResult = run([...argsFor(options), "--variants", "3"], text);
  assert.equal(runResult.status, 0, runResult.stderr || runResult.error?.message);
  const cpp = JSON.parse(runResult.stdout), js = rewriteVariants(text, options, resources);
  assert.equal(js.requested, cpp.requested); assert.equal(js.attempts, cpp.attempts);
  assert.deepEqual(js.variants.map((v) => ({ seed: v.seed, style: v.style, text: v.result.text, changes: v.result.changes })),
    cpp.variants.map(({ version, ...v }) => v));
  assert.ok(js.attempts <= 12);
  assert.equal(new Set(js.variants.map((v) => v.result.text)).size, js.variants.length);
  for (const v of js.variants) {
    assert.deepEqual(rewrite(text, { ...options, seed: v.seed, style: v.style }, resources), v.result);
    assert.equal(v.result.parts.map((p) => p.text).join(""), v.result.text);
  }
  return js;
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
  for (const intensity of [1, 2]) test(`independent batch grammar guard / ${text} / ${seed} / ${intensity}`, () => {
    for (const v of batch(text, { seed, intensity }).variants) {
      for (const word of keep) assert.ok(v.result.text.includes(word), `${word} missing from ${v.result.text}`);
      if (absent) assert.doesNotMatch(v.result.text, absent);
    }
  });
}
for (const [text, expected, options] of [
  ["The teacher carefully examined the report.", "The teacher examined the report carefully.", { style: "recast", synonyms: false, seed: "1" }],
  ["The teacher carefully examined the report.", "Carefully, the teacher examined the report.", { style: "recast", synonyms: false, seed: "2" }],
  ["She worked in a careful manner.", "She worked carefully.", {}],
  ["She worked in an efficient manner.", "She worked efficiently.", {}],
  ["On a daily basis, she studied.", "Daily, she studied.", {}],
  ["She visited daily.", "She visited on a daily basis.", {}],
  ["She visited daily.", "She visited daily.", { intensity: 0 }],
  ["She worked in a careful manner.", "She worked in a cautious manner.", { style: "close" }],
  ["She is happier today.", "She is more cheerful today.", {}],
  ["The aircraft were ready.", "The airplanes were prepared.", {}],
  ["An aircraft was ready.", "An airplane was prepared.", {}],
  ["The airplanes were ready.", "The aircraft were prepared.", {}],
  ["They finished the project.", "They completed the project.", {}],
]) test(`adjunct or number agreement / ${text} / ${JSON.stringify(options)}`, () => {
  const result = single(text, options);
  assert.equal(result.text, expected);
  if (options.style === "close") assert.ok(!result.changes.some((c) => c.kind === "phrase"));
});
for (const text of [
  "She only worked in a careful manner.", "She did not work in a careful manner.",
  "She barely worked in a careful manner.", "She worked in a very careful manner.",
  "She knew that he worked in a careful manner.", "He said that she visited daily.",
  "She worked in a careful manner and he left.", "She worked in a careful manner?",
  "She said \"She worked in a careful manner.\"", "She worked in a\ncareful manner.",
  "The daily was printed.", "The report was written by an author in a careful manner.",
]) test(`adjunct scope cannot be forced / ${text}`, () => {
  for (const style of ["balanced", "close", "recast"]) {
    const result = single(text, { style });
    assert.ok(!result.changes.some((c) => c.kind === "phrase" && c.detail === "Matched adjunct phrase"), result.text);
  }
});
test("phrase locks and disabled operations survive every style and alternative", () => {
  const text = "She worked in a careful manner. The happy child bought a car.";
  const options = { protectedTerms: ["careful manner", "happy child"] };
  for (const v of batch(text, options).variants) {
    assert.ok(v.result.text.includes("in a careful manner")); assert.ok(v.result.text.includes("happy child"));
  }
  for (const style of ["balanced", "close", "recast"]) {
    const result = single("She worked in a careful manner.", { style, synonyms: false });
    assert.ok(!result.changes.some((c) => c.kind === "phrase"));
  }
});
test("every adjunct rule has matching native/browser execution in every profile", () => {
  for (const rule of resources.rephrases) {
    const source = rule.source.join(" ");
    for (const style of ["balanced", "close", "recast"]) {
      single(`She worked ${source}.`, { style });
      single(`${source[0].toUpperCase()+source.slice(1)}, she worked.`, { style });
    }
  }
});
test("adjunct schema is explicit, valid and duplicate-free", () => {
  const table = readFileSync(new URL("../data/rephrases.tsv", import.meta.url), "utf8");
  const lines = table.split(/\r?\n/).filter((s) => s && !s.startsWith("#"));
  const seen = new Set();
  for (const line of lines) {
    const [source, target, position, minimum, ...extra] = line.split("\t");
    assert.equal(extra.length, 0); assert.match(source, /^[a-z]+(?: [a-z]+)*$/); assert.match(target, /^[a-z]+(?: [a-z]+)*$/);
    assert.ok(["edge", "tail"].includes(position)); assert.ok(["0", "1"].includes(minimum));
    assert.ok(!seen.has(source)); seen.add(source);
  }
  assert.equal(resources.rephrases.length, lines.length);
  assert.throws(() => loadResources("", "", "x\ty\tbogus\t0"), TypeError);
});
test("bounded seed type checks protect public browser entry points", () => {
  for (const seed of [[], [1], {}, "0".repeat(100000)]) {
    assert.throws(() => rewrite("hello", { seed }, resources), RangeError);
    assert.throws(() => rewriteVariants("hello", { seed }, resources), RangeError);
  }
});
