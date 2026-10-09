// Copyright 2026 adybag14-cyber
// SPDX-License-Identifier: Apache-2.0
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadResources,rewrite} from '../../docs/engine.js';
const resources=loadResources(...['lexicon.tsv','phrases.txt','rephrases.tsv'].map(n=>readFileSync(new URL(`../../data/${n}`,import.meta.url),'utf8')));
const hash=s=>createHash('sha256').update(s).digest('hex');
const source='The process requires control of pressure, temperature or flow. Do not exceed 5 bar.';
async function loaded(page) {await page.goto('./'); await page.locator("#profile").selectOption("variation");await expect(page.locator('#status')).toContainText('seed 1');}
async function settled(page) {await expect(page.locator('#status')).toContainText('review required');await expect(page.locator('#output')).toHaveAttribute('aria-busy','false');}
async function exportReport(page) {
 const waiting=page.waitForEvent('download');await page.locator('#export-changes').click();const file=await waiting;
 return JSON.parse(await readFile(await file.path(),'utf8'));
}

test('both-standards shortcut is visible from the initial screen and creates one dual-reviewed draft',async({page},info)=>{
 await loaded(page);await expect(page.locator('#both-standards')).toBeVisible();
 await expect(page.locator('#both-standards')).toHaveText('Restructure for both standards');
 await expect(page.locator('#both-standards-help')).toContainText('ASD-STE100 + ISO 24495-1');
 await page.locator('#source').fill(source);await page.locator('#both-standards').click();await settled(page);
 await expect(page.locator('#profile')).toHaveValue('combined');
 await expect(page.locator('.variant-card:visible')).toHaveCount(1);
 await expect(page.locator('.standard-screen')).toHaveCount(2);
 const report=await exportReport(page),expected=rewrite(source,{profile:'combined',requireConformity:true},resources);
 expect(report.text).toBe(expected.text);expect(report.standards).toEqual(expected.standards);
 expect(report.standards.screens.map(s=>s.draftSha256)).toEqual([hash(report.text),hash(report.text)]);
 await expect(page.locator('#source')).toHaveValue(source);
 await expect(page.locator('#copy')).toBeDisabled();await expect(page.locator('#download')).toBeDisabled();
 await expect(page.locator('#mode-route')).toContainText('Both standards selected');
 await page.screenshot({path:info.outputPath('dual-standards-visible.png'),fullPage:true});
});

test('Restructured card can switch to both standards without feeding its own generated text back',async({page})=>{
 await loaded(page);const original=await page.locator('#source').inputValue();
 const card=page.locator('.variant-card').nth(2);
 await expect(card).toBeVisible();const variation=await card.locator('.variant-output').innerText();
 expect(variation).not.toBe(original);
 await card.locator('[data-action="both"]').click();await settled(page);
 const report=await exportReport(page);
 expect(report.text).toBe(rewrite(original,{profile:'combined'},resources).text);
 expect(report.standards.conformity.sourceSha256).toBe(hash(original));
 await expect(page.locator('#source')).toHaveValue(original);
 expect(report.options.profile).toBe('combined');expect(report.standards.screens).toHaveLength(2);
});

test('preset retains terms, audience, purpose and input while explicitly enabling structural drafting and strict export',async({page})=>{
 await loaded(page);await page.locator('#profile').selectOption('plain');
 await page.locator('#audience').fill('New technicians');await page.locator('#purpose').fill('Inspect equipment');
 await page.locator('#text-type').selectOption('procedure');
 await page.locator('details.advanced').evaluate(e=>e.open=true);await page.locator('#protected').fill('5 bar');
 await page.locator('#check-only').check();await page.locator('#require-conformity').uncheck();
 await page.locator('#arrange').uncheck();await page.locator('#structured-lists').uncheck();
 await page.locator('#source').fill(source);await page.locator('#both-standards').click();await settled(page);
 const report=await exportReport(page);
 expect(report.options).toMatchObject({profile:'combined',audience:'New technicians',purpose:'Inspect equipment',textType:'procedure',protectedTerms:['5 bar'],checkOnly:false,arrange:true,structuredLists:true,requireConformity:true});
 expect(report.text).toContain('Do not exceed 5 bar.');expect(report.text).toContain('- or flow.');
 expect(report.standards.screens.map(s=>s.sentenceTarget)).toEqual([20,25]);
 await expect(page.locator('#source')).toHaveValue(source);await expect(page.locator('#copy')).toBeDisabled();
});

test('same draft exposes STE grouped counts and distinct plain-language advisory concerns',async({page})=>{
 await loaded(page);const text='The label says "'+Array(30).fill('word').join(' ')+'".';
 await page.locator('#source').fill(text);await page.locator('#both-standards').click();await settled(page);
 const report=await exportReport(page),[ste,plain]=report.standards.screens;
 expect(report.text).toBe(text);expect(ste.after.longestSentence).toBe(4);expect(plain.after.longestSentence).toBe(33);
 const steBox=page.locator('.standard-screen[data-profile="ste"]'),plainBox=page.locator('.standard-screen[data-profile="plain"]');
 await expect(steBox.locator('h3')).toContainText('ASD-STE100');await expect(plainBox.locator('h3')).toContainText('ISO 24495-1');
 await expect(plainBox).toContainText('advisory, not an ISO requirement');
 await plainBox.locator('summary').click();await expect(plainBox).toContainText('PL-SENTENCE');
 expect(ste.findings.some(f=>f.code.startsWith('ISO-'))).toBe(false);expect(plain.findings.some(f=>f.code.startsWith('STE-'))).toBe(false);
});

test('check-only and explicit draft download use the same dual checks; switching modes clears old views',async({page})=>{
 await loaded(page);await page.locator('#source').fill(source);await page.locator('#both-standards').click();await settled(page);
 await page.locator('#check-only').check();await page.locator('#rewrite').click();await settled(page);
 let report=await exportReport(page);expect(report.text).toBe(source);expect(report.changes).toEqual([]);
 expect(report.standards.screens).toHaveLength(2);
 await page.locator('#require-conformity').uncheck();await page.locator('#rewrite').click();await settled(page);
 const waiting=page.waitForEvent('download');await page.locator('#download').click();const file=await waiting;
 expect(await readFile(await file.path(),'utf8')).toBe(source);
 report=await exportReport(page);expect(report.standards.conformity.releaseAllowed).toBe(false);
 await page.locator('#profile').selectOption('variation');await page.locator('#rewrite').click();await expect(page.locator('#status')).toContainText('seed 1');
 await expect(page.locator('#standards-report')).toBeHidden();await expect(page.locator('.standard-screen')).toHaveCount(0);
 await expect(page.locator('#mode-route')).toContainText('ordinary rewriting');
});

test('shortcut is keyboard operable and both review panels fit a narrow screen',async({page},info)=>{
 await loaded(page);await page.setViewportSize({width:320,height:812});
 await page.locator('#both-standards').focus();await page.keyboard.press('Enter');await settled(page);
 await expect(page.locator('#profile')).toHaveValue('combined');await expect(page.locator('.standard-screen')).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const boxes=await page.locator('.standard-screen').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width};}));
 expect(Math.abs(boxes[0].x-boxes[1].x)).toBeLessThan(2);expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
 await page.screenshot({path:info.outputPath('dual-standards-mobile.png'),fullPage:true});
});

test('dual reports remain local and reported claims stay attributed',async({page,baseURL})=>{
 const external=[],writes=[],errors=[];
 page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());if(r.url().startsWith('http')&&new URL(r.url()).origin!==new URL(baseURL).origin)external.push(r.url());});
 page.on('pageerror',e=>errors.push(e.message));
 await loaded(page);const text='The analyst has said the valve is open, and the light is on.';
 await page.locator('#source').fill(text);await page.locator('#both-standards').click();await settled(page);
 const report=await exportReport(page);expect(report.text).toBe(text);
 for(const screen of report.standards.screens)expect(screen.findings.some(f=>f.code==='CLARITY-SCOPE')).toBe(true);
 expect(external).toEqual([]);expect(writes).toEqual([]);expect(errors).toEqual([]);
});
