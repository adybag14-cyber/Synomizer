// SPDX-License-Identifier: Apache-2.0
// Development/test server. Only the assembled site directory is exposed, under the Pages subpath.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, relative, extname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../site/", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".tsv": "text/tab-separated-values; charset=utf-8", ".txt": "text/plain; charset=utf-8" };
const port = Number(process.env.PORT || 4178);
const server = createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path === "/" || path === "/Synomizer") { res.writeHead(302, { Location: "/Synomizer/" }); res.end(); return; }
    if (!path.startsWith("/Synomizer/")) throw new Error("Not found");
    path = path.slice("/Synomizer/".length) || "index.html";
    const full = resolve(root, path), rel = relative(root, full);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Not found");
    const data = await readFile(full);
    res.writeHead(200, { "Content-Type": types[extname(full)] || "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch { res.writeHead(404); res.end("Not found"); }
});
server.listen(port, "127.0.0.1", () => console.log(`Synomizer: http://127.0.0.1:${port}/Synomizer/`));
