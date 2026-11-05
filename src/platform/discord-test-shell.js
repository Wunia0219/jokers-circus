import {connectDiscordTestActivity} from './discord-test-activity.js';
import {createDiscordTestHost} from './discord-test-host.js';
import {activityPath} from './game-navigation.js';

const status=document.querySelector('#status'),frame=document.querySelector('#game');
try{
  // A new outer document establishes one SDK connection. Only inner game
  // documents navigate, keeping commands and reauthorization available.
  const activity=await connectDiscordTestActivity({storage:null,host:null});
  Object.defineProperty(window,'__discordTestHost',{value:createDiscordTestHost({activity,location,clientId:import.meta.env.VITE_DISCORD_CLIENT_ID})});
  frame.src=activityPath(location,'/yakyuken-preview.html');
  const safeAreas=()=>{try{for(const edge of ['top','bottom','left','right']){const key='--discord-safe-area-inset-'+edge,value=getComputedStyle(document.documentElement).getPropertyValue(key).trim(),style=frame.contentDocument.documentElement.style;if(value)style.setProperty(key,value);else style.removeProperty(key);}}catch{}};
  frame.addEventListener('load',safeAreas);addEventListener('resize',safeAreas);
  frame.hidden=false;status.hidden=true;
}catch(error){status.textContent=error.message;}
