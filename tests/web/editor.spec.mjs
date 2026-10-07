// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function loaded(page) {
  await page.goto("./");
  await expect(page.locator("#status")).toContainText("seed 1");
  await expect(page.locator("#copy")).toBeEnabled();
}
async function input(page, text) {
  await page.locator("#source").fill(text);
  await page.locator("#rewrite").click();
  await expect(page.locator("#output")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#status")).toContainText("seed");
}
async function download(page, id) {
  const wait = page.waitForEvent("download");
  await page.locator(id).click();
  const item = await wait;
  return { name: item.suggestedFilename(), text: await readFile(await item.path(), "utf8") };
}
test("sample rewrites locally without page errors or external requests", async ({ page }, info) => {
  const errors = [], external = [], failures = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (req) => failures.push(req.url()));
  const origin = new URL(info.project.use.baseURL || "http://127.0.0.1:4178/").origin;
  page.on("request", (req) => { if (!req.url().startsWith(origin) && !req.url().startsWith("data:")) external.push(req.url()); });
  await loaded(page);
  const original = await page.locator("#source").inputValue();
  const output = await page.locator("#output").textContent();
  expect(output).not.toBe(original);
  await expect(page.locator("#output mark").first()).toBeVisible();
  await expect(page.locator("#changes li").first()).toBeVisible();
  expect(errors).toEqual([]); expect(external).toEqual([]); expect(failures).toEqual([]);
  await page.screenshot({ path: info.outputPath("editor.png"), fullPage: true });
});
test("another variation uses original text and seed remains deterministic", async ({ page }) => {
  await loaded(page);
  const original = await page.locator("#source").inputValue();
  const first = await page.locator("#output").textContent();
  await page.locator("#variant").click();
  await expect(page.locator("#status")).toContainText("seed 2");
  expect(await page.locator("#output").textContent()).not.toBe(first);
  await expect(page.locator("#source")).toHaveValue(original);
  await page.locator("#seed").fill("1");
  await page.locator("#rewrite").click();
  await expect(page.locator("#output")).toHaveText(first);
});
test("invalid seeds cannot export stale text and recover cleanly", async ({ page }) => {
  await loaded(page);
  for (const seed of ["-1", "1junk", "18446744073709551616", ""]) {
    await page.locator("#seed").fill(seed);
    await page.locator("#rewrite").click();
    await expect(page.locator("#banner")).toContainText("64-bit");
    await expect(page.locator("#copy")).toBeDisabled();
    await expect(page.locator("#download")).toBeDisabled();
    await expect(page.locator("#export-changes")).toBeDisabled();
    await expect(page.locator("#output")).toBeEmpty();
  }
  await page.locator("#seed").fill("18446744073709551615");
  await page.locator("#rewrite").click();
  await expect(page.locator("#status")).toContainText("seed 18446744073709551615");
  await expect(page.locator("#copy")).toBeEnabled();
  await page.locator("#variant").click();
  await expect(page.locator("#status")).toContainText("seed 0");
});
test("disabled operations preserve text and paragraph layout", async ({ page }) => {
  await loaded(page);
  await page.locator("#synonyms").uncheck(); await page.locator("#arrange").uncheck();
  const text = '  The happy child.\n\n"A small car."\n';
  await input(page, text);
  await expect(page.locator("#output")).toHaveText(text, { useInnerText: false });
  expect(await page.locator("#output").textContent()).toBe(text);
  await expect(page.locator("#status")).toContainText("0 synonyms / 0 moves");
});
test("quotes, URLs and code survive while surrounding prose changes", async ({ page }) => {
  await loaded(page);
  const quoted = "“The happy child was ready. The car was small.”";
  const url = "https://happy.com/car";
  await input(page, `She said ${quoted} Read ${url} and \`happy_child\`. The happy child bought a car.`);
  const text = await page.locator("#output").textContent();
  expect(text).toContain(quoted); expect(text).toContain(url); expect(text).toContain("`happy_child`");
  expect(text).toContain("youngster");
});
test("protected terms and empty input", async ({ page }) => {
  await loaded(page);
  await page.locator("summary").click();
  await page.locator("#protected").fill("happy\nchild\nbought\ncar");
  await input(page, "The happy child bought a car.");
  await expect(page.locator("#output")).toHaveText("The happy child bought a car.");
  await page.locator("#clear").click();
  await expect(page.locator("#source")).toHaveValue("");
  await expect(page.locator("#output")).toBeEmpty();
  await expect(page.locator("#copy")).toBeDisabled();
});
test("import UTF-8 and download text plus structured change log", async ({ page }) => {
  await loaded(page);
  const text = "The happy child bought a car.\n\n中文 café🙂";
  await page.locator("#file").setInputFiles({ name: "sample.txt", mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(page.locator("#source")).toHaveValue(text);
  await expect(page.locator("#output")).toContainText("中文 café🙂");
  await expect(page.locator("#copy")).toBeEnabled();
  const current = await page.locator("#output").textContent();
  const txt = await download(page, "#download");
  expect(txt.name).toBe("synomizer-rewrite.txt"); expect(txt.text).toBe(current);
  const json = await download(page, "#export-changes");
  const result = JSON.parse(json.text);
  expect(result.text).toBe(current); expect(result.options.seed).toBe("1"); expect(result.changes.length).toBeGreaterThan(0);
});
test("HTML input is displayed as text, never executed", async ({ page }) => {
  await loaded(page);
  await input(page, '<img src=x onerror="window.__injected=1"> The happy child. <script>window.__injected=2</script>');
  await expect(page.locator("#output img, #output script")).toHaveCount(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  expect(await page.locator("#output").textContent()).toContain('<img src=x onerror="window.__injected=1">');
});
test("oversize input is refused without a stale result", async ({ page }) => {
  await loaded(page);
  await page.locator("#source").fill("x".repeat(200001));
  await page.locator("#rewrite").click();
  await expect(page.locator("#banner")).toContainText("200,000");
  await expect(page.locator("#copy")).toBeDisabled();
  await expect(page.locator("#output")).toBeEmpty();
  await input(page, "The happy child.");
  await expect(page.locator("#copy")).toBeEnabled();
});
test("rapid edits do not publish an older rewrite", async ({ page }) => {
  await loaded(page);
  await page.locator("#source").fill("The happy child. ".repeat(5000));
  await page.locator("#rewrite").click();
  await page.locator("#source").fill("A uniquely xyzzy sentence.");
  await page.locator("#rewrite").click();
  await expect(page.locator("#status")).toContainText("seed");
  await expect(page.locator("#output")).toHaveText("A uniquely xyzzy sentence.");
  const result = await download(page, "#download");
  expect(result.text).toBe("A uniquely xyzzy sentence.");
});
test("small-screen layout has no horizontal overflow", async ({ page }, info) => {
  await loaded(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator("summary").click();
  await page.locator("#protected").fill("a".repeat(200));
  await expect(page.locator("#status")).toContainText("seed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("mobile.png"), fullPage: true });
});
test("word-list failure is actionable and retry recovers", async ({ page }) => {
  let fail = true;
  await page.route("**/data/lexicon.tsv", (route) => fail ? route.fulfill({ status: 503, body: "temporarily unavailable" }) : route.continue());
  await page.goto("./");
  await expect(page.locator("#banner")).toContainText("word lists");
  await expect(page.locator("#copy")).toBeDisabled();
  await expect(page.locator("#retry")).toBeVisible();
  fail = false;
  await page.locator("#retry").click();
  await expect(page.locator("#status")).toContainText("seed 1");
  await expect(page.locator("#copy")).toBeEnabled();
});
test("clipboard refusal leaves a usable download", async ({ page }) => {
  await loaded(page);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } }));
  await page.locator("#copy").click();
  await expect(page.locator("#banner")).toContainText("Clipboard access was refused");
  await expect(page.locator("#download")).toBeEnabled();
});

test("cancel stops the worker without changing the original, then rewrite still works", async ({ page }) => {
  await loaded(page);
  const text = "The happy child bought a car. ".repeat(4000);
  await page.evaluate((value) => {
    const source = document.querySelector("#source");
    source.value = value;
    source.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#rewrite").click();
    document.querySelector("#cancel").click();
  }, text);
  await expect(page.locator("#status")).toContainText("cancelled");
  await expect(page.locator("#source")).toHaveValue(text);
  await expect(page.locator("#copy")).toBeDisabled();
  await expect(page.locator("#output")).toBeEmpty();
  await input(page, "The happy child bought a car.");
  await expect(page.locator("#output")).toContainText("youngster");
  await expect(page.locator("#download")).toBeEnabled();
});
