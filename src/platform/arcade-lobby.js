import './arcade-lobby.css';
import slotCover from '../../images/lobby/slot-cover-v2.webp';
import teaserCover from '../../images/lobby/teaser.webp';
import {activityPath} from './game-navigation.js';
import {connectActivity} from './discord-activity.js';
import {authenticateActivity} from './discord-auth.js';
import {ARCADE_SLOT_PATH,createArcadeHost} from './arcade-session.js';
import {hasPendingSpin} from './wallet-client.js';

const byId=id=>document.getElementById(id);
const lobby=byId('lobby'),frame=byId('arcade-game'),slot=byId('slot'),feature=byId('feature');
const status=byId('lobby-status'),retry=byId('lobby-retry'),cover=byId('feature-cover'),title=byId('feature-title');
byId('slot-cover').src=slotCover;
byId('teaser-cover').src=teaserCover;
let activity,latest,refreshing,lastButton;

function render(state){
  latest=state;
  const recover=!!activity&&hasPendingSpin(activity.session);
  slot.textContent=state.slot==='open'?'進入遊戲':recover?'確認上一局':'維護中';
  slot.disabled=!activity||(state.slot!=='open'&&!recover);
  if(!state.feature){
    feature.hidden=true;
    title.textContent='即將揭曉';
    cover.closest('.card').classList.remove('revealed');
    cover.removeAttribute('src');
    return;
  }
  const reveal=()=>{
    if(!latest.feature)return;
    cover.closest('.card').classList.add('revealed');
    const unlock=()=>{
      if(!latest.feature)return;
      title.textContent=latest.feature.title;
      feature.hidden=false;
      feature.textContent=latest.feature.mode==='paused'?'暫停開放 · 續局／紀錄':'進入遊戲';
      feature.disabled=!activity;
    };
    if(feature.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      clearTimeout(revealTimer);
      revealTimer=setTimeout(unlock,420);
    }else unlock();
  };
  if(cover.getAttribute('src')!==state.feature.image)cover.src=state.feature.image;
  if(cover.complete&&cover.naturalWidth)reveal();
  else cover.onload=reveal;
}
let revealTimer;
cover.onerror=()=>{
  cover.removeAttribute('src');
  status.textContent='卡圖暫時無法載入。';
  retry.hidden=false;
};
function refresh(){
  refreshing ||= (async()=>{
    const response=await fetch('/api/arcade',{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('營運狀態暫時無法更新。');
    render(await response.json());
    status.textContent='';
    retry.hidden=true;
  })().catch(()=>{
    status.textContent='營運狀態暫時無法更新。';
    retry.hidden=false;
  }).finally(()=>{refreshing=null;});
  return refreshing;
}
function enter(path,button){
  if(!path||!activity||button.disabled||lobby.hidden)return;
  lastButton=button;
  frame.src=activityPath(location,path);
  lobby.hidden=true;
  frame.hidden=false;
  frame.focus();
}
slot.addEventListener('click',()=>enter(ARCADE_SLOT_PATH,slot));
feature.addEventListener('click',()=>enter(latest?.feature?.path,feature));
frame.addEventListener('return-to-lobby',()=>{
  frame.hidden=true;
  frame.removeAttribute('src');
  lobby.hidden=false;
  lastButton?.focus();
  void refresh();
});
function syncSafeArea(){
  try{
    for(const edge of ['top','right','bottom','left']){
      const key='--discord-safe-area-inset-'+edge;
      frame.contentDocument.documentElement.style.setProperty(key,getComputedStyle(document.documentElement).getPropertyValue(key));
    }
  }catch{}
}
frame.addEventListener('load',syncSafeArea);
new MutationObserver(syncSafeArea).observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});
const refreshVisible=()=>{if(activity&&!document.hidden&&!lobby.hidden)void refresh();};
document.addEventListener('visibilitychange',refreshVisible);
window.addEventListener('focus',refreshVisible);
setInterval(refreshVisible,15000);
retry.addEventListener('click',()=>activity?void refresh():location.reload());

try{
  activity=await connectActivity({authEnabled:true,walletEnabled:true});
  if(!activity.session||!['production','test'].includes(activity.session.environment)||activity.session.discordTest)
    throw new Error('此入口需要 Discord 活動登入。');
  Object.defineProperty(window,'__circusArcade',{value:createArcadeHost(activity,
    ()=>authenticateActivity(activity.sdk,import.meta.env.VITE_DISCORD_CLIENT_ID,fetch,true),frame)});
  await refresh();
}catch{
  activity=null;
  status.textContent='暫時無法登入，請從 Discord 重新開啟活動。';
  retry.hidden=false;
}
