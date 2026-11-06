import {activityPath} from './game-navigation.js';
import {createLaunchScreen} from './launch-screen.js';
import {LOBBY_READY_EVENT,LOBBY_FAILED_EVENT} from './launch-protocol.js';

const frame=document.querySelector('#game'),launch=createLaunchScreen(document.querySelector('#launch-screen'));
const abort=new AbortController();let awaitingLobby=false;
const timeout=setTimeout(()=>{awaitingLobby=false;launch.fail();},45000);
addEventListener('message',async event=>{
  if(!awaitingLobby||event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.type===LOBBY_FAILED_EVENT){awaitingLobby=false;clearTimeout(timeout);launch.fail();}
  if(event.data?.type===LOBBY_READY_EVENT){
    awaitingLobby=false;clearTimeout(timeout);
    if(await launch.finish()){frame.inert=false;frame.removeAttribute('aria-hidden');}
  }
},{signal:abort.signal});
addEventListener('pagehide',event=>{if(!event.persisted){clearTimeout(timeout);abort.abort();launch.destroy();}},{signal:abort.signal});
try{
  // Paint the independent launch screen before downloading/handshaking SDK.
  const [{connectDiscordTestActivity},{createDiscordTestHost}]=await Promise.all([import('./discord-test-activity.js'),import('./discord-test-host.js')]);
  // A new outer document establishes one SDK connection. Only inner game
  // documents navigate, keeping commands and reauthorization available.
  const activity=await connectDiscordTestActivity({storage:null,host:null});
  if(abort.signal.aborted)throw new Error('Activity closed');
  Object.defineProperty(window,'__discordTestHost',{value:createDiscordTestHost({activity,location,clientId:import.meta.env.VITE_DISCORD_CLIENT_ID})});
  awaitingLobby=true;frame.src=activityPath(location,'/yakyuken-preview.html');
  const safeAreas=()=>{try{for(const edge of ['top','bottom','left','right']){const key='--discord-safe-area-inset-'+edge,value=getComputedStyle(document.documentElement).getPropertyValue(key).trim(),style=frame.contentDocument.documentElement.style;if(value)style.setProperty(key,value);else style.removeProperty(key);}}catch{}};
  frame.addEventListener('load',safeAreas,{signal:abort.signal});addEventListener('resize',safeAreas,{signal:abort.signal});
  frame.hidden=false;
}catch{awaitingLobby=false;clearTimeout(timeout);launch.fail();}
