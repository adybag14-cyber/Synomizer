// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import { loadResources, rewriteVariants } from "./engine.js";
const resources = Promise.all(["data/lexicon.tsv", "data/phrases.txt", "data/rephrases.tsv"].map(async (path) => {
  const response = await fetch(new URL(path, import.meta.url), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("The word lists could not be loaded. Check your connection and retry.");
  return response.text();
})).then(([lexicon, phrases, rephrases]) => loadResources(lexicon, phrases, rephrases));
resources.then(() => postMessage({ type: "ready" })).catch((error) => postMessage({ type: "error", message: error.message }));
self.onmessage = async ({ data }) => {
  try {
    if (typeof data.text !== "string" || data.text.length > 200_000) throw new Error("Use at most 200,000 characters in the browser. The C++ tool supports longer files.");
    const generated = rewriteVariants(data.text, data.options, await resources, 3);
    const batch = { requested: generated.requested, candidatesConsidered: generated.attempts,
      variations: generated.variants.map((variant) => ({ result: variant.result,
        options: { seed: variant.seed, style: variant.style, intensity: data.options.intensity ?? 1,
          synonyms: data.options.synonyms !== false, arrange: data.options.arrange !== false,
          protectQuotes: data.options.protectQuotes !== false, protectedTerms: [...(data.options.protectedTerms || [])] } })) };

    postMessage({ type: "result", id: data.id, batch });
  } catch (error) { postMessage({ type: "error", id: data.id, message: error.message || "Could not rewrite that text." }); }
};
