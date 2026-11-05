export const PREVIEW_LOBBY_PATH='/yakyuken-preview.html';
export const PREVIEW_SLOT_PATH='/?lobby=preview';
const discordTest=import.meta.env?.VITE_DISCORD_TEST_ACTIVITY==='true';
export function activityPath(location,path){
  const target=new URL(path,location.href);
  const source=new URLSearchParams(location.search);
  for(const key of ['frame_id','instance_id','platform','guild_id','channel_id','location_id','launch_id','custom_id','referrer_id','mobile_app_version','discord_shim'])if(source.has(key))target.searchParams.set(key,source.get(key));
  return target.pathname+target.search;
}
export function slotEntryPath(location,test=discordTest){return test?activityPath(location,'/slot/'):PREVIEW_SLOT_PATH;}

// The lobby is currently a local preview, not part of the deployed slot entry.
export function slotLobbyPath(location,test=discordTest){
  if(test)return activityPath(location,'/');
  return location.protocol==='http:' && location.hostname==='127.0.0.1' && new URLSearchParams(location.search).get('lobby')==='preview'?PREVIEW_LOBBY_PATH:null;
}
export function canReturnToLobby({ready,busy,claiming,pending}){return !!ready && !busy && !claiming && !pending;}
