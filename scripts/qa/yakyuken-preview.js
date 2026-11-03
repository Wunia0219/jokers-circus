import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'vite';
import {launchBrowser} from './helpers/browser.js';
import {ENTRY_TIMING} from '../../src/games/yakyuken/pixi/entry-state.js';
import {slotHeaderLayout} from '../../src/games/yakyuken/pixi/header-layout.js';
import {tableLayout,TABLE_MOVES} from '../../src/games/yakyuken/pixi/layout.js';
import {DIFFICULTIES} from '../../src/games/yakyuken/challenge.js';

const port=4196,origin=`http://127.0.0.1:${port}`,output='test-results/yakyuken-pixi';
mkdirSync(output,{recursive:true});
const server=await createServer({configFile:false,envDir:false,cacheDir:`${output}/vite-cache`,
  optimizeDeps:{include:['pixi.js','pixi.js/unsafe-eval','pixi.js/prepare'],noDiscovery:true},
  plugins:[{name:'isolated-pixi-lifecycle',configureServer(dev){dev.middlewares.use((request,response,next) => {
    if(request.url!=='/__yakyuken_lifecycle')return next();
    response.setHeader('Content-Type','text/html');response.end(`<div id="host"></div><script type="module">import {YakyukenScene} from '/src/games/yakyuken/scene.js';const scene=new YakyukenScene();const host=document.querySelector('#host');const init=scene.init(host);await scene.destroy();await init;document.body.dataset.disposed='true';</script>`);
  });},transform(code,id){
    const path=id.split('?')[0].replaceAll('\\','/');
    if(path.endsWith('/src/ui/audio/audio.js'))return {code:code.replace('this.music=musicUrl?','globalThis.__qaSound=this;this.music=musicUrl?'),map:null};
    if(path.endsWith('/src/games/yakyuken/scene.js')){
      assert.ok(code.includes('playChallengeRound(this.challenge,this.selected)'));
      // Deterministic entropy only in this isolated QA server. Exercise the real sampler.
      return {code:code.replace('this.host = host;','globalThis.__yakyukenTest=this;this.host = host;')
        .replace('playChallengeRound(this.challenge,this.selected)','playChallengeRound(this.challenge,this.selected,{getRandomValues:values=>{values[0]=globalThis.__duelWeights?.shift() ?? 0;}})'),map:null};
    }
    if(!path.endsWith('/src/main.js'))return;
    assert.ok(code.includes('startGame();'),'isolated slot ticker hook must match the real entry');
    return {code:code.replace('startGame();','globalThis.__slotNavigationTest={scene,controls};startGame();'),map:null};
  }}],
  server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:{ignored:['**/test-results/**','**/data/**','**/backups/**']}},
});
const checks=[],errors=[],requests=[],entryEvidence=[],entryReleases=[];
let browser;
const watchEntryBindings=context=>context.on('page',page=>page.on('console',message=>{if(message.type()==='warning' && message.text().includes('[BindGroup]'))errors.push(message.text());}));
const report=() => writeFileSync(`${output}/browser-report.json`,JSON.stringify({ok:checks.length===21 && errors.length===0,checks,errors,requests,entryEvidence},null,2));
const frame=page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const phase=(page,value) => page.waitForFunction(expected => document.querySelector('canvas')?.dataset.phase===expected,value);
const canvasState=page => page.locator('canvas').evaluate(canvas => ({...canvas.dataset}));
const tickEntry=async(page,elapsed)=>page.evaluate(async ms=>{
  const scene=window.__yakyukenTest;scene.entryOverlay.tick(ms);await Promise.resolve();scene.entryOverlay?.tick(0);scene.app.render();
},elapsed);
const openMenuItem=async(page,name)=>{
  await page.getByRole('button',{name:'遊戲規則',exact:true}).click();
  await page.getByRole('button',{name:'遊戲設定與造型',exact:true}).click();
  await page.getByRole('button',{name,exact:true}).click();
};
const assertHeader=async(page,screen)=>{
  const {width,height}=page.viewportSize(),header=tableLayout(width,height).ui.headerHeight;
  await frame(page);
  await page.mouse.click(width<=700?32:52,width<=700?32:40);
  assert.equal((await canvasState(page)).modal || '','','avatar has no action');
  assert.equal((await canvasState(page)).screen,screen,'avatar does not navigate');
  const back=page.getByRole('button',{name:'返回遊戲大廳',exact:true});
  assert.equal(await back.count(),screen==='games'?0:1,'only one lobby control outside the lobby');
  if(screen==='games'){
    assert.equal(await page.getByRole('button',{name:'遊戲規則',exact:true}).count(),0,'lobby has no game header');
  }else{
    assert.equal(await page.getByRole('button',{name:'週簽到・介面預覽',exact:true}).count(),1,'shared checkin UI placeholder is visible');
    const box=await back.boundingBox();
    assert.ok(box.y>=0 && box.y+box.height<=header,'lobby control is inside the top UI');
  }
};
const returnLobby=async page=>{
  await assertHeader(page,(await canvasState(page)).screen);
  await page.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await phase(page,'games');
};
const startTable=async(page,screenshots,difficulty)=>{
  await phase(page,'games');
  await assertHeader(page,'games');
  if(screenshots)await page.screenshot({path:`${output}/${screenshots}-lobby.png`});
  assert.equal(await page.getByRole('button',{name:'確認出牌',exact:true}).count(),0,'no table input before entry');
  await page.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase(page,'characters');
  await page.getByRole('button',{name:'選擇命運荷官',exact:true}).click();
  assert.equal((await canvasState(page)).entries,'0');
  assert.equal(await page.getByRole('button',{name:'選擇第二位來賓',exact:true}).count(),0,'unavailable characters cannot enter');
  await assertHeader(page,'characters');
  if(screenshots)await page.screenshot({path:`${output}/${screenshots}-characters.png`});
  if(difficulty){
    await page.getByRole('button',{name:'選擇難度',exact:true}).click();
    for(const rule of DIFFICULTIES){
      const box=await page.getByRole('button',{name:`難度${rule.name}`,exact:true}).boundingBox();
      assert.ok(box.width>=44 && box.height>=44 && box.x>=0 && box.x+box.width<=page.viewportSize().width,'difficulty has a visible touch target');
    }
    await page.getByRole('button',{name:`難度${DIFFICULTIES[difficulty-1].name}`,exact:true}).click();
    if(screenshots)await page.screenshot({path:`${output}/${screenshots}-difficulty.png`});
    await page.getByRole('button',{name:'使用此難度',exact:true}).click();
  }
  await page.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase(page,'selecting');
  await assertHeader(page,'table');
  assert.equal(await page.evaluate(()=>window.__qaSound.musicEnabled),true,'each game starts with music enabled');
  const checkin=page.getByRole('button',{name:'週簽到・介面預覽',exact:true});
  await checkin.click();assert.equal((await canvasState(page)).modal || '','','preview checkin has no action');
  const bounds=await checkin.boundingBox(),expected=slotHeaderLayout(...Object.values(page.viewportSize())).checkin;
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(bounds[key]-expected[key])<1,`checkin ${key} matches slot header`);
  await page.keyboard.press('Enter');assert.equal((await canvasState(page)).entries,'1','duplicate entry input cannot start a second session');
};
try {
  await server.listen();browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width:1600,height:900}});watchEntryBindings(context);
  await context.addInitScript(() => {
    if(localStorage.getItem('kemet-slot-preview-v2')===null)localStorage.setItem('kemet-slot-preview-v2','slot-sentinel');
    if(sessionStorage.getItem('jokers-circus:yakyuken:preview:v1')===null)sessionStorage.setItem('jokers-circus:yakyuken:preview:v1','wallet-sentinel');
  });
  const page=await context.newPage();page.on('pageerror',error => errors.push(error.message));page.on('request',request => requests.push(request.url()));
  await page.goto(`${origin}/yakyuken-preview.html`);await startTable(page,'desktop');await frame(page);
  await page.evaluate(()=>{window.__duelWeights=[8000,0,8000];});
  checks.push('game lobby, five character positions and explicit local entry precede the table; unavailable characters and duplicate entry are blocked');
  assert.equal((await canvasState(page)).dealerFrontCount,'0','all three dealer cards start face down');
  assert.equal(await page.locator('#yakyuken-app canvas').count(),1);
  assert.equal(await page.locator('body').innerText(),'');
  assert.equal(await page.locator('dialog,img,main,h1,header').count(),0);
  assert.equal(await page.getByRole('button',{name:/^選擇(拳頭|剪刀|布)$/}).count(),3);
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight===innerHeight && document.documentElement.scrollWidth===innerWidth),true);
  const help=page.getByRole('button',{name:'遊戲規則',exact:true});
  await help.hover();await page.mouse.move(800,200);await frame(page);
  assert.equal(await page.evaluate(()=>window.__yakyukenTest.hud.children.find(node=>node.accessibleTitle==='遊戲規則').outline.visible),false,'moving off a button clears its outline');
  await help.click();await page.getByRole('button',{name:'關閉視窗',exact:true}).click();await page.mouse.move(800,200);await frame(page);
  assert.equal(await page.evaluate(()=>window.__yakyukenTest.hud.children.find(node=>node.accessibleTitle==='遊戲規則').outline.visible),false,'pointer focus after click cannot leave a ring');
  await page.keyboard.press('Tab');await help.focus();
  assert.equal(await page.evaluate(()=>window.__yakyukenTest.hud.children.find(node=>node.accessibleTitle==='遊戲規則').outline.visible),true,'keyboard focus remains visible');
  await page.mouse.click(800,200);await frame(page);
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
  await page.waitForFunction(()=>!window.__yakyukenTest.changing);
  await frame(page);await page.screenshot({path:`${output}/desktop-pose-2.png`});
  checks.push('Pixi wardrobe panel and central emblem replace the dealer texture behind the table');

  await openMenuItem(page,'遊戲設定');
  assert.equal(await page.getByRole('button',{name:'切換音效',exact:true}).count(),0,'no duel SFX control');
  await page.getByRole('button',{name:'切換動態效果',exact:true}).click();
  await page.getByRole('button',{name:'關閉視窗',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__qaSound.context),null,'duel does not initialize effects');
  await page.getByRole('button',{name:'關閉音樂',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__qaSound.musicEnabled),false,'first click turns default music off');
  await page.getByRole('button',{name:'開啟音樂',exact:true}).click();
  await page.getByRole('button',{name:'關閉音樂',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'遊玩紀錄',exact:true}).count(),0,'history is not implemented');
  assert.equal(await page.evaluate(()=>Object.hasOwn(window.__yakyukenTest,'history')),false,'no per-hand history accumulates');
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
    for(const control of ['返回遊戲大廳','遊戲規則']){
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
    await phone.getByRole('button',{name:'遊戲規則',exact:true}).tap();
    await phone.getByRole('button',{name:'遊戲設定與造型',exact:true}).tap();
    await phone.getByRole('button',{name:'荷官與造型',exact:true}).tap();
    await phone.getByRole('button',{name:'預覽漸入佳境造型',exact:true}).tap();
    await phone.waitForFunction(() => document.querySelector('canvas').dataset.pose==='1');
    await phone.waitForFunction(()=>!window.__yakyukenTest.changing);
    if(name==='mobile'){
      await returnLobby(phone);
      await phone.getByRole('button',{name:'選擇老虎機',exact:true}).tap();await phone.waitForURL(`${origin}/?lobby=preview`);
      await phone.locator('#loading').waitFor({state:'detached'});
      const menuBox=await phone.getByRole('button',{name:'返回遊戲大廳',exact:true}).boundingBox();
      assert.ok(menuBox.width>=44 && menuBox.height>=44,'mobile slot lobby button retains a touch target');
      await phone.locator('.player-avatar').click();
      assert.equal(await phone.locator('#dialog').evaluate(node=>node.open),false);
      assert.equal(await phone.locator('#player-header #return-lobby').count(),1);
      await phone.screenshot({path:`${output}/mobile-slot-header.png`});
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
  assert.ok(!requests.some(url => /\/(wallet-client|discord-activity|state|controller|demo-duel)\.js/.test(url)));
  assert.ok(requests.some(url=>url.includes('/yakyuken/challenge.js')));
  checks.push('resize preserves selection and pose; probability engine loads without wallet, legacy controller or Discord');

  for(const rule of DIFFICULTIES){
    const viewports=[[320,568],[390,844],[844,390],[768,1024],[1600,900]], [width,height]=viewports[rule.id-1];
    const challengeContext=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const challengePage=await challengeContext.newPage();challengePage.on('pageerror',error=>errors.push(error.message));
    await challengePage.goto(`${origin}/yakyuken-preview.html`);await startTable(challengePage,`difficulty-${rule.id}`,rule.id);
    const play=async outcome=>{
      await challengePage.evaluate(value=>{window.__duelWeights=[value];},{win:0,loss:4000,draw:8000}[outcome]);
      await challengePage.getByRole('button',{name:'選擇拳頭',exact:true}).click();
      await challengePage.getByRole('button',{name:'確認出牌',exact:true}).click();await phase(challengePage,'confirmed');
      assert.equal((await canvasState(challengePage)).outcome,outcome);
    };
    await play('draw');assert.equal((await canvasState(challengePage)).draws,'1');
    assert.equal((await canvasState(challengePage)).wins,'0');assert.equal((await canvasState(challengePage)).losses,'0');
    await challengePage.getByRole('button',{name:'下一局',exact:true}).click();
    await play('loss');await challengePage.getByRole('button',{name:'下一局',exact:true}).click();
    for(let wins=1;wins<=rule.winsRequired;wins++){
      await play('win');
      const state=await canvasState(challengePage);assert.equal(state.wins,String(wins));assert.equal(state.losses,'1');
      assert.equal(state.challengeStatus,wins===rule.winsRequired?'won':'playing');
      if(wins<rule.winsRequired)await challengePage.getByRole('button',{name:'下一局',exact:true}).click();
    }
    assert.equal((await canvasState(challengePage)).reward,String(rule.reward));
    assert.equal(await challengePage.getByRole('button',{name:'下一局',exact:true}).count(),0);
    await challengePage.screenshot({path:`${output}/difficulty-${rule.id}-won.png`});
    await challengePage.getByRole('button',{name:'再挑戰一次',exact:true}).click();
    assert.deepEqual([(await canvasState(challengePage)).wins,(await canvasState(challengePage)).losses,(await canvasState(challengePage)).round],['0','0','0']);
    for(let losses=1;losses<=rule.lossLimit;losses++){
      await play('loss');assert.equal((await canvasState(challengePage)).challengeStatus,losses===rule.lossLimit?'lost':'playing');
      if(losses<rule.lossLimit)await challengePage.getByRole('button',{name:'下一局',exact:true}).click();
    }
    assert.equal((await canvasState(challengePage)).reward,'0');
    await challengePage.screenshot({path:`${output}/difficulty-${rule.id}-lost.png`});
    assert.equal(await challengePage.evaluate(()=>Object.hasOwn(window.__yakyukenTest,'history')),false);
    await challengeContext.close();
  }
  checks.push('all five difficulty selectors, draws, cumulative wins, exact win/loss endings, rewards and fresh retry work across screen sizes without game history');

  const resizing=await context.newPage();resizing.on('pageerror',error => errors.push(error.message));
  await resizing.goto(`${origin}/yakyuken-preview.html`);await startTable(resizing);
  await resizing.evaluate(()=>{window.__duelWeights=[4000];});
  await resizing.getByRole('button',{name:'選擇布',exact:true}).click();
  await resizing.getByRole('button',{name:'確認出牌',exact:true}).click();await phase(resizing,'presenting');
  await resizing.setViewportSize({width:390,height:844});await phase(resizing,'confirmed');
  assert.deepEqual([(await canvasState(resizing)).dealerMove,(await canvasState(resizing)).outcome,(await canvasState(resizing)).round],['scissors','loss','1']);
  assert.equal((await canvasState(resizing)).dealerFrontCount,'1','resize preserves only the chosen front');
  checks.push('resize during dealer presentation reveals the same round once, including a losing result');

  await resizing.keyboard.press('Escape');
  await resizing.getByRole('button',{name:'繼續遊戲',exact:true}).waitFor();
  assert.equal(await resizing.getByRole('button',{name:/重新選|返回.*大廳/}).count(),0,'menu contains no character reselect or lobby navigation');
  await resizing.keyboard.press('Escape');assert.equal((await canvasState(resizing)).screen,'table');
  await returnLobby(resizing);
  assert.equal(await resizing.getByRole('button',{name:/^選擇(拳頭|剪刀|布)$/}).count(),0);
  await resizing.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase(resizing,'characters');
  await resizing.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase(resizing,'selecting');
  assert.deepEqual([(await canvasState(resizing)).entries,(await canvasState(resizing)).round,(await canvasState(resizing)).dealerFrontCount],['2','0','0']);
  checks.push('return only through the header removes table input; re-entry resets the presentation without wallet calls');

  const slot=await context.newPage();slot.on('pageerror',error=>errors.push(error.message));
  await slot.goto(`${origin}/yakyuken-preview.html`);await phase(slot,'games');
  await slot.getByRole('button',{name:'選擇老虎機',exact:true}).click();
  await slot.waitForURL(`${origin}/?lobby=preview`);
  await slot.locator('#loading-logo, .loading-logo').waitFor();
  assert.equal(await slot.locator('#loading-track').getAttribute('role'),'progressbar','slot entry retains its own logo and meter');
  await slot.waitForFunction(()=>document.querySelector('#app')?.children.length>0);
  await slot.locator('#loading').waitFor({state:'detached'});
  assert.equal(await slot.getByRole('button',{name:'旋轉一次',exact:true}).isEnabled(),true,'slot assets finish loading and its original controls are ready');
  assert.equal(await slot.locator('#daily-checkin').isVisible(),true);
  assert.equal(await slot.locator('#daily-checkin').isDisabled(),true,'checkin is UI-only');
  const slotCheckin=await slot.locator('#daily-checkin').boundingBox(),expected=slotHeaderLayout(1600,900).checkin;
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(slotCheckin[key]-expected[key])<1,`slot checkin ${key} matches shared geometry`);
  assert.equal(await slot.evaluate(()=>window.__qaSound.musicEnabled),true);
  await slot.screenshot({path:`${output}/slot-entry.png`});
  await slot.evaluate(()=>{
    const animate=Element.prototype.animate;
    Element.prototype.animate=function(...args){const animation=animate.apply(this,args);if(this.classList.contains('lobby-exit-cover')){animation.pause();animation.currentTime=170;window.__exitAnimation=animation;}return animation;};
  });
  await slot.addInitScript(()=>{
    if(new URLSearchParams(location.search).get('transition')!=='fade' || sessionStorage.getItem('__qaArrivalPaused'))return;
    sessionStorage.setItem('__qaArrivalPaused','true');
    const observer=new MutationObserver(()=>{const scene=window.__yakyukenTest;if(scene?.initialized && scene.app.canvas?.dataset.entryKind==='arrival'){scene.app.stop();observer.disconnect();}});
    observer.observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['data-entry-kind']});
  });
  await slot.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();
  const slotFade=await slot.locator('.lobby-exit-cover').evaluate(node=>({alpha:Number(getComputedStyle(node).opacity),children:node.children.length,inert:document.querySelector('#app').inert}));
  assert.ok(slotFade.alpha>0 && slotFade.alpha<1 && slotFade.inert);assert.equal(slotFade.children,0);assert.equal(await slot.locator('#loading').count(),0);
  await slot.screenshot({path:`${output}/slot-return-fade-out.png`});
  await slot.evaluate(()=>window.__exitAnimation.finish());
  await slot.waitForURL(`${origin}/yakyuken-preview.html?transition=fade`);
  await slot.waitForFunction(()=>document.querySelector('canvas')?.dataset.entryStage==='revealing');
  assert.equal(await slot.getByRole('progressbar').count(),0);assert.equal(await slot.locator('body').innerText(),'');
  await tickEntry(slot,ENTRY_TIMING.reveal/2);
  assert.ok(await slot.evaluate(()=>{const alpha=window.__yakyukenTest.entryOverlay.cover.value;return alpha>0 && alpha<1;}));
  await slot.screenshot({path:`${output}/slot-return-fade-in.png`});
  await slot.evaluate(()=>window.__yakyukenTest.app.start());await phase(slot,'games');
  checks.push('slot entry keeps its logo and loader; return fades out and the lobby fades in without loading UI');
  await startTable(slot);await slot.getByRole('button',{name:'返回遊戲大廳',exact:true}).click();await phase(slot,'games');
  checks.push('both games return to the lobby only from the top UI and can switch games without relaunching');

  await slot.getByRole('button',{name:'選擇老虎機',exact:true}).click();await slot.waitForURL(`${origin}/?lobby=preview`);
  await slot.locator('#loading').waitFor({state:'detached'});
  // Pause the isolated test ticker before input so navigation is checked during a
  // genuine active round, regardless of the machine's pointer-command latency.
  await slot.evaluate(()=>window.__slotNavigationTest.scene.app.ticker.stop());
  await slot.getByRole('button',{name:'自動旋轉',exact:true}).click();
  await slot.waitForFunction(()=>document.querySelector('#spin')?.getAttribute('aria-label')==='快速停輪');
  await slot.locator('.player-avatar').click();
  assert.equal(await slot.locator('#dialog').evaluate(node=>node.open),false,'slot avatar has no action');
  assert.equal(await slot.locator('#player-header #return-lobby').count(),1,'slot return exists only in the header');
  await slot.getByRole('button',{name:'停止自動旋轉',exact:true}).click();
  const returnButton=slot.getByRole('button',{name:'返回遊戲大廳',exact:true});
  assert.equal(await returnButton.isDisabled(),true,'cannot abandon an active settlement or animation');
  assert.equal(await slot.evaluate(()=>window.__slotNavigationTest.controls.auto),false,'stop auto cancels automatic continuation before leaving');
  await slot.screenshot({path:`${output}/slot-header-busy.png`});
  await slot.evaluate(()=>window.__slotNavigationTest.scene.app.ticker.start());
  await slot.waitForFunction(()=>document.querySelector('#return-lobby')?.disabled===false);
  const saved=await slot.evaluate(()=>localStorage.getItem('kemet-slot-preview-v2'));
  assert.equal(JSON.parse(saved).history.length,1,'only one round settles after automatic play stops');
  await slot.screenshot({path:`${output}/slot-header.png`});
  await returnButton.click();await phase(slot,'games');
  await slot.getByRole('button',{name:'選擇老虎機',exact:true}).click();await slot.waitForURL(`${origin}/?lobby=preview`);
  await slot.locator('#loading').waitFor({state:'detached'});
  assert.equal(await slot.evaluate(()=>localStorage.getItem('kemet-slot-preview-v2')),saved,'returning and re-entering preserves settled progress');
  await slot.close();checks.push('slot return waits for the active round, stops auto play and preserves exactly one saved result on re-entry');

  // Hold a real entry asset so phase assertions remain valid on slow machines.
  const entry=await context.newPage();entry.on('pageerror',error=>errors.push(error.message));
  let releaseEntry;const entryGate=new Promise(resolve=>{releaseEntry=resolve;entryReleases.push(resolve);});
  await entry.route('**/images/yakyuken/**/stage-1.webp',async route=>{await entryGate;await route.continue();});
  await entry.goto(`${origin}/yakyuken-preview.html`);await phase(entry,'games');
  await entry.evaluate(()=>{
    window.__entryStages=[];
    new MutationObserver(()=>{const stage=document.querySelector('canvas')?.dataset.entryStage;if(stage && !window.__entryStages.includes(stage))window.__entryStages.push(stage);}).observe(document.querySelector('canvas'),{attributes:true,attributeFilter:['data-entry-stage']});
    window.__yakyukenTest.app.stop();
  });
  await entry.getByRole('button',{name:'選擇野球拳',exact:true}).click();await phase(entry,'entering');
  await tickEntry(entry,ENTRY_TIMING.cover/2);
  const covering=await entry.evaluate(()=>({cover:window.__yakyukenTest.entryOverlay.cover.value,content:window.__yakyukenTest.entryOverlay.contentFade.value}));
  assert.ok(covering.cover>0 && covering.cover<1,'lobby visibly fades out');assert.equal(covering.content,0,'fade-out does not show a loading meter');
  assert.equal(await entry.evaluate(()=>{const scene=window.__yakyukenTest;return scene.app.renderer.graphicsContext.getGpuContext(scene.entryOverlay.backdrop.context).isBatchable;}),true,'loader background does not retain a standalone graphics bind group');
  assert.equal(await entry.getByRole('progressbar').count(),0);
  await entry.screenshot({path:`${output}/entry-fade-out.png`});
  await entry.evaluate(()=>window.__yakyukenTest.app.start());
  await entry.getByRole('progressbar',{name:'野球拳載入進度',exact:true}).waitFor();
  assert.ok(Number((await canvasState(entry)).entryProgress)<100,'a held asset cannot report ready');
  assert.equal((await canvasState(entry)).entries,'0');
  await entry.keyboard.press('Enter');await entry.keyboard.press('Escape');
  assert.equal((await canvasState(entry)).entries,'0','entry keyboard input cannot enter twice or dismiss preparation');
  assert.equal(await entry.getByRole('button',{name:'返回遊戲大廳',exact:true}).count(),0,'entry blocks background navigation');
  await entry.screenshot({path:`${output}/entry-loading-desktop.png`});
  await entry.setViewportSize({width:390,height:844});
  await entry.getByRole('progressbar',{name:'野球拳載入進度',exact:true}).waitFor();await frame(entry);
  const meter=await entry.getByRole('progressbar').boundingBox();assert.ok(meter.x>=0 && meter.x+meter.width<=390 && meter.y+meter.height<=844);
  await entry.screenshot({path:`${output}/entry-loading-mobile.png`});
  await entry.evaluate(()=>window.__yakyukenTest.app.stop());releaseEntry();
  await entry.waitForFunction(()=>document.querySelector('canvas').dataset.entryStage==='settling');
  await tickEntry(entry,ENTRY_TIMING.minimum+ENTRY_TIMING.fill);
  await entry.waitForFunction(()=>document.querySelector('canvas').dataset.entryStage==='clearing');
  await tickEntry(entry,ENTRY_TIMING.clear);
  await entry.waitForFunction(()=>document.querySelector('canvas').dataset.entryStage==='revealing');
  await tickEntry(entry,ENTRY_TIMING.reveal/2);
  const revealing=await entry.evaluate(()=>({cover:window.__yakyukenTest.entryOverlay.cover.value,content:window.__yakyukenTest.entryOverlay.contentFade.value,world:window.__yakyukenTest.world.alpha,zoom:window.__yakyukenTest.world.scale.x}));
  assert.ok(revealing.cover>0 && revealing.cover<1,'selection fades in after preparation');assert.equal(revealing.world,1);assert.equal(revealing.zoom,1);
  assert.equal(revealing.content,0);assert.equal(await entry.getByRole('progressbar').count(),0,'reveal contains no loading UI');
  await entry.screenshot({path:`${output}/entry-fade-in.png`});
  await entry.setViewportSize({width:1600,height:900});await frame(entry);
  await tickEntry(entry,ENTRY_TIMING.reveal/2);await entry.evaluate(()=>window.__yakyukenTest.app.start());await phase(entry,'characters');
  assert.equal((await canvasState(entry)).entries,'0');
  const entryStages=await entry.evaluate(()=>window.__entryStages);
  for(const stage of ['covering','loading','settling','clearing','revealing','complete'])assert.ok(entryStages.includes(stage),stage);
  entryEvidence.push({covering,revealing,stages:entryStages});
  checks.push('lobby-to-Yakyuken shows its independent logo and real preparation meter before character selection');

  // Both in-game routes are plain fades; inspect their actual middle frames.
  for(const kind of ['table','lobby']){
    const trigger=entry.getByRole('button',{name:kind==='table'?'進入野球拳試玩':'返回遊戲大廳',exact:true});
    await trigger.waitFor();
    await entry.evaluate(()=>window.__yakyukenTest.app.stop());
    await trigger.click();await phase(entry,'entering');
    await tickEntry(entry,ENTRY_TIMING.cover/2);
    assert.equal((await canvasState(entry)).entryKind,kind);assert.equal(await entry.getByRole('progressbar').count(),0);
    assert.ok(await entry.evaluate(()=>{const overlay=window.__yakyukenTest.entryOverlay;return overlay.cover.value>0 && overlay.cover.value<1 && overlay.root.children.length===1 && !overlay.content;}),'fade-out contains only its plain cover');
    await entry.keyboard.press('Enter');await entry.keyboard.press('Escape');
    await entry.screenshot({path:`${output}/${kind}-fade-out.png`});
    await tickEntry(entry,ENTRY_TIMING.cover/2);
    await entry.waitForFunction(()=>document.querySelector('canvas')?.dataset.entryStage==='revealing');
    await tickEntry(entry,ENTRY_TIMING.reveal/2);
    assert.equal(await entry.getByRole('progressbar').count(),0);
    const fade=await entry.evaluate(()=>{const scene=window.__yakyukenTest;return {alpha:scene.entryOverlay.cover.value,zoom:scene.world.scale.x,cards:scene.playerCards.map(card=>({y:card.y,baseY:card.baseY,alpha:card.alpha}))};});
    assert.ok(fade.alpha>0 && fade.alpha<1);assert.equal(fade.zoom,1);
    for(const card of fade.cards){assert.equal(card.y,card.baseY);assert.equal(card.alpha,1);}
    await entry.screenshot({path:`${output}/${kind}-fade-in.png`});
    await entry.setViewportSize({width:390,height:844});await frame(entry);
    assert.ok(await entry.evaluate(()=>{const value=window.__yakyukenTest.entryOverlay.cover.value;return value>0 && value<1;}),'resizing preserves fade progress');
    await tickEntry(entry,ENTRY_TIMING.reveal/2);await entry.evaluate(()=>window.__yakyukenTest.app.start());await phase(entry,kind==='table'?'selecting':'games');
    assert.equal((await canvasState(entry)).entries,'1');
  }
  checks.push('Yakyuken selection-to-table and table-to-lobby use only fade-out/fade-in, with no logo, meter, zoom or card choreography');
  await entry.close();

  const recoveryContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  watchEntryBindings(recoveryContext);const recovery=await recoveryContext.newPage();recovery.on('pageerror',error=>errors.push(error.message));let denyEntry=true;
  await recovery.route('**/images/yakyuken/**/stage-2.webp',route=>denyEntry?route.abort():route.continue());
  await recovery.goto(`${origin}/yakyuken-preview.html`);await phase(recovery,'games');
  await recovery.getByRole('button',{name:'選擇野球拳',exact:true}).click();
  await recovery.getByRole('button',{name:'取消野球拳載入',exact:true}).waitFor();
  assert.equal((await canvasState(recovery)).entries,'0');assert.equal(await recovery.getByRole('button',{name:/^選擇(拳頭|剪刀|布)$/}).count(),0);
  await recovery.screenshot({path:`${output}/entry-error.png`});
  await recovery.evaluate(()=>{window.__firstEntryGradients=window.__yakyukenTest.entryGradients;});
  await recovery.getByRole('button',{name:'取消野球拳載入',exact:true}).click();await phase(recovery,'games');
  await assertHeader(recovery,'games');
  await recovery.getByRole('button',{name:'選擇野球拳',exact:true}).click();
  await recovery.getByRole('button',{name:'重試進入野球拳',exact:true}).waitFor();denyEntry=false;
  await recovery.getByRole('button',{name:'重試進入野球拳',exact:true}).click();await phase(recovery,'characters');
  assert.equal((await canvasState(recovery)).entries,'0');
  await recovery.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase(recovery,'selecting');
  assert.equal((await canvasState(recovery)).entries,'1','only successful preparation enters a session');
  assert.equal(await recovery.evaluate(()=>window.__yakyukenTest.entryGradients===window.__firstEntryGradients),true,'retry reuses the renderer-owned loading textures');
  await recoveryContext.close();checks.push('failed lobby-to-Yakyuken preparation offers retry or cancellation without partial entry or duplicate sessions');

  const reducedContext=await browser.newContext({viewport:{width:320,height:568},reducedMotion:'reduce'});
  watchEntryBindings(reducedContext);const reduced=await reducedContext.newPage();reduced.on('pageerror',error=>errors.push(error.message));let releaseReduced;
  const reducedGate=new Promise(resolve=>{releaseReduced=resolve;entryReleases.push(resolve);});
  await reduced.route('**/images/yakyuken/**/stage-2.webp',async route=>{await reducedGate;await route.continue();});
  await reduced.goto(`${origin}/yakyuken-preview.html`);await phase(reduced,'games');
  await reduced.getByRole('button',{name:'選擇野球拳',exact:true}).click();
  await reduced.getByRole('progressbar',{name:'野球拳載入進度',exact:true}).waitFor();
  assert.equal(await reduced.evaluate(()=>window.__yakyukenTest.entryOverlay.cover.value),1);
  assert.equal(await reduced.evaluate(()=>window.__yakyukenTest.entryOverlay.motion.tasks.size),0,'reduced motion does not keep fade or shimmer tasks');
  assert.ok(Number((await canvasState(reduced)).entryProgress)<100);await reduced.screenshot({path:`${output}/entry-reduced-motion.png`});
  releaseReduced();await phase(reduced,'characters');assert.equal((await canvasState(reduced)).entries,'0');
  await reduced.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase(reduced,'selecting');assert.equal((await canvasState(reduced)).entries,'1');
  assert.equal(await reduced.getByRole('progressbar').count(),0);
  await reducedContext.close();checks.push('reduced-motion entry still waits for real assets, while decorative transition motion is skipped');

  const disposed=await context.newPage();disposed.on('pageerror',error=>errors.push(error.message));let releaseDisposed;
  const disposedGate=new Promise(resolve=>{releaseDisposed=resolve;entryReleases.push(resolve);});
  await disposed.route('**/images/yakyuken/**/stage-2.webp',async route=>{await disposedGate;await route.continue();});
  await disposed.goto(`${origin}/yakyuken-preview.html`);await phase(disposed,'games');
  await disposed.evaluate(()=>{const scene=window.__yakyukenTest,prepare=scene.prepareEntry.bind(scene);scene.prepareEntry=(...args)=>(window.__entryAssets=prepare(...args));});
  await disposed.getByRole('button',{name:'選擇野球拳',exact:true}).click();
  await disposed.getByRole('progressbar',{name:'野球拳載入進度',exact:true}).waitFor();
  await disposed.evaluate(async()=>{const scene=window.__yakyukenTest,pending=scene.entryPromise;await scene.destroy();await pending;});
  releaseDisposed();await disposed.evaluate(()=>window.__entryAssets);
  assert.equal(await disposed.locator('canvas').count(),0);assert.equal(await disposed.getByRole('progressbar').count(),0);
  assert.equal(await disposed.evaluate(()=>window.__yakyukenTest.loaded.size),0);
  assert.equal(await disposed.evaluate(()=>window.__yakyukenTest.entryGradients),null);
  await disposed.close();checks.push('disposing during entry cancels pending presentation and unloads late assets without resurrecting the renderer');

  const failure=await context.newPage();failure.on('pageerror',error => errors.push(error.message));
  await failure.route('**/images/yakyuken/**/stage-0.webp',route => route.abort());
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
finally {for(const release of entryReleases)release();await browser?.close();await server.close();}
