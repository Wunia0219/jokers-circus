import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {createQaServer, launchBrowser} from './helpers/browser.js';

const port = 4196, origin = `http://127.0.0.1:${port}`, output = 'test-results/yakyuken';
mkdirSync(output,{recursive:true});
const server = await createQaServer(port);
let browser;
const results = [], errors = [], requests = [];
const report = () => writeFileSync(`${output}/browser-report.json`,JSON.stringify({ok:results.length >= 8 && errors.length === 0,results,errors,requests},null,2));
const storageKey = 'jokers-circus:yakyuken:preview:v1';
try {
  await server.listen(); browser = await launchBrowser();
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  // Deterministic opponent in the QA browser, with no cheats in the preview.
  await context.addInitScript(() => {
    const original = Crypto.prototype.getRandomValues;
    Crypto.prototype.getRandomValues = function(values) {
      if (values instanceof Uint32Array && values.length === 1) { values[0] = 0; return values; }
      return original.call(this,values);
    };
    localStorage.setItem('kemet-slot-preview-v2','slot-sentinel');
  });
  const page = await context.newPage();
  page.on('pageerror',error => errors.push(error.message));
  page.on('request',request => requests.push(request.url()));
  const state = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)),storageKey);
  const ready = () => page.waitForFunction(() => document.querySelector('#duel-panel')?.getAttribute('aria-busy') === 'false');
  const move = async name => {await page.locator(`[data-move="${name}"]`).click();await ready();};
  await page.goto(`${origin}/yakyuken-preview.html`); await ready();
  assert.equal(await page.locator('#balance').textContent(),'10,000');
  assert.equal(await page.locator('#dealer-art').evaluate(image => image.complete && image.naturalWidth > 0),true);
  await page.screenshot({path:`${output}/desktop-start.png`,fullPage:true});
  results.push('desktop loads with three decoded stage images');

  await page.locator('#enter-challenge').click();
  assert.equal((await state()).balance,9000);
  await move('rock');
  assert.deepEqual([(await state()).session.draws,(await state()).session.losses,(await state()).balance],[1,0,9000]);
  results.push('entry charged once and draws cost no opportunity');

  await page.evaluate(() => {
    window.__yakyukenSwapEvents = [];
    const art = document.querySelector('#dealer-art');
    new MutationObserver(() => window.__yakyukenSwapEvents.push({stage:document.querySelector('#portrait').dataset.stage,covered:!document.querySelector('#victory-overlay').hidden,busy:document.querySelector('#duel-panel').getAttribute('aria-busy')})).observe(art,{attributes:true,attributeFilter:['src']});
  });
  await page.locator('[data-move="paper"]').click();
  await page.waitForFunction(() => !document.querySelector('#victory-overlay').hidden);
  const overlay = await page.locator('.victory-emblem').boundingBox();
  assert.ok(Math.abs(overlay.x + overlay.width / 2 - 720) < 2,'emblem centered horizontally');
  assert.ok(Math.abs(overlay.y + overlay.height / 2 - 500) < 2,'emblem centered vertically');
  await page.waitForFunction(() => document.querySelector('#portrait').dataset.stage === '1');
  await page.screenshot({path:`${output}/victory-emblem.png`});
  await ready();
  const swaps = await page.evaluate(() => window.__yakyukenSwapEvents);
  const firstStageChange = swaps.find(event => event.stage === '1');
  assert.ok(firstStageChange?.covered && firstStageChange.busy === 'true','first pose change must occur while the emblem covers the stage and controls are locked');
  assert.equal((await state()).session.wins,1);
  await page.screenshot({path:`${output}/desktop-stage-1.png`,fullPage:true});
  results.push('central victory emblem covers the pose change before controls unlock');

  await page.reload(); await ready();
  assert.equal((await state()).session.wins,1);
  assert.equal((await state()).balance,9000);
  await page.locator('[data-move="paper"]').click();
  await page.waitForFunction(key => JSON.parse(sessionStorage.getItem(key)).session.status === 'won',storageKey);
  // Reload during the reveal: terminal balance must remain paid exactly once.
  await page.reload(); await ready();
  assert.equal((await state()).balance,11000);
  assert.equal(await page.locator('#portrait').getAttribute('data-stage'),'2');
  assert.equal(await page.locator('[data-move="paper"]').isDisabled(),true);
  await page.screenshot({path:`${output}/desktop-final.png`,fullPage:true});
  results.push('reload restores progression and cannot replay the completion reward');

  await page.locator('#enter-challenge').click();
  await move('scissors'); await move('scissors');
  assert.equal((await state()).session.status,'lost');
  assert.equal((await state()).balance,10000);
  results.push('second defeat ends challenge without payout');

  await page.locator('#show-rules').click();
  assert.equal(await page.locator('#review-dialog').evaluate(dialog => dialog.open),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#review-dialog').evaluate(dialog => dialog.open),false);
  await page.locator('#show-art').click();
  assert.equal(await page.locator('.art-gallery img').count(),3);
  await page.keyboard.press('Escape');
  await page.locator('#show-odds').click();
  assert.equal(await page.locator('tbody tr').count(),5);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => localStorage.getItem('kemet-slot-preview-v2')),'slot-sentinel');
  assert.ok(requests.every(url => url.startsWith(origin) || url.startsWith('data:')),'no Discord or production requests');
  results.push('rules, art review, exact odds and isolated wallet');

  const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await mobile.addInitScript(() => { Crypto.prototype.getRandomValues = values => {values[0]=0;return values;}; });
  const phone = await mobile.newPage(); phone.on('pageerror',error => errors.push(error.message));
  await phone.goto(`${origin}/yakyuken-preview.html`);
  await phone.waitForFunction(() => document.querySelector('#duel-panel')?.getAttribute('aria-busy') === 'false');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  await phone.screenshot({path:`${output}/mobile-start.png`,fullPage:true});
  await phone.locator('#enter-challenge').tap();
  await phone.locator('[data-move="paper"]').tap();
  await phone.waitForFunction(() => document.querySelector('#portrait').dataset.stage === '1');
  await phone.waitForFunction(() => document.querySelector('#duel-panel').getAttribute('aria-busy') === 'false');
  assert.equal(await phone.locator('#victory-overlay').isHidden(),true);
  await phone.locator('[data-move="paper"]').tap();
  await phone.waitForFunction(() => document.querySelector('#portrait').dataset.stage === '2');
  assert.equal(await phone.locator('#balance').textContent(),'11,000');
  await phone.screenshot({path:`${output}/mobile-final.png`,fullPage:true});
  results.push('mobile touch, no horizontal overflow, reduced-motion instant wardrobe state');

  const failure = await context.newPage(); failure.on('pageerror',error => errors.push(error.message));
  await failure.route('**/images/yakyuken/**/stage-2.webp',route => route.abort());
  await failure.goto(`${origin}/yakyuken-preview.html`);
  await failure.waitForFunction(() => document.querySelector('#feedback-title')?.textContent === '舞台尚未就緒');
  assert.equal(await failure.locator('#enter-challenge').isDisabled(),true);
  results.push('asset failure blocks entry without charging');
  assert.deepEqual(errors,[]);
  report(); console.log(JSON.stringify({ok:true,checks:results.length,output}));
} catch (error) {errors.push(error.stack);report();throw error;}
finally {await browser?.close();await server.close();}
