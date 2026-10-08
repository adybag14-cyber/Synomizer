// SPDX-License-Identifier: Apache-2.0
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const site = new URL("site/", root);
await rm(site, { recursive: true, force: true });
await mkdir(new URL("data/", site), { recursive: true });
for (const name of ["index.html", "styles.css", "app.js", "engine.js", "worker.js", "standards.js", "standards.html", "favicon.svg"])
  await cp(new URL(`docs/${name}`, root), new URL(name, site));
for (const name of ["lexicon.tsv", "phrases.txt", "rephrases.tsv"])
  await cp(new URL(`data/${name}`, root), new URL(`data/${name}`, site));
await cp(new URL("LICENSE", root), new URL("LICENSE", site));
await writeFile(new URL(".nojekyll", site), "");
const { version } = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
let commit = "local";
try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: fileURLToPath(root), encoding: "utf8" }).trim(); } catch { /* Source archives need not contain .git. */ }
const sha256 = {};
for (const name of ["index.html", "styles.css", "app.js", "engine.js", "worker.js", "standards.js", "standards.html", "favicon.svg", "data/lexicon.tsv", "data/phrases.txt", "data/rephrases.tsv", "LICENSE"])
  sha256[name] = createHash("sha256").update(await readFile(new URL(name, site))).digest("hex");
const manifest = JSON.stringify({ version, commit, sha256 }, null, 2) + "\n";
await writeFile(new URL("version.json", site), manifest);
await writeFile(new URL("build.json", site), manifest);
console.log(`Built Synomizer ${version} at ${fileURLToPath(site)}`);
