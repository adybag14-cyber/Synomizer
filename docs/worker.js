// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import { loadResources, rewriteVariations } from "./engine.js";
const resources = Promise.all(["data/lexicon.tsv", "data/phrases.txt", "data/rephrases.tsv"].map(async (path) => {
  const response = await fetch(new URL(path, import.meta.url), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("The word lists could not be loaded. Check your connection and retry.");
  return response.text();
})).then(([lexicon, phrases, rephrases]) => loadResources(lexicon, phrases, rephrases));
resources.then(() => postMessage({ type: "ready" })).catch((error) => postMessage({ type: "error", message: error.message }));
self.onmessage = async ({ data }) => {
  try {
    if (typeof data.text !== "string" || data.text.length > 200_000) throw new Error("Use at most 200,000 characters in the browser. The C++ tool supports longer files.");
    const batch = rewriteVariations(data.text, data.options, await resources, 3);
    postMessage({ type: "result", id: data.id, batch });
  } catch (error) { postMessage({ type: "error", id: data.id, message: error.message || "Could not rewrite that text." }); }
};
