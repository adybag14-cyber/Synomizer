// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { resources, run } from "./hardening-support.mjs";
import { rewrite, rewriteVariants } from "../docs/engine.js";

const commands = [
  "Question the result.", "Answer the question.", "Store the medicine.",
  "Picture a car.", "Film the event.", "Ship the tool.",
  "Lie to the children.", "Part with the money.", "Cause no damage.",
];
for (const text of commands) for (const seed of ["1", "3", "42", "18446744073709551615"]) {
  for (const intensity of [1, 2]) test(`command is not a noun / ${text} / ${seed} / ${intensity}`, () => {
    const verb = text.split(" ")[0] + " ";
    for (const style of ["balanced", "close", "recast"]) {
      const options = { seed, intensity, style };
      const result = rewrite(text, options, resources);
      const native = run(["--json", "--seed", seed, "--intensity", String(intensity), "--style", style], text);
      assert.equal(native.status, 0, native.stderr);
      const cpp = JSON.parse(native.stdout);
      assert.ok(result.text.startsWith(verb), result.text);
      assert.ok(cpp.text.startsWith(verb), cpp.text);
      assert.deepEqual({ text: result.text, changes: result.changes }, { text: cpp.text, changes: cpp.changes });
    }
    const js = rewriteVariants(text, { seed, intensity }, resources);
    const native = run(["--json", "--variants", "3", "--seed", seed, "--intensity", String(intensity)], text);
    assert.equal(native.status, 0, native.stderr);
    const cpp = JSON.parse(native.stdout);
    assert.deepEqual(js.variants.map(v => v.result.text), cpp.variants.map(v => v.text));
    for (const v of js.variants) assert.ok(v.result.text.startsWith(verb), v.result.text);
  });
}

test("explicit noun frames still permit nominal synonyms", () => {
  for (const [text, pattern] of [
    ["The questions were difficult.", /^The inquiries were /],
    ["The answer was useful.", /^The (response|reply) was /],
    ["A film was interesting.", /^A movie was /],
  ]) {
    const js = rewrite(text, {}, resources), native = run(["--json"], text);
    assert.equal(native.status, 0, native.stderr);
    const cpp = JSON.parse(native.stdout);
    assert.match(js.text, pattern); assert.match(cpp.text, pattern);
    assert.equal(js.text, cpp.text);
  }
});
