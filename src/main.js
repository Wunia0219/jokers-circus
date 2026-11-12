import { mainArt } from './ui/shared/main-art.js';
import { icon } from './ui/shared/icons.js';
import { createPlayerBar } from './ui/player/player-bar.js';
import { checkinClaimFeedback,playerError } from './ui/player/player-copy.js';
import { createPlayerToast } from './ui/player/player-toast.js';
import { createWeeklyCheckin } from './ui/dialogs/weekly-checkin.js';
import { roundRecords,placeResetMarker } from './ui/player/player-records.js';
import './style.css';
import { SlotScene } from './ui/reels/scene.js';
import { Sound } from './ui/audio/audio.js';
import { MUSIC_SOURCE } from './ui/audio/audio-cues.js';
import {bindActivityMusic,startDefaultMusic} from './ui/audio/default-music.js';
import { presentRoundWin } from './ui/wins/round-win.js';
import { connectActivity, isDiscordActivity } from './platform/discord-activity.js';
import {connectDiscordTestActivity,discordTestBuild,discordTestMusic,testSessionFetch} from './platform/discord-test-activity.js';
import { connectLocalWallet } from './platform/local-wallet.js';
import { createLoadingScreen } from './ui/shared/loading.js';
import { showMaintenanceScreen } from './ui/shared/maintenance-screen.js';
import { BigWinPresentation } from './ui/wins/big-win.js';
import { createGameRules } from './ui/dialogs/game-rules.js';
import { applyProgrammeTheme } from './ui/shared/dialog-spec.js';
import { SpinControls } from './ui/reels/spin-controls.js';
import { bindSpinButton } from './ui/reels/spin-button.js';
import { installSpinShortcut } from './ui/reels/spin-shortcut.js';
import { roundFeedbackTiming } from './ui/reels/presentation.js';
import { setBitmapNumber } from './ui/shared/bitmap-number.js';
import { installResponsiveLayout } from './ui/shared/responsive-layout.js';
import { createWalletClient, hasPendingSpin } from './platform/wallet-client.js';
import { canEnterGame, readGameEntry } from './platform/game-entry.js';
import {createCasinoPresence} from './platform/casino-presence.js';
import {slotLobbyPath} from './platform/game-navigation.js';
import {fadeToLobby} from './platform/lobby-transition.js';
import {arcadeHost,ARCADE_SLOT_PATH,canReturnToLobby} from './platform/arcade-session.js';
import { BETS, SYMBOL_NAMES, MODEL_VERSION, drawStops, restoredStops, freshState, readState, createRound } from './game/index.js';

const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('en-US');
$('#app').innerHTML = `
  <header id="player-header" class="header"></header>
  <main>
    <section class="game-panel" aria-label="Joker’s Circus：五軸三列老虎機">
      <h1 class="sr-only">Joker’s Circus</h1>
      <div class="game-composition">
      <div class="game-stage"><div id="canvas-host"></div>
        <div id="celebration" aria-hidden="true"><span id="celebration-kicker">JOKER’S CIRCUS</span><strong id="celebration-title">馬戲團大獎</strong><b id="celebration-amount">+2,000</b><span id="celebration-note">聚光燈下，精彩即將揭曉。</span></div>
      </div>
      <div class="control-deck">
      <output id="payout-result" class="payout-result" aria-live="polite" aria-label="本局獲得戲籌"></output>
        <div class="bet-group"><label>BET <span>本局下注</span></label><div class="bets">${BETS.map(b=>'<button data-bet="'+b+'" aria-pressed="'+(b===100)+'">'+fmt(b)+'</button>').join('')}</div></div>
        <button id="auto-spin" class="gold-button" aria-label="自動旋轉" aria-pressed="false"><span>AUTO SPIN</span><small>自動旋轉</small></button>
        <button id="spin" class="spin" aria-label="旋轉一次" aria-keyshortcuts="Space" title="旋轉一次（空白鍵）" disabled>${mainArt('spin-button.png','spin-art')}</button>
        <button id="max-bet" class="gold-button"><span>MAX BET</span><small>最大下注</small></button>
        <div class="wallet"><span>COINS <small>戲籌餘額</small></span><strong id="balance">10,000</strong></div>
      </div>
      <div id="game-status" class="sr-only" role="status" aria-live="polite"></div>
      </div>
    </section>
  </main>
  <div id="player-toast" class="player-toast" role="status" aria-live="polite" aria-atomic="true" hidden></div>
  <dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-head"><h2 id="dialog-title"></h2><button id="close-dialog" class="icon-button" aria-label="關閉視窗">${icon('close')}</button></div><div id="dialog-body"></div></dialog>`;

installResponsiveLayout($('main'));
const KEY='kemet-slot-preview-v2';
let state, storageAvailable=true;
try { state=readState(localStorage.getItem(KEY)); } catch { state=freshState();storageAvailable=false; }
let bet=100, busy=false, presenting=false, ready=false, leavingLobby=false, countAnimation=0, payoutAnimation=0, celebrationTimer=0;
const loopbackWalletTest=location.protocol==='http:'&&location.hostname==='127.0.0.1'&&
  new URLSearchParams(location.search).get('wallet')==='local';
const arcade=location.pathname===ARCADE_SLOT_PATH?arcadeHost():null;
const entryEnabled=import.meta.env.PROD&&!arcade&&!discordTestBuild&&!loopbackWalletTest&&
  import.meta.env.VITE_DISCORD_WALLET_ENABLED==='true';
let entryClosing=false, maintenanceShown=false, entryCheck=null, activityIdentity, casinoPresence;
const activityMusic=arcade?.music??(discordTestBuild?discordTestMusic():null);
const scene=new SlotScene(), sound=new Sound({effectsEnabled:true,musicUrl:activityMusic?null:MUSIC_SOURCE,onStateChange:renderAudio});
const bigWin=new BigWinPresentation($('#app'));
let activityMode='browser', activityUser=null, walletClient=null, claiming=false, historySync=null, checkinPanel=null, checkinRetry=false;
const canUseSpin=()=>ready&&(!entryClosing||busy||walletClient?.hasPending());
const controls=new SpinControls({
  isReady:()=>canUseSpin()&&!leavingLobby&&!claiming&&!document.hidden&&!$('#dialog').open,
  isBusy:()=>busy,
  startSpin:()=>spin(),
  stopReels:()=>scene.requestQuickStop(),
  onAutoChange:enabled=>{
    const button=$('#auto-spin');
    button.setAttribute('aria-pressed',String(enabled));
    button.setAttribute('aria-label',enabled?'停止自動旋轉':'自動旋轉');
    button.innerHTML=enabled?'<span>STOP AUTO</span><small>停止自動</small>':'<span>AUTO SPIN</span><small>自動旋轉</small>';
    setBusy(busy);
  },
});
const renderSpinButton=bindSpinButton($('#spin'),controls);
const motion=matchMedia('(prefers-reduced-motion: reduce)');scene.reduced=motion.matches;motion.addEventListener('change',()=>scene.reduced=motion.matches);
const signed=n=>(n>0?'+':'')+fmt(n);
function save(next) { if(walletClient){if((next.revision||0)>=(state.revision||0))state=next;return;}state=next;try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageAvailable=false;} }
const lobbyPath=arcade?'/':slotLobbyPath(window.location);
const playerBar=createPlayerBar({icon,onCheckin:showCheckin,onHistory:showHistory,onRules:showRules,onSound:toggleSound,onMusic:toggleMusic,onLobby:lobbyPath?returnToLobby:undefined});
$('#player-header').append(playerBar.element);
function renderAudio(){
  playerBar.audio(activityMusic?{...sound.state,musicEnabled:activityMusic.enabled,musicAvailable:true}:sound.state);
}
renderAudio();
const effectsInput=new AbortController();
let stopMusic;
const unlockEffects=event=>{if(event.isTrusted)void sound.unlockEffects();};
function startGameAudio(){
  stopMusic=activityMusic?bindActivityMusic(activityMusic,renderAudio,{signal:effectsInput.signal}):startDefaultMusic(sound);
  document.addEventListener('pointerup',unlockEffects,{capture:true,signal:effectsInput.signal});
  document.addEventListener('keydown',unlockEffects,{capture:true,signal:effectsInput.signal});
}
if(!entryEnabled)startGameAudio();
addEventListener('pagehide',event=>{if(maintenanceShown)return;if(event.persisted)void sound.setVisible(false);else{effectsInput.abort();stopMusic?.();sound.dispose();}});
addEventListener('pageshow',event=>{if(event.persisted&&!maintenanceShown){leavingLobby=false;void sound.setVisible(true);void refreshEntry();}});
const checkinOptions=()=>({ready:ready&&!entryClosing&&!!walletClient,busy,claiming,preview:!walletClient,retry:checkinRetry&&!state.claimed});
function renderPlayer(){playerBar.update({user:activityUser,connected:!!walletClient,checkinPreview:!!lobbyPath&&!walletClient,localTest:activityMode==='local',ready:ready&&!entryClosing,busy,claiming,claimed:state.claimed,daily:state.daily,weeklyCheckin:state.weeklyCheckin,storageAvailable});if(checkinPanel?.element.isConnected&&$('#dialog').open)checkinPanel.update(walletClient?state:{},checkinOptions());updateLobbyButton();}
function updateLobbyButton(){
  const pending=walletClient?.hasPending()===true;
  playerBar.lobby({enabled:canReturnToLobby({ready,busy,claiming,pending}),note:busy||claiming?'正在完成這局或處理戲籌，完成後即可返回大廳。':pending?'上一局尚待確認，請先按 SPIN 找回結果。':'返回遊戲大廳'});
}
function returnToLobby(){
  if(leavingLobby || !lobbyPath || !canReturnToLobby({ready,busy,claiming,pending:walletClient?.hasPending()}))return;
  leavingLobby=true;controls.stopAuto();
  if(arcade)arcade.back(window);else void fadeToLobby($('#app'),lobbyPath);
}
const {show:notifyPlayer}=createPlayerToast($('#player-toast'));
function showPlayerError(error,context='game'){
  const copy=playerError(error,{context,canClaim:!!walletClient&&!state.claimed});
  if(error?.status===401){ready=false;setBusy(false);}
  const body=document.createElement('div'),message=document.createElement('p');message.textContent=copy.message;body.append(message);
  const supportCode=context==='game'?walletClient?.supportCode():null;
  if(supportCode){const code=document.createElement('p');code.textContent='回報碼 '+supportCode;code.style.overflowWrap='anywhere';body.append(code);}
  if(copy.reconnect){const retry=document.createElement('button');retry.className='notice-action';retry.textContent='重新開啟遊戲';retry.addEventListener('click',()=>location.reload());body.append(retry);}
  openDialog(copy.title,body);
}
async function refreshWallet(){if(!walletClient||busy||claiming||!ready||entryClosing)return;try{const update=await walletClient.state();if(!busy&&!claiming&&!entryClosing){save(update.state);renderState();}}catch(error){if(error.status===401&&!entryClosing)showPlayerError(error);}}
function enterMaintenance(){
  if(maintenanceShown||busy||claiming||walletClient?.hasPending())return;
  maintenanceShown=true;
  ready=false;
  $('#dialog').close();
  $('#app').inert=true;
  $('#app').hidden=true;
  cancelAnimationFrame(countAnimation);
  cancelAnimationFrame(payoutAnimation);
  effectsInput.abort();
  stopMusic?.();
  sound.dispose();
  casinoPresence?.dispose();
  if(scene.initTask){
    hideCelebration();
    void scene.destroy().catch(error=>console.warn('Stage cleanup unavailable:',error.message));
  }
  showMaintenanceScreen({pending:walletClient?.hasPending()});
}
function refreshEntry(){
  if(!entryEnabled||!ready||entryClosing||document.hidden)return;
  entryCheck ||= readGameEntry().then(entry=>{
    if(canEnterGame(entry,activityIdentity))return;
    entryClosing=true;
    controls.stopAuto();
    setBusy(busy);
    enterMaintenance();
  },()=>{/* Keep the last confirmed state during a status fetch failure. */})
    .finally(()=>{entryCheck=null;});
  return entryCheck;
}
function renderState() {
  setBitmapNumber($('#balance'),fmt(state.balance));
  renderPlayer();
}
function setBusy(value) {
  busy=value;
  renderSpinButton({busy,presenting,claiming,ready:canUseSpin()});
  $('#max-bet').disabled=value||claiming||!ready||entryClosing||controls.auto;
  $('#auto-spin').disabled=claiming||!ready||entryClosing;
  document.querySelectorAll('[data-bet]').forEach(b=>b.disabled=value||claiming||!ready||entryClosing||controls.auto);
  renderPlayer();
}
function result(title,detail) {
  $('#game-status').textContent=`${title} ${detail}`;
}
function showPayout(payout, animate=false) {
  cancelAnimationFrame(payoutAnimation);
  payoutAnimation=0;
  const output=$('#payout-result');
  output.setAttribute('aria-busy','false');
  output.setAttribute('aria-label',`本局獲得戲籌 ${fmt(payout)}`);
  if(payout<=0){setBitmapNumber(output,'');return;}
  if(!animate||scene.reduced){setBitmapNumber(output,signed(payout));return;}
  output.setAttribute('aria-busy','true');
  setBitmapNumber(output,'+0');
  const start=performance.now();
  const frame=now=>{
    const progress=scene.reduced?1:Math.min(Math.max((now-start)/1200,0),1);
    const value=progress===1?payout:Math.floor(payout*(1-(1-progress)**3));
    setBitmapNumber(output,`+${fmt(value)}`);
    if(progress<1)payoutAnimation=requestAnimationFrame(frame);
    else {payoutAnimation=0;output.setAttribute('aria-busy','false');}
  };
  payoutAnimation=requestAnimationFrame(frame);
}
function animateBalance(from,to) {
  cancelAnimationFrame(countAnimation);
  if(scene.reduced){setBitmapNumber($('#balance'),fmt(to));return;}
  const start=performance.now();
  const frame=now=>{const p=Math.min((now-start)/900,1);setBitmapNumber($('#balance'),fmt(from+(to-from)*(1-(1-p)**3)));if(p<1)countAnimation=requestAnimationFrame(frame);};countAnimation=requestAnimationFrame(frame);
}
function hideCelebration(){bigWin.hide();scene.clearCelebration();clearTimeout(celebrationTimer);$('#celebration').classList.remove('show');$('.game-panel').classList.remove('big-win');}
function clearWinReadout(){scene.clearWins();}
function presentWins(round){scene.showWins(round.wins);}
function celebrate(kind,amount) {
  hideCelebration();
  const milestone=kind==='milestone';
  if(!milestone){
    bigWin.show(amount,scene.reduced,kind);
    scene.celebrate(true,true);
    celebrationTimer=setTimeout(hideCelebration,4500);
    return;
  }
  $('#celebration').classList.toggle('milestone',milestone);
  $('#celebration-kicker').textContent=milestone?'A NEW CHAPTER':'JOKER’S CIRCUS';
  $('#celebration-title').textContent=milestone?'馬戲團里程碑':'馬戲團大獎';
  $('#celebration-amount').textContent=milestone?'12,000':`+${fmt(amount)}`;
  $('#celebration-note').textContent=milestone?'第一枚馬戲團徽章，已為你收藏。':'這一刻，傳說再次閃耀。';
  $('#celebration').classList.add('show');$('.game-panel').classList.add('big-win');
  scene.celebrate(!milestone,!milestone);scene.reactToMilestone();sound.win('big');
  celebrationTimer=setTimeout(hideCelebration,4500);
}
async function spin() {
  if(busy||!controls.isReady())return;
  controls.beginRound();
  setBusy(true);result('準備開轉…','');let nextDelay=650,settledRound;
  try{
    const recovering=walletClient?.hasPending()===true;
    // Request the authoritative result before animation; history follows in the background.
    const settlement=walletClient?walletClient.spin(bet,{deferHistory:true}):Promise.resolve(createRound(state,bet,drawStops(),crypto.randomUUID()));
    settlement.catch(()=>{});
    showPayout(0);cancelAnimationFrame(countAnimation);hideCelebration();clearWinReadout();
    // Preview a new wager only; recovering an old request must not show a second debit.
    if(!recovering&&state.balance>=bet)setBitmapNumber($('#balance'),fmt(state.balance-bet));
    scene.beginSpin();sound.spin();result('轉動中…',`本局下注 ${fmt(bet)}`);
    const update=await settlement;
    const r=update.round;save(update.state);settledRound=r;
    if(update.synchronized){
      historySync=update.synchronized.then(synced=>{save(synced.state);if(!busy&&!claiming)renderState();});
      historySync.catch(()=>{});
    }
    if(r.rules!==MODEL_VERSION){
      if(update.synchronized){const synced=await update.synchronized;save(synced.state);}
      scene.cancelSpin(restoredStops(state));
      controls.stopAuto();renderState();showPayout(r.payout);
      result('上一局的結果已找回',`獲得 ${fmt(r.payout)} 戲籌，沒有再次扣除下注。可在遊玩紀錄查看。`);
      return;
    }
    scene.prepareDealer(r);
    setBitmapNumber($('#balance'),fmt(r.before-r.bet));
    result('轉動中…',`本局下注 ${fmt(r.bet)}`);
    const animation=scene.spin(r.stops,i=>sound.stop(i));
    controls.animationStarted();
    if(document.hidden)scene.finish();
    await animation;
    presenting=true;setBusy(true);
    renderState();animateBalance(r.before-r.bet,state.balance);presentWins(r);showPayout(r.payout,true);
    const symbols=r.wins.length?r.wins.map(w=>`${SYMBOL_NAMES[w.symbol]} ${w.count} 連・${w.ways} 組`).join('、'):'這局沒有連出中獎組合';
    result(r.payout?`這局獲得 ${fmt(r.payout)} 戲籌`:'這局沒有得獎',`${symbols}｜戲籌變化 ${signed(r.net)}`);
    const tier=presentRoundWin(r,{sound,celebrate,celebrateSmall:()=>scene.celebrate()});
    scene.reactToRound(r);
    // Let the authored gesture return to its neutral pose before AUTO SPIN.
    const timing=roundFeedbackTiming(r,tier,scene.dealerFeedbackDuration(r));nextDelay=timing.autoDelay;
    if(r.milestone){clearTimeout(celebrationTimer);celebrationTimer=setTimeout(()=>celebrate('milestone',12000),tier?4500:1800);}
    // Space can shorten reel travel, but cannot cut off the resulting win.
    if(timing.hold&&!document.hidden)await new Promise(resolve=>setTimeout(resolve,timing.hold));
  }catch(error){
    scene.cancelSpin(restoredStops(state));
    controls.stopAuto();renderState();
    if(settledRound)showPayout(settledRound.payout);
    if(settledRound){const body=document.createElement('p');body.textContent='這局的結果已保存，可以到遊玩紀錄查看。自動旋轉已暫停。';openDialog('這局的結果已保存',body);}
    else showPlayerError(error);
  }finally{
    presenting=false;setBusy(false);controls.endRound(nextDelay);
    if(entryClosing)enterMaintenance();
  }
}
function openDialog(title,body,variant='notice') {
  controls.stopAuto();
  $('#dialog').className=`${variant}-dialog`;
  if(variant==='rules')applyProgrammeTheme($('#dialog'));
  $('#dialog-title').textContent=title;
  $('#dialog-body').replaceChildren();
  if(typeof body==='string')$('#dialog-body').innerHTML=body;
  else $('#dialog-body').append(body);
  if(!$('#dialog').open)$('#dialog').showModal();
  $('#dialog-body').scrollTop=0;
}
function showRules(){openDialog('遊戲規則',createGameRules(bet,state.weeklyCheckin?.rewards),'rules');}
function showCheckin(){
  if((!walletClient&&!lobbyPath)||!ready||entryClosing||busy||claiming)return;
  checkinPanel=createWeeklyCheckin({onClaim:claimDaily});checkinPanel.update(walletClient?state:{},checkinOptions());
  openDialog('週簽到',checkinPanel.element,'checkin');
}
async function showHistory(){
  if(historySync){
    const syncing=historySync;
    const pending=document.createElement('div');pending.className='records-loading';pending.textContent='正在載入紀錄…';
    openDialog('遊玩紀錄',pending,'records');
    try{await syncing;if(historySync===syncing)historySync=null;}
    catch{
      if(!$('#dialog').open||!pending.isConnected)return;
      pending.className='records-empty';pending.textContent='紀錄暫時載入失敗，請再試一次。';
      const retry=document.createElement('button');retry.className='notice-action';retry.textContent='重新載入';pending.append(retry);
      retry.addEventListener('click',()=>{historySync=walletClient.state().then(update=>save(update.state));historySync.catch(()=>{});showHistory();});
      return;
    }
    if(!$('#dialog').open||!pending.isConnected)return;
  }
  const body=roundRecords(state.history,{balanceReset:state.balanceReset});openDialog('遊玩紀錄',body,'records');
  if(!walletClient||!state.historyBefore||state.history.length<100)return;
  let cursor=state.historyBefore;
  const shown=[...state.history],balanceReset=state.balanceReset;
  const button=document.createElement('button'),status=document.createElement('p');
  button.type='button';button.className='notice-action';button.textContent='載入更早的紀錄';
  status.setAttribute('role','status');body.append(status,button);
  button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='正在載入紀錄…';
    try{
      const page=await walletClient.rounds(cursor),extra=roundRecords(page.rows.map(row=>row.round));
      for(const card of [...extra.querySelectorAll('.play-record')])body.insertBefore(card,status);
      shown.push(...page.rows.map(row=>row.round));placeResetMarker(body,shown,balanceReset);
      cursor=page.next;status.textContent=cursor?'':'已顯示所有遊玩紀錄。';button.hidden=!cursor;
      const caption=body.querySelector('.records-caption');
      if(caption)caption.textContent=`已顯示 ${body.querySelectorAll('.play-record').length} 局 · 點開一局查看得獎組合`;
    }catch{status.textContent='紀錄暫時載入失敗，請再試一次。';}
    finally{button.disabled=false;}
  });
}
async function claimDaily(){
  if(!walletClient||!ready||entryClosing||busy||claiming||state.claimed)return;
  const panel=checkinPanel;panel?.message('');
  controls.stopAuto();claiming=true;setBusy(busy);
  try{
    const update=await walletClient.checkin();checkinRetry=false;save(update.state);renderState();
    const message=checkinClaimFeedback(update);
    if(panel?.element.isConnected&&$('#dialog').open)panel.message(message,'success');else notifyPlayer(message);
  }catch(error){
    checkinRetry=error.status!==401;
    if(error.status===401)showPlayerError(error,'checkin');
    else if(panel?.element.isConnected&&$('#dialog').open)panel.message(playerError(error,{context:'checkin'}).message);
    else notifyPlayer(playerError(error,{context:'checkin'}).message,'info');
  }
  finally{claiming=false;setBusy(busy);if(entryClosing)enterMaintenance();}
}
async function toggleSound(){
  const button=$('#sound');button.disabled=true;button.setAttribute('aria-busy','true');
  try{
    const enable=!sound.enabled;
    const enabled=await sound.setEffectsEnabled(enable);
    if(enable&&!enabled)notifyPlayer('暫時無法播放音效，請稍後再試。','info');
    if(enabled)sound.win('return');
  }catch{notifyPlayer('暫時無法播放音效，請稍後再試。','info');}
  finally{renderAudio();button.setAttribute('aria-busy','false');}
}
async function toggleMusic(){
  if(!activityMusic&&!sound.musicAvailable)return;
  const button=$('#music');button.disabled=true;button.setAttribute('aria-busy','true');
  try{
    const enable=!(activityMusic?.enabled??sound.musicEnabled);
    const playing=await (activityMusic?activityMusic.setEnabled(enable):sound.setMusicEnabled(enable));
    if(!playing&&enable)notifyPlayer('暫時無法播放音樂，請稍後再試。','info');
  }finally{renderAudio();button.setAttribute('aria-busy','false');}
}
$('#max-bet').addEventListener('click',()=>{if(!busy)document.querySelector('[data-bet="500"]').click();});
// Pointer interaction has no persistent ring; Tab navigation keeps a gold cue.
document.addEventListener('pointerdown',()=>{document.documentElement.dataset.input='pointer';},true);
document.addEventListener('keydown',event=>{
  if(event.key==='Tab')document.documentElement.dataset.input='keyboard';
},true);
installSpinShortcut({target:document,controls,isBlocked:()=>document.hidden,isModalOpen:()=>$('#dialog').open});
$('#auto-spin').addEventListener('click',()=>controls.toggleAuto());
document.querySelectorAll('[data-bet]').forEach(b=>b.addEventListener('click',()=>{if(busy)return;bet=Number(b.dataset.bet);document.querySelectorAll('[data-bet]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
$('#close-dialog').addEventListener('click',()=>$('#dialog').close());
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#dialog').close();}});

document.addEventListener('visibilitychange',()=>{
  if(maintenanceShown)return;
  if(document.hidden){scene.setDealerVisible(false);controls.stopAuto();controls.stopCurrent();scene.finish();if(ready)scene.app.stop();sound.setVisible(false);}
  else {scene.setDealerVisible(true);if(ready)scene.app.start();sound.setVisible(true);void refreshGameStatus();}
});
window.addEventListener('focus',()=>void refreshEntry());
renderState();
// History restores the wallet and reels, but a new visit has no current win.
showPayout(0);
setBusy(false);
async function startGame() {
  const loading = createLoadingScreen();
  loading.update(8, '正在連線…');
  let previewActivity;
  if(entryEnabled){
    let entry;
    try{entry=await readGameEntry();}
    catch{loading.fail('暫時無法確認遊戲是否開放，請再試一次。');return;}
    if(entry.mode==='maintenance'){
      if(isDiscordActivity(window.location)){
        previewActivity=await connectActivity().catch(()=>null);
      }
      if(!canEnterGame(entry,previewActivity)){
        entryClosing=true;
        if(!hasPendingSpin(previewActivity?.session)){
          loading.dismiss();
          enterMaintenance();
          return;
        }
      }
    }
    startGameAudio();
  }
  let stageProgress, showStageProgress=false,casinoSession;
  const activityReady=arcade?Promise.resolve(arcade.connect(window)):discordTestBuild?connectDiscordTestActivity():
    connectLocalWallet(window.location).then(activity=>activity||previewActivity||connectActivity());
  const stageReady=Promise.all([scene.init($('#canvas-host'),(...progress)=>{
    stageProgress=progress;
    if(showStageProgress)loading.update(...progress);
  }),bigWin.prepare()]);
  // Stage preparation may fail before login finishes; report it after connection.
  stageReady.catch(()=>{});
  try {
    const activity=await activityReady;
    activityIdentity=activity;
    activityMode=activity.mode;
    activityUser=activity.user || null;
    if(activity.session){walletClient=createWalletClient(activity.session,arcade?.fetch??(discordTestBuild?testSessionFetch(activity):undefined));state=(await walletClient.state()).state;renderState();}
    if(activityMode==='discord'&&activity.session?.casinoNotifications)casinoSession=activity.session;
    if(activityMode==='discord'&&import.meta.env.VITE_DISCORD_WALLET_ENABLED==='true'&&!walletClient)throw new Error('帳號錢包尚未連接，請重新開啟活動。');
    renderPlayer();
    loading.update(20, '正在準備舞台');
    showStageProgress=true;
    if(stageProgress)loading.update(...stageProgress);
  } catch(error) {
    console.error(error);
    showStageProgress=false;bigWin.hide();
    void scene.destroy().catch(cleanup=>console.warn('Stage cleanup unavailable:',cleanup.message));
    const copy=playerError(error,{context:'connect'});loading.fail(copy.message);
    result(copy.title,copy.message);
    return;
  }
  try {
    await stageReady;
    renderState();
    scene.setStops(restoredStops(state));
    scene.app.render();
    await loading.finish();
    if(casinoSession){casinoPresence=createCasinoPresence(casinoSession);await casinoPresence.start();}
    ready=true;setBusy(false);
    if(entryClosing&&walletClient?.hasPending())result('上一局的結果仍待確認','維護期間可按 SPIN 確認上一局，不會再次下注。');
    void refreshEntry();
    setTimeout(()=>scene.preloadDealer(),0);
  } catch(error) {
    showStageProgress=false;
    bigWin.hide();void scene.destroy().catch(cleanup=>console.warn('Stage cleanup unavailable:',cleanup.message));
    console.error(error);const copy=playerError(error,{context:'load'});loading.fail(copy.message);result(copy.title,copy.message);
  }
}
startGame();
async function refreshGameStatus(){
  if(entryEnabled)await refreshEntry();
  await refreshWallet();
}
setTimeout(function pollWallet(){
  if(maintenanceShown)return;
  if(!document.hidden)void refreshGameStatus();
  setTimeout(pollWallet,15000+Math.floor(Math.random()*5000));
},15000+Math.floor(Math.random()*5000));
