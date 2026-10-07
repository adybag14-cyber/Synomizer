// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile as readAsync } from "node:fs/promises";
import { loadResources, rewrite, rewriteVariants } from "../../docs/engine.js";
const resources = loadResources(...["lexicon.tsv", "phrases.txt", "rephrases.tsv"].map((name) =>
  readFileSync(new URL(`../../data/${name}`, import.meta.url), "utf8")));
const card = (page, index) => page.locator(`.variant-card[data-index="${index}"]`);
async function loaded(page) {
  await page.goto("./");
  await expect(page.locator("#status")).toContainText("seed 1");
  await expect(page.locator("#export-all")).toBeEnabled();
}
async function input(page, text) {
  await page.locator("#source").fill(text);
  await page.locator("#rewrite").click();
  await expect(page.locator("#status")).toContainText("seed");
  await expect(page.locator("#output")).toHaveAttribute("aria-busy", "false");
}
async function download(page, button) {
  const waiting = page.waitForEvent("download");
  await button.click();
  const file = await waiting;
  return { name: file.suggestedFilename(), text: await readAsync(await file.path(), "utf8") };
}
async function exportBatch(page) {
  return JSON.parse((await download(page, page.locator("#export-all"))).text);
}
async function fakeClipboard(page) {
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true,
    value: { writeText: async (text) => { window.__copied = text; } } }));
}

test("three complete cards are simultaneous, distinct and derived from the unchanged original", async ({ page }, info) => {
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await loaded(page);
  await expect(page.locator(".variant-card:visible")).toHaveCount(3);
  await expect(page.locator("#variation-summary")).toContainText("Three different rewrites");
  const original = await page.locator("#source").inputValue();
  const texts = await page.locator(".variant-output").allTextContents();
  expect(new Set(texts).size).toBe(3);
  const expected = rewriteVariants(original, {}, resources);
  expect(texts).toEqual(expected.variants.map((v) => v.result.text));
  const report = await exportBatch(page);
  expect(report.original).toBe(original); expect(report.variants).toHaveLength(3);
  expect(report.attempts).toBeLessThanOrEqual(12);
  for (let i = 0; i < 3; i++) {
    const variant = report.variants[i];
    expect(variant.text).toBe(texts[i]);
    const replay = rewrite(original, variant.options, resources);
    expect(replay.text).toBe(variant.text); expect(replay.changes).toEqual(variant.changes);
    await expect(card(page, i).locator(".variant-options")).toContainText(`seed ${variant.options.seed}`);
  }
  await expect(page.locator("#source")).toHaveValue(original);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("three-variations.png"), fullPage: true });
});

test("each card has correct independent copy, text download and structured change log", async ({ page }) => {
  await loaded(page); await fakeClipboard(page);
  const original = await page.locator("#source").inputValue();
  for (let i = 0; i < 3; i++) {
    const panel = card(page, i), text = await panel.locator(".variant-output").textContent();
    await panel.locator('[data-action="copy"]').click();
    expect(await page.evaluate(() => window.__copied)).toBe(text);
    const txt = await download(page, panel.locator('[data-action="download"]'));
    expect(txt.name).toBe(`synomizer-variation-${i+1}.txt`); expect(txt.text).toBe(text);
    const json = await download(page, panel.locator('[data-action="json"]'));
    expect(json.name).toBe(`synomizer-variation-${i+1}.json`);
    const report = JSON.parse(json.text);
    expect(report.text).toBe(text); expect(rewrite(original, report.options, resources).changes).toEqual(report.changes);
  }
});

test("choosing a card switches the shared ledger and selected exports but never overwrites the original", async ({ page }) => {
  await loaded(page); await fakeClipboard(page);
  const original = await page.locator("#source").inputValue(), batch = await exportBatch(page);
  for (const i of [2, 1, 0]) {
    await page.getByRole("radio", { name: `Select variation ${i+1}`, exact: true }).check();
    await expect(card(page, i)).toHaveClass(/is-selected/);
    await expect(page.locator("#ledger-choice")).toContainText(`variation ${i+1}`);
    const itemCount = batch.variants[i].changes.length;
    await expect(page.locator("#changes li")).toHaveCount(Math.min(itemCount, 250));
    await page.locator("#copy").click();
    expect(await page.evaluate(() => window.__copied)).toBe(batch.variants[i].text);
    const selected = JSON.parse((await download(page, page.locator("#export-changes"))).text);
    expect(selected).toEqual(batch.variants[i]);
    const text = await download(page, page.locator("#download")); expect(text.text).toBe(batch.variants[i].text);
    await expect(page.locator("#source")).toHaveValue(original);
  }
  await card(page, 2).locator('[data-action="review"]').click();
  await expect(page.locator("#ledger-heading")).toBeFocused();
  await expect(page.getByRole("radio", { name: "Select variation 3", exact: true })).toBeChecked();
});

test("unknown, one-choice and fully protected passages do not pretend to have three rewrites", async ({ page }) => {
  await loaded(page);
  for (const text of ["xyzzy", "car", '"The happy child bought a car."']) {
    await input(page, text);
    await expect(page.locator(".variant-card:visible")).toHaveCount(1);
    const batch = await exportBatch(page); expect(batch.variants).toHaveLength(1);
    expect(batch.variants[0].text).toBe(text === "car" ? "automobile" : text);
    await expect(page.locator("#variation-summary")).toContainText(text === "car" ? "1 distinct rewrite" : "No eligible rewrite");
  }
  await page.locator("#clear").click();
  await expect(page.locator("#output")).toBeEmpty();
  await expect(page.locator("#export-all")).toBeDisabled();
  await expect(page.locator(".variant-card:visible")).toHaveCount(1);
});

test("all alternatives respect names, phrases, quotations and intensity without broader automatic escalation", async ({ page }) => {
  await loaded(page); await page.locator("summary").click();
  await page.locator("#protected").fill("in a careful manner\noriginal brand");
  await page.locator("#intensity").selectOption("0");
  const original = 'The happy teacher worked in a careful manner. The original brand was reliable. She said "The happy child." Visit https://happy.example/car. A healthy child was cheerful.';
  await input(page, original);
  const report = await exportBatch(page);
  expect(report.variants).toHaveLength(3);
  for (const v of report.variants) {
    for (const value of ["in a careful manner", "original brand", '"The happy child."', "https://happy.example/car", "healthy"]) expect(v.text).toContain(value);
    expect(v.options.intensity).toBe(0); expect(v.options.protectQuotes).toBe(true);
    expect(v.options.protectedTerms).toEqual(["in a careful manner", "original brand"]);
  }
});

test("an invalid or superseded request clears every card export, not just the selected one", async ({ page }) => {
  await loaded(page);
  await page.getByRole("radio", { name: "Select variation 3", exact: true }).check();
  await page.locator("#seed").fill("1invalid"); await page.locator("#rewrite").click();
  await expect(page.locator("#banner")).toContainText("64-bit");
  for (const id of ["#copy", "#download", "#export-changes", "#export-all"]) await expect(page.locator(id)).toBeDisabled();
  for (let i = 0; i < 3; i++) {
    await expect(card(page, i).locator(".variant-output")).toBeEmpty();
    for (const action of ["copy", "download", "json", "review"]) await expect(card(page, i).locator(`[data-action="${action}"]`)).toBeDisabled();
  }
  await page.locator("#seed").fill("1");
  await input(page, "The happy child bought a car. ".repeat(4000));
  await page.locator("#source").fill("A uniquely xyzzy sentence."); await page.locator("#rewrite").click();
  await expect(page.locator("#output")).toHaveText("A uniquely xyzzy sentence.");
  await expect(page.locator(".variant-card:visible")).toHaveCount(1);
  const batch = await exportBatch(page);
  expect(batch.original).toBe("A uniquely xyzzy sentence."); expect(batch.variants[0].text).toBe(batch.original);
});

test("overlapping new sets use the newest source and exact seed including uint64 wrap", async ({ page }) => {
  await loaded(page);
  const original = await page.locator("#source").inputValue();
  await page.locator("#seed").fill("18446744073709551615"); await page.locator("#rewrite").click();
  await expect(page.locator("#status")).toContainText("seed 18446744073709551615");
  let batch = await exportBatch(page);
  expect(batch.baseOptions.seed).toBe("18446744073709551615");
  expect(batch.variants[0].options.seed).toBe("18446744073709551615");
  await page.locator("#variant").click();
  await expect(page.locator("#status")).toContainText("seed 0");
  batch = await exportBatch(page);
  expect(batch.baseOptions.seed).toBe("0");
  for (const variant of batch.variants) expect(rewrite(original, variant.options, resources).text).toBe(variant.text);
  await expect(page.locator("#source")).toHaveValue(original);
});

test("missing phrase dictionary disables generation and Retry reloads all three resources", async ({ page }) => {
  let broken = true;
  await page.route("**/data/rephrases.tsv", (route) => broken ? route.fulfill({ status: 503, body: "offline" }) : route.continue());
  await page.goto("./");
  await expect(page.locator("#banner")).toContainText("word lists");
  await expect(page.locator("#export-all")).toBeDisabled();
  broken = false; await page.locator("#retry").click();
  await expect(page.locator(".variant-card:visible")).toHaveCount(3);
  await expect(page.locator("#export-all")).toBeEnabled();
});

test("phrase and arrangement changes survive round-trip export for each chosen result", async ({ page }) => {
  await loaded(page);
  const original = "She worked in a careful manner. On a daily basis, she studied. The teacher carefully examined the report. She is happier today.";
  await input(page, original);
  const batch = await exportBatch(page);
  expect(batch.variants).toHaveLength(3);
  expect(batch.variants[0].changes.some((c) => c.kind === "phrase")).toBe(true);
  expect(batch.variants.some((v) => v.changes.some((c) => c.kind === "arrangement"))).toBe(true);
  for (const v of batch.variants) expect(rewrite(original, v.options, resources).changes).toEqual(v.changes);
});

test("all cards safely display markup as text", async ({ page }) => {
  await loaded(page);
  await input(page, '<img src=x onerror="window.__injected=1"> The happy child bought a small car. <script>window.__injected=2</script>');
  await expect(page.locator(".variant-card:visible")).toHaveCount(3);
  await expect(page.locator(".variant-output img, .variant-output script")).toHaveCount(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  for (const text of await page.locator(".variant-output").allTextContents()) expect(text).toContain('<img src=x onerror="window.__injected=1">');
});

test("desktop comparison has three columns and 320px mobile view stacks without overflow", async ({ page }, info) => {
  await loaded(page);
  if (info.project.name !== "mobile") {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const boxes = await Promise.all([0, 1, 2].map((i) => card(page, i).boundingBox()));
    expect(Math.abs(boxes[0].y - boxes[2].y)).toBeLessThan(3);
    expect(boxes[0].x + boxes[0].width).toBeLessThan(boxes[1].x);
    expect(boxes[1].x + boxes[1].width).toBeLessThan(boxes[2].x);
  }
  await page.setViewportSize({ width: 320, height: 812 });
  const boxes = await Promise.all([0, 1, 2].map((i) => card(page, i).boundingBox()));
  expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height);
  expect(boxes[2].y).toBeGreaterThan(boxes[1].y + boxes[1].height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("radio", { name: "Select variation 3", exact: true }).check();
  await expect(page.locator("#ledger-choice")).toContainText("variation 3");
  await page.screenshot({ path: info.outputPath("three-mobile.png"), fullPage: true });
});

test("choosing and exporting each long result retains complete logs with bounded visible ledger", async ({ page }) => {
  await loaded(page);
  const original = "The happy child bought a car.\n\n".repeat(2000);
  // Use the supported file-import path for this many-paragraph ledger fixture.
  // Chromium's synthetic insertText on thousands of line breaks can dominate
  // locator.fill runtime even in an otherwise empty standalone textarea.
  await page.locator("#file").setInputFiles({ name: "long.txt", mimeType: "text/plain", buffer: Buffer.from(original) });
  await expect(page.locator("#source")).toHaveValue(original);
  await expect(page.locator("#status")).toContainText("seed 1");
  await expect(page.locator("#export-all")).toBeEnabled();
  const batch = await exportBatch(page);
  expect(batch.variants).toHaveLength(3);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("radio", { name: `Select variation ${i+1}`, exact: true }).check();
    await expect(page.locator("#changes li")).toHaveCount(250);
    await page.locator("#more-changes").click();
    await expect(page.locator("#changes li")).toHaveCount(500);
    const report = JSON.parse((await download(page, page.locator("#export-changes"))).text);
    expect(report).toEqual(batch.variants[i]);
    expect(report.text.split("\n\n")).toHaveLength(2001);
    expect(report.changes.length).toBeGreaterThan(500);
  }
});
