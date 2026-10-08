import { parseVocabulary } from "./standards.js";
// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
const SAMPLE = "The careful teacher helped the happy children. Because the weather was cold, the class started the project late. She quietly explained the main idea, and the students were glad to assist. They purchased a small car for the school trip and quickly found the correct route. The calm physician said the tired boy was healthy. Although the journey was long, the group remained cheerful. The writer described the final result in an honest report. The crowd was silent when the meeting ended. The local students found a useful answer and remained calm. It was a small victory.";

const VERSION = "1.5.0";
const $ = (selector) => document.querySelector(selector);
const source = $("#source"), status = $("#status"), banner = $("#banner");
const changes = $("#changes"), seed = $("#seed"), intensity = $("#intensity"), grid = $("#variations");
const cards = [...document.querySelectorAll(".variant-card")];
const PROFILE_NAMES = { balanced: "Balanced", close: "Light touch", recast: "Restructured" };
const MAX = 200_000, MAX_SEED = (1n << 64n) - 1n;
let worker, ready = false, busy = false, revision = 0, running = null, pending = false;
let timer, deadline, latest = null, ledgerLimit = 250;
let vocabularyImportRevision = 0;
let importRevision = 0; // A newer file choice supersedes every older pending read.
const wordCount = (text) => (text.match(/\S+/g) || []).length;
const escapeHtml = (text) => text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
function current(index = latest?.selected) {
  return !busy && latest?.id === revision ? latest.batch.variations[index] : null;
}
function textReleaseAllowed(index = latest?.selected) {
  const variant=current(index);
  return !!variant && (!variant.options.requireConformity || variant.result.standards?.conformity?.releaseAllowed===true);
}
function exportsEnabled(enabled) {
  const allowed = enabled && !!current()?.result.text.length;
  for (const id of ["#export-changes", "#export-all"]) $(id).disabled = !allowed;
  for (const id of ["#copy", "#download"]) $(id).disabled = !allowed || !textReleaseAllowed();
  cards.forEach((card, index) => {
    const present = enabled && !!current(index);
    card.querySelector("input").disabled = !present;
    for (const button of card.querySelectorAll("button")) button.disabled = !present || !current(index).result.text.length ||
      (["copy","download"].includes(button.dataset.action) && !textReleaseAllowed(index));
  });
}
function clearResults() {
  latest = null;
  renderStandards(null);
  cards.forEach((card, index) => {
    card.hidden = index !== 0; card.classList.toggle("is-selected", index === 0);
    card.querySelector(".variant-output").id = index === 0 ? "output" : `output-${index+1}`;
    card.querySelector(".variant-output").replaceChildren();
    card.querySelector(".variant-stats").textContent = "";
    card.querySelector(".variant-options").textContent = "";
    card.querySelector("input").checked = index === 0;
  });
  grid.dataset.count = "1";
  exportsEnabled(false); changes.replaceChildren();
  $("#more-changes").hidden = true;
  $("#variation-summary").textContent = "";
  $("#ledger-choice").textContent = "Choose a variation to review its changes.";
}
function invalidate() {
  revision++; clearResults();
  $("#source-count").textContent = `${wordCount(source.value).toLocaleString()} words / ${source.value.length.toLocaleString()} characters`;
}
function clearError() { banner.hidden = true; banner.textContent = ""; }
function fail(message) {
  clearResults(); banner.textContent = message; banner.hidden = false;
  status.textContent = "No current rewrite. Correct the input or retry.";
  for (const card of cards) card.querySelector(".variant-output").setAttribute("aria-busy", "false");
}
const STANDARD_NAMES = { ste: "ASD-STE100 aid", plain: "Plain-language aid", combined: "STE + plain-language aid" };
function updateMode() {
  const standard = $("#profile").value !== "variation";
  $("#standard-options").hidden = !standard;
  seed.disabled = intensity.disabled = $("#variant").disabled = standard;
  $("#rewrite").textContent = standard ? ($("#check-only").checked ? "Check text" : "Create clarity draft") : "Create 3 variations";
  $("#variations-heading").textContent = standard ? "One source. One consistent draft." : "One original. Three possibilities.";
  $("#variation-guidance").hidden = standard;
  $("#word-operation-label").textContent = standard ? "Clarity word edits" : "Synonyms";
}
function renderStandards(report) {
  $("#standards-report").hidden = !report;
  $("#standard-findings").replaceChildren();
  $("#release-blockers").replaceChildren();$("#rule-coverage").replaceChildren();
  $("#release-decision").textContent="";$("#report-binding").textContent="";
  $("#coverage-panel").hidden=true;$("#show-coverage").setAttribute("aria-expanded","false");
  if (!report) { $("#standards-summary").textContent = ""; $("#standards-metrics").textContent = ""; return; }
  $("#standards-summary").textContent = `${STANDARD_NAMES[report.profile]}: review required. Full conformity and semantic equivalence have not been verified.`;
  $("#standards-metrics").textContent = `Screening only: longest sentence ${report.before.longestSentence} → ${report.after.longestSentence} words; count units above the target ${report.before.longSentences} → ${report.after.longSentences}; possible passives ${report.before.possiblePassives} → ${report.after.possiblePassives}. Imported vocabulary: ${report.vocabularyEntries} entries. The ${report.sentenceTarget}-word target is not an ISO requirement; STE counts need section 8 review.`;
  const fragment = document.createDocumentFragment();
  for (const finding of report.findings) {
    const li = document.createElement("li"), title = document.createElement("strong"), text = document.createElement("p");
    title.textContent = `${finding.code}${finding.sentence ? ` / screening unit ${finding.sentence}` : ""}`;
    text.textContent = finding.message; li.append(title, text);
    if (finding.evidence) { const quote = document.createElement("p"); quote.className = "finding-evidence"; quote.textContent = finding.evidence; li.append(quote); }
    fragment.append(li);
  }
  $("#standard-findings").append(fragment);
  const c=report.conformity;
  if(c) {
    $("#release-decision").textContent=c.strictRequested ? "STRICT RELEASE BLOCKED: final-text copy/download is disabled. The candidate below is an unverified draft; report export remains available." : "UNVERIFIED DRAFT: conformity is not established. Enable strict release to withhold text exports.";
    $("#report-binding").textContent=`SHA-256 of LF-normalized source: ${c.sourceSha256}\nSHA-256 of draft: ${c.draftSha256}\nThese fingerprints identify text; they are not approval signatures or semantic proofs.`;
    for(const reason of c.blockers){const li=document.createElement("li");li.textContent=reason;$("#release-blockers").append(li);}
    for(const r of c.requirements){const row=document.createElement("tr");for(const value of [r.standard+" / "+r.rule,r.method,r.result,r.note]){const cell=document.createElement("td");cell.textContent=value;row.append(cell);}$("#rule-coverage").append(row);}
    $("#show-coverage").textContent=`Show ${c.requirements.length} rule/principle review entries (not verified rules)`;
  }
}
function optionsFromForm() {
  const standard = $("#profile").value !== "variation";
  const value = standard ? "1" : seed.value.trim();
  if (!/^[0-9]+$/.test(value) || value.length > 20 || BigInt(value) > MAX_SEED) throw new Error("Seed must be an unsigned 64-bit integer: 0 to 18446744073709551615.");
  const options = { seed: value, intensity: standard ? 1 : Number(intensity.value), synonyms: $("#synonyms").checked,
    arrange: $("#arrange").checked, protectQuotes: $("#quotes").checked,
    protectedTerms: $("#protected").value.split(/\r?\n/).map((term) => term.trim()).filter(Boolean) };
  if (standard) Object.assign(options, { profile: $("#profile").value, textType: $("#text-type").value,
    checkOnly: $("#check-only").checked, audience: $("#audience").value, purpose: $("#purpose").value,
    vocabulary: parseVocabulary($("#vocabulary").value), requireConformity: $("#require-conformity").checked,
    structuredLists: $("#structured-lists").checked });
  return options;
}
function renderLedger() {
  changes.replaceChildren();
  const list = current()?.result.changes || [];
  if (!list.length) {
    const item = document.createElement("li"); item.className = "empty";
    item.textContent = "No eligible change on this pass. The original is preserved when a rule does not fit.";
    changes.append(item);
  }
  const fragment = document.createDocumentFragment();
  for (const change of list.slice(0, ledgerLimit)) {
    const item = document.createElement("li");
    for (const [text, cls] of [[`${change.kind} / ${change.detail}`, "kind"], [change.before, "before"], ["\u2192", "arrow"], [change.after, "after"]]) {
      const part = document.createElement("span"); part.textContent = text; part.className = cls; item.append(part);
    }
    fragment.append(item);
  }
  changes.append(fragment);
  $("#more-changes").hidden = list.length <= ledgerLimit;
  $("#more-changes").textContent = `Show more changes (${Math.min(ledgerLimit, list.length)} of ${list.length})`;
  $("#ledger-choice").textContent = `Changes for variation ${(latest?.selected ?? 0)+1}. Phrase edits and sentence moves are included.`;
}
function select(index) {
  if (!current(index)) return;
  latest.selected = index;
  cards.forEach((card, i) => { card.classList.toggle("is-selected", i === index); card.querySelector("input").checked = i === index; card.querySelector(".variant-output").id = i === index ? "output" : `output-${i+1}`; });
  ledgerLimit = 250; renderLedger(); renderStandards(current()?.result.standards); exportsEnabled(true);
}
function render(batch, request) {
  latest = { batch, id: request.id, original: request.text, baseOptions: request.options, selected: 0 };
  clearError();
  cards.forEach((card, index) => {
    const variant = batch.variations[index]; card.hidden = !variant;
    if (!variant) return;
    const { result, options } = variant, output = card.querySelector(".variant-output");
    // Avoid hundreds of thousands of mark nodes for long documents. The full
    // ledger and exports remain available; nothing is truncated from the text.
    if (result.text.length > 50000) output.textContent = result.text;
    else output.innerHTML = result.parts.map((p) => p.changed ? `<mark>${escapeHtml(p.text)}</mark>` : escapeHtml(p.text)).join("");
    output.setAttribute("aria-busy", "false");
    const synonyms = result.changes.filter((c) => c.kind === "synonym").length;
    const phrases = result.changes.filter((c) => c.kind === "phrase").length;
    const moves = result.changes.filter((c) => c.kind === "arrangement").length;
    card.querySelector(".variant-stats").textContent = `${wordCount(result.text).toLocaleString()} words / ${synonyms} synonyms / ${moves} moves / ${phrases} phrases`;
    card.querySelector("h3").textContent = result.standards ? `${STANDARD_NAMES[options.profile]} / ${options.checkOnly ? "check only" : "draft"}` : `Variation ${index+1}: ${PROFILE_NAMES[options.style]}`;
    card.querySelector(".variant-options").textContent = `seed ${options.seed} / ${options.style === "close" ? "lighter word changes, original order" : options.arrange ? "eligible sentence moves" : "original order"}${result.text.length > 50000 ? " / highlights off for long text" : ""}`;
  });
  grid.dataset.count = String(batch.variations.length);
  const changed = batch.variations.filter((v) => v.result.text !== request.text.replace(/\r\n?/g, "\n")).length;
  $("#variation-summary").textContent = changed === 3 ? "Three different rewrites. Compare them, then choose your favourite." :
    changed ? `Found ${changed} distinct rewrite${changed === 1 ? "" : "s"} on this pass; no duplicates are shown.` :
    "No eligible rewrite found. Your original is preserved; duplicate alternatives are not invented.";
  const first = batch.variations[0].result;
  const synonyms = first.changes.filter((c) => c.kind === "synonym").length, moves = first.changes.filter((c) => c.kind === "arrangement").length;
  status.textContent = `${changed} distinct rewrite${changed === 1 ? "" : "s"} / seed ${request.options.seed} / variation 1: ${synonyms} synonyms / ${moves} moves${request.options.intensity === 2 ? " / Broader mode: review carefully." : ""}`;
  if (first.standards) {
    $("#variation-summary").textContent = request.options.checkOnly ? "Check only: no edits were made. Review the findings below." : "One deterministic clarity draft. No synonym diversity search was used; unresolved issues remain visible.";
    cards[0].querySelector(".variant-options").textContent = "Rule-based authoring aid / no language model / review required";
    status.textContent = `${STANDARD_NAMES[request.options.profile]} / ${request.options.checkOnly ? "checked without editing" : "draft ready"} / review required`;
  }
  select(0);
}
function setBusy(value) {
  busy = value; $("#cancel").hidden = !value;
  for (const card of cards) card.querySelector(".variant-output").setAttribute("aria-busy", String(value));
  if (value) exportsEnabled(false);
}
function workerFailed(instance, message) {
  if (instance !== worker) return;
  window.clearTimeout(deadline); worker = undefined; instance.terminate();
  ready = false; pending = false; running = null; setBusy(false); $("#retry").hidden = false; fail(message);
}
function startWorker() {
  worker?.terminate(); worker = undefined; ready = false; setBusy(false); running = null;
  window.clearTimeout(deadline);
  try {
    const instance = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker = instance;
    deadline = window.setTimeout(() => workerFailed(instance, "The word lists took too long to load. Check your connection and retry."), 20000);
    instance.onmessage = ({ data }) => {
      if (worker !== instance) return; // A terminated worker must never revive an old batch.
      if (data.type === "ready") {
        window.clearTimeout(deadline); ready = true; $("#retry").hidden = true; if (pending) runRewrite(); return;
      }
      window.clearTimeout(deadline);
      const request = running; running = null; setBusy(false);
      if (data.type === "error" && data.id === undefined) { workerFailed(instance, data.message); return; }
      if (data.id === revision) {
        if (data.type === "result" && request) render(data.batch, request);
        else fail(data.message);
      }
      if (pending) runRewrite();
    };
    instance.onerror = (event) => { event.preventDefault(); workerFailed(instance, "The background rewriter could not start. Reload or retry in a browser supporting module workers."); };
  } catch { $("#retry").hidden = false; fail("This browser could not start the rewriter."); }
}
function runRewrite() {
  window.clearTimeout(timer);
  try {
    if (source.value.length > MAX) throw new Error("Use at most 200,000 characters in the browser. For longer files, use the C++ command-line tool.");
    const options = optionsFromForm();
    if (options.protectedTerms.length > 200 || options.protectedTerms.some((term) => term.length > 200)) throw new Error("Use at most 200 protected terms, each up to 200 characters.");
    if (!ready || busy) { pending = true; return; }
    pending = false; clearError();
    running = { id: revision, text: source.value, options };
    setBusy(true); status.textContent = "Comparing variations locally in your browser...";
    worker.postMessage(running);
    const instance = worker;
    deadline = window.setTimeout(() => workerFailed(instance, "The rewrite took too long. Try a shorter passage or fewer protected terms."), 30000);
  } catch (error) { pending = false; fail(error.message); }
}
function requestRewrite() {
  invalidate(); window.clearTimeout(timer);
  if (busy) { pending = true; startWorker(); } else runRewrite();
}
function schedule() {
  invalidate(); clearError(); pending = false;
  if (busy) startWorker(); // Stop obsolete expensive searches immediately.
  status.textContent = "Text changed; preparing new variations...";
  window.clearTimeout(timer); timer = window.setTimeout(runRewrite, 180);
}
source.value = SAMPLE;
source.addEventListener("input", schedule);
for (const control of [seed, intensity, $("#synonyms"), $("#arrange"), $("#quotes"), $("#protected")]) control.addEventListener("input", schedule);
for (const control of [$("#profile"), $("#text-type"), $("#check-only"), $("#audience"), $("#purpose"), $("#vocabulary"), $("#require-conformity"), $("#structured-lists")]) {
  control.addEventListener("input", () => { updateMode(); schedule(); });
}

$("#tools").addEventListener("submit", (event) => { event.preventDefault(); requestRewrite(); });
$("#variant").addEventListener("click", () => {
  try { seed.value = String((BigInt(optionsFromForm().seed) + 1n) & MAX_SEED); requestRewrite(); }
  catch (error) { invalidate(); fail(error.message); }
});
$("#reset").addEventListener("click", () => {
  source.value = SAMPLE; seed.value = "1"; intensity.value = "1";
  $("#synonyms").checked = $("#arrange").checked = $("#quotes").checked = true;
  $("#protected").value = ""; $("#profile").value = "variation"; $("#check-only").checked = false; updateMode(); requestRewrite();
});
$("#clear").addEventListener("click", () => { source.value = ""; requestRewrite(); source.focus(); });
$("#cancel").addEventListener("click", () => {
  window.clearTimeout(timer); pending = false; invalidate(); startWorker(); status.textContent = "Rewrite cancelled. Your original text is unchanged.";
});
$("#retry").addEventListener("click", () => { invalidate(); clearError(); pending = true; startWorker(); });
async function copy(index = latest?.selected) {
  const variant = current(index); if (!variant || !textReleaseAllowed(index)) return;
  const id = revision;
  try { await navigator.clipboard.writeText(variant.result.text); if (revision === id) status.textContent = `Copied variation ${index+1}.`; }
  catch { if (revision === id) { banner.hidden = false; banner.textContent = "Clipboard access was refused. Select the rewrite and copy it, or download the text."; } }
}
function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function report(variant) {
  const output = { version: VERSION, seed: variant.options.seed, style: variant.options.style, options: variant.options, text: variant.result.text, changes: variant.result.changes };
  if (variant.result.standards) output.standards = variant.result.standards;
  return output;
}
function saveText(index = latest?.selected, name = "synomizer-rewrite.txt") {
  const variant = current(index); if (variant && textReleaseAllowed(index)) download(variant.result.text, name, "text/plain;charset=utf-8");
}
function saveReport(index = latest?.selected, name = "synomizer-changes.json") {
  const variant = current(index); if (variant) download(JSON.stringify(report(variant), null, 2)+"\n", name, "application/json");
}
$("#copy").addEventListener("click", () => copy());
$("#download").addEventListener("click", () => saveText());
$("#export-changes").addEventListener("click", () => saveReport());
$("#export-all").addEventListener("click", () => {
  if (!current()) return;
  const { batch } = latest;
  download(JSON.stringify({ version: VERSION, original: latest.original, baseOptions: latest.baseOptions,
    requested: batch.requested, attempts: batch.candidatesConsidered, selected: latest.selected+1,
    variants: batch.variations.map(report) }, null, 2)+"\n", "synomizer-variations.json", "application/json");
});
grid.addEventListener("change", (event) => {
  if (event.target.matches("input[data-select]")) select(Number(event.target.dataset.select));
});
grid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  const index = Number(button.closest(".variant-card").dataset.index);
  if (!current(index)) return;
  if (button.dataset.action === "copy") copy(index);
  if (button.dataset.action === "download") saveText(index, `synomizer-variation-${index+1}.txt`);
  if (button.dataset.action === "json") saveReport(index, `synomizer-variation-${index+1}.json`);
  if (button.dataset.action === "review") { select(index); $("#ledger-heading").focus(); }
});
$("#import").addEventListener("click", () => $("#file").click());
$("#file").addEventListener("change", async () => {
  const file = $("#file").files[0]; if (!file) return;
  const requestRevision = revision, importId = ++importRevision;
  try {
    if (file.size > MAX * 4) throw new Error("The selected file is too large. Use the C++ tool for longer files.");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    if (text.length > MAX) throw new Error("Use at most 200,000 characters in the browser.");
    if (revision !== requestRevision || importId !== importRevision) return;
    source.value = text; requestRewrite();
  } catch (error) { if (revision === requestRevision && importId === importRevision) { banner.hidden = false; banner.textContent = `Could not import file: ${error.message}`; } }
  finally { if (importId === importRevision) $("#file").value = ""; }
});
$("#more-changes").addEventListener("click", () => { ledgerLimit += 250; renderLedger(); });
source.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); requestRewrite(); } });
$("#import-vocabulary").addEventListener("click", () => $("#vocabulary-file").click());
$("#vocabulary-file").addEventListener("change", async () => {
  const file = $("#vocabulary-file").files[0]; if (!file) return;
  const importId = ++vocabularyImportRevision, initialRevision = revision;
  try {
    if (file.size > 1000000) throw new Error("Vocabulary must fit in 1,000,000 UTF-8 bytes.");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    const entries = parseVocabulary(text);
    if (importId !== vocabularyImportRevision || initialRevision !== revision) return;
    $("#vocabulary").value = text;
    $("#vocabulary-status").textContent = `Loaded ${entries.length} user-supplied entries. Their authority, completeness, senses and parts of speech still require review.`;
    requestRewrite();
  } catch (error) {
    if (importId === vocabularyImportRevision && initialRevision === revision) { banner.hidden = false; banner.textContent = `Could not import vocabulary: ${error.message}`; }
  } finally { if (importId === vocabularyImportRevision) $("#vocabulary-file").value = ""; }
});
$("#show-coverage").addEventListener("click",()=>{const panel=$("#coverage-panel");panel.hidden=!panel.hidden;$("#show-coverage").setAttribute("aria-expanded",String(!panel.hidden));});
updateMode(); invalidate(); pending = true; startWorker();
