// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source='The selection includes copper, zinc or nickel. The cover is clean.';
const expected='The selection includes:\n- copper,\n- zinc\n- or nickel.\n\nThe cover is clean.';
async function ready(page,profile='combined') {
  await page.goto('./');await expect(page.locator('#status')).toContainText('seed 1');
  await page.locator('#profile').selectOption(profile);
  await page.locator('#source').fill(source);await page.locator('#rewrite').click();
  await expect(page.locator('#status')).toContainText('review required');
  await expect(page.locator('#output')).toHaveAttribute('aria-busy','false');
}
async function report(page,id='#export-changes') {
  const waiting=page.waitForEvent('download');await page.locator(id).click();
  const file=await waiting;return JSON.parse(await readFile(await file.path(),'utf8'));
}
async function settled(page) {
  await page.locator('#rewrite').click();
  await expect(page.locator('#status')).toContainText('review required');
  await expect(page.locator('#output')).toHaveAttribute('aria-busy','false');
}
test('strict release blocks all text exports while diagnostic reports remain usable',async({page})=>{
  await ready(page);await expect(page.locator('#output')).toHaveText(expected);
  await expect(page.locator('#require-conformity')).toBeChecked();
  await page.locator('#require-conformity').check();await settled(page);
  await expect(page.locator('#release-decision')).toContainText('STRICT RELEASE BLOCKED');
  for(const id of ['#copy','#download'])await expect(page.locator(id)).toBeDisabled();
  for(const action of ['copy','download'])await expect(page.locator(`.variant-card[data-index="0"] [data-action="${action}"]`)).toBeDisabled();
  const r=await report(page);
  expect(r.options.requireConformity).toBe(true);
  expect(r.standards.conformity.releaseAllowed).toBe(false);
  expect(r.standards.conformity.conformityVerified).toBe(false);
  expect(r.text).toBe(expected);
  expect(r.standards.conformity.sourceSha256).toBe(createHash('sha256').update(source).digest('hex'));
  expect(r.standards.conformity.draftSha256).toBe(createHash('sha256').update(expected).digest('hex'));
  const all=await report(page,'#export-all');expect(all.original).toBe(source);expect(all.variants[0]).toEqual(r);
  await page.locator('#require-conformity').uncheck();await settled(page);
  await expect(page.locator('#copy')).toBeEnabled();await expect(page.locator('#download')).toBeEnabled();
  await expect(page.locator('#release-decision')).toContainText('UNVERIFIED DRAFT');
});
test('rule inventory is complete by identifier without claiming verified coverage',async({page})=>{
  await ready(page);
  for(const [profile,count] of [['ste',53],['plain',4],['combined',57]]) {
    await page.locator('#profile').selectOption(profile);await settled(page);
    await page.locator('#show-coverage').click();
    await expect(page.locator('#coverage-panel')).toBeVisible();
    await expect(page.locator('#rule-coverage tr')).toHaveCount(count);
    const r=await report(page);expect(r.standards.conformity.requirements).toHaveLength(count);
    expect(r.standards.conformity.requirements.every(x=>['attention','not-verified'].includes(x.result))).toBe(true);
    expect(r.standards.conformity.requirements.some(x=>x.rule==='2.3')).toBe(false);
    await expect(page.locator('#source')).toHaveValue(source);
  }
});
test('list switch and check-only preserve the original and do not certify short text',async({page})=>{
  await ready(page);await expect(page.locator('#output')).toHaveText(expected);
  await page.locator('#structured-lists').uncheck();await settled(page);
  await expect(page.locator('#output')).toHaveText(source);
  let r=await report(page);expect(r.options.structuredLists).toBe(false);
  await page.locator('#structured-lists').check();await page.locator('#check-only').check();await settled(page);
  await expect(page.locator('#output')).toHaveText(source);
  r=await report(page);expect(r.changes).toEqual([]);
  expect(r.standards.before).toEqual(r.standards.after);expect(r.standards.conformity.releaseAllowed).toBe(false);
  await expect(page.locator('#source')).toHaveValue(source);
});
test('invalid or superseded strict requests never revive stale release/report state',async({page})=>{
  await ready(page);await page.locator('#require-conformity').check();await settled(page);
  await page.locator('#vocabulary').fill('invalid glossary');await page.locator('#rewrite').click();
  await expect(page.locator('#banner')).toContainText('four columns');
  await expect(page.locator('#standards-report')).toBeHidden();
  for(const id of ['#copy','#download','#export-changes','#export-all'])await expect(page.locator(id)).toBeDisabled();
  await page.locator('#vocabulary').fill('');await page.locator('#source').fill('Use the lever.');await settled(page);
  await expect(page.locator('#output')).toHaveText('Use the lever.');
  await expect(page.locator('#copy')).toBeDisabled();
  const r=await report(page);expect(r.options.requireConformity).toBe(true);
  expect(r.standards.conformity.sourceSha256).toBe(createHash('sha256').update('Use the lever.').digest('hex'));
});
test('full release inventory and hashes fit a narrow viewport',async({page},info)=>{
  await ready(page);await page.locator('#require-conformity').check();await settled(page);
  await page.setViewportSize({width:320,height:812});await page.locator('#show-coverage').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(page.locator('#rule-coverage tr')).toHaveCount(57);
  await page.screenshot({path:info.outputPath('strict-release-mobile.png'),fullPage:true});
});
test('new release controls make no model or third-party requests',async({page,baseURL})=>{
  const errors=[],requests=[];const origin=new URL(baseURL).origin;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.method()!=='GET'||r.url().startsWith('http')&&new URL(r.url()).origin!==origin)requests.push(r.url());});
  await ready(page);await page.locator('#require-conformity').check();await settled(page);await report(page);
  await page.locator('#show-coverage').click();
  expect(errors).toEqual([]);expect(requests).toEqual([]);
});
