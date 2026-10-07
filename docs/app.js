// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
const SAMPLE = "The careful teacher helped the happy children. Because the weather was cold, the class started the project late. She quietly explained the main idea, and the students were glad to assist. They purchased a small car for the school trip and quickly found the correct route. The calm physician said the tired boy was healthy. Although the journey was long, the group remained cheerful. The writer described the final result in an honest report. The crowd was silent when the meeting ended. The local students found a useful answer and remained calm. It was a small victory.";
const $ = (selector) => document.querySelector(selector);
const source = $("#source"), output = $("#output"), status = $("#status"), banner = $("#banner");
const changes = $("#changes"), seed = $("#seed"), intensity = $("#intensity");
const MAX = 200_000, MAX_SEED = (1n << 64n) - 1n;
let worker, ready = false, busy = false, revision = 0, running = null, pending = false;
let timer, deadline, latest = null, ledgerLimit = 250;
let currentBatch = null, selectedIndex = 0;
const PROFILES = { balanced: "Balanced", close: "Light touch", recast: "Restructured" };
const wordCount = (text) => (text.match(/\S+/g) || []).length;
const escapeHtml = (text) => text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
function exportsEnabled(enabled) { for (const id of ["#copy", "#download", "#export-changes", "#export-variants"]) $(id).disabled = !enabled; }
function invalidate() {
  revision++;
  latest = null; currentBatch = null; selectedIndex = 0;
  $("#selected-label").textContent = "Selected rewrite";
  $("#variants").replaceChildren(); $("#variant-notice").textContent = "";
  exportsEnabled(false);
  output.replaceChildren();
  changes.replaceChildren();
  $("#more-changes").hidden = true;
  $("#output-count").textContent = "";
  $("#source-count").textContent = `${wordCount(source.value).toLocaleString()} words / ${source.value.length.toLocaleString()} characters`;
}
function clearError() { banner.hidden = true; banner.textContent = ""; }
function fail(message) {
  latest = null; currentBatch = null; selectedIndex = 0;
  $("#selected-label").textContent = "Selected rewrite";
  $("#variants").replaceChildren(); $("#variant-notice").textContent = "";
  exportsEnabled(false);
  output.replaceChildren();
  changes.replaceChildren();
  $("#output-count").textContent = "";
  $("#more-changes").hidden = true;
  banner.textContent = message;
  banner.hidden = false;
  status.textContent = "No current rewrite. Correct the input or retry.";
  output.setAttribute("aria-busy", "false");
}
function optionsFromForm() {
  const value = seed.value.trim();
  if (!/^[0-9]+$/.test(value) || value.length > 20 || BigInt(value) > MAX_SEED) throw new Error("Seed must be an unsigned 64-bit integer: 0 to 18446744073709551615.");
  return { seed: value, intensity: Number(intensity.value), synonyms: $("#synonyms").checked,
    arrange: $("#arrange").checked, protectQuotes: $("#quotes").checked,
    protectedTerms: $("#protected").value.split(/\r?\n/).map((term) => term.trim()).filter(Boolean) };
}
function renderLedger() {
  changes.replaceChildren();
  const list = latest?.result.changes || [];
  if (!list.length) {
    const item = document.createElement("li"); item.className = "empty";
    item.textContent = "No suitable change on this pass. Leaving text unchanged is intentional when a rule does not fit.";
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
}
function renderParts(parts, preview = false) {
  let remaining = preview ? 5000 : Infinity;
  const html = [];
  for (const part of parts) {
    if (remaining <= 0) break;
    const text = part.text.slice(0, remaining); remaining -= text.length;
    html.push(part.changed ? `<mark>${escapeHtml(text)}</mark>` : escapeHtml(text));
  }
  return html.join("");
}
function stats(result) {
  const n = (kind) => result.changes.filter((c) => c.kind === kind).length;
  return `${n("synonym")} synonyms / ${n("arrangement")} moves / ${n("phrase")} phrases`;
}
function selectVariant(index, focus = false) {
  if (!currentBatch || busy || !currentBatch.batch.variants[index]) return;
  const { batch, request } = currentBatch;
  const variant = batch.variants[index], result = variant.result;
  selectedIndex = index;
  latest = { result, options: { ...request.options, seed: variant.seed, style: variant.style }, index };
  output.innerHTML = renderParts(result.parts);
  output.setAttribute("aria-busy", "false");
  ledgerLimit = 250; renderLedger();
  $("#selected-label").textContent = `Selected: option ${index+1} / ${PROFILES[variant.style]}`;
  $("#output-count").textContent = `${wordCount(result.text).toLocaleString()} words`;
  for (const button of document.querySelectorAll(".choose-variant")) {
    const chosen = Number(button.dataset.index) === index;
    button.setAttribute("aria-pressed", String(chosen));
    button.textContent = chosen ? "Selected" : "Choose this version";
    button.closest(".variant-card").classList.toggle("selected", chosen);
  }
  status.textContent = `${batch.variants.length} option${batch.variants.length===1 ? "" : "s"} / ${stats(result)} / seed ${variant.seed} / ${PROFILES[variant.style]}${request.options.intensity === 2 ? " / Broader mode: review carefully." : ""}`;
  exportsEnabled(result.text.length > 0);
  if (focus) output.focus({ preventScroll: true });
}
function render(batch, request) {
  currentBatch = { batch, request }; selectedIndex = 0;
  clearError();
  const cards = $("#variants"); cards.replaceChildren();
  const unchanged = batch.variants.length === 1 && batch.variants[0].result.text === request.text.replace(/\r\n?/g, "\n");
  $("#variant-notice").textContent = !request.text.trim() ? "Enter text to compare up to three variations." : unchanged ?
    "No suitable change found. Your text is kept unchanged; protection settings have not been relaxed." : batch.variants.length < batch.requested ?
    `Found ${batch.variants.length} distinct rewrite${batch.variants.length===1 ? "" : "s"} in this bounded search. Duplicate versions are omitted; no extra changes are forced.` :
    "Three distinct versions of your original. Compare the wording, choose a version, then copy or download it. These are approaches, not quality rankings.";
  if (request.text) for (const [index, variant] of batch.variants.entries()) {
    const card = document.createElement("article"); card.className = "variant-card";
    const title = document.createElement("h3"); title.textContent = `Option ${index+1} / ${PROFILES[variant.style]}`;
    const note = document.createElement("p"); note.className = "variant-profile";
    note.textContent = { balanced: "Standard word choices and guarded sentence moves.", close: "Selective word substitutions; sentence order retained.", recast: "Also explores eligible phrases and extra sentence moves." }[variant.style];
    const meta = document.createElement("p"); meta.className = "variant-meta";
    meta.textContent = `${wordCount(variant.result.text).toLocaleString()} words / ${stats(variant.result)} / seed ${variant.seed}`;
    const preview = document.createElement("div"); preview.className = "variant-text"; preview.tabIndex = 0;
    preview.setAttribute("aria-label", `Option ${index+1} text`);
    preview.innerHTML = renderParts(variant.result.parts, true);
    const button = document.createElement("button"); button.type = "button"; button.className = "choose-variant";
    button.dataset.index = String(index); button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `Choose option ${index+1}: ${PROFILES[variant.style]}`);
    button.addEventListener("click", () => selectVariant(index));
    card.append(title, note, meta, preview);
    if (variant.result.text.length > 5000) {
      const truncated = document.createElement("p"); truncated.className = "hint";
      truncated.textContent = "Preview: first 5,000 characters. Choose this option to read or export the complete version.";
      card.append(truncated);
    }
    card.append(button); cards.append(card);
  }
  selectVariant(0);
}

function setBusy(value) { busy = value; $("#cancel").hidden = !value; output.setAttribute("aria-busy", String(value)); }
function startWorker() {
  worker?.terminate(); ready = false; setBusy(false); running = null;
  window.clearTimeout(deadline);
  try {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    const activeWorker = worker;
    worker.onmessage = ({ data }) => {
      if (worker !== activeWorker) return;
      if (data.type === "ready") { ready = true; $("#retry").hidden = true; if (pending) runRewrite(); return; }
      window.clearTimeout(deadline);
      const request = running;
      running = null; setBusy(false);
      if (data.type === "error" && data.id === undefined) { ready = false; pending = false; $("#retry").hidden = false; fail(data.message); return; }
      if (data.id === revision) {
        if (data.type === "result" && request) render(data.result, request);
        else fail(data.message);
      }
      if (pending) runRewrite();
    };
    worker.onerror = (event) => {
      if (worker !== activeWorker) return;
      event.preventDefault(); window.clearTimeout(deadline);
      ready = false; pending = false; setBusy(false); $("#retry").hidden = false;
      fail("The background rewriter could not start. Reload or retry in a browser supporting module workers.");
    };
  } catch { $("#retry").hidden = false; fail("This browser could not start the rewriter."); }
}
function runRewrite() {
  window.clearTimeout(timer);
  try {
    if (source.value.length > MAX) throw new Error("Use at most 200,000 characters in the browser. For longer files, use the C++ command-line tool.");
    const options = optionsFromForm();
    if (options.protectedTerms.length > 200 || options.protectedTerms.some((term) => term.length > 200)) throw new Error("Use at most 200 protected terms, each up to 200 characters.");
    if (busy && running?.id !== revision) { pending = true; startWorker(); return; }
    if (!ready || busy) { pending = true; return; }
    pending = false; clearError(); exportsEnabled(false);
    running = { id: revision, text: source.value, options };
    setBusy(true); status.textContent = "Comparing up to three rewrites locally in your browser...";
    worker.postMessage(running);
    deadline = window.setTimeout(() => {
      pending = false; invalidate(); startWorker();
      fail("The rewrite took too long. Try a shorter passage or fewer protected terms.");
    }, 30000);
  } catch (error) { pending = false; fail(error.message); }
}
function schedule() {
  invalidate(); clearError(); status.textContent = "Text changed; preparing a new rewrite...";
  window.clearTimeout(timer); timer = window.setTimeout(runRewrite, 180);
}
source.value = SAMPLE;
source.addEventListener("input", schedule);
for (const control of [seed, intensity, $("#synonyms"), $("#arrange"), $("#quotes"), $("#protected")]) control.addEventListener("input", schedule);
$("#tools").addEventListener("submit", (event) => { event.preventDefault(); invalidate(); runRewrite(); });
$("#variant").addEventListener("click", () => {
  try { seed.value = String((BigInt(optionsFromForm().seed) + 1n) & MAX_SEED); invalidate(); runRewrite(); }
  catch (error) { invalidate(); fail(error.message); }
});
$("#reset").addEventListener("click", () => {
  source.value = SAMPLE; seed.value = "1"; intensity.value = "1";
  $("#synonyms").checked = $("#arrange").checked = $("#quotes").checked = true;
  $("#protected").value = ""; invalidate(); runRewrite();
});
$("#clear").addEventListener("click", () => { source.value = ""; invalidate(); runRewrite(); source.focus(); });
$("#cancel").addEventListener("click", () => {
  window.clearTimeout(timer); pending = false; invalidate(); startWorker(); status.textContent = "Rewrite cancelled. Your original text is unchanged.";
});
$("#retry").addEventListener("click", () => { invalidate(); clearError(); pending = true; startWorker(); });
$("#copy").addEventListener("click", async () => {
  if (!latest || busy) return;
  try { await navigator.clipboard.writeText(latest.result.text); status.textContent = "Copied the rewrite."; }
  catch { banner.hidden = false; banner.textContent = "Clipboard access was refused. Select the rewrite and copy it, or download the text."; }
});
function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#download").addEventListener("click", () => { if (latest && !busy) download(latest.result.text, "synomizer-rewrite.txt", "text/plain;charset=utf-8"); });
$("#export-changes").addEventListener("click", () => {
  if (latest && !busy) download(JSON.stringify({ version: "1.2.0", options: latest.options, text: latest.result.text, changes: latest.result.changes }, null, 2) + "\n", "synomizer-changes.json", "application/json");
});
$("#export-variants").addEventListener("click", () => {
  if (!currentBatch || !latest || busy) return;
  const { batch, request } = currentBatch;
  const data = { version: "1.2.0", original: request.text, options: request.options,
    requested: batch.requested, attempts: batch.attempts, selected: selectedIndex+1,
    variants: batch.variants.map((v, index) => ({ option: index+1, style: v.style, seed: v.seed, text: v.result.text, changes: v.result.changes })) };
  download(JSON.stringify(data, null, 2) + "\n", "synomizer-variations.json", "application/json");
});
$("#import").addEventListener("click", () => $("#file").click());
$("#file").addEventListener("change", async () => {
  const file = $("#file").files[0]; if (!file) return;
  const requestRevision = revision;
  try {
    if (file.size > MAX * 4) throw new Error("The selected file is too large. Use the C++ tool for longer files.");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    if (text.length > MAX) throw new Error("Use at most 200,000 characters in the browser.");
    if (revision !== requestRevision) return; // Never overwrite newer user edits.
    source.value = text; invalidate(); runRewrite();
  } catch (error) { banner.hidden = false; banner.textContent = `Could not import file: ${error.message}`; }
  finally { $("#file").value = ""; }
});
$("#more-changes").addEventListener("click", () => { ledgerLimit += 250; renderLedger(); });
source.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); invalidate(); runRewrite(); } });
invalidate(); pending = true; startWorker();
