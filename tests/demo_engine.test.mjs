// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
// The C++ binary is the reference. This test fails if the browser port drifts.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadResources, rewrite } from "../docs/engine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binary = [process.env.SYNOMIZER_BIN, path.join(root, "build", "synomizer"), path.join(root, "build", "synomizer.exe"), path.join(root, "build", "Release", "synomizer.exe")]
  .find((candidate) => candidate && existsSync(candidate));
const resources = loadResources(
  readFileSync(path.join(root, "data", "lexicon.tsv"), "utf8"),
  readFileSync(path.join(root, "data", "phrases.txt"), "utf8"),
);

const paragraph =
  "The careful teacher helped the happy children. Because the weather was cold, the class started the project " +
  "late. She quietly explained the main idea, and the students were glad to assist. They purchased a small car " +
  "for the school trip and quickly found the correct route. The calm physician said the tired boy was healthy. " +
  "Although the journey was long, the group remained cheerful. The writer described the final result in an honest " +
  "report. The crowd was silent when the meeting ended. The local students found a useful answer and remained " +
  "calm. It was a small victory.";

function native(text, options = {}) {
  const args = ["--show-changes", "--seed", String(options.seed ?? 1), "--intensity", String(options.intensity ?? 1)];
  if (options.synonyms === false && options.arrange === false) {
    args.push("--no-rewrite");
  } else if (options.synonyms === false) {
    args.push("--arrange-only");
  } else if (options.arrange === false) {
    args.push("--synonyms-only");
  }
  for (const term of options.protectedTerms || []) args.push("--protect", term);
  if (options.protectQuotes === false) {
    args.push("--vary-quotes");
  }
  assert.ok(binary, "build synomizer before running the browser comparison");
  const run = spawnSync(binary, args, { input: text, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.error?.message || "synomizer failed");
  return { text: run.stdout, changes: (run.stderr || "").replace(/\r/g, "").trimEnd() };
}

function browser(text, options = {}) {
  const result = rewrite(text, options, resources);
  const lines = result.changes.map((change) => {
    const tail = change.detail ? ` (${change.detail})` : "";
    return `[${change.kind}] ${change.before} => ${change.after}${tail}`;
  });
  return { text: result.text, changes: lines.join("\n") };
}

function same(name, text, options = {}) {
  test(name, () => {
    const left = native(text, options);
    const right = browser(text, options);
    assert.equal(right.text, left.text, name);
    assert.equal(right.changes, left.changes, `${name} changes`);
  });
}

const arrange = { synonyms: false };
const off = { synonyms: false, arrange: false };

same("empty", "");
same("greeting", "Hello, world!");
same("ambiguous bank", "The bank was on the right.");
same("decimal", "The value was 3.14 exactly.");
same("abbreviation", "Dr. Smith arrived late.");
same("blank lines", "Line one.\n\nLine two.", off);
same("roundtrip quote", 'She said "happy" once.', off);
same("fronted because", "Because the road was icy, the bus arrived late.", arrange);
same("trailing because", "The bus arrived late because the road was icy.", arrange);
same("pronoun I", "I stayed because the road was icy.", arrange);
same("proper noun", "Alice left because the bus arrived.", arrange);
same("even though", "Even though the road was icy, the bus arrived late.", arrange);
same("mr clause", "Because Mr. Smith was late, the bus arrived.", arrange);
same("decimal clause", "Because the value was 3.14, the bus arrived.", arrange);
same("final though", "The bus arrived late, though.", arrange);
same("after a noun", "We left after the meeting.", arrange);
same("coordinated although", "Although the journey was long, the group remained cheerful and completed the work.", arrange);
same("fronted adverb", "Quickly, she left the room.", arrange);
same("final adverb", "She left the room quickly.", arrange);
same("adjective swap", "It was a bright and cheerful room.", arrange);
same("purchase", "They purchased a car.");
same("participle choose", "They have selected a car.");
same("past choose", "They selected a car.");
same("started the car", "She started the car.");
same("ditransitive", "They bought her a car.");
same("find", "They find the keys.");
same("find out", "They find out things.");
same("person", "A person arrived.");
same("bigger", "A bigger car waited.");
same("happier", "She is happier today.");
same("ran fast", "They ran fast.");
same("remained calm", "They remained calm.");
same("honest", "It was an honest mistake.");
same("hidden money", "The money was hidden.");
same("children", "The children were ready.");
same("short visit", "It was a short visit.");
same("short man", "It was a short man.");
same("many", "Many children arrived.");
same("many of", "Many of the children arrived.");
same("careful verb", "She tried to change the plan.");
same("intensity 2", "She tried to change the plan.", { intensity: 2 });
same("intensity 0", "The happy child bought a car.", { intensity: 0 });
same("intransitive start", "The meeting started early.");
same("quotes", 'The happy child said "happy".');
same("used to", "She used to help.");
same("proper names", "Alice was happy in Paris.");
same("acronym", "NASA was happy.");
same("paragraph seed 1", paragraph, { seed: 1 });
same("paragraph seed 2", paragraph, { seed: 2 });
same("paragraph intensity 0", paragraph, { intensity: 0 });
same("paragraph intensity 2", paragraph, { intensity: 2 });
same("paragraph arrange only", paragraph, arrange);
same("articles seed 7", "She saw a big owl beside an honest guide and a union.", { seed: 7 });
same("crlf", "The happy child arrived.\r\nShe left quickly.");
