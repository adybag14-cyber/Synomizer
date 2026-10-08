// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { loadResources, rewrite } from '../../docs/engine.js';
const text = readFileSync(new URL('../fixtures/academic-prose.txt',import.meta.url),'utf8').trim();
const resources=loadResources(...['lexicon.tsv','phrases.txt','rephrases.tsv'].map(n=>readFileSync(new URL(`../../data/${n}`,import.meta.url),'utf8')));
async function batch(page) {
 const waiting=page.waitForEvent('download');await page.locator('#export-all').click();
 const file=await waiting;return JSON.parse(await readFile(await file.path(),'utf8'));
}
async function load(page) {
 await page.goto('./');await expect(page.locator('#status')).toContainText('seed 1');
 await page.locator('#source').fill(text);await page.locator('#rewrite').click();
 await expect(page.locator('#export-all')).toBeEnabled();
 await expect(page.locator('#output')).toHaveAttribute('aria-busy','false');
}
test('academic prose yields actual phrase edits and four structural changes, all exportable',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await load(page);const report=await batch(page);expect(report.variants).toHaveLength(3);
 expect(report.version).toBe('1.4.0');expect(report.original).toBe(text);
 const index=report.variants.findIndex(v=>v.style==='recast');expect(index).toBeGreaterThanOrEqual(0);
 const recast=report.variants[index];
 expect(recast.changes.filter(c=>c.kind==='arrangement').length).toBeGreaterThanOrEqual(4);
 expect(recast.changes.filter(c=>c.kind==='phrase').length).toBeGreaterThanOrEqual(8);
 for(const v of report.variants){expect(rewrite(text,v.options,resources).text).toBe(v.text);expect(v.text).not.toMatch(/stays to be|inspects whether/);}
 await page.getByRole('radio',{name:`Select variation ${index+1}`,exact:true}).check();
 await expect(page.locator('#ledger-choice')).toContainText(`variation ${index+1}`);
 await expect(page.locator('#output')).toHaveText(recast.text);
 await expect(page.locator('#source')).toHaveValue(text);
 expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('academic-comparison.png'),fullPage:true});
});
test('academic structural phase respects disabled sentence moves in every result',async({page})=>{
 await load(page);await page.locator('#arrange').uncheck();await page.locator('#rewrite').click();
 await expect(page.locator('#export-all')).toBeEnabled();const report=await batch(page);
 for(const v of report.variants){expect(v.options.arrange).toBe(false);expect(v.changes.some(c=>c.kind==='arrangement')).toBe(false);}
 expect(report.variants.some(v=>v.changes.some(c=>c.kind==='phrase'))).toBe(true);
});
test('broader academic choices do not invent importance or erase modal uncertainty',async({page})=>{
 await load(page);await page.locator('#intensity').selectOption('2');
 const source='The results suggest that the model may fail. A significant difference was recorded. This review examines whether the framework works. The mechanism remains to be established.';
 await page.locator('#source').fill(source);await page.locator('#rewrite').click();await expect(page.locator('#export-all')).toBeEnabled();
 const report=await batch(page);
 for(const v of report.variants){expect(v.text).toContain('may fail');expect(v.text).toContain('significant');expect(v.text).not.toMatch(/inspects whether|stays to be|important difference|proves/);}
});
