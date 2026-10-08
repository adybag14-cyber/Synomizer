// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function loaded(page) {
  await page.goto('./');
  await expect(page.locator('#status')).toContainText('seed 1');
  await expect(page.locator('#copy')).toBeEnabled();
}
async function rewrite(page,text) {
  await page.locator('#source').fill(text);
  await page.locator('#rewrite').click();
  await expect(page.locator('#output')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#status')).toContainText('seed');
}
test('grammar guards survive worker processing and form controls',async({page})=>{
  await loaded(page);
  for(const [text,keep,absent] of [
    ['She is likely to leave.','likely to','probable to'],
    ['I remembered to help.','remembered to','recalled to'],
    ['She found it difficult.','found it','located it'],
    ['A frightened child arrived.','child','afraid'],
    ['She left very quickly.','very','she left very.'],
    ['Joy left because the bus arrived.','Joy','joy'],
    ['https://happy.example/thing(happy).','thing(happy)','thing(glad)'],
  ]) {
    await rewrite(page,text);
    const output=await page.locator('#output').textContent();
    if(keep!=='child') expect(output).toContain(keep);
    expect(output).not.toContain(absent);
  }
  await page.locator('#synonyms').uncheck();
  await rewrite(page,'It was an honest and careful person.');
  await expect(page.locator('#output')).toHaveText('It was a careful and honest person.');
  await rewrite(page,'Because she was late,\nshe left quickly.');
  expect(await page.locator('#output').textContent()).toBe('Because she was late,\nshe left quickly.');
});
test('large ledger exports every change, not only its visible page',async({page})=>{
  await loaded(page);
  await rewrite(page,'The happy child purchased a car. '.repeat(3000));
  await expect(page.locator('#more-changes')).toBeVisible();
  expect(await page.locator('#changes li').count()).toBe(250);
  const waiting=page.waitForEvent('download');
  await page.locator('#export-changes').click();
  const download=await waiting;
  const report=JSON.parse(await readFile(await download.path(),'utf8'));
  expect(report.version).toBe('1.4.1');
  expect(report.changes.length).toBeGreaterThan(250);
  expect(report.text).toBe(await page.locator('#output').textContent());
});
test('published artifact includes the release version and asset fingerprints',async({request})=>{
  const response=await request.get('build.json');
  expect(response.ok()).toBeTruthy();
  const manifest=await response.json();
  expect(manifest.version).toBe('1.4.1');
  expect(Object.keys(manifest.sha256)).toHaveLength(12);
  for(const hash of Object.values(manifest.sha256)) expect(hash).toMatch(/^[a-f0-9]{64}$/);
});
