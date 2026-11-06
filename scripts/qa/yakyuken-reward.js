import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launchBrowser} from './helpers/browser.js';
import {PLAYTEST_FS_DENY} from '../game/yakyuken-test-gateway.js';
import {PlaytestService} from '../../cloud/yakyuken-playtest-core.js';
import {WARDROBE_DURATION} from '../../src/games/yakyuken/duel-presentation.js';
import {REWARD_SHOWCASE_MS,REWARD_COUNT_MS,REWARD_FADE_MS} from '../../src/games/yakyuken/reward-presentation.js';

const output='test-results/yakyuken-reward',origin='http://127.0.0.1:4204',values=new Map(),calls=[],errors=[],checks=[];
mkdirSync(output,{recursive:true});let ledger,outcome=0;
const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),transaction:async fn=>fn(storage)};
const repository={read:async()=>structuredClone(ledger),mutate:async(_,fn)=>{ledger=structuredClone(fn(structuredClone(ledger)));return structuredClone(ledger);}};
const service=new PlaytestService({player:'qa-a',storage,repository,entropy:{getRandomValues:v=>{v[0]=outcome;}}});
const server=await createServer({configFile:false,envDir:false,cacheDir:output+'/vite-cache',
  define:{'import.meta.env.VITE_YAKYUKEN_CLOUD_TEST':JSON.stringify('true')},
  optimizeDeps:{include:['pixi.js','pixi.js/unsafe-eval','pixi.js/prepare'],noDiscovery:true},
  plugins:[{name:'isolated-reward',transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/games/yakyuken/scene.js'))return {code:code.replace('this.host = host;','globalThis.__rewardScene=this;this.host = host;'),map:null};},configureServer(dev){dev.middlewares.use(async(req,res,next)=>{
    const path=new URL(req.url,origin).pathname;if(!path.startsWith('/api/playtest/'))return next();
    try{let text='';for await(const chunk of req)text+=chunk;const action=path.split('/').at(-1);if(req.method==='POST')calls.push(action);
      const result=action==='state'?await service.stateView():await service.execute(action,JSON.parse(text));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
    }catch(error){res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
  });}}],server:{host:'127.0.0.1',port:4204,strictPort:true,hmr:false,fs:{deny:PLAYTEST_FS_DENY},watch:{ignored:['**/test-results/**']}}});
let browser;
try{
  await server.listen();browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1255,height:700},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  const phase=value=>page.waitForFunction(value=>{const s=window.__rewardScene;return s?.phase===value&&!s.changing&&!s.rewardPresentation.busy;},value);
  const snapshot=()=>page.evaluate(()=>{const s=window.__rewardScene,r=s.rewardPresentation,p=s.rewardNumber,b=p.getBounds();return {stage:r.stage,elapsed:r.elapsed,busy:r.busy,pose:s.pose,balance:s.balanceNumber.text,payout:p.text,visible:p.visible,mode:s.rewardLayout.mode,alpha:p.alpha,x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height,enabled:s.confirmButton?.enabled,world:s.world.interactiveChildren};});
  const tick=ms=>page.evaluate(ms=>{const s=window.__rewardScene;s.tickReward(ms);s.app.render();},ms);
  const play=async()=>{await page.getByRole('button',{name:'選擇拳頭',exact:true}).click();await page.getByRole('button',{name:'確認出牌',exact:true}).click();};
  await page.goto(origin+'/yakyuken-preview.html');await page.getByRole('button',{name:'選擇野球拳',exact:true}).click();await page.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase('selecting');
  await page.waitForFunction(()=>window.__rewardScene.audio.background.enabled);
  await page.evaluate(()=>{window.__rewardSounds=[];const s=window.__rewardScene,sound=s.audio.background,play=sound.playVoices.bind(sound);sound.playVoices=voices=>{if(sound.enabled&&!sound.suspended)window.__rewardSounds.push({stage:s.rewardPresentation.stage,elapsed:s.rewardPresentation.elapsed,amount:s.rewardPresentation.frame(s.wallet.wallet.balance).amount,voices:voices.length});play(voices);};});
  await play();await phase('confirmed');await page.getByRole('button',{name:'下一局',exact:true}).click();await phase('selecting');
  await page.emulateMedia({reducedMotion:'no-preference'});await play();
  await page.waitForFunction(()=>{const s=window.__rewardScene;if(!s?.wardrobe||s.rewardPresentation.stage!=='holding')return false;s.app.stop();return true;});
  assert.equal(ledger.balance,11500);assert.equal((await snapshot()).balance,'9,000');assert.equal((await snapshot()).visible,false);
  assert.equal(await page.evaluate(()=>window.__rewardSounds.length),0,'no coin sound during the outfit reveal');
  await page.evaluate(()=>{const s=window.__rewardScene;s.wardrobe.tick(900);s.app.render();});
  assert.equal((await snapshot()).pose,2);assert.equal((await snapshot()).balance,'9,000');
  await page.screenshot({path:output+'/outfit-before-credit.png'});
  await page.setViewportSize({width:1255,height:550});await page.waitForFunction(()=>window.__rewardScene.layout.ui.height===550);
  assert.equal((await snapshot()).stage,'holding');assert.equal((await snapshot()).balance,'9,000');
  await page.evaluate(ms=>window.__rewardScene.wardrobe.tick(ms),WARDROBE_DURATION);
  await page.waitForFunction(()=>!!window.__rewardScene.rewardReveal&&!window.__rewardScene.changing);
  assert.equal((await snapshot()).stage,'holding','a completed promise is not yet a rendered outfit frame');
  await page.evaluate(()=>window.__rewardScene.app.ticker.update(performance.now()));
  assert.equal((await snapshot()).stage,'showcase');
  await tick(REWARD_SHOWCASE_MS-1);assert.equal((await snapshot()).balance,'9,000');assert.equal((await snapshot()).visible,false);
  const settledCalls=calls.length;
  await page.evaluate(()=>{const s=window.__rewardScene;void s.confirm();s.visitScreen('games');void s.claimDaily();});assert.equal(calls.length,settledCalls);
  await tick(1);assert.equal((await snapshot()).payout,'+0');await tick(400);
  const mid=await snapshot(),earned=Number(mid.payout.replace(/[^\d]/g,''));assert.ok(earned>0&&earned<2500);assert.equal(Number(mid.balance.replaceAll(',','')),9000+earned);
  const soundEvents=await page.evaluate(()=>window.__rewardSounds);assert.ok(soundEvents.length>=2);assert.ok(soundEvents.every(e=>e.stage==='counting'));assert.equal(soundEvents.at(-1).amount,earned);
  await page.getByRole('button',{name:'關閉音效',exact:true}).click();assert.equal(await page.evaluate(()=>window.__rewardScene.audio.background.voices.size),0);
  assert.equal(await page.evaluate(()=>window.__rewardScene.audio.background.musicEnabled),true,'muting effects keeps music enabled');
  await page.getByRole('button',{name:'開啟音效',exact:true}).click();await tick(0);assert.equal(await page.evaluate(()=>window.__rewardSounds.length),soundEvents.length,'unmuting does not replay earlier count beats');
  await page.screenshot({path:output+'/counting-desktop.png'});
  for(const [width,height] of [[390,844],[320,568],[844,390]]){
    await page.setViewportSize({width,height});await page.waitForFunction(w=>window.__rewardScene.layout.ui.width===w,width);
    const state=await snapshot();assert.equal(state.elapsed,400);assert.equal(state.pose,2);assert.equal(state.balance,mid.balance);assert.ok(state.x>=0&&state.y>=0&&state.right<=width&&state.bottom<=height,'gain fits the viewport after rebuilding the HUD');
    await page.screenshot({path:`${output}/counting-${width}.png`});
  }
  await page.evaluate(()=>{const s=window.__rewardScene;s.pause();s.resume();s.app.stop();s.tickReward(100000);});
  assert.equal((await snapshot()).elapsed,400,'returning from a hidden/stopped view cannot consume the whole celebration');
  await tick(REWARD_COUNT_MS-400);const final=await snapshot();assert.equal(final.balance,'11,500');assert.equal(final.payout,'+2,500');assert.equal(final.busy,false);assert.equal(final.enabled,true);assert.equal(calls.length,settledCalls);assert.equal(ledger.balance,11500);
  await page.screenshot({path:output+'/exact-award.png'});await tick(REWARD_FADE_MS);assert.equal((await snapshot()).visible,false);
  checks.push('authoritative prize held until final outfit; staged count, resize, background recovery, exact +2500 and no extra financial calls');
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.__rewardScene.app.start());
  await page.evaluate(()=>{const s=window.__rewardScene,original=s.rewardPresentation.reveal.bind(s.rewardPresentation);s.rewardPresentation.reveal=()=>{const result=original();if(result)s.app.stop();return result;};});
  await page.getByRole('button',{name:'再次挑戰',exact:true}).click();await phase('selecting');assert.equal(ledger.balance,10500);
  await play();await phase('confirmed');await page.getByRole('button',{name:'下一局',exact:true}).click();await phase('selecting');await play();
  await page.waitForFunction(()=>{const s=window.__rewardScene;if(s.rewardPresentation.stage!=='showcase')return false;s.app.stop();return true;});
  assert.equal(ledger.balance,13000);assert.equal((await snapshot()).pose,2);assert.equal((await snapshot()).balance,'10,500');
  await tick(REWARD_SHOWCASE_MS);assert.equal((await snapshot()).payout,'+2,500');assert.equal((await snapshot()).balance,'13,000');
  checks.push('reduced motion preserves outfit-before-credit order and shows a static exact gain');
  await page.evaluate(()=>{const s=window.__rewardScene,original=s.rewardPresentation.hold.bind(s.rewardPresentation);s.rewardPresentation.hold=award=>{const result=original(award);if(result)s.app.stop();return result;};s.app.start();});
  await page.getByRole('button',{name:'再次挑戰',exact:true}).click();await phase('selecting');await play();await phase('confirmed');
  await page.getByRole('button',{name:'下一局',exact:true}).click();await phase('selecting');await play();
  await page.waitForFunction(()=>!!window.__rewardScene.rewardReveal&&window.__rewardScene.rewardPresentation.stage==='holding');
  assert.equal(ledger.balance,14500);assert.equal((await snapshot()).balance,'12,000');
  const posts=calls.length;await page.reload();await page.getByRole('button',{name:'選擇野球拳',exact:true}).click();
  await page.waitForFunction(()=>window.__rewardScene.screen==='characters');assert.equal((await snapshot()).balance,'14,500');assert.equal((await snapshot()).stage,'idle');assert.equal(calls.length,posts);
  checks.push('closing before the pending reveal callback keeps the authoritative balance without re-awarding or replaying the gain');
  outcome=4000;
  await page.getByRole('button',{name:'進入野球拳試玩',exact:true}).click();await phase('selecting');await play();await phase('confirmed');await page.getByRole('button',{name:'下一局',exact:true}).click();await phase('selecting');await play();await phase('confirmed');
  assert.equal(ledger.balance,13500);assert.equal(ledger.records[0].status,'lost');
  await page.getByRole('button',{name:'再次挑戰',exact:true}).waitFor();await page.getByRole('button',{name:'返回',exact:true}).waitFor();
  await page.waitForTimeout(1800);assert.equal(await page.evaluate(()=>window.__rewardScene.screen),'table','defeat remains visible beyond the former automatic exit deadline');
  const beforeRetry=calls.length;await page.evaluate(()=>{void window.__rewardScene.confirm();void window.__rewardScene.confirm();});await phase('selecting');
  assert.equal(ledger.balance,12500);assert.deepEqual(calls.slice(beforeRetry),['begin'],'repeated retry activation starts one new paid match');
  await play();await phase('confirmed');await page.getByRole('button',{name:'下一局',exact:true}).click();await phase('selecting');await play();await phase('confirmed');
  const beforeReturn=calls.length;await page.getByRole('button',{name:'返回',exact:true}).click();await page.waitForFunction(()=>window.__rewardScene.screen==='characters'&&!window.__rewardScene.entering);
  assert.equal(calls.length,beforeReturn,'returning from a finished match does not charge, refund or settle again');assert.equal(ledger.balance,12500);
  checks.push('slot reward tones follow visible amounts, mute independently, and both endings offer explicit retry/return with exactly one fee per new match');
  assert.deepEqual(errors,[]);writeFileSync(output+'/report.json',JSON.stringify({ok:true,checks,calls,errors},null,2));console.log(JSON.stringify({ok:true,checks:checks.length,output}));
}catch(error){writeFileSync(output+'/failure.json',JSON.stringify({error:error.stack,checks,calls,errors},null,2));throw error;}
finally{await browser?.close();await server.close();}
