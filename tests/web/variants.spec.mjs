// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function ready(page) {
  await page.goto('./');
  await expect(page.locator('#status')).toContainText('seed 1');
  await expect(page.locator('.variant-card:visible')).toHaveCount(3);
}
async function rewrite(page,text) {
  await page.locator('#source').fill(text);await page.locator('#rewrite').click();
  await expect(page.locator('#status')).toContainText('seed');
  await expect(page.locator('#output')).toHaveAttribute('aria-busy','false');
}
async function download(page,id) {
  const promise=page.waitForEvent('download');await page.locator(id).click();
  const file=await promise;return {name:file.suggestedFilename(),text:await readFile(await file.path(),'utf8')};
}
test('three distinct simultaneous options and selected preview agree',async({page},info)=>{
  await ready(page);
  const texts=await page.locator('.variant-output').allTextContents();
  expect(new Set(texts).size).toBe(3);
  const original=await page.locator('#source').inputValue();
  for(let i=0;i<3;i++) {
    await page.getByRole('radio').nth(i).click();
    await expect(page.getByRole('radio').nth(i)).toBeChecked();
    expect(await page.locator('#output').textContent()).toBe(texts[i]);
    expect(await page.locator('#source').inputValue()).toBe(original);
  }
  await page.locator('.comparison').screenshot({path:info.outputPath('three-options.png')});
});
test('chosen option drives copy, download and complete change ledger',async({page})=>{
  await ready(page);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(t)=>{window.__copied=t;}}}));
  for(let i=0;i<3;i++) {
    await page.getByRole('radio').nth(i).click();
    const text=await page.locator('#output').textContent();
    await page.locator('#copy').click();expect(await page.evaluate(()=>window.__copied)).toBe(text);
    expect((await download(page,'#download')).text).toBe(text);
    const report=JSON.parse((await download(page,'#export-changes')).text);
    expect(report.text).toBe(text);expect(report.options.style).toBe(['balanced','close','recast'][i]);
    expect(report.changes.length).toBe(await page.locator('#changes li').count());
  }
});
test('download all exports every variant plus selection and source',async({page})=>{
  await ready(page);await page.getByRole('radio').nth(2).click();
  const saved=await download(page,'#export-all');expect(saved.name).toBe('synomizer-variations.json');
  const batch=JSON.parse(saved.text);expect(batch.version).toBe('1.3.0');expect(batch.selected).toBe(3);
  expect(batch.requested).toBe(3);expect(batch.attempts).toBeLessThanOrEqual(12);
  expect(batch.original).toBe(await page.locator('#source').inputValue());
  expect(batch.variants.map(v=>v.text)).toEqual(await page.locator('.variant-output').allTextContents());
  expect(batch.variants[2].text).toBe(await page.locator('#output').textContent());
});
test('insufficient variation is explained instead of padded with duplicates',async({page})=>{
  await ready(page);await rewrite(page,'The car.');
  await expect(page.locator('.variant-card:visible')).toHaveCount(1);
  await expect(page.locator('#variation-summary')).toContainText('no duplicates are shown');
  await rewrite(page,'xyzzy');
  await expect(page.locator('.variant-card:visible')).toHaveCount(1);
  await expect(page.locator('#variation-summary')).toContainText('original is preserved');
  await page.locator('#clear').click();
  await expect(page.locator('.variant-card:visible')).toHaveCount(1);
  await expect(page.locator('#export-all')).toBeDisabled();
});
test('edits and invalid input clear all old options and batch exports',async({page})=>{
  await ready(page);await page.getByRole('radio').nth(2).click();
  await page.locator('#seed').fill('-1');await page.locator('#rewrite').click();
  await expect(page.locator('.variant-card:visible')).toHaveCount(1);
  await expect(page.locator('#export-all')).toBeDisabled();
  await page.locator('#seed').fill('5');await rewrite(page,'The happy child purchased a car.');
  await expect(page.locator('.variant-card:visible')).toHaveCount(3);
  await expect(page.getByRole('radio').first()).toBeChecked();
});
test('every option protects terms, quoted words and URLs',async({page})=>{
  await ready(page);await page.locator('summary').click();
  await page.locator('#protected').fill('clear explanation');
  const text='The teacher gave a clear explanation. She said "the happy child". Read https://happy.example/car. They purchased a small car.';
  await rewrite(page,text);
  const texts=await page.locator('.variant-output').allTextContents();expect(texts.length).toBe(3);
  for(const result of texts)for(const term of ['clear explanation','"the happy child"','https://happy.example/car'])expect(result).toContain(term);
});
test('profile-specific phrase edits are visible and selectable',async({page})=>{
  await ready(page);
  await rewrite(page,'In addition, the teacher gave a clear explanation. She carefully examined the report. They retained the documents in order to verify the details.');
  await expect(page.locator('.variant-card:visible')).toHaveCount(3);
  await page.getByRole('radio').nth(2).click();
  await expect(page.locator('#changes')).toContainText('phrase');
  await expect(page.locator('#output')).toContainText('lucid explanation');
  const full=JSON.parse((await download(page,'#export-all')).text);
  expect(full.variants[2].changes.some(c=>c.kind==='phrase')).toBe(true);
});
test('cards are keyboard selectable and fit narrow viewports',async({page},info)=>{
  await ready(page);await page.setViewportSize({width:360,height:780});
  await page.getByRole('radio').nth(1).focus();await page.keyboard.press('Space');
  await expect(page.getByRole('radio').nth(1)).toBeChecked();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('.comparison').screenshot({path:info.outputPath('three-options-mobile.png')});
});
test('untrusted markup is inert in every comparison card',async({page})=>{
  await ready(page);await rewrite(page,'<img src=x onerror="window.__bad=1"> The happy child purchased a car.');
  await expect(page.locator('.variant-output img,.variant-output script')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__bad)).toBeUndefined();
});
test('long cards retain complete text as well as complete exports',async({page})=>{
  await ready(page);const text='The happy child purchased a car.\n'.repeat(300);
  await rewrite(page,text);
  await expect(page.locator('.variant-card:visible')).toHaveCount(3);
  for(const preview of await page.locator('.variant-output').allTextContents())expect(preview.length).toBeGreaterThan(5000);
  const saved=JSON.parse((await download(page,'#export-all')).text);
  for(const v of saved.variants)expect(v.text.length).toBeGreaterThan(5000);
  await page.getByRole('radio').nth(2).click();
  expect(await page.locator('#output').textContent()).toBe(saved.variants[2].text);
});
