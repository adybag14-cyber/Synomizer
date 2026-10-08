// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function loaded(page) {
  await page.goto('./');
  await expect(page.locator('#status')).toContainText('seed 1');
}
async function mode(page, profile) {
  await page.locator('#profile').selectOption(profile);
  // These cases explicitly exercise an unverified draft export.
  await page.locator('#require-conformity').uncheck();
  await page.locator('#rewrite').click();
  await expect(page.locator('#status')).toContainText('review required');
}
async function rewrite(page, text) {
  await page.locator('#source').fill(text); await page.locator('#rewrite').click();
  await expect(page.locator('#status')).toContainText('review required');
  await expect(page.locator('#output')).toHaveAttribute('aria-busy','false');
}
async function download(page, id) {
  const waiting=page.waitForEvent('download'); await page.locator(id).click();
  const file=await waiting; return JSON.parse(await readFile(await file.path(),'utf8'));
}
test('standards modes produce one consistent draft and a review report without model or third-party requests', async ({page,baseURL}, info) => {
  const errors=[], requests=[], external=[];
  const origin=new URL(baseURL).origin;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{ if(r.method()!=='GET') requests.push(r.method()+' '+r.url()); if(r.url().startsWith('http') && new URL(r.url()).origin!==origin) external.push(r.url()); });
  await loaded(page);
  for(const profile of ['ste','plain','combined']) {
    await mode(page,profile);
    await rewrite(page,'The valve was opened by the technician. Utilize the lever.');
    await expect(page.locator('.variant-card:visible')).toHaveCount(1);
    await expect(page.locator('#output')).toHaveText('The technician opened the valve. Use the lever.');
    await expect(page.locator('#seed')).toBeDisabled(); await expect(page.locator('#intensity')).toBeDisabled();
    await expect(page.locator('#variant')).toBeDisabled();
    await expect(page.locator('#standards-report')).toBeVisible();
    await expect(page.locator('#standards-summary')).toContainText('not been verified');
    const report=await download(page,'#export-changes');
    expect(report.standards.status).toBe('review-required'); expect(report.options.profile).toBe(profile);
    expect(report.standards.semanticEquivalenceVerified).toBe(false);
    expect(report.standards.estimatedCounts).toBe(true);
    const batch=await download(page,'#export-all');
    expect(batch.requested).toBe(1);expect(batch.variants).toHaveLength(1);
    expect(batch.original).toBe('The valve was opened by the technician. Utilize the lever.');
    expect(batch.variants[0]).toEqual(report);
  }
  expect(errors).toEqual([]);expect(requests).toEqual([]);expect(external).toEqual([]);
  await page.screenshot({path:info.outputPath('standards-draft.png'),fullPage:true});
});
test('check-only preserves text and exports diagnostics; switching back restores three variants', async({page})=>{
  await loaded(page);await mode(page,'combined');
  await page.locator('#check-only').check();
  const text="The valve was opened by the technician. Don't remove the pin.";
  await rewrite(page,text);
  await expect(page.locator('#output')).toHaveText(text);
  await expect(page.locator('#rewrite')).toHaveText('Check text');
  const report=await download(page,'#export-changes');
  expect(report.changes).toEqual([]);expect(report.options.checkOnly).toBe(true);
  expect(report.standards.before).toEqual(report.standards.after);
  await page.locator('#reset').click();
  await expect(page.locator('#status')).toContainText('seed 1');
  await expect(page.locator('.variant-card:visible')).toHaveCount(3);
  await expect(page.locator('#standards-report')).toBeHidden();
  await expect(page.locator('#standard-options')).toBeHidden();
  await expect(page.locator('#variant')).toBeEnabled();
});
test('reader context and procedure selection survive exports without false ISO or STE approval',async({page})=>{
  await loaded(page);await mode(page,'combined');
  await page.locator('#text-type').selectOption('procedure');
  await page.locator('#audience').fill('New technicians');
  await page.locator('#purpose').fill('Inspect a valve');
  await rewrite(page,'The valve was inspected.');
  const report=await download(page,'#export-changes');
  expect(report.options.textType).toBe('procedure');expect(report.standards.sentenceTarget).toBe(20);
  expect(report.standards.audience).toBe('New technicians');expect(report.standards.purpose).toBe('Inspect a valve');
  for(const code of ['STE-DICTIONARY','ISO-RELEVANT','ISO-FINDABLE','ISO-UNDERSTANDABLE','ISO-USABLE'])expect(report.standards.findings.some(f=>f.code===code)).toBe(true);
  await expect(page.locator('#standards-metrics')).toContainText('not an ISO requirement');
});
test('authorized vocabulary import protects terms and invalid input clears every stale report/export',async({page})=>{
  await loaded(page);await mode(page,'ste');
  const text='utilize\tnoun\tA local component label\ttechnical-noun\n';
  await page.locator('#vocabulary-file').setInputFiles({name:'terms.tsv',mimeType:'text/tab-separated-values',buffer:Buffer.from(text)});
  await expect(page.locator('#vocabulary')).toHaveValue(text);
  await rewrite(page,'Utilize was printed on the label.');
  await expect(page.locator('#output')).toHaveText('Utilize was printed on the label.');
  const report=await download(page,'#export-changes');expect(report.options.vocabulary).toHaveLength(1);
  expect(report.options.vocabulary[0].category).toBe('technical-noun');
  await page.locator('#vocabulary').fill('bad row');await page.locator('#rewrite').click();
  await expect(page.locator('#banner')).toContainText('four columns');
  await expect(page.locator('#output')).toBeEmpty();await expect(page.locator('#standards-report')).toBeHidden();
  for(const id of ['#copy','#download','#export-changes','#export-all'])await expect(page.locator(id)).toBeDisabled();
});
test('untrusted terminology/context stays inert and a missing model is never required',async({page})=>{
  await loaded(page);await mode(page,'plain');
  const text='<img src=x onerror="window.__injected=1"> Utilize the tool.';
  await page.locator('#audience').fill('<script>window.__injected=2</script>');
  await rewrite(page,text);
  await expect(page.locator('#output img, #standard-findings img, #standard-findings script')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__injected)).toBeUndefined();
  await expect(page.locator('#output')).toContainText('<img src=x');
  await expect(page.locator('#variation-summary')).toContainText('No synonym diversity search');
});
test('standard options and findings fit a 320-pixel screen',async({page},info)=>{
  await loaded(page);await page.setViewportSize({width:320,height:812});await mode(page,'combined');
  await rewrite(page,'The cover was removed. Utilize the lever.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('standards-mobile.png'),fullPage:true});
});
test('coverage documentation distinguishes standards assistance from full compliance and optional external AI',async({page})=>{
  await page.goto('standards.html');
  await expect(page.locator('h1')).toHaveText('Clarity, not certification');
  await expect(page.locator('main')).toContainText('not the complete section 8 counting method');
  await expect(page.locator('main')).toContainText('does not prescribe');
  await expect(page.locator('main')).toContainText('researched, not embedded');
  expect(await page.locator('iframe').count()).toBe(0);
});


test('standards preserve auxiliary-led reported claims and export text without review labels', async ({page}) => {
  await loaded(page);
  const source = 'The operator has said the valve is open, and the light is on. Do not exceed 5 bar.';
  for (const profile of ['ste','plain','combined']) {
    await mode(page, profile); await rewrite(page, source);
    await expect(page.locator('#output')).toHaveText(source);
    await expect(page.locator('#standard-findings')).toContainText('CLARITY-SCOPE');
    const report = await download(page, '#export-changes');
    expect(report.changes).toEqual([]);
    expect(report.standards.findings.some(f => f.code === 'CLARITY-SCOPE')).toBe(true);
    const waiting = page.waitForEvent('download'); await page.locator('#download').click();
    const file = await waiting;
    expect(await readFile(await file.path(), 'utf8')).toBe(source);
  }
  await page.locator('#check-only').check();
  await rewrite(page, 'The engineer has already written the report.');
  const report = await download(page, '#export-changes');
  expect(report.text).toBe('The engineer has already written the report.');
  expect(report.changes).toEqual([]);
  expect(report.standards.findings.some(f => f.code === 'STE-3.2')).toBe(true);
});

test('BOM-prefixed vocabulary can be pasted as well as imported, with exact replay metadata', async ({page}) => {
  await loaded(page); await mode(page, 'ste');
  const tsv = '\ufeff# UTF-8 terminology\nutilize\tnoun\tA local component label\ttechnical-noun\n';
  await page.locator('#vocabulary').fill(tsv);
  await rewrite(page, 'Utilize was printed on the label.');
  await expect(page.locator('#banner')).toBeHidden();
  await expect(page.locator('#output')).toHaveText('Utilize was printed on the label.');
  const report = await download(page, '#export-changes');
  expect(report.options.vocabulary).toEqual([{term:'utilize',pos:'noun',meaning:'A local component label',category:'technical-noun'}]);
  expect(report.standards.vocabularyEntries).toBe(1);
});
