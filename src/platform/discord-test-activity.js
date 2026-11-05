import {connectActivity,isDiscordActivity} from './discord-activity.js';
import {authenticateActivity} from './discord-auth.js';
import {parentDiscordTestHost} from './discord-test-host.js';
const CHANNEL='1564243344857632818',GUILD='760012177326997544';
export const discordTestBuild=import.meta.env?.VITE_DISCORD_TEST_ACTIVITY==='true';
export async function connectDiscordTestActivity({location=window.location,storage=globalThis.sessionStorage,fetchImpl=globalThis.fetch,connect=connectActivity,host=parentDiscordTestHost(),...options}={}){
  if(!isDiscordActivity(location))throw new Error('請從 Discord 指定測試頻道啟動遊戲。');
  const params=new URLSearchParams(location.search),clientId=options.clientId||import.meta.env?.VITE_DISCORD_CLIENT_ID;
  if(params.get('guild_id')!==GUILD||params.get('channel_id')!==CHANNEL||!params.get('frame_id')||!params.get('instance_id'))throw new Error('請從指定的 Discord 測試頻道啟動。');
  if(host)return host.connect(location);
  const key='jokers-circus:discord-test-session:'+JSON.stringify([clientId,params.get('frame_id'),params.get('instance_id')]);
  const saveTestSession=session=>{try{storage?.setItem(key,JSON.stringify({token:session.token,expiresAt:session.expiresAt,userId:session.userId,guildId:session.guildId,environment:session.environment,discordTest:session.discordTest,walletEpoch:session.walletEpoch}));}catch{}};
  let cached;try{cached=JSON.parse(storage?.getItem(key)||'null');}catch{}
  if(cached){
    if(cached.environment!=='test'||!cached.discordTest||cached.guildId!==GUILD||!/^\d{17,20}$/.test(cached.userId||'')||typeof cached.token!=='string'||!cached.token){try{storage?.removeItem(key);}catch{}throw new Error('測試登入資訊無效，請關閉活動後重新啟動。');}
    let response;try{response=await fetchImpl('/api/session',{headers:{Authorization:'Bearer '+cached.token},cache:'no-store',signal:AbortSignal.timeout(15000)});}catch{throw new Error('測試雲端暫時無法連線，請重新載入。');}
    if(!response.ok){if([401,403].includes(response.status)){try{storage?.removeItem(key);}catch{}}throw new Error([401,403].includes(response.status)?'測試登入已過期，請關閉活動後重新啟動。':'測試雲端暫時無法連線，請重新載入。');}
    const principal=await response.json();
    if(principal.guild!==GUILD||principal.user!==cached.userId||principal.player!==`d_${GUILD}_${cached.userId}`){try{storage?.removeItem(key);}catch{}throw new Error('測試登入身分不符，請關閉活動後重新啟動。');}
    return {mode:'discord',sdk:null,user:{id:principal.user,username:principal.name,global_name:principal.name,avatar:null},session:cached,saveTestSession};
  }
  const activity=await connect({location,fetchImpl,...options});
  if(!activity.session?.discordTest||activity.session.environment!=='test')throw new Error('此入口只接受獨立 Discord 測試錢包。');
  if(activity.sdk.channelId!==CHANNEL)throw new Error('請從指定的 Discord 測試頻道啟動。');
  saveTestSession(activity.session);activity.saveTestSession=saveTestSession;
  return activity;
}
export function testReauthorization(activity,clientId=import.meta.env?.VITE_DISCORD_CLIENT_ID){
  if(activity.reauthorize)return activity.reauthorize;
  return async()=>{
    if(!activity.sdk)throw new Error('測試登入已過期，請關閉活動後重新啟動；未確認操作會保留。');
    const renewed=await authenticateActivity(activity.sdk,clientId,globalThis.fetch.bind(globalThis),true);
    activity.saveTestSession?.(renewed.session);
    return renewed.session;
  };
}

// Slot requests retain the exact serialized operation on a single 401 retry.
// The ordinary production wallet client and its timing stay unchanged.
export function testSessionFetch(activity,fetchImpl=globalThis.fetch){
  return async(path,options)=>{
    const send=()=>fetchImpl(path,{...options,headers:{...options.headers,Authorization:'Bearer '+activity.session.token}});
    const response=await send();
    if(response.status!==401)return response;
    const renewed=await testReauthorization(activity)();
    if(renewed.userId!==activity.session.userId||renewed.guildId!==activity.session.guildId||!renewed.discordTest||renewed.environment!=='test')throw new Error('測試登入身分不符，請關閉活動後重新啟動。');
    activity.session=renewed;return send();
  };
}
