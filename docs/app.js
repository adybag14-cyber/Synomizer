// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0

import { loadResources, rewrite } from "./engine.js";

const SAMPLE =
  "The careful teacher helped the happy children. Because the weather was cold, the class started the project late. She quietly explained the main idea, and the students were glad to assist. They purchased a small car for the school trip and quickly found the correct route. The calm physician said the tired boy was healthy. Although the journey was long, the group remained cheerful. The writer described the final result in an honest report. The crowd was silent when the meeting ended. The local students found a useful answer and remained calm. It was a small victory.";

const source = document.querySelector("#source");
const output = document.querySelector("#output");
const changes = document.querySelector("#changes");
const status = document.querySelector("#status");
const banner = document.querySelector("#banner");
const seedInput = document.querySelector("#seed");
const intensityInput = document.querySelector("#intensity");
const synonymsInput = document.querySelector("#synonyms");
const arrangeInput = document.querySelector("#arrange");
const quotesInput = document.querySelector("#quotes");
const sourceCount = document.querySelector("#source-count");
const outputCount = document.querySelector("#output-count");

let resources = null;
let latest = "";
let timer = 0;

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function wordCount(text) {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

function renderParts(parts) {
  output.innerHTML = parts.map((part) => {
    const safe = escapeHtml(part.text);
    return part.changed ? `<mark>${safe}</mark>` : safe;
  }).join("");
}

function renderChanges(list) {
  changes.replaceChildren();
  if (list.length === 0) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "No safe change on this pass.";
    changes.append(item);
    return;
  }
  for (const change of list) {
    const item = document.createElement("li");
    const kind = document.createElement("span");
    kind.className = "kind";
    kind.textContent = change.detail ? `${change.kind} · ${change.detail}` : change.kind;
    const from = document.createElement("span");
    from.textContent = change.before;
    const arrow = document.createElement("span");
    arrow.textContent = "→";
    const to = document.createElement("span");
    to.className = "after";
    to.textContent = change.after;
    item.append(kind, from, arrow, to);
    changes.append(item);
  }
}

function optionsFromForm() {
  const seedText = seedInput.value.trim();
  if (!/^\d+$/.test(seedText)) throw new Error("Seed must be a whole number.");
  if (BigInt(seedText) > 18446744073709551615n) throw new Error("Seed must fit in 64 bits.");
  return {
    seed: seedText,
    intensity: Number(intensityInput.value),
    synonyms: synonymsInput.checked,
    arrange: arrangeInput.checked,
    protectQuotes: quotesInput.checked,
  };
}

function showError(message) {
  banner.hidden = false;
  banner.textContent = message;
}

function clearError() {
  banner.hidden = true;
  banner.textContent = "";
}

function runRewrite() {
  if (!resources) return;
  sourceCount.textContent = `${wordCount(source.value)} words`;
  try {
    const result = rewrite(source.value, optionsFromForm(), resources);
    latest = result.text;
    clearError();
    renderParts(result.parts);
    renderChanges(result.changes);
    const synonyms = result.changes.filter((change) => change.kind === "synonym").length;
    const moves = result.changes.filter((change) => change.kind === "arrangement").length;
    outputCount.textContent = `${wordCount(result.text)} words`;
    status.textContent = `${synonyms} synonym${synonyms === 1 ? "" : "s"} · ${moves} move${moves === 1 ? "" : "s"} · seed ${seedInput.value.trim()}`;
  } catch (error) {
    showError(error.message || "Could not rewrite that text.");
  }
}

function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(runRewrite, 140);
}

source.value = SAMPLE;
source.addEventListener("input", schedule);
document.querySelector("#tools").addEventListener("submit", (event) => {
  event.preventDefault();
  runRewrite();
});
for (const control of [seedInput, intensityInput, synonymsInput, arrangeInput, quotesInput]) {
  control.addEventListener("change", runRewrite);
  control.addEventListener("input", schedule);
}
document.querySelector("#reset").addEventListener("click", () => {
  source.value = SAMPLE;
  seedInput.value = "1";
  intensityInput.value = "1";
  synonymsInput.checked = true;
  arrangeInput.checked = true;
  quotesInput.checked = true;
  runRewrite();
});
document.querySelector("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(latest);
    status.textContent = "Copied the rewrite.";
  } catch {
    showError("The browser refused the clipboard. Select the revise column and copy it.");
  }
});

try {
  const [lexicon, phrases] = await Promise.all([
    fetch("data/lexicon.tsv").then((response) => {
      if (!response.ok) throw new Error("lexicon");
      return response.text();
    }),
    fetch("data/phrases.txt").then((response) => {
      if (!response.ok) throw new Error("phrases");
      return response.text();
    }),
  ]);
  resources = loadResources(lexicon, phrases);
  runRewrite();
} catch {
  showError("The word lists did not load. Serve this folder with data/lexicon.tsv and data/phrases.txt beside it.");
  status.textContent = "Word lists unavailable.";
}
