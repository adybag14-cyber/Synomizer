// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resources, run } from './hardening-support.mjs';
import { rewrite, rewriteVariants, parseVocabulary } from '../docs/engine.js';

function check(source, options = {}) {
  const o = { profile: 'combined', ...options };
  const args = ['--json', '--profile', o.profile];
  if (o.checkOnly) args.push('--check-only');
  const native = run(args, source);
  assert.equal(native.status, 0, native.stderr || native.error?.message);
  const cpp = JSON.parse(native.stdout), js = rewrite(source, o, resources);
  assert.deepEqual({text:js.text, changes:js.changes, standards:js.standards},
    {text:cpp.text, changes:cpp.changes, standards:cpp.standards});
  assert.equal(js.parts.map(p => p.text).join(''), js.text);
  return js;
}
const embedded = [
  'The operator has said the valve is open, and the light is on.',
  'She may think the valve is open, but the switch is off.',
  'The engineer is certain the motor works, and the pressure is low.',
  'The operator has verified the test is complete; the result is valid.',
  'The analyst has reported the sample was clean, and the control was dry.',
  'The operator does believe the test passed, and the sample is intact.',
  'The engineer is sure the valve opens; the light is on.',
  'The assessment has shown the motor is safe, but the cover is damaged.',
  'The report is evidence the system works, and the panel is dry.',
  'The valve is open, and the operator has said the motor is safe.',
  'The panel is ready to indicate the motor is safe, and the light is on.',
];
for (const profile of ['ste','plain','combined']) for (const source of embedded) {
  test(`reported/attitude scope remains attached / ${profile} / ${source}`, () => {
    const result = check(source, {profile});
    assert.equal(result.text, source);
    assert.equal(result.changes.length, 0);
    assert.ok(result.standards.findings.some(f => f.code === 'CLARITY-SCOPE'));
    assert.equal(result.standards.semanticEquivalenceVerified, false);
    const batch = rewriteVariants(source, {profile}, resources, 3);
    assert.equal(batch.variants.length, 1);
    assert.equal(batch.variants[0].result.text, source);
  });
}
for (const [source, expected] of [
  ['The valve is open, but the switch is off.', 'The valve is open. But the switch is off.'],
  ['The panel is clean; the surface is dry.', 'The panel is clean. The surface is dry.'],
  ['The technician has inspected the valve, and the operator has tested the switch.', 'The technician has inspected the valve. And the operator has tested the switch.'],
  ['The operator can open the valve, and the technician can remove the cover.', 'The operator can open the valve. And the technician can remove the cover.'],
  ['The panel has been cleaned; the cover is dry.', 'The panel has been cleaned. The cover is dry.'],
]) test(`supported direct clauses still split / ${source}`, () => {
  const result = check(source);
  assert.equal(result.text, expected);
  assert.equal(result.changes.length, 1);
  assert.ok(!result.standards.findings.some(f => f.code === 'CLARITY-SCOPE'));
});
for (const source of [
  'The engineer has written the report.',
  'The engineer has already written the report.',
  'The technician has not removed the cover.',
  'The mechanic had built the device.',
]) test(`STE tense review detects irregular/intervening words / ${source}`, () => {
  const result = check(source, {profile:'ste', checkOnly:true});
  assert.equal(result.text, source);
  assert.ok(result.standards.findings.some(f => f.code === 'STE-3.2'));
});
test('possessive have is not reported as a perfect construction', () => {
  const result = check('The device has a red label.', {profile:'ste', checkOnly:true});
  assert.ok(!result.standards.findings.some(f => f.code === 'STE-3.2'));
});
test('plain-language passive guidance does not present STE rules as ISO requirements', () => {
  const result = check('The cover was removed.', {profile:'plain'});
  const item = result.standards.findings.find(f => f.code === 'PL-ACTIVE');
  assert.ok(item); assert.doesNotMatch(item.message, /STE/);
  assert.match(item.message, /reader|focus|actor/);
});
test('UTF-8 BOM vocabulary behaves identically in browser API and native CLI', () => {
  const plain = '# User-owned terminology\r\nutilize\tnoun\tA local component label\ttechnical-noun\r\nuse\tverb\tEmploy an item\tgeneral\r\n';
  const tsv = '\ufeff' + plain;
  assert.deepEqual(parseVocabulary(tsv), parseVocabulary(plain));
  const folder = mkdtempSync(path.join(tmpdir(), 'synomizer-bom-'));
  try {
    const file = path.join(folder, 'terms.tsv'); writeFileSync(file, tsv);
    const source = 'Utilize was printed on the label. Use the tool.';
    const native = run(['--profile','ste','--vocabulary',file,'--json'], source);
    assert.equal(native.status, 0, native.stderr);
    const cpp = JSON.parse(native.stdout);
    const js = rewrite(source, {profile:'ste', vocabulary:parseVocabulary(tsv)}, resources);
    assert.equal(cpp.text, source);
    assert.deepEqual(cpp.standards, js.standards);
  } finally { rmSync(folder, {recursive:true, force:true}); }
});
