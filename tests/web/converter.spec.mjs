// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const source='The process requires control of temperature, pressure or flow.';
const expected='The process requires control of the following:\n- temperature,\n- pressure,\n- or flow.\n\n';
async function ready(page,profile='combined') {
  await page.goto('./');await expect(page.locator('#status')).toContainText('seed 1');
  await page.locator('#profile').selectOption(profile);
}
async function convert(page,text=source) {
  await page.locator('#source').fill(text);await page.locator('#rewrite').click();
  await expect(page.locator('#status')).toContainText('review required');
  await expect(page.locator('#output')).toHaveAttribute('aria-busy','false');
}
async function download(page,id) {
  const waiting=page.waitForEvent('download');await page.locator(id).click();
  const file=await waiting;return await readFile(await file.path(),'utf8');
}
async function blocked(page) {
  for(const id of ['#copy','#download'])await expect(page.locator(id)).toBeDisabled();
  for(const action of ['copy','download'])await expect(page.locator(`.variant-card:visible [data-action="${action}"]`)).toBeDisabled();
  await expect(page.locator('#export-changes')).toBeEnabled();
  await expect(page.locator('#export-all')).toBeEnabled();
}

test('strict standards mode defaults to blocked text release with complete diagnostic export',async({page})=>{
  await ready(page);await expect(page.locator('#require-conformity')).toBeChecked();
  await convert(page);
  await expect(page.locator('#output')).toHaveText(expected);
  await blocked(page);
  await expect(page.locator('#conformity-state')).toContainText('Text copy/download is blocked');
  const report=JSON.parse(await download(page,'#export-changes'));
  expect(report.classification).toBe('unverified-draft-report');
  expect(report.text).toBe(expected);expect(report.changes).toHaveLength(1);
  expect(report.standards.conformity).toMatchObject({decision:'blocked',releaseAllowed:false,conformityVerified:false,strictRequested:true,invariantCheck:'passed',sourceSha256:hash(source),draftSha256:hash(expected)});
  const all=JSON.parse(await download(page,'#export-all'));
  expect(all.variants[0]).toEqual(report);expect(all.original).toBe(source);
  await expect(page.locator('#source')).toHaveValue(source);
});

test('draft opt-out and re-enabling strict mode update every text export without changing meaning',async({page})=>{
  await ready(page);await convert(page);
  await page.locator('#require-conformity').uncheck();await page.locator('#rewrite').click();
  await expect(page.locator('#download')).toBeEnabled();
  await expect(page.locator('#conformity-state')).toContainText('unverified draft');
  expect(await download(page,'#download')).toBe(expected);
  const report=JSON.parse(await download(page,'#export-changes'));
  expect(report.standards.conformity.releaseAllowed).toBe(false);
  expect(report.options.requireConformity).toBe(false);
  await page.locator('#require-conformity').check();await page.locator('#rewrite').click();
  await expect(page.locator('#status')).toContainText('review required');await blocked(page);
  await expect(page.locator('#output')).toHaveText(expected);
});

test('requirements panel distinguishes full STE ID inventory from ISO principle-level review',async({page},info)=>{
  await ready(page);await convert(page);
  for(const [profile,count] of [['ste',53],['plain',4],['combined',57]]) {
    await page.locator('#profile').selectOption(profile);await page.locator('#rewrite').click();
    await expect(page.locator('#status')).toContainText('review required');
    await page.locator('#coverage-toggle').click();
    await expect(page.locator('#coverage-panel')).toBeVisible();
    await expect(page.locator('#rule-coverage tbody tr')).toHaveCount(count);
    const statuses=await page.locator('#rule-coverage tbody tr td:last-child').allTextContents();
    expect(statuses.every(s=>s==='not-verified'||s==='attention')).toBe(true);
    await expect(page.locator('#coverage-summary')).toContainText('not every guideline');
    await blocked(page);
  }
  await page.setViewportSize({width:320,height:812});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('strict-converter-mobile.png'),fullPage:true});
});

test('empty text, glossary data and reader fields never manufacture conformity',async({page})=>{
  await ready(page);await convert(page,'');
  await expect(page.locator('#output')).toBeEmpty();await blocked(page);
  let report=JSON.parse(await download(page,'#export-changes'));
  expect(report.standards.conformity.blockers.some(x=>x.includes('No assessable'))).toBe(true);
  await page.locator('#audience').fill('Maintenance staff');await page.locator('#purpose').fill('Use a lever');
  await page.locator('#vocabulary').fill('use\tverb\tEmploy\tgeneral\nthe\tarticle\tSpecified item\tgeneral\nlever\tnoun\tLocal component\ttechnical-noun\n');
  await convert(page,'Use the lever.');await blocked(page);
  report=JSON.parse(await download(page,'#export-changes'));
  expect(report.standards.conformity.conformityVerified).toBe(false);
  expect(report.standards.conformity.requirements.every(r=>r.result!=='pass')).toBe(true);
});

test('list opt-out and check-only preserve exact source and strict release gate',async({page})=>{
  await ready(page);await page.locator('#structured-lists').uncheck();await convert(page);
  await expect(page.locator('#output')).toHaveText(source);await blocked(page);
  await page.locator('#structured-lists').check();await page.locator('#check-only').check();await convert(page);
  await expect(page.locator('#output')).toHaveText(source);await blocked(page);
  const report=JSON.parse(await download(page,'#export-changes'));expect(report.changes).toEqual([]);
  expect(report.standards.conformity.sourceSha256).toBe(report.standards.conformity.draftSha256);
  await page.locator('#reset').click();
  await expect(page.locator('#status')).toContainText('seed 1');
  await expect(page.locator('.variant-card:visible')).toHaveCount(3);
  await expect(page.locator('#copy')).toBeEnabled();await expect(page.locator('#conformity-panel')).toBeHidden();
});

test('new input invalidates old export/report and new hash remains local',async({page,baseURL})=>{
  const external=[],writes=[],errors=[];
  page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());if(r.url().startsWith('http')&&new URL(r.url()).origin!==new URL(baseURL).origin)external.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await ready(page);await convert(page);
  await page.locator('#require-conformity').uncheck();await page.locator('#rewrite').click();await expect(page.locator('#download')).toBeEnabled();
  await page.locator('#require-conformity').check();
  const changed='The analyst has said the valve is open, and the light is on.';
  await convert(page,changed);await blocked(page);
  const report=JSON.parse(await download(page,'#export-changes'));
  expect(report.text).toBe(changed);expect(report.standards.conformity.draftSha256).toBe(hash(changed));
  expect(report.standards.findings.some(f=>f.code==='CLARITY-SCOPE')).toBe(true);
  expect(external).toEqual([]);expect(writes).toEqual([]);expect(errors).toEqual([]);
});


test('missing worker reproduction metadata cannot disable the originating strict request',async({page})=>{
 await page.route('**/worker.js',async route=>{
  const response=await route.fetch();const original=await response.text();
  const field='requireConformity: data.options.requireConformity ?? false, ';
  expect(original).toContain(field);
  await route.fulfill({response,body:original.replace(field,'')});
 });
 await ready(page);await convert(page);
 await blocked(page);
 const report=JSON.parse(await download(page,'#export-changes'));
 expect(report.options.requireConformity).toBeUndefined();
 expect(report.standards.conformity.strictRequested).toBe(true);
 expect(report.standards.conformity.releaseAllowed).toBe(false);
});
