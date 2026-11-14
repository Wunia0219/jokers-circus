import './arcade-lobby.css';
import {activityPath} from './game-navigation.js';
import {connectActivity} from './discord-activity.js';
import {authenticateActivity} from './discord-auth.js';
import {ARCADE_SLOT_PATH,createArcadeHost} from './arcade-session.js';
import {createLaunchScreen} from './launch-screen.js';
import {createActivityMusic} from './activity-music.js';
import {icon} from '../ui/shared/icons.js';
import {createLoadingScreen} from '../ui/shared/loading.js';
import {showMaintenanceScreen} from '../ui/shared/maintenance-screen.js';

const byId=id=>document.getElementById(id);
const lobby=byId('lobby'),frame=byId('arcade-game');
const status=byId('lobby-status'),retry=byId('lobby-retry'),featureStatus=byId('feature-status');
const musicButton=lobby.querySelector('.lobby-music');
const launch=createLaunchScreen(byId('launch-screen')),music=createActivityMusic();
const lifetime=new AbortController(),{signal}=lifetime;
let activity,view,refreshing,lastCard,displayed,refreshTimer,state,game,gameLoading;
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

function startGameLoading(){
  gameLoading?.dismiss();
  const screen=byId('game-loading').content.firstElementChild.cloneNode(true);
  const back=screen.querySelector('#loading-back');
  back.addEventListener('click',returnToLobby);
  frame.inert=true;
  document.body.append(screen);
  const loading=createLoadingScreen({screen,app:frame,onRetry:()=>{
    startGameLoading();
    frame.src=frame.src;
  }});
  const deadline=setTimeout(()=>gameLoading.fail(),45000);
  gameLoading={
    update:loading.update,
    async finish(){
      clearTimeout(deadline);
      await loading.finish();
      if(gameLoading!==this)return false;
      gameLoading=null;
      frame.focus();
      return true;
    },
    fail(message='舞台暫時無法載入。'){
      clearTimeout(deadline);
      loading.fail(message);
      back.hidden=false;
    },
    dismiss(){clearTimeout(deadline);loading.dismiss();},
  };
  loading.update(8,'正在連線…');
}
function enter(path,index){
  if(!activity||lobby.hidden||lobby.inert||(index===0?state.slot:state.feature?.mode)!=='open')return;
  lastCard=index;
  game=new AbortController();
  if(index===1)startGameLoading();
  lobby.hidden=true;
  view.setVisible(false);
  frame.src=activityPath(location,path);
  frame.hidden=false;
  if(index===0)frame.focus();
  void watchGame(game.signal);
}
function stopGame(){
  game?.abort();
  game=null;
  gameLoading?.dismiss();
  gameLoading=null;
  frame.inert=false;
  frame.hidden=true;
  frame.removeAttribute('src');
}
function returnToLobby(){
  stopGame();
  lobby.hidden=false;
  view.setVisible(!document.hidden);
  view.focus(lastCard);
  void refresh();
}
async function render(next){
  if(state&&next.revision<state.revision)return;
  state=next;
  const hidden=lastCard===1&&!next.feature;
  if(game&&(lastCard===0?next.slot==='maintenance':hidden||next.feature.mode==='maintenance')){
    stopGame();
    const notice=showMaintenanceScreen({
      onBack:()=>{notice.remove();returnToLobby();},
      ...(hidden?{title:'即將揭曉',message:'遊戲預告已更新，請返回大廳。'}:{}),
    });
  }
  if(displayed===next.revision)return;
  const slot={
    onPress:next.slot==='open'?()=>enter(ARCADE_SLOT_PATH,0):null,
    status:next.slot==='open'?undefined:'維護中',
  };
  if(!next.feature){
    view.show({slot});
    featureStatus.textContent='即將揭曉';
  }else{
    if(displayed===undefined)view.show({slot});
    const {image,title,path,mode}=next.feature;
    const texture=await view.loadCover(image);
    if(state.revision!==next.revision)return;
    const caption=mode==='maintenance'?'維護中':undefined;
    view.show({slot,feature:{texture,name:title,onPress:caption?null:()=>enter(path,1),status:caption}});
    featureStatus.textContent=caption||title;
  }
  displayed=next.revision;
}
async function watchGame(gameSignal){
  while(!gameSignal.aborted){
    try{
      const response=await fetch('/api/arcade?after='+state.revision,{cache:'no-store',
        signal:AbortSignal.any([gameSignal,AbortSignal.timeout(15000)])});
      if(!response.ok)throw new Error('暫時無法確認遊戲是否開放，請再試一次。');
      if(response.status!==204){
        const next=await response.json();
        // A previous Worker version may return a snapshot for a watch request.
        if(next.revision===state.revision)await new Promise(resolve=>setTimeout(resolve,1000));
        if(!gameSignal.aborted)await render(next);
      }
    }catch{
      if(!gameSignal.aborted)await new Promise(resolve=>setTimeout(resolve,1000));
    }
  }
}
function refresh(){
  refreshing ||= (async()=>{
    const response=await fetch('/api/arcade',{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('暫時無法確認遊戲是否開放，請再試一次。');
    await render(await response.json());
    status.textContent='';
    retry.hidden=true;
    return true;
  })().catch(()=>{
    status.textContent='暫時無法確認遊戲是否開放，請再試一次。';
    retry.hidden=false;
    return false;
  }).finally(()=>{refreshing=null;});
  return refreshing;
}
frame.addEventListener('return-to-lobby',returnToLobby,{signal});
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
  if(!document.hidden&&activity&&!lobby.inert&&(game||!lobby.hidden))void refresh();
}
document.addEventListener('visibilitychange',visibility,{signal});
window.addEventListener('focus',visibility,{signal});
window.addEventListener('pageshow',visibility,{signal});
window.addEventListener('pagehide',event=>{
  music.setVisible(false);view?.setVisible(false);
  if(event.persisted)return;
  clearTimeout(timeout);clearInterval(refreshTimer);stopGame();
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
    ()=>authenticateActivity(activity.sdk,import.meta.env.VITE_DISCORD_CLIENT_ID,fetch,true),frame,music.controls,
    {entryLoading:()=>gameLoading,onMaintenance:()=>void refresh()})});
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
  clearInterval(refreshTimer);
  lifetime.abort();safeAreaObserver.disconnect();music.dispose();
  console.error('無法開啟遊戲大廳。',error);
  launch.fail();
}
