// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { run, resources, root } from "./hardening-support.mjs";
import { rewrite, rewriteVariants } from "../docs/engine.js";
const sample = readFileSync(`${root}/examples/sample.txt`, "utf8");
const normalize = (batch) => ({ requested: batch.requested, attempts: batch.attempts,
  variants: batch.variants.map((v) => ({ seed: v.seed, style: v.style, text: v.result.text, changes: v.result.changes })) });
function argsFor(options = {}) {
  const args = ["--json", "--seed", String(options.seed ?? 1), "--intensity", String(options.intensity ?? 1)];
  if (options.style) args.push("--style", options.style);
  if (options.synonyms === false && options.arrange === false) args.push("--no-rewrite");
  else if (options.synonyms === false) args.push("--arrange-only");
  else if (options.arrange === false) args.push("--synonyms-only");
  if (options.protectQuotes === false) args.push("--vary-quotes");
  for (const term of options.protectedTerms || []) args.push("--protect", term);
  return args;
}
function single(text, options = {}) {
  const native = run(argsFor(options), text);
  assert.equal(native.status, 0, native.stderr);
  const expected = JSON.parse(native.stdout), actual = rewrite(text, options, resources);
  assert.deepEqual({ text: actual.text, changes: actual.changes }, { text: expected.text, changes: expected.changes });
  assert.equal(actual.parts.map((part) => part.text).join(""), actual.text);
  return actual;
}
function batch(text, options = {}, count = 3) {
  const native = run([...argsFor(options), "--variants", String(count)], text);
  assert.equal(native.status, 0, native.stderr || native.error?.message);
  const expected = JSON.parse(native.stdout), actual = rewriteVariants(text, options, resources, count);
  const clean = normalize(actual);
  if (count > 1) {
    const { requested, attempts, variants } = expected;
    assert.deepEqual(clean, { requested, attempts, variants: variants.map(({version, ...v}) => v) });
  } else assert.deepEqual(clean.variants[0], (({version,...v})=>v)(expected));
  assert.equal(new Set(actual.variants.map((v)=>v.result.text)).size, actual.variants.length);
  assert.ok(actual.attempts <= 12 && actual.variants.length <= count);
  for (const v of actual.variants) {
    assert.equal(v.result.parts.map((part)=>part.text).join(""), v.result.text);
    assert.deepEqual(rewrite(text, {...options, style:v.style,seed:v.seed},resources),v.result);
  }
  return actual;
}
const inputs = [sample, "", "The car.", "xyzzy.", "A happy child.",
  "In addition, the teacher gave a clear explanation. She carefully examined the report.",
  "They retained the documents in order to verify the details.",
  'In spite of the rain, the bus arrived. "In addition, a happy child."',
  "She is happier today. The airplanes arrived.",
  "The teacher gave a thorough assessment and a concise report.",
  "She has recently shown the technique. They kept the receipts.",
  "  Because the road was icy, the bus arrived late.\r\n\r\nNASA\n",
  'Read https://happy.example/car and `the happy child`. 中文 café 🌍.',
  "She was not happy because the car was small.",
];
for (const [index, text] of inputs.entries()) for (const seed of ["0", "1", "9007199254740993", "18446744073709551615"])
  for (const options of [{}, {intensity:0}, {intensity:2}, {synonyms:false}, {arrange:false}, {synonyms:false,arrange:false}])
    test(`variant parity ${index} / ${seed} / ${JSON.stringify(options)}`,()=>batch(text,{...options,seed}));
test("three actual choices; every seed/profile reproduces from the original",()=>{
  const result=batch(sample); assert.equal(result.variants.length,3);
  assert.deepEqual(result.variants.map(v=>v.style),["balanced","close","recast"]);
  assert.equal(result.variants[0].result.text,single(sample).text);
  assert.deepEqual(result,batch(sample));
});
test("no forced differences for an unrewritable or completely protected input",()=>{
  for(const text of ["xyzzy", "", "A happy child."]) {
    const result=batch(text,{protectedTerms:[text || "xyzzy"]});
    assert.equal(result.variants.length,1);assert.equal(result.variants[0].result.text,text);
  }
  assert.equal(batch("The car.").variants.length,1);
});
test("one- and two-result batch limits plus full uint64 seed wrapping",()=>{
  batch(sample,{seed:"18446744073709551615"},2);
  batch(sample,{seed:"18446744073709551615",style:"close"},1);
  const v=batch(sample,{seed:"18446744073709551615"});
  assert.ok(v.variants.every(x=>BigInt(x.seed)<=18446744073709551615n));
});
const grammar = [
 ["The teacher gave a clear explanation.","lucid explanation",null],
 ["The sky was clear.","clear", "lucid"],
 ["Please complete the task.","complete", "entire"],
 ["She consumed electricity.","consumed", "ate"],
 ["She consumed the meal.","ate the meal", null],
 ["The prices declined rapidly.","declined", "refused"],
 ["I helped to build the house.","helped to", "assisted to"],
 ["The pupils in her eyes were dilated.","pupils", "learners"],
 ["She is a doctor of history.","doctor of", "physician of"],
 ["She has recently shown the technique.","has recently demonstrated", "showed"],
 ["She was recently shown the technique.","was recently shown", "was recently demonstrated"],
 ["They kept the records.","retained the records", null],
 ["They evaluated the proposal.","assessed the proposal", null],
 ["The airplanes arrived.","aircraft", "aircrafts"],
 ["She is happier today.","more ", "cheerfuler"],
 ["She is happiest today.","most ", "cheerfulest"],
 ["She carefully examined the report.","report cautiously.",null],
];
for (const [text,kept,absent] of grammar) test(`context and morphology: ${text}`,()=>{
  const result=single(text,{style:text.startsWith("She carefully")?"recast":"balanced"});
  if(kept)assert.ok(result.text.includes(kept),result.text);
  if(absent)assert.ok(!result.text.includes(absent),result.text);
});
test("phrase variation is guarded by mode, quotations, term locks and negation",()=>{
  const text="In addition, the bus arrived.";
  assert.ok(single(text,{style:"recast"}).changes.some(c=>c.kind==="phrase"));
  for(const options of [{style:"balanced"},{style:"close"},{style:"recast",synonyms:false},{style:"recast",intensity:0},{style:"recast",protectedTerms:["in addition"]}])
    assert.ok(!single(text,options).changes.some(c=>c.kind==="phrase"));
  for(const text of ['"In addition, the bus arrived."',"In addition, the bus did not arrive.","She put the books in order to read them.","She wanted to leave."])
    assert.ok(!single(text,{style:"recast"}).changes.some(c=>c.kind==="phrase"),text);
});
test("all variants preserve named terms, numerical values, URLs and quotation content",()=>{
  const text='Alice purchased 12 cars for NASA. She said "In addition, the happy child." Visit https://happy.example/car. statistical significance matters.';
  for(const variant of batch(text,{protectedTerms:["statistical significance"]}).variants)
    for(const fragment of ['Alice','12','NASA','"In addition, the happy child."','https://happy.example/car','statistical significance'])
      assert.ok(variant.result.text.includes(fragment),variant.result.text);
});
test("Close never rearranges; operations remain off in every profile",()=>{
  for(const v of batch(sample).variants)if(v.style==="close")assert.ok(!v.result.changes.some(c=>c.kind==="arrangement"||c.kind==="phrase"));
  for(const v of batch(sample,{synonyms:false}).variants)assert.ok(v.result.changes.every(c=>c.kind==="arrangement"||c.kind==="article"));
  for(const v of batch(sample,{arrange:false}).variants)assert.ok(!v.result.changes.some(c=>c.kind==="arrangement"));
});
test("large batch remains complete with paragraphs intact",()=>{
  const text="The happy child purchased a car.\n\n".repeat(1200);
  const result=batch(text);assert.equal(result.variants.length,3);
  for(const v of result.variants)assert.equal(v.result.text.split("\n\n").length,1201);
});
for(const count of [0,4,-1,1.5,"3",NaN])test(`invalid batch count ${count}`,()=>assert.throws(()=>rewriteVariants("x",{},resources,count)));
for(const args of [["--variants","0"],["--variants","4"],["--variants","1x"],["--variants"],["--style","bogus"],["--style"]])
  test(`invalid CLI batch/profile ${JSON.stringify(args)}`,()=>assert.notEqual(run(args,"x").status,0));
test("plain-text batch has labelled, separate outputs",()=>{
  const native=run(["--variants","3"],sample);assert.equal(native.status,0,native.stderr);
  for(const n of [1,2,3])assert.ok(native.stdout.includes(`=== Variation ${n} /`));
});

test("a skipped phrase rule restores fixed-expression protection",()=>{
  for(const text of ["As a result, the bus did not leave.","They left as a result of the rain.","For this reason, the bus did not leave.","She put the books in order to read them."]){
    const result=single(text,{style:"recast"});
    for(const phrase of ["as a result","for this reason","in order to"])
      if(text.toLowerCase().includes(phrase))assert.ok(result.text.toLowerCase().includes(phrase),result.text);
  }
  const text="As a result, the bus arrived.";
  for(const style of ["balanced","close","recast"])
    assert.ok(single(text,{style,protectedTerms:["bus"]}).text.startsWith("As a result,"));
});
test("new medial adverb moves do not cross embedded verbs",()=>{
  const text="She carefully examined the report published in May.";
  const result=single(text,{style:"recast",synonyms:false});
  assert.equal(result.text,text);
});
