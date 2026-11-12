import './arcade-lobby.css';
import {activityPath} from './game-navigation.js';
import {connectActivity} from './discord-activity.js';
import {authenticateActivity} from './discord-auth.js';
import {ARCADE_SLOT_PATH,createArcadeHost} from './arcade-session.js';
import {hasPendingSpin} from './wallet-client.js';
import {createLaunchScreen} from './launch-screen.js';
import {createActivityMusic} from './activity-music.js';
import {icon} from '../ui/shared/icons.js';

const byId=id=>document.getElementById(id);
const lobby=byId('lobby'),frame=byId('arcade-game');
const status=byId('lobby-status'),retry=byId('lobby-retry'),featureStatus=byId('feature-status');
const musicButton=lobby.querySelector('.lobby-music');
const launch=createLaunchScreen(byId('launch-screen')),music=createActivityMusic();
const lifetime=new AbortController(),{signal}=lifetime;
let activity,view,refreshing,lastCard,displayed,refreshTimer;
const timeout=setTimeout(()=>launch.fail(),45000);

function updateMusic(){
  const {enabled}=music.controls;
  musicButton.setAttribute('aria-pressed',String(enabled));
  musicButton.title=enabled?'關閉背景音樂':'開啟背景音樂';
  musicButton.innerHTML=icon(enabled?'music':'musicMuted');
}
musicButton.addEventListener('click',()=>void music.controls.setEnabled(!music.controls.enabled),{signal});
lobby.addEventListener('pointerdown',music.controls.resumeFromGesture,{signal});
lobby.addEventListener('keydown',music.controls.resumeFromGesture,{signal});
music.controls.subscribe(updateMusic);
updateMusic();

function enter(path,index){
  if(!activity||lobby.hidden||lobby.inert)return;
  lastCard=index;
  frame.src=activityPath(location,path);
  lobby.hidden=true;
  view.setVisible(false);
  frame.hidden=false;
  frame.focus();
}
async function render(state){
  const recover=hasPendingSpin(activity.session);
  const displayKey=JSON.stringify([state.revision,state.slot,state.feature,recover]);
  if(displayed===displayKey)return;
  const slot={
    onPress:state.slot==='open'||recover?()=>enter(ARCADE_SLOT_PATH,0):null,
    status:state.slot==='open'?undefined:recover?'確認上一局':'維護中',
  };
  if(!state.feature){
    view.show({slot});
    featureStatus.textContent='即將揭曉';
  }else{
    if(!displayed)view.show({slot});
    const {image,title,path,mode}=state.feature;
    const texture=await view.loadCover(image);
    const caption=mode==='paused'?'暫停開放 · 續局／紀錄':undefined;
    view.show({slot,feature:{texture,name:title,onPress:()=>enter(path,1),status:caption}});
    featureStatus.textContent=caption||title;
  }
  displayed=displayKey;
}
function refresh(){
  refreshing ||= (async()=>{
    const response=await fetch('/api/arcade',{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('營運狀態暫時無法更新。');
    await render(await response.json());
    status.textContent='';
    retry.hidden=true;
    return true;
  })().catch(()=>{
    status.textContent='營運狀態暫時無法更新。';
    retry.hidden=false;
    return false;
  }).finally(()=>{refreshing=null;});
  return refreshing;
}
frame.addEventListener('return-to-lobby',()=>{
  frame.hidden=true;
  frame.removeAttribute('src');
  lobby.hidden=false;
  view.setVisible(!document.hidden);
  view.focus(lastCard);
  void refresh();
},{signal});
function syncSafeArea(){
  try{
    for(const edge of ['top','bottom','left','right']){
      const key='--discord-safe-area-inset-'+edge;
      frame.contentDocument.documentElement.style.setProperty(key,getComputedStyle(document.documentElement).getPropertyValue(key));
    }
  }catch{}
}
frame.addEventListener('load',syncSafeArea,{signal});
const safeAreaObserver=new MutationObserver(syncSafeArea);
safeAreaObserver.observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});

function visibility(){
  music.setVisible(!document.hidden);
  view?.setVisible(!document.hidden&&!lobby.hidden);
  if(!document.hidden&&activity&&!lobby.hidden&&!lobby.inert)void refresh();
}
document.addEventListener('visibilitychange',visibility,{signal});
window.addEventListener('focus',visibility,{signal});
window.addEventListener('pageshow',visibility,{signal});
window.addEventListener('pagehide',event=>{
  music.setVisible(false);view?.setVisible(false);
  if(event.persisted)return;
  clearTimeout(timeout);clearInterval(refreshTimer);
  safeAreaObserver.disconnect();launch.destroy();music.dispose();lifetime.abort();
},{signal});
retry.addEventListener('click',()=>void refresh(),{signal});
visibility();

try{
  [activity,view]=await Promise.all([
    connectActivity({authEnabled:true,walletEnabled:true,lockMobileOrientation:false}),
    import('./arcade-lobby-view.js').then(({createArcadeLobbyView})=>createArcadeLobbyView(byId('lobby-stage'),signal)),
  ]);
  if(!activity.session||!['production','test'].includes(activity.session.environment)||activity.session.discordTest)
    throw new Error('此入口需要 Discord 活動登入。');
  Object.defineProperty(window,'__circusArcade',{value:createArcadeHost(activity,
    ()=>authenticateActivity(activity.sdk,import.meta.env.VITE_DISCORD_CLIENT_ID,fetch,true),frame,music.controls)});
  if(!await refresh())throw new Error('無法取得遊戲入口狀態。');
  clearTimeout(timeout);
  if(await launch.finish()){
    lobby.inert=false;
    activity.restoreMobilePortrait?.();
    music.start();
    visibility();
    refreshTimer=setInterval(()=>{if(!document.hidden&&!lobby.hidden)void refresh();},15000);
  }
}catch(error){
  clearTimeout(timeout);
  console.error('無法開啟遊戲大廳。',error);
  launch.fail();
}
