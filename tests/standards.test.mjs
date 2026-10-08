// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resources, run } from './hardening-support.mjs';
import { rewrite, rewriteVariants, parseVocabulary } from '../docs/engine.js';

function cliArgs(o) {
  const args = ['--json', '--profile', o.profile, '--text-type', o.textType ?? 'description', '--seed', String(o.seed ?? 1)];
  if (o.checkOnly) args.push('--check-only');
  if (o.audience !== undefined) args.push('--audience', o.audience);
  if (o.purpose !== undefined) args.push('--purpose', o.purpose);
  if (o.synonyms === false && o.arrange === false) args.push('--no-rewrite');
  else if (o.synonyms === false) args.push('--arrange-only');
  else if (o.arrange === false) args.push('--synonyms-only');
  if (o.protectQuotes === false) args.push('--vary-quotes');
  for (const term of o.protectedTerms || []) args.push('--protect', term);
  return args;
}
function check(text, options = {}, expected) {
  const o = { profile: 'combined', ...options };
  const native = run(cliArgs(o), text);
  assert.equal(native.status, 0, native.stderr || native.error?.message);
  const cpp = JSON.parse(native.stdout), js = rewrite(text, o, resources);
  assert.deepEqual({ text: js.text, changes: js.changes, standards: js.standards }, { text: cpp.text, changes: cpp.changes, standards: cpp.standards });
  assert.equal(js.parts.map(p => p.text).join(''), js.text);
  if (expected !== undefined) assert.equal(js.text, expected);
  assert.equal(js.standards.status, 'review-required');
  assert.equal(js.standards.semanticEquivalenceVerified, false);
  assert.equal(js.standards.estimatedCounts, true);
  return js;
}
const positives = [
  ['In order to remove the cover, utilize the lever.', 'To remove the cover, use the lever.'],
  ['The valve was opened by the technician.', 'The technician opened the valve.'],
  ['The panels were removed by a technician.', 'A technician removed the panels.'],
  ['The report was written by the engineer.', 'The engineer wrote the report.'],
  ['The valve is open, but the switch is off.', 'The valve is open. But the switch is off.'],
  ['The panel is clean; the surface is dry.', 'The panel is clean. The surface is dry.'],
  ["She can't open the door.", 'She cannot open the door.'],
  ["Don't remove the pin.", 'Do not remove the pin.'],
  ['Prior to the inspection, remove the cover.', 'Before the inspection, remove the cover.'],
  ['The display is in close proximity to the valve.', 'The display is near the valve.'],
  ['In the event that the indicator is red, do not start the motor.', 'If the indicator is red, do not start the motor.'],
  ['The delay is due to the fact that the roads are closed.', 'The delay is because the roads are closed.'],
];
for (const profile of ['ste', 'plain', 'combined']) for (const textType of ['description', 'procedure']) {
  for (const [source, expected] of positives) test(`standard edits / ${profile} / ${textType} / ${source}`, () => check(source, { profile, textType }, expected));
}
const retain = [
  'The valve was opened by the river.',
  'The cover was removed by the entrance.',
  'The operator believes the valve is open, and the light is on.',
  'The operator said the valve is open, but the switch is off.',
  'The cover was removed.',
  'The valve may be opened by the technician.',
  'The valve was not opened by the technician.',
  'The valve was opened by the time the bell rang.',
  'The report was written by the engineer who inspected the device.',
  'The device used by the operator was removed by the engineer.',
  'If the valve is open, the motor is active, and the pressure is high.',
  'The motor is not active, but the pressure is high.',
  'The road to the station; the road to the harbor.',
  'The cover was removed by her.',
  'The system may fail, but it should not stop.',
  'The technician kept the tools in order to work.',
  'The technician set the parts in order to avoid confusion.',
  'Do not open the valve or remove the cover.',
  'The operator must keep the pressure below 5 bar.',
  'The claim is not universal.',
  'No significant difference was observed.',
  'The happy child bought a car.',
  'The entire dataset was compared.',
  'Visit https://example.org/utilize and email utilize@example.org.',
  '`utilize the tool` and <span title="utilize">quoted markup</span>.',
  'The words "utilize the tool" are quoted.',
];
for (const profile of ['ste', 'plain', 'combined']) for (const source of retain)
  test(`standard preserves scope/terminology / ${profile} / ${source}`, () => check(source, { profile }, source));

test('check-only performs no edit, normalizes only line endings and keeps a full report', () => {
  const source = 'The valve was opened by the technician.\r\n\r\nUtilize the lever.\r';
  for (const profile of ['ste', 'plain', 'combined']) {
    const r = check(source, { profile, checkOnly: true }, source.replace(/\r\n?/g, '\n'));
    assert.equal(r.changes.length, 0); assert.deepEqual(r.standards.before, r.standards.after);
  }
});
test('standards batches return one deterministic result across style and seed, never padded', () => {
  const text = 'The happy technician utilized the tool. The cover was removed by the mechanic.';
  for (const profile of ['ste', 'plain', 'combined']) {
    const expected = check(text, { profile });
    for (const seed of ['0', '1', '42', '18446744073709551615']) for (const style of ['balanced', 'close', 'recast']) {
      const o = { profile, seed, style }, batch = rewriteVariants(text, o, resources, 3);
      assert.equal(batch.variants.length, 1); assert.equal(batch.attempts, 1);
      assert.deepEqual(batch.variants[0].result, expected);
      const cpp = run([...cliArgs(o), '--variants', '3', '--style', style], text);
      assert.equal(cpp.status, 0, cpp.stderr);
      const b = JSON.parse(cpp.stdout); assert.equal(b.variants.length, 1); assert.equal(b.variants[0].text, expected.text);
    }
  }
});
test('standard profiles do not weaken operation switches or protected terms', () => {
  const text = 'The valve was opened by the technician. Utilize the tool.';
  check(text, { synonyms: false }, 'The technician opened the valve. Utilize the tool.');
  check(text, { arrange: false }, 'The valve was opened by the technician. Use the tool.');
  check(text, { synonyms: false, arrange: false }, text);
  check(text, { protectedTerms: ['valve', 'Utilize'] }, text);
  check('"Utilize the tool."', {}, '"Utilize the tool."');
  check('"Utilize the tool."', { protectQuotes: false }, '"Use the tool."');
});
test('STE procedure, description and note screening targets are distinct; ISO target is a disclosed heuristic', () => {
  const source = 'The cover must remain in the correct position during the inspection of the motor and the subsequent adjustment of the support.';
  const proc = check(source, { profile: 'ste', textType: 'procedure', checkOnly: true });
  const desc = check(source, { profile: 'ste', textType: 'description', checkOnly: true });
  assert.equal(proc.standards.sentenceTarget, 20); assert.equal(proc.standards.after.longSentences, 1);
  assert.equal(desc.standards.sentenceTarget, 25); assert.equal(desc.standards.after.longSentences, 0);
  const note = check('NOTE: ' + source, { profile: 'ste', textType: 'procedure', checkOnly: true });
  assert.equal(note.standards.after.longSentences, 0);
  const plain = check(source, { profile: 'plain', textType: 'procedure', checkOnly: true });
  assert.equal(plain.standards.sentenceTarget, 25);
  assert.match(plain.standards.findings.find(f => f.code === 'COUNT-SCOPE').message, /does not impose/);
});
test('ISO reader context is recorded but never treated as an evaluation', () => {
  const r = check('Use the lever.', { profile: 'plain', audience: 'New technicians', purpose: 'Remove a cover' });
  assert.equal(r.standards.audience, 'New technicians'); assert.equal(r.standards.purpose, 'Remove a cover');
  for (const code of ['ISO-RELEVANT','ISO-FINDABLE','ISO-UNDERSTANDABLE','ISO-USABLE']) assert.ok(r.standards.findings.some(f => f.code === code));
  assert.match(r.standards.findings.find(f => f.code === 'ISO-USABLE').message, /No reader evaluation/);
});
test('user-authorized vocabulary protects technical terms and screens spellings without claiming dictionary completeness', () => {
  const tsv = 'utilize\tnoun\tLabel of a local component\ttechnical-noun\nuse\tverb\tEmploy an item\tgeneral\n__proto__\tnoun\tA literal identifier\ttechnical-noun\n';
  const vocabulary = parseVocabulary(tsv), text = 'Utilize was printed on the label. Use the tool.';
  const js = rewrite(text, { profile: 'combined', vocabulary }, resources);
  assert.equal(js.text, text); assert.equal(js.standards.vocabularyEntries, 3);
  assert.ok(js.standards.after.unlistedWords > 0);
  assert.match(js.standards.findings.find(f => f.code === 'STE-DICTIONARY').message, /spelling checks only/);
  const dir = mkdtempSync(path.join(tmpdir(), 'synomizer-vocab-'));
  try {
    const file = path.join(dir, 'vocabulary.tsv'); writeFileSync(file, tsv);
    const native = run(['--profile','combined','--vocabulary',file,'--json'], text);
    assert.equal(native.status, 0, native.stderr);
    assert.deepEqual(JSON.parse(native.stdout).standards, js.standards);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('invalid profile, text type, metadata and glossary are rejected', () => {
  for (const options of [{profile:'wrong'}, {profile:'ste',textType:'wrong'}, {profile:'ste',checkOnly:'yes'}, {profile:'plain',audience:'x'.repeat(1001)}, {profile:'ste',vocabulary:[{}]}])
    assert.throws(() => rewrite('Test.', options, resources));
  for (const input of ['term\tnoun\tmeaning', 'term\tbogus\tmeaning\tgeneral', 'term\tnoun\t\tgeneral', 'term\tnoun\tmeaning\ttechnical-verb', 'x\tnoun\ty\tgeneral\nx\tnoun\ty\tgeneral']) assert.throws(() => parseVocabulary(input));
  for (const args of [['--profile','wrong'], ['--profile','ste','--text-type','wrong'], ['--check-only'], ['--vocabulary',''], ['--profile','plain','--audience','x'.repeat(1001)]]) assert.notEqual(run(args, 'Test.').status, 0);
});
test('long inputs keep full output and bounded finding presentation', () => {
  const source = 'The cover was removed. '.repeat(2000);
  const r = check(source, { profile: 'combined', checkOnly: true }, source);
  assert.equal(r.standards.after.sentences, 2000);
  assert.ok(r.standards.findings.length <= 251);
  assert.ok(r.standards.findings.some(f => f.code === 'REPORT-LIMIT'));
});

test('an oversized clause cannot trigger repeated full-prefix passive scans', () => {
  const source = 'the valve was opened by the technician '.repeat(2500) + '.';
  check(source, { profile: 'combined' }, source);
});
