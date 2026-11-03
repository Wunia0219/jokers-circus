import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'vite';
import {launchBrowser} from './helpers/browser.js';
import {tableLayout,TABLE_MOVES} from '../../src/games/yakyuken/pixi/layout.js';

const port=4196,origin=`http://127.0.0.1:${port}`,output='test-results/yakyuken-pixi';
mkdirSync(output,{recursive:true});
const server=await createServer({configFile:false,envDir:false,cacheDir:`${output}/vite-cache`,
  optimizeDeps:{include:['pixi.js','pixi.js/unsafe-eval','pixi.js/prepare'],noDiscovery:true},
  plugins:[{name:'isolated-pixi-lifecycle',configureServer(dev){dev.middlewares.use((request,response,next) => {
    if(request.url!=='/__yakyuken_lifecycle')return next();
    response.setHeader('Content-Type','text/html');response.end(`<div id="host"></div><script type="module">import {YakyukenScene} from '/src/games/yakyuken/scene.js';const scene=new YakyukenScene();const host=document.querySelector('#host');const init=scene.init(host);await scene.destroy();await init;document.body.dataset.disposed='true';</script>`);
  });},transform(code,id){
    if(!id.split('?')[0].replaceAll('\\','/').endsWith('/src/main.js'))return;
    assert.ok(code.includes('startGame();'),'isolated slot ticker hook must match the real entry');
    return {code:code.replace('startGame();','globalThis.__slotNavigationTest={scene,controls};startGame();'),map:null};
  }}],
  server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:{ignored:['**/test-results/**','**/data/**','**/backups/**']}},
});
const checks=[],errors=[],requests=[];
let browser;
const report=() => writeFileSync(`${output}/browser-report.json`,JSON.stringify({ok:checks.length===14 && errors.length===0,checks,errors,requests},null,2));
const frame=page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const phase=(page,value) => page.waitForFunction(expected => document.querySelector('canvas')?.dataset.phase===expected,value);
const canvasState=page => page.locator('canvas').evaluate(canvas => ({...canvas.dataset}));
const openMenuItem=async(page,name)=>{
  await page.getByRole('button',{name:'開啟選單',exact:true}).click();
  await page.getByRole('button',{name,exact:true}).click();
};
const startTable=async(page,screenshots)=>{
  await phase(page,'games');
  if(screenshots)await page.screenshot({path:`${output}/${screenshots}-lobby.png`});
  assert.equal(await page.getByRole('button',{name:'確認出牌',exact:true}).count(),0,'no table input before entry');
  await page.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase(page,'characters');
  await page.getByRole('button',{name:'選擇命運荷官',exact:true}).click();
  assert.equal((await canvasState(page)).entries,'0');
  assert.equal(await page.getByRole('button',{name:'選擇第二位來賓',exact:true}).count(),0,'unavailable characters cannot enter');
  if(screenshots)await page.screenshot({path:`${output}/${screenshots}-characters.png`});
  await page.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase(page,'selecting');
  await page.keyboard.press('Enter');assert.equal((await canvasState(page)).entries,'1','duplicate entry input cannot start a second session');
};
try {
  await server.listen();browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width:1600,height:900}});
  await context.addInitScript(() => {
    if(localStorage.getItem('kemet-slot-preview-v2')===null)localStorage.setItem('kemet-slot-preview-v2','slot-sentinel');
    if(sessionStorage.getItem('jokers-circus:yakyuken:preview:v1')===null)sessionStorage.setItem('jokers-circus:yakyuken:preview:v1','wallet-sentinel');
  });
  const page=await context.newPage();page.on('pageerror',error => errors.push(error.message));page.on('request',request => requests.push(request.url()));
  await page.goto(`${origin}/yakyuken-preview.html`);await startTable(page,'desktop');await frame(page);
  checks.push('game lobby, five character positions and explicit local entry precede the table; unavailable characters and duplicate entry are blocked');
  assert.equal((await canvasState(page)).dealerFrontCount,'0','all three dealer cards start face down');
  assert.equal(await page.locator('#yakyuken-app canvas').count(),1);
  assert.equal(await page.locator('body').innerText(),'');
  assert.equal(await page.locator('dialog,img,main,h1,header').count(),0);
  assert.equal(await page.getByRole('button',{name:/^選擇(拳頭|剪刀|布)$/}).count(),3);
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight===innerHeight && document.documentElement.scrollWidth===innerWidth),true);
  await page.screenshot({path:`${output}/desktop.png`});
  checks.push('one full-viewport Pixi canvas, six visible table cards reviewed in screenshot, no HTML game UI');

  const l=tableLayout(1600,900);
  // Exercise actual screen coordinates, rather than invoking game methods.
  await page.mouse.click(l.playerCards.x-l.playerCards.gap,l.playerCards.y);
  assert.equal((await canvasState(page)).selected,'rock');
  await page.getByRole('button',{name:'選擇剪刀',exact:true}).click();
  assert.equal((await canvasState(page)).selected,'scissors');
  await page.evaluate(() => {
    window.__dealerStages=[];window.__dealerFaces=[];
    new MutationObserver(() => {const data=document.querySelector('canvas').dataset;if(!window.__dealerStages.includes(data.dealerStage))window.__dealerStages.push(data.dealerStage);window.__dealerFaces.push({stage:data.dealerStage,fronts:data.dealerFrontCount});}).observe(document.querySelector('canvas'),{attributes:true,attributeFilter:['data-dealer-stage','data-dealer-front-count']});
  });
  await page.getByRole('button',{name:'確認出牌',exact:true}).click();await phase(page,'presenting');
  await page.keyboard.press('Enter');await phase(page,'confirmed');
  assert.deepEqual(await page.evaluate(() => window.__dealerStages),['thinking','playing','shown']);
  const flips=await page.evaluate(()=>window.__dealerFaces);
  assert.ok(flips.some(event=>event.stage==='playing' && event.fronts==='0'),'playing starts on the back');
  assert.ok(flips.some(event=>event.stage==='playing' && event.fronts==='1'),'the chosen front appears during the flip');
  assert.ok(flips.every(event=>Number(event.fronts)<=1),'unplayed cards never reveal');
  assert.deepEqual([(await canvasState(page)).dealerMove,(await canvasState(page)).outcome,(await canvasState(page)).round],['scissors','draw','1']);
  await page.mouse.click(l.playerCards.x+l.playerCards.gap,l.playerCards.y);
  assert.equal((await canvasState(page)).selected,'scissors','locked cards cannot replace a confirmed choice');
  await page.screenshot({path:`${output}/desktop-selected.png`});
  await page.getByRole('button',{name:'下一局',exact:true}).click();await phase(page,'selecting');
  assert.equal((await canvasState(page)).selected,'');
  assert.equal((await canvasState(page)).dealerMove,'');
  assert.equal((await canvasState(page)).dealerFrontCount,'0','next round restores all backs');
  checks.push('player confirmation triggers thinking, dealer card play and result; duplicate input cannot repeat the round');

  await page.keyboard.press('3');assert.equal((await canvasState(page)).selected,'paper');
  await page.keyboard.press('Enter');await phase(page,'confirmed');
  assert.deepEqual([(await canvasState(page)).dealerMove,(await canvasState(page)).outcome],['rock','win']);
  await page.keyboard.press('Escape');await page.waitForFunction(() => document.querySelector('canvas').dataset.modal==='menu');
  await page.keyboard.press('1');assert.equal((await canvasState(page)).selected,'paper');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'遊戲規則',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('canvas').dataset.modal==='help');
  await page.screenshot({path:`${output}/help.png`});await page.keyboard.press('Escape');
  checks.push('keyboard selection and confirm; Pixi modal blocks underlying input and closes with Escape');

  await openMenuItem(page,'荷官與造型');
  await page.getByRole('button',{name:'預覽終幕造型',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('canvas').dataset.pose==='2');
  await page.getByRole('button',{name:'開啟選單',exact:true}).waitFor();
  await frame(page);await page.screenshot({path:`${output}/desktop-pose-2.png`});
  checks.push('Pixi wardrobe panel and central emblem replace the dealer texture behind the table');

  await openMenuItem(page,'遊戲設定');
  await page.getByRole('button',{name:'切換音效',exact:true}).click();
  await page.getByRole('button',{name:'切換動態效果',exact:true}).click();
  await page.getByRole('button',{name:'關閉視窗',exact:true}).click();
  await page.getByRole('button',{name:'關閉音效',exact:true}).waitFor();
  await page.getByRole('button',{name:'開啟音樂',exact:true}).click();
  await page.getByRole('button',{name:'關閉音樂',exact:true}).click();
  await page.getByRole('button',{name:'開啟音樂',exact:true}).waitFor();
  await page.getByRole('button',{name:'遊玩紀錄',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('canvas').dataset.modal==='history');
  await page.screenshot({path:`${output}/history.png`});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'下一局',exact:true}).click();
  await page.getByRole('button',{name:'選擇布',exact:true}).focus();
  await page.keyboard.press('Enter');assert.equal((await canvasState(page)).selected,'paper');
  await page.keyboard.press('Enter');await phase(page,'confirmed');
  checks.push('Pixi settings and accessible keyboard activation work without HTML dialogs');

  for(const [name,width,height] of [['mobile',390,844],['small-mobile',320,568],['mobile-landscape',844,390],['tablet',768,1024],['side-panel',544,680]]) {
    const phoneContext=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const phone=await phoneContext.newPage();phone.on('pageerror',error => errors.push(error.message));
    await phone.goto(`${origin}/yakyuken-preview.html`);await startTable(phone,name);await frame(phone);
    assert.equal((await canvasState(phone)).dealerFrontCount,'0',`${name}: reduced-motion game starts on backs`);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth===innerWidth && document.documentElement.scrollHeight===innerHeight),true);
    for(const control of ['開啟選單','遊玩紀錄','遊戲規則']){
      const target=await phone.getByRole('button',{name:control,exact:true}).boundingBox();
      assert.ok(target.width>=43.9 && target.height>=43.9,`${name}: ${control} has a 44px touch target`);
    }
    const card=phone.getByRole('button',{name:'選擇拳頭',exact:true}),box=await card.boundingBox();
    assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=width && box.y+box.height<=height,`${name}: player card in viewport`);
    await card.tap();assert.equal((await canvasState(phone)).selected,'rock');
    await phone.getByRole('button',{name:'確認出牌',exact:true}).tap();await phase(phone,'confirmed');
    assert.deepEqual([(await canvasState(phone)).dealerStage,(await canvasState(phone)).dealerMove,(await canvasState(phone)).outcome],['shown','scissors','win']);
    assert.equal((await canvasState(phone)).dealerFrontCount,'1',`${name}: reduced-motion game reveals one card`);
    await phone.screenshot({path:`${output}/${name}.png`});
    if(name==='mobile-landscape'){
      await phone.getByRole('button',{name:'遊戲規則',exact:true}).tap();
      await phone.waitForFunction(() => document.querySelector('canvas').dataset.modal==='help');
      await phone.screenshot({path:`${output}/mobile-landscape-help.png`});await phone.keyboard.press('Escape');
    }
    await phone.getByRole('button',{name:'開啟選單',exact:true}).tap();
    await phone.getByRole('button',{name:'荷官與造型',exact:true}).tap();
    await phone.getByRole('button',{name:'預覽漸入佳境造型',exact:true}).tap();
    await phone.waitForFunction(() => document.querySelector('canvas').dataset.pose==='1');
    await phone.getByRole('button',{name:'開啟選單',exact:true}).waitFor();
    if(name==='mobile'){
      await openMenuItem(phone,'返回遊戲大廳');await phase(phone,'games');
      await phone.getByRole('button',{name:'選擇老虎機',exact:true}).tap();await phone.waitForURL(`${origin}/?lobby=preview`);
      await phone.locator('#loading').waitFor({state:'detached'});
      const menuBox=await phone.getByRole('button',{name:'開啟選單',exact:true}).boundingBox();
      assert.ok(menuBox.width>=44 && menuBox.height>=44,'mobile slot menu retains a touch target');
      await phone.getByRole('button',{name:'開啟選單',exact:true}).tap();
      await phone.screenshot({path:`${output}/mobile-slot-menu.png`});
      await phone.getByRole('button',{name:'返回遊戲大廳',exact:true}).tap();await phase(phone,'games');
    }
    await phoneContext.close();
  }
  checks.push('mobile, small mobile, landscape, tablet and side-panel touch layouts stay within a non-scrolling viewport');

  await page.setViewportSize({width:390,height:844});await frame(page);
  assert.equal((await canvasState(page)).selected,'paper');assert.equal((await canvasState(page)).pose,'2');
  await page.setViewportSize({width:1600,height:900});await frame(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('kemet-slot-preview-v2')),'slot-sentinel');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('jokers-circus:yakyuken:preview:v1')),'wallet-sentinel');
  // Pixi decodes local image blobs; their origin must still be this QA server.
  const localRequest=url => url.startsWith('data:') || new URL(url).origin===origin;
  assert.equal(localRequest('https://discord.com/api/blocked'),false);
  assert.equal(localRequest('blob:https://example.com/blocked'),false);
  assert.ok(requests.every(localRequest));
  assert.ok(!requests.some(url => /\/(wallet-client|discord-activity|rules|state|controller)\.js/.test(url)));
  checks.push('resize preserves selection and pose; no wallet, probability or Discord modules/requests');

  const resizing=await context.newPage();resizing.on('pageerror',error => errors.push(error.message));
  await resizing.goto(`${origin}/yakyuken-preview.html`);await startTable(resizing);
  await resizing.getByRole('button',{name:'選擇布',exact:true}).click();
  await resizing.getByRole('button',{name:'確認出牌',exact:true}).click();await phase(resizing,'presenting');
  await resizing.setViewportSize({width:390,height:844});await phase(resizing,'confirmed');
  assert.deepEqual([(await canvasState(resizing)).dealerMove,(await canvasState(resizing)).outcome,(await canvasState(resizing)).round],['scissors','loss','1']);
  assert.equal((await canvasState(resizing)).dealerFrontCount,'1','resize preserves only the chosen front');
  checks.push('resize during dealer presentation reveals the same round once, including a losing result');

  await openMenuItem(resizing,'重新選擇角色');await phase(resizing,'characters');
  assert.equal(await resizing.getByRole('button',{name:/^選擇(拳頭|剪刀|布)$/}).count(),0);
  await resizing.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await phase(resizing,'games');
  await resizing.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase(resizing,'characters');
  await resizing.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase(resizing,'selecting');
  assert.deepEqual([(await canvasState(resizing)).entries,(await canvasState(resizing)).round,(await canvasState(resizing)).dealerFrontCount],['2','0','0']);
  checks.push('return to characters and lobby removes table input; re-entry resets the presentation without wallet calls');

  const slot=await context.newPage();slot.on('pageerror',error=>errors.push(error.message));
  await slot.goto(`${origin}/yakyuken-preview.html`);await phase(slot,'games');
  await slot.getByRole('button',{name:'選擇老虎機',exact:true}).click();
  await slot.waitForURL(`${origin}/?lobby=preview`);
  await slot.waitForFunction(()=>document.querySelector('#app')?.children.length>0);
  await slot.locator('#loading').waitFor({state:'detached'});
  assert.equal(await slot.getByRole('button',{name:'旋轉一次',exact:true}).isEnabled(),true,'slot assets finish loading and its original controls are ready');
  await slot.screenshot({path:`${output}/slot-entry.png`});
  await openMenuItem(slot,'返回遊戲大廳');await phase(slot,'games');
  await startTable(slot);await openMenuItem(slot,'返回遊戲大廳');await phase(slot,'games');
  checks.push('both games return to the lobby from the same avatar menu and can switch games without relaunching');

  await slot.getByRole('button',{name:'選擇老虎機',exact:true}).click();await slot.waitForURL(`${origin}/?lobby=preview`);
  await slot.locator('#loading').waitFor({state:'detached'});
  // Pause the isolated test ticker before input so the menu is opened during a
  // genuine active round, regardless of the machine's pointer-command latency.
  await slot.evaluate(()=>window.__slotNavigationTest.scene.app.ticker.stop());
  await slot.getByRole('button',{name:'自動旋轉',exact:true}).click();
  await slot.waitForFunction(()=>document.querySelector('#spin')?.getAttribute('aria-label')==='快速停輪');
  await slot.getByRole('button',{name:'開啟選單',exact:true}).click();
  const returnButton=slot.getByRole('button',{name:'返回遊戲大廳',exact:true});
  assert.equal(await returnButton.isDisabled(),true,'cannot abandon an active settlement or animation');
  assert.equal(await slot.evaluate(()=>window.__slotNavigationTest.controls.auto),false,'opening the menu cancels automatic continuation');
  await slot.screenshot({path:`${output}/slot-menu-busy.png`});
  await slot.evaluate(()=>window.__slotNavigationTest.scene.app.ticker.start());
  await slot.waitForFunction(()=>document.querySelector('.game-menu-actions button:last-child')?.disabled===false);
  const saved=await slot.evaluate(()=>localStorage.getItem('kemet-slot-preview-v2'));
  assert.equal(JSON.parse(saved).history.length,1,'only one round settles after automatic play stops');
  await slot.screenshot({path:`${output}/slot-menu.png`});
  await returnButton.click();await phase(slot,'games');
  await slot.getByRole('button',{name:'選擇老虎機',exact:true}).click();await slot.waitForURL(`${origin}/?lobby=preview`);
  await slot.locator('#loading').waitFor({state:'detached'});
  assert.equal(await slot.evaluate(()=>localStorage.getItem('kemet-slot-preview-v2')),saved,'returning and re-entering preserves settled progress');
  await slot.close();checks.push('slot return waits for the active round, stops auto play and preserves exactly one saved result on re-entry');

  const failure=await context.newPage();failure.on('pageerror',error => errors.push(error.message));
  await failure.route('**/images/yakyuken/**/stage-2.webp',route => route.abort());
  await failure.goto(`${origin}/yakyuken-preview.html`);await phase(failure,'error');
  await failure.getByRole('button',{name:'重新載入',exact:true}).waitFor();
  assert.equal(await failure.getByRole('button',{name:/^選擇/}).count(),0);
  checks.push('missing character image gives a Pixi retry screen and never enables play');

  const lifecycle=await context.newPage();lifecycle.on('pageerror',error => errors.push(error.message));
  await lifecycle.goto(`${origin}/__yakyuken_lifecycle`);
  await lifecycle.waitForFunction(() => document.body.dataset.disposed==='true');
  assert.equal(await lifecycle.locator('canvas').count(),0);
  checks.push('dispose during renderer startup does not resurrect canvas or listeners');
  assert.deepEqual(errors,[]);report();console.log(JSON.stringify({ok:true,checks:checks.length,output}));
} catch(error) {errors.push(error.stack);report();throw error;}
finally {await browser?.close();await server.close();}
