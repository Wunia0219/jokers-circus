import {authenticateActivity} from './discord-auth.js';

// Only the test shell owns the SDK. Child documents reuse it without sending a
// second handshake to Discord; OAuth tokens never cross this boundary.
export function createDiscordTestHost({activity,location,clientId,fetchImpl=globalThis.fetch}){
  const scope=['frame_id','instance_id','guild_id','channel_id','platform'];
  let renewal=null;
  const renew=()=>renewal||=(async()=>{
    const next=await authenticateActivity(activity.sdk,clientId,fetchImpl,true);
    if(next.session.userId!==activity.session.userId||next.session.guildId!==activity.session.guildId||!next.session.discordTest||next.session.environment!=='test')throw new Error('測試登入身分不符，請關閉活動後重新啟動。');
    activity.session=next.session;activity.user=next.user;
    return next.session;
  })().finally(()=>{renewal=null;});
  return Object.freeze({
    async connect(childLocation){
      const target=new URL(childLocation.href),source=new URL(location.href);
      if(target.origin!==source.origin||!['/yakyuken-preview.html','/slot/'].includes(target.pathname)||scope.some(key=>target.searchParams.get(key)!==source.searchParams.get(key)))throw new Error('測試活動連線範圍不符。');
      let response=await fetchImpl('/api/session',{headers:{Authorization:'Bearer '+activity.session.token},cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(response.status===401){await renew();response=await fetchImpl('/api/session',{headers:{Authorization:'Bearer '+activity.session.token},cache:'no-store',signal:AbortSignal.timeout(15000)});}
      if(!response.ok)throw new Error('測試登入驗證失敗，請關閉活動後重新啟動。');
      const principal=await response.json(),session=activity.session;
      if(principal.guild!==session.guildId||principal.user!==session.userId||principal.player!==`d_${session.guildId}_${session.userId}`)throw new Error('測試登入身分不符，請關閉活動後重新啟動。');
      return {mode:'discord',sdk:activity.sdk,user:{...activity.user},session:{...session},reauthorize:renew};
    },
  });
}

export function parentDiscordTestHost(){
  try{return window.parent!==window&&window.parent.location.origin===window.location.origin?window.parent.__discordTestHost:null;}catch{return null;}
}
